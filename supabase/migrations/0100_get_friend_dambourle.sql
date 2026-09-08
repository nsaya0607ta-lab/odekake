-- フレンドのダンボール所持状況を取得するRPCを追加する。
-- ホーム画面の図鑑総数（COLLECTION_ITEMS + DAMBOURLE_PRIZES）とフレンド画面の総数を一致させるため、
-- get_friend_collection（user_gacha_items）と同じ考え方でuser_dambourle_itemsも取得できるようにする。
create or replace function public.get_friend_dambourle(p_friend_user_id uuid)
returns table (
  item_id text,
  count integer
)
language sql
security definer
stable
set search_path = public
as $$
  select udi.item_id, udi.count
  from public.user_dambourle_items udi
  where udi.user_id = p_friend_user_id
    and public.is_friend(p_friend_user_id)
    and coalesce((
      select ps.show_collection
      from public.friend_privacy_settings ps
      where ps.user_id = p_friend_user_id
    ), true);
$$;

revoke all on function public.get_friend_dambourle(uuid) from public, anon;
grant execute on function public.get_friend_dambourle(uuid) to authenticated;
