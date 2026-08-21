-- =============================================================
-- SNS: 通知の返信取得をバッチ化し、未読集計の対象投稿を返信の新しさで選ぶ
-- =============================================================
-- 通知センターは自分の投稿ごとに get_friend_text_post_replies を個別に
-- 呼んでいたため、返信のある投稿が多い利用者ほどRPCの往復回数が増えていた。
-- 1回のRPCでまとめて取得できるようにする。
-- また get_sns_unread_count / 通知センターは「自分の投稿の新しさ」で
-- 対象を絞っていたため、古い投稿に新しい返信が付いても件数から漏れる
-- ことがあった。「返信の新しさ」で対象を選ぶよう修正する。
begin;

do $$
begin
  if to_regprocedure('public.get_friend_text_post_replies(uuid)') is null
    or to_regprocedure('public.get_sns_unread_count()') is null
    or to_regprocedure('public.can_view_friend_text_post(uuid)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'SNS_NOTIFICATION_BATCH_MISSING_DEPENDENCY',
      hint = '先に 0060_sns_performance.sql まで適用してください。';
  end if;
end;
$$;

create index if not exists friend_text_post_replies_post_created_idx
  on public.friend_text_post_replies(post_id, created_at desc);

-- 通知センターの返信一覧を、投稿ごとの個別RPC呼び出しではなく1回でまとめて取得する。
create or replace function public.get_friend_text_post_replies_batch(p_post_ids uuid[])
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
  where p_post_ids is not null
    and r.post_id = any(p_post_ids)
    and public.can_view_friend_text_post(r.post_id)
    and not public.is_sns_user_blocked(auth.uid(), r.user_id)
  order by r.post_id, r.created_at asc;
$$;

revoke all on function public.get_friend_text_post_replies_batch(uuid[]) from public, anon;
grant execute on function public.get_friend_text_post_replies_batch(uuid[]) to authenticated;

-- 対象投稿の絞り込みを「自分の投稿の新しさ」から「返信の新しさ」に変更する
-- （それ以外は0060と同一）。
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
      select tp.id
      from public.friend_text_posts tp
      where tp.user_id = v_user_id
      order by tp.created_at desc
      limit 50
    ), reply_posts as (
      select op.id, latest.last_reply_at
      from own_posts op
      join lateral (
        select max(r.created_at) as last_reply_at
        from public.friend_text_post_replies r
        where r.post_id = op.id
      ) latest on latest.last_reply_at is not null
      order by latest.last_reply_at desc
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
      select tp.id
      from public.friend_text_posts tp
      where tp.user_id = v_user_id
      order by tp.created_at desc
      limit 50
    ), reply_posts as (
      select op.id, latest.last_reply_at
      from own_posts op
      join lateral (
        select max(r.created_at) as last_reply_at
        from public.friend_text_post_replies r
        where r.post_id = op.id
      ) latest on latest.last_reply_at is not null
      order by latest.last_reply_at desc
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
  'SNS_NOTIFICATION_BATCH_READY'::text as status,
  has_function_privilege('authenticated', 'public.get_friend_text_post_replies_batch(uuid[])', 'EXECUTE')
    as replies_batch_ok;
