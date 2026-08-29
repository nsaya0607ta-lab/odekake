-- =============================================================
-- 100連ガチャ
-- =============================================================
-- commit_gacha_draw は1回のRPC呼び出しで最大10件までしか確定できない
-- 制約があった（0014）。100連を1トランザクションで確定できるよう、
-- 上限だけを100件に緩和する。ロジックは0014から変更なし。

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
  if array_length(p_item_ids, 1) > 100 then raise exception 'Too many items'; end if;

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
