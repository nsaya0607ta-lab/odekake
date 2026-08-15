-- =============================================================
-- アイテムキャッチのコイン付与RPCの上限を、ゲーム側の新スキル
-- （出現量アップ・磁石・くみたてボーナス等）に合わせて緩和する。
--
-- p_caught_count > 80 のままだと、出現量アップ系スキルで達成できる
-- キャッチ数（100個超）が正当なプレイでも「Invalid caught count」で
-- 弾かれてしまう。
--
-- スコアの妥当性チェック（1キャッチあたり10〜100点）も、うんち
-- ペナルティ（-10pt、キャッチ数はカウントされる）や「くみたて
-- ボーナス」（キャッチ数を伴わず後からまとめて加算される）の追加で
-- 平均値が範囲外になり得るため、範囲を大きく緩和する。
-- =============================================================

create or replace function public.record_item_catch_result(
  p_round_id text,
  p_score integer,
  p_caught_count integer,
  p_duration_seconds integer
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
  if p_score is null or p_score < 0 then raise exception 'Invalid score'; end if;
  if p_caught_count is null or p_caught_count < 0 or p_caught_count > 2000 then raise exception 'Invalid caught count'; end if;
  if p_caught_count = 0 and p_score <> 0 then raise exception 'Invalid score'; end if;
  if p_caught_count > 0 and (p_score < p_caught_count * -50 or p_score > p_caught_count * 1500) then
    raise exception 'Implausible score';
  end if;

  v_key := 'item-catch:' || p_round_id;
  v_reward := greatest(1, p_score / 25);

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
      'duration_seconds', p_duration_seconds
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

grant execute on function public.record_item_catch_result(text, integer, integer, integer) to authenticated;

NOTIFY pgrst, 'reload schema';
select 'ITEM_CATCH_LIMITS_READY'::text as status;
