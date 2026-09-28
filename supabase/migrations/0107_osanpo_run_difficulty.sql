-- =============================================================
-- おさんぽフレンチー：難易度（やさしい・ふつう・むずかしい）
-- =============================================================
-- 難易度ごとに出てくる障害物が変わるので、スコアとフレンドランキングも難易度ごとに分ける。
-- コインは難易度ごとに割る数を変える（やさしい÷60・ふつう÷40・むずかしい÷30、端数切り上げ）。
-- 割る数はアプリ側の OSANPO_RUN_DIFFICULTIES（src/lib/games/osanpo-run/config.ts）と同じ値。
--
-- これまでの記録は、すべての障害物が出ていたので「むずかしい」の記録として扱う。
begin;

alter table public.osanpo_run_scores
  add column if not exists difficulty text not null default 'hard';

alter table public.osanpo_run_scores drop constraint if exists osanpo_run_scores_difficulty_check;
alter table public.osanpo_run_scores add constraint osanpo_run_scores_difficulty_check
  check (difficulty in ('easy', 'normal', 'hard'));

create index if not exists osanpo_run_scores_difficulty_score_idx
  on public.osanpo_run_scores(difficulty, user_id, score desc, played_at asc);

-- -------------------------------------------------------------
-- 結果の記録とコイン付与（難易度つき）
-- -------------------------------------------------------------
-- 引数が変わるので古い版は消す（残すと÷50のままのコインを受け取れてしまう）
drop function if exists public.record_osanpo_run_result(text, text, integer, integer, integer);

create or replace function public.record_osanpo_run_result(
  p_round_id text,
  p_stage text,
  p_difficulty text,
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
  v_divisor integer;
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
  v_divisor := case p_difficulty when 'easy' then 60 when 'normal' then 40 when 'hard' then 30 end;
  if v_divisor is null then
    raise exception using errcode = 'P0001', message = 'INVALID_DIFFICULTY';
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

  insert into public.osanpo_run_scores (user_id, round_id, stage, difficulty, score, meters, items)
  values (v_user_id, p_round_id, p_stage, p_difficulty, p_score, p_meters, p_items)
  on conflict (user_id, round_id) do nothing;

  v_applied := found;

  select max(s.score) into v_best_score
    from public.osanpo_run_scores s
   where s.user_id = v_user_id
     and s.difficulty = p_difficulty;

  -- コインはスコア÷難易度ごとの数の端数切り上げ。スコア記録と同じ round_id で冪等にする。
  v_coins_key := 'osanpo-run:' || p_round_id;
  v_coins := least(v_max_coins, ceil(p_score / v_divisor::numeric)::integer);

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
        'difficulty', p_difficulty,
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

revoke all on function public.record_osanpo_run_result(text, text, text, integer, integer, integer) from public, anon;
grant execute on function public.record_osanpo_run_result(text, text, text, integer, integer, integer) to authenticated;

comment on function public.record_osanpo_run_result(text, text, text, integer, integer, integer) is
  'おさんぽフレンチーの1プレイ分のスコアを難易度つきで記録し、スコア÷(やさしい60・ふつう40・むずかしい30)(端数切り上げ、1プレイ10000まで)をコインとして付与する。同じ round_id は二重に記録・付与しない。';

-- -------------------------------------------------------------
-- フレンドランキング（自分＋フレンドのみ・難易度ごと）
-- -------------------------------------------------------------
drop function if exists public.get_friend_osanpo_run_ranking(text);

create or replace function public.get_friend_osanpo_run_ranking(
  p_period text default 'week',
  p_difficulty text default 'normal'
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
  v_difficulty text := lower(coalesce(p_difficulty, 'normal'));
  v_week_start timestamptz :=
    date_trunc('week', timezone('Asia/Tokyo', now())) at time zone 'Asia/Tokyo';
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if v_period not in ('week', 'best') then
    raise exception using errcode = 'P0001', message = 'INVALID_RANKING_PERIOD';
  end if;

  if v_difficulty not in ('easy', 'normal', 'hard') then
    raise exception using errcode = 'P0001', message = 'INVALID_DIFFICULTY';
  end if;

  return query
  with candidate_users as (
    select v_user_id as candidate_user_id
    union
    select f.friend_user_id
      from public.friendships f
     where f.user_id = v_user_id
  ),
  -- 期間内・その難易度で一番スコアの高いプレイ（同点なら先に出したほう）を1人1つ選ぶ
  best_per_user as (
    select distinct on (s.user_id)
      s.user_id, s.score, s.meters, s.stage, s.played_at
    from public.osanpo_run_scores s
    join candidate_users cu on cu.candidate_user_id = s.user_id
    where s.difficulty = v_difficulty
      and (v_period = 'best' or s.played_at >= v_week_start)
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

revoke all on function public.get_friend_osanpo_run_ranking(text, text) from public, anon;
grant execute on function public.get_friend_osanpo_run_ranking(text, text) to authenticated;

comment on function public.get_friend_osanpo_run_ranking(text, text) is
  '認証ユーザー本人とフレンドだけのおさんぽフレンチーのベストスコア（その時の距離と道つき）を難易度ごとに返す。week は日本時間の月曜0時から、best は全期間。';

commit;

notify pgrst, 'reload schema';
