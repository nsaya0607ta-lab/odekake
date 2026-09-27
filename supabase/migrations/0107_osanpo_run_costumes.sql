-- =============================================================
-- おさんぽフレンチー: コインで買えるきせかえ
-- =============================================================
-- 頭・顔・足あとに付けるきせかえを、コインで1回買えばずっと使える。
-- 値段はクライアントから受け取らず、この関数の中の一覧で決める（書きかえて安く買われないように）。
-- 何を付けているかは端末に保存する（ここでは「持っているか」だけを記録する）。
-- 消費は他と同じく coin_events に負の値を1件積み、残高は既存のトリガーが直す。
begin;

alter table public.coin_events drop constraint if exists coin_events_event_type_check;
alter table public.coin_events add constraint coin_events_event_type_check
  check (event_type in (
    'level_up', 'steps', 'unlock', 'gacha', 'login', 'item_catch',
    'wanko_bowling', 'snack_trail', 'dambourle_gacha', 'osanpo_run', 'osanpo_run_shop'
  ));

create table if not exists public.osanpo_run_costumes (
  user_id uuid not null references auth.users(id) on delete cascade,
  costume_id text not null,
  bought_at timestamptz not null default now(),
  primary key (user_id, costume_id),
  constraint osanpo_run_costumes_id_format check (length(costume_id) between 1 and 40)
);

alter table public.osanpo_run_costumes enable row level security;

-- 読めるのは自分の持ち物だけ。増やすのは下の購入関数からだけ。
drop policy if exists osanpo_run_costumes_select_own on public.osanpo_run_costumes;
create policy osanpo_run_costumes_select_own on public.osanpo_run_costumes
  for select to authenticated
  using (user_id = auth.uid());

grant select on public.osanpo_run_costumes to authenticated;

-- -------------------------------------------------------------
-- 値段の一覧（src/lib/games/osanpo-run/config.ts の OSANPO_RUN_COSTUMES と合わせる）
-- -------------------------------------------------------------
create or replace function public.osanpo_run_costume_price(p_costume_id text)
returns integer
language sql
immutable
as $$
  select case p_costume_id
    when 'ribbon' then 800
    when 'flower' then 1500
    when 'halo' then 2500
    when 'crown' then 3000
    when 'sunglasses' then 1200
    when 'hearteyes' then 1500
    when 'trail_bubble' then 800
    when 'trail_sparkle' then 1000
    when 'trail_note' then 1200
    when 'trail_heart' then 1500
    when 'trail_rainbow' then 3000
    else null
  end;
$$;

-- -------------------------------------------------------------
-- 購入
-- -------------------------------------------------------------
-- 返り値:
--   { "ok": true,  "applied": true,  "balance": 残高 }         買えた
--   { "ok": true,  "applied": false, "balance": 残高 }         もう持っていた（コインは減らない）
--   { "ok": false, "reason": "insufficient_coins", "balance": 残高 }
create or replace function public.buy_osanpo_run_costume(p_costume_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_price integer := public.osanpo_run_costume_price(p_costume_id);
  v_key text;
  v_balance integer;
  v_event_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if v_price is null then
    raise exception using errcode = 'P0001', message = 'UNKNOWN_COSTUME';
  end if;

  v_key := 'osanpo-run-costume:' || p_costume_id;

  -- 同じユーザーの他の消費と同時に走っても残高が二重に減らないよう、行を押さえてから確かめる。
  select balance into v_balance from public.user_coins where user_id = v_user_id for update;
  v_balance := coalesce(v_balance, 0);

  if exists (select 1 from public.osanpo_run_costumes where user_id = v_user_id and costume_id = p_costume_id) then
    return jsonb_build_object('ok', true, 'applied', false, 'balance', v_balance);
  end if;

  if v_balance < v_price then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_coins', 'balance', v_balance);
  end if;

  insert into public.coin_events (user_id, event_type, amount, idempotency_key, metadata)
  values (
    v_user_id, 'osanpo_run_shop', -v_price, v_key,
    jsonb_build_object('label', 'おさんぽフレンチー きせかえ', 'costume_id', p_costume_id)
  )
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_event_id;

  -- 同じ購入が同時に走ったときは、先に入ったほうだけがコインを減らす
  if v_event_id is not null then
    insert into public.osanpo_run_costumes (user_id, costume_id)
    values (v_user_id, p_costume_id)
    on conflict (user_id, costume_id) do nothing;
  end if;

  select balance into v_balance from public.user_coins where user_id = v_user_id;

  return jsonb_build_object('ok', true, 'applied', v_event_id is not null, 'balance', coalesce(v_balance, 0));
end;
$$;

revoke all on function public.buy_osanpo_run_costume(text) from public, anon;
grant execute on function public.buy_osanpo_run_costume(text) to authenticated;

comment on function public.buy_osanpo_run_costume(text) is
  'おさんぽフレンチーのきせかえをコインで買う。値段はサーバー側の一覧で決め、同じものは二重に買えない。';

commit;

notify pgrst, 'reload schema';
