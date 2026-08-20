-- =============================================================
-- 個人投稿（つぶやき）へのいいね機能
-- friend_photo_reactions と同じ方針で、テーブルへの直接アクセスは
-- 許可せず SECURITY DEFINER の RPC 経由でのみ操作する。
-- =============================================================
begin;

do $$
begin
  if to_regclass('public.friend_text_posts') is null then
    raise exception using
      errcode = 'P0001',
      message = 'FRIEND_TEXT_POST_LIKES_MISSING_DEPENDENCY: public.friend_text_posts',
      hint = '先に 0051_friend_text_posts.sql を適用してください。';
  end if;
  if to_regprocedure('public.can_view_friend_text_post(uuid)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'FRIEND_TEXT_POST_LIKES_MISSING_DEPENDENCY: public.can_view_friend_text_post(uuid)',
      hint = '先に 0052_friend_text_post_replies.sql を適用してください。';
  end if;
end;
$$;

create table if not exists public.friend_text_post_likes (
  post_id uuid not null references public.friend_text_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists friend_text_post_likes_post_idx
  on public.friend_text_post_likes(post_id);

alter table public.friend_text_post_likes enable row level security;
revoke all on public.friend_text_post_likes from public, anon, authenticated;

-- -------------------------------------------------------------
-- いいねのON/OFF切り替え
-- -------------------------------------------------------------
create or replace function public.set_friend_text_post_like(p_post_id uuid, p_liked boolean)
returns void
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if not public.can_view_friend_text_post(p_post_id) then
    raise exception using errcode = 'P0001', message = 'POST_NOT_FOUND';
  end if;

  if p_liked then
    insert into public.friend_text_post_likes (post_id, user_id)
    values (p_post_id, v_user_id)
    on conflict (post_id, user_id) do nothing;
  else
    delete from public.friend_text_post_likes
    where post_id = p_post_id and user_id = v_user_id;
  end if;
end;
$$;

revoke all on function public.set_friend_text_post_like(uuid, boolean) from public, anon;
grant execute on function public.set_friend_text_post_like(uuid, boolean) to authenticated;

-- -------------------------------------------------------------
-- 取得系にいいね件数・自分がいいね済みかを追加
-- 戻り値の列が増えるため、CREATE OR REPLACE ではなく一度DROPしてから作り直す
-- -------------------------------------------------------------
drop function if exists public.get_personal_text_feed(uuid, integer);

create function public.get_personal_text_feed(p_user_id uuid default null, p_limit integer default 100)
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  profile_image_url text,
  body text,
  created_at timestamptz,
  reply_count bigint,
  like_count bigint,
  my_liked boolean
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
    coalesce(replies.n, 0) as reply_count,
    coalesce(likes.n, 0) as like_count,
    mine.liked is not null as my_liked
  from public.friend_text_posts tp
  join public.profiles p on p.user_id = tp.user_id
  left join lateral (
    select count(*) as n from public.friend_text_post_replies r where r.post_id = tp.id
  ) replies on true
  left join lateral (
    select count(*) as n from public.friend_text_post_likes l where l.post_id = tp.id
  ) likes on true
  left join lateral (
    select true as liked from public.friend_text_post_likes l
    where l.post_id = tp.id and l.user_id = auth.uid()
  ) mine on true
  where auth.uid() is not null
    and (tp.user_id = auth.uid() or public.is_friend(tp.user_id))
    and (p_user_id is null or tp.user_id = p_user_id)
  order by tp.created_at desc
  limit greatest(coalesce(p_limit, 100), 1);
$$;

revoke all on function public.get_personal_text_feed(uuid, integer) from public, anon;
grant execute on function public.get_personal_text_feed(uuid, integer) to authenticated;

drop function if exists public.get_personal_text_post(uuid);

create function public.get_personal_text_post(p_post_id uuid)
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  profile_image_url text,
  body text,
  created_at timestamptz,
  reply_count bigint,
  like_count bigint,
  my_liked boolean
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
    coalesce(replies.n, 0) as reply_count,
    coalesce(likes.n, 0) as like_count,
    mine.liked is not null as my_liked
  from public.friend_text_posts tp
  join public.profiles p on p.user_id = tp.user_id
  left join lateral (
    select count(*) as n from public.friend_text_post_replies r where r.post_id = tp.id
  ) replies on true
  left join lateral (
    select count(*) as n from public.friend_text_post_likes l where l.post_id = tp.id
  ) likes on true
  left join lateral (
    select true as liked from public.friend_text_post_likes l
    where l.post_id = tp.id and l.user_id = auth.uid()
  ) mine on true
  where tp.id = p_post_id
    and (tp.user_id = auth.uid() or public.is_friend(tp.user_id));
$$;

revoke all on function public.get_personal_text_post(uuid) from public, anon;
grant execute on function public.get_personal_text_post(uuid) to authenticated;

commit;
