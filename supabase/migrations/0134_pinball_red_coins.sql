-- =============================================================
-- ご当地ピンボール（ミニゲーム05）と、赤コイン
-- =============================================================
-- ・赤コインは、ご当地ピンボールのスコアでもらえる新しいコイン。いまは「ためるだけ」（使い道はあとで決める）。
--   残高は user_red_coins、台帳は red_coin_events（冪等キーつき。青コインと同じつくり）。
-- ・1プレイの記録は pinball_scores（round_id で二重に記録しない）。台は 'default'（いつもの台）か都道府県コード。
-- ・赤コインは スコア ÷ 9500（切り捨て）、1プレイ 3000 まで。アプリ側の src/lib/games/pinball/config.ts
--   （RED_COIN_POINTS・RED_COIN_MAX）と同じにする。
-- ・ランキングは自分とフレンドだけ（ほかのミニゲームと同じ）。全部の台まとめて、ベストを出した台もいっしょに返す。
begin;

-- -------------------------------------------------------------
-- 赤コインの残高と台帳
-- -------------------------------------------------------------
create table if not exists public.user_red_coins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  total_earned integer not null default 0 check (total_earned >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.red_coin_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('pinball')),
  amount integer not null check (amount <> 0),
  idempotency_key text not null check (length(idempotency_key) between 1 and 200),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint red_coin_events_key_unique unique (user_id, idempotency_key)
);
create index if not exists red_coin_events_user_created_idx on public.red_coin_events(user_id, created_at desc);

alter table public.user_red_coins enable row level security;
alter table public.red_coin_events enable row level security;

drop policy if exists user_red_coins_select_own on public.user_red_coins;
create policy user_red_coins_select_own on public.user_red_coins for select to authenticated using (user_id = auth.uid());
drop policy if exists red_coin_events_select_own on public.red_coin_events;
create policy red_coin_events_select_own on public.red_coin_events for select to authenticated using (user_id = auth.uid());

grant select on public.user_red_coins to authenticated;
grant select on public.red_coin_events to authenticated;

/**
 * 赤コインを増やす・減らす（同じ冪等キーは1回だけ）。減らすときに足りなければ RED_COINS_SHORT。
 * 呼べるのは、この台帳を使う security definer の関数だけ。
 */
create or replace function public.add_red_coin_event(
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

  insert into public.user_red_coins (user_id) values (p_user_id) on conflict (user_id) do nothing;
  -- 同じ人の残高を同時に動かさない
  select balance into v_balance from public.user_red_coins where user_id = p_user_id for update;

  if p_amount < 0 and v_balance + p_amount < 0 then
    raise exception using errcode = 'P0001', message = 'RED_COINS_SHORT';
  end if;

  insert into public.red_coin_events (user_id, event_type, amount, idempotency_key, metadata)
  values (p_user_id, p_event_type, p_amount, p_key, coalesce(p_metadata, '{}'::jsonb))
  on conflict (user_id, idempotency_key) do nothing;
  if not found then
    return false;
  end if;

  update public.user_red_coins
     set balance = balance + p_amount,
         total_earned = total_earned + greatest(p_amount, 0),
         updated_at = now()
   where user_id = p_user_id;
  return true;
end;
$$;

revoke all on function public.add_red_coin_event(uuid, text, integer, text, jsonb) from public, anon, authenticated;

-- -------------------------------------------------------------
-- ご当地ピンボールの記録
-- -------------------------------------------------------------
create table if not exists public.pinball_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 1プレイに1つ。二重送信しても同じ行のままにする
  round_id text not null,
  -- 'default'（いつもの台）か、都道府県コード（'21' = 岐阜県）
  table_id text not null,
  score integer not null,
  duration_ms integer not null,
  items integer not null default 0,
  conquests integer not null default 0,
  jackpots integer not null default 0,
  max_combo integer not null default 0,
  coins integer not null default 0,
  played_at timestamptz not null default now(),
  constraint pinball_scores_round_unique unique (user_id, round_id),
  constraint pinball_scores_round_id_format check (length(round_id) between 8 and 100),
  constraint pinball_scores_table_format check (table_id = 'default' or table_id ~ '^[0-9]{2}$'),
  constraint pinball_scores_score_range check (score between 0 and 200000000),
  constraint pinball_scores_duration_range check (duration_ms between 0 and 10800000),
  constraint pinball_scores_counts_range check (
    items between 0 and 10000 and conquests between 0 and 1000 and jackpots between 0 and 10000 and max_combo between 0 and 100
  ),
  constraint pinball_scores_coins_range check (coins between 0 and 3000)
);

create index if not exists pinball_scores_user_score_idx on public.pinball_scores(user_id, score desc, played_at desc);
create index if not exists pinball_scores_user_table_idx on public.pinball_scores(user_id, table_id, score desc);
create index if not exists pinball_scores_user_played_idx on public.pinball_scores(user_id, played_at desc);

alter table public.pinball_scores enable row level security;

-- 直接読めるのは自分の記録だけ。フレンドの分は下のランキング関数からのみ見せる。
drop policy if exists pinball_scores_select_own on public.pinball_scores;
create policy pinball_scores_select_own on public.pinball_scores
  for select to authenticated
  using (user_id = auth.uid());

grant select on public.pinball_scores to authenticated;

-- -------------------------------------------------------------
-- 結果の記録と赤コインの付与
-- -------------------------------------------------------------
create or replace function public.record_pinball_result(
  p_round_id text,
  p_table text,
  p_score integer,
  p_duration_ms integer,
  p_items integer,
  p_conquests integer,
  p_jackpots integer,
  p_max_combo integer
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
  v_coins_key text;
  v_existing_amount integer;
  v_balance integer;
  v_recent integer;
  -- アプリ側の RED_COIN_POINTS / RED_COIN_MAX と同じ
  v_points_per_coin constant integer := 9500;
  v_max_coins constant integer := 3000;
  -- 1秒あたりにとれる得点の上限の目安（MAX_SCORE_PER_SECOND と同じ）
  v_max_per_second constant integer := 400000;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_round_id is null or length(p_round_id) not between 8 and 100 then
    raise exception using errcode = 'P0001', message = 'INVALID_ROUND_ID';
  end if;
  if p_table is null or not (p_table = 'default' or p_table ~ '^[0-9]{2}$') then
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

  -- 新しいプレイは1時間に40回まで（API の制限と同じ。関数を直接呼んで赤コインをかせがれないように）。
  -- 同じ round_id の再送は、下で前と同じ結果を返すのでそのまま通す
  if not exists (select 1 from public.pinball_scores s where s.user_id = v_user_id and s.round_id = p_round_id) then
    select count(*) into v_recent
      from public.pinball_scores s
     where s.user_id = v_user_id and s.played_at > now() - interval '1 hour';
    if v_recent >= 40 then
      raise exception using errcode = 'P0001', message = 'TOO_MANY_ROUNDS';
    end if;
  end if;

  select max(s.score) into v_prev_best
    from public.pinball_scores s
   where s.user_id = v_user_id and s.table_id = p_table;

  v_coins := least(v_max_coins, floor(p_score / v_points_per_coin::numeric)::integer);

  insert into public.pinball_scores (user_id, round_id, table_id, score, duration_ms, items, conquests, jackpots, max_combo, coins)
  values (v_user_id, p_round_id, p_table, p_score, p_duration_ms, p_items, p_conquests, p_jackpots, p_max_combo, v_coins)
  on conflict (user_id, round_id) do nothing;
  v_applied := found;

  select max(s.score) into v_best
    from public.pinball_scores s
   where s.user_id = v_user_id and s.table_id = p_table;

  v_coins_key := 'pinball:' || p_round_id;
  if v_coins > 0 then
    if not public.add_red_coin_event(
      v_user_id,
      'pinball',
      v_coins,
      v_coins_key,
      jsonb_build_object('label', 'ご当地ピンボール', 'table', p_table, 'score', p_score, 'items', p_items, 'conquests', p_conquests)
    ) then
      -- 再送：1回目に付けた枚数を返す
      select amount into v_existing_amount
        from public.red_coin_events
       where user_id = v_user_id and idempotency_key = v_coins_key;
      v_coins := coalesce(v_existing_amount, 0);
    end if;
  end if;

  select balance into v_balance from public.user_red_coins where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'applied', v_applied,
    'coins', greatest(v_coins, 0),
    'balance', coalesce(v_balance, 0),
    'best', coalesce(v_best, 0),
    'is_best', v_applied and p_score > coalesce(v_prev_best, -1) and p_score > 0
  );
end;
$$;

revoke all on function public.record_pinball_result(text, text, integer, integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.record_pinball_result(text, text, integer, integer, integer, integer, integer, integer) to authenticated;

comment on function public.record_pinball_result(text, text, integer, integer, integer, integer, integer, integer) is
  'ご当地ピンボールの1プレイを記録し、スコア÷9500（切り捨て、1プレイ3000まで）を赤コインとして付与する。同じ round_id は二重に記録・付与しない。';

-- -------------------------------------------------------------
-- フレンドランキング（自分＋フレンドのみ・全部の台まとめて）
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
  -- 期間内で一番スコアの高いプレイ（同点なら先に出したほう）を1人1つ選ぶ
  best_per_user as (
    select distinct on (s.user_id)
      s.user_id, s.score, s.table_id, s.played_at
    from public.pinball_scores s
    join candidate_users cu on cu.candidate_user_id = s.user_id
    where v_period = 'best'
       or s.played_at >= v_week_start
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
  '認証ユーザー本人とフレンドだけのご当地ピンボールのベストスコア（その時の台つき）。week は日本時間の月曜0時から、best は全期間。';

commit;

notify pgrst, 'reload schema';
