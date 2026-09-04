-- =============================================================
-- 「管理用」アカウントの全アイテムのスキルレベルを5(MAX)にする
-- =============================================================
-- スキルレベルは user_gacha_items.count（累計取得数）から
-- src/lib/gacha/skill-levels.ts の SKILL_LEVEL_THRESHOLDS で判定される。
-- Lv5に必要なcountはレアリティごとに固定（R:90 / SR:40 / SSR:26 / UR:15 / LR:8 / MR:6）。
-- N（ノーマル）はスキルレベルの対象外なので触らない。
-- アイテム一覧（id・レアリティ）は src/lib/gacha/prizes.ts の GACHA_PRIZES と一致させている。
--
-- 実行方法: Supabase SQL Editor か `psql` で、対象DBに対してこのファイルをそのまま実行する。
-- 一回限りのデータ修正用スクリプトであり、schema migrationではないので
-- supabase/migrations/ には置いていない。

do $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id
  from public.profiles
  where display_name = '管理用'
  limit 1;

  if v_user_id is null then
    raise exception 'display_name = ''管理用'' のプロフィールが見つかりません';
  end if;

  with item_rarities (item_id, rarity) as (
    values
    ('toy_colorful_ball', 'N'),
    ('toy_rope', 'N'),
    ('toy_bone', 'N'),
    ('toy_squeaky_ball', 'N'),
    ('toy_duck_plush', 'R'),
    ('toy_carrot', 'R'),
    ('toy_frisbee', 'R'),
    ('toy_treasure_puzzle', 'SR'),
    ('toy_frenchie_plush', 'SR'),
    ('toy_rainbow_ball', 'SSR'),
    ('toy_tennis_ball', 'N'),
    ('toy_red_slipper', 'N'),
    ('toy_wood_stick', 'N'),
    ('toy_donut_rope', 'N'),
    ('toy_soccer_ball', 'R'),
    ('toy_taiyaki_plush', 'R'),
    ('toy_bear_plush', 'R'),
    ('toy_meat', 'SR'),
    ('toy_frenchie_cushion', 'SR'),
    ('toy_paw_macaron', 'SR'),
    ('toy_star_wan_wand', 'SR'),
    ('toy_golden_crown_ball', 'SSR'),
    ('food_paw_bowl', 'R'),
    ('food_strawberry_roll_cake', 'SR'),
    ('food_paw_pudding', 'R'),
    ('food_paw_melon_bread', 'R'),
    ('food_smile_onigiri', 'N'),
    ('food_paw_cupcake', 'SR'),
    ('food_paw_taiyaki', 'N'),
    ('food_dog_milk', 'N'),
    ('food_cheese_cubes', 'N'),
    ('food_roasted_sweet_potato', 'N'),
    ('food_honey_butter_toast', 'N'),
    ('food_fruit_basket', 'SR'),
    ('food_kamikami', 'R'),
    ('food_mocchurin', 'UR'),
    ('interior_stretch_rod', 'R'),
    ('interior_anball', 'UR'),
    ('interior_kinoko_azubee', 'UR'),
    ('interior_gold_ball', 'SSR'),
    ('interior_sleepy_moon', 'SR'),
    ('interior_spring_flower_wreath', 'SR'),
    ('interior_shikkoku_no_ar', 'LR'),
    ('interior_ragby_ar', 'LR'),
    ('other_azubee', 'UR'),
    ('other_omojii', 'UR'),
    ('other_nakayoshi_azubee', 'SSR'),
    ('other_komochi', 'UR'),
    ('other_azuki', 'UR'),
    ('other_omoi_bashira', 'UR'),
    ('other_kobee', 'UR'),
    ('other_kamunayo', 'SSR'),
    ('other_hamigaki', 'SSR'),
    ('other_ikea', 'SSR'),
    ('other_orusuban', 'SSR'),
    ('other_kurumari_a', 'SSR'),
    ('other_pondeomo', 'SSR'),
    ('other_pondear', 'SSR'),
    ('other_oyatsu_no_jikan', 'SSR'),
    ('other_jare_a', 'SSR'),
    ('other_ketsunade_a', 'SSR'),
    ('other_omochi_janai', 'SSR'),
    ('other_oyasumi', 'SSR'),
    ('other_nisoku_a', 'SSR'),
    ('other_listen_to_the_a', 'LR'),
    ('other_okaeri', 'LR'),
    ('other_sparkle_rope_crown', 'SR'),
    ('other_burebur', 'MR'),
    ('other_xmas_party', 'MR'),
    ('other_narcissist_a', 'MR'),
    ('other_mafia_a', 'MR'),
    ('other_clawd', 'SSR'),
    ('other_mah', 'UR'),
    ('other_mirror_omochi', 'UR'),
    ('other_toorematen', 'UR'),
    ('other_hia', 'UR'),
    ('other_yellow_rain_boots', 'N'),
    ('accessory_red_bandana', 'N'),
    ('other_acorns', 'N'),
    ('toy_paper_airplane', 'N'),
    ('other_walk_water_bottle', 'N'),
    ('other_shiny_pinecone', 'N'),
    ('accessory_blue_handkerchief', 'N'),
    ('toy_red_balloon', 'N'),
    ('toy_sand_bucket', 'N'),
    ('accessory_walk_pouch', 'N'),
    ('hiking_frenchie', 'LR'),
    ('snow_frenchie', 'LR'),
    ('summer_frenchie', 'LR'),
    ('toy_hiking_stick', 'N'),
    ('toy_rock_ball', 'N'),
    ('toy_echo_whistle', 'N'),
    ('toy_rope_swing', 'R'),
    ('food_ume_onigiri', 'N'),
    ('food_hut_curry', 'N'),
    ('food_onsen_tamago', 'R'),
    ('food_summit_cup_ramen', 'R'),
    ('interior_led_lantern', 'N'),
    ('interior_campfire_set', 'R'),
    ('interior_hut_fireplace', 'SR'),
    ('interior_stargazing_telescope', 'SSR'),
    ('accessory_bear_bell', 'N'),
    ('accessory_hiking_backpack', 'N'),
    ('accessory_trekking_poles', 'R'),
    ('accessory_hiking_pin_hat', 'SR'),
    ('other_trail_map_compass', 'R'),
    ('other_cairn', 'SR'),
    ('other_sunrise_view', 'SSR'),
    ('other_sea_of_clouds', 'UR'),
    ('other_rock_ptarmigan', 'LR'),
    ('toy_sled', 'N'),
    ('toy_snowman_kit', 'N'),
    ('toy_snowball', 'N'),
    ('toy_mini_skis', 'R'),
    ('food_snow_roasted_sweet_potato', 'N'),
    ('food_oshiruko', 'N'),
    ('food_oden', 'R'),
    ('food_hot_chocolate', 'R'),
    ('interior_yutanpo', 'N'),
    ('interior_fluffy_blanket', 'R'),
    ('interior_kerosene_stove', 'SR'),
    ('interior_kotatsu', 'SSR'),
    ('accessory_knit_hat', 'N'),
    ('accessory_muffler', 'N'),
    ('accessory_mittens', 'R'),
    ('accessory_fluffy_boots', 'SR'),
    ('other_icicle', 'R'),
    ('other_snowflake_ornament', 'SR'),
    ('other_snow_lantern', 'SSR'),
    ('other_kamakura', 'UR'),
    ('other_diamond_dust', 'LR'),
    ('toy_beach_ball', 'N'),
    ('toy_bug_net', 'N'),
    ('food_watermelon', 'N'),
    ('food_ramune', 'N'),
    ('food_popsicle', 'N'),
    ('toy_water_gun', 'R'),
    ('food_shaved_ice', 'R'),
    ('food_somen', 'R'),
    ('interior_sudare', 'R'),
    ('accessory_straw_hat', 'R'),
    ('accessory_sunglasses', 'R'),
    ('other_cotton_candy', 'R'),
    ('accessory_jinbei', 'SR'),
    ('other_sparkler', 'SR'),
    ('other_goldfish_scoop', 'SSR'),
    ('interior_beach_parasol', 'SSR'),
    ('toy_fireworks_set', 'UR'),
    ('toy_yoyo_scoop', 'N'),
    ('toy_bubbles', 'N'),
    ('toy_water_balloon', 'N'),
    ('toy_watermelon_bat', 'R'),
    ('food_grilled_corn', 'N'),
    ('food_takoyaki', 'R'),
    ('food_melon_soda', 'R'),
    ('food_fruit_punch', 'R'),
    ('food_hiyashi_chuka', 'R'),
    ('interior_uchiwa', 'N'),
    ('interior_mosquito_coil', 'SR'),
    ('interior_hammock', 'SR'),
    ('accessory_beach_sandals', 'R'),
    ('accessory_shell_bracelet', 'R'),
    ('accessory_yukata_kanzashi', 'SR'),
    ('other_lantern', 'SSR'),
    ('other_shooting_gallery', 'SSR'),
    ('other_milky_way', 'LR')
  ),
  lv5_counts as (
    select
      item_id,
      case rarity
        when 'R'   then 90
        when 'SR'  then 40
        when 'SSR' then 26
        when 'UR'  then 15
        when 'LR'  then 8
        when 'MR'  then 6
        -- N はスキルレベル対象外なのでここには来ない
      end as target_count
    from item_rarities
    where rarity <> 'N'
  )
  insert into public.user_gacha_items (user_id, item_id, count)
  select v_user_id, item_id, target_count
  from lv5_counts
  on conflict (user_id, item_id) do update
    set count = greatest(public.user_gacha_items.count, excluded.count),
        updated_at = now();

  raise notice '「管理用」(user_id=%) の全アイテムのスキルレベルをLv5にしました', v_user_id;
end $$;
