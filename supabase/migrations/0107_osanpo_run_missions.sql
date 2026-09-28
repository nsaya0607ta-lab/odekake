-- =============================================================
-- おさんぽフレンチー：今日のミッション
-- =============================================================
-- 毎日3つ出るお題（選び方はアプリ側の src/lib/games/osanpo-run/missions.ts）を達成すると、
-- 1つ30コイン、3つそろうとさらに100コイン。
-- どのお題が今日のものかは API で確かめるが、この関数を直接呼ばれても配りすぎないよう、
-- 日付は日本時間の今日に固定し、1日に記録できるのは3つまでにする（1日最大190コイン）。
-- 台帳は他のミニゲームと同じ coin_events（event_type は osanpo_run）を使い、
-- 冪等キーで同じお題を二重に数えないようにする。
begin;

create table if not exists public.osanpo_run_missions (
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_date date not null,
  mission_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, mission_date, mission_id),
  constraint osanpo_run_missions_id_format check (mission_id ~ '^[A-Za-z0-9_]{1,40}$')
);

alter table public.osanpo_run_missions enable row level security;

drop policy if exists osanpo_run_missions_select_own on public.osanpo_run_missions;
create policy osanpo_run_missions_select_own on public.osanpo_run_missions
  for select to authenticated
  using (user_id = auth.uid());

grant select on public.osanpo_run_missions to authenticated;

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

  -- 同じ人の同時送信で3つを超えないよう、その人の行をまとめて押さえてから数える
  perform pg_advisory_xact_lock(hashtext('osanpo-run-mission:' || v_user_id::text));

  if exists (
    select 1 from public.osanpo_run_missions
     where user_id = v_user_id and mission_date = v_today and mission_id = p_mission_id
  ) then
    select count(*) into v_count from public.osanpo_run_missions where user_id = v_user_id and mission_date = v_today;
    select balance into v_balance from public.user_coins where user_id = v_user_id;
    return jsonb_build_object('ok', true, 'applied', false, 'coins', 0, 'completed', v_count, 'balance', coalesce(v_balance, 0));
  end if;

  select count(*) into v_count from public.osanpo_run_missions where user_id = v_user_id and mission_date = v_today;
  if v_count >= v_daily then
    raise exception using errcode = 'P0001', message = 'MISSION_LIMIT';
  end if;

  insert into public.osanpo_run_missions (user_id, mission_date, mission_id)
  values (v_user_id, v_today, p_mission_id);
  v_count := v_count + 1;

  if public.add_coin_event(
    v_user_id, 'osanpo_run', v_per_mission,
    'osanpo-mission:' || v_today::text || ':' || p_mission_id,
    null, v_today,
    jsonb_build_object('label', 'おさんぽミッション', 'mission', p_mission_id)
  ) then
    v_coins := v_coins + v_per_mission;
  end if;

  if v_count = v_daily and public.add_coin_event(
    v_user_id, 'osanpo_run', v_all_bonus,
    'osanpo-mission:' || v_today::text || ':all',
    null, v_today,
    jsonb_build_object('label', 'おさんぽミッション コンプリート')
  ) then
    v_coins := v_coins + v_all_bonus;
  end if;

  select balance into v_balance from public.user_coins where user_id = v_user_id;

  return jsonb_build_object('ok', true, 'applied', true, 'coins', v_coins, 'completed', v_count, 'balance', coalesce(v_balance, 0));
end;
$$;

revoke all on function public.record_osanpo_run_mission(text) from public, anon;
grant execute on function public.record_osanpo_run_mission(text) to authenticated;

comment on function public.record_osanpo_run_mission(text) is
  'おさんぽフレンチーの今日のミッションを1つ達成として記録し、30コイン（3つ目でさらに100コイン）を付与する。日付は日本時間の今日、1日3つまで。同じお題は二重に数えない。';

commit;

notify pgrst, 'reload schema';
