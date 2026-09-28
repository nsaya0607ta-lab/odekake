-- =============================================================
-- おさんぽフレンチー：協力チャレンジ
-- =============================================================
-- 自分とフレンドの「今週（日本時間の月曜0時から）歩いた合計距離」で目標を目指す。
-- 目標は 1人あたり 2000m × 人数（2000m〜20000m）。達成したら、それぞれが1回だけ 100コインを受け取れる。
-- 値はアプリ側の COOP_METERS_PER_MEMBER / COOP_GOAL_MIN / COOP_GOAL_MAX / COOP_COINS と同じ。
-- 距離は osanpo_run_scores（1プレイごとの記録）の meters を合計する。
begin;

create table if not exists public.osanpo_run_coop_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

alter table public.osanpo_run_coop_claims enable row level security;

drop policy if exists osanpo_run_coop_claims_select_own on public.osanpo_run_coop_claims;
create policy osanpo_run_coop_claims_select_own on public.osanpo_run_coop_claims
  for select to authenticated
  using (user_id = auth.uid());

grant select on public.osanpo_run_coop_claims to authenticated;

-- -------------------------------------------------------------
-- 今週の進み具合（自分＋フレンド）
-- -------------------------------------------------------------
create or replace function public.get_osanpo_run_coop()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_week_date date := (date_trunc('week', timezone('Asia/Tokyo', now())))::date;
  v_week_start timestamptz := date_trunc('week', timezone('Asia/Tokyo', now())) at time zone 'Asia/Tokyo';
  v_members jsonb;
  v_count integer;
  v_total bigint;
  v_goal integer;
  v_claimed boolean;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  with candidate_users as (
    select v_user_id as member_id
    union
    select f.friend_user_id from public.friendships f where f.user_id = v_user_id
  ),
  per_user as (
    select cu.member_id, coalesce(sum(s.meters), 0)::bigint as meters
      from candidate_users cu
      left join public.osanpo_run_scores s
        on s.user_id = cu.member_id and s.played_at >= v_week_start
     group by cu.member_id
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'user_id', p.member_id,
      'display_name', coalesce(nullif(btrim(pr.display_name), ''), 'ゲスト'),
      'meters', p.meters,
      'is_me', p.member_id = v_user_id
    ) order by p.meters desc, p.member_id), '[]'::jsonb),
    count(*)::integer,
    coalesce(sum(p.meters), 0)::bigint
  into v_members, v_count, v_total
  from per_user p
  left join public.profiles pr on pr.user_id = p.member_id;

  v_goal := least(20000, greatest(2000, 2000 * v_count));
  select exists (
    select 1 from public.osanpo_run_coop_claims c where c.user_id = v_user_id and c.week_start = v_week_date
  ) into v_claimed;

  return jsonb_build_object(
    'week_start', v_week_date,
    'goal', v_goal,
    'total', v_total,
    'members', v_members,
    'claimed', v_claimed,
    'coins', 100
  );
end;
$$;

revoke all on function public.get_osanpo_run_coop() from public, anon;
grant execute on function public.get_osanpo_run_coop() to authenticated;

comment on function public.get_osanpo_run_coop() is
  'おさんぽフレンチーの協力チャレンジ。自分とフレンドの今週の合計距離・目標・メンバーごとの距離・受け取り済みかを返す。';

-- -------------------------------------------------------------
-- 達成ごほうびの受け取り（1週1回）
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

  if found and public.add_coin_event(
    v_user_id, 'osanpo_run', 100,
    'osanpo-coop:' || v_week_date::text,
    null, (timezone('Asia/Tokyo', now()))::date,
    jsonb_build_object('label', 'おさんぽ協力チャレンジ', 'week_start', v_week_date)
  ) then
    v_coins := 100;
  end if;

  select balance into v_balance from public.user_coins where user_id = v_user_id;
  return jsonb_build_object('ok', true, 'coins', v_coins, 'balance', coalesce(v_balance, 0));
end;
$$;

revoke all on function public.claim_osanpo_run_coop() from public, anon;
grant execute on function public.claim_osanpo_run_coop() to authenticated;

comment on function public.claim_osanpo_run_coop() is
  'おさんぽフレンチーの協力チャレンジを達成していれば、今週ぶんの100コインを1回だけ付与する。';

commit;

notify pgrst, 'reload schema';
