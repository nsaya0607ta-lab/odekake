-- =============================================================
-- ホームの着せかえ（カードの並び・出す出さない・透け感）を、端末をまたいで保存する
-- =============================================================
-- 0122 の後に適用する。背景の選択と同じ user_app_background_choice に、home_look 列を足す。
-- 中身はアプリ側の src/lib/home-look.ts の HomeLook（{"order":[...],"hidden":[...],"cards":"solid"}）。
-- アプリが形をととのえてから入れるので、ここでは大きさと形（オブジェクト）だけを確かめる。
begin;

do $$
begin
  if to_regclass('public.user_app_background_choice') is null then
    raise exception using
      errcode = 'P0001',
      message = 'HOME_LOOK_MISSING_DEPENDENCY',
      hint = 'ショップの背景（0122）を先に適用してください。';
  end if;
end;
$$;

alter table public.user_app_background_choice add column if not exists home_look jsonb;

create or replace function public.set_home_look(p_look jsonb)
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
  if p_look is null or jsonb_typeof(p_look) <> 'object' or length(p_look::text) > 500 then
    raise exception using errcode = 'P0001', message = 'INVALID_HOME_LOOK';
  end if;

  insert into public.user_app_background_choice (user_id, home_look, updated_at)
  values (v_user_id, p_look, now())
  on conflict (user_id) do update set home_look = excluded.home_look, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.set_home_look(jsonb) from public, anon;
grant execute on function public.set_home_look(jsonb) to authenticated;

comment on function public.set_home_look(jsonb) is
  'ホームの着せかえ（カードの並び・出す出さない・透け感）を保存する。';

commit;

notify pgrst, 'reload schema';
