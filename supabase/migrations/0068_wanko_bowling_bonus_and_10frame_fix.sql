-- =============================================================
-- わんこボウリング：10フレーム制への修正 + ボーナスチャンス対応
-- =============================================================
-- 0066 は5フレーム制の頃の名残で p_frame_count <> 5 のままだった。
-- 実際のゲームは10フレーム制（BOWLING_FRAME_COUNT）のため、これまで
-- record_wanko_bowling_result は常に「Round was not completed」で
-- 弾かれてコインが付与されていなかった。あわせて、10投球のうち1回だけ
-- 訪れるボーナスチャンスでストライクを取った場合にコインを2倍にする
-- p_bonus_hit を追加する。

drop function if exists public.record_wanko_bowling_result(text, integer, integer, integer, integer, integer);

create or replace function public.record_wanko_bowling_result(
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
  if p_bonus_hit then
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

  select balance into v_balance from public.user_coins where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'applied', v_applied,
    'coins', v_reward,
    'balance', coalesce(v_balance, 0)
  );
end;
$$;

grant execute on function public.record_wanko_bowling_result(text, integer, integer, integer, integer, integer, boolean) to authenticated;

notify pgrst, 'reload schema';
