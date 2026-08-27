"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { MAX_SKILL_LEVEL } from "@/lib/gacha/skill-levels";
import { COLLECTION_ITEMS, type CollectionItem } from "@/lib/collection/items";

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

const ROUND_SECONDS = 30;
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
const FALL_SPEED_BOOST = 1.7;
const UR_BOOST_MAX = 30;
const POOP_ITEM_ID = "hazard_poop";
const POOP_IMAGE = "/collection/items/dog-poop.webp";
const POOP_SPAWN_CHANCE = 0.04;
const POOP_PENALTY = 500;
const MYSTERY_ITEM_ID = "mystery_item";
const MYSTERY_IMAGE = "/collection/items/mystery-question.webp";
const MYSTERY_SPAWN_CHANCE = 0.05;
const MYSTERY_BASE_POINTS = 10;
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
/** プレイ60秒経過後、画面上部1/5のアイテムを透明にする */
const TOP_ZONE_HIDDEN_AFTER_SEC = 60;
const TOP_ZONE_HIDDEN_LOCAL_Y = 20;
/** プレイ120秒経過後、画面上部1/4のアイテムを透明にする */
const TOP_ZONE_HIDDEN_AFTER_SEC_2 = 120;
const TOP_ZONE_HIDDEN_LOCAL_Y_2 = 25;
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
/** うんち祭り中の出現レート倍率（通常の4倍の頻度で降ってくる） */
const POOP_FLOOD_SPAWN_RATE = 4;
const NORMAL_ENTITY_CAP = 10;
const DOUBLE_ENTITY_CAP = 15;
const TRIPLE_ENTITY_CAP = 18;
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
  "food_fruit_basket", "interior_gold_ball", "other_clawd", "food_kamikami", "food_mocchurin",
];

/** アイテムごとのLv1〜5パラメータ（item_skill_levels_colored.xlsxの「スキル一覧」シート通り） */
const LV = {
  DUCK_SEC: [2, 3, 4, 5, 6],
  CARROT_SEC: [2, 3, 4, 5, 7],
  FRISBEE_MULT: [2, 2.2, 2.4, 2.7, 3],
  SOCCER_PT: [10, 15, 20, 30, 40],
  TAIYAKI_PT: [5, 7, 10, 13, 15],
  BEAR_PT: [0, 10, 0, 20, 0],
  BOWL_PT: [5, 7, 10, 13, 15],
  PUDDING_PT: [15, 20, 30, 40, 50],
  MELON_SEC: [2, 3, 4, 5, 6],
  MELON_PT: [5, 10, 15, 20, 30],
  TREASURE_LOW: [25, 30, 40, 50, 60],
  TREASURE_HIGH: [50, 65, 80, 100, 130],
  TREASURE_SEC: [3, 4, 5, 6, 8],
  TREASURE_STREAK_PCT: [20, 25, 30, 35, 40],
  FRENCHIE_PLUSH_COUNT: [3, 3, 4, 4, 5],
  FRENCHIE_PLUSH_PT: [10, 13, 15, 20, 25],
  MEAT_SEC: [5, 6, 7, 8, 10],
  MEAT_MULT: [1.5, 1.5, 1.6, 1.7, 1.8],
  CUSHION_PT: [30, 40, 50, 65, 80],
  MACARON_SEC: [3, 4, 5, 6, 8],
  STARWAND_MULT: [2, 2.3, 2.6, 3, 3.5],
  STRAWBERRY_COUNT: [1, 1, 1, 2, 2],
  STRAWBERRY_MULT: [1.5, 1.7, 2, 2, 2.5],
  CUPCAKE_SEC: [4, 5, 6, 7, 10],
  SPRING_SEC: [5, 6, 7, 9, 12],
  SPRING_MULT: [1.2, 1.2, 1.25, 1.3, 1.4],
  SPARKLE_SEC: [4, 5, 6, 8, 10],
  SPARKLE_STRENGTH: ["weak", "weak", "weak", "weak", "medium"] as const,
  RAINBOW_STEP: [10, 12, 15, 20, 25],
  GOLDEN_COUNT: [2, 2, 3, 3, 4],
  GOLDEN_MULT: [2, 2.2, 2.2, 2.5, 2.5],
  NAKAYOSHI_PT: [30, 40, 50, 65, 80],
  KAMUNAYO_SEC: [5, 6, 8, 10, 13],
  KAMUNAYO_MULT: [1.3, 1.35, 1.4, 1.5, 1.6],
  HIKING_SEC: [5, 6, 7, 9, 12],
  SNOW_SEC: [5, 6, 7, 9, 12],
  SUMMER_ADD: [6, 7, 8, 9, 10],
  SUMMER_MULTSEC: [5, 6, 7, 8, 10],
  SUMMER_MULT: [1.5, 1.5, 1.6, 1.7, 1.8],
  ANBALL_PT: [100, 125, 150, 180, 220],
  ANBALL_SEC: [3, 4, 5, 6, 8],
  STRETCH_ROD_MULT: [0.5, 0.4, 0.3, 0.2, 0.1],
  LISTEN_DOG_COUNT: [10, 15, 20, 25, 30],
  AZUBEE_SEC: [6, 7, 8, 10, 12],
  AZUBEE_MULT: [2, 2, 2.1, 2.2, 2.5],
  OMOJII_SEC: [7, 13, 16, 17, 19],
  OMOJII_PT: [30, 45, 60, 80, 100],
  KINOKO_SEC: [6, 7, 8, 10, 12],
  KINOKO_FALL: [1.7, 1.8, 1.9, 2, 2.2],
  KINOKO_SCORE: [1.5, 1.5, 1.6, 1.7, 2],
  KOMOCHI_COUNT: [5, 5, 6, 7, 8],
  KOMOCHI_MULT: [2, 2.1, 2.2, 2.3, 2.5],
  AZUKI_SEC: [5, 8, 10, 11, 12],
  AZUKI_PT: [50, 65, 80, 100, 130],
  KOBEE_PT: [50, 65, 80, 100, 130],
  KOBEE_SEC: [8, 9, 11, 13, 16],
  KOBEE_MULT: [1.4, 1.4, 1.5, 1.5, 1.6],
  HAMIGAKI_SEC: [0, 2, 3, 4, 5],
  HAMIGAKI_PT: [0, 0, 10, 15, 20],
  IKEA_SEC: [4, 5, 6, 7, 8],
  ORUSUBAN_SEC: [5, 6, 7, 8, 10],
  ORUSUBAN_FALL: [1.8, 2, 2.2, 2.4, 2.8],
  PONDEOMO_SEC: [4, 5, 6, 8, 10],
  PONDEAR_SEC: [4, 5, 6, 8, 10],
  JARE_A_SEC: [4, 5, 6, 8, 10],
  SHIKKOKU_SEC: [8, 10, 12, 15, 20],
  SHIKKOKU_FALL: [2, 2.2, 2.4, 2.6, 3],
  SHIKKOKU_MULT: [2, 2.2, 2.4, 2.7, 3],
  RAGBY_SEC: [5, 6, 7, 9, 12],
  OYATSU_PT: [80, 100, 120, 140, 180],
  KETSUNADE_SEC: [4, 5, 6, 8, 10],
  BUREBUR_SEC: [4, 5, 6, 8, 10],
  XMAS_SEC: [6, 7, 9, 10, 12],
  XMAS_FALL: [1.8, 2, 2.2, 2.4, 2.5],
  XMAS_SCORE: [2, 2.2, 2.5, 2.7, 3],
  XMAS_SPAWN: [1.5, 1.6, 1.7, 1.8, 2],
  XMAS_DOG_COUNT: [5, 6, 7, 8, 9],
  OMOCHI_SEC: [4, 5, 6, 8, 10],
  OMOCHI_PT: [10, 15, 20, 25, 30],
  OKAERI_SEC: 3,
  OKAERI_PER_CATCH: [3, 4, 5, 6, 7],
  OMOI_BASHIRA_SEC: [4, 5, 6, 8, 10],
  OYASUMI_MULT: [3, 3.5, 4, 4.5, 6],
  NISOKU_A_SEC: [4, 5, 6, 7, 8],
  NISOKU_A_MULT: [3, 3.5, 4, 4.5, 5],
  FRUIT_BASKET_COUNT: [2, 3, 4, 5, 6],
  GOLD_BALL_COINS: [10, 15, 20, 30, 50],
  CLAWD_BALL_COUNT: [5, 8, 10, 12, 14],
  KAMIKAMI_PT: [10, 15, 25, 35, 45],
  MOCCHURIN_PT: [30, 45, 60, 80, 100],
  TIME_BONUS_FALL: [6, 5.6, 5.2, 4.8, 4.5],
} as const;
/** 出現量アップ系は時間増加系アイテムの取得率まで底上げしてしまうため、控えめな倍率にしている */
const SPAWN_RATE_BOOST = 1.5;
const SLANT_VX_BOOST = 3.5;
const RAGBY_SPAWN_RATE_BOOST = 2;
const POINTS: Record<FrenchieCatchItem["rarity"], number> = { N: 10, R: 20, SR: 40, SSR: 70, UR: 100, LR: 150, MR: 220 };
const RARITY_FALL_SPEED: Record<FrenchieCatchItem["rarity"], number> = { N: 1, R: 1.08, SR: 1.18, SSR: 1.32, UR: 1.5, LR: 1.75, MR: 2 };
/** 時間が増えるスキルを持つアイテムだけ、落下速度をレアリティ別倍率で上げる */
const TIME_BONUS_ITEM_IDS = new Set([
  "toy_duck_plush", "toy_carrot", "food_paw_melon_bread",
  "interior_anball", "other_omojii", "other_azuki", "summer_frenchie",
]);
const TREASURE_ITEM_ID = "toy_treasure_puzzle";
const TREASURE_FALL_SPEED = 4;
const POOP_FLOOD_FALL_SPEED = 6;
const TREASURE_POOP_FLOOD_COUNT = 10;
const DOG_FLOOD_ITEM_ID = "other_listen_to_the_a";
const DOG_FLOOD_SPAWN_RATE = 4;
const DOG_FLOOD_FALL_SPEED = 2.5;
const TREASURE_MINUS5_SEC = 5;
const TREASURE_DOUBLE_MULT = 2;
/** 宝箱の中身抽選（8択）。合計100、ハズレ(うんち祭り+マイナス秒)は合計20 */
const TREASURE_OUTCOME_WEIGHTS: { outcome: string; weight: number }[] = [
  { outcome: "low_pt", weight: 17 },
  { outcome: "high_pt", weight: 10 },
  { outcome: "time_plus", weight: 15 },
  { outcome: "poop_flood", weight: 10 },
  { outcome: "time_minus5", weight: 10 },
  { outcome: "item_double", weight: 15 },
  { outcome: "rare_lock", weight: 15 },
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
 * 出現量アップ系スキル（宝箱の1/7枠・ぽんでおも・ぽんでアー・じゃれアー・ラグビーアー）は
 * スポーン間隔そのものを割るため、有効中は時間増加系アイテムの取得率まで一緒に底上げしてしまう。
 * 何もしないとLv5でr(1秒あたりの時間増加率)が1を超え、理論上ゲームが終わらなくなる。
 * そのため出現量アップの倍率を抑えた上（SPAWN_RATE_BOOST/RAGBY_SPAWN_RATE_BOOST参照）、
 * 時間増加系7種＋おもじぃの出現重みをさらに下げて、Lv5でも最終プレイ時間が180秒程度に収まるよう調整している。
 * （出現量アップ側の重み・秒数を下げると、浮いた確率が時間増加系側に再配分されてかえって悪化するため、
 * 　時間増加系側の重みを絞るのが正しいレバーだった）
 *
 * other_listen_to_the_a（LR、一撃で大量スコアが出やすいため出現重みを半分に調整）は
 * 時間・出現量には無関係だが、重みを下げた分だけプール全体の合計重みが減り、他アイテムの
 * 取得確率が僅かに底上げされてLv5の最終プレイ時間が180秒を超えてしまう。
 * そのため上と同じ「時間増加系7種＋宝箱」の重みを底上げ分だけ相殺し、Lv5の時間増加を打ち消している。
 *
 * food_fruit_basket（SR、時間・出現量のどちらにも無関係）を追加した際も、プール総数(N)が
 * 78→79に増えたことで既存アイテムの取得確率が薄まり、Lv5の最終プレイ時間期待値が175秒→約166秒に
 * 短縮されてしまっていた。docs/minigame-time-balance.md の手順どおり「時間増加系7種の重みを
 * プール総数の増加率だけ底上げする」方針で、64.4→65.5・80.3→81.6（6種）に変更して相殺済み。
 *
 * interior_gold_ball（SSR、時間・出現量のどちらにも無関係）を追加した際も同様に、
 * プール総数(N)が79→80に増えたことでLv5の最終プレイ時間期待値が175秒→約166秒に短縮されて
 * いたため、時間増加系7種の重みを65.5→66.6・81.6→82.9（6種）に変更して相殺済み。
 *
 * other_clawd（SSR、時間・出現量のどちらにも無関係）を追加した際も同様に、プール総数(N)が
 * 80→81に増えたため、時間増加系7種の重みをプール総数の増加率（Total(81)/Total(80)≈1.0126）
 * だけ底上げして相殺し、66.6→67.4・82.9→83.9（6種）に変更した。
 *
 * food_kamikami（R、時間・出現量のどちらにも無関係）を追加した際も同様に、プール総数(N)が
 * 81→82に増えたため、時間増加系7種の重みをプール総数の増加率（Total(82)/Total(81)≈1.0124）
 * だけ底上げして相殺し、67.4→68.2・83.9→84.9（6種）に変更した。
 *
 * food_mocchurin（SSR、時間・出現量のどちらにも無関係。直前に捕まえたアイテムのスキルを
 * 確率でもう一度発動する「エコー」系）を追加した際も同様に、プール総数(N)が82→83に増えたため、
 * 時間増加系7種の重みをプール総数の増加率（Total(83)/Total(82)≈1.0123）だけ底上げして相殺し、
 * 68.2→69.0・84.9→85.9（6種）に変更した。
 */
const ITEM_SPAWN_WEIGHTS: Partial<Record<string, number>> = {
  toy_treasure_puzzle: 200,
  other_omojii: 69.0,
  toy_duck_plush: 85.9,
  toy_carrot: 85.9,
  food_paw_melon_bread: 85.9,
  interior_anball: 85.9,
  other_azuki: 85.9,
  summer_frenchie: 85.9,
  other_listen_to_the_a: 50,
};
const STRETCH_ROD_ITEM_ID = "interior_stretch_rod";
const STRETCH_ROD_SECONDS = 3;
const BUREBUR_ITEM_ID = "other_burebur";
const XMAS_PARTY_ITEM_ID = "other_xmas_party";
const OMOCHI_ITEM_ID = "other_omochi_janai";
const OKAERI_ITEM_ID = "other_okaeri";
const OMOI_BASHIRA_ITEM_ID = "other_omoi_bashira";
const OYASUMI_ITEM_ID = "other_oyasumi";
const OYASUMI_SECONDS = 5;
const NISOKU_A_ITEM_ID = "other_nisoku_a";
const FRUIT_BASKET_ITEM_ID = "food_fruit_basket";
const GOLD_BALL_ITEM_ID = "interior_gold_ball";
/** フルーツバスケットの効果中に降ってくる「人物の入ったキャラ」。本来のレアリティ・スキルのまま出現する */
const PERSON_CHARACTER_ITEM_IDS = ["other_omochi_janai", "other_listen_to_the_a", "other_omoi_bashira", "other_xmas_party"];
const PERSON_CHARACTER_ITEMS: CollectionItem[] = PERSON_CHARACTER_ITEM_IDS
  .map((id) => COLLECTION_ITEMS.find((entry) => entry.id === id))
  .filter((entry): entry is CollectionItem => entry != null);
const CLAWD_ITEM_ID = "other_clawd";
/** Clawdの効果中に降ってくる「サッカーボール／ゴールドボール」。本来のレアリティ・スキルのまま出現する */
const CLAWD_SOCCER_BALL_ITEM = COLLECTION_ITEMS.find((entry) => entry.id === "toy_soccer_ball") ?? null;
const CLAWD_GOLD_BALL_ITEM = COLLECTION_ITEMS.find((entry) => entry.id === "interior_gold_ball") ?? null;
/** 降ってくるボールのうちゴールドボールになる確率 */
const CLAWD_GOLD_BALL_CHANCE = 0.2;
const MOCCHURIN_ITEM_ID = "food_mocchurin";
/** Lv4(lv index=3)以降は直前に捕まえた2つ分のスキルをエコーする */
const MOCCHURIN_DOUBLE_ECHO_MIN_LV = 3;
/** ブレブルの効果中、このレアリティ以外のアイテムは出現しなくなる */
const HIGH_RARITY_LOCK_RARITIES = new Set<FrenchieCatchItem["rarity"]>(["SSR", "UR", "LR"]);
const OTHER_CATEGORY_ITEM_IDS = new Set(
  COLLECTION_ITEMS.filter((entry) => entry.category === "other").map((entry) => entry.id),
);
const FOOD_CATEGORY_ITEM_IDS = new Set(
  COLLECTION_ITEMS.filter((entry) => entry.category === "food").map((entry) => entry.id),
);
const DOG_SPAWN_RATIO = 0.28;
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
        left: `${entity.x}%`,
        top: `${entity.y}%`,
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

export function FrenchieCatchGame({ ownedItems }: { ownedItems: FrenchieCatchItem[] }) {
  const router = useRouter();
  const boardRef = useRef<HTMLDivElement | null>(null);
  const catcherRef = useRef<HTMLDivElement | null>(null);
  const entitiesRef = useRef<Entity[]>([]);
  const entityNodeRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const mountedEntityIdsRef = useRef<Set<number>>(new Set());
  const draggingRef = useRef(false);
  const dragOffsetRef = useRef(0);
  const boxXRef = useRef(50);
  const nextIdRef = useRef(1);
  const startAtRef = useRef(0);
  const endAtRef = useRef(0);
  const nextSpawnRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const scoreRef = useRef(0);
  const dogCaughtRef = useRef(0);
  const caughtRef = useRef(0);
  const roundIdRef = useRef<string | null>(null);
  const nextMultiplierRef = useRef(1);
  const nextMultiplierCountRef = useRef(0);
  const nextBonus5Ref = useRef(0);
  const nextBonus5ValueRef = useRef(5);
  const nextBonus10Ref = useRef(0);
  const nextBonus10ValueRef = useRef(10);
  const rewardTimeCountRef = useRef(0);
  const rewardTimeValueRef = useRef(0);
  const stunGuardRef = useRef(0);
  const boxShrinkGuardRef = useRef(0);
  const timeMinusGuardRef = useRef(0);
  const multiplier15UntilRef = useRef(0);
  const multiplier15ValueRef = useRef(1.5);
  const multiplier2UntilRef = useRef(0);
  const multiplier2ValueRef = useRef(2);
  const boxWideUntilRef = useRef(0);
  const boxWideScaleRef = useRef(BOX_WIDE_SCALE_DEFAULT);
  const magnetUntilRef = useRef(0);
  const magnetStrengthRef = useRef<"weak" | "medium" | "strong">("weak");
  const urBoostRef = useRef(0);
  const fallSpeedBoostUntilRef = useRef(0);
  const fallSpeedValueRef = useRef(FALL_SPEED_BOOST);
  const poopSuppressUntilRef = useRef(0);
  const poopFloodRemainingRef = useRef(0);
  const ikeaUntilRef = useRef(0);
  const ikeaCountRef = useRef(0);
  const bagStockRef = useRef(0);
  const spawnRateBoostUntilRef = useRef(0);
  const spawnRateBoostValueRef = useRef(SPAWN_RATE_BOOST);
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
  const nisokuUntilRef = useRef(0);
  const nisokuMultValueRef = useRef(3);
  const dogFloodRemainingRef = useRef(0);
  const personFloodRemainingRef = useRef(0);
  const clawdBallFloodRemainingRef = useRef(0);
  /** もっちゅりんのエコー用に、直前に捕まえたアイテムを新しい順に最大2件保持する */
  const lastSkillCatchesRef = useRef<{ itemId: string; level: number }[]>([]);
  const goldBonusCoinsRef = useRef(0);
  const slantBoostUntilRef = useRef(0);
  const boxShrinkUntilRef = useRef(0);
  const blackoutUntilRef = useRef(0);
  const stunUntilRef = useRef(0);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const impactTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentSkillEffectIdRef = useRef(0);
  const recentSkillEffectTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

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
  const [activeEffects, setActiveEffects] = useState<string[]>([]);
  const [recentSkillEffects, setRecentSkillEffects] = useState<RecentSkillEffect[]>([]);
  const [impactX, setImpactX] = useState<number | null>(null);
  const [boxBounce, setBoxBounce] = useState(false);
  const [blackoutActive, setBlackoutActive] = useState(false);
  const [stunned, setStunned] = useState(false);
  const [dogBonus, setDogBonus] = useState<{ count: number; bonus: number } | null>(null);
  const [coinReward, setCoinReward] = useState<number | null>(null);
  const [rewardPending, setRewardPending] = useState(false);
  const [rewardError, setRewardError] = useState<string | null>(null);

  const itemPool = useMemo(() => ownedItems.filter((item) => item.image.length > 0), [ownedItems]);
  const itemLevelByIdRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    itemLevelByIdRef.current = new Map(ownedItems.map((item) => [item.id, item.level]));
  }, [ownedItems]);

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
    const labels: string[] = [];
    if (now < multiplier2UntilRef.current) labels.push(`得点 ×${multiplier2ValueRef.current}`);
    else if (now < multiplier15UntilRef.current) labels.push(`得点 ×${multiplier15ValueRef.current}`);
    if (nextMultiplierCountRef.current > 0) labels.push(`次の${nextMultiplierCountRef.current}個 ×${nextMultiplierRef.current}`);
    if (nextBonus10Ref.current > 0) labels.push(`あと${nextBonus10Ref.current}個 +10pt`);
    if (rewardTimeCountRef.current > 0) labels.push(`次の1個 ${rewardTimeValueRef.current}pt確定`);
    if (nextBonus5Ref.current > 0) labels.push(`あと${nextBonus5Ref.current}個 +5pt`);
    if (stunGuardRef.current > 0) labels.push(HAZARD_GUARD_LABELS.stun);
    if (boxShrinkGuardRef.current > 0) labels.push(HAZARD_GUARD_LABELS.boxShrink);
    if (timeMinusGuardRef.current > 0) labels.push(HAZARD_GUARD_LABELS.timeMinus);
    if (now < magnetUntilRef.current) labels.push(magnetStrengthRef.current === "weak" ? "ミニマグネット発動中" : "マグネット発動中");
    if (now < fallSpeedBoostUntilRef.current) labels.push("落下速度アップ中");
    if (now < poopSuppressUntilRef.current) labels.push("うんち出現なし");
    if (poopFloodRemainingRef.current > 0) labels.push(`うんち祭り あと${poopFloodRemainingRef.current}個`);
    if (dogFloodRemainingRef.current > 0) labels.push(`フレブル大量発生 あと${dogFloodRemainingRef.current}体`);
    if (personFloodRemainingRef.current > 0) labels.push(`人物入りキャラ大量発生 あと${personFloodRemainingRef.current}体`);
    if (clawdBallFloodRemainingRef.current > 0) labels.push(`サッカーボール/ゴールドボール大量発生 あと${clawdBallFloodRemainingRef.current}個`);
    if (now < ikeaUntilRef.current) labels.push(`くみたて中 ${ikeaCountRef.current}個`);
    if (now < spawnRateBoostUntilRef.current) labels.push(`アイテム出現量×${spawnRateBoostValueRef.current}中`);
    if (now < otherSuppressUntilRef.current) labels.push(`その他カテゴリ出現×${otherSuppressValueRef.current}中`);
    if (now < highRarityLockUntilRef.current) labels.push("SSR/UR/LRのみ出現中");
    if (treasureStreakActiveRef.current) labels.push(`宝箱連続ボーナス 得点+${Math.round((treasureStreakMultRef.current - 1) * 100)}%`);
    if (now < omochiUntilRef.current) labels.push(`うんちがおもちに +${omochiPtValueRef.current}pt`);
    if (now < okaeriUntilRef.current) labels.push(`1個ごとに+${okaeriPerCatchValueRef.current}秒`);
    if (now < hazardShieldUntilRef.current) labels.push("ハザード出現なし");
    if (now < nisokuUntilRef.current) labels.push(`食べ物カテゴリ得点×${nisokuMultValueRef.current}中`);
    if (now < slantBoostUntilRef.current) labels.push("斜め落下中");
    if (now < boxShrinkUntilRef.current) labels.push("ダンボール0.8倍");
    else if (now < boxWideUntilRef.current) labels.push(`ダンボール×${boxWideScaleRef.current}拡大中`);
    if (now < blackoutUntilRef.current) labels.push("上半分ブラックアウト中");
    if (now - startAtRef.current > TOP_ZONE_HIDDEN_AFTER_SEC_2 * 1000) labels.push("画面上部1/4が見えない");
    else if (now - startAtRef.current > TOP_ZONE_HIDDEN_AFTER_SEC * 1000) labels.push("画面上部が見えない");
    if (now < stunUntilRef.current) labels.push("しびれ中");
    if (urBoostRef.current > 0) labels.push(`UR出現率+${Math.min(urBoostRef.current, UR_BOOST_MAX)}`);
    setActiveEffects(labels);
  }, []);

  const createEntity = useCallback((): Entity => {
    const fallSpeedBoost = performance.now() < fallSpeedBoostUntilRef.current ? fallSpeedValueRef.current : 1;
    const slantBoost = performance.now() < slantBoostUntilRef.current ? SLANT_VX_BOOST : 1;
    const rawVy = (17 + Math.random() * 5) * 1.35;
    const base = {
      id: nextIdRef.current++,
      x: 9 + Math.random() * 82,
      y: -13 - Math.random() * 5,
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

    if (personFloodRemainingRef.current > 0 && PERSON_CHARACTER_ITEMS.length > 0) {
      personFloodRemainingRef.current -= 1;
      const character = PERSON_CHARACTER_ITEMS[Math.floor(Math.random() * PERSON_CHARACTER_ITEMS.length)]!;
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

    if (clawdBallFloodRemainingRef.current > 0 && (CLAWD_SOCCER_BALL_ITEM || CLAWD_GOLD_BALL_ITEM)) {
      clawdBallFloodRemainingRef.current -= 1;
      const rollGold = Math.random() < CLAWD_GOLD_BALL_CHANCE;
      const ball = (rollGold ? CLAWD_GOLD_BALL_ITEM : CLAWD_SOCCER_BALL_ITEM) ?? CLAWD_SOCCER_BALL_ITEM ?? CLAWD_GOLD_BALL_ITEM!;
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
        size: 12 + Math.random() * 3,
        spin: (Math.random() - 0.5) * 40,
      };
    }
    if (hazardRoll < POOP_SPAWN_CHANCE + MYSTERY_SPAWN_CHANCE) {
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
    if (hazardRoll < POOP_SPAWN_CHANCE + MYSTERY_SPAWN_CHANCE + BAG_SPAWN_CHANCE && bagStockRef.current < BAG_MAX_STOCK) {
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
    const timeMinusChance = TIME_MINUS_SPAWN_CHANCE * timeMinusWeightFactor;
    const timeMinusThreshold = POOP_SPAWN_CHANCE + MYSTERY_SPAWN_CHANCE + BAG_SPAWN_CHANCE + timeMinusChance;
    const shrinkThreshold = timeMinusThreshold + BOX_SHRINK_SPAWN_CHANCE;
    const blackoutThreshold = shrinkThreshold + BLACKOUT_SPAWN_CHANCE;
    const stunThreshold = blackoutThreshold + STUN_SPAWN_CHANCE;
    const chocolateThreshold = stunThreshold + CHOCOLATE_SPAWN_CHANCE;
    if (!hazardShieldActive && hazardRoll < timeMinusThreshold) return { ...base, itemId: TIME_MINUS_ITEM_ID, kind: "item", name: "時間 -3秒", image: TIME_MINUS_IMAGE, rarity: null, level: 0, vy: base.vy * TIME_MINUS_FALL_SPEED, size: 13 + Math.random() * 3, spin: (Math.random() - 0.5) * 28 };
    if (!hazardShieldActive && hazardRoll < shrinkThreshold) return { ...base, itemId: BOX_SHRINK_ITEM_ID, kind: "item", name: "ダンボール縮小", image: BOX_SHRINK_IMAGE, rarity: null, level: 0, size: 13 + Math.random() * 3, spin: (Math.random() - 0.5) * 28 };
    if (!hazardShieldActive && hazardRoll < blackoutThreshold) return { ...base, itemId: BLACKOUT_ITEM_ID, kind: "item", name: "イカスミ", image: BLACKOUT_IMAGE, rarity: null, level: 0, size: 14 + Math.random() * 3, spin: (Math.random() - 0.5) * 22 };
    if (!hazardShieldActive && hazardRoll < stunThreshold) return { ...base, itemId: STUN_ITEM_ID, kind: "item", name: "しびれバッテリー", image: STUN_IMAGE, rarity: null, level: 0, size: 12.5 + Math.random() * 3, spin: (Math.random() - 0.5) * 30 };
    if (!hazardShieldActive && hazardRoll < chocolateThreshold) return { ...base, itemId: CHOCOLATE_ITEM_ID, kind: "item", name: "呪いのチョコレート", image: CHOCOLATE_IMAGE, rarity: null, level: 0, size: 13.5 + Math.random() * 3, spin: (Math.random() - 0.5) * 26 };

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
    const weightedItems = itemPool.map((item) => ({
      item,
      weight:
        (ITEM_SPAWN_WEIGHTS[item.id] ?? DEFAULT_ITEM_SPAWN_WEIGHT) *
        (item.rarity === "UR" ? urBoostFactor : 1) *
        (otherSuppressActive && item.id !== STRETCH_ROD_ITEM_ID && OTHER_CATEGORY_ITEM_IDS.has(item.id)
          ? otherSuppressValueRef.current
          : 1) *
        (highRarityLockActive && !HIGH_RARITY_LOCK_RARITIES.has(item.rarity) ? 0 : 1),
    }));
    const itemWeightTotal = weightedItems.reduce((sum, entry) => sum + entry.weight, 0);
    const dogWeight = itemPool.length * DEFAULT_ITEM_SPAWN_WEIGHT * (DOG_SPAWN_RATIO / (1 - DOG_SPAWN_RATIO));
    let roll = Math.random() * (dogWeight + itemWeightTotal);

    if (roll < dogWeight) {
      const skinPool = itemPool.filter((item) => FRENCHIE_SKIN_IDS.includes(item.id));
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
      const dogBonusPoints = Math.floor(dogCount * playSeconds);
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
      if (multiplier2UntilRef.current > 0 && now >= multiplier2UntilRef.current) {
        multiplier2UntilRef.current = 0;
        timedEffectChanged = true;
      }
      if (multiplier15UntilRef.current > 0 && now >= multiplier15UntilRef.current) {
        multiplier15UntilRef.current = 0;
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
          const ikeaBonus = ikeaCount * 10;
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
        : now < spawnRateBoostUntilRef.current ? spawnRateBoostValueRef.current : 1;
      const entityCap = spawnRate >= 3 ? TRIPLE_ENTITY_CAP : spawnRate >= 2 ? DOUBLE_ENTITY_CAP : NORMAL_ENTITY_CAP;
      if (now >= nextSpawnRef.current && entitiesRef.current.length < entityCap) {
        entitiesRef.current.push(createEntity());
        nextSpawnRef.current = now + (SPAWN_INTERVAL_MIN_MS + Math.random() * (SPAWN_INTERVAL_MAX_MS - SPAWN_INTERVAL_MIN_MS)) / spawnRate;
      }

      const boxWide = now < boxWideUntilRef.current;
      const boxShrink = now < boxShrinkUntilRef.current;
      const effectiveBoxScale = boxShrink ? BOX_SHRINK_SCALE : boxWide ? boxWideScaleRef.current : 1;
      const effBoxHalf = BOX_HALF * effectiveBoxScale;
      const effBoxWidth = BOX_WIDTH * effectiveBoxScale;
      const magnetActive = now < magnetUntilRef.current;
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
                scoreRef.current = Math.max(0, scoreRef.current - POOP_PENALTY);
                setScore(scoreRef.current);
                showCatch(entity, -POOP_PENALTY, "うんちを踏んじゃった…");
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
              if (entity.itemId === TIME_MINUS_ITEM_ID) {
                if (timeMinusGuardRef.current > 0) {
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
                if (boxShrinkGuardRef.current > 0) {
                  boxShrinkGuardRef.current = 0;
                  setBoxShrinkGuard(0);
                  showCatch(entity, 0, `${HAZARD_GUARD_LABELS.boxShrink}で無効化！`);
                } else {
                  boxShrinkUntilRef.current = now + BOX_SHRINK_SECONDS * 1000;
                  showCatch(entity, 0, BOX_SHRINK_SECONDS + "秒間 ダンボール0.8倍");
                }
              } else if (entity.itemId === BLACKOUT_ITEM_ID) {
                blackoutUntilRef.current = now + BLACKOUT_SECONDS * 1000;
                setBlackoutActive(true);
                showCatch(entity, 0, BLACKOUT_SECONDS + "秒間 上半分が見えない！");
              } else if (entity.itemId === STUN_ITEM_ID) {
                if (stunGuardRef.current > 0) {
                  stunGuardRef.current = 0;
                  setStunGuard(0);
                  showCatch(entity, 0, `${HAZARD_GUARD_LABELS.stun}で無効化！`);
                } else {
                  stunUntilRef.current = now + STUN_SECONDS * 1000;
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
              ? 15
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

            const timedMultiplier = now < multiplier2UntilRef.current
              ? multiplier2ValueRef.current
              : now < multiplier15UntilRef.current
                ? multiplier15ValueRef.current
                : 1;
            let nextMultiplier = 1;
            if (nextMultiplierCountRef.current > 0) {
              nextMultiplier = nextMultiplierRef.current;
              nextMultiplierCountRef.current -= 1;
              if (nextMultiplierCountRef.current === 0) nextMultiplierRef.current = 1;
              statusChanged = true;
            }
            const foodMultiplier = now < nisokuUntilRef.current && FOOD_CATEGORY_ITEM_IDS.has(entity.itemId ?? "")
              ? nisokuMultValueRef.current
              : 1;
            const streakMultiplier = treasureStreakActiveRef.current ? treasureStreakMultRef.current : 1;
            const multiplier = Math.max(timedMultiplier, nextMultiplier, foodMultiplier, streakMultiplier);
            let points = Math.round((basePoints + pendingBonus) * multiplier);
            let effectLabel: string | undefined;

            if (now < ikeaUntilRef.current) {
              ikeaCountRef.current += 1;
              statusChanged = true;
            }

            const isMystery = entity.itemId === MYSTERY_ITEM_ID;
            const skillId = isMystery
              ? MYSTERY_SKILL_ITEM_IDS[Math.floor(Math.random() * MYSTERY_SKILL_ITEM_IDS.length)]!
              : entity.itemId;
            const skillLevel = isMystery
              ? (itemLevelByIdRef.current.get(skillId ?? "") ?? 1)
              : (entity.level || 1);
            const lv = clamp(skillLevel, 1, MAX_SKILL_LEVEL) - 1;

            const addBonusTime = (seconds: number) => {
              endAtRef.current += seconds * 1000;
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

            const lvTag = skillLevel >= MAX_SKILL_LEVEL ? " [Lv.MAX]" : skillLevel > 1 ? ` [Lv${skillLevel}]` : "";

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
                nextMultiplierRef.current = LV.FRISBEE_MULT[lv]!;
                nextMultiplierCountRef.current = 1;
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
                multiplier15UntilRef.current = now + LV.MEAT_SEC[lv]! * 1000;
                multiplier15ValueRef.current = LV.MEAT_MULT[lv]!;
                effectLabel = `${LV.MEAT_SEC[lv]}秒間 ×${LV.MEAT_MULT[lv]}${lvTag}`;
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
                  multiplier15UntilRef.current = now + LV.TREASURE_SEC[lv]! * 1000;
                  multiplier15ValueRef.current = TREASURE_DOUBLE_MULT;
                  effectLabel = `宝箱 ${LV.TREASURE_SEC[lv]}秒間 得点×${TREASURE_DOUBLE_MULT}${lvTag}`;
                  statusChanged = true;
                } else if (outcome === "rare_lock") {
                  highRarityLockUntilRef.current = now + LV.TREASURE_SEC[lv]! * 1000;
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
                effectLabel = `UR出現率 +${LV.RAINBOW_STEP[lv]}（ゲーム終了まで）${lvTag}`;
                statusChanged = true;
                break;
              case "toy_golden_crown_ball":
                nextMultiplierRef.current = LV.GOLDEN_MULT[lv]!;
                nextMultiplierCountRef.current = LV.GOLDEN_COUNT[lv]!;
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
                otherSuppressUntilRef.current = now + STRETCH_ROD_SECONDS * 1000;
                otherSuppressValueRef.current = LV.STRETCH_ROD_MULT[lv]!;
                effectLabel = `${STRETCH_ROD_SECONDS}秒間 その他×${LV.STRETCH_ROD_MULT[lv]}${lvTag}`;
                statusChanged = true;
                break;
              case BUREBUR_ITEM_ID:
                highRarityLockUntilRef.current = now + LV.BUREBUR_SEC[lv]! * 1000;
                effectLabel = `${LV.BUREBUR_SEC[lv]}秒間 SSR/UR/LRのみ出現${lvTag}`;
                statusChanged = true;
                break;
              case XMAS_PARTY_ITEM_ID: {
                const xmasSec = LV.XMAS_SEC[lv]!;
                fallSpeedBoostUntilRef.current = now + xmasSec * 1000;
                fallSpeedValueRef.current = LV.XMAS_FALL[lv]!;
                multiplier15UntilRef.current = now + xmasSec * 1000;
                multiplier15ValueRef.current = LV.XMAS_SCORE[lv]!;
                spawnRateBoostUntilRef.current = now + xmasSec * 1000;
                spawnRateBoostValueRef.current = LV.XMAS_SPAWN[lv]!;
                dogFloodRemainingRef.current += LV.XMAS_DOG_COUNT[lv]!;
                effectLabel = `${xmasSec}秒間 落下×${LV.XMAS_FALL[lv]}+得点×${LV.XMAS_SCORE[lv]}+出現量×${LV.XMAS_SPAWN[lv]} / フレブル${LV.XMAS_DOG_COUNT[lv]}体${lvTag}`;
                statusChanged = true;
                break;
              }
              case DOG_FLOOD_ITEM_ID:
                dogFloodRemainingRef.current += LV.LISTEN_DOG_COUNT[lv]!;
                effectLabel = `フレブル${LV.LISTEN_DOG_COUNT[lv]}体 大量発生${lvTag}`;
                statusChanged = true;
                break;
              case "other_azubee":
                multiplier2UntilRef.current = now + LV.AZUBEE_SEC[lv]! * 1000;
                multiplier2ValueRef.current = LV.AZUBEE_MULT[lv]!;
                effectLabel = `${LV.AZUBEE_SEC[lv]}秒間 ×${LV.AZUBEE_MULT[lv]}${lvTag}`;
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
              case MOCCHURIN_ITEM_ID:
                points += LV.MOCCHURIN_PT[lv]!;
                effectLabel = `+${LV.MOCCHURIN_PT[lv]}ptボーナス${lvTag}`;
                break;
              case "food_paw_melon_bread": {
                const applied = addBonusTime(LV.MELON_SEC[lv]!);
                points += LV.MELON_PT[lv]!;
                effectLabel = `+${applied}秒 / +${LV.MELON_PT[lv]}pt${lvTag}`;
                break;
              }
              case "food_paw_cupcake":
                boxWideUntilRef.current = now + LV.CUPCAKE_SEC[lv]! * 1000;
                boxWideScaleRef.current = BOX_WIDE_SCALE_DEFAULT;
                effectLabel = `${LV.CUPCAKE_SEC[lv]}秒間 ダンボール1.5倍拡大${lvTag}`;
                statusChanged = true;
                break;
              case "toy_paw_macaron":
                boxWideUntilRef.current = now + LV.MACARON_SEC[lv]! * 1000;
                boxWideScaleRef.current = BOX_WIDE_SCALE_DEFAULT;
                effectLabel = `${LV.MACARON_SEC[lv]}秒間 ダンボール1.5倍拡大${lvTag}`;
                statusChanged = true;
                break;
              case "food_strawberry_roll_cake":
                nextMultiplierRef.current = LV.STRAWBERRY_MULT[lv]!;
                nextMultiplierCountRef.current = LV.STRAWBERRY_COUNT[lv]!;
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
              case "interior_sleepy_moon": {
                const guard = grantRandomHazardGuard();
                effectLabel = `${guard ? HAZARD_GUARD_LABELS[guard] : "防止アイテムは満タン"}${lvTag}`;
                statusChanged = true;
                break;
              }
              case "interior_spring_flower_wreath":
                multiplier15UntilRef.current = now + LV.SPRING_SEC[lv]! * 1000;
                multiplier15ValueRef.current = LV.SPRING_MULT[lv]!;
                effectLabel = `${LV.SPRING_SEC[lv]}秒間 ×${LV.SPRING_MULT[lv]}${lvTag}`;
                statusChanged = true;
                break;
              case "other_sparkle_rope_crown":
                magnetUntilRef.current = now + LV.SPARKLE_SEC[lv]! * 1000;
                magnetStrengthRef.current = LV.SPARKLE_STRENGTH[lv]!;
                effectLabel = `${LV.SPARKLE_SEC[lv]}秒間 ミニマグネット${lvTag}`;
                statusChanged = true;
                break;
              case NISOKU_A_ITEM_ID: {
                const nisokuSec = LV.NISOKU_A_SEC[lv]!;
                nisokuUntilRef.current = now + nisokuSec * 1000;
                nisokuMultValueRef.current = LV.NISOKU_A_MULT[lv]!;
                effectLabel = `${nisokuSec}秒間 食べ物カテゴリ得点×${LV.NISOKU_A_MULT[lv]}${lvTag}`;
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
                blackoutUntilRef.current = now + OYASUMI_SECONDS * 1000;
                setBlackoutActive(true);
                multiplier15UntilRef.current = now + OYASUMI_SECONDS * 1000;
                multiplier15ValueRef.current = LV.OYASUMI_MULT[lv]!;
                effectLabel = `${OYASUMI_SECONDS}秒間 上半分ブラックアウト 得点×${LV.OYASUMI_MULT[lv]}${lvTag}`;
                statusChanged = true;
                break;
              }
              case OMOI_BASHIRA_ITEM_ID: {
                const shieldSec = LV.OMOI_BASHIRA_SEC[lv]!;
                hazardShieldUntilRef.current = now + shieldSec * 1000;
                effectLabel = `${shieldSec}秒間 ハザード出現なし${lvTag}`;
                statusChanged = true;
                break;
              }
              case OKAERI_ITEM_ID: {
                okaeriUntilRef.current = now + LV.OKAERI_SEC * 1000;
                okaeriPerCatchValueRef.current = LV.OKAERI_PER_CATCH[lv]!;
                effectLabel = `${LV.OKAERI_SEC}秒間 取った個数×${LV.OKAERI_PER_CATCH[lv]}秒${lvTag}`;
                statusChanged = true;
                break;
              }
              case OMOCHI_ITEM_ID: {
                const omochiSec = LV.OMOCHI_SEC[lv]!;
                omochiUntilRef.current = now + omochiSec * 1000;
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
              case "other_kamunayo":
                multiplier15UntilRef.current = now + LV.KAMUNAYO_SEC[lv]! * 1000;
                multiplier15ValueRef.current = LV.KAMUNAYO_MULT[lv]!;
                effectLabel = `${LV.KAMUNAYO_SEC[lv]}秒間 ×${LV.KAMUNAYO_MULT[lv]}${lvTag}`;
                statusChanged = true;
                break;
              case "hiking_frenchie":
                magnetUntilRef.current = now + LV.HIKING_SEC[lv]! * 1000;
                magnetStrengthRef.current = "strong";
                effectLabel = `${LV.HIKING_SEC[lv]}秒間 マグネット${lvTag}`;
                statusChanged = true;
                break;
              case "snow_frenchie":
                boxWideUntilRef.current = now + LV.SNOW_SEC[lv]! * 1000;
                boxWideScaleRef.current = BOX_WIDE_SCALE_STRONG;
                effectLabel = `${LV.SNOW_SEC[lv]}秒間 ダンボール1.7倍拡大${lvTag}`;
                statusChanged = true;
                break;
              case "summer_frenchie": {
                const applied = addBonusTime(LV.SUMMER_ADD[lv]!);
                multiplier15UntilRef.current = now + LV.SUMMER_MULTSEC[lv]! * 1000;
                multiplier15ValueRef.current = LV.SUMMER_MULT[lv]!;
                effectLabel = `+${applied}秒 / ${LV.SUMMER_MULTSEC[lv]}秒間×${LV.SUMMER_MULT[lv]}${lvTag}`;
                statusChanged = true;
                break;
              }
              case "interior_kinoko_azubee":
                fallSpeedBoostUntilRef.current = now + LV.KINOKO_SEC[lv]! * 1000;
                fallSpeedValueRef.current = LV.KINOKO_FALL[lv]!;
                multiplier15UntilRef.current = now + LV.KINOKO_SEC[lv]! * 1000;
                multiplier15ValueRef.current = LV.KINOKO_SCORE[lv]!;
                effectLabel = `${LV.KINOKO_SEC[lv]}秒間 落下×${LV.KINOKO_FALL[lv]}+得点×${LV.KINOKO_SCORE[lv]}${lvTag}`;
                statusChanged = true;
                break;
              case "other_komochi": {
                nextMultiplierRef.current = LV.KOMOCHI_MULT[lv]!;
                nextMultiplierCountRef.current = LV.KOMOCHI_COUNT[lv]!;
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
                multiplier15UntilRef.current = now + LV.KOBEE_SEC[lv]! * 1000;
                multiplier15ValueRef.current = LV.KOBEE_MULT[lv]!;
                effectLabel = `+${LV.KOBEE_PT[lv]}pt / ${LV.KOBEE_SEC[lv]}秒間 ×${LV.KOBEE_MULT[lv]}${lvTag}`;
                statusChanged = true;
                break;
              case "other_hamigaki": {
                entitiesRef.current.forEach((e) => {
                  if (e.itemId === POOP_ITEM_ID && e.status !== "caught") e.y = 999;
                });
                const suppressSec = LV.HAMIGAKI_SEC[lv]!;
                points += LV.HAMIGAKI_PT[lv]!;
                if (suppressSec > 0) {
                  poopSuppressUntilRef.current = now + suppressSec * 1000;
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
                fallSpeedBoostUntilRef.current = now + orusubanSec * 1000;
                fallSpeedValueRef.current = LV.ORUSUBAN_FALL[lv]!;
                const guard = grantRandomHazardGuard();
                effectLabel = `${orusubanSec}秒間 落下速度×${LV.ORUSUBAN_FALL[lv]} / ${guard ? HAZARD_GUARD_LABELS[guard] : "防止アイテムは満タン"}${lvTag}`;
                statusChanged = true;
                break;
              }
              case "other_pondeomo": {
                const pondeomoSec = LV.PONDEOMO_SEC[lv]!;
                spawnRateBoostUntilRef.current = now + pondeomoSec * 1000;
                spawnRateBoostValueRef.current = SPAWN_RATE_BOOST;
                effectLabel = `${pondeomoSec}秒間 アイテム出現量×${SPAWN_RATE_BOOST}${lvTag}`;
                statusChanged = true;
                break;
              }
              case "other_pondear": {
                const pondearSec = LV.PONDEAR_SEC[lv]!;
                spawnRateBoostUntilRef.current = now + pondearSec * 1000;
                spawnRateBoostValueRef.current = SPAWN_RATE_BOOST;
                effectLabel = `${pondearSec}秒間 アイテム出現量×${SPAWN_RATE_BOOST}${lvTag}`;
                statusChanged = true;
                break;
              }
              case "other_jare_a": {
                const jareASec = LV.JARE_A_SEC[lv]!;
                spawnRateBoostUntilRef.current = now + jareASec * 1000;
                spawnRateBoostValueRef.current = SPAWN_RATE_BOOST;
                slantBoostUntilRef.current = now + jareASec * 1000;
                effectLabel = `${jareASec}秒間 アイテム出現量×${SPAWN_RATE_BOOST}+斜め落下${lvTag}`;
                statusChanged = true;
                break;
              }
              case "interior_shikkoku_no_ar": {
                const shikkokuSec = LV.SHIKKOKU_SEC[lv]!;
                fallSpeedBoostUntilRef.current = now + shikkokuSec * 1000;
                fallSpeedValueRef.current = LV.SHIKKOKU_FALL[lv]!;
                multiplier15UntilRef.current = now + shikkokuSec * 1000;
                multiplier15ValueRef.current = LV.SHIKKOKU_MULT[lv]!;
                effectLabel = `${shikkokuSec}秒間 落下×${LV.SHIKKOKU_FALL[lv]}+得点×${LV.SHIKKOKU_MULT[lv]}${lvTag}`;
                statusChanged = true;
                break;
              }
              case "interior_ragby_ar": {
                const ragbySec = LV.RAGBY_SEC[lv]!;
                spawnRateBoostUntilRef.current = now + ragbySec * 1000;
                spawnRateBoostValueRef.current = RAGBY_SPAWN_RATE_BOOST;
                effectLabel = `${ragbySec}秒間 アイテム出現量×${RAGBY_SPAWN_RATE_BOOST}${lvTag}`;
                statusChanged = true;
                break;
              }
              case "other_ketsunade_a": {
                const ketsunadeSec = LV.KETSUNADE_SEC[lv]!;
                magnetUntilRef.current = now + ketsunadeSec * 1000;
                magnetStrengthRef.current = "strong";
                const guard = grantRandomHazardGuard();
                effectLabel = `${ketsunadeSec}秒間 なでなでマグネット / ${guard ? HAZARD_GUARD_LABELS[guard] : "防止アイテムは満タン"}${lvTag}`;
                statusChanged = true;
                break;
              }
              case "other_oyatsu_no_jikan": {
                const rewardPt = LV.OYATSU_PT[lv]!;
                rewardTimeCountRef.current = 1;
                rewardTimeValueRef.current = rewardPt;
                effectLabel = `次の1個 ${rewardPt}pt確定${lvTag}`;
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

            if (skillId === MOCCHURIN_ITEM_ID) {
              const echoCount = lv >= MOCCHURIN_DOUBLE_ECHO_MIN_LV ? 2 : 1;
              const echoTargets = lastSkillCatchesRef.current.slice(0, echoCount);
              for (const lastSkill of echoTargets) {
                const echoLv = clamp(lastSkill.level, 1, MAX_SKILL_LEVEL) - 1;
                const echoLvTag = lastSkill.level >= MAX_SKILL_LEVEL ? " [Lv.MAX]" : lastSkill.level > 1 ? ` [Lv${lastSkill.level}]` : "";
                const echoResult = runItemSkillEffect(lastSkill.itemId, echoLv, echoLvTag);
                points += echoResult.points;
                if (echoResult.effectLabel) {
                  effectLabel = effectLabel ? `${effectLabel} / エコー: ${echoResult.effectLabel}` : `エコー: ${echoResult.effectLabel}`;
                }
                if (echoResult.statusChanged) statusChanged = true;
              }
            }

            if (skillId && skillId !== MOCCHURIN_ITEM_ID) {
              lastSkillCatchesRef.current = [{ itemId: skillId, level: skillLevel }, ...lastSkillCatchesRef.current].slice(0, 2);
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

      const elapsedSincePlayStart = now - startAtRef.current;
      const topZoneHiddenY = elapsedSincePlayStart > TOP_ZONE_HIDDEN_AFTER_SEC_2 * 1000
        ? TOP_ZONE_HIDDEN_LOCAL_Y_2
        : elapsedSincePlayStart > TOP_ZONE_HIDDEN_AFTER_SEC * 1000
          ? TOP_ZONE_HIDDEN_LOCAL_Y
          : 0;
      for (const entity of next) {
        const el = entityNodeRefs.current.get(entity.id);
        if (!el) continue;
        const zIndex = entity.enteredOpening && entity.status !== "bounced" ? 40 : 20;
        const opacity = entity.y < topZoneHiddenY ? 0 : 1;
        el.style.cssText = `position:absolute;left:${entity.x}%;top:${entity.y}%;width:${entity.size}%;z-index:${zIndex};opacity:${opacity};transform:translate(-50%,-50%) rotate(${entity.rotation}deg);will-change:transform;`;
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
        const response = await fetch("/api/coins/item-catch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roundId,
            score: scoreRef.current,
            caughtCount: caughtRef.current,
            durationSeconds: ROUND_SECONDS,
            bonusCoins: goldBonusCoinsRef.current,
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
    nextMultiplierRef.current = 1;
    nextMultiplierCountRef.current = 0;
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
    multiplier15UntilRef.current = 0;
    multiplier15ValueRef.current = 1.5;
    multiplier2UntilRef.current = 0;
    multiplier2ValueRef.current = 2;
    boxWideUntilRef.current = 0;
    boxWideScaleRef.current = BOX_WIDE_SCALE_DEFAULT;
    magnetUntilRef.current = 0;
    magnetStrengthRef.current = "weak";
    urBoostRef.current = 0;
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
    nisokuUntilRef.current = 0;
    nisokuMultValueRef.current = 3;
    dogFloodRemainingRef.current = 0;
    personFloodRemainingRef.current = 0;
    clawdBallFloodRemainingRef.current = 0;
    lastSkillCatchesRef.current = [];
    goldBonusCoinsRef.current = 0;
    slantBoostUntilRef.current = 0;
    boxShrinkUntilRef.current = 0;
    blackoutUntilRef.current = 0;
    stunUntilRef.current = 0;
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
    setActiveEffects([]);
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
    setPhase("playing");
  }, []);

  const moveBox = useCallback((clientX: number) => {
    if (performance.now() < stunUntilRef.current) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const pointerX = ((clientX - rect.left) / rect.width) * 100;
    const now = performance.now();
    const boxScale = now < boxShrinkUntilRef.current ? BOX_SHRINK_SCALE : now < boxWideUntilRef.current ? boxWideScaleRef.current : 1;
    const dynamicHalf = BOX_HALF * boxScale;
    const nextX = clamp(pointerX - dragOffsetRef.current, dynamicHalf + 1, 100 - dynamicHalf - 1);
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
        <span className="rounded-full bg-leaf-soft px-2.5 py-1 text-[10px] font-bold text-leaf-deep">30秒チャレンジ</span>
      </div>

      <div ref={boardRef} className="relative aspect-[3/4] w-full select-none overflow-hidden bg-[#dff3fa]">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#caeef9_0%,#eff9f2_70%,#d9ebbd_100%)]" />
        <div className="absolute -left-8 top-[18%] h-20 w-36 rounded-full bg-white/50 blur-xl" />
        <div className="absolute -right-10 top-[34%] h-24 w-40 rounded-full bg-white/50 blur-xl" />
        <div className="absolute inset-x-0 bottom-0 h-[18%] bg-[linear-gradient(180deg,rgba(208,232,171,0)_0%,#c9e29e_72%,#efdcb8_73%,#e9cfa5_73%,#e9cfa5_100%)]" />

        <div className="absolute left-3 right-3 top-3 z-50 flex items-start justify-between gap-2">
          <div className="flex flex-col items-start gap-1">
            <div className="relative rounded-2xl border border-white/80 bg-white/90 px-3 py-2 shadow-sm">
              <p className="text-[9px] font-bold tracking-widest text-ink-faint">SCORE</p>
              <p className="text-xl font-black tabular-nums text-ink">{score.toLocaleString("ja-JP")}</p>
              {feedback ? <span className="pointer-events-none absolute -right-2 -top-2 rounded-full bg-[#fff6cc]/95 px-2 py-0.5 text-[10px] font-black text-[#c87527] shadow-sm">+{feedback.points}</span> : null}
            </div>
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

        {activeEffects.length > 0 ? (
          <div className="pointer-events-none absolute right-3 top-24 z-50 flex flex-col items-end gap-0.5">
            {activeEffects.map((effect) => (
              <span key={effect} className="rounded-full bg-white/90 px-2 py-0.5 text-[8px] font-bold text-ink-soft shadow-sm">{effect}</span>
            ))}
          </div>
        ) : null}

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
            width: `${BOX_WIDTH * (performance.now() < boxShrinkUntilRef.current ? BOX_SHRINK_SCALE : performance.now() < boxWideUntilRef.current ? boxWideScaleRef.current : 1)}%`,
            height: `${BOX_HEIGHT}%`,
            transform: `translateX(-50%) scaleY(${boxBounce ? 1.015 : 1})`,
          }}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerEnd}
          onPointerCancel={pointerEnd}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BOX_IMAGE} alt="拾ってくだブーと書かれた段ボール" draggable={false} className={`pointer-events-none absolute inset-0 h-full w-full ${performance.now() < boxWideUntilRef.current && performance.now() >= boxShrinkUntilRef.current ? "object-fill" : "object-contain"}`} />
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
                  <button type="button" onClick={startGame} className="mt-4 w-full rounded-full bg-leaf px-4 py-3 text-sm font-black text-white shadow-md active:translate-y-px">START</button>
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