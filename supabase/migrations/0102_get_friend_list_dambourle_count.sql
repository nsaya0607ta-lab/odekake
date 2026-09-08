-- フレンド一覧(get_friend_list)の図鑑数にダンボール景品の所持数も含める。
-- ホーム画面・フレンド詳細・フレンド図鑑ページはCOLLECTION_ITEMS+DAMBOURLE_PRIZESの合算で
-- 総数を表示しているが、フレンド一覧ページだけuser_gacha_itemsのcollection_owned_countのみを
-- 参照しており、ダンボール分が抜けたままだった。dambourle_owned_countを新規に返すよう変更する。
-- RETURNS TABLEの列構成を変えるのでcreate or replaceだけでは"cannot change return type of
-- existing function"エラーになる。先にdropしてから作り直す。
drop function if exists public.get_friend_list();

create function public.get_friend_list()
returns table (
  friend_user_id uuid,
  display_name text,
  profile_image_url text,
  total_exp integer,
  visited_prefectures bigint,
  visited_municipalities bigint,
  visit_count bigint,
  collection_owned_count bigint,
  dambourle_owned_count bigint,
  show_collection boolean,
  friend_since timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    f.friend_user_id,
    coalesce(nullif(btrim(p.display_name), ''), 'ゲスト') as display_name,
    p.profile_image_url,
    coalesce(ue.total_exp, 0) as total_exp,
    coalesce(v.visited_prefectures, 0) as visited_prefectures,
    coalesce(v.visited_municipalities, 0) as visited_municipalities,
    coalesce(v.visit_count, 0) as visit_count,
    case when coalesce(ps.show_collection, true)
      then coalesce(c.collection_owned_count, 0)
      else null
    end as collection_owned_count,
    case when coalesce(ps.show_collection, true)
      then coalesce(d.dambourle_owned_count, 0)
      else null
    end as dambourle_owned_count,
    coalesce(ps.show_collection, true) as show_collection,
    f.created_at as friend_since
  from public.friendships f
  left join public.profiles p on p.user_id = f.friend_user_id
  left join public.user_exp ue on ue.user_id = f.friend_user_id
  left join public.friend_privacy_settings ps on ps.user_id = f.friend_user_id
  left join lateral (
    select
      count(*) as visit_count,
      count(distinct s.prefecture_code) as visited_prefectures,
      count(distinct s.municipality_code) as visited_municipalities
    from public.visit_records vr
    join public.spots s on s.id = vr.spot_id
    where vr.user_id = f.friend_user_id
  ) v on true
  left join lateral (
    select count(*) as collection_owned_count
    from public.user_gacha_items ugi
    where ugi.user_id = f.friend_user_id
  ) c on true
  left join lateral (
    select count(*) as dambourle_owned_count
    from public.user_dambourle_items udi
    where udi.user_id = f.friend_user_id
      and udi.count > 0
  ) d on true
  where auth.uid() is not null
    and f.user_id = auth.uid()
  order by f.created_at desc;
$$;

-- drop function で失われる権限をここで再付与する（0019_friends.sqlの元の付与と同じ内容）。
revoke all on function public.get_friend_list() from public, anon;
grant execute on function public.get_friend_list() to authenticated;
