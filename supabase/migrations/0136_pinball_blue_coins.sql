-- =============================================================
-- 赤コインをやめて、ご当地ピンボールの報酬を青コインにする
-- =============================================================
-- 0134（ピンボールと赤コイン）・0135（ホームに降る赤コイン）の後に適用する。
-- ・ご当地ピンボールの報酬は青コインにする。枚数は赤コインのときの8割：
--   スコア ÷ 11875（切り捨て、9500 ÷ 0.8）、1プレイ 2400 枚まで（3000 × 0.8）。
--   アプリ側の src/lib/games/pinball/config.ts（COIN_POINTS・COIN_MAX）と同じにする。
-- ・ホームに赤コインはもう降らない。claim_home_coin_drop は 0129 と同じく黄色・青だけを受けつける。
-- ・いま持っている赤コインは、同じ枚数の青コインにする（1回だけ。赤の残高は 0 にする）。
-- ・赤コインの残高と台帳のテーブルは、これまでの記録として残す（もう増えない）。
begin;

do $$
begin
  if to_regprocedure('public.add_blue_coin_event(uuid, text, integer, text, jsonb)') is null
     or to_regprocedure('public.add_red_coin_event(uuid, text, integer, text, jsonb)') is null
     or to_regprocedure('public.claim_home_coin_drop(text, text, text)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'PINBALL_BLUE_COINS_MISSING_DEPENDENCY',
      hint = '青コイン（0111）・ホームの降ってくるコイン（0129）・赤コイン（0134・0135）を先に適用してください。';
  end if;
end;
$$;

-- 青コインの台帳の種類に、ピンボールと「赤コインから換えた分」を足す（いまある行は見直さない）
alter table public.blue_coin_events drop constraint if exists blue_coin_events_event_type_check;
alter table public.blue_coin_events add constraint blue_coin_events_event_type_check
  check (event_type in ('osanpo_run', 'room_furniture', 'pref_gacha', 'first_place', 'login_total', 'home_drop', 'app_background', 'home_skin', 'pinball', 'red_coin_convert')) not valid;

-- 赤コインの台帳の種類に、青コインへ換えた分（マイナス）を足す
alter table public.red_coin_events drop constraint if exists red_coin_events_event_type_check;
alter table public.red_coin_events add constraint red_coin_events_event_type_check
  check (event_type in ('pinball', 'home_drop', 'blue_convert')) not valid;

-- -------------------------------------------------------------
-- いま持っている赤コインを、同じ枚数の青コインにする
-- -------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in select user_id, balance from public.user_red_coins where balance > 0 loop
    perform public.add_blue_coin_event(
      r.user_id, 'red_coin_convert', r.balance, 'red-coin-convert',
      jsonb_build_object('label', '赤コインから換えた青コイン', 'red', r.balance)
    );
    perform public.add_red_coin_event(
      r.user_id, 'blue_convert', -r.balance, 'blue-convert',
      jsonb_build_object('label', '青コインに換えた')
    );
  end loop;
end;
$$;

-- -------------------------------------------------------------
-- 結果の記録と青コインの付与
-- -------------------------------------------------------------
create or replace function public.record_pinball_result(
  p_round_id text,
  p_table text,
  p_score integer,
  p_duration_ms integer,
  p_items integer,
  p_conquests integer,
  p_jackpots integer,
  p_max_combo integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_applied boolean := false;
  v_prev_best integer;
  v_best integer;
  v_coins integer;
  v_balance integer;
  v_recent integer;
  -- アプリ側の COIN_POINTS / COIN_MAX と同じ
  v_points_per_coin constant integer := 11875;
  v_max_coins constant integer := 2400;
  -- 1秒あたりにとれる得点の上限の目安（MAX_SCORE_PER_SECOND と同じ）
  v_max_per_second constant integer := 400000;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_round_id is null or length(p_round_id) not between 8 and 100 then
    raise exception using errcode = 'P0001', message = 'INVALID_ROUND_ID';
  end if;
  if p_table is null or not (p_table = 'default' or p_table ~ '^[0-9]{2}$') then
    raise exception using errcode = 'P0001', message = 'INVALID_TABLE';
  end if;
  if p_score is null or p_score < 0 or p_score > 200000000 then
    raise exception using errcode = 'P0001', message = 'INVALID_SCORE';
  end if;
  if p_duration_ms is null or p_duration_ms < 0 or p_duration_ms > 10800000 then
    raise exception using errcode = 'P0001', message = 'INVALID_DURATION';
  end if;
  -- 遊んだ時間のわりに大きすぎるスコアは受けつけない（はじめの30秒ぶんは余裕をみる）
  if p_score::bigint > ((p_duration_ms::bigint / 1000) + 30) * v_max_per_second then
    raise exception using errcode = 'P0001', message = 'INVALID_SCORE';
  end if;
  if p_items is null or p_items not between 0 and 10000
     or p_conquests is null or p_conquests not between 0 and 1000
     or p_jackpots is null or p_jackpots not between 0 and 10000
     or p_max_combo is null or p_max_combo not between 0 and 100 then
    raise exception using errcode = 'P0001', message = 'INVALID_COUNTS';
  end if;

  -- 新しいプレイは1時間に40回まで（API の制限と同じ。関数を直接呼んで青コインをかせがれないように）。
  -- 同じ round_id の再送は、下で前と同じ結果を返すのでそのまま通す
  if not exists (select 1 from public.pinball_scores s where s.user_id = v_user_id and s.round_id = p_round_id) then
    select count(*) into v_recent
      from public.pinball_scores s
     where s.user_id = v_user_id and s.played_at > now() - interval '1 hour';
    if v_recent >= 40 then
      raise exception using errcode = 'P0001', message = 'TOO_MANY_ROUNDS';
    end if;
  end if;

  select max(s.score) into v_prev_best
    from public.pinball_scores s
   where s.user_id = v_user_id and s.table_id = p_table;

  v_coins := least(v_max_coins, floor(p_score / v_points_per_coin::numeric)::integer);

  insert into public.pinball_scores (user_id, round_id, table_id, score, duration_ms, items, conquests, jackpots, max_combo, coins)
  values (v_user_id, p_round_id, p_table, p_score, p_duration_ms, p_items, p_conquests, p_jackpots, p_max_combo, v_coins)
  on conflict (user_id, round_id) do nothing;
  v_applied := found;

  if v_applied then
    if v_coins > 0 then
      perform public.add_blue_coin_event(
        v_user_id,
        'pinball',
        v_coins,
        'pinball:' || p_round_id,
        jsonb_build_object('label', 'ご当地ピンボール', 'table', p_table, 'score', p_score, 'items', p_items, 'conquests', p_conquests)
      );
    end if;
  else
    -- 再送：1回目に付けた枚数を返す（0136 より前のプレイは赤コインで付いているので、もう付けない）
    select s.coins into v_coins
      from public.pinball_scores s
     where s.user_id = v_user_id and s.round_id = p_round_id;
  end if;

  select max(s.score) into v_best
    from public.pinball_scores s
   where s.user_id = v_user_id and s.table_id = p_table;

  select balance into v_balance from public.user_blue_coins where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'applied', v_applied,
    'coins', greatest(coalesce(v_coins, 0), 0),
    'balance', coalesce(v_balance, 0),
    'best', coalesce(v_best, 0),
    'is_best', v_applied and p_score > coalesce(v_prev_best, -1) and p_score > 0
  );
end;
$$;

revoke all on function public.record_pinball_result(text, text, integer, integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.record_pinball_result(text, text, integer, integer, integer, integer, integer, integer) to authenticated;

comment on function public.record_pinball_result(text, text, integer, integer, integer, integer, integer, integer) is
  'ご当地ピンボールの1プレイを記録し、スコア÷11875（切り捨て、1プレイ2400まで）を青コインとして付与する。同じ round_id は二重に記録・付与しない。';

-- -------------------------------------------------------------
-- ホームの降ってくるコイン：黄色・青だけにもどす
-- -------------------------------------------------------------
create or replace function public.claim_home_coin_drop(p_drop_id text, p_kind text, p_tier text default 'common')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (timezone('Asia/Tokyo', now()))::date;
  v_tier text;
  v_amount integer;
  v_key text;
  v_last timestamptz;
  v_tier_count integer;
  v_tier_limit integer;
  v_applied boolean;
  v_balance integer;
  v_blue_balance integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_drop_id is null or p_drop_id !~ '^[A-Za-z0-9_-]{8,64}$' then raise exception 'Invalid drop id'; end if;
  if p_kind is null or p_kind not in ('coin', 'blue') then raise exception 'Invalid coin kind'; end if;
  if p_tier is null or p_tier not in ('common', 'rare', 'epic') then raise exception 'Invalid coin tier'; end if;

  -- 同じ人の受け取りを1つずつ数える
  perform pg_advisory_xact_lock(hashtext('home_drop:' || v_user_id::text));

  v_key := 'home-drop:' || p_drop_id;

  -- 同じコインの再送は受け取らない（どちらの台帳にあっても）
  if exists (select 1 from public.coin_events where user_id = v_user_id and idempotency_key = v_key)
     or exists (select 1 from public.blue_coin_events where user_id = v_user_id and idempotency_key = v_key) then
    return jsonb_build_object('ok', true, 'granted', false, 'reason', 'duplicate');
  end if;

  -- 前の受け取りから 8 秒（黄色・青のどちらでも）
  select max(created_at) into v_last
    from public.coin_events
   where user_id = v_user_id and event_type = 'home_drop' and created_at > now() - interval '1 minute';
  select greatest(v_last, max(created_at)) into v_last
    from public.blue_coin_events
   where user_id = v_user_id and event_type = 'home_drop' and created_at > now() - interval '1 minute';
  if v_last is not null and v_last > now() - interval '8 seconds' then
    return jsonb_build_object('ok', true, 'granted', false, 'reason', 'too_soon');
  end if;

  -- レア度ごとの、直近1時間の回数（2色あわせて）。超えたら、ふつうとして渡す
  v_tier := p_tier;
  if v_tier <> 'common' then
    select
      (select count(*) from public.coin_events
        where user_id = v_user_id and event_type = 'home_drop'
          and created_at > now() - interval '1 hour' and metadata->>'tier' = v_tier)
      + (select count(*) from public.blue_coin_events
        where user_id = v_user_id and event_type = 'home_drop'
          and created_at > now() - interval '1 hour' and metadata->>'tier' = v_tier)
      into v_tier_count;
    v_tier_limit := (case v_tier when 'epic' then 8 else 30 end);
    if v_tier_count >= v_tier_limit then
      v_tier := 'common';
    end if;
  end if;

  v_amount := case v_tier when 'epic' then 100 when 'rare' then 20 else 5 end;

  if p_kind = 'blue' then
    v_applied := public.add_blue_coin_event(
      v_user_id, 'home_drop', v_amount, v_key,
      jsonb_build_object('label', 'ホームで拾った青コイン', 'drop_id', p_drop_id, 'tier', v_tier)
    );
  else
    v_applied := public.add_coin_event(
      v_user_id, 'home_drop', v_amount, v_key, null, v_today,
      jsonb_build_object('label', 'ホームで拾ったコイン', 'drop_id', p_drop_id, 'tier', v_tier)
    );
  end if;

  select balance into v_balance from public.user_coins where user_id = v_user_id;
  select balance into v_blue_balance from public.user_blue_coins where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'granted', v_applied,
    'kind', p_kind,
    'tier', v_tier,
    'amount', case when v_applied then v_amount else 0 end,
    'balance', coalesce(v_balance, 0),
    'blue_balance', coalesce(v_blue_balance, 0)
  );
end;
$$;

revoke all on function public.claim_home_coin_drop(text, text, text) from public, anon;
grant execute on function public.claim_home_coin_drop(text, text, text) to authenticated;

comment on function public.claim_home_coin_drop(text, text, text) is
  'ホームの犬カードに降ってきたコイン（黄色・青）を受け取る。ふつう5・中レア20・高レア100。同じコインは1回だけ、前の受け取りから8秒あける。';

commit;

notify pgrst, 'reload schema';
