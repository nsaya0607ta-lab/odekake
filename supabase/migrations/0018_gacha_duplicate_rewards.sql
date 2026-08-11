-- =============================================================
-- ガチャ重複ボーナス
-- =============================================================
-- 同じ景品が2回目以降に出たとき、user_gacha_items.count は今まで通り増やし、
-- さらにレア度に応じてコインを返す。
--
--   N   : +2 コイン
--   R   : +5 コイン
--   SR  : +10 コイン
--   SSR : +20 コイン
--
-- 景品のレア度はアプリ側 src/lib/gacha/prizes.ts と同じ対応にする。
-- 新しい景品を追加したときは、この関数にも item_id を追加する。

create or replace function public.gacha_duplicate_coin_for_item(p_item_id text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    -- N
    when p_item_id in (
      'toy_colorful_ball',
      'toy_rope',
      'toy_bone',
      'toy_squeaky_ball',
      'toy_tennis_ball',
      'toy_red_slipper',
      'toy_wood_stick',
      'toy_donut_rope'
    ) then 2

    -- R
    when p_item_id in (
      'toy_duck_plush',
      'toy_carrot',
      'toy_frisbee',
      'toy_soccer_ball',
      'toy_taiyaki_plush',
      'toy_bear_plush'
    ) then 5

    -- SR
    when p_item_id in (
      'toy_treasure_puzzle',
      'toy_frenchie_plush',
      'toy_meat',
      'toy_frenchie_cushion'
    ) then 10

    -- SSR
    when p_item_id in (
      'toy_rainbow_ball',
      'toy_golden_crown_ball',
      'hiking_frenchie',
      'snow_frenchie',
      'summer_frenchie'
    ) then 20

    -- 将来追加された景品は、対応を追加するまで重複ボーナスなし。
    else 0
  end;
$$;

-- -------------------------------------------------------------
-- ガチャ確定処理を、重複ボーナス対応版へ更新
-- -------------------------------------------------------------
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
  v_previous_count integer;
  v_duplicate_reward integer;
  v_duplicate_total integer := 0;
  v_duplicate_rewards integer[] := '{}';
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

  -- 同じユーザーの他の消費と同時に走っても残高が二重に減らないよう、行を押さえる。
  select balance into v_balance
  from public.user_coins
  where user_id = v_user_id
  for update;
  v_balance := coalesce(v_balance, 0);

  -- 同じ request_id の再送なら、1回目の結果だけ返して何も追加付与しない。
  select metadata into v_existing
  from public.coin_events
  where user_id = v_user_id and idempotency_key = v_key;

  if v_existing is not null then
    return jsonb_build_object(
      'ok', true,
      'applied', false,
      'balance', v_balance,
      'item_ids', coalesce(v_existing -> 'item_ids', '[]'::jsonb),
      'new_item_ids', '[]'::jsonb,
      'duplicate_coins', coalesce((v_existing ->> 'duplicate_coins')::integer, 0),
      'duplicate_rewards', coalesce(v_existing -> 'duplicate_rewards', '[]'::jsonb)
    );
  end if;

  if v_balance < p_cost then
    return jsonb_build_object(
      'ok', false,
      'reason', 'insufficient_coins',
      'balance', v_balance
    );
  end if;

  -- まず通常どおりガチャ代を消費。
  insert into public.coin_events (
    user_id,
    event_type,
    amount,
    idempotency_key,
    metadata
  ) values (
    v_user_id,
    'gacha',
    -p_cost,
    v_key,
    jsonb_build_object(
      'label', 'ガチャ',
      'draws', array_length(p_item_ids, 1),
      'item_ids', to_jsonb(p_item_ids)
    )
  )
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_event_id;

  -- 同じキーが同時実行された場合は、先に確定した方だけを採用する。
  if v_event_id is null then
    select metadata into v_existing
    from public.coin_events
    where user_id = v_user_id and idempotency_key = v_key;

    select balance into v_balance
    from public.user_coins
    where user_id = v_user_id;

    return jsonb_build_object(
      'ok', true,
      'applied', false,
      'balance', coalesce(v_balance, 0),
      'item_ids', coalesce(v_existing -> 'item_ids', '[]'::jsonb),
      'new_item_ids', '[]'::jsonb,
      'duplicate_coins', coalesce((v_existing ->> 'duplicate_coins')::integer, 0),
      'duplicate_rewards', coalesce(v_existing -> 'duplicate_rewards', '[]'::jsonb)
    );
  end if;

  foreach v_item_id in array p_item_ids loop
    -- この時点で既に1個以上持っていれば「ダブり」。
    select count into v_previous_count
    from public.user_gacha_items
    where user_id = v_user_id and item_id = v_item_id;

    if found then
      v_duplicate_reward := public.gacha_duplicate_coin_for_item(v_item_id);
      v_duplicate_total := v_duplicate_total + v_duplicate_reward;
      v_duplicate_rewards := array_append(v_duplicate_rewards, v_duplicate_reward);
    else
      v_duplicate_rewards := array_append(v_duplicate_rewards, 0);
    end if;

    -- 回数は初回も含めて必ず増やす。10連の中で同じ景品が複数回出た場合も1回ずつ加算される。
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

  -- 元のガチャ台帳にも重複情報を記録し、同じrequest_idの再送でも同じ結果を返せるようにする。
  update public.coin_events
  set metadata = metadata || jsonb_build_object(
    'duplicate_coins', v_duplicate_total,
    'duplicate_rewards', to_jsonb(v_duplicate_rewards)
  )
  where id = v_event_id;

  -- ダブりがあったときだけ、まとめて1件の正のコインイベントを積む。
  -- request_id ごとに一意なので、再送や連打で二重付与されない。
  if v_duplicate_total > 0 then
    insert into public.coin_events (
      user_id,
      event_type,
      amount,
      idempotency_key,
      metadata
    ) values (
      v_user_id,
      'gacha',
      v_duplicate_total,
      'gacha-duplicate:' || p_request_id,
      jsonb_build_object(
        'label', 'ガチャ重複ボーナス',
        'item_ids', to_jsonb(p_item_ids),
        'duplicate_rewards', to_jsonb(v_duplicate_rewards)
      )
    )
    on conflict (user_id, idempotency_key) do nothing;
  end if;

  select balance into v_balance
  from public.user_coins
  where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'applied', true,
    'balance', coalesce(v_balance, 0),
    'item_ids', to_jsonb(p_item_ids),
    'new_item_ids', to_jsonb(v_new_ids),
    'duplicate_coins', v_duplicate_total,
    'duplicate_rewards', to_jsonb(v_duplicate_rewards)
  );
end;
$$;

grant execute on function public.commit_gacha_draw(integer, text, text[]) to authenticated;
