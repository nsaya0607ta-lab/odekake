-- =============================================================
-- SNS（フレンド間の日替わり写真共有）
-- =============================================================
-- BeReal 風に、フレンド同士でその日撮った写真を1つの場に投稿し合う機能。
-- 「今日のフォルダ」は日付（Asia/Tokyo基準）ごとに分かれ、投稿できるのは
-- その日のうちだけ（photo_date は常にDB側で「今日」を採番し、クライアントの
-- 指定を信用しない）。
--
-- 公開範囲は自分視点: 見えるのは自分の投稿と、直接フレンドの投稿だけ
-- （フレンドのフレンドは見えない）。友達関係は既存の public.friendships /
-- public.is_friend() をそのまま使う。
--
-- exp_events 等と同じく、テーブルへの直接アクセスは一切許可せず
-- （RLS 有効・ポリシーなし）、SECURITY DEFINER の RPC 経由でのみ操作する。
begin;

do $$
declare
  v_missing text[] := '{}';
  v_table text;
begin
  foreach v_table in array array['profiles', 'friendships'] loop
    if to_regclass('public.' || v_table) is null then
      v_missing := array_append(v_missing, 'public.' || v_table);
    end if;
  end loop;

  if cardinality(v_missing) > 0 then
    raise exception using
      errcode = 'P0001',
      message = 'FRIEND_PHOTOS_SNS_MISSING_DEPENDENCIES: ' || array_to_string(v_missing, ', '),
      hint = 'odekakeアプリが現在利用しているSupabaseプロジェクトで実行してください。';
  end if;

  if to_regprocedure('public.is_friend(uuid)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'FRIEND_PHOTOS_SNS_MISSING_DEPENDENCY: public.is_friend(uuid)',
      hint = '先に 0019_friends.sql を適用してください。';
  end if;
end;
$$;

create table if not exists public.friend_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_date date not null,
  storage_path text not null unique,
  caption text,
  created_at timestamptz not null default now(),
  constraint friend_photos_caption_length check (caption is null or char_length(caption) <= 300)
);

create index if not exists friend_photos_user_date_idx
  on public.friend_photos(user_id, photo_date desc, created_at);
create index if not exists friend_photos_date_idx
  on public.friend_photos(photo_date desc, created_at);

create table if not exists public.friend_photo_reactions (
  photo_id uuid not null references public.friend_photos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id),
  constraint friend_photo_reactions_emoji_length check (char_length(emoji) between 1 and 8)
);

create table if not exists public.friend_photo_comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.friend_photos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint friend_photo_comments_body_length check (char_length(body) between 1 and 1000)
);

create index if not exists friend_photo_comments_photo_idx
  on public.friend_photo_comments(photo_id, created_at);

alter table public.friend_photos enable row level security;
alter table public.friend_photo_reactions enable row level security;
alter table public.friend_photo_comments enable row level security;

-- 直接のテーブルアクセスは許可しない。以降の SECURITY DEFINER RPC だけを経路にする。
revoke all on public.friend_photos from public, anon, authenticated;
revoke all on public.friend_photo_reactions from public, anon, authenticated;
revoke all on public.friend_photo_comments from public, anon, authenticated;

-- -------------------------------------------------------------
-- 写真の投稿・削除
-- -------------------------------------------------------------
create or replace function public.create_friend_photo(
  p_storage_path text,
  p_caption text default null
)
returns table (id uuid, photo_date date, created_at timestamptz)
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_caption text := nullif(trim(coalesce(p_caption, '')), '');
  v_row public.friend_photos;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_storage_path is null or length(trim(p_storage_path)) = 0 then
    raise exception using errcode = 'P0001', message = 'STORAGE_PATH_REQUIRED';
  end if;
  if v_caption is not null and char_length(v_caption) > 300 then
    raise exception using errcode = 'P0001', message = 'CAPTION_TOO_LONG';
  end if;

  insert into public.friend_photos (user_id, photo_date, storage_path, caption)
  values (v_user_id, (now() at time zone 'Asia/Tokyo')::date, p_storage_path, v_caption)
  returning * into v_row;

  return query select v_row.id, v_row.photo_date, v_row.created_at;
end;
$$;

revoke all on function public.create_friend_photo(text, text) from public, anon;
grant execute on function public.create_friend_photo(text, text) to authenticated;

create or replace function public.delete_friend_photo(p_photo_id uuid)
returns text
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_path text;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  delete from public.friend_photos
  where id = p_photo_id and user_id = v_user_id
  returning storage_path into v_path;

  if v_path is null then
    raise exception using errcode = 'P0001', message = 'PHOTO_NOT_FOUND';
  end if;

  return v_path;
end;
$$;

revoke all on function public.delete_friend_photo(uuid) from public, anon;
grant execute on function public.delete_friend_photo(uuid) to authenticated;

-- 写真が自分の投稿か、直接フレンドの投稿かを判定する（見えている前提での操作用）
create or replace function public.can_view_friend_photo(p_photo_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.friend_photos fp
    where fp.id = p_photo_id
      and (fp.user_id = auth.uid() or public.is_friend(fp.user_id))
  );
$$;

revoke all on function public.can_view_friend_photo(uuid) from public, anon, authenticated;

-- -------------------------------------------------------------
-- 一覧取得（プロフィールと集計をまとめて返す）
-- -------------------------------------------------------------
create or replace function public.get_sns_feed(p_days integer default 14)
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  profile_image_url text,
  photo_date date,
  storage_path text,
  caption text,
  created_at timestamptz,
  my_reaction text,
  reaction_count bigint,
  comment_count bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    fp.id,
    fp.user_id,
    p.display_name,
    p.profile_image_url,
    fp.photo_date,
    fp.storage_path,
    fp.caption,
    fp.created_at,
    mine.emoji as my_reaction,
    coalesce(reactions.n, 0) as reaction_count,
    coalesce(comments.n, 0) as comment_count
  from public.friend_photos fp
  join public.profiles p on p.user_id = fp.user_id
  left join lateral (
    select r.emoji from public.friend_photo_reactions r
    where r.photo_id = fp.id and r.user_id = auth.uid()
  ) mine on true
  left join lateral (
    select count(*) as n from public.friend_photo_reactions r where r.photo_id = fp.id
  ) reactions on true
  left join lateral (
    select count(*) as n from public.friend_photo_comments c where c.photo_id = fp.id
  ) comments on true
  where auth.uid() is not null
    and (fp.user_id = auth.uid() or public.is_friend(fp.user_id))
    and fp.photo_date >= (now() at time zone 'Asia/Tokyo')::date - greatest(coalesce(p_days, 14), 1) + 1
  order by fp.photo_date desc, fp.created_at asc;
$$;

revoke all on function public.get_sns_feed(integer) from public, anon;
grant execute on function public.get_sns_feed(integer) to authenticated;

-- -------------------------------------------------------------
-- リアクション（1人1写真につき1つ、絵文字を選び直し可）
-- -------------------------------------------------------------
create or replace function public.set_friend_photo_reaction(p_photo_id uuid, p_emoji text)
returns void
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_emoji text := nullif(trim(coalesce(p_emoji, '')), '');
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not public.can_view_friend_photo(p_photo_id) then
    raise exception using errcode = 'P0001', message = 'PHOTO_NOT_FOUND';
  end if;

  if v_emoji is null then
    delete from public.friend_photo_reactions where photo_id = p_photo_id and user_id = v_user_id;
    return;
  end if;

  if char_length(v_emoji) > 8 then
    raise exception using errcode = 'P0001', message = 'EMOJI_TOO_LONG';
  end if;

  insert into public.friend_photo_reactions (photo_id, user_id, emoji)
  values (p_photo_id, v_user_id, v_emoji)
  on conflict (photo_id, user_id) do update set emoji = excluded.emoji, created_at = now();
end;
$$;

revoke all on function public.set_friend_photo_reaction(uuid, text) from public, anon;
grant execute on function public.set_friend_photo_reaction(uuid, text) to authenticated;

-- -------------------------------------------------------------
-- コメント
-- -------------------------------------------------------------
create or replace function public.add_friend_photo_comment(p_photo_id uuid, p_body text)
returns table (
  id uuid,
  photo_id uuid,
  user_id uuid,
  display_name text,
  profile_image_url text,
  body text,
  created_at timestamptz
)
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_body text := trim(coalesce(p_body, ''));
  v_row public.friend_photo_comments;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if v_body = '' then
    raise exception using errcode = 'P0001', message = 'COMMENT_EMPTY';
  end if;
  if char_length(v_body) > 1000 then
    raise exception using errcode = 'P0001', message = 'COMMENT_TOO_LONG';
  end if;
  if not public.can_view_friend_photo(p_photo_id) then
    raise exception using errcode = 'P0001', message = 'PHOTO_NOT_FOUND';
  end if;

  insert into public.friend_photo_comments (photo_id, user_id, body)
  values (p_photo_id, v_user_id, v_body)
  returning * into v_row;

  return query
    select v_row.id, v_row.photo_id, v_row.user_id, p.display_name, p.profile_image_url, v_row.body, v_row.created_at
    from public.profiles p
    where p.user_id = v_row.user_id;
end;
$$;

revoke all on function public.add_friend_photo_comment(uuid, text) from public, anon;
grant execute on function public.add_friend_photo_comment(uuid, text) to authenticated;

create or replace function public.get_friend_photo_comments(p_photo_id uuid)
returns table (
  id uuid,
  photo_id uuid,
  user_id uuid,
  display_name text,
  profile_image_url text,
  body text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select c.id, c.photo_id, c.user_id, p.display_name, p.profile_image_url, c.body, c.created_at
  from public.friend_photo_comments c
  join public.profiles p on p.user_id = c.user_id
  where c.photo_id = p_photo_id and public.can_view_friend_photo(p_photo_id)
  order by c.created_at asc;
$$;

revoke all on function public.get_friend_photo_comments(uuid) from public, anon;
grant execute on function public.get_friend_photo_comments(uuid) to authenticated;

create or replace function public.delete_friend_photo_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  delete from public.friend_photo_comments
  where id = p_comment_id and user_id = v_user_id
  returning id into v_deleted;

  if v_deleted is null then
    raise exception using errcode = 'P0001', message = 'COMMENT_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.delete_friend_photo_comment(uuid) from public, anon;
grant execute on function public.delete_friend_photo_comment(uuid) to authenticated;

-- -------------------------------------------------------------
-- Storage: friend-photos/{user_id}/{date}/... の読み書き
-- -------------------------------------------------------------
create or replace function public.can_access_storage_path(p_name text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  parts text[] := storage.foldername(p_name);
begin
  if auth.uid() is null then
    return false;
  end if;

  if (parts[1] = 'tmp' or parts[1] = 'users') and parts[2] = auth.uid()::text then
    return true;
  end if;

  if parts[1] = 'trips' then
    begin
      return public.can_access_trip(parts[2]::uuid);
    exception when others then
      return false;
    end;
  end if;

  if parts[1] = 'friend-photos' and parts[2] = auth.uid()::text then
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.can_access_storage_path(text) from public, anon;
grant execute on function public.can_access_storage_path(text) to authenticated;

create or replace function public.can_view_friend_storage_path(p_name text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  parts text[] := storage.foldername(p_name);
  v_owner uuid;
  v_trip uuid;
  v_visit uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  if parts[1] = 'users' and parts[3] = 'profile' then
    begin
      v_owner := parts[2]::uuid;
    exception when others then
      return false;
    end;

    return exists (
      select 1
      from public.profiles p
      join public.friendships f
        on f.user_id = auth.uid()
       and f.friend_user_id = p.user_id
      where p.user_id = v_owner
        and p.profile_image_url = p_name
    );
  end if;

  if parts[1] = 'trips' and parts[3] = 'visits' then
    begin
      v_trip := parts[2]::uuid;
      v_visit := parts[4]::uuid;
    exception when others then
      return false;
    end;

    return exists (
      select 1
      from public.visit_photos vp
      join public.visit_records vr
        on vr.id = vp.visit_record_id
       and vr.user_id = vp.user_id
      join public.friendships f
        on f.user_id = auth.uid()
       and f.friend_user_id = vr.user_id
      left join public.friend_privacy_settings ps
        on ps.user_id = vr.user_id
      where vp.storage_path = p_name
        and vr.id = v_visit
        and vr.trip_id = v_trip
        and coalesce(ps.show_recent_visits, true)
    );
  end if;

  if parts[1] = 'friend-photos' then
    begin
      v_owner := parts[2]::uuid;
    exception when others then
      return false;
    end;

    return exists (
      select 1
      from public.friend_photos fp
      where fp.storage_path = p_name
        and fp.user_id = v_owner
        and public.is_friend(v_owner)
    );
  end if;

  return false;
end;
$$;

revoke all on function public.can_view_friend_storage_path(text) from public, anon;
grant execute on function public.can_view_friend_storage_path(text) to authenticated;

drop policy if exists photos_select on storage.objects;
create policy photos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and (
      public.can_access_storage_path(name)
      or public.can_view_friend_storage_path(name)
    )
  );

commit;

notify pgrst, 'reload schema';

select
  'FRIEND_PHOTOS_SNS_READY'::text as status,
  to_regclass('public.friend_photos') is not null as table_ok,
  has_function_privilege('authenticated', 'public.create_friend_photo(text, text)', 'EXECUTE') as create_ok,
  has_function_privilege('authenticated', 'public.get_sns_feed(integer)', 'EXECUTE') as feed_ok,
  has_function_privilege('authenticated', 'public.set_friend_photo_reaction(uuid, text)', 'EXECUTE') as reaction_ok,
  has_function_privilege('authenticated', 'public.add_friend_photo_comment(uuid, text)', 'EXECUTE') as comment_ok;
