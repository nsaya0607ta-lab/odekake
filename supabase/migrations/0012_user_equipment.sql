-- =============================================================
-- そうび（レベルアップ報酬のアクセサリー・称号）
-- =============================================================
-- LEVEL_REWARDS（src/lib/exp.ts）のうち種類が accessory / title の項目だけを
-- 「そうびできるもの」として扱う。1スロットにつき装着できるのは1つだけで、
-- スロットと到達レベルの対応は equipment_slot_of() に固定する
-- （src/lib/equipment.ts の SLOT_BY_LEVEL と必ず同じにする）。

create table if not exists public.user_equipment (
  user_id uuid not null references auth.users(id) on delete cascade,
  slot text not null check (slot in ('collar', 'bandana', 'hat', 'backpack', 'crown', 'title')),
  level integer not null check (level between 1 and 30),
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);

alter table public.user_equipment enable row level security;

drop policy if exists user_equipment_select on public.user_equipment;
create policy user_equipment_select on public.user_equipment for select to authenticated
  using (user_id = auth.uid());

-- 参照だけ許可する。装着・解除は下の RPC（SECURITY DEFINER）だけが行う。
grant select on public.user_equipment to authenticated;

drop trigger if exists user_equipment_set_updated_at on public.user_equipment;
create trigger user_equipment_set_updated_at before update on public.user_equipment
  for each row execute function public.set_updated_at();

-- 到達レベルから、そのレベルの報酬がどのスロットに属すかを返す。
-- 属さない（モーション・表情・お部屋）レベルは null。
create or replace function public.equipment_slot_of(p_level integer)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select case p_level
    when 4 then 'collar'
    when 11 then 'collar'
    when 21 then 'collar'
    when 6 then 'bandana'
    when 15 then 'bandana'
    when 9 then 'backpack'
    when 25 then 'backpack'
    when 18 then 'hat'
    when 27 then 'hat'
    when 30 then 'crown'
    when 8 then 'title'
    when 17 then 'title'
    when 29 then 'title'
    else null
  end;
$$;

-- 装着・解除。p_level が null なら解除、それ以外は該当レベルの報酬をそのスロットへ装着する。
-- レベルがスロットと一致しない、またはまだ到達していないレベルは拒否する。
create or replace function public.set_equipped_item(p_slot text, p_level integer default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_level integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_slot not in ('collar', 'bandana', 'hat', 'backpack', 'crown', 'title') then
    raise exception 'Invalid slot';
  end if;

  if p_level is null then
    delete from public.user_equipment where user_id = v_user_id and slot = p_slot;
    return;
  end if;

  if public.equipment_slot_of(p_level) is distinct from p_slot then
    raise exception 'Reward does not belong to this slot';
  end if;

  select public.exp_level_of(total_exp) into v_current_level
    from public.user_exp where user_id = v_user_id;

  if coalesce(v_current_level, 1) < p_level then
    raise exception 'Reward is not unlocked yet';
  end if;

  insert into public.user_equipment (user_id, slot, level, updated_at)
  values (v_user_id, p_slot, p_level, now())
  on conflict (user_id, slot) do update
    set level = excluded.level,
        updated_at = now();
end;
$$;

grant execute on function public.set_equipped_item(text, integer) to authenticated;

-- 装着中のレベルがEXPの減少などで解放条件を下回った場合に解除する。
-- （通常EXPは減らないが、将来の調整に備えて自己修復できるようにしておく）
create or replace function public.tg_unequip_outleveled_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_level integer;
begin
  v_level := public.exp_level_of(new.total_exp);
  delete from public.user_equipment
   where user_id = new.user_id
     and level > v_level;
  return new;
end;
$$;

drop trigger if exists user_exp_unequip_outleveled on public.user_exp;
create trigger user_exp_unequip_outleveled
after insert or update of total_exp on public.user_exp
for each row execute function public.tg_unequip_outleveled_items();
