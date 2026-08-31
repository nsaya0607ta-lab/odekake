-- =============================================================
-- 運営お知らせに画像添付を追加
-- =============================================================
-- 管理者アカウント(is_notice_admin())が投稿する運営お知らせに、1枚まで画像を
-- 添付できるようにする。画像は既存の photos バケットの notices/{id}/ 以下に保存し、
-- 投稿・編集は管理者のみ、閲覧は認証済みユーザー全員に許可する。
begin;

do $$
begin
  if to_regclass('public.notices') is null then
    raise exception using
      errcode = 'P0001',
      message = 'NOTICE_ADMIN_IMAGE_MIGRATION_MISSING_DEPENDENCY: public.notices',
      hint = 'お知らせ機能（0036_notices.sql）を先に適用してください。';
  end if;
  if to_regprocedure('public.is_notice_admin()') is null then
    raise exception using
      errcode = 'P0001',
      message = 'NOTICE_ADMIN_IMAGE_MIGRATION_MISSING_DEPENDENCY: public.is_notice_admin()',
      hint = 'お知らせ機能（0036_notices.sql）を先に適用してください。';
  end if;
  if to_regprocedure('public.can_access_storage_path(text)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'NOTICE_ADMIN_IMAGE_MIGRATION_MISSING_DEPENDENCY: public.can_access_storage_path(text)',
      hint = '写真アップロード機能（0001_init.sql）を先に適用してください。';
  end if;
end;
$$;

-- -------------------------------------------------------------
-- Storage: notices/ 以下は認証済みユーザー全員が閲覧でき、書き込みは管理者のみ
-- -------------------------------------------------------------
drop policy if exists photos_select on storage.objects;
create policy photos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and (
      public.can_access_storage_path(name)
      or public.can_view_friend_storage_path(name)
      or (storage.foldername(name))[1] = 'notices'
    )
  );

drop policy if exists photos_insert on storage.objects;
create policy photos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (
      public.can_access_storage_path(name)
      or ((storage.foldername(name))[1] = 'notices' and public.is_notice_admin())
    )
  );

drop policy if exists photos_update on storage.objects;
create policy photos_update on storage.objects for update to authenticated
  using (
    bucket_id = 'photos'
    and (
      public.can_access_storage_path(name)
      or ((storage.foldername(name))[1] = 'notices' and public.is_notice_admin())
    )
  )
  with check (
    bucket_id = 'photos'
    and (
      public.can_access_storage_path(name)
      or ((storage.foldername(name))[1] = 'notices' and public.is_notice_admin())
    )
  );

drop policy if exists photos_delete on storage.objects;
create policy photos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'photos'
    and (
      public.can_access_storage_path(name)
      or ((storage.foldername(name))[1] = 'notices' and public.is_notice_admin())
    )
  );

-- -------------------------------------------------------------
-- post_admin_notice / update_admin_notice: 画像パスを受け取れるように
-- -------------------------------------------------------------
drop function if exists public.post_admin_notice(text, text);

create or replace function public.post_admin_notice(p_title text, p_message text, p_image_path text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_message text := btrim(coalesce(p_message, ''));
  v_image_path text := nullif(btrim(coalesce(p_image_path, '')), '');
begin
  if not public.is_notice_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_REQUIRED';
  end if;

  if length(v_title) = 0 or length(v_title) > 100 then
    raise exception using errcode = 'P0001', message = 'INVALID_TITLE';
  end if;

  if length(v_message) = 0 or length(v_message) > 2000 then
    raise exception using errcode = 'P0001', message = 'INVALID_MESSAGE';
  end if;

  insert into public.notices (type, actor_user_id, payload)
  values (
    'admin',
    null,
    jsonb_strip_nulls(jsonb_build_object('title', v_title, 'body', v_message, 'image_path', v_image_path))
  )
  returning id into v_id;

  return v_id;
end;
$$;

drop function if exists public.update_admin_notice(uuid, text, text);

create or replace function public.update_admin_notice(
  p_notice_id uuid, p_title text, p_message text, p_image_path text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_message text := btrim(coalesce(p_message, ''));
  v_image_path text := nullif(btrim(coalesce(p_image_path, '')), '');
begin
  if not public.is_notice_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_REQUIRED';
  end if;

  if length(v_title) = 0 or length(v_title) > 100 then
    raise exception using errcode = 'P0001', message = 'INVALID_TITLE';
  end if;

  if length(v_message) = 0 or length(v_message) > 2000 then
    raise exception using errcode = 'P0001', message = 'INVALID_MESSAGE';
  end if;

  update public.notices
  set payload = jsonb_strip_nulls(jsonb_build_object('title', v_title, 'body', v_message, 'image_path', v_image_path)),
      updated_at = now()
  where id = p_notice_id
    and type = 'admin';

  if not found then
    raise exception using errcode = 'P0001', message = 'NOTICE_NOT_FOUND';
  end if;
end;
$$;

-- -------------------------------------------------------------
-- delete_admin_notice: 削除前の画像パスを返す（Storage側の後片付け用）
-- -------------------------------------------------------------
drop function if exists public.delete_admin_notice(uuid);

create or replace function public.delete_admin_notice(p_notice_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_image_path text;
begin
  if not public.is_notice_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_REQUIRED';
  end if;

  delete from public.notices
  where id = p_notice_id
    and type = 'admin'
  returning payload ->> 'image_path' into v_image_path;

  if not found then
    raise exception using errcode = 'P0001', message = 'NOTICE_NOT_FOUND';
  end if;

  return v_image_path;
end;
$$;

-- -------------------------------------------------------------
-- get_notices_feed / get_notice_detail: image_path を返す
-- -------------------------------------------------------------
drop function if exists public.get_notices_feed(integer);

create or replace function public.get_notices_feed(p_limit integer default 20)
returns table (
  id uuid,
  type text,
  created_at timestamptz,
  display_name text,
  avatar_url text,
  title text,
  content text,
  is_read boolean,
  image_path text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    n.id,
    n.type,
    n.created_at,
    prof.display_name,
    prof.profile_image_url,
    case n.type
      when 'admin' then coalesce(nullif(n.payload ->> 'title', ''), n.payload ->> 'message')
      when 'friend_spot' then
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんが' || coalesce(s.name, '') || 'に行きました'
      when 'minigame_best' then
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんがミニゲームで自己ベストを更新しました'
      when 'steps_10000' then
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんが1日1万歩を達成しました'
      when 'collection_rare' then
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんが図鑑で'
          || coalesce(public.rare_plus_item_rarity(n.payload ->> 'item_id'), 'レア以上')
          || 'のアイテムを手に入れました'
      else ''
    end as title,
    case n.type
      when 'admin' then coalesce(nullif(n.payload ->> 'body', ''), n.payload ->> 'message')
      else null
    end as content,
    exists (
      select 1 from public.notice_reads r
      where r.notice_id = n.id and r.user_id = auth.uid()
    ) as is_read,
    case n.type
      when 'admin' then n.payload ->> 'image_path'
      else null
    end as image_path
  from public.notices n
  left join public.profiles prof on prof.user_id = n.actor_user_id
  left join public.spots s on n.type = 'friend_spot' and s.id = (n.payload ->> 'spot_id')::uuid
  where auth.uid() is not null
    and (
      (n.type in ('friend_spot', 'minigame_best', 'steps_10000', 'collection_rare')
         and public.is_friend(n.actor_user_id))
      or n.type = 'admin'
    )
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

drop function if exists public.get_notice_detail(uuid);

create or replace function public.get_notice_detail(p_notice_id uuid)
returns table (
  id uuid,
  type text,
  created_at timestamptz,
  display_name text,
  avatar_url text,
  title text,
  content text,
  is_read boolean,
  image_path text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    n.id,
    n.type,
    n.created_at,
    prof.display_name,
    prof.profile_image_url,
    case n.type
      when 'admin' then coalesce(nullif(n.payload ->> 'title', ''), n.payload ->> 'message')
      when 'friend_spot' then
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんが' || coalesce(s.name, '') || 'に行きました'
      when 'minigame_best' then
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんがミニゲームで自己ベストを更新しました'
      when 'steps_10000' then
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんが1日1万歩を達成しました'
      when 'collection_rare' then
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんが図鑑で'
          || coalesce(public.rare_plus_item_rarity(n.payload ->> 'item_id'), 'レア以上')
          || 'のアイテムを手に入れました'
      else ''
    end as title,
    case n.type
      when 'admin' then coalesce(nullif(n.payload ->> 'body', ''), n.payload ->> 'message')
      when 'collection_rare' then
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんが'
          || case
               when exists (
                 select 1 from public.user_gacha_items ug
                 where ug.user_id = auth.uid() and ug.item_id = n.payload ->> 'item_id'
               ) then coalesce(public.rare_plus_item_name(n.payload ->> 'item_id'), '？？？')
               else '？？？'
             end
          || 'を手に入れました！'
      else null
    end as content,
    exists (
      select 1 from public.notice_reads r
      where r.notice_id = n.id and r.user_id = auth.uid()
    ) as is_read,
    case n.type
      when 'admin' then n.payload ->> 'image_path'
      else null
    end as image_path
  from public.notices n
  left join public.profiles prof on prof.user_id = n.actor_user_id
  left join public.spots s on n.type = 'friend_spot' and s.id = (n.payload ->> 'spot_id')::uuid
  where auth.uid() is not null
    and n.id = p_notice_id
    and (
      (n.type in ('friend_spot', 'minigame_best', 'steps_10000', 'collection_rare')
         and public.is_friend(n.actor_user_id))
      or n.type = 'admin'
    );
$$;

revoke all on function public.post_admin_notice(text, text, text) from public, anon;
revoke all on function public.update_admin_notice(uuid, text, text, text) from public, anon;
revoke all on function public.delete_admin_notice(uuid) from public, anon;
revoke all on function public.get_notices_feed(integer) from public, anon;
revoke all on function public.get_notice_detail(uuid) from public, anon;

grant execute on function public.post_admin_notice(text, text, text) to authenticated;
grant execute on function public.update_admin_notice(uuid, text, text, text) to authenticated;
grant execute on function public.delete_admin_notice(uuid) to authenticated;
grant execute on function public.get_notices_feed(integer) to authenticated;
grant execute on function public.get_notice_detail(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'NOTICE_ADMIN_IMAGE_READY'::text as status,
  to_regprocedure('public.post_admin_notice(text, text, text)') is not null as post_rpc_ok,
  to_regprocedure('public.update_admin_notice(uuid, text, text, text)') is not null as update_rpc_ok,
  to_regprocedure('public.delete_admin_notice(uuid)') is not null as delete_rpc_ok,
  to_regprocedure('public.get_notice_detail(uuid)') is not null as detail_rpc_ok;
