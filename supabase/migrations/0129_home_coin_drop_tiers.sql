-- =============================================================
-- ホームの降ってくるコイン：中レア・高レアを足す
-- =============================================================
-- 0128 の後に適用する。claim_home_coin_drop に「レア度（p_tier）」を足して作り直す。
-- 黄色・青どちらも同じ枚数：
--   ・ふつう（common）  5 枚（降る 85%）
--   ・中レア（rare）   20 枚（降る 12%）
--   ・高レア（epic）  100 枚（降る  3%）
-- レア度はアプリ側で決めるので、DB 側で「直近1時間に受け取れる回数」を決めて守る。
-- ふつうに遊んでいて超えることはまずない回数（高レアは平均 1時間に約4回 → 8回まで、中レアは約17回 → 30回まで）。
-- 超えたぶんは、ふつう（5枚）として渡す。前の受け取りから 8 秒あける・同じコインは1回だけ、は 0128 のまま。
begin;

do $$
begin
  if to_regprocedure('public.claim_home_coin_drop(text, text)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'HOME_COIN_DROP_TIERS_MISSING_DEPENDENCY',
      hint = 'ホームの降ってくるコイン（0128）を先に適用してください。';
  end if;
end;
$$;

drop function if exists public.claim_home_coin_drop(text, text);

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
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_drop_id is null or p_drop_id !~ '^[A-Za-z0-9_-]{8,64}$' then raise exception 'Invalid drop id'; end if;
  if p_kind is null or p_kind not in ('coin', 'blue') then raise exception 'Invalid coin kind'; end if;
  if p_tier is null or p_tier not in ('common', 'rare', 'epic') then raise exception 'Invalid coin tier'; end if;

  -- 同じ人の受け取りを1つずつ数える
  perform pg_advisory_xact_lock(hashtext('home_drop:' || v_user_id::text));

  v_key := 'home-drop:' || p_drop_id;

  -- 同じコインの再送は受け取らない
  if exists (select 1 from public.coin_events where user_id = v_user_id and idempotency_key = v_key)
     or exists (select 1 from public.blue_coin_events where user_id = v_user_id and idempotency_key = v_key) then
    return jsonb_build_object('ok', true, 'granted', false, 'reason', 'duplicate');
  end if;

  -- 前の受け取りから 8 秒（黄色と青のどちらでも）
  select max(created_at) into v_last
    from public.coin_events
   where user_id = v_user_id and event_type = 'home_drop' and created_at > now() - interval '1 minute';
  select greatest(v_last, max(created_at)) into v_last
    from public.blue_coin_events
   where user_id = v_user_id and event_type = 'home_drop' and created_at > now() - interval '1 minute';
  if v_last is not null and v_last > now() - interval '8 seconds' then
    return jsonb_build_object('ok', true, 'granted', false, 'reason', 'too_soon');
  end if;

  -- レア度ごとの、直近1時間の回数。超えたら、ふつうとして渡す
  v_tier := p_tier;
  if v_tier <> 'common' then
    select
      (select count(*) from public.coin_events
        where user_id = v_user_id and event_type = 'home_drop'
          and created_at > now() - interval '1 hour' and metadata->>'tier' = v_tier)
      + (select count(*) from public.blue_coin_events
        where user_id = v_user_id and event_type = 'home_drop'
          and created_at > now() - interval '1 hour' and metadata->>'tier' = v_tier)
      into v_tier_count;
    v_tier_limit := (case v_tier when 'epic' then 8 else 30 end);
    if v_tier_count >= v_tier_limit then
      v_tier := 'common';
    end if;
  end if;

  v_amount := case v_tier when 'epic' then 100 when 'rare' then 20 else 5 end;

  if p_kind = 'blue' then
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

  return jsonb_build_object(
    'ok', true,
    'granted', v_applied,
    'kind', p_kind,
    'tier', v_tier,
    'amount', case when v_applied then v_amount else 0 end,
    'balance', coalesce(v_balance, 0),
    'blue_balance', coalesce(v_blue_balance, 0)
  );
end;
$$;

revoke all on function public.claim_home_coin_drop(text, text, text) from public, anon;
grant execute on function public.claim_home_coin_drop(text, text, text) to authenticated;

commit;

notify pgrst, 'reload schema';
