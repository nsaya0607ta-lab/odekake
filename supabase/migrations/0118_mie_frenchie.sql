-- =============================================================
-- 犬スキン「三重のフレブル」（都道府県ガチャの景品 mie_frenchie）
-- =============================================================
-- 0117 の後に適用する。src/lib/dog-skins.ts の DOG_SKINS と同じにする。

alter table public.user_dog_skin drop constraint if exists user_dog_skin_skin_id_check;
alter table public.user_dog_skin
  add constraint user_dog_skin_skin_id_check
  check (skin_id in ('default', 'hiking', 'snow', 'summer', 'gifu', 'aichi', 'mie'));

create or replace function public.dog_skin_unlock_item(p_skin_id text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_skin_id
    when 'hiking' then 'hiking_frenchie'
    when 'snow' then 'snow_frenchie'
    when 'summer' then 'summer_frenchie'
    when 'gifu' then 'gifu_frenchie'
    when 'aichi' then 'aichi_frenchie'
    when 'mie' then 'mie_frenchie'
    else null
  end;
$$;

create or replace function public.set_dog_skin(p_skin_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item_id text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_skin_id not in ('default', 'hiking', 'snow', 'summer', 'gifu', 'aichi', 'mie') then
    raise exception 'Invalid skin';
  end if;

  v_item_id := public.dog_skin_unlock_item(p_skin_id);
  if v_item_id is not null and not exists (
    select 1 from public.user_gacha_items
     where user_id = v_user_id and item_id = v_item_id
  ) then
    raise exception 'Skin not owned';
  end if;

  insert into public.user_dog_skin (user_id, skin_id, updated_at)
  values (v_user_id, p_skin_id, now())
  on conflict (user_id) do update
    set skin_id = excluded.skin_id,
        updated_at = now();
end;
$$;

grant execute on function public.set_dog_skin(text) to authenticated;
