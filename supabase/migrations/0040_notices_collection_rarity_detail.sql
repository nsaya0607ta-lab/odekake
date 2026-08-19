-- =============================================================
-- 図鑑お知らせ: LR/MRの区別 + 詳細でのアイテム名開示
-- =============================================================
-- 一覧では「レア以上」ではなく実際のレアリティ（LR/MR）を表示する。
-- 詳細画面では、閲覧者自身がそのアイテムを持っていればアイテム名を、
-- 持っていなければ「？？？」を表示する。
-- src/lib/collection/items.ts の LR/MR アイテムと同期させること。
begin;

do $$
begin
  if to_regclass('public.notices') is null then
    raise exception using
      errcode = 'P0001',
      message = 'NOTICES_RARITY_DETAIL_MIGRATION_MISSING_DEPENDENCY: public.notices',
      hint = 'お知らせ機能（0036_notices.sql）を先に適用してください。';
  end if;
  if to_regclass('public.user_gacha_items') is null then
    raise exception using
      errcode = 'P0001',
      message = 'NOTICES_RARITY_DETAIL_MIGRATION_MISSING_DEPENDENCY: public.user_gacha_items',
      hint = 'ガチャ機能（0014_coin_gacha.sql）を先に適用してください。';
  end if;
end;
$$;

-- -------------------------------------------------------------
-- LR/MRアイテムのレアリティ・名前マッピング
-- -------------------------------------------------------------
create or replace function public.rare_plus_item_rarity(p_item_id text)
returns text
language sql
immutable
as $$
  select case p_item_id
    when 'interior_shikkoku_no_ar' then 'LR'
    when 'interior_ragby_ar' then 'LR'
    when 'other_listen_to_the_a' then 'LR'
    when 'other_okaeri' then 'LR'
    when 'other_burebur' then 'MR'
    when 'other_xmas_party' then 'MR'
    else null
  end;
$$;

create or replace function public.rare_plus_item_name(p_item_id text)
returns text
language sql
immutable
as $$
  select case p_item_id
    when 'interior_shikkoku_no_ar' then '漆黒のアー'
    when 'interior_ragby_ar' then 'ラグビーアー'
    when 'other_listen_to_the_a' then 'Listen to the a-'
    when 'other_okaeri' then 'おかえり'
    when 'other_burebur' then 'ブレブル'
    when 'other_xmas_party' then 'Xmas Party'
    else null
  end;
$$;

revoke all on function public.rare_plus_item_rarity(text) from public, anon;
revoke all on function public.rare_plus_item_name(text) from public, anon;
grant execute on function public.rare_plus_item_rarity(text) to authenticated;
grant execute on function public.rare_plus_item_name(text) to authenticated;

-- -------------------------------------------------------------
-- トリガー: どのアイテムを引いたか payload に記録する
-- -------------------------------------------------------------
create or replace function public.notices_on_gacha_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_rare_plus_item(new.item_id) then
    insert into public.notices (type, actor_user_id, payload)
    values ('collection_rare', new.user_id, jsonb_build_object('item_id', new.item_id));
  end if;
  return new;
end;
$$;

-- -------------------------------------------------------------
-- 一覧: レアリティ（LR/MR）を出す。アイテム名は出さない。
-- -------------------------------------------------------------
drop function if exists public.get_notices_feed(integer);

create or replace function public.get_notices_feed(p_limit integer default 20)
returns table (
  id uuid,
  type text,
  created_at timestamptz,
  display_name text,
  avatar_url text,
  title text,
  content text,
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
      when 'admin' then coalesce(nullif(n.payload ->> 'title', ''), n.payload ->> 'message')
      when 'friend_spot' then
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんが' || coalesce(s.name, '') || 'に行きました'
      when 'minigame_best' then
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんがミニゲームで自己ベストを更新しました'
      when 'steps_10000' then
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんが1日1万歩を達成しました'
      when 'collection_rare' then
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんが図鑑で'
          || coalesce(public.rare_plus_item_rarity(n.payload ->> 'item_id'), 'レア以上')
          || 'のアイテムを手に入れました'
      else ''
    end as title,
    case n.type
      when 'admin' then coalesce(nullif(n.payload ->> 'body', ''), n.payload ->> 'message')
      else null
    end as content,
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

-- -------------------------------------------------------------
-- 詳細: 図鑑お知らせは、閲覧者本人が持っているアイテムだけ名前を明かす
-- -------------------------------------------------------------
drop function if exists public.get_notice_detail(uuid);

create or replace function public.get_notice_detail(p_notice_id uuid)
returns table (
  id uuid,
  type text,
  created_at timestamptz,
  display_name text,
  avatar_url text,
  title text,
  content text,
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
      when 'admin' then coalesce(nullif(n.payload ->> 'title', ''), n.payload ->> 'message')
      when 'friend_spot' then
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんが' || coalesce(s.name, '') || 'に行きました'
      when 'minigame_best' then
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんがミニゲームで自己ベストを更新しました'
      when 'steps_10000' then
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんが1日1万歩を達成しました'
      when 'collection_rare' then
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんが図鑑で'
          || coalesce(public.rare_plus_item_rarity(n.payload ->> 'item_id'), 'レア以上')
          || 'のアイテムを手に入れました'
      else ''
    end as title,
    case n.type
      when 'admin' then coalesce(nullif(n.payload ->> 'body', ''), n.payload ->> 'message')
      when 'collection_rare' then
        coalesce(nullif(btrim(prof.display_name), ''), 'ゲスト') || 'さんが'
          || case
               when exists (
                 select 1 from public.user_gacha_items ug
                 where ug.user_id = auth.uid() and ug.item_id = n.payload ->> 'item_id'
               ) then coalesce(public.rare_plus_item_name(n.payload ->> 'item_id'), '？？？')
               else '？？？'
             end
          || 'を手に入れました！'
      else null
    end as content,
    exists (
      select 1 from public.notice_reads r
      where r.notice_id = n.id and r.user_id = auth.uid()
    ) as is_read
  from public.notices n
  left join public.profiles prof on prof.user_id = n.actor_user_id
  left join public.spots s on n.type = 'friend_spot' and s.id = (n.payload ->> 'spot_id')::uuid
  where auth.uid() is not null
    and n.id = p_notice_id
    and (
      (n.type = 'friend_spot' and public.is_friend(n.actor_user_id))
      or n.type <> 'friend_spot'
    );
$$;

revoke all on function public.get_notice_detail(uuid) from public, anon;
grant execute on function public.get_notice_detail(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'NOTICES_COLLECTION_RARITY_DETAIL_READY'::text as status,
  to_regprocedure('public.rare_plus_item_rarity(text)') is not null as rarity_fn_ok,
  to_regprocedure('public.rare_plus_item_name(text)') is not null as name_fn_ok,
  to_regprocedure('public.get_notice_detail(uuid)') is not null as detail_rpc_ok;
