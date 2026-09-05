"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";
import { MAX_SKILL_LEVEL } from "@/lib/gacha/skill-levels";
import { COLLECTION_ITEMS, type CollectionItem } from "@/lib/collection/items";
import { DAMBOURLE_PRIZES, EFFECT_ROULETTE_ELIGIBLE_EFFECT_KEYS, type DambourleEffectKey } from "@/lib/dambourle/prizes";
import { getDambourleEffectLevel } from "@/lib/dambourle/skill-levels";

export type FrenchieCatchItem = {
  id: string;
  name: string;
  image: string;
  rarity: "N" | "R" | "SR" | "SSR" | "UR" | "LR" | "MR";
  /** スキルレベル(1〜5)。Nや未所持は0。user_gacha_items.countから判定済みの値を渡す。 */
  level: number;
};

type Entity = {
  id: number;
  itemId: string | null;
  kind: "dog" | "item";
  name: string;
  image: string;
  rarity: FrenchieCatchItem["rarity"] | null;
  level: number;
  x: number;
  y: number;
  /** 生成時のx/y（%）。position:absoluteのleft/topはこの値で固定し、以後の移動はtransformのtranslateだけで表す */
  spawnX: number;
  spawnY: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  status: "falling" | "bounced" | "caught";
  rimChecked: boolean;
  enteredOpening: boolean;
  ttl: number;
};

type CatchFeedback = {
  name: string;
  points: number;
  effect?: string;
};

type RecentSkillEffect = {
  id: number;
  text: string;
};

const ROUND_SECONDS = 50;
/** 時間増加系スキルの複利的な伸びが稀に極端化した場合の安全弁。この秒数を超えては延長しない */
const MAX_ROUND_SECONDS = 1800;
const BOX_IMAGE = "/4EA485D9-BB37-47F3-97F0-111CF0E4AF7E.webp";
const BOX_WIDTH = 37.8 * 0.9;
const BOX_HALF = BOX_WIDTH / 2;
const BOX_HEIGHT = BOX_WIDTH * 0.75;
const BOX_BOTTOM = 0.5;
const BOX_TOP = 100 - BOX_BOTTOM - BOX_HEIGHT;
const OPEN_TOP_LOCAL_Y = 0.17;
const OPEN_BOTTOM_LOCAL_Y = 0.48;
const CATCH_START_LOCAL_Y = 0.36;
const BOX_OPEN_TOP_Y = BOX_TOP + BOX_HEIGHT * OPEN_TOP_LOCAL_Y;
const BOX_LIP_Y = BOX_TOP + BOX_HEIGHT * OPEN_BOTTOM_LOCAL_Y;
const BOX_WIDE_SCALE_DEFAULT = 1.5;
const BOX_WIDE_SCALE_STRONG = 1.5;
const MAGNET_WEAK_RANGE = 14;
const MAGNET_WEAK_PULL = 16;
const MAGNET_MEDIUM_RANGE = 20;
const MAGNET_MEDIUM_PULL = 30;
const MAGNET_STRONG_RANGE = 28;
const MAGNET_STRONG_PULL = 48;
/**
 * ピンクオモ：既存のマグネットと違い範囲制限なしで全アイテムを段ボールの中心軸へ引き寄せる。
 * 速度に力を加算する方式（マグネットと同じ）だと中心を通り過ぎては戻りを繰り返す「うにょうにょ」
 * した往復振動になるため、ピンクオモは指数減衰イージングでx座標を直接中心へ寄せ、
 * 十分近づいたらピタッと止めて中心軸に固定する（vxは使わない）。値は1秒あたりの収束の速さ。
 */
const PINK_OMO_SNAP_RATE = 8;
/** この距離未満まで中心へ寄ったら、以後は中心軸ぴったりに固定する（%幅基準） */
const PINK_OMO_SNAP_EPSILON = 0.15;
const FALL_SPEED_BOOST = 1.7;
const UR_BOOST_MAX = 10;
/** 虹色わんこボールのUR加算は永続だと時間増加系との複利で発散しやすいため、時間経過で自然に減衰させる */
const UR_BOOST_DECAY_STEP = 1;
const UR_BOOST_DECAY_INTERVAL_MS = 650;
const POOP_ITEM_ID = "hazard_poop";
const POOP_IMAGE = "/collection/items/dog-poop.webp";
const POOP_SPAWN_CHANCE = 0.04;
const POOP_PENALTY = 500;
const MYSTERY_ITEM_ID = "mystery_item";
const MYSTERY_IMAGE = "/collection/items/mystery-question.webp";
const MYSTERY_SPAWN_CHANCE = 0.05;
const MYSTERY_BASE_POINTS = 20;
const IKEA_PT_PER_ITEM = 90;
/** /api/coins/item-catch のMAX_BONUS_COINS(10000)と一致させる。超えるとリクエスト自体が400で失敗するため必ず送信前にクランプする */
const MAX_BONUS_COINS_CLIENT = 10000;
const BAG_ITEM_ID = "hazard_bag";
const BAG_IMAGE = "/collection/items/plastic-bag.webp";
const BAG_SPAWN_CHANCE = 0.03;
const BAG_MAX_STOCK = 3;
const TIME_MINUS_ITEM_ID = "hazard_time_minus";
const TIME_MINUS_IMAGE = "/collection/items/hazard-time-minus.webp";
/** 基準の出現ウェイトを100とした場合の重み。60秒経過後はTIME_MINUS_BOOSTED_WEIGHT(300)相当に上がる */
const TIME_MINUS_BASE_WEIGHT = 100;
const TIME_MINUS_BOOSTED_WEIGHT = 300;
const TIME_MINUS_BOOST_AFTER_SEC = 60;
const TIME_MINUS_SPAWN_CHANCE = 0.015;
const TIME_MINUS_SECONDS = 3;
const TIME_MINUS_FALL_SPEED = 3.5;
const BOX_SHRINK_ITEM_ID = "hazard_box_shrink";
const BOX_SHRINK_IMAGE = "/collection/items/hazard-box-shrink.webp";
const BOX_SHRINK_SPAWN_CHANCE = 0.02;
const BOX_SHRINK_SCALE = 0.8;
const BOX_SHRINK_SECONDS = 3;
const BLACKOUT_ITEM_ID = "hazard_blackout_squid";
const BLACKOUT_IMAGE = "/collection/items/hazard-blackout-squid.webp";
const BLACKOUT_SPAWN_CHANCE = 0.01;
const BLACKOUT_SECONDS = 3;
const STUN_ITEM_ID = "hazard_stun_battery";
const STUN_IMAGE = "/collection/items/hazard-stun-battery.webp";
const STUN_SPAWN_CHANCE = 0.02;
const STUN_SECONDS = 1;
const CHOCOLATE_ITEM_ID = "hazard_chocolate_instant_end";
const CHOCOLATE_IMAGE = "/collection/items/hazard-chocolate-instant-end.webp";
/** 出現確率そのものを直接指定（0.20%） */
const CHOCOLATE_SPAWN_CHANCE = 0.002;
const NEGATIVE_HAZARD_IDS = new Set([TIME_MINUS_ITEM_ID, BOX_SHRINK_ITEM_ID, BLACKOUT_ITEM_ID, STUN_ITEM_ID, CHOCOLATE_ITEM_ID]);
const SPAWN_INTERVAL_MIN_MS = 650;
const SPAWN_INTERVAL_MAX_MS = 780;
/**
 * アイテムの降ってくる量を2倍にするため、通常のスポーンタイマーと全く同じ間隔で
 * もう1系統「ボーナス出現」タイマーを並走させる（Clawdのボールと同じ独立タイマー方式）。
 *
 * 単純にspawnRate計算へ一律の倍率を掛ける方式も試したが、時間増加系8種の重みを
 * 「1/倍率」で相殺する近似では誤差を完全には消せず、プレイ時間の期待値がLv3以降
 * わずかに水増しされ続けて指数的に膨らみ、ラウンドが実質終了しなくなる不具合が
 * 発生した（元々r値が1に近い際どいバランスだったため、小さな誤差でも致命的だった）。
 * ボーナス出現タイマーは時間増加系8種（TIME_BONUS_ITEM_IDS）と、時間増加系を含む
 * 夏のフレブルスキン・？アイテムを一切対象にしないことで、既存のスポーンタイマーの
 * 挙動（＝時間増加系の取得ペース）を寸分変えずに、それ以外のアイテム量だけを厳密に
 * 2倍にする。
 */
/** うんち祭り中の出現レート倍率（通常の4倍の頻度で降ってくる） */
const POOP_FLOOD_SPAWN_RATE = 4;
/** ボーナス出現タイマーを並走させて出現量を底上げした分、同時出現数の上限も合わせて緩めている */
const NORMAL_ENTITY_CAP = 20;
const DOUBLE_ENTITY_CAP = 30;
const TRIPLE_ENTITY_CAP = 36;
type HazardGuardKind = "stun" | "boxShrink" | "timeMinus";
const HAZARD_GUARD_KINDS: readonly HazardGuardKind[] = ["stun", "boxShrink", "timeMinus"];
const HAZARD_GUARD_LABELS: Record<HazardGuardKind, string> = {
  stun: "しびれ防止",
  boxShrink: "ダンボール縮小防止",
  timeMinus: "時間減少防止",
};
/** ガードのアイコンは対応するハザード自体の画像を流用する */
const HAZARD_GUARD_IMAGES: Record<HazardGuardKind, string> = {
  stun: "/collection/items/hazard-stun-battery.webp",
  boxShrink: "/collection/items/hazard-box-shrink.webp",
  timeMinus: "/collection/items/hazard-time-minus.webp",
};
const JUST_RADIUS_RATIO = 0.3;
const JUST_MULTIPLIER = 1.25;
const MYSTERY_SKILL_ITEM_IDS = [
  "toy_soccer_ball", "toy_taiyaki_plush", "toy_bear_plush", "toy_duck_plush", "toy_carrot",
  "toy_frisbee", "food_paw_bowl", "toy_meat", "toy_frenchie_cushion", "toy_treasure_puzzle",
  "toy_frenchie_plush", "toy_rainbow_ball", "toy_golden_crown_ball", "interior_anball", "interior_stretch_rod",
  "other_azubee", "other_omojii", "other_omoi_bashira", "food_paw_pudding", "food_paw_melon_bread", "food_paw_cupcake",
  "toy_paw_macaron", "food_strawberry_roll_cake", "toy_star_wan_wand", "interior_sleepy_moon",
  "interior_spring_flower_wreath", "other_sparkle_rope_crown", "other_nakayoshi_azubee",
  "other_kamunayo", "hiking_frenchie", "snow_frenchie", "summer_frenchie", "interior_kinoko_azubee",
  "other_komochi", "other_azuki", "other_kobee", "other_hamigaki", "other_ikea", "other_orusuban",
  "other_pondeomo", "other_pondear", "other_kurumari_a", "other_jare_a", "other_ketsunade_a", "other_omochi_janai", "other_oyasumi", "other_nisoku_a",
  "interior_shikkoku_no_ar", "interior_ragby_ar", "other_oyatsu_no_jikan", "other_listen_to_the_a", "other_okaeri",
  "food_fruit_basket", "interior_gold_ball", "other_clawd", "food_kamikami", "food_mocchurin", "other_mah",
  "other_mirror_omochi", "other_toorematen", "other_hia", "other_pink_omo",
];

/** アイテムごとのLv1〜5パラメータ（item_skill_levels_colored.xlsxの「スキル一覧」シート通り） */
const LV = {
  DUCK_SEC: [1, 3, 4, 5, 6, 6.94, 7.88, 8.81, 9.75, 10.69],
  CARROT_SEC: [1, 3, 4, 5, 6, 6.94, 7.88, 8.81, 9.75, 10.69],
  FRISBEE_MULT: [2, 2.2, 2.4, 2.7, 3, 3.19, 3.38, 3.56, 3.75, 3.94],
  SOCCER_PT: [15, 23, 30, 45, 60, 68.44, 76.88, 85.31, 93.75, 102.19],
  TAIYAKI_PT: [8, 11, 15, 20, 23, 25.81, 28.63, 31.44, 34.25, 37.06],
  BEAR_PT: [0, 15, 0, 30, 0, 0, 0, 0, 0, 0],
  BOWL_PT: [8, 11, 15, 20, 23, 25.81, 28.63, 31.44, 34.25, 37.06],
  PUDDING_PT: [23, 30, 45, 60, 75, 84.75, 94.5, 104.25, 114, 123.75],
  MELON_SEC: [1, 3, 4, 5, 6, 6.94, 7.88, 8.81, 9.75, 10.69],
  MELON_PT: [8, 15, 23, 30, 45, 51.94, 58.88, 65.81, 72.75, 79.69],
  TREASURE_LOW: [38, 45, 60, 75, 90, 99.75, 109.5, 119.25, 129, 138.75],
  TREASURE_HIGH: [75, 98, 120, 150, 195, 217.5, 240, 262.5, 285, 307.5],
  TREASURE_SEC: [1, 5, 6, 7, 8, 9.31, 10.63, 11.94, 13.25, 14.56],
  TREASURE_STREAK_PCT: [20, 25, 30, 35, 40, 43.75, 47.5, 51.25, 55, 58.75],
  FRENCHIE_PLUSH_COUNT: [3, 3, 4, 4, 5, 6, 6, 7, 7, 7],
  FRENCHIE_PLUSH_PT: [15, 20, 23, 30, 38, 42.31, 46.63, 50.94, 55.25, 59.56],
  MEAT_MULT: [1.1, 1.3, 1.5, 1.7, 1.9, 2.05, 2.2, 2.35, 2.5, 2.65],
  CUSHION_PT: [45, 60, 75, 98, 120, 134.06, 148.13, 162.19, 176.25, 190.31],
  MACARON_SEC: [3, 4, 5, 6, 8, 8.94, 9.88, 10.81, 11.75, 12.69],
  STARWAND_MULT: [2, 2.3, 2.6, 3, 3.5, 3.78, 4.06, 4.34, 4.63, 4.91],
  STRAWBERRY_COUNT: [1, 1, 1, 2, 2, 3, 3, 3, 3, 3],
  STRAWBERRY_MULT: [1.5, 1.7, 2, 2, 2.5, 2.69, 2.88, 3.06, 3.25, 3.44],
  CUPCAKE_SEC: [4, 5, 6, 7, 10, 11.13, 12.25, 13.38, 14.5, 15.63],
  SPRING_MULT: [1.1, 1.3, 1.5, 1.7, 1.9, 2.05, 2.2, 2.35, 2.5, 2.65],
  SPARKLE_SEC: [4, 5, 6, 8, 10, 11.13, 12.25, 13.38, 14.5, 15.63],
  SPARKLE_STRENGTH: ["weak", "weak", "weak", "weak", "medium"] as const,
  RAINBOW_STEP: [2, 5, 7, 8, 9, 10.31, 11.63, 12.94, 14.25, 15.56],
  GOLDEN_COUNT: [2, 2, 3, 3, 4, 5, 5, 6, 6, 6],
  GOLDEN_MULT: [2, 2.2, 2.2, 2.5, 2.5, 2.59, 2.69, 2.78, 2.88, 2.97],
  NAKAYOSHI_PT: [45, 60, 75, 98, 120, 134.06, 148.13, 162.19, 176.25, 190.31],
  KAMUNAYO_SEC: [5, 6, 8, 10, 13, 14.5, 16, 17.5, 19, 20.5],
  KAMUNAYO_MULT: [1.2, 1.4, 1.6, 1.8, 2.0, 2.15, 2.3, 2.45, 2.6, 2.75],
  HIKING_SEC: [5, 6, 7, 9, 12, 13.31, 14.63, 15.94, 17.25, 18.56],
  SNOW_SEC: [5, 6, 7, 9, 12, 13.31, 14.63, 15.94, 17.25, 18.56],
  SUMMER_ADD: [2, 5, 7, 8, 9, 10.31, 11.63, 12.94, 14.25, 15.56],
  SUMMER_MULT: [1.3, 1.6, 1.9, 2.2, 2.5, 2.73, 2.95, 3.18, 3.4, 3.63],
  ANBALL_PT: [150, 188, 225, 270, 330, 363.75, 397.5, 431.25, 465, 498.75],
  ANBALL_SEC: [2, 5, 7, 8, 9, 10.31, 11.63, 12.94, 14.25, 15.56],
  STRETCH_ROD_MULT: [0.5, 0.4, 0.3, 0.2, 0.1, 0.05, 0.05, 0.05, 0.05, 0.05],
  LISTEN_DOG_COUNT: [10, 15, 20, 25, 30, 34, 38, 42, 45, 49],
  AZUBEE_MULT: [1.2, 1.5, 1.8, 2.1, 2.4, 2.63, 2.85, 3.08, 3.3, 3.53],
  OMOJII_SEC: [3, 10, 11, 13, 14, 16.06, 18.13, 20.19, 22.25, 24.31],
  OMOJII_PT: [45, 68, 90, 120, 150, 169.69, 189.38, 209.06, 228.75, 248.44],
  KINOKO_SEC: [6, 7, 8, 10, 12, 13.13, 14.25, 15.38, 16.5, 17.63],
  KINOKO_FALL: [1.7, 1.8, 1.9, 2, 2.2, 2.29, 2.39, 2.48, 2.58, 2.67],
  KINOKO_SCORE: [1.2, 1.5, 1.8, 2.1, 2.4, 2.63, 2.85, 3.08, 3.3, 3.53],
  KOMOCHI_COUNT: [5, 5, 6, 7, 8, 9, 10, 10, 11, 11],
  KOMOCHI_MULT: [2, 2.1, 2.2, 2.3, 2.5, 2.59, 2.69, 2.78, 2.88, 2.97],
  AZUKI_SEC: [2, 8, 9, 10, 11, 12.69, 14.38, 16.06, 17.75, 19.44],
  AZUKI_PT: [75, 98, 120, 150, 195, 217.5, 240, 262.5, 285, 307.5],
  KOBEE_PT: [75, 98, 120, 150, 195, 217.5, 240, 262.5, 285, 307.5],
  KOBEE_MULT: [1.2, 1.5, 1.8, 2.1, 2.4, 2.63, 2.85, 3.08, 3.3, 3.53],
  HAMIGAKI_SEC: [0, 2, 3, 4, 5, 5.94, 6.88, 7.81, 8.75, 9.69],
  HAMIGAKI_PT: [0, 0, 15, 23, 30, 35.63, 41.25, 46.88, 52.5, 58.13],
  IKEA_SEC: [4, 5, 6, 7, 8, 8.75, 9.5, 10.25, 11, 11.75],
  ORUSUBAN_SEC: [5, 6, 7, 8, 10, 10.94, 11.88, 12.81, 13.75, 14.69],
  ORUSUBAN_FALL: [1.8, 2, 2.2, 2.4, 2.8, 2.99, 3.18, 3.36, 3.55, 3.74],
  PONDEOMO_SEC: [4, 5, 6, 8, 10, 11.13, 12.25, 13.38, 14.5, 15.63],
  PONDEOMO_SPAWN: [1.5, 1.625, 1.75, 1.875, 2, 2.09, 2.19, 2.28, 2.38, 2.47],
  PONDEAR_SEC: [4, 5, 6, 8, 10, 11.13, 12.25, 13.38, 14.5, 15.63],
  PONDEAR_SPAWN: [1.5, 1.625, 1.75, 1.875, 2, 2.09, 2.19, 2.28, 2.38, 2.47],
  JARE_A_SEC: [4, 5, 6, 8, 10, 11.13, 12.25, 13.38, 14.5, 15.63],
  JARE_A_SPAWN: [1.5, 1.625, 1.75, 1.875, 2, 2.09, 2.19, 2.28, 2.38, 2.47],
  SHIKKOKU_SEC: [8, 10, 12, 15, 20, 22.25, 24.5, 26.75, 29, 31.25],
  SHIKKOKU_FALL: [2, 2.2, 2.4, 2.6, 3, 3.19, 3.38, 3.56, 3.75, 3.94],
  SHIKKOKU_MULT: [1.3, 1.6, 1.9, 2.2, 2.5, 2.73, 2.95, 3.18, 3.4, 3.63],
  RAGBY_SEC: [5, 6, 7, 9, 12, 13.31, 14.63, 15.94, 17.25, 18.56],
  RAGBY_SPAWN: [2, 2.25, 2.5, 2.75, 3, 3.19, 3.38, 3.56, 3.75, 3.94],
  OYATSU_PT: [270, 300, 330, 360, 420, 448.13, 476.25, 504.38, 532.5, 560.63],
  KETSUNADE_SEC: [4, 5, 6, 8, 10, 11.13, 12.25, 13.38, 14.5, 15.63],
  BUREBUR_SEC: [20, 23, 26, 29, 32, 34.25, 36.5, 38.75, 41, 43.25],
  XMAS_SEC: [6, 7, 9, 10, 12, 13.13, 14.25, 15.38, 16.5, 17.63],
  XMAS_FALL: [1.8, 2, 2.2, 2.4, 2.5, 2.63, 2.76, 2.89, 3.03, 3.16],
  XMAS_SCORE: [1.5, 1.9, 2.3, 2.7, 3.1, 3.4, 3.7, 4, 4.3, 4.6],
  XMAS_SPAWN: [1.5, 1.75, 2, 2.25, 2.5, 2.69, 2.88, 3.06, 3.25, 3.44],
  XMAS_DOG_COUNT: [5, 6, 7, 8, 9, 10, 11, 12, 12, 13],
  OMOCHI_SEC: [4, 5, 6, 8, 10, 11.13, 12.25, 13.38, 14.5, 15.63],
  OMOCHI_PT: [750, 750, 750, 750, 750, 750, 750, 750, 750, 750],
  OKAERI_SEC: 3,
  OKAERI_PER_CATCH: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  OMOI_BASHIRA_SEC: [4, 5, 6, 8, 10, 11.13, 12.25, 13.38, 14.5, 15.63],
  /** おやすみ：ブラックアウト発生時はLR、発生しなかった時はSSRのランク別倍率カーブを使う */
  OYASUMI_MULT_BLACKOUT: [1.3, 1.6, 1.9, 2.2, 2.5, 2.73, 2.95, 3.18, 3.4, 3.63],
  OYASUMI_MULT_NORMAL: [1.2, 1.4, 1.6, 1.8, 2.0, 2.15, 2.3, 2.45, 2.6, 2.75],
  NISOKU_A_MULT: [1.2, 1.4, 1.6, 1.8, 2.0, 2.15, 2.3, 2.45, 2.6, 2.75],
  TREASURE_DOUBLE_MULT: [1.1, 1.3, 1.5, 1.7, 1.9, 2.05, 2.2, 2.35, 2.5, 2.65],
  FRUIT_BASKET_COUNT: [2, 3, 4, 5, 6, 7, 8, 9, 9, 10],
  GOLD_BALL_COINS: [10, 15, 20, 30, 50, 57.5, 65, 72.5, 80, 87.5],
  CLAWD_BALL_COUNT: [5, 8, 10, 12, 14, 16, 18, 20, 21, 23],
  KAMIKAMI_PT: [15, 23, 38, 53, 68, 77.94, 87.88, 97.81, 107.75, 117.69],
  MOCCHURIN_PT: [45, 68, 90, 120, 150, 169.69, 189.38, 209.06, 228.75, 248.44],
  TIME_BONUS_FALL: [6, 5.6, 5.2, 4.8, 4.5, 4.22, 3.94, 3.66, 3.38, 3.09],
  MAH_PT: [390, 420, 450, 495, 555, 585.94, 616.88, 647.81, 678.75, 709.69],
  MIRROR_SEC: [5, 6, 8, 10, 13, 14.5, 16, 17.5, 19, 20.5],
  MIRROR_INVERT_PT: [23, 30, 38, 45, 60, 66.94, 73.88, 80.81, 87.75, 94.69],
  TOOREMATEN_SEC: [4, 5, 6, 8, 10, 11.13, 12.25, 13.38, 14.5, 15.63],
  TOOREMATEN_PT: [68, 90, 120, 150, 195, 218.81, 242.63, 266.44, 290.25, 314.06],
  HIA_MULT: [6, 7, 8, 9, 10, 10.75, 11.5, 12.25, 13, 13.75],
  NARCISSIST_SEC: [20, 25, 30, 35, 40, 43.75, 47.5, 51.25, 55, 58.75],
  MAFIA_MULT: [1.1, 1.12, 1.14, 1.16, 1.18, 1.19, 1.21, 1.22, 1.24, 1.25],
  PINK_OMO_SEC: [3, 5, 7, 9, 10, 11.31, 12.63, 13.94, 15.25, 16.56],
} as const;
const SLANT_VX_BOOST = 3.5;
const POINTS: Record<FrenchieCatchItem["rarity"], number> = { N: 20, R: 40, SR: 80, SSR: 140, UR: 200, LR: 300, MR: 440 };
const RARITY_FALL_SPEED: Record<FrenchieCatchItem["rarity"], number> = { N: 1, R: 1.08, SR: 1.18, SSR: 1.32, UR: 1.5, LR: 1.75, MR: 2 };
/** 時間が増えるスキルを持つアイテムだけ、落下速度をレアリティ別倍率で上げる */
const TIME_BONUS_ITEM_IDS = new Set([
  "toy_duck_plush", "toy_carrot", "food_paw_melon_bread",
  "interior_anball", "other_omojii", "other_azuki", "summer_frenchie", "other_burebur",
]);
/**
 * UR出現率アップ・その他カテゴリ抑制・SSR/UR/LR限定出現・出現量アップを付与するアイテム。
 * いずれも「出現重みの計算式そのもの」を一時的に書き換える効果を持ち、時間増加系8種の
 * 一部はUR/otherカテゴリに属するため、これらの発動頻度が変わると時間増加系の取得ペースが
 * 間接的に揺らいでしまう（宝箱のrare_lockが時間増加系のUR勢を集中優遇して伸びやすくなる、
 * という既知の現象がTREASURE_OUTCOME_WEIGHTSのコメントにもある）。
 * ボーナス出現タイマーがこれらを引いて発動頻度を実質的に底上げしてしまうと、時間増加系の
 * 取得ペースがわずかに変わり得るため、ボーナス出現タイマーでは時間増加系8種と合わせて
 * こちらも対象外にする。
 */
const SPAWN_DYNAMICS_ITEM_IDS = new Set([
  "toy_rainbow_ball", "interior_stretch_rod", "toy_treasure_puzzle",
  "other_xmas_party", "other_pondeomo", "other_pondear", "other_jare_a", "interior_ragby_ar",
]);
/**
 * 2026-09-03、ユーザー指定で新設した4つ目のプール（通常アイテム系プール）。上記3プール・
 * Listen to the a-/ナルシストアー/マフィアー（単独チューニング枠）以外の、特殊効果を持たない
 * 「通常アイテム」全61種（得点のみ・演出のみ含む）が対象。新設時点ではいずれも
 * `DEFAULT_ITEM_SPAWN_WEIGHT`と同値の100のままなので、導入によるプレイ時間・スコアへの
 * 影響はゼロ。重みの決め方・新アイテム追加時の手順、対象アイテムのID一覧は
 * `ITEM_SPAWN_WEIGHTS`直上のコメント・実体、および`scripts/simulate-item-catch.mjs`の
 * `NORMAL_ITEM_IDS`（手動同期）を参照（ゲームロジック側でこの分類を参照する処理は無いため、
 * この定義自体はここには置かない）。
 */
const TREASURE_ITEM_ID = "toy_treasure_puzzle";
const TREASURE_FALL_SPEED = 4;
const POOP_FLOOD_FALL_SPEED = 2;
const TREASURE_POOP_FLOOD_COUNT = 10;
const DOG_FLOOD_ITEM_ID = "other_listen_to_the_a";
const DOG_FLOOD_SPAWN_RATE = 4;
const DOG_FLOOD_FALL_SPEED = 2.5;
const TREASURE_MINUS5_SEC = 5;
/**
 * 得点倍率スキル（肉/宝箱item_double/Xmas Party/あずびー/はるいろフラワーリース/おやすみ/
 * かむなよ/夏のフレブル/きのこあずびー/こびー/漆黒のアー/二足アー）は、2026-09-01に
 * レアリティ別の統一カーブ（R:1.1〜0.1刻み、SR:1.1〜0.2、SSR:1.2〜0.2、UR:1.2〜0.3、
 * LR:1.3〜0.3、MR:1.5〜0.4）に揃えた。発動秒数は2026-09-02にレアリティ別
 * （SR:3秒/SSR:5秒/UR:6秒/LR:8秒/MR:15秒）に変更（ユーザー指定）。
 * 落下速度アップ等、別の効果と秒数を共有していたアイテム（Xmas Party/きのこあずびー/
 * 漆黒のアー）は、得点倍率の発動時間だけこの定数を使い、落下速度側は既存のLV.xxx_SECを
 * そのまま使う（両者が別々の秒数で動くようになる）。
 */
const SCORE_MULT_DURATION_SR_SEC = 3;
const SCORE_MULT_DURATION_SSR_SEC = 5;
const SCORE_MULT_DURATION_UR_SEC = 6;
const SCORE_MULT_DURATION_LR_SEC = 8;
const SCORE_MULT_DURATION_MR_SEC = 15;
/**
 * 宝箱の中身抽選（8択）。合計100、ハズレ(うんち祭り+マイナス秒)は合計20。
 * rare_lockはSSR/UR/LR以外の出現重みをゼロにするため、時間増加系のUR勢を一時的に
 * 集中優遇してしまい複利的に伸びやすい。頻度を下げてitem_doubleに振り替えた。
 */
const TREASURE_OUTCOME_WEIGHTS: { outcome: string; weight: number }[] = [
  { outcome: "low_pt", weight: 17 },
  { outcome: "high_pt", weight: 10 },
  { outcome: "time_plus", weight: 15 },
  { outcome: "poop_flood", weight: 10 },
  { outcome: "time_minus5", weight: 10 },
  { outcome: "item_double", weight: 26 },
  { outcome: "rare_lock", weight: 4 },
  { outcome: "streak_bonus", weight: 8 },
];
function rollTreasureOutcome(): string {
  const total = TREASURE_OUTCOME_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of TREASURE_OUTCOME_WEIGHTS) {
    roll -= entry.weight;
    if (roll < 0) return entry.outcome;
  }
  return TREASURE_OUTCOME_WEIGHTS[TREASURE_OUTCOME_WEIGHTS.length - 1]!.outcome;
}
const DEFAULT_ITEM_SPAWN_WEIGHT = 100;
/**
 * 出現量アップ系スキル（ぽんでおも・ぽんでアー・じゃれアー・ラグビーアー・Xmas Party）は
 * スポーン間隔そのものを割るため、有効中は時間増加系アイテムの取得率まで一緒に底上げしてしまう。
 * createEntity内のweightedItems計算で「出現量アップ中は時間増加系8種の重みを現在有効な
 * ブースト倍率で割る」1/n相殺ロジックを入れてあるため、出現量アップ側の倍率は時間増加系のr値に
 * 影響しない（詳細はdocs/minigame-time-balance.md参照）。
 *
 * 2026-08-30、「時間減少ハザードとチョコレートは避けられる（回避されうる）」という、より現実的な
 * 前提でバランスを取り直した。この前提だと、それまで理論値計算の"歯止め"になっていた
 * チョコレート即終了がなくなり、r値が1未満でも虹色わんこボールのUR加算(永続)や宝箱のレア枠確定
 * （SSR/UR/LR以外の出現を一時的にゼロにする）が作る自己強化ループのせいでLv5が発散気味になる
 * ことが判明した。そのため今回は重みだけでなく次の3点もあわせて調整した:
 * 1. 虹色わんこボールのUR加算を永続→時間経過で減衰（UR_BOOST_DECAY_STEP/INTERVAL_MS）に変更し、
 *    上限もUR_BOOST_MAX 30→10に縮小
 * 2. 宝箱の「レア枠確定出現」の出現率を15%→4%に削減（浮いた11%はitem_double(得点倍率)に付け替え）
 * 3. ブレブルのSSR/UR/LR限定カウントをBUREBUR_COUNT [5,7,9,11,13]→[2,3,3,4,5]に短縮
 * さらに時間増加系7種＋宝箱の重みも下げて、「時間減少・チョコレートを一切キャッチしない」前提で
 * Lv5の最終プレイ時間期待値の平均が概ね180秒になるよう再調整した（同条件でのシミュレーションで
 * 平均185.7秒・中央値111秒・p99が1112秒程度、暴走はしない）。
 */
const ITEM_SPAWN_WEIGHTS: Partial<Record<string, number>> = {
  /**
   * 2026-09-03、ユーザー指定で「固定重み」を全廃し、4プール共通で以下の1ルールのみに統一：
   * 各プールの合計予算 × レアリティ別ランク比率(R:30% / SR:18% / SSR:16% / UR:14% / LR:12% /
   * MR:10%、合計100%)がそのランクの予算。**そのランクに属するアイテムの人数で均等に割った値を
   * 一切丸めずそのまま書く**（個別チューニング・10の倍数丸めのどちらも行わない。ランク予算自体が
   * 割り切れない場合は小数のまま、式`予算/人数`をそのままコードに書いて計算させる）。該当アイテムが
   * 無いランクの予算はプールの合計から減らさず、「普通のフレブル」(dog)の出現重みに上乗せして
   * 消化する（TIME_BONUS_UNFILLED_RANK_DOG_WEIGHT等、DOG_SPAWN_RATIO直下のコメント参照）。
   *
   * 時間増加系プール（予算2120、おかえりを含む）：R:636÷3=212ずつ / SR:381.6(未充填→dog) /
   * SSR:339.2(未充填→dog) / UR:296.8÷3 / LR:254.4÷2=127.2ずつ(夏のフレブル/おかえり) /
   * MR:212÷1=212(ブレブル)。在籍分の実際の合計は1399.2（残り720.8は
   * `TIME_BONUS_UNFILLED_RANK_DOG_WEIGHT`でdogへ）。
   */
  other_omojii: 296.8 / 3,
  toy_duck_plush: 636 / 3,
  toy_carrot: 636 / 3,
  food_paw_melon_bread: 636 / 3,
  interior_anball: 296.8 / 3,
  other_azuki: 296.8 / 3,
  summer_frenchie: 254.4 / 2,
  other_okaeri: 254.4 / 2,
  other_burebur: 212 / 1,
  /**
   * 出現量アップ・出現制御系プール（予算900）：R:270÷1=270 / SR:162÷1=162 / SSR:144÷4=36ずつ /
   * UR:126(未充填→dog) / LR:108÷2=54ずつ / MR:90÷1=90(Xmas Party)。在籍分の実際の合計は774
   * （残り126は`SPAWN_DYNAMICS_UNFILLED_RANK_DOG_WEIGHT`でdogへ）。宝箱おやつパズル・
   * Xmas Partyもここでは個別チューニング値ではなく「ランク予算÷在籍数」のみで計算する
   * （ユーザー指定、2026-09-03〜）。ブレブルは2026-09-04に効果を秒数プラス系へ変更し、
   * 時間増加系プールへ移動した（このプールからは離籍）。
   */
  toy_rainbow_ball: 144 / 4,
  interior_stretch_rod: 270 / 1,
  toy_treasure_puzzle: 162 / 1,
  other_xmas_party: 90 / 1,
  other_pondeomo: 144 / 4,
  other_pondear: 144 / 4,
  other_jare_a: 144 / 4,
  interior_ragby_ar: 108 / 2,
  other_listen_to_the_a: 108 / 2,
  /**
   * 得点倍率系プール（予算400）：R:120(未充填→dog) / SR:72÷2=36ずつ / SSR:64÷2=32ずつ /
   * UR:56÷3 / LR:48÷2=24ずつ / MR:40÷2=20ずつ。在籍分の実際の合計は280
   * （残り120は`SCORE_MULT_UNFILLED_RANK_DOG_WEIGHT`でdogへ）。ピンクオモ・ナルシストアー・
   * マフィアーも含め、全アイテム「ランク予算÷在籍数」のみで計算する（ユーザー指定、2026-09-03〜）。
   */
  toy_meat: 72 / 2,
  interior_spring_flower_wreath: 72 / 2,
  other_kamunayo: 64 / 2,
  other_nisoku_a: 64 / 2,
  other_azubee: 56 / 3,
  interior_kinoko_azubee: 56 / 3,
  other_kobee: 56 / 3,
  interior_shikkoku_no_ar: 48 / 2,
  other_pink_omo: 48 / 2,
  other_narcissist_a: 40 / 2,
  other_mafia_a: 40 / 2,
  /**
   * 通常アイテム系プール（予算6100、在籍61種すべて等分100ずつ）：N:2400(24種) / R:700(7種) /
   * SR:900(9種) / SSR:1200(12種) / UR:700(7種) / LR:200(2種) / MR:0(未在籍)。全ランクとも
   * 予算÷在籍数=100ちょうどで割り切れるため、現状は`DEFAULT_ITEM_SPAWN_WEIGHT`と同じ値。
   * 今後このプールに新アイテムを追加する場合は、他の3プールと同じ「同ランク内で均等に重みを
   * 割り振る計算方法」（docs/item-catch-new-item-checklist.md参照）でそのランクの予算を
   * 新しい在籍数で割り直し、対象ランクの全メンバーを書き直すこと（ランク予算・プール総予算
   * 6100自体は変更しない）。これにより、このプールにどれだけアイテムを追加しても他の3プール・
   * 「普通のフレブル」(dog)の相対確率は薄まらない。MRランクに初めて追加する場合のみ、
   * 新たにMRランク予算を設定してプール総予算に加算すること（他ランクの予算はいじらない）。
   */
  toy_colorful_ball: 100,
  toy_rope: 100,
  toy_bone: 100,
  toy_squeaky_ball: 100,
  toy_tennis_ball: 100,
  toy_red_slipper: 100,
  toy_wood_stick: 100,
  toy_donut_rope: 100,
  food_smile_onigiri: 100,
  food_paw_taiyaki: 100,
  food_dog_milk: 100,
  food_cheese_cubes: 100,
  food_roasted_sweet_potato: 100,
  food_honey_butter_toast: 100,
  other_yellow_rain_boots: 100,
  accessory_red_bandana: 100,
  other_acorns: 100,
  toy_paper_airplane: 100,
  other_walk_water_bottle: 100,
  other_shiny_pinecone: 100,
  accessory_blue_handkerchief: 100,
  toy_red_balloon: 100,
  toy_sand_bucket: 100,
  accessory_walk_pouch: 100,
  toy_frisbee: 100,
  toy_soccer_ball: 100,
  toy_taiyaki_plush: 100,
  toy_bear_plush: 100,
  food_paw_bowl: 100,
  food_paw_pudding: 100,
  food_kamikami: 100,
  toy_frenchie_plush: 100,
  toy_frenchie_cushion: 100,
  toy_paw_macaron: 100,
  toy_star_wan_wand: 100,
  food_strawberry_roll_cake: 100,
  food_paw_cupcake: 100,
  food_fruit_basket: 100,
  interior_sleepy_moon: 100,
  other_sparkle_rope_crown: 100,
  toy_golden_crown_ball: 100,
  interior_gold_ball: 100,
  other_nakayoshi_azubee: 100,
  other_hamigaki: 100,
  other_ikea: 100,
  other_orusuban: 100,
  other_kurumari_a: 100,
  other_oyatsu_no_jikan: 100,
  other_ketsunade_a: 100,
  other_omochi_janai: 100,
  other_oyasumi: 100,
  other_clawd: 100,
  food_mocchurin: 100,
  other_komochi: 100,
  other_omoi_bashira: 100,
  other_mah: 100,
  other_mirror_omochi: 100,
  other_toorematen: 100,
  other_hia: 100,
  hiking_frenchie: 100,
  snow_frenchie: 100,
};
const STRETCH_ROD_ITEM_ID = "interior_stretch_rod";
const STRETCH_ROD_SECONDS = 3;
const BUREBUR_ITEM_ID = "other_burebur";
const XMAS_PARTY_ITEM_ID = "other_xmas_party";
const OMOCHI_ITEM_ID = "other_omochi_janai";
const OKAERI_ITEM_ID = "other_okaeri";
/**
 * 時間増加系8種＋おかえりは、プレイヤーの図鑑育成度（R以上アイテムのスキルLv平均）に応じた
 * 秒数を超えると出現しなくなる（？アイテムのスキル抽選からも除外される）。宝箱は対象外。
 * 平均Lv1→60秒、2→80、3→100、4→120、5→140の線形（+20秒/Lv、小数点も比例配分）。
 * 詳細はdocs/minigame-time-balance.mdの「時間増加系の出現カットオフ」節を参照。
 */
const TIME_BONUS_CUTOFF_ITEM_IDS = new Set([...TIME_BONUS_ITEM_IDS, OKAERI_ITEM_ID]);
const TIME_BONUS_CUTOFF_BASE_SEC = 60;
const TIME_BONUS_CUTOFF_STEP_SEC_PER_LEVEL = 20;
const OMOI_BASHIRA_ITEM_ID = "other_omoi_bashira";
const OYASUMI_ITEM_ID = "other_oyasumi";
const OYASUMI_SECONDS = SCORE_MULT_DURATION_SSR_SEC;
/** 50%の確率でブラックアウト演出だけ発生せず、得点倍率だけがかかる */
const OYASUMI_NO_BLACKOUT_CHANCE = 0.5;
/**
 * 得点倍率（"○秒間 ×n"系）アイテムは、効果中に重複して取得しても上書きしない。
 * 1回の取得ごとに独立したタイマー付きエントリを追加し、重なっている間は
 * すべてのエントリの倍率を掛け合わせる（5倍が重複中の2秒間は5×5=25倍、など）。
 */
type TimedMultiplierEntry = { value: number; until: number };

function addScoreMultiplier(
  ref: MutableRefObject<TimedMultiplierEntry[]>,
  now: number,
  value: number,
  durationMs: number,
) {
  ref.current.push({ value, until: now + durationMs });
}

/** 期限切れのエントリを取り除く。1つ以上削除されたら true を返す */
function pruneScoreMultipliers(ref: MutableRefObject<TimedMultiplierEntry[]>, now: number): boolean {
  const before = ref.current.length;
  if (before === 0) return false;
  ref.current = ref.current.filter((entry) => entry.until > now);
  return ref.current.length !== before;
}

/** 現在有効な得点倍率アイテムをすべて掛け合わせた値（他系統の倍率とも別途掛け合わされる） */
function getScoreMultiplierProduct(ref: MutableRefObject<TimedMultiplierEntry[]>, now: number): number {
  let product = 1;
  for (const entry of ref.current) {
    if (entry.until > now) product *= entry.value;
  }
  return product;
}

/** UI表示用：小数点第一位まで切り上げ（例: 1.21→1.3, 2→2.0） */
function formatMultiplierCeil(value: number): string {
  return (Math.ceil(value * 10) / 10).toFixed(1);
}

/**
 * 「次のN個 ×n」系（フリスビー/金の冠ボール/いちごロールケーキ/こもち）も、
 * 効果中に重ねて取ると上書きせず独立したカウントを追加する。
 * キャッチのたびに、その時点で残数が残っている全エントリの倍率を掛け合わせてから、
 * それぞれの残数を1減らす（0になったエントリは消える）。
 * これにより「次の2個×2」中にもう一度取ると、重なる区間だけ×2×2=×4になり、
 * 後続の区間は残った方の×2だけになる。
 */
type CountMultiplierEntry = { value: number; remaining: number };

function addCountMultiplier(ref: MutableRefObject<CountMultiplierEntry[]>, value: number, count: number) {
  ref.current.push({ value, remaining: count });
}

/** 現在有効なエントリの倍率を掛け合わせて返し、全エントリの残数を1減らす（このキャッチ分を消費する） */
function consumeCountMultiplierProduct(ref: MutableRefObject<CountMultiplierEntry[]>): number {
  const active = ref.current.filter((entry) => entry.remaining > 0);
  const product = active.reduce((acc, entry) => acc * entry.value, 1);
  if (active.length > 0) {
    ref.current = ref.current
      .map((entry) => (entry.remaining > 0 ? { ...entry, remaining: entry.remaining - 1 } : entry))
      .filter((entry) => entry.remaining > 0);
  }
  return product;
}

const NISOKU_A_ITEM_ID = "other_nisoku_a";
const FRUIT_BASKET_ITEM_ID = "food_fruit_basket";
const GOLD_BALL_ITEM_ID = "interior_gold_ball";
/** フルーツバスケットの効果中に降ってくる「人物の入ったキャラ」。本来のレアリティ・スキルのまま出現する */
const PERSON_CHARACTER_ITEM_IDS = ["other_omochi_janai", "other_listen_to_the_a", "other_omoi_bashira", "other_xmas_party"];
const PERSON_CHARACTER_ITEMS: CollectionItem[] = PERSON_CHARACTER_ITEM_IDS
  .map((id) => COLLECTION_ITEMS.find((entry) => entry.id === id))
  .filter((entry): entry is CollectionItem => entry != null);
/**
 * フルーツバスケットで降ってくる人物入りキャラの抽選重み。他プールと同じ
 * R:30%/SR:18%/SSR:16%/UR:14%/LR:12%/MR:10%比率（ITEM_SPAWN_WEIGHTS直上コメント参照）を流用する。
 * これまでは所持している人物入りキャラ4種（SSR/UR/LR/MR）から均等抽選していたため、
 * 最も効果の強いMR（Xmas Party：得点倍率×最大3.1＋出現量・落下速度アップ＋フレブル大量発生が同時発動）が
 * 他と同確率(25%)で頻発し、複数体連続で引くとスコアが際限なく伸びる原因になっていた。
 * ランクが上がるほど出現しにくくする比率に変更し、爆発力の強いキャラほど頻度を下げる。
 */
const PERSON_CHARACTER_RANK_WEIGHT: Partial<Record<FrenchieCatchItem["rarity"], number>> = {
  N: 30, R: 30, SR: 18, SSR: 16, UR: 14, LR: 12, MR: 10,
};
function pickPersonCharacter(pool: CollectionItem[]): CollectionItem {
  const weighted = pool.map((item) => ({ item, weight: PERSON_CHARACTER_RANK_WEIGHT[item.rarity] ?? 1 }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll < 0) return entry.item;
  }
  return weighted[weighted.length - 1]!.item;
}
const CLAWD_ITEM_ID = "other_clawd";
/** Clawdの効果中に降ってくる「サッカーボール／ゴールドボール」。本来のレアリティ・スキルのまま出現する */
const CLAWD_SOCCER_BALL_ITEM = COLLECTION_ITEMS.find((entry) => entry.id === "toy_soccer_ball") ?? null;
const CLAWD_GOLD_BALL_ITEM = COLLECTION_ITEMS.find((entry) => entry.id === "interior_gold_ball") ?? null;
/** 降ってくるボールのうちゴールドボールになる確率 */
const CLAWD_GOLD_BALL_CHANCE = 0.2;
const MOCCHURIN_ITEM_ID = "food_mocchurin";
/** Lv4(lv index=3)以降は直前に捕まえた2つ分のスキルをエコーする */
const MOCCHURIN_DOUBLE_ECHO_MIN_LV = 3;
/** 宝箱の「レア枠確定出現」効果中、このレアリティ以外のアイテムは出現しなくなる */
const HIGH_RARITY_LOCK_RARITIES = new Set<FrenchieCatchItem["rarity"]>(["SSR", "UR", "LR"]);
const OTHER_CATEGORY_ITEM_IDS = new Set(
  COLLECTION_ITEMS.filter((entry) => entry.category === "other").map((entry) => entry.id),
);
const FOOD_CATEGORY_ITEM_IDS = new Set(
  COLLECTION_ITEMS.filter((entry) => entry.category === "food").map((entry) => entry.id),
);
const DOG_SPAWN_RATIO = 0.28;
/**
 * 2026-09-03、`dogWeight`（「普通のフレブル」(dog)の出現重み）の算出式を
 * `itemPool.length（所持アイテム数）× DEFAULT_ITEM_SPAWN_WEIGHT`という近似から、
 * 実際の`itemWeightTotal`（所持アイテムの実重み合計）を使う式に変更した（ユーザー指定）。
 * 旧式は「全アイテムがDEFAULT_ITEM_SPAWN_WEIGHT(100)である」前提の近似だったため、4プール制で
 * ランク予算が固定化された後も所持アイテム数が増えるたびにdogWeightだけ増え続け、時間増加系を
 * 含む全アイテムの相対確率がわずかに薄まり続けていた（Nランクへの大量追加の検証でLv5平均-5%程度）。
 * `dogWeight = itemWeightTotal × (DOG_SPAWN_RATIO/(1-DOG_SPAWN_RATIO))`にすると、
 * `dogWeight / (dogWeight + itemWeightTotal) = DOG_SPAWN_RATIO`が常に厳密に成り立つため、
 * 未充填ランク分（下記3定数）を除けば、プール予算が変わらない限りdogの出現割合は所持アイテム数に
 * 依存せず常にDOG_SPAWN_RATIO(28%)ちょうどになる。
 *
 * 3プール（時間増加系2120・得点倍率系400・出現量アップ制御系900）はレアリティ別の固定比率
 * （R:30%/SR:18%/SSR:16%/UR:14%/LR:12%/MR:10%）でランク予算を割り当てているが、該当アイテムが
 * まだ存在しないランクの予算は消化されず余る。プールの予算を減らさないため、この余りを
 * 「普通のフレブル」(dog)の出現重みに上乗せして消化する（ITEM_SPAWN_WEIGHTS直上のコメント参照）。
 * 各値は「プール予算 − 在籍ランクの実際の重み合計」。2026-09-03、ユーザー指定で固定重みを
 * 全廃し「ランク予算÷在籍数」のみに統一したため、以下の3値も端数を丸めず正確な値にした：
 * 時間増加系: 2120−1399.2=720.8 / 得点倍率系: 400−280=120 / 出現量アップ制御系: 900−774=126。
 * 新しく未充填ランクにアイテムを追加したら、対応する定数からそのランクの予算分を差し引くこと。
 * （時間増加系のMR枠は、2026-09-04にブレブルの効果を秒数プラス系へ変更したことで新たに
 * 充填された。従来のR:636+UR:296.8+LR:254.4=1187.2に、MR:212を加えて1399.2）
 */
const TIME_BONUS_UNFILLED_RANK_DOG_WEIGHT = 2120 - 1399.2;
/** 2026-09-03、固定重み全廃・ランク予算÷在籍数のみに統一（ユーザー指定）。ITEM_SPAWN_WEIGHTS直上のコメント参照。 */
const SCORE_MULT_UNFILLED_RANK_DOG_WEIGHT = 120;
/** 2026-09-03、固定重み全廃・ランク予算÷在籍数のみに統一（ユーザー指定）。ITEM_SPAWN_WEIGHTS直上のコメント参照。 */
const SPAWN_DYNAMICS_UNFILLED_RANK_DOG_WEIGHT = 126;
/** 通れまてん有効中に「はずれ」フレブルの代わりに出現する金色フレブルの目印用id（kindは通常のdogのまま） */
const TOOREMATEN_GOLDEN_DOG_ID = "toorematen_golden_dog";
const FRENCHIE_SKIN_IDS = ["hiking_frenchie", "snow_frenchie", "summer_frenchie"];
const FRENCHIE_SKIN_SPAWN_CHANCE = 0.18;
/**
 * N/Rは同時出現数が多いため、フィルターコストを避けてdrop-shadowなしにしている。
 * SR以上は同時出現数が少ないため、見た目の演出としてdrop-shadowを維持。
 */
const RARITY_STYLE: Record<FrenchieCatchItem["rarity"], string> = {
  N: "",
  R: "",
  SR: "drop-shadow-[0_0_10px_rgba(235,180,55,0.68)]",
  SSR: "drop-shadow-[0_0_13px_rgba(177,112,220,0.78)]",
  UR: "drop-shadow-[0_0_16px_rgba(201,66,55,0.92)]",
  LR: "drop-shadow-[0_0_20px_rgba(230,180,60,0.95)]",
  MR: "drop-shadow-[0_0_22px_rgba(90,110,255,0.95)]",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function overlap(leftA: number, rightA: number, leftB: number, rightB: number) {
  return Math.max(0, Math.min(rightA, rightB) - Math.max(leftA, leftB));
}

/**
 * 時間増加系アイテムは「落下速度アップ」スキルの影響を受けず、常にスキルレベル別の固定倍率で落ちる
 * （Lv1〜5でLV.TIME_BONUS_FALLの6→5.6→5.2→4.8→4.5と、レベルが上がるほど遅くなり捕まえやすくなる）。
 * それ以外は通常どおりスキルによる落下速度アップ(boostedVy)を反映したレアリティ倍率になる。
 */
function resolveFallVy(
  rawVy: number,
  boostedVy: number,
  itemId: string,
  rarity: FrenchieCatchItem["rarity"],
  level: number,
) {
  if (itemId === TREASURE_ITEM_ID) return rawVy * TREASURE_FALL_SPEED;
  if (TIME_BONUS_ITEM_IDS.has(itemId)) {
    const lv = clamp(level || 1, 1, MAX_SKILL_LEVEL) - 1;
    return rawVy * LV.TIME_BONUS_FALL[lv]!;
  }
  return boostedVy * RARITY_FALL_SPEED[rarity];
}

/**
 * ダンボールガチャの効果（No.11「全アイテムのスキルLv上昇」を除く）を、そのダンボール自身の
 * Lv(1〜5)で拡大した実効値(%)に変換する。倍率式は
 * `src/lib/dambourle/prizes.ts`のDambourleItem.baseValuePercentコメントの通り
 * 「基礎値(%) × (1 + 0.02×(換算Lv-1))」で統一する（No.12「効果ルーレット」が引いた
 * 効果にも、その基礎値にNo.12自身のLvでこの式を適用する）。換算Lvは
 * `getDambourleEffectLevel`（新Lv1〜5→旧70段階システムのLv1/14/28/42/56）を参照。
 */
const DAMBOURLE_EFFECT_BASE_VALUE_PERCENT = new Map(
  DAMBOURLE_PRIZES.filter((prize) => prize.baseValuePercent !== null).map((prize) => [prize.effectKey, prize.baseValuePercent!]),
);

function dambourleEffectPercent(effectKey: DambourleEffectKey, level: number): number {
  const base = DAMBOURLE_EFFECT_BASE_VALUE_PERCENT.get(effectKey);
  if (base == null) return 0;
  return base * (1 + 0.02 * (getDambourleEffectLevel(level) - 1));
}

type ResolvedDambourleEffect = { key: DambourleEffectKey; percent: number };

/**
 * No.12「効果ルーレット」は対象9種から毎ラウンド開始時に1つ抽選し、そのラウンドの間だけ固定する。
 * No.11「全アイテムのスキルLv上昇」はここでは扱わない（dambourleSkillBoostプロップで別処理）。
 */
function resolveDambourleEffect(
  effect: { key: DambourleEffectKey; level: number } | null,
): ResolvedDambourleEffect | null {
  if (!effect || effect.key === "item_skill_level_up") return null;
  if (effect.key === "effect_roulette") {
    const pool = EFFECT_ROULETTE_ELIGIBLE_EFFECT_KEYS;
    const key = pool[Math.floor(Math.random() * pool.length)]!;
    return { key, percent: dambourleEffectPercent(key, effect.level) };
  }
  return { key: effect.key, percent: dambourleEffectPercent(effect.key, effect.level) };
}

/**
 * 「出現量×N」「得点×N」のような"ボーナス倍率"は、基礎値そのものではなく1を超えた
 * ボーナス分だけをupFactor(1+効果%/100)で拡大する（例: ×1.5にダンボール効果+20%なら
 * 1+0.5×1.2=×1.6。基礎値ごと1.5倍にする(×1.8)方式だと高Lvで暴走しやすいため採らない）。
 */
function scaleDambourleBonusMultiplier(rawMultiplier: number, upFactor: number): number {
  return 1 + (rawMultiplier - 1) * upFactor;
}

function openingBoundsAt(localY: number) {
  const t = clamp((localY - OPEN_TOP_LOCAL_Y) / (OPEN_BOTTOM_LOCAL_Y - OPEN_TOP_LOCAL_Y), 0, 1);
  const left = 0.145 - t * 0.055;
  const right = 0.855 + t * 0.055;
  return { left, right };
}

function isCardboardTap(localX: number, localY: number) {
  const front = localY >= 0.47 && localY <= 0.94 && localX >= 0.07 && localX <= 0.93;
  const leftSide = localY >= 0.16 && localY <= 0.50 && localX >= 0.055 && localX <= 0.18;
  const rightSide = localY >= 0.16 && localY <= 0.50 && localX >= 0.82 && localX <= 0.945;
  return front || leftSide || rightSide;
}

/**
 * 位置・回転・不透明度・z-indexはマウント後、rAFループがrefのDOM要素へ直接書き込む。
 * entity.idさえ変わらなければ再レンダリングしない（増減時のReact側の処理対象を最小化するため）。
 */
const FallingEntity = memo(function FallingEntity({
  entity,
  registerRef,
}: {
  entity: Entity;
  registerRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={registerRef}
      className={`absolute will-change-transform ${entity.rarity ? RARITY_STYLE[entity.rarity] : ""}`}
      style={{
        left: `${entity.spawnX}%`,
        top: `${entity.spawnY}%`,
        width: `${entity.size}%`,
        zIndex: entity.enteredOpening && entity.status !== "bounced" ? 40 : 20,
        transform: `translate(-50%, -50%) rotate(${entity.rotation}deg)`,
      }}
    >
      <Image src={entity.image} alt="" width={96} height={96} quality={65} draggable={false} loading="eager" className="h-auto w-full object-contain" />
      {entity.rarity === "UR" ? <span className="absolute -inset-2 -z-10 animate-pulse rounded-full bg-[#e95c4d]/15 blur-sm" /> : null}
      {entity.rarity === "LR" ? <span className="absolute -inset-3 -z-10 animate-pulse rounded-full bg-[#e6b43c]/25 blur" /> : null}
    </div>
  );
}, (prev, next) => prev.entity.id === next.entity.id);

export function FrenchieCatchGame({
  ownedItems,
  equippedBoxImage = BOX_IMAGE,
  equippedBoxAlt = "拾ってくだブーと書かれた段ボール",
  dambourleSkillBoost = 0,
  dambourleEffect = null,
  showDambourlePicker = false,
}: {
  ownedItems: FrenchieCatchItem[];
  /** プレイ前に選んだダンボールの画像。未指定なら初期無料ダンボール */
  equippedBoxImage?: string;
  equippedBoxAlt?: string;
  /**
   * ダンボールNo.11「全アイテムのスキルLv上昇」を装備しているときの、そのダンボール自身のLv(1〜5)。
   * 図鑑アイテムのスキルLv上限をこの分だけ底上げする（Lv5→最大Lv10）。未装備なら0。
   * カットオフ秒数の計算(timeBonusCutoffSecRef)には反映しない。
   */
  dambourleSkillBoost?: number;
  /** No.11以外の装備中ダンボール効果（effectKey + そのダンボール自身のLv1〜5）。未装備・No.11装備時はnull */
  dambourleEffect?: { key: DambourleEffectKey; level: number } | null;
  /** ダンボールガチャは実験公開中のため、限定ユーザーにのみ選択導線を出す */
  showDambourlePicker?: boolean;
}) {
  const router = useRouter();
  const skillLevelCap = MAX_SKILL_LEVEL + dambourleSkillBoost;
  const boardRef = useRef<HTMLDivElement | null>(null);
  const catcherRef = useRef<HTMLDivElement | null>(null);
  const entitiesRef = useRef<Entity[]>([]);
  const entityNodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  /** ボード実寸(px)。リサイズ時だけ更新し、毎フレームの座標計算はこれを参照する */
  const boardSizeRef = useRef({ w: 0, h: 0 });
  const mountedEntityIdsRef = useRef<Set<number>>(new Set());
  const draggingRef = useRef(false);
  const dragOffsetRef = useRef(0);
  const boxXRef = useRef(50);
  const nextIdRef = useRef(1);
  const startAtRef = useRef(0);
  const endAtRef = useRef(0);
  const nextSpawnRef = useRef(0);
  /** アイテム量2倍化用のボーナス出現タイマー（時間増加系を除く独立系統） */
  const extraSpawnRef = useRef(0);
  /** Clawdのボールは通常アイテムの抽選を妨げず、独立したタイマーで並行して降らせる */
  const nextClawdSpawnRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const scoreRef = useRef(0);
  const dogCaughtRef = useRef(0);
  const caughtRef = useRef(0);
  const roundIdRef = useRef<string | null>(null);
  /** 「次のN個 ×n」アイテムの有効中エントリ一覧。重複取得時は掛け合わされる */
  const nextMultipliersRef = useRef<CountMultiplierEntry[]>([]);
  const nextBonus5Ref = useRef(0);
  const nextBonus5ValueRef = useRef(5);
  const nextBonus10Ref = useRef(0);
  const nextBonus10ValueRef = useRef(10);
  const rewardTimeCountRef = useRef(0);
  const rewardTimeValueRef = useRef(0);
  const stunGuardRef = useRef(0);
  const boxShrinkGuardRef = useRef(0);
  const timeMinusGuardRef = useRef(0);
  /** 得点倍率アイテム（肉/宝箱/クリスマス/あずびー等）の有効中エントリ一覧。重複取得時は掛け合わされる */
  const scoreMultipliersRef = useRef<TimedMultiplierEntry[]>([]);
  const boxWideUntilRef = useRef(0);
  const boxWideScaleRef = useRef(BOX_WIDE_SCALE_DEFAULT);
  const magnetUntilRef = useRef(0);
  const magnetStrengthRef = useRef<"weak" | "medium" | "strong">("weak");
  /** ピンクオモ：有効中は画面にピンクフィルターがかかり、マイナスアイテム以外の全アイテムが段ボールの中心軸へ引き寄せられる */
  const pinkOmoUntilRef = useRef(0);
  const urBoostRef = useRef(0);
  const urBoostDecayNextRef = useRef(0);
  const fallSpeedBoostUntilRef = useRef(0);
  const fallSpeedValueRef = useRef(FALL_SPEED_BOOST);
  const poopSuppressUntilRef = useRef(0);
  const poopFloodRemainingRef = useRef(0);
  const ikeaUntilRef = useRef(0);
  const ikeaCountRef = useRef(0);
  const bagStockRef = useRef(0);
  const spawnRateBoostUntilRef = useRef(0);
  const spawnRateBoostValueRef = useRef(1);
  const otherSuppressUntilRef = useRef(0);
  const otherSuppressValueRef = useRef(1);
  const highRarityLockUntilRef = useRef(0);
  const treasureStreakActiveRef = useRef(false);
  const treasureStreakMultRef = useRef(1);
  const omochiUntilRef = useRef(0);
  const omochiPtValueRef = useRef(10);
  const okaeriUntilRef = useRef(0);
  const okaeriPerCatchValueRef = useRef(3);
  const hazardShieldUntilRef = useRef(0);
  /** 食べ物カテゴリ限定倍率（二足A）の有効中エントリ一覧。重複取得時は掛け合わされる */
  const foodScoreMultipliersRef = useRef<TimedMultiplierEntry[]>([]);
  const dogFloodRemainingRef = useRef(0);
  const personFloodRemainingRef = useRef(0);
  const clawdBallFloodRemainingRef = useRef(0);
  /** もっちゅりんのエコー用に、直前に捕まえたアイテムを新しい順に最大2件保持する */
  /** もっちゅりんを取った直後に捕まえるアイテムのスキルをもう一度発動する残り回数 */
  const mocchurinPendingEchoCountRef = useRef(0);
  const goldBonusCoinsRef = useRef(0);
  const slantBoostUntilRef = useRef(0);
  const boxShrinkUntilRef = useRef(0);
  const blackoutUntilRef = useRef(0);
  const stunUntilRef = useRef(0);
  /**
   * ミラーおもち：有効中はしびれ/ダンボール縮小/時間減少のマイナス効果が反転してプラスになる。
   * 時間減少の反転先も「+秒」ではなく「+pt」にしてある（プレイ時間そのものを伸ばすと
   * docs/minigame-time-balance.mdの時間バランス計算に影響するため、あえて時間には触れない設計）。
   */
  const hazardInvertUntilRef = useRef(0);
  const mirrorInvertPtValueRef = useRef(0);
  /** ナルシストアー：有効中は捕まえた全アイテムのスキルがレベル5(MAX)として発動する */
  const narcissistUntilRef = useRef(0);
  /**
   * マフィアー：ラウンド終了時のフレブル数ボーナス（dogCaughtRef × プレイ秒数）にかかる
   * 累計倍率。捕まえるたびに掛け合わされ、ラウンド中重複していく（3体で×1.1×1.1×1.1など）。
   */
  const mafiaDogBonusMultRef = useRef(1);
  /**
   * 通れまてん：有効中は「はずれ」の初期フレブル(15pt)の代わりに、より高得点な金色フレブルが
   * 同じ出現枠（dogWeight）でそのまま出現する。フレブルの出現シェア自体は変えないので、
   * 時間増加系8種の取得率やdogCaughtRef（ラウンド終了時のフレブル数ボーナス算定）には影響しない。
   */
  const dogGoldenUntilRef = useRef(0);
  const dogGoldenPtValueRef = useRef(0);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const impactTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentSkillEffectIdRef = useRef(0);
  const recentSkillEffectTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  /** 装備中ダンボール効果のプロップの最新値。startGame(deps:[])内から常に最新値を読むための橋渡し */
  const dambourleEffectPropRef = useRef(dambourleEffect);
  useEffect(() => {
    dambourleEffectPropRef.current = dambourleEffect;
  }, [dambourleEffect]);
  /** ラウンド開始時に確定した、そのラウンド中ずっと使う実効ダンボール効果（No.12はここで抽選確定） */
  const dambourleEffectRef = useRef<ResolvedDambourleEffect | null>(null);
  /** keyが一致する時だけ (1+効果%/100) を返す。一致しなければ1（無効） */
  const dambourleUpMultiplier = useCallback((key: DambourleEffectKey) => {
    const eff = dambourleEffectRef.current;
    return eff && eff.key === key ? 1 + eff.percent / 100 : 1;
  }, []);
  /** keyが一致する時だけ (1-効果%/100) を返す（マイナス方向の効果用）。0未満にはしない */
  const dambourleDownMultiplier = useCallback((key: DambourleEffectKey) => {
    const eff = dambourleEffectRef.current;
    return eff && eff.key === key ? Math.max(0, 1 - eff.percent / 100) : 1;
  }, []);

  const [phase, setPhase] = useState<"idle" | "playing" | "finished">("idle");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [boxX, setBoxX] = useState(50);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [score, setScore] = useState(0);
  const [caught, setCaught] = useState(0);
  const [bagStock, setBagStock] = useState(0);
  const [stunGuard, setStunGuard] = useState(0);
  const [boxShrinkGuard, setBoxShrinkGuard] = useState(0);
  const [timeMinusGuard, setTimeMinusGuard] = useState(0);
  const [feedback, setFeedback] = useState<CatchFeedback | null>(null);
  const [scoreMultiplierTotal, setScoreMultiplierTotal] = useState(1);
  const [recentSkillEffects, setRecentSkillEffects] = useState<RecentSkillEffect[]>([]);
  const [impactX, setImpactX] = useState<number | null>(null);
  const [boxBounce, setBoxBounce] = useState(false);
  const [blackoutActive, setBlackoutActive] = useState(false);
  const [pinkOmoActive, setPinkOmoActive] = useState(false);
  const [stunned, setStunned] = useState(false);
  const [dogBonus, setDogBonus] = useState<{ count: number; bonus: number } | null>(null);
  const [coinReward, setCoinReward] = useState<number | null>(null);
  const [rewardPending, setRewardPending] = useState(false);
  const [rewardError, setRewardError] = useState<string | null>(null);

  const itemPool = useMemo(() => ownedItems.filter((item) => item.image.length > 0), [ownedItems]);
  const itemLevelByIdRef = useRef<Map<string, number>>(new Map());
  /** 時間増加系8種＋おかえりが出現しなくなるまでの秒数。ownedItems（R以上）のスキルLv平均から算出する */
  const timeBonusCutoffSecRef = useRef(TIME_BONUS_CUTOFF_BASE_SEC);
  /** ❓アイテムが確定させるスキルの抽選プール。持っていないキャラのスキルが出ないよう、所持アイテムだけに絞る */
  const mysterySkillPoolRef = useRef<string[]>(MYSTERY_SKILL_ITEM_IDS);
  /** フルーツバスケット中に降ってくる「人物の入ったキャラ」。未所持のものは出さないよう所持アイテムだけに絞る */
  const personCharacterPoolRef = useRef<CollectionItem[]>([]);
  /** Clawd中に降ってくるサッカーボール／ゴールドボール。未所持のものは出さないよう所持アイテムだけに絞る */
  const clawdBallItemsRef = useRef<{ soccer: CollectionItem | null; gold: CollectionItem | null }>({
    soccer: null,
    gold: null,
  });
  /** 時間増加系8種＋おかえりが出現しなくなるまでの秒数（スタート画面表示用）。timeBonusCutoffSecRefと同じ計算式 */
  const timeBonusCutoffSecDisplay = useMemo(() => {
    const rPlusItems = ownedItems.filter((item) => item.rarity !== "N");
    const totalLevel = rPlusItems.reduce((sum, item) => sum + item.level, 0);
    const avgLevelRaw = rPlusItems.length > 0 ? totalLevel / rPlusItems.length : 0;
    const avgLevel = Math.round(avgLevelRaw * 100) / 100;
    return avgLevel < 1
      ? TIME_BONUS_CUTOFF_BASE_SEC
      : TIME_BONUS_CUTOFF_BASE_SEC + (Math.min(avgLevel, MAX_SKILL_LEVEL) - 1) * TIME_BONUS_CUTOFF_STEP_SEC_PER_LEVEL;
  }, [ownedItems]);
  /**
   * スタート画面表示用のカットオフ秒数。ダンボールNo.3「時間増加アップ」を直接装備している場合のみ
   * 反映する（No.12「効果ルーレット」はラウンド開始まで抽選結果が定まらないため、ここでは加味しない。
   * 実プレイ時の実効値はstartGame内でdambourleEffectRef確定後にtimeBonusCutoffSecRefへ反映する）。
   */
  const timeBonusCutoffSecDisplayWithDambourle = useMemo(() => {
    const directPercent = dambourleEffect?.key === "time_bonus_cutoff_up"
      ? dambourleEffectPercent("time_bonus_cutoff_up", dambourleEffect.level)
      : 0;
    return timeBonusCutoffSecDisplay * (1 + directPercent / 100);
  }, [timeBonusCutoffSecDisplay, dambourleEffect]);
  useEffect(() => {
    itemLevelByIdRef.current = new Map(ownedItems.map((item) => [item.id, item.level]));
    timeBonusCutoffSecRef.current = timeBonusCutoffSecDisplay;
    const ownedIds = new Set(ownedItems.map((item) => item.id));
    const pool = MYSTERY_SKILL_ITEM_IDS.filter((id) => ownedIds.has(id));
    mysterySkillPoolRef.current = pool.length > 0 ? pool : MYSTERY_SKILL_ITEM_IDS;
    personCharacterPoolRef.current = PERSON_CHARACTER_ITEMS.filter((item) => ownedIds.has(item.id));
    clawdBallItemsRef.current = {
      soccer: ownedIds.has(CLAWD_SOCCER_BALL_ITEM?.id ?? "") ? CLAWD_SOCCER_BALL_ITEM : null,
      gold: ownedIds.has(CLAWD_GOLD_BALL_ITEM?.id ?? "") ? CLAWD_GOLD_BALL_ITEM : null,
    };
  }, [ownedItems, timeBonusCutoffSecDisplay]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const measure = () => {
      boardSizeRef.current = { w: board.clientWidth, h: board.clientHeight };
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    return () => observer.disconnect();
  }, []);

  /**
   * 落下中に出現するすべての画像を先読みしてブラウザキャッシュに乗せておく。
   * これをしないと、初出現の画像はダウンロード+デコードが落下中に間に合わず
   * 「途中の位置から突然描画される」ように見える（特にモバイルで顕著）。
   */
  const preloadImages = useMemo(() => {
    const fixed = [
      POOP_IMAGE, MYSTERY_IMAGE, BAG_IMAGE, TIME_MINUS_IMAGE,
      BOX_SHRINK_IMAGE, BLACKOUT_IMAGE, STUN_IMAGE, CHOCOLATE_IMAGE, "/characters/default/front.webp",
    ];
    const dynamic = itemPool.map((item) => item.image);
    return Array.from(new Set([...fixed, ...dynamic]));
  }, [itemPool]);

  const refreshEffectStatus = useCallback((now: number) => {
    let scoreMultiplierTotalValue = 1;
    // ダンボールNo.2「スコア倍率アップ」：ラウンド中ずっと有効な固定倍率。上部「スコア倍率 ×X」に含める
    scoreMultiplierTotalValue *= dambourleUpMultiplier("score_mult_up");
    const activeScoreMultipliers = scoreMultipliersRef.current.filter((entry) => entry.until > now);
    if (activeScoreMultipliers.length > 0) {
      const product = activeScoreMultipliers.reduce((acc, entry) => acc * entry.value, 1);
      scoreMultiplierTotalValue *= product;
    }
    if (treasureStreakActiveRef.current) {
      scoreMultiplierTotalValue *= treasureStreakMultRef.current;
    }
    const activeFoodMultipliers = foodScoreMultipliersRef.current.filter((entry) => entry.until > now);
    if (activeFoodMultipliers.length > 0) {
      const product = activeFoodMultipliers.reduce((acc, entry) => acc * entry.value, 1);
      scoreMultiplierTotalValue *= product;
    }
    setScoreMultiplierTotal(scoreMultiplierTotalValue);
  }, []);

  /**
   * excludeTimeBonus: ボーナス出現タイマー（アイテム量2倍化用）からの呼び出し専用。
   * 時間増加系8種・そのスキンである夏のフレブル・？アイテム（時間増加系を引く可能性があるため）、
   * および出現重みの計算式自体を書き換えるSPAWN_DYNAMICS_ITEM_IDSを一切対象にせず、
   * 既存のスポーンタイマー側の時間増加系取得ペースを完全に不変に保つ。
   */
  const createEntity = useCallback((excludeTimeBonus = false): Entity => {
    const fallSpeedBoost = performance.now() < fallSpeedBoostUntilRef.current ? fallSpeedValueRef.current : 1;
    const slantBoost = performance.now() < slantBoostUntilRef.current ? SLANT_VX_BOOST : 1;
    const rawVy = (17 + Math.random() * 5) * 1.35;
    const spawnX = 9 + Math.random() * 82;
    const spawnY = -13 - Math.random() * 5;
    const base = {
      id: nextIdRef.current++,
      x: spawnX,
      y: spawnY,
      spawnX,
      spawnY,
      vx: (Math.random() - 0.5) * 2.4 * slantBoost,
      vy: rawVy * fallSpeedBoost,
      rotation: (Math.random() - 0.5) * 12,
      status: "falling" as const,
      rimChecked: false,
      enteredOpening: false,
      ttl: 0,
    };

    if (dogFloodRemainingRef.current > 0) {
      dogFloodRemainingRef.current -= 1;
      return {
        ...base,
        itemId: null,
        kind: "dog",
        name: "初期フレブル",
        image: "/characters/default/front.webp",
        rarity: null,
        level: 0,
        vy: rawVy * DOG_FLOOD_FALL_SPEED,
        size: 19,
        spin: (Math.random() - 0.5) * 20,
      };
    }

    if (personFloodRemainingRef.current > 0 && personCharacterPoolRef.current.length === 0) {
      personFloodRemainingRef.current = 0;
    }
    if (personFloodRemainingRef.current > 0) {
      personFloodRemainingRef.current -= 1;
      const character = pickPersonCharacter(personCharacterPoolRef.current);
      return {
        ...base,
        itemId: character.id,
        kind: "item",
        name: character.name,
        image: character.image ?? "",
        rarity: character.rarity,
        level: itemLevelByIdRef.current.get(character.id) ?? 0,
        vy: resolveFallVy(rawVy, base.vy, character.id, character.rarity, itemLevelByIdRef.current.get(character.id) ?? 1),
        size: 12.5 + Math.random() * 3.5,
        spin: (Math.random() - 0.5) * 65,
      };
    }

    if (poopFloodRemainingRef.current > 0) {
      poopFloodRemainingRef.current -= 1;
      return {
        ...base,
        itemId: POOP_ITEM_ID,
        kind: "item",
        name: "犬のうんち",
        image: POOP_IMAGE,
        rarity: null,
        level: 0,
        vy: rawVy * POOP_FLOOD_FALL_SPEED,
        size: 12 + Math.random() * 3,
        spin: (Math.random() - 0.5) * 40,
      };
    }

    const hazardRoll = Math.random();
    if (hazardRoll < POOP_SPAWN_CHANCE && performance.now() >= poopSuppressUntilRef.current) {
      return {
        ...base,
        itemId: POOP_ITEM_ID,
        kind: "item",
        name: "犬のうんち",
        image: POOP_IMAGE,
        rarity: null,
        level: 0,
        // マイナス要素のアイテムは落下速度アップ系スキルの影響を受けない
        vy: rawVy,
        size: 12 + Math.random() * 3,
        spin: (Math.random() - 0.5) * 40,
      };
    }
    /** ？アイテムは所持スキルからランダムに1つ発動するため、時間増加系を引く可能性がありボーナス出現タイマーでは除外する */
    const mysteryChance = excludeTimeBonus ? 0 : MYSTERY_SPAWN_CHANCE;
    if (hazardRoll < POOP_SPAWN_CHANCE + mysteryChance) {
      return {
        ...base,
        itemId: MYSTERY_ITEM_ID,
        kind: "item",
        name: "？アイテム",
        image: MYSTERY_IMAGE,
        rarity: null,
        level: 0,
        size: 13 + Math.random() * 3,
        spin: (Math.random() - 0.5) * 50,
      };
    }
    if (hazardRoll < POOP_SPAWN_CHANCE + mysteryChance + BAG_SPAWN_CHANCE && bagStockRef.current < BAG_MAX_STOCK) {
      return {
        ...base,
        itemId: BAG_ITEM_ID,
        kind: "item",
        name: "ビニール袋",
        image: BAG_IMAGE,
        rarity: null,
        level: 0,
        size: 13 + Math.random() * 3,
        spin: (Math.random() - 0.5) * 30,
      };
    }

    const hazardShieldActive = performance.now() < hazardShieldUntilRef.current;
    const elapsedSec = (performance.now() - startAtRef.current) / 1000;
    const timeMinusWeightFactor = elapsedSec > TIME_MINUS_BOOST_AFTER_SEC ? TIME_MINUS_BOOSTED_WEIGHT / TIME_MINUS_BASE_WEIGHT : 1;
    /** ダンボールNo.7「マイナスアイテムの出現率ダウン」：時間減少/ダンボール縮小/イカスミ/しびれ/呪いのチョコレートの5種の出現率を一律で下げる */
    const negativeSpawnDownFactor = dambourleDownMultiplier("negative_spawn_down");
    const timeMinusChance = TIME_MINUS_SPAWN_CHANCE * timeMinusWeightFactor * negativeSpawnDownFactor;
    const timeMinusThreshold = POOP_SPAWN_CHANCE + mysteryChance + BAG_SPAWN_CHANCE + timeMinusChance;
    const shrinkThreshold = timeMinusThreshold + BOX_SHRINK_SPAWN_CHANCE * negativeSpawnDownFactor;
    const blackoutThreshold = shrinkThreshold + BLACKOUT_SPAWN_CHANCE * negativeSpawnDownFactor;
    const stunThreshold = blackoutThreshold + STUN_SPAWN_CHANCE * negativeSpawnDownFactor;
    const chocolateThreshold = stunThreshold + CHOCOLATE_SPAWN_CHANCE * negativeSpawnDownFactor;
    // マイナス要素のアイテム（うんち以外）も落下速度アップ系スキルの影響を受けないよう、vyはrawVy基準にする
    if (!hazardShieldActive && hazardRoll < timeMinusThreshold) return { ...base, itemId: TIME_MINUS_ITEM_ID, kind: "item", name: "時間 -3秒", image: TIME_MINUS_IMAGE, rarity: null, level: 0, vy: rawVy * TIME_MINUS_FALL_SPEED, size: 13 + Math.random() * 3, spin: (Math.random() - 0.5) * 28 };
    if (!hazardShieldActive && hazardRoll < shrinkThreshold) return { ...base, itemId: BOX_SHRINK_ITEM_ID, kind: "item", name: "ダンボール縮小", image: BOX_SHRINK_IMAGE, rarity: null, level: 0, vy: rawVy, size: 13 + Math.random() * 3, spin: (Math.random() - 0.5) * 28 };
    if (!hazardShieldActive && hazardRoll < blackoutThreshold) return { ...base, itemId: BLACKOUT_ITEM_ID, kind: "item", name: "イカスミ", image: BLACKOUT_IMAGE, rarity: null, level: 0, vy: rawVy, size: 14 + Math.random() * 3, spin: (Math.random() - 0.5) * 22 };
    if (!hazardShieldActive && hazardRoll < stunThreshold) return { ...base, itemId: STUN_ITEM_ID, kind: "item", name: "しびれバッテリー", image: STUN_IMAGE, rarity: null, level: 0, vy: rawVy, size: 12.5 + Math.random() * 3, spin: (Math.random() - 0.5) * 30 };
    if (!hazardShieldActive && hazardRoll < chocolateThreshold) return { ...base, itemId: CHOCOLATE_ITEM_ID, kind: "item", name: "呪いのチョコレート", image: CHOCOLATE_IMAGE, rarity: null, level: 0, vy: rawVy, size: 13.5 + Math.random() * 3, spin: (Math.random() - 0.5) * 26 };

    if (itemPool.length === 0) {
      return {
        ...base,
        itemId: null,
        kind: "dog",
        name: "初期フレブル",
        image: "/characters/default/front.webp",
        rarity: null,
        level: 0,
        size: 19,
        spin: (Math.random() - 0.5) * 20,
      };
    }

    const urBoostFactor = 1 + Math.min(urBoostRef.current, UR_BOOST_MAX) / 100;
    const otherSuppressActive = performance.now() < otherSuppressUntilRef.current;
    const highRarityLockActive = performance.now() < highRarityLockUntilRef.current;
    /**
     * 出現量アップ中は時間増加系8種の重みをブースト倍率で割り、取得ペースがブーストなしの時と
     * 変わらないよう相殺する（詳細はdocs/minigame-time-balance.mdの「出現量ブーストの1/n相殺」参照）。
     * これにより出現量アップ側の倍率をどれだけ強くしても、時間増加系側のr値には影響しなくなる。
     */
    const spawnRateBoostActive = performance.now() < spawnRateBoostUntilRef.current;
    const timeBonusCutoffActive = elapsedSec >= timeBonusCutoffSecRef.current;
    /**
     * ダンボールNo.1「アイテム出現量アップ」：既存の出現量アップ系スキルと同じ「出現間隔そのものを
     * 割る」方式（spawnRateへ反映、下のメインループ側）で、時間増加系8種の重みをこの倍率で
     * 割って相殺する（上のコメント「出現量ブーストの1/n相殺」と同じ考え方をこちらにも適用する）。
     */
    const dambourlePermanentSpawnBoost = dambourleUpMultiplier("item_spawn_up");
    const totalSpawnRateBoost = (spawnRateBoostActive ? spawnRateBoostValueRef.current : 1) * dambourlePermanentSpawnBoost;
    /** ダンボールNo.8「時間系プールの出現率アップ」：時間増加系8種の重みだけを直接底上げする */
    const timePoolRateUpFactor = dambourleUpMultiplier("time_pool_rate_up");
    const weightedItems = itemPool.map((item) => ({
      item,
      weight:
        (ITEM_SPAWN_WEIGHTS[item.id] ?? DEFAULT_ITEM_SPAWN_WEIGHT) *
        (item.rarity === "UR" ? urBoostFactor : 1) *
        (otherSuppressActive && item.id !== STRETCH_ROD_ITEM_ID && OTHER_CATEGORY_ITEM_IDS.has(item.id)
          ? otherSuppressValueRef.current
          : 1) *
        (highRarityLockActive && !HIGH_RARITY_LOCK_RARITIES.has(item.rarity) ? 0 : 1) *
        (excludeTimeBonus && (TIME_BONUS_ITEM_IDS.has(item.id) || SPAWN_DYNAMICS_ITEM_IDS.has(item.id)) ? 0 : 1) *
        (timeBonusCutoffActive && TIME_BONUS_CUTOFF_ITEM_IDS.has(item.id) ? 0 : 1) *
        (TIME_BONUS_ITEM_IDS.has(item.id) ? timePoolRateUpFactor / totalSpawnRateBoost : 1),
    }));
    const itemWeightTotal = weightedItems.reduce((sum, entry) => sum + entry.weight, 0);
    const dogWeight =
      itemWeightTotal * (DOG_SPAWN_RATIO / (1 - DOG_SPAWN_RATIO)) +
      TIME_BONUS_UNFILLED_RANK_DOG_WEIGHT +
      SCORE_MULT_UNFILLED_RANK_DOG_WEIGHT +
      SPAWN_DYNAMICS_UNFILLED_RANK_DOG_WEIGHT;
    let roll = Math.random() * (dogWeight + itemWeightTotal);

    if (roll < dogWeight) {
      const dogGoldenActive = performance.now() < dogGoldenUntilRef.current;
      if (dogGoldenActive) {
        return {
          ...base,
          itemId: TOOREMATEN_GOLDEN_DOG_ID,
          kind: "dog",
          name: "金色フレブル",
          image: "/characters/default/front.webp",
          rarity: null,
          level: 0,
          size: 21,
          spin: (Math.random() - 0.5) * 20,
        };
      }
      const skinPool = itemPool.filter((item) => FRENCHIE_SKIN_IDS.includes(item.id) && !((excludeTimeBonus || timeBonusCutoffActive) && TIME_BONUS_ITEM_IDS.has(item.id)));
      if (skinPool.length > 0 && Math.random() < FRENCHIE_SKIN_SPAWN_CHANCE) {
        const skin = skinPool[Math.floor(Math.random() * skinPool.length)]!;
        return {
          ...base,
          itemId: skin.id,
          kind: "item",
          name: skin.name,
          image: skin.image,
          rarity: skin.rarity,
          level: skin.level,
          vy: resolveFallVy(rawVy, base.vy, skin.id, skin.rarity, skin.level || 1),
          size: 15.5 + Math.random() * 3.5,
          spin: (Math.random() - 0.5) * 20,
        };
      }
      return {
        ...base,
        itemId: null,
        kind: "dog",
        name: "初期フレブル",
        image: "/characters/default/front.webp",
        rarity: null,
        level: 0,
        size: 19,
        spin: (Math.random() - 0.5) * 20,
      };
    }

    roll -= dogWeight;
    let item = weightedItems[weightedItems.length - 1]!.item;
    for (const entry of weightedItems) {
      roll -= entry.weight;
      if (roll <= 0) {
        item = entry.item;
        break;
      }
    }

    return {
      ...base,
      itemId: item.id,
      kind: "item",
      name: item.name,
      image: item.image,
      rarity: item.rarity,
      level: item.level,
      vy: resolveFallVy(rawVy, base.vy, item.id, item.rarity, item.level || 1),
      size: 12.5 + Math.random() * 3.5,
      spin: (Math.random() - 0.5) * 65,
    };
  }, [itemPool]);

  /**
   * Clawdのボールは通常アイテムの抽選を妨げないよう、createEntityとは独立したタイマーで
   * 並行して降らせる（他のアイテムと一緒に降ってくる。normal spawnをブロックしない）。
   */
  const createClawdBallEntity = useCallback((): Entity | null => {
    const { soccer, gold } = clawdBallItemsRef.current;
    if (!soccer && !gold) return null;
    const fallSpeedBoost = performance.now() < fallSpeedBoostUntilRef.current ? fallSpeedValueRef.current : 1;
    const slantBoost = performance.now() < slantBoostUntilRef.current ? SLANT_VX_BOOST : 1;
    const rawVy = (17 + Math.random() * 5) * 1.35;
    const spawnX = 9 + Math.random() * 82;
    const spawnY = -13 - Math.random() * 5;
    const base = {
      id: nextIdRef.current++,
      x: spawnX,
      y: spawnY,
      spawnX,
      spawnY,
      vx: (Math.random() - 0.5) * 2.4 * slantBoost,
      vy: rawVy * fallSpeedBoost,
      rotation: (Math.random() - 0.5) * 12,
      status: "falling" as const,
      rimChecked: false,
      enteredOpening: false,
      ttl: 0,
    };
    const rollGold = Math.random() < CLAWD_GOLD_BALL_CHANCE;
    const ball = (rollGold ? gold : soccer) ?? soccer ?? gold!;
    return {
      ...base,
      itemId: ball.id,
      kind: "item",
      name: ball.name,
      image: ball.image ?? "",
      rarity: ball.rarity,
      level: itemLevelByIdRef.current.get(ball.id) ?? 0,
      vy: resolveFallVy(rawVy, base.vy, ball.id, ball.rarity, itemLevelByIdRef.current.get(ball.id) ?? 1),
      size: 12.5 + Math.random() * 3.5,
      spin: (Math.random() - 0.5) * 65,
    };
  }, []);

  const pushRecentSkillEffect = useCallback((text: string) => {
    const id = ++recentSkillEffectIdRef.current;
    setRecentSkillEffects((prev) => [{ id, text }, ...prev].slice(0, 2));
    const timer = setTimeout(() => {
      setRecentSkillEffects((prev) => prev.filter((entry) => entry.id !== id));
      recentSkillEffectTimersRef.current.delete(id);
    }, 2400);
    recentSkillEffectTimersRef.current.set(id, timer);
  }, []);

  const showCatch = useCallback((entity: Entity, points: number, effect?: string) => {
    setFeedback({ name: entity.name, points, effect });
    setBoxBounce(true);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      setFeedback(null);
      setBoxBounce(false);
    }, 900);
    if (effect) pushRecentSkillEffect(effect);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(18);
  }, [pushRecentSkillEffect]);

  const showImpact = useCallback((x: number) => {
    setImpactX(x);
    if (impactTimerRef.current) clearTimeout(impactTimerRef.current);
    impactTimerRef.current = setTimeout(() => setImpactX(null), 280);
  }, []);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    if (impactTimerRef.current) clearTimeout(impactTimerRef.current);
    recentSkillEffectTimersRef.current.forEach((timer) => clearTimeout(timer));
    recentSkillEffectTimersRef.current.clear();
  }, []);

  useEffect(() => {
    if (phase !== "playing" || performance.now() < stunUntilRef.current) return;
    let last = performance.now();

    /** いつものフレブル(N)を取った回数×プレイ時間(秒)を最後にまとめて加算する（小数点切り捨て） */
    const finishRound = (now: number) => {
      const playSeconds = Math.max(0, (now - startAtRef.current) / 1000);
      const dogCount = dogCaughtRef.current;
      // ダンボールNo.6「フレブルボーナスの倍率アップ」：マフィアーの累積倍率とは別枠でさらに掛け合わせる
      // （ダンボール効果が絡むスコア換算は必ず切り上げにする。/api/coins/item-catchはInteger必須のため
      //  端数が残るとリクエスト自体が失敗する）
      const dogBonusPoints = Math.ceil(dogCount * playSeconds * mafiaDogBonusMultRef.current * dambourleUpMultiplier("dog_bonus_mult_up"));
      if (dogBonusPoints > 0) {
        scoreRef.current += dogBonusPoints;
        setScore(scoreRef.current);
      }
      setDogBonus(dogCount > 0 ? { count: dogCount, bonus: dogBonusPoints } : null);
      setPhase("finished");
    };

    const frame = (now: number) => {
      const remaining = Math.max(0, (endAtRef.current - now) / 1000);
      setTimeLeft(Math.ceil(remaining));
      if (remaining <= 0) {
        finishRound(now);
        return;
      }

      let timedEffectChanged = false;
      if (pruneScoreMultipliers(scoreMultipliersRef, now)) {
        timedEffectChanged = true;
      }
      if (pruneScoreMultipliers(foodScoreMultipliersRef, now)) {
        timedEffectChanged = true;
      }
      if (boxWideUntilRef.current > 0 && now >= boxWideUntilRef.current) {
        boxWideUntilRef.current = 0;
        timedEffectChanged = true;
      }
      if (magnetUntilRef.current > 0 && now >= magnetUntilRef.current) {
        magnetUntilRef.current = 0;
        timedEffectChanged = true;
      }
      if (fallSpeedBoostUntilRef.current > 0 && now >= fallSpeedBoostUntilRef.current) {
        fallSpeedBoostUntilRef.current = 0;
        timedEffectChanged = true;
      }
      if (poopSuppressUntilRef.current > 0 && now >= poopSuppressUntilRef.current) {
        poopSuppressUntilRef.current = 0;
        timedEffectChanged = true;
      }
      if (ikeaUntilRef.current > 0 && now >= ikeaUntilRef.current) {
        ikeaUntilRef.current = 0;
        const ikeaCount = ikeaCountRef.current;
        ikeaCountRef.current = 0;
        if (ikeaCount > 0) {
          const ikeaBonus = ikeaCount * IKEA_PT_PER_ITEM;
          scoreRef.current += ikeaBonus;
          setScore(scoreRef.current);
          setFeedback({ name: "くみたてボーナス", points: ikeaBonus, effect: `くみたて完成！+${ikeaBonus}pt` });
          setBoxBounce(true);
          if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
          feedbackTimerRef.current = setTimeout(() => {
            setFeedback(null);
            setBoxBounce(false);
          }, 900);
          pushRecentSkillEffect(`くみたて完成！+${ikeaBonus}pt`);
        }
        timedEffectChanged = true;
      }
      if (spawnRateBoostUntilRef.current > 0 && now >= spawnRateBoostUntilRef.current) {
        spawnRateBoostUntilRef.current = 0;
        timedEffectChanged = true;
      }
      if (narcissistUntilRef.current > 0 && now >= narcissistUntilRef.current) {
        narcissistUntilRef.current = 0;
        timedEffectChanged = true;
      }
      if (urBoostRef.current > 0 && now >= urBoostDecayNextRef.current) {
        urBoostRef.current = Math.max(0, urBoostRef.current - UR_BOOST_DECAY_STEP);
        urBoostDecayNextRef.current = now + UR_BOOST_DECAY_INTERVAL_MS;
        timedEffectChanged = true;
      }
      if (pinkOmoUntilRef.current > 0 && now >= pinkOmoUntilRef.current) { pinkOmoUntilRef.current = 0; setPinkOmoActive(false); timedEffectChanged = true; }
      if (boxShrinkUntilRef.current > 0 && now >= boxShrinkUntilRef.current) { boxShrinkUntilRef.current = 0; timedEffectChanged = true; }
      if (blackoutUntilRef.current > 0 && now >= blackoutUntilRef.current) { blackoutUntilRef.current = 0; setBlackoutActive(false); timedEffectChanged = true; }
      if (stunUntilRef.current > 0 && now >= stunUntilRef.current) { stunUntilRef.current = 0; setStunned(false); timedEffectChanged = true; }
      if (timedEffectChanged) refreshEffectStatus(now);

      const dt = Math.min(0.035, Math.max(0, (now - last) / 1000));
      last = now;
      const spawnRate = dogFloodRemainingRef.current > 0
        ? DOG_FLOOD_SPAWN_RATE
        : poopFloodRemainingRef.current > 0
        ? POOP_FLOOD_SPAWN_RATE
        // ダンボールNo.1「アイテム出現量アップ」ぶんを常時掛け合わせる（時間増加系の重み側で1/nを相殺済み）
        : (now < spawnRateBoostUntilRef.current ? spawnRateBoostValueRef.current : 1) * dambourleUpMultiplier("item_spawn_up");
      const entityCap = spawnRate >= 3 ? TRIPLE_ENTITY_CAP : spawnRate >= 2 ? DOUBLE_ENTITY_CAP : NORMAL_ENTITY_CAP;
      if (now >= nextSpawnRef.current && entitiesRef.current.length < entityCap) {
        entitiesRef.current.push(createEntity());
        nextSpawnRef.current = now + (SPAWN_INTERVAL_MIN_MS + Math.random() * (SPAWN_INTERVAL_MAX_MS - SPAWN_INTERVAL_MIN_MS)) / spawnRate;
      }
      /** アイテム量2倍化用のボーナス出現タイマー。時間増加系は一切対象にせず(createEntityにexcludeTimeBonus=trueを渡す)、通常タイマーと全く同じ間隔で並走させる */
      if (now >= extraSpawnRef.current && entitiesRef.current.length < entityCap) {
        entitiesRef.current.push(createEntity(true));
        extraSpawnRef.current = now + (SPAWN_INTERVAL_MIN_MS + Math.random() * (SPAWN_INTERVAL_MAX_MS - SPAWN_INTERVAL_MIN_MS)) / spawnRate;
      }
      if (clawdBallFloodRemainingRef.current > 0 && now >= nextClawdSpawnRef.current && entitiesRef.current.length < entityCap) {
        const ball = createClawdBallEntity();
        if (ball) {
          clawdBallFloodRemainingRef.current -= 1;
          entitiesRef.current.push(ball);
        }
        nextClawdSpawnRef.current = now + SPAWN_INTERVAL_MIN_MS + Math.random() * (SPAWN_INTERVAL_MAX_MS - SPAWN_INTERVAL_MIN_MS);
      }

      const boxWide = now < boxWideUntilRef.current;
      const boxShrink = now < boxShrinkUntilRef.current;
      const effectiveBoxScale = (boxShrink ? BOX_SHRINK_SCALE : boxWide ? boxWideScaleRef.current : 1) * dambourleUpMultiplier("box_size_up");
      const effBoxHalf = BOX_HALF * effectiveBoxScale;
      const effBoxWidth = BOX_WIDTH * effectiveBoxScale;
      const magnetActive = now < magnetUntilRef.current;
      const pinkOmoPullActive = now < pinkOmoUntilRef.current;
      const magnetRange = magnetStrengthRef.current === "strong"
        ? MAGNET_STRONG_RANGE
        : magnetStrengthRef.current === "medium"
          ? MAGNET_MEDIUM_RANGE
          : MAGNET_WEAK_RANGE;
      const magnetPull = magnetStrengthRef.current === "strong"
        ? MAGNET_STRONG_PULL
        : magnetStrengthRef.current === "medium"
          ? MAGNET_MEDIUM_PULL
          : MAGNET_WEAK_PULL;

      const next: Entity[] = [];
      for (const entity of entitiesRef.current) {
        if (entity.status === "caught") {
          entity.ttl -= dt;
          entity.vy += 42 * dt;
          entity.x += entity.vx * dt;
          entity.y += entity.vy * dt;
          entity.rotation += entity.spin * dt;
          if (entity.ttl > 0) next.push(entity);
          continue;
        }

        if (magnetActive && entity.status === "falling" && entity.y > 20 && entity.itemId !== POOP_ITEM_ID && !NEGATIVE_HAZARD_IDS.has(entity.itemId ?? "")) {
          const dx = boxXRef.current - entity.x;
          if (Math.abs(dx) < magnetRange) entity.vx += Math.sign(dx) * magnetPull * dt;
        }

        if (
          pinkOmoPullActive &&
          (entity.status === "falling" || entity.status === "bounced") &&
          entity.itemId !== POOP_ITEM_ID &&
          !NEGATIVE_HAZARD_IDS.has(entity.itemId ?? "")
        ) {
          const dx = boxXRef.current - entity.x;
          if (Math.abs(dx) < PINK_OMO_SNAP_EPSILON) {
            entity.x = boxXRef.current;
          } else {
            entity.x += dx * (1 - Math.exp(-PINK_OMO_SNAP_RATE * dt));
          }
          entity.vx = 0;
        }

        const previousY = entity.y;
        if (entity.status === "bounced") entity.vy += 38 * dt;
        entity.x += entity.vx * dt;
        entity.y += entity.vy * dt;
        entity.rotation += entity.spin * dt;

        const hitboxWidth = entity.size * (entity.kind === "dog" ? 0.56 : 0.62);
        let hitLeft = entity.x - hitboxWidth / 2;
        let hitRight = entity.x + hitboxWidth / 2;

        if (hitLeft < 0 && entity.vx < 0) {
          entity.x = hitboxWidth / 2;
          entity.vx = Math.abs(entity.vx) * 0.7;
          entity.spin = -entity.spin * 0.6;
          hitLeft = entity.x - hitboxWidth / 2;
          hitRight = entity.x + hitboxWidth / 2;
        } else if (hitRight > 100 && entity.vx > 0) {
          entity.x = 100 - hitboxWidth / 2;
          entity.vx = -Math.abs(entity.vx) * 0.7;
          entity.spin = -entity.spin * 0.6;
          hitLeft = entity.x - hitboxWidth / 2;
          hitRight = entity.x + hitboxWidth / 2;
        }

        const bottomOffset = entity.size * (entity.kind === "dog" ? 0.34 : 0.31);
        const previousBottom = previousY + bottomOffset;
        const bottom = entity.y + bottomOffset;

        if (entity.vy < 0 && bottom < BOX_OPEN_TOP_Y - 1.5) {
          entity.enteredOpening = false;
          if (entity.status === "bounced") entity.rimChecked = false;
        }

        if (entity.vy > 0 && bottom >= BOX_OPEN_TOP_Y) {
          const center = boxXRef.current;
          const localY = (bottom - BOX_TOP) / BOX_HEIGHT;
          const previousLocalY = (previousBottom - BOX_TOP) / BOX_HEIGHT;
          const localHitLeft = (hitLeft - (center - effBoxHalf)) / effBoxWidth;
          const localHitRight = (hitRight - (center - effBoxHalf)) / effBoxWidth;
          const localHitWidth = Math.max(0.001, localHitRight - localHitLeft);
          const localCenterX = (entity.x - (center - effBoxHalf)) / effBoxWidth;
          const opening = openingBoundsAt(localY);

          if (!entity.enteredOpening && previousLocalY < OPEN_TOP_LOCAL_Y && localY >= OPEN_TOP_LOCAL_Y) {
            const entryOpening = openingBoundsAt(OPEN_TOP_LOCAL_Y);
            const entryRatio = overlap(localHitLeft, localHitRight, entryOpening.left, entryOpening.right) / localHitWidth;
            const entryInset = 0.035;
            entity.enteredOpening = entryRatio >= 0.68
              && localCenterX >= entryOpening.left + entryInset
              && localCenterX <= entryOpening.right - entryInset;
          }

          const widthFullyInsideOpening = localHitLeft >= opening.left && localHitRight <= opening.right;
          const canCatch = entity.enteredOpening
            && localY >= CATCH_START_LOCAL_Y
            && localY <= OPEN_BOTTOM_LOCAL_Y + 0.10
            && widthFullyInsideOpening;

          if (canCatch) {
            entity.rimChecked = true;
            entity.status = "caught";
            entity.ttl = 0.16;
            entity.vx *= 0.35;
            entity.vy = Math.max(entity.vy, 32);
            entity.spin *= 0.45;

            if (entity.itemId === POOP_ITEM_ID) {
              caughtRef.current += 1;
              setCaught(caughtRef.current);
              if (now < omochiUntilRef.current) {
                const omochiPt = omochiPtValueRef.current;
                scoreRef.current += omochiPt;
                setScore(scoreRef.current);
                showCatch(entity, omochiPt, `こんどうが守ってくれた！ +${omochiPt}pt`);
              } else if (bagStockRef.current > 0) {
                bagStockRef.current -= 1;
                setBagStock(bagStockRef.current);
                showCatch(entity, 0, "ビニール袋でノーダメージ！");
              } else {
                // マイナス点も画面上部の「スコア倍率 ×X」と同じ倍率（時間経過系×宝箱連続ボーナス系×食べ物限定系×ダンボールNo.2）を反映する
                const poopPenaltyMultiplier = getScoreMultiplierProduct(scoreMultipliersRef, now)
                  * (treasureStreakActiveRef.current ? treasureStreakMultRef.current : 1)
                  * getScoreMultiplierProduct(foodScoreMultipliersRef, now)
                  * dambourleUpMultiplier("score_mult_up");
                const poopPenalty = Math.round(POOP_PENALTY * poopPenaltyMultiplier);
                scoreRef.current = Math.max(0, scoreRef.current - poopPenalty);
                setScore(scoreRef.current);
                showCatch(entity, -poopPenalty, "うんちを踏んじゃった…");
              }
              next.push(entity);
              continue;
            }

            if (entity.itemId === BAG_ITEM_ID) {
              caughtRef.current += 1;
              setCaught(caughtRef.current);
              if (bagStockRef.current < BAG_MAX_STOCK) {
                bagStockRef.current += 1;
                setBagStock(bagStockRef.current);
                showCatch(entity, 0, `ビニール袋 ${bagStockRef.current}/${BAG_MAX_STOCK}`);
              } else {
                showCatch(entity, 0, "ビニール袋は満タン");
              }
              next.push(entity);
              continue;
            }

            if (NEGATIVE_HAZARD_IDS.has(entity.itemId ?? "")) {
              caughtRef.current += 1;
              setCaught(caughtRef.current);
              const hazardInverted = now < hazardInvertUntilRef.current
                && (entity.itemId === TIME_MINUS_ITEM_ID || entity.itemId === BOX_SHRINK_ITEM_ID || entity.itemId === STUN_ITEM_ID);
              if (entity.itemId === TIME_MINUS_ITEM_ID) {
                if (hazardInverted) {
                  const bonusPt = Math.round(mirrorInvertPtValueRef.current);
                  scoreRef.current += bonusPt;
                  setScore(scoreRef.current);
                  showCatch(entity, bonusPt, `ミラー反転！+${bonusPt}pt`);
                } else if (timeMinusGuardRef.current > 0) {
                  timeMinusGuardRef.current = 0;
                  setTimeMinusGuard(0);
                  showCatch(entity, 0, `${HAZARD_GUARD_LABELS.timeMinus}で無効化！`);
                } else {
                  endAtRef.current -= TIME_MINUS_SECONDS * 1000;
                  const nextRemaining = Math.max(0, (endAtRef.current - now) / 1000);
                  setTimeLeft(Math.ceil(nextRemaining));
                  showCatch(entity, 0, "残り時間 -" + TIME_MINUS_SECONDS + "秒");
                  if (endAtRef.current <= now) { endAtRef.current = now; setTimeLeft(0); finishRound(now); }
                }
              } else if (entity.itemId === BOX_SHRINK_ITEM_ID) {
                if (hazardInverted) {
                  boxWideUntilRef.current = Math.max(now, boxWideUntilRef.current) + BOX_SHRINK_SECONDS * 1000;
                  boxWideScaleRef.current = BOX_WIDE_SCALE_DEFAULT;
                  showCatch(entity, 0, `ミラー反転！${BOX_SHRINK_SECONDS}秒間 ダンボール拡大`);
                } else if (boxShrinkGuardRef.current > 0) {
                  boxShrinkGuardRef.current = 0;
                  setBoxShrinkGuard(0);
                  showCatch(entity, 0, `${HAZARD_GUARD_LABELS.boxShrink}で無効化！`);
                } else {
                  boxShrinkUntilRef.current = Math.max(now, boxShrinkUntilRef.current) + BOX_SHRINK_SECONDS * 1000;
                  showCatch(entity, 0, BOX_SHRINK_SECONDS + "秒間 ダンボール0.8倍");
                }
              } else if (entity.itemId === BLACKOUT_ITEM_ID) {
                blackoutUntilRef.current = Math.max(now, blackoutUntilRef.current) + BLACKOUT_SECONDS * 1000;
                setBlackoutActive(true);
                showCatch(entity, 0, BLACKOUT_SECONDS + "秒間 上半分が見えない！");
              } else if (entity.itemId === STUN_ITEM_ID) {
                if (hazardInverted) {
                  const bonusPt = Math.round(mirrorInvertPtValueRef.current);
                  scoreRef.current += bonusPt;
                  setScore(scoreRef.current);
                  showCatch(entity, bonusPt, `ミラー反転！+${bonusPt}pt`);
                } else if (stunGuardRef.current > 0) {
                  stunGuardRef.current = 0;
                  setStunGuard(0);
                  showCatch(entity, 0, `${HAZARD_GUARD_LABELS.stun}で無効化！`);
                } else {
                  stunUntilRef.current = Math.max(now, stunUntilRef.current) + STUN_SECONDS * 1000;
                  draggingRef.current = false;
                  setStunned(true);
                  showCatch(entity, 0, STUN_SECONDS + "秒間 しびれ！");
                }
              } else if (entity.itemId === CHOCOLATE_ITEM_ID) {
                endAtRef.current = now;
                setTimeLeft(0);
                finishRound(now);
                showCatch(entity, 0, "呪いのチョコレート…ゲーム終了！");
              }
              refreshEffectStatus(now);
              next.push(entity);
              continue;
            }

            let basePoints = entity.kind === "dog"
              ? (entity.itemId === TOOREMATEN_GOLDEN_DOG_ID ? dogGoldenPtValueRef.current : 30)
              : entity.itemId === MYSTERY_ITEM_ID
                ? MYSTERY_BASE_POINTS
                : POINTS[entity.rarity!];
            let pendingBonus = 0;
            let statusChanged = false;

            if (rewardTimeCountRef.current > 0) {
              basePoints = rewardTimeValueRef.current;
              rewardTimeCountRef.current -= 1;
              statusChanged = true;
            }

            if (nextBonus5Ref.current > 0) {
              pendingBonus += nextBonus5ValueRef.current;
              nextBonus5Ref.current -= 1;
              statusChanged = true;
            }
            if (nextBonus10Ref.current > 0) {
              pendingBonus += nextBonus10ValueRef.current;
              nextBonus10Ref.current -= 1;
              statusChanged = true;
            }

            // ダンボールNo.13「全アイテムの基礎スコアプラス」：基礎点を底上げする（固定pt系オーバーライドの後に適用）
            // ダンボール効果が絡むスコア換算は必ず切り上げにする（端数が出るとAPI側の整数チェックで弾かれるため）
            basePoints = Math.ceil(basePoints * dambourleUpMultiplier("item_base_score_up"));

            const timedMultiplier = getScoreMultiplierProduct(scoreMultipliersRef, now);
            const hadActiveNextMultiplier = nextMultipliersRef.current.some((entry) => entry.remaining > 0);
            const nextMultiplier = consumeCountMultiplierProduct(nextMultipliersRef);
            if (hadActiveNextMultiplier) statusChanged = true;
            const foodMultiplier = FOOD_CATEGORY_ITEM_IDS.has(entity.itemId ?? "")
              ? getScoreMultiplierProduct(foodScoreMultipliersRef, now)
              : 1;
            const streakMultiplier = treasureStreakActiveRef.current ? treasureStreakMultRef.current : 1;
            // ダンボールNo.2「スコア倍率アップ」：他系統の得点倍率と同様、重複中もすべて掛け合わされる
            const dambourleScoreMultiplier = dambourleUpMultiplier("score_mult_up");
            // 種類の異なる得点倍率（時間経過系/次のN個系/食べ物限定系/宝箱連続ボーナス系/ダンボール効果）は重複中すべて掛け合わされる
            const multiplier = timedMultiplier * nextMultiplier * foodMultiplier * streakMultiplier * dambourleScoreMultiplier;
            // ダンボール効果（No.2やNo.12の抽選結果）が絡むと端数が出うるため、必ず切り上げにする
            // （端数のままだと/api/coins/item-catchのInteger必須チェックでリクエスト自体が失敗する）
            let points = Math.ceil((basePoints + pendingBonus) * multiplier);
            let effectLabel: string | undefined;

            if (now < ikeaUntilRef.current) {
              ikeaCountRef.current += 1;
              statusChanged = true;
            }

            const isMystery = entity.itemId === MYSTERY_ITEM_ID;
            const timeBonusCutoffActiveAtCatch = (now - startAtRef.current) / 1000 >= timeBonusCutoffSecRef.current;
            const mysterySkillPool = timeBonusCutoffActiveAtCatch
              ? mysterySkillPoolRef.current.filter((id) => !TIME_BONUS_CUTOFF_ITEM_IDS.has(id))
              : mysterySkillPoolRef.current;
            const effectiveMysterySkillPool = mysterySkillPool.length > 0 ? mysterySkillPool : mysterySkillPoolRef.current;
            const skillId = isMystery
              ? effectiveMysterySkillPool[Math.floor(Math.random() * effectiveMysterySkillPool.length)]!
              : entity.itemId;
            const skillLevel = isMystery
              ? (itemLevelByIdRef.current.get(skillId ?? "") ?? 1)
              : (entity.level || 1);
            /** ナルシストアー有効中は、捕まえた全アイテムのスキルが上限(No.11装備時はそのぶん底上げされた上限)として発動する */
            const narcissistActive = now < narcissistUntilRef.current;
            const effectiveSkillLevel = narcissistActive ? skillLevelCap : skillLevel + dambourleSkillBoost;
            const lv = clamp(effectiveSkillLevel, 1, skillLevelCap) - 1;

            const addBonusTime = (seconds: number) => {
              const maxEndAt = startAtRef.current + MAX_ROUND_SECONDS * 1000;
              endAtRef.current = Math.min(maxEndAt, endAtRef.current + seconds * 1000);
              setTimeLeft(Math.ceil(Math.max(0, (endAtRef.current - now) / 1000)));
              return seconds;
            };

            if (now < okaeriUntilRef.current) {
              addBonusTime(okaeriPerCatchValueRef.current);
              statusChanged = true;
            }

            /** しびれ/ダンボール縮小/時間減少のいずれかを1回だけ防ぐガードを、まだ持っていない種類からランダムで1つ付与する */
            const grantRandomHazardGuard = (): HazardGuardKind | null => {
              const candidates = HAZARD_GUARD_KINDS.filter((kind) => {
                if (kind === "stun") return stunGuardRef.current === 0;
                if (kind === "boxShrink") return boxShrinkGuardRef.current === 0;
                return timeMinusGuardRef.current === 0;
              });
              if (candidates.length === 0) return null;
              const kind = candidates[Math.floor(Math.random() * candidates.length)]!;
              if (kind === "stun") { stunGuardRef.current = 1; setStunGuard(1); }
              else if (kind === "boxShrink") { boxShrinkGuardRef.current = 1; setBoxShrinkGuard(1); }
              else { timeMinusGuardRef.current = 1; setTimeMinusGuard(1); }
              return kind;
            };

            const lvTag = narcissistActive
              ? " [ナルシストアー Lv.MAX]"
              : skillLevel >= MAX_SKILL_LEVEL ? " [Lv.MAX]" : skillLevel > 1 ? ` [Lv${skillLevel}]` : "";

            /**
             * もっちゅりんの「エコー」で任意のアイテムのスキルを再発動できるよう、
             * switch本体を関数化。呼び出し側は差分のpoints/effectLabel/statusChangedを受け取り、
             * 通常の1回目の発動とエコーの2回目の発動の両方で同じロジックを共有する。
             */
            const runItemSkillEffect = (
              skillId: string | null,
              lv: number,
              lvTag: string,
            ): { points: number; effectLabel?: string; statusChanged: boolean } => {
              let points = 0;
              let effectLabel: string | undefined;
              let statusChanged = false;
              switch (skillId) {
              case "toy_soccer_ball":
                points += LV.SOCCER_PT[lv]!;
                effectLabel = `+${LV.SOCCER_PT[lv]}ptボーナス${lvTag}`;
                break;
              case "toy_taiyaki_plush":
                nextBonus5Ref.current += 2;
                nextBonus5ValueRef.current = LV.TAIYAKI_PT[lv]!;
                effectLabel = `次の2個 +${LV.TAIYAKI_PT[lv]}pt${lvTag}`;
                statusChanged = true;
                break;
              case "toy_bear_plush": {
                const bonusPt = LV.BEAR_PT[lv]!;
                const guard = grantRandomHazardGuard();
                points += bonusPt;
                const guardLabel = guard ? HAZARD_GUARD_LABELS[guard] : "防止アイテムは満タン";
                effectLabel = bonusPt > 0 ? `${guardLabel} +${bonusPt}pt${lvTag}` : `${guardLabel}${lvTag}`;
                statusChanged = true;
                break;
              }
              case "toy_duck_plush": {
                const applied = addBonusTime(LV.DUCK_SEC[lv]!);
                effectLabel = `+${applied}秒${lvTag}`;
                break;
              }
              case "toy_carrot": {
                const applied = addBonusTime(LV.CARROT_SEC[lv]!);
                effectLabel = `+${applied}秒${lvTag}`;
                break;
              }
              case "toy_frisbee":
                addCountMultiplier(nextMultipliersRef, LV.FRISBEE_MULT[lv]!, 1);
                effectLabel = `次の1個 ×${LV.FRISBEE_MULT[lv]}${lvTag}`;
                statusChanged = true;
                break;
              case "food_paw_bowl":
                nextBonus5Ref.current += 3;
                nextBonus5ValueRef.current = LV.BOWL_PT[lv]!;
                effectLabel = `次の3個 +${LV.BOWL_PT[lv]}pt${lvTag}`;
                statusChanged = true;
                break;
              case "toy_meat":
                addScoreMultiplier(scoreMultipliersRef, now, scaleDambourleBonusMultiplier(LV.MEAT_MULT[lv]!, dambourleUpMultiplier("score_mult_pool_effect_up")), SCORE_MULT_DURATION_SR_SEC * 1000);
                effectLabel = `${SCORE_MULT_DURATION_SR_SEC}秒間 ×${LV.MEAT_MULT[lv]}${lvTag}`;
                statusChanged = true;
                break;
              case "toy_frenchie_cushion":
                points += LV.CUSHION_PT[lv]!;
                effectLabel = `+${LV.CUSHION_PT[lv]}ptボーナス${lvTag}`;
                break;
              case "toy_treasure_puzzle": {
                // 宝箱を取ると、前回の連続ボーナスはここで終了する（新しい抽選結果に上書き）
                treasureStreakActiveRef.current = false;
                const outcome = rollTreasureOutcome();
                if (outcome === "low_pt") {
                  points += LV.TREASURE_LOW[lv]!;
                  effectLabel = `宝箱 +${LV.TREASURE_LOW[lv]}pt${lvTag}`;
                } else if (outcome === "high_pt") {
                  points += LV.TREASURE_HIGH[lv]!;
                  effectLabel = `宝箱 +${LV.TREASURE_HIGH[lv]}pt${lvTag}`;
                } else if (outcome === "time_plus") {
                  const applied = addBonusTime(LV.TREASURE_SEC[lv]!);
                  effectLabel = `宝箱 +${applied}秒${lvTag}`;
                } else if (outcome === "poop_flood") {
                  poopFloodRemainingRef.current += TREASURE_POOP_FLOOD_COUNT;
                  effectLabel = `宝箱 うんち祭り(${TREASURE_POOP_FLOOD_COUNT}個)${lvTag}`;
                  statusChanged = true;
                } else if (outcome === "time_minus5") {
                  const applied = addBonusTime(-TREASURE_MINUS5_SEC);
                  effectLabel = `宝箱 ${applied}秒${lvTag}`;
                } else if (outcome === "item_double") {
                  addScoreMultiplier(scoreMultipliersRef, now, scaleDambourleBonusMultiplier(LV.TREASURE_DOUBLE_MULT[lv]!, dambourleUpMultiplier("score_mult_pool_effect_up")), SCORE_MULT_DURATION_SR_SEC * 1000);
                  effectLabel = `宝箱 ${SCORE_MULT_DURATION_SR_SEC}秒間 得点×${LV.TREASURE_DOUBLE_MULT[lv]}${lvTag}`;
                  statusChanged = true;
                } else if (outcome === "rare_lock") {
                  highRarityLockUntilRef.current = Math.max(now, highRarityLockUntilRef.current) + LV.TREASURE_SEC[lv]! * 1000;
                  effectLabel = `宝箱 ${LV.TREASURE_SEC[lv]}秒間 SSR/UR/LRのみ出現${lvTag}`;
                  statusChanged = true;
                } else {
                  const pct = LV.TREASURE_STREAK_PCT[lv]!;
                  treasureStreakActiveRef.current = true;
                  treasureStreakMultRef.current = 1 + pct / 100;
                  effectLabel = `宝箱 次の宝箱まで得点+${pct}%${lvTag}`;
                  statusChanged = true;
                }
                break;
              }
              case "toy_frenchie_plush":
                nextBonus10Ref.current += LV.FRENCHIE_PLUSH_COUNT[lv]!;
                nextBonus10ValueRef.current = LV.FRENCHIE_PLUSH_PT[lv]!;
                effectLabel = `次の${LV.FRENCHIE_PLUSH_COUNT[lv]}個 +${LV.FRENCHIE_PLUSH_PT[lv]}pt${lvTag}`;
                statusChanged = true;
                break;
              case "toy_rainbow_ball":
                urBoostRef.current = Math.min(UR_BOOST_MAX, urBoostRef.current + LV.RAINBOW_STEP[lv]!);
                urBoostDecayNextRef.current = now + UR_BOOST_DECAY_INTERVAL_MS;
                effectLabel = `UR出現率 +${LV.RAINBOW_STEP[lv]}（少しずつ減衰）${lvTag}`;
                statusChanged = true;
                break;
              case "toy_golden_crown_ball":
                addCountMultiplier(nextMultipliersRef, LV.GOLDEN_MULT[lv]!, LV.GOLDEN_COUNT[lv]!);
                effectLabel = `次の${LV.GOLDEN_COUNT[lv]}個 ×${LV.GOLDEN_MULT[lv]}${lvTag}`;
                statusChanged = true;
                break;
              case "interior_anball": {
                points += LV.ANBALL_PT[lv]!;
                const applied = addBonusTime(LV.ANBALL_SEC[lv]!);
                effectLabel = `+${LV.ANBALL_PT[lv]}pt / +${applied}秒${lvTag}`;
                break;
              }
              case STRETCH_ROD_ITEM_ID:
                otherSuppressUntilRef.current = Math.max(now, otherSuppressUntilRef.current) + STRETCH_ROD_SECONDS * 1000;
                otherSuppressValueRef.current = LV.STRETCH_ROD_MULT[lv]!;
                effectLabel = `${STRETCH_ROD_SECONDS}秒間 その他×${LV.STRETCH_ROD_MULT[lv]}${lvTag}`;
                statusChanged = true;
                break;
              case BUREBUR_ITEM_ID: {
                const applied = addBonusTime(LV.BUREBUR_SEC[lv]!);
                effectLabel = `+${applied}秒${lvTag}`;
                break;
              }
              case XMAS_PARTY_ITEM_ID: {
                const xmasSec = LV.XMAS_SEC[lv]!;
                fallSpeedBoostUntilRef.current = Math.max(now, fallSpeedBoostUntilRef.current) + xmasSec * 1000;
                fallSpeedValueRef.current = LV.XMAS_FALL[lv]!;
                addScoreMultiplier(scoreMultipliersRef, now, scaleDambourleBonusMultiplier(LV.XMAS_SCORE[lv]!, dambourleUpMultiplier("score_mult_pool_effect_up")), SCORE_MULT_DURATION_MR_SEC * 1000);
                spawnRateBoostUntilRef.current = Math.max(now, spawnRateBoostUntilRef.current) + xmasSec * 1000;
                spawnRateBoostValueRef.current = scaleDambourleBonusMultiplier(LV.XMAS_SPAWN[lv]!, dambourleUpMultiplier("spawn_dynamics_effect_up"));
                dogFloodRemainingRef.current += LV.XMAS_DOG_COUNT[lv]!;
                effectLabel = `${xmasSec}秒間 落下×${LV.XMAS_FALL[lv]}+出現量×${LV.XMAS_SPAWN[lv]} / ${SCORE_MULT_DURATION_MR_SEC}秒間 得点×${LV.XMAS_SCORE[lv]} / フレブル${LV.XMAS_DOG_COUNT[lv]}体${lvTag}`;
                statusChanged = true;
                break;
              }
              case DOG_FLOOD_ITEM_ID:
                dogFloodRemainingRef.current += LV.LISTEN_DOG_COUNT[lv]!;
                effectLabel = `フレブル${LV.LISTEN_DOG_COUNT[lv]}体 大量発生${lvTag}`;
                statusChanged = true;
                break;
              case "other_azubee":
                addScoreMultiplier(scoreMultipliersRef, now, scaleDambourleBonusMultiplier(LV.AZUBEE_MULT[lv]!, dambourleUpMultiplier("score_mult_pool_effect_up")), SCORE_MULT_DURATION_UR_SEC * 1000);
                effectLabel = `${SCORE_MULT_DURATION_UR_SEC}秒間 ×${LV.AZUBEE_MULT[lv]}${lvTag}`;
                statusChanged = true;
                break;
              case "other_omojii": {
                const applied = addBonusTime(LV.OMOJII_SEC[lv]!);
                points += LV.OMOJII_PT[lv]!;
                effectLabel = `+${applied}秒 / +${LV.OMOJII_PT[lv]}pt${lvTag}`;
                break;
              }
              case "food_paw_pudding":
                points += LV.PUDDING_PT[lv]!;
                effectLabel = `+${LV.PUDDING_PT[lv]}ptボーナス${lvTag}`;
                break;
              case "food_kamikami":
                points += LV.KAMIKAMI_PT[lv]!;
                effectLabel = `+${LV.KAMIKAMI_PT[lv]}ptボーナス${lvTag}`;
                break;
              case MOCCHURIN_ITEM_ID: {
                points += LV.MOCCHURIN_PT[lv]!;
                const echoCount = lv >= MOCCHURIN_DOUBLE_ECHO_MIN_LV ? 2 : 1;
                mocchurinPendingEchoCountRef.current += echoCount;
                effectLabel = `+${LV.MOCCHURIN_PT[lv]}ptボーナス / 次の${echoCount}個をエコー${lvTag}`;
                statusChanged = true;
                break;
              }
              case "food_paw_melon_bread": {
                const applied = addBonusTime(LV.MELON_SEC[lv]!);
                points += LV.MELON_PT[lv]!;
                effectLabel = `+${applied}秒 / +${LV.MELON_PT[lv]}pt${lvTag}`;
                break;
              }
              case "food_paw_cupcake":
                boxWideUntilRef.current = Math.max(now, boxWideUntilRef.current) + LV.CUPCAKE_SEC[lv]! * 1000;
                boxWideScaleRef.current = BOX_WIDE_SCALE_DEFAULT;
                effectLabel = `${LV.CUPCAKE_SEC[lv]}秒間 ダンボール1.5倍拡大${lvTag}`;
                statusChanged = true;
                break;
              case "toy_paw_macaron":
                boxWideUntilRef.current = Math.max(now, boxWideUntilRef.current) + LV.MACARON_SEC[lv]! * 1000;
                boxWideScaleRef.current = BOX_WIDE_SCALE_DEFAULT;
                effectLabel = `${LV.MACARON_SEC[lv]}秒間 ダンボール1.5倍拡大${lvTag}`;
                statusChanged = true;
                break;
              case "food_strawberry_roll_cake":
                addCountMultiplier(nextMultipliersRef, LV.STRAWBERRY_MULT[lv]!, LV.STRAWBERRY_COUNT[lv]!);
                effectLabel = `次の${LV.STRAWBERRY_COUNT[lv]}個 ×${LV.STRAWBERRY_MULT[lv]}${lvTag}`;
                statusChanged = true;
                break;
              case "toy_star_wan_wand": {
                const remainingSec = Math.round(Math.max(0, (endAtRef.current - now) / 1000));
                const timeBonus = Math.round(remainingSec * LV.STARWAND_MULT[lv]!);
                points += timeBonus;
                effectLabel = `残り時間ボーナス +${timeBonus}pt${lvTag}`;
                break;
              }
              case "other_hia": {
                const remainingSec = Math.round(Math.max(0, (endAtRef.current - now) / 1000));
                const timeBonus = Math.round(remainingSec * LV.HIA_MULT[lv]!);
                points += timeBonus;
                effectLabel = `残り時間ボーナス +${timeBonus}pt${lvTag}`;
                break;
              }
              case "interior_sleepy_moon": {
                const guard = grantRandomHazardGuard();
                effectLabel = `${guard ? HAZARD_GUARD_LABELS[guard] : "防止アイテムは満タン"}${lvTag}`;
                statusChanged = true;
                break;
              }
              case "interior_spring_flower_wreath":
                addScoreMultiplier(scoreMultipliersRef, now, scaleDambourleBonusMultiplier(LV.SPRING_MULT[lv]!, dambourleUpMultiplier("score_mult_pool_effect_up")), SCORE_MULT_DURATION_SR_SEC * 1000);
                effectLabel = `${SCORE_MULT_DURATION_SR_SEC}秒間 ×${LV.SPRING_MULT[lv]}${lvTag}`;
                statusChanged = true;
                break;
              case "other_sparkle_rope_crown":
                magnetUntilRef.current = Math.max(now, magnetUntilRef.current) + LV.SPARKLE_SEC[lv]! * 1000;
                magnetStrengthRef.current = LV.SPARKLE_STRENGTH[lv]!;
                effectLabel = `${LV.SPARKLE_SEC[lv]}秒間 ミニマグネット${lvTag}`;
                statusChanged = true;
                break;
              case NISOKU_A_ITEM_ID: {
                addScoreMultiplier(foodScoreMultipliersRef, now, LV.NISOKU_A_MULT[lv]!, SCORE_MULT_DURATION_SSR_SEC * 1000);
                effectLabel = `${SCORE_MULT_DURATION_SSR_SEC}秒間 食べ物カテゴリ得点×${LV.NISOKU_A_MULT[lv]}${lvTag}`;
                statusChanged = true;
                break;
              }
              case FRUIT_BASKET_ITEM_ID: {
                const fruitCount = LV.FRUIT_BASKET_COUNT[lv]!;
                personFloodRemainingRef.current += fruitCount;
                effectLabel = `人物入りキャラ${fruitCount}体 大量発生${lvTag}`;
                statusChanged = true;
                break;
              }
              case GOLD_BALL_ITEM_ID: {
                const bonusCoins = LV.GOLD_BALL_COINS[lv]!;
                goldBonusCoinsRef.current += bonusCoins;
                effectLabel = `+${bonusCoins}コイン獲得${lvTag}`;
                break;
              }
              case CLAWD_ITEM_ID: {
                const ballCount = LV.CLAWD_BALL_COUNT[lv]!;
                clawdBallFloodRemainingRef.current += ballCount;
                effectLabel = `サッカーボール/ゴールドボール${ballCount}個 大量発生${lvTag}`;
                statusChanged = true;
                break;
              }
              case OYASUMI_ITEM_ID: {
                const skipBlackout = Math.random() < OYASUMI_NO_BLACKOUT_CHANCE;
                const oyasumiMult = skipBlackout ? LV.OYASUMI_MULT_NORMAL[lv]! : LV.OYASUMI_MULT_BLACKOUT[lv]!;
                if (!skipBlackout) {
                  blackoutUntilRef.current = Math.max(now, blackoutUntilRef.current) + OYASUMI_SECONDS * 1000;
                  setBlackoutActive(true);
                }
                addScoreMultiplier(scoreMultipliersRef, now, scaleDambourleBonusMultiplier(oyasumiMult, dambourleUpMultiplier("score_mult_pool_effect_up")), OYASUMI_SECONDS * 1000);
                effectLabel = skipBlackout
                  ? `${OYASUMI_SECONDS}秒間 得点×${oyasumiMult}（ブラックアウトなし）${lvTag}`
                  : `${OYASUMI_SECONDS}秒間 上半分ブラックアウト 得点×${oyasumiMult}${lvTag}`;
                statusChanged = true;
                break;
              }
              case OMOI_BASHIRA_ITEM_ID: {
                const shieldSec = LV.OMOI_BASHIRA_SEC[lv]!;
                hazardShieldUntilRef.current = Math.max(now, hazardShieldUntilRef.current) + shieldSec * 1000;
                effectLabel = `${shieldSec}秒間 ハザード出現なし${lvTag}`;
                statusChanged = true;
                break;
              }
              case OKAERI_ITEM_ID: {
                okaeriUntilRef.current = Math.max(now, okaeriUntilRef.current) + LV.OKAERI_SEC * 1000;
                okaeriPerCatchValueRef.current = LV.OKAERI_PER_CATCH[lv]!;
                effectLabel = `${LV.OKAERI_SEC}秒間 取った個数×${LV.OKAERI_PER_CATCH[lv]}秒${lvTag}`;
                statusChanged = true;
                break;
              }
              case OMOCHI_ITEM_ID: {
                const omochiSec = LV.OMOCHI_SEC[lv]!;
                omochiUntilRef.current = Math.max(now, omochiUntilRef.current) + omochiSec * 1000;
                omochiPtValueRef.current = LV.OMOCHI_PT[lv]!;
                effectLabel = `${omochiSec}秒間 うんちがおもちに変身 +${LV.OMOCHI_PT[lv]}pt${lvTag}`;
                statusChanged = true;
                break;
              }
              case "other_nakayoshi_azubee": {
                points += LV.NAKAYOSHI_PT[lv]!;
                const guard = grantRandomHazardGuard();
                effectLabel = `+${LV.NAKAYOSHI_PT[lv]}pt / ${guard ? HAZARD_GUARD_LABELS[guard] : "防止アイテムは満タン"}${lvTag}`;
                statusChanged = true;
                break;
              }
              case "other_mah": {
                points += LV.MAH_PT[lv]!;
                const guard = grantRandomHazardGuard();
                effectLabel = `+${LV.MAH_PT[lv]}pt / ${guard ? HAZARD_GUARD_LABELS[guard] : "防止アイテムは満タン"}${lvTag}`;
                statusChanged = true;
                break;
              }
              case "other_mirror_omochi": {
                const mirrorSec = LV.MIRROR_SEC[lv]!;
                hazardInvertUntilRef.current = Math.max(now, hazardInvertUntilRef.current) + mirrorSec * 1000;
                mirrorInvertPtValueRef.current = LV.MIRROR_INVERT_PT[lv]!;
                effectLabel = `${mirrorSec}秒間 ハザード反転${lvTag}`;
                statusChanged = true;
                break;
              }
              case "other_toorematen": {
                const toorematenSec = LV.TOOREMATEN_SEC[lv]!;
                dogGoldenUntilRef.current = Math.max(now, dogGoldenUntilRef.current) + toorematenSec * 1000;
                dogGoldenPtValueRef.current = LV.TOOREMATEN_PT[lv]!;
                effectLabel = `${toorematenSec}秒間 フレブルが金色に(+${LV.TOOREMATEN_PT[lv]}pt)${lvTag}`;
                statusChanged = true;
                break;
              }
              case "other_kamunayo":
                addScoreMultiplier(scoreMultipliersRef, now, scaleDambourleBonusMultiplier(LV.KAMUNAYO_MULT[lv]!, dambourleUpMultiplier("score_mult_pool_effect_up")), SCORE_MULT_DURATION_SSR_SEC * 1000);
                effectLabel = `${SCORE_MULT_DURATION_SSR_SEC}秒間 ×${LV.KAMUNAYO_MULT[lv]}${lvTag}`;
                statusChanged = true;
                break;
              case "hiking_frenchie":
                magnetUntilRef.current = Math.max(now, magnetUntilRef.current) + LV.HIKING_SEC[lv]! * 1000;
                magnetStrengthRef.current = "strong";
                effectLabel = `${LV.HIKING_SEC[lv]}秒間 マグネット${lvTag}`;
                statusChanged = true;
                break;
              case "snow_frenchie":
                boxWideUntilRef.current = Math.max(now, boxWideUntilRef.current) + LV.SNOW_SEC[lv]! * 1000;
                boxWideScaleRef.current = BOX_WIDE_SCALE_STRONG;
                effectLabel = `${LV.SNOW_SEC[lv]}秒間 ダンボール1.7倍拡大${lvTag}`;
                statusChanged = true;
                break;
              case "summer_frenchie": {
                const applied = addBonusTime(LV.SUMMER_ADD[lv]!);
                addScoreMultiplier(scoreMultipliersRef, now, scaleDambourleBonusMultiplier(LV.SUMMER_MULT[lv]!, dambourleUpMultiplier("score_mult_pool_effect_up")), SCORE_MULT_DURATION_LR_SEC * 1000);
                effectLabel = `+${applied}秒 / ${SCORE_MULT_DURATION_LR_SEC}秒間×${LV.SUMMER_MULT[lv]}${lvTag}`;
                statusChanged = true;
                break;
              }
              case "interior_kinoko_azubee":
                fallSpeedBoostUntilRef.current = Math.max(now, fallSpeedBoostUntilRef.current) + LV.KINOKO_SEC[lv]! * 1000;
                fallSpeedValueRef.current = LV.KINOKO_FALL[lv]!;
                addScoreMultiplier(scoreMultipliersRef, now, scaleDambourleBonusMultiplier(LV.KINOKO_SCORE[lv]!, dambourleUpMultiplier("score_mult_pool_effect_up")), SCORE_MULT_DURATION_UR_SEC * 1000);
                effectLabel = `${LV.KINOKO_SEC[lv]}秒間 落下×${LV.KINOKO_FALL[lv]} / ${SCORE_MULT_DURATION_UR_SEC}秒間 得点×${LV.KINOKO_SCORE[lv]}${lvTag}`;
                statusChanged = true;
                break;
              case "other_komochi": {
                addCountMultiplier(nextMultipliersRef, LV.KOMOCHI_MULT[lv]!, LV.KOMOCHI_COUNT[lv]!);
                const guard = grantRandomHazardGuard();
                effectLabel = `次の${LV.KOMOCHI_COUNT[lv]}個 ×${LV.KOMOCHI_MULT[lv]} / ${guard ? HAZARD_GUARD_LABELS[guard] : "防止アイテムは満タン"}${lvTag}`;
                statusChanged = true;
                break;
              }
              case "other_azuki": {
                const applied = addBonusTime(LV.AZUKI_SEC[lv]!);
                points += LV.AZUKI_PT[lv]!;
                effectLabel = `+${applied}秒 / +${LV.AZUKI_PT[lv]}pt${lvTag}`;
                break;
              }
              case "other_kobee":
                points += LV.KOBEE_PT[lv]!;
                addScoreMultiplier(scoreMultipliersRef, now, scaleDambourleBonusMultiplier(LV.KOBEE_MULT[lv]!, dambourleUpMultiplier("score_mult_pool_effect_up")), SCORE_MULT_DURATION_UR_SEC * 1000);
                effectLabel = `+${LV.KOBEE_PT[lv]}pt / ${SCORE_MULT_DURATION_UR_SEC}秒間 ×${LV.KOBEE_MULT[lv]}${lvTag}`;
                statusChanged = true;
                break;
              case "other_hamigaki": {
                entitiesRef.current.forEach((e) => {
                  if (e.itemId === POOP_ITEM_ID && e.status !== "caught") e.y = 999;
                });
                const suppressSec = LV.HAMIGAKI_SEC[lv]!;
                points += LV.HAMIGAKI_PT[lv]!;
                if (suppressSec > 0) {
                  poopSuppressUntilRef.current = Math.max(now, poopSuppressUntilRef.current) + suppressSec * 1000;
                  effectLabel = LV.HAMIGAKI_PT[lv]! > 0
                    ? `うんち一掃 / ${suppressSec}秒間 出現なし / +${LV.HAMIGAKI_PT[lv]}pt${lvTag}`
                    : `うんち一掃 / ${suppressSec}秒間 出現なし${lvTag}`;
                } else {
                  effectLabel = `うんち一掃${lvTag}`;
                }
                statusChanged = true;
                break;
              }
              case "other_ikea": {
                const addSec = LV.IKEA_SEC[lv]!;
                const base = now < ikeaUntilRef.current ? ikeaUntilRef.current : now;
                ikeaUntilRef.current = base + addSec * 1000;
                effectLabel = `くみたて中 +${addSec}秒${lvTag}`;
                statusChanged = true;
                break;
              }
              case "other_orusuban":
              case "other_kurumari_a": {
                const orusubanSec = LV.ORUSUBAN_SEC[lv]!;
                fallSpeedBoostUntilRef.current = Math.max(now, fallSpeedBoostUntilRef.current) + orusubanSec * 1000;
                fallSpeedValueRef.current = LV.ORUSUBAN_FALL[lv]!;
                const guard = grantRandomHazardGuard();
                effectLabel = `${orusubanSec}秒間 落下速度×${LV.ORUSUBAN_FALL[lv]} / ${guard ? HAZARD_GUARD_LABELS[guard] : "防止アイテムは満タン"}${lvTag}`;
                statusChanged = true;
                break;
              }
              case "other_pondeomo": {
                const pondeomoSec = LV.PONDEOMO_SEC[lv]!;
                const pondeomoSpawn = LV.PONDEOMO_SPAWN[lv]!;
                spawnRateBoostUntilRef.current = Math.max(now, spawnRateBoostUntilRef.current) + pondeomoSec * 1000;
                spawnRateBoostValueRef.current = scaleDambourleBonusMultiplier(pondeomoSpawn, dambourleUpMultiplier("spawn_dynamics_effect_up"));
                effectLabel = `${pondeomoSec}秒間 アイテム出現量×${pondeomoSpawn}${lvTag}`;
                statusChanged = true;
                break;
              }
              case "other_pondear": {
                const pondearSec = LV.PONDEAR_SEC[lv]!;
                const pondearSpawn = LV.PONDEAR_SPAWN[lv]!;
                spawnRateBoostUntilRef.current = Math.max(now, spawnRateBoostUntilRef.current) + pondearSec * 1000;
                spawnRateBoostValueRef.current = scaleDambourleBonusMultiplier(pondearSpawn, dambourleUpMultiplier("spawn_dynamics_effect_up"));
                effectLabel = `${pondearSec}秒間 アイテム出現量×${pondearSpawn}${lvTag}`;
                statusChanged = true;
                break;
              }
              case "other_jare_a": {
                const jareASec = LV.JARE_A_SEC[lv]!;
                const jareASpawn = LV.JARE_A_SPAWN[lv]!;
                spawnRateBoostUntilRef.current = Math.max(now, spawnRateBoostUntilRef.current) + jareASec * 1000;
                spawnRateBoostValueRef.current = scaleDambourleBonusMultiplier(jareASpawn, dambourleUpMultiplier("spawn_dynamics_effect_up"));
                slantBoostUntilRef.current = Math.max(now, slantBoostUntilRef.current) + jareASec * 1000;
                effectLabel = `${jareASec}秒間 アイテム出現量×${jareASpawn}+斜め落下${lvTag}`;
                statusChanged = true;
                break;
              }
              case "interior_shikkoku_no_ar": {
                const shikkokuSec = LV.SHIKKOKU_SEC[lv]!;
                fallSpeedBoostUntilRef.current = Math.max(now, fallSpeedBoostUntilRef.current) + shikkokuSec * 1000;
                fallSpeedValueRef.current = LV.SHIKKOKU_FALL[lv]!;
                addScoreMultiplier(scoreMultipliersRef, now, scaleDambourleBonusMultiplier(LV.SHIKKOKU_MULT[lv]!, dambourleUpMultiplier("score_mult_pool_effect_up")), SCORE_MULT_DURATION_LR_SEC * 1000);
                effectLabel = `${shikkokuSec}秒間 落下×${LV.SHIKKOKU_FALL[lv]} / ${SCORE_MULT_DURATION_LR_SEC}秒間 得点×${LV.SHIKKOKU_MULT[lv]}${lvTag}`;
                statusChanged = true;
                break;
              }
              case "other_pink_omo": {
                const pinkOmoSec = LV.PINK_OMO_SEC[lv]!;
                pinkOmoUntilRef.current = Math.max(now, pinkOmoUntilRef.current) + pinkOmoSec * 1000;
                setPinkOmoActive(true);
                effectLabel = `${pinkOmoSec}秒間 ピンクフィルター発動！アイテムが中心へ${lvTag}`;
                statusChanged = true;
                break;
              }
              case "interior_ragby_ar": {
                const ragbySec = LV.RAGBY_SEC[lv]!;
                const ragbySpawn = LV.RAGBY_SPAWN[lv]!;
                spawnRateBoostUntilRef.current = Math.max(now, spawnRateBoostUntilRef.current) + ragbySec * 1000;
                spawnRateBoostValueRef.current = scaleDambourleBonusMultiplier(ragbySpawn, dambourleUpMultiplier("spawn_dynamics_effect_up"));
                effectLabel = `${ragbySec}秒間 アイテム出現量×${ragbySpawn}${lvTag}`;
                statusChanged = true;
                break;
              }
              case "other_ketsunade_a": {
                const ketsunadeSec = LV.KETSUNADE_SEC[lv]!;
                magnetUntilRef.current = Math.max(now, magnetUntilRef.current) + ketsunadeSec * 1000;
                magnetStrengthRef.current = "strong";
                const guard = grantRandomHazardGuard();
                effectLabel = `${ketsunadeSec}秒間 なでなでマグネット / ${guard ? HAZARD_GUARD_LABELS[guard] : "防止アイテムは満タン"}${lvTag}`;
                statusChanged = true;
                break;
              }
              case "other_oyatsu_no_jikan": {
                const rewardPt = LV.OYATSU_PT[lv]!;
                rewardTimeCountRef.current += 1;
                rewardTimeValueRef.current = rewardPt;
                effectLabel = `次の1個 ${rewardPt}pt確定${lvTag}`;
                statusChanged = true;
                break;
              }
              case "other_narcissist_a": {
                const narcissistSec = LV.NARCISSIST_SEC[lv]!;
                narcissistUntilRef.current = Math.max(now, narcissistUntilRef.current) + narcissistSec * 1000;
                effectLabel = `${narcissistSec}秒間 全アイテムのスキルがLv.MAXに${lvTag}`;
                statusChanged = true;
                break;
              }
              case "other_mafia_a": {
                const mafiaMult = LV.MAFIA_MULT[lv]!;
                mafiaDogBonusMultRef.current *= mafiaMult;
                effectLabel = `フレブル数ボーナス×${mafiaMult}（累計×${mafiaDogBonusMultRef.current.toFixed(2)}）${lvTag}`;
                statusChanged = true;
                break;
              }
              default:
                break;
              }
              return { points, effectLabel, statusChanged };
            };

            const mainSkillResult = runItemSkillEffect(skillId, lv, lvTag);
            points += mainSkillResult.points;
            if (mainSkillResult.effectLabel) effectLabel = mainSkillResult.effectLabel;
            if (mainSkillResult.statusChanged) statusChanged = true;

            if (skillId && skillId !== MOCCHURIN_ITEM_ID && mocchurinPendingEchoCountRef.current > 0) {
              mocchurinPendingEchoCountRef.current -= 1;
              const echoResult = runItemSkillEffect(skillId, lv, lvTag);
              points += echoResult.points;
              if (echoResult.effectLabel) {
                effectLabel = effectLabel ? `${effectLabel} / エコー: ${echoResult.effectLabel}` : `エコー: ${echoResult.effectLabel}`;
              }
              if (echoResult.statusChanged) statusChanged = true;
            }

            if (isMystery && effectLabel) effectLabel = `？発動 / ${effectLabel}`;

            const isJust = Math.abs(entity.x - center) <= effBoxHalf * JUST_RADIUS_RATIO;
            if (isJust) {
              points = Math.round(points * JUST_MULTIPLIER);
              effectLabel = effectLabel ? `${effectLabel} / JUST!×${JUST_MULTIPLIER}` : `JUST!×${JUST_MULTIPLIER}`;
            }

            scoreRef.current += points;
            if (entity.kind === "dog") dogCaughtRef.current += 1;
            caughtRef.current += 1;
            setScore(scoreRef.current);
            setCaught(caughtRef.current);
            if (statusChanged) refreshEffectStatus(now);
            showCatch(entity, points, effectLabel);
          } else if (!entity.rimChecked && localY >= OPEN_TOP_LOCAL_Y - 0.02 && localY <= OPEN_BOTTOM_LOCAL_Y + 0.10) {
            const wallInnerPadding = 0.025;
            const leftWallHit = overlap(localHitLeft, localHitRight, 0.045, opening.left + wallInnerPadding) > 0;
            const rightWallHit = overlap(localHitLeft, localHitRight, opening.right - wallInnerPadding, 0.955) > 0;

            if (leftWallHit || rightWallHit) {
              entity.rimChecked = true;
              const side = leftWallHit && !rightWallHit ? "left" : rightWallHit && !leftWallHit ? "right" : entity.x <= center ? "left" : "right";
              const contactLocalX = side === "left" ? opening.left : opening.right;
              const contactX = center - effBoxHalf + contactLocalX * effBoxWidth;
              const impactOffset = clamp((contactX - entity.x) / Math.max(hitboxWidth / 2, 0.001), -1, 1);
              const incomingVx = entity.vx;
              const incomingVy = entity.vy;
              const impactSpeed = Math.hypot(incomingVx, incomingVy);

              let direction: -1 | 1;
              if (impactOffset > 0.06) direction = -1;
              else if (impactOffset < -0.06) direction = 1;
              else if (incomingVx > 0.3) direction = -1;
              else if (incomingVx < -0.3) direction = 1;
              else direction = side === "left" ? 1 : -1;

              const lateralFactor = 0.58 + Math.abs(impactOffset) * 0.62;
              const horizontalSpeed = clamp(impactSpeed * 0.48 * lateralFactor, 6.5, 20);
              const verticalSpeed = clamp(Math.abs(incomingVy) * 0.52 + impactSpeed * 0.10, 7.5, 16);

              entity.status = "bounced";
              entity.vx = direction * horizontalSpeed;
              entity.vy = -verticalSpeed;
              entity.x += direction * Math.max(0.7, hitboxWidth * 0.08);
              entity.spin = clamp(entity.spin + direction * (110 + Math.abs(impactOffset) * 210), -420, 420);
              showImpact(clamp(contactX, 4, 96));
            }
          }
        }

        if (entity.y > 110 || entity.x < -18 || entity.x > 118) {
          continue;
        }
        next.push(entity);
      }

      entitiesRef.current = next;

      const nextIds = new Set(next.map((entity) => entity.id));
      let idsChanged = nextIds.size !== mountedEntityIdsRef.current.size;
      if (!idsChanged) {
        for (const id of nextIds) {
          if (!mountedEntityIdsRef.current.has(id)) {
            idsChanged = true;
            break;
          }
        }
      }
      if (idsChanged) {
        mountedEntityIdsRef.current = nextIds;
        setEntities(next);
      }

      const { w: boardW, h: boardH } = boardSizeRef.current;
      for (const entity of next) {
        const el = entityNodeRefs.current.get(entity.id);
        if (!el) continue;
        const zIndex = entity.enteredOpening && entity.status !== "bounced" ? 40 : 20;
        const px = ((entity.x - entity.spawnX) / 100) * boardW;
        const py = ((entity.y - entity.spawnY) / 100) * boardH;
        el.style.zIndex = String(zIndex);
        el.style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%) rotate(${entity.rotation}deg)`;
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [createEntity, phase, refreshEffectStatus, showCatch, showImpact]);

  useEffect(() => {
    if (phase !== "finished" || !roundIdRef.current) return;
    const roundId = roundIdRef.current;
    let cancelled = false;

    const grantReward = async () => {
      setRewardPending(true);
      setRewardError(null);
      try {
        // ダンボールNo.5「ゲーム終了時コイン増加」：スコアから見込まれるコイン数(100pt=1コイン、
        // /api/coins/item-catchのCOIN_CONVERSION_POINTSと一致させる)の増加分を、既存のbonusCoins
        // 経路（金のボール等と同じ枠）にまとめて上乗せする。MAX_BONUS_COINS_CLIENTを超えると
        // リクエスト自体が失敗する（サーバー側の上限）ため、送信前に必ずクランプする。
        const dambourleEndCoinBonus = dambourleEffectRef.current?.key === "end_coin_bonus"
          ? Math.floor((scoreRef.current / 100) * (dambourleEffectRef.current.percent / 100))
          : 0;
        const bonusCoins = Math.min(MAX_BONUS_COINS_CLIENT, goldBonusCoinsRef.current + dambourleEndCoinBonus);
        const response = await fetch("/api/coins/item-catch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roundId,
            // ダンボール効果の倍率計算で万一端数が残っていても、送信直前に必ず整数へ切り上げる
            // （/api/coins/item-catchはInteger必須のため、端数のままだとリクエスト自体が失敗する）
            score: Math.ceil(scoreRef.current),
            caughtCount: caughtRef.current,
            durationSeconds: ROUND_SECONDS,
            bonusCoins,
          }),
        });
        const payload = (await response.json().catch(() => null)) as { coins?: number; error?: string } | null;
        if (!response.ok) throw new Error(payload?.error ?? "コインを受け取れませんでした。");
        if (cancelled) return;
        setCoinReward(payload?.coins ?? 0);
      } catch (error) {
        if (cancelled) return;
        setRewardError(error instanceof Error ? error.message : "コインを受け取れませんでした。");
      } finally {
        if (!cancelled) setRewardPending(false);
      }
    };

    void grantReward();
    return () => {
      cancelled = true;
    };
  }, [phase]);

  const startGame = useCallback(() => {
    const now = performance.now();
    // No.12「効果ルーレット」はここで対象9種から抽選し、以後このラウンド中は固定する
    dambourleEffectRef.current = resolveDambourleEffect(dambourleEffectPropRef.current);
    timeBonusCutoffSecRef.current = timeBonusCutoffSecDisplay
      * (1 + (dambourleEffectRef.current?.key === "time_bonus_cutoff_up" ? dambourleEffectRef.current.percent : 0) / 100);
    entitiesRef.current = [];
    entityNodeRefs.current.clear();
    mountedEntityIdsRef.current = new Set();
    nextIdRef.current = 1;
    scoreRef.current = 0;
    dogCaughtRef.current = 0;
    caughtRef.current = 0;
    boxXRef.current = 50;
    draggingRef.current = false;
    dragOffsetRef.current = 0;
    roundIdRef.current = crypto.randomUUID();
    nextMultipliersRef.current = [];
    nextBonus5Ref.current = 0;
    nextBonus5ValueRef.current = 5;
    nextBonus10Ref.current = 0;
    rewardTimeCountRef.current = 0;
    nextBonus10ValueRef.current = 10;
    stunGuardRef.current = 0;
    setStunGuard(0);
    boxShrinkGuardRef.current = 0;
    setBoxShrinkGuard(0);
    timeMinusGuardRef.current = 0;
    setTimeMinusGuard(0);
    scoreMultipliersRef.current = [];
    boxWideUntilRef.current = 0;
    boxWideScaleRef.current = BOX_WIDE_SCALE_DEFAULT;
    magnetUntilRef.current = 0;
    magnetStrengthRef.current = "weak";
    pinkOmoUntilRef.current = 0;
    setPinkOmoActive(false);
    urBoostRef.current = 0;
    urBoostDecayNextRef.current = 0;
    fallSpeedBoostUntilRef.current = 0;
    fallSpeedValueRef.current = FALL_SPEED_BOOST;
    poopSuppressUntilRef.current = 0;
    poopFloodRemainingRef.current = 0;
    ikeaUntilRef.current = 0;
    ikeaCountRef.current = 0;
    spawnRateBoostUntilRef.current = 0;
    otherSuppressUntilRef.current = 0;
    otherSuppressValueRef.current = 1;
    highRarityLockUntilRef.current = 0;
    treasureStreakActiveRef.current = false;
    treasureStreakMultRef.current = 1;
    omochiUntilRef.current = 0;
    omochiPtValueRef.current = 10;
    okaeriUntilRef.current = 0;
    okaeriPerCatchValueRef.current = 3;
    hazardShieldUntilRef.current = 0;
    foodScoreMultipliersRef.current = [];
    dogFloodRemainingRef.current = 0;
    personFloodRemainingRef.current = 0;
    clawdBallFloodRemainingRef.current = 0;
    mocchurinPendingEchoCountRef.current = 0;
    goldBonusCoinsRef.current = 0;
    slantBoostUntilRef.current = 0;
    boxShrinkUntilRef.current = 0;
    blackoutUntilRef.current = 0;
    stunUntilRef.current = 0;
    hazardInvertUntilRef.current = 0;
    mirrorInvertPtValueRef.current = 0;
    dogGoldenUntilRef.current = 0;
    dogGoldenPtValueRef.current = 0;
    narcissistUntilRef.current = 0;
    mafiaDogBonusMultRef.current = 1;
    setBlackoutActive(false);
    setStunned(false);
    bagStockRef.current = 0;
    setBagStock(0);
    setEntities([]);
    setBoxX(50);
    setScore(0);
    setCaught(0);
    setTimeLeft(ROUND_SECONDS);
    setFeedback(null);
    setScoreMultiplierTotal(1);
    recentSkillEffectTimersRef.current.forEach((timer) => clearTimeout(timer));
    recentSkillEffectTimersRef.current.clear();
    setRecentSkillEffects([]);
    setImpactX(null);
    setDogBonus(null);
    setCoinReward(null);
    setRewardPending(false);
    setRewardError(null);
    startAtRef.current = now;
    endAtRef.current = now + ROUND_SECONDS * 1000;
    nextSpawnRef.current = now;
    extraSpawnRef.current = now;
    nextClawdSpawnRef.current = now;
    // 装備中ダンボール効果はラウンド開始時から有効なので、最初のcatchを待たず状態表示に反映する
    refreshEffectStatus(now);
    setPhase("playing");
  }, [timeBonusCutoffSecDisplay, refreshEffectStatus]);

  const moveBox = useCallback((clientX: number) => {
    if (performance.now() < stunUntilRef.current) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const pointerX = ((clientX - rect.left) / rect.width) * 100;
    const now = performance.now();
    const boxScale = (now < boxShrinkUntilRef.current ? BOX_SHRINK_SCALE : now < boxWideUntilRef.current ? boxWideScaleRef.current : 1) * dambourleUpMultiplier("box_size_up");
    const dynamicHalf = BOX_HALF * boxScale;
    const nextX = clamp(pointerX - dragOffsetRef.current, dynamicHalf, 100 - dynamicHalf);
    boxXRef.current = nextX;
    setBoxX(nextX);
  }, []);

  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (phase !== "playing") return;
    const catcherRect = catcherRef.current?.getBoundingClientRect();
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!catcherRect || !boardRect || catcherRect.width <= 0 || catcherRect.height <= 0 || boardRect.width <= 0) return;
    const localX = (event.clientX - catcherRect.left) / catcherRect.width;
    const localY = (event.clientY - catcherRect.top) / catcherRect.height;
    if (!isCardboardTap(localX, localY)) return;
    const pointerX = ((event.clientX - boardRect.left) / boardRect.width) * 100;
    dragOffsetRef.current = pointerX - boxXRef.current;
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (phase === "playing" && draggingRef.current && performance.now() >= stunUntilRef.current) moveBox(event.clientX);
  };

  const pointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <section className="rough-card overflow-hidden p-0">
      <div aria-hidden className="hidden">
        {preloadImages.map((src) => (
          <Image key={src} src={src} alt="" width={96} height={96} quality={65} loading="eager" />
        ))}
      </div>

      <div className="flex items-center justify-between border-b border-line bg-card px-4 py-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-ink-faint">MINI GAME</p>
          <h2 className="mt-0.5 text-base font-black text-ink">アイテムキャッチ</h2>
        </div>
        <span className="rounded-full bg-leaf-soft px-2.5 py-1 text-[10px] font-bold text-leaf-deep">50秒チャレンジ</span>
      </div>

      <div
        ref={boardRef}
        className="relative w-full select-none overflow-hidden bg-[#dff3fa]"
        style={{ paddingBottom: "calc(400% / 3 + 30px)" }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#caeef9_0%,#eff9f2_70%,#d9ebbd_100%)]" />
        <div className="absolute -left-8 top-[18%] h-20 w-36 rounded-full bg-white/50 blur-xl will-change-transform" />
        <div className="absolute -right-10 top-[34%] h-24 w-40 rounded-full bg-white/50 blur-xl will-change-transform" />
        <div className="absolute inset-x-0 bottom-0 h-[18%] bg-[linear-gradient(180deg,rgba(208,232,171,0)_0%,#c9e29e_72%,#efdcb8_73%,#e9cfa5_73%,#e9cfa5_100%)]" />

        <div className="absolute left-3 right-3 top-3 z-50 flex items-start justify-between gap-2">
          <div className="flex flex-col items-start gap-1">
            <div className="relative rounded-2xl border border-white/80 bg-white/90 px-3 py-2 shadow-sm">
              <p className="text-[9px] font-bold tracking-widest text-ink-faint">SCORE</p>
              <p className="text-xl font-black tabular-nums text-ink">{score.toLocaleString("ja-JP")}</p>
              {feedback ? <span className="pointer-events-none absolute -right-2 -top-2 rounded-full bg-[#fff6cc]/95 px-2 py-0.5 text-[10px] font-black text-[#c87527] shadow-sm">+{feedback.points}</span> : null}
            </div>
            {scoreMultiplierTotal > 1 ? (
              <span className="rounded-xl border border-[#f4d98f] bg-[#fff6cc]/95 px-2.5 py-1 text-base font-black leading-none text-[#c87527] shadow-sm">
                スコア倍率 ×{formatMultiplierCeil(scoreMultiplierTotal)}
              </span>
            ) : null}
            {bagStock > 0 || stunGuard > 0 || boxShrinkGuard > 0 || timeMinusGuard > 0 ? (
              <div className="flex flex-row items-start gap-1.5">
                {bagStock > 0 ? (
                  <div className="flex flex-col items-start gap-0.5">
                    {Array.from({ length: bagStock }, (_, index) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={index} src={BAG_IMAGE} alt="ビニール袋" width={28} height={28} draggable={false} className="h-6 w-6 object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.25)]" />
                    ))}
                  </div>
                ) : null}
                {stunGuard > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={HAZARD_GUARD_IMAGES.stun} alt={HAZARD_GUARD_LABELS.stun} width={28} height={28} draggable={false} className="h-6 w-6 object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.25)]" />
                ) : null}
                {boxShrinkGuard > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={HAZARD_GUARD_IMAGES.boxShrink} alt={HAZARD_GUARD_LABELS.boxShrink} width={28} height={28} draggable={false} className="h-6 w-6 object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.25)]" />
                ) : null}
                {timeMinusGuard > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={HAZARD_GUARD_IMAGES.timeMinus} alt={HAZARD_GUARD_LABELS.timeMinus} width={28} height={28} draggable={false} className="h-6 w-6 object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.25)]" />
                ) : null}
              </div>
            ) : null}
          </div>
          {recentSkillEffects.length > 0 ? (
            <div className="pointer-events-none flex flex-1 flex-col items-center gap-1 pt-1">
              {recentSkillEffects.map((entry) => (
                <span key={entry.id} className="animate-in fade-in zoom-in-95 rounded-full border border-[#f4d98f] bg-[#fff6cc]/95 px-3 py-1 text-center text-[12px] font-black leading-tight text-[#9a6322] shadow-md">
                  {entry.text}
                </span>
              ))}
            </div>
          ) : (
            <span className="flex-1" />
          )}
          <div className="rounded-2xl border border-white/80 bg-white/90 px-3 py-2 text-right shadow-sm"><p className="text-[9px] font-bold tracking-widest text-ink-faint">TIME</p><p className="text-xl font-black tabular-nums text-ink">{timeLeft}</p></div>
        </div>

        {blackoutActive ? <div className="pointer-events-none absolute inset-x-0 top-0 z-[25] h-1/2 bg-black/95" aria-label="上半分ブラックアウト" /> : null}
        {pinkOmoActive ? <div className="pointer-events-none absolute inset-0 z-[26] bg-pink-300/25" aria-label="ピンクオモ発動中（ピンクフィルター）" /> : null}

        {entities.map((entity) => (
          <FallingEntity
            key={entity.id}
            entity={entity}
            registerRef={(el) => {
              if (el) entityNodeRefs.current.set(entity.id, el);
              else entityNodeRefs.current.delete(entity.id);
            }}
          />
        ))}

        {impactX !== null ? <div className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2 animate-ping text-xl font-black text-[#d7684f]" style={{ left: `${impactX}%`, top: `${BOX_LIP_Y}%` }}>✦</div> : null}
        {feedback ? (
          <div className="pointer-events-none absolute left-1/2 top-[67%] z-40 -translate-x-1/2 text-center">
            <p className="text-lg font-black text-[#c87527]">CATCH!</p>
            <p className="mt-0.5 max-w-40 truncate rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-bold text-ink-soft">{feedback.name}</p>
          </div>
        ) : null}

        <div
          ref={catcherRef}
          role="button"
          aria-label="拾ってくだブーの段ボールを左右に動かす"
          className={`absolute bottom-[0.5%] z-30 touch-none select-none rounded-3xl transition-[width,transform] duration-200 ${performance.now() < magnetUntilRef.current ? "shadow-[0_0_20px_6px_rgba(120,170,240,0.55)] ring-4 ring-sky-300/70" : ""}`}
          style={{
            left: `${boxX}%`,
            width: `${BOX_WIDTH * (performance.now() < boxShrinkUntilRef.current ? BOX_SHRINK_SCALE : performance.now() < boxWideUntilRef.current ? boxWideScaleRef.current : 1) * dambourleUpMultiplier("box_size_up")}%`,
            height: `${BOX_HEIGHT}%`,
            transform: `translateX(-50%) scaleY(${boxBounce ? 1.015 : 1})`,
          }}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerEnd}
          onPointerCancel={pointerEnd}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={equippedBoxImage} alt={equippedBoxAlt} draggable={false} className={`pointer-events-none absolute inset-0 h-full w-full ${performance.now() < boxWideUntilRef.current && performance.now() >= boxShrinkUntilRef.current ? "object-fill" : "object-contain"}`} />
          {stunned ? <span className="pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 text-2xl" aria-label="しびれ中">⚡</span> : null}
        </div>

        {phase === "playing" ? <div className="pointer-events-none absolute bottom-[0.5%] left-1/2 z-40 -translate-x-1/2 rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-bold text-ink-faint">箱を押さえて左右にドラッグ</div> : null}

        {phase !== "playing" ? (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#f9f3e7]/70 px-6 backdrop-blur-[2px]">
            <div className="w-full max-w-xs rounded-[28px] border border-white/90 bg-card/95 p-5 text-center shadow-xl">
              {phase === "finished" ? (
                <>
                  <p className="text-[10px] font-black tracking-[0.18em] text-ink-faint">RESULT</p>
                  <p className="mt-1 text-4xl font-black tabular-nums text-ink">{score.toLocaleString("ja-JP")}</p>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
                    <div className="rounded-xl bg-paper-deep px-2 py-2"><p className="text-[9px] text-ink-faint">キャッチ</p><p className="font-black text-ink">{caught}個</p></div>
                  </div>
                  {dogBonus ? (
                    <div className="mt-2 rounded-xl bg-paper-deep px-3 py-2 text-xs">
                      <p className="text-[9px] text-ink-faint">いつものフレブル ボーナス</p>
                      <p className="mt-0.5 font-black text-ink">{dogBonus.count}匹 × プレイ時間 = <span className="text-leaf-deep">+{dogBonus.bonus.toLocaleString("ja-JP")}pt</span></p>
                    </div>
                  ) : null}
                  <div className="mt-3 rounded-xl bg-[#fff5df] px-3 py-2">
                    {rewardPending ? (
                      <p className="text-[11px] font-bold text-[#8d6231]">コインを受け取り中…</p>
                    ) : rewardError ? (
                      <p className="text-[10px] font-bold text-red-600">{rewardError}</p>
                    ) : (
                      <p className="flex items-center justify-center gap-1 text-sm font-black text-[#8d6231]">獲得コイン <span className="tabular-nums">+{coinReward ?? 0}</span></p>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" onClick={startGame} disabled={rewardPending} className="rounded-full bg-leaf px-3 py-3 text-xs font-black text-white shadow-md active:translate-y-px disabled:opacity-45">もう一度あそぶ</button>
                    <button type="button" onClick={() => router.push("/games")} disabled={rewardPending} className="rounded-full border border-line bg-card px-3 py-3 text-xs font-black text-ink-soft shadow-sm active:translate-y-px disabled:opacity-45">終了する</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[10px] font-black tracking-[0.18em] text-leaf-deep">ITEM CATCH</p>
                  <p className="mt-1 text-xl font-black text-ink">箱でキャッチしよう！</p>
                  <p className="mt-3 text-[9px] text-ink-faint">時間増加系アイテムは{Math.round(timeBonusCutoffSecDisplayWithDambourle)}秒まで出現</p>
                  <button type="button" onClick={startGame} className="mt-1.5 w-full rounded-full bg-leaf px-4 py-3 text-sm font-black text-white shadow-md active:translate-y-px">START</button>
                  {showDambourlePicker ? (
                    <button
                      type="button"
                      onClick={() => router.push("/games/item-catch/dambourle")}
                      className="mt-2 w-full rounded-full border border-line bg-card px-4 py-2 text-xs font-black text-ink-soft shadow-sm active:translate-y-px"
                    >
                      ダンボールを選ぶ
                    </button>
                  ) : null}
                </>
              )}
              <p className="mt-2 text-[9px] text-ink-faint">所持アイテム {itemPool.length}種類 + 初期フレブル</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}