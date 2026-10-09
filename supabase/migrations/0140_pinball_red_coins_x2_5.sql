-- =============================================================
-- ご当地ピンボール：もらえる赤コインを2.5倍に・部品の持てる数の上限をなくす
-- =============================================================
-- 0139 の後に適用する（2026-10-09、ユーザー指定）。
-- ・もらえる赤コインを、どれも2.5倍にする。
--   ピンボール：スコア ÷ 11875 → ÷ 4750（切り捨て）、1プレイ 2400 → 6000 枚まで（record_pinball_result）。
--   ホームに降る赤コイン：ふつう 5 → 13（12.5 を切り上げ）・中レア 20 → 50・高レア 100 → 250（claim_home_coin_drop。黄色・青はそのまま）。
--   ログイン：1日 50 → 125 枚（claim_login_bonus）。
--   アプリの src/lib/games/pinball/config.ts（COIN_POINTS・COIN_MAX）・src/lib/red-coin-rewards.ts（RED_LOGIN_COINS）・
--   src/components/guide/guide-data.ts（HOME_DROP の redAmount）と同じにする。前にもらった赤コインは、そのまま。
-- ・部品の持てる数（pinball_part_catalog の max_count）を、ランプのほかは上限なし（null）にする。
--   1つのステージに置けるのは持っている数まで。部品どうしのすき間（アプリの STAGE_GAP）があるので、置ける数は台の広さで自然に決まる
--   （くぎでも約50本）。buy_pinball_part・save_pinball_stage は max_count が null なら上限を見ない（0138 のまま。least は null を無視する）。
begin;

do $$
begin
  if to_regprocedure('public.pinball_part_catalog()') is null
     or to_regprocedure('public.record_pinball_result(text, text, integer, integer, integer, integer, integer, integer, uuid)') is null
     or to_regprocedure('public.claim_home_coin_drop(text, text, text)') is null
     or to_regprocedure('public.claim_login_bonus()') is null then
    raise exception using
      errcode = 'P0001',
      message = 'PINBALL_RED_COINS_MISSING_DEPENDENCY',
      hint = 'ご当地ピンボールのステージと部品（0138・0139）を先に適用してください。';
  end if;
end;
$$;

/** 部品のカタログ。アプリの PINBALL_PARTS と同じ（price＝1回の値段、pack＝1回で増える数、free＝はじめから持っている数、max_count＝持てる数。null は上限なし） */
create or replace function public.pinball_part_catalog()
returns table (part text, price integer, pack integer, free integer, max_count integer)
language sql
immutable
set search_path = public
as $$
  values
    ('bumper'::text, 900, 1, 3, null::integer),
    ('pinwheel'::text, 1200, 1, 1, null::integer),
    ('post'::text, 150, 1, 4, null::integer),
    ('peg'::text, 300, 10, 10, null::integer),
    ('sling'::text, 1200, 1, 0, null::integer),
    ('rail'::text, 450, 1, 2, null::integer),
    ('rubber'::text, 600, 1, 0, null::integer),
    ('block'::text, 450, 1, 0, null::integer),
    ('bar'::text, 1500, 1, 0, null::integer),
    ('spinner'::text, 1200, 1, 0, null::integer),
    ('drop'::text, 900, 1, 0, null::integer),
    ('ramp_top'::text, 3600, 1, 0, 1),
    ('ramp_cross'::text, 5400, 1, 0, 1)
$$;

grant execute on function public.pinball_part_catalog() to authenticated;

-- 1プレイの赤コインが 6000 枚までになるので、記録の枚数の範囲を広げる
alter table public.pinball_scores drop constraint if exists pinball_scores_coins_range;
alter table public.pinball_scores add constraint pinball_scores_coins_range check (coins between 0 and 6000);

-- -------------------------------------------------------------
-- 結果の記録と赤コインの付与（0138 と同じ。換算だけ 2.5倍）
-- -------------------------------------------------------------
create or replace function public.record_pinball_result(
  p_round_id text,
  p_table text,
  p_score integer,
  p_duration_ms integer,
  p_items integer,
  p_conquests integer,
  p_jackpots integer,
  p_max_combo integer,
  p_stage_id uuid default null
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
  v_stage public.pinball_stages%rowtype;
  v_since timestamptz := '-infinity';
  -- アプリ側の COIN_POINTS / COIN_MAX と同じ
  v_points_per_coin constant integer := 4750;
  v_max_coins constant integer := 6000;
  -- 1秒あたりにとれる得点の上限の目安（MAX_SCORE_PER_SECOND と同じ）
  v_max_per_second constant integer := 400000;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_round_id is null or length(p_round_id) not between 8 and 100 then
    raise exception using errcode = 'P0001', message = 'INVALID_ROUND_ID';
  end if;
  -- 台はマップの id（英小文字ではじまる、英小文字・数字・_ の32文字まで）。ステージのプレイは 'stage' とステージの番号
  if p_table is null or p_table !~ '^[a-z][a-z0-9_]{0,31}$' or ((p_table = 'stage') <> (p_stage_id is not null)) then
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

  -- 同じ round_id の再送は、下で前と同じ結果を返す
  if not exists (select 1 from public.pinball_scores s where s.user_id = v_user_id and s.round_id = p_round_id) then
    -- ステージは、自分のものか、フレンドが公開しているものだけ
    if p_stage_id is not null and not public.can_play_pinball_stage(v_user_id, p_stage_id) then
      raise exception using errcode = 'P0001', message = 'STAGE_NOT_FOUND';
    end if;
    -- 新しいプレイは1時間に40回まで（API の制限と同じ。関数を直接呼んで赤コインをかせがれないように）
    select count(*) into v_recent
      from public.pinball_scores s
     where s.user_id = v_user_id and s.played_at > now() - interval '1 hour';
    if v_recent >= 40 then
      raise exception using errcode = 'P0001', message = 'TOO_MANY_ROUNDS';
    end if;
  end if;

  if p_stage_id is not null then
    select * into v_stage from public.pinball_stages where id = p_stage_id;
    v_since := coalesce(v_stage.layout_updated_at, '-infinity');
  end if;

  -- ベストは台ごと（ステージはステージごと。置き方を変える前のプレイは数えない）
  select max(s.score) into v_prev_best
    from public.pinball_scores s
   where s.user_id = v_user_id
     and (case when p_stage_id is null then s.table_id = p_table else s.stage_id = p_stage_id and s.played_at >= v_since end);

  v_coins := least(v_max_coins, floor(p_score / v_points_per_coin::numeric)::integer);

  insert into public.pinball_scores (user_id, round_id, table_id, stage_id, score, duration_ms, items, conquests, jackpots, max_combo, coins)
  values (v_user_id, p_round_id, p_table, p_stage_id, p_score, p_duration_ms, p_items, p_conquests, p_jackpots, p_max_combo, v_coins)
  on conflict (user_id, round_id) do nothing;
  v_applied := found;

  if v_applied then
    if v_coins > 0 then
      perform public.add_red_coin_event(
        v_user_id,
        'pinball',
        v_coins,
        'pinball:' || p_round_id,
        jsonb_build_object('label', 'ご当地ピンボール', 'table', p_table, 'stage', v_stage.name, 'score', p_score, 'items', p_items, 'conquests', p_conquests)
      );
    end if;
  else
    -- 再送：1回目に付けた枚数を返す
    select s.coins into v_coins
      from public.pinball_scores s
     where s.user_id = v_user_id and s.round_id = p_round_id;
  end if;

  select max(s.score) into v_best
    from public.pinball_scores s
   where s.user_id = v_user_id
     and (case when p_stage_id is null then s.table_id = p_table else s.stage_id = p_stage_id and s.played_at >= v_since end);

  select balance into v_balance from public.user_red_coins where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'applied', v_applied,
    'kind', 'red',
    'coins', greatest(coalesce(v_coins, 0), 0),
    'balance', coalesce(v_balance, 0),
    'best', coalesce(v_best, 0),
    'is_best', v_applied and p_score > coalesce(v_prev_best, -1) and p_score > 0
  );
end;
$$;

revoke all on function public.record_pinball_result(text, text, integer, integer, integer, integer, integer, integer, uuid) from public, anon;
grant execute on function public.record_pinball_result(text, text, integer, integer, integer, integer, integer, integer, uuid) to authenticated;

comment on function public.record_pinball_result(text, text, integer, integer, integer, integer, integer, integer, uuid) is
  'ご当地ピンボールの1プレイ（マップかステージ）を記録し、スコア÷4750（切り捨て、1プレイ6000まで）を赤コインとして付与する。同じ round_id は二重に記録・付与しない。';

-- -------------------------------------------------------------
-- ホームの降ってくるコイン（0138 と同じ。赤コインだけ 2.5倍）
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
  v_red_balance integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_drop_id is null or p_drop_id !~ '^[A-Za-z0-9_-]{8,64}$' then raise exception 'Invalid drop id'; end if;
  if p_kind is null or p_kind not in ('coin', 'blue', 'red') then raise exception 'Invalid coin kind'; end if;
  if p_tier is null or p_tier not in ('common', 'rare', 'epic') then raise exception 'Invalid coin tier'; end if;

  -- 同じ人の受け取りを1つずつ数える
  perform pg_advisory_xact_lock(hashtext('home_drop:' || v_user_id::text));

  v_key := 'home-drop:' || p_drop_id;

  -- 同じコインの再送は受け取らない（3色のどの台帳にあっても）
  if exists (select 1 from public.coin_events where user_id = v_user_id and idempotency_key = v_key)
     or exists (select 1 from public.blue_coin_events where user_id = v_user_id and idempotency_key = v_key)
     or exists (select 1 from public.red_coin_events where user_id = v_user_id and idempotency_key = v_key) then
    return jsonb_build_object('ok', true, 'granted', false, 'reason', 'duplicate');
  end if;

  -- 前の受け取りから 8 秒（黄色・青・赤のどれでも）
  select max(created_at) into v_last
    from public.coin_events
   where user_id = v_user_id and event_type = 'home_drop' and created_at > now() - interval '1 minute';
  select greatest(v_last, max(created_at)) into v_last
    from public.blue_coin_events
   where user_id = v_user_id and event_type = 'home_drop' and created_at > now() - interval '1 minute';
  select greatest(v_last, max(created_at)) into v_last
    from public.red_coin_events
   where user_id = v_user_id and event_type = 'home_drop' and created_at > now() - interval '1 minute';
  if v_last is not null and v_last > now() - interval '8 seconds' then
    return jsonb_build_object('ok', true, 'granted', false, 'reason', 'too_soon');
  end if;

  -- レア度ごとの、直近1時間の回数（3色あわせて）。超えたら、ふつうとして渡す
  v_tier := p_tier;
  if v_tier <> 'common' then
    select
      (select count(*) from public.coin_events
        where user_id = v_user_id and event_type = 'home_drop'
          and created_at > now() - interval '1 hour' and metadata->>'tier' = v_tier)
      + (select count(*) from public.blue_coin_events
        where user_id = v_user_id and event_type = 'home_drop'
          and created_at > now() - interval '1 hour' and metadata->>'tier' = v_tier)
      + (select count(*) from public.red_coin_events
        where user_id = v_user_id and event_type = 'home_drop'
          and created_at > now() - interval '1 hour' and metadata->>'tier' = v_tier)
      into v_tier_count;
    v_tier_limit := (case v_tier when 'epic' then 8 else 30 end);
    if v_tier_count >= v_tier_limit then
      v_tier := 'common';
    end if;
  end if;

  v_amount := case v_tier when 'epic' then 100 when 'rare' then 20 else 5 end;
  -- 赤コインは黄色・青の2.5倍（0140。ふつうの 12.5 は切り上げて 13）
  if p_kind = 'red' then
    v_amount := case v_tier when 'epic' then 250 when 'rare' then 50 else 13 end;
  end if;

  if p_kind = 'red' then
    v_applied := public.add_red_coin_event(
      v_user_id, 'home_drop', v_amount, v_key,
      jsonb_build_object('label', 'ホームで拾った赤コイン', 'drop_id', p_drop_id, 'tier', v_tier)
    );
  elsif p_kind = 'blue' then
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
  select balance into v_red_balance from public.user_red_coins where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'granted', v_applied,
    'kind', p_kind,
    'tier', v_tier,
    'amount', case when v_applied then v_amount else 0 end,
    'balance', coalesce(v_balance, 0),
    'blue_balance', coalesce(v_blue_balance, 0),
    'red_balance', coalesce(v_red_balance, 0)
  );
end;
$$;

revoke all on function public.claim_home_coin_drop(text, text, text) from public, anon;
grant execute on function public.claim_home_coin_drop(text, text, text) to authenticated;

comment on function public.claim_home_coin_drop(text, text, text) is
  'ホームの犬カードに降ってきたコイン（黄色・青・赤）を受け取る。ふつう5・中レア20・高レア100（赤は13・50・250）。同じコインは1回だけ、前の受け取りから8秒あける。';

-- -------------------------------------------------------------
-- ログインボーナス（0138 と同じ。毎日の赤コインを 50 → 125 枚に）
-- -------------------------------------------------------------
create or replace function public.claim_login_bonus()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (timezone('Asia/Tokyo', now()))::date;
  v_prior_days integer := 0;
  v_streak_day integer;
  v_next_day integer;
  v_amount integer;
  v_event_id uuid;
  v_balance integer;
  v_blue_amount integer := 0;
  v_red_amount integer := 0;
  v_red_balance integer;
  v_total_days integer := 0;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  -- きのうまでに開いた日の合計（通算）。休んでも1日目へは戻らず、7日ごとにひとまわりする
  select count(*)::integer into v_prior_days
    from public.coin_events
   where user_id = v_user_id
     and event_type = 'login'
     and event_date < v_today;

  v_streak_day := (v_prior_days % 7) + 1;
  v_next_day := (v_streak_day % 7) + 1;
  v_amount := public.coin_login_bonus(v_streak_day);

  insert into public.coin_events (
    user_id, event_type, amount, idempotency_key, event_date, metadata
  ) values (
    v_user_id, 'login', v_amount, 'login:' || v_today::text, v_today,
    jsonb_build_object('label', 'ログインボーナス', 'streak_day', v_streak_day)
  )
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_event_id;

  -- 通算のログイン日数（きょうを入れて）。7日ごとに青コインもいっしょに
  v_total_days := v_prior_days + 1;

  if v_event_id is not null and v_total_days > 0 and v_total_days % 7 = 0 then
    if public.add_blue_coin_event(
      v_user_id, 'login_total', 400,
      'login-total:' || v_total_days::text,
      jsonb_build_object('label', '通算' || v_total_days::text || '日ログイン', 'total_days', v_total_days)
    ) then
      v_blue_amount := 400;
    end if;
  end if;

  -- 毎日の赤コイン（ご当地ピンボールのステージの部品に使う）
  if v_event_id is not null then
    if public.add_red_coin_event(
      v_user_id, 'login', 125,
      'login:' || v_today::text,
      jsonb_build_object('label', 'ログインボーナス', 'date', v_today)
    ) then
      v_red_amount := 125;
    end if;
  end if;

  select balance into v_balance from public.user_coins where user_id = v_user_id;
  select balance into v_red_balance from public.user_red_coins where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'granted', v_event_id is not null,
    'amount', case when v_event_id is not null then v_amount else 0 end,
    'balance', coalesce(v_balance, 0),
    'date', v_today,
    'streak_day', v_streak_day,
    'next_amount', public.coin_login_bonus(v_next_day),
    'blue_amount', v_blue_amount,
    'red_amount', v_red_amount,
    'red_balance', coalesce(v_red_balance, 0),
    'total_days', v_total_days
  );
end;
$$;

grant execute on function public.claim_login_bonus() to authenticated;

commit;
