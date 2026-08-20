-- =============================================================
-- SNS: フレンドグループのアイコンを画像に変更
-- =============================================================
-- 絵文字アイコンの代わりに、メンバーが自分で選んだ画像をアイコンにできるようにする。
-- グループ作成時・グループの設定画面のどちらからも、参加メンバーなら誰でも変更できる。
begin;

do $$
begin
  if to_regclass('public.friend_groups') is null then
    raise exception using
      errcode = 'P0001',
      message = 'FRIEND_GROUP_ICON_IMAGE_MISSING_DEPENDENCY: public.friend_groups',
      hint = '先に 0045_friend_groups.sql / 0047_friend_group_icon.sql を適用してください。';
  end if;
end;
$$;

alter table public.friend_groups add column if not exists icon_path text;

-- 旧シグネチャ（2引数・3引数）を残すと、アプリが p_name/p_member_user_ids の2引数だけで
-- 呼んだときにデフォルト引数のせいでどの関数か曖昧になり呼び出しが失敗するため、先に消す
drop function if exists public.create_friend_group(text, uuid[]);
drop function if exists public.create_friend_group(text, uuid[], text);

-- p_icon はもう使わないが、既存呼び出しとの互換のため引数自体は残し、
-- 画像パス（p_icon_path）だけを保存する。
create or replace function public.create_friend_group(
  p_name text,
  p_member_user_ids uuid[],
  p_icon text default '👥',
  p_icon_path text default null
)
returns uuid
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_icon_path text := nullif(trim(coalesce(p_icon_path, '')), '');
  v_group_id uuid;
  v_member uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 40 then
    raise exception using errcode = 'P0001', message = 'GROUP_NAME_INVALID';
  end if;

  insert into public.friend_groups (owner_id, name, icon, icon_path)
  values (v_user_id, v_name, '👥', v_icon_path)
  returning id into v_group_id;

  insert into public.friend_group_members (group_id, user_id) values (v_group_id, v_user_id);

  if p_member_user_ids is not null then
    foreach v_member in array p_member_user_ids loop
      if v_member <> v_user_id and public.is_friend(v_member) then
        insert into public.friend_group_members (group_id, user_id)
        values (v_group_id, v_member)
        on conflict do nothing;
      end if;
    end loop;
  end if;

  return v_group_id;
end;
$$;

revoke all on function public.create_friend_group(text, uuid[], text, text) from public, anon;
grant execute on function public.create_friend_group(text, uuid[], text, text) to authenticated;

-- グループ名・アイコン画像の変更。参加メンバーなら誰でも呼べる
create or replace function public.update_friend_group(
  p_group_id uuid,
  p_name text default null,
  p_icon_path text default null,
  p_remove_icon boolean default false
)
returns void
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not public.is_friend_group_member(p_group_id) then
    raise exception using errcode = 'P0001', message = 'NOT_GROUP_MEMBER';
  end if;

  if p_name is not null then
    v_name := trim(p_name);
    if char_length(v_name) < 1 or char_length(v_name) > 40 then
      raise exception using errcode = 'P0001', message = 'GROUP_NAME_INVALID';
    end if;
    update public.friend_groups set name = v_name where id = p_group_id;
  end if;

  if p_remove_icon then
    update public.friend_groups set icon_path = null where id = p_group_id;
  elsif p_icon_path is not null then
    update public.friend_groups set icon_path = nullif(trim(p_icon_path), '') where id = p_group_id;
  end if;
end;
$$;

revoke all on function public.update_friend_group(uuid, text, text, boolean) from public, anon;
grant execute on function public.update_friend_group(uuid, text, text, boolean) to authenticated;

-- 戻り値の列構成が変わるため、既存の関数を先に消してから作り直す
drop function if exists public.get_my_friend_groups();

create or replace function public.get_my_friend_groups()
returns table (
  id uuid,
  name text,
  icon text,
  icon_path text,
  owner_id uuid,
  member_count bigint,
  created_at timestamptz,
  has_unread boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    g.id,
    g.name,
    g.icon,
    g.icon_path,
    g.owner_id,
    (select count(*) from public.friend_group_members mm where mm.group_id = g.id) as member_count,
    g.created_at,
    exists (
      select 1 from public.friend_photos fp
      where fp.group_id = g.id
        and fp.user_id <> auth.uid()
        and fp.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
      union all
      select 1 from public.friend_group_messages gm
      where gm.group_id = g.id
        and gm.user_id <> auth.uid()
        and gm.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
    ) as has_unread
  from public.friend_groups g
  join public.friend_group_members m on m.group_id = g.id and m.user_id = auth.uid()
  left join public.friend_group_reads r on r.group_id = g.id and r.user_id = auth.uid()
  order by g.created_at asc;
$$;

revoke all on function public.get_my_friend_groups() from public, anon;
grant execute on function public.get_my_friend_groups() to authenticated;

-- -------------------------------------------------------------
-- Storage: groups/{group_id}/icon/... の読み書き
-- -------------------------------------------------------------
create or replace function public.can_access_storage_path(p_name text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  parts text[] := storage.foldername(p_name);
begin
  if auth.uid() is null then
    return false;
  end if;

  if (parts[1] = 'tmp' or parts[1] = 'users') and parts[2] = auth.uid()::text then
    return true;
  end if;

  if parts[1] = 'trips' then
    begin
      return public.can_access_trip(parts[2]::uuid);
    exception when others then
      return false;
    end;
  end if;

  if parts[1] = 'friend-photos' and parts[2] = auth.uid()::text then
    return true;
  end if;

  if parts[1] = 'groups' and parts[3] = 'icon' then
    begin
      return public.is_friend_group_member(parts[2]::uuid);
    exception when others then
      return false;
    end;
  end if;

  return false;
end;
$$;

revoke all on function public.can_access_storage_path(text) from public, anon;
grant execute on function public.can_access_storage_path(text) to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'FRIEND_GROUP_ICON_IMAGE_READY'::text as status,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'friend_groups' and column_name = 'icon_path'
  ) as icon_path_column_ok,
  has_function_privilege('authenticated', 'public.update_friend_group(uuid, text, text, boolean)', 'EXECUTE') as update_group_ok;
