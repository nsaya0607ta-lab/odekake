-- =============================================================
-- spots のポリシーの重複を解消する
-- =============================================================
-- 0005 は復旧用に spots_insert_own / spots_update_own /
-- spots_select_own / spots_delete_own を追加したが、0001 の
-- spots_insert / spots_update / spots_select / spots_delete は残ったままで、
-- 同じ表に同じ用途のポリシーが2組ある状態になっていた。
--
-- PostgreSQL は permissive なポリシーを OR で足すため、いまの動作は正しい。
-- ただし select は範囲が食い違う。
--
--   spots_select      … created_by = 自分  OR  can_read_spot(id)   ← 共有旅で必要
--   spots_select_own  … created_by = 自分                          ← 0005 が追加
--
-- この状態で「新しいほうが正しい」と判断して spots_select を消すと、
-- 共有旅のメンバーが他の人の登録したスポットを読めなくなり、
-- 地図の色分け・タイムライン・スポット詳細がまとめて壊れる。
--
-- 危ないので、0001 の定義へ一本化する。
-- =============================================================

alter table public.spots enable row level security;

drop policy if exists spots_select_own on public.spots;
drop policy if exists spots_insert_own on public.spots;
drop policy if exists spots_update_own on public.spots;
drop policy if exists spots_delete_own on public.spots;

-- 0005 を先に流していない環境でも同じ状態になるよう、正しい定義を作り直す
drop policy if exists spots_select on public.spots;
create policy spots_select on public.spots for select to authenticated
  using (created_by = auth.uid() or public.can_read_spot(id));

drop policy if exists spots_insert on public.spots;
create policy spots_insert on public.spots for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists spots_update on public.spots;
create policy spots_update on public.spots for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists spots_delete on public.spots;
create policy spots_delete on public.spots for delete to authenticated
  using (created_by = auth.uid());

comment on policy spots_select on public.spots is
  '登録者本人と、そのスポットの訪問記録を読めるユーザー（共有旅のメンバーを含む）が参照できる。';
