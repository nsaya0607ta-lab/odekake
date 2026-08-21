-- =============================================================
-- コメント（返信）にもいいねと、返信への返信（ネスト）ができるようにする
-- =============================================================
begin;

do $$
begin
  if to_regclass('public.friend_text_post_replies') is null then
    raise exception using
      errcode = 'P0001',
      message = 'FRIEND_TEXT_POST_REPLY_LIKES_MISSING_DEPENDENCY: public.friend_text_post_replies',
      hint = '先に 0052_friend_text_post_replies.sql を適用してください。';
  end if;
end;
$$;

alter table public.friend_text_post_replies
  add column if not exists parent_reply_id uuid references public.friend_text_post_replies(id) on delete cascade;

create index if not exists friend_text_post_replies_parent_idx
  on public.friend_text_post_replies(parent_reply_id);

create table if not exists public.friend_text_post_reply_likes (
  reply_id uuid not null references public.friend_text_post_replies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reply_id, user_id)
);

create index if not exists friend_text_post_reply_likes_reply_idx
  on public.friend_text_post_reply_likes(reply_id);

alter table public.friend_text_post_reply_likes enable row level security;
revoke all on public.friend_text_post_reply_likes from public, anon, authenticated;

-- -------------------------------------------------------------
-- 返信の投稿（親返信への返信=ネスト にも対応）
-- p_parent_reply_id を末尾にデフォルト付きで追加するだけなので、
-- 既存の add_friend_text_post_reply(uuid, text) 呼び出しもそのまま動く
-- -------------------------------------------------------------
create or replace function public.add_friend_text_post_reply(
  p_post_id uuid,
  p_body text,
  p_parent_reply_id uuid default null
)
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
  if p_parent_reply_id is not null and not exists (
    select 1 from public.friend_text_post_replies pr
    where pr.id = p_parent_reply_id and pr.post_id = p_post_id
  ) then
    raise exception using errcode = 'P0001', message = 'PARENT_REPLY_NOT_FOUND';
  end if;

  insert into public.friend_text_post_replies (post_id, user_id, body, parent_reply_id)
  values (p_post_id, v_user_id, v_body, p_parent_reply_id)
  returning * into v_row;

  return query select v_row.id, v_row.created_at;
end;
$$;

revoke all on function public.add_friend_text_post_reply(uuid, text, uuid) from public, anon;
grant execute on function public.add_friend_text_post_reply(uuid, text, uuid) to authenticated;

-- -------------------------------------------------------------
-- 返信のいいねON/OFF切り替え
-- -------------------------------------------------------------
create or replace function public.set_friend_text_post_reply_like(p_reply_id uuid, p_liked boolean)
returns void
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_post_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select r.post_id into v_post_id from public.friend_text_post_replies r where r.id = p_reply_id;
  if v_post_id is null or not public.can_view_friend_text_post(v_post_id) then
    raise exception using errcode = 'P0001', message = 'REPLY_NOT_FOUND';
  end if;

  if p_liked then
    insert into public.friend_text_post_reply_likes (reply_id, user_id)
    values (p_reply_id, v_user_id)
    on conflict (reply_id, user_id) do nothing;
  else
    delete from public.friend_text_post_reply_likes
    where reply_id = p_reply_id and user_id = v_user_id;
  end if;
end;
$$;

revoke all on function public.set_friend_text_post_reply_like(uuid, boolean) from public, anon;
grant execute on function public.set_friend_text_post_reply_like(uuid, boolean) to authenticated;

-- -------------------------------------------------------------
-- 取得系に parent_reply_id・いいね件数・自分がいいね済みかを追加
-- 戻り値の列が増えるため、CREATE OR REPLACE ではなく一度DROPしてから作り直す
-- -------------------------------------------------------------
drop function if exists public.get_friend_text_post_replies(uuid);

create function public.get_friend_text_post_replies(p_post_id uuid)
returns table (
  id uuid,
  post_id uuid,
  parent_reply_id uuid,
  user_id uuid,
  display_name text,
  profile_image_url text,
  body text,
  created_at timestamptz,
  like_count bigint,
  my_liked boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    r.id,
    r.post_id,
    r.parent_reply_id,
    r.user_id,
    p.display_name,
    p.profile_image_url,
    r.body,
    r.created_at,
    coalesce(likes.n, 0) as like_count,
    mine.liked is not null as my_liked
  from public.friend_text_post_replies r
  join public.profiles p on p.user_id = r.user_id
  left join lateral (
    select count(*) as n from public.friend_text_post_reply_likes l where l.reply_id = r.id
  ) likes on true
  left join lateral (
    select true as liked from public.friend_text_post_reply_likes l
    where l.reply_id = r.id and l.user_id = auth.uid()
  ) mine on true
  where public.can_view_friend_text_post(p_post_id)
    and r.post_id = p_post_id
  order by r.created_at asc;
$$;

revoke all on function public.get_friend_text_post_replies(uuid) from public, anon;
grant execute on function public.get_friend_text_post_replies(uuid) to authenticated;

commit;
