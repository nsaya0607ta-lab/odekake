-- =============================================================
-- フレンド機能
-- =============================================================
-- 既存の profiles / user_exp / visit_records / spots /
-- user_gacha_items の RLS は変更しない。
-- フレンドへ公開する情報は、以下の SECURITY DEFINER RPC だけを通して返す。

-- SQL Editor から実行中にどこか1か所でも失敗した場合、途中までの状態を
-- 残さない。すでに一度適用済みでも安全に再実行できる。
begin;

create extension if not exists "pgcrypto";

-- このマイグレーションが依存する既存テーブルを先に検査する。
-- 接続先を間違えた場合や、古いDBへ適用した場合は変更前に停止する。
do $$
declare
  v_missing text[] := '{}';
  v_table text;
begin
  foreach v_table in array array[
    'profiles',
    'user_exp',
    'visit_records',
    'spots',
    'user_gacha_items'
  ] loop
    if to_regclass('public.' || v_table) is null then
      v_missing := array_append(v_missing, 'public.' || v_table);
    end if;
  end loop;

  if cardinality(v_missing) > 0 then
    raise exception using
      errcode = 'P0001',
      message = 'FRIENDS_MIGRATION_MISSING_DEPENDENCIES: ' || array_to_string(v_missing, ', '),
      hint = 'odekakeアプリが現在利用しているSupabaseプロジェクトで実行してください。Vercelの環境変数は変更しないでください。';
  end if;

  if to_regprocedure('public.set_updated_at()') is null then
    raise exception using
      errcode = 'P0001',
      message = 'FRIENDS_MIGRATION_MISSING_DEPENDENCY: public.set_updated_at()',
      hint = '先に既存のodekakeマイグレーションを適用してください。';
  end if;
end;
$$;

create table if not exists public.friend_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friend_codes_code_format check (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$')
);

create table if not exists public.friendships (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_user_id),
  constraint friendships_not_self check (user_id <> friend_user_id)
);

create index if not exists friendships_friend_user_id_idx
  on public.friendships(friend_user_id);

create table if not exists public.friend_privacy_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  show_prefectures boolean not null default true,
  show_collection boolean not null default true,
  show_recent_visits boolean not null default true,
  updated_at timestamptz not null default now()
);

drop trigger if exists friend_codes_set_updated_at on public.friend_codes;
create trigger friend_codes_set_updated_at before update on public.friend_codes
  for each row execute function public.set_updated_at();

drop trigger if exists friend_privacy_settings_set_updated_at on public.friend_privacy_settings;
create trigger friend_privacy_settings_set_updated_at before update on public.friend_privacy_settings
  for each row execute function public.set_updated_at();

alter table public.friend_codes enable row level security;
alter table public.friendships enable row level security;
alter table public.friend_privacy_settings enable row level security;

drop policy if exists friend_codes_select_own on public.friend_codes;
create policy friend_codes_select_own on public.friend_codes for select to authenticated
  using (user_id = auth.uid());

drop policy if exists friendships_select_own on public.friendships;
create policy friendships_select_own on public.friendships for select to authenticated
  using (user_id = auth.uid());

drop policy if exists friend_privacy_settings_select_own on public.friend_privacy_settings;
create policy friend_privacy_settings_select_own on public.friend_privacy_settings for select to authenticated
  using (user_id = auth.uid());

drop policy if exists friend_privacy_settings_insert_own on public.friend_privacy_settings;
create policy friend_privacy_settings_insert_own on public.friend_privacy_settings for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists friend_privacy_settings_update_own on public.friend_privacy_settings;
create policy friend_privacy_settings_update_own on public.friend_privacy_settings for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select on public.friend_codes to authenticated;
grant select on public.friendships to authenticated;
grant select, insert, update on public.friend_privacy_settings to authenticated;

-- 読み間違えやすい I / O / 0 / 1 を含まない8文字を作る。
create or replace function public.make_friend_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := gen_random_bytes(8);
  v_code text := '';
  v_index integer;
begin
  for v_index in 0..7 loop
    v_code := v_code || substr(v_chars, (get_byte(v_bytes, v_index) % length(v_chars)) + 1, 1);
  end loop;
  return v_code;
end;
$$;

revoke all on function public.make_friend_code() from public, anon, authenticated;

create or replace function public.get_or_create_friend_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
  v_attempt integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select fc.code into v_code
  from public.friend_codes fc
  where fc.user_id = v_user_id;

  if v_code is not null then
    return v_code;
  end if;

  for v_attempt in 1..20 loop
    v_code := public.make_friend_code();
    insert into public.friend_codes (user_id, code)
    values (v_user_id, v_code)
    on conflict do nothing
    returning code into v_code;

    if v_code is not null then
      insert into public.friend_privacy_settings (user_id)
      values (v_user_id)
      on conflict (user_id) do nothing;
      return v_code;
    end if;

    select fc.code into v_code
    from public.friend_codes fc
    where fc.user_id = v_user_id;
    if v_code is not null then
      return v_code;
    end if;
  end loop;

  raise exception using errcode = 'P0001', message = 'FRIEND_CODE_GENERATION_FAILED';
end;
$$;

create or replace function public.regenerate_friend_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
  v_attempt integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  for v_attempt in 1..20 loop
    begin
      v_code := public.make_friend_code();
      insert into public.friend_codes (user_id, code)
      values (v_user_id, v_code)
      on conflict (user_id) do update
        set code = excluded.code,
            updated_at = now();

      insert into public.friend_privacy_settings (user_id)
      values (v_user_id)
      on conflict (user_id) do nothing;
      return v_code;
    exception when unique_violation then
      -- 別ユーザーのコードと衝突した場合だけ再試行する。
    end;
  end loop;

  raise exception using errcode = 'P0001', message = 'FRIEND_CODE_GENERATION_FAILED';
end;
$$;

create or replace function public.add_friend_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_normalized text := regexp_replace(upper(coalesce(p_code, '')), '[-[:space:]]', '', 'g');
  v_friend_user_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if v_normalized !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$' then
    raise exception using errcode = 'P0001', message = 'FRIEND_CODE_NOT_FOUND';
  end if;

  select fc.user_id into v_friend_user_id
  from public.friend_codes fc
  where fc.code = v_normalized;

  if v_friend_user_id is null then
    raise exception using errcode = 'P0001', message = 'FRIEND_CODE_NOT_FOUND';
  end if;
  if v_friend_user_id = v_user_id then
    raise exception using errcode = 'P0001', message = 'CANNOT_FRIEND_SELF';
  end if;
  if exists (
    select 1 from public.friendships f
    where f.user_id = v_user_id and f.friend_user_id = v_friend_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'ALREADY_FRIENDS';
  end if;

  insert into public.friendships (user_id, friend_user_id)
  values (v_user_id, v_friend_user_id), (v_friend_user_id, v_user_id)
  on conflict do nothing;

  return v_friend_user_id;
end;
$$;

create or replace function public.remove_friend(p_friend_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  delete from public.friendships
  where (user_id = v_user_id and friend_user_id = p_friend_user_id)
     or (user_id = p_friend_user_id and friend_user_id = v_user_id);
end;
$$;

-- SECURITY DEFINER RPCから共通利用するフレンド判定。外部には公開しない。
create or replace function public.is_friend(p_friend_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.friendships f
    where f.user_id = auth.uid()
      and f.friend_user_id = p_friend_user_id
  );
$$;

revoke all on function public.is_friend(uuid) from public, anon, authenticated;

create or replace function public.get_friend_list()
returns table (
  friend_user_id uuid,
  display_name text,
  profile_image_url text,
  total_exp integer,
  visited_prefectures bigint,
  visited_municipalities bigint,
  visit_count bigint,
  collection_owned_count bigint,
  show_collection boolean,
  friend_since timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    f.friend_user_id,
    coalesce(nullif(btrim(p.display_name), ''), 'ゲスト') as display_name,
    p.profile_image_url,
    coalesce(ue.total_exp, 0) as total_exp,
    coalesce(v.visited_prefectures, 0) as visited_prefectures,
    coalesce(v.visited_municipalities, 0) as visited_municipalities,
    coalesce(v.visit_count, 0) as visit_count,
    case when coalesce(ps.show_collection, true)
      then coalesce(c.collection_owned_count, 0)
      else null
    end as collection_owned_count,
    coalesce(ps.show_collection, true) as show_collection,
    f.created_at as friend_since
  from public.friendships f
  left join public.profiles p on p.user_id = f.friend_user_id
  left join public.user_exp ue on ue.user_id = f.friend_user_id
  left join public.friend_privacy_settings ps on ps.user_id = f.friend_user_id
  left join lateral (
    select
      count(*) as visit_count,
      count(distinct s.prefecture_code) as visited_prefectures,
      count(distinct s.municipality_code) as visited_municipalities
    from public.visit_records vr
    join public.spots s on s.id = vr.spot_id
    where vr.user_id = f.friend_user_id
  ) v on true
  left join lateral (
    select count(*) as collection_owned_count
    from public.user_gacha_items ugi
    where ugi.user_id = f.friend_user_id
  ) c on true
  where auth.uid() is not null
    and f.user_id = auth.uid()
  order by f.created_at desc;
$$;

create or replace function public.get_friend_overview(p_friend_user_id uuid)
returns table (
  friend_user_id uuid,
  display_name text,
  profile_image_url text,
  introduction text,
  total_exp integer,
  visited_prefecture_count bigint,
  visited_municipality_count bigint,
  visit_count bigint,
  show_prefectures boolean,
  show_collection boolean,
  show_recent_visits boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p_friend_user_id,
    coalesce(nullif(btrim(p.display_name), ''), 'ゲスト') as display_name,
    p.profile_image_url,
    p.introduction,
    coalesce(ue.total_exp, 0) as total_exp,
    coalesce(v.visited_prefecture_count, 0) as visited_prefecture_count,
    coalesce(v.visited_municipality_count, 0) as visited_municipality_count,
    coalesce(v.visit_count, 0) as visit_count,
    coalesce(ps.show_prefectures, true) as show_prefectures,
    coalesce(ps.show_collection, true) as show_collection,
    coalesce(ps.show_recent_visits, true) as show_recent_visits
  from (select 1) seed
  left join public.profiles p on p.user_id = p_friend_user_id
  left join public.user_exp ue on ue.user_id = p_friend_user_id
  left join public.friend_privacy_settings ps on ps.user_id = p_friend_user_id
  left join lateral (
    select
      count(*) as visit_count,
      count(distinct s.prefecture_code) as visited_prefecture_count,
      count(distinct s.municipality_code) as visited_municipality_count
    from public.visit_records vr
    join public.spots s on s.id = vr.spot_id
    where vr.user_id = p_friend_user_id
  ) v on true
  where public.is_friend(p_friend_user_id);
$$;

create or replace function public.get_friend_prefectures(p_friend_user_id uuid)
returns table (
  prefecture_code text,
  visit_count bigint,
  last_visited_at date
)
language sql
security definer
stable
set search_path = public
as $$
  select
    s.prefecture_code,
    count(*) as visit_count,
    max(vr.visited_at) as last_visited_at
  from public.visit_records vr
  join public.spots s on s.id = vr.spot_id
  where vr.user_id = p_friend_user_id
    and public.is_friend(p_friend_user_id)
    and coalesce((
      select ps.show_prefectures
      from public.friend_privacy_settings ps
      where ps.user_id = p_friend_user_id
    ), true)
  group by s.prefecture_code
  order by max(vr.visited_at) desc, s.prefecture_code;
$$;

create or replace function public.get_friend_collection(p_friend_user_id uuid)
returns table (
  item_id text,
  count integer
)
language sql
security definer
stable
set search_path = public
as $$
  select ugi.item_id, ugi.count
  from public.user_gacha_items ugi
  where ugi.user_id = p_friend_user_id
    and public.is_friend(p_friend_user_id)
    and coalesce((
      select ps.show_collection
      from public.friend_privacy_settings ps
      where ps.user_id = p_friend_user_id
    ), true)
  order by ugi.first_obtained_at desc;
$$;

create or replace function public.get_friend_recent_visits(
  p_friend_user_id uuid,
  p_limit integer default 5
)
returns table (
  spot_id uuid,
  spot_name text,
  visited_at date,
  prefecture_code text,
  municipality_code text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    s.id as spot_id,
    s.name as spot_name,
    vr.visited_at,
    s.prefecture_code,
    s.municipality_code
  from public.visit_records vr
  join public.spots s on s.id = vr.spot_id
  where vr.user_id = p_friend_user_id
    and public.is_friend(p_friend_user_id)
    and coalesce((
      select ps.show_recent_visits
      from public.friend_privacy_settings ps
      where ps.user_id = p_friend_user_id
    ), true)
  order by vr.visited_at desc, vr.created_at desc
  limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;

-- アプリが「SQL未適用」「古いSQL」「接続先違い」を曖昧な画面にせず
-- 判別するための軽量ヘルスチェック。秘密情報やDB識別子は返さない。
create or replace function public.get_friends_health()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  return jsonb_build_object(
    'ready', true,
    'version', 2
  );
end;
$$;

revoke all on function public.get_or_create_friend_code() from public, anon;
revoke all on function public.regenerate_friend_code() from public, anon;
revoke all on function public.add_friend_by_code(text) from public, anon;
revoke all on function public.remove_friend(uuid) from public, anon;
revoke all on function public.get_friend_list() from public, anon;
revoke all on function public.get_friend_overview(uuid) from public, anon;
revoke all on function public.get_friend_prefectures(uuid) from public, anon;
revoke all on function public.get_friend_collection(uuid) from public, anon;
revoke all on function public.get_friend_recent_visits(uuid, integer) from public, anon;
revoke all on function public.get_friends_health() from public, anon;

grant execute on function public.get_or_create_friend_code() to authenticated;
grant execute on function public.regenerate_friend_code() to authenticated;
grant execute on function public.add_friend_by_code(text) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.get_friend_list() to authenticated;
grant execute on function public.get_friend_overview(uuid) to authenticated;
grant execute on function public.get_friend_prefectures(uuid) to authenticated;
grant execute on function public.get_friend_collection(uuid) to authenticated;
grant execute on function public.get_friend_recent_visits(uuid, integer) to authenticated;
grant execute on function public.get_friends_health() to authenticated;

commit;

-- PostgRESTへ新しいRPCを即時認識させる。環境変数やAuth設定は変更しない。
notify pgrst, 'reload schema';

-- SQL EditorのResultsに FRIENDS_V2_READY / true が1行表示されれば成功。
select
  'FRIENDS_V2_READY'::text as status,
  to_regclass('public.friend_codes') is not null as friend_codes_ok,
  to_regclass('public.friendships') is not null as friendships_ok,
  to_regclass('public.friend_privacy_settings') is not null as privacy_ok,
  to_regprocedure('public.get_friends_health()') is not null as health_rpc_ok,
  to_regprocedure('public.get_or_create_friend_code()') is not null as code_rpc_ok,
  to_regprocedure('public.get_friend_list()') is not null as list_rpc_ok;
