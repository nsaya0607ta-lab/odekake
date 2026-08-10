-- =============================================================
-- 犬スキン（重ね着せではなく、犬ごと丸ごと差し替え）
-- =============================================================
-- 選べるのは default（常に所持）と、ガチャの景品として手に入る
-- hiking / snow / summer。所持判定は既存の user_gacha_items をそのまま使う
-- （新しい所持テーブルは作らない）。ここが持つのは「いま選んでいるスキン」
-- という1行だけ。
--
-- スキンごとの画像は public/characters/<skin_id>/ に同じファイル名で揃える
-- （src/lib/dog-skins.ts の getFrenchieSrc）。DB は画像の中身を知らない。

create table if not exists public.user_dog_skin (
  user_id uuid primary key references auth.users(id) on delete cascade,
  skin_id text not null default 'default' check (skin_id in ('default', 'hiking', 'snow', 'summer')),
  updated_at timestamptz not null default now()
);

alter table public.user_dog_skin enable row level security;

drop policy if exists user_dog_skin_select on public.user_dog_skin;
create policy user_dog_skin_select on public.user_dog_skin for select to authenticated
  using (user_id = auth.uid());

-- 参照だけ許可する。切り替えは下の RPC（SECURITY DEFINER）だけが行う。
grant select on public.user_dog_skin to authenticated;

drop trigger if exists user_dog_skin_set_updated_at on public.user_dog_skin;
create trigger user_dog_skin_set_updated_at before update on public.user_dog_skin
  for each row execute function public.set_updated_at();

-- スキンを選ぶのに必要な景品 id。default は null（誰でも選べる）。
-- src/lib/dog-skins.ts の DOG_SKINS.unlockItemId と必ず同じにする。
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
    else null
  end;
$$;

-- 切り替え。所持している景品のスキンか default 以外は拒否する。
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
  if p_skin_id not in ('default', 'hiking', 'snow', 'summer') then
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
