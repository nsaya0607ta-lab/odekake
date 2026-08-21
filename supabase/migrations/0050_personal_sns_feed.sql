-- -------------------------------------------------------------
-- 個人投稿（グループに紐付かない投稿）だけのフィード
-- p_user_id を省略するとフレンド全員分をまとめた「ホーム」フィード、
-- 指定するとそのユーザー1人分だけの投稿一覧になる
-- -------------------------------------------------------------
create or replace function public.get_personal_sns_feed(p_user_id uuid default null, p_days integer default 30)
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  profile_image_url text,
  photo_date date,
  storage_path text,
  caption text,
  created_at timestamptz,
  my_reaction text,
  reaction_count bigint,
  comment_count bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    fp.id,
    fp.user_id,
    p.display_name,
    p.profile_image_url,
    fp.photo_date,
    fp.storage_path,
    fp.caption,
    fp.created_at,
    mine.emoji as my_reaction,
    coalesce(reactions.n, 0) as reaction_count,
    coalesce(comments.n, 0) as comment_count
  from public.friend_photos fp
  join public.profiles p on p.user_id = fp.user_id
  left join lateral (
    select r.emoji from public.friend_photo_reactions r
    where r.photo_id = fp.id and r.user_id = auth.uid()
  ) mine on true
  left join lateral (
    select count(*) as n from public.friend_photo_reactions r where r.photo_id = fp.id
  ) reactions on true
  left join lateral (
    select count(*) as n from public.friend_photo_comments c where c.photo_id = fp.id
  ) comments on true
  where auth.uid() is not null
    and fp.group_id is null
    and (fp.user_id = auth.uid() or public.is_friend(fp.user_id))
    and (p_user_id is null or fp.user_id = p_user_id)
    and fp.photo_date >= (now() at time zone 'Asia/Tokyo')::date - greatest(coalesce(p_days, 30), 1) + 1
  order by fp.photo_date desc, fp.created_at asc;
$$;

revoke all on function public.get_personal_sns_feed(uuid, integer) from public, anon;
grant execute on function public.get_personal_sns_feed(uuid, integer) to authenticated;
