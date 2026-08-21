-- =============================================================
-- SNS: 未読バッジを1 RPCで集計し、メンション検索を軽量化する。
-- 画面ごとに最大20回取得していた返信一覧をDB内で集計することで、
-- モバイル回線でも画面遷移を待たせない。
-- =============================================================
begin;

do $$
begin
  if to_regclass('public.friend_text_posts') is null
    or to_regclass('public.friend_text_post_replies') is null
    or to_regclass('public.friend_text_post_likes') is null
    or to_regprocedure('public.get_sns_mentions(integer)') is null
    or to_regprocedure('public.get_my_friend_groups()') is null then
    raise exception using
      errcode = 'P0001',
      message = 'SNS_PERFORMANCE_MISSING_DEPENDENCY',
      hint = '先に 0059_sns_familiar_features.sql まで適用してください。';
  end if;
end;
$$;

create index if not exists friend_text_post_mentions_user_created_idx
  on public.friend_text_post_mentions(mentioned_user_id, created_at desc);
create index if not exists friend_text_post_reply_mentions_user_created_idx
  on public.friend_text_post_reply_mentions(mentioned_user_id, created_at desc);
create index if not exists friend_group_message_mentions_user_created_idx
  on public.friend_group_message_mentions(mentioned_user_id, created_at desc);

create or replace function public.get_sns_unread_count()
returns bigint
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_metadata jsonb := '{}'::jsonb;
  v_preferences jsonb := '{}'::jsonb;
  v_like_counts jsonb := '{}'::jsonb;
  v_muted_groups jsonb := '[]'::jsonb;
  v_seen_at timestamptz := 'epoch'::timestamptz;
  v_notify_replies boolean := true;
  v_notify_likes boolean := true;
  v_notify_mentions boolean := true;
  v_notify_groups boolean := true;
  v_unread_replies bigint := 0;
  v_unread_likes bigint := 0;
  v_unread_mentions bigint := 0;
  v_unread_groups bigint := 0;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select coalesce(u.raw_user_meta_data, '{}'::jsonb)
    into v_metadata
  from auth.users u
  where u.id = v_user_id;

  v_preferences := case
    when jsonb_typeof(v_metadata -> 'sns_notification_preferences') = 'object'
      then v_metadata -> 'sns_notification_preferences'
    else '{}'::jsonb
  end;
  v_like_counts := case
    when jsonb_typeof(v_metadata -> 'sns_notification_like_counts') = 'object'
      then v_metadata -> 'sns_notification_like_counts'
    else '{}'::jsonb
  end;
  v_muted_groups := case
    when jsonb_typeof(v_metadata -> 'sns_muted_group_ids') = 'array'
      then v_metadata -> 'sns_muted_group_ids'
    else '[]'::jsonb
  end;

  begin
    v_seen_at := coalesce(
      nullif(v_metadata ->> 'sns_notifications_seen_at', '')::timestamptz,
      'epoch'::timestamptz
    );
  exception when invalid_datetime_format then
    v_seen_at := 'epoch'::timestamptz;
  end;

  v_notify_replies := case
    when jsonb_typeof(v_preferences -> 'replies') = 'boolean'
      then (v_preferences ->> 'replies')::boolean
    else true
  end;
  v_notify_likes := case
    when jsonb_typeof(v_preferences -> 'likes') = 'boolean'
      then (v_preferences ->> 'likes')::boolean
    else true
  end;
  v_notify_mentions := case
    when jsonb_typeof(v_preferences -> 'mentions') = 'boolean'
      then (v_preferences ->> 'mentions')::boolean
    else true
  end;
  v_notify_groups := case
    when jsonb_typeof(v_preferences -> 'groups') = 'boolean'
      then (v_preferences ->> 'groups')::boolean
    else true
  end;

  if v_notify_replies then
    with own_posts as materialized (
      select tp.id, tp.created_at
      from public.friend_text_posts tp
      where tp.user_id = v_user_id
      order by tp.created_at desc
      limit 50
    ), reply_posts as (
      select op.id, op.created_at
      from own_posts op
      where exists (
        select 1 from public.friend_text_post_replies r where r.post_id = op.id
      )
      order by op.created_at desc
      limit 20
    )
    select count(*)::bigint
      into v_unread_replies
    from reply_posts rp
    join public.friend_text_post_replies r on r.post_id = rp.id
    where r.user_id <> v_user_id
      and r.created_at > v_seen_at
      and not public.is_sns_user_blocked(v_user_id, r.user_id);
  end if;

  if v_notify_likes then
    with own_posts as materialized (
      select tp.id
      from public.friend_text_posts tp
      where tp.user_id = v_user_id
      order by tp.created_at desc
      limit 50
    ), totals as (
      select op.id, count(l.user_id) filter (where l.user_id <> v_user_id)::bigint as current_count
      from own_posts op
      left join public.friend_text_post_likes l on l.post_id = op.id
      group by op.id
    )
    select coalesce(sum(greatest(
      totals.current_count - case
        when jsonb_typeof(v_like_counts -> totals.id::text) = 'number'
          then (v_like_counts ->> totals.id::text)::bigint
        else 0::bigint
      end,
      0::bigint
    )), 0)::bigint
      into v_unread_likes
    from totals;
  end if;

  if v_notify_mentions then
    with own_posts as materialized (
      select tp.id, tp.created_at
      from public.friend_text_posts tp
      where tp.user_id = v_user_id
      order by tp.created_at desc
      limit 50
    ), reply_posts as (
      select op.id, op.created_at
      from own_posts op
      where exists (
        select 1 from public.friend_text_post_replies r where r.post_id = op.id
      )
      order by op.created_at desc
      limit 20
    )
    select count(*)::bigint
      into v_unread_mentions
    from public.get_sns_mentions(50) mention
    where mention.created_at > v_seen_at
      and not (
        v_notify_replies
        and mention.kind = 'reply'
        and exists (select 1 from reply_posts rp where rp.id = mention.post_id)
      );
  end if;

  if v_notify_groups then
    select count(*)::bigint
      into v_unread_groups
    from public.get_my_friend_groups() friend_group
    where friend_group.has_unread
      and not (v_muted_groups ? friend_group.id::text);
  end if;

  return coalesce(v_unread_replies, 0)
    + coalesce(v_unread_likes, 0)
    + coalesce(v_unread_mentions, 0)
    + coalesce(v_unread_groups, 0);
end;
$$;

revoke all on function public.get_sns_unread_count() from public, anon;
grant execute on function public.get_sns_unread_count() to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'SNS_PERFORMANCE_READY'::text as status,
  has_function_privilege('authenticated', 'public.get_sns_unread_count()', 'EXECUTE') as unread_count_ok;
