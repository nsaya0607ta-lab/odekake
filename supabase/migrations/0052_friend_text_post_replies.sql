-- =============================================================
-- 個人投稿（つぶやき）への返信（リプライ）機能
-- friend_photo_comments と同じ方針で、テーブルへの直接アクセスは
-- 許可せず SECURITY DEFINER の RPC 経由でのみ操作する。
-- =============================================================
begin;

do $$
begin
  if to_regclass('public.friend_text_posts') is null then
    raise exception using
      errcode = 'P0001',
      message = 'FRIEND_TEXT_POST_REPLIES_MISSING_DEPENDENCY: public.friend_text_posts',
      hint = '先に 0051_friend_text_posts.sql を適用してください。';
  end if;
  if to_regprocedure('public.is_friend(uuid)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'FRIEND_TEXT_POST_REPLIES_MISSING_DEPENDENCY: public.is_friend(uuid)',
      hint = '先に 0019_friends.sql を適用してください。';
  end if;
end;
$$;

create table if not exists public.friend_text_post_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.friend_text_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint friend_text_post_replies_body_length check (char_length(body) between 1 and 1000)
);

create index if not exists friend_text_post_replies_post_idx
  on public.friend_text_post_replies(post_id, created_at);

alter table public.friend_text_post_replies enable row level security;
revoke all on public.friend_text_post_replies from public, anon, authenticated;

-- そのつぶやきが自分視点で見えるか（自分の投稿か、投稿者とフレンドか）
create or replace function public.can_view_friend_text_post(p_post_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.friend_text_posts tp
    where tp.id = p_post_id
      and (tp.user_id = auth.uid() or public.is_friend(tp.user_id))
  );
$$;

revoke all on function public.can_view_friend_text_post(uuid) from public, anon;
grant execute on function public.can_view_friend_text_post(uuid) to authenticated;

-- -------------------------------------------------------------
-- 返信の投稿・削除
-- -------------------------------------------------------------
create or replace function public.add_friend_text_post_reply(p_post_id uuid, p_body text)
returns table (id uuid, created_at timestamptz)
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_body text := trim(coalesce(p_body, ''));
  v_row public.friend_text_post_replies;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if v_body = '' then
    raise exception using errcode = 'P0001', message = 'BODY_REQUIRED';
  end if;
  if char_length(v_body) > 1000 then
    raise exception using errcode = 'P0001', message = 'BODY_TOO_LONG';
  end if;
  if not public.can_view_friend_text_post(p_post_id) then
    raise exception using errcode = 'P0001', message = 'POST_NOT_FOUND';
  end if;

  insert into public.friend_text_post_replies (post_id, user_id, body)
  values (p_post_id, v_user_id, v_body)
  returning * into v_row;

  return query select v_row.id, v_row.created_at;
end;
$$;

revoke all on function public.add_friend_text_post_reply(uuid, text) from public, anon;
grant execute on function public.add_friend_text_post_reply(uuid, text) to authenticated;

create or replace function public.delete_friend_text_post_reply(p_reply_id uuid)
returns void
language plpgsql
security definer
volatile
set search_path = public
as $$
begin
  delete from public.friend_text_post_replies
  where id = p_reply_id and user_id = auth.uid();

  if not found then
    raise exception using errcode = 'P0001', message = 'REPLY_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.delete_friend_text_post_reply(uuid) from public, anon;
grant execute on function public.delete_friend_text_post_reply(uuid) to authenticated;

-- -------------------------------------------------------------
-- 取得系
-- -------------------------------------------------------------
create or replace function public.get_friend_text_post_replies(p_post_id uuid)
returns table (
  id uuid,
  post_id uuid,
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
    r.id,
    r.post_id,
    r.user_id,
    p.display_name,
    p.profile_image_url,
    r.body,
    r.created_at
  from public.friend_text_post_replies r
  join public.profiles p on p.user_id = r.user_id
  where public.can_view_friend_text_post(p_post_id)
    and r.post_id = p_post_id
  order by r.created_at asc;
$$;

revoke all on function public.get_friend_text_post_replies(uuid) from public, anon;
grant execute on function public.get_friend_text_post_replies(uuid) to authenticated;

-- 1件だけの取得（返信画面のヘッダー用）
create or replace function public.get_personal_text_post(p_post_id uuid)
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  profile_image_url text,
  body text,
  created_at timestamptz,
  reply_count bigint
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
    tp.created_at,
    coalesce(replies.n, 0) as reply_count
  from public.friend_text_posts tp
  join public.profiles p on p.user_id = tp.user_id
  left join lateral (
    select count(*) as n from public.friend_text_post_replies r where r.post_id = tp.id
  ) replies on true
  where tp.id = p_post_id
    and (tp.user_id = auth.uid() or public.is_friend(tp.user_id));
$$;

revoke all on function public.get_personal_text_post(uuid) from public, anon;
grant execute on function public.get_personal_text_post(uuid) to authenticated;

-- フィード一覧にも返信件数を出す（既存の get_personal_text_feed を差し替え）
-- 戻り値の列が増える（reply_count追加）ため、CREATE OR REPLACE ではなく一度DROPしてから作り直す
drop function if exists public.get_personal_text_feed(uuid, integer);

create function public.get_personal_text_feed(p_user_id uuid default null, p_limit integer default 100)
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  profile_image_url text,
  body text,
  created_at timestamptz,
  reply_count bigint
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
    tp.created_at,
    coalesce(replies.n, 0) as reply_count
  from public.friend_text_posts tp
  join public.profiles p on p.user_id = tp.user_id
  left join lateral (
    select count(*) as n from public.friend_text_post_replies r where r.post_id = tp.id
  ) replies on true
  where auth.uid() is not null
    and (tp.user_id = auth.uid() or public.is_friend(tp.user_id))
    and (p_user_id is null or tp.user_id = p_user_id)
  order by tp.created_at desc
  limit greatest(coalesce(p_limit, 100), 1);
$$;

revoke all on function public.get_personal_text_feed(uuid, integer) from public, anon;
grant execute on function public.get_personal_text_feed(uuid, integer) to authenticated;

commit;
