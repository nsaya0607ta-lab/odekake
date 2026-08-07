-- =============================================================
-- 写真の一時領域を確実に使えるようにする
-- =============================================================
-- 保存前の写真は tmp/{user_id}/{下書きID}/ へアップロードし、保存時に
-- 本来の場所へ移動している。tmp/ を許可しているのは 0002 で入れ替えた
-- can_access_storage_path() だが、0001 の定義（tmp/ を許可しない）が
-- 残っているデータベースではアップロードが RLS で弾かれ、
-- プロフィール画像や表紙画像が「アップロードに失敗しました」になる。
--
-- 0002 と同じ定義をもう一度当てて、どのデータベースでも tmp/ を使えるようにする。
-- あわせて、アプリ側の予備の一時領域 users/{user_id}/uploads/ も
-- users/ 配下なのでこの関数でそのまま許可される。
--
-- パス設計:
--   tmp/{user_id}/{draft_token}/...        ← 保存前
--   users/{user_id}/uploads/{token}/...    ← 保存前（予備）
--   users/{user_id}/profile/...
--   trips/{trip_id}/cover/...
--   trips/{trip_id}/visits/{visit_record_id}/...
-- =============================================================
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

-- ポリシー本体も、関数を参照する形で当て直しておく（欠けている環境向け）
drop policy if exists photos_select on storage.objects;
create policy photos_select on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.can_access_storage_path(name));

drop policy if exists photos_insert on storage.objects;
create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.can_access_storage_path(name));

drop policy if exists photos_update on storage.objects;
create policy photos_update on storage.objects for update to authenticated
  using (bucket_id = 'photos' and public.can_access_storage_path(name))
  with check (bucket_id = 'photos' and public.can_access_storage_path(name));

drop policy if exists photos_delete on storage.objects;
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.can_access_storage_path(name));
