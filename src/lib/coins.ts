import { LEVEL_THRESHOLDS } from "@/lib/exp";

/**
 * おでかけコインの付与量。
 * レベルアップ報酬は supabase/migrations/0011_odekake_coins.sql、
 * 歩数報酬は supabase/migrations/0015_step_coins_every_500.sql、
 * ログインボーナスは supabase/migrations/0016_login_bonus.sql と必ず同じにする。
 */

/** その日はじめてアプリを開いたときにもらえるコイン（1日1回） */
export const LOGIN_BONUS_COINS = 100;

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

/** 歩数報酬：1日ごとに500歩達成するたび10コイン */
export const STEP_COIN_INTERVAL = 500;
export const STEP_COIN_AMOUNT = 10;

/**
 * 互換用。歩数報酬の表示は STEP_COIN_INTERVAL / STEP_COIN_AMOUNT を使う。
 * API側の1日歩数上限（200,000歩）に基づく理論上の最大値。
 */
export const STEP_COIN_TIERS = [{ steps: STEP_COIN_INTERVAL, coins: STEP_COIN_AMOUNT }] as const;
export const MAX_DAILY_STEP_COINS = (200000 / STEP_COIN_INTERVAL) * STEP_COIN_AMOUNT;

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

/** その日の歩数でもらえるコインの合計。500歩未満の端数は切り捨てる。 */
export function getStepCoins(steps: number | null | undefined): number {
  if (steps === null || steps === undefined || !Number.isFinite(steps)) return 0;
  const safeSteps = Math.max(0, Math.floor(steps));
  return Math.floor(safeSteps / STEP_COIN_INTERVAL) * STEP_COIN_AMOUNT;
}

export function formatCoins(coins: number): string {
  return coins.toLocaleString("ja-JP");
}
