-- ホームに降ってくるコインを全体で5倍にする（ユーザー指定）。0142 の後に適用する。
-- アプリは5秒ごとの抽選を1秒ごとにする。DB は受け取りの間かくを 8秒→1秒、
-- 直近1時間のレア回数の上限を 中レア 30→150・高レア 8→40 にする（枚数・二重受け取りの防止は変えない）。
begin;

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
  if p_kind is null or p_kind not in ('coin', 'blue', 'red', 'white') then raise exception 'Invalid coin kind'; end if;
  if p_tier is null or p_tier not in ('common', 'rare', 'epic') then raise exception 'Invalid coin tier'; end if;

  -- 同じ人の受け取りを1つずつ数える
  perform pg_advisory_xact_lock(hashtext('home_drop:' || v_user_id::text));

  v_key := 'home-drop:' || p_drop_id;

  -- 同じコインの再送は受け取らない（3色のどの台帳にあっても）
  if exists (select 1 from public.coin_events where user_id = v_user_id and idempotency_key = v_key)
     or exists (select 1 from public.blue_coin_events where user_id = v_user_id and idempotency_key = v_key)
     or exists (select 1 from public.red_coin_events where user_id = v_user_id and idempotency_key = v_key)
     or exists (select 1 from public.white_coin_events where user_id = v_user_id and idempotency_key = v_key) then
    return jsonb_build_object('ok', true, 'granted', false, 'reason', 'duplicate');
  end if;

  -- 前の受け取りから 1 秒（4色のどれでも。0143 で 8 秒から短くした）
  select max(created_at) into v_last
    from public.coin_events
   where user_id = v_user_id and event_type = 'home_drop' and created_at > now() - interval '1 minute';
  select greatest(v_last, max(created_at)) into v_last
    from public.blue_coin_events
   where user_id = v_user_id and event_type = 'home_drop' and created_at > now() - interval '1 minute';
  select greatest(v_last, max(created_at)) into v_last
    from public.red_coin_events
   where user_id = v_user_id and event_type = 'home_drop' and created_at > now() - interval '1 minute';
  select greatest(v_last, max(created_at)) into v_last from public.white_coin_events where user_id=v_user_id and event_type='home_drop' and created_at>now()-interval '1 minute';
  if v_last is not null and v_last > now() - interval '1 second' then
    return jsonb_build_object('ok', true, 'granted', false, 'reason', 'too_soon');
  end if;

  -- レア度ごとの、直近1時間の回数（4色あわせて。0143 で5倍）。超えたら、ふつうとして渡す
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
      + (select count(*) from public.white_coin_events where user_id=v_user_id and event_type='home_drop' and created_at>now()-interval '1 hour' and metadata->>'tier'=v_tier)
      into v_tier_count;
    v_tier_limit := (case v_tier when 'epic' then 40 else 150 end);
    if v_tier_count >= v_tier_limit then
      v_tier := 'common';
    end if;
  end if;

  v_amount := case v_tier when 'epic' then 100 when 'rare' then 20 else 5 end;

  if p_kind = 'white' then
    v_applied := public.add_white_coin_event(v_user_id,'home_drop',v_amount,v_key,jsonb_build_object('label','ホームで拾った白コイン','drop_id',p_drop_id,'tier',v_tier));
  elsif p_kind = 'red' then
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
    'red_balance', coalesce(v_red_balance, 0),
    'white_balance', coalesce((select balance from public.user_white_coins where user_id=v_user_id),0)
  );
end;
$$;

revoke all on function public.claim_home_coin_drop(text, text, text) from public, anon;
grant execute on function public.claim_home_coin_drop(text, text, text) to authenticated;

notify pgrst, 'reload schema';
commit;
