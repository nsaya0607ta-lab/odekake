-- =============================================================
-- アイテムキャッチ フレンドランキング
-- =============================================================
-- 既存の coin_events に保存されている item_catch のスコアを使う。
-- 新しい結果テーブルを増やさないため、これまで遊んだ記録もランキング対象になる。
-- 8,000点超で複数イベントに分割されたラウンドは round_id 単位へ戻して合算する。

create index if not exists coin_events_item_catch_ranking_idx
  on public.coin_events(user_id, created_at desc)
  where event_type = 'item_catch';

create or replace function public.get_friend_item_catch_ranking(
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
      regexp_replace(ce.idempotency_key, ':[0-9]+$', '') as round_key,
      sum(
        case
          when jsonb_typeof(ce.metadata -> 'score') = 'number'
            then (ce.metadata ->> 'score')::integer
          else 0
        end
      )::integer as score,
      max(ce.created_at) as round_played_at
    from public.coin_events ce
    join candidate_users cu on cu.candidate_user_id = ce.user_id
    where ce.event_type = 'item_catch'
      and ce.idempotency_key like 'item-catch:%'
    group by ce.user_id, regexp_replace(ce.idempotency_key, ':[0-9]+$', '')
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

revoke all on function public.get_friend_item_catch_ranking(text) from public, anon;
grant execute on function public.get_friend_item_catch_ranking(text) to authenticated;

comment on function public.get_friend_item_catch_ranking(text) is
  '認証ユーザー本人とフレンドだけのアイテムキャッチ最高スコアランキング。week は日本時間の月曜0時から、best は全期間。';
