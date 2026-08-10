-- =============================================================
-- コインガチャ
-- =============================================================
-- 既存のおでかけコイン（0011）をそのまま使う。新しい通貨は作らない。
-- 消費は coin_events に負の値を1件積むだけで、残高は既存のトリガーが直す。
--
-- 抽選そのもの（排出率・景品一覧）はアプリ側（src/lib/gacha/）に置いてある。
-- 後から景品を足す作業をSQLの書き換えなしで済ませたいので、DBは
-- 「残高を確かめて減らす」「引き当てた景品を所持に記録する」だけを受け持つ。
--
-- 二重消費は idempotency_key で止める。同じ p_request_id で2回呼ばれても
-- 台帳は1件しか増えず、2回目は1回目に引いた景品をそのまま返す。

-- 消費の種類に 'gacha' を足す（'unlock' は将来のショップ用のまま）。
alter table public.coin_events drop constraint if exists coin_events_event_type_check;
alter table public.coin_events add constraint coin_events_event_type_check
  check (event_type in ('level_up', 'steps', 'unlock', 'gacha'));

-- ガチャで手に入れたもの。同じものが重複して出るので個数も持つ。
create table if not exists public.user_gacha_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  -- src/lib/gacha/prizes.ts の GachaPrize.id
  item_id text not null,
  count integer not null default 1 check (count > 0),
  first_obtained_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.user_gacha_items enable row level security;

drop policy if exists user_gacha_items_select on public.user_gacha_items;
create policy user_gacha_items_select on public.user_gacha_items for select to authenticated
  using (user_id = auth.uid());

-- 参照だけ許可する。書き込みは下の RPC（SECURITY DEFINER）だけが行う。
grant select on public.user_gacha_items to authenticated;

drop trigger if exists user_gacha_items_set_updated_at on public.user_gacha_items;
create trigger user_gacha_items_set_updated_at before update on public.user_gacha_items
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- ガチャの確定
-- -------------------------------------------------------------
-- アプリ側が引いた結果（p_item_ids）を受け取り、残高を確かめて減らし、所持に記録する。
-- 返り値の JSON:
--   { "ok": true,  "applied": true,  "balance": 残高, "item_ids": [...], "new_item_ids": [...] }
--   { "ok": true,  "applied": false, ... }  … 同じ p_request_id で既に処理済み（再送）
--   { "ok": false, "reason": "insufficient_coins", "balance": 残高 }
create or replace function public.commit_gacha_draw(
  p_cost integer,
  p_request_id text,
  p_item_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_key text;
  v_balance integer;
  v_event_id uuid;
  v_existing jsonb;
  v_item_id text;
  v_new_ids text[] := '{}';
  v_inserted boolean;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_cost is null or p_cost <= 0 or p_cost > 100000 then raise exception 'Invalid cost'; end if;
  if p_request_id is null or length(p_request_id) not between 8 and 100 then
    raise exception 'Invalid request id';
  end if;
  if p_item_ids is null or array_length(p_item_ids, 1) is null then
    raise exception 'No items to grant';
  end if;
  if array_length(p_item_ids, 1) > 10 then raise exception 'Too many items'; end if;

  v_key := 'gacha:' || p_request_id;

  -- 同じユーザーの他の消費と同時に走っても残高が二重に減らないよう、行を押さえてから確かめる。
  select balance into v_balance from public.user_coins where user_id = v_user_id for update;
  v_balance := coalesce(v_balance, 0);

  -- 再送なら、1回目に引いた景品をそのまま返す（コインは減らさない）。
  select metadata into v_existing from public.coin_events
   where user_id = v_user_id and idempotency_key = v_key;
  if v_existing is not null then
    return jsonb_build_object(
      'ok', true, 'applied', false, 'balance', v_balance,
      'item_ids', coalesce(v_existing -> 'item_ids', '[]'::jsonb),
      'new_item_ids', '[]'::jsonb
    );
  end if;

  if v_balance < p_cost then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_coins', 'balance', v_balance);
  end if;

  insert into public.coin_events (user_id, event_type, amount, idempotency_key, metadata)
  values (
    v_user_id, 'gacha', -p_cost, v_key,
    jsonb_build_object(
      'label', 'ガチャ',
      'draws', array_length(p_item_ids, 1),
      'item_ids', to_jsonb(p_item_ids)
    )
  )
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_event_id;

  -- ここで衝突するのは、同じキーの呼び出しが同時に走ったとき。先に入った方の結果を返す。
  if v_event_id is null then
    select metadata into v_existing from public.coin_events
     where user_id = v_user_id and idempotency_key = v_key;
    return jsonb_build_object(
      'ok', true, 'applied', false, 'balance', v_balance,
      'item_ids', coalesce(v_existing -> 'item_ids', '[]'::jsonb),
      'new_item_ids', '[]'::jsonb
    );
  end if;

  foreach v_item_id in array p_item_ids loop
    insert into public.user_gacha_items (user_id, item_id, count)
    values (v_user_id, v_item_id, 1)
    on conflict (user_id, item_id) do update
      set count = public.user_gacha_items.count + 1,
          updated_at = now()
    returning (xmax = 0) into v_inserted;

    if v_inserted and not (v_item_id = any(v_new_ids)) then
      v_new_ids := array_append(v_new_ids, v_item_id);
    end if;
  end loop;

  select balance into v_balance from public.user_coins where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true, 'applied', true, 'balance', coalesce(v_balance, 0),
    'item_ids', to_jsonb(p_item_ids),
    'new_item_ids', to_jsonb(v_new_ids)
  );
end;
$$;

grant execute on function public.commit_gacha_draw(integer, text, text[]) to authenticated;
