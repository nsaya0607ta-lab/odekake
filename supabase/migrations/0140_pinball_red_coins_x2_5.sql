-- =============================================================
-- ご当地ピンボール：もらえる赤コインを2.5倍に・部品の持てる数の上限をなくす
-- =============================================================
-- 0139 の後に適用する（2026-10-09、ユーザー指定）。
-- ・もらえる赤コインを2.5倍にする（ホームに降る赤コインは今まで通り）。
--   ピンボール：スコア ÷ 11875 → ÷ 4750（切り捨て）、1プレイ 2400 → 100000 枚まで（record_pinball_result）。
--   ホームに降る赤コインは今まで通り（5・20・100）。
--   ログイン：1日 50 → 125 枚（claim_login_bonus）。
--   アプリの src/lib/games/pinball/config.ts（COIN_POINTS・COIN_MAX）・src/lib/red-coin-rewards.ts（RED_LOGIN_COINS）・
--   と同じにする。前にもらった赤コインは、そのまま。
-- ・部品の持てる数（pinball_part_catalog の max_count）を、ランプのほかは上限なし（null）にする。
--   1つのステージに置けるのは持っている数まで。部品どうしのすき間（アプリの STAGE_GAP）があるので、置ける数は台の広さで自然に決まる
--   （くぎでも約50本）。buy_pinball_part・save_pinball_stage は max_count が null なら上限を見ない（0138 のまま。least は null を無視する）。
begin;

do $$
begin
  if to_regprocedure('public.pinball_part_catalog()') is null
     or to_regprocedure('public.record_pinball_result(text, text, integer, integer, integer, integer, integer, integer, uuid)') is null
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

-- 1プレイの赤コインが 100000 枚までになるので、記録の枚数の範囲を広げる
alter table public.pinball_scores drop constraint if exists pinball_scores_coins_range;
alter table public.pinball_scores add constraint pinball_scores_coins_range check (coins between 0 and 100000);

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
  v_max_coins constant integer := 100000;
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
  'ご当地ピンボールの1プレイ（マップかステージ）を記録し、スコア÷4750（切り捨て、1プレイ100000まで）を赤コインとして付与する。同じ round_id は二重に記録・付与しない。';

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
