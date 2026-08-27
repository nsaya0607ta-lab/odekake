-- =============================================================
-- マイルーム（軽量な2.5D家具配置）
-- =============================================================
-- 画面上の座標は0〜1の正規化値で保存する。端末サイズが変わっても同じ配置を
-- 再現でき、将来Three.jsへ移行する場合もワールド座標へ変換しやすい。

create table if not exists public.room_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  position_x real not null check (position_x between 0.04 and 0.96),
  position_y real not null check (position_y between 0.04 and 0.96),
  rotation integer not null default 0 check (rotation in (0, 90, 180, 270)),
  scale_value real not null default 1 check (scale_value between 0.7 and 1.35),
  z_index integer not null default 0 check (z_index between 0 and 1000),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.room_items enable row level security;

drop policy if exists room_items_select on public.room_items;
create policy room_items_select on public.room_items for select to authenticated
  using (user_id = auth.uid());

-- 参照だけを許可し、配置・移動・削除は下のSECURITY DEFINER RPCに限定する。
grant select on public.room_items to authenticated;

create or replace function public.set_room_item(
  p_item_id text,
  p_position_x real,
  p_position_y real,
  p_rotation integer default 0,
  p_scale real default 1,
  p_z_index integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_item_id is null or btrim(p_item_id) = '' then raise exception 'Invalid item'; end if;
  if p_position_x not between 0.04 and 0.96 or p_position_y not between 0.04 and 0.96 then
    raise exception 'Position is outside the room';
  end if;
  if p_rotation not in (0, 90, 180, 270) then raise exception 'Invalid rotation'; end if;
  if p_scale not between 0.7 and 1.35 then raise exception 'Invalid scale'; end if;
  if p_z_index not between 0 and 1000 then raise exception 'Invalid z index'; end if;

  if not exists (
    select 1
      from public.user_gacha_items
     where user_id = v_user_id
       and item_id = p_item_id
  ) then
    raise exception 'Item is not owned';
  end if;

  insert into public.room_items (
    user_id, item_id, position_x, position_y, rotation, scale_value, z_index, updated_at
  ) values (
    v_user_id, p_item_id, p_position_x, p_position_y, p_rotation, p_scale, p_z_index, now()
  )
  on conflict (user_id, item_id) do update
    set position_x = excluded.position_x,
        position_y = excluded.position_y,
        rotation = excluded.rotation,
        scale_value = excluded.scale_value,
        z_index = excluded.z_index,
        updated_at = now();
end;
$$;

create or replace function public.clear_room_item(p_item_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  delete from public.room_items where user_id = v_user_id and item_id = p_item_id;
end;
$$;

revoke execute on function public.set_room_item(text, real, real, integer, real, integer) from public, anon;
revoke execute on function public.clear_room_item(text) from public, anon;
grant execute on function public.set_room_item(text, real, real, integer, real, integer) to authenticated;
grant execute on function public.clear_room_item(text) to authenticated;
