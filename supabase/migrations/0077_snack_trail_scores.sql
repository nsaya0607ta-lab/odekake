-- =============================================================
-- わんこのおやつ道（ミニゲーム03）のスコア記録とフレンドランキング
-- =============================================================
-- おやつ道はプレビュー中でコインを配らないため、coin_events を台帳にできない。
-- スコアと最高コンボだけを保存する専用テーブルを置き、
-- ランキングは他のミニゲームと同じく security definer の RPC で公開する。
begin;

create table if not exists public.snack_trail_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 1プレイに1つ。二重送信しても同じ行のままにする
  round_id text not null,
  score integer not null,
  max_combo integer not null,
  collected integer not null default 0,
  played_at timestamptz not null default now(),
  constraint snack_trail_scores_round_unique unique (user_id, round_id),
  constraint snack_trail_scores_round_id_format check (length(round_id) between 8 and 100),
  constraint snack_trail_scores_score_range check (score between 0 and 100000),
  constraint snack_trail_scores_combo_range check (max_combo between 0 and 5000),
  constraint snack_trail_scores_collected_range check (collected between 0 and 100000)
);

create index if not exists snack_trail_scores_user_score_idx
  on public.snack_trail_scores(user_id, score desc, played_at desc);
create index if not exists snack_trail_scores_user_played_idx
  on public.snack_trail_scores(user_id, played_at desc);

alter table public.snack_trail_scores enable row level security;

-- 直接読めるのは自分の記録だけ。フレンドの分は下のランキング関数からのみ見せる。
drop policy if exists snack_trail_scores_select_own on public.snack_trail_scores;
create policy snack_trail_scores_select_own on public.snack_trail_scores
  for select to authenticated
  using (user_id = auth.uid());

grant select on public.snack_trail_scores to authenticated;

-- -------------------------------------------------------------
-- 結果の記録
-- -------------------------------------------------------------
create or replace function public.record_snack_trail_result(
  p_round_id text,
  p_score integer,
  p_max_combo integer,
  p_collected integer
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
  v_best_combo integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_round_id is null or length(p_round_id) not between 8 and 100 then
    raise exception using errcode = 'P0001', message = 'INVALID_ROUND_ID';
  end if;
  if p_score is null or p_score < 0 or p_score > 100000 then
    raise exception using errcode = 'P0001', message = 'INVALID_SCORE';
  end if;
  if p_max_combo is null or p_max_combo < 0 or p_max_combo > 5000 then
    raise exception using errcode = 'P0001', message = 'INVALID_COMBO';
  end if;
  if p_collected is null or p_collected < 0 or p_collected > 100000 then
    raise exception using errcode = 'P0001', message = 'INVALID_COLLECTED';
  end if;

  insert into public.snack_trail_scores (user_id, round_id, score, max_combo, collected)
  values (v_user_id, p_round_id, p_score, p_max_combo, p_collected)
  on conflict (user_id, round_id) do nothing;

  v_applied := found;

  select max(s.score), max(s.max_combo)
    into v_best_score, v_best_combo
    from public.snack_trail_scores s
   where s.user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'applied', v_applied,
    'best_score', coalesce(v_best_score, 0),
    'best_combo', coalesce(v_best_combo, 0)
  );
end;
$$;

revoke all on function public.record_snack_trail_result(text, integer, integer, integer) from public, anon;
grant execute on function public.record_snack_trail_result(text, integer, integer, integer) to authenticated;

comment on function public.record_snack_trail_result(text, integer, integer, integer) is
  'わんこのおやつ道の1プレイ分のスコアと最高コンボを記録する。同じ round_id は二重に記録しない。';

-- -------------------------------------------------------------
-- フレンドランキング（自分＋フレンドのみ）
-- -------------------------------------------------------------
create or replace function public.get_friend_snack_trail_ranking(
  p_period text default 'week'
)
returns table (
  rank_position integer,
  user_id uuid,
  display_name text,
  profile_image_url text,
  best_score integer,
  best_combo integer,
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
  period_scores as (
    select s.user_id, s.score, s.max_combo, s.played_at
      from public.snack_trail_scores s
      join candidate_users cu on cu.candidate_user_id = s.user_id
     where v_period = 'best'
        or s.played_at >= v_week_start
  ),
  -- 期間内のベストスコアと、期間内の最高コンボはそれぞれ別のプレイでもよい
  best_per_user as (
    select
      ps.user_id,
      max(ps.score)::integer as best_score,
      max(ps.max_combo)::integer as best_combo,
      max(ps.played_at) as played_at
    from period_scores ps
    group by ps.user_id
  ),
  ranked as (
    select
      rank() over (order by b.best_score desc)::integer as rank_position,
      b.user_id,
      b.best_score,
      b.best_combo,
      b.played_at
    from best_per_user b
  )
  select
    r.rank_position,
    r.user_id,
    coalesce(nullif(btrim(p.display_name), ''), 'ゲスト') as display_name,
    p.profile_image_url,
    r.best_score,
    r.best_combo,
    r.played_at,
    r.user_id = v_user_id as is_me
  from ranked r
  left join public.profiles p on p.user_id = r.user_id
  order by r.rank_position, r.played_at desc, r.user_id;
end;
$$;

revoke all on function public.get_friend_snack_trail_ranking(text) from public, anon;
grant execute on function public.get_friend_snack_trail_ranking(text) to authenticated;

comment on function public.get_friend_snack_trail_ranking(text) is
  '認証ユーザー本人とフレンドだけのおやつ道スコア（スコアと最高コンボ）。week は日本時間の月曜0時から、best は全期間。';

commit;

notify pgrst, 'reload schema';
