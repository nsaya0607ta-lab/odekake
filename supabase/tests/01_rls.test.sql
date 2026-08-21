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
-- 歩数RPCは8日以上前の日付を受け付けないため、日付は固定せず「日本時間の今日」を使う。
select pg_temp.expect_ok('歩数: 10000歩を日次同期できる', :'alice',
  $q$select public.record_daily_steps((timezone('Asia/Tokyo', now()))::date, 10000)$q$);
select pg_temp.record('歩数: 10000歩は22EXP',
  (select earned_exp from public.daily_steps
    where user_id = :'alice' and step_date = (timezone('Asia/Tokyo', now()))::date) = 22
  and (select total_exp from public.user_exp where user_id = :'alice') = 967);

select pg_temp.expect_ok('歩数: 同じ日の20000歩へ累積更新できる', :'alice',
  $q$select public.record_daily_steps((timezone('Asia/Tokyo', now()))::date, 20000)$q$);
select pg_temp.record('歩数: 20000歩は日次最大35EXPで差分だけ増える',
  (select earned_exp from public.daily_steps
    where user_id = :'alice' and step_date = (timezone('Asia/Tokyo', now()))::date) = 35
  and (select total_exp from public.user_exp where user_id = :'alice') = 980
  and (select count(*) from public.exp_events
         where user_id = :'alice' and event_type = 'steps') = 1);

select pg_temp.expect_ok('歩数: 同じ値を再同期できる', :'alice',
  $q$select public.record_daily_steps((timezone('Asia/Tokyo', now()))::date, 20000)$q$);
select pg_temp.record('歩数: 同じ値の再同期では二重付与されない',
  (select total_exp from public.user_exp where user_id = :'alice') = 980
  and (select count(*) from public.exp_events
         where user_id = :'alice' and event_type = 'steps') = 1);

select pg_temp.expect_count('歩数: 他人の日次歩数は見えない', :'bob',
  format($q$select 1 from public.daily_steps where user_id = %L$q$, :'alice'), 0);

-- -------------------------------------------------------------
-- おでかけコイン（レベルアップ報酬 ＋ 歩数報酬）
-- -------------------------------------------------------------
-- ここまでで alice は 980EXP = Lv.7。
-- レベルアップ報酬 Lv.2〜5 が各100枚、Lv.6〜7 が各150枚で 700枚。
-- 歩数報酬は 20000歩なので日次上限の70枚。
select pg_temp.record('コイン: alice は Lv.7 になっている',
  public.exp_level_of((select total_exp from public.user_exp where user_id = :'alice')) = 7);

select pg_temp.record('コイン: レベルアップ報酬が到達レベルごとに1回だけ入る',
  (select count(*) from public.coin_events
     where user_id = :'alice' and event_type = 'level_up') = 6
  and (select sum(amount) from public.coin_events
         where user_id = :'alice' and event_type = 'level_up') = 700);

select pg_temp.record('コイン: 歩数報酬は1日1行で最大70枚',
  (select count(*) from public.coin_events
     where user_id = :'alice' and event_type = 'steps') = 1
  and (select amount from public.coin_events
         where user_id = :'alice' and event_type = 'steps') = 70);

select pg_temp.record('コイン: 残高は台帳の合計と一致する',
  (select balance from public.user_coins where user_id = :'alice') = 770
  and (select total_earned from public.user_coins where user_id = :'alice') = 770
  and (select sum(amount) from public.coin_events where user_id = :'alice') = 770);

select pg_temp.record('コイン: 3000歩未満ではもらえない',
  public.calculate_step_coins(2999) = 0 and public.calculate_step_coins(3000) = 10);

select pg_temp.expect_ok('コイン: 歩数を減らして再同期できる', :'alice',
  $q$select public.record_daily_steps((timezone('Asia/Tokyo', now()))::date, 5000)$q$);
select pg_temp.record('コイン: 歩数が減ると歩数コインも減る（レベル分は残る）',
  (select amount from public.coin_events
     where user_id = :'alice' and event_type = 'steps') = 20
  and (select balance from public.user_coins where user_id = :'alice') = 720);

select pg_temp.expect_count('コイン: 本人は自分の台帳を見られる', :'alice',
  'select 1 from public.coin_events', 7);
select pg_temp.expect_count('コイン: 他人の台帳は見えない', :'bob',
  format($q$select 1 from public.coin_events where user_id = %L$q$, :'alice'), 0);
select pg_temp.expect_count('コイン: 他人の残高は見えない', :'bob',
  format($q$select 1 from public.user_coins where user_id = %L$q$, :'alice'), 0);
select pg_temp.expect_count('コイン: 本人は自分の残高を見られる', :'alice',
  'select 1 from public.user_coins', 1);

select pg_temp.expect_denied('コイン: 台帳へ任意のコインを直接追加できない', :'alice', format(
  $q$insert into public.coin_events (user_id, event_type, amount, idempotency_key)
     values (%L, 'level_up', 9999, 'manual-cheat')$q$, :'alice'));
select pg_temp.expect_blocked('コイン: 残高を直接書き換えられない', :'alice', format(
  $q$update public.user_coins set balance = 99999 where user_id = %L$q$, :'alice'));
select pg_temp.record('コイン: 直接の書き換えは反映されない',
  (select balance from public.user_coins where user_id = :'alice') = 720);

-- -------------------------------------------------------------
-- そうび（レベルアップ報酬のアクセサリー・称号）
-- -------------------------------------------------------------
-- ここまでで alice は Lv.7。Lv.4の首輪・Lv.6のバンダナは解放済み、Lv.8の称号は未解放。
select pg_temp.expect_ok('そうび: 解放済みのアクセサリーを装着できる', :'alice',
  $q$select public.set_equipped_item('collar', 4)$q$);
select pg_temp.record('そうび: 装着した内容が保存される',
  (select level from public.user_equipment where user_id = :'alice' and slot = 'collar') = 4);

select pg_temp.expect_denied('そうび: まだ解放していないレベルの称号は装着できない', :'alice',
  $q$select public.set_equipped_item('title', 8)$q$);

select pg_temp.expect_denied('そうび: レベルとスロットが一致しないと装着できない', :'alice',
  $q$select public.set_equipped_item('bandana', 4)$q$);

select pg_temp.expect_ok('そうび: 別スロットのアクセサリーも装着できる', :'alice',
  $q$select public.set_equipped_item('bandana', 6)$q$);

select pg_temp.expect_count('そうび: 本人は自分のそうびを見られる', :'alice',
  'select 1 from public.user_equipment', 2);
select pg_temp.expect_count('そうび: 他人のそうびは見えない', :'bob',
  format($q$select 1 from public.user_equipment where user_id = %L$q$, :'alice'), 0);

select pg_temp.expect_ok('そうび: 装着中のスロットへ付け替えられる', :'alice',
  $q$select public.set_equipped_item('collar', 4)$q$);
select pg_temp.record('そうび: 付け替えでも1スロット1件のまま',
  (select count(*) from public.user_equipment where user_id = :'alice' and slot = 'collar') = 1);

select pg_temp.expect_ok('そうび: 解除できる', :'alice',
  $q$select public.set_equipped_item('collar', null)$q$);
select pg_temp.record('そうび: 解除するとその行が消える',
  (select count(*) from public.user_equipment where user_id = :'alice' and slot = 'collar') = 0);

select pg_temp.expect_denied('そうび: RPCを介さず直接装着できない', :'alice', format(
  $q$insert into public.user_equipment (user_id, slot, level) values (%L, 'crown', 30)$q$, :'alice'));

-- -------------------------------------------------------------
-- コインガチャ
-- -------------------------------------------------------------
-- ここまでで alice の残高は 720。抽選そのものはアプリ側で行うので、
-- ここでは「減らし方」だけを確かめる。とくに、同じ request_id で
-- 2回呼ばれてもコインが二重に減らないことを固定する。

-- 引いた結果の置き場。判定と同じ式の中で RPC を呼ぶと、状態を見る副問い合わせが
-- 先に評価されてしまうことがあるので、「引く」と「確かめる」を別の文に分ける。
create temp table gacha_last (result jsonb) on commit drop;

create or replace function pg_temp.gacha_as(p_user uuid, p_sql text)
returns void language plpgsql as $$
declare v jsonb;
begin
  perform public.test_login(p_user);
  set local role authenticated;
  execute p_sql into v;
  set local role postgres;
  delete from gacha_last;
  insert into gacha_last (result) values (v);
end $$;

select pg_temp.gacha_as(:'bob',
  $q$select public.commit_gacha_draw(100, 'req-bob-0001', array['placeholder_n'])$q$);
select pg_temp.record('ガチャ: コインが足りないと引けない',
  (select result ->> 'reason' from gacha_last) = 'insufficient_coins'
  -- bob はコインをもらったことがないので、残高の行そのものが無い
  and coalesce((select balance from public.user_coins where user_id = :'bob'), 0) = 0);

select pg_temp.gacha_as(:'alice',
  $q$select public.commit_gacha_draw(100, 'req-alice-0001', array['summer_frenchie'])$q$);
select pg_temp.record('ガチャ: 1回まわすと100コイン減る',
  (select (result ->> 'balance')::integer from gacha_last) = 620
  and (select balance from public.user_coins where user_id = :'alice') = 620);

select pg_temp.record('ガチャ: 引いたものが所持に入り、NEW として返る',
  (select result -> 'new_item_ids' from gacha_last) = '["summer_frenchie"]'::jsonb
  and (select count = 1 from public.user_gacha_items
        where user_id = :'alice' and item_id = 'summer_frenchie'));

-- 連打・再送よけ。同じ request_id は台帳が1件のままで、残高も動かない。
select pg_temp.gacha_as(:'alice',
  $q$select public.commit_gacha_draw(100, 'req-alice-0001', array['placeholder_ssr'])$q$);
select pg_temp.record('ガチャ: 同じリクエストを送り直しても二重に減らない',
  (select result ->> 'applied' from gacha_last) = 'false'
  and (select balance from public.user_coins where user_id = :'alice') = 620
  and (select count(*) from public.coin_events
        where user_id = :'alice' and idempotency_key = 'gacha:req-alice-0001') = 1);

select pg_temp.record('ガチャ: 再送では1回目に引いたものが返る',
  (select result -> 'item_ids' from gacha_last) = '["summer_frenchie"]'::jsonb);

select pg_temp.record('ガチャ: 再送で所持が増えない',
  (select count = 1 from public.user_gacha_items
    where user_id = :'alice' and item_id = 'summer_frenchie')
  and (select count(*) from public.user_gacha_items where user_id = :'alice') = 1);

-- 2回目の当選。同じものが出たら個数だけ増え、NEW ではなくなる。
select pg_temp.gacha_as(:'alice',
  $q$select public.commit_gacha_draw(100, 'req-alice-0002', array['summer_frenchie'])$q$);
select pg_temp.record('ガチャ: 同じものが出ると個数が増え NEW にならない',
  (select result -> 'new_item_ids' from gacha_last) = '[]'::jsonb
  and (select count = 2 from public.user_gacha_items
        where user_id = :'alice' and item_id = 'summer_frenchie'));

select pg_temp.gacha_as(:'alice',
  $q$select public.commit_gacha_draw(900, 'req-alice-0003',
    array['placeholder_n','placeholder_n','placeholder_n','placeholder_n','placeholder_n',
          'placeholder_n','placeholder_n','placeholder_n','placeholder_n','placeholder_n'])$q$);
select pg_temp.record('ガチャ: 10連ぶんの残高がなければ引けない',
  (select result ->> 'reason' from gacha_last) = 'insufficient_coins'
  and (select balance from public.user_coins where user_id = :'alice') = 520);

select pg_temp.record('ガチャ: 消費は台帳に負の値で残る',
  (select sum(amount) from public.coin_events
    where user_id = :'alice' and event_type = 'gacha') = -200);

select pg_temp.expect_denied('ガチャ: RPCを介さず所持を書き足せない', :'alice', format(
  $q$insert into public.user_gacha_items (user_id, item_id) values (%L, 'cheat')$q$, :'alice'));

select pg_temp.expect_count('ガチャ: 本人は自分の所持を見られる', :'alice',
  'select 1 from public.user_gacha_items', 1);
select pg_temp.expect_count('ガチャ: 他人の所持は見えない', :'bob',
  format($q$select 1 from public.user_gacha_items where user_id = %L$q$, :'alice'), 0);

-- -------------------------------------------------------------
-- 犬スキン（重ね着せではなく、犬ごと丸ごと差し替え）
-- -------------------------------------------------------------
-- ここまでで alice は summer_frenchie を1つ所持、hiking_frenchie / snow_frenchie は未所持。
-- bob はガチャに一度も成功していないので何も持っていない。

select pg_temp.expect_ok('犬スキン: default はだれでも選べる', :'bob',
  $q$select public.set_dog_skin('default')$q$);
select pg_temp.record('犬スキン: 選んだ内容が保存される',
  (select skin_id from public.user_dog_skin where user_id = :'bob') = 'default');

select pg_temp.expect_denied('犬スキン: 持っていないスキンは選べない', :'bob',
  $q$select public.set_dog_skin('summer')$q$);
select pg_temp.record('犬スキン: 拒否された選択は保存されない',
  (select skin_id from public.user_dog_skin where user_id = :'bob') = 'default');

select pg_temp.expect_denied('犬スキン: 存在しないスキンIDは拒否される', :'alice',
  $q$select public.set_dog_skin('ghost')$q$);

select pg_temp.expect_ok('犬スキン: 所持しているスキンは選べる', :'alice',
  $q$select public.set_dog_skin('summer')$q$);
select pg_temp.record('犬スキン: 所持スキンへの切り替えが保存される',
  (select skin_id from public.user_dog_skin where user_id = :'alice') = 'summer');

select pg_temp.expect_denied('犬スキン: まだ手に入れていない登山犬は選べない', :'alice',
  $q$select public.set_dog_skin('hiking')$q$);
select pg_temp.record('犬スキン: 拒否されても選択中のスキンは変わらない',
  (select skin_id from public.user_dog_skin where user_id = :'alice') = 'summer');

select pg_temp.expect_ok('犬スキン: default へ戻すのはいつでもできる', :'alice',
  $q$select public.set_dog_skin('default')$q$);
select pg_temp.record('犬スキン: 切り替えても行は1件のまま',
  (select count(*) from public.user_dog_skin where user_id = :'alice') = 1);

select pg_temp.expect_count('犬スキン: 本人は自分の選択を見られる', :'alice',
  'select 1 from public.user_dog_skin', 1);
select pg_temp.expect_count('犬スキン: 他人の選択は見えない', :'bob',
  format($q$select 1 from public.user_dog_skin where user_id = %L$q$, :'alice'), 0);

select pg_temp.expect_denied('犬スキン: RPCを介さず直接書き込めない', :'alice', format(
  $q$insert into public.user_dog_skin (user_id, skin_id) values (%L, 'hiking')$q$, :'alice'));
select pg_temp.expect_blocked('犬スキン: RPCを介さず直接書き換えられない', :'alice', format(
  $q$update public.user_dog_skin set skin_id = 'hiking' where user_id = %L$q$, :'alice'));

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
-- SNS（フレンド間の日替わり写真共有）
-- -------------------------------------------------------------
-- alice と bob だけを相互フレンドにする（carol はどちらとも友達ではない）。
insert into public.friendships (user_id, friend_user_id)
values (:'alice', :'bob'), (:'bob', :'alice');

select pg_temp.expect_ok('SNS投稿に自分の訪問場所と旅行を紐づけられる', :'alice', format(
  $q$select public.create_friend_text_post('喫茶店へ行った', array[]::text[], %L)$q$, :'visit_a1'));

select id as sns_text_post_a from public.friend_text_posts where user_id = :'alice' order by created_at desc limit 1 \gset

select pg_temp.expect_ok('SNS: フレンドの投稿を保存できる', :'bob', format(
  $q$select public.set_friend_text_post_saved(%L, true)$q$, :'sns_text_post_a'));
select pg_temp.record('SNS: 保存タブ用RPCに保存済み投稿が出る',
  pg_temp.count_as(:'bob', format(
    $q$select 1 from public.get_saved_friend_text_posts(100) where id = %L and my_saved$q$,
    :'sns_text_post_a')) = 1);

select pg_temp.expect_ok('SNS: フレンドの投稿をリポストできる', :'bob', format(
  $q$select public.set_friend_text_post_repost(%L, true)$q$, :'sns_text_post_a'));
select pg_temp.record('SNS: リポスト元と件数がフィードへ出る',
  pg_temp.count_as(:'alice', format(
    $q$select 1 from public.get_personal_text_feed(%L, 100)
       where repost_of_post_id = %L and quoted_display_name = 'あかり' and body = ''$q$,
    :'bob', :'sns_text_post_a')) = 1);

select pg_temp.expect_ok('SNS: コメント付き引用とメンションを投稿できる', :'bob', format(
  $q$select public.create_friend_text_post('@あかり また行きたい', array[]::text[], null, %L)$q$,
  :'sns_text_post_a'));
select pg_temp.record('SNS: @メンションが本人の通知RPCへ出る',
  pg_temp.count_as(:'alice',
    $q$select 1 from public.get_sns_mentions(50) where actor_display_name = 'ぼぶ' and kind = 'post'$q$) = 1);

select pg_temp.expect_ok('SNS: 自分の投稿をプロフィールに固定できる', :'alice', format(
  $q$select public.set_friend_text_post_pin(%L, true)$q$, :'sns_text_post_a'));
select pg_temp.record('SNS: 固定状態がプロフィール用フィードへ出る',
  pg_temp.count_as(:'bob', format(
    $q$select 1 from public.get_personal_text_feed(%L, 100) where id = %L and is_pinned$q$,
    :'alice', :'sns_text_post_a')) = 1);

select pg_temp.expect_denied('SNS: 保存テーブルへは直接アクセスできない', :'bob',
  'select * from public.friend_text_post_saves');

select pg_temp.expect_ok('SNS: ユーザーをブロックできる', :'alice', format(
  $q$select public.set_sns_user_block(%L, true)$q$, :'bob'));
select pg_temp.record('SNS: ブロックした相手の投稿は互いに見えない',
  pg_temp.count_as(:'alice', format(
    $q$select 1 from public.get_personal_text_feed(%L, 100)$q$, :'bob')) = 0);
select pg_temp.expect_ok('SNS: ブロックを解除できる', :'alice', format(
  $q$select public.set_sns_user_block(%L, false)$q$, :'bob'));

select pg_temp.record('フレンドには紐づけた場所と旅行名が表示される',
  pg_temp.count_as(:'bob', format(
    $q$select 1 from public.get_personal_text_feed(%L, 100)
       where linked_visit_id = %L and linked_spot_name = '秘密の喫茶店' and linked_trip_title = '秘密の旅'$q$,
    :'alice', :'visit_a1')) = 1);

select pg_temp.record('友達でない相手には紐づけ投稿も見えない',
  pg_temp.count_as(:'carol', format(
    $q$select 1 from public.get_personal_text_feed(%L, 100) where linked_visit_id = %L$q$,
    :'alice', :'visit_a1')) = 0);

select pg_temp.expect_denied('他人の訪問記録は自分の投稿へ紐づけられない', :'bob', format(
  $q$select public.create_friend_text_post('なりすまし', array[]::text[], %L)$q$, :'visit_a1'));

select pg_temp.expect_ok('自分の写真を投稿できる', :'alice', format(
  $q$select public.create_friend_photo('friend-photos/%s/2026-01-01/a.webp', 'テスト')$q$, :'alice'));

select pg_temp.expect_denied('直接テーブルへは触れない（select）', :'alice',
  'select * from public.friend_photos');

select pg_temp.record('フィードにフレンドの投稿が含まれる（bob視点）',
  pg_temp.count_as(:'bob', 'select * from public.get_sns_feed(30)') = 1);

select pg_temp.record('フィードは友達でない相手には見えない（carol視点）',
  pg_temp.count_as(:'carol', 'select * from public.get_sns_feed(30)') = 0);

select pg_temp.record('自分の投稿は自分のフィードにも含まれる（alice視点）',
  pg_temp.count_as(:'alice', 'select * from public.get_sns_feed(30)') = 1);

select id as sns_photo_a1 from public.friend_photos where user_id = :'alice' \gset

select pg_temp.expect_ok('フレンドはリアクションできる', :'bob', format(
  $q$select public.set_friend_photo_reaction('%s', '😊')$q$, :'sns_photo_a1'));

select pg_temp.expect_denied('友達でない相手はリアクションできない', :'carol', format(
  $q$select public.set_friend_photo_reaction('%s', '😊')$q$, :'sns_photo_a1'));

select pg_temp.record('リアクションは1件（絵文字の選び直し）',
  (select count(*) from public.friend_photo_reactions where photo_id = :'sns_photo_a1'::uuid) = 1);

select pg_temp.expect_ok('フレンドはコメントできる', :'bob', format(
  $q$select public.add_friend_photo_comment('%s', 'いいね')$q$, :'sns_photo_a1'));

select pg_temp.expect_denied('友達でない相手はコメントできない', :'carol', format(
  $q$select public.add_friend_photo_comment('%s', 'なりすまし')$q$, :'sns_photo_a1'));

select id as sns_comment_bob from public.friend_photo_comments where photo_id = :'sns_photo_a1'::uuid and user_id = :'bob' \gset

select pg_temp.expect_denied('他人のコメントは削除できない', :'alice', format(
  $q$select public.delete_friend_photo_comment('%s')$q$, :'sns_comment_bob'));

select pg_temp.expect_ok('本人はコメントを削除できる', :'bob', format(
  $q$select public.delete_friend_photo_comment('%s')$q$, :'sns_comment_bob'));

select pg_temp.expect_denied('他人の写真は削除できない', :'bob', format(
  $q$select public.delete_friend_photo('%s')$q$, :'sns_photo_a1'));

select pg_temp.expect_ok('本人は自分の写真を削除できる', :'alice', format(
  $q$select public.delete_friend_photo('%s')$q$, :'sns_photo_a1'));

select pg_temp.record('削除後はフィードから消える',
  pg_temp.count_as(:'alice', 'select * from public.get_sns_feed(30)') = 0);

-- -------------------------------------------------------------
-- SNS: 全体チャット
-- -------------------------------------------------------------
select pg_temp.expect_ok('フレンドは全体チャットに投稿できる', :'alice', $q$select public.create_friend_message('こんにちは')$q$);

select pg_temp.record('自分の発言は自分にも見える',
  pg_temp.count_as(:'alice', 'select * from public.get_friend_messages(50)') = 1);

select pg_temp.record('フレンドの発言が見える（bob視点）',
  pg_temp.count_as(:'bob', 'select * from public.get_friend_messages(50)') = 1);

select pg_temp.record('友達でない人には見えない（carol視点）',
  pg_temp.count_as(:'carol', 'select * from public.get_friend_messages(50)') = 0);

select id as sns_message_a from public.friend_messages where user_id = :'alice' \gset

select pg_temp.expect_denied('他人の発言は削除できない', :'bob', format(
  $q$select public.delete_friend_message(%L)$q$, :'sns_message_a'));

select pg_temp.expect_ok('本人は自分の発言を削除できる', :'alice', format(
  $q$select public.delete_friend_message(%L)$q$, :'sns_message_a'));

select pg_temp.record('削除後は全体チャットから消える',
  pg_temp.count_as(:'alice', 'select * from public.get_friend_messages(50)') = 0);

-- -------------------------------------------------------------
-- SNS: フレンドグループ
-- -------------------------------------------------------------
-- alice がグループを作り、フレンドの bob を招待する。carol は友達ではないので追加されない。
select pg_temp.expect_ok('グループを作成できる', :'alice', format(
  $q$select public.create_friend_group('旅仲間', array[%L]::uuid[])$q$, :'bob'));

select id as sns_group_a from public.friend_groups where owner_id = :'alice' \gset

select pg_temp.record('友達だけがメンバーに入る（carolは入らない）',
  (select count(*) from public.friend_group_members where group_id = :'sns_group_a'::uuid) = 2);

select pg_temp.record('メンバー一覧はメンバーだけ見える（bob視点）',
  pg_temp.count_as(:'bob', format('select * from public.get_friend_group_members(%L)', :'sns_group_a')) = 2);

select pg_temp.record('メンバーでない人はグループの中身を見られない',
  pg_temp.count_as(:'carol', format('select * from public.get_friend_group_members(%L)', :'sns_group_a')) = 0);

select pg_temp.expect_ok('メンバーはグループへ写真を投稿できる', :'bob', format(
  $q$select public.create_friend_photo('friend-photos/%s/group/%s/2026-01-01/b.webp', null, %L)$q$,
  :'bob', :'sns_group_a', :'sns_group_a'));

select pg_temp.expect_denied('メンバーでない人はグループへ写真を投稿できない', :'carol', format(
  $q$select public.create_friend_photo('friend-photos/%s/group/%s/2026-01-01/c.webp', null, %L)$q$,
  :'carol', :'sns_group_a', :'sns_group_a'));

select pg_temp.record('グループの写真は全体フィードには出ない（bob視点）',
  pg_temp.count_as(:'bob', 'select * from public.get_sns_feed(30)') = 0);

select pg_temp.record('グループの写真はグループフィードに出る（alice視点）',
  pg_temp.count_as(:'alice', format('select * from public.get_sns_group_feed(%L, 30)', :'sns_group_a')) = 1);

select pg_temp.record('メンバーでない人はグループフィードを見られない',
  pg_temp.count_as(:'carol', format('select * from public.get_sns_group_feed(%L, 30)', :'sns_group_a')) = 0);

select pg_temp.expect_ok('メンバーはグループにメッセージを送れる', :'alice', format(
  $q$select public.create_friend_group_message(%L, 'よろしく')$q$, :'sns_group_a'));

select pg_temp.expect_denied('メンバーでない人はメッセージを送れない', :'carol', format(
  $q$select public.create_friend_group_message(%L, 'なりすまし')$q$, :'sns_group_a'));

select pg_temp.record('メッセージはメンバーだけ見える（bob視点）',
  pg_temp.count_as(:'bob', format('select * from public.get_friend_group_messages(%L, 50)', :'sns_group_a')) = 1);

select pg_temp.record('メンバーでない人はメッセージを見られない',
  pg_temp.count_as(:'carol', format('select * from public.get_friend_group_messages(%L, 50)', :'sns_group_a')) = 0);

select pg_temp.record('他人の投稿があると未読になる（bob視点、既読前・alice発言分）',
  pg_temp.count_as(:'bob', format(
    'select * from public.get_my_friend_groups() where id = %L and has_unread', :'sns_group_a')) = 1);

select pg_temp.record('グループ一覧に最新メッセージと正確な未読件数が出る（bob視点）',
  pg_temp.count_as(:'bob', format(
    $q$select * from public.get_my_friend_group_summaries()
       where id = %L and latest_kind = 'message' and latest_preview = 'よろしく' and unread_count = 1$q$,
    :'sns_group_a')) = 1);

select pg_temp.expect_ok('既読にできる', :'alice', format(
  $q$select public.mark_friend_group_read(%L)$q$, :'sns_group_a'));

select pg_temp.record('未読は自分の投稿では立たない（alice視点、既読後は自分の発言だけ）',
  pg_temp.count_as(:'alice', format(
    'select * from public.get_my_friend_groups() where id = %L and has_unread', :'sns_group_a')) = 0);

select pg_temp.expect_ok('既読にできる（bob）', :'bob', format(
  $q$select public.mark_friend_group_read(%L)$q$, :'sns_group_a'));

select pg_temp.record('既読後はグループ一覧の未読件数が0になる（bob視点）',
  pg_temp.count_as(:'bob', format(
    'select * from public.get_my_friend_group_summaries() where id = %L and unread_count = 0 and not has_unread',
    :'sns_group_a')) = 1);

select pg_temp.expect_ok('SNSグループ: 集合情報を上部に固定できる', :'alice', format(
  $q$select public.set_friend_group_pin(%L, '東京駅10時', '丸の内南口に集合')$q$,
  :'sns_group_a'));
select pg_temp.record('SNSグループ: 固定カードはメンバーだけが取得できる',
  pg_temp.count_as(:'bob', format(
    $q$select 1 from public.get_friend_group_pin(%L) where title = '東京駅10時'$q$,
    :'sns_group_a')) = 1
  and pg_temp.count_as(:'carol', format(
    $q$select 1 from public.get_friend_group_pin(%L)$q$, :'sns_group_a')) = 0);

select pg_temp.expect_ok('SNSグループ: メンバーは投票を作成できる', :'alice', format(
  $q$select public.create_friend_group_poll(%L, 'ランチはどっち？', array['和食','洋食'])$q$,
  :'sns_group_a'));
select id as sns_poll_a from public.friend_group_polls where group_id = :'sns_group_a'::uuid order by created_at desc limit 1 \gset
select id as sns_poll_option_a from public.friend_group_poll_options where poll_id = :'sns_poll_a'::uuid order by sort_order limit 1 \gset
select pg_temp.expect_ok('SNSグループ: メンバーは投票できる', :'bob', format(
  $q$select public.vote_friend_group_poll(%L, %L)$q$, :'sns_poll_a', :'sns_poll_option_a'));
select pg_temp.expect_denied('SNSグループ: 非メンバーは投票できない', :'carol', format(
  $q$select public.vote_friend_group_poll(%L, %L)$q$, :'sns_poll_a', :'sns_poll_option_a'));
select pg_temp.record('SNSグループ: 投票結果と自分の選択が集計される',
  pg_temp.count_as(:'bob', format(
    $q$select 1 from public.get_friend_group_polls(%L, 5)
       where id = %L and total_votes = 1 and my_option_id = %L$q$,
    :'sns_group_a', :'sns_poll_a', :'sns_poll_option_a')) = 1);

select pg_temp.expect_ok('SNSグループ: チャットでメンションできる', :'alice', format(
  $q$select public.create_friend_group_message(%L, '@ぼぶ 次どこ行く？')$q$, :'sns_group_a'));
select pg_temp.record('SNSグループ: メンションが通知RPCへ出る',
  pg_temp.count_as(:'bob', format(
    $q$select 1 from public.get_sns_mentions(50) where group_id = %L and kind = 'group'$q$,
    :'sns_group_a')) = 1);

select pg_temp.expect_denied('オーナー以外はメンバーを追加できない', :'bob', format(
  $q$select public.add_friend_group_members(%L, array[]::uuid[])$q$, :'sns_group_a'));

select pg_temp.expect_denied('オーナーはグループを退出できない', :'alice', format(
  $q$select public.leave_friend_group(%L)$q$, :'sns_group_a'));

select pg_temp.expect_ok('オーナー以外はグループを退出できる', :'bob', format(
  $q$select public.leave_friend_group(%L)$q$, :'sns_group_a'));

select pg_temp.record('退出後はメンバーから消える',
  (select count(*) from public.friend_group_members where group_id = :'sns_group_a'::uuid) = 1);

select pg_temp.expect_denied('オーナー以外はグループを削除できない', :'bob', format(
  $q$select public.delete_friend_group(%L)$q$, :'sns_group_a'));

select pg_temp.expect_ok('オーナーはグループを削除できる', :'alice', format(
  $q$select public.delete_friend_group(%L)$q$, :'sns_group_a'));

select pg_temp.record('グループ削除で写真とメッセージも消える',
  (select count(*) from public.friend_photos where group_id = :'sns_group_a'::uuid) = 0
  and (select count(*) from public.friend_group_messages where group_id = :'sns_group_a'::uuid) = 0);

-- 後続のアカウント削除テストに影響しないよう、フレンド関係を戻しておく。
delete from public.friendships where user_id in (:'alice', :'bob') and friend_user_id in (:'alice', :'bob');

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

select pg_temp.record('オーナー削除でEXPとコインの台帳・残高も消える',
  (select count(*) from public.exp_events) = 0
  and (select count(*) from public.user_exp) = 0
  and (select count(*) from public.coin_events) = 0
  and (select count(*) from public.user_coins) = 0);

select pg_temp.record('オーナー削除でそうびも消える',
  (select count(*) from public.user_equipment) = 0);

select pg_temp.record('オーナー削除で犬スキンの選択も消える',
  (select count(*) from public.user_dog_skin) = 0);

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
