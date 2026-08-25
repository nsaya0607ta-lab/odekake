-- シリーズ限定の犬スキン3種(hiking/snow/summer_frenchie)をSSRからLRに変更する。
-- あわせて、gacha_rarity_for_item() に元々LR判定が無く、既存のLR景品
-- (interior_shikkoku_no_ar, interior_ragby_ar, other_listen_to_the_a, other_okaeri)
-- が重複時コイン還元の対象外(0コイン)になっていた不整合も、この機会に直す。
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
      'toy_beach_ball', 'toy_bug_net', 'food_watermelon', 'food_ramune', 'food_popsicle'
    ) then 'N'
    when p_item_id in (
      'toy_duck_plush', 'toy_carrot', 'toy_frisbee', 'toy_soccer_ball',
      'toy_taiyaki_plush', 'toy_bear_plush', 'food_paw_bowl',
      'food_paw_pudding', 'food_paw_melon_bread',
      'toy_water_gun', 'food_shaved_ice', 'food_somen', 'interior_sudare',
      'accessory_straw_hat', 'accessory_sunglasses', 'other_cotton_candy'
    ) then 'R'
    when p_item_id in (
      'toy_treasure_puzzle', 'toy_frenchie_plush', 'toy_meat', 'toy_frenchie_cushion',
      'toy_paw_macaron', 'toy_star_wan_wand',
      'interior_sleepy_moon', 'interior_spring_flower_wreath',
      'other_sparkle_rope_crown',
      'food_strawberry_roll_cake', 'food_paw_cupcake',
      'accessory_jinbei', 'other_sparkler'
    ) then 'SR'
    when p_item_id in (
      'toy_rainbow_ball', 'toy_golden_crown_ball',
      'other_nakayoshi_azubee', 'other_kamunayo', 'other_goldfish_scoop',
      'interior_beach_parasol'
    ) then 'SSR'
    when p_item_id in (
      'interior_anball', 'other_azubee', 'other_omojii',
      'interior_kinoko_azubee', 'other_komochi', 'other_azuki', 'other_kobee',
      'toy_fireworks_set'
    ) then 'UR'
    when p_item_id in (
      'hiking_frenchie', 'snow_frenchie', 'summer_frenchie',
      'interior_shikkoku_no_ar', 'interior_ragby_ar',
      'other_listen_to_the_a', 'other_okaeri'
    ) then 'LR'
    else null
  end;
$$;

create or replace function public.gacha_duplicate_coin_for_rarity(p_rarity text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_rarity
    when 'N' then 5
    when 'R' then 10
    when 'SR' then 20
    when 'SSR' then 30
    when 'UR' then 50
    when 'LR' then 80
    else 0
  end;
$$;
