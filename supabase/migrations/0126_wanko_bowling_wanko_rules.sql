-- =============================================================
-- わんこボウリング：わんこルールで 300 点の上限をなくす
-- =============================================================
-- 0071 の後に適用する。record_wanko_bowling_result の中身は 0071 と同じで、
-- スコアの上限だけを 300 → 2000 にする（アプリ側の満点は 640 点）。
-- ・ビッグラック：ストライクの次のラックはピン15本
-- ・フィーバー：ターキーのあとのフレームは倒した本数が2倍
-- ・キングピン：10フレーム目のまんなか。倒すと残りが全部倒れて +20
-- ・スプリット・チャレンジ：割れた並びを全部倒すと +30
-- 点数はアプリの API が投球の記録から再計算してから渡す（この関数はその値を記録してコインにする）。
-- ※ アプリを新しくする前に、このSQLを適用すること（先にアプリだけ新しくすると、300点を超えたゲームのコインが受け取れない）。
begin;

do $$
begin
  if to_regprocedure('public.record_wanko_bowling_result(text, integer, integer, integer, integer, integer, integer)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'WANKO_BOWLING_RULES_MISSING_DEPENDENCY',
      hint = 'わんこボウリングのコイン（0071）を先に適用してください。';
  end if;
end;
$$;

create or replace function public.record_wanko_bowling_result(
  p_round_id text,
  p_score integer,
  p_strike_count integer,
  p_spare_count integer,
  p_gutter_count integer,
  p_frame_count integer,
  p_golden_hits integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_key text;
  v_reward integer;
  v_golden_bonus integer;
  v_applied boolean;
  v_existing_amount integer;
  v_balance integer;
  v_today date := (timezone('Asia/Tokyo', now()))::date;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_round_id is null or length(p_round_id) not between 8 and 100 then raise exception 'Invalid round id'; end if;
  if p_frame_count <> 10 then raise exception 'Round was not completed'; end if;
  -- わんこルール（ビッグラック・フィーバー・キングピン・スプリット）で300点を超える。
  -- アプリ側の満点は640点なので、余裕をみて2000点までを受けつける。
  if p_score is null or p_score < 0 or p_score > 2000 then raise exception 'Invalid score'; end if;
  if p_strike_count is null or p_strike_count < 0 or p_strike_count > 12 then raise exception 'Invalid strike count'; end if;
  if p_spare_count is null or p_spare_count < 0 or p_spare_count > 11 then raise exception 'Invalid spare count'; end if;
  if p_gutter_count is null or p_gutter_count < 0 or p_gutter_count > 21 then raise exception 'Invalid gutter count'; end if;
  if p_golden_hits is null or p_golden_hits < 0 or p_golden_hits > 5 then raise exception 'Invalid golden pin hits'; end if;

  v_key := 'wanko-bowling:' || p_round_id;
  v_golden_bonus := p_golden_hits * 10;
  v_reward := p_score + v_golden_bonus;

  v_applied := public.add_coin_event(
    v_user_id,
    'wanko_bowling',
    v_reward,
    v_key,
    null,
    v_today,
    jsonb_build_object(
      'label', 'わんこボウリング',
      'score', p_score,
      'score_coins', p_score,
      'golden_hits', p_golden_hits,
      'golden_bonus_coins', v_golden_bonus,
      'strike_count', p_strike_count,
      'spare_count', p_spare_count,
      'gutter_count', p_gutter_count,
      'frame_count', p_frame_count
    )
  );

  -- 同じround_idの再送時は二重付与せず、最初に確定した金額を返す。
  if not v_applied then
    select amount into v_existing_amount
      from public.coin_events
     where user_id = v_user_id
       and idempotency_key = v_key;
    v_reward := coalesce(v_existing_amount, v_reward);
  end if;

  select balance into v_balance
    from public.user_coins
   where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'applied', v_applied,
    'score', p_score,
    'score_coins', p_score,
    'golden_hits', p_golden_hits,
    'golden_bonus_coins', v_golden_bonus,
    'coins', v_reward,
    'balance', coalesce(v_balance, 0)
  );
end;
$$;

revoke all on function public.record_wanko_bowling_result(text, integer, integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.record_wanko_bowling_result(text, integer, integer, integer, integer, integer, integer) to authenticated;

commit;

notify pgrst, 'reload schema';
