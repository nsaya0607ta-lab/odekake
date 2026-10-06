-- =============================================================
-- 青コインで背景を買えなくなっていたのを直す
-- =============================================================
-- 0128 で blue_coin_events の event_type の許可リストを作り直したとき、
-- ショップの背景（app_background）を入れ忘れ、背景の購入がすべて失敗していた。
-- いま使っている種類をすべて許可しなおす。
begin;

alter table public.blue_coin_events drop constraint if exists blue_coin_events_event_type_check;
alter table public.blue_coin_events add constraint blue_coin_events_event_type_check
  check (event_type in ('osanpo_run', 'room_furniture', 'pref_gacha', 'first_place', 'login_total', 'home_drop', 'app_background')) not valid;

commit;

notify pgrst, 'reload schema';
