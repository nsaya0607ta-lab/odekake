-- =============================================================
-- わんこのおへや：フレンドの部屋にあそびに行く
-- =============================================================
-- ・user_rooms.showcase … 部屋に飾ったもののうち、見る人の側だけでは描けないもの
--   （おさんぽのトロフィーの記録・おでかけの写真の場所と日付・犬のスキン）を、保存のたびに持ち主が書く。
-- ・get_friend_room … フレンドだけが、相手の部屋（飾り方と showcase）を見られる
-- ・room_likes / room_notes … フレンドの部屋への「いいね」と置き手紙
-- ・get_room_mailbox … 自分の部屋に届いた「いいね」と置き手紙（送った人の名前つき）
-- ・部屋にアップロードした写真（users/{id}/room/）は、その部屋に飾っている間だけフレンドも見られる
begin;

do $$
begin
  if to_regclass('public.user_rooms') is null then
    raise exception using
      errcode = 'P0001',
      message = 'FRIEND_ROOMS_MIGRATION_MISSING_DEPENDENCY: public.user_rooms',
      hint = 'わんこのおへや（0109_my_room.sql）を先に適用してください。';
  end if;
  if to_regclass('public.friendships') is null then
    raise exception using
      errcode = 'P0001',
      message = 'FRIEND_ROOMS_MIGRATION_MISSING_DEPENDENCY: public.friendships',
      hint = 'フレンド機能（0019_friends.sql）を先に適用してください。';
  end if;
end;
$$;

alter table public.user_rooms
  add column if not exists showcase jsonb not null default '{}'::jsonb;

alter table public.user_rooms drop constraint if exists user_rooms_showcase_object;
alter table public.user_rooms add constraint user_rooms_showcase_object check (jsonb_typeof(showcase) = 'object');
alter table public.user_rooms drop constraint if exists user_rooms_showcase_size;
alter table public.user_rooms add constraint user_rooms_showcase_size check (pg_column_size(showcase) <= 65536);

-- -------------------------------------------------------------
-- いいね（1人1部屋1つ）
-- -------------------------------------------------------------
create table if not exists public.room_likes (
  room_owner uuid not null references auth.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (room_owner, user_id),
  constraint room_likes_not_self check (room_owner <> user_id)
);
create index if not exists room_likes_user_id_idx on public.room_likes(user_id);

alter table public.room_likes enable row level security;

drop policy if exists room_likes_select on public.room_likes;
create policy room_likes_select on public.room_likes for select to authenticated
  using (user_id = auth.uid() or room_owner = auth.uid());

drop policy if exists room_likes_insert_friend on public.room_likes;
create policy room_likes_insert_friend on public.room_likes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.friendships f where f.user_id = auth.uid() and f.friend_user_id = room_owner)
  );

drop policy if exists room_likes_delete_own on public.room_likes;
create policy room_likes_delete_own on public.room_likes for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on public.room_likes to authenticated;

-- -------------------------------------------------------------
-- 置き手紙（60文字まで）
-- -------------------------------------------------------------
create table if not exists public.room_notes (
  id uuid primary key default gen_random_uuid(),
  room_owner uuid not null references auth.users(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint room_notes_not_self check (room_owner <> author_id),
  constraint room_notes_body_length check (char_length(btrim(body)) between 1 and 60)
);
create index if not exists room_notes_owner_created_idx on public.room_notes(room_owner, created_at desc);
create index if not exists room_notes_author_idx on public.room_notes(author_id, created_at desc);

alter table public.room_notes enable row level security;

drop policy if exists room_notes_select on public.room_notes;
create policy room_notes_select on public.room_notes for select to authenticated
  using (author_id = auth.uid() or room_owner = auth.uid());

drop policy if exists room_notes_insert_friend on public.room_notes;
create policy room_notes_insert_friend on public.room_notes for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.friendships f where f.user_id = auth.uid() and f.friend_user_id = room_owner)
  );

-- 書いた人は取り消せて、部屋の持ち主は片づけられる
drop policy if exists room_notes_delete on public.room_notes;
create policy room_notes_delete on public.room_notes for delete to authenticated
  using (author_id = auth.uid() or room_owner = auth.uid());

grant select, insert, delete on public.room_notes to authenticated;

-- -------------------------------------------------------------
-- フレンドの部屋
-- -------------------------------------------------------------
create or replace function public.get_friend_room(p_friend_user_id uuid)
returns table (
  display_name text,
  layout jsonb,
  showcase jsonb,
  like_count integer,
  liked boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    coalesce(p.display_name, 'フレンド') as display_name,
    r.layout,
    r.showcase,
    (select count(*)::integer from public.room_likes l where l.room_owner = p_friend_user_id) as like_count,
    exists (select 1 from public.room_likes l where l.room_owner = p_friend_user_id and l.user_id = auth.uid()) as liked
  from (select 1) seed
  left join public.profiles p on p.user_id = p_friend_user_id
  left join public.user_rooms r on r.user_id = p_friend_user_id
  where public.is_friend(p_friend_user_id);
$$;

revoke all on function public.get_friend_room(uuid) from public, anon;
grant execute on function public.get_friend_room(uuid) to authenticated;

-- 自分の部屋に届いたもの（新しい順）
create or replace function public.get_room_mailbox(p_limit integer default 20)
returns table (
  kind text,
  id text,
  user_id uuid,
  display_name text,
  body text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select * from (
    select 'note'::text, n.id::text, n.author_id, coalesce(p.display_name, 'フレンド'), n.body, n.created_at
    from public.room_notes n
    left join public.profiles p on p.user_id = n.author_id
    where n.room_owner = auth.uid()
    union all
    select 'like'::text, l.user_id::text, l.user_id, coalesce(p.display_name, 'フレンド'), null::text, l.created_at
    from public.room_likes l
    left join public.profiles p on p.user_id = l.user_id
    where l.room_owner = auth.uid()
  ) m
  order by 6 desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

revoke all on function public.get_room_mailbox(integer) from public, anon;
grant execute on function public.get_room_mailbox(integer) to authenticated;

-- -------------------------------------------------------------
-- 部屋に飾っているアップロード写真は、フレンドも見られる
-- -------------------------------------------------------------
create or replace function public.can_view_friend_room_path(p_name text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  parts text[] := storage.foldername(p_name);
  v_owner uuid;
begin
  if auth.uid() is null or parts[1] is distinct from 'users' or parts[3] is distinct from 'room' then
    return false;
  end if;
  begin
    v_owner := parts[2]::uuid;
  exception when others then
    return false;
  end;
  return exists (
    select 1
    from public.user_rooms r
    join public.friendships f on f.user_id = auth.uid() and f.friend_user_id = r.user_id
    cross join lateral jsonb_array_elements(case when jsonb_typeof(r.layout -> 'photos') = 'array' then r.layout -> 'photos' else '[]'::jsonb end) ph
    where r.user_id = v_owner
      and (ph ->> 'path' = p_name or regexp_replace(ph ->> 'path', '\.([a-z]+)$', '-thumb.\1') = p_name)
  );
end;
$$;

revoke all on function public.can_view_friend_room_path(text) from public, anon;
grant execute on function public.can_view_friend_room_path(text) to authenticated;

drop policy if exists photos_select on storage.objects;
create policy photos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and (
      public.can_access_storage_path(name)
      or public.can_view_friend_storage_path(name)
      or public.can_view_friend_room_path(name)
      or (storage.foldername(name))[1] = 'notices'
    )
  );

comment on column public.user_rooms.showcase is
  'フレンドが部屋を見るときに使う、飾ったものの見た目（{dog, trophies: {key: {...}}, photos: {key: {path, name, date, comment, pref}}}）。保存のたびに持ち主が書く。';

commit;

notify pgrst, 'reload schema';
