import { getRequiredExpForLevel } from "@/lib/exp";

/**
 * おでかけコインの付与量。
 * DB側の定義は supabase/migrations/0028_coin_economy_overhaul.sql と必ず同じにする。
 */

/** 7日周期の連続ログインボーナス。 */
export const LOGIN_BONUS_SCHEDULE = [100, 120, 140, 160, 180, 200, 300] as const;
/** 旧参照向け。1日目の金額。 */
export const LOGIN_BONUS_COINS = LOGIN_BONUS_SCHEDULE[0];

/** Lv.2〜30 のレベルアップ報酬。Lv.31以降は必要EXPから計算する。 */
export const LEVEL_UP_COIN_BANDS = [
  { maxLevel: 5, coins: 200 },
  { maxLevel: 10, coins: 300 },
  { maxLevel: 15, coins: 400 },
  { maxLevel: 20, coins: 500 },
  { maxLevel: 25, coins: 600 },
  { maxLevel: 29, coins: 800 },
  { maxLevel: 30, coins: 2000 },
] as const;

/** Lv.31以降の節目ボーナス。通常のレベルアップコインへ追加する。 */
export const LEVEL_MILESTONE_COIN_BONUSES = [
  { level: 50, coins: 500 },
  { level: 100, coins: 1500 },
  { level: 200, coins: 3000 },
  { level: 500, coins: 7500 },
  { level: 1000, coins: 15000 },
] as const;

/** 歩数報酬：500歩ごとに60コイン。 */
export const STEP_COIN_INTERVAL = 500;
export const STEP_COIN_AMOUNT = 60;

/** 到達したものをすべて累積する歩数ボーナス。 */
export const STEP_COIN_MILESTONES = [
  { steps: 3000, coins: 100 },
  { steps: 5000, coins: 200 },
  { steps: 8000, coins: 300 },
  { steps: 10000, coins: 500 },
] as const;

/** 互換用。基本報酬の表示は STEP_COIN_INTERVAL / STEP_COIN_AMOUNT を使う。 */
export const STEP_COIN_TIERS = [{ steps: STEP_COIN_INTERVAL, coins: STEP_COIN_AMOUNT }] as const;
/** API側の1日歩数上限（200,000歩）に基づく理論上の最大値。 */
export const MAX_DAILY_STEP_COINS =
  (200000 / STEP_COIN_INTERVAL) * STEP_COIN_AMOUNT
  + STEP_COIN_MILESTONES.reduce((sum, milestone) => sum + milestone.coins, 0);

/** アイテムキャッチ：30秒遊びきると25スコアごとに1コイン、最低1コイン。 */
export const ITEM_CATCH_SCORE_PER_COIN = 25;
export const ITEM_CATCH_MIN_COINS = 1;

/** ガチャで同じ景品が出たときの返却コイン。 */
export const GACHA_DUPLICATE_COINS = {
  N: 5,
  R: 10,
  SR: 20,
  SSR: 30,
  UR: 50,
} as const;

function bandCoins(bands: readonly { maxLevel: number; coins: number }[], level: number): number {
  return bands.find((band) => level <= band.maxLevel)?.coins ?? 0;
}

/** そのレベルへ到達したときのコイン。Lv.31以降も上限なし。 */
export function getLevelUpCoins(level: number): number {
  if (!Number.isFinite(level)) return 0;
  const target = Math.floor(level);
  if (target < 2) return 0;
  if (target <= 30) return bandCoins(LEVEL_UP_COIN_BANDS, target);

  const requiredExp = getRequiredExpForLevel(target);
  const baseCoins = Math.max(250, Math.round((requiredExp * 0.2) / 50) * 50);
  const milestoneCoins = LEVEL_MILESTONE_COIN_BONUSES.find((milestone) => milestone.level === target)?.coins ?? 0;
  return baseCoins + milestoneCoins;
}

/** その日の歩数でもらえるコイン合計。基本報酬＋到達済み節目をすべて累積する。 */
export function getStepCoins(steps: number | null | undefined): number {
  if (steps === null || steps === undefined || !Number.isFinite(steps)) return 0;
  const safeSteps = Math.max(0, Math.floor(steps));
  const base = Math.floor(safeSteps / STEP_COIN_INTERVAL) * STEP_COIN_AMOUNT;
  const milestone = STEP_COIN_MILESTONES.reduce(
    (sum, reward) => sum + (safeSteps >= reward.steps ? reward.coins : 0),
    0,
  );
  return base + milestone;
}

/** 30秒のアイテムキャッチを完走したときの報酬。 */
export function getItemCatchCoins(score: number): number {
  if (!Number.isFinite(score)) return ITEM_CATCH_MIN_COINS;
  const safeScore = Math.max(0, Math.floor(score));
  return Math.max(ITEM_CATCH_MIN_COINS, Math.floor(safeScore / ITEM_CATCH_SCORE_PER_COIN));
}

export function formatCoins(coins: number): string {
  return coins.toLocaleString("ja-JP");
}
