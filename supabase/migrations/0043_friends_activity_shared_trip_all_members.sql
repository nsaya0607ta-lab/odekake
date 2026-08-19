-- =============================================================
-- 「みんなのおでかけ」で、共有旅は登録者だけでなく参加者全員に出す
-- =============================================================
-- 従来は visit_records を実際に登録した本人しか「みんなのおでかけ」に
-- 出なかったため、共有旅で1人だけが登録すると他の参加者(一緒に行った
-- はずのメンバー)が一切表示されなかった。
-- 共有旅の登録は、承認済み参加者全員の「行った」として展開して見せる。
begin;

drop function if exists public.get_friends_activity_feed(integer);

create function public.get_friends_activity_feed(p_limit integer default 10)
returns table (
  friend_user_id uuid,
  display_name text,
  profile_image_url text,
  spot_name text,
  prefecture_code text,
  municipality_code text,
  registered_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  with visible_visits as (
    select
      vr.id,
      vr.user_id,
      vr.spot_id,
      vr.created_at,
      t.trip_type,
      coalesce(root.id, t.id) as root_trip_id
    from public.visit_records vr
    left join public.trips t on t.id = vr.trip_id
    left join public.trips root on root.id = t.parent_trip_id
    where auth.uid() is not null
      and (
        -- 自分自身の登録
        vr.user_id = auth.uid()
        -- フレンドの登録
        or exists (
          select 1 from public.friendships f
          where f.user_id = auth.uid() and f.friend_user_id = vr.user_id
        )
        -- 自分も参加している共有旅の、他の参加者の登録
        or (
          t.trip_type = 'shared'
          and public.is_accepted_trip_member(coalesce(root.id, t.id), auth.uid())
          and public.is_accepted_trip_member(coalesce(root.id, t.id), vr.user_id)
        )
      )
      and (
        vr.user_id = auth.uid()
        or coalesce((
          select ps.show_recent_visits
          from public.friend_privacy_settings ps
          where ps.user_id = vr.user_id
        ), true)
      )
  ),
  -- 共有旅の登録は、実際に登録した人だけでなく承認済み参加者全員の
  -- 「行った」として展開する。それ以外(自分・フレンド)は登録者本人のみ。
  expanded_visits as (
    select vv.id, vv.user_id as registrant_id, vv.spot_id, vv.created_at
    from visible_visits vv
    union
    select vv.id, tm.user_id as registrant_id, vv.spot_id, vv.created_at
    from visible_visits vv
    join public.trip_members tm
      on tm.trip_id = vv.root_trip_id
     and tm.status = 'accepted'
     and tm.user_id <> vv.user_id
    where vv.trip_type = 'shared'
  )
  select
    ev.registrant_id as friend_user_id,
    coalesce(nullif(btrim(p.display_name), ''), 'ゲスト') as display_name,
    p.profile_image_url,
    s.name as spot_name,
    s.prefecture_code,
    s.municipality_code,
    ev.created_at as registered_at
  from expanded_visits ev
  join public.spots s on s.id = ev.spot_id
  left join public.profiles p on p.user_id = ev.registrant_id
  order by ev.created_at desc
  limit least(greatest(coalesce(p_limit, 10), 1), 30);
$$;

revoke all on function public.get_friends_activity_feed(integer) from public, anon;
grant execute on function public.get_friends_activity_feed(integer) to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'FRIENDS_ACTIVITY_SHARED_TRIP_ALL_MEMBERS_READY'::text as status,
  to_regprocedure('public.get_friends_activity_feed(integer)') is not null as activity_rpc_ok;
