-- =============================================================
-- SNS: 全体（フレンド全員）のチャット
-- =============================================================
-- グループにはチャットがあるのに、全体共有（「みんな」タブ）にはチャットが
-- ないと画面の作りが揃わない。グループのチャットと同じ「Twitterのタイムライン
-- のような短文投稿」を、全体共有側にも用意する。
--
-- 公開範囲は既存の写真フィード（get_sns_feed）と同じく自分視点:
-- 見えるのは自分の発言と、直接フレンドの発言だけ。
begin;

do $$
begin
  if to_regclass('public.friendships') is null then
    raise exception using
      errcode = 'P0001',
      message = 'FRIEND_GLOBAL_CHAT_MISSING_DEPENDENCY: public.friendships',
      hint = '先に 0019_friends.sql を適用してください。';
  end if;
  if to_regprocedure('public.is_friend(uuid)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'FRIEND_GLOBAL_CHAT_MISSING_DEPENDENCY: public.is_friend(uuid)',
      hint = '先に 0019_friends.sql を適用してください。';
  end if;
end;
$$;

create table if not exists public.friend_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint friend_messages_body_length check (char_length(body) between 1 and 1000)
);

create index if not exists friend_messages_created_at_idx on public.friend_messages(created_at desc);
create index if not exists friend_messages_user_idx on public.friend_messages(user_id, created_at desc);

alter table public.friend_messages enable row level security;
revoke all on public.friend_messages from public, anon, authenticated;

create or replace function public.create_friend_message(p_body text)
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  profile_image_url text,
  body text,
  created_at timestamptz
)
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_body text := trim(coalesce(p_body, ''));
  v_row public.friend_messages;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if v_body = '' then
    raise exception using errcode = 'P0001', message = 'COMMENT_EMPTY';
  end if;
  if char_length(v_body) > 1000 then
    raise exception using errcode = 'P0001', message = 'COMMENT_TOO_LONG';
  end if;

  insert into public.friend_messages (user_id, body) values (v_user_id, v_body)
  returning * into v_row;

  return query
    select v_row.id, v_row.user_id, p.display_name, p.profile_image_url, v_row.body, v_row.created_at
    from public.profiles p
    where p.user_id = v_row.user_id;
end;
$$;

revoke all on function public.create_friend_message(text) from public, anon;
grant execute on function public.create_friend_message(text) to authenticated;

create or replace function public.get_friend_messages(p_limit integer default 50)
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  profile_image_url text,
  body text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select fm.id, fm.user_id, p.display_name, p.profile_image_url, fm.body, fm.created_at
  from public.friend_messages fm
  join public.profiles p on p.user_id = fm.user_id
  where auth.uid() is not null
    and (fm.user_id = auth.uid() or public.is_friend(fm.user_id))
  order by fm.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

revoke all on function public.get_friend_messages(integer) from public, anon;
grant execute on function public.get_friend_messages(integer) to authenticated;

create or replace function public.delete_friend_message(p_message_id uuid)
returns void
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  delete from public.friend_messages
  where id = p_message_id and user_id = v_user_id
  returning id into v_deleted;

  if v_deleted is null then
    raise exception using errcode = 'P0001', message = 'COMMENT_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.delete_friend_message(uuid) from public, anon;
grant execute on function public.delete_friend_message(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'FRIEND_GLOBAL_CHAT_READY'::text as status,
  to_regclass('public.friend_messages') is not null as table_ok,
  has_function_privilege('authenticated', 'public.create_friend_message(text)', 'EXECUTE') as create_ok,
  has_function_privilege('authenticated', 'public.get_friend_messages(integer)', 'EXECUTE') as list_ok;
