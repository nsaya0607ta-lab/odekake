-- =============================================================
-- 「みんなのおでかけ」に自分の登録・共有旅の参加者の登録も含める
-- =============================================================
-- 従来の get_friends_activity_feed はフレンドの visit_records だけを
-- 対象にしていたため、(1) 自分自身の登録、(2) 友達登録はしていないが
-- 共有旅に一緒に参加しているメンバーの登録、が一切表示されなかった。
-- これらも「みんなのおでかけ」に出るよう対象を広げる。
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
    select vr.id, vr.user_id, vr.spot_id, vr.created_at
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
  )
  select
    vv.user_id as friend_user_id,
    coalesce(nullif(btrim(p.display_name), ''), 'ゲスト') as display_name,
    p.profile_image_url,
    s.name as spot_name,
    s.prefecture_code,
    s.municipality_code,
    vv.created_at as registered_at
  from visible_visits vv
  join public.spots s on s.id = vv.spot_id
  left join public.profiles p on p.user_id = vv.user_id
  where vv.user_id = auth.uid()
     or coalesce((
       select ps.show_recent_visits
       from public.friend_privacy_settings ps
       where ps.user_id = vv.user_id
     ), true)
  order by vv.created_at desc
  limit least(greatest(coalesce(p_limit, 10), 1), 30);
$$;

revoke all on function public.get_friends_activity_feed(integer) from public, anon;
grant execute on function public.get_friends_activity_feed(integer) to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'FRIENDS_ACTIVITY_FEED_SELF_AND_TRIP_MEMBERS_READY'::text as status,
  to_regprocedure('public.get_friends_activity_feed(integer)') is not null as activity_rpc_ok;
