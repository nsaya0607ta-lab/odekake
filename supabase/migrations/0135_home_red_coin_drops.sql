-- =============================================================
-- ホームの降ってくるコインに、赤コインを足す
-- =============================================================
-- 0129（降ってくるコインのレア度）と 0134（赤コイン）の後に適用する。
-- ・ホームの犬カードに、赤コインも降ってくる。黄色・青の降り方はいままでのまま（5秒ごとに20%）で、
--   赤はそれとは別に 5秒ごとに5%（アプリ側で決める）。拾うと黄色・青と同じ枚数（ふつう5・中レア20・高レア100）。
-- ・受け取りの決まりは黄色・青と同じ：同じコインは1回だけ、前の受け取りから 8 秒（3色のどれでも）、
--   中レア・高レアは直近1時間の回数まで（3色あわせて数える。超えたぶんは、ふつうとして渡す）。
-- ・claim_home_coin_drop を作り直して、p_kind に 'red' を受けつける。赤コインの台帳の種類に home_drop を足す。
begin;

do $$
begin
  if to_regprocedure('public.claim_home_coin_drop(text, text, text)') is null
     or to_regprocedure('public.add_red_coin_event(uuid, text, integer, text, jsonb)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'HOME_RED_COIN_DROPS_MISSING_DEPENDENCY',
      hint = 'ホームの降ってくるコイン（0129）と赤コイン（0134）を先に適用してください。';
  end if;
end;
$$;

-- 赤コインの台帳の種類に home_drop を足す（いまある行は見直さない）
alter table public.red_coin_events drop constraint if exists red_coin_events_event_type_check;
alter table public.red_coin_events add constraint red_coin_events_event_type_check
  check (event_type in ('pinball', 'home_drop')) not valid;

create or replace function public.claim_home_coin_drop(p_drop_id text, p_kind text, p_tier text default 'common')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (timezone('Asia/Tokyo', now()))::date;
  v_tier text;
  v_amount integer;
  v_key text;
  v_last timestamptz;
  v_tier_count integer;
  v_tier_limit integer;
  v_applied boolean;
  v_balance integer;
  v_blue_balance integer;
  v_red_balance integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_drop_id is null or p_drop_id !~ '^[A-Za-z0-9_-]{8,64}$' then raise exception 'Invalid drop id'; end if;
  if p_kind is null or p_kind not in ('coin', 'blue', 'red') then raise exception 'Invalid coin kind'; end if;
  if p_tier is null or p_tier not in ('common', 'rare', 'epic') then raise exception 'Invalid coin tier'; end if;

  -- 同じ人の受け取りを1つずつ数える
  perform pg_advisory_xact_lock(hashtext('home_drop:' || v_user_id::text));

  v_key := 'home-drop:' || p_drop_id;

  -- 同じコインの再送は受け取らない（3色のどの台帳にあっても）
  if exists (select 1 from public.coin_events where user_id = v_user_id and idempotency_key = v_key)
     or exists (select 1 from public.blue_coin_events where user_id = v_user_id and idempotency_key = v_key)
     or exists (select 1 from public.red_coin_events where user_id = v_user_id and idempotency_key = v_key) then
    return jsonb_build_object('ok', true, 'granted', false, 'reason', 'duplicate');
  end if;

  -- 前の受け取りから 8 秒（黄色・青・赤のどれでも）
  select max(created_at) into v_last
    from public.coin_events
   where user_id = v_user_id and event_type = 'home_drop' and created_at > now() - interval '1 minute';
  select greatest(v_last, max(created_at)) into v_last
    from public.blue_coin_events
   where user_id = v_user_id and event_type = 'home_drop' and created_at > now() - interval '1 minute';
  select greatest(v_last, max(created_at)) into v_last
    from public.red_coin_events
   where user_id = v_user_id and event_type = 'home_drop' and created_at > now() - interval '1 minute';
  if v_last is not null and v_last > now() - interval '8 seconds' then
    return jsonb_build_object('ok', true, 'granted', false, 'reason', 'too_soon');
  end if;

  -- レア度ごとの、直近1時間の回数（3色あわせて）。超えたら、ふつうとして渡す
  v_tier := p_tier;
  if v_tier <> 'common' then
    select
      (select count(*) from public.coin_events
        where user_id = v_user_id and event_type = 'home_drop'
          and created_at > now() - interval '1 hour' and metadata->>'tier' = v_tier)
      + (select count(*) from public.blue_coin_events
        where user_id = v_user_id and event_type = 'home_drop'
          and created_at > now() - interval '1 hour' and metadata->>'tier' = v_tier)
      + (select count(*) from public.red_coin_events
        where user_id = v_user_id and event_type = 'home_drop'
          and created_at > now() - interval '1 hour' and metadata->>'tier' = v_tier)
      into v_tier_count;
    v_tier_limit := (case v_tier when 'epic' then 8 else 30 end);
    if v_tier_count >= v_tier_limit then
      v_tier := 'common';
    end if;
  end if;

  v_amount := case v_tier when 'epic' then 100 when 'rare' then 20 else 5 end;

  if p_kind = 'red' then
    v_applied := public.add_red_coin_event(
      v_user_id, 'home_drop', v_amount, v_key,
      jsonb_build_object('label', 'ホームで拾った赤コイン', 'drop_id', p_drop_id, 'tier', v_tier)
    );
  elsif p_kind = 'blue' then
    v_applied := public.add_blue_coin_event(
      v_user_id, 'home_drop', v_amount, v_key,
      jsonb_build_object('label', 'ホームで拾った青コイン', 'drop_id', p_drop_id, 'tier', v_tier)
    );
  else
    v_applied := public.add_coin_event(
      v_user_id, 'home_drop', v_amount, v_key, null, v_today,
      jsonb_build_object('label', 'ホームで拾ったコイン', 'drop_id', p_drop_id, 'tier', v_tier)
    );
  end if;

  select balance into v_balance from public.user_coins where user_id = v_user_id;
  select balance into v_blue_balance from public.user_blue_coins where user_id = v_user_id;
  select balance into v_red_balance from public.user_red_coins where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'granted', v_applied,
    'kind', p_kind,
    'tier', v_tier,
    'amount', case when v_applied then v_amount else 0 end,
    'balance', coalesce(v_balance, 0),
    'blue_balance', coalesce(v_blue_balance, 0),
    'red_balance', coalesce(v_red_balance, 0)
  );
end;
$$;

revoke all on function public.claim_home_coin_drop(text, text, text) from public, anon;
grant execute on function public.claim_home_coin_drop(text, text, text) to authenticated;

comment on function public.claim_home_coin_drop(text, text, text) is
  'ホームの犬カードに降ってきたコイン（黄色・青・赤）を受け取る。ふつう5・中レア20・高レア100。同じコインは1回だけ、前の受け取りから8秒あける。';

commit;

notify pgrst, 'reload schema';
