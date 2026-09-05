import { DAMBOURLE_LEVEL_CAP, type DambourleRarity } from "./config";

/**
 * ダンボール自身のスキルLv・スキン解放段階の判定。
 * supabase/migrations/0088_dambourle_gacha.sql の
 * dambourle_level_for_count / dambourle_skin_tier_for_item と必ず一致させること
 * （こちらは表示用。実際の権限チェックはRPC側で行う）。
 */

const MR_ITEM_ID = "dambourle_no11";

/** 重複3個ごとにLv+1（全ランク共通）。count=1の時点でLv1。 */
export function getDambourleLevel(rarity: DambourleRarity, count: number): number {
  const cap = DAMBOURLE_LEVEL_CAP[rarity];
  const level = Math.floor((Math.max(count, 1) - 1) / 3) + 1;
  return Math.min(cap, level);
}

/** No.11以外：Lv14/28/42/56/70でスキンが1枚ずつ解放（Lv1〜13は基本スキンのみ＝0）。
 * No.11：Lv1〜5がそのままスキン1〜5に対応。 */
export function getDambourleUnlockedSkinTier(itemId: string, level: number): number {
  if (itemId === MR_ITEM_ID) return Math.min(level, 5);
  return Math.min(Math.floor(level / 14), 5);
}

/** 次のLvまでに必要な追加重複数。Lv上限のときはnull。 */
export function getDambourleNextLevelRemaining(rarity: DambourleRarity, count: number): number | null {
  const cap = DAMBOURLE_LEVEL_CAP[rarity];
  const level = getDambourleLevel(rarity, count);
  if (level >= cap) return null;
  const countForNextLevel = level * 3 + 1;
  return countForNextLevel - count;
}
