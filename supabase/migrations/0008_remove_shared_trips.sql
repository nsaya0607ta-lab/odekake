-- =============================================================
-- 共有旅の廃止（第4版）
-- =============================================================
-- 0001〜0007 を適用済みのプロジェクトに対して実行してください。
--
-- このアプリは「自分ひとりで記録する」用途に絞ります。共有旅に関する
-- テーブル・関数・トリガー・列をすべて削除します。
--
--   trip_members     … 参加メンバー
--   trip_invitations … 招待
--   trip_comments    … 旅行へのコメント
--   trip_activities  … みんなの動き（活動履歴）
--   trips.trip_type / trips.invite_code
--
-- 【この操作は元に戻せません】招待・メンバー・コメント・活動履歴は
-- 完全に消えます。旅行そのものと訪問記録・写真は消しません。
--
-- 共有旅として作られた旅行は、所有者の個人の旅行になります。
-- 他の人の共有旅に自分が書いた記録は、書いた本人の旅行へ移します
-- （移さないと、参加できなくなった時点でその記録が誰からも見えなくなるため）。
--
-- あわせて、ホームに出る「自分の旅」の名前を変更できるように
-- profiles.space_name を追加します。
--
-- 何度実行しても同じ結果になるように書いています
-- （scripts/verify-rls.sh が2回適用して確かめます）。
-- =============================================================

-- -------------------------------------------------------------
-- 1. 共有旅のためのトリガーを外す
-- -------------------------------------------------------------
-- 活動履歴のトリガーは、このあとの記録の付け替えで履歴が書かれるのを防ぐため先に外す。
-- 旅行作成時に trip_members へ owner を入れるトリガーも、残したままだと
-- テーブルを消したあとに旅行を作れなくなる。
drop trigger if exists trips_log_activity on public.trips;
drop trigger if exists visit_records_log_activity on public.visit_records;
drop trigger if exists visit_photos_log_insert on public.visit_photos;
drop trigger if exists visit_photos_log_delete on public.visit_photos;
drop trigger if exists trips_add_owner_member on public.trips;

-- すでに消えているテーブルへの drop trigger はエラーになるため、存在を確かめる
do $$ begin
  if to_regclass('public.trip_members') is not null then
    execute 'drop trigger if exists trip_members_log_activity on public.trip_members';
  end if;
  if to_regclass('public.trip_comments') is not null then
    execute 'drop trigger if exists trip_comments_log_activity on public.trip_comments';
  end if;
end $$;

drop function if exists public.add_trip_owner_as_member();

-- -------------------------------------------------------------
-- 2. trips から共有旅のための列を落とす
-- -------------------------------------------------------------
-- 先に落としておくと、このあとの処理で種類を気にしなくてよくなる。
alter table public.trips drop column if exists trip_type;
alter table public.trips drop column if exists invite_code;

-- -------------------------------------------------------------
-- 3. 他の人の旅行に書いた自分の記録を、自分の旅行へ移す
-- -------------------------------------------------------------
do $$
declare
  v_user uuid;
  v_trip uuid;
begin
  for v_user in
    select distinct vr.user_id
    from public.visit_records vr
    join public.trips t on t.id = vr.trip_id
    where t.owner_id <> vr.user_id
  loop
    -- 移動先は本人がいちばん最初に作った旅行。無ければ作る
    select id into v_trip
      from public.trips
     where owner_id = v_user
     order by created_at
     limit 1;

    if v_trip is null then
      insert into public.trips (owner_id, title, description)
      values (v_user, '自分のおでかけ', '普段のおでかけをまとめる記録先')
      returning id into v_trip;
    end if;

    update public.visit_records vr
       set trip_id = v_trip
      from public.trips t
     where t.id = vr.trip_id
       and vr.user_id = v_user
       and t.owner_id <> vr.user_id;
  end loop;
end $$;

-- -------------------------------------------------------------
-- 4. 共有旅のテーブルを削除する
-- -------------------------------------------------------------
drop table if exists public.trip_activities;
drop table if exists public.trip_comments;
drop table if exists public.trip_invitations;
drop table if exists public.trip_members;

-- -------------------------------------------------------------
-- 5. 権限判定を「持ち主だけ」に単純化する
-- -------------------------------------------------------------
-- can_access_trip は多くのポリシーとストレージの判定から呼ばれるため、
-- 名前と引数はそのままに中身だけ差し替える。
create or replace function public.can_access_trip(p_trip uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip and t.owner_id = auth.uid()
  );
$$;

comment on function public.can_access_trip(uuid) is
  '旅行を読めるか。共有旅の廃止により、持ち主かどうかだけを見る。';

-- プロフィールは本人のみ。同じ旅行のメンバーという概念がなくなった
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (user_id = auth.uid());

-- 招待による閲覧（0004）がなくなるため、旅行の select を戻す。
-- has_pending_trip_invitation() を消す前に、それを使うポリシーを外しておく。
drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips for select to authenticated
  using (owner_id = auth.uid());

-- -------------------------------------------------------------
-- 6. 共有旅のための関数を削除する
-- -------------------------------------------------------------
drop function if exists public.tg_trip_activity();
drop function if exists public.tg_trip_member_activity();
drop function if exists public.tg_visit_activity();
drop function if exists public.tg_visit_photo_insert_activity();
drop function if exists public.tg_visit_photo_delete_activity();
drop function if exists public.tg_trip_comment_activity();
drop function if exists public.is_shared_trip(uuid);
drop function if exists public.has_pending_trip_invitation(uuid);
drop function if exists public.join_trip_by_code(text);
drop function if exists public.shares_trip_with(uuid);

-- log_trip_activity は列挙型を引数に取るため、型が残っているうちに消す
do $$ begin
  if exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
              where n.nspname = 'public' and t.typname = 'trip_activity_action') then
    execute 'drop function if exists public.log_trip_activity(uuid, public.trip_activity_action, text, uuid, text, jsonb)';
  end if;
end $$;

-- -------------------------------------------------------------
-- 7. 使われなくなった列挙型を削除する
-- -------------------------------------------------------------
drop type if exists public.trip_activity_action;
drop type if exists public.invitation_status;
drop type if exists public.trip_role;
drop type if exists public.trip_type;

-- -------------------------------------------------------------
-- 8. ホームに出す「自分の旅」の名前を変更できるようにする
-- -------------------------------------------------------------
alter table public.profiles
  add column if not exists space_name text;

do $$ begin
  alter table public.profiles
    add constraint profiles_space_name_length
    check (space_name is null or length(btrim(space_name)) between 1 and 30);
exception when duplicate_object then null; end $$;

comment on column public.profiles.space_name is
  'ホームや記録画面の上に出す、自分の記録全体の名前。未設定なら「自分の旅」を使う。';
