-- =============================================================
-- iPhoneショートカット経由の訪問登録
-- =============================================================
-- 既存の steps_sync_tokens を共通の「iPhone連携キー」として利用する。
-- ショートカットから user_id を直接受け取らず、連携キーから所有者を解決する。

create or replace function public.record_shortcut_visit_with_token(
  p_token text,
  p_name text,
  p_address text,
  p_latitude double precision,
  p_longitude double precision,
  p_prefecture_code text,
  p_municipality_code text,
  p_rating integer default null,
  p_comment text default null,
  p_visited_at date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
  v_user_id uuid;
  v_trip_id uuid;
  v_spot_id uuid;
  v_visit_id uuid := gen_random_uuid();
  v_visit_date date := coalesce(p_visited_at, (timezone('Asia/Tokyo', now()))::date);
  v_name text := btrim(coalesce(p_name, ''));
  v_address text := nullif(btrim(coalesce(p_address, '')), '');
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_personal_title constant text := '自分のおでかけ';
  v_personal_description constant text := '普段のおでかけをまとめる記録先';
begin
  begin
    v_token := p_token::uuid;
  exception when invalid_text_representation then
    raise exception 'Invalid sync token';
  end;

  select user_id into v_user_id
    from public.steps_sync_tokens
   where token = v_token;

  if v_user_id is null then raise exception 'Invalid sync token'; end if;

  if v_name = '' or length(v_name) > 80 then raise exception 'Invalid place name'; end if;
  if p_prefecture_code is null or p_prefecture_code !~ '^[0-9]{2}$' then
    raise exception 'Invalid prefecture code';
  end if;
  if p_municipality_code is null or p_municipality_code !~ '^[0-9]{5}$' then
    raise exception 'Invalid municipality code';
  end if;
  if p_latitude is null or p_latitude < -90 or p_latitude > 90 then
    raise exception 'Invalid latitude';
  end if;
  if p_longitude is null or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Invalid longitude';
  end if;
  if p_rating is not null and (p_rating < 1 or p_rating > 5) then
    raise exception 'Invalid rating';
  end if;
  if v_comment is not null and length(v_comment) > 2000 then
    raise exception 'Comment too long';
  end if;
  if v_visit_date > (timezone('Asia/Tokyo', now()))::date then
    raise exception 'Visit date must not be in the future';
  end if;

  -- 普段のおでかけ用の内部保存先をユーザーごとに1件だけ利用する。
  select id into v_trip_id
    from public.trips
   where owner_id = v_user_id
     and title = v_personal_title
     and description = v_personal_description
     and start_date is null
     and end_date is null
   order by created_at asc
   limit 1;

  if v_trip_id is null then
    insert into public.trips (
      id, owner_id, title, start_date, end_date, description
    ) values (
      gen_random_uuid(), v_user_id, v_personal_title, null, null, v_personal_description
    )
    returning id into v_trip_id;
  end if;

  -- 再訪で同じスポット扱いになるよう、近距離かつ同名の既存スポットを優先して再利用する。
  -- 緯度経度の差 0.001 度は概ね100m前後。住所が取得できる場合は住所一致も候補にする。
  select id into v_spot_id
    from public.spots
   where created_by = v_user_id
     and lower(btrim(name)) = lower(v_name)
     and (
       (
         latitude is not null and longitude is not null
         and abs(latitude - p_latitude) <= 0.001
         and abs(longitude - p_longitude) <= 0.001
       )
       or (v_address is not null and address is not null and btrim(address) = v_address)
     )
   order by created_at asc
   limit 1;

  if v_spot_id is null then
    insert into public.spots (
      id,
      created_by,
      name,
      category_id,
      prefecture_code,
      municipality_code,
      address,
      latitude,
      longitude
    ) values (
      gen_random_uuid(),
      v_user_id,
      v_name,
      17,
      p_prefecture_code,
      p_municipality_code,
      v_address,
      p_latitude,
      p_longitude
    )
    returning id into v_spot_id;
  end if;

  insert into public.visit_records (
    id,
    user_id,
    trip_id,
    spot_id,
    visited_at,
    rating,
    comment
  ) values (
    v_visit_id,
    v_user_id,
    v_trip_id,
    v_spot_id,
    v_visit_date,
    p_rating,
    v_comment
  );

  -- EXP同期トリガーが存在する環境では自動反映される。
  -- 念のため関数が存在する場合のみ明示同期する。
  if to_regprocedure('public.sync_visit_exp(uuid)') is not null then
    perform public.sync_visit_exp(v_visit_id);
  end if;

  return jsonb_build_object(
    'ok', true,
    'visitId', v_visit_id,
    'spotId', v_spot_id,
    'tripId', v_trip_id,
    'visitedAt', v_visit_date,
    'name', v_name
  );
end;
$$;

revoke all on function public.record_shortcut_visit_with_token(
  text, text, text, double precision, double precision, text, text, integer, text, date
) from public;

grant execute on function public.record_shortcut_visit_with_token(
  text, text, text, double precision, double precision, text, text, integer, text, date
) to anon, authenticated;
