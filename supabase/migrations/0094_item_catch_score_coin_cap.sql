-- =============================================================
-- アイテムキャッチ: コイン上限をスコア換算分だけに限定
-- =============================================================
-- これまでは合計コイン(スコア換算 + ボーナスコイン)全体ではなく、ボーナスコイン
-- (p_bonus_coins。金のボール・ダンボール効果由来)の側にだけ10000の上限を設けていた。
-- 一方でスコア換算分(p_score/100)には上限がなく、高スコアなプレイでは合計コインが
-- 10000を大きく超えることがあり、「10000枚が上限のはず」という想定と食い違っていた。
--
-- 今回、上限をかける対象をスコア換算分の側に付け替える。ボーナスコイン系スキルは
-- スタック上限を設けない仕様（docs/minigame-time-balance.md参照）のため無制限のままとする。
create or replace function public.record_item_catch_result(
  p_round_id text,
  p_score bigint,
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
  v_score_coins bigint;
  v_reward bigint;
  v_applied boolean;
  v_existing_amount integer;
  v_balance integer;
  v_today date := (timezone('Asia/Tokyo', now()))::date;
  v_max_score_coins constant bigint := 10000;
  v_max_caught_count constant integer := 10000;
  v_max_score constant bigint := 10000000000;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_round_id is null or length(p_round_id) not between 8 and 100 then raise exception 'Invalid round id'; end if;
  if p_duration_seconds <> 50 then raise exception 'Round was not completed'; end if;
  if p_score is null or p_score < 0 or p_score > v_max_score then raise exception 'Invalid score'; end if;
  if p_caught_count is null or p_caught_count < 0 or p_caught_count > v_max_caught_count then raise exception 'Invalid caught count'; end if;
  if p_caught_count = 0 and p_score <> 0 then raise exception 'Invalid score'; end if;
  if p_bonus_coins is null or p_bonus_coins < 0 then
    raise exception 'Implausible bonus coins';
  end if;

  v_key := 'item-catch:' || p_round_id;
  v_score_coins := least(v_max_score_coins, greatest(1, p_score / 100));
  v_reward := v_score_coins + p_bonus_coins;

  v_applied := public.add_coin_event(
    v_user_id,
    'item_catch',
    v_reward::integer,
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
