-- =============================================================
-- おでかけ記録アプリ 追加スキーマ（第2版）
-- =============================================================
-- 0001_init.sql を適用済みのプロジェクトに対して実行してください。
-- 何度実行しても同じ結果になるように書いています。
--
--   supabase db push
--   もしくは Supabase ダッシュボードの SQL Editor に貼り付けて実行
--
-- 追加内容
--   1. 招待     — 招待者・メール送信状態・承諾者を記録できるようにする
--   2. スポット — 座標の由来と精度を保存し、店舗検索や地図選択へ拡張できるようにする
--   3. 活動履歴 — trip_activities に「誰が何をしたか」を自動で記録する
--   4. 写真     — 保存前の一時領域 tmp/{user_id}/... を許可する
-- =============================================================

-- -------------------------------------------------------------
-- 1. 招待（メールアドレス招待の土台）
-- -------------------------------------------------------------
alter table public.trip_invitations
  add column if not exists invited_by uuid references auth.users(id) on delete set null,
  add column if not exists message text,
  add column if not exists email_status text not null default 'not_sent',
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_error text,
  add column if not exists email_attempts smallint not null default 0,
  add column if not exists accepted_by uuid references auth.users(id) on delete set null,
  add column if not exists accepted_at timestamptz;

do $$ begin
  alter table public.trip_invitations
    add constraint trip_invitations_email_status_check
    check (email_status in ('not_sent', 'queued', 'sent', 'failed'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.trip_invitations
    add constraint trip_invitations_email_format
    check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
exception when duplicate_object then null; end $$;

-- 同じ旅行の同じ宛先に、有効な招待が二重に作られないようにする
create unique index if not exists trip_invitations_pending_email_idx
  on public.trip_invitations (trip_id, lower(email))
  where email is not null and status = 'pending';

comment on column public.trip_invitations.email_status is
  'メール送信の状態。初期版は常に not_sent（アプリからは送信しない）。送信機能を足すときに queued → sent / failed と遷移させる。';

-- 送信待ちの招待を取り出すための索引（将来のワーカー用）
create index if not exists trip_invitations_email_queue_idx
  on public.trip_invitations (email_status, created_at)
  where email is not null;

-- -------------------------------------------------------------
-- 2. スポットの位置情報
-- -------------------------------------------------------------
do $$ begin
  create type public.location_source as enum (
    'municipality',   -- 市区町村の代表座標（初期版の既定）
    'address',        -- 住所から求めた座標（ジオコーディング）
    'map',            -- 地図上で選んだ座標
    'device',         -- 端末の現在地
    'place_search'    -- 店舗・施設検索の結果
  );
exception when duplicate_object then null; end $$;

alter table public.spots
  add column if not exists location_source public.location_source not null default 'municipality',
  add column if not exists location_accuracy_m double precision,
  add column if not exists location_updated_at timestamptz,
  add column if not exists place_provider text,
  add column if not exists place_id text,
  add column if not exists postal_code text,
  add column if not exists phone text;

do $$ begin
  alter table public.spots add constraint spots_latitude_range
    check (latitude is null or latitude between -90 and 90);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.spots add constraint spots_longitude_range
    check (longitude is null or longitude between -180 and 180);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.spots add constraint spots_accuracy_positive
    check (location_accuracy_m is null or location_accuracy_m >= 0);
exception when duplicate_object then null; end $$;

-- 外部の店舗検索を追加したとき、同じ施設を重複登録しないようにする
create unique index if not exists spots_place_ref_idx
  on public.spots (created_by, place_provider, place_id)
  where place_id is not null;

comment on column public.spots.location_source is
  '座標の由来。市区町村の代表座標か、地図選択・現在地・店舗検索などで得た正確な座標かを区別する。';
comment on column public.spots.place_provider is
  '店舗検索の提供元の識別子（例: google, osm）。初期版では未使用。';

-- -------------------------------------------------------------
-- 3. 活動履歴 trip_activities
-- -------------------------------------------------------------
do $$ begin
  create type public.trip_activity_action as enum (
    'trip_created',
    'trip_updated',
    'member_joined',
    'member_left',
    'member_removed',
    'visit_added',
    'visit_updated',
    'visit_deleted',
    'photo_added',
    'photo_removed',
    'comment_added'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.trip_activities (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action public.trip_activity_action not null,
  target_type text,
  target_id uuid,
  -- 参照先が消えても履歴が読めるよう、対象の名前はここに写しておく
  target_label text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists trip_activities_trip_idx
  on public.trip_activities (trip_id, created_at desc);

alter table public.trip_activities enable row level security;

-- 閲覧はその旅行を見られる人だけ。書き込みはトリガー（security definer）に限る
drop policy if exists trip_activities_select on public.trip_activities;
create policy trip_activities_select on public.trip_activities for select to authenticated
  using (public.can_access_trip(trip_id));

-- 共有旅だけを記録対象にする（一人旅は自分しかいないため）
create or replace function public.is_shared_trip(p_trip uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.trips t where t.id = p_trip and t.trip_type = 'shared');
$$;

create or replace function public.log_trip_activity(
  p_trip uuid,
  p_action public.trip_activity_action,
  p_target_type text default null,
  p_target_id uuid default null,
  p_target_label text default null,
  p_detail jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_trip is null or not public.is_shared_trip(p_trip) then
    return;
  end if;

  insert into public.trip_activities (trip_id, actor_id, action, target_type, target_id, target_label, detail)
  values (p_trip, auth.uid(), p_action, p_target_type, p_target_id, p_target_label, coalesce(p_detail, '{}'::jsonb));
exception when foreign_key_violation then
  -- アカウント削除の連鎖でこの関数が呼ばれた場合、実行者の行はすでに消えている。
  -- 「誰か」は分からなくなるが、退出したという事実は残す。
  insert into public.trip_activities (trip_id, actor_id, action, target_type, target_id, target_label, detail)
  values (p_trip, null, p_action, p_target_type, p_target_id, p_target_label, coalesce(p_detail, '{}'::jsonb));
end;
$$;

-- ---- 旅行 ----
create or replace function public.tg_trip_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_trip_activity(new.id, 'trip_created', 'trip', new.id, new.title);
  elsif tg_op = 'UPDATE' then
    -- 招待コードの再発行など、表示に関係のない変更は履歴に残さない
    if new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.start_date is distinct from old.start_date
      or new.end_date is distinct from old.end_date
      or new.cover_image_url is distinct from old.cover_image_url
    then
      perform public.log_trip_activity(new.id, 'trip_updated', 'trip', new.id, new.title);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists trips_log_activity on public.trips;
create trigger trips_log_activity after insert or update on public.trips
  for each row execute function public.tg_trip_activity();

-- ---- メンバー ----
create or replace function public.tg_trip_member_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if tg_op = 'INSERT' then
    -- 作成者の自動登録は trip_created と重複するため記録しない
    if new.role = 'owner' then
      return null;
    end if;
    select display_name into v_name from public.profiles where user_id = new.user_id;
    perform public.log_trip_activity(new.trip_id, 'member_joined', 'member', new.user_id, v_name);
  else
    select display_name into v_name from public.profiles where user_id = old.user_id;
    perform public.log_trip_activity(
      old.trip_id,
      (case when auth.uid() = old.user_id then 'member_left' else 'member_removed' end)::public.trip_activity_action,
      'member',
      old.user_id,
      v_name
    );
  end if;
  return null;
end;
$$;

drop trigger if exists trip_members_log_activity on public.trip_members;
create trigger trip_members_log_activity after insert or delete on public.trip_members
  for each row execute function public.tg_trip_member_activity();

-- ---- 訪問記録 ----
create or replace function public.tg_visit_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.visit_records%rowtype := case when tg_op = 'DELETE' then old else new end;
  v_spot text;
begin
  select name into v_spot from public.spots where id = v_row.spot_id;

  if tg_op = 'INSERT' then
    perform public.log_trip_activity(v_row.trip_id, 'visit_added', 'visit', v_row.id, v_spot);
  elsif tg_op = 'DELETE' then
    perform public.log_trip_activity(v_row.trip_id, 'visit_deleted', 'visit', v_row.id, v_spot);
  else
    -- 旅行を移した場合は、移動先を「追加」として記録する
    if new.trip_id is distinct from old.trip_id then
      perform public.log_trip_activity(old.trip_id, 'visit_deleted', 'visit', old.id, v_spot);
      perform public.log_trip_activity(new.trip_id, 'visit_added', 'visit', new.id, v_spot);
    else
      perform public.log_trip_activity(v_row.trip_id, 'visit_updated', 'visit', v_row.id, v_spot);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists visit_records_log_activity on public.visit_records;
create trigger visit_records_log_activity after insert or update or delete on public.visit_records
  for each row execute function public.tg_visit_activity();

-- ---- 写真（1回の保存を1件にまとめる） ----
create or replace function public.tg_visit_photo_insert_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select vr.trip_id, vr.spot_id, count(*) as photo_count
    from new_rows n
    join public.visit_records vr on vr.id = n.visit_record_id
    group by vr.trip_id, vr.spot_id
  loop
    perform public.log_trip_activity(
      r.trip_id,
      'photo_added',
      'photo',
      null,
      (select name from public.spots where id = r.spot_id),
      jsonb_build_object('count', r.photo_count)
    );
  end loop;
  return null;
end;
$$;

drop trigger if exists visit_photos_log_insert on public.visit_photos;
create trigger visit_photos_log_insert after insert on public.visit_photos
  referencing new table as new_rows
  for each statement execute function public.tg_visit_photo_insert_activity();

create or replace function public.tg_visit_photo_delete_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select vr.trip_id, vr.spot_id, count(*) as photo_count
    from old_rows o
    join public.visit_records vr on vr.id = o.visit_record_id
    group by vr.trip_id, vr.spot_id
  loop
    perform public.log_trip_activity(
      r.trip_id,
      'photo_removed',
      'photo',
      null,
      (select name from public.spots where id = r.spot_id),
      jsonb_build_object('count', r.photo_count)
    );
  end loop;
  return null;
end;
$$;

-- 訪問記録ごと消えたときは visit_deleted に含まれるため、写真単体の削除だけを記録する
drop trigger if exists visit_photos_log_delete on public.visit_photos;
create trigger visit_photos_log_delete after delete on public.visit_photos
  referencing old table as old_rows
  for each statement execute function public.tg_visit_photo_delete_activity();

-- ---- コメント ----
create or replace function public.tg_trip_comment_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_trip_activity(
    new.trip_id,
    'comment_added',
    'comment',
    new.id,
    left(new.comment, 40)
  );
  return null;
end;
$$;

drop trigger if exists trip_comments_log_activity on public.trip_comments;
create trigger trip_comments_log_activity after insert on public.trip_comments
  for each row execute function public.tg_trip_comment_activity();

-- -------------------------------------------------------------
-- 4. 写真の一時領域
-- -------------------------------------------------------------
-- 保存ボタンを押す前の写真は tmp/{user_id}/{token}/... へ置き、
-- 保存時に本来の場所へ移動する。移動されなかったファイルは掃除の対象になる。
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
  if parts[1] = 'tmp' or parts[1] = 'users' then
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

-- -------------------------------------------------------------
-- 5. アカウント削除を「失敗したら分かる」ようにする
-- -------------------------------------------------------------
-- auth.users の削除が権限や RLS で弾かれた場合、以前は何も起きずに成功扱いに
-- なっていたため、削除できたことを確認してから返すようにする。
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  delete from auth.users where id = v_uid;

  if exists (select 1 from auth.users where id = v_uid) then
    raise exception 'ACCOUNT_DELETE_FAILED';
  end if;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

-- -------------------------------------------------------------
-- 6. 招待の承諾者を残す
-- -------------------------------------------------------------
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

  -- 戻り値の列名 trip_id と列参照がぶつかるため、on conflict (trip_id, ...) は使えない
  -- （使うと実行時に「column reference "trip_id" is ambiguous」で失敗する）
  begin
    insert into public.trip_members (trip_id, user_id, role)
    values (v_trip.id, auth.uid(), 'member');
  exception when unique_violation then
    null; -- すでに参加済み
  end;

  if v_inv.id is not null then
    update public.trip_invitations
       set status = 'accepted',
           accepted_by = auth.uid(),
           accepted_at = now()
     where id = v_inv.id;
  end if;

  return query select v_trip.id, v_trip.title;
end;
$$;

revoke all on function public.join_trip_by_code(text) from public;
grant execute on function public.join_trip_by_code(text) to authenticated;

grant execute on function public.is_shared_trip(uuid) to authenticated;
