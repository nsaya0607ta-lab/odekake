-- =============================================================
-- フレンド機能：旧0019適用後の仕上げと確認
-- =============================================================
-- 0019_friends.sql の旧版をすでに実行した環境向け。
-- 何度実行しても安全。Vercelの環境変数は変更しない。

begin;

do $$
declare
  v_missing text[] := '{}';
begin
  if to_regclass('public.friend_codes') is null then
    v_missing := array_append(v_missing, 'public.friend_codes');
  end if;
  if to_regclass('public.friendships') is null then
    v_missing := array_append(v_missing, 'public.friendships');
  end if;
  if to_regclass('public.friend_privacy_settings') is null then
    v_missing := array_append(v_missing, 'public.friend_privacy_settings');
  end if;
  if to_regprocedure('public.get_or_create_friend_code()') is null then
    v_missing := array_append(v_missing, 'public.get_or_create_friend_code()');
  end if;
  if to_regprocedure('public.get_friend_list()') is null then
    v_missing := array_append(v_missing, 'public.get_friend_list()');
  end if;

  if cardinality(v_missing) > 0 then
    raise exception using
      errcode = 'P0001',
      message = 'FRIENDS_SETUP_INCOMPLETE: ' || array_to_string(v_missing, ', '),
      hint = '先に0019_friends.sqlを最後まで実行してください。Vercelの環境変数は変更しないでください。';
  end if;
end;
$$;

create or replace function public.get_friends_health()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  return jsonb_build_object('ready', true, 'version', 2);
end;
$$;

revoke all on function public.get_friends_health() from public, anon;
grant execute on function public.get_friends_health() to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'FRIENDS_V2_READY'::text as status,
  to_regclass('public.friend_codes') is not null as friend_codes_ok,
  to_regclass('public.friendships') is not null as friendships_ok,
  to_regclass('public.friend_privacy_settings') is not null as privacy_ok,
  to_regprocedure('public.get_friends_health()') is not null as health_rpc_ok,
  to_regprocedure('public.get_or_create_friend_code()') is not null as code_rpc_ok,
  to_regprocedure('public.get_friend_list()') is not null as list_rpc_ok;
