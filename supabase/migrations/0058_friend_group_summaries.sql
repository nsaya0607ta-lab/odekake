-- =============================================================
-- SNS: グループ一覧のサマリー（最新投稿・未読件数）
-- =============================================================
-- 一覧カードごとの追加問い合わせを避け、参加グループの表示に必要な情報を
-- 1回のRPCで返す。未読は自分以外の投稿だけを数える。
begin;

do $$
begin
  if to_regclass('public.friend_group_reads') is null
    or to_regclass('public.friend_group_messages') is null
    or to_regclass('public.friend_photos') is null then
    raise exception using
      errcode = 'P0001',
      message = 'FRIEND_GROUP_SUMMARIES_MISSING_DEPENDENCY',
      hint = '先に 0045_friend_groups.sql 以降のグループ関連マイグレーションを適用してください。';
  end if;
end;
$$;

create or replace function public.get_my_friend_group_summaries()
returns table (
  id uuid,
  name text,
  icon text,
  icon_path text,
  owner_id uuid,
  member_count bigint,
  created_at timestamptz,
  has_unread boolean,
  unread_count bigint,
  latest_kind text,
  latest_preview text,
  latest_actor_name text,
  latest_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    g.id,
    g.name,
    g.icon,
    g.icon_path,
    g.owner_id,
    (select count(*) from public.friend_group_members mm where mm.group_id = g.id) as member_count,
    g.created_at,
    unread.count > 0 as has_unread,
    unread.count as unread_count,
    latest.kind as latest_kind,
    latest.preview as latest_preview,
    coalesce(nullif(btrim(actor.display_name), ''), 'ゲスト') as latest_actor_name,
    latest.created_at as latest_at
  from public.friend_groups g
  join public.friend_group_members m
    on m.group_id = g.id
   and m.user_id = auth.uid()
  left join public.friend_group_reads r
    on r.group_id = g.id
   and r.user_id = auth.uid()
  cross join lateral (
    select count(*)::bigint as count
    from (
      select fp.id
      from public.friend_photos fp
      where fp.group_id = g.id
        and fp.user_id <> auth.uid()
        and fp.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
      union all
      select gm.id
      from public.friend_group_messages gm
      where gm.group_id = g.id
        and gm.user_id <> auth.uid()
        and gm.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
    ) unread_items
  ) unread
  left join lateral (
    select activity.kind, activity.preview, activity.user_id, activity.created_at
    from (
      select
        'photo'::text as kind,
        coalesce(nullif(btrim(fp.caption), ''), '写真が投稿されました') as preview,
        fp.user_id,
        fp.created_at
      from public.friend_photos fp
      where fp.group_id = g.id
      union all
      select
        'message'::text as kind,
        gm.body as preview,
        gm.user_id,
        gm.created_at
      from public.friend_group_messages gm
      where gm.group_id = g.id
    ) activity
    order by activity.created_at desc
    limit 1
  ) latest on true
  left join public.profiles actor on actor.user_id = latest.user_id
  order by m.sort_order asc, g.created_at asc;
$$;

revoke all on function public.get_my_friend_group_summaries() from public, anon;
grant execute on function public.get_my_friend_group_summaries() to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'FRIEND_GROUP_SUMMARIES_READY'::text as status,
  has_function_privilege('authenticated', 'public.get_my_friend_group_summaries()', 'EXECUTE') as summaries_ok;
