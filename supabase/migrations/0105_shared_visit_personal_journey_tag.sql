-- =============================================================
-- 共有旅の記録に、自分の個人旅行をタグとして付けられるようにする
-- =============================================================
-- これまでは journey_id に「trip_id の直下にある旅行」しか入れられなかったため、
-- 共有旅の記録を個人旅の旅行（山梨旅行など）にもまとめたいときは、記録を
-- もう1件作るしかなかった。記録は1件のまま、journey_id を旅行タグとして使えるよう、
-- 共有旅の記録には「記録した本人の個人旅行」も許可する。
--
-- 共有旅の他メンバーから個人旅行は見えない（trips の RLS）。画面側では
-- 旅行名が読めない場合は共有旅の名前を表示する。

create or replace function public.validate_visit_destination()
returns trigger
language plpgsql
-- 共有旅のオーナーがメンバーの記録を編集するとき、メンバーの個人旅行は
-- オーナーから見えない。RLS に左右されずに所属を確かめるため definer で読む。
security definer
set search_path = public
as $$
declare
  v_root_type text;
  v_journey_parent uuid;
  v_journey_type text;
  v_journey_owner uuid;
  v_journey_parent_is_root boolean;
begin
  select trip_type into v_root_type
  from public.trips where id = new.trip_id and parent_trip_id is null;
  if v_root_type is null then
    raise exception 'INVALID_RECORD_DESTINATION';
  end if;

  if new.journey_id is not null then
    select j.parent_trip_id, j.trip_type, j.owner_id, (p.id is not null and p.parent_trip_id is null)
      into v_journey_parent, v_journey_type, v_journey_owner, v_journey_parent_is_root
    from public.trips j
    left join public.trips p on p.id = j.parent_trip_id
    where j.id = new.journey_id;

    -- 1) 記録先の直下にある旅行（従来どおり）
    if v_journey_parent is not distinct from new.trip_id and v_journey_type is not distinct from v_root_type then
      return new;
    end if;

    -- 2) 共有旅の記録に、記録した本人の個人旅行をタグとして付ける
    if v_root_type = 'shared'
      and v_journey_type = 'personal'
      and v_journey_parent is not null
      and v_journey_parent_is_root
      and v_journey_owner = new.user_id then
      return new;
    end if;

    raise exception 'JOURNEY_DOES_NOT_BELONG_TO_DESTINATION';
  end if;
  return new;
end;
$$;

drop trigger if exists visit_records_validate_destination on public.visit_records;
create trigger visit_records_validate_destination
before insert or update of trip_id, journey_id, user_id on public.visit_records
for each row execute function public.validate_visit_destination();

notify pgrst, 'reload schema';
select 'SHARED_VISIT_PERSONAL_JOURNEY_TAG_READY'::text as status;
