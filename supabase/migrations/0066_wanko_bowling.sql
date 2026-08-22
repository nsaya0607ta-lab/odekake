-- =============================================================
-- わんこボウリング（5フレーム制ミニゲーム）
-- =============================================================
-- アイテムキャッチと同じ方針で、新しい結果テーブルは作らず coin_events を台帳として使う。
-- 1ラウンド = 5フレームで理論上の満点は150点（BOWLING_PERFECT_SCORE と一致させること）。

alter table public.coin_events drop constraint if exists coin_events_event_type_check;
alter table public.coin_events add constraint coin_events_event_type_check
  check (event_type in ('level_up', 'steps', 'unlock', 'gacha', 'login', 'item_catch', 'wanko_bowling'));

-- -------------------------------------------------------------
-- 結果の記録・コイン付与
-- -------------------------------------------------------------
create or replace function public.record_wanko_bowling_result(
  p_round_id text,
  p_score integer,
  p_strike_count integer,
  p_spare_count integer,
  p_gutter_count integer,
  p_frame_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_key text;
  v_reward integer;
  v_applied boolean;
  v_existing_amount integer;
  v_balance integer;
  v_today date := (timezone('Asia/Tokyo', now()))::date;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_round_id is null or length(p_round_id) not between 8 and 100 then raise exception 'Invalid round id'; end if;
  if p_frame_count <> 5 then raise exception 'Round was not completed'; end if;
  if p_score is null or p_score < 0 or p_score > 150 then raise exception 'Invalid score'; end if;
  if p_strike_count is null or p_strike_count < 0 or p_strike_count > 7 then raise exception 'Invalid strike count'; end if;
  if p_spare_count is null or p_spare_count < 0 or p_spare_count > 5 then raise exception 'Invalid spare count'; end if;
  if p_gutter_count is null or p_gutter_count < 0 or p_gutter_count > 15 then raise exception 'Invalid gutter count'; end if;

  v_key := 'wanko-bowling:' || p_round_id;
  v_reward := greatest(1, p_score / 5);

  v_applied := public.add_coin_event(
    v_user_id,
    'wanko_bowling',
    v_reward,
    v_key,
    null,
    v_today,
    jsonb_build_object(
      'label', 'わんこボウリング',
      'score', p_score,
      'strike_count', p_strike_count,
      'spare_count', p_spare_count,
      'gutter_count', p_gutter_count,
      'frame_count', p_frame_count
    )
  );

  if not v_applied then
    select amount into v_existing_amount
      from public.coin_events
     where user_id = v_user_id and idempotency_key = v_key;
    v_reward := coalesce(v_existing_amount, v_reward);
  end if;

  select balance into v_balance from public.user_coins where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'applied', v_applied,
    'coins', v_reward,
    'balance', coalesce(v_balance, 0)
  );
end;
$$;

grant execute on function public.record_wanko_bowling_result(text, integer, integer, integer, integer, integer) to authenticated;

-- -------------------------------------------------------------
-- フレンドランキング（ベストスコア）。coin_events から導出し、専用テーブルは作らない。
-- 週間ランキングへの拡張は get_friend_item_catch_ranking と同じ p_period 引数で対応できる。
-- -------------------------------------------------------------
create index if not exists coin_events_wanko_bowling_ranking_idx
  on public.coin_events(user_id, created_at desc)
  where event_type = 'wanko_bowling';

create or replace function public.get_friend_wanko_bowling_ranking(
  p_period text default 'week'
)
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
  round_scores as (
    select
      ce.user_id,
      ce.idempotency_key as round_key,
      case
        when jsonb_typeof(ce.metadata -> 'score') = 'number'
          then (ce.metadata ->> 'score')::integer
        else 0
      end as score,
      ce.created_at as round_played_at
    from public.coin_events ce
    join candidate_users cu on cu.candidate_user_id = ce.user_id
    where ce.event_type = 'wanko_bowling'
      and ce.idempotency_key like 'wanko-bowling:%'
  ),
  period_scores as (
    select rs.*
      from round_scores rs
     where v_period = 'best'
        or rs.round_played_at >= v_week_start
  ),
  best_per_user as (
    select distinct on (ps.user_id)
      ps.user_id,
      ps.score as best_score,
      ps.round_played_at as played_at
    from period_scores ps
    order by ps.user_id, ps.score desc, ps.round_played_at desc
  ),
  ranked as (
    select
      rank() over (order by b.best_score desc)::integer as rank_position,
      b.user_id,
      b.best_score,
      b.played_at
    from best_per_user b
  )
  select
    r.rank_position,
    r.user_id,
    coalesce(nullif(btrim(p.display_name), ''), 'ゲスト') as display_name,
    p.profile_image_url,
    r.best_score,
    r.played_at,
    r.user_id = v_user_id as is_me
  from ranked r
  left join public.profiles p on p.user_id = r.user_id
  order by r.rank_position, r.played_at desc, r.user_id;
end;
$$;

revoke all on function public.get_friend_wanko_bowling_ranking(text) from public, anon;
grant execute on function public.get_friend_wanko_bowling_ranking(text) to authenticated;

comment on function public.get_friend_wanko_bowling_ranking(text) is
  '認証ユーザー本人とフレンドだけのわんこボウリング最高スコアランキング。week は日本時間の月曜0時から、best は全期間。';

notify pgrst, 'reload schema';
