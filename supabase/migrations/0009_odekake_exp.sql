-- =============================================================
-- おでかけレベル / EXP
-- =============================================================
-- EXP は表示時の再集計ではなく、exp_events（台帳）と user_exp（残高）へ保存する。
-- idempotency_key をユーザー内で一意にし、編集や二重送信による再付与を防ぐ。

create table if not exists public.user_exp (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_exp integer not null default 0 check (total_exp >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.exp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'visit_created', 'first_spot', 'revisit', 'photo', 'comment', 'rating',
    'first_municipality', 'first_prefecture', 'first_region',
    'municipality_5_spots', 'prefecture_5_municipalities',
    'prefecture_50_percent', 'prefecture_100_percent', 'steps'
  )),
  exp integer not null check (exp >= 0 and exp <= 600),
  idempotency_key text not null,
  visit_record_id uuid references public.visit_records(id) on delete set null,
  spot_id uuid references public.spots(id) on delete set null,
  prefecture_code text,
  municipality_code text,
  event_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  constraint exp_events_prefecture_code_format
    check (prefecture_code is null or prefecture_code ~ '^[0-9]{2}$'),
  constraint exp_events_municipality_code_format
    check (municipality_code is null or municipality_code ~ '^[0-9]{5}$')
);

create index if not exists exp_events_user_created_idx
  on public.exp_events(user_id, created_at desc);
create index if not exists exp_events_visit_idx
  on public.exp_events(visit_record_id) where visit_record_id is not null;

create table if not exists public.daily_steps (
  user_id uuid not null references auth.users(id) on delete cascade,
  step_date date not null,
  steps integer not null check (steps >= 0 and steps <= 200000),
  earned_exp integer not null default 0 check (earned_exp between 0 and 35),
  source text not null default 'healthcare',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, step_date)
);

-- 県内達成率の母数。アプリの municipalities.json（市区町村など 1,894件）と一致させる。
create table if not exists public.prefecture_municipality_totals (
  prefecture_code text primary key check (prefecture_code ~ '^[0-9]{2}$'),
  municipality_count integer not null check (municipality_count > 0)
);

insert into public.prefecture_municipality_totals (prefecture_code, municipality_count) values
  ('01',188),('02',40),('03',33),('04',39),('05',25),('06',35),('07',59),
  ('08',44),('09',25),('10',35),('11',72),('12',59),('13',61),('14',58),
  ('15',37),('16',15),('17',19),('18',17),('19',27),('20',77),('21',42),
  ('22',43),('23',69),('24',29),('25',19),('26',36),('27',72),('28',49),
  ('29',39),('30',30),('31',19),('32',19),('33',30),('34',30),('35',19),
  ('36',24),('37',17),('38',20),('39',34),('40',72),('41',20),('42',21),
  ('43',48),('44',18),('45',26),('46',43),('47',41)
on conflict (prefecture_code) do update
  set municipality_count = excluded.municipality_count;

alter table public.user_exp enable row level security;
alter table public.exp_events enable row level security;
alter table public.daily_steps enable row level security;
alter table public.prefecture_municipality_totals enable row level security;

drop policy if exists user_exp_select on public.user_exp;
create policy user_exp_select on public.user_exp for select to authenticated
  using (user_id = auth.uid());

drop policy if exists exp_events_select on public.exp_events;
create policy exp_events_select on public.exp_events for select to authenticated
  using (user_id = auth.uid());

drop policy if exists daily_steps_select on public.daily_steps;
create policy daily_steps_select on public.daily_steps for select to authenticated
  using (user_id = auth.uid());

drop policy if exists prefecture_municipality_totals_select on public.prefecture_municipality_totals;
create policy prefecture_municipality_totals_select on public.prefecture_municipality_totals
  for select to authenticated using (true);

grant select on public.user_exp, public.exp_events, public.daily_steps,
  public.prefecture_municipality_totals to authenticated;

-- 台帳の追加・修正分を保存済み合計へ反映する。
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

  insert into public.user_exp (user_id, total_exp, updated_at)
  values (v_user_id, greatest(0, v_delta), now())
  on conflict (user_id) do update
    set total_exp = greatest(0, public.user_exp.total_exp + v_delta),
        updated_at = now();

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists exp_events_sync_total on public.exp_events;
create trigger exp_events_sync_total
after insert or update of exp or delete on public.exp_events
for each row execute function public.sync_user_exp_total();

drop trigger if exists exp_events_set_updated_at on public.exp_events;
create trigger exp_events_set_updated_at before update on public.exp_events
  for each row execute function public.set_updated_at();

drop trigger if exists daily_steps_set_updated_at on public.daily_steps;
create trigger daily_steps_set_updated_at before update on public.daily_steps
  for each row execute function public.set_updated_at();

-- 同じ付与キーは一度だけ。付与できた場合だけ true を返す。
create or replace function public.add_exp_event(
  p_user_id uuid,
  p_event_type text,
  p_exp integer,
  p_idempotency_key text,
  p_visit_record_id uuid default null,
  p_spot_id uuid default null,
  p_prefecture_code text default null,
  p_municipality_code text default null,
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
  insert into public.exp_events (
    user_id, event_type, exp, idempotency_key, visit_record_id, spot_id,
    prefecture_code, municipality_code, event_date, metadata
  ) values (
    p_user_id, p_event_type, p_exp, p_idempotency_key, p_visit_record_id, p_spot_id,
    p_prefecture_code, p_municipality_code, p_event_date, coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_id;

  return v_id is not null;
end;
$$;

-- 歩数だけは同じ日付の値が後から増減するため、台帳の同じ行を差分更新する。
create or replace function public.set_exp_event(
  p_user_id uuid,
  p_event_type text,
  p_exp integer,
  p_idempotency_key text,
  p_event_date date,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.exp_events (
    user_id, event_type, exp, idempotency_key, event_date, metadata
  ) values (
    p_user_id, p_event_type, p_exp, p_idempotency_key, p_event_date,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (user_id, idempotency_key) do update
    set exp = excluded.exp,
        event_date = excluded.event_date,
        metadata = excluded.metadata,
        updated_at = now();
end;
$$;

create or replace function public.exp_region_of(p_prefecture_code text)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select case
    when p_prefecture_code = '01' then 'hokkaido'
    when p_prefecture_code between '02' and '07' then 'tohoku'
    when p_prefecture_code between '08' and '14' then 'kanto'
    when p_prefecture_code between '15' and '23' then 'chubu'
    when p_prefecture_code between '24' and '30' then 'kinki'
    when p_prefecture_code between '31' and '35' then 'chugoku'
    when p_prefecture_code between '36' and '39' then 'shikoku'
    when p_prefecture_code between '40' and '47' then 'kyushu-okinawa'
  end;
$$;

-- 1件の訪問について、現時点で成立している付与条件を同期する。
-- 何度呼ばれても idempotency_key により同じEXPは増えない。
create or replace function public.sync_visit_exp(p_visit_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visit public.visit_records%rowtype;
  v_spot public.spots%rowtype;
  v_first_spot_visit uuid;
  v_region text;
  v_municipality_spots integer;
  v_prefecture_municipalities integer;
  v_prefecture_total integer;
begin
  select * into v_visit from public.visit_records where id = p_visit_id;
  if not found then return; end if;

  select * into v_spot from public.spots where id = v_visit.spot_id;
  if not found then return; end if;

  perform public.add_exp_event(
    v_visit.user_id, 'visit_created', 20, 'visit:' || v_visit.id || ':created',
    v_visit.id, v_spot.id, v_spot.prefecture_code, v_spot.municipality_code,
    v_visit.visited_at, jsonb_build_object('label', '訪問履歴を登録', 'spot_name', v_spot.name)
  );

  select visit_record_id into v_first_spot_visit
    from public.exp_events
   where user_id = v_visit.user_id
     and idempotency_key = 'spot:' || v_spot.id || ':first';

  if not found then
    if not public.add_exp_event(
      v_visit.user_id, 'first_spot', 30, 'spot:' || v_spot.id || ':first',
      v_visit.id, v_spot.id, v_spot.prefecture_code, v_spot.municipality_code,
      v_visit.visited_at, jsonb_build_object('label', '初めてのスポット', 'spot_name', v_spot.name)
    ) then
      perform public.add_exp_event(
        v_visit.user_id, 'revisit', 10, 'visit:' || v_visit.id || ':revisit',
        v_visit.id, v_spot.id, v_spot.prefecture_code, v_spot.municipality_code,
        v_visit.visited_at, jsonb_build_object('label', '同じスポットを再訪', 'spot_name', v_spot.name)
      );
    end if;
  elsif v_first_spot_visit is distinct from v_visit.id then
    perform public.add_exp_event(
      v_visit.user_id, 'revisit', 10, 'visit:' || v_visit.id || ':revisit',
      v_visit.id, v_spot.id, v_spot.prefecture_code, v_spot.municipality_code,
      v_visit.visited_at, jsonb_build_object('label', '同じスポットを再訪', 'spot_name', v_spot.name)
    );
  end if;

  if nullif(btrim(coalesce(v_visit.comment, '')), '') is not null then
    perform public.add_exp_event(
      v_visit.user_id, 'comment', 10, 'visit:' || v_visit.id || ':comment',
      v_visit.id, v_spot.id, v_spot.prefecture_code, v_spot.municipality_code,
      v_visit.visited_at, jsonb_build_object('label', '感想を記録', 'spot_name', v_spot.name)
    );
  end if;

  if v_visit.rating is not null then
    perform public.add_exp_event(
      v_visit.user_id, 'rating', 5, 'visit:' || v_visit.id || ':rating',
      v_visit.id, v_spot.id, v_spot.prefecture_code, v_spot.municipality_code,
      v_visit.visited_at, jsonb_build_object('label', '評価を記録', 'spot_name', v_spot.name)
    );
  end if;

  perform public.add_exp_event(
    v_visit.user_id, 'first_municipality', 60,
    'municipality:' || v_spot.municipality_code || ':first',
    v_visit.id, v_spot.id, v_spot.prefecture_code, v_spot.municipality_code,
    v_visit.visited_at, jsonb_build_object('label', '初めての市区町村')
  );

  perform public.add_exp_event(
    v_visit.user_id, 'first_prefecture', 150,
    'prefecture:' || v_spot.prefecture_code || ':first',
    v_visit.id, v_spot.id, v_spot.prefecture_code, v_spot.municipality_code,
    v_visit.visited_at, jsonb_build_object('label', '初めての都道府県')
  );

  v_region := public.exp_region_of(v_spot.prefecture_code);
  if v_region is not null then
    perform public.add_exp_event(
      v_visit.user_id, 'first_region', 200, 'region:' || v_region || ':first',
      v_visit.id, v_spot.id, v_spot.prefecture_code, v_spot.municipality_code,
      v_visit.visited_at, jsonb_build_object('label', '初めての地方', 'region', v_region)
    );
  end if;

  select count(distinct vr.spot_id)::integer into v_municipality_spots
    from public.visit_records vr
    join public.spots s on s.id = vr.spot_id
   where vr.user_id = v_visit.user_id
     and s.municipality_code = v_spot.municipality_code;

  if v_municipality_spots >= 5 then
    perform public.add_exp_event(
      v_visit.user_id, 'municipality_5_spots', 100,
      'municipality:' || v_spot.municipality_code || ':5-spots',
      v_visit.id, v_spot.id, v_spot.prefecture_code, v_spot.municipality_code,
      v_visit.visited_at, jsonb_build_object('label', '同じ市区町村で5スポット')
    );
  end if;

  select count(distinct s.municipality_code)::integer into v_prefecture_municipalities
    from public.visit_records vr
    join public.spots s on s.id = vr.spot_id
   where vr.user_id = v_visit.user_id
     and s.prefecture_code = v_spot.prefecture_code;

  if v_prefecture_municipalities >= 5 then
    perform public.add_exp_event(
      v_visit.user_id, 'prefecture_5_municipalities', 150,
      'prefecture:' || v_spot.prefecture_code || ':5-municipalities',
      v_visit.id, v_spot.id, v_spot.prefecture_code, v_spot.municipality_code,
      v_visit.visited_at, jsonb_build_object('label', '1県で5市区町村')
    );
  end if;

  select municipality_count into v_prefecture_total
    from public.prefecture_municipality_totals
   where prefecture_code = v_spot.prefecture_code;

  if v_prefecture_total is not null
     and v_prefecture_municipalities * 2 >= v_prefecture_total then
    perform public.add_exp_event(
      v_visit.user_id, 'prefecture_50_percent', 250,
      'prefecture:' || v_spot.prefecture_code || ':50-percent',
      v_visit.id, v_spot.id, v_spot.prefecture_code, v_spot.municipality_code,
      v_visit.visited_at, jsonb_build_object('label', '県内50%訪問')
    );
  end if;

  if v_prefecture_total is not null
     and v_prefecture_municipalities >= v_prefecture_total then
    perform public.add_exp_event(
      v_visit.user_id, 'prefecture_100_percent', 600,
      'prefecture:' || v_spot.prefecture_code || ':100-percent',
      v_visit.id, v_spot.id, v_spot.prefecture_code, v_spot.municipality_code,
      v_visit.visited_at, jsonb_build_object('label', '県内100%訪問')
    );
  end if;
end;
$$;

create or replace function public.tg_sync_visit_exp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_visit_exp(new.id);
  return new;
end;
$$;

drop trigger if exists visit_records_sync_exp on public.visit_records;
create trigger visit_records_sync_exp
after insert or update of comment, rating on public.visit_records
for each row execute function public.tg_sync_visit_exp();

create or replace function public.tg_award_photo_exp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visit public.visit_records%rowtype;
  v_spot public.spots%rowtype;
begin
  select * into v_visit from public.visit_records where id = new.visit_record_id;
  if not found then return new; end if;
  select * into v_spot from public.spots where id = v_visit.spot_id;
  if not found then return new; end if;

  perform public.add_exp_event(
    v_visit.user_id, 'photo', 10, 'visit:' || v_visit.id || ':photo',
    v_visit.id, v_spot.id, v_spot.prefecture_code, v_spot.municipality_code,
    v_visit.visited_at, jsonb_build_object('label', '写真を追加', 'spot_name', v_spot.name)
  );
  return new;
end;
$$;

drop trigger if exists visit_photos_award_exp on public.visit_photos;
create trigger visit_photos_award_exp after insert on public.visit_photos
  for each row execute function public.tg_award_photo_exp();

-- HealthKit等から日付ごとの累計歩数を同期するためのRPC。
-- 閾値ごとの加点合計を35EXPで上限化し、同じ日は台帳の1行だけ更新する。
create or replace function public.record_daily_steps(p_step_date date, p_steps integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_exp integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_step_date is null or p_step_date > (timezone('Asia/Tokyo', now()))::date then
    raise exception 'Step date must not be in the future';
  end if;
  if p_steps < 0 or p_steps > 200000 then raise exception 'Invalid step count'; end if;

  v_exp :=
    (case when p_steps >= 1000  then 1 else 0 end) +
    (case when p_steps >= 2000  then 1 else 0 end) +
    (case when p_steps >= 3000  then 2 else 0 end) +
    (case when p_steps >= 4000  then 2 else 0 end) +
    (case when p_steps >= 5000  then 3 else 0 end) +
    (case when p_steps >= 6000  then 2 else 0 end) +
    (case when p_steps >= 7000  then 2 else 0 end) +
    (case when p_steps >= 8000  then 3 else 0 end) +
    (case when p_steps >= 9000  then 2 else 0 end) +
    (case when p_steps >= 10000 then 4 else 0 end) +
    (case when p_steps >= 12000 then 4 else 0 end) +
    (case when p_steps >= 15000 then 5 else 0 end) +
    (case when p_steps >= 20000 then 4 else 0 end);
  v_exp := least(35, v_exp);

  insert into public.daily_steps (user_id, step_date, steps, earned_exp)
  values (v_user_id, p_step_date, p_steps, v_exp)
  on conflict (user_id, step_date) do update
    set steps = excluded.steps,
        earned_exp = excluded.earned_exp,
        updated_at = now();

  perform public.set_exp_event(
    v_user_id, 'steps', v_exp, 'steps:' || p_step_date::text, p_step_date,
    jsonb_build_object('label', '歩数EXP', 'steps', p_steps)
  );

  return v_exp;
end;
$$;

grant execute on function public.record_daily_steps(date, integer) to authenticated;

-- 内部関数をAPIから直接呼ばせない。
revoke all on function public.add_exp_event(uuid, text, integer, text, uuid, uuid, text, text, date, jsonb)
  from public, anon, authenticated;
revoke all on function public.set_exp_event(uuid, text, integer, text, date, jsonb)
  from public, anon, authenticated;
revoke all on function public.sync_visit_exp(uuid) from public, anon, authenticated;

-- 既存の訪問記録も登録順に一度だけ台帳へ移す。
do $$
declare
  v_visit record;
begin
  for v_visit in
    select id from public.visit_records order by created_at, id
  loop
    perform public.sync_visit_exp(v_visit.id);
  end loop;
end;
$$;

-- 台帳を正として保存済み合計を揃える（再適用時の自己修復も兼ねる）。
insert into public.user_exp (user_id, total_exp, updated_at)
select user_id, sum(exp)::integer, now()
  from public.exp_events
 group by user_id
on conflict (user_id) do update
  set total_exp = excluded.total_exp,
      updated_at = excluded.updated_at;

-- 既存写真分の初回ボーナスも付与する。
do $$
declare
  v_photo record;
begin
  for v_photo in
    select distinct on (vr.id)
      vr.id as visit_id, vr.user_id, vr.visited_at,
      s.id as spot_id, s.name as spot_name, s.prefecture_code, s.municipality_code
    from public.visit_records vr
    join public.spots s on s.id = vr.spot_id
    join public.visit_photos vp on vp.visit_record_id = vr.id
    order by vr.id, vp.created_at, vp.id
  loop
    perform public.add_exp_event(
      v_photo.user_id, 'photo', 10, 'visit:' || v_photo.visit_id || ':photo',
      v_photo.visit_id, v_photo.spot_id, v_photo.prefecture_code, v_photo.municipality_code,
      v_photo.visited_at, jsonb_build_object('label', '写真を追加', 'spot_name', v_photo.spot_name)
    );
  end loop;
end;
$$;
