-- =============================================================
-- プロフィール更新を既存DBでも確実に利用できるようにする
-- =============================================================
-- 以前のDBで不足することがある space_name 列と本人更新ポリシーを補う。
-- 既存データ、フレンド機能、Storageのフレンド閲覧ポリシーは変更しない。

alter table public.profiles
  add column if not exists space_name text;

do $$ begin
  alter table public.profiles
    add constraint profiles_space_name_length
    check (space_name is null or length(btrim(space_name)) between 1 and 30);
exception when duplicate_object then null; end $$;

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant update (display_name, profile_image_url, introduction, space_name)
  on table public.profiles to authenticated;

NOTIFY pgrst, 'reload schema';

select
  'PROFILE_UPDATE_READY'::text as status,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'space_name'
  ) as space_name_ok,
  has_column_privilege(
    'authenticated',
    'public.profiles',
    'display_name',
    'UPDATE'
  ) as profile_update_ok;
