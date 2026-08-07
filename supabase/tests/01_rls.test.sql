-- =============================================================
-- RLS / RPC の自動テスト
-- =============================================================
--   scripts/verify-rls.sh から実行します。
--   00_supabase_stub.sql → migrations/*.sql を適用した空のデータベースに対して
--   実行してください。1件でも失敗すると例外で終了します。
-- =============================================================

\set ON_ERROR_STOP on
\pset pager off

begin;

-- -------------------------------------------------------------
-- テスト用の小さな枠組み
-- -------------------------------------------------------------
create temp table test_results (
  seq serial,
  name text,
  ok boolean,
  detail text
) on commit drop;

create or replace function pg_temp.record(p_name text, p_ok boolean, p_detail text default '')
returns void language sql as $$
  insert into test_results (name, ok, detail) values (p_name, p_ok, p_detail);
$$;

-- 指定ユーザーとして SQL を実行し、'ok' か 'SQLSTATE: メッセージ' を返す
create or replace function pg_temp.run_as(p_user uuid, p_sql text)
returns text language plpgsql as $$
begin
  perform public.test_login(p_user);
  set local role authenticated;
  begin
    execute p_sql;
  exception when others then
    set local role postgres;
    return sqlstate || ': ' || sqlerrm;
  end;
  set local role postgres;
  return 'ok';
end $$;

-- 実行はできるが RLS で1行も対象にならないことを確かめる（update / delete 用）。
-- RLS の using 句は行を絞り込むだけでエラーにならないため、影響行数で判定する。
create or replace function pg_temp.affected_as(p_user uuid, p_sql text)
returns text language plpgsql as $$
declare n bigint;
begin
  perform public.test_login(p_user);
  set local role authenticated;
  begin
    execute p_sql;
    get diagnostics n = row_count;
  exception when others then
    set local role postgres;
    return 'denied';
  end;
  set local role postgres;
  return case when n = 0 then 'denied' else format('%s 行に影響しました', n) end;
end $$;

-- 指定ユーザーから見える行数を返す
create or replace function pg_temp.count_as(p_user uuid, p_sql text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform public.test_login(p_user);
  set local role authenticated;
  execute format('select count(*) from (%s) t', p_sql) into n;
  set local role postgres;
  return n;
end $$;

create or replace function pg_temp.expect_ok(p_name text, p_user uuid, p_sql text)
returns void language plpgsql as $$
declare r text;
begin
  r := pg_temp.run_as(p_user, p_sql);
  perform pg_temp.record(p_name, r = 'ok', case when r = 'ok' then '' else r end);
end $$;

create or replace function pg_temp.expect_denied(p_name text, p_user uuid, p_sql text)
returns void language plpgsql as $$
declare r text;
begin
  r := pg_temp.run_as(p_user, p_sql);
  perform pg_temp.record(p_name, r <> 'ok', case when r = 'ok' then '拒否されるべき操作が成功しました' else '' end);
end $$;

-- 更新・削除が1行にも届かないことを確かめる
create or replace function pg_temp.expect_blocked(p_name text, p_user uuid, p_sql text)
returns void language plpgsql as $$
declare r text;
begin
  r := pg_temp.affected_as(p_user, p_sql);
  perform pg_temp.record(p_name, r = 'denied', case when r = 'denied' then '' else r end);
end $$;

create or replace function pg_temp.expect_count(p_name text, p_user uuid, p_sql text, p_expected bigint)
returns void language plpgsql as $$
declare n bigint;
begin
  n := pg_temp.count_as(p_user, p_sql);
  perform pg_temp.record(p_name, n = p_expected, case when n = p_expected then '' else format('期待 %s 件 / 実際 %s 件', p_expected, n) end);
end $$;

-- -------------------------------------------------------------
-- 登場人物
--   alice … 旅行のオーナー
--   bob   … 共有旅のメンバー
--   carol … どこにも参加していない第三者
-- -------------------------------------------------------------
\set alice '11111111-1111-1111-1111-111111111111'
\set bob   '22222222-2222-2222-2222-222222222222'
\set carol '33333333-3333-3333-3333-333333333333'
\set solo  'aaaaaaaa-0000-4000-8000-000000000001'
\set shared 'aaaaaaaa-0000-4000-8000-000000000002'
\set spot_solo   'bbbbbbbb-0000-4000-8000-000000000001'
\set spot_shared 'bbbbbbbb-0000-4000-8000-000000000002'
\set visit_solo    'cccccccc-0000-4000-8000-000000000001'
\set visit_shared_a 'cccccccc-0000-4000-8000-000000000002'
\set visit_shared_b 'cccccccc-0000-4000-8000-000000000003'

-- 新規登録（auth.users への insert）でプロフィールが自動作成されるか
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  (:'alice', 'alice@example.com', now(), '{"display_name":"あかり"}'),
  (:'bob',   'bob@example.com',   now(), '{"display_name":"ぼぶ"}'),
  (:'carol', 'carol@example.com', now(), '{}');

select pg_temp.record(
  '新規登録: handle_new_user がプロフィールを自動作成する',
  (select count(*) from public.profiles where user_id in (:'alice', :'bob', :'carol')) = 3
);

select pg_temp.record(
  '新規登録: display_name はユーザーメタデータ、無ければメールのローカル部',
  (select display_name from public.profiles where user_id = :'alice') = 'あかり'
  and (select display_name from public.profiles where user_id = :'carol') = 'carol'
);

-- -------------------------------------------------------------
-- 旅行の作成
-- -------------------------------------------------------------
select pg_temp.expect_ok('一人旅の作成', :'alice', format(
  $q$insert into public.trips (id, owner_id, title, trip_type) values (%L, %L, '秘密の一人旅', 'solo')$q$,
  :'solo', :'alice'));

select pg_temp.expect_ok('共有旅の作成', :'alice', format(
  $q$insert into public.trips (id, owner_id, title, trip_type, invite_code) values (%L, %L, 'みんなの旅', 'shared', 'TESTCODE')$q$,
  :'shared', :'alice'));

select pg_temp.record(
  '旅行作成時に作成者が owner として登録される',
  (select count(*) from public.trip_members where trip_id = :'shared' and user_id = :'alice' and role = 'owner') = 1
);

select pg_temp.expect_denied('他人を owner にした旅行は作れない', :'carol', format(
  $q$insert into public.trips (owner_id, title, trip_type) values (%L, 'なりすまし', 'solo')$q$, :'alice'));

-- -------------------------------------------------------------
-- 招待と参加
-- -------------------------------------------------------------
select pg_temp.expect_ok('オーナーはメール招待を作成できる', :'alice', format(
  $q$insert into public.trip_invitations (trip_id, email, invite_code, invited_by) values (%L, 'bob@example.com', 'INVITEBOB', %L)$q$,
  :'shared', :'alice'));

select pg_temp.expect_denied('メンバー以外は招待を作成できない', :'carol', format(
  $q$insert into public.trip_invitations (trip_id, email, invite_code) values (%L, 'carol@example.com', 'HACK1234')$q$,
  :'shared'));

select pg_temp.expect_denied('同じ宛先の招待は重複して作れない', :'alice', format(
  $q$insert into public.trip_invitations (trip_id, email, invite_code) values (%L, 'BOB@example.com', 'DUPCODE1')$q$,
  :'shared'));

select pg_temp.expect_count('招待は宛先本人には見える', :'bob',
  'select 1 from public.trip_invitations', 1);

select pg_temp.expect_count('招待は無関係な人には見えない', :'carol',
  'select 1 from public.trip_invitations', 0);

select pg_temp.expect_ok('招待コードで共有旅に参加できる', :'bob',
  $q$select public.join_trip_by_code('invitebob')$q$);

select pg_temp.record(
  '参加後に trip_members へ member として登録される',
  (select count(*) from public.trip_members where trip_id = :'shared' and user_id = :'bob' and role = 'member') = 1
);

select pg_temp.record(
  '招待の状態が accepted になり、承諾者が記録される',
  (select status::text || ':' || (accepted_by = :'bob')::text
     from public.trip_invitations where invite_code = 'INVITEBOB') = 'accepted:true'
);

select pg_temp.expect_denied('一人旅の招待コードでは参加できない', :'carol',
  $q$select public.join_trip_by_code('NOSUCHCODE')$q$);

-- -------------------------------------------------------------
-- スポットと訪問記録
-- -------------------------------------------------------------
select pg_temp.expect_ok('スポットの登録（一人旅用）', :'alice', format(
  $q$insert into public.spots (id, created_by, name, prefecture_code, municipality_code)
     values (%L, %L, '秘密の喫茶店', '21', '21201')$q$, :'spot_solo', :'alice'));

select pg_temp.expect_ok('スポットの登録（共有旅用）', :'alice', format(
  $q$insert into public.spots (id, created_by, name, prefecture_code, municipality_code, latitude, longitude, location_source, location_accuracy_m)
     values (%L, %L, 'みんなのカフェ', '13', '13101', 35.6812, 139.7671, 'device', 12.5)$q$, :'spot_shared', :'alice'));

select pg_temp.expect_ok('一人旅に訪問記録を追加', :'alice', format(
  $q$insert into public.visit_records (id, user_id, trip_id, spot_id, visited_at) values (%L, %L, %L, %L, '2026-01-10')$q$,
  :'visit_solo', :'alice', :'solo', :'spot_solo'));

select pg_temp.expect_ok('共有旅にオーナーが訪問記録を追加', :'alice', format(
  $q$insert into public.visit_records (id, user_id, trip_id, spot_id, visited_at, rating) values (%L, %L, %L, %L, '2026-01-11', 5)$q$,
  :'visit_shared_a', :'alice', :'shared', :'spot_shared'));

select pg_temp.expect_ok('共有旅にメンバーが訪問記録を追加', :'bob', format(
  $q$insert into public.visit_records (id, user_id, trip_id, spot_id, visited_at) values (%L, %L, %L, %L, '2026-01-12')$q$,
  :'visit_shared_b', :'bob', :'shared', :'spot_shared'));

select pg_temp.expect_denied('未参加ユーザーは共有旅に記録を追加できない', :'carol', format(
  $q$insert into public.visit_records (user_id, trip_id, spot_id, visited_at) values (%L, %L, %L, '2026-01-13')$q$,
  :'carol', :'shared', :'spot_shared'));

select pg_temp.expect_denied('他人になりすました訪問記録は追加できない', :'bob', format(
  $q$insert into public.visit_records (user_id, trip_id, spot_id, visited_at) values (%L, %L, %L, '2026-01-14')$q$,
  :'alice', :'shared', :'spot_shared'));

-- -------------------------------------------------------------
-- ★ 一人旅が他ユーザーから見えないこと
-- -------------------------------------------------------------
select pg_temp.expect_count('一人旅は本人にだけ見える', :'alice',
  format($q$select 1 from public.trips where id = %L$q$, :'solo'), 1);
select pg_temp.expect_count('一人旅は共有旅の仲間からも見えない', :'bob',
  format($q$select 1 from public.trips where id = %L$q$, :'solo'), 0);
select pg_temp.expect_count('一人旅は第三者から見えない', :'carol',
  format($q$select 1 from public.trips where id = %L$q$, :'solo'), 0);

select pg_temp.expect_count('一人旅の訪問記録は他ユーザーから見えない', :'bob',
  format($q$select 1 from public.visit_records where trip_id = %L$q$, :'solo'), 0);
select pg_temp.expect_count('一人旅のスポットは他ユーザーから見えない', :'bob',
  format($q$select 1 from public.spots where id = %L$q$, :'spot_solo'), 0);

-- -------------------------------------------------------------
-- ★ 共有旅へ未参加ユーザーが閲覧できないこと
-- -------------------------------------------------------------
select pg_temp.expect_count('共有旅はメンバーには見える', :'bob',
  format($q$select 1 from public.trips where id = %L$q$, :'shared'), 1);
select pg_temp.expect_count('共有旅は未参加ユーザーには見えない（URL を知っていても）', :'carol',
  format($q$select 1 from public.trips where id = %L$q$, :'shared'), 0);
select pg_temp.expect_count('共有旅の訪問記録は未参加ユーザーには見えない', :'carol',
  format($q$select 1 from public.visit_records where trip_id = %L$q$, :'shared'), 0);
select pg_temp.expect_count('共有旅のスポットは未参加ユーザーには見えない', :'carol',
  format($q$select 1 from public.spots where id = %L$q$, :'spot_shared'), 0);
select pg_temp.expect_count('共有旅のメンバー一覧は未参加ユーザーには見えない', :'carol',
  format($q$select 1 from public.trip_members where trip_id = %L$q$, :'shared'), 0);

select pg_temp.expect_ok('共有旅にコメントを投稿できる', :'bob', format(
  $q$insert into public.trip_comments (trip_id, user_id, comment) values (%L, %L, 'たのしかったね')$q$,
  :'shared', :'bob'));
select pg_temp.expect_count('コメントは未参加ユーザーには見えない', :'carol',
  format($q$select 1 from public.trip_comments where trip_id = %L$q$, :'shared'), 0);

-- 一覧取得（アプリの実際の問い合わせに近い形）
select pg_temp.expect_count('carol には旅行が1件も見えない', :'carol', 'select 1 from public.trips', 0);
select pg_temp.expect_count('bob に見える旅行は共有旅の1件だけ', :'bob', 'select 1 from public.trips', 1);
select pg_temp.expect_count('alice には自分の2件が見える', :'alice', 'select 1 from public.trips', 2);

-- 共有旅のスポットが「メンバーには見える」ことの確認。
-- これまで未参加ユーザーに見えないことしか確かめておらず、
-- spots_select を狭めてしまっても気づけない状態だった。
-- 地図の色分け・タイムライン・スポット詳細がここに乗っている。
select pg_temp.expect_count('共有旅のスポットはメンバーに見える', :'bob',
  format($q$select 1 from public.spots where id = %L$q$, :'spot_shared'), 1);

select pg_temp.record('spots に select ポリシーが1本だけある',
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'spots' and cmd = 'SELECT') = 1);

-- タイムラインは、見える訪問記録すべてがスポットへ結び付くことを前提にしている
-- （結び付かない記録はアプリ側で黙って落ちる）。件数の一致で確かめる。
select pg_temp.record('見える訪問記録はすべてスポットへ結び付く',
  pg_temp.count_as(:'bob', format($q$select 1 from public.visit_records where trip_id = %L$q$, :'shared'))
  = pg_temp.count_as(:'bob', format(
      $q$select 1 from public.visit_records vr
           join public.spots s on s.id = vr.spot_id
          where vr.trip_id = %L$q$, :'shared')));

-- -------------------------------------------------------------
-- 編集・削除の権限
-- -------------------------------------------------------------
select pg_temp.expect_blocked('メンバーは他人の訪問記録を編集できない', :'bob', format(
  $q$update public.visit_records set comment = 'かきかえ' where id = %L$q$, :'visit_shared_a'));

select pg_temp.record('メンバーによる他人の記録の編集は1行も変えない',
  (select comment is null from public.visit_records where id = :'visit_shared_a'));

select pg_temp.expect_ok('メンバーは自分の訪問記録を編集できる', :'bob', format(
  $q$update public.visit_records set comment = 'よかった' where id = %L$q$, :'visit_shared_b'));

select pg_temp.expect_ok('オーナーは旅行内のすべての記録を編集できる', :'alice', format(
  $q$update public.visit_records set comment = 'ありがとう' where id = %L$q$, :'visit_shared_b'));

select pg_temp.record('オーナーの編集が反映される',
  (select comment from public.visit_records where id = :'visit_shared_b') = 'ありがとう');

select pg_temp.expect_blocked('メンバーは旅行の情報を更新できない', :'bob', format(
  $q$update public.trips set title = 'のっとり' where id = %L$q$, :'shared'));
select pg_temp.record('メンバーによる旅行名の変更は反映されない',
  (select title from public.trips where id = :'shared') = 'みんなの旅');

-- -------------------------------------------------------------
-- ★ 写真（Storage のパス権限）
-- -------------------------------------------------------------
select pg_temp.expect_ok('自分の一時領域へアップロードできる', :'alice', format(
  $q$insert into storage.objects (bucket_id, name, owner) values ('photos', 'tmp/%s/draft1/a.jpg', %L)$q$, :'alice', :'alice'));

select pg_temp.expect_denied('他人の一時領域へはアップロードできない', :'bob', format(
  $q$insert into storage.objects (bucket_id, name, owner) values ('photos', 'tmp/%s/draft1/b.jpg', %L)$q$, :'alice', :'bob'));

select pg_temp.expect_count('他人の一時領域のファイルは見えない', :'bob',
  $q$select 1 from storage.objects where name like 'tmp/%'$q$, 0);

select pg_temp.expect_ok('共有旅の写真をメンバーが置ける', :'bob', format(
  $q$insert into storage.objects (bucket_id, name, owner) values ('photos', 'trips/%s/visits/%s/p.jpg', %L)$q$,
  :'shared', :'visit_shared_b', :'bob'));

select pg_temp.expect_count('共有旅の写真はメンバーから見える', :'alice',
  format($q$select 1 from storage.objects where name like 'trips/%s/%%'$q$, :'shared'), 1);

select pg_temp.expect_count('共有旅の写真は未参加ユーザーから見えない', :'carol',
  format($q$select 1 from storage.objects where name like 'trips/%s/%%'$q$, :'shared'), 0);

select pg_temp.expect_denied('未参加ユーザーは共有旅の写真を置けない', :'carol', format(
  $q$insert into storage.objects (bucket_id, name, owner) values ('photos', 'trips/%s/visits/%s/x.jpg', %L)$q$,
  :'shared', :'visit_shared_b', :'carol'));

select pg_temp.expect_denied('一人旅の写真は他ユーザーから置けない', :'bob', format(
  $q$insert into storage.objects (bucket_id, name, owner) values ('photos', 'trips/%s/visits/%s/x.jpg', %L)$q$,
  :'solo', :'visit_solo', :'bob'));

select pg_temp.expect_ok('写真のメタ情報を登録できる', :'bob', format(
  $q$insert into public.visit_photos (user_id, visit_record_id, storage_path) values (%L, %L, 'trips/%s/visits/%s/p.jpg')$q$,
  :'bob', :'visit_shared_b', :'shared', :'visit_shared_b'));

select pg_temp.expect_count('写真のメタ情報は未参加ユーザーから見えない', :'carol',
  'select 1 from public.visit_photos', 0);
select pg_temp.expect_count('写真のメタ情報はメンバーから見える', :'alice',
  'select 1 from public.visit_photos', 1);

-- -------------------------------------------------------------
-- プロフィールの公開範囲
-- -------------------------------------------------------------
select pg_temp.expect_count('共有旅の仲間のプロフィールは見える', :'bob',
  format($q$select 1 from public.profiles where user_id = %L$q$, :'alice'), 1);
select pg_temp.expect_count('無関係な人のプロフィールは見えない', :'carol',
  format($q$select 1 from public.profiles where user_id = %L$q$, :'alice'), 0);
select pg_temp.expect_blocked('他人のプロフィールは更新できない', :'bob', format(
  $q$update public.profiles set display_name = 'にせもの' where user_id = %L$q$, :'alice'));

-- -------------------------------------------------------------
-- 集計 RPC が RLS を守るか
-- -------------------------------------------------------------
select pg_temp.expect_count('area_stats: alice には2市区町村分が見える', :'alice',
  'select * from public.area_stats()', 2);
select pg_temp.expect_count('area_stats: bob には共有旅の1市区町村分だけ', :'bob',
  'select * from public.area_stats()', 1);
select pg_temp.expect_count('area_stats: carol には何も見えない', :'carol',
  'select * from public.area_stats()', 0);

-- 旅ワークスペースの分離: 旅行を指定すると、その旅行の記録だけが集計される
select pg_temp.expect_count('area_stats: 一人旅だけを指定すると1市区町村分', :'alice',
  format($q$select * from public.area_stats(array[%L]::uuid[])$q$, :'solo'), 1);
select pg_temp.expect_count('area_stats: 共有旅だけを指定すると1市区町村分', :'alice',
  format($q$select * from public.area_stats(array[%L]::uuid[])$q$, :'shared'), 1);
select pg_temp.record(
  'area_stats: 一人旅と共有旅で市区町村が混ざらない',
  (select municipality_code from public.area_stats(array[:'solo'::uuid])) = '21201'
);
select pg_temp.expect_count('area_stats: 参加していない旅行を指定しても集計されない', :'carol',
  format($q$select * from public.area_stats(array[%L]::uuid[])$q$, :'shared'), 0);

-- -------------------------------------------------------------
-- ★ 活動履歴 trip_activities
-- -------------------------------------------------------------
select pg_temp.record('活動履歴: 一人旅では記録されない',
  (select count(*) from public.trip_activities where trip_id = :'solo') = 0);

select pg_temp.record('活動履歴: 共有旅の作成が記録される',
  (select count(*) from public.trip_activities where trip_id = :'shared' and action = 'trip_created') = 1);

select pg_temp.record('活動履歴: 参加が記録される',
  (select count(*) from public.trip_activities
    where trip_id = :'shared' and action = 'member_joined' and actor_id = :'bob') = 1);

select pg_temp.record('活動履歴: 誰が何を追加したか分かる',
  (select count(*) from public.trip_activities
    where trip_id = :'shared' and action = 'visit_added' and actor_id = :'bob' and target_label = 'みんなのカフェ') = 1);

select pg_temp.record('活動履歴: 編集も記録される',
  (select count(*) from public.trip_activities
    where trip_id = :'shared' and action = 'visit_updated' and actor_id = :'alice') = 1);

select pg_temp.record('活動履歴: 写真の追加は1回の保存で1件にまとまる',
  (select count(*) from public.trip_activities where trip_id = :'shared' and action = 'photo_added') = 1);

select pg_temp.record('活動履歴: コメントが記録される',
  (select count(*) from public.trip_activities where trip_id = :'shared' and action = 'comment_added') = 1);

-- 旅行の作成 / 参加 / 記録の追加2件 / 編集2件 / 写真の追加 / コメント の8件
select pg_temp.expect_count('活動履歴はメンバーから見える', :'bob',
  format($q$select 1 from public.trip_activities where trip_id = %L$q$, :'shared'), 8);
select pg_temp.expect_count('活動履歴は未参加ユーザーから見えない', :'carol',
  'select 1 from public.trip_activities', 0);
select pg_temp.expect_denied('活動履歴はクライアントから直接追加できない', :'bob', format(
  $q$insert into public.trip_activities (trip_id, actor_id, action) values (%L, %L, 'visit_added')$q$,
  :'shared', :'bob'));

-- -------------------------------------------------------------
-- -------------------------------------------------------------
-- アプリの画面が前提にしている挙動
-- -------------------------------------------------------------
-- 「お気に入り」「また行きたい」はスポットではなく訪問記録に付く。
-- マイページの一覧は訪問記録側のフラグで引くので、そこを確かめる。
select pg_temp.expect_ok('自分の記録にお気に入りを付けられる', :'bob', format(
  $q$update public.visit_records set favorite = true where id = %L$q$, :'visit_shared_b'));

select pg_temp.expect_ok('自分の記録に「また行きたい」を付けられる', :'bob', format(
  $q$update public.visit_records set revisit_wanted = true where id = %L$q$, :'visit_shared_b'));

select pg_temp.record('お気に入りのスポットを訪問記録から引ける',
  (select count(*) from public.visit_records v
     join public.spots s on s.id = v.spot_id
    where v.favorite and v.trip_id = :'shared') = 1);

select pg_temp.record('また行きたいスポットを訪問記録から引ける',
  (select count(*) from public.visit_records v
     join public.spots s on s.id = v.spot_id
    where v.revisit_wanted and v.trip_id = :'shared') = 1);

-- 画面は「他人のお気に入りを勝手に外さない」ことを前提にしている
select pg_temp.expect_blocked('他人の記録のお気に入りは外せない', :'carol', format(
  $q$update public.visit_records set favorite = false where id = %L$q$, :'visit_shared_b'));

select pg_temp.record('他人によるお気に入り解除は反映されない',
  (select favorite from public.visit_records where id = :'visit_shared_b'));

-- 更新系のサーバーアクションは「エラーが出ない＝保存できた」ではなく、
-- 影響行数が 0 かどうかで成否を判定している。その前提を固定する。
select pg_temp.record('権限のない更新は例外ではなく0行更新になる',
  pg_temp.affected_as(:'carol', format(
    $q$update public.visit_records set comment = 'のっとり' where id = %L$q$, :'visit_shared_b')) = 'denied');

select pg_temp.record('権限のないスポット更新も0行更新になる',
  pg_temp.affected_as(:'bob', format(
    $q$update public.spots set name = 'のっとり' where id = %L$q$, :'spot_solo')) = 'denied');

-- 期限切れの招待。
-- 画面は status だけで絞ると「一覧に出るのに参加できない招待」を並べてしまうため、
-- status は pending のままでも期限で弾かれることを固定しておく。
select pg_temp.expect_ok('期限切れの招待を作る', :'alice', format(
  $q$insert into public.trip_invitations (trip_id, email, invite_code, invited_by, expires_at)
     values (%L, 'expired@example.com', 'EXPIRED1', %L, now() - interval '1 day')$q$,
  :'shared', :'alice'));

select pg_temp.record('期限切れでも status は pending のまま',
  (select status from public.trip_invitations where invite_code = 'EXPIRED1') = 'pending');

select pg_temp.record('期限で絞ると一覧から外れる',
  (select count(*) from public.trip_invitations
    where invite_code = 'EXPIRED1' and status = 'pending' and expires_at >= now()) = 0);

select pg_temp.expect_denied('期限切れの招待コードでは参加できない', :'carol',
  $q$select public.join_trip_by_code('EXPIRED1')$q$);

-- メンバーの退出・除外
-- -------------------------------------------------------------
select pg_temp.expect_blocked('オーナー自身は除外できない', :'alice', format(
  $q$delete from public.trip_members where trip_id = %L and user_id = %L$q$, :'shared', :'alice'));
select pg_temp.record('オーナーは旅行に残る',
  (select count(*) from public.trip_members where trip_id = :'shared' and user_id = :'alice') = 1);

select pg_temp.expect_ok('メンバーは自分で退出できる', :'bob', format(
  $q$delete from public.trip_members where trip_id = %L and user_id = %L$q$, :'shared', :'bob'));
select pg_temp.record('退出が活動履歴に残る',
  (select count(*) from public.trip_activities where trip_id = :'shared' and action = 'member_left') = 1);
select pg_temp.expect_count('退出後は共有旅が見えなくなる', :'bob',
  format($q$select 1 from public.trips where id = %L$q$, :'shared'), 0);

-- 退出しても、本人が作った記録は本人には見える（user_id で参照できるため）
select pg_temp.expect_count('退出後も自分の記録は自分に見える', :'bob',
  format($q$select 1 from public.visit_records where id = %L$q$, :'visit_shared_b'), 1);

-- -------------------------------------------------------------
-- ★ アカウント削除
-- -------------------------------------------------------------
select pg_temp.expect_ok('アカウント削除の RPC が成功する', :'carol', 'select public.delete_own_account()');
select pg_temp.record('アカウント削除で auth.users から消える',
  (select count(*) from auth.users where id = :'carol') = 0);
select pg_temp.record('アカウント削除でプロフィールも消える',
  (select count(*) from public.profiles where user_id = :'carol') = 0);

select pg_temp.expect_ok('メンバーのアカウント削除', :'bob', 'select public.delete_own_account()');
select pg_temp.record('削除したユーザーの訪問記録は消える',
  (select count(*) from public.visit_records where user_id = :'bob') = 0);
select pg_temp.record('削除したユーザーの写真メタ情報も消える',
  (select count(*) from public.visit_photos where user_id = :'bob') = 0);
select pg_temp.record('他ユーザーの旅行と記録は残る',
  (select count(*) from public.trips) = 2
  and (select count(*) from public.visit_records where user_id = :'alice') = 2);
select pg_temp.record('活動履歴は残り、実行者だけが空になる',
  (select count(*) from public.trip_activities where actor_id is null) > 0);

select pg_temp.expect_ok('オーナーのアカウント削除', :'alice', 'select public.delete_own_account()');
select pg_temp.record('オーナー削除で旅行・記録・スポットがすべて消える',
  (select count(*) from public.trips) = 0
  and (select count(*) from public.visit_records) = 0
  and (select count(*) from public.spots) = 0
  and (select count(*) from public.trip_activities) = 0);

-- -------------------------------------------------------------
-- 結果
-- -------------------------------------------------------------
\echo ''
select lpad(seq::text, 3) as "No.",
       case when ok then '  OK  ' else ' 失敗 ' end as "結果",
       name as "テスト",
       detail as "詳細"
  from test_results order by seq;

\echo ''
select count(*) filter (where ok) as "成功", count(*) filter (where not ok) as "失敗", count(*) as "合計"
  from test_results;

do $$
declare n int;
begin
  select count(*) into n from test_results where not ok;
  if n > 0 then
    raise exception '% 件のテストが失敗しました', n;
  end if;
  raise notice 'すべてのテストに成功しました';
end $$;

rollback;
