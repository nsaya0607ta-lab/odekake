-- =============================================================
-- SNS: フレンドグループ（写真＋チャット）
-- =============================================================
-- 0044 で作った「フレンド全員で1つの共有フォルダ」に加えて、フレンドの中から
-- 選んだメンバーだけのグループを作れるようにする。
--   - グループには「今日のフォルダ」と同じ形の写真投稿（friend_photos.group_id）と、
--     Twitterのタイムラインのような短文チャット（friend_group_messages）がある。
--   - 作成・メンバー追加は作成者（オーナー）のみ。参加者は自分の意思で退出できる。
--   - 未読バッジは「画面を表示したときにサーバーで判定する」方式（リアルタイム配信はしない）。
--     friend_group_reads.last_read_at より新しい投稿・メッセージがあれば未読とみなす。
begin;

do $$
begin
  if to_regclass('public.friend_photos') is null then
    raise exception using
      errcode = 'P0001',
      message = 'FRIEND_GROUPS_MISSING_DEPENDENCY: public.friend_photos',
      hint = '先に 0044_friend_photos_sns.sql を適用してください。';
  end if;
end;
$$;

create table if not exists public.friend_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  constraint friend_groups_name_length check (char_length(trim(name)) between 1 and 40)
);

create table if not exists public.friend_group_members (
  group_id uuid not null references public.friend_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists friend_group_members_user_idx on public.friend_group_members(user_id);

create table if not exists public.friend_group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.friend_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint friend_group_messages_body_length check (char_length(body) between 1 and 1000)
);

create index if not exists friend_group_messages_group_idx
  on public.friend_group_messages(group_id, created_at desc);

create table if not exists public.friend_group_reads (
  group_id uuid not null references public.friend_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- friend_photos をグループの写真置き場としても使う（group_id が null なら従来どおり全フレンド共有）
alter table public.friend_photos add column if not exists group_id uuid references public.friend_groups(id) on delete cascade;
create index if not exists friend_photos_group_idx
  on public.friend_photos(group_id, photo_date desc, created_at);

alter table public.friend_groups enable row level security;
alter table public.friend_group_members enable row level security;
alter table public.friend_group_messages enable row level security;
alter table public.friend_group_reads enable row level security;

revoke all on public.friend_groups from public, anon, authenticated;
revoke all on public.friend_group_members from public, anon, authenticated;
revoke all on public.friend_group_messages from public, anon, authenticated;
revoke all on public.friend_group_reads from public, anon, authenticated;

-- -------------------------------------------------------------
-- メンバー判定
-- -------------------------------------------------------------
create or replace function public.is_friend_group_member(p_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.friend_group_members m
    where m.group_id = p_group_id and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_friend_group_member(uuid) from public, anon, authenticated;

-- can_view_friend_photo を、グループの写真にも対応させる
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
      and (
        (fp.group_id is null and (fp.user_id = auth.uid() or public.is_friend(fp.user_id)))
        or (fp.group_id is not null and public.is_friend_group_member(fp.group_id))
      )
  );
$$;

-- -------------------------------------------------------------
-- グループの作成・メンバー管理
-- -------------------------------------------------------------
create or replace function public.create_friend_group(p_name text, p_member_user_ids uuid[])
returns uuid
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_group_id uuid;
  v_member uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 40 then
    raise exception using errcode = 'P0001', message = 'GROUP_NAME_INVALID';
  end if;

  insert into public.friend_groups (owner_id, name) values (v_user_id, v_name)
  returning id into v_group_id;

  insert into public.friend_group_members (group_id, user_id) values (v_group_id, v_user_id);

  if p_member_user_ids is not null then
    foreach v_member in array p_member_user_ids loop
      if v_member <> v_user_id and public.is_friend(v_member) then
        insert into public.friend_group_members (group_id, user_id)
        values (v_group_id, v_member)
        on conflict do nothing;
      end if;
    end loop;
  end if;

  return v_group_id;
end;
$$;

revoke all on function public.create_friend_group(text, uuid[]) from public, anon;
grant execute on function public.create_friend_group(text, uuid[]) to authenticated;

create or replace function public.add_friend_group_members(p_group_id uuid, p_member_user_ids uuid[])
returns void
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_member uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not exists (select 1 from public.friend_groups g where g.id = p_group_id and g.owner_id = v_user_id) then
    raise exception using errcode = 'P0001', message = 'GROUP_OWNER_ONLY';
  end if;

  if p_member_user_ids is not null then
    foreach v_member in array p_member_user_ids loop
      if v_member <> v_user_id and public.is_friend(v_member) then
        insert into public.friend_group_members (group_id, user_id)
        values (p_group_id, v_member)
        on conflict do nothing;
      end if;
    end loop;
  end if;
end;
$$;

revoke all on function public.add_friend_group_members(uuid, uuid[]) from public, anon;
grant execute on function public.add_friend_group_members(uuid, uuid[]) to authenticated;

create or replace function public.leave_friend_group(p_group_id uuid)
returns void
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if exists (select 1 from public.friend_groups g where g.id = p_group_id and g.owner_id = v_user_id) then
    raise exception using errcode = 'P0001', message = 'OWNER_CANNOT_LEAVE';
  end if;

  delete from public.friend_group_members where group_id = p_group_id and user_id = v_user_id;
  delete from public.friend_group_reads where group_id = p_group_id and user_id = v_user_id;
end;
$$;

revoke all on function public.leave_friend_group(uuid) from public, anon;
grant execute on function public.leave_friend_group(uuid) to authenticated;

create or replace function public.delete_friend_group(p_group_id uuid)
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

  delete from public.friend_groups where id = p_group_id and owner_id = v_user_id
  returning id into v_deleted;

  if v_deleted is null then
    raise exception using errcode = 'P0001', message = 'GROUP_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.delete_friend_group(uuid) from public, anon;
grant execute on function public.delete_friend_group(uuid) to authenticated;

create or replace function public.get_friend_group_members(p_group_id uuid)
returns table (user_id uuid, display_name text, profile_image_url text, is_owner boolean)
language sql
security definer
stable
set search_path = public
as $$
  select m.user_id, p.display_name, p.profile_image_url, (g.owner_id = m.user_id) as is_owner
  from public.friend_group_members m
  join public.profiles p on p.user_id = m.user_id
  join public.friend_groups g on g.id = m.group_id
  where m.group_id = p_group_id and public.is_friend_group_member(p_group_id)
  order by is_owner desc, m.joined_at asc;
$$;

revoke all on function public.get_friend_group_members(uuid) from public, anon;
grant execute on function public.get_friend_group_members(uuid) to authenticated;

create or replace function public.mark_friend_group_read(p_group_id uuid)
returns void
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not public.is_friend_group_member(p_group_id) then
    raise exception using errcode = 'P0001', message = 'GROUP_NOT_FOUND';
  end if;

  insert into public.friend_group_reads (group_id, user_id, last_read_at)
  values (p_group_id, v_user_id, now())
  on conflict (group_id, user_id) do update set last_read_at = excluded.last_read_at;
end;
$$;

revoke all on function public.mark_friend_group_read(uuid) from public, anon;
grant execute on function public.mark_friend_group_read(uuid) to authenticated;

create or replace function public.get_my_friend_groups()
returns table (
  id uuid,
  name text,
  owner_id uuid,
  member_count bigint,
  created_at timestamptz,
  has_unread boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    g.id,
    g.name,
    g.owner_id,
    (select count(*) from public.friend_group_members mm where mm.group_id = g.id) as member_count,
    g.created_at,
    exists (
      select 1 from public.friend_photos fp
      where fp.group_id = g.id
        and fp.user_id <> auth.uid()
        and fp.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
      union all
      select 1 from public.friend_group_messages gm
      where gm.group_id = g.id
        and gm.user_id <> auth.uid()
        and gm.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
    ) as has_unread
  from public.friend_groups g
  join public.friend_group_members m on m.group_id = g.id and m.user_id = auth.uid()
  left join public.friend_group_reads r on r.group_id = g.id and r.user_id = auth.uid()
  order by g.created_at asc;
$$;

revoke all on function public.get_my_friend_groups() from public, anon;
grant execute on function public.get_my_friend_groups() to authenticated;

-- -------------------------------------------------------------
-- グループのチャット（Twitterのタイムラインのような短文投稿）
-- -------------------------------------------------------------
create or replace function public.create_friend_group_message(p_group_id uuid, p_body text)
returns table (
  id uuid,
  group_id uuid,
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
  v_row public.friend_group_messages;
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
  if not public.is_friend_group_member(p_group_id) then
    raise exception using errcode = 'P0001', message = 'GROUP_NOT_FOUND';
  end if;

  insert into public.friend_group_messages (group_id, user_id, body)
  values (p_group_id, v_user_id, v_body)
  returning * into v_row;

  return query
    select v_row.id, v_row.group_id, v_row.user_id, p.display_name, p.profile_image_url, v_row.body, v_row.created_at
    from public.profiles p
    where p.user_id = v_row.user_id;
end;
$$;

revoke all on function public.create_friend_group_message(uuid, text) from public, anon;
grant execute on function public.create_friend_group_message(uuid, text) to authenticated;

create or replace function public.get_friend_group_messages(p_group_id uuid, p_limit integer default 50)
returns table (
  id uuid,
  group_id uuid,
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
  select gm.id, gm.group_id, gm.user_id, p.display_name, p.profile_image_url, gm.body, gm.created_at
  from public.friend_group_messages gm
  join public.profiles p on p.user_id = gm.user_id
  where gm.group_id = p_group_id and public.is_friend_group_member(p_group_id)
  order by gm.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

revoke all on function public.get_friend_group_messages(uuid, integer) from public, anon;
grant execute on function public.get_friend_group_messages(uuid, integer) to authenticated;

create or replace function public.delete_friend_group_message(p_message_id uuid)
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

  delete from public.friend_group_messages
  where id = p_message_id and user_id = v_user_id
  returning id into v_deleted;

  if v_deleted is null then
    raise exception using errcode = 'P0001', message = 'COMMENT_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.delete_friend_group_message(uuid) from public, anon;
grant execute on function public.delete_friend_group_message(uuid) to authenticated;

-- -------------------------------------------------------------
-- グループの写真投稿・一覧
-- -------------------------------------------------------------
-- シグネチャが変わる（p_group_id を追加）ため、古い2引数版はオーバーロードとして
-- 残ってしまい呼び出しが曖昧になる。明示的に消してから作り直す。
drop function if exists public.create_friend_photo(text, text);

create or replace function public.create_friend_photo(
  p_storage_path text,
  p_caption text default null,
  p_group_id uuid default null
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
  if p_group_id is not null and not public.is_friend_group_member(p_group_id) then
    raise exception using errcode = 'P0001', message = 'GROUP_NOT_FOUND';
  end if;

  insert into public.friend_photos (user_id, photo_date, storage_path, caption, group_id)
  values (v_user_id, (now() at time zone 'Asia/Tokyo')::date, p_storage_path, v_caption, p_group_id)
  returning * into v_row;

  return query select v_row.id, v_row.photo_date, v_row.created_at;
end;
$$;

revoke all on function public.create_friend_photo(text, text, uuid) from public, anon;
grant execute on function public.create_friend_photo(text, text, uuid) to authenticated;

create or replace function public.get_sns_group_feed(p_group_id uuid, p_days integer default 30)
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
  where fp.group_id = p_group_id
    and public.is_friend_group_member(p_group_id)
    and fp.photo_date >= (now() at time zone 'Asia/Tokyo')::date - greatest(coalesce(p_days, 30), 1) + 1
  order by fp.photo_date desc, fp.created_at asc;
$$;

revoke all on function public.get_sns_group_feed(uuid, integer) from public, anon;
grant execute on function public.get_sns_group_feed(uuid, integer) to authenticated;

-- 1枚だけを取得する（全体フィード・グループフィードのどちらでも使える共通の詳細取得）
create or replace function public.get_sns_photo(p_photo_id uuid)
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  profile_image_url text,
  photo_date date,
  storage_path text,
  caption text,
  created_at timestamptz,
  group_id uuid,
  group_name text,
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
    fp.group_id,
    g.name as group_name,
    mine.emoji as my_reaction,
    coalesce(reactions.n, 0) as reaction_count,
    coalesce(comments.n, 0) as comment_count
  from public.friend_photos fp
  join public.profiles p on p.user_id = fp.user_id
  left join public.friend_groups g on g.id = fp.group_id
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
  where fp.id = p_photo_id and public.can_view_friend_photo(fp.id);
$$;

revoke all on function public.get_sns_photo(uuid) from public, anon;
grant execute on function public.get_sns_photo(uuid) to authenticated;

-- get_sns_feed は全フレンド共有（グループに属さない）写真だけを返すようにする
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
    and fp.group_id is null
    and (fp.user_id = auth.uid() or public.is_friend(fp.user_id))
    and fp.photo_date >= (now() at time zone 'Asia/Tokyo')::date - greatest(coalesce(p_days, 14), 1) + 1
  order by fp.photo_date desc, fp.created_at asc;
$$;

revoke all on function public.get_sns_feed(integer) from public, anon;
grant execute on function public.get_sns_feed(integer) to authenticated;

-- -------------------------------------------------------------
-- Storage: friend-photos/{user_id}/group/{group_id}/{date}/... の読み書き
-- -------------------------------------------------------------
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
  v_group uuid;
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

  if parts[1] = 'friend-photos' and parts[3] = 'group' then
    begin
      v_group := parts[4]::uuid;
    exception when others then
      return false;
    end;

    return exists (
      select 1 from public.friend_photos fp
      where fp.storage_path = p_name
        and fp.group_id = v_group
        and public.is_friend_group_member(v_group)
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
        and fp.group_id is null
        and public.is_friend(v_owner)
    );
  end if;

  return false;
end;
$$;

revoke all on function public.can_view_friend_storage_path(text) from public, anon;
grant execute on function public.can_view_friend_storage_path(text) to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'FRIEND_GROUPS_READY'::text as status,
  to_regclass('public.friend_groups') is not null as table_ok,
  has_function_privilege('authenticated', 'public.create_friend_group(text, uuid[])', 'EXECUTE') as create_group_ok,
  has_function_privilege('authenticated', 'public.get_my_friend_groups()', 'EXECUTE') as list_groups_ok,
  has_function_privilege('authenticated', 'public.get_sns_group_feed(uuid, integer)', 'EXECUTE') as group_feed_ok,
  has_function_privilege('authenticated', 'public.create_friend_group_message(uuid, text)', 'EXECUTE') as message_ok;
