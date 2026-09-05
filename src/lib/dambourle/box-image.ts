/** 初期無料ダンボール（効果なし）。ガチャを一切引かなくても使える。 */
export const DEFAULT_BOX_IMAGE = "/4EA485D9-BB37-47F3-97F0-111CF0E4AF7E.webp";
export const DEFAULT_BOX_ALT = "拾ってくだブーと書かれた段ボール";

/**
 * ダンボールの画像パス。skinIndex=0は各ダンボールの基本デザイン、1〜5は
 * 解放済みスキン段階（src/lib/dambourle/skill-levels.ts のgetDambourleUnlockedSkinTier参照）。
 * 画像アセット本体（public/collection/dambourle/配下）は別途用意すること。
 */
export function getDambourleBoxImage(itemId: string | null, skinIndex: number): string {
  if (!itemId) return DEFAULT_BOX_IMAGE;
  return `/collection/dambourle/${itemId}/skin-${skinIndex}.webp`;
}
