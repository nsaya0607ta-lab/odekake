-- for.administ@gmail.com の図鑑を全埋め・全スキルLv.MAXにする一回限りの管理用スクリプト。
-- Supabase の SQL Editor で実行してください（サーバー側のみで完結し、アプリコードの変更は不要です）。
--
-- 各アイテムの count は src/lib/gacha/skill-levels.ts の SKILL_LEVEL_THRESHOLDS の
-- 最終しきい値（Lv5到達に必要な累計取得数）。Nレアリティはスキル対象外なので1のみ。
-- 実行時点の src/lib/gacha/prizes.ts の全72アイテム分。

do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where email = 'for.administ@gmail.com';

  if v_user_id is null then
    raise exception 'user not found: for.administ@gmail.com';
  end if;

  insert into public.user_gacha_items (user_id, item_id, count)
  values
    (v_user_id, 'toy_colorful_ball', 1),
    (v_user_id, 'toy_rope', 1),
    (v_user_id, 'toy_bone', 1),
    (v_user_id, 'toy_squeaky_ball', 1),
    (v_user_id, 'toy_duck_plush', 90),
    (v_user_id, 'toy_carrot', 90),
    (v_user_id, 'toy_frisbee', 90),
    (v_user_id, 'toy_treasure_puzzle', 40),
    (v_user_id, 'toy_frenchie_plush', 40),
    (v_user_id, 'toy_rainbow_ball', 26),
    (v_user_id, 'toy_tennis_ball', 1),
    (v_user_id, 'toy_red_slipper', 1),
    (v_user_id, 'toy_wood_stick', 1),
    (v_user_id, 'toy_donut_rope', 1),
    (v_user_id, 'toy_soccer_ball', 90),
    (v_user_id, 'toy_taiyaki_plush', 90),
    (v_user_id, 'toy_bear_plush', 90),
    (v_user_id, 'toy_meat', 40),
    (v_user_id, 'toy_frenchie_cushion', 40),
    (v_user_id, 'toy_paw_macaron', 40),
    (v_user_id, 'toy_star_wan_wand', 40),
    (v_user_id, 'toy_golden_crown_ball', 26),
    (v_user_id, 'food_paw_bowl', 90),
    (v_user_id, 'food_strawberry_roll_cake', 40),
    (v_user_id, 'food_paw_pudding', 90),
    (v_user_id, 'food_paw_melon_bread', 90),
    (v_user_id, 'food_smile_onigiri', 1),
    (v_user_id, 'food_paw_cupcake', 40),
    (v_user_id, 'food_paw_taiyaki', 1),
    (v_user_id, 'food_dog_milk', 1),
    (v_user_id, 'food_cheese_cubes', 1),
    (v_user_id, 'food_roasted_sweet_potato', 1),
    (v_user_id, 'food_honey_butter_toast', 1),
    (v_user_id, 'interior_stretch_rod', 90),
    (v_user_id, 'interior_anball', 15),
    (v_user_id, 'interior_kinoko_azubee', 15),
    (v_user_id, 'interior_sleepy_moon', 40),
    (v_user_id, 'interior_spring_flower_wreath', 40),
    (v_user_id, 'interior_shikkoku_no_ar', 8),
    (v_user_id, 'interior_ragby_ar', 8),
    (v_user_id, 'other_azubee', 15),
    (v_user_id, 'other_omojii', 15),
    (v_user_id, 'other_nakayoshi_azubee', 26),
    (v_user_id, 'other_komochi', 15),
    (v_user_id, 'other_azuki', 15),
    (v_user_id, 'other_kobee', 15),
    (v_user_id, 'other_kamunayo', 26),
    (v_user_id, 'other_hamigaki', 26),
    (v_user_id, 'other_ikea', 26),
    (v_user_id, 'other_orusuban', 26),
    (v_user_id, 'other_kurumari_a', 26),
    (v_user_id, 'other_pondeomo', 26),
    (v_user_id, 'other_pondear', 26),
    (v_user_id, 'other_oyatsu_no_jikan', 26),
    (v_user_id, 'other_jare_a', 26),
    (v_user_id, 'other_ketsunade_a', 26),
    (v_user_id, 'other_listen_to_the_a', 8),
    (v_user_id, 'other_sparkle_rope_crown', 40),
    (v_user_id, 'other_burebur', 6),
    (v_user_id, 'other_yellow_rain_boots', 1),
    (v_user_id, 'accessory_red_bandana', 1),
    (v_user_id, 'other_acorns', 1),
    (v_user_id, 'toy_paper_airplane', 1),
    (v_user_id, 'other_walk_water_bottle', 1),
    (v_user_id, 'other_shiny_pinecone', 1),
    (v_user_id, 'accessory_blue_handkerchief', 1),
    (v_user_id, 'toy_red_balloon', 1),
    (v_user_id, 'toy_sand_bucket', 1),
    (v_user_id, 'accessory_walk_pouch', 1),
    (v_user_id, 'hiking_frenchie', 26),
    (v_user_id, 'snow_frenchie', 26),
    (v_user_id, 'summer_frenchie', 26)
  on conflict (user_id, item_id) do update
    set count = greatest(public.user_gacha_items.count, excluded.count),
        updated_at = now();
end $$;
