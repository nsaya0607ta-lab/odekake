-- =============================================================
-- 青コイン（おさんぽフレンチーでもらえる特別なコイン）と、わんこのおへやの家具の購入
-- =============================================================
-- ・おさんぽフレンチー（スコア・今日のミッション・協力チャレンジ）のごほうびを、ふつうのコインから青コインにかえる。
--   枚数の決め方はこれまでと同じ（スコア÷50の切り上げ・1プレイ10000まで／ミッション30・ぜんぶで+100／協力100）。
--   これまでに受け取ったふつうのコインは、そのまま。
-- ・青コインの台帳は blue_coin_events（冪等キーつき）、残高は user_blue_coins。
-- ・わんこのおへやの家具は、青コインで買う（1種類2こまで）。持っている数は user_room_furniture。
--   値段はアプリ側の FURNITURE[id].price と同じ。
-- ・これまで無料で置けた家具のうち、いま部屋に置いているものは、持っていることにする。
begin;

do $$
begin
  if to_regclass('public.user_rooms') is null or to_regclass('public.osanpo_run_scores') is null then
    raise exception using
      errcode = 'P0001',
      message = 'BLUE_COINS_MIGRATION_MISSING_DEPENDENCY',
      hint = 'わんこのおへや（0109）と、おさんぽフレンチー（0106〜0108）を先に適用してください。';
  end if;
end;
$$;

-- -------------------------------------------------------------
-- 青コインの残高と台帳
-- -------------------------------------------------------------
create table if not exists public.user_blue_coins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  total_earned integer not null default 0 check (total_earned >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.blue_coin_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('osanpo_run', 'room_furniture')),
  amount integer not null check (amount <> 0),
  idempotency_key text not null check (length(idempotency_key) between 1 and 200),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint blue_coin_events_key_unique unique (user_id, idempotency_key)
);
create index if not exists blue_coin_events_user_created_idx on public.blue_coin_events(user_id, created_at desc);

alter table public.user_blue_coins enable row level security;
alter table public.blue_coin_events enable row level security;

drop policy if exists user_blue_coins_select_own on public.user_blue_coins;
create policy user_blue_coins_select_own on public.user_blue_coins for select to authenticated using (user_id = auth.uid());
drop policy if exists blue_coin_events_select_own on public.blue_coin_events;
create policy blue_coin_events_select_own on public.blue_coin_events for select to authenticated using (user_id = auth.uid());

grant select on public.user_blue_coins to authenticated;
grant select on public.blue_coin_events to authenticated;

/**
 * 青コインを増やす・減らす（同じ冪等キーは1回だけ）。減らすときに足りなければ BLUE_COINS_SHORT。
 * 呼べるのは、この台帳を使う security definer の関数だけ。
 */
create or replace function public.add_blue_coin_event(
  p_user_id uuid,
  p_event_type text,
  p_amount integer,
  p_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_amount is null or p_amount = 0 then
    return false;
  end if;

  insert into public.user_blue_coins (user_id) values (p_user_id) on conflict (user_id) do nothing;
  -- 同じ人の残高を同時に動かさない
  select balance into v_balance from public.user_blue_coins where user_id = p_user_id for update;

  if p_amount < 0 and v_balance + p_amount < 0 then
    raise exception using errcode = 'P0001', message = 'BLUE_COINS_SHORT';
  end if;

  insert into public.blue_coin_events (user_id, event_type, amount, idempotency_key, metadata)
  values (p_user_id, p_event_type, p_amount, p_key, coalesce(p_metadata, '{}'::jsonb))
  on conflict (user_id, idempotency_key) do nothing;
  if not found then
    return false;
  end if;

  update public.user_blue_coins
     set balance = balance + p_amount,
         total_earned = total_earned + greatest(p_amount, 0),
         updated_at = now()
   where user_id = p_user_id;
  return true;
end;
$$;

revoke all on function public.add_blue_coin_event(uuid, text, integer, text, jsonb) from public, anon, authenticated;

-- -------------------------------------------------------------
-- おさんぽフレンチー：スコアのごほうびを青コインに
-- -------------------------------------------------------------
create or replace function public.record_osanpo_run_result(
  p_round_id text,
  p_stage text,
  p_score integer,
  p_meters integer,
  p_items integer
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
  v_coins_key text;
  v_coins integer;
  v_existing_amount integer;
  v_balance integer;
  -- 偽装スコアで大量に稼がれないよう、1プレイで配るコインには上限を置く（これまでと同じ10000）
  v_max_coins constant integer := 10000;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_round_id is null or length(p_round_id) not between 8 and 100 then
    raise exception using errcode = 'P0001', message = 'INVALID_ROUND_ID';
  end if;
  if p_stage is null or p_stage not in ('town', 'hiking', 'snow', 'summer') then
    raise exception using errcode = 'P0001', message = 'INVALID_STAGE';
  end if;
  if p_score is null or p_score < 0 or p_score > 10000000 then
    raise exception using errcode = 'P0001', message = 'INVALID_SCORE';
  end if;
  if p_meters is null or p_meters < 0 or p_meters > 1000000 then
    raise exception using errcode = 'P0001', message = 'INVALID_METERS';
  end if;
  if p_items is null or p_items < 0 or p_items > 1000000 then
    raise exception using errcode = 'P0001', message = 'INVALID_ITEMS';
  end if;

  insert into public.osanpo_run_scores (user_id, round_id, stage, score, meters, items)
  values (v_user_id, p_round_id, p_stage, p_score, p_meters, p_items)
  on conflict (user_id, round_id) do nothing;
  v_applied := found;

  select max(s.score) into v_best_score from public.osanpo_run_scores s where s.user_id = v_user_id;

  -- 青コインはスコア÷50の端数切り上げ。スコア記録と同じ round_id で冪等にする。
  v_coins_key := 'osanpo-run:' || p_round_id;
  v_coins := least(v_max_coins, ceil(p_score / 50.0)::integer);

  if v_coins > 0 then
    if not public.add_blue_coin_event(
      v_user_id, 'osanpo_run', v_coins, v_coins_key,
      jsonb_build_object('label', 'おさんぽフレンチー', 'stage', p_stage, 'score', p_score, 'meters', p_meters, 'items', p_items)
    ) then
      select amount into v_existing_amount from public.blue_coin_events where user_id = v_user_id and idempotency_key = v_coins_key;
      v_coins := coalesce(v_existing_amount, v_coins);
    end if;
  else
    v_coins := 0;
  end if;

  select balance into v_balance from public.user_blue_coins where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'applied', v_applied,
    'best_score', coalesce(v_best_score, 0),
    'coins', v_coins,
    'balance', coalesce(v_balance, 0)
  );
end;
$$;

revoke all on function public.record_osanpo_run_result(text, text, integer, integer, integer) from public, anon;
grant execute on function public.record_osanpo_run_result(text, text, integer, integer, integer) to authenticated;

comment on function public.record_osanpo_run_result(text, text, integer, integer, integer) is
  'おさんぽフレンチーの1プレイ分のスコアを記録し、スコア÷50(端数切り上げ、1プレイ10000まで)を青コインとして付与する。同じ round_id は二重に記録・付与しない。';

-- -------------------------------------------------------------
-- おさんぽフレンチー：今日のミッションのごほうびを青コインに
-- -------------------------------------------------------------
create or replace function public.record_osanpo_run_mission(p_mission_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (timezone('Asia/Tokyo', now()))::date;
  v_count integer;
  v_coins integer := 0;
  v_balance integer;
  -- アプリ側の MISSION_COINS / MISSION_ALL_BONUS / OSANPO_RUN_DAILY_MISSION_COUNT と同じ値
  v_per_mission constant integer := 30;
  v_all_bonus constant integer := 100;
  v_daily constant integer := 3;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_mission_id is null or p_mission_id !~ '^[A-Za-z0-9_]{1,40}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_MISSION';
  end if;

  perform pg_advisory_xact_lock(hashtext('osanpo-run-mission:' || v_user_id::text));

  if exists (
    select 1 from public.osanpo_run_missions
     where user_id = v_user_id and mission_date = v_today and mission_id = p_mission_id
  ) then
    select count(*) into v_count from public.osanpo_run_missions where user_id = v_user_id and mission_date = v_today;
    select balance into v_balance from public.user_blue_coins where user_id = v_user_id;
    return jsonb_build_object('ok', true, 'applied', false, 'coins', 0, 'completed', v_count, 'balance', coalesce(v_balance, 0));
  end if;

  select count(*) into v_count from public.osanpo_run_missions where user_id = v_user_id and mission_date = v_today;
  if v_count >= v_daily then
    raise exception using errcode = 'P0001', message = 'MISSION_LIMIT';
  end if;

  insert into public.osanpo_run_missions (user_id, mission_date, mission_id)
  values (v_user_id, v_today, p_mission_id);
  v_count := v_count + 1;

  if public.add_blue_coin_event(
    v_user_id, 'osanpo_run', v_per_mission,
    'osanpo-mission:' || v_today::text || ':' || p_mission_id,
    jsonb_build_object('label', 'おさんぽミッション', 'mission', p_mission_id)
  ) then
    v_coins := v_coins + v_per_mission;
  end if;

  if v_count = v_daily and public.add_blue_coin_event(
    v_user_id, 'osanpo_run', v_all_bonus,
    'osanpo-mission:' || v_today::text || ':all',
    jsonb_build_object('label', 'おさんぽミッション コンプリート')
  ) then
    v_coins := v_coins + v_all_bonus;
  end if;

  select balance into v_balance from public.user_blue_coins where user_id = v_user_id;
  return jsonb_build_object('ok', true, 'applied', true, 'coins', v_coins, 'completed', v_count, 'balance', coalesce(v_balance, 0));
end;
$$;

revoke all on function public.record_osanpo_run_mission(text) from public, anon;
grant execute on function public.record_osanpo_run_mission(text) to authenticated;

comment on function public.record_osanpo_run_mission(text) is
  'おさんぽフレンチーの今日のミッションを1つ達成として記録し、青コイン30枚（3つ目でさらに100枚）を付与する。日付は日本時間の今日、1日3つまで。同じお題は二重に数えない。';

-- -------------------------------------------------------------
-- おさんぽフレンチー：協力チャレンジのごほうびを青コインに
-- -------------------------------------------------------------
create or replace function public.claim_osanpo_run_coop()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_week_date date := (date_trunc('week', timezone('Asia/Tokyo', now())))::date;
  v_status jsonb;
  v_coins integer := 0;
  v_balance integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  v_status := public.get_osanpo_run_coop();
  if (v_status->>'total')::bigint < (v_status->>'goal')::integer then
    raise exception using errcode = 'P0001', message = 'COOP_NOT_REACHED';
  end if;

  insert into public.osanpo_run_coop_claims (user_id, week_start)
  values (v_user_id, v_week_date)
  on conflict (user_id, week_start) do nothing;

  if found and public.add_blue_coin_event(
    v_user_id, 'osanpo_run', 100,
    'osanpo-coop:' || v_week_date::text,
    jsonb_build_object('label', 'おさんぽ協力チャレンジ', 'week_start', v_week_date)
  ) then
    v_coins := 100;
  end if;

  select balance into v_balance from public.user_blue_coins where user_id = v_user_id;
  return jsonb_build_object('ok', true, 'coins', v_coins, 'balance', coalesce(v_balance, 0));
end;
$$;

revoke all on function public.claim_osanpo_run_coop() from public, anon;
grant execute on function public.claim_osanpo_run_coop() to authenticated;

comment on function public.claim_osanpo_run_coop() is
  'おさんぽフレンチーの協力チャレンジを達成していれば、今週ぶんの青コイン100枚を1回だけ付与する。';

-- -------------------------------------------------------------
-- わんこのおへやの家具（青コインで買う。1種類2こまで）
-- -------------------------------------------------------------
create table if not exists public.user_room_furniture (
  user_id uuid not null references auth.users(id) on delete cascade,
  furniture text not null check (furniture ~ '^[a-z-]{1,32}$'),
  count integer not null default 0 check (count between 0 and 2),
  updated_at timestamptz not null default now(),
  primary key (user_id, furniture)
);

alter table public.user_room_furniture enable row level security;
drop policy if exists user_room_furniture_select_own on public.user_room_furniture;
create policy user_room_furniture_select_own on public.user_room_furniture for select to authenticated using (user_id = auth.uid());
grant select on public.user_room_furniture to authenticated;

/** 家具の値段（青コイン）。アプリ側の FURNITURE[id].price と同じ。知らない家具は null */
create or replace function public.room_furniture_price(p_furniture text)
returns integer
language sql
immutable
as $$
  select case p_furniture
    when 'bowl' then 30
    when 'plant' then 50
    when 'lamp' then 80
    when 'table' then 100
    when 'bookshelf' then 120
    when 'whiteboard' then 120
    when 'dog-bed' then 150
    when 'dog-house' then 200
    when 'sofa' then 250
    else null
  end;
$$;

create or replace function public.buy_room_furniture(p_furniture text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_price integer := public.room_furniture_price(p_furniture);
  v_owned integer;
  v_balance integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if v_price is null then
    raise exception using errcode = 'P0001', message = 'INVALID_FURNITURE';
  end if;

  insert into public.user_room_furniture (user_id, furniture) values (v_user_id, p_furniture) on conflict do nothing;
  select count into v_owned from public.user_room_furniture where user_id = v_user_id and furniture = p_furniture for update;
  if v_owned >= 2 then
    raise exception using errcode = 'P0001', message = 'FURNITURE_LIMIT';
  end if;

  -- 何こ目かを冪等キーにして、同じ買い物を二重に引かない（足りなければ BLUE_COINS_SHORT）
  if not public.add_blue_coin_event(
    v_user_id, 'room_furniture', -v_price,
    'room-furniture:' || p_furniture || ':' || (v_owned + 1)::text,
    jsonb_build_object('label', 'おへやの家具', 'furniture', p_furniture)
  ) then
    raise exception using errcode = 'P0001', message = 'PURCHASE_CONFLICT';
  end if;

  update public.user_room_furniture set count = v_owned + 1, updated_at = now() where user_id = v_user_id and furniture = p_furniture;
  select balance into v_balance from public.user_blue_coins where user_id = v_user_id;
  return jsonb_build_object('ok', true, 'furniture', p_furniture, 'owned', v_owned + 1, 'balance', coalesce(v_balance, 0));
end;
$$;

revoke all on function public.buy_room_furniture(text) from public, anon;
grant execute on function public.buy_room_furniture(text) to authenticated;

comment on function public.buy_room_furniture(text) is
  'わんこのおへやの家具を1こ、青コインで買う（1種類2こまで。値段は room_furniture_price）。';

-- これまで無料で置けた家具：いま部屋に置いているぶんは、持っていることにする
insert into public.user_room_furniture (user_id, furniture, count)
select r.user_id, substr(it->>'key', 11) as furniture, least(2, count(*))::integer
  from public.user_rooms r
  cross join lateral jsonb_array_elements(case when jsonb_typeof(r.layout -> 'items') = 'array' then r.layout -> 'items' else '[]'::jsonb end) it
 where it->>'key' like 'furniture:%'
   and public.room_furniture_price(substr(it->>'key', 11)) is not null
 group by r.user_id, substr(it->>'key', 11)
on conflict (user_id, furniture) do update set count = greatest(public.user_room_furniture.count, excluded.count);

commit;

notify pgrst, 'reload schema';
