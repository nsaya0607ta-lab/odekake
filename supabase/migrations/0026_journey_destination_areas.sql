-- =============================================================
-- 旅行の行き先（概要情報）
-- =============================================================
-- destination_areas は「この旅行でどこへ行く/行ったか」を表示するためのメタデータ。
-- 訪問実績や地図の集計には使わない。
-- 地図は従来どおり visit_records.trip_id、旅行内の記録は journey_id で集計する。

alter table public.trips
  add column if not exists destination_areas jsonb;

update public.trips
set destination_areas = '[]'::jsonb
where destination_areas is null;

alter table public.trips
  alter column destination_areas set default '[]'::jsonb;

alter table public.trips
  alter column destination_areas set not null;

alter table public.trips
  drop constraint if exists trips_destination_areas_array;

alter table public.trips
  add constraint trips_destination_areas_array
  check (jsonb_typeof(destination_areas) = 'array');

notify pgrst, 'reload schema';

select
  'JOURNEY_DESTINATION_AREAS_READY'::text as status,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trips'
      and column_name = 'destination_areas'
  ) as destination_areas_ok;
