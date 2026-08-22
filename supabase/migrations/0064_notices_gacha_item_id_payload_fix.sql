-- =============================================================
-- 図鑑レア以上入手お知らせで item_id が payload に入らない不具合を修正
-- =============================================================
-- 0040_notices_collection_rarity_detail.sql で notices_on_gacha_item() は
-- payload に item_id を含めるよう変更されていたが、0063_notices_exclude_admin_account.sql
-- が管理用アカウント除外のために関数を再定義した際、誤って payload を
-- '{}'::jsonb に戻してしまっていた（item_id の格納が抜け落ちた）。
-- この結果、get_notices_feed / get_notice_detail が
-- rare_plus_item_rarity(payload->>'item_id') 等を参照しても常に null となり、
-- 一覧では「レア以上」という汎用表示に、詳細では常に「？？？」になっていた。
-- 管理用アカウント除外は維持したまま、item_id を payload に戻す。
begin;

do $$
begin
  if to_regclass('public.notices') is null
    or to_regprocedure('public.is_admin_account(uuid)') is null
    or to_regprocedure('public.is_rare_plus_item(text)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'NOTICES_GACHA_ITEM_ID_PAYLOAD_FIX_MISSING_DEPENDENCY',
      hint = 'お知らせ機能（0036/0040/0063_notices*.sql）を先に適用してください。';
  end if;
end;
$$;

create or replace function public.notices_on_gacha_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_rare_plus_item(new.item_id) and not public.is_admin_account(new.user_id) then
    insert into public.notices (type, actor_user_id, payload)
    values ('collection_rare', new.user_id, jsonb_build_object('item_id', new.item_id));
  end if;
  return new;
end;
$$;

commit;

notify pgrst, 'reload schema';

select
  'NOTICES_GACHA_ITEM_ID_PAYLOAD_FIX_READY'::text as status,
  to_regprocedure('public.notices_on_gacha_item()') is not null as trigger_fn_ok;
