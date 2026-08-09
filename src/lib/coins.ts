import { LEVEL_THRESHOLDS } from "@/lib/exp";

/**
 * おでかけコインの付与量。
 * 数値は supabase/migrations/0011_odekake_coins.sql の
 * coin_level_up_reward() / calculate_step_coins() と必ず同じにする。
 */

/** そのレベルへ到達したときにもらえるコイン（上限レベルごとの帯） */
export const LEVEL_UP_COIN_BANDS = [
  { maxLevel: 5, coins: 100 },
  { maxLevel: 10, coins: 150 },
  { maxLevel: 15, coins: 200 },
  { maxLevel: 20, coins: 250 },
  { maxLevel: 25, coins: 300 },
  { maxLevel: 29, coins: 400 },
  { maxLevel: 30, coins: 1000 },
] as const;

/** 1日の歩数の段階報酬。到達するごとに加算される */
export const STEP_COIN_TIERS = [
  { steps: 3000, coins: 10 },
  { steps: 5000, coins: 10 },
  { steps: 8000, coins: 15 },
  { steps: 10000, coins: 15 },
  { steps: 15000, coins: 20 },
] as const;

/** 1日にもらえる歩数コインの上限 */
export const MAX_DAILY_STEP_COINS = 70;

const MAX_LEVEL = LEVEL_THRESHOLDS.length;

function bandCoins(bands: readonly { maxLevel: number; coins: number }[], level: number): number {
  return bands.find((band) => level <= band.maxLevel)?.coins ?? 0;
}

/** Lv.2〜30 へ到達したときのコイン。Lv.1 と範囲外は 0 */
export function getLevelUpCoins(level: number): number {
  if (!Number.isFinite(level)) return 0;
  const target = Math.floor(level);
  if (target < 2 || target > MAX_LEVEL) return 0;
  return bandCoins(LEVEL_UP_COIN_BANDS, target);
}

/** その日の歩数でもらえるコインの合計 */
export function getStepCoins(steps: number | null | undefined): number {
  if (steps === null || steps === undefined || !Number.isFinite(steps)) return 0;
  const safeSteps = Math.max(0, Math.floor(steps));
  const total = STEP_COIN_TIERS.reduce(
    (sum, tier) => (safeSteps >= tier.steps ? sum + tier.coins : sum),
    0,
  );
  return Math.min(MAX_DAILY_STEP_COINS, total);
}

export function formatCoins(coins: number): string {
  return coins.toLocaleString("ja-JP");
}
