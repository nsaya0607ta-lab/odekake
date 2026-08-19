-- =============================================================
-- 管理者お知らせの編集
-- =============================================================
-- for.administ@gmail.com が、自分が配信した「運営」お知らせの本文を
-- 後から編集できるようにする。get_notices_feed は payload->>'message' を
-- そのつど読むので、編集すればホーム・一覧にもすぐ反映される。
begin;

do $$
begin
  if to_regclass('public.notices') is null then
    raise exception using
      errcode = 'P0001',
      message = 'NOTICES_ADMIN_EDIT_MIGRATION_MISSING_DEPENDENCY: public.notices',
      hint = 'お知らせ機能（0036_notices.sql）を先に適用してください。';
  end if;
  if to_regprocedure('public.is_notice_admin()') is null then
    raise exception using
      errcode = 'P0001',
      message = 'NOTICES_ADMIN_EDIT_MIGRATION_MISSING_DEPENDENCY: public.is_notice_admin()',
      hint = 'お知らせ機能（0036_notices.sql）を先に適用してください。';
  end if;
end;
$$;

alter table public.notices add column if not exists updated_at timestamptz not null default now();

create or replace function public.update_admin_notice(p_notice_id uuid, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message text := btrim(coalesce(p_message, ''));
begin
  if not public.is_notice_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_REQUIRED';
  end if;

  if length(v_message) = 0 or length(v_message) > 500 then
    raise exception using errcode = 'P0001', message = 'INVALID_MESSAGE';
  end if;

  update public.notices
  set payload = jsonb_set(payload, '{message}', to_jsonb(v_message)),
      updated_at = now()
  where id = p_notice_id
    and type = 'admin';

  if not found then
    raise exception using errcode = 'P0001', message = 'NOTICE_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.update_admin_notice(uuid, text) from public, anon;
grant execute on function public.update_admin_notice(uuid, text) to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'NOTICES_ADMIN_EDIT_READY'::text as status,
  to_regprocedure('public.update_admin_notice(uuid, text)') is not null as update_rpc_ok;
