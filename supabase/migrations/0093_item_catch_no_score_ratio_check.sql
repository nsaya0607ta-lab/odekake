-- =============================================================
-- アイテムキャッチ: コイン受け取りAPIの高速化（スコア比率チェックの撤廃）
-- =============================================================
-- ダンボール等の得点倍率スキルはスタック上限を設けない仕様（docs/minigame-time-balance.md、
-- src/app/api/coins/item-catch/route.tsのコメント参照）のため、正当なプレイでも
-- 「スコア ÷ キャッチ数」が非常に大きくなりうる。ところが record_item_catch_result()
-- 側には旧仕様のまま「p_score が p_caught_count*10〜*100の範囲内であること」という
-- 古い妥当性チェックが残っており、これに引っかからないようAPI側で
-- スコアを8000pt単位のチャンクに分割し、チャンクごとに架空のcaught_countを
-- 水増ししてRPCを何度も呼ぶという遠回りな実装（splitScoreForLegacyValidation）に
-- なっていた。スコアが大きいプレイほどRPCの逐次呼び出し回数が増え、
-- コイン受け取りに数秒〜数十秒かかる原因になっていたため、この関数側の
-- チェックをAPI側の実バリデーション（p_caught_count<=10000, p_score<=100億）に
-- 合わせて緩和し、1回のRPC呼び出しで完結できるようにする。

-- p_score を bigint に拡張する（最大100億は int4 の上限 約21.4億を超えるため）。
-- シグネチャが変わるため、旧関数(p_score integer版)は明示的にdropしてから作り直す。
drop function if exists public.record_item_catch_result(text, integer, integer, integer, integer);

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
  v_reward bigint;
  v_applied boolean;
  v_existing_amount integer;
  v_balance integer;
  v_today date := (timezone('Asia/Tokyo', now()))::date;
  v_max_bonus_coins constant integer := 10000;
  v_max_caught_count constant integer := 10000;
  v_max_score constant bigint := 10000000000;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_round_id is null or length(p_round_id) not between 8 and 100 then raise exception 'Invalid round id'; end if;
  if p_duration_seconds <> 50 then raise exception 'Round was not completed'; end if;
  if p_score is null or p_score < 0 or p_score > v_max_score then raise exception 'Invalid score'; end if;
  if p_caught_count is null or p_caught_count < 0 or p_caught_count > v_max_caught_count then raise exception 'Invalid caught count'; end if;
  if p_caught_count = 0 and p_score <> 0 then raise exception 'Invalid score'; end if;
  if p_bonus_coins is null or p_bonus_coins < 0 or p_bonus_coins > v_max_bonus_coins then
    raise exception 'Implausible bonus coins';
  end if;

  v_key := 'item-catch:' || p_round_id;
  v_reward := greatest(1, p_score / 100) + p_bonus_coins;

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

grant execute on function public.record_item_catch_result(text, bigint, integer, integer, integer) to authenticated;
