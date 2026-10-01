-- =============================================================
-- わんこのおへや：部屋の飾り方を保存する
-- =============================================================
-- 壁紙・床・カーテン・ラグ（theme）と、図鑑アイテム・おでかけの写真・トロフィー・ペナントの
-- 置き方（items）を、ユーザーごとに1行の JSON で持つ。
-- 何を持っているか（置けるか）はアプリ側で各テーブルから確かめるので、ここは飾り方だけ。
begin;

create table if not exists public.user_rooms (
  user_id uuid primary key references auth.users(id) on delete cascade,
  layout jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_rooms_layout_object check (jsonb_typeof(layout) = 'object'),
  -- アプリ側の上限（ROOM_MAX_ITEMS = 120）より余裕を持たせる
  constraint user_rooms_layout_size check (pg_column_size(layout) <= 65536)
);

alter table public.user_rooms enable row level security;

drop policy if exists user_rooms_select_own on public.user_rooms;
create policy user_rooms_select_own on public.user_rooms
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists user_rooms_insert_own on public.user_rooms;
create policy user_rooms_insert_own on public.user_rooms
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists user_rooms_update_own on public.user_rooms;
create policy user_rooms_update_own on public.user_rooms
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.user_rooms to authenticated;

comment on table public.user_rooms is
  'わんこのおへやの飾り方。layout は {theme: {wall, floor, curtain, rug}, items: [{id, key, x, y, scale, flip, z, frame?}]}。';

commit;

notify pgrst, 'reload schema';
