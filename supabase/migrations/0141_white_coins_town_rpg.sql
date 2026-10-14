-- 白コイン・まちづくりRPG。0140 の後に適用する。
-- 残高/街/EXP/履歴は一つのトランザクションで更新。クライアント申告の金額は使わない。
begin;

-- Pin the existing private preview owner once. Renaming another account must
-- never grant access, including when this migration is reapplied.
do $$ begin
  if to_regclass('public.town_builder_access') is null then
    create table public.town_builder_access (
      user_id uuid primary key references auth.users(id) on delete cascade
    );
    insert into public.town_builder_access(user_id)
      select id from auth.users where btrim(raw_user_meta_data->>'display_name')='しゅん';
  end if;
end $$;
alter table public.town_builder_access enable row level security;
drop policy if exists town_access_own on public.town_builder_access;
create policy town_access_own on public.town_builder_access for select to authenticated using (user_id=(select auth.uid()));
revoke all on public.town_builder_access from public,anon,authenticated;
grant select on public.town_builder_access to authenticated;
create or replace function public.has_town_builder_access()
returns boolean language sql stable security invoker set search_path=public as $$
  select auth.uid() is not null and exists(select 1 from public.town_builder_access where user_id=(select auth.uid()))
$$;
revoke all on function public.has_town_builder_access() from public,anon;
grant execute on function public.has_town_builder_access() to authenticated;

create table if not exists public.user_white_coins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  total_earned bigint not null default 0 check (total_earned >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.white_coin_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('starter','login','home_drop','town_build','town_undo','quest','level_up')),
  amount integer not null check (amount <> 0),
  idempotency_key text not null check (length(idempotency_key) between 1 and 200),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index if not exists white_coin_events_user_created_idx on public.white_coin_events(user_id, created_at desc, id desc);
create table if not exists public.user_town_builder (
  user_id uuid primary key references auth.users(id) on delete cascade,
  town jsonb,
  revision integer not null default 0 check (revision >= 0),
  xp integer not null default 0 check (xp >= 0),
  max_level integer not null default 1 check (max_level between 1 and 50),
  claimed_quests text[] not null default '{}',
  undo jsonb not null default '[]',
  daily_date date,
  daily_spent integer not null default 0 check (daily_spent >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.town_builder_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  revision integer not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
alter table public.user_white_coins enable row level security;
alter table public.white_coin_events enable row level security;
alter table public.user_town_builder enable row level security;
alter table public.town_builder_receipts enable row level security;
drop policy if exists white_balance_own on public.user_white_coins;
create policy white_balance_own on public.user_white_coins for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists white_events_own on public.white_coin_events;
create policy white_events_own on public.white_coin_events for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists town_builder_own on public.user_town_builder;
create policy town_builder_own on public.user_town_builder for select to authenticated using (user_id = (select auth.uid()));
grant select on public.user_white_coins, public.white_coin_events, public.user_town_builder to authenticated;
revoke all on public.town_builder_receipts from anon, authenticated;
revoke insert, update, delete on public.user_white_coins, public.white_coin_events, public.user_town_builder from anon, authenticated;

create or replace function public.add_white_coin_event(p_user_id uuid, p_event_type text, p_amount integer, p_key text, p_metadata jsonb default '{}')
returns boolean language plpgsql security definer set search_path = public as $$
declare v_balance integer;
begin
  if p_amount is null or p_amount = 0 then return false; end if;
  insert into public.user_white_coins(user_id) values(p_user_id) on conflict do nothing;
  select balance into v_balance from public.user_white_coins where user_id = p_user_id for update;
  -- Idempotency comes before the funds check: a retry is harmless even after later spending.
  if exists(select 1 from public.white_coin_events where user_id=p_user_id and idempotency_key=p_key) then return false; end if;
  if v_balance::bigint + p_amount < 0 then raise exception 'WHITE_COINS_SHORT'; end if;
  if v_balance::bigint + p_amount > 2000000000 then raise exception 'WHITE_COINS_LIMIT'; end if;
  insert into public.white_coin_events(user_id,event_type,amount,idempotency_key,metadata) values(p_user_id,p_event_type,p_amount,p_key,coalesce(p_metadata,'{}'));
  update public.user_white_coins set balance=balance+p_amount,total_earned=total_earned+greatest(p_amount,0),updated_at=now() where user_id=p_user_id;
  return true;
end $$;
revoke all on function public.add_white_coin_event(uuid,text,integer,text,jsonb) from public, anon, authenticated;

create or replace function public.town_level_xp(p_level integer)
returns integer language sql immutable set search_path=public as $$
  select (greatest(1,least(50,p_level))-1)*100 + (greatest(1,least(50,p_level))-1)*(greatest(1,least(50,p_level))-2)*25
$$;
create or replace function public.town_level(p_xp integer)
returns integer language sql immutable set search_path=public as $$
  select max(l) from generate_series(1,50) l where public.town_level_xp(l) <= greatest(0,p_xp)
$$;

-- The catalog below is shared with src/lib/games/town-builder.ts / town-progression.ts.
create or replace function public.town_part_catalog()
returns table(scope text,part text,price integer,layer text,value integer,kinds text[]) language sql immutable set search_path=public as $$
values
('park','tree',70,'object',3,array[]::text[]),
('park','flowers',60,'object',2,array[]::text[]),
('park','bench',80,'object',2,array[]::text[]),
('park','fountain',180,'object',3,array[]::text[]),
('park','playground',240,'object',4,array[]::text[]),
('park','path',25,'ground',0,array[]::text[]),
('park','light',90,'object',1,array[]::text[]),
('park','cherry',130,'object',4,array[]::text[]),
('park','pine',90,'object',3,array[]::text[]),
('park','hedge',65,'object',2,array[]::text[]),
('park','arch',180,'object',4,array[]::text[]),
('park','swings',220,'object',4,array[]::text[]),
('park','sandbox',120,'object',3,array[]::text[]),
('park','picnic',150,'object',3,array[]::text[]),
('park','gazebo',320,'object',5,array[]::text[]),
('park','trash',45,'object',1,array[]::text[]),
('park','bikeRack',100,'object',2,array[]::text[]),
('park','pond',260,'object',4,array[]::text[]),
('park','sculpture',210,'object',3,array[]::text[]),
('park','clock',190,'object',2,array[]::text[]),
('park','stones',40,'ground',0,array[]::text[]),
('facility','garden',90,'object',0,array['house','shop']::text[]),
('facility','terrace',220,'object',0,array['house','shop']::text[]),
('facility','light',70,'object',0,array['house','shop','station','road']::text[]),
('facility','sign',120,'object',0,array['shop']::text[]),
('facility','storage',220,'object',0,array['factory']::text[]),
('facility','greenbelt',140,'object',0,array['factory']::text[]),
('facility','solar',260,'object',0,array['factory']::text[]),
('facility','bench',90,'object',0,array['station']::text[]),
('facility','vending',160,'object',0,array['shop','station']::text[]),
('facility','canopy',180,'object',0,array['house','shop']::text[]),
('facility','planter',80,'object',0,array['house','shop','station']::text[])
$$;
revoke all on function public.town_part_catalog() from public,anon,authenticated;

create or replace function public.town_quest_catalog()
returns table(id text,title text,level integer,target integer,coins integer,xp integer) language sql immutable set search_path=public as $$
values
('roads','街の道しるべ',1,10,300,40),
('homes','おかえりの灯り',1,5,600,80),
('shop','最初のお店',1,1,250,30),
('park','木陰でひと休み',2,1,400,60),
('parts','小さなこだわり',2,8,500,80),
('people','100人の物語',2,100,800,120),
('upgrade','空へ、一歩',3,1,400,100),
('equipment','暮らしの職人',3,5,600,100),
('rails','レールの向こうへ',3,12,500,80),
('railway','出発進行！',3,2,1500,200),
('factory','ものづくりの街',4,2,700,120),
('green','緑をめぐる散歩道',4,3,1200,180),
('variety','庭づくりの達人',5,10,1000,180),
('skyline','街の新しいシンボル',5,1,1000,200),
('residents','300人のおかえり',6,300,1800,250),
('city','ぼくらの小さな都市',8,500,3000,400),
('metropolis','1000人のふるさと',10,1000,5000,650),
('master','空を彩る街並み',12,10,6000,800)
$$;
revoke all on function public.town_quest_catalog() from public,anon,authenticated;

create or replace function public.town_lot_price(p_lot jsonb)
returns integer language sql immutable set search_path=public as $$
  select case (p_lot->>'width')::integer * (p_lot->>'height')::integer when 1 then 140 when 4 then 580 when 9 then 1150 when 12 then 1500 else 0 end
$$;

create or replace function public.town_starter_layout(p_starter boolean)
returns jsonb language plpgsql immutable set search_path=public as $$
declare terrain boolean[]:='{}'; tiles text[]:='{}'; levels integer[]:='{}'; parks jsonb:='[]'; i integer; x integer; y integer; water boolean; item record;
begin
  for i in 0..575 loop
    x:=i%24; y:=i/24; water:=abs(x-(18+sin(y*.32)*1.4))<1.35;
    terrain:=array_append(terrain,water); tiles:=array_append(tiles,case when water then 'water' else 'grass' end);
  end loop;
  if p_starter then
    for x in 6..13 loop tiles[10*24+x+1]:='road'; end loop;
    for y in 7..14 loop tiles[y*24+10]:='road'; end loop;
    for item in select * from (values(7,9,'house'),(8,11,'house'),(10,8,'house'),(10,12,'shop')) v(x,y,kind) loop tiles[item.y*24+item.x+1]:=item.kind; end loop;
    for y in 7..8 loop for x in 7..8 loop tiles[y*24+x+1]:='park'; end loop; end loop;
    parks:='[{"id":175,"x":7,"y":7,"width":2,"height":2,"kind":"park","parts":[{"tile":175,"kind":"tree","rotation":0},{"tile":176,"kind":"bench","rotation":0},{"tile":199,"kind":"flowers","rotation":0},{"tile":200,"kind":"path","rotation":0}]}]'::jsonb;
  end if;
  for i in 1..576 loop levels:=array_append(levels,case when tiles[i] in ('house','shop','factory') then 1 else 0 end); end loop;
  return jsonb_build_object('tiles',tiles,'terrain',terrain,'levels',levels,'money',20000,'day',1,'paused',false,'rewards','[]'::jsonb,'parks',parks,'attachments','[]'::jsonb);
end $$;

/** Validate all geometry and compute the price of additions using the database catalog. */
create or replace function public.town_construction_cost(p_before jsonb,p_after jsonb,p_import boolean default false)
returns integer language plpgsql set search_path=public as $$
declare
  v_cost integer:=0; i integer; j integer; k integer; x integer; y integer; w integer; h integer; n integer;
  t text; b text; l integer; old_l integer; lot jsonb; old_lot jsonb; v_part jsonb; a jsonb; old_a jsonb; info record;
  used integer[]:='{}'; keys text[]; key text; id integer; covered integer[]:='{}';
begin
  if p_after is null or jsonb_typeof(p_after) <> 'object' or octet_length(p_after::text)>131072
    or jsonb_typeof(p_after->'tiles') is distinct from 'array' or jsonb_array_length(p_after->'tiles')<>576
    or jsonb_typeof(p_after->'levels') is distinct from 'array' or jsonb_array_length(p_after->'levels')<>576
    or jsonb_typeof(p_after->'terrain') is distinct from 'array' or jsonb_array_length(p_after->'terrain')<>576
    or jsonb_typeof(p_after->'parks') is distinct from 'array' or jsonb_array_length(p_after->'parks')>144
    or jsonb_typeof(p_after->'attachments') is distinct from 'array' or jsonb_array_length(p_after->'attachments')>576
    or jsonb_typeof(p_after->'day') is distinct from 'number' or coalesce(p_after->>'day','')!~'^[0-9]{1,10}$' or (p_after->>'day')::bigint not between 1 and 1000000000
    or jsonb_typeof(p_after->'paused') is distinct from 'boolean'
    or (p_before is not null and p_before->'terrain' is distinct from p_after->'terrain') then raise exception 'INVALID_TOWN'; end if;
  for i in 0..575 loop
    t:=p_after->'tiles'->>i; b:=coalesce(p_before->'tiles'->>i,'grass');
    if t is null or t not in ('grass','water','road','rail','station','house','shop','factory','park')
       or jsonb_typeof(p_after->'levels'->i) is distinct from 'number' or coalesce(p_after->'levels'->>i,'') !~ '^[0-3]$' or jsonb_typeof(p_after->'terrain'->i) is distinct from 'boolean' then raise exception 'INVALID_TOWN'; end if;
    l:=(p_after->'levels'->>i)::integer;
    if (t in ('house','shop','factory') and l=0) or (t not in ('house','shop','factory') and l<>0) then raise exception 'INVALID_TOWN'; end if;
    if (p_after->'terrain'->>i)::boolean and t not in ('water','road','rail') then raise exception 'INVALID_TOWN'; end if;
    if not (p_after->'terrain'->>i)::boolean and t='water' then raise exception 'INVALID_TOWN'; end if;
    if t in ('house','shop','factory') and (t<>b or l>coalesce((p_before->'levels'->>i)::integer,0)) and not p_import then
      if not ((i%24>0 and p_after->'tiles'->>(i-1)='road') or (i%24<23 and p_after->'tiles'->>(i+1)='road') or (i>=24 and p_after->'tiles'->>(i-24)='road') or (i<552 and p_after->'tiles'->>(i+24)='road')) then raise exception 'TOWN_ROAD_REQUIRED'; end if;
    end if;
    if t<>b then
      v_cost:=v_cost+case t when 'road' then case when (p_after->'terrain'->>i)::boolean then 120 else 35 end when 'rail' then case when (p_after->'terrain'->>i)::boolean then 160 else 55 end when 'station' then 550 when 'house' then 250 when 'shop' then 400 when 'factory' then 650 else 0 end;
    end if;
    if t in ('house','shop','factory') then
      old_l:=case when t=b then coalesce((p_before->'levels'->>i)::integer,1) else 1 end;
      if l>old_l then for j in old_l..l-1 loop v_cost:=v_cost+j*450; end loop; end if;
    end if;
  end loop;
  for lot in select value from jsonb_array_elements(p_after->'parks') loop
    if jsonb_typeof(lot) <> 'object' then raise exception 'INVALID_TOWN'; end if;
    if exists(select 1 from unnest(array['id','x','y','width','height']) f where jsonb_typeof(lot->f) is distinct from 'number' or coalesce(lot->>f,'')!~'^[0-9]{1,3}$') then raise exception 'INVALID_TOWN'; end if;
    x:=(lot->>'x')::integer; y:=(lot->>'y')::integer; w:=(lot->>'width')::integer; h:=(lot->>'height')::integer; id:=(lot->>'id')::integer;
    select value into old_lot from jsonb_array_elements(coalesce(p_before->'parks','[]')) where (value->>'id')::integer=id;
    if x is null or y is null or w is null or h is null or id is null or x<0 or y<0 or x+w>24 or y+h>24 or id<>y*24+x or id=any(used)
      or not ((w=2 and h=2) or (w=3 and h=3) or (w=4 and h=3) or (w=3 and h=4) or (w=1 and h=1 and (p_import or old_lot is not null)))
      or coalesce(lot->>'kind','') not in ('park','plaza') or jsonb_typeof(lot->'parts') is distinct from 'array' or jsonb_array_length(lot->'parts')>w*h*2 then raise exception 'INVALID_TOWN'; end if;
    used:=array_append(used,id);
    for j in 0..h-1 loop for k in 0..w-1 loop
      i:=(y+j)*24+x+k;
      if i=any(covered) or p_after->'tiles'->>i<>'park' or (p_after->'terrain'->>i)::boolean then raise exception 'INVALID_TOWN'; end if;
      covered:=array_append(covered,i);
    end loop; end loop;
    v_cost:=v_cost+greatest(0,public.town_lot_price(lot)-coalesce(public.town_lot_price(old_lot),0));
    keys:='{}';
    for v_part in select value from jsonb_array_elements(lot->'parts') loop
      select * into info from public.town_part_catalog() c where c.scope='park' and c.part=v_part->>'kind';
      if not found then raise exception 'INVALID_TOWN'; end if;
      if jsonb_typeof(v_part->'tile') is distinct from 'number' or coalesce(v_part->>'tile','')!~'^[0-9]{1,3}$' or jsonb_typeof(v_part->'rotation') is distinct from 'number' then raise exception 'INVALID_TOWN'; end if;
      i:=(v_part->>'tile')::integer;
      key:=i::text||':'||info.layer;
      if i is null or i%24<x or i%24>=x+w or i/24<y or i/24>=y+h or coalesce(v_part->>'rotation','')!~'^[0-3]$' or key=any(keys) then raise exception 'INVALID_TOWN'; end if;
      keys:=array_append(keys,key);
      if not exists(select 1 from jsonb_array_elements(coalesce(old_lot->'parts','[]')) e where e->>'kind'=v_part->>'kind' and e->>'tile'=v_part->>'tile') then v_cost:=v_cost+info.price; end if;
    end loop;
  end loop;
  if exists(select 1 from generate_series(0,575) series(cell) where p_after->'tiles'->>series.cell='park' and not series.cell=any(covered)) then raise exception 'INVALID_TOWN'; end if;
  used:='{}';
  for a in select value from jsonb_array_elements(p_after->'attachments') loop
    if jsonb_typeof(a->'tile') is distinct from 'number' or coalesce(a->>'tile','')!~'^[0-9]{1,3}$' then raise exception 'INVALID_TOWN'; end if;
    i:=(a->>'tile')::integer; t:=a->>'kind';
    if i is null or i not between 0 and 575 or i=any(used) or t is null or p_after->'tiles'->>i<>t or jsonb_typeof(a->'parts') is distinct from 'array' or jsonb_array_length(a->'parts')>11 then raise exception 'INVALID_TOWN'; end if;
    used:=array_append(used,i); keys:='{}';
    select value into old_a from jsonb_array_elements(coalesce(p_before->'attachments','[]')) e where (e->>'tile')::integer=i and e->>'kind'=t;
    for key in select jsonb_array_elements_text(a->'parts') loop
      select * into info from public.town_part_catalog() c where c.scope='facility' and c.part=key;
      if not found or not t=any(info.kinds) or key=any(keys) then raise exception 'INVALID_TOWN'; end if;
      keys:=array_append(keys,key);
      if not coalesce(old_a->'parts','[]') ? key then v_cost:=v_cost+info.price; end if;
    end loop;
  end loop;
  return v_cost;
end $$;

create or replace function public.town_quest_metric(p_town jsonb,p_id text)
returns integer language plpgsql stable set search_path=public as $$
declare v_count integer:=0; i integer; t text; extras integer; lot jsonb; stations integer[]; start_i integer; current_i integer; queue integer[]; seen integer[]; n integer; linked integer[]:='{}';
begin
  if p_town is null then return 0; end if;
  if p_id in ('roads','homes','shop','rails','factory') then
    select count(*) into v_count from jsonb_array_elements_text(p_town->'tiles') e where e=case p_id when 'roads' then 'road' when 'homes' then 'house' when 'shop' then 'shop' when 'rails' then 'rail' else 'factory' end;
  elsif p_id in ('park','green') then
    for lot in select value from jsonb_array_elements(p_town->'parks') loop
      if exists(select 1 from jsonb_array_elements(lot->'parts') e join public.town_part_catalog() c on c.scope='park' and c.part=e->>'kind' where c.value>=2) then v_count:=v_count+1; end if;
    end loop;
  elsif p_id='parts' then select coalesce(sum(jsonb_array_length(e->'parts')),0) into v_count from jsonb_array_elements(p_town->'parks') e;
  elsif p_id='equipment' then select coalesce(sum(jsonb_array_length(e->'parts')),0) into v_count from jsonb_array_elements(p_town->'attachments') e;
  elsif p_id='variety' then select count(distinct p->>'kind') into v_count from jsonb_array_elements(p_town->'parks') l cross join lateral jsonb_array_elements(l->'parts') p;
  elsif p_id in ('upgrade','skyline','master') then
    select count(*) into v_count from generate_series(0,575) idx(cell) where p_town->'tiles'->>idx.cell in ('house','shop','factory') and (p_town->'levels'->>idx.cell)::integer>=case when p_id='upgrade' then 2 else 3 end;
  elsif p_id in ('people','residents','city','metropolis') then
    for i in 0..575 loop
      if p_town->'tiles'->>i='house' and ((i%24>0 and p_town->'tiles'->>(i-1)='road') or (i%24<23 and p_town->'tiles'->>(i+1)='road') or (i>=24 and p_town->'tiles'->>(i-24)='road') or (i<552 and p_town->'tiles'->>(i+24)='road')) then
        select count(*)*6 into extras from jsonb_array_elements(p_town->'attachments') a where (a->>'tile')::integer=i and a->'parts' ? 'terrace';
        v_count:=v_count+(p_town->'levels'->>i)::integer*18+extras;
      end if;
    end loop;
  elsif p_id='railway' then
    select array_agg(idx.cell) into stations from generate_series(0,575) idx(cell) where p_town->'tiles'->>idx.cell='station';
    foreach start_i in array coalesce(stations,'{}') loop
      queue:=array[start_i]; seen:=queue;
      while cardinality(queue)>0 loop
        current_i:=queue[1]; queue:=queue[2:];
        for n in select q from unnest(array[case when current_i%24>0 then current_i-1 end,case when current_i%24<23 then current_i+1 end,case when current_i>=24 then current_i-24 end,case when current_i<552 then current_i+24 end]) q where q is not null loop
          if n=any(seen) then continue; end if;
          t:=p_town->'tiles'->>n;
          if t not in ('rail','station') then continue; end if;
          seen:=array_append(seen,n);
          if t='station' then
            if current_i<>start_i then linked:=array_append(array_append(linked,start_i),n); end if;
          else queue:=array_append(queue,n); end if;
        end loop;
      end loop;
    end loop;
    select count(distinct q) into v_count from unnest(linked) q;
  end if;
  return v_count;
end $$;

create or replace function public.claim_white_login_bonus()
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); d date:=(timezone('Asia/Tokyo',now()))::date; applied boolean;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  applied:=public.add_white_coin_event(u,'login',500,'login:'||d::text,jsonb_build_object('label','毎日の白コイン','date',d));
  return jsonb_build_object('granted',applied,'amount',case when applied then 500 else 0 end,'date',d);
end $$;
revoke all on function public.claim_white_login_bonus() from public,anon;
grant execute on function public.claim_white_login_bonus() to authenticated;

create or replace function public.get_town_builder()
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); r public.user_town_builder%rowtype; b integer; d date:=(timezone('Asia/Tokyo',now()))::date;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.town_builder_access where user_id=u) then raise exception 'TOWN_NOT_ALLOWED'; end if;
  select * into r from public.user_town_builder where user_id=u;
  select balance into b from public.user_white_coins where user_id=u;
  return jsonb_build_object('town',case when r.town is null then null else jsonb_set(r.town,'{money}',to_jsonb(coalesce(b,0))) end,'balance',coalesce(b,0),'revision',coalesce(r.revision,0),'xp',coalesce(r.xp,0),'maxLevel',coalesce(r.max_level,1),'claimedQuests',coalesce(r.claimed_quests,'{}'::text[]),'canUndo',coalesce(jsonb_array_length(r.undo)>0,false),'date',d,'dailySpent',case when r.daily_date=d then r.daily_spent else 0 end,'dailyClaimed',exists(select 1 from public.white_coin_events where user_id=u and idempotency_key='login:'||d::text),'dailyQuestClaimed',exists(select 1 from public.white_coin_events where user_id=u and idempotency_key='quest:daily:'||d::text));
end $$;
revoke all on function public.get_town_builder() from public,anon;
grant execute on function public.get_town_builder() to authenticated;

create or replace function public.commit_town_builder(p_request_id uuid,p_revision integer,p_action text,p_town jsonb default null,p_quest text default null,p_import boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); r public.user_town_builder%rowtype; cost integer:=0; gain integer:=0; lv integer; q record; prev jsonb; d date:=(timezone('Asia/Tokyo',now()))::date; entry jsonb; dummy integer;
begin
  if u is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.town_builder_access where user_id=u) then raise exception 'TOWN_NOT_ALLOWED'; end if;
  if p_request_id is null or p_revision is null or p_revision<0 or p_import is null or p_action is null or p_action not in ('start','edit','undo','quest','daily','reset') then raise exception 'INVALID_TOWN_ACTION'; end if;
  insert into public.user_town_builder(user_id) values(u) on conflict do nothing;
  select * into r from public.user_town_builder where user_id=u for update;
  if exists(select 1 from public.town_builder_receipts where user_id=u and request_id=p_request_id) then return public.get_town_builder(); end if;
  if r.revision<>p_revision then raise exception 'TOWN_CONFLICT'; end if;
  if p_action='reset' or (p_action='start' and not p_import) then
    if not exists(select 1 from unnest(array[true,false]) starter where
      (p_town-array['money','day','paused','rewards'])=(public.town_starter_layout(starter)-array['money','day','paused','rewards'])) then raise exception 'INVALID_TOWN_STARTER'; end if;
  end if;
  if p_action='start' then
    if r.town is not null then raise exception 'TOWN_ALREADY_STARTED'; end if;
    dummy:=public.town_construction_cost(null,p_town,true);
    r.town:=p_town;
    -- One fixed starter grant per account. Reset and local save values never mint currency.
    perform public.add_white_coin_event(u,'starter',20000,'town-starter',jsonb_build_object('label','街づくりのはじまり支援'));
    if p_import then
      r.xp:=least(5000,dummy/10);
      r.max_level:=public.town_level(r.xp);
    end if;
  elsif r.town is null then raise exception 'TOWN_NOT_STARTED';
  elsif p_action='edit' then
    cost:=public.town_construction_cost(r.town,p_town);
    if r.town->'tiles'=p_town->'tiles' and r.town->'levels'=p_town->'levels' and r.town->'parks'=p_town->'parks' and r.town->'attachments'=p_town->'attachments' then raise exception 'TOWN_NO_CHANGE'; end if;
    gain:=case when cost>0 then greatest(1,cost/10) else 0 end;
    if cost>0 then perform public.add_white_coin_event(u,'town_build',-cost,'town:'||p_request_id::text,jsonb_build_object('label','街の建設・部品購入','xp',gain)); end if;
    entry:=jsonb_build_object('town',r.town,'cost',cost,'xp',gain,'request',p_request_id,'date',d);
    select coalesce(jsonb_agg(e order by ord),'[]') into r.undo from jsonb_array_elements(r.undo||jsonb_build_array(entry)) with ordinality a(e,ord) where ord>greatest(0,jsonb_array_length(r.undo)+1-20);
    r.town:=p_town; r.xp:=r.xp+gain;
    r.daily_spent:=case when r.daily_date=d then r.daily_spent else 0 end+cost; r.daily_date:=d;
  elsif p_action='undo' then
    if jsonb_array_length(r.undo)=0 then raise exception 'TOWN_UNDO_EMPTY'; end if;
    entry:=r.undo->-1; cost:=(entry->>'cost')::integer;
    if cost>0 then perform public.add_white_coin_event(u,'town_undo',cost,'undo:'||(entry->>'request'),jsonb_build_object('label','工事の取り消し')); end if;
    r.town:=entry->'town'; r.xp:=greatest(0,r.xp-(entry->>'xp')::integer); r.undo:=r.undo-(jsonb_array_length(r.undo)-1);
    if r.daily_date=d and entry->>'date'=d::text then r.daily_spent:=greatest(0,r.daily_spent-cost); end if;
  elsif p_action='reset' then
    dummy:=public.town_construction_cost(null,p_town,true); r.town:=p_town; r.undo:='[]';
  elsif p_action='daily' then perform public.claim_white_login_bonus();
  elsif p_action='quest' then
    if p_quest='daily' then
      if r.daily_date is distinct from d or r.daily_spent<500 then raise exception 'TOWN_QUEST_NOT_READY'; end if;
      if public.add_white_coin_event(u,'quest',250,'quest:daily:'||d::text,jsonb_build_object('label','今日の開拓クエスト')) then r.xp:=r.xp+50; end if;
    else
      select * into q from public.town_quest_catalog() c where c.id=p_quest;
      if not found or public.town_level(r.xp)<q.level or public.town_quest_metric(r.town,p_quest)<q.target then raise exception 'TOWN_QUEST_NOT_READY'; end if;
      if not p_quest=any(r.claimed_quests) then
        perform public.add_white_coin_event(u,'quest',q.coins,'quest:'||p_quest,jsonb_build_object('label',q.title||' 達成報酬'));
        r.xp:=r.xp+q.xp; r.claimed_quests:=array_append(r.claimed_quests,p_quest);
      end if;
    end if;
  end if;
  lv:=public.town_level(r.xp);
  if lv>r.max_level then
    for dummy in r.max_level+1..lv loop
      perform public.add_white_coin_event(u,'level_up',200+dummy*50,'town-level:'||dummy::text,jsonb_build_object('label','まちづくりLv.'||dummy::text||' 報酬'));
    end loop;
    r.max_level:=lv;
  end if;
  update public.user_town_builder set town=r.town,revision=r.revision+1,xp=r.xp,max_level=r.max_level,claimed_quests=r.claimed_quests,undo=r.undo,daily_date=r.daily_date,daily_spent=r.daily_spent,updated_at=now() where user_id=u;
  insert into public.town_builder_receipts(user_id,request_id,revision) values(u,p_request_id,r.revision+1);
  return public.get_town_builder();
end $$;
revoke all on function public.commit_town_builder(uuid,integer,text,jsonb,text,boolean) from public,anon;
grant execute on function public.commit_town_builder(uuid,integer,text,jsonb,text,boolean) to authenticated;

-- Neither the validators nor catalog helpers are an externally writable economy API.
revoke all on function public.town_construction_cost(jsonb,jsonb,boolean),public.town_quest_metric(jsonb,text),public.town_lot_price(jsonb),public.town_level(integer),public.town_level_xp(integer),public.town_starter_layout(boolean) from public,anon,authenticated;

-- Preserve all existing yellow / blue / red rewards exactly as implemented in 0140.
do $$ begin
  if to_regprocedure('public.claim_login_bonus_before_white()') is null then
    alter function public.claim_login_bonus() rename to claim_login_bonus_before_white;
  end if;
end $$;
revoke all on function public.claim_login_bonus_before_white() from public,anon,authenticated;
create or replace function public.claim_login_bonus()
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; white jsonb;
begin
  result:=public.claim_login_bonus_before_white();
  white:=public.claim_white_login_bonus();
  return result || jsonb_build_object('white_amount',(white->>'amount')::integer);
end $$;
revoke all on function public.claim_login_bonus() from public,anon;
grant execute on function public.claim_login_bonus() to authenticated;
create or replace function public.claim_home_coin_drop(p_drop_id text, p_kind text, p_tier text default 'common')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (timezone('Asia/Tokyo', now()))::date;
  v_tier text;
  v_amount integer;
  v_key text;
  v_last timestamptz;
  v_tier_count integer;
  v_tier_limit integer;
  v_applied boolean;
  v_balance integer;
  v_blue_balance integer;
  v_red_balance integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_drop_id is null or p_drop_id !~ '^[A-Za-z0-9_-]{8,64}$' then raise exception 'Invalid drop id'; end if;
  if p_kind is null or p_kind not in ('coin', 'blue', 'red', 'white') then raise exception 'Invalid coin kind'; end if;
  if p_tier is null or p_tier not in ('common', 'rare', 'epic') then raise exception 'Invalid coin tier'; end if;

  -- 同じ人の受け取りを1つずつ数える
  perform pg_advisory_xact_lock(hashtext('home_drop:' || v_user_id::text));

  v_key := 'home-drop:' || p_drop_id;

  -- 同じコインの再送は受け取らない（3色のどの台帳にあっても）
  if exists (select 1 from public.coin_events where user_id = v_user_id and idempotency_key = v_key)
     or exists (select 1 from public.blue_coin_events where user_id = v_user_id and idempotency_key = v_key)
     or exists (select 1 from public.red_coin_events where user_id = v_user_id and idempotency_key = v_key)
     or exists (select 1 from public.white_coin_events where user_id = v_user_id and idempotency_key = v_key) then
    return jsonb_build_object('ok', true, 'granted', false, 'reason', 'duplicate');
  end if;

  -- 前の受け取りから 8 秒（黄色・青・赤のどれでも）
  select max(created_at) into v_last
    from public.coin_events
   where user_id = v_user_id and event_type = 'home_drop' and created_at > now() - interval '1 minute';
  select greatest(v_last, max(created_at)) into v_last
    from public.blue_coin_events
   where user_id = v_user_id and event_type = 'home_drop' and created_at > now() - interval '1 minute';
  select greatest(v_last, max(created_at)) into v_last
    from public.red_coin_events
   where user_id = v_user_id and event_type = 'home_drop' and created_at > now() - interval '1 minute';
  select greatest(v_last, max(created_at)) into v_last from public.white_coin_events where user_id=v_user_id and event_type='home_drop' and created_at>now()-interval '1 minute';
  if v_last is not null and v_last > now() - interval '8 seconds' then
    return jsonb_build_object('ok', true, 'granted', false, 'reason', 'too_soon');
  end if;

  -- レア度ごとの、直近1時間の回数（3色あわせて）。超えたら、ふつうとして渡す
  v_tier := p_tier;
  if v_tier <> 'common' then
    select
      (select count(*) from public.coin_events
        where user_id = v_user_id and event_type = 'home_drop'
          and created_at > now() - interval '1 hour' and metadata->>'tier' = v_tier)
      + (select count(*) from public.blue_coin_events
        where user_id = v_user_id and event_type = 'home_drop'
          and created_at > now() - interval '1 hour' and metadata->>'tier' = v_tier)
      + (select count(*) from public.red_coin_events
        where user_id = v_user_id and event_type = 'home_drop'
          and created_at > now() - interval '1 hour' and metadata->>'tier' = v_tier)
      + (select count(*) from public.white_coin_events where user_id=v_user_id and event_type='home_drop' and created_at>now()-interval '1 hour' and metadata->>'tier'=v_tier)
      into v_tier_count;
    v_tier_limit := (case v_tier when 'epic' then 8 else 30 end);
    if v_tier_count >= v_tier_limit then
      v_tier := 'common';
    end if;
  end if;

  v_amount := case v_tier when 'epic' then 100 when 'rare' then 20 else 5 end;

  if p_kind = 'white' then
    v_applied := public.add_white_coin_event(v_user_id,'home_drop',v_amount,v_key,jsonb_build_object('label','ホームで拾った白コイン','drop_id',p_drop_id,'tier',v_tier));
  elsif p_kind = 'red' then
    v_applied := public.add_red_coin_event(
      v_user_id, 'home_drop', v_amount, v_key,
      jsonb_build_object('label', 'ホームで拾った赤コイン', 'drop_id', p_drop_id, 'tier', v_tier)
    );
  elsif p_kind = 'blue' then
    v_applied := public.add_blue_coin_event(
      v_user_id, 'home_drop', v_amount, v_key,
      jsonb_build_object('label', 'ホームで拾った青コイン', 'drop_id', p_drop_id, 'tier', v_tier)
    );
  else
    v_applied := public.add_coin_event(
      v_user_id, 'home_drop', v_amount, v_key, null, v_today,
      jsonb_build_object('label', 'ホームで拾ったコイン', 'drop_id', p_drop_id, 'tier', v_tier)
    );
  end if;

  select balance into v_balance from public.user_coins where user_id = v_user_id;
  select balance into v_blue_balance from public.user_blue_coins where user_id = v_user_id;
  select balance into v_red_balance from public.user_red_coins where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'granted', v_applied,
    'kind', p_kind,
    'tier', v_tier,
    'amount', case when v_applied then v_amount else 0 end,
    'balance', coalesce(v_balance, 0),
    'blue_balance', coalesce(v_blue_balance, 0),
    'red_balance', coalesce(v_red_balance, 0),
    'white_balance', coalesce((select balance from public.user_white_coins where user_id=v_user_id),0)
  );
end;
$$;

revoke all on function public.claim_home_coin_drop(text, text, text) from public, anon;
grant execute on function public.claim_home_coin_drop(text, text, text) to authenticated;

notify pgrst, 'reload schema';
commit;
