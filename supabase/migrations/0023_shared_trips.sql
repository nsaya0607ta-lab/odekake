-- =============================================================
-- 共有旅 第1段階: 一覧・作成・フレンド招待・参加確認
-- =============================================================

-- 0008を未適用のDBでは、旧enum型（solo/shared）のtrip_typeが残っている。
-- 一度textへ統一し、soloだけpersonalへ読み替えることで両方のDBに対応する。
alter table public.trips add column if not exists trip_type text;
alter table public.trips alter column trip_type drop default;
alter table public.trips
  alter column trip_type type text
  using case when trip_type::text = 'solo' then 'personal' else trip_type::text end;
update public.trips set trip_type = 'personal' where trip_type is null or trip_type = 'solo';
alter table public.trips alter column trip_type set default 'personal';
alter table public.trips alter column trip_type set not null;
alter table public.trips drop constraint if exists trips_trip_type_check;
alter table public.trips add constraint trips_trip_type_check
  check (trip_type in ('personal', 'shared'));

create table if not exists public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'invited' check (status in ('invited', 'accepted', 'declined', 'left')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

-- 旧共有旅テーブルが残るDBでは不足列を追加し、enumのroleをtextへ統一する。
alter table public.trip_members add column if not exists status text;
alter table public.trip_members add column if not exists invited_by uuid references auth.users(id) on delete set null;
alter table public.trip_members add column if not exists created_at timestamptz not null default now();
alter table public.trip_members add column if not exists updated_at timestamptz not null default now();
alter table public.trip_members alter column role drop default;
alter table public.trip_members alter column role type text using role::text;
alter table public.trip_members alter column role set default 'member';
alter table public.trip_members alter column joined_at drop not null;
alter table public.trip_members alter column joined_at drop default;
update public.trip_members set status = 'accepted' where status is null;
alter table public.trip_members alter column status set default 'invited';
alter table public.trip_members alter column status set not null;
alter table public.trip_members drop constraint if exists trip_members_role_check;
alter table public.trip_members add constraint trip_members_role_check check (role in ('owner', 'member'));
alter table public.trip_members drop constraint if exists trip_members_status_check;
alter table public.trip_members add constraint trip_members_status_check check (status in ('invited', 'accepted', 'declined', 'left'));

-- 旧版の自動owner追加トリガーは、共有旅作成RPCの明示処理と重複するため外す。
drop trigger if exists trips_add_owner_member on public.trips;
drop function if exists public.add_trip_owner_as_member();

create index if not exists trip_members_user_status_idx on public.trip_members(user_id, status);
create index if not exists trip_members_trip_status_idx on public.trip_members(trip_id, status);
alter table public.trip_members enable row level security;

create or replace function public.is_accepted_trip_member(p_trip_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql security definer stable set search_path = public as $$
  select p_user_id is not null and exists (
    select 1 from public.trip_members tm
    where tm.trip_id = p_trip_id and tm.user_id = p_user_id and tm.status = 'accepted'
  );
$$;
revoke all on function public.is_accepted_trip_member(uuid, uuid) from public, anon, authenticated;

-- 既存の個人旅は所有者だけ、共有旅は承認済みメンバーも利用できる。
create or replace function public.can_access_trip(p_trip uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip
      and (t.owner_id = auth.uid() or (t.trip_type = 'shared' and public.is_accepted_trip_member(t.id)))
  );
$$;

drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips for select to authenticated
  using (public.can_access_trip(id));

drop policy if exists trip_members_select on public.trip_members;
create policy trip_members_select on public.trip_members for select to authenticated
  using (user_id = auth.uid() or public.is_accepted_trip_member(trip_id));

revoke insert, update, delete on public.trip_members from authenticated;
grant select on public.trip_members to authenticated;

create or replace function public.create_shared_trip(
  p_title text,
  p_friend_user_ids uuid[],
  p_start_date date default null,
  p_end_date date default null,
  p_description text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_trip_id uuid;
  v_friend_id uuid;
  v_friend_ids uuid[];
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(btrim(p_title), '') is null or length(btrim(p_title)) > 60 then raise exception 'INVALID_TITLE'; end if;
  if p_start_date is not null and p_end_date is not null and p_start_date > p_end_date then raise exception 'INVALID_DATE_RANGE'; end if;

  select coalesce(array_agg(distinct x), '{}'::uuid[]) into v_friend_ids
  from unnest(coalesce(p_friend_user_ids, '{}'::uuid[])) x where x <> v_user_id;
  if cardinality(v_friend_ids) = 0 then raise exception 'FRIEND_REQUIRED'; end if;

  foreach v_friend_id in array v_friend_ids loop
    if not exists (select 1 from public.friendships f where f.user_id = v_user_id and f.friend_user_id = v_friend_id) then
      raise exception 'NOT_A_FRIEND';
    end if;
  end loop;

  insert into public.trips (owner_id, title, trip_type, start_date, end_date, description)
  values (v_user_id, btrim(p_title), 'shared', p_start_date, p_end_date, nullif(btrim(p_description), ''))
  returning id into v_trip_id;

  insert into public.trip_members (trip_id, user_id, role, status, invited_by, joined_at)
  values (v_trip_id, v_user_id, 'owner', 'accepted', v_user_id, now())
  on conflict (trip_id, user_id) do update
    set role = 'owner', status = 'accepted', joined_at = coalesce(public.trip_members.joined_at, now());

  insert into public.trip_members (trip_id, user_id, role, status, invited_by)
  select v_trip_id, x, 'member', 'invited', v_user_id from unnest(v_friend_ids) x
  on conflict (trip_id, user_id) do nothing;
  return v_trip_id;
end;
$$;

create or replace function public.respond_shared_trip_invitation(p_trip_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.trip_members
    set status = case when p_accept then 'accepted' else 'declined' end,
        joined_at = case when p_accept then now() else null end,
        updated_at = now()
  where trip_id = p_trip_id and user_id = auth.uid() and status = 'invited';
  if not found then raise exception 'INVITATION_NOT_FOUND'; end if;
end;
$$;

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
  join public.trips t on t.id = mine.trip_id and t.trip_type = 'shared'
  left join public.profiles op on op.user_id = t.owner_id
  where mine.user_id = auth.uid() and mine.status in ('invited', 'accepted')
  order by (mine.status = 'invited') desc, t.updated_at desc;
$$;

create or replace function public.get_shared_trips_health()
returns jsonb language sql security definer stable set search_path = public as $$
  select jsonb_build_object('ready', true, 'version', 1);
$$;

revoke all on function public.create_shared_trip(text, uuid[], date, date, text) from public, anon;
revoke all on function public.respond_shared_trip_invitation(uuid, boolean) from public, anon;
revoke all on function public.get_shared_trip_list() from public, anon;
revoke all on function public.get_shared_trips_health() from public, anon;
grant execute on function public.create_shared_trip(text, uuid[], date, date, text) to authenticated;
grant execute on function public.respond_shared_trip_invitation(uuid, boolean) to authenticated;
grant execute on function public.get_shared_trip_list() to authenticated;
grant execute on function public.get_shared_trips_health() to authenticated;

NOTIFY pgrst, 'reload schema';
select 'SHARED_TRIPS_READY'::text as status,
  to_regclass('public.trip_members') is not null as members_ok,
  to_regprocedure('public.create_shared_trip(text,uuid[],date,date,text)') is not null as create_rpc_ok,
  to_regprocedure('public.get_shared_trip_list()') is not null as list_rpc_ok;
