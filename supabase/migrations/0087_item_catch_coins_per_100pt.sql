-- =============================================================
-- アイテムキャッチのコイン換算レートを「200pt=1コイン」→「100pt=1コイン」に変更
-- =============================================================
-- record_item_catch_result() が付与するコインは、これまでラウンドの
-- スコアを200で割った値（端数切り捨て、最低1コイン）だった。
-- これを100で割る（＝1コイン=100ポイント）に変更する。
-- ゴールドボール等による直接コイン加算(p_bonus_coins)には影響しない。

begin;

do $$
begin
  if to_regprocedure('public.record_item_catch_result(text, integer, integer, integer, integer)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'ITEM_CATCH_COINS_PER_100PT_MISSING_DEPENDENCY',
      hint = 'アイテムキャッチのコイン換算レート200pt対応（0086_item_catch_coins_per_200pt.sql）を先に適用してください。';
  end if;
end;
$$;

create or replace function public.record_item_catch_result(
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
  v_max_bonus_coins constant integer := 2000;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_round_id is null or length(p_round_id) not between 8 and 100 then raise exception 'Invalid round id'; end if;
  if p_duration_seconds <> 50 then raise exception 'Round was not completed'; end if;
  if p_score is null or p_score < 0 then raise exception 'Invalid score'; end if;
  if p_caught_count is null or p_caught_count < 0 or p_caught_count > 80 then raise exception 'Invalid caught count'; end if;
  if p_caught_count = 0 and p_score <> 0 then raise exception 'Invalid score'; end if;
  if p_caught_count > 0 and (p_score < p_caught_count * 10 or p_score > p_caught_count * 100) then
    raise exception 'Implausible score';
  end if;
  if p_bonus_coins is null or p_bonus_coins < 0 or p_bonus_coins > v_max_bonus_coins then
    raise exception 'Implausible bonus coins';
  end if;

  v_key := 'item-catch:' || p_round_id;
  v_reward := greatest(1, p_score / 100) + p_bonus_coins;

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

  select balance into v_balance from public.user_coins where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'applied', v_applied,
    'coins', v_reward,
    'balance', coalesce(v_balance, 0)
  );
end;
$$;

grant execute on function public.record_item_catch_result(text, integer, integer, integer, integer) to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'ITEM_CATCH_COINS_PER_100PT_READY'::text as status,
  to_regprocedure('public.record_item_catch_result(text, integer, integer, integer, integer)') is not null as fn_ok;
