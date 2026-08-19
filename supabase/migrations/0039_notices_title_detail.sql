-- =============================================================
-- お知らせのタイトル・本文分離 + 詳細表示
-- =============================================================
-- 運営お知らせを「タイトル」と「本文」に分けて投稿できるようにし、
-- 一覧ではタイトルのみを表示、タップした先の詳細画面で本文を見せる。
-- 既存データ（payload->>'message' のみ）はタイトル・本文どちらにも
-- 使えるようフォールバックする。
begin;

do $$
begin
  if to_regclass('public.notices') is null then
    raise exception using
      errcode = 'P0001',
      message = 'NOTICES_TITLE_DETAIL_MIGRATION_MISSING_DEPENDENCY: public.notices',
      hint = 'お知らせ機能（0036_notices.sql）を先に適用してください。';
  end if;
  if to_regprocedure('public.is_notice_admin()') is null then
    raise exception using
      errcode = 'P0001',
      message = 'NOTICES_TITLE_DETAIL_MIGRATION_MISSING_DEPENDENCY: public.is_notice_admin()',
      hint = 'お知らせ機能（0036_notices.sql）を先に適用してください。';
  end if;
end;
$$;

-- -------------------------------------------------------------
-- 一覧: 運営お知らせのタイトルは payload->>'title'（無ければ従来の message で代替）
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
  is_read boolean
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
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんが図鑑でレア以上のアイテムを手に入れました'
      else ''
    end as title,
    case n.type
      when 'admin' then coalesce(nullif(n.payload ->> 'body', ''), n.payload ->> 'message')
      else null
    end as content,
    exists (
      select 1 from public.notice_reads r
      where r.notice_id = n.id and r.user_id = auth.uid()
    ) as is_read
  from public.notices n
  left join public.profiles prof on prof.user_id = n.actor_user_id
  left join public.spots s on n.type = 'friend_spot' and s.id = (n.payload ->> 'spot_id')::uuid
  where auth.uid() is not null
    and (
      (n.type = 'friend_spot' and public.is_friend(n.actor_user_id))
      or n.type <> 'friend_spot'
    )
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- -------------------------------------------------------------
-- 詳細: 1件分をタイトル・本文つきで返す
-- -------------------------------------------------------------
create or replace function public.get_notice_detail(p_notice_id uuid)
returns table (
  id uuid,
  type text,
  created_at timestamptz,
  display_name text,
  avatar_url text,
  title text,
  content text,
  is_read boolean
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
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんが図鑑でレア以上のアイテムを手に入れました'
      else ''
    end as title,
    case n.type
      when 'admin' then coalesce(nullif(n.payload ->> 'body', ''), n.payload ->> 'message')
      else null
    end as content,
    exists (
      select 1 from public.notice_reads r
      where r.notice_id = n.id and r.user_id = auth.uid()
    ) as is_read
  from public.notices n
  left join public.profiles prof on prof.user_id = n.actor_user_id
  left join public.spots s on n.type = 'friend_spot' and s.id = (n.payload ->> 'spot_id')::uuid
  where auth.uid() is not null
    and n.id = p_notice_id
    and (
      (n.type = 'friend_spot' and public.is_friend(n.actor_user_id))
      or n.type <> 'friend_spot'
    );
$$;

-- -------------------------------------------------------------
-- 管理者投稿・編集: タイトル + 本文の2フィールドに変更
-- -------------------------------------------------------------
drop function if exists public.post_admin_notice(text);

create or replace function public.post_admin_notice(p_title text, p_message text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_message text := btrim(coalesce(p_message, ''));
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
  values ('admin', null, jsonb_build_object('title', v_title, 'body', v_message))
  returning id into v_id;

  return v_id;
end;
$$;

drop function if exists public.update_admin_notice(uuid, text);

create or replace function public.update_admin_notice(p_notice_id uuid, p_title text, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_message text := btrim(coalesce(p_message, ''));
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
  set payload = jsonb_build_object('title', v_title, 'body', v_message),
      updated_at = now()
  where id = p_notice_id
    and type = 'admin';

  if not found then
    raise exception using errcode = 'P0001', message = 'NOTICE_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.get_notice_detail(uuid) from public, anon;
revoke all on function public.post_admin_notice(text, text) from public, anon;
revoke all on function public.update_admin_notice(uuid, text, text) from public, anon;

grant execute on function public.get_notice_detail(uuid) to authenticated;
grant execute on function public.post_admin_notice(text, text) to authenticated;
grant execute on function public.update_admin_notice(uuid, text, text) to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'NOTICES_TITLE_DETAIL_READY'::text as status,
  to_regprocedure('public.get_notice_detail(uuid)') is not null as detail_rpc_ok,
  to_regprocedure('public.post_admin_notice(text, text)') is not null as post_rpc_ok,
  to_regprocedure('public.update_admin_notice(uuid, text, text)') is not null as update_rpc_ok;
