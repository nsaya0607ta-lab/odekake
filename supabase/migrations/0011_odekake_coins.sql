-- =============================================================
-- おでかけコイン
-- =============================================================
-- コインはEXPと同じ作りで、台帳（coin_events）と残高（user_coins）に保存する。
-- 表示のたびに集計し直さないので、あとから履歴を消しても残高がずれない。
--
-- もらえるのは次の2つだけ。
--   1. レベルアップ報酬 … 到達レベルごとに1回（Lv.2〜30）
--   2. 歩数報酬         … 1日の歩数の段階報酬（同じ日は差分だけ増える）
--
-- 使い道（コインで解放するショップ）はまだ画面がないため、
-- 台帳は負の値も持てるようにし、event_type に 'unlock' を先に用意しておく。

create table if not exists public.user_coins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  total_earned integer not null default 0 check (total_earned >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.coin_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('level_up', 'steps', 'unlock')),
  -- 正の値が獲得、負の値が消費。1件で動かせる上限を決めておく。
  amount integer not null check (amount between -100000 and 100000),
  idempotency_key text not null,
  level integer check (level is null or level between 1 and 30),
  event_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists coin_events_user_created_idx
  on public.coin_events(user_id, created_at desc);

alter table public.user_coins enable row level security;
alter table public.coin_events enable row level security;

drop policy if exists user_coins_select on public.user_coins;
create policy user_coins_select on public.user_coins for select to authenticated
  using (user_id = auth.uid());

drop policy if exists coin_events_select on public.coin_events;
create policy coin_events_select on public.coin_events for select to authenticated
  using (user_id = auth.uid());

-- 参照だけ許可する。増減は下の RPC / トリガー（SECURITY DEFINER）だけが行う。
grant select on public.user_coins, public.coin_events to authenticated;

drop trigger if exists coin_events_set_updated_at on public.coin_events;
create trigger coin_events_set_updated_at before update on public.coin_events
  for each row execute function public.set_updated_at();

-- 台帳の追加・修正分を残高へ反映する。
create or replace function public.sync_user_coin_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_delta integer;
  v_earned integer;
begin
  if tg_op = 'INSERT' then
    v_user_id := new.user_id;
    v_delta := new.amount;
    v_earned := greatest(0, new.amount);
  elsif tg_op = 'UPDATE' then
    if new.user_id <> old.user_id then
      raise exception 'Coin event owner cannot be changed';
    end if;
    v_user_id := new.user_id;
    v_delta := new.amount - old.amount;
    v_earned := greatest(0, new.amount) - greatest(0, old.amount);
  else
    v_user_id := old.user_id;
    v_delta := -old.amount;
    v_earned := -greatest(0, old.amount);
  end if;

  if tg_op = 'DELETE' then
    -- 退会時は auth.users の削除が台帳と残高の両方へ連鎖する。
    -- ここで insert し直すと、消えたユーザーの残高を作ろうとして外部キー違反になるため、
    -- 削除では残っている残高だけを直す。
    update public.user_coins
       set balance = greatest(0, balance + v_delta),
           total_earned = greatest(0, total_earned + v_earned),
           updated_at = now()
     where user_id = v_user_id;
    return old;
  end if;

  insert into public.user_coins (user_id, balance, total_earned, updated_at)
  values (v_user_id, greatest(0, v_delta), greatest(0, v_earned), now())
  on conflict (user_id) do update
    set balance = greatest(0, public.user_coins.balance + v_delta),
        total_earned = greatest(0, public.user_coins.total_earned + v_earned),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists coin_events_sync_balance on public.coin_events;
create trigger coin_events_sync_balance
after insert or update of amount or delete on public.coin_events
for each row execute function public.sync_user_coin_balance();

-- EXPの台帳も同じ理由で、削除では残高を作り直さないようにする。
-- （退会時に exp_events の連鎖削除が user_exp の外部キー違反になっていた）
create or replace function public.sync_user_exp_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_delta integer;
begin
  if tg_op = 'INSERT' then
    v_user_id := new.user_id;
    v_delta := new.exp;
  elsif tg_op = 'UPDATE' then
    if new.user_id <> old.user_id then
      raise exception 'EXP event owner cannot be changed';
    end if;
    v_user_id := new.user_id;
    v_delta := new.exp - old.exp;
  else
    v_user_id := old.user_id;
    v_delta := -old.exp;
  end if;

  if tg_op = 'DELETE' then
    update public.user_exp
       set total_exp = greatest(0, total_exp + v_delta),
           updated_at = now()
     where user_id = v_user_id;
    return old;
  end if;

  insert into public.user_exp (user_id, total_exp, updated_at)
  values (v_user_id, greatest(0, v_delta), now())
  on conflict (user_id) do update
    set total_exp = greatest(0, public.user_exp.total_exp + v_delta),
        updated_at = now();

  return new;
end;
$$;

-- -------------------------------------------------------------
-- 付与量の定義（src/lib/exp.ts / src/lib/coins.ts と同じ値にする）
-- -------------------------------------------------------------
-- 合計EXPから、おでかけレベルを求める。
-- 段階は src/lib/exp.ts の LEVEL_THRESHOLDS と必ず同じにする。
create or replace function public.exp_level_of(p_total_exp integer)
returns integer
language sql
immutable
strict
set search_path = public
as $$
  select coalesce((
    select max(t.ord)::integer
      from unnest(array[
        0, 100, 220, 360, 520, 700, 900, 1120, 1360, 1620,
        1900, 2200, 2520, 2860, 3220, 3600, 4000, 4420, 4860, 5320,
        5800, 6300, 6820, 7360, 7920, 8500, 9100, 9720, 10360, 11020
      ]) with ordinality as t(threshold, ord)
     where greatest(0, p_total_exp) >= t.threshold
  ), 1);
$$;

-- そのレベルへ到達したときにもらえるコイン。Lv.30だけ大きくする。
create or replace function public.coin_level_up_reward(p_level integer)
returns integer
language sql
immutable
strict
set search_path = public
as $$
  select case
    when p_level between 2 and 5 then 100
    when p_level between 6 and 10 then 150
    when p_level between 11 and 15 then 200
    when p_level between 16 and 20 then 250
    when p_level between 21 and 25 then 300
    when p_level between 26 and 29 then 400
    when p_level = 30 then 1000
    else 0
  end;
$$;

-- 1日の歩数の段階報酬。1日あたり最大70コイン。
create or replace function public.calculate_step_coins(p_steps integer)
returns integer
language sql
immutable
strict
set search_path = public
as $$
  select least(70,
    (case when p_steps >= 3000  then 10 else 0 end) +
    (case when p_steps >= 5000  then 10 else 0 end) +
    (case when p_steps >= 8000  then 15 else 0 end) +
    (case when p_steps >= 10000 then 15 else 0 end) +
    (case when p_steps >= 15000 then 20 else 0 end)
  );
$$;

-- -------------------------------------------------------------
-- 台帳への書き込み
-- -------------------------------------------------------------
-- 同じ付与キーは一度だけ。付与できた場合だけ true を返す。
create or replace function public.add_coin_event(
  p_user_id uuid,
  p_event_type text,
  p_amount integer,
  p_idempotency_key text,
  p_level integer default null,
  p_event_date date default null,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.coin_events (
    user_id, event_type, amount, idempotency_key, level, event_date, metadata
  ) values (
    p_user_id, p_event_type, p_amount, p_idempotency_key, p_level, p_event_date,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_id;

  return v_id is not null;
end;
$$;

-- 歩数は同じ日の値が後から増減するため、台帳の同じ行を差分更新する。
create or replace function public.set_coin_event(
  p_user_id uuid,
  p_event_type text,
  p_amount integer,
  p_idempotency_key text,
  p_level integer default null,
  p_event_date date default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.coin_events (
    user_id, event_type, amount, idempotency_key, level, event_date, metadata
  ) values (
    p_user_id, p_event_type, p_amount, p_idempotency_key, p_level, p_event_date,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (user_id, idempotency_key) do update
    set amount = excluded.amount,
        event_date = excluded.event_date,
        metadata = excluded.metadata,
        updated_at = now();
end;
$$;

-- -------------------------------------------------------------
-- レベルアップ報酬
-- -------------------------------------------------------------
-- 現在のレベルまでの未付与分をまとめて配る。
-- キーが 'level:{レベル}' なので、何度呼んでも同じレベル分は増えない。
-- EXPが減ってレベルが下がっても、一度もらったコインは戻さない。
create or replace function public.sync_level_up_coins(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_level integer;
  v_level_index integer;
begin
  select public.exp_level_of(total_exp) into v_level
    from public.user_exp where user_id = p_user_id;
  if v_level is null then return; end if;

  for v_level_index in 2..v_level loop
    perform public.add_coin_event(
      p_user_id, 'level_up', public.coin_level_up_reward(v_level_index),
      'level:' || v_level_index, v_level_index, null,
      jsonb_build_object('label', 'レベルアップ報酬', 'level', v_level_index)
    );
  end loop;
end;
$$;

create or replace function public.tg_sync_level_up_coins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_level_up_coins(new.user_id);
  return new;
end;
$$;

drop trigger if exists user_exp_sync_coins on public.user_exp;
create trigger user_exp_sync_coins
after insert or update of total_exp on public.user_exp
for each row execute function public.tg_sync_level_up_coins();

-- -------------------------------------------------------------
-- 歩数報酬
-- -------------------------------------------------------------
-- 0010 の共通処理へコインの同期を足す（EXPの扱いはそのまま）。
create or replace function public.record_daily_steps_for_user(
  p_user_id uuid,
  p_step_date date,
  p_steps integer,
  p_source text default 'healthcare'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exp integer;
  v_coins integer;
begin
  if p_user_id is null then raise exception 'User is required'; end if;
  if p_step_date is null or p_step_date > (timezone('Asia/Tokyo', now()))::date then
    raise exception 'Step date must not be in the future';
  end if;
  if p_step_date < (timezone('Asia/Tokyo', now()))::date - 7 then
    raise exception 'Step date is too old';
  end if;
  if p_steps < 0 or p_steps > 200000 then raise exception 'Invalid step count'; end if;

  v_exp := public.calculate_step_exp(p_steps);
  v_coins := public.calculate_step_coins(p_steps);

  insert into public.daily_steps (user_id, step_date, steps, earned_exp, source)
  values (p_user_id, p_step_date, p_steps, v_exp, coalesce(nullif(p_source, ''), 'healthcare'))
  on conflict (user_id, step_date) do update
    set steps = excluded.steps,
        earned_exp = excluded.earned_exp,
        source = excluded.source,
        updated_at = now();

  perform public.set_exp_event(
    p_user_id, 'steps', v_exp, 'steps:' || p_step_date::text, p_step_date,
    jsonb_build_object('label', '歩数EXP', 'steps', p_steps, 'source', p_source)
  );

  perform public.set_coin_event(
    p_user_id, 'steps', v_coins, 'steps:' || p_step_date::text, null, p_step_date,
    jsonb_build_object('label', '歩数コイン', 'steps', p_steps, 'source', p_source)
  );

  return v_exp;
end;
$$;

revoke all on function public.record_daily_steps_for_user(uuid, date, integer, text)
  from public, anon, authenticated;

-- 内部関数をAPIから直接呼ばせない。
revoke all on function public.add_coin_event(uuid, text, integer, text, integer, date, jsonb)
  from public, anon, authenticated;
revoke all on function public.set_coin_event(uuid, text, integer, text, integer, date, jsonb)
  from public, anon, authenticated;
revoke all on function public.sync_level_up_coins(uuid) from public, anon, authenticated;

-- -------------------------------------------------------------
-- これまでの分を配る（再適用時の自己修復も兼ねる）
-- -------------------------------------------------------------
do $$
declare
  v_row record;
begin
  for v_row in select user_id from public.user_exp loop
    perform public.sync_level_up_coins(v_row.user_id);
  end loop;

  for v_row in select user_id, step_date, steps, source from public.daily_steps loop
    perform public.set_coin_event(
      v_row.user_id, 'steps', public.calculate_step_coins(v_row.steps),
      'steps:' || v_row.step_date::text, null, v_row.step_date,
      jsonb_build_object('label', '歩数コイン', 'steps', v_row.steps, 'source', v_row.source)
    );
  end loop;
end;
$$;

-- 台帳を正として残高を揃える。
insert into public.user_coins (user_id, balance, total_earned, updated_at)
select user_id,
       greatest(0, sum(amount))::integer,
       sum(greatest(0, amount))::integer,
       now()
  from public.coin_events
 group by user_id
on conflict (user_id) do update
  set balance = excluded.balance,
      total_earned = excluded.total_earned,
      updated_at = excluded.updated_at;
