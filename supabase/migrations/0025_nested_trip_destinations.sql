-- 記録先を「親の所属先」と「任意の旅行グループ」に分離する。
-- trip_id    : 個人旅の常設先、または共有旅（地図の表示単位）
-- journey_id : 上記の中に作る大阪旅行など（任意のまとめ）

alter table public.trips
  add column if not exists parent_trip_id uuid references public.trips(id) on delete cascade;

alter table public.visit_records
  add column if not exists journey_id uuid references public.trips(id) on delete set null;

create index if not exists trips_parent_trip_id_idx on public.trips(parent_trip_id);
create index if not exists visit_records_journey_id_idx on public.visit_records(journey_id);

-- 個人旅行を持つユーザー全員に、地図の親となる常設の個人旅を用意する。
insert into public.trips (owner_id, title, trip_type, start_date, end_date, description)
select distinct t.owner_id, '自分のおでかけ', 'personal', null::date, null::date,
  '普段のおでかけをまとめる記録先'
from public.trips t
where t.trip_type = 'personal'
  and not exists (
    select 1 from public.trips root
    where root.owner_id = t.owner_id
      and root.trip_type = 'personal'
      and root.parent_trip_id is null
      and root.title = '自分のおでかけ'
      and root.start_date is null
      and root.end_date is null
      and root.description = '普段のおでかけをまとめる記録先'
  );

-- 既存の個人旅行は、本人の常設個人旅に属する旅行グループへ移す。
update public.trips child
set parent_trip_id = root.id
from public.trips root
where child.trip_type = 'personal'
  and child.parent_trip_id is null
  and not (
    child.title = '自分のおでかけ'
    and child.start_date is null
    and child.end_date is null
    and child.description = '普段のおでかけをまとめる記録先'
  )
  and root.owner_id = child.owner_id
  and root.trip_type = 'personal'
  and root.parent_trip_id is null
  and root.title = '自分のおでかけ'
  and root.start_date is null
  and root.end_date is null
  and root.description = '普段のおでかけをまとめる記録先';

-- 既存の個人旅行記録は、親を個人旅に直しつつ元の旅行にも残す。
update public.visit_records vr
set journey_id = child.id,
    trip_id = child.parent_trip_id
from public.trips child
where vr.trip_id = child.id
  and child.parent_trip_id is not null
  and child.trip_type = 'personal';

-- 子旅行でも、親の共有旅への参加権限で閲覧できるようにする。
create or replace function public.can_access_trip(p_trip uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.trips t
    left join public.trips root on root.id = t.parent_trip_id
    where t.id = p_trip
      and (
        t.owner_id = auth.uid()
        or (t.trip_type = 'shared' and public.is_accepted_trip_member(coalesce(root.id, t.id)))
      )
  );
$$;

-- journey_id は必ず trip_id の直下にある旅行だけを許可する。
create or replace function public.validate_visit_destination()
returns trigger language plpgsql set search_path = public as $$
declare
  v_root_type text;
  v_journey_parent uuid;
  v_journey_type text;
begin
  select trip_type into v_root_type
  from public.trips where id = new.trip_id and parent_trip_id is null;
  if v_root_type is null then
    raise exception 'INVALID_RECORD_DESTINATION';
  end if;

  if new.journey_id is not null then
    select parent_trip_id, trip_type into v_journey_parent, v_journey_type
    from public.trips where id = new.journey_id;
    if v_journey_parent is distinct from new.trip_id or v_journey_type is distinct from v_root_type then
      raise exception 'JOURNEY_DOES_NOT_BELONG_TO_DESTINATION';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists visit_records_validate_destination on public.visit_records;
create trigger visit_records_validate_destination
before insert or update of trip_id, journey_id on public.visit_records
for each row execute function public.validate_visit_destination();

-- 旅行グループは、自分が利用できる親の直下にだけ作成できる。
drop policy if exists trips_insert on public.trips;
create policy trips_insert on public.trips for insert to authenticated
with check (
  owner_id = auth.uid()
  and (
    parent_trip_id is null
    or (
      public.can_access_trip(parent_trip_id)
      and exists (
        select 1 from public.trips parent
        where parent.id = trips.parent_trip_id
          and parent.parent_trip_id is null
          and parent.trip_type = trips.trip_type
      )
    )
  )
);

-- 共有旅一覧には親だけを返し、配下の旅行グループを混ぜない。
drop function if exists public.get_shared_trip_list();
create function public.get_shared_trip_list()
returns table (
  trip_id uuid, title text, description text, start_date date, end_date date,
  cover_image_url text, owner_id uuid, owner_name text, my_role text, my_status text,
  member_count bigint, member_names text[], updated_at timestamptz
)
language sql security definer stable set search_path = public as $$
  select t.id, t.title, t.description, t.start_date, t.end_date, t.cover_image_url,
    t.owner_id, coalesce(nullif(btrim(op.display_name), ''), 'ゲスト'), mine.role, mine.status,
    (select count(*) from public.trip_members m where m.trip_id = t.id and m.status = 'accepted'),
    coalesce((select array_agg(coalesce(nullif(btrim(p.display_name), ''), 'ゲスト') order by m.joined_at)
      from public.trip_members m left join public.profiles p on p.user_id = m.user_id
      where m.trip_id = t.id and m.status = 'accepted'), '{}'::text[]),
    t.updated_at
  from public.trip_members mine
  join public.trips t on t.id = mine.trip_id and t.trip_type = 'shared' and t.parent_trip_id is null
  left join public.profiles op on op.user_id = t.owner_id
  where mine.user_id = auth.uid() and mine.status in ('invited', 'accepted')
  order by (mine.status = 'invited') desc, t.updated_at desc;
$$;

revoke all on function public.get_shared_trip_list() from public, anon;
grant execute on function public.get_shared_trip_list() to authenticated;

create or replace function public.get_nested_trip_destinations_health()
returns jsonb language sql security definer stable set search_path = public as $$
  select jsonb_build_object('ready', true, 'version', 1);
$$;
revoke all on function public.get_nested_trip_destinations_health() from public, anon;
grant execute on function public.get_nested_trip_destinations_health() to authenticated;

notify pgrst, 'reload schema';
select 'NESTED_TRIP_DESTINATIONS_READY'::text as status,
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='trips' and column_name='parent_trip_id') as parent_ok,
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='visit_records' and column_name='journey_id') as journey_ok;
