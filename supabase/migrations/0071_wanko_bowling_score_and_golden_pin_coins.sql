-- =============================================================
-- わんこボウリング：スコア等倍コイン + ゴールデンピン報酬
--
-- 新しい record_wanko_bowling_result(..., p_golden_hits integer) を追加する。
-- item_catchを含む他ゲームの関数・coin_events・既存履歴は変更しない。
-- 報酬 = 最終スコア + (ゴールデンピンを倒した本数 × 10)
--
-- 本番とプレビューが同じDBを使っていても、旧APIが呼ぶ
-- record_wanko_bowling_result(..., p_bonus_hit boolean) は削除しない。
-- JSONの引数名が異なるため、PostgRESTは新旧APIを呼び分けられる。
-- =============================================================

begin;

do $$
begin
  if to_regclass('public.coin_events') is null
    or to_regprocedure('public.add_coin_event(uuid, text, integer, text, integer, date, jsonb)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'WANKO_BOWLING_REWARD_MISSING_DEPENDENCY',
      hint = '先にコイン経済のマイグレーション（0011、0028）を適用してください。';
  end if;
end;
$$;

-- 同じ新シグネチャだけを再作成可能にする。旧boolean版は本番互換用に残す。
drop function if exists public.record_wanko_bowling_result(text, integer, integer, integer, integer, integer, integer);

create function public.record_wanko_bowling_result(
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
  if p_score is null or p_score < 0 or p_score > 300 then raise exception 'Invalid score'; end if;
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

select
  'WANKO_BOWLING_SCORE_AND_GOLDEN_PIN_COINS_READY'::text as status,
  to_regprocedure('public.record_wanko_bowling_result(text, integer, integer, integer, integer, integer, integer)') is not null as bowling_ok,
  to_regprocedure('public.record_item_catch_result(text, integer, integer, integer, integer)') is not null as item_catch_unchanged;
