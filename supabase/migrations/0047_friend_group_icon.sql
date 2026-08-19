-- =============================================================
-- SNS: フレンドグループにアイコン（絵文字）を追加
-- =============================================================
-- グループ作成時にアイコンを選べるようにする。グループ一覧はこのアイコンを
-- 円形バッジとして横スクロールで表示する。
begin;

do $$
begin
  if to_regclass('public.friend_groups') is null then
    raise exception using
      errcode = 'P0001',
      message = 'FRIEND_GROUP_ICON_MISSING_DEPENDENCY: public.friend_groups',
      hint = '先に 0045_friend_groups.sql を適用してください。';
  end if;
end;
$$;

alter table public.friend_groups add column if not exists icon text not null default '👥';

create or replace function public.create_friend_group(p_name text, p_member_user_ids uuid[], p_icon text default '👥')
returns uuid
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_icon text := nullif(trim(coalesce(p_icon, '')), '');
  v_group_id uuid;
  v_member uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 40 then
    raise exception using errcode = 'P0001', message = 'GROUP_NAME_INVALID';
  end if;
  if v_icon is null or char_length(v_icon) > 8 then
    v_icon := '👥';
  end if;

  insert into public.friend_groups (owner_id, name, icon) values (v_user_id, v_name, v_icon)
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

revoke all on function public.create_friend_group(text, uuid[], text) from public, anon;
grant execute on function public.create_friend_group(text, uuid[], text) to authenticated;

create or replace function public.get_my_friend_groups()
returns table (
  id uuid,
  name text,
  icon text,
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

commit;

notify pgrst, 'reload schema';

select
  'FRIEND_GROUP_ICON_READY'::text as status,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'friend_groups' and column_name = 'icon'
  ) as icon_column_ok,
  has_function_privilege('authenticated', 'public.create_friend_group(text, uuid[], text)', 'EXECUTE') as create_group_ok;
