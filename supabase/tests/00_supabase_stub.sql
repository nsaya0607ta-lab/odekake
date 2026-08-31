-- =============================================================
-- ローカル Postgres で Supabase 相当の土台を用意するスタブ
-- =============================================================
-- 本番の Supabase では既に存在するものを、素の PostgreSQL 上に最小限だけ
-- 作り直します。RLS ポリシーと RPC の挙動をローカルで検証するためのもので、
-- 本番環境へ適用するものではありません。
--
--   実行例: psql -f supabase/tests/00_supabase_stub.sql
-- =============================================================

create extension if not exists "pgcrypto";

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create schema if not exists storage;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;

-- Supabase の初期設定と同じく、public に後から作られるテーブルにも権限が付くようにする
-- （テーブルレベルの権限は付与し、行の絞り込みは RLS が行う）
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- ---------------- auth ----------------
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Supabase では JWT のクレームが request.jwt.claims に入る
create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'role', current_setting('role', true));
$$;

create or replace function auth.email()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'email', '');
$$;

-- ---------------- storage ----------------
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null,
  owner uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb,
  unique (bucket_id, name)
);

alter table storage.objects enable row level security;

-- 本家と同じ定義（パスからファイル名を除いたフォルダ配列を返す）
create or replace function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  parts text[];
begin
  select string_to_array(name, '/') into parts;
  return parts[1 : array_length(parts, 1) - 1];
end;
$$;

create or replace function storage.filename(name text)
returns text
language plpgsql
immutable
as $$
declare
  parts text[];
begin
  select string_to_array(name, '/') into parts;
  return parts[array_length(parts, 1)];
end;
$$;

grant select on storage.buckets to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;

-- テスト用: 「今このユーザーとして操作する」ヘルパー
create or replace function public.test_login(p_user uuid)
returns void
language plpgsql
as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = p_user;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'email', v_email, 'role', 'authenticated')::text,
    true
  );
end;
$$;

create or replace function public.test_logout()
returns void
language sql
as $$
  select set_config('request.jwt.claims', '', true);
$$;
