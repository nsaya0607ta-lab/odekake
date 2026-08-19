-- =============================================================
-- お知らせ機能
-- =============================================================
-- ホームの「お知らせ」カード用。以下4種類を1つの notices テーブルに集約する。
--   - friend_spot     : フレンドが新規に訪問記録を登録した（閲覧者のフレンドにのみ見せる）
--   - minigame_best    : ミニゲーム（アイテムキャッチ）で自己ベストを更新した
--                         （閲覧者のフレンドにのみ見せる。0041_minigame_best_friends_only.sql 参照）
--   - steps_10000      : 歩数が1日1万歩を超えた（全ユーザーに見せる）
--   - collection_rare  : 図鑑でLR以上のアイテムを初めて手に入れた（全ユーザーに見せる。アイテム名は出さない）
--   - admin            : for.administ@gmail.com のみが投稿できる管理者からのお知らせ（全ユーザーに見せる）
--
-- 既読管理は notice_reads で行い、ユーザーごとに読んだお知らせを記録する。
-- 「新着情報がN件あります」の N は、直近24時間に作成された・自分が見られる・
-- まだ notice_reads に無いお知らせの件数。
begin;

do $$
declare
  v_missing text[] := '{}';
  v_table text;
begin
  foreach v_table in array array[
    'profiles', 'spots', 'visit_records', 'daily_steps', 'coin_events', 'user_gacha_items', 'friendships'
  ] loop
    if to_regclass('public.' || v_table) is null then
      v_missing := array_append(v_missing, 'public.' || v_table);
    end if;
  end loop;

  if cardinality(v_missing) > 0 then
    raise exception using
      errcode = 'P0001',
      message = 'NOTICES_MIGRATION_MISSING_DEPENDENCIES: ' || array_to_string(v_missing, ', '),
      hint = '既存のodekakeマイグレーションを先に適用してください。';
  end if;

  if to_regprocedure('public.is_friend(uuid)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'NOTICES_MIGRATION_MISSING_DEPENDENCY: public.is_friend(uuid)',
      hint = 'フレンド機能（0019_friends.sql）を先に適用してください。';
  end if;
end;
$$;

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('friend_spot', 'minigame_best', 'steps_10000', 'collection_rare', 'admin')),
  actor_user_id uuid references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notices_created_at_idx on public.notices(created_at desc);
create index if not exists notices_actor_idx on public.notices(actor_user_id);

create table if not exists public.notice_reads (
  notice_id uuid not null references public.notices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notice_id, user_id)
);

alter table public.notices enable row level security;
alter table public.notice_reads enable row level security;

-- notices は直接SELECTさせず、フレンド判定や既読状態を含む SECURITY DEFINER RPC 経由でのみ読ませる。
drop policy if exists notice_reads_select_own on public.notice_reads;
create policy notice_reads_select_own on public.notice_reads for select to authenticated
  using (user_id = auth.uid());

drop policy if exists notice_reads_insert_own on public.notice_reads;
create policy notice_reads_insert_own on public.notice_reads for insert to authenticated
  with check (user_id = auth.uid());

grant select, insert on public.notice_reads to authenticated;

-- -------------------------------------------------------------
-- 管理者判定・レアリティ判定
-- -------------------------------------------------------------
create or replace function public.is_notice_admin()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.email(), '')) = 'for.administ@gmail.com';
$$;

-- src/lib/collection/items.ts の rarity: "LR" | "MR" のアイテムだけを対象にする。
-- アイテムが追加されたら、ここにも追記する必要がある。
create or replace function public.is_rare_plus_item(p_item_id text)
returns boolean
language sql
immutable
as $$
  select p_item_id in (
    'interior_shikkoku_no_ar', 'interior_ragby_ar',
    'other_listen_to_the_a', 'other_okaeri',
    'other_burebur', 'other_xmas_party'
  );
$$;

revoke all on function public.is_notice_admin() from public, anon;
revoke all on function public.is_rare_plus_item(text) from public, anon;
grant execute on function public.is_notice_admin() to authenticated;
grant execute on function public.is_rare_plus_item(text) to authenticated;

-- -------------------------------------------------------------
-- 自動発生するお知らせ（トリガー）
-- -------------------------------------------------------------

-- 歩数が1日1万歩を超えた瞬間だけ発生させる（同じ日に何度syncされても1回だけ）。
create or replace function public.notices_on_daily_steps()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.steps >= 10000 and (tg_op = 'INSERT' or old.steps < 10000) then
    insert into public.notices (type, actor_user_id, payload)
    values ('steps_10000', new.user_id, jsonb_build_object('steps', new.steps, 'step_date', new.step_date));
  end if;
  return new;
end;
$$;

drop trigger if exists daily_steps_notices on public.daily_steps;
create trigger daily_steps_notices
  after insert or update on public.daily_steps
  for each row execute function public.notices_on_daily_steps();

-- アイテムキャッチの自己ベスト更新（＝それまでの最高スコアより高い時だけ）。
-- 初プレイ（それまでの記録が無い）はベスト「更新」ではないので対象外にする。
create or replace function public.notices_on_item_catch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_best integer;
  v_score integer;
begin
  if new.event_type <> 'item_catch' then
    return new;
  end if;

  v_score := (new.metadata ->> 'score')::integer;

  select max((metadata ->> 'score')::integer) into v_prev_best
  from public.coin_events
  where user_id = new.user_id
    and event_type = 'item_catch'
    and id <> new.id;

  if v_prev_best is not null and v_score > v_prev_best then
    insert into public.notices (type, actor_user_id, payload)
    values ('minigame_best', new.user_id, jsonb_build_object('score', v_score));
  end if;

  return new;
end;
$$;

drop trigger if exists coin_events_notices on public.coin_events;
create trigger coin_events_notices
  after insert on public.coin_events
  for each row execute function public.notices_on_item_catch();

-- 図鑑でLR以上を初めて手に入れた瞬間（重複所持による count 更新では発生しない）。
create or replace function public.notices_on_gacha_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_rare_plus_item(new.item_id) then
    insert into public.notices (type, actor_user_id, payload)
    values ('collection_rare', new.user_id, '{}'::jsonb);
  end if;
  return new;
end;
$$;

drop trigger if exists user_gacha_items_notices on public.user_gacha_items;
create trigger user_gacha_items_notices
  after insert on public.user_gacha_items
  for each row execute function public.notices_on_gacha_item();

-- フレンドの新規訪問登録。
create or replace function public.notices_on_visit_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notices (type, actor_user_id, payload)
  values ('friend_spot', new.user_id, jsonb_build_object('visit_record_id', new.id, 'spot_id', new.spot_id));
  return new;
end;
$$;

drop trigger if exists visit_records_notices on public.visit_records;
create trigger visit_records_notices
  after insert on public.visit_records
  for each row execute function public.notices_on_visit_record();

-- -------------------------------------------------------------
-- 読み取り・既読・管理者投稿 RPC
-- -------------------------------------------------------------
create or replace function public.get_notices_feed(p_limit integer default 20)
returns table (
  id uuid,
  type text,
  created_at timestamptz,
  display_name text,
  avatar_url text,
  title text,
  is_read boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    n.id,
    n.type,
    n.created_at,
    prof.display_name,
    prof.profile_image_url,
    case n.type
      when 'admin' then n.payload ->> 'message'
      when 'friend_spot' then
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんが' || coalesce(s.name, '') || 'に行きました'
      when 'minigame_best' then
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんがミニゲームで自己ベストを更新しました'
      when 'steps_10000' then
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんが1日1万歩を達成しました'
      when 'collection_rare' then
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんが図鑑でレア以上のアイテムを手に入れました'
      else ''
    end as title,
    exists (
      select 1 from public.notice_reads r
      where r.notice_id = n.id and r.user_id = auth.uid()
    ) as is_read
  from public.notices n
  left join public.profiles prof on prof.user_id = n.actor_user_id
  left join public.spots s on n.type = 'friend_spot' and s.id = (n.payload ->> 'spot_id')::uuid
  where auth.uid() is not null
    and (
      (n.type = 'friend_spot' and public.is_friend(n.actor_user_id))
      or n.type <> 'friend_spot'
    )
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

create or replace function public.get_unread_notice_count()
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::int
  from public.notices n
  where auth.uid() is not null
    and n.created_at >= now() - interval '24 hours'
    and (
      (n.type = 'friend_spot' and public.is_friend(n.actor_user_id))
      or n.type <> 'friend_spot'
    )
    and not exists (
      select 1 from public.notice_reads r
      where r.notice_id = n.id and r.user_id = auth.uid()
    );
$$;

create or replace function public.mark_notices_read(p_notice_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  insert into public.notice_reads (notice_id, user_id)
  select unnest(p_notice_ids), auth.uid()
  on conflict do nothing;
end;
$$;

create or replace function public.post_admin_notice(p_message text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_message text := btrim(coalesce(p_message, ''));
begin
  if not public.is_notice_admin() then
    raise exception using errcode = 'P0001', message = 'ADMIN_REQUIRED';
  end if;

  if length(v_message) = 0 or length(v_message) > 500 then
    raise exception using errcode = 'P0001', message = 'INVALID_MESSAGE';
  end if;

  insert into public.notices (type, actor_user_id, payload)
  values ('admin', null, jsonb_build_object('message', v_message))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.get_notices_feed(integer) from public, anon;
revoke all on function public.get_unread_notice_count() from public, anon;
revoke all on function public.mark_notices_read(uuid[]) from public, anon;
revoke all on function public.post_admin_notice(text) from public, anon;

grant execute on function public.get_notices_feed(integer) to authenticated;
grant execute on function public.get_unread_notice_count() to authenticated;
grant execute on function public.mark_notices_read(uuid[]) to authenticated;
grant execute on function public.post_admin_notice(text) to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'NOTICES_READY'::text as status,
  to_regclass('public.notices') is not null as notices_table_ok,
  to_regclass('public.notice_reads') is not null as notice_reads_table_ok,
  to_regprocedure('public.get_notices_feed(integer)') is not null as feed_rpc_ok,
  to_regprocedure('public.get_unread_notice_count()') is not null as unread_count_rpc_ok,
  to_regprocedure('public.post_admin_notice(text)') is not null as admin_post_rpc_ok;
