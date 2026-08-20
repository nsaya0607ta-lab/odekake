-- =============================================================
-- SNS: グループ作成時に最低1人はメンバーを必須にする
-- =============================================================
-- アプリ側では既にバリデーションしているが、RPCを直接呼ばれた場合の
-- 防御としてDB側でも1人以下（自分だけ）での作成を拒否する。
begin;

do $$
begin
  if to_regclass('public.friend_groups') is null then
    raise exception using
      errcode = 'P0001',
      message = 'FRIEND_GROUP_MIN_MEMBERS_MISSING_DEPENDENCY: public.friend_groups',
      hint = '先に 0045_friend_groups.sql / 0048_friend_group_icon_image.sql を適用してください。';
  end if;
end;
$$;

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
  v_added_members integer := 0;
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
        v_added_members := v_added_members + 1;
      end if;
    end loop;
  end if;

  if v_added_members = 0 then
    raise exception using errcode = 'P0001', message = 'GROUP_NEEDS_MEMBER';
  end if;

  return v_group_id;
end;
$$;

revoke all on function public.create_friend_group(text, uuid[], text, text) from public, anon;
grant execute on function public.create_friend_group(text, uuid[], text, text) to authenticated;

commit;

notify pgrst, 'reload schema';

select 'FRIEND_GROUP_MIN_MEMBERS_READY'::text as status;
