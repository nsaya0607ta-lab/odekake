import { DAMBOURLE_LEVEL_CAP, type DambourleRarity } from "./config";

/**
 * ダンボール自身のスキルLv・スキン解放段階の判定。
 * supabase/migrations/0088_dambourle_gacha.sql・0092_dambourle_level_cap_5.sql の
 * dambourle_level_for_count / dambourle_skin_tier_for_item と必ず一致させること
 * （こちらは表示用。実際の権限チェックはRPC側で行う）。
 */

const MR_ITEM_ID = "dambourle_no11";

/** 重複5個ごとにLv+1（全ランク共通、2026-09〜）。count=1の時点でLv1。 */
export function getDambourleLevel(rarity: DambourleRarity, count: number): number {
  const cap = DAMBOURLE_LEVEL_CAP[rarity];
  const level = Math.floor((Math.max(count, 1) - 1) / 5) + 1;
  return Math.min(cap, level);
}

/**
 * No.11以外：Lv1は基本スキン(0)のまま、Lv2〜5でスキン2〜5が1枚ずつ解放される
 * （スキン1はskin-0と同一画像のため使わない。skin-0/skin-1.webpが同一ファイルなのはそのため）。
 * No.11：Lv1〜5がそのままスキン1〜5に対応（元から変更なし）。
 */
export function getDambourleUnlockedSkinTier(itemId: string, level: number): number {
  if (itemId === MR_ITEM_ID) return Math.min(level, 5);
  return level <= 1 ? 0 : Math.min(level, 5);
}

/**
 * スキン選択画面で実際にボタンとして出す解放済みスキンのインデックス一覧。
 * getDambourleUnlockedSkinTierの返り値は「0→2」のように1を飛ばすため、
 * 単純にminSkinIndex〜tierの連番では作れない。
 */
export function getDambourleUnlockedSkinIndices(itemId: string, level: number): number[] {
  const tier = getDambourleUnlockedSkinTier(itemId, level);
  const minIndex = getDambourleMinSkinIndex(itemId);
  if (itemId === MR_ITEM_ID) {
    return Array.from({ length: tier - minIndex + 1 }, (_, i) => i + minIndex);
  }
  if (tier <= 0) return [0];
  return [0, ...Array.from({ length: tier - 1 }, (_, i) => i + 2)];
}

/**
 * No.11は基本スキン(skin-0)を持たず、count=1で確定するLv1からスキン1が最初の見た目になる
 * （public/collection/dambourle/dambourle_no11/にskin-0.webpは存在しない）。それ以外は0が基本デザイン。
 */
export function getDambourleMinSkinIndex(itemId: string): number {
  return itemId === MR_ITEM_ID ? 1 : 0;
}

/**
 * 効果倍率式「基礎値(%) × (1 + 0.02×(Lv-1))」専用の換算Lv。
 * ダンボール自身のLv上限が70→5になった際も効果の伸びしろを保つため、
 * 新Lv(1〜5)を旧70段階システムの解放閾値(Lv14/28/42/56)に対応づける
 * （新Lv2→旧Lv14, 新Lv3→旧Lv28, 新Lv4→旧Lv42, 新Lv5→旧Lv56。新Lv1は1のまま＝効果無し）。
 */
export function getDambourleEffectLevel(level: number): number {
  return level <= 1 ? 1 : (level - 1) * 14;
}

/** 次のLvまでに必要な追加重複数。Lv上限のときはnull。 */
export function getDambourleNextLevelRemaining(rarity: DambourleRarity, count: number): number | null {
  const cap = DAMBOURLE_LEVEL_CAP[rarity];
  const level = getDambourleLevel(rarity, count);
  if (level >= cap) return null;
  const countForNextLevel = level * 5 + 1;
  return countForNextLevel - count;
}
