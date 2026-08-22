-- =============================================================
-- 管理用アカウント(for.administ@gmail.com)の行動を自動お知らせの対象外にする
-- =============================================================
-- notices テーブルは歩数10000達成・ミニゲーム自己ベスト更新・図鑑レア以上入手を
-- トリガーで自動投稿していたが、管理用アカウントがこれらの操作を行った場合も
-- 一般ユーザーと同様にお知らせが生成されてしまっていた。
-- 管理用アカウントについては is_notice_admin() が投稿を許可する「admin」種別の
-- お知らせ（運営からのお知らせ）だけが配信されるようにし、自動発生系
-- （steps_10000 / minigame_best / collection_rare）の対象からは除外する。
begin;

do $$
begin
  if to_regclass('public.notices') is null
    or to_regprocedure('public.is_notice_admin()') is null
    or to_regprocedure('public.notices_on_daily_steps()') is null
    or to_regprocedure('public.notices_on_item_catch()') is null
    or to_regprocedure('public.notices_on_gacha_item()') is null then
    raise exception using
      errcode = 'P0001',
      message = 'NOTICES_EXCLUDE_ADMIN_MISSING_DEPENDENCY',
      hint = 'お知らせ機能（0036_notices.sql）を先に適用してください。';
  end if;
end;
$$;

-- auth.email() に依存する is_notice_admin() は「今ログインしているユーザー」しか
-- 判定できないため、トリガー内で任意ユーザーIDを判定できる関数を別途用意する。
create or replace function public.is_admin_account(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and exists (
    select 1 from auth.users u
    where u.id = p_user_id
      and lower(coalesce(u.email, '')) = 'for.administ@gmail.com'
  );
$$;

revoke all on function public.is_admin_account(uuid) from public, anon;
grant execute on function public.is_admin_account(uuid) to authenticated;

-- 歩数1万歩達成。管理用アカウントは対象外にする。
create or replace function public.notices_on_daily_steps()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.steps >= 10000
    and (tg_op = 'INSERT' or old.steps < 10000)
    and not public.is_admin_account(new.user_id) then
    insert into public.notices (type, actor_user_id, payload)
    values ('steps_10000', new.user_id, jsonb_build_object('steps', new.steps, 'step_date', new.step_date));
  end if;
  return new;
end;
$$;

-- アイテムキャッチ自己ベスト更新。管理用アカウントは対象外にする。
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

  if public.is_admin_account(new.user_id) then
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

-- 図鑑レア以上初入手。管理用アカウントは対象外にする。
create or replace function public.notices_on_gacha_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_rare_plus_item(new.item_id) and not public.is_admin_account(new.user_id) then
    insert into public.notices (type, actor_user_id, payload)
    values ('collection_rare', new.user_id, '{}'::jsonb);
  end if;
  return new;
end;
$$;

commit;

notify pgrst, 'reload schema';

select
  'NOTICES_EXCLUDE_ADMIN_READY'::text as status,
  to_regprocedure('public.is_admin_account(uuid)') is not null as is_admin_account_rpc_ok;
