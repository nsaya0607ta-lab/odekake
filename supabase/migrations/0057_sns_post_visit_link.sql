-- =============================================================
-- SNSの個人投稿へ、自分の訪問記録を任意で1件紐づける。
-- 1つの visit_record_id から場所と旅行を導くことで、重複した選択や
-- 場所と旅行の組み合わせ不整合を防ぐ。
-- =============================================================
begin;

do $$
begin
  if to_regclass('public.friend_text_posts') is null then
    raise exception using
      errcode = 'P0001',
      message = 'SNS_POST_VISIT_LINK_MISSING_DEPENDENCY: public.friend_text_posts',
      hint = '先に 0051_friend_text_posts.sql を適用してください。';
  end if;
  if to_regclass('public.visit_records') is null then
    raise exception using
      errcode = 'P0001',
      message = 'SNS_POST_VISIT_LINK_MISSING_DEPENDENCY: public.visit_records';
  end if;
end;
$$;

alter table public.friend_text_posts
  add column if not exists linked_visit_id uuid references public.visit_records(id) on delete set null;

create index if not exists friend_text_posts_linked_visit_idx
  on public.friend_text_posts(linked_visit_id)
  where linked_visit_id is not null;

-- 旧1引数・2引数版を、新しい省略可能な3引数版へまとめる。
drop function if exists public.create_friend_text_post(text);
drop function if exists public.create_friend_text_post(text, text[]);

create function public.create_friend_text_post(
  p_body text,
  p_photo_paths text[] default '{}',
  p_visit_record_id uuid default null
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
  if p_visit_record_id is not null and not exists (
    select 1
    from public.visit_records vr
    where vr.id = p_visit_record_id and vr.user_id = v_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'LINKED_VISIT_NOT_FOUND';
  end if;

  insert into public.friend_text_posts (user_id, body, photo_paths, linked_visit_id)
  values (v_user_id, v_body, v_photo_paths, p_visit_record_id)
  returning * into v_row;

  return query select v_row.id, v_row.created_at;
end;
$$;

revoke all on function public.create_friend_text_post(text, text[], uuid) from public, anon;
grant execute on function public.create_friend_text_post(text, text[], uuid) to authenticated;

-- 取得結果へ、投稿カードで必要な場所・旅行情報を追加する。
drop function if exists public.get_personal_text_feed(uuid, integer);

create function public.get_personal_text_feed(p_user_id uuid default null, p_limit integer default 100)
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  profile_image_url text,
  body text,
  photo_paths text[],
  linked_visit_id uuid,
  linked_spot_id uuid,
  linked_spot_name text,
  linked_trip_id uuid,
  linked_trip_title text,
  linked_visited_at date,
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
    tp.linked_visit_id,
    vr.spot_id as linked_spot_id,
    s.name as linked_spot_name,
    coalesce(vr.journey_id, vr.trip_id) as linked_trip_id,
    t.title as linked_trip_title,
    vr.visited_at as linked_visited_at,
    tp.created_at,
    coalesce(replies.n, 0) as reply_count,
    coalesce(likes.n, 0) as like_count,
    mine.liked is not null as my_liked
  from public.friend_text_posts tp
  join public.profiles p on p.user_id = tp.user_id
  left join public.visit_records vr on vr.id = tp.linked_visit_id and vr.user_id = tp.user_id
  left join public.spots s on s.id = vr.spot_id
  left join public.trips t on t.id = coalesce(vr.journey_id, vr.trip_id)
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
  linked_visit_id uuid,
  linked_spot_id uuid,
  linked_spot_name text,
  linked_trip_id uuid,
  linked_trip_title text,
  linked_visited_at date,
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
    tp.linked_visit_id,
    vr.spot_id as linked_spot_id,
    s.name as linked_spot_name,
    coalesce(vr.journey_id, vr.trip_id) as linked_trip_id,
    t.title as linked_trip_title,
    vr.visited_at as linked_visited_at,
    tp.created_at,
    coalesce(replies.n, 0) as reply_count,
    coalesce(likes.n, 0) as like_count,
    mine.liked is not null as my_liked
  from public.friend_text_posts tp
  join public.profiles p on p.user_id = tp.user_id
  left join public.visit_records vr on vr.id = tp.linked_visit_id and vr.user_id = tp.user_id
  left join public.spots s on s.id = vr.spot_id
  left join public.trips t on t.id = coalesce(vr.journey_id, vr.trip_id)
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
