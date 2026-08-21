-- =============================================================
-- ユーザー個別のホーム画面（/sns/users/[userId]）のヘッダー用。
-- public.profiles の select ポリシーは本人の行しか読めないため
-- （0008_remove_shared_trips.sqlで本人限定になった）、フレンドの
-- 表示名・アイコンをそのまま select しても常に空になってしまっていた。
-- SECURITY DEFINER の RPC でフレンド視点の可視性チェックをして返す。
-- =============================================================
begin;

do $$
begin
  if to_regprocedure('public.is_friend(uuid)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'GET_FRIEND_PROFILE_MISSING_DEPENDENCY: public.is_friend(uuid)',
      hint = '先に 0019_friends.sql を適用してください。';
  end if;
end;
$$;

create or replace function public.get_friend_profile(p_user_id uuid)
returns table (display_name text, profile_image_url text)
language sql
security definer
stable
set search_path = public
as $$
  select p.display_name, p.profile_image_url
  from public.profiles p
  where p.user_id = p_user_id
    and (p_user_id = auth.uid() or public.is_friend(p_user_id));
$$;

revoke all on function public.get_friend_profile(uuid) from public, anon;
grant execute on function public.get_friend_profile(uuid) to authenticated;

commit;
