/**
 * ルールブック（/guide）で使う数字。
 * できるだけアプリ本体の値をそのまま読みこんで、食い違わないようにしている。
 * DB だけにある値（歩数EXP・訪問EXP）は、該当するマイグレーションと同じにすること。
 */
import {
  GACHA_DUPLICATE_COINS,
  LEVEL_MILESTONE_COIN_BONUSES,
  LEVEL_UP_COIN_BANDS,
  LOGIN_BONUS_SCHEDULE,
  STEP_COIN_AMOUNT,
  STEP_COIN_INTERVAL,
  STEP_COIN_MILESTONES,
} from "@/lib/coins";
import { GACHA_DISPLAY_RARITY_RATES, GACHA_PLANS, type GachaRarity } from "@/lib/gacha/config";
import { SKILL_LEVEL_THRESHOLDS } from "@/lib/gacha/skill-levels";

export {
  GACHA_DUPLICATE_COINS,
  GACHA_PLANS,
  LEVEL_MILESTONE_COIN_BONUSES,
  LEVEL_UP_COIN_BANDS,
  LOGIN_BONUS_SCHEDULE,
  SKILL_LEVEL_THRESHOLDS,
};

/** 表に出すレア（表示用の排出率が0のものは出さない） */
export const GUIDE_RARITIES = (Object.keys(GACHA_DISPLAY_RARITY_RATES) as GachaRarity[]).filter((rarity) => GACHA_DISPLAY_RARITY_RATES[rarity] > 0);
export const GUIDE_RATES = GACHA_DISPLAY_RARITY_RATES;

/** その日の歩数でもらえるコイン（src/lib/coins.ts と同じ計算） */
export function stepCoins(steps: number): number {
  const base = Math.floor(steps / STEP_COIN_INTERVAL) * STEP_COIN_AMOUNT;
  const bonus = STEP_COIN_MILESTONES.filter((milestone) => steps >= milestone.steps).reduce((sum, milestone) => sum + milestone.coins, 0);
  return base + bonus;
}

/** その日の歩数でもらえるEXP（supabase/migrations/0020_increase_step_exp.sql と同じ） */
const STEP_EXP_TABLE: readonly [number, number][] = [
  [20000, 1000], [15000, 750], [12000, 550], [10000, 420], [9000, 350], [8000, 300],
  [7000, 250], [6000, 210], [5000, 170], [4000, 120], [3000, 80], [2000, 50], [1000, 25],
];
export function stepExp(steps: number): number {
  return STEP_EXP_TABLE.find(([at]) => steps >= at)?.[1] ?? 0;
}
export const STEP_EXP_MARKS = [...STEP_EXP_TABLE].reverse();

/** 訪問を記録したときのEXP（supabase/migrations/0009_odekake_exp.sql と同じ） */
export const VISIT_EXP = [
  { id: "visit", label: "訪問を記録する", exp: 20, always: true },
  { id: "firstSpot", label: "はじめてのスポット", exp: 30, alt: { label: "同じスポットに また来た", exp: 10 } },
  { id: "comment", label: "感想を書く", exp: 10 },
  { id: "rating", label: "評価をつける", exp: 5 },
  { id: "firstCity", label: "はじめての市区町村", exp: 60, blue: 100 },
  { id: "firstPref", label: "はじめての都道府県", exp: 150, blue: 600 },
  { id: "firstRegion", label: "はじめての地方", exp: 200 },
] as const;

/** ホームの犬カードに降ってくるコイン（wandering-frenchie.tsx・0129 と同じ） */
export const HOME_DROP = {
  everySeconds: 5,
  chance: 20,
  /** 赤コイン（ご当地ピンボールのステージの部品に使う）は、黄色・青とは別にこの％で降る（wandering-frenchie.tsx の COIN_RED_CHANCE） */
  redChance: 5,
  tiers: [
    { tier: "common", label: "ふつう", rate: 85, amount: 5 },
    { tier: "rare", label: "中レア", rate: 12, amount: 20 },
    { tier: "epic", label: "高レア", rate: 3, amount: 100 },
  ],
} as const;

/** レベルアップでもらえるコイン（Lv.2〜30） */
export function levelUpCoins(level: number): number {
  return LEVEL_UP_COIN_BANDS.find((band) => level <= band.maxLevel)?.coins ?? 0;
}
