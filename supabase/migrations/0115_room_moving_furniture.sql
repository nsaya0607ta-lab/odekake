-- =============================================================
-- わんこのおへや：動きのある家具を6つ追加
-- =============================================================
-- ・鳥かご（インコ）4,000／ハムスターケージ 3,000／レコードプレーヤー 4,500／暖炉 7,000／扇風機 2,500／ガチャガチャ 3,500
--   （青コイン、1種類2こまで。room_furniture_max は「その他は2こ」のままなので、変えない）。
-- ・値段はアプリ側の FURNITURE[id].price と同じ。ほかの家具・窓や棚・もようがえのデザインの値段は 0114 のまま。
-- ・持っている家具・部屋の飾り方・図鑑アイテムの持ち物には、さわらない。
begin;

do $$
begin
  if to_regprocedure('public.room_theme_bundle(text)') is null then
    raise exception using
      errcode = 'P0001',
      message = 'ROOM_MOVING_FURNITURE_MISSING_DEPENDENCY',
      hint = 'わんこの名前・家具の追加・もようがえのデザイン（0114）を先に適用してください。';
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
    when 'birdcage' then 4000
    when 'hamster' then 3000
    when 'record' then 4500
    when 'fireplace' then 7000
    when 'fan' then 2500
    when 'gacha' then 3500
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

commit;

notify pgrst, 'reload schema';
