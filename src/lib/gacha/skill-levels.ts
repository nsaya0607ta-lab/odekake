import type { GachaRarity } from "./config";

/**
 * アイテムキャッチのスキルレベル判定。
 * user_gacha_items.count（累計取得数）からLv1〜Lv5を判定する。
 * Nと特殊アイテム（？アイテム/犬のうんち等、図鑑に存在しないもの）はレベル対象外。
 */

export const MAX_SKILL_LEVEL = 5;

export const SKILL_LEVEL_THRESHOLDS: Record<GachaRarity, readonly number[]> = {
  N: [],
  R: [1, 12, 30, 55, 90],
  SR: [1, 6, 14, 25, 40],
  SSR: [1, 4, 9, 16, 26],
  UR: [1, 3, 5, 9, 15],
  LR: [1, 2, 3, 5, 8],
};

export function isLevelableRarity(rarity: GachaRarity): boolean {
  return SKILL_LEVEL_THRESHOLDS[rarity].length > 0;
}

/** count(累計取得数)からスキルLv(0=未達/対象外, 1〜5)を判定する。 */
export function getSkillLevel(rarity: GachaRarity, count: number): number {
  const thresholds = SKILL_LEVEL_THRESHOLDS[rarity];
  let level = 0;
  for (let i = 0; i < thresholds.length; i += 1) {
    if (count >= thresholds[i]!) level = i + 1;
  }
  return level;
}

/** 次のレベルまでに必要な追加取得数。Lv.MAXまたは対象外のときはnull。 */
export function getNextLevelRemaining(rarity: GachaRarity, count: number): number | null {
  const thresholds = SKILL_LEVEL_THRESHOLDS[rarity];
  for (const threshold of thresholds) {
    if (count < threshold) return threshold - count;
  }
  return null;
}

/** 表示用のLvラベル。対象外はnull、Lv5は"Lv.MAX"。 */
export function formatSkillLevel(rarity: GachaRarity, count: number): string | null {
  const level = getSkillLevel(rarity, count);
  if (level <= 0) return null;
  return level >= MAX_SKILL_LEVEL ? "Lv.MAX" : `Lv${level}`;
}
