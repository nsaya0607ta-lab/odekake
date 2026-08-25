-- =============================================================
-- ミニゲーム報酬RPCの本番整合修正
--   1. アイテムキャッチ: bonusCoins対応 + 現行APIと同じ検証上限
--   2. わんこボウリング: 10フレーム + ボーナス成功時2倍
--
-- 再実行可能。既存のcoin_eventsは変更・再計算しない。
-- round_id単位の冪等性はadd_coin_event()で維持する。
-- =============================================================

begin;

do $$
begin
  if to_regclass('public.coin_events') is null
    or to_regprocedure('public.add_coin_event(uuid, text, integer, text, integer, date, jsonb)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'GAME_REWARD_RPC_MISSING_DEPENDENCY',
      hint = '先にコイン経済のマイグレーション（0011、0028）を適用してください。';
  end if;
end;
$$;

-- ボウリング報酬をcoin_eventsへ記録できるよう、現在利用中の種別をすべて許可する。
alter table public.coin_events drop constraint if exists coin_events_event_type_check;
alter table public.coin_events add constraint coin_events_event_type_check
  check (event_type in ('level_up', 'steps', 'unlock', 'gacha', 'login', 'item_catch', 'wanko_bowling'));

-- -------------------------------------------------------------
-- アイテムキャッチ
-- -------------------------------------------------------------
-- PostgRESTで旧版と新版が多重定義にならないよう両方を削除する。
drop function if exists public.record_item_catch_result(text, integer, integer, integer);
drop function if exists public.record_item_catch_result(text, integer, integer, integer, integer);

create function public.record_item_catch_result(
  p_round_id text,
  p_score integer,
  p_caught_count integer,
  p_duration_seconds integer,
  p_bonus_coins integer default 0
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
  v_applied boolean;
  v_existing_amount integer;
  v_balance integer;
  v_today date := (timezone('Asia/Tokyo', now()))::date;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_round_id is null or length(p_round_id) not between 8 and 100 then raise exception 'Invalid round id'; end if;
  if p_duration_seconds <> 30 then raise exception 'Round was not completed'; end if;
  if p_score is null or p_score < 0 or p_score > 8000 then raise exception 'Invalid score'; end if;
  if p_caught_count is null or p_caught_count < 0 or p_caught_count > 2000 then raise exception 'Invalid caught count'; end if;
  if p_caught_count = 0 and p_score <> 0 then raise exception 'Invalid score'; end if;
  if p_caught_count > 0 and p_score > p_caught_count * 1500 then raise exception 'Implausible score'; end if;
  if p_bonus_coins is null or p_bonus_coins < 0 or p_bonus_coins > 2000 then raise exception 'Implausible bonus coins'; end if;

  v_key := 'item-catch:' || p_round_id;
  v_reward := greatest(1, p_score / 25) + p_bonus_coins;

  v_applied := public.add_coin_event(
    v_user_id,
    'item_catch',
    v_reward,
    v_key,
    null,
    v_today,
    jsonb_build_object(
      'label', 'アイテムキャッチ',
      'score', p_score,
      'caught_count', p_caught_count,
      'duration_seconds', p_duration_seconds,
      'bonus_coins', p_bonus_coins
    )
  );

  if not v_applied then
    select amount into v_existing_amount
      from public.coin_events
     where user_id = v_user_id and idempotency_key = v_key;
    v_reward := coalesce(v_existing_amount, v_reward);
  end if;

  select balance into v_balance
    from public.user_coins
   where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'applied', v_applied,
    'score', p_score,
    'coins', v_reward,
    'balance', coalesce(v_balance, 0)
  );
end;
$$;

revoke all on function public.record_item_catch_result(text, integer, integer, integer, integer) from public, anon;
grant execute on function public.record_item_catch_result(text, integer, integer, integer, integer) to authenticated;

-- -------------------------------------------------------------
-- わんこボウリング
-- -------------------------------------------------------------
drop function if exists public.record_wanko_bowling_result(text, integer, integer, integer, integer, integer);
drop function if exists public.record_wanko_bowling_result(text, integer, integer, integer, integer, integer, boolean);

create function public.record_wanko_bowling_result(
  p_round_id text,
  p_score integer,
  p_strike_count integer,
  p_spare_count integer,
  p_gutter_count integer,
  p_frame_count integer,
  p_bonus_hit boolean default false
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

  v_key := 'wanko-bowling:' || p_round_id;
  v_reward := greatest(1, p_score / 5);
  if coalesce(p_bonus_hit, false) then
    v_reward := v_reward * 2;
  end if;

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
      'strike_count', p_strike_count,
      'spare_count', p_spare_count,
      'gutter_count', p_gutter_count,
      'frame_count', p_frame_count,
      'bonus_hit', coalesce(p_bonus_hit, false)
    )
  );

  if not v_applied then
    select amount into v_existing_amount
      from public.coin_events
     where user_id = v_user_id and idempotency_key = v_key;
    v_reward := coalesce(v_existing_amount, v_reward);
  end if;

  select balance into v_balance
    from public.user_coins
   where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'applied', v_applied,
    'score', p_score,
    'coins', v_reward,
    'balance', coalesce(v_balance, 0)
  );
end;
$$;

revoke all on function public.record_wanko_bowling_result(text, integer, integer, integer, integer, integer, boolean) from public, anon;
grant execute on function public.record_wanko_bowling_result(text, integer, integer, integer, integer, integer, boolean) to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'GAME_REWARD_RPC_READY'::text as status,
  to_regprocedure('public.record_item_catch_result(text, integer, integer, integer, integer)') is not null as item_catch_ok,
  to_regprocedure('public.record_wanko_bowling_result(text, integer, integer, integer, integer, integer, boolean)') is not null as bowling_ok;
