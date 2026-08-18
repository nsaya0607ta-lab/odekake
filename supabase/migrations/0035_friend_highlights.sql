-- =============================================================
-- ホーム画面のフレンドカルーセル用RPC
-- =============================================================
-- 「フレンドの最新おでかけ」「フレンドの歩数ランキング」をホームの
-- カルーセルに出すための、SECURITY DEFINER な読み取り専用RPCを追加する。
-- 既存の friendships / visit_records / spots / daily_steps / profiles /
-- friend_privacy_settings の RLS・テーブル定義は一切変更しない。
begin;

do $$
declare
  v_missing text[] := '{}';
  v_table text;
begin
  foreach v_table in array array[
    'friendships',
    'friend_privacy_settings',
    'visit_records',
    'spots',
    'daily_steps',
    'profiles'
  ] loop
    if to_regclass('public.' || v_table) is null then
      v_missing := array_append(v_missing, 'public.' || v_table);
    end if;
  end loop;

  if cardinality(v_missing) > 0 then
    raise exception using
      errcode = 'P0001',
      message = 'FRIEND_HIGHLIGHTS_MIGRATION_MISSING_DEPENDENCIES: ' || array_to_string(v_missing, ', '),
      hint = 'フレンド機能（0019_friends.sql）を先に適用してください。';
  end if;

  if to_regprocedure('public.is_friend(uuid)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'FRIEND_HIGHLIGHTS_MIGRATION_MISSING_DEPENDENCY: public.is_friend(uuid)',
      hint = 'フレンド機能（0019_friends.sql）を先に適用してください。';
  end if;
end;
$$;

-- 自分の全フレンド分の訪問登録を、フレンドをまたいで登録が新しい順にまとめて返す。
-- 「誰が」ではなく「いつ登録したか」で並べるため、visited_at（旅の日付）ではなく
-- created_at（実際に記録した時刻）で並べる。
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
  select
    f.friend_user_id,
    coalesce(nullif(btrim(p.display_name), ''), 'ゲスト') as display_name,
    p.profile_image_url,
    s.name as spot_name,
    s.prefecture_code,
    s.municipality_code,
    vr.created_at as registered_at
  from public.friendships f
  join public.visit_records vr on vr.user_id = f.friend_user_id
  join public.spots s on s.id = vr.spot_id
  left join public.profiles p on p.user_id = f.friend_user_id
  where auth.uid() is not null
    and f.user_id = auth.uid()
    and coalesce((
      select ps.show_recent_visits
      from public.friend_privacy_settings ps
      where ps.user_id = f.friend_user_id
    ), true)
  order by vr.created_at desc
  limit least(greatest(coalesce(p_limit, 10), 1), 30);
$$;

-- 自分のフレンドの「今日の歩数」ランキング。歩数が多い順。
-- 今日まだ記録が無いフレンドは 0 歩として一覧に含める。
drop function if exists public.get_friends_steps_ranking(integer);

create function public.get_friends_steps_ranking(p_limit integer default 5)
returns table (
  friend_user_id uuid,
  display_name text,
  profile_image_url text,
  steps integer
)
language sql
security definer
stable
set search_path = public
as $$
  select
    f.friend_user_id,
    coalesce(nullif(btrim(p.display_name), ''), 'ゲスト') as display_name,
    p.profile_image_url,
    coalesce(ds.steps, 0) as steps
  from public.friendships f
  left join public.profiles p on p.user_id = f.friend_user_id
  left join public.daily_steps ds
    on ds.user_id = f.friend_user_id
   and ds.step_date = (now() at time zone 'Asia/Tokyo')::date
  where auth.uid() is not null
    and f.user_id = auth.uid()
  order by coalesce(ds.steps, 0) desc, f.friend_user_id
  limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;

revoke all on function public.get_friends_activity_feed(integer) from public, anon;
revoke all on function public.get_friends_steps_ranking(integer) from public, anon;

grant execute on function public.get_friends_activity_feed(integer) to authenticated;
grant execute on function public.get_friends_steps_ranking(integer) to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'FRIEND_HIGHLIGHTS_READY'::text as status,
  to_regprocedure('public.get_friends_activity_feed(integer)') is not null as activity_rpc_ok,
  to_regprocedure('public.get_friends_steps_ranking(integer)') is not null as steps_rpc_ok;
