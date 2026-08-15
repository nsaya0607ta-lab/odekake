-- =============================================================
-- 共有旅を自分の一覧からだけ削除する（他の参加者には影響しない）
-- =============================================================

create or replace function public.leave_shared_trip(p_trip_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  delete from public.trip_members
  where trip_id = p_trip_id and user_id = auth.uid();

  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
end;
$$;

revoke all on function public.leave_shared_trip(uuid) from public, anon;
grant execute on function public.leave_shared_trip(uuid) to authenticated;

NOTIFY pgrst, 'reload schema';
select 'LEAVE_SHARED_TRIP_READY'::text as status,
  to_regprocedure('public.leave_shared_trip(uuid)') is not null as leave_rpc_ok;
