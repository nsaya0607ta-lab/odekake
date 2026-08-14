-- =============================================================
-- コイン経済・無限レベル 全面改定
-- =============================================================
-- 1. Lv.30の上限を撤廃。Lv.31以降は必要EXP +50/level。
-- 2. レベルアップコインを増額し、Lv.31以降は必要EXP連動＋節目ボーナス。
-- 3. 歩数を500歩=60コイン＋累積達成ボーナスへ変更。
-- 4. ログインを7日周期の連続ボーナスへ変更。
-- 5. アイテムキャッチ完走報酬を追加（25スコア=1コイン、最低1）。
-- 6. ガチャ重複返却を N/R/SR/SSR/UR = 5/10/20/30/50 に変更。

alter table public.coin_events drop constraint if exists coin_events_level_check;
alter table public.coin_events add constraint coin_events_level_check
  check (level is null or level >= 1);

alter table public.coin_events drop constraint if exists coin_events_event_type_check;
alter table public.coin_events add constraint coin_events_event_type_check
  check (event_type in ('level_up', 'steps', 'unlock', 'gacha', 'login', 'item_catch'));

alter table public.coin_events drop constraint if exists coin_events_amount_check;
alter table public.coin_events add constraint coin_events_amount_check
  check (amount >= -100000);

create index if not exists coin_events_user_type_date_idx
  on public.coin_events(user_id, event_type, event_date desc);

-- -------------------------------------------------------------
-- 無限レベル
-- -------------------------------------------------------------
create or replace function public.exp_level_of(p_total_exp integer)
returns integer
language plpgsql
immutable
strict
set search_path = public
as $$
declare
  v_total integer := greatest(0, p_total_exp);
  v_delta numeric;
  v_after30 integer;
  v_level integer;
begin
  if v_total < 11020 then
    select coalesce(max(t.ord)::integer, 1)
      into v_level
      from unnest(array[
        0, 100, 220, 360, 520, 700, 900, 1120, 1360, 1620,
        1900, 2200, 2520, 2860, 3220, 3600, 4000, 4420, 4860, 5320,
        5800, 6300, 6820, 7360, 7920, 8500, 9100, 9720, 10360, 11020
      ]) with ordinality as t(threshold, ord)
     where v_total >= t.threshold;
    return coalesce(v_level, 1);
  end if;

  v_delta := v_total - 11020;
  v_after30 := greatest(
    0,
    floor((-675::numeric + sqrt(455625::numeric + 100::numeric * v_delta)) / 50::numeric)::integer
  );
  return 30 + v_after30;
end;
$$;

create or replace function public.exp_required_for_level(p_level integer)
returns integer
language sql
immutable
strict
set search_path = public
as $$
  select case
    when p_level < 2 then 0
    when p_level = 2 then 100
    when p_level between 3 and 30 then 100 + 20 * (p_level - 2)
    else 700 + 50 * (p_level - 31)
  end;
$$;

-- -------------------------------------------------------------
-- レベルアップコイン
-- -------------------------------------------------------------
create or replace function public.coin_level_up_reward(p_level integer)
returns integer
language plpgsql
immutable
strict
set search_path = public
as $$
declare
  v_required integer;
  v_base integer;
  v_bonus integer := 0;
begin
  if p_level < 2 then return 0; end if;

  if p_level between 2 and 5 then return 200; end if;
  if p_level between 6 and 10 then return 300; end if;
  if p_level between 11 and 15 then return 400; end if;
  if p_level between 16 and 20 then return 500; end if;
  if p_level between 21 and 25 then return 600; end if;
  if p_level between 26 and 29 then return 800; end if;
  if p_level = 30 then return 2000; end if;

  v_required := public.exp_required_for_level(p_level);
  v_base := greatest(250, (round((v_required::numeric * 0.20) / 50) * 50)::integer);
  v_bonus := case p_level
    when 50 then 500
    when 100 then 1500
    when 200 then 3000
    when 500 then 7500
    when 1000 then 15000
    else 0
  end;

  return v_base + v_bonus;
end;
$$;

update public.coin_events
   set amount = public.coin_level_up_reward(level),
       metadata = metadata || jsonb_build_object('reward_version', 2),
       updated_at = now()
 where event_type = 'level_up'
   and level is not null
   and amount <> public.coin_level_up_reward(level);

do $$
declare
  v_user record;
begin
  for v_user in select user_id from public.user_exp loop
    perform public.sync_level_up_coins(v_user.user_id);
  end loop;
end;
$$;

-- -------------------------------------------------------------
-- 歩数コイン
-- -------------------------------------------------------------
create or replace function public.calculate_step_coins(p_steps integer)
returns integer
language sql
immutable
strict
set search_path = public
as $$
  select
    (greatest(0, p_steps) / 500) * 60
    + case when p_steps >= 3000 then 100 else 0 end
    + case when p_steps >= 5000 then 200 else 0 end
    + case when p_steps >= 8000 then 300 else 0 end
    + case when p_steps >= 10000 then 500 else 0 end;
$$;

-- 今日すでに同期済みの歩数は、新ルールへその場で差分調整する。
do $$
declare
  v_steps record;
begin
  for v_steps in
    select user_id, step_date, steps, source
      from public.daily_steps
     where step_date = (timezone('Asia/Tokyo', now()))::date
  loop
    perform public.set_coin_event(
      v_steps.user_id,
      'steps',
      public.calculate_step_coins(v_steps.steps),
      'steps:' || v_steps.step_date::text,
      null,
      v_steps.step_date,
      jsonb_build_object('label', '歩数コイン', 'steps', v_steps.steps, 'source', v_steps.source)
    );
  end loop;
end;
$$;

-- -------------------------------------------------------------
-- 7日周期の連続ログインボーナス
-- -------------------------------------------------------------
create or replace function public.coin_login_bonus(p_streak_day integer)
returns integer
language sql
immutable
strict
set search_path = public
as $$
  select case p_streak_day
    when 1 then 100
    when 2 then 120
    when 3 then 140
    when 4 then 160
    when 5 then 180
    when 6 then 200
    when 7 then 300
    else 100
  end;
$$;

create or replace function public.coin_login_bonus()
returns integer
language sql
immutable
set search_path = public
as $$
  select public.coin_login_bonus(1);
$$;

create or replace function public.claim_login_bonus()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (timezone('Asia/Tokyo', now()))::date;
  v_cursor date;
  v_consecutive integer := 0;
  v_streak_day integer;
  v_next_day integer;
  v_amount integer;
  v_event_id uuid;
  v_balance integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  v_cursor := v_today - 1;
  loop
    exit when not exists (
      select 1
        from public.coin_events
       where user_id = v_user_id
         and event_type = 'login'
         and event_date = v_cursor
    );
    v_consecutive := v_consecutive + 1;
    v_cursor := v_cursor - 1;
  end loop;

  v_streak_day := (v_consecutive % 7) + 1;
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

  select balance into v_balance from public.user_coins where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'granted', v_event_id is not null,
    'amount', case when v_event_id is not null then v_amount else 0 end,
    'balance', coalesce(v_balance, 0),
    'date', v_today,
    'streak_day', v_streak_day,
    'next_amount', public.coin_login_bonus(v_next_day)
  );
end;
$$;

grant execute on function public.claim_login_bonus() to authenticated;

-- -------------------------------------------------------------
-- アイテムキャッチ
-- -------------------------------------------------------------
create or replace function public.record_item_catch_result(
  p_round_id text,
  p_score integer,
  p_caught_count integer,
  p_duration_seconds integer
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
  if p_duration_seconds <> 30 then raise exception 'Round was not completed'; end if;
  if p_score is null or p_score < 0 then raise exception 'Invalid score'; end if;
  if p_caught_count is null or p_caught_count < 0 or p_caught_count > 80 then raise exception 'Invalid caught count'; end if;
  if p_caught_count = 0 and p_score <> 0 then raise exception 'Invalid score'; end if;
  if p_caught_count > 0 and (p_score < p_caught_count * 10 or p_score > p_caught_count * 100) then
    raise exception 'Implausible score';
  end if;

  v_key := 'item-catch:' || p_round_id;
  v_reward := greatest(1, p_score / 25);

  v_applied := public.add_coin_event(
    v_user_id,
    'item_catch',
    v_reward,
    v_key,
    null,
    v_today,
    jsonb_build_object(
      'label', 'アイテムキャッチ',
      'score', p_score,
      'caught_count', p_caught_count,
      'duration_seconds', p_duration_seconds
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

grant execute on function public.record_item_catch_result(text, integer, integer, integer) to authenticated;

-- -------------------------------------------------------------
-- ガチャ重複返却
-- -------------------------------------------------------------
create or replace function public.gacha_rarity_for_item(p_item_id text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_item_id in (
      'toy_colorful_ball', 'toy_rope', 'toy_bone', 'toy_squeaky_ball',
      'toy_tennis_ball', 'toy_red_slipper', 'toy_wood_stick', 'toy_donut_rope'
    ) then 'N'
    when p_item_id in (
      'toy_duck_plush', 'toy_carrot', 'toy_frisbee', 'toy_soccer_ball',
      'toy_taiyaki_plush', 'toy_bear_plush', 'food_paw_bowl'
    ) then 'R'
    when p_item_id in (
      'toy_treasure_puzzle', 'toy_frenchie_plush', 'toy_meat', 'toy_frenchie_cushion'
    ) then 'SR'
    when p_item_id in (
      'toy_rainbow_ball', 'toy_golden_crown_ball',
      'hiking_frenchie', 'snow_frenchie', 'summer_frenchie'
    ) then 'SSR'
    when p_item_id in ('interior_anball', 'other_azubee', 'other_omojii') then 'UR'
    else null
  end;
$$;

create or replace function public.gacha_duplicate_coin_for_rarity(p_rarity text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_rarity
    when 'N' then 5
    when 'R' then 10
    when 'SR' then 20
    when 'SSR' then 30
    when 'UR' then 50
    else 0
  end;
$$;

create or replace function public.gacha_duplicate_coin_for_item(p_item_id text)
returns integer
language sql
immutable
set search_path = public
as $$
  select public.gacha_duplicate_coin_for_rarity(public.gacha_rarity_for_item(p_item_id));
$$;
