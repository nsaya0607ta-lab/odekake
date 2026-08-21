-- =============================================================
-- SNSホームの個人投稿を、写真ではなくテキストベース（Twitterのつぶやきのような
-- 短文投稿）に変更する。グループとは無関係で、フレンド全員に共有される。
-- friend_photos と同じ方針で、テーブルへの直接アクセスは許可せず
-- SECURITY DEFINER の RPC 経由でのみ操作する。
-- =============================================================
begin;

do $$
begin
  if to_regprocedure('public.is_friend(uuid)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'FRIEND_TEXT_POSTS_MISSING_DEPENDENCY: public.is_friend(uuid)',
      hint = '先に 0019_friends.sql を適用してください。';
  end if;
end;
$$;

create table if not exists public.friend_text_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint friend_text_posts_body_length check (char_length(body) between 1 and 280)
);

create index if not exists friend_text_posts_created_idx
  on public.friend_text_posts(created_at desc);
create index if not exists friend_text_posts_user_idx
  on public.friend_text_posts(user_id, created_at desc);

alter table public.friend_text_posts enable row level security;
revoke all on public.friend_text_posts from public, anon, authenticated;

-- -------------------------------------------------------------
-- 投稿・削除
-- -------------------------------------------------------------
create or replace function public.create_friend_text_post(p_body text)
returns table (id uuid, created_at timestamptz)
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_body text := trim(coalesce(p_body, ''));
  v_row public.friend_text_posts;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if v_body = '' then
    raise exception using errcode = 'P0001', message = 'BODY_REQUIRED';
  end if;
  if char_length(v_body) > 280 then
    raise exception using errcode = 'P0001', message = 'BODY_TOO_LONG';
  end if;

  insert into public.friend_text_posts (user_id, body)
  values (v_user_id, v_body)
  returning * into v_row;

  return query select v_row.id, v_row.created_at;
end;
$$;

revoke all on function public.create_friend_text_post(text) from public, anon;
grant execute on function public.create_friend_text_post(text) to authenticated;

create or replace function public.delete_friend_text_post(p_post_id uuid)
returns void
language plpgsql
security definer
volatile
set search_path = public
as $$
begin
  delete from public.friend_text_posts
  where id = p_post_id and user_id = auth.uid();

  if not found then
    raise exception using errcode = 'P0001', message = 'POST_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.delete_friend_text_post(uuid) from public, anon;
grant execute on function public.delete_friend_text_post(uuid) to authenticated;

-- -------------------------------------------------------------
-- フィード取得
-- p_user_id を省略するとフレンド全員分をまとめた「ホーム」フィード、
-- 指定するとそのユーザー1人分だけの投稿一覧になる
-- -------------------------------------------------------------
create or replace function public.get_personal_text_feed(p_user_id uuid default null, p_limit integer default 100)
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
  select
    tp.id,
    tp.user_id,
    p.display_name,
    p.profile_image_url,
    tp.body,
    tp.created_at
  from public.friend_text_posts tp
  join public.profiles p on p.user_id = tp.user_id
  where auth.uid() is not null
    and (tp.user_id = auth.uid() or public.is_friend(tp.user_id))
    and (p_user_id is null or tp.user_id = p_user_id)
  order by tp.created_at desc
  limit greatest(coalesce(p_limit, 100), 1);
$$;

revoke all on function public.get_personal_text_feed(uuid, integer) from public, anon;
grant execute on function public.get_personal_text_feed(uuid, integer) to authenticated;

commit;
