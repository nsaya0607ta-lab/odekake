-- =============================================================
-- わんこのおやつ道にコイン報酬を追加する
-- =============================================================
-- これまでは検証中のためコインを配っていなかった（0077参照）。
-- 今回からスコアの2/3（端数切り捨て）をコインとして付与する。
-- 台帳は他のミニゲームと同じ coin_events を使い、round_id をそのまま
-- 冪等キーにすることで、同じプレイ結果を二重に送っても増えないようにする。
begin;

alter table public.coin_events drop constraint if exists coin_events_event_type_check;
alter table public.coin_events add constraint coin_events_event_type_check
  check (event_type in ('level_up', 'steps', 'unlock', 'gacha', 'login', 'item_catch', 'wanko_bowling', 'snack_trail'));

-- おやつ道はまだコインが付いていなかった頃の緩い上限だったため、
-- 直接APIを叩いた偽装スコアでコインを稼がれないよう、現実的な範囲へ絞る。
alter table public.snack_trail_scores drop constraint if exists snack_trail_scores_score_range;
alter table public.snack_trail_scores add constraint snack_trail_scores_score_range
  check (score between 0 and 5000);

create or replace function public.record_snack_trail_result(
  p_round_id text,
  p_score integer,
  p_max_combo integer,
  p_collected integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_applied boolean := false;
  v_best_score integer;
  v_best_combo integer;
  v_coins_key text;
  v_coins integer;
  v_coins_applied boolean;
  v_existing_amount integer;
  v_balance integer;
  v_today date := (timezone('Asia/Tokyo', now()))::date;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_round_id is null or length(p_round_id) not between 8 and 100 then
    raise exception using errcode = 'P0001', message = 'INVALID_ROUND_ID';
  end if;
  if p_score is null or p_score < 0 or p_score > 5000 then
    raise exception using errcode = 'P0001', message = 'INVALID_SCORE';
  end if;
  if p_max_combo is null or p_max_combo < 0 or p_max_combo > 5000 then
    raise exception using errcode = 'P0001', message = 'INVALID_COMBO';
  end if;
  if p_collected is null or p_collected < 0 or p_collected > 100000 then
    raise exception using errcode = 'P0001', message = 'INVALID_COLLECTED';
  end if;

  insert into public.snack_trail_scores (user_id, round_id, score, max_combo, collected)
  values (v_user_id, p_round_id, p_score, p_max_combo, p_collected)
  on conflict (user_id, round_id) do nothing;

  v_applied := found;

  select max(s.score), max(s.max_combo)
    into v_best_score, v_best_combo
    from public.snack_trail_scores s
   where s.user_id = v_user_id;

  -- コイン付与はスコア記録と同じ round_id で冪等にする。
  v_coins_key := 'snack-trail:' || p_round_id;
  v_coins := floor(p_score * 2.0 / 3)::integer;

  if v_coins > 0 then
    v_coins_applied := public.add_coin_event(
      v_user_id,
      'snack_trail',
      v_coins,
      v_coins_key,
      null,
      v_today,
      jsonb_build_object(
        'label', 'わんこのおやつ道',
        'score', p_score,
        'max_combo', p_max_combo,
        'collected', p_collected
      )
    );

    if not v_coins_applied then
      select amount into v_existing_amount
        from public.coin_events
       where user_id = v_user_id and idempotency_key = v_coins_key;
      v_coins := coalesce(v_existing_amount, v_coins);
    end if;
  else
    v_coins := 0;
  end if;

  select balance into v_balance from public.user_coins where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'applied', v_applied,
    'best_score', coalesce(v_best_score, 0),
    'best_combo', coalesce(v_best_combo, 0),
    'coins', v_coins,
    'balance', coalesce(v_balance, 0)
  );
end;
$$;

revoke all on function public.record_snack_trail_result(text, integer, integer, integer) from public, anon;
grant execute on function public.record_snack_trail_result(text, integer, integer, integer) to authenticated;

comment on function public.record_snack_trail_result(text, integer, integer, integer) is
  'わんこのおやつ道の1プレイ分のスコアと最高コンボを記録し、スコアの2/3(端数切り捨て)をコインとして付与する。同じ round_id は二重に記録・付与しない。';

commit;

notify pgrst, 'reload schema';
