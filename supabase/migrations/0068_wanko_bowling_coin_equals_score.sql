-- わんこボウリングの獲得コインを「スコア ÷ 5」から「スコアそのまま」に変更する。
create or replace function public.record_wanko_bowling_result(
  p_round_id text,
  p_score integer,
  p_strike_count integer,
  p_spare_count integer,
  p_gutter_count integer,
  p_frame_count integer
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
  if p_frame_count <> 5 then raise exception 'Round was not completed'; end if;
  if p_score is null or p_score < 0 or p_score > 150 then raise exception 'Invalid score'; end if;
  if p_strike_count is null or p_strike_count < 0 or p_strike_count > 7 then raise exception 'Invalid strike count'; end if;
  if p_spare_count is null or p_spare_count < 0 or p_spare_count > 5 then raise exception 'Invalid spare count'; end if;
  if p_gutter_count is null or p_gutter_count < 0 or p_gutter_count > 15 then raise exception 'Invalid gutter count'; end if;

  v_key := 'wanko-bowling:' || p_round_id;
  v_reward := greatest(1, p_score);

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
      'frame_count', p_frame_count
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

grant execute on function public.record_wanko_bowling_result(text, integer, integer, integer, integer, integer) to authenticated;
