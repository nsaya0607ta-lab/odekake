-- =============================================================
-- ミニゲーム自己ベスト更新お知らせが（フレンドから見て）発生しない不具合を修正
-- =============================================================
-- notices_on_item_catch() は new.metadata->>'score' および過去の coin_events の
-- metadata->>'score' を無防備に ::integer キャストしていた。
-- get_friend_item_catch_ranking()（0029_friend_item_catch_ranking.sql:56-59）は
-- 同じ列に対して jsonb_typeof(...) = 'number' を確認してから安全にキャストしており、
-- score が数値以外の形式で入っている coin_events 行が存在しうることを前提にしている。
-- notices_on_item_catch() 側にこのガードが無いため、対象ユーザーの item_catch 履歴に
-- 数値以外の score を持つ行が1件でもあると MAX() 集計でキャスト例外が発生し、
-- トリガーが例外を投げて今回の coin_events への INSERT ごとロールバックされてしまう
-- （= 自己ベスト更新の notices 行が作られず、フレンドから見た通知が永久に発生しない）。
-- 0029 と同じガードを入れて、数値以外の score は 0 扱い（比較対象から除外）にする。
begin;

do $$
begin
  if to_regclass('public.coin_events') is null
    or to_regprocedure('public.notices_on_item_catch()') is null then
    raise exception using
      errcode = 'P0001',
      message = 'NOTICES_ITEM_CATCH_SCORE_CAST_GUARD_MISSING_DEPENDENCY',
      hint = 'お知らせ機能・コイン経済（0028/0036_notices*.sql）を先に適用してください。';
  end if;
end;
$$;

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

  v_score := case
    when jsonb_typeof(new.metadata -> 'score') = 'number' then (new.metadata ->> 'score')::integer
    else 0
  end;

  select max(
    case
      when jsonb_typeof(metadata -> 'score') = 'number' then (metadata ->> 'score')::integer
      else 0
    end
  ) into v_prev_best
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

commit;

notify pgrst, 'reload schema';

select
  'NOTICES_ITEM_CATCH_SCORE_CAST_GUARD_READY'::text as status,
  to_regprocedure('public.notices_on_item_catch()') is not null as trigger_fn_ok;
