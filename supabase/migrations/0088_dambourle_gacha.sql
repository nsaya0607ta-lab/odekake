-- =============================================================
-- ダンボールガチャ
-- =============================================================
-- アイテムキャッチのダンボール（キャッチャー）見た目・効果を引けるガチャ。
-- 通常ガチャ（0014_coin_gacha.sql / 0079_gacha_hundred_pull.sql）と同じ骨格：
-- user_dambourle_items(count)で所持・重複数を管理し、コイン消費・重複時の
-- 還元はcommit_gacha_drawと同じくcoin_eventsへのinsert+トリガー(sync_user_coin_balance)
-- で残高に反映する。
--
-- ダンボール自身のスキルLv・スキン解放段階は、count（重複数）から都度計算する
-- 純粋関数として持ち、別カラムに二重管理しない（正規ガチャのpreviousLevel/newLevel
-- と同じ考え方）。
--
-- id/ランク/重複還元額/Lv上限は src/lib/dambourle/prizes.ts と一致させること
-- （新しいダンボールを追加したらこのファイルの関数も更新する）。

create table if not exists public.user_dambourle_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  -- src/lib/dambourle/prizes.ts の DambourleItem.id
  item_id text not null,
  count integer not null default 1 check (count > 0),
  first_obtained_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.user_dambourle_items enable row level security;

drop policy if exists user_dambourle_items_select on public.user_dambourle_items;
create policy user_dambourle_items_select on public.user_dambourle_items for select to authenticated
  using (user_id = auth.uid());

-- 参照だけ許可する。書き込みは下のRPC（SECURITY DEFINER）だけが行う。
grant select on public.user_dambourle_items to authenticated;

drop trigger if exists user_dambourle_items_set_updated_at on public.user_dambourle_items;
create trigger user_dambourle_items_set_updated_at before update on public.user_dambourle_items
  for each row execute function public.set_updated_at();

-- プレイ前に選ぶ「装備中のダンボール＋スキン段階」。1ユーザー1行。
create table if not exists public.user_dambourle_equipped (
  user_id uuid primary key references auth.users(id) on delete cascade,
  item_id text not null,
  -- 0 = 初期無料ダンボール(既存デザイン)の基本スキンを含む「未昇格」段階。
  -- No.11以外は1〜5(Lv14/28/42/56/70で解放)、No.11は1〜5(Lv1〜5でそのまま解放)。
  skin_index integer not null default 0 check (skin_index between 0 and 5),
  updated_at timestamptz not null default now()
);

alter table public.user_dambourle_equipped enable row level security;

drop policy if exists user_dambourle_equipped_select on public.user_dambourle_equipped;
create policy user_dambourle_equipped_select on public.user_dambourle_equipped for select to authenticated
  using (user_id = auth.uid());

grant select on public.user_dambourle_equipped to authenticated;

-- -------------------------------------------------------------
-- ランク・Lv・スキン段階の計算（すべてsrc/lib/dambourle/prizes.tsのidと同期させる）
-- -------------------------------------------------------------

create or replace function public.dambourle_rank_for_item(p_item_id text)
returns text
language sql
immutable
as $$
  select case p_item_id
    when 'dambourle_no7' then 'SSR'
    when 'dambourle_no13' then 'SSR'
    when 'dambourle_no10' then 'SSR'
    when 'dambourle_no6' then 'UR'
    when 'dambourle_no8' then 'UR'
    when 'dambourle_no9' then 'UR'
    when 'dambourle_no3' then 'UR'
    when 'dambourle_no1' then 'LR'
    when 'dambourle_no2' then 'LR'
    when 'dambourle_no5' then 'LR'
    when 'dambourle_no12' then 'LR'
    when 'dambourle_no4' then 'LR'
    when 'dambourle_no11' then 'MR'
    else null
  end;
$$;

create or replace function public.dambourle_duplicate_coin_for_rank(p_rank text)
returns integer
language sql
immutable
as $$
  select case p_rank
    when 'SSR' then 50
    when 'UR' then 150
    when 'LR' then 400
    when 'MR' then 1000
    else 0
  end;
$$;

-- 重複3個ごとにLv+1（全ランク共通）。count=1の時点でLv1。
-- No.11のみ自身のLv上限は5、それ以外は70。
create or replace function public.dambourle_level_cap_for_item(p_item_id text)
returns integer
language sql
immutable
as $$
  select case when p_item_id = 'dambourle_no11' then 5 else 70 end;
$$;

create or replace function public.dambourle_level_for_count(p_item_id text, p_count integer)
returns integer
language sql
immutable
as $$
  select least(
    public.dambourle_level_cap_for_item(p_item_id),
    floor((greatest(p_count, 1) - 1) / 3.0)::integer + 1
  );
$$;

-- No.11以外：Lv14/28/42/56/70でスキンが1枚ずつ解放（Lv1〜13は基本スキンのみ＝0）。
-- No.11：Lv1〜5がそのままスキン1〜5に対応。
create or replace function public.dambourle_skin_tier_for_item(p_item_id text, p_level integer)
returns integer
language sql
immutable
as $$
  select case
    when p_item_id = 'dambourle_no11' then least(p_level, 5)
    else least(floor(p_level / 14.0)::integer, 5)
  end;
$$;

-- -------------------------------------------------------------
-- ガチャの確定
-- -------------------------------------------------------------
-- 返り値のJSON:
--   { "ok": true,  "applied": true,  "balance": 残高, "item_ids": [...], "new_item_ids": [...], "duplicate_coins": 還元合計 }
--   { "ok": true,  "applied": false, ... }  … 同じp_request_idで既に処理済み（再送）
--   { "ok": false, "reason": "insufficient_coins", "balance": 残高 }
create or replace function public.commit_dambourle_draw(
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
  v_duplicate_coins integer := 0;
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

  v_key := 'dambourle:' || p_request_id;

  select balance into v_balance from public.user_coins where user_id = v_user_id for update;
  v_balance := coalesce(v_balance, 0);

  -- 再送なら、1回目に引いた景品をそのまま返す（コインは減らさない）。
  select metadata into v_existing from public.coin_events
   where user_id = v_user_id and idempotency_key = v_key;
  if v_existing is not null then
    return jsonb_build_object(
      'ok', true, 'applied', false, 'balance', v_balance,
      'item_ids', coalesce(v_existing -> 'item_ids', '[]'::jsonb),
      'new_item_ids', '[]'::jsonb,
      'duplicate_coins', 0
    );
  end if;

  if v_balance < p_cost then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_coins', 'balance', v_balance);
  end if;

  insert into public.coin_events (user_id, event_type, amount, idempotency_key, metadata)
  values (
    v_user_id, 'dambourle_gacha', -p_cost, v_key,
    jsonb_build_object(
      'label', 'ダンボールガチャ',
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
      'new_item_ids', '[]'::jsonb,
      'duplicate_coins', 0
    );
  end if;

  foreach v_item_id in array p_item_ids loop
    insert into public.user_dambourle_items (user_id, item_id, count)
    values (v_user_id, v_item_id, 1)
    on conflict (user_id, item_id) do update
      set count = public.user_dambourle_items.count + 1,
          updated_at = now()
    returning (xmax = 0) into v_inserted;

    if v_inserted then
      v_new_ids := array_append(v_new_ids, v_item_id);
    else
      v_duplicate_coins := v_duplicate_coins
        + public.dambourle_duplicate_coin_for_rank(public.dambourle_rank_for_item(v_item_id));
    end if;
  end loop;

  if v_duplicate_coins > 0 then
    insert into public.coin_events (user_id, event_type, amount, idempotency_key, metadata)
    values (
      v_user_id, 'dambourle_gacha', v_duplicate_coins, 'dambourle-duplicate:' || p_request_id,
      jsonb_build_object('label', 'ダンボール重複還元')
    )
    on conflict (user_id, idempotency_key) do nothing;
  end if;

  select balance into v_balance from public.user_coins where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true, 'applied', true, 'balance', coalesce(v_balance, 0),
    'item_ids', to_jsonb(p_item_ids),
    'new_item_ids', to_jsonb(v_new_ids),
    'duplicate_coins', v_duplicate_coins
  );
end;
$$;

grant execute on function public.commit_dambourle_draw(integer, text, text[]) to authenticated;

-- -------------------------------------------------------------
-- 装備（プレイ前のダンボール・スキン選択）
-- -------------------------------------------------------------
create or replace function public.set_dambourle_equipped(p_item_id text, p_skin_index integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
  v_level integer;
  v_max_tier integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select count into v_count from public.user_dambourle_items
   where user_id = v_user_id and item_id = p_item_id;
  if v_count is null then
    raise exception 'このダンボールはまだガチャで手に入れていません';
  end if;

  v_level := public.dambourle_level_for_count(p_item_id, v_count);
  v_max_tier := public.dambourle_skin_tier_for_item(p_item_id, v_level);

  if p_skin_index < 0 or p_skin_index > v_max_tier then
    raise exception 'このスキンはまだ解放されていません';
  end if;

  insert into public.user_dambourle_equipped (user_id, item_id, skin_index)
  values (v_user_id, p_item_id, p_skin_index)
  on conflict (user_id) do update
    set item_id = excluded.item_id,
        skin_index = excluded.skin_index,
        updated_at = now();
end;
$$;

grant execute on function public.set_dambourle_equipped(text, integer) to authenticated;

-- coin_eventsのevent_typeに新種別を追加
alter table public.coin_events drop constraint if exists coin_events_event_type_check;
alter table public.coin_events add constraint coin_events_event_type_check
  check (event_type in (
    'level_up', 'steps', 'unlock', 'gacha', 'login', 'item_catch',
    'wanko_bowling', 'snack_trail', 'dambourle_gacha'
  ));
