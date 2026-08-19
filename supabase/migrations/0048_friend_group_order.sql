-- =============================================================
-- SNS: グループの並び順（自分だけの並び替え）
-- =============================================================
-- 一番左のグループを「既定のグループ」として扱うため、並び順は
-- friend_group_members.sort_order（自分の行だけ）で持つ。
begin;

do $$
begin
  if to_regclass('public.friend_group_members') is null then
    raise exception using
      errcode = 'P0001',
      message = 'FRIEND_GROUP_ORDER_MISSING_DEPENDENCY: public.friend_group_members',
      hint = '先に 0045_friend_groups.sql を適用してください。';
  end if;
end;
$$;

alter table public.friend_group_members add column if not exists sort_order integer not null default 0;

drop function if exists public.get_my_friend_groups();

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
  order by m.sort_order asc, g.created_at asc;
$$;

revoke all on function public.get_my_friend_groups() from public, anon;
grant execute on function public.get_my_friend_groups() to authenticated;

create or replace function public.reorder_friend_groups(p_group_ids uuid[])
returns void
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_group_id uuid;
  v_index integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_group_ids is null then
    return;
  end if;

  foreach v_group_id in array p_group_ids loop
    update public.friend_group_members
    set sort_order = v_index
    where group_id = v_group_id and user_id = v_user_id;
    v_index := v_index + 1;
  end loop;
end;
$$;

revoke all on function public.reorder_friend_groups(uuid[]) from public, anon;
grant execute on function public.reorder_friend_groups(uuid[]) to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'FRIEND_GROUP_ORDER_READY'::text as status,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'friend_group_members' and column_name = 'sort_order'
  ) as sort_order_column_ok,
  has_function_privilege('authenticated', 'public.reorder_friend_groups(uuid[])', 'EXECUTE') as reorder_ok;
