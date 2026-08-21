-- =============================================================
-- つぶやきに写真を最大4枚まで添付できるようにする
-- 一覧・詳細ともにサムネイル（-thumb）のURLだけを署名して配るようにし、
-- 原寸画像の転送量（Storage egress）を抑える。原寸は既存の
-- signPhotoPaths/signThumbOrOriginalPaths の仕組みをそのまま流用する。
-- =============================================================
begin;

do $$
begin
  if to_regclass('public.friend_text_posts') is null then
    raise exception using
      errcode = 'P0001',
      message = 'FRIEND_TEXT_POST_PHOTOS_MISSING_DEPENDENCY: public.friend_text_posts',
      hint = '先に 0051_friend_text_posts.sql を適用してください。';
  end if;
end;
$$;

alter table public.friend_text_posts
  add column if not exists photo_paths text[] not null default '{}';

alter table public.friend_text_posts
  drop constraint if exists friend_text_posts_body_length;
alter table public.friend_text_posts
  add constraint friend_text_posts_body_length check (char_length(body) <= 280);

alter table public.friend_text_posts
  drop constraint if exists friend_text_posts_body_or_photos;
alter table public.friend_text_posts
  add constraint friend_text_posts_body_or_photos
  check (char_length(trim(body)) > 0 or coalesce(array_length(photo_paths, 1), 0) > 0);

alter table public.friend_text_posts
  drop constraint if exists friend_text_posts_photo_paths_max;
alter table public.friend_text_posts
  add constraint friend_text_posts_photo_paths_max
  check (coalesce(array_length(photo_paths, 1), 0) <= 4);

-- -------------------------------------------------------------
-- 削除時に、消した投稿が持っていた photo_paths を返すようにする
-- （呼び出し側でStorageの実ファイルも削除できるように）。戻り値の型が
-- 変わるため、CREATE OR REPLACE ではなく一度DROPしてから作り直す
-- -------------------------------------------------------------
drop function if exists public.delete_friend_text_post(uuid);

create function public.delete_friend_text_post(p_post_id uuid)
returns text[]
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_photo_paths text[];
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  delete from public.friend_text_posts
  where id = p_post_id and user_id = v_user_id
  returning photo_paths into v_photo_paths;

  if v_photo_paths is null then
    raise exception using errcode = 'P0001', message = 'POST_NOT_FOUND';
  end if;

  return v_photo_paths;
end;
$$;

revoke all on function public.delete_friend_text_post(uuid) from public, anon;
grant execute on function public.delete_friend_text_post(uuid) to authenticated;

-- -------------------------------------------------------------
-- 投稿（写真つき対応）
-- p_photo_paths を末尾にデフォルト付きで追加するだけなので、
-- 既存の create_friend_text_post(text) 呼び出しもそのまま動く
-- -------------------------------------------------------------
create or replace function public.create_friend_text_post(p_body text, p_photo_paths text[] default '{}')
returns table (id uuid, created_at timestamptz)
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_body text := trim(coalesce(p_body, ''));
  v_photo_paths text[] := coalesce(p_photo_paths, '{}');
  v_row public.friend_text_posts;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if array_length(v_photo_paths, 1) > 4 then
    raise exception using errcode = 'P0001', message = 'TOO_MANY_PHOTOS';
  end if;
  if v_body = '' and coalesce(array_length(v_photo_paths, 1), 0) = 0 then
    raise exception using errcode = 'P0001', message = 'BODY_REQUIRED';
  end if;
  if char_length(v_body) > 280 then
    raise exception using errcode = 'P0001', message = 'BODY_TOO_LONG';
  end if;

  insert into public.friend_text_posts (user_id, body, photo_paths)
  values (v_user_id, v_body, v_photo_paths)
  returning * into v_row;

  return query select v_row.id, v_row.created_at;
end;
$$;

revoke all on function public.create_friend_text_post(text, text[]) from public, anon;
grant execute on function public.create_friend_text_post(text, text[]) to authenticated;

-- -------------------------------------------------------------
-- 取得系に photo_paths を追加
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
  photo_paths text[],
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
    tp.photo_paths,
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
  photo_paths text[],
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
    tp.photo_paths,
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
