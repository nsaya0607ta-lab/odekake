-- =============================================================
-- おでかけ記録アプリ 初期スキーマ
-- =============================================================
-- 適用方法:
--   supabase db push        （Supabase CLI）
--   もしくは Supabase ダッシュボードの SQL Editor に貼り付けて実行
-- =============================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- 列挙型
-- -------------------------------------------------------------
do $$ begin
  create type public.trip_type as enum ('solo', 'shared');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.trip_role as enum ('owner', 'member', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invitation_status as enum ('pending', 'accepted', 'expired', 'cancelled');
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------
-- 更新日時の自動更新
-- -------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -------------------------------------------------------------
-- profiles
-- -------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null default 'ゲスト',
  profile_image_url text,
  introduction text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- categories（マスタ）
-- -------------------------------------------------------------
create table if not exists public.categories (
  id smallint primary key,
  name text not null unique,
  icon text not null default 'pin',
  display_order smallint not null default 0,
  active boolean not null default true
);

insert into public.categories (id, name, icon, display_order) values
  (1,  '飲食店',       'restaurant', 10),
  (2,  'カフェ',       'cafe',       20),
  (3,  '観光地',       'landmark',   30),
  (4,  '宿泊施設',     'hotel',      40),
  (5,  '温泉',         'onsen',      50),
  (6,  'ショッピング', 'shopping',   60),
  (7,  'レジャー施設', 'leisure',    70),
  (8,  '公園',         'park',       80),
  (9,  '自然',         'nature',     90),
  (10, '神社',         'shrine',    100),
  (11, '寺院',         'temple',    110),
  (12, 'イベント',     'event',     120),
  (13, '道の駅',       'roadstation', 130),
  (14, '駅',           'station',   140),
  (15, '海',           'sea',       150),
  (16, '展望台',       'view',      160),
  (17, 'その他',       'other',     170)
on conflict (id) do update
  set name = excluded.name,
      icon = excluded.icon,
      display_order = excluded.display_order;

-- -------------------------------------------------------------
-- trips
-- -------------------------------------------------------------
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  trip_type public.trip_type not null default 'solo',
  start_date date,
  end_date date,
  description text,
  cover_image_url text,
  invite_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_title_not_blank check (length(btrim(title)) > 0),
  constraint trips_date_order check (start_date is null or end_date is null or start_date <= end_date)
);

create index if not exists trips_owner_id_idx on public.trips(owner_id);

drop trigger if exists trips_set_updated_at on public.trips;
create trigger trips_set_updated_at before update on public.trips
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- trip_members
-- -------------------------------------------------------------
create table if not exists public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.trip_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

create index if not exists trip_members_user_id_idx on public.trip_members(user_id);

-- 旅行作成時に作成者を owner として自動登録する
create or replace function public.add_trip_owner_as_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.trip_members (trip_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (trip_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trips_add_owner_member on public.trips;
create trigger trips_add_owner_member after insert on public.trips
  for each row execute function public.add_trip_owner_as_member();

-- -------------------------------------------------------------
-- spots
-- -------------------------------------------------------------
create table if not exists public.spots (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category_id smallint references public.categories(id),
  prefecture_code text not null,
  municipality_code text not null,
  address text,
  latitude double precision,
  longitude double precision,
  website_url text,
  opening_hours text,
  closed_days text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spots_name_not_blank check (length(btrim(name)) > 0),
  constraint spots_prefecture_code_format check (prefecture_code ~ '^[0-9]{2}$'),
  constraint spots_municipality_code_format check (municipality_code ~ '^[0-9]{5}$')
);

create index if not exists spots_municipality_idx on public.spots(municipality_code);
create index if not exists spots_prefecture_idx on public.spots(prefecture_code);
create index if not exists spots_created_by_idx on public.spots(created_by);

drop trigger if exists spots_set_updated_at on public.spots;
create trigger spots_set_updated_at before update on public.spots
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- visit_records
-- -------------------------------------------------------------
create table if not exists public.visit_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  spot_id uuid not null references public.spots(id) on delete cascade,
  visited_at date not null,
  rating smallint,
  comment text,
  note text,
  companions text,
  amount integer,
  stay_minutes integer,
  congestion_level smallint,
  revisit_wanted boolean not null default false,
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visit_records_rating_range check (rating is null or rating between 1 and 5),
  constraint visit_records_congestion_range check (congestion_level is null or congestion_level between 1 and 3),
  constraint visit_records_amount_positive check (amount is null or amount >= 0),
  constraint visit_records_stay_positive check (stay_minutes is null or stay_minutes >= 0)
);

create index if not exists visit_records_trip_idx on public.visit_records(trip_id);
create index if not exists visit_records_spot_idx on public.visit_records(spot_id);
create index if not exists visit_records_user_idx on public.visit_records(user_id);
create index if not exists visit_records_visited_at_idx on public.visit_records(visited_at desc);

drop trigger if exists visit_records_set_updated_at on public.visit_records;
create trigger visit_records_set_updated_at before update on public.visit_records
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- visit_photos
-- -------------------------------------------------------------
create table if not exists public.visit_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  visit_record_id uuid not null references public.visit_records(id) on delete cascade,
  storage_path text not null,
  caption text,
  display_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists visit_photos_record_idx on public.visit_photos(visit_record_id, display_order);

-- -------------------------------------------------------------
-- tags / visit_record_tags
-- -------------------------------------------------------------
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.visit_record_tags (
  id uuid primary key default gen_random_uuid(),
  visit_record_id uuid not null references public.visit_records(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  unique (visit_record_id, tag_id)
);

-- -------------------------------------------------------------
-- trip_comments
-- -------------------------------------------------------------
create table if not exists public.trip_comments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  comment text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_comments_not_blank check (length(btrim(comment)) > 0)
);

create index if not exists trip_comments_trip_idx on public.trip_comments(trip_id, created_at desc);

drop trigger if exists trip_comments_set_updated_at on public.trip_comments;
create trigger trip_comments_set_updated_at before update on public.trip_comments
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- trip_invitations
-- -------------------------------------------------------------
create table if not exists public.trip_invitations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  email text,
  invite_code text not null unique,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);

create index if not exists trip_invitations_trip_idx on public.trip_invitations(trip_id);
create index if not exists trip_invitations_email_idx on public.trip_invitations(lower(email));

-- =============================================================
-- 権限判定ヘルパー
--   RLS ポリシー内で再帰しないよう security definer にする
-- =============================================================

create or replace function public.can_access_trip(p_trip uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.trips t
    where t.id = p_trip
      and (
        t.owner_id = auth.uid()
        or (
          t.trip_type = 'shared'
          and exists (
            select 1 from public.trip_members m
            where m.trip_id = t.id and m.user_id = auth.uid()
          )
        )
      )
  );
$$;

create or replace function public.is_trip_owner(p_trip uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip and t.owner_id = auth.uid()
  );
$$;

-- 同じ旅行に参加しているユーザーかどうか（プロフィール閲覧の判定に使う）
create or replace function public.shares_trip_with(p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.trip_members me
    join public.trip_members other on other.trip_id = me.trip_id
    join public.trips t on t.id = me.trip_id
    where me.user_id = auth.uid()
      and other.user_id = p_user
      and t.trip_type = 'shared'
  );
$$;

create or replace function public.can_read_visit(p_visit uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.visit_records vr
    where vr.id = p_visit
      and (vr.user_id = auth.uid() or public.can_access_trip(vr.trip_id))
  );
$$;

create or replace function public.can_write_visit(p_visit uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.visit_records vr
    where vr.id = p_visit
      and (vr.user_id = auth.uid() or public.is_trip_owner(vr.trip_id))
  );
$$;

-- スポットが閲覧可能か（自分が作成 / 閲覧できる訪問記録から参照されている）
create or replace function public.can_read_spot(p_spot uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.spots s
    where s.id = p_spot and s.created_by = auth.uid()
  ) or exists (
    select 1 from public.visit_records vr
    where vr.spot_id = p_spot
      and (vr.user_id = auth.uid() or public.can_access_trip(vr.trip_id))
  );
$$;

-- =============================================================
-- Row Level Security
-- =============================================================

alter table public.profiles          enable row level security;
alter table public.categories        enable row level security;
alter table public.trips             enable row level security;
alter table public.trip_members      enable row level security;
alter table public.spots             enable row level security;
alter table public.visit_records     enable row level security;
alter table public.visit_photos      enable row level security;
alter table public.tags              enable row level security;
alter table public.visit_record_tags enable row level security;
alter table public.trip_comments     enable row level security;
alter table public.trip_invitations  enable row level security;

-- ---------------- profiles ----------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.shares_trip_with(user_id));

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete to authenticated
  using (user_id = auth.uid());

-- ---------------- categories ----------------
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories for select to authenticated
  using (true);

-- ---------------- trips ----------------
drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips for select to authenticated
  using (
    owner_id = auth.uid()
    or (
      trip_type = 'shared'
      and exists (select 1 from public.trip_members m where m.trip_id = trips.id and m.user_id = auth.uid())
    )
  );

drop policy if exists trips_insert on public.trips;
create policy trips_insert on public.trips for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists trips_update on public.trips;
create policy trips_update on public.trips for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists trips_delete on public.trips;
create policy trips_delete on public.trips for delete to authenticated
  using (owner_id = auth.uid());

-- ---------------- trip_members ----------------
drop policy if exists trip_members_select on public.trip_members;
create policy trip_members_select on public.trip_members for select to authenticated
  using (user_id = auth.uid() or public.can_access_trip(trip_id));

drop policy if exists trip_members_insert on public.trip_members;
create policy trip_members_insert on public.trip_members for insert to authenticated
  with check (public.is_trip_owner(trip_id));

drop policy if exists trip_members_update on public.trip_members;
create policy trip_members_update on public.trip_members for update to authenticated
  using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));

-- オーナーはメンバーを削除でき、メンバー自身は旅行から退出できる
drop policy if exists trip_members_delete on public.trip_members;
create policy trip_members_delete on public.trip_members for delete to authenticated
  using (
    (public.is_trip_owner(trip_id) and role <> 'owner')
    or (user_id = auth.uid() and role <> 'owner')
  );

-- ---------------- spots ----------------
drop policy if exists spots_select on public.spots;
create policy spots_select on public.spots for select to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.visit_records vr
      where vr.spot_id = spots.id
        and (vr.user_id = auth.uid() or public.can_access_trip(vr.trip_id))
    )
  );

drop policy if exists spots_insert on public.spots;
create policy spots_insert on public.spots for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists spots_update on public.spots;
create policy spots_update on public.spots for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists spots_delete on public.spots;
create policy spots_delete on public.spots for delete to authenticated
  using (created_by = auth.uid());

-- ---------------- visit_records ----------------
drop policy if exists visit_records_select on public.visit_records;
create policy visit_records_select on public.visit_records for select to authenticated
  using (user_id = auth.uid() or public.can_access_trip(trip_id));

drop policy if exists visit_records_insert on public.visit_records;
create policy visit_records_insert on public.visit_records for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_trip(trip_id));

-- member は自分の記録のみ、owner は旅行内すべてを編集できる
drop policy if exists visit_records_update on public.visit_records;
create policy visit_records_update on public.visit_records for update to authenticated
  using (user_id = auth.uid() or public.is_trip_owner(trip_id))
  with check (user_id = auth.uid() or public.is_trip_owner(trip_id));

drop policy if exists visit_records_delete on public.visit_records;
create policy visit_records_delete on public.visit_records for delete to authenticated
  using (user_id = auth.uid() or public.is_trip_owner(trip_id));

-- ---------------- visit_photos ----------------
drop policy if exists visit_photos_select on public.visit_photos;
create policy visit_photos_select on public.visit_photos for select to authenticated
  using (public.can_read_visit(visit_record_id));

drop policy if exists visit_photos_insert on public.visit_photos;
create policy visit_photos_insert on public.visit_photos for insert to authenticated
  with check (user_id = auth.uid() and public.can_read_visit(visit_record_id));

drop policy if exists visit_photos_update on public.visit_photos;
create policy visit_photos_update on public.visit_photos for update to authenticated
  using (user_id = auth.uid() or public.can_write_visit(visit_record_id))
  with check (user_id = auth.uid() or public.can_write_visit(visit_record_id));

drop policy if exists visit_photos_delete on public.visit_photos;
create policy visit_photos_delete on public.visit_photos for delete to authenticated
  using (user_id = auth.uid() or public.can_write_visit(visit_record_id));

-- ---------------- tags ----------------
drop policy if exists tags_all on public.tags;
create policy tags_all on public.tags for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------- visit_record_tags ----------------
drop policy if exists visit_record_tags_select on public.visit_record_tags;
create policy visit_record_tags_select on public.visit_record_tags for select to authenticated
  using (public.can_read_visit(visit_record_id));

drop policy if exists visit_record_tags_write on public.visit_record_tags;
create policy visit_record_tags_write on public.visit_record_tags for insert to authenticated
  with check (public.can_write_visit(visit_record_id));

drop policy if exists visit_record_tags_delete on public.visit_record_tags;
create policy visit_record_tags_delete on public.visit_record_tags for delete to authenticated
  using (public.can_write_visit(visit_record_id));

-- ---------------- trip_comments ----------------
drop policy if exists trip_comments_select on public.trip_comments;
create policy trip_comments_select on public.trip_comments for select to authenticated
  using (public.can_access_trip(trip_id));

drop policy if exists trip_comments_insert on public.trip_comments;
create policy trip_comments_insert on public.trip_comments for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_trip(trip_id));

drop policy if exists trip_comments_update on public.trip_comments;
create policy trip_comments_update on public.trip_comments for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists trip_comments_delete on public.trip_comments;
create policy trip_comments_delete on public.trip_comments for delete to authenticated
  using (user_id = auth.uid() or public.is_trip_owner(trip_id));

-- ---------------- trip_invitations ----------------
-- 招待コードそのものは参照できないようにし、参加は join_trip_by_code() 経由に限定する
drop policy if exists trip_invitations_select on public.trip_invitations;
create policy trip_invitations_select on public.trip_invitations for select to authenticated
  using (public.is_trip_owner(trip_id) or lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists trip_invitations_insert on public.trip_invitations;
create policy trip_invitations_insert on public.trip_invitations for insert to authenticated
  with check (public.is_trip_owner(trip_id));

drop policy if exists trip_invitations_update on public.trip_invitations;
create policy trip_invitations_update on public.trip_invitations for update to authenticated
  using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));

drop policy if exists trip_invitations_delete on public.trip_invitations;
create policy trip_invitations_delete on public.trip_invitations for delete to authenticated
  using (public.is_trip_owner(trip_id));

-- =============================================================
-- RPC
-- =============================================================

-- 新規ユーザー登録時にプロフィールを自動作成する
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 地域ごとの集計（RLS が効くよう security invoker）
create or replace function public.area_stats()
returns table (
  prefecture_code text,
  municipality_code text,
  spot_count bigint,
  visit_count bigint,
  last_visited_at date
)
language sql
security invoker
stable
set search_path = public
as $$
  select s.prefecture_code,
         s.municipality_code,
         count(distinct s.id) as spot_count,
         count(vr.id) as visit_count,
         max(vr.visited_at) as last_visited_at
  from public.visit_records vr
  join public.spots s on s.id = vr.spot_id
  group by s.prefecture_code, s.municipality_code;
$$;

-- 招待コードで共有旅に参加する
create or replace function public.join_trip_by_code(p_code text)
returns table (trip_id uuid, title text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip public.trips%rowtype;
  v_inv public.trip_invitations%rowtype;
  v_code text := upper(btrim(p_code));
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_inv from public.trip_invitations
   where upper(invite_code) = v_code
   order by created_at desc
   limit 1;

  if found then
    if v_inv.status = 'cancelled' then
      raise exception 'INVITATION_CANCELLED';
    end if;
    if v_inv.expires_at < now() then
      update public.trip_invitations set status = 'expired' where id = v_inv.id;
      raise exception 'INVITATION_EXPIRED';
    end if;
    select * into v_trip from public.trips where id = v_inv.trip_id;
  else
    select * into v_trip from public.trips where upper(invite_code) = v_code;
  end if;

  if v_trip.id is null then
    raise exception 'INVITATION_NOT_FOUND';
  end if;

  if v_trip.trip_type <> 'shared' then
    raise exception 'TRIP_NOT_SHARED';
  end if;

  insert into public.trip_members (trip_id, user_id, role)
  values (v_trip.id, auth.uid(), 'member')
  on conflict (trip_id, user_id) do nothing;

  if v_inv.id is not null then
    update public.trip_invitations set status = 'accepted' where id = v_inv.id;
  end if;

  return query select v_trip.id, v_trip.title;
end;
$$;

revoke all on function public.join_trip_by_code(text) from public;
grant execute on function public.join_trip_by_code(text) to authenticated;

-- 自分のアカウントを削除する（サービスロールキーをクライアントに置かないため）
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

-- =============================================================
-- Storage
-- =============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;

-- パス設計:
--   users/{user_id}/profile/...
--   trips/{trip_id}/cover/...
--   trips/{trip_id}/visits/{visit_record_id}/...
create or replace function public.can_access_storage_path(p_name text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  parts text[] := storage.foldername(p_name);
  v_id uuid;
begin
  if parts[1] = 'users' then
    return parts[2] = auth.uid()::text;
  elsif parts[1] = 'trips' then
    begin
      v_id := parts[2]::uuid;
    exception when others then
      return false;
    end;
    return public.can_access_trip(v_id);
  end if;
  return false;
end;
$$;

drop policy if exists photos_select on storage.objects;
create policy photos_select on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.can_access_storage_path(name));

drop policy if exists photos_insert on storage.objects;
create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and owner = auth.uid() and public.can_access_storage_path(name));

drop policy if exists photos_update on storage.objects;
create policy photos_update on storage.objects for update to authenticated
  using (bucket_id = 'photos' and owner = auth.uid())
  with check (bucket_id = 'photos' and owner = auth.uid() and public.can_access_storage_path(name));

drop policy if exists photos_delete on storage.objects;
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (owner = auth.uid() or public.can_access_storage_path(name)));
