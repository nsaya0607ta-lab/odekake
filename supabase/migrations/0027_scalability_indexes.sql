-- =============================================================
-- 訪問記録が数千〜数万件になっても一覧・旅行集計を重くしにくくする
-- =============================================================
-- 既存機能・データは変更せず、検索用indexと集計RPCだけを追加する。

create index if not exists visit_records_trip_date_idx
  on public.visit_records(trip_id, visited_at desc, created_at desc);

create index if not exists visit_records_journey_idx
  on public.visit_records(journey_id)
  where journey_id is not null;

create index if not exists visit_records_journey_date_idx
  on public.visit_records(journey_id, visited_at desc, created_at desc)
  where journey_id is not null;

create index if not exists visit_records_user_date_idx
  on public.visit_records(user_id, visited_at desc, created_at desc);

create index if not exists trips_parent_created_idx
  on public.trips(parent_trip_id, created_at desc)
  where parent_trip_id is not null;

create or replace function public.get_journey_visit_counts(p_journey_ids uuid[])
returns table (
  journey_id uuid,
  visit_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    vr.journey_id,
    count(*)::bigint as visit_count
  from public.visit_records vr
  where vr.journey_id = any(coalesce(p_journey_ids, '{}'::uuid[]))
  group by vr.journey_id;
$$;

revoke all on function public.get_journey_visit_counts(uuid[]) from public, anon;
grant execute on function public.get_journey_visit_counts(uuid[]) to authenticated;

notify pgrst, 'reload schema';

select
  'SCALABILITY_INDEXES_READY'::text as status,
  to_regprocedure('public.get_journey_visit_counts(uuid[])') is not null as count_rpc_ok;
