-- =============================================================
-- 管理者お知らせの削除
-- =============================================================
begin;

do $$
begin
  if to_regclass('public.notices') is null then
    raise exception using
      errcode = 'P0001',
      message = 'NOTICES_ADMIN_DELETE_MIGRATION_MISSING_DEPENDENCY: public.notices',
      hint = 'お知らせ機能（0036_notices.sql）を先に適用してください。';
  end if;
  if to_regprocedure('public.is_notice_admin()') is null then
    raise exception using
      errcode = 'P0001',
      message = 'NOTICES_ADMIN_DELETE_MIGRATION_MISSING_DEPENDENCY: public.is_notice_admin()',
      hint = 'お知らせ機能（0036_notices.sql）を先に適用してください。';
  end if;
end;
$$;

create or replace function public.delete_admin_notice(p_notice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_notice_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_REQUIRED';
  end if;

  delete from public.notices
  where id = p_notice_id
    and type = 'admin';

  if not found then
    raise exception using errcode = 'P0001', message = 'NOTICE_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.delete_admin_notice(uuid) from public, anon;
grant execute on function public.delete_admin_notice(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'NOTICES_ADMIN_DELETE_READY'::text as status,
  to_regprocedure('public.delete_admin_notice(uuid)') is not null as delete_rpc_ok;
