-- =============================================================
-- おさんぽフレンチー（ミニゲーム04）のスコア記録・コイン報酬・フレンドランキング
-- =============================================================
-- これまではお試し版として、記録を端末（localStorage）にだけ保存していた。
-- 今回からスコアをサーバーに記録し、スコア÷50（端数切り上げ）をコインとして付与する。
-- 台帳は他のミニゲームと同じ coin_events を使い、round_id を冪等キーにして
-- 同じプレイ結果を二重に送っても増えないようにする。
-- ランキングは他のミニゲームと同じく security definer の RPC で、自分とフレンドだけを見せる。
begin;

alter table public.coin_events drop constraint if exists coin_events_event_type_check;
alter table public.coin_events add constraint coin_events_event_type_check
  check (event_type in (
    'level_up', 'steps', 'unlock', 'gacha', 'login', 'item_catch',
    'wanko_bowling', 'snack_trail', 'dambourle_gacha', 'osanpo_run'
  ));

create table if not exists public.osanpo_run_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 1プレイに1つ。二重送信しても同じ行のままにする
  round_id text not null,
  -- 歩いた道（まち・山道・雪国・夏まつり）
  stage text not null,
  score integer not null,
  meters integer not null,
  items integer not null default 0,
  played_at timestamptz not null default now(),
  constraint osanpo_run_scores_round_unique unique (user_id, round_id),
  constraint osanpo_run_scores_round_id_format check (length(round_id) between 8 and 100),
  constraint osanpo_run_scores_stage_check check (stage in ('town', 'hiking', 'snow', 'summer')),
  constraint osanpo_run_scores_score_range check (score between 0 and 10000000),
  constraint osanpo_run_scores_meters_range check (meters between 0 and 1000000),
  constraint osanpo_run_scores_items_range check (items between 0 and 1000000)
);

create index if not exists osanpo_run_scores_user_score_idx
  on public.osanpo_run_scores(user_id, score desc, played_at desc);
create index if not exists osanpo_run_scores_user_played_idx
  on public.osanpo_run_scores(user_id, played_at desc);

alter table public.osanpo_run_scores enable row level security;

-- 直接読めるのは自分の記録だけ。フレンドの分は下のランキング関数からのみ見せる。
drop policy if exists osanpo_run_scores_select_own on public.osanpo_run_scores;
create policy osanpo_run_scores_select_own on public.osanpo_run_scores
  for select to authenticated
  using (user_id = auth.uid());

grant select on public.osanpo_run_scores to authenticated;

-- -------------------------------------------------------------
-- 結果の記録とコイン付与
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
  v_coins_applied boolean;
  v_existing_amount integer;
  v_balance integer;
  v_today date := (timezone('Asia/Tokyo', now()))::date;
  -- 偽装スコアで大量に稼がれないよう、1プレイで配るコインには上限を置く（アイテムキャッチと同じ10000）
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

  select max(s.score) into v_best_score
    from public.osanpo_run_scores s
   where s.user_id = v_user_id;

  -- コインはスコア÷50の端数切り上げ。スコア記録と同じ round_id で冪等にする。
  v_coins_key := 'osanpo-run:' || p_round_id;
  v_coins := least(v_max_coins, ceil(p_score / 50.0)::integer);

  if v_coins > 0 then
    v_coins_applied := public.add_coin_event(
      v_user_id,
      'osanpo_run',
      v_coins,
      v_coins_key,
      null,
      v_today,
      jsonb_build_object(
        'label', 'おさんぽフレンチー',
        'stage', p_stage,
        'score', p_score,
        'meters', p_meters,
        'items', p_items
      )
    );

    if not v_coins_applied then
      select amount into v_existing_amount
        from public.coin_events
       where user_id = v_user_id and idempotency_key = v_coins_key;
      v_coins := coalesce(v_existing_amount, v_coins);
    end if;
  else
    v_coins := 0;
  end if;

  select balance into v_balance from public.user_coins where user_id = v_user_id;

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
  'おさんぽフレンチーの1プレイ分のスコアを記録し、スコア÷50(端数切り上げ、1プレイ10000まで)をコインとして付与する。同じ round_id は二重に記録・付与しない。';

-- -------------------------------------------------------------
-- フレンドランキング（自分＋フレンドのみ）
-- -------------------------------------------------------------
create or replace function public.get_friend_osanpo_run_ranking(
  p_period text default 'week'
)
returns table (
  rank_position integer,
  user_id uuid,
  display_name text,
  profile_image_url text,
  best_score integer,
  best_meters integer,
  best_stage text,
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
      s.user_id, s.score, s.meters, s.stage, s.played_at
    from public.osanpo_run_scores s
    join candidate_users cu on cu.candidate_user_id = s.user_id
    where v_period = 'best'
       or s.played_at >= v_week_start
    order by s.user_id, s.score desc, s.played_at asc
  ),
  ranked as (
    select
      rank() over (order by b.score desc)::integer as rank_position,
      b.user_id, b.score, b.meters, b.stage, b.played_at
    from best_per_user b
  )
  select
    r.rank_position,
    r.user_id,
    coalesce(nullif(btrim(p.display_name), ''), 'ゲスト') as display_name,
    p.profile_image_url,
    r.score as best_score,
    r.meters as best_meters,
    r.stage as best_stage,
    r.played_at,
    r.user_id = v_user_id as is_me
  from ranked r
  left join public.profiles p on p.user_id = r.user_id
  order by r.rank_position, r.played_at, r.user_id;
end;
$$;

revoke all on function public.get_friend_osanpo_run_ranking(text) from public, anon;
grant execute on function public.get_friend_osanpo_run_ranking(text) to authenticated;

comment on function public.get_friend_osanpo_run_ranking(text) is
  '認証ユーザー本人とフレンドだけのおさんぽフレンチーのベストスコア（その時の距離と道つき）。week は日本時間の月曜0時から、best は全期間。';

commit;

notify pgrst, 'reload schema';
