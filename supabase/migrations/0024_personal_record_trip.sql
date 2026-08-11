-- =============================================================
-- 個人用の常設記録先を確実に用意する
-- =============================================================
-- 直接INSERTが旧RLS・トリガーの影響を受けるDBでも、認証中の本人に限って
-- 「自分のおでかけ」を1件だけ取得または作成できるようにする。

create or replace function public.ensure_personal_record_trip()
returns table (trip_id uuid, title text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trip_id uuid;
  v_title text;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select t.id, t.title
    into v_trip_id, v_title
    from public.trips t
   where t.owner_id = v_user_id
     and t.title = '自分のおでかけ'
     and t.description = '普段のおでかけをまとめる記録先'
     and t.start_date is null
     and t.end_date is null
   order by t.created_at
   limit 1;

  if v_trip_id is null then
    insert into public.trips as new_trip (owner_id, title, trip_type, start_date, end_date, description)
    values (
      v_user_id,
      '自分のおでかけ',
      'personal',
      null,
      null,
      '普段のおでかけをまとめる記録先'
    )
    returning new_trip.id, new_trip.title into v_trip_id, v_title;
  else
    -- 旧DBでこの常設保存先がshared扱いだった場合も個人用へ正規化する。
    update public.trips
       set trip_type = 'personal'
     where id = v_trip_id and trip_type <> 'personal';
  end if;

  return query select v_trip_id, v_title;
end;
$$;

revoke all on function public.ensure_personal_record_trip() from public, anon;
grant execute on function public.ensure_personal_record_trip() to authenticated;

notify pgrst, 'reload schema';

select 'PERSONAL_RECORD_TRIP_READY'::text as status,
  to_regprocedure('public.ensure_personal_record_trip()') is not null as rpc_ok;
