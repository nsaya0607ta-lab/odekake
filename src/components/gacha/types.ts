import type { GachaPlanId, GachaRarity } from "@/lib/gacha/config";

export type DrawResult = {
  id: string;
  name: string;
  rarity: string;
  type: string;
  image: string | null;
  isNew: boolean;
  previousLevel: number;
  newLevel: number;
  /** 景品ごとにLv上限が異なる場合の表示用。通常ガチャは未指定で5。 */
  maxLevel?: number;
  /** 結果カードに添える短い効果説明。 */
  detail?: string;
};

export type AnimationDraw = {
  plan: GachaPlanId;
  results: DrawResult[];
  promotion?: {
    index: number;
    fromRarity: Extract<GachaRarity, "N" | "R">;
    toRarity: Extract<GachaRarity, "LR" | "MR">;
  };
};
