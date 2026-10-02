-- =============================================================
-- わんこのおへや：わんこの名前・家具を6つ追加・もようがえのデザインも青コインで買うものに
-- =============================================================
-- ・わんこの名前は、部屋の飾り方（user_rooms.layout の dogName）に保存する（アプリが保存する。この SQL では列を足さない）。
--   フレンドのわんこの名前と見た目は get_friend_dogs で読む（お泊まり会・窓の外を通る犬で、タップしたときだけ名前を出す）。
-- ・家具を6つ追加：こたつ 4,500／金魚ばち 2,500／テレビ 5,000／ピアノ 8,000／ゆりいす 3,500／おもちゃ箱 2,000（青コイン、2こまで）。
-- ・もようがえのデザイン（おへや・窓の形・壁紙・床・カーテン・壁のかざり・ラグ）も青コインで買う（1つずつ、持てるのは1つ）。
--   いまの標準のデザイン（ふつうのおへや・いつもの窓・クリーム・明るい木の床・緑のカーテン・ガーランド・クリームのラグ）と「なし」は無料。
--   値段：おへや 6,000（合う壁紙・床・窓などもセットでもらえる）／窓の形 2,500／壁紙 1,500／床 2,000／カーテン 800／壁のかざり 600／ラグ 1,000。
--   持っている数は家具と同じ user_room_furniture に入れる（furniture 列に wall-brick などの id）。
-- ・これまで選んでいた有料のデザインは、標準にもどす（全員0から）。季節の行事かざりの設定（events）はそのまま。
--   家具・窓や棚・図鑑アイテム・写真・トロフィー・ペナント、図鑑アイテムの持ち物のテーブルにはさわらない。
-- ・値段・セットの中身は、アプリ側（FURNITURE・FIXTURES・THEME_PRICES・roomBundle）から作った値。
begin;

do $$
begin
  if to_regclass('public.user_room_furniture') is null or to_regprocedure('public.room_furniture_max(text)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'ROOM_THEMES_SHOP_MISSING_DEPENDENCY',
      hint = '青コインと家具・窓や棚の購入（0111〜0113）を先に適用してください。';
  end if;
end;
$$;

/** 値段（青コイン）。家具・窓や棚など・もようがえのデザイン。知らないものは null */
create or replace function public.room_furniture_price(p_furniture text)
returns integer
language sql
immutable
as $$
  select case p_furniture
    when 'sofa' then 6000
    when 'dog-bed' then 4000
    when 'plant' then 1200
    when 'bookshelf' then 3000
    when 'lamp' then 2000
    when 'table' then 2500
    when 'dog-house' then 5000
    when 'bowl' then 800
    when 'whiteboard' then 3000
    when 'kotatsu' then 4500
    when 'fishbowl' then 2500
    when 'tv' then 5000
    when 'piano' then 8000
    when 'rocking-chair' then 3500
    when 'toybox' then 2000
    when 'window' then 3000
    when 'shelf' then 1000
    when 'clock' then 1500
    when 'weather' then 2000
    when 'room-log' then 6000
    when 'room-wa' then 6000
    when 'room-nordic' then 6000
    when 'room-cafe' then 6000
    when 'room-seaside' then 6000
    when 'room-starry' then 6000
    when 'style-arch' then 2500
    when 'style-bay' then 2500
    when 'style-round' then 2500
    when 'style-attic' then 2500
    when 'style-shoji' then 2500
    when 'style-french' then 2500
    when 'wall-mint-stripe' then 1500
    when 'wall-pink-gingham' then 1500
    when 'wall-blue-dots' then 1500
    when 'wall-flower' then 1500
    when 'wall-night-stars' then 1500
    when 'wall-wood-panel' then 1500
    when 'wall-log' then 1500
    when 'wall-brick' then 1500
    when 'wall-shiplap' then 1500
    when 'wall-plaster' then 1500
    when 'wall-fog-blue' then 1500
    when 'floor-wood-dark' then 2000
    when 'floor-tatami' then 2000
    when 'floor-checker' then 2000
    when 'floor-carpet' then 2000
    when 'floor-herringbone' then 2000
    when 'floor-white-wood' then 2000
    when 'curtain-sakura' then 800
    when 'curtain-sky' then 800
    when 'curtain-lemon' then 800
    when 'curtain-berry' then 800
    when 'deco-lights' then 600
    when 'deco-stars' then 600
    when 'rug-oval-pink' then 1000
    when 'rug-rect-green' then 1000
    when 'rug-round-navy' then 1000
    else null
  end;
$$;

/** 1種類あたり持てる数（もようがえのデザインは1つ） */
create or replace function public.room_furniture_max(p_furniture text)
returns integer
language sql
immutable
as $$
  select case
    when p_furniture in ('window') then 2
    when p_furniture in ('shelf') then 3
    when p_furniture in ('clock', 'weather') then 1
    when p_furniture ~ '^(room|style|wall|floor|curtain|deco|rug)-' then 1
    else 2
  end;
$$;

/** おへやを買うと、いっしょにもらえる（無料でない）壁紙・床・窓など */
create or replace function public.room_theme_bundle(p_furniture text)
returns text[]
language sql
immutable
as $$
  select case p_furniture
    when 'room-log' then array['wall-log', 'floor-wood-dark', 'curtain-berry', 'rug-rect-green']::text[]
    when 'room-wa' then array['style-shoji', 'wall-plaster', 'floor-tatami']::text[]
    when 'room-nordic' then array['style-french', 'wall-fog-blue', 'floor-white-wood', 'curtain-sky']::text[]
    when 'room-cafe' then array['style-arch', 'wall-brick', 'floor-herringbone', 'curtain-lemon', 'deco-lights', 'rug-rect-green']::text[]
    when 'room-seaside' then array['style-round', 'wall-shiplap', 'curtain-sky', 'rug-round-navy']::text[]
    when 'room-starry' then array['style-attic', 'wall-night-stars', 'floor-carpet', 'curtain-berry', 'deco-stars', 'rug-round-navy']::text[]
    else array[]::text[]
  end;
$$;

-- 1こ買う（同じ人の同じものは、行のロックで1つずつ）。おへやは、セットの壁紙・床・窓なども持っていることにする
create or replace function public.buy_room_furniture(p_furniture text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_price integer := public.room_furniture_price(p_furniture);
  v_max integer := public.room_furniture_max(p_furniture);
  v_owned integer;
  v_balance integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if v_price is null then
    raise exception using errcode = 'P0001', message = 'INVALID_FURNITURE';
  end if;

  insert into public.user_room_furniture (user_id, furniture) values (v_user_id, p_furniture) on conflict do nothing;
  select count into v_owned from public.user_room_furniture where user_id = v_user_id and furniture = p_furniture for update;
  if v_owned >= v_max then
    raise exception using errcode = 'P0001', message = 'FURNITURE_LIMIT';
  end if;

  if not public.add_blue_coin_event(
    v_user_id, 'room_furniture', -v_price,
    'room-furniture:' || p_furniture || ':' || gen_random_uuid()::text,
    jsonb_build_object('label', 'おへやの家具', 'furniture', p_furniture)
  ) then
    raise exception using errcode = 'P0001', message = 'PURCHASE_CONFLICT';
  end if;

  update public.user_room_furniture set count = v_owned + 1, updated_at = now() where user_id = v_user_id and furniture = p_furniture;

  -- おへやのセット
  insert into public.user_room_furniture (user_id, furniture, count)
  select v_user_id, b, 1 from unnest(public.room_theme_bundle(p_furniture)) as b
  on conflict (user_id, furniture) do update set count = greatest(public.user_room_furniture.count, 1), updated_at = now();

  select balance into v_balance from public.user_blue_coins where user_id = v_user_id;
  return jsonb_build_object('ok', true, 'furniture', p_furniture, 'owned', v_owned + 1, 'balance', coalesce(v_balance, 0));
end;
$$;

revoke all on function public.buy_room_furniture(text) from public, anon;
grant execute on function public.buy_room_furniture(text) to authenticated;

comment on function public.buy_room_furniture(text) is
  'わんこのおへやの家具・窓や棚など・もようがえのデザインを1こ、青コインで買う（持てる数は room_furniture_max、値段は room_furniture_price。おへやは room_theme_bundle もいっしょに）。';

-- -------------------------------------------------------------
-- フレンドのわんこの名前と見た目（自分のフレンドだけ）
-- -------------------------------------------------------------
create or replace function public.get_friend_dogs()
returns table (friend_user_id uuid, dog_name text, dog_skin text)
language sql
security definer
stable
set search_path = public
as $$
  select f.friend_user_id,
         nullif(left(btrim(r.layout ->> 'dogName'), 10), '') as dog_name,
         r.showcase ->> 'dog' as dog_skin
    from public.friendships f
    left join public.user_rooms r on r.user_id = f.friend_user_id
   where f.user_id = auth.uid();
$$;

revoke all on function public.get_friend_dogs() from public, anon;
grant execute on function public.get_friend_dogs() to authenticated;

comment on function public.get_friend_dogs() is
  'フレンドのわんこの名前（user_rooms.layout の dogName）と見た目（showcase の dog）。自分のフレンドの分だけ。';

-- -------------------------------------------------------------
-- これまで選んでいた有料のデザインは、標準にもどす（events などほかの設定はそのまま）
-- -------------------------------------------------------------
update public.user_rooms r
   set layout = jsonb_set(
         r.layout,
         '{theme}',
         (r.layout -> 'theme') || jsonb_build_object(
           'room', 'cozy',
           'style', 'standard',
           'wall', 'cream',
           'floor', 'wood-light',
           'curtain', 'leaf',
           'deco', case when r.layout -> 'theme' ->> 'deco' in ('garland', 'none') then r.layout -> 'theme' ->> 'deco' else 'garland' end,
           'rug', case when r.layout -> 'theme' ->> 'rug' in ('round-cream', 'none') then r.layout -> 'theme' ->> 'rug' else 'round-cream' end
         )
       ),
       updated_at = now()
 where jsonb_typeof(r.layout -> 'theme') = 'object';

commit;

notify pgrst, 'reload schema';
