-- =============================================================
-- iPhoneショートカット経由の歩数同期
-- =============================================================
-- WebアプリのままAppleヘルスケアの歩数を取り込むため、
-- ユーザーごとにランダムな連携キーを1つ発行する。
-- ショートカットはこのキーをBearerトークンとして送信し、
-- SECURITY DEFINER RPCが所有者を特定して歩数とEXPを同期する。

create table if not exists public.steps_sync_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.steps_sync_tokens enable row level security;

-- トークン本体は通常のAPIから読ませない。発行・失効はRPCだけで行う。
revoke all on public.steps_sync_tokens from public, anon, authenticated;

create or replace function public.create_steps_sync_token()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_token uuid := gen_random_uuid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  insert into public.steps_sync_tokens (user_id, token, created_at, updated_at)
  values (v_user_id, v_token, now(), now())
  on conflict (user_id) do update
    set token = excluded.token,
        updated_at = now();

  return v_token::text;
end;
$$;

grant execute on function public.create_steps_sync_token() to authenticated;

create or replace function public.revoke_steps_sync_token()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  delete from public.steps_sync_tokens where user_id = v_user_id;
end;
$$;

grant execute on function public.revoke_steps_sync_token() to authenticated;

-- 歩数EXPの計算はアプリ側とDB側でズレないようDBに集約する。
create or replace function public.calculate_step_exp(p_steps integer)
returns integer
language sql
immutable
strict
set search_path = public
as $$
  select least(35,
    (case when p_steps >= 1000 then 1 else 0 end) +
    (case when p_steps >= 2000 then 1 else 0 end) +
    (case when p_steps >= 3000 then 2 else 0 end) +
    (case when p_steps >= 4000 then 2 else 0 end) +
    (case when p_steps >= 5000 then 3 else 0 end) +
    (case when p_steps >= 6000 then 2 else 0 end) +
    (case when p_steps >= 7000 then 2 else 0 end) +
    (case when p_steps >= 8000 then 3 else 0 end) +
    (case when p_steps >= 9000 then 2 else 0 end) +
    (case when p_steps >= 10000 then 4 else 0 end) +
    (case when p_steps >= 12000 then 4 else 0 end) +
    (case when p_steps >= 15000 then 5 else 0 end) +
    (case when p_steps >= 20000 then 4 else 0 end)
  );
$$;

-- 認証済みRPCとショートカットRPCの共通処理。
create or replace function public.record_daily_steps_for_user(
  p_user_id uuid,
  p_step_date date,
  p_steps integer,
  p_source text default 'healthcare'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exp integer;
begin
  if p_user_id is null then raise exception 'User is required'; end if;
  if p_step_date is null or p_step_date > (timezone('Asia/Tokyo', now()))::date then
    raise exception 'Step date must not be in the future';
  end if;
  if p_step_date < (timezone('Asia/Tokyo', now()))::date - 7 then
    raise exception 'Step date is too old';
  end if;
  if p_steps < 0 or p_steps > 200000 then raise exception 'Invalid step count'; end if;

  v_exp := public.calculate_step_exp(p_steps);

  insert into public.daily_steps (user_id, step_date, steps, earned_exp, source)
  values (p_user_id, p_step_date, p_steps, v_exp, coalesce(nullif(p_source, ''), 'healthcare'))
  on conflict (user_id, step_date) do update
    set steps = excluded.steps,
        earned_exp = excluded.earned_exp,
        source = excluded.source,
        updated_at = now();

  perform public.set_exp_event(
    p_user_id, 'steps', v_exp, 'steps:' || p_step_date::text, p_step_date,
    jsonb_build_object('label', '歩数EXP', 'steps', p_steps, 'source', p_source)
  );

  return v_exp;
end;
$$;

revoke all on function public.record_daily_steps_for_user(uuid, date, integer, text)
  from public, anon, authenticated;

-- 既存の認証済み歩数RPCも共通処理へ寄せる。
create or replace function public.record_daily_steps(p_step_date date, p_steps integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  return public.record_daily_steps_for_user(v_user_id, p_step_date, p_steps, 'healthcare');
end;
$$;

grant execute on function public.record_daily_steps(date, integer) to authenticated;

-- iPhoneショートカットからBearer連携キーで呼ぶRPC。
create or replace function public.record_daily_steps_with_token(
  p_token text,
  p_step_date date,
  p_steps integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
  v_user_id uuid;
begin
  begin
    v_token := p_token::uuid;
  exception when invalid_text_representation then
    raise exception 'Invalid sync token';
  end;

  select user_id into v_user_id
    from public.steps_sync_tokens
   where token = v_token;

  if v_user_id is null then raise exception 'Invalid sync token'; end if;

  return public.record_daily_steps_for_user(v_user_id, p_step_date, p_steps, 'iphone-shortcuts');
end;
$$;

grant execute on function public.record_daily_steps_with_token(text, date, integer) to anon, authenticated;
