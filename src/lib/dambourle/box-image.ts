/** 初期無料ダンボール（効果なし）。ガチャを一切引かなくても使える。 */
export const DEFAULT_BOX_IMAGE = "/4EA485D9-BB37-47F3-97F0-111CF0E4AF7E.webp";
export const DEFAULT_BOX_ALT = "拾ってくだブーと書かれた段ボール";

/** No.11(MR)以外はskin-1.webpがskin-0と同一画像だったため削除済み（2026-09〜）。
 * Lv上限変更前にskinIndex=1で装備済みだったユーザーの記録が残っていても
 * 404にならないよう、ここで0に読み替える。 */
const MR_ITEM_ID = "dambourle_no11";

/**
 * ダンボールの画像パス。skinIndex=0は各ダンボールの基本デザイン、1〜5は
 * 解放済みスキン段階（src/lib/dambourle/skill-levels.ts のgetDambourleUnlockedSkinTier参照）。
 * 画像アセット本体（public/collection/dambourle/配下）は別途用意すること。
 */
export function getDambourleBoxImage(itemId: string | null, skinIndex: number): string {
  if (!itemId) return DEFAULT_BOX_IMAGE;
  const resolvedIndex = itemId !== MR_ITEM_ID && skinIndex === 1 ? 0 : skinIndex;
  return `/collection/dambourle/${itemId}/skin-${resolvedIndex}.webp`;
}
