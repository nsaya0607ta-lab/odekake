-- =============================================================
-- フレンド写真表示とフレンドコード生成の互換性修正
-- =============================================================
-- ・フレンドコード生成から pgcrypto のスキーマ差を取り除く
-- ・公開設定が有効なフレンドの最近のおでかけ写真を1枚返す
-- ・プロフィール画像と公開中の訪問写真だけをフレンドが署名可能にする
-- ・写真の追加・更新・削除権限は一切広げない

begin;

create or replace function public.make_friend_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := uuid_send(gen_random_uuid());
  v_code text := '';
  v_index integer;
begin
  for v_index in 0..7 loop
    v_code := v_code || substr(v_chars, (get_byte(v_bytes, v_index) % length(v_chars)) + 1, 1);
  end loop;
  return v_code;
end;
$$;

revoke all on function public.make_friend_code() from public, anon, authenticated;

create or replace function public.can_view_friend_storage_path(p_name text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  parts text[] := storage.foldername(p_name);
  v_owner uuid;
  v_trip uuid;
  v_visit uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  if parts[1] = 'users' and parts[3] = 'profile' then
    begin
      v_owner := parts[2]::uuid;
    exception when others then
      return false;
    end;

    return exists (
      select 1
      from public.profiles p
      join public.friendships f
        on f.user_id = auth.uid()
       and f.friend_user_id = p.user_id
      where p.user_id = v_owner
        and p.profile_image_url = p_name
    );
  end if;

  if parts[1] = 'trips' and parts[3] = 'visits' then
    begin
      v_trip := parts[2]::uuid;
      v_visit := parts[4]::uuid;
    exception when others then
      return false;
    end;

    return exists (
      select 1
      from public.visit_photos vp
      join public.visit_records vr
        on vr.id = vp.visit_record_id
       and vr.user_id = vp.user_id
      join public.friendships f
        on f.user_id = auth.uid()
       and f.friend_user_id = vr.user_id
      left join public.friend_privacy_settings ps
        on ps.user_id = vr.user_id
      where vp.storage_path = p_name
        and vr.id = v_visit
        and vr.trip_id = v_trip
        and coalesce(ps.show_recent_visits, true)
    );
  end if;

  return false;
end;
$$;

revoke all on function public.can_view_friend_storage_path(text) from public, anon;
grant execute on function public.can_view_friend_storage_path(text) to authenticated;

drop policy if exists photos_select on storage.objects;
create policy photos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and (
      public.can_access_storage_path(name)
      or public.can_view_friend_storage_path(name)
    )
  );

drop function if exists public.get_friend_recent_visits(uuid, integer);

create function public.get_friend_recent_visits(
  p_friend_user_id uuid,
  p_limit integer default 5
)
returns table (
  spot_id uuid,
  spot_name text,
  visited_at date,
  prefecture_code text,
  municipality_code text,
  photo_path text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    s.id as spot_id,
    s.name as spot_name,
    vr.visited_at,
    s.prefecture_code,
    s.municipality_code,
    photo.storage_path
  from public.visit_records vr
  join public.spots s on s.id = vr.spot_id
  left join lateral (
    select vp.storage_path
    from public.visit_photos vp
    where vp.visit_record_id = vr.id
      and vp.user_id = p_friend_user_id
    order by vp.display_order, vp.created_at
    limit 1
  ) photo on true
  where vr.user_id = p_friend_user_id
    and public.is_friend(p_friend_user_id)
    and coalesce((
      select ps.show_recent_visits
      from public.friend_privacy_settings ps
      where ps.user_id = p_friend_user_id
    ), true)
  order by vr.visited_at desc, vr.created_at desc
  limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;

revoke all on function public.get_friend_recent_visits(uuid, integer) from public, anon;
grant execute on function public.get_friend_recent_visits(uuid, integer) to authenticated;

create or replace function public.get_friends_health()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  return jsonb_build_object('ready', true, 'version', 3);
end;
$$;

revoke all on function public.get_friends_health() from public, anon;
grant execute on function public.get_friends_health() to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'FRIEND_PHOTOS_READY'::text as status,
  has_function_privilege('authenticated', 'public.get_friend_recent_visits(uuid, integer)', 'EXECUTE') as visits_rpc_ok,
  has_function_privilege('authenticated', 'public.can_view_friend_storage_path(text)', 'EXECUTE') as photo_access_ok;
