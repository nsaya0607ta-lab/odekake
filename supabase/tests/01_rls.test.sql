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
--   alice … 旅行と記録を持つ利用者
--   bob   … 別の利用者（alice の記録は一切見えないはず）
--   carol … 何も持たない利用者
-- -------------------------------------------------------------
\set alice '11111111-1111-1111-1111-111111111111'
\set bob   '22222222-2222-2222-2222-222222222222'
\set carol '33333333-3333-3333-3333-333333333333'
\set trip_a1 'aaaaaaaa-0000-4000-8000-000000000001'
\set trip_a2 'aaaaaaaa-0000-4000-8000-000000000002'
\set trip_b  'aaaaaaaa-0000-4000-8000-000000000003'
\set spot_a1 'bbbbbbbb-0000-4000-8000-000000000001'
\set spot_a2 'bbbbbbbb-0000-4000-8000-000000000002'
\set visit_a1 'cccccccc-0000-4000-8000-000000000001'
\set visit_a2 'cccccccc-0000-4000-8000-000000000002'
\set visit_b  'cccccccc-0000-4000-8000-000000000003'

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
-- 共有旅の名残が残っていないこと
-- -------------------------------------------------------------
select pg_temp.record('共有旅のテーブルが残っていない',
  (select count(*) from information_schema.tables
    where table_schema = 'public'
      and table_name in ('trip_members', 'trip_invitations', 'trip_comments', 'trip_activities')) = 0);

select pg_temp.record('trips に共有旅のための列が残っていない',
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'trips'
      and column_name in ('trip_type', 'invite_code')) = 0);

select pg_temp.record('参加用の RPC が残っていない',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('join_trip_by_code', 'shares_trip_with', 'is_shared_trip')) = 0);

-- -------------------------------------------------------------
-- 旅行の作成
-- -------------------------------------------------------------
select pg_temp.expect_ok('旅行の作成', :'alice', format(
  $q$insert into public.trips (id, owner_id, title) values (%L, %L, '秘密の旅')$q$,
  :'trip_a1', :'alice'));

select pg_temp.expect_ok('2つめの旅行の作成', :'alice', format(
  $q$insert into public.trips (id, owner_id, title, start_date, end_date) values (%L, %L, '春の旅', '2026-03-01', '2026-03-03')$q$,
  :'trip_a2', :'alice'));

select pg_temp.expect_ok('別の利用者も自分の旅行を作れる', :'bob', format(
  $q$insert into public.trips (id, owner_id, title) values (%L, %L, 'ぼぶの旅')$q$,
  :'trip_b', :'bob'));

select pg_temp.expect_denied('他人を owner にした旅行は作れない', :'carol', format(
  $q$insert into public.trips (owner_id, title) values (%L, 'なりすまし')$q$, :'alice'));

-- -------------------------------------------------------------
-- スポットと訪問記録
-- -------------------------------------------------------------
select pg_temp.expect_ok('スポットの登録', :'alice', format(
  $q$insert into public.spots (id, created_by, name, prefecture_code, municipality_code)
     values (%L, %L, '秘密の喫茶店', '21', '21201')$q$, :'spot_a1', :'alice'));

select pg_temp.expect_ok('座標つきスポットの登録', :'alice', format(
  $q$insert into public.spots (id, created_by, name, prefecture_code, municipality_code, latitude, longitude, location_source, location_accuracy_m)
     values (%L, %L, '東京のカフェ', '13', '13101', 35.6812, 139.7671, 'device', 12.5)$q$, :'spot_a2', :'alice'));

select pg_temp.expect_ok('訪問記録を追加', :'alice', format(
  $q$insert into public.visit_records (id, user_id, trip_id, spot_id, visited_at) values (%L, %L, %L, %L, '2026-01-10')$q$,
  :'visit_a1', :'alice', :'trip_a1', :'spot_a1'));

select pg_temp.expect_ok('2件目の訪問記録を追加', :'alice', format(
  $q$insert into public.visit_records (id, user_id, trip_id, spot_id, visited_at, rating) values (%L, %L, %L, %L, '2026-01-11', 5)$q$,
  :'visit_a2', :'alice', :'trip_a2', :'spot_a2'));

select pg_temp.record('EXP: 訪問・初スポット・新地域・評価が台帳と合計へ保存される',
  (select total_exp from public.user_exp where user_id = :'alice') = 925
  and (select count(*) from public.exp_events where user_id = :'alice') = 11);

select pg_temp.expect_count('EXP: 本人は自分の台帳を見られる', :'alice',
  'select 1 from public.exp_events', 11);
select pg_temp.expect_count('EXP: 他人の台帳は見えない', :'bob',
  format($q$select 1 from public.exp_events where user_id = %L$q$, :'alice'), 0);
select pg_temp.expect_denied('EXP: 台帳へ任意のEXPを直接追加できない', :'alice', format(
  $q$insert into public.exp_events (user_id, event_type, exp, idempotency_key)
     values (%L, 'steps', 600, 'manual-cheat')$q$, :'alice'));

select pg_temp.expect_denied('他人の旅行には記録を追加できない', :'bob', format(
  $q$insert into public.visit_records (user_id, trip_id, spot_id, visited_at) values (%L, %L, %L, '2026-01-13')$q$,
  :'bob', :'trip_a1', :'spot_a1'));

select pg_temp.expect_denied('他人になりすました訪問記録は追加できない', :'bob', format(
  $q$insert into public.visit_records (user_id, trip_id, spot_id, visited_at) values (%L, %L, %L, '2026-01-14')$q$,
  :'alice', :'trip_b', :'spot_a1'));

-- -------------------------------------------------------------
-- ★ 旅行が他ユーザーから見えないこと
-- -------------------------------------------------------------
select pg_temp.expect_count('旅行は本人にだけ見える', :'alice',
  format($q$select 1 from public.trips where id = %L$q$, :'trip_a1'), 1);
select pg_temp.expect_count('旅行は他の利用者から見えない（URL を知っていても）', :'bob',
  format($q$select 1 from public.trips where id = %L$q$, :'trip_a1'), 0);
select pg_temp.expect_count('旅行は第三者から見えない', :'carol',
  format($q$select 1 from public.trips where id = %L$q$, :'trip_a1'), 0);

select pg_temp.expect_count('訪問記録は他ユーザーから見えない', :'bob',
  format($q$select 1 from public.visit_records where trip_id = %L$q$, :'trip_a1'), 0);
select pg_temp.expect_count('スポットは他ユーザーから見えない', :'bob',
  format($q$select 1 from public.spots where id = %L$q$, :'spot_a1'), 0);

-- 一覧取得（アプリの実際の問い合わせに近い形）
select pg_temp.expect_count('carol には旅行が1件も見えない', :'carol', 'select 1 from public.trips', 0);
select pg_temp.expect_count('bob に見えるのは自分の1件だけ', :'bob', 'select 1 from public.trips', 1);
select pg_temp.expect_count('alice には自分の2件が見える', :'alice', 'select 1 from public.trips', 2);

select pg_temp.expect_count('自分のスポットは自分に見える', :'alice',
  format($q$select 1 from public.spots where id = %L$q$, :'spot_a2'), 1);

select pg_temp.record('spots に select ポリシーが1本だけある',
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'spots' and cmd = 'SELECT') = 1);

-- タイムラインは、見える訪問記録すべてがスポットへ結び付くことを前提にしている
-- （結び付かない記録はアプリ側で黙って落ちる）。件数の一致で確かめる。
select pg_temp.record('見える訪問記録はすべてスポットへ結び付く',
  pg_temp.count_as(:'alice', 'select 1 from public.visit_records')
  = pg_temp.count_as(:'alice',
      $q$select 1 from public.visit_records vr join public.spots s on s.id = vr.spot_id$q$));

-- -------------------------------------------------------------
-- 編集・削除の権限
-- -------------------------------------------------------------
select pg_temp.expect_ok('自分の訪問記録を編集できる', :'alice', format(
  $q$update public.visit_records set comment = 'よかった' where id = %L$q$, :'visit_a2'));

select pg_temp.record('編集が反映される',
  (select comment from public.visit_records where id = :'visit_a2') = 'よかった');

select pg_temp.record('EXP: 感想の初回追加だけ10EXP増える',
  (select total_exp from public.user_exp where user_id = :'alice') = 935
  and (select count(*) from public.exp_events
         where user_id = :'alice' and event_type = 'comment') = 1);

select pg_temp.expect_ok('同じ感想を再保存できる', :'alice', format(
  $q$update public.visit_records set comment = 'よかった' where id = %L$q$, :'visit_a2'));
select pg_temp.record('EXP: 感想の再保存では二重付与されない',
  (select total_exp from public.user_exp where user_id = :'alice') = 935
  and (select count(*) from public.exp_events
         where user_id = :'alice' and event_type = 'comment') = 1);

select pg_temp.expect_blocked('他人の訪問記録は編集できない', :'bob', format(
  $q$update public.visit_records set comment = 'かきかえ' where id = %L$q$, :'visit_a1'));

select pg_temp.record('他人による編集は1行も変えない',
  (select comment is null from public.visit_records where id = :'visit_a1'));

select pg_temp.expect_blocked('他人は旅行の情報を更新できない', :'bob', format(
  $q$update public.trips set title = 'のっとり' where id = %L$q$, :'trip_a1'));
select pg_temp.record('他人による旅行名の変更は反映されない',
  (select title from public.trips where id = :'trip_a1') = '秘密の旅');

-- -------------------------------------------------------------
-- ★ 写真（Storage のパス権限）
-- -------------------------------------------------------------
select pg_temp.expect_ok('自分の一時領域へアップロードできる', :'alice', format(
  $q$insert into storage.objects (bucket_id, name, owner) values ('photos', 'tmp/%s/draft1/a.jpg', %L)$q$, :'alice', :'alice'));

select pg_temp.expect_denied('他人の一時領域へはアップロードできない', :'bob', format(
  $q$insert into storage.objects (bucket_id, name, owner) values ('photos', 'tmp/%s/draft1/b.jpg', %L)$q$, :'alice', :'bob'));

select pg_temp.expect_count('他人の一時領域のファイルは見えない', :'bob',
  $q$select 1 from storage.objects where name like 'tmp/%'$q$, 0);

-- tmp/ が使えないデータベース向けの予備の一時領域
select pg_temp.expect_ok('自分のフォルダ内の一時領域へアップロードできる', :'alice', format(
  $q$insert into storage.objects (bucket_id, name, owner) values ('photos', 'users/%s/uploads/draft1/a.jpg', %L)$q$,
  :'alice', :'alice'));

select pg_temp.expect_denied('他人のフォルダ内の一時領域へはアップロードできない', :'bob', format(
  $q$insert into storage.objects (bucket_id, name, owner) values ('photos', 'users/%s/uploads/draft1/b.jpg', %L)$q$,
  :'alice', :'bob'));

select pg_temp.expect_ok('自分の旅行の写真を置ける', :'alice', format(
  $q$insert into storage.objects (bucket_id, name, owner) values ('photos', 'trips/%s/visits/%s/p.jpg', %L)$q$,
  :'trip_a2', :'visit_a2', :'alice'));

select pg_temp.expect_count('自分の旅行の写真は自分から見える', :'alice',
  format($q$select 1 from storage.objects where name like 'trips/%s/%%'$q$, :'trip_a2'), 1);

select pg_temp.expect_count('旅行の写真は他ユーザーから見えない', :'bob',
  format($q$select 1 from storage.objects where name like 'trips/%s/%%'$q$, :'trip_a2'), 0);

select pg_temp.expect_denied('他人の旅行には写真を置けない', :'bob', format(
  $q$insert into storage.objects (bucket_id, name, owner) values ('photos', 'trips/%s/visits/%s/x.jpg', %L)$q$,
  :'trip_a1', :'visit_a1', :'bob'));

select pg_temp.expect_ok('写真のメタ情報を登録できる', :'alice', format(
  $q$insert into public.visit_photos (user_id, visit_record_id, storage_path) values (%L, %L, 'trips/%s/visits/%s/p.jpg')$q$,
  :'alice', :'visit_a2', :'trip_a2', :'visit_a2'));

select pg_temp.expect_count('写真のメタ情報は他ユーザーから見えない', :'bob',
  'select 1 from public.visit_photos', 0);
select pg_temp.expect_count('写真のメタ情報は本人から見える', :'alice',
  'select 1 from public.visit_photos', 1);

select pg_temp.record('EXP: 写真は訪問ごとに初回の10EXPだけ付く',
  (select total_exp from public.user_exp where user_id = :'alice') = 945
  and (select count(*) from public.exp_events
         where user_id = :'alice' and event_type = 'photo') = 1);

select pg_temp.expect_ok('同じ訪問へ2枚目の写真メタ情報を登録できる', :'alice', format(
  $q$insert into public.visit_photos (user_id, visit_record_id, storage_path)
     values (%L, %L, 'trips/%s/visits/%s/p2.jpg')$q$,
  :'alice', :'visit_a2', :'trip_a2', :'visit_a2'));
select pg_temp.record('EXP: 写真を増やしても二重付与されない',
  (select total_exp from public.user_exp where user_id = :'alice') = 945
  and (select count(*) from public.exp_events
         where user_id = :'alice' and event_type = 'photo') = 1);

-- -------------------------------------------------------------
-- 歩数EXP（日付単位の累積・最大35EXP）
-- -------------------------------------------------------------
select pg_temp.expect_ok('歩数: 10000歩を日次同期できる', :'alice',
  $q$select public.record_daily_steps('2026-01-12', 10000)$q$);
select pg_temp.record('歩数: 10000歩は22EXP',
  (select earned_exp from public.daily_steps
    where user_id = :'alice' and step_date = '2026-01-12') = 22
  and (select total_exp from public.user_exp where user_id = :'alice') = 967);

select pg_temp.expect_ok('歩数: 同じ日の20000歩へ累積更新できる', :'alice',
  $q$select public.record_daily_steps('2026-01-12', 20000)$q$);
select pg_temp.record('歩数: 20000歩は日次最大35EXPで差分だけ増える',
  (select earned_exp from public.daily_steps
    where user_id = :'alice' and step_date = '2026-01-12') = 35
  and (select total_exp from public.user_exp where user_id = :'alice') = 980
  and (select count(*) from public.exp_events
         where user_id = :'alice' and event_type = 'steps') = 1);

select pg_temp.expect_ok('歩数: 同じ値を再同期できる', :'alice',
  $q$select public.record_daily_steps('2026-01-12', 20000)$q$);
select pg_temp.record('歩数: 同じ値の再同期では二重付与されない',
  (select total_exp from public.user_exp where user_id = :'alice') = 980
  and (select count(*) from public.exp_events
         where user_id = :'alice' and event_type = 'steps') = 1);

select pg_temp.expect_count('歩数: 他人の日次歩数は見えない', :'bob',
  format($q$select 1 from public.daily_steps where user_id = %L$q$, :'alice'), 0);

-- -------------------------------------------------------------
-- プロフィールの公開範囲
-- -------------------------------------------------------------
select pg_temp.expect_count('自分のプロフィールは見える', :'alice',
  format($q$select 1 from public.profiles where user_id = %L$q$, :'alice'), 1);
select pg_temp.expect_count('他人のプロフィールは見えない', :'bob',
  format($q$select 1 from public.profiles where user_id = %L$q$, :'alice'), 0);
select pg_temp.expect_blocked('他人のプロフィールは更新できない', :'bob', format(
  $q$update public.profiles set display_name = 'にせもの' where user_id = %L$q$, :'alice'));

-- ホームに出す「自分の旅」の名前
select pg_temp.expect_ok('自分の旅の名前を変更できる', :'alice', format(
  $q$update public.profiles set space_name = 'あかりのおでかけ' where user_id = %L$q$, :'alice'));
select pg_temp.record('変更した名前が保存される',
  (select space_name from public.profiles where user_id = :'alice') = 'あかりのおでかけ');
select pg_temp.expect_denied('空白だけの名前は保存できない', :'alice', format(
  $q$update public.profiles set space_name = '   ' where user_id = %L$q$, :'alice'));
select pg_temp.expect_ok('名前を空にすると既定へ戻せる', :'alice', format(
  $q$update public.profiles set space_name = null where user_id = %L$q$, :'alice'));

-- -------------------------------------------------------------
-- 集計 RPC が RLS を守るか
-- -------------------------------------------------------------
select pg_temp.expect_count('area_stats: alice には2市区町村分が見える', :'alice',
  'select * from public.area_stats()', 2);
select pg_temp.expect_count('area_stats: bob には何も見えない', :'bob',
  'select * from public.area_stats()', 0);
select pg_temp.expect_count('area_stats: carol には何も見えない', :'carol',
  'select * from public.area_stats()', 0);

-- 旅行を指定すると、その旅行の記録だけが集計される
select pg_temp.expect_count('area_stats: 旅行を1つ指定すると1市区町村分', :'alice',
  format($q$select * from public.area_stats(array[%L]::uuid[])$q$, :'trip_a1'), 1);
select pg_temp.record(
  'area_stats: 旅行ごとに市区町村が混ざらない',
  (select municipality_code from public.area_stats(array[:'trip_a1'::uuid])) = '21201'
);
select pg_temp.expect_count('area_stats: 他人の旅行を指定しても集計されない', :'bob',
  format($q$select * from public.area_stats(array[%L]::uuid[])$q$, :'trip_a1'), 0);

-- -------------------------------------------------------------
-- アプリの画面が前提にしている挙動
-- -------------------------------------------------------------
-- 「お気に入り」「また行きたい」はスポットではなく訪問記録に付く。
-- マイページの一覧は訪問記録側のフラグで引くので、そこを確かめる。
select pg_temp.expect_ok('自分の記録にお気に入りを付けられる', :'alice', format(
  $q$update public.visit_records set favorite = true where id = %L$q$, :'visit_a2'));

select pg_temp.expect_ok('自分の記録に「また行きたい」を付けられる', :'alice', format(
  $q$update public.visit_records set revisit_wanted = true where id = %L$q$, :'visit_a2'));

select pg_temp.record('お気に入りのスポットを訪問記録から引ける',
  (select count(*) from public.visit_records v
     join public.spots s on s.id = v.spot_id
    where v.favorite) = 1);

select pg_temp.record('また行きたいスポットを訪問記録から引ける',
  (select count(*) from public.visit_records v
     join public.spots s on s.id = v.spot_id
    where v.revisit_wanted) = 1);

select pg_temp.expect_blocked('他人の記録のお気に入りは外せない', :'bob', format(
  $q$update public.visit_records set favorite = false where id = %L$q$, :'visit_a2'));

select pg_temp.record('他人によるお気に入り解除は反映されない',
  (select favorite from public.visit_records where id = :'visit_a2'));

-- 更新系のサーバーアクションは「エラーが出ない＝保存できた」ではなく、
-- 影響行数が 0 かどうかで成否を判定している。その前提を固定する。
select pg_temp.record('権限のない更新は例外ではなく0行更新になる',
  pg_temp.affected_as(:'bob', format(
    $q$update public.visit_records set comment = 'のっとり' where id = %L$q$, :'visit_a2')) = 'denied');

select pg_temp.record('権限のないスポット更新も0行更新になる',
  pg_temp.affected_as(:'bob', format(
    $q$update public.spots set name = 'のっとり' where id = %L$q$, :'spot_a1')) = 'denied');

-- -------------------------------------------------------------
-- ★ アカウント削除
-- -------------------------------------------------------------
select pg_temp.expect_ok('アカウント削除の RPC が成功する', :'carol', 'select public.delete_own_account()');
select pg_temp.record('アカウント削除で auth.users から消える',
  (select count(*) from auth.users where id = :'carol') = 0);
select pg_temp.record('アカウント削除でプロフィールも消える',
  (select count(*) from public.profiles where user_id = :'carol') = 0);

select pg_temp.expect_ok('別の利用者のアカウント削除', :'bob', 'select public.delete_own_account()');
select pg_temp.record('削除したユーザーの旅行は消える',
  (select count(*) from public.trips where owner_id = :'bob') = 0);
select pg_temp.record('他ユーザーの旅行と記録は残る',
  (select count(*) from public.trips) = 2
  and (select count(*) from public.visit_records where user_id = :'alice') = 2);

select pg_temp.expect_ok('オーナーのアカウント削除', :'alice', 'select public.delete_own_account()');
select pg_temp.record('オーナー削除で旅行・記録・スポットがすべて消える',
  (select count(*) from public.trips) = 0
  and (select count(*) from public.visit_records) = 0
  and (select count(*) from public.spots) = 0);

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
