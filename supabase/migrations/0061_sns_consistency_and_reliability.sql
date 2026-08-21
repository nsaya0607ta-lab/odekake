-- =============================================================
-- SNS: ブロック範囲の統一とグループ表示の整合性
-- =============================================================
-- どちらか一方がブロックした相手は、個人投稿だけでなく写真・コメント・
-- グループのメンバー/最新投稿/投票でも相互に表示しない。
begin;

do $$
begin
  if to_regclass('public.sns_user_blocks') is null
    or to_regprocedure('public.is_sns_user_blocked(uuid,uuid)') is null
    or to_regclass('public.friend_groups') is null then
    raise exception using
      errcode = 'P0001',
      message = 'SNS_CONSISTENCY_MISSING_DEPENDENCY',
      hint = '先に 0059_sns_familiar_features.sql まで適用してください。';
  end if;
end;
$$;

create index if not exists sns_user_blocks_blocked_user_idx
  on public.sns_user_blocks(blocked_user_id, blocker_id);

-- 自分からのブロックだけでなく、相手側からブロックされている場合も返す。
create or replace function public.get_sns_hidden_user_ids()
returns table (user_id uuid)
language sql
security definer
stable
set search_path = public
as $$
  select distinct
    case when b.blocker_id = auth.uid() then b.blocked_user_id else b.blocker_id end
  from public.sns_user_blocks b
  where b.blocker_id = auth.uid() or b.blocked_user_id = auth.uid();
$$;

revoke all on function public.get_sns_hidden_user_ids() from public, anon;
grant execute on function public.get_sns_hidden_user_ids() to authenticated;

create or replace function public.can_view_friend_photo(p_photo_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.friend_photos fp
    where fp.id = p_photo_id
      and not public.is_sns_user_blocked(auth.uid(), fp.user_id)
      and (
        (fp.group_id is null and (fp.user_id = auth.uid() or public.is_friend(fp.user_id)))
        or (fp.group_id is not null and public.is_friend_group_member(fp.group_id))
      )
  );
$$;

revoke all on function public.can_view_friend_photo(uuid) from public, anon;
grant execute on function public.can_view_friend_photo(uuid) to authenticated;

-- フォームを改変しても、ブロック関係の相手は新しいグループへ追加できない。
create or replace function public.create_friend_group(
  p_name text,
  p_member_user_ids uuid[],
  p_icon text default '👥',
  p_icon_path text default null
)
returns uuid
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_icon_path text := nullif(trim(coalesce(p_icon_path, '')), '');
  v_group_id uuid;
  v_member uuid;
  v_added_members integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 40 then
    raise exception using errcode = 'P0001', message = 'GROUP_NAME_INVALID';
  end if;

  insert into public.friend_groups (owner_id, name, icon, icon_path)
  values (v_user_id, v_name, '👥', v_icon_path)
  returning id into v_group_id;

  insert into public.friend_group_members (group_id, user_id)
  values (v_group_id, v_user_id);

  if p_member_user_ids is not null then
    foreach v_member in array p_member_user_ids loop
      if v_member <> v_user_id
        and public.is_friend(v_member)
        and not public.is_sns_user_blocked(v_user_id, v_member) then
        insert into public.friend_group_members (group_id, user_id)
        values (v_group_id, v_member)
        on conflict do nothing;
        if found then
          v_added_members := v_added_members + 1;
        end if;
      end if;
    end loop;
  end if;

  if v_added_members = 0 then
    raise exception using errcode = 'P0001', message = 'GROUP_NEEDS_MEMBER';
  end if;
  return v_group_id;
end;
$$;

revoke all on function public.create_friend_group(text, uuid[], text, text) from public, anon;
grant execute on function public.create_friend_group(text, uuid[], text, text) to authenticated;

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
  if not exists (
    select 1 from public.friend_groups g where g.id = p_group_id and g.owner_id = v_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'GROUP_OWNER_ONLY';
  end if;

  if p_member_user_ids is not null then
    foreach v_member in array p_member_user_ids loop
      if v_member <> v_user_id
        and public.is_friend(v_member)
        and not public.is_sns_user_blocked(v_user_id, v_member) then
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

create or replace function public.get_sns_feed(p_days integer default 14)
returns table (
  id uuid, user_id uuid, display_name text, profile_image_url text,
  photo_date date, storage_path text, caption text, created_at timestamptz,
  my_reaction text, reaction_count bigint, comment_count bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    fp.id, fp.user_id, p.display_name, p.profile_image_url, fp.photo_date,
    fp.storage_path, fp.caption, fp.created_at, mine.emoji,
    coalesce(reactions.n, 0), coalesce(comments.n, 0)
  from public.friend_photos fp
  join public.profiles p on p.user_id = fp.user_id
  left join lateral (
    select r.emoji from public.friend_photo_reactions r
    where r.photo_id = fp.id and r.user_id = auth.uid()
  ) mine on true
  left join lateral (
    select count(*) as n from public.friend_photo_reactions r
    where r.photo_id = fp.id
      and not public.is_sns_user_blocked(auth.uid(), r.user_id)
  ) reactions on true
  left join lateral (
    select count(*) as n from public.friend_photo_comments c
    where c.photo_id = fp.id
      and not public.is_sns_user_blocked(auth.uid(), c.user_id)
  ) comments on true
  where auth.uid() is not null
    and fp.group_id is null
    and (fp.user_id = auth.uid() or public.is_friend(fp.user_id))
    and not public.is_sns_user_blocked(auth.uid(), fp.user_id)
    and fp.photo_date >= (now() at time zone 'Asia/Tokyo')::date
      - greatest(coalesce(p_days, 14), 1) + 1
  order by fp.photo_date desc, fp.created_at asc;
$$;

revoke all on function public.get_sns_feed(integer) from public, anon;
grant execute on function public.get_sns_feed(integer) to authenticated;

create or replace function public.get_personal_sns_feed(
  p_user_id uuid default null,
  p_days integer default 30
)
returns table (
  id uuid, user_id uuid, display_name text, profile_image_url text,
  photo_date date, storage_path text, caption text, created_at timestamptz,
  my_reaction text, reaction_count bigint, comment_count bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    fp.id, fp.user_id, p.display_name, p.profile_image_url, fp.photo_date,
    fp.storage_path, fp.caption, fp.created_at, mine.emoji,
    coalesce(reactions.n, 0), coalesce(comments.n, 0)
  from public.friend_photos fp
  join public.profiles p on p.user_id = fp.user_id
  left join lateral (
    select r.emoji from public.friend_photo_reactions r
    where r.photo_id = fp.id and r.user_id = auth.uid()
  ) mine on true
  left join lateral (
    select count(*) as n from public.friend_photo_reactions r
    where r.photo_id = fp.id
      and not public.is_sns_user_blocked(auth.uid(), r.user_id)
  ) reactions on true
  left join lateral (
    select count(*) as n from public.friend_photo_comments c
    where c.photo_id = fp.id
      and not public.is_sns_user_blocked(auth.uid(), c.user_id)
  ) comments on true
  where auth.uid() is not null
    and fp.group_id is null
    and (fp.user_id = auth.uid() or public.is_friend(fp.user_id))
    and not public.is_sns_user_blocked(auth.uid(), fp.user_id)
    and (p_user_id is null or fp.user_id = p_user_id)
    and fp.photo_date >= (now() at time zone 'Asia/Tokyo')::date
      - greatest(coalesce(p_days, 30), 1) + 1
  order by fp.photo_date desc, fp.created_at asc;
$$;

revoke all on function public.get_personal_sns_feed(uuid, integer) from public, anon;
grant execute on function public.get_personal_sns_feed(uuid, integer) to authenticated;

create or replace function public.get_sns_group_feed(p_group_id uuid, p_days integer default 30)
returns table (
  id uuid, user_id uuid, display_name text, profile_image_url text,
  photo_date date, storage_path text, caption text, created_at timestamptz,
  my_reaction text, reaction_count bigint, comment_count bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    fp.id, fp.user_id, p.display_name, p.profile_image_url, fp.photo_date,
    fp.storage_path, fp.caption, fp.created_at, mine.emoji,
    coalesce(reactions.n, 0), coalesce(comments.n, 0)
  from public.friend_photos fp
  join public.profiles p on p.user_id = fp.user_id
  left join lateral (
    select r.emoji from public.friend_photo_reactions r
    where r.photo_id = fp.id and r.user_id = auth.uid()
  ) mine on true
  left join lateral (
    select count(*) as n from public.friend_photo_reactions r
    where r.photo_id = fp.id
      and not public.is_sns_user_blocked(auth.uid(), r.user_id)
  ) reactions on true
  left join lateral (
    select count(*) as n from public.friend_photo_comments c
    where c.photo_id = fp.id
      and not public.is_sns_user_blocked(auth.uid(), c.user_id)
  ) comments on true
  where fp.group_id = p_group_id
    and public.is_friend_group_member(p_group_id)
    and not public.is_sns_user_blocked(auth.uid(), fp.user_id)
    and fp.photo_date >= (now() at time zone 'Asia/Tokyo')::date
      - greatest(coalesce(p_days, 30), 1) + 1
  order by fp.photo_date desc, fp.created_at asc;
$$;

revoke all on function public.get_sns_group_feed(uuid, integer) from public, anon;
grant execute on function public.get_sns_group_feed(uuid, integer) to authenticated;

create or replace function public.get_sns_photo(p_photo_id uuid)
returns table (
  id uuid, user_id uuid, display_name text, profile_image_url text,
  photo_date date, storage_path text, caption text, created_at timestamptz,
  group_id uuid, group_name text, my_reaction text,
  reaction_count bigint, comment_count bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    fp.id, fp.user_id, p.display_name, p.profile_image_url, fp.photo_date,
    fp.storage_path, fp.caption, fp.created_at, fp.group_id, g.name,
    mine.emoji, coalesce(reactions.n, 0), coalesce(comments.n, 0)
  from public.friend_photos fp
  join public.profiles p on p.user_id = fp.user_id
  left join public.friend_groups g on g.id = fp.group_id
  left join lateral (
    select r.emoji from public.friend_photo_reactions r
    where r.photo_id = fp.id and r.user_id = auth.uid()
  ) mine on true
  left join lateral (
    select count(*) as n from public.friend_photo_reactions r
    where r.photo_id = fp.id
      and not public.is_sns_user_blocked(auth.uid(), r.user_id)
  ) reactions on true
  left join lateral (
    select count(*) as n from public.friend_photo_comments c
    where c.photo_id = fp.id
      and not public.is_sns_user_blocked(auth.uid(), c.user_id)
  ) comments on true
  where fp.id = p_photo_id and public.can_view_friend_photo(fp.id);
$$;

revoke all on function public.get_sns_photo(uuid) from public, anon;
grant execute on function public.get_sns_photo(uuid) to authenticated;

create or replace function public.get_friend_photo_comments(p_photo_id uuid)
returns table (
  id uuid, photo_id uuid, user_id uuid, display_name text,
  profile_image_url text, body text, created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select c.id, c.photo_id, c.user_id, p.display_name, p.profile_image_url, c.body, c.created_at
  from public.friend_photo_comments c
  join public.profiles p on p.user_id = c.user_id
  where c.photo_id = p_photo_id
    and public.can_view_friend_photo(p_photo_id)
    and not public.is_sns_user_blocked(auth.uid(), c.user_id)
  order by c.created_at asc;
$$;

revoke all on function public.get_friend_photo_comments(uuid) from public, anon;
grant execute on function public.get_friend_photo_comments(uuid) to authenticated;

create or replace function public.get_friend_profile(p_user_id uuid)
returns table (display_name text, profile_image_url text)
language sql
security definer
stable
set search_path = public
as $$
  select p.display_name, p.profile_image_url
  from public.profiles p
  where p.user_id = p_user_id
    and (p_user_id = auth.uid() or public.is_friend(p_user_id))
    and not public.is_sns_user_blocked(auth.uid(), p_user_id);
$$;

revoke all on function public.get_friend_profile(uuid) from public, anon;
grant execute on function public.get_friend_profile(uuid) to authenticated;

create or replace function public.get_friend_group_members(p_group_id uuid)
returns table (user_id uuid, display_name text, profile_image_url text, is_owner boolean)
language sql
security definer
stable
set search_path = public
as $$
  select m.user_id, p.display_name, p.profile_image_url, (g.owner_id = m.user_id)
  from public.friend_group_members m
  join public.profiles p on p.user_id = m.user_id
  join public.friend_groups g on g.id = m.group_id
  where m.group_id = p_group_id
    and public.is_friend_group_member(p_group_id)
    and (m.user_id = auth.uid() or not public.is_sns_user_blocked(auth.uid(), m.user_id))
  order by (g.owner_id = m.user_id) desc, m.joined_at asc;
$$;

revoke all on function public.get_friend_group_members(uuid) from public, anon;
grant execute on function public.get_friend_group_members(uuid) to authenticated;

-- 0048の重複マイグレーションで失われる場合がある icon_path と sort_order をここで統一する。
drop function if exists public.get_my_friend_groups();

create function public.get_my_friend_groups()
returns table (
  id uuid, name text, icon text, icon_path text, owner_id uuid,
  member_count bigint, created_at timestamptz, has_unread boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    g.id, g.name, g.icon, g.icon_path, g.owner_id,
    (
      select count(*) from public.friend_group_members mm
      where mm.group_id = g.id
        and (mm.user_id = auth.uid() or not public.is_sns_user_blocked(auth.uid(), mm.user_id))
    ),
    g.created_at,
    exists (
      select 1 from public.friend_photos fp
      where fp.group_id = g.id
        and fp.user_id <> auth.uid()
        and not public.is_sns_user_blocked(auth.uid(), fp.user_id)
        and fp.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
      union all
      select 1 from public.friend_group_messages gm
      where gm.group_id = g.id
        and gm.user_id <> auth.uid()
        and not public.is_sns_user_blocked(auth.uid(), gm.user_id)
        and gm.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
    )
  from public.friend_groups g
  join public.friend_group_members m on m.group_id = g.id and m.user_id = auth.uid()
  left join public.friend_group_reads r on r.group_id = g.id and r.user_id = auth.uid()
  order by m.sort_order asc, g.created_at asc;
$$;

revoke all on function public.get_my_friend_groups() from public, anon;
grant execute on function public.get_my_friend_groups() to authenticated;

create or replace function public.get_my_friend_group_summaries()
returns table (
  id uuid, name text, icon text, icon_path text, owner_id uuid,
  member_count bigint, created_at timestamptz, has_unread boolean,
  unread_count bigint, latest_kind text, latest_preview text,
  latest_actor_name text, latest_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    g.id, g.name, g.icon, g.icon_path, g.owner_id,
    (
      select count(*) from public.friend_group_members mm
      where mm.group_id = g.id
        and (mm.user_id = auth.uid() or not public.is_sns_user_blocked(auth.uid(), mm.user_id))
    ),
    g.created_at,
    unread.count > 0,
    unread.count,
    latest.kind,
    latest.preview,
    case when latest.created_at is null then null
      else coalesce(nullif(btrim(actor.display_name), ''), 'ゲスト') end,
    latest.created_at
  from public.friend_groups g
  join public.friend_group_members m on m.group_id = g.id and m.user_id = auth.uid()
  left join public.friend_group_reads r on r.group_id = g.id and r.user_id = auth.uid()
  cross join lateral (
    select count(*)::bigint as count
    from (
      select fp.id from public.friend_photos fp
      where fp.group_id = g.id
        and fp.user_id <> auth.uid()
        and not public.is_sns_user_blocked(auth.uid(), fp.user_id)
        and fp.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
      union all
      select gm.id from public.friend_group_messages gm
      where gm.group_id = g.id
        and gm.user_id <> auth.uid()
        and not public.is_sns_user_blocked(auth.uid(), gm.user_id)
        and gm.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
    ) unread_items
  ) unread
  left join lateral (
    select activity.kind, activity.preview, activity.user_id, activity.created_at
    from (
      select 'photo'::text, coalesce(nullif(btrim(fp.caption), ''), '写真が投稿されました'),
        fp.user_id, fp.created_at
      from public.friend_photos fp
      where fp.group_id = g.id
        and not public.is_sns_user_blocked(auth.uid(), fp.user_id)
      union all
      select 'message'::text, gm.body, gm.user_id, gm.created_at
      from public.friend_group_messages gm
      where gm.group_id = g.id
        and not public.is_sns_user_blocked(auth.uid(), gm.user_id)
    ) activity(kind, preview, user_id, created_at)
    order by activity.created_at desc
    limit 1
  ) latest on true
  left join public.profiles actor on actor.user_id = latest.user_id
  order by m.sort_order asc, g.created_at asc;
$$;

revoke all on function public.get_my_friend_group_summaries() from public, anon;
grant execute on function public.get_my_friend_group_summaries() to authenticated;

create or replace function public.get_friend_group_polls(p_group_id uuid, p_limit integer default 5)
returns table (
  id uuid, group_id uuid, user_id uuid, display_name text, question text,
  closes_at timestamptz, created_at timestamptz, option_ids uuid[],
  option_labels text[], option_vote_counts bigint[], my_option_id uuid, total_votes bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    poll.id, poll.group_id, poll.user_id, p.display_name, poll.question,
    poll.closes_at, poll.created_at, options.ids, options.labels, options.counts,
    my_vote.option_id, coalesce(options.total, 0)
  from public.friend_group_polls poll
  join public.profiles p on p.user_id = poll.user_id
  cross join lateral (
    select
      array_agg(o.id order by o.sort_order),
      array_agg(o.label order by o.sort_order),
      array_agg(coalesce(v.n, 0) order by o.sort_order),
      sum(coalesce(v.n, 0))::bigint
    from public.friend_group_poll_options o
    left join lateral (
      select count(*)::bigint as n
      from public.friend_group_poll_votes pv
      where pv.option_id = o.id
        and (pv.user_id = auth.uid() or not public.is_sns_user_blocked(auth.uid(), pv.user_id))
    ) v on true
    where o.poll_id = poll.id
  ) options(ids, labels, counts, total)
  left join public.friend_group_poll_votes my_vote
    on my_vote.poll_id = poll.id and my_vote.user_id = auth.uid()
  where poll.group_id = p_group_id
    and public.is_friend_group_member(p_group_id)
    and not public.is_sns_user_blocked(auth.uid(), poll.user_id)
  order by poll.created_at desc
  limit greatest(coalesce(p_limit, 5), 1);
$$;

revoke all on function public.get_friend_group_polls(uuid, integer) from public, anon;
grant execute on function public.get_friend_group_polls(uuid, integer) to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'SNS_CONSISTENCY_AND_RELIABILITY_READY'::text as status,
  has_function_privilege('authenticated', 'public.get_sns_hidden_user_ids()', 'EXECUTE') as hidden_users_ok,
  has_function_privilege('authenticated', 'public.get_my_friend_group_summaries()', 'EXECUTE') as summaries_ok;
