-- =============================================================
-- SNS: Instagram / X で馴染みのある基本機能をまとめて追加する。
--   1. 保存  2. リポスト・引用  3. メンション  4. 検索用データ
--   5. グループ投票  6. ピン留め  7. プロフィールタブ用取得
--   8. 写真操作はUI側  9. ブロック・通報  10. 下書きは端末側
--
-- テーブルへの直接アクセスは許可せず、既存SNSと同じく
-- SECURITY DEFINER RPC のみを公開する。
-- =============================================================
begin;

do $$
begin
  if to_regclass('public.friend_text_posts') is null
    or to_regclass('public.friend_text_post_replies') is null
    or to_regclass('public.friend_groups') is null
    or to_regclass('public.friend_group_messages') is null then
    raise exception using
      errcode = 'P0001',
      message = 'SNS_FAMILIAR_FEATURES_MISSING_DEPENDENCY',
      hint = '先に 0058_friend_group_summaries.sql まで適用してください。';
  end if;
end;
$$;

-- -------------------------------------------------------------
-- 保存・リポスト・ピン留め・メンション
-- -------------------------------------------------------------
create table if not exists public.friend_text_post_saves (
  post_id uuid not null references public.friend_text_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.friend_text_posts
  add column if not exists repost_of_post_id uuid references public.friend_text_posts(id) on delete cascade;

alter table public.friend_text_posts
  drop constraint if exists friend_text_posts_body_or_photos;
alter table public.friend_text_posts
  drop constraint if exists friend_text_posts_body_photos_or_repost;
alter table public.friend_text_posts
  add constraint friend_text_posts_body_photos_or_repost
  check (
    char_length(trim(body)) > 0
    or coalesce(array_length(photo_paths, 1), 0) > 0
    or repost_of_post_id is not null
  );

create unique index if not exists friend_text_posts_one_plain_repost_idx
  on public.friend_text_posts(user_id, repost_of_post_id)
  where repost_of_post_id is not null
    and char_length(trim(body)) = 0
    and coalesce(array_length(photo_paths, 1), 0) = 0
    and linked_visit_id is null;

create index if not exists friend_text_posts_repost_idx
  on public.friend_text_posts(repost_of_post_id)
  where repost_of_post_id is not null;

create table if not exists public.friend_text_post_pins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  post_id uuid not null unique references public.friend_text_posts(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.friend_text_post_mentions (
  post_id uuid not null references public.friend_text_posts(id) on delete cascade,
  mentioned_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, mentioned_user_id)
);

create table if not exists public.friend_text_post_reply_mentions (
  reply_id uuid not null references public.friend_text_post_replies(id) on delete cascade,
  mentioned_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reply_id, mentioned_user_id)
);

create table if not exists public.friend_group_message_mentions (
  message_id uuid not null references public.friend_group_messages(id) on delete cascade,
  mentioned_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, mentioned_user_id)
);

-- -------------------------------------------------------------
-- グループの固定カード・投票
-- -------------------------------------------------------------
create table if not exists public.friend_group_pins (
  group_id uuid primary key references public.friend_groups(id) on delete cascade,
  updated_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null default '',
  updated_at timestamptz not null default now(),
  constraint friend_group_pins_title_length check (char_length(title) between 1 and 60),
  constraint friend_group_pins_body_length check (char_length(body) <= 300)
);

create table if not exists public.friend_group_polls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.friend_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  constraint friend_group_polls_question_length check (char_length(question) between 1 and 120)
);

create table if not exists public.friend_group_poll_options (
  id uuid not null default gen_random_uuid(),
  poll_id uuid not null references public.friend_group_polls(id) on delete cascade,
  label text not null,
  sort_order smallint not null,
  primary key (id),
  unique (id, poll_id),
  unique (poll_id, sort_order),
  constraint friend_group_poll_options_label_length check (char_length(label) between 1 and 60),
  constraint friend_group_poll_options_order check (sort_order between 0 and 3)
);

create table if not exists public.friend_group_poll_votes (
  poll_id uuid not null references public.friend_group_polls(id) on delete cascade,
  option_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id),
  foreign key (option_id, poll_id)
    references public.friend_group_poll_options(id, poll_id) on delete cascade
);

create index if not exists friend_group_polls_group_idx
  on public.friend_group_polls(group_id, created_at desc);
create index if not exists friend_group_poll_votes_option_idx
  on public.friend_group_poll_votes(option_id);

-- -------------------------------------------------------------
-- ブロック・通報
-- -------------------------------------------------------------
create table if not exists public.sns_user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_user_id),
  constraint sns_user_blocks_not_self check (blocker_id <> blocked_user_id)
);

create table if not exists public.sns_post_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.friend_text_posts(id) on delete set null,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint sns_post_reports_reason_length check (char_length(reason) between 1 and 120),
  unique (reporter_id, post_id)
);

-- すべてRPC専用。RLSを有効にした上で、直接権限を剥がす。
alter table public.friend_text_post_saves enable row level security;
alter table public.friend_text_post_pins enable row level security;
alter table public.friend_text_post_mentions enable row level security;
alter table public.friend_text_post_reply_mentions enable row level security;
alter table public.friend_group_message_mentions enable row level security;
alter table public.friend_group_pins enable row level security;
alter table public.friend_group_polls enable row level security;
alter table public.friend_group_poll_options enable row level security;
alter table public.friend_group_poll_votes enable row level security;
alter table public.sns_user_blocks enable row level security;
alter table public.sns_post_reports enable row level security;

revoke all on public.friend_text_post_saves from public, anon, authenticated;
revoke all on public.friend_text_post_pins from public, anon, authenticated;
revoke all on public.friend_text_post_mentions from public, anon, authenticated;
revoke all on public.friend_text_post_reply_mentions from public, anon, authenticated;
revoke all on public.friend_group_message_mentions from public, anon, authenticated;
revoke all on public.friend_group_pins from public, anon, authenticated;
revoke all on public.friend_group_polls from public, anon, authenticated;
revoke all on public.friend_group_poll_options from public, anon, authenticated;
revoke all on public.friend_group_poll_votes from public, anon, authenticated;
revoke all on public.sns_user_blocks from public, anon, authenticated;
revoke all on public.sns_post_reports from public, anon, authenticated;

-- 双方向のどちらかがブロックしていれば、SNS上では互いを表示しない。
create or replace function public.is_sns_user_blocked(p_first_user_id uuid, p_second_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.sns_user_blocks b
    where (b.blocker_id = p_first_user_id and b.blocked_user_id = p_second_user_id)
       or (b.blocker_id = p_second_user_id and b.blocked_user_id = p_first_user_id)
  );
$$;

revoke all on function public.is_sns_user_blocked(uuid, uuid) from public, anon, authenticated;

create or replace function public.can_view_friend_text_post(p_post_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.friend_text_posts tp
    where tp.id = p_post_id
      and (tp.user_id = auth.uid() or public.is_friend(tp.user_id))
      and not public.is_sns_user_blocked(auth.uid(), tp.user_id)
  );
$$;

revoke all on function public.can_view_friend_text_post(uuid) from public, anon;
grant execute on function public.can_view_friend_text_post(uuid) to authenticated;

-- -------------------------------------------------------------
-- 投稿作成: 引用元と本文中の @表示名 を同時に保存する。
-- -------------------------------------------------------------
drop function if exists public.create_friend_text_post(text, text[], uuid);
drop function if exists public.create_friend_text_post(text, text[], uuid, uuid);

create function public.create_friend_text_post(
  p_body text,
  p_photo_paths text[] default '{}',
  p_visit_record_id uuid default null,
  p_repost_of_post_id uuid default null
)
returns table (id uuid, created_at timestamptz)
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_body text := trim(coalesce(p_body, ''));
  v_photo_paths text[] := coalesce(p_photo_paths, '{}');
  v_repost_of_post_id uuid := p_repost_of_post_id;
  v_nested_repost_id uuid;
  v_row public.friend_text_posts;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if array_length(v_photo_paths, 1) > 4 then
    raise exception using errcode = 'P0001', message = 'TOO_MANY_PHOTOS';
  end if;
  if char_length(v_body) > 280 then
    raise exception using errcode = 'P0001', message = 'BODY_TOO_LONG';
  end if;
  if p_visit_record_id is not null and not exists (
    select 1 from public.visit_records vr
    where vr.id = p_visit_record_id and vr.user_id = v_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'LINKED_VISIT_NOT_FOUND';
  end if;
  if v_repost_of_post_id is not null then
    if not public.can_view_friend_text_post(v_repost_of_post_id) then
      raise exception using errcode = 'P0001', message = 'REPOST_NOT_FOUND';
    end if;
    -- リポストをさらに引用した場合は、元投稿へそろえて表示を1段に保つ。
    select tp.repost_of_post_id into v_nested_repost_id
    from public.friend_text_posts tp where tp.id = v_repost_of_post_id;
    v_repost_of_post_id := coalesce(v_nested_repost_id, v_repost_of_post_id);
  end if;
  if v_body = '' and coalesce(array_length(v_photo_paths, 1), 0) = 0 and v_repost_of_post_id is null then
    raise exception using errcode = 'P0001', message = 'BODY_REQUIRED';
  end if;

  insert into public.friend_text_posts (
    user_id, body, photo_paths, linked_visit_id, repost_of_post_id
  ) values (
    v_user_id, v_body, v_photo_paths, p_visit_record_id, v_repost_of_post_id
  ) returning * into v_row;

  insert into public.friend_text_post_mentions (post_id, mentioned_user_id)
  select v_row.id, p.user_id
  from public.profiles p
  where p.user_id <> v_user_id
    and public.is_friend(p.user_id)
    and not public.is_sns_user_blocked(v_user_id, p.user_id)
    and nullif(trim(p.display_name), '') is not null
    and position('@' || trim(p.display_name) in v_body) > 0
  on conflict do nothing;

  return query select v_row.id, v_row.created_at;
end;
$$;

revoke all on function public.create_friend_text_post(text, text[], uuid, uuid) from public, anon;
grant execute on function public.create_friend_text_post(text, text[], uuid, uuid) to authenticated;

create or replace function public.set_friend_text_post_saved(p_post_id uuid, p_saved boolean)
returns void
language plpgsql
security definer
volatile
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not public.can_view_friend_text_post(p_post_id) then
    raise exception using errcode = 'P0001', message = 'POST_NOT_FOUND';
  end if;
  if p_saved then
    insert into public.friend_text_post_saves (post_id, user_id)
    values (p_post_id, auth.uid()) on conflict do nothing;
  else
    delete from public.friend_text_post_saves
    where post_id = p_post_id and user_id = auth.uid();
  end if;
end;
$$;

revoke all on function public.set_friend_text_post_saved(uuid, boolean) from public, anon;
grant execute on function public.set_friend_text_post_saved(uuid, boolean) to authenticated;

create or replace function public.set_friend_text_post_repost(p_post_id uuid, p_reposted boolean)
returns void
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_target_id uuid := p_post_id;
  v_nested_target uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not public.can_view_friend_text_post(p_post_id) then
    raise exception using errcode = 'P0001', message = 'POST_NOT_FOUND';
  end if;
  select tp.repost_of_post_id into v_nested_target
  from public.friend_text_posts tp where tp.id = p_post_id;
  v_target_id := coalesce(v_nested_target, p_post_id);

  if p_reposted then
    insert into public.friend_text_posts (user_id, body, photo_paths, repost_of_post_id)
    values (auth.uid(), '', '{}', v_target_id)
    on conflict do nothing;
  else
    delete from public.friend_text_posts tp
    where tp.user_id = auth.uid()
      and tp.repost_of_post_id = v_target_id
      and char_length(trim(tp.body)) = 0
      and coalesce(array_length(tp.photo_paths, 1), 0) = 0
      and tp.linked_visit_id is null;
  end if;
end;
$$;

revoke all on function public.set_friend_text_post_repost(uuid, boolean) from public, anon;
grant execute on function public.set_friend_text_post_repost(uuid, boolean) to authenticated;

create or replace function public.set_friend_text_post_pin(p_post_id uuid, p_pinned boolean)
returns void
language plpgsql
security definer
volatile
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_pinned then
    if not exists (
      select 1 from public.friend_text_posts tp
      where tp.id = p_post_id and tp.user_id = auth.uid()
    ) then
      raise exception using errcode = 'P0001', message = 'POST_NOT_FOUND';
    end if;
    insert into public.friend_text_post_pins (user_id, post_id)
    values (auth.uid(), p_post_id)
    on conflict (user_id) do update
      set post_id = excluded.post_id, created_at = now();
  else
    delete from public.friend_text_post_pins
    where user_id = auth.uid() and post_id = p_post_id;
  end if;
end;
$$;

revoke all on function public.set_friend_text_post_pin(uuid, boolean) from public, anon;
grant execute on function public.set_friend_text_post_pin(uuid, boolean) to authenticated;

-- -------------------------------------------------------------
-- 返信・グループメッセージにも @表示名 のメンションを記録する。
-- -------------------------------------------------------------
create or replace function public.add_friend_text_post_reply(
  p_post_id uuid,
  p_body text,
  p_parent_reply_id uuid default null
)
returns table (id uuid, created_at timestamptz)
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_body text := trim(coalesce(p_body, ''));
  v_row public.friend_text_post_replies;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if v_body = '' then
    raise exception using errcode = 'P0001', message = 'BODY_REQUIRED';
  end if;
  if char_length(v_body) > 1000 then
    raise exception using errcode = 'P0001', message = 'BODY_TOO_LONG';
  end if;
  if not public.can_view_friend_text_post(p_post_id) then
    raise exception using errcode = 'P0001', message = 'POST_NOT_FOUND';
  end if;
  if p_parent_reply_id is not null and not exists (
    select 1 from public.friend_text_post_replies pr
    where pr.id = p_parent_reply_id and pr.post_id = p_post_id
  ) then
    raise exception using errcode = 'P0001', message = 'PARENT_REPLY_NOT_FOUND';
  end if;

  insert into public.friend_text_post_replies (post_id, user_id, body, parent_reply_id)
  values (p_post_id, v_user_id, v_body, p_parent_reply_id)
  returning * into v_row;

  insert into public.friend_text_post_reply_mentions (reply_id, mentioned_user_id)
  select v_row.id, p.user_id
  from public.profiles p
  where p.user_id <> v_user_id
    and public.is_friend(p.user_id)
    and not public.is_sns_user_blocked(v_user_id, p.user_id)
    and nullif(trim(p.display_name), '') is not null
    and position('@' || trim(p.display_name) in v_body) > 0
  union
  select v_row.id, parent.user_id
  from public.friend_text_post_replies parent
  where parent.id = p_parent_reply_id and parent.user_id <> v_user_id
  on conflict do nothing;

  return query select v_row.id, v_row.created_at;
end;
$$;

revoke all on function public.add_friend_text_post_reply(uuid, text, uuid) from public, anon;
grant execute on function public.add_friend_text_post_reply(uuid, text, uuid) to authenticated;

drop function if exists public.create_friend_group_message(uuid, text);

create function public.create_friend_group_message(p_group_id uuid, p_body text)
returns table (
  id uuid,
  group_id uuid,
  user_id uuid,
  display_name text,
  profile_image_url text,
  body text,
  created_at timestamptz,
  mentions jsonb
)
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_body text := trim(coalesce(p_body, ''));
  v_message public.friend_group_messages;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not public.is_friend_group_member(p_group_id) then
    raise exception using errcode = 'P0001', message = 'GROUP_NOT_FOUND';
  end if;
  if v_body = '' then
    raise exception using errcode = 'P0001', message = 'BODY_REQUIRED';
  end if;
  if char_length(v_body) > 1000 then
    raise exception using errcode = 'P0001', message = 'BODY_TOO_LONG';
  end if;

  insert into public.friend_group_messages (group_id, user_id, body)
  values (p_group_id, v_user_id, v_body)
  returning * into v_message;

  insert into public.friend_group_message_mentions (message_id, mentioned_user_id)
  select v_message.id, p.user_id
  from public.friend_group_members gm
  join public.profiles p on p.user_id = gm.user_id
  where gm.group_id = p_group_id
    and p.user_id <> v_user_id
    and not public.is_sns_user_blocked(v_user_id, p.user_id)
    and nullif(trim(p.display_name), '') is not null
    and position('@' || trim(p.display_name) in v_body) > 0
  on conflict do nothing;

  return query
  select
    v_message.id,
    v_message.group_id,
    v_message.user_id,
    p.display_name,
    p.profile_image_url,
    v_message.body,
    v_message.created_at,
    coalesce((
      select jsonb_agg(jsonb_build_object('user_id', mp.user_id, 'display_name', mp.display_name))
      from public.friend_group_message_mentions mm
      join public.profiles mp on mp.user_id = mm.mentioned_user_id
      where mm.message_id = v_message.id
    ), '[]'::jsonb)
  from public.profiles p
  where p.user_id = v_message.user_id;
end;
$$;

revoke all on function public.create_friend_group_message(uuid, text) from public, anon;
grant execute on function public.create_friend_group_message(uuid, text) to authenticated;

drop function if exists public.get_friend_group_messages(uuid, integer);

create function public.get_friend_group_messages(p_group_id uuid, p_limit integer default 50)
returns table (
  id uuid,
  group_id uuid,
  user_id uuid,
  display_name text,
  profile_image_url text,
  body text,
  created_at timestamptz,
  mentions jsonb
)
language sql
security definer
stable
set search_path = public
as $$
  select
    gm.id,
    gm.group_id,
    gm.user_id,
    p.display_name,
    p.profile_image_url,
    gm.body,
    gm.created_at,
    coalesce(mentions.items, '[]'::jsonb) as mentions
  from public.friend_group_messages gm
  join public.profiles p on p.user_id = gm.user_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object('user_id', mp.user_id, 'display_name', mp.display_name)
      order by mp.display_name
    ) as items
    from public.friend_group_message_mentions mm
    join public.profiles mp on mp.user_id = mm.mentioned_user_id
    where mm.message_id = gm.id
  ) mentions on true
  where gm.group_id = p_group_id
    and public.is_friend_group_member(p_group_id)
    and not public.is_sns_user_blocked(auth.uid(), gm.user_id)
  order by gm.created_at desc
  limit greatest(coalesce(p_limit, 50), 1);
$$;

revoke all on function public.get_friend_group_messages(uuid, integer) from public, anon;
grant execute on function public.get_friend_group_messages(uuid, integer) to authenticated;

-- -------------------------------------------------------------
-- 投稿の共通取得。通常フィード・保存済み・1件詳細で同じ表示情報を返す。
-- -------------------------------------------------------------
create or replace function public.get_friend_text_posts_core(
  p_user_id uuid default null,
  p_saved_only boolean default false,
  p_post_id uuid default null,
  p_limit integer default 100
)
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  profile_image_url text,
  body text,
  photo_paths text[],
  linked_visit_id uuid,
  linked_spot_id uuid,
  linked_spot_name text,
  linked_trip_id uuid,
  linked_trip_title text,
  linked_visited_at date,
  created_at timestamptz,
  reply_count bigint,
  like_count bigint,
  my_liked boolean,
  my_saved boolean,
  is_pinned boolean,
  repost_count bigint,
  my_reposted boolean,
  repost_of_post_id uuid,
  quoted_user_id uuid,
  quoted_display_name text,
  quoted_profile_image_url text,
  quoted_body text,
  quoted_photo_paths text[],
  quoted_linked_spot_id uuid,
  quoted_linked_spot_name text,
  quoted_linked_trip_id uuid,
  quoted_linked_trip_title text,
  quoted_linked_visited_at date,
  quoted_created_at timestamptz,
  mentions jsonb
)
language sql
security definer
stable
set search_path = public
as $$
  select
    tp.id,
    tp.user_id,
    p.display_name,
    p.profile_image_url,
    tp.body,
    tp.photo_paths,
    tp.linked_visit_id,
    vr.spot_id,
    s.name,
    coalesce(vr.journey_id, vr.trip_id),
    t.title,
    vr.visited_at,
    tp.created_at,
    coalesce(replies.n, 0),
    coalesce(likes.n, 0),
    mine_like.liked is not null,
    mine_save.saved_at is not null,
    pin.post_id is not null,
    coalesce(reposts.n, 0),
    mine_repost.reposted is not null,
    tp.repost_of_post_id,
    quoted.id_user,
    quoted.display_name,
    quoted.profile_image_url,
    quoted.body,
    quoted.photo_paths,
    quoted.spot_id,
    quoted.spot_name,
    quoted.trip_id,
    quoted.trip_title,
    quoted.visited_at,
    quoted.created_at,
    coalesce(mentions.items, '[]'::jsonb)
  from public.friend_text_posts tp
  join public.profiles p on p.user_id = tp.user_id
  left join public.visit_records vr on vr.id = tp.linked_visit_id and vr.user_id = tp.user_id
  left join public.spots s on s.id = vr.spot_id
  left join public.trips t on t.id = coalesce(vr.journey_id, vr.trip_id)
  left join lateral (
    select count(*)::bigint as n from public.friend_text_post_replies r
    where r.post_id = tp.id and not public.is_sns_user_blocked(auth.uid(), r.user_id)
  ) replies on true
  left join lateral (
    select count(*)::bigint as n from public.friend_text_post_likes l where l.post_id = tp.id
  ) likes on true
  left join lateral (
    select true as liked from public.friend_text_post_likes l
    where l.post_id = tp.id and l.user_id = auth.uid()
  ) mine_like on true
  left join lateral (
    select ps.created_at as saved_at from public.friend_text_post_saves ps
    where ps.post_id = tp.id and ps.user_id = auth.uid()
  ) mine_save on true
  left join public.friend_text_post_pins pin on pin.post_id = tp.id
  left join lateral (
    select count(*)::bigint as n from public.friend_text_posts rp where rp.repost_of_post_id = tp.id
  ) reposts on true
  left join lateral (
    select true as reposted from public.friend_text_posts rp
    where rp.repost_of_post_id = tp.id
      and rp.user_id = auth.uid()
      and char_length(trim(rp.body)) = 0
      and coalesce(array_length(rp.photo_paths, 1), 0) = 0
      and rp.linked_visit_id is null
    limit 1
  ) mine_repost on true
  left join lateral (
    select
      qp.user_id as id_user,
      qprofile.display_name,
      qprofile.profile_image_url,
      qp.body,
      qp.photo_paths,
      qvr.spot_id,
      qs.name as spot_name,
      coalesce(qvr.journey_id, qvr.trip_id) as trip_id,
      qt.title as trip_title,
      qvr.visited_at,
      qp.created_at
    from public.friend_text_posts qp
    join public.profiles qprofile on qprofile.user_id = qp.user_id
    left join public.visit_records qvr on qvr.id = qp.linked_visit_id and qvr.user_id = qp.user_id
    left join public.spots qs on qs.id = qvr.spot_id
    left join public.trips qt on qt.id = coalesce(qvr.journey_id, qvr.trip_id)
    where qp.id = tp.repost_of_post_id
      and public.can_view_friend_text_post(qp.id)
  ) quoted on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object('user_id', mp.user_id, 'display_name', mp.display_name)
      order by mp.display_name
    ) as items
    from public.friend_text_post_mentions pm
    join public.profiles mp on mp.user_id = pm.mentioned_user_id
    where pm.post_id = tp.id
  ) mentions on true
  where auth.uid() is not null
    and public.can_view_friend_text_post(tp.id)
    and (tp.repost_of_post_id is null or quoted.id_user is not null)
    and (p_user_id is null or tp.user_id = p_user_id)
    and (p_post_id is null or tp.id = p_post_id)
    and (not p_saved_only or mine_save.saved_at is not null)
  order by
    case when p_saved_only then mine_save.saved_at else tp.created_at end desc
  limit greatest(coalesce(p_limit, 100), 1);
$$;

revoke all on function public.get_friend_text_posts_core(uuid, boolean, uuid, integer) from public, anon, authenticated;

drop function if exists public.get_personal_text_feed(uuid, integer);
create function public.get_personal_text_feed(p_user_id uuid default null, p_limit integer default 100)
returns table (
  id uuid, user_id uuid, display_name text, profile_image_url text, body text, photo_paths text[],
  linked_visit_id uuid, linked_spot_id uuid, linked_spot_name text, linked_trip_id uuid,
  linked_trip_title text, linked_visited_at date, created_at timestamptz, reply_count bigint,
  like_count bigint, my_liked boolean, my_saved boolean, is_pinned boolean, repost_count bigint,
  my_reposted boolean, repost_of_post_id uuid, quoted_user_id uuid, quoted_display_name text,
  quoted_profile_image_url text, quoted_body text, quoted_photo_paths text[], quoted_linked_spot_id uuid,
  quoted_linked_spot_name text, quoted_linked_trip_id uuid, quoted_linked_trip_title text,
  quoted_linked_visited_at date, quoted_created_at timestamptz, mentions jsonb
)
language sql security definer stable set search_path = public
as $$ select * from public.get_friend_text_posts_core(p_user_id, false, null, p_limit); $$;

revoke all on function public.get_personal_text_feed(uuid, integer) from public, anon;
grant execute on function public.get_personal_text_feed(uuid, integer) to authenticated;

drop function if exists public.get_personal_text_post(uuid);
create function public.get_personal_text_post(p_post_id uuid)
returns table (
  id uuid, user_id uuid, display_name text, profile_image_url text, body text, photo_paths text[],
  linked_visit_id uuid, linked_spot_id uuid, linked_spot_name text, linked_trip_id uuid,
  linked_trip_title text, linked_visited_at date, created_at timestamptz, reply_count bigint,
  like_count bigint, my_liked boolean, my_saved boolean, is_pinned boolean, repost_count bigint,
  my_reposted boolean, repost_of_post_id uuid, quoted_user_id uuid, quoted_display_name text,
  quoted_profile_image_url text, quoted_body text, quoted_photo_paths text[], quoted_linked_spot_id uuid,
  quoted_linked_spot_name text, quoted_linked_trip_id uuid, quoted_linked_trip_title text,
  quoted_linked_visited_at date, quoted_created_at timestamptz, mentions jsonb
)
language sql security definer stable set search_path = public
as $$ select * from public.get_friend_text_posts_core(null, false, p_post_id, 1); $$;

revoke all on function public.get_personal_text_post(uuid) from public, anon;
grant execute on function public.get_personal_text_post(uuid) to authenticated;

create or replace function public.get_saved_friend_text_posts(p_limit integer default 100)
returns table (
  id uuid, user_id uuid, display_name text, profile_image_url text, body text, photo_paths text[],
  linked_visit_id uuid, linked_spot_id uuid, linked_spot_name text, linked_trip_id uuid,
  linked_trip_title text, linked_visited_at date, created_at timestamptz, reply_count bigint,
  like_count bigint, my_liked boolean, my_saved boolean, is_pinned boolean, repost_count bigint,
  my_reposted boolean, repost_of_post_id uuid, quoted_user_id uuid, quoted_display_name text,
  quoted_profile_image_url text, quoted_body text, quoted_photo_paths text[], quoted_linked_spot_id uuid,
  quoted_linked_spot_name text, quoted_linked_trip_id uuid, quoted_linked_trip_title text,
  quoted_linked_visited_at date, quoted_created_at timestamptz, mentions jsonb
)
language sql security definer stable set search_path = public
as $$ select * from public.get_friend_text_posts_core(null, true, null, p_limit); $$;

revoke all on function public.get_saved_friend_text_posts(integer) from public, anon;
grant execute on function public.get_saved_friend_text_posts(integer) to authenticated;

drop function if exists public.get_friend_text_post_replies(uuid);
create function public.get_friend_text_post_replies(p_post_id uuid)
returns table (
  id uuid,
  post_id uuid,
  parent_reply_id uuid,
  user_id uuid,
  display_name text,
  profile_image_url text,
  body text,
  created_at timestamptz,
  like_count bigint,
  my_liked boolean,
  mentions jsonb
)
language sql
security definer
stable
set search_path = public
as $$
  select
    r.id,
    r.post_id,
    r.parent_reply_id,
    r.user_id,
    p.display_name,
    p.profile_image_url,
    r.body,
    r.created_at,
    coalesce(likes.n, 0),
    mine.liked is not null,
    coalesce(mentions.items, '[]'::jsonb)
  from public.friend_text_post_replies r
  join public.profiles p on p.user_id = r.user_id
  left join lateral (
    select count(*)::bigint as n from public.friend_text_post_reply_likes l where l.reply_id = r.id
  ) likes on true
  left join lateral (
    select true as liked from public.friend_text_post_reply_likes l
    where l.reply_id = r.id and l.user_id = auth.uid()
  ) mine on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object('user_id', mp.user_id, 'display_name', mp.display_name)
      order by mp.display_name
    ) as items
    from public.friend_text_post_reply_mentions rm
    join public.profiles mp on mp.user_id = rm.mentioned_user_id
    where rm.reply_id = r.id
  ) mentions on true
  where public.can_view_friend_text_post(p_post_id)
    and r.post_id = p_post_id
    and not public.is_sns_user_blocked(auth.uid(), r.user_id)
  order by r.created_at asc;
$$;

revoke all on function public.get_friend_text_post_replies(uuid) from public, anon;
grant execute on function public.get_friend_text_post_replies(uuid) to authenticated;

-- -------------------------------------------------------------
-- グループ固定カード・投票 RPC
-- -------------------------------------------------------------
create or replace function public.set_friend_group_pin(p_group_id uuid, p_title text, p_body text default '')
returns void
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_title text := trim(coalesce(p_title, ''));
  v_body text := trim(coalesce(p_body, ''));
begin
  if not public.is_friend_group_member(p_group_id) then
    raise exception using errcode = 'P0001', message = 'GROUP_NOT_FOUND';
  end if;
  if v_title = '' then
    delete from public.friend_group_pins where group_id = p_group_id;
    return;
  end if;
  if char_length(v_title) > 60 or char_length(v_body) > 300 then
    raise exception using errcode = 'P0001', message = 'PIN_TOO_LONG';
  end if;
  insert into public.friend_group_pins (group_id, updated_by, title, body)
  values (p_group_id, auth.uid(), v_title, v_body)
  on conflict (group_id) do update
    set updated_by = excluded.updated_by,
        title = excluded.title,
        body = excluded.body,
        updated_at = now();
end;
$$;

revoke all on function public.set_friend_group_pin(uuid, text, text) from public, anon;
grant execute on function public.set_friend_group_pin(uuid, text, text) to authenticated;

create or replace function public.get_friend_group_pin(p_group_id uuid)
returns table (group_id uuid, title text, body text, updated_by_name text, updated_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select pin.group_id, pin.title, pin.body, p.display_name, pin.updated_at
  from public.friend_group_pins pin
  join public.profiles p on p.user_id = pin.updated_by
  where pin.group_id = p_group_id and public.is_friend_group_member(p_group_id);
$$;

revoke all on function public.get_friend_group_pin(uuid) from public, anon;
grant execute on function public.get_friend_group_pin(uuid) to authenticated;

create or replace function public.create_friend_group_poll(
  p_group_id uuid,
  p_question text,
  p_options text[],
  p_closes_at timestamptz default null
)
returns uuid
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_question text := trim(coalesce(p_question, ''));
  v_options text[];
  v_poll_id uuid;
begin
  if not public.is_friend_group_member(p_group_id) then
    raise exception using errcode = 'P0001', message = 'GROUP_NOT_FOUND';
  end if;
  select array_agg(trim(option_text)) into v_options
  from unnest(coalesce(p_options, '{}')) option_text
  where trim(option_text) <> '';
  if v_question = '' or char_length(v_question) > 120 then
    raise exception using errcode = 'P0001', message = 'POLL_QUESTION_INVALID';
  end if;
  if coalesce(array_length(v_options, 1), 0) not between 2 and 4 then
    raise exception using errcode = 'P0001', message = 'POLL_OPTIONS_INVALID';
  end if;
  if exists (select 1 from unnest(v_options) option_text where char_length(option_text) > 60) then
    raise exception using errcode = 'P0001', message = 'POLL_OPTION_TOO_LONG';
  end if;
  if (select count(distinct lower(option_text)) from unnest(v_options) option_text) <> array_length(v_options, 1) then
    raise exception using errcode = 'P0001', message = 'POLL_OPTIONS_DUPLICATED';
  end if;

  insert into public.friend_group_polls (group_id, user_id, question, closes_at)
  values (p_group_id, auth.uid(), v_question, p_closes_at)
  returning id into v_poll_id;

  insert into public.friend_group_poll_options (poll_id, label, sort_order)
  select v_poll_id, option_text, (ordinality - 1)::smallint
  from unnest(v_options) with ordinality as options(option_text, ordinality);

  return v_poll_id;
end;
$$;

revoke all on function public.create_friend_group_poll(uuid, text, text[], timestamptz) from public, anon;
grant execute on function public.create_friend_group_poll(uuid, text, text[], timestamptz) to authenticated;

create or replace function public.vote_friend_group_poll(p_poll_id uuid, p_option_id uuid)
returns void
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_group_id uuid;
  v_closes_at timestamptz;
begin
  select poll.group_id, poll.closes_at into v_group_id, v_closes_at
  from public.friend_group_polls poll where poll.id = p_poll_id;
  if v_group_id is null or not public.is_friend_group_member(v_group_id) then
    raise exception using errcode = 'P0001', message = 'POLL_NOT_FOUND';
  end if;
  if v_closes_at is not null and v_closes_at <= now() then
    raise exception using errcode = 'P0001', message = 'POLL_CLOSED';
  end if;
  if not exists (
    select 1 from public.friend_group_poll_options o
    where o.id = p_option_id and o.poll_id = p_poll_id
  ) then
    raise exception using errcode = 'P0001', message = 'POLL_OPTION_NOT_FOUND';
  end if;
  insert into public.friend_group_poll_votes (poll_id, option_id, user_id)
  values (p_poll_id, p_option_id, auth.uid())
  on conflict (poll_id, user_id) do update
    set option_id = excluded.option_id, created_at = now();
end;
$$;

revoke all on function public.vote_friend_group_poll(uuid, uuid) from public, anon;
grant execute on function public.vote_friend_group_poll(uuid, uuid) to authenticated;

create or replace function public.delete_friend_group_poll(p_poll_id uuid)
returns void
language plpgsql
security definer
volatile
set search_path = public
as $$
begin
  delete from public.friend_group_polls poll
  where poll.id = p_poll_id
    and (poll.user_id = auth.uid() or exists (
      select 1 from public.friend_groups g where g.id = poll.group_id and g.owner_id = auth.uid()
    ));
  if not found then
    raise exception using errcode = 'P0001', message = 'POLL_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.delete_friend_group_poll(uuid) from public, anon;
grant execute on function public.delete_friend_group_poll(uuid) to authenticated;

create or replace function public.get_friend_group_polls(p_group_id uuid, p_limit integer default 5)
returns table (
  id uuid,
  group_id uuid,
  user_id uuid,
  display_name text,
  question text,
  closes_at timestamptz,
  created_at timestamptz,
  option_ids uuid[],
  option_labels text[],
  option_vote_counts bigint[],
  my_option_id uuid,
  total_votes bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    poll.id,
    poll.group_id,
    poll.user_id,
    p.display_name,
    poll.question,
    poll.closes_at,
    poll.created_at,
    options.ids,
    options.labels,
    options.counts,
    my_vote.option_id,
    coalesce(options.total, 0)
  from public.friend_group_polls poll
  join public.profiles p on p.user_id = poll.user_id
  cross join lateral (
    select
      array_agg(o.id order by o.sort_order) as ids,
      array_agg(o.label order by o.sort_order) as labels,
      array_agg(coalesce(v.n, 0) order by o.sort_order) as counts,
      sum(coalesce(v.n, 0))::bigint as total
    from public.friend_group_poll_options o
    left join lateral (
      select count(*)::bigint as n
      from public.friend_group_poll_votes pv where pv.option_id = o.id
    ) v on true
    where o.poll_id = poll.id
  ) options
  left join public.friend_group_poll_votes my_vote
    on my_vote.poll_id = poll.id and my_vote.user_id = auth.uid()
  where poll.group_id = p_group_id and public.is_friend_group_member(p_group_id)
  order by poll.created_at desc
  limit greatest(coalesce(p_limit, 5), 1);
$$;

revoke all on function public.get_friend_group_polls(uuid, integer) from public, anon;
grant execute on function public.get_friend_group_polls(uuid, integer) to authenticated;

-- -------------------------------------------------------------
-- ブロック・通報・メンション通知
-- -------------------------------------------------------------
create or replace function public.set_sns_user_block(p_user_id uuid, p_blocked boolean)
returns void
language plpgsql
security definer
volatile
set search_path = public
as $$
begin
  if auth.uid() is null or p_user_id = auth.uid() then
    raise exception using errcode = 'P0001', message = 'BLOCK_USER_INVALID';
  end if;
  if p_blocked then
    insert into public.sns_user_blocks (blocker_id, blocked_user_id)
    values (auth.uid(), p_user_id) on conflict do nothing;
  else
    delete from public.sns_user_blocks
    where blocker_id = auth.uid() and blocked_user_id = p_user_id;
  end if;
end;
$$;

revoke all on function public.set_sns_user_block(uuid, boolean) from public, anon;
grant execute on function public.set_sns_user_block(uuid, boolean) to authenticated;

create or replace function public.get_sns_blocked_users()
returns table (user_id uuid, display_name text, profile_image_url text, blocked_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select b.blocked_user_id, p.display_name, p.profile_image_url, b.created_at
  from public.sns_user_blocks b
  join public.profiles p on p.user_id = b.blocked_user_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

revoke all on function public.get_sns_blocked_users() from public, anon;
grant execute on function public.get_sns_blocked_users() to authenticated;

create or replace function public.report_sns_post(p_post_id uuid, p_reason text default '不適切な投稿')
returns void
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_reported_user_id uuid;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if not public.can_view_friend_text_post(p_post_id) then
    raise exception using errcode = 'P0001', message = 'POST_NOT_FOUND';
  end if;
  select tp.user_id into v_reported_user_id from public.friend_text_posts tp where tp.id = p_post_id;
  if v_reported_user_id = auth.uid() or v_reason = '' or char_length(v_reason) > 120 then
    raise exception using errcode = 'P0001', message = 'REPORT_INVALID';
  end if;
  insert into public.sns_post_reports (reporter_id, post_id, reported_user_id, reason)
  values (auth.uid(), p_post_id, v_reported_user_id, v_reason)
  on conflict (reporter_id, post_id) do update
    set reason = excluded.reason, created_at = now();
end;
$$;

revoke all on function public.report_sns_post(uuid, text) from public, anon;
grant execute on function public.report_sns_post(uuid, text) to authenticated;

create or replace function public.get_sns_mentions(p_limit integer default 50)
returns table (
  id text,
  kind text,
  post_id uuid,
  group_id uuid,
  actor_user_id uuid,
  actor_display_name text,
  actor_profile_image_url text,
  body text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select *
  from (
    select
      'post:' || pm.post_id::text as id,
      'post'::text as kind,
      pm.post_id,
      null::uuid as group_id,
      tp.user_id,
      p.display_name,
      p.profile_image_url,
      tp.body,
      pm.created_at
    from public.friend_text_post_mentions pm
    join public.friend_text_posts tp on tp.id = pm.post_id
    join public.profiles p on p.user_id = tp.user_id
    where pm.mentioned_user_id = auth.uid()
      and public.can_view_friend_text_post(pm.post_id)
    union all
    select
      'reply:' || rm.reply_id::text,
      'reply'::text,
      r.post_id,
      null::uuid,
      r.user_id,
      p.display_name,
      p.profile_image_url,
      r.body,
      rm.created_at
    from public.friend_text_post_reply_mentions rm
    join public.friend_text_post_replies r on r.id = rm.reply_id
    join public.profiles p on p.user_id = r.user_id
    where rm.mentioned_user_id = auth.uid()
      and public.can_view_friend_text_post(r.post_id)
      and not public.is_sns_user_blocked(auth.uid(), r.user_id)
    union all
    select
      'group:' || gm.message_id::text,
      'group'::text,
      null::uuid,
      msg.group_id,
      msg.user_id,
      p.display_name,
      p.profile_image_url,
      msg.body,
      gm.created_at
    from public.friend_group_message_mentions gm
    join public.friend_group_messages msg on msg.id = gm.message_id
    join public.profiles p on p.user_id = msg.user_id
    where gm.mentioned_user_id = auth.uid()
      and public.is_friend_group_member(msg.group_id)
      and not public.is_sns_user_blocked(auth.uid(), msg.user_id)
  ) mentions
  order by mentions.created_at desc
  limit greatest(coalesce(p_limit, 50), 1);
$$;

revoke all on function public.get_sns_mentions(integer) from public, anon;
grant execute on function public.get_sns_mentions(integer) to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'SNS_FAMILIAR_FEATURES_READY'::text as status,
  has_function_privilege('authenticated', 'public.get_saved_friend_text_posts(integer)', 'EXECUTE') as saved_ok,
  has_function_privilege('authenticated', 'public.get_friend_group_polls(uuid, integer)', 'EXECUTE') as polls_ok,
  has_function_privilege('authenticated', 'public.get_sns_mentions(integer)', 'EXECUTE') as mentions_ok;
