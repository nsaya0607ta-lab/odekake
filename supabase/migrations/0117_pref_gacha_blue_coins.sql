-- =============================================================
-- 都道府県ガチャ（青コイン）と、岐阜のフレブル
-- =============================================================
-- ・都道府県ガチャは青コインでまわす（1回100・10回900・100回9000）。
--   景品は通常ガチャと同じ user_gacha_items に入る（図鑑・犬スキンの所持判定もそのまま使える）。
-- ・青コインの台帳（blue_coin_events）に 'pref_gacha' を足す。
-- ・犬スキンに 'gifu'（景品 gifu_frenchie）を足す。
--
-- 抽選はアプリ側（src/lib/gacha/draw.ts の pool: "pref"）で行い、ここは
-- 「値段が回数どおりか」を確かめて、青コインを減らし、景品を渡すだけ。
-- 値段は src/lib/gacha/config.ts の GACHA_PLANS と同じにする。

-- -------------------------------------------------------------
-- 青コインの台帳に「都道府県ガチャ」を足す
-- -------------------------------------------------------------
alter table public.blue_coin_events drop constraint if exists blue_coin_events_event_type_check;
alter table public.blue_coin_events
  add constraint blue_coin_events_event_type_check
  check (event_type in ('osanpo_run', 'room_furniture', 'pref_gacha'));

-- -------------------------------------------------------------
-- 都道府県ガチャを確定する
-- -------------------------------------------------------------
create or replace function public.commit_pref_gacha_draw(
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
  v_draws integer;
  v_balance integer;
  v_existing jsonb;
  v_item_id text;
  v_new_ids text[] := '{}';
  v_inserted boolean;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or length(p_request_id) not between 8 and 100 then
    raise exception 'Invalid request id';
  end if;
  v_draws := coalesce(array_length(p_item_ids, 1), 0);
  -- 値段は回数で決まっている（1回100・10回900・100回9000）。それ以外は受けつけない
  if not ((v_draws = 1 and p_cost = 100) or (v_draws = 10 and p_cost = 900) or (v_draws = 100 and p_cost = 9000)) then
    raise exception 'Invalid plan';
  end if;

  v_key := 'pref-gacha:' || p_request_id;

  -- 再送なら、1回目に引いた景品をそのまま返す（青コインは減らさない）
  select metadata into v_existing from public.blue_coin_events
   where user_id = v_user_id and idempotency_key = v_key;
  if v_existing is not null then
    select balance into v_balance from public.user_blue_coins where user_id = v_user_id;
    return jsonb_build_object(
      'ok', true, 'applied', false, 'balance', coalesce(v_balance, 0),
      'item_ids', coalesce(v_existing -> 'item_ids', '[]'::jsonb),
      'new_item_ids', '[]'::jsonb
    );
  end if;

  begin
    if not public.add_blue_coin_event(
      v_user_id, 'pref_gacha', -p_cost, v_key,
      jsonb_build_object('label', '都道府県ガチャ', 'draws', v_draws, 'item_ids', to_jsonb(p_item_ids))
    ) then
      -- 同じキーの呼び出しが同時に走ったとき。先に入った方の結果を返す
      select metadata into v_existing from public.blue_coin_events
       where user_id = v_user_id and idempotency_key = v_key;
      select balance into v_balance from public.user_blue_coins where user_id = v_user_id;
      return jsonb_build_object(
        'ok', true, 'applied', false, 'balance', coalesce(v_balance, 0),
        'item_ids', coalesce(v_existing -> 'item_ids', '[]'::jsonb),
        'new_item_ids', '[]'::jsonb
      );
    end if;
  exception when sqlstate 'P0001' then
    if sqlerrm = 'BLUE_COINS_SHORT' then
      select balance into v_balance from public.user_blue_coins where user_id = v_user_id;
      return jsonb_build_object('ok', false, 'reason', 'insufficient_coins', 'balance', coalesce(v_balance, 0));
    end if;
    raise;
  end;

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

  select balance into v_balance from public.user_blue_coins where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true, 'applied', true, 'balance', coalesce(v_balance, 0),
    'item_ids', to_jsonb(p_item_ids),
    'new_item_ids', to_jsonb(v_new_ids)
  );
end;
$$;

revoke all on function public.commit_pref_gacha_draw(integer, text, text[]) from public, anon;
grant execute on function public.commit_pref_gacha_draw(integer, text, text[]) to authenticated;

comment on function public.commit_pref_gacha_draw(integer, text, text[]) is
  '都道府県ガチャ（青コイン）を確定する。値段は回数どおり（1回100・10回900・100回9000）でないと受けつけない。';

-- -------------------------------------------------------------
-- 犬スキン「岐阜のフレブル」
-- -------------------------------------------------------------
alter table public.user_dog_skin drop constraint if exists user_dog_skin_skin_id_check;
alter table public.user_dog_skin
  add constraint user_dog_skin_skin_id_check
  check (skin_id in ('default', 'hiking', 'snow', 'summer', 'gifu'));

create or replace function public.dog_skin_unlock_item(p_skin_id text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_skin_id
    when 'hiking' then 'hiking_frenchie'
    when 'snow' then 'snow_frenchie'
    when 'summer' then 'summer_frenchie'
    when 'gifu' then 'gifu_frenchie'
    else null
  end;
$$;

create or replace function public.set_dog_skin(p_skin_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item_id text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_skin_id not in ('default', 'hiking', 'snow', 'summer', 'gifu') then
    raise exception 'Invalid skin';
  end if;

  v_item_id := public.dog_skin_unlock_item(p_skin_id);
  if v_item_id is not null and not exists (
    select 1 from public.user_gacha_items
     where user_id = v_user_id and item_id = v_item_id
  ) then
    raise exception 'Skin not owned';
  end if;

  insert into public.user_dog_skin (user_id, skin_id, updated_at)
  values (v_user_id, p_skin_id, now())
  on conflict (user_id) do update
    set skin_id = excluded.skin_id,
        updated_at = now();
end;
$$;

grant execute on function public.set_dog_skin(text) to authenticated;
