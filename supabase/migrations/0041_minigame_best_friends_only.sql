-- =============================================================
-- ミニゲーム自己ベスト更新のお知らせをフレンド限定に変更
-- =============================================================
-- 0036_notices.sql では minigame_best は全ユーザーに見せていたが、
-- friend_spot と同様にフレンドにのみ見せるよう変更する。
-- スコアの大小に関わらず、閲覧者が投稿者のフレンドである場合だけ見える。
begin;

do $$
begin
  if to_regclass('public.notices') is null then
    raise exception using
      errcode = 'P0001',
      message = 'NOTICES_MINIGAME_FRIENDS_ONLY_MIGRATION_MISSING_DEPENDENCY: public.notices',
      hint = 'お知らせ機能（0036_notices.sql）を先に適用してください。';
  end if;
  if to_regprocedure('public.is_friend(uuid)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'NOTICES_MINIGAME_FRIENDS_ONLY_MIGRATION_MISSING_DEPENDENCY: public.is_friend(uuid)',
      hint = 'フレンド機能（0019_friends.sql）を先に適用してください。';
  end if;
end;
$$;

-- -------------------------------------------------------------
-- 一覧
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
      (n.type in ('friend_spot', 'minigame_best') and public.is_friend(n.actor_user_id))
      or n.type not in ('friend_spot', 'minigame_best')
    )
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- -------------------------------------------------------------
-- 未読件数
-- -------------------------------------------------------------
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
      (n.type in ('friend_spot', 'minigame_best') and public.is_friend(n.actor_user_id))
      or n.type not in ('friend_spot', 'minigame_best')
    )
    and not exists (
      select 1 from public.notice_reads r
      where r.notice_id = n.id and r.user_id = auth.uid()
    );
$$;

-- -------------------------------------------------------------
-- 詳細
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
      (n.type in ('friend_spot', 'minigame_best') and public.is_friend(n.actor_user_id))
      or n.type not in ('friend_spot', 'minigame_best')
    );
$$;

revoke all on function public.get_notices_feed(integer) from public, anon;
revoke all on function public.get_unread_notice_count() from public, anon;
revoke all on function public.get_notice_detail(uuid) from public, anon;

grant execute on function public.get_notices_feed(integer) to authenticated;
grant execute on function public.get_unread_notice_count() to authenticated;
grant execute on function public.get_notice_detail(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

select
  'NOTICES_MINIGAME_FRIENDS_ONLY_READY'::text as status,
  to_regprocedure('public.get_notices_feed(integer)') is not null as feed_rpc_ok,
  to_regprocedure('public.get_unread_notice_count()') is not null as unread_count_rpc_ok,
  to_regprocedure('public.get_notice_detail(uuid)') is not null as detail_rpc_ok;
