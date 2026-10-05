-- =============================================================
-- ショップ：アプリの背景を青コインで買って、アプリ全体の背景にする
-- =============================================================
-- ・背景は1つずつ買う（同じ背景は1回だけ）。「いつもの」（default）は無料で、買わなくても選べる。
-- ・値段（青コイン）：肉球スタンプ・和紙・水彩にじみ・秋の落ち葉 1,500／おでかけ地図・空と丘・星空 2,500／
--   パステルオーロラ・時間で変わる空 4,000。アプリ側の src/lib/app-backgrounds.ts の APP_BACKGROUNDS と同じにする。
-- ・買った背景は user_app_backgrounds、選んでいる背景は user_app_background_choice に入れる。
--   アプリは選んでいる背景をCookieで持ち、Cookieが無いときだけ middleware.ts がここを読む。
-- ・青コインの仕組み（0111）を先に適用しておくこと。
begin;

do $$
begin
  if to_regprocedure('public.add_blue_coin_event(uuid, text, integer, text, jsonb)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'APP_BACKGROUNDS_SHOP_MISSING_DEPENDENCY',
      hint = '青コインの仕組み（0111）を先に適用してください。';
  end if;
end;
$$;

create table if not exists public.user_app_backgrounds (
  user_id uuid not null references auth.users(id) on delete cascade,
  background_id text not null check (background_id ~ '^[a-z-]{1,32}$'),
  purchased_at timestamptz not null default now(),
  primary key (user_id, background_id)
);

alter table public.user_app_backgrounds enable row level security;
drop policy if exists user_app_backgrounds_select_own on public.user_app_backgrounds;
create policy user_app_backgrounds_select_own on public.user_app_backgrounds for select to authenticated using (user_id = auth.uid());
grant select on public.user_app_backgrounds to authenticated;

create table if not exists public.user_app_background_choice (
  user_id uuid primary key references auth.users(id) on delete cascade,
  background_id text not null default 'default' check (background_id ~ '^[a-z-]{1,32}$'),
  updated_at timestamptz not null default now()
);

alter table public.user_app_background_choice enable row level security;
drop policy if exists user_app_background_choice_select_own on public.user_app_background_choice;
create policy user_app_background_choice_select_own on public.user_app_background_choice for select to authenticated using (user_id = auth.uid());
grant select on public.user_app_background_choice to authenticated;

/** 背景の値段（青コイン）。「いつもの」は 0、知らない背景は null */
create or replace function public.app_background_price(p_background text)
returns integer
language sql
immutable
as $$
  select case p_background
    when 'default' then 0
    when 'paw' then 1500
    when 'washi' then 1500
    when 'watercolor' then 1500
    when 'autumn' then 1500
    when 'map' then 2500
    when 'scenery' then 2500
    when 'starry' then 2500
    when 'aurora' then 4000
    when 'sky-clock' then 4000
    else null
  end;
$$;

-- 背景を1つ買う（同じ背景は1回だけ。持っているかの行を先に入れて、同時に2回買えないようにする）
create or replace function public.buy_app_background(p_background text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_price integer := public.app_background_price(p_background);
  v_balance integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if v_price is null or v_price <= 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_BACKGROUND';
  end if;

  insert into public.user_app_backgrounds (user_id, background_id) values (v_user_id, p_background) on conflict do nothing;
  if not found then
    raise exception using errcode = 'P0001', message = 'BACKGROUND_OWNED';
  end if;

  if not public.add_blue_coin_event(
    v_user_id, 'app_background', -v_price,
    'app-background:' || p_background,
    jsonb_build_object('label', 'ショップの背景', 'background', p_background)
  ) then
    raise exception using errcode = 'P0001', message = 'PURCHASE_CONFLICT';
  end if;

  select balance into v_balance from public.user_blue_coins where user_id = v_user_id;
  return jsonb_build_object('ok', true, 'background', p_background, 'balance', coalesce(v_balance, 0));
end;
$$;

revoke all on function public.buy_app_background(text) from public, anon;
grant execute on function public.buy_app_background(text) to authenticated;

comment on function public.buy_app_background(text) is
  'ショップの背景を1つ、青コインで買う（値段は app_background_price。同じ背景は1回だけ）。';

-- 使う背景を選ぶ（「いつもの」か、買った背景だけ）
create or replace function public.set_app_background(p_background text)
returns jsonb
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
  if public.app_background_price(p_background) is null then
    raise exception using errcode = 'P0001', message = 'INVALID_BACKGROUND';
  end if;
  if p_background <> 'default' and not exists (
    select 1 from public.user_app_backgrounds where user_id = v_user_id and background_id = p_background
  ) then
    raise exception using errcode = 'P0001', message = 'BACKGROUND_NOT_OWNED';
  end if;

  insert into public.user_app_background_choice (user_id, background_id, updated_at)
  values (v_user_id, p_background, now())
  on conflict (user_id) do update set background_id = excluded.background_id, updated_at = now();
  return jsonb_build_object('ok', true, 'background', p_background);
end;
$$;

revoke all on function public.set_app_background(text) from public, anon;
grant execute on function public.set_app_background(text) to authenticated;

comment on function public.set_app_background(text) is
  'アプリの背景を選ぶ（「いつもの」か、買った背景だけ）。';

commit;

notify pgrst, 'reload schema';
