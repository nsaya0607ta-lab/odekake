-- =============================================================
-- ホームの犬カード：空から降ってくるコイン
-- =============================================================
-- 0125 の後に適用する。
-- ・ホームの犬カードに、ときどき空からコイン（黄色 or 青）が降ってくる。犬が取りに行くか、タップで拾うと
--   1回につき 5 枚もらえる。降るかどうかはアプリ側（5秒ごとに5%）で決めるので、DB 側で上限を決めて守る。
--   ・1日（日本時間）に受け取れるのは 10 回まで（青はそのうち 3 回まで。こえたぶんは黄色で渡す）
--   ・前に受け取ってから 8 秒たっていないときは受け取らない（連打・自動化よけ）
--   ・同じコイン（drop_id）は1回だけ
-- ・あわせて、青コインの台帳の種類チェックを直す。
--   0125 で入れた「はじめての場所（first_place）」「通算ログイン（login_total）」が 0117 のチェックに
--   入っていなかったため、はじめての場所の青コインが入らず、通算7日目ごとのログインボーナスが
--   エラーで受け取れなくなっていた。
begin;

do $$
begin
  if to_regprocedure('public.add_blue_coin_event(uuid, text, integer, text, jsonb)') is null
     or to_regprocedure('public.add_coin_event(uuid, text, integer, text, integer, date, jsonb)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'HOME_COIN_DROPS_MISSING_DEPENDENCY',
      hint = 'コイン（0011）と青コイン（0111・0125）を先に適用してください。';
  end if;
end;
$$;

-- 黄色のコインの種類に home_drop を足す（いまある行は見直さない）
alter table public.coin_events drop constraint if exists coin_events_event_type_check;
alter table public.coin_events add constraint coin_events_event_type_check
  check (event_type in (
    'level_up', 'steps', 'unlock', 'gacha', 'login', 'item_catch',
    'wanko_bowling', 'snack_trail', 'dambourle_gacha', 'osanpo_run', 'home_drop'
  )) not valid;

-- 青コインの種類：0125 のぶん（first_place・login_total）と home_drop を足す
alter table public.blue_coin_events drop constraint if exists blue_coin_events_event_type_check;
alter table public.blue_coin_events add constraint blue_coin_events_event_type_check
  check (event_type in ('osanpo_run', 'room_furniture', 'pref_gacha', 'first_place', 'login_total', 'home_drop')) not valid;

create or replace function public.claim_home_coin_drop(p_drop_id text, p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_amount constant integer := 5;
  v_daily_limit constant integer := 10;
  v_blue_limit constant integer := 3;
  v_today date := (timezone('Asia/Tokyo', now()))::date;
  v_day_start timestamptz := (v_today::timestamp at time zone 'Asia/Tokyo');
  v_key text;
  v_yellow_today integer;
  v_blue_today integer;
  v_last timestamptz;
  v_kind text;
  v_applied boolean;
  v_balance integer;
  v_blue_balance integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_drop_id is null or p_drop_id !~ '^[A-Za-z0-9_-]{8,64}$' then raise exception 'Invalid drop id'; end if;
  if p_kind is null or p_kind not in ('coin', 'blue') then raise exception 'Invalid coin kind'; end if;

  -- 同じ人の受け取りを1つずつ数える
  perform pg_advisory_xact_lock(hashtext('home_drop:' || v_user_id::text));

  v_key := 'home-drop:' || p_drop_id;

  -- 同じコインの再送は、最初に受け取った結果をそのまま返す
  if exists (select 1 from public.coin_events where user_id = v_user_id and idempotency_key = v_key)
     or exists (select 1 from public.blue_coin_events where user_id = v_user_id and idempotency_key = v_key) then
    return jsonb_build_object('ok', true, 'granted', false, 'reason', 'duplicate');
  end if;

  select count(*), max(created_at) into v_yellow_today, v_last
    from public.coin_events
   where user_id = v_user_id and event_type = 'home_drop' and event_date = v_today;
  select count(*), greatest(v_last, max(created_at)) into v_blue_today, v_last
    from public.blue_coin_events
   where user_id = v_user_id and event_type = 'home_drop' and created_at >= v_day_start;

  if v_yellow_today + v_blue_today >= v_daily_limit then
    return jsonb_build_object('ok', true, 'granted', false, 'reason', 'daily_limit', 'remaining', 0);
  end if;
  if v_last is not null and v_last > now() - interval '8 seconds' then
    return jsonb_build_object('ok', true, 'granted', false, 'reason', 'too_soon',
      'remaining', v_daily_limit - v_yellow_today - v_blue_today);
  end if;

  -- 青は1日3回まで。こえたぶんは黄色で渡す
  v_kind := case when p_kind = 'blue' and v_blue_today < v_blue_limit then 'blue' else 'coin' end;

  if v_kind = 'blue' then
    v_applied := public.add_blue_coin_event(
      v_user_id, 'home_drop', v_amount, v_key,
      jsonb_build_object('label', 'ホームで拾った青コイン', 'drop_id', p_drop_id)
    );
  else
    v_applied := public.add_coin_event(
      v_user_id, 'home_drop', v_amount, v_key, null, v_today,
      jsonb_build_object('label', 'ホームで拾ったコイン', 'drop_id', p_drop_id)
    );
  end if;

  select balance into v_balance from public.user_coins where user_id = v_user_id;
  select balance into v_blue_balance from public.user_blue_coins where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'granted', v_applied,
    'kind', v_kind,
    'amount', case when v_applied then v_amount else 0 end,
    'remaining', greatest(0, v_daily_limit - v_yellow_today - v_blue_today - case when v_applied then 1 else 0 end),
    'balance', coalesce(v_balance, 0),
    'blue_balance', coalesce(v_blue_balance, 0)
  );
end;
$$;

revoke all on function public.claim_home_coin_drop(text, text) from public, anon;
grant execute on function public.claim_home_coin_drop(text, text) to authenticated;

commit;

notify pgrst, 'reload schema';
