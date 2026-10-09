-- =============================================================
-- 赤コインの復活と、ご当地ピンボールの「自分で作るステージ」
-- =============================================================
-- 0134〜0137（ピンボール・赤コイン・青コインの報酬・マップ）の後に適用する。
-- ・赤コインをまた使う。もらえるのは、ご当地ピンボールのスコア・ホームに降ってくる赤コイン・ログイン（1日1回）だけ。
--   ピンボールの報酬は青コインから赤コインにもどす（枚数は 0136 と同じ：スコア ÷ 11875（切り捨て）・1プレイ 2400 枚まで。
--   アプリの src/lib/games/pinball/config.ts の COIN_POINTS・COIN_MAX と同じ）。
--   ホームの赤コインは 0135 と同じ（ふつう5・中レア20・高レア100。受け取りの決まりは黄色・青といっしょ）。
--   ログインは1日1回 50 枚（アプリの RED_LOGIN_COINS と同じ）。
-- ・赤コインの使いみちは、ステージの部品（pinball_part_catalog）。値段・はじめから持っている数・持てる数は、
--   アプリの src/lib/games/pinball/stage.ts（PINBALL_PARTS）と同じにする。買ったぶんは user_pinball_parts。
-- ・ステージ（pinball_stages）は1人6つまで。公開（shared）したステージは、フレンドが見て遊べる。
--   部品の置き方（すき間など）はアプリの API（validateStage）で確かめる。ここでは、データの形・持っている部品の数を確かめる。
-- ・pinball_scores に stage_id を足す。ステージのプレイは table_id = 'stage'。ステージの記録・ランキングは、
--   そのステージの置き方を最後に変えた時刻（layout_updated_at）よりあとのプレイだけを数える。
--   全部の台のフレンドランキング（get_friend_pinball_ranking）には、ステージのプレイは入れない。
begin;

do $$
begin
  if to_regprocedure('public.add_red_coin_event(uuid, text, integer, text, jsonb)') is null
     or to_regprocedure('public.add_blue_coin_event(uuid, text, integer, text, jsonb)') is null
     or to_regprocedure('public.add_coin_event(uuid, text, integer, text, integer, date, jsonb)') is null
     or to_regprocedure('public.coin_login_bonus(integer)') is null
     or to_regclass('public.pinball_scores') is null
     or to_regclass('public.friendships') is null then
    raise exception using
      errcode = 'P0001',
      message = 'PINBALL_STAGES_MISSING_DEPENDENCY',
      hint = 'フレンド（0019）・コイン（0028）・青コイン（0111・0125）・ピンボール（0134〜0137）を先に適用してください。';
  end if;
end;
$$;

-- 赤コインの台帳の種類に、ログインと部品の買い物（マイナス）を足す（いまある行は見直さない）
alter table public.red_coin_events drop constraint if exists red_coin_events_event_type_check;
alter table public.red_coin_events add constraint red_coin_events_event_type_check
  check (event_type in ('pinball', 'home_drop', 'blue_convert', 'login', 'pinball_part')) not valid;

-- -------------------------------------------------------------
-- 部品（赤コインで買う）
-- -------------------------------------------------------------
/** 部品のカタログ。アプリの PINBALL_PARTS と同じ（price＝1回の値段、pack＝1回で増える数、free＝はじめから持っている数、max_count＝持てる数） */
create or replace function public.pinball_part_catalog()
returns table (part text, price integer, pack integer, free integer, max_count integer)
language sql
immutable
set search_path = public
as $$
  values
    ('bumper'::text, 300, 1, 3, 8),
    ('pinwheel'::text, 400, 1, 1, 4),
    ('post'::text, 50, 1, 4, 16),
    ('peg'::text, 100, 10, 10, 60),
    ('sling'::text, 400, 1, 0, 4),
    ('ramp_top'::text, 1200, 1, 0, 1),
    ('ramp_cross'::text, 1800, 1, 0, 1)
$$;

grant execute on function public.pinball_part_catalog() to authenticated;

-- 買ったぶんの数（はじめから持っているぶんは入れない）
create table if not exists public.user_pinball_parts (
  user_id uuid not null references auth.users(id) on delete cascade,
  part text not null check (part ~ '^[a-z_]{1,32}$'),
  count integer not null default 0 check (count between 0 and 1000),
  updated_at timestamptz not null default now(),
  primary key (user_id, part)
);

alter table public.user_pinball_parts enable row level security;
drop policy if exists user_pinball_parts_select_own on public.user_pinball_parts;
create policy user_pinball_parts_select_own on public.user_pinball_parts for select to authenticated using (user_id = auth.uid());
grant select on public.user_pinball_parts to authenticated;

create or replace function public.buy_pinball_part(p_part text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_info record;
  v_bought integer;
  v_balance integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  select * into v_info from public.pinball_part_catalog() c where c.part = p_part;
  if not found then
    raise exception using errcode = 'P0001', message = 'INVALID_PART';
  end if;

  insert into public.user_pinball_parts (user_id, part) values (v_user_id, p_part) on conflict do nothing;
  select count into v_bought from public.user_pinball_parts where user_id = v_user_id and part = p_part for update;
  if v_info.free + v_bought + v_info.pack > v_info.max_count then
    raise exception using errcode = 'P0001', message = 'PART_LIMIT';
  end if;

  -- 何こ目までかを冪等キーにして、同じ買い物を二重に引かない（足りなければ RED_COINS_SHORT）
  if not public.add_red_coin_event(
    v_user_id, 'pinball_part', -v_info.price,
    'pinball-part:' || p_part || ':' || (v_bought + v_info.pack)::text,
    jsonb_build_object('label', 'ピンボールの部品', 'part', p_part, 'count', v_info.pack)
  ) then
    raise exception using errcode = 'P0001', message = 'PURCHASE_CONFLICT';
  end if;

  update public.user_pinball_parts
     set count = v_bought + v_info.pack, updated_at = now()
   where user_id = v_user_id and part = p_part;
  select balance into v_balance from public.user_red_coins where user_id = v_user_id;
  return jsonb_build_object('ok', true, 'part', p_part, 'owned', v_info.free + v_bought + v_info.pack, 'balance', coalesce(v_balance, 0));
end;
$$;

revoke all on function public.buy_pinball_part(text) from public, anon;
grant execute on function public.buy_pinball_part(text) to authenticated;

comment on function public.buy_pinball_part(text) is
  'ご当地ピンボールのステージの部品を赤コインで1回ぶん買う（値段・数は pinball_part_catalog。持てる数をこえると PART_LIMIT）。';

-- -------------------------------------------------------------
-- ステージ
-- -------------------------------------------------------------
create table if not exists public.pinball_stages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  -- { v: 1, look, ramp, parts: [{ kind, x, y, ... }], items: [{ x, y } × 3] }（アプリの StageSpec）
  spec jsonb not null,
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 部品の置き方・ランプ・アイテムの場所を最後に変えた時刻。これより前のプレイは、記録・ランキングに数えない
  layout_updated_at timestamptz not null default now(),
  constraint pinball_stages_name_length check (char_length(name) between 1 and 16),
  constraint pinball_stages_spec_object check (jsonb_typeof(spec) = 'object'),
  constraint pinball_stages_spec_size check (pg_column_size(spec) <= 16384)
);
create index if not exists pinball_stages_user_idx on public.pinball_stages(user_id, updated_at desc);

alter table public.pinball_stages enable row level security;

-- 自分のステージと、フレンドが公開したステージだけ見える。書きこみは下の関数からだけ
drop policy if exists pinball_stages_select_own on public.pinball_stages;
create policy pinball_stages_select_own on public.pinball_stages for select to authenticated
  using (user_id = auth.uid());
drop policy if exists pinball_stages_select_friend_shared on public.pinball_stages;
create policy pinball_stages_select_friend_shared on public.pinball_stages for select to authenticated
  using (
    shared
    and exists (select 1 from public.friendships f where f.user_id = auth.uid() and f.friend_user_id = pinball_stages.user_id)
  );

grant select on public.pinball_stages to authenticated;

/** その人がそのステージを遊べるか（自分のステージか、フレンドが公開しているステージ） */
create or replace function public.can_play_pinball_stage(p_user_id uuid, p_stage_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.pinball_stages st
     where st.id = p_stage_id
       and (st.user_id = p_user_id
            or (st.shared and exists (select 1 from public.friendships f where f.user_id = p_user_id and f.friend_user_id = st.user_id)))
  );
$$;

revoke all on function public.can_play_pinball_stage(uuid, uuid) from public, anon, authenticated;

/**
 * ステージを保存する（p_id が null なら新しく作る）。部品の置き方はアプリ（API）で確かめてから呼ぶ。
 * ここでは、データの形と、持っている部品の数をこえていないかを確かめる
 */
create or replace function public.save_pinball_stage(p_id uuid, p_name text, p_spec jsonb, p_shared boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_parts jsonb;
  v_items jsonb;
  v_count integer;
  v_row public.pinball_stages%rowtype;
  v_layout_changed boolean := true;
  r record;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if char_length(v_name) not between 1 and 16 or v_name ~ '[[:cntrl:]]' then
    raise exception using errcode = 'P0001', message = 'INVALID_NAME';
  end if;

  -- データの形
  if p_spec is null or jsonb_typeof(p_spec) <> 'object' or pg_column_size(p_spec) > 16384
     or p_spec -> 'v' is distinct from '1'::jsonb
     or coalesce(p_spec ->> 'look', '') not in ('default', 'bumper', 'pachinko', 'coaster')
     or coalesce(p_spec ->> 'ramp', '') not in ('standard', 'top', 'cross') then
    raise exception using errcode = 'P0001', message = 'INVALID_STAGE';
  end if;
  v_parts := p_spec -> 'parts';
  v_items := p_spec -> 'items';
  if jsonb_typeof(v_parts) is distinct from 'array' or jsonb_array_length(v_parts) > 120
     or jsonb_typeof(v_items) is distinct from 'array' or jsonb_array_length(v_items) <> 3 then
    raise exception using errcode = 'P0001', message = 'INVALID_STAGE';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_parts) e
     where jsonb_typeof(e) <> 'object'
        or coalesce(e ->> 'kind', '') not in ('bumper', 'pinwheel', 'post', 'peg', 'sling')
        or jsonb_typeof(e -> 'x') is distinct from 'number' or jsonb_typeof(e -> 'y') is distinct from 'number'
        or (e ->> 'x')::numeric not between 0 and 480 or (e ->> 'y')::numeric not between 0 and 1000
  ) or exists (
    select 1 from jsonb_array_elements(v_items) e
     where jsonb_typeof(e) <> 'object'
        or jsonb_typeof(e -> 'x') is distinct from 'number' or jsonb_typeof(e -> 'y') is distinct from 'number'
        or (e ->> 'x')::numeric not between 0 and 480 or (e ->> 'y')::numeric not between 0 and 1000
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_STAGE';
  end if;

  -- 持っている部品（はじめのぶん＋買ったぶん）をこえていないか
  for r in
    select c.part,
           least(c.max_count, c.free + coalesce(u.count, 0)) as owned,
           case c.part
             when 'ramp_top' then (case when p_spec ->> 'ramp' = 'top' then 1 else 0 end)
             when 'ramp_cross' then (case when p_spec ->> 'ramp' = 'cross' then 1 else 0 end)
             else (select count(*)::integer from jsonb_array_elements(v_parts) e where e ->> 'kind' = c.part)
           end as used
      from public.pinball_part_catalog() c
      left join public.user_pinball_parts u on u.user_id = v_user_id and u.part = c.part
  loop
    if r.used > r.owned then
      raise exception using errcode = 'P0001', message = 'PARTS_SHORT', detail = r.part;
    end if;
  end loop;

  if p_id is null then
    -- 新しいステージ（1人6つまで。同じ人が同時に作っても数をこえないように）
    perform pg_advisory_xact_lock(hashtext('pinball_stage:' || v_user_id::text));
    select count(*) into v_count from public.pinball_stages where user_id = v_user_id;
    if v_count >= 6 then
      raise exception using errcode = 'P0001', message = 'STAGE_LIMIT';
    end if;
    insert into public.pinball_stages (user_id, name, spec, shared)
    values (v_user_id, v_name, p_spec, coalesce(p_shared, false))
    returning * into v_row;
  else
    select * into v_row from public.pinball_stages where id = p_id and user_id = v_user_id for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'STAGE_NOT_FOUND';
    end if;
    -- 名前・見た目・公開だけを変えたときは、記録を消さない
    v_layout_changed := (v_row.spec -> 'parts') is distinct from v_parts
      or (v_row.spec -> 'items') is distinct from v_items
      or (v_row.spec ->> 'ramp') is distinct from (p_spec ->> 'ramp');
    update public.pinball_stages
       set name = v_name,
           spec = p_spec,
           shared = coalesce(p_shared, false),
           updated_at = now(),
           -- clock_timestamp：同じトランザクションの中で記録したプレイ（played_at = now()）より、かならずあとにする
           layout_updated_at = case when v_layout_changed then clock_timestamp() else layout_updated_at end
     where id = p_id
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'name', v_row.name,
    'shared', v_row.shared,
    'layout_changed', v_layout_changed,
    'updated_at', v_row.updated_at,
    'layout_updated_at', v_row.layout_updated_at
  );
end;
$$;

revoke all on function public.save_pinball_stage(uuid, text, jsonb, boolean) from public, anon;
grant execute on function public.save_pinball_stage(uuid, text, jsonb, boolean) to authenticated;

comment on function public.save_pinball_stage(uuid, text, jsonb, boolean) is
  'ご当地ピンボールのステージを保存する（p_id が null なら新しく作る。1人6つまで）。持っている部品をこえると PARTS_SHORT。';

create or replace function public.delete_pinball_stage(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  delete from public.pinball_stages where id = p_id and user_id = v_user_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'STAGE_NOT_FOUND';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.delete_pinball_stage(uuid) from public, anon;
grant execute on function public.delete_pinball_stage(uuid) to authenticated;

-- -------------------------------------------------------------
-- 記録にステージを足す
-- -------------------------------------------------------------
alter table public.pinball_scores
  add column if not exists stage_id uuid references public.pinball_stages(id) on delete set null;
create index if not exists pinball_scores_stage_score_idx on public.pinball_scores(stage_id, score desc) where stage_id is not null;

-- -------------------------------------------------------------
-- 結果の記録と赤コインの付与（0137 のものに、ステージと赤コインを足す）
-- -------------------------------------------------------------
-- 引数がふえるので、前の関数は消して作りなおす（p_stage_id は省ける。マップのプレイは前と同じ呼び方でよい）
drop function if exists public.record_pinball_result(text, text, integer, integer, integer, integer, integer, integer);

create or replace function public.record_pinball_result(
  p_round_id text,
  p_table text,
  p_score integer,
  p_duration_ms integer,
  p_items integer,
  p_conquests integer,
  p_jackpots integer,
  p_max_combo integer,
  p_stage_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_applied boolean := false;
  v_prev_best integer;
  v_best integer;
  v_coins integer;
  v_balance integer;
  v_recent integer;
  v_stage public.pinball_stages%rowtype;
  v_since timestamptz := '-infinity';
  -- アプリ側の COIN_POINTS / COIN_MAX と同じ
  v_points_per_coin constant integer := 11875;
  v_max_coins constant integer := 2400;
  -- 1秒あたりにとれる得点の上限の目安（MAX_SCORE_PER_SECOND と同じ）
  v_max_per_second constant integer := 400000;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_round_id is null or length(p_round_id) not between 8 and 100 then
    raise exception using errcode = 'P0001', message = 'INVALID_ROUND_ID';
  end if;
  -- 台はマップの id（英小文字ではじまる、英小文字・数字・_ の32文字まで）。ステージのプレイは 'stage' とステージの番号
  if p_table is null or p_table !~ '^[a-z][a-z0-9_]{0,31}$' or ((p_table = 'stage') <> (p_stage_id is not null)) then
    raise exception using errcode = 'P0001', message = 'INVALID_TABLE';
  end if;
  if p_score is null or p_score < 0 or p_score > 200000000 then
    raise exception using errcode = 'P0001', message = 'INVALID_SCORE';
  end if;
  if p_duration_ms is null or p_duration_ms < 0 or p_duration_ms > 10800000 then
    raise exception using errcode = 'P0001', message = 'INVALID_DURATION';
  end if;
  -- 遊んだ時間のわりに大きすぎるスコアは受けつけない（はじめの30秒ぶんは余裕をみる）
  if p_score::bigint > ((p_duration_ms::bigint / 1000) + 30) * v_max_per_second then
    raise exception using errcode = 'P0001', message = 'INVALID_SCORE';
  end if;
  if p_items is null or p_items not between 0 and 10000
     or p_conquests is null or p_conquests not between 0 and 1000
     or p_jackpots is null or p_jackpots not between 0 and 10000
     or p_max_combo is null or p_max_combo not between 0 and 100 then
    raise exception using errcode = 'P0001', message = 'INVALID_COUNTS';
  end if;

  -- 同じ round_id の再送は、下で前と同じ結果を返す
  if not exists (select 1 from public.pinball_scores s where s.user_id = v_user_id and s.round_id = p_round_id) then
    -- ステージは、自分のものか、フレンドが公開しているものだけ
    if p_stage_id is not null and not public.can_play_pinball_stage(v_user_id, p_stage_id) then
      raise exception using errcode = 'P0001', message = 'STAGE_NOT_FOUND';
    end if;
    -- 新しいプレイは1時間に40回まで（API の制限と同じ。関数を直接呼んで赤コインをかせがれないように）
    select count(*) into v_recent
      from public.pinball_scores s
     where s.user_id = v_user_id and s.played_at > now() - interval '1 hour';
    if v_recent >= 40 then
      raise exception using errcode = 'P0001', message = 'TOO_MANY_ROUNDS';
    end if;
  end if;

  if p_stage_id is not null then
    select * into v_stage from public.pinball_stages where id = p_stage_id;
    v_since := coalesce(v_stage.layout_updated_at, '-infinity');
  end if;

  -- ベストは台ごと（ステージはステージごと。置き方を変える前のプレイは数えない）
  select max(s.score) into v_prev_best
    from public.pinball_scores s
   where s.user_id = v_user_id
     and (case when p_stage_id is null then s.table_id = p_table else s.stage_id = p_stage_id and s.played_at >= v_since end);

  v_coins := least(v_max_coins, floor(p_score / v_points_per_coin::numeric)::integer);

  insert into public.pinball_scores (user_id, round_id, table_id, stage_id, score, duration_ms, items, conquests, jackpots, max_combo, coins)
  values (v_user_id, p_round_id, p_table, p_stage_id, p_score, p_duration_ms, p_items, p_conquests, p_jackpots, p_max_combo, v_coins)
  on conflict (user_id, round_id) do nothing;
  v_applied := found;

  if v_applied then
    if v_coins > 0 then
      perform public.add_red_coin_event(
        v_user_id,
        'pinball',
        v_coins,
        'pinball:' || p_round_id,
        jsonb_build_object('label', 'ご当地ピンボール', 'table', p_table, 'stage', v_stage.name, 'score', p_score, 'items', p_items, 'conquests', p_conquests)
      );
    end if;
  else
    -- 再送：1回目に付けた枚数を返す
    select s.coins into v_coins
      from public.pinball_scores s
     where s.user_id = v_user_id and s.round_id = p_round_id;
  end if;

  select max(s.score) into v_best
    from public.pinball_scores s
   where s.user_id = v_user_id
     and (case when p_stage_id is null then s.table_id = p_table else s.stage_id = p_stage_id and s.played_at >= v_since end);

  select balance into v_balance from public.user_red_coins where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'applied', v_applied,
    'kind', 'red',
    'coins', greatest(coalesce(v_coins, 0), 0),
    'balance', coalesce(v_balance, 0),
    'best', coalesce(v_best, 0),
    'is_best', v_applied and p_score > coalesce(v_prev_best, -1) and p_score > 0
  );
end;
$$;

revoke all on function public.record_pinball_result(text, text, integer, integer, integer, integer, integer, integer, uuid) from public, anon;
grant execute on function public.record_pinball_result(text, text, integer, integer, integer, integer, integer, integer, uuid) to authenticated;

comment on function public.record_pinball_result(text, text, integer, integer, integer, integer, integer, integer, uuid) is
  'ご当地ピンボールの1プレイ（マップかステージ）を記録し、スコア÷11875（切り捨て、1プレイ2400まで）を赤コインとして付与する。同じ round_id は二重に記録・付与しない。';

-- -------------------------------------------------------------
-- フレンドランキング（全部の台まとめて。ステージのプレイは入れない）
-- -------------------------------------------------------------
create or replace function public.get_friend_pinball_ranking(
  p_period text default 'week'
)
returns table (
  rank_position integer,
  user_id uuid,
  display_name text,
  profile_image_url text,
  best_score integer,
  best_table text,
  played_at timestamptz,
  is_me boolean
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_period text := lower(coalesce(p_period, 'week'));
  v_week_start timestamptz :=
    date_trunc('week', timezone('Asia/Tokyo', now())) at time zone 'Asia/Tokyo';
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if v_period not in ('week', 'best') then
    raise exception using errcode = 'P0001', message = 'INVALID_RANKING_PERIOD';
  end if;

  return query
  with candidate_users as (
    select v_user_id as candidate_user_id
    union
    select f.friend_user_id
      from public.friendships f
     where f.user_id = v_user_id
  ),
  -- 期間内で一番スコアの高いプレイ（同点なら先に出したほう）を1人1つ選ぶ（ステージのプレイはのぞく）
  best_per_user as (
    select distinct on (s.user_id)
      s.user_id, s.score, s.table_id, s.played_at
    from public.pinball_scores s
    join candidate_users cu on cu.candidate_user_id = s.user_id
    where s.table_id <> 'stage'
      and (v_period = 'best' or s.played_at >= v_week_start)
    order by s.user_id, s.score desc, s.played_at asc
  ),
  ranked as (
    select
      rank() over (order by b.score desc)::integer as rank_position,
      b.user_id, b.score, b.table_id, b.played_at
    from best_per_user b
  )
  select
    r.rank_position,
    r.user_id,
    coalesce(nullif(btrim(p.display_name), ''), 'ゲスト') as display_name,
    p.profile_image_url,
    r.score as best_score,
    r.table_id as best_table,
    r.played_at,
    r.user_id = v_user_id as is_me
  from ranked r
  left join public.profiles p on p.user_id = r.user_id
  order by r.rank_position, r.played_at, r.user_id;
end;
$$;

revoke all on function public.get_friend_pinball_ranking(text) from public, anon;
grant execute on function public.get_friend_pinball_ranking(text) to authenticated;

comment on function public.get_friend_pinball_ranking(text) is
  '認証ユーザー本人とフレンドだけのご当地ピンボールのベストスコア（その時の台つき。自分で作るステージのプレイはのぞく）。week は日本時間の月曜0時から、best は全期間。';

-- -------------------------------------------------------------
-- 見られるステージの一覧（自分のもの＋フレンドが公開したもの）
-- -------------------------------------------------------------
create or replace function public.get_pinball_stages()
returns table (
  id uuid,
  user_id uuid,
  owner_name text,
  owner_image_url text,
  name text,
  spec jsonb,
  shared boolean,
  updated_at timestamptz,
  layout_updated_at timestamptz,
  is_mine boolean,
  my_best integer,
  top_score integer,
  top_name text,
  plays integer
)
language sql
security definer
stable
set search_path = public
as $$
  with me as (
    select auth.uid() as uid
  ),
  -- 自分とフレンド（いちばんのスコアは、知っている人の中だけで出す）
  people as (
    select uid from me
    union
    select f.friend_user_id from public.friendships f, me where f.user_id = me.uid
  ),
  visible as (
    select st.*
      from public.pinball_stages st, me
     where st.user_id = me.uid
        or (st.shared and exists (select 1 from public.friendships f where f.user_id = me.uid and f.friend_user_id = st.user_id))
  )
  select
    v.id,
    v.user_id,
    coalesce(nullif(btrim(p.display_name), ''), 'フレンド') as owner_name,
    p.profile_image_url as owner_image_url,
    v.name,
    v.spec,
    v.shared,
    v.updated_at,
    v.layout_updated_at,
    v.user_id = me.uid as is_mine,
    (select max(s.score) from public.pinball_scores s
      where s.stage_id = v.id and s.user_id = me.uid and s.played_at >= v.layout_updated_at) as my_best,
    top.score as top_score,
    top.name as top_name,
    -- 作った人のほかに、遊ばれた回数
    (select count(*)::integer from public.pinball_scores s where s.stage_id = v.id and s.user_id <> v.user_id) as plays
  from visible v
  cross join me
  left join public.profiles p on p.user_id = v.user_id
  left join lateral (
    select s.score, coalesce(nullif(btrim(pp.display_name), ''), 'ゲスト') as name
      from public.pinball_scores s
      join people pe on pe.uid = s.user_id
      left join public.profiles pp on pp.user_id = s.user_id
     where s.stage_id = v.id and s.played_at >= v.layout_updated_at
     order by s.score desc, s.played_at asc
     limit 1
  ) top on true
  where me.uid is not null
  order by (v.user_id = me.uid) desc, v.updated_at desc
  limit 60;
$$;

revoke all on function public.get_pinball_stages() from public, anon;
grant execute on function public.get_pinball_stages() to authenticated;

comment on function public.get_pinball_stages() is
  '自分のステージと、フレンドが公開したご当地ピンボールのステージ（自分のベスト・自分とフレンドの中のいちばん・遊ばれた回数つき）。';

-- -------------------------------------------------------------
-- ステージごとのランキング（自分とフレンドだけ・置き方を変えたあとのプレイ）
-- -------------------------------------------------------------
create or replace function public.get_pinball_stage_ranking(p_stage_id uuid)
returns table (
  rank_position integer,
  user_id uuid,
  display_name text,
  profile_image_url text,
  best_score integer,
  played_at timestamptz,
  is_me boolean
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_since timestamptz;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not public.can_play_pinball_stage(v_user_id, p_stage_id) then
    raise exception using errcode = 'P0001', message = 'STAGE_NOT_FOUND';
  end if;
  select layout_updated_at into v_since from public.pinball_stages where id = p_stage_id;

  return query
  with candidate_users as (
    select v_user_id as candidate_user_id
    union
    select f.friend_user_id from public.friendships f where f.user_id = v_user_id
  ),
  best_per_user as (
    select distinct on (s.user_id) s.user_id, s.score, s.played_at
      from public.pinball_scores s
      join candidate_users cu on cu.candidate_user_id = s.user_id
     where s.stage_id = p_stage_id and s.played_at >= v_since
     order by s.user_id, s.score desc, s.played_at asc
  ),
  ranked as (
    select rank() over (order by b.score desc)::integer as rank_position, b.user_id, b.score, b.played_at
      from best_per_user b
  )
  select
    r.rank_position,
    r.user_id,
    coalesce(nullif(btrim(p.display_name), ''), 'ゲスト') as display_name,
    p.profile_image_url,
    r.score as best_score,
    r.played_at,
    r.user_id = v_user_id as is_me
  from ranked r
  left join public.profiles p on p.user_id = r.user_id
  order by r.rank_position, r.played_at, r.user_id
  limit 50;
end;
$$;

revoke all on function public.get_pinball_stage_ranking(uuid) from public, anon;
grant execute on function public.get_pinball_stage_ranking(uuid) to authenticated;

-- -------------------------------------------------------------
-- ホームの降ってくるコイン：赤コインをもどす（0135 と同じ）
-- -------------------------------------------------------------
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

-- -------------------------------------------------------------
-- ログインボーナス（0125 のものに、毎日の赤コイン 50 枚を足す）
-- -------------------------------------------------------------
create or replace function public.claim_login_bonus()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (timezone('Asia/Tokyo', now()))::date;
  v_prior_days integer := 0;
  v_streak_day integer;
  v_next_day integer;
  v_amount integer;
  v_event_id uuid;
  v_balance integer;
  v_blue_amount integer := 0;
  v_red_amount integer := 0;
  v_red_balance integer;
  v_total_days integer := 0;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  -- きのうまでに開いた日の合計（通算）。休んでも1日目へは戻らず、7日ごとにひとまわりする
  select count(*)::integer into v_prior_days
    from public.coin_events
   where user_id = v_user_id
     and event_type = 'login'
     and event_date < v_today;

  v_streak_day := (v_prior_days % 7) + 1;
  v_next_day := (v_streak_day % 7) + 1;
  v_amount := public.coin_login_bonus(v_streak_day);

  insert into public.coin_events (
    user_id, event_type, amount, idempotency_key, event_date, metadata
  ) values (
    v_user_id, 'login', v_amount, 'login:' || v_today::text, v_today,
    jsonb_build_object('label', 'ログインボーナス', 'streak_day', v_streak_day)
  )
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_event_id;

  -- 通算のログイン日数（きょうを入れて）。7日ごとに青コインもいっしょに
  v_total_days := v_prior_days + 1;

  if v_event_id is not null and v_total_days > 0 and v_total_days % 7 = 0 then
    if public.add_blue_coin_event(
      v_user_id, 'login_total', 400,
      'login-total:' || v_total_days::text,
      jsonb_build_object('label', '通算' || v_total_days::text || '日ログイン', 'total_days', v_total_days)
    ) then
      v_blue_amount := 400;
    end if;
  end if;

  -- 毎日の赤コイン（ご当地ピンボールのステージの部品に使う）
  if v_event_id is not null then
    if public.add_red_coin_event(
      v_user_id, 'login', 50,
      'login:' || v_today::text,
      jsonb_build_object('label', 'ログインボーナス', 'date', v_today)
    ) then
      v_red_amount := 50;
    end if;
  end if;

  select balance into v_balance from public.user_coins where user_id = v_user_id;
  select balance into v_red_balance from public.user_red_coins where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'granted', v_event_id is not null,
    'amount', case when v_event_id is not null then v_amount else 0 end,
    'balance', coalesce(v_balance, 0),
    'date', v_today,
    'streak_day', v_streak_day,
    'next_amount', public.coin_login_bonus(v_next_day),
    'blue_amount', v_blue_amount,
    'red_amount', v_red_amount,
    'red_balance', coalesce(v_red_balance, 0),
    'total_days', v_total_days
  );
end;
$$;

grant execute on function public.claim_login_bonus() to authenticated;

commit;

notify pgrst, 'reload schema';
