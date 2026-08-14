-- 食べものNレアアイテム5種（図鑑/ガチャ）の追加に合わせて、DB側の重複返却判定へ追加する。
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
      'food_roasted_sweet_potato', 'food_honey_butter_toast'
    ) then 'N'
    when p_item_id in (
      'toy_duck_plush', 'toy_carrot', 'toy_frisbee', 'toy_soccer_ball',
      'toy_taiyaki_plush', 'toy_bear_plush', 'food_paw_bowl',
      'food_paw_pudding', 'food_paw_melon_bread'
    ) then 'R'
    when p_item_id in (
      'toy_treasure_puzzle', 'toy_frenchie_plush', 'toy_meat', 'toy_frenchie_cushion',
      'toy_paw_macaron', 'toy_star_wan_wand',
      'interior_sleepy_moon', 'interior_spring_flower_wreath',
      'other_sparkle_rope_crown',
      'food_strawberry_roll_cake', 'food_paw_cupcake'
    ) then 'SR'
    when p_item_id in (
      'toy_rainbow_ball', 'toy_golden_crown_ball',
      'hiking_frenchie', 'snow_frenchie', 'summer_frenchie',
      'other_nakayoshi_azubee', 'other_kamunayo'
    ) then 'SSR'
    when p_item_id in (
      'interior_anball', 'other_azubee', 'other_omojii',
      'interior_kinoko_azubee', 'other_komochi', 'other_azuki', 'other_kobee'
    ) then 'UR'
    else null
  end;
$$;
