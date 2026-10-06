-- =============================================================
-- ショップ：ホームのカードの絵がら（冬など）を青コインで買って、1枚ずつ／まとめて変える
-- =============================================================
-- 0124 の後に適用する。アプリ側の src/lib/home-skins.ts と同じ値段・同じ割引にする。
-- ・カードは scene（わんこのカード）・notice（お知らせ）・highlights（あなたの実績）・collection（図鑑）の4つ
-- ・冬（winter）：わんこのカード 1,500／ほかは 800。2枚以上まとめて買うと合計の2割引（100枚単位で切り下げ）
-- ・買ったものは user_home_skins、使っている絵がらは user_app_background_choice.home_skins（{"scene":"winter",...}）
begin;

do $$
begin
  if to_regprocedure('public.set_home_look(jsonb)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'HOME_SKINS_MISSING_DEPENDENCY',
      hint = 'ホームの着せかえ（0124）を先に適用してください。';
  end if;
end;
$$;

create table if not exists public.user_home_skins (
  user_id uuid not null references auth.users(id) on delete cascade,
  theme text not null check (theme ~ '^[a-z-]{1,32}$'),
  part text not null check (part in ('scene', 'notice', 'highlights', 'collection')),
  purchased_at timestamptz not null default now(),
  primary key (user_id, theme, part)
);

alter table public.user_home_skins enable row level security;
drop policy if exists user_home_skins_select_own on public.user_home_skins;
create policy user_home_skins_select_own on public.user_home_skins for select to authenticated using (user_id = auth.uid());
grant select on public.user_home_skins to authenticated;

alter table public.user_app_background_choice add column if not exists home_skins jsonb;

-- 青コインの記録に「ホームのカード」を足す（0130 の一覧＋home_skin）
alter table public.blue_coin_events drop constraint if exists blue_coin_events_event_type_check;
alter table public.blue_coin_events add constraint blue_coin_events_event_type_check
  check (event_type in ('osanpo_run', 'room_furniture', 'pref_gacha', 'first_place', 'login_total', 'home_drop', 'app_background', 'home_skin')) not valid;

/** カードの絵がらの値段（青コイン）。いつもの は 0、知らないものは null */
create or replace function public.home_skin_price(p_theme text, p_part text)
returns integer
language sql
immutable
as $$
  select case
    when p_part not in ('scene', 'notice', 'highlights', 'collection') then null
    when p_theme = 'default' then 0
    when p_theme = 'winter' then case p_part when 'scene' then 1500 else 800 end
    else null
  end;
$$;

-- 絵がらを買う（1枚でも、まとめてでも。持っているものは飛ばし、2枚以上なら2割引）
create or replace function public.buy_home_skins(p_theme text, p_parts text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_part text;
  v_price integer;
  v_total integer := 0;
  v_bought text[] := '{}';
  v_balance integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_parts is null or cardinality(p_parts) = 0 or cardinality(p_parts) > 4 then
    raise exception using errcode = 'P0001', message = 'INVALID_HOME_SKIN';
  end if;

  for v_part in select distinct x from unnest(p_parts) as x order by 1 loop
    v_price := public.home_skin_price(p_theme, v_part);
    if v_price is null or v_price <= 0 then
      raise exception using errcode = 'P0001', message = 'INVALID_HOME_SKIN';
    end if;
    insert into public.user_home_skins (user_id, theme, part) values (v_user_id, p_theme, v_part) on conflict do nothing;
    if found then
      v_total := v_total + v_price;
      v_bought := v_bought || v_part;
    end if;
  end loop;

  if cardinality(v_bought) = 0 then
    raise exception using errcode = 'P0001', message = 'HOME_SKIN_OWNED';
  end if;
  if cardinality(v_bought) >= 2 then
    v_total := floor(v_total * 0.8 / 100) * 100;
  end if;

  if not public.add_blue_coin_event(
    v_user_id, 'home_skin', -v_total,
    'home-skin:' || p_theme || ':' || array_to_string(v_bought, ','),
    jsonb_build_object('label', 'ホームのカード', 'theme', p_theme, 'parts', to_jsonb(v_bought))
  ) then
    raise exception using errcode = 'P0001', message = 'PURCHASE_CONFLICT';
  end if;

  select balance into v_balance from public.user_blue_coins where user_id = v_user_id;
  return jsonb_build_object('ok', true, 'theme', p_theme, 'bought', to_jsonb(v_bought), 'price', v_total, 'balance', coalesce(v_balance, 0));
end;
$$;

revoke all on function public.buy_home_skins(text, text[]) from public, anon;
grant execute on function public.buy_home_skins(text, text[]) to authenticated;

comment on function public.buy_home_skins(text, text[]) is
  'ホームのカードの絵がらを青コインで買う（値段は home_skin_price。2枚以上まとめると2割引）。';

-- 使う絵がらを決める（カードごとに、いつもの か 買ったもの）
create or replace function public.set_home_skins(p_skins jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_part text;
  v_theme text;
  v_clean jsonb := '{}'::jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_skins is null or jsonb_typeof(p_skins) <> 'object' then
    raise exception using errcode = 'P0001', message = 'INVALID_HOME_SKIN';
  end if;

  foreach v_part in array array['scene', 'notice', 'highlights', 'collection'] loop
    v_theme := coalesce(p_skins ->> v_part, 'default');
    if public.home_skin_price(v_theme, v_part) is null then
      raise exception using errcode = 'P0001', message = 'INVALID_HOME_SKIN';
    end if;
    if v_theme <> 'default' and not exists (
      select 1 from public.user_home_skins where user_id = v_user_id and theme = v_theme and part = v_part
    ) then
      raise exception using errcode = 'P0001', message = 'HOME_SKIN_NOT_OWNED';
    end if;
    v_clean := v_clean || jsonb_build_object(v_part, v_theme);
  end loop;

  insert into public.user_app_background_choice (user_id, home_skins, updated_at)
  values (v_user_id, v_clean, now())
  on conflict (user_id) do update set home_skins = excluded.home_skins, updated_at = now();
  return jsonb_build_object('ok', true, 'skins', v_clean);
end;
$$;

revoke all on function public.set_home_skins(jsonb) from public, anon;
grant execute on function public.set_home_skins(jsonb) to authenticated;

comment on function public.set_home_skins(jsonb) is
  'ホームのカードの絵がらを決める（カードごとに default か、買った絵がら）。';

commit;

notify pgrst, 'reload schema';
