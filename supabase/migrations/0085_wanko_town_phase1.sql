-- =============================================================
-- わんこタウン 第1段階
-- =============================================================
-- 建物カタログ、ユーザーごとの素材・成長状態、所有建物を分離して保存する。
-- 建築・移動・収納はすべてRPCを通し、素材消費と配置判定を同一トランザクションで行う。

begin;

create table if not exists public.town_catalog_items (
  id text primary key,
  name text not null,
  category text not null check (category in ('building', 'facility', 'decor', 'road', 'nature')),
  grid_width integer not null check (grid_width between 1 and 6),
  grid_height integer not null check (grid_height between 1 and 6),
  unlock_level integer not null default 1 check (unlock_level between 1 and 100),
  cost jsonb not null default '{}'::jsonb check (jsonb_typeof(cost) = 'object'),
  exp_reward integer not null default 0 check (exp_reward between 0 and 10000),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_towns (
  user_id uuid primary key references auth.users(id) on delete cascade,
  town_name text not null default 'わんこタウン' check (char_length(town_name) between 1 and 30),
  town_level integer not null default 1 check (town_level between 1 and 100),
  town_exp integer not null default 0 check (town_exp >= 0),
  unlocked_areas text[] not null default array['core']::text[],
  materials jsonb not null default '{"wood":700,"stone":360,"flower":180,"shell":120,"iron":80}'::jsonb
    check (jsonb_typeof(materials) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_town_items (
  instance_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null references public.town_catalog_items(id),
  grid_x integer not null check (grid_x between 0 and 13),
  grid_y integer not null check (grid_y between 0 and 13),
  rotation smallint not null default 0 check (rotation in (0, 90, 180, 270)),
  is_placed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_town_items_user_placed_idx
  on public.user_town_items(user_id, is_placed, created_at);
create index if not exists user_town_items_user_item_idx
  on public.user_town_items(user_id, item_id);

alter table public.town_catalog_items enable row level security;
alter table public.user_towns enable row level security;
alter table public.user_town_items enable row level security;

create or replace function public.town_access_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and btrim(coalesce(p.display_name, '')) = 'しゅん'
  );
$;

drop policy if exists town_catalog_items_select on public.town_catalog_items;
create policy town_catalog_items_select on public.town_catalog_items
  for select to authenticated
  using (active = true and public.town_access_allowed());

drop policy if exists user_towns_select_own on public.user_towns;
create policy user_towns_select_own on public.user_towns
  for select to authenticated
  using (user_id = auth.uid() and public.town_access_allowed());

drop policy if exists user_town_items_select_own on public.user_town_items;
create policy user_town_items_select_own on public.user_town_items
  for select to authenticated
  using (user_id = auth.uid() and public.town_access_allowed());

-- クライアントは参照のみ。書き込みは下のSECURITY DEFINER RPCだけに限定する。
grant select on public.town_catalog_items, public.user_towns, public.user_town_items to authenticated;

drop trigger if exists town_catalog_items_set_updated_at on public.town_catalog_items;
create trigger town_catalog_items_set_updated_at
before update on public.town_catalog_items
for each row execute function public.set_updated_at();

drop trigger if exists user_towns_set_updated_at on public.user_towns;
create trigger user_towns_set_updated_at
before update on public.user_towns
for each row execute function public.set_updated_at();

drop trigger if exists user_town_items_set_updated_at on public.user_town_items;
create trigger user_town_items_set_updated_at
before update on public.user_town_items
for each row execute function public.set_updated_at();

-- 第1段階の5種類。見た目はアプリ側で描画し、ゲームルールとなるサイズ・費用はDBを正とする。
insert into public.town_catalog_items (
  id, name, category, grid_width, grid_height, unlock_level, cost, exp_reward, sort_order, active
) values
  (
    'town-hall', 'タウンホール', 'building', 3, 3, 1,
    '{"wood":80,"stone":60,"flower":0,"shell":0,"iron":20}'::jsonb, 80, 10, true
  ),
  (
    'dog-cafe', 'ドッグカフェ', 'building', 2, 2, 1,
    '{"wood":120,"stone":80,"flower":40,"shell":0,"iron":0}'::jsonb, 65, 20, true
  ),
  (
    'bakery', 'ベーカリー', 'building', 2, 2, 1,
    '{"wood":100,"stone":60,"flower":50,"shell":0,"iron":0}'::jsonb, 60, 30, true
  ),
  (
    'dog-run', 'ドッグラン', 'facility', 3, 2, 2,
    '{"wood":90,"stone":0,"flower":30,"shell":0,"iron":10}'::jsonb, 75, 40, true
  ),
  (
    'hot-spring', '温泉', 'facility', 3, 3, 3,
    '{"wood":150,"stone":100,"flower":0,"shell":30,"iron":20}'::jsonb, 110, 50, true
  )
on conflict (id) do update
set name = excluded.name,
    category = excluded.category,
    grid_width = excluded.grid_width,
    grid_height = excluded.grid_height,
    unlock_level = excluded.unlock_level,
    cost = excluded.cost,
    exp_reward = excluded.exp_reward,
    sort_order = excluded.sort_order,
    active = excluded.active,
    updated_at = now();

create or replace function public.town_level_of(p_exp integer)
returns integer
language sql
immutable
strict
set search_path = public
as $$
  select case
    when p_exp >= 800 then 5
    when p_exp >= 520 then 4
    when p_exp >= 300 then 3
    when p_exp >= 140 then 2
    else 1
  end;
$$;

-- 14×14の論理グリッド。第1段階は中央8×8だけを開放し、周囲を4方向の拡張候補として予約する。
create or replace function public.town_cell_is_unlocked(
  p_areas text[],
  p_x integer,
  p_y integer
)
returns boolean
language sql
immutable
strict
set search_path = public
as $$
  select
    (p_x between 2 and 11 and p_y between 2 and 11 and 'core' = any(p_areas))
    or (p_x between 2 and 11 and p_y between 0 and 1 and 'north' = any(p_areas))
    or (p_x between 12 and 13 and p_y between 2 and 11 and 'east' = any(p_areas))
    or (p_x between 2 and 11 and p_y between 12 and 13 and 'south' = any(p_areas))
    or (p_x between 0 and 1 and p_y between 2 and 11 and 'west' = any(p_areas));
$$;

create or replace function public.town_snapshot(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'town', jsonb_build_object(
      'townName', t.town_name,
      'townLevel', t.town_level,
      'townExp', t.town_exp,
      'unlockedAreas', to_jsonb(t.unlocked_areas),
      'materials', t.materials,
      'updatedAt', t.updated_at
    ),
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'instanceId', i.instance_id,
            'itemId', i.item_id,
            'gridX', i.grid_x,
            'gridY', i.grid_y,
            'rotation', i.rotation,
            'isPlaced', i.is_placed,
            'createdAt', i.created_at
          )
          order by i.created_at, i.instance_id
        )
        from public.user_town_items i
        where i.user_id = p_user_id
      ),
      '[]'::jsonb
    )
  )
  from public.user_towns t
  where t.user_id = p_user_id;
$$;

create or replace function public.get_or_create_town()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not public.town_access_allowed() then
    raise exception using errcode = 'P0002', message = 'TOWN_NOT_FOUND';
  end if;

  insert into public.user_towns (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  return public.town_snapshot(v_user_id);
end;
$$;

create or replace function public.town_can_place(
  p_user_id uuid,
  p_grid_x integer,
  p_grid_y integer,
  p_grid_width integer,
  p_grid_height integer,
  p_rotation integer,
  p_category text,
  p_exclude_instance uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_width integer;
  v_height integer;
  v_padding integer;
  v_areas text[];
  v_collision boolean;
begin
  if p_rotation not in (0, 90, 180, 270) then return false; end if;

  if p_rotation in (90, 270) then
    v_width := p_grid_height;
    v_height := p_grid_width;
  else
    v_width := p_grid_width;
    v_height := p_grid_height;
  end if;

  v_padding := case when p_category in ('building', 'facility') then 1 else 0 end;

  if p_grid_x - v_padding < 0
    or p_grid_y - v_padding < 0
    or p_grid_x + v_width + v_padding > 14
    or p_grid_y + v_height + v_padding > 14
  then
    return false;
  end if;

  select t.unlocked_areas into v_areas
  from public.user_towns t
  where t.user_id = p_user_id;

  if v_areas is null then return false; end if;

  if exists (
    select 1
    from generate_series(p_grid_x - v_padding, p_grid_x + v_width + v_padding - 1) as gx
    cross join generate_series(p_grid_y - v_padding, p_grid_y + v_height + v_padding - 1) as gy
    where not public.town_cell_is_unlocked(v_areas, gx, gy)
  ) then
    return false;
  end if;

  select exists (
    select 1
    from public.user_town_items i
    join public.town_catalog_items c on c.id = i.item_id
    where i.user_id = p_user_id
      and i.is_placed
      and (p_exclude_instance is null or i.instance_id <> p_exclude_instance)
      and p_grid_x
        - case
            when p_category in ('building', 'facility')
              and c.category in ('building', 'facility') then 1
            else 0
          end
        < i.grid_x + (case when i.rotation in (90, 270) then c.grid_height else c.grid_width end)
      and p_grid_x + v_width
        + case
            when p_category in ('building', 'facility')
              and c.category in ('building', 'facility') then 1
            else 0
          end
        > i.grid_x
      and p_grid_y
        - case
            when p_category in ('building', 'facility')
              and c.category in ('building', 'facility') then 1
            else 0
          end
        < i.grid_y + (case when i.rotation in (90, 270) then c.grid_width else c.grid_height end)
      and p_grid_y + v_height
        + case
            when p_category in ('building', 'facility')
              and c.category in ('building', 'facility') then 1
            else 0
          end
        > i.grid_y
  ) into v_collision;

  return not coalesce(v_collision, false);
end;
$$;

create or replace function public.build_town_item(
  p_item_id text,
  p_grid_x integer,
  p_grid_y integer,
  p_rotation integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_town public.user_towns%rowtype;
  v_item public.town_catalog_items%rowtype;
  v_wood integer;
  v_stone integer;
  v_flower integer;
  v_shell integer;
  v_iron integer;
  v_cost_wood integer;
  v_cost_stone integer;
  v_cost_flower integer;
  v_cost_shell integer;
  v_cost_iron integer;
  v_new_exp integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not public.town_access_allowed() then
    raise exception using errcode = 'P0002', message = 'TOWN_NOT_FOUND';
  end if;
  if p_rotation not in (0, 90, 180, 270) then
    raise exception using errcode = 'P0001', message = 'INVALID_TOWN_PLACEMENT';
  end if;

  insert into public.user_towns (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select * into v_town
  from public.user_towns
  where user_id = v_user_id
  for update;

  select * into v_item
  from public.town_catalog_items
  where id = p_item_id and active = true;

  if not found then
    raise exception using errcode = 'P0001', message = 'TOWN_ITEM_NOT_FOUND';
  end if;
  if v_item.unlock_level > v_town.town_level then
    raise exception using errcode = 'P0001', message = 'TOWN_ITEM_LOCKED';
  end if;

  if not public.town_can_place(
    v_user_id, p_grid_x, p_grid_y, v_item.grid_width, v_item.grid_height,
    p_rotation, v_item.category, null
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_TOWN_PLACEMENT';
  end if;

  v_wood := coalesce((v_town.materials ->> 'wood')::integer, 0);
  v_stone := coalesce((v_town.materials ->> 'stone')::integer, 0);
  v_flower := coalesce((v_town.materials ->> 'flower')::integer, 0);
  v_shell := coalesce((v_town.materials ->> 'shell')::integer, 0);
  v_iron := coalesce((v_town.materials ->> 'iron')::integer, 0);

  v_cost_wood := coalesce((v_item.cost ->> 'wood')::integer, 0);
  v_cost_stone := coalesce((v_item.cost ->> 'stone')::integer, 0);
  v_cost_flower := coalesce((v_item.cost ->> 'flower')::integer, 0);
  v_cost_shell := coalesce((v_item.cost ->> 'shell')::integer, 0);
  v_cost_iron := coalesce((v_item.cost ->> 'iron')::integer, 0);

  if v_wood < v_cost_wood
    or v_stone < v_cost_stone
    or v_flower < v_cost_flower
    or v_shell < v_cost_shell
    or v_iron < v_cost_iron then
    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_MATERIALS';
  end if;

  v_new_exp := v_town.town_exp + v_item.exp_reward;

  update public.user_towns
  set materials = jsonb_build_object(
        'wood', v_wood - v_cost_wood,
        'stone', v_stone - v_cost_stone,
        'flower', v_flower - v_cost_flower,
        'shell', v_shell - v_cost_shell,
        'iron', v_iron - v_cost_iron
      ),
      town_exp = v_new_exp,
      town_level = public.town_level_of(v_new_exp),
      updated_at = now()
  where user_id = v_user_id;

  insert into public.user_town_items (
    user_id, item_id, grid_x, grid_y, rotation, is_placed
  ) values (
    v_user_id, v_item.id, p_grid_x, p_grid_y, p_rotation, true
  );

  return public.town_snapshot(v_user_id);
end;
$$;

create or replace function public.move_town_item(
  p_instance_id uuid,
  p_grid_x integer,
  p_grid_y integer,
  p_rotation integer,
  p_is_placed boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owned public.user_town_items%rowtype;
  v_item public.town_catalog_items%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not public.town_access_allowed() then
    raise exception using errcode = 'P0002', message = 'TOWN_NOT_FOUND';
  end if;
  if p_rotation not in (0, 90, 180, 270) then
    raise exception using errcode = 'P0001', message = 'INVALID_TOWN_PLACEMENT';
  end if;

  -- 建築・移動をユーザー単位で直列化し、同時操作のすり抜けを防ぐ。
  perform 1 from public.user_towns where user_id = v_user_id for update;

  select * into v_owned
  from public.user_town_items
  where instance_id = p_instance_id and user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'TOWN_INSTANCE_NOT_FOUND';
  end if;

  select * into v_item
  from public.town_catalog_items
  where id = v_owned.item_id;

  if p_is_placed and not public.town_can_place(
    v_user_id, p_grid_x, p_grid_y, v_item.grid_width, v_item.grid_height,
    p_rotation, v_item.category, p_instance_id
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_TOWN_PLACEMENT';
  end if;

  update public.user_town_items
  set grid_x = case when p_is_placed then p_grid_x else grid_x end,
      grid_y = case when p_is_placed then p_grid_y else grid_y end,
      rotation = p_rotation,
      is_placed = p_is_placed,
      updated_at = now()
  where instance_id = p_instance_id and user_id = v_user_id;

  return public.town_snapshot(v_user_id);
end;
$$;

revoke all on function public.town_access_allowed() from public, anon, authenticated;
revoke all on function public.town_level_of(integer) from public, anon, authenticated;
revoke all on function public.town_cell_is_unlocked(text[], integer, integer) from public, anon, authenticated;
revoke all on function public.town_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.town_can_place(uuid, integer, integer, integer, integer, integer, text, uuid)
  from public, anon, authenticated;

revoke all on function public.get_or_create_town() from public, anon;
grant execute on function public.get_or_create_town() to authenticated;

revoke all on function public.build_town_item(text, integer, integer, integer) from public, anon;
grant execute on function public.build_town_item(text, integer, integer, integer) to authenticated;

revoke all on function public.move_town_item(uuid, integer, integer, integer, boolean) from public, anon;
grant execute on function public.move_town_item(uuid, integer, integer, integer, boolean) to authenticated;

comment on table public.user_towns is
  'ユーザーごとのわんこタウン成長状態・素材・開放済み土地。';
comment on table public.user_town_items is
  'ユーザーが所有するタウン建物・デコ。is_placed=falseは収納中。';
comment on function public.build_town_item(text, integer, integer, integer) is
  '素材・解放レベル・土地・重なりを検証し、建築とタウンEXP加算を原子的に確定する。';
comment on function public.move_town_item(uuid, integer, integer, integer, boolean) is
  '所有建物の移動・90度回転・収納・再配置を、重なり検証付きで確定する。';

commit;

notify pgrst, 'reload schema';
