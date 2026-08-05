-- =============================================================
-- 招待を受け取ったユーザーに、参加前でも旅行名を表示する
-- =============================================================
-- trip_invitations は本人宛の行を読めても、trips 側の RLS により
-- 参加前は旅行名を取得できなかった。メールアドレスが一致する有効な
-- pending 招待がある場合に限り、その旅行の基本情報を読めるようにする。

create or replace function public.has_pending_trip_invitation(p_trip uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.trip_invitations invitation
    where invitation.trip_id = p_trip
      and invitation.status = 'pending'
      and invitation.expires_at >= now()
      and invitation.email is not null
      and lower(invitation.email) = lower(auth.jwt() ->> 'email')
  );
$$;

revoke all on function public.has_pending_trip_invitation(uuid) from public;
grant execute on function public.has_pending_trip_invitation(uuid) to authenticated;

comment on function public.has_pending_trip_invitation(uuid) is
  'ログイン中のメールアドレス宛に有効な招待がある旅行かを判定する。参加前の旅行名表示に使う。';

-- 既存のアクセス権に「本人宛の有効な招待」を追加する。
drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips for select to authenticated
  using (
    owner_id = auth.uid()
    or public.can_access_trip(id)
    or public.has_pending_trip_invitation(id)
  );
