-- =============================================================
-- 運営お知らせのHTML添付を専用バケットへ分離
-- =============================================================
-- 0083で追加したHTML添付機能は既存の photos バケットへアップロードしていたが、
-- photos バケットは Storage 側で allowed_mime_types が image/jpeg・image/png・
-- image/webp のみに制限されているため、text/html のアップロードがStorage API側で
-- 拒否されていた（RLSではなくバケット設定によるエラー）。
--
-- photos バケットの許可MIMEを緩めると、既存のプロフィール写真・旅行写真などあらゆる
-- 書き込み可能なパスでもHTMLファイルを保存できてしまい、アプリと同一オリジンで配信される
-- /api/photo 経由でスクリプトが実行されるリスクが管理者以外にも広がる。
-- そのため、HTML添付専用の notice_files バケットを新設し、書き込みを管理者のみに限定する。
begin;

do $$
begin
  if to_regclass('public.notices') is null then
    raise exception using
      errcode = 'P0001',
      message = 'NOTICE_HTML_BUCKET_MIGRATION_MISSING_DEPENDENCY: public.notices',
      hint = 'お知らせ機能（0036_notices.sql）を先に適用してください。';
  end if;
  if to_regprocedure('public.is_notice_admin()') is null then
    raise exception using
      errcode = 'P0001',
      message = 'NOTICE_HTML_BUCKET_MIGRATION_MISSING_DEPENDENCY: public.is_notice_admin()',
      hint = 'お知らせ機能（0036_notices.sql）を先に適用してください。';
  end if;
end;
$$;

-- -------------------------------------------------------------
-- 専用バケット（非公開、text/htmlのみ、上限2MB）
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notice_files', 'notice_files', false, 2097152, array['text/html'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;

-- 書き込み（一時領域への保存を含む）は管理者のみ、閲覧は認証済みユーザー全員に許可する。
-- バケット全体が本添付専用のため、パスの内訳（tmp/等）で区別する必要はない。
drop policy if exists notice_files_select on storage.objects;
create policy notice_files_select on storage.objects for select to authenticated
  using (bucket_id = 'notice_files');

drop policy if exists notice_files_insert on storage.objects;
create policy notice_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'notice_files' and public.is_notice_admin());

drop policy if exists notice_files_update on storage.objects;
create policy notice_files_update on storage.objects for update to authenticated
  using (bucket_id = 'notice_files' and public.is_notice_admin())
  with check (bucket_id = 'notice_files' and public.is_notice_admin());

drop policy if exists notice_files_delete on storage.objects;
create policy notice_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'notice_files' and public.is_notice_admin());

-- -------------------------------------------------------------
-- delete_admin_notice: image_path（photosバケット）とhtml_path（notice_filesバケット）を
-- 別々に返す（後片付け時にどちらのバケットから削除するか区別するため、text[]をやめる）
-- -------------------------------------------------------------
drop function if exists public.delete_admin_notice(uuid);

create or replace function public.delete_admin_notice(p_notice_id uuid)
returns table (image_path text, html_path text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  if not public.is_notice_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_REQUIRED';
  end if;

  delete from public.notices
  where id = p_notice_id
    and type = 'admin'
  returning payload into v_payload;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOTICE_NOT_FOUND';
  end if;

  return query select v_payload ->> 'image_path', v_payload ->> 'html_path';
end;
$$;

revoke all on function public.delete_admin_notice(uuid) from public, anon;
grant execute on function public.delete_admin_notice(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'NOTICE_HTML_BUCKET_READY'::text as status,
  exists (select 1 from storage.buckets where id = 'notice_files') as bucket_ok,
  to_regprocedure('public.delete_admin_notice(uuid)') is not null as delete_rpc_ok;
