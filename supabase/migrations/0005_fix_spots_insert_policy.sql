-- スポットの登録・更新を本人に限定して許可する。
-- 既存環境でポリシーが欠落・不整合でも、再実行できる形で復旧する。
alter table public.spots enable row level security;

drop policy if exists spots_insert_own on public.spots;
create policy spots_insert_own
  on public.spots
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists spots_update_own on public.spots;
create policy spots_update_own
  on public.spots
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists spots_select_own on public.spots;
create policy spots_select_own
  on public.spots
  for select
  to authenticated
  using (created_by = auth.uid());

drop policy if exists spots_delete_own on public.spots;
create policy spots_delete_own
  on public.spots
  for delete
  to authenticated
  using (created_by = auth.uid());
