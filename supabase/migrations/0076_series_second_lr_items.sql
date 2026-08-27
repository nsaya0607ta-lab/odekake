-- 各シリーズ（登山・雪国・夏）に、犬スキンとは別のLR景品を1つずつ追加する。
create or replace function public.gacha_rarity_for_item(p_item_id text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_item_id in (
      'toy_colorful_ball', 'toy_rope', 'toy_bone', 'toy_squeaky_ball',
      'toy_tennis_ball', 'toy_red_slipper', 'toy_wood_stick', 'toy_donut_rope',
      'food_smile_onigiri',
      'food_paw_taiyaki', 'food_dog_milk', 'food_cheese_cubes',
      'food_roasted_sweet_potato', 'food_honey_butter_toast',
      'toy_beach_ball', 'toy_bug_net', 'food_watermelon', 'food_ramune', 'food_popsicle',
      'toy_yoyo_scoop', 'toy_bubbles', 'toy_water_balloon', 'food_grilled_corn', 'interior_uchiwa',
      'toy_sled', 'toy_snowman_kit', 'toy_snowball',
      'food_snow_roasted_sweet_potato', 'food_oshiruko',
      'interior_yutanpo', 'accessory_knit_hat', 'accessory_muffler',
      'toy_hiking_stick', 'toy_rock_ball', 'toy_echo_whistle', 'food_ume_onigiri',
      'food_hut_curry', 'interior_led_lantern',
      'accessory_bear_bell', 'accessory_hiking_backpack'
    ) then 'N'
    when p_item_id in (
      'toy_duck_plush', 'toy_carrot', 'toy_frisbee', 'toy_soccer_ball',
      'toy_taiyaki_plush', 'toy_bear_plush', 'food_paw_bowl',
      'food_paw_pudding', 'food_paw_melon_bread',
      'toy_water_gun', 'food_shaved_ice', 'food_somen', 'interior_sudare',
      'accessory_straw_hat', 'accessory_sunglasses', 'other_cotton_candy',
      'toy_watermelon_bat', 'food_takoyaki', 'food_melon_soda', 'food_fruit_punch',
      'food_hiyashi_chuka', 'accessory_beach_sandals', 'accessory_shell_bracelet',
      'toy_mini_skis', 'food_oden', 'food_hot_chocolate',
      'interior_fluffy_blanket', 'accessory_mittens', 'other_icicle',
      'toy_rope_swing', 'food_onsen_tamago', 'food_summit_cup_ramen', 'interior_campfire_set',
      'accessory_trekking_poles', 'other_trail_map_compass'
    ) then 'R'
    when p_item_id in (
      'toy_treasure_puzzle', 'toy_frenchie_plush', 'toy_meat', 'toy_frenchie_cushion',
      'toy_paw_macaron', 'toy_star_wan_wand',
      'interior_sleepy_moon', 'interior_spring_flower_wreath',
      'other_sparkle_rope_crown',
      'food_strawberry_roll_cake', 'food_paw_cupcake',
      'accessory_jinbei', 'other_sparkler',
      'interior_mosquito_coil', 'interior_hammock', 'accessory_yukata_kanzashi',
      'interior_kerosene_stove', 'other_snowflake_ornament', 'accessory_fluffy_boots',
      'interior_hut_fireplace', 'accessory_hiking_pin_hat', 'other_cairn'
    ) then 'SR'
    when p_item_id in (
      'toy_rainbow_ball', 'toy_golden_crown_ball',
      'other_nakayoshi_azubee', 'other_kamunayo', 'other_goldfish_scoop',
      'interior_beach_parasol', 'other_lantern', 'other_shooting_gallery',
      'interior_kotatsu', 'other_snow_lantern',
      'interior_stargazing_telescope', 'other_sunrise_view'
    ) then 'SSR'
    when p_item_id in (
      'interior_anball', 'other_azubee', 'other_omojii',
      'interior_kinoko_azubee', 'other_komochi', 'other_azuki', 'other_kobee',
      'toy_fireworks_set',
      'other_kamakura', 'other_sea_of_clouds'
    ) then 'UR'
    when p_item_id in (
      'hiking_frenchie', 'snow_frenchie', 'summer_frenchie',
      'interior_shikkoku_no_ar', 'interior_ragby_ar',
      'other_listen_to_the_a', 'other_okaeri',
      'other_rock_ptarmigan', 'other_diamond_dust', 'other_milky_way'
    ) then 'LR'
    else null
  end;
$$;
