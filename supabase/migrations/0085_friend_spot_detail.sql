-- =============================================================
-- フレンドの訪問先スポットを閲覧専用で表示するためのRPC
-- =============================================================
-- ・フレンドの「最近のおでかけ」からスポットをタップしたとき、
--   そのスポットにあるフレンド自身の訪問履歴・写真だけを返す
-- ・is_friend + friend_privacy_settings.show_recent_visits で
--   既存の「最近のおでかけ」と同じ公開範囲に揃える
-- ・書き込み権限は一切追加しない（閲覧専用）

begin;

create function public.get_friend_spot_visits(
  p_friend_user_id uuid,
  p_spot_id uuid
)
returns table (
  spot_id uuid,
  spot_name text,
  category_id smallint,
  category_name text,
  prefecture_code text,
  municipality_code text,
  address text,
  latitude double precision,
  longitude double precision,
  visit_id uuid,
  visited_at date,
  rating smallint,
  comment text,
  note text,
  companions text,
  amount integer,
  stay_minutes integer,
  congestion_level smallint,
  revisit_wanted boolean,
  trip_title text,
  photo_id uuid,
  photo_storage_path text,
  photo_caption text,
  photo_display_order integer
)
language sql
security definer
stable
set search_path = public
as $$
  select
    s.id as spot_id,
    s.name as spot_name,
    s.category_id,
    c.name as category_name,
    s.prefecture_code,
    s.municipality_code,
    s.address,
    s.latitude,
    s.longitude,
    vr.id as visit_id,
    vr.visited_at,
    vr.rating,
    vr.comment,
    vr.note,
    vr.companions,
    vr.amount,
    vr.stay_minutes,
    vr.congestion_level,
    vr.revisit_wanted,
    t.title as trip_title,
    vp.id as photo_id,
    vp.storage_path as photo_storage_path,
    vp.caption as photo_caption,
    vp.display_order as photo_display_order
  from public.visit_records vr
  join public.spots s on s.id = vr.spot_id
  left join public.categories c on c.id = s.category_id
  left join public.trips t on t.id = vr.trip_id
  left join public.visit_photos vp
    on vp.visit_record_id = vr.id
   and vp.user_id = p_friend_user_id
  where vr.user_id = p_friend_user_id
    and vr.spot_id = p_spot_id
    and public.is_friend(p_friend_user_id)
    and coalesce((
      select ps.show_recent_visits
      from public.friend_privacy_settings ps
      where ps.user_id = p_friend_user_id
    ), true)
  order by vr.visited_at desc, vr.created_at desc, vp.display_order, vp.created_at;
$$;

revoke all on function public.get_friend_spot_visits(uuid, uuid) from public, anon;
grant execute on function public.get_friend_spot_visits(uuid, uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'FRIEND_SPOT_DETAIL_READY'::text as status,
  has_function_privilege('authenticated', 'public.get_friend_spot_visits(uuid, uuid)', 'EXECUTE') as spot_visits_rpc_ok;
