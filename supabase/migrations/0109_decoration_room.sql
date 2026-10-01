-- =============================================================
-- おへや（飾り部屋）の置き方を保存する
-- =============================================================
-- 図鑑アイテム・おでかけの写真・おさんぽフレンチーのトロフィー・行った都道府県のおみやげを
-- 部屋に飾った「置き方」を、ユーザーごとに1行の JSON 配列で持つ。
-- 以前は端末の localStorage にだけ保存していたため、機種変更やブラウザが変わると消えていた。
-- 何を持っているか（置けるか）はアプリ側で各テーブルから確かめるので、ここは置き方だけ。
begin;

create table if not exists public.user_decoration_rooms (
  user_id uuid primary key references auth.users(id) on delete cascade,
  placements jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_decoration_rooms_placements_array check (jsonb_typeof(placements) = 'array'),
  -- アプリ側の上限（ROOM_MAX_PLACEMENTS = 120）より少し余裕を持たせる
  constraint user_decoration_rooms_placements_limit check (jsonb_array_length(placements) <= 200)
);

alter table public.user_decoration_rooms enable row level security;

drop policy if exists user_decoration_rooms_select_own on public.user_decoration_rooms;
create policy user_decoration_rooms_select_own on public.user_decoration_rooms
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists user_decoration_rooms_insert_own on public.user_decoration_rooms;
create policy user_decoration_rooms_insert_own on public.user_decoration_rooms
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists user_decoration_rooms_update_own on public.user_decoration_rooms;
create policy user_decoration_rooms_update_own on public.user_decoration_rooms
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.user_decoration_rooms to authenticated;

comment on table public.user_decoration_rooms is
  'おへや（飾り部屋）の置き方。placements は {instanceId, itemId, x, y, scale, rotation, flipped, z} の配列。';

commit;

notify pgrst, 'reload schema';
