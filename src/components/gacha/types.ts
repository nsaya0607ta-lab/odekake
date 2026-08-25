import type { GachaPlanId } from "@/lib/gacha/config";

export type DrawResult = {
  id: string;
  name: string;
  rarity: string;
  type: string;
  image: string | null;
  isNew: boolean;
  previousLevel: number;
  newLevel: number;
};

export type AnimationDraw = {
  plan: GachaPlanId;
  results: DrawResult[];
};

