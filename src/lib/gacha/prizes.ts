/**
 * ガチャの景品一覧
 * =============================================================
 * 景品を増やすときはこの配列に足すだけでよい。
 * id は台帳（coin_events.metadata）と所持（user_gacha_items.item_id）に
 * そのまま入るので、一度出した id は変えないこと。
 *
 * 現在のガチャは「夏のフレブル」だけを排出する限定ガチャ。
 * 登山・雪国スキンは図鑑には先に載せるが、ガチャへはまだ追加しない。
 */
import type { GachaRarity } from "./config";

export type GachaPrizeType = "dog_skin" | "item";

export type GachaPrize = {
  id: string;
  name: string;
  rarity: GachaRarity;
  type: GachaPrizeType;
  /** public/ からのパス。未用意なら null */
  image: string | null;
};

export const GACHA_PRIZES: readonly GachaPrize[] = [
  {
    id: "summer_frenchie",
    name: "夏のフレブル",
    rarity: "SR",
    type: "dog_skin",
    image: "/collection/skins/summer-frenchie.webp",
  },
];

const PRIZE_BY_ID = new Map(GACHA_PRIZES.map((prize) => [prize.id, prize]));

export function getPrize(id: string): GachaPrize | null {
  return PRIZE_BY_ID.get(id) ?? null;
}

export function getPrizesByRarity(rarity: GachaRarity): GachaPrize[] {
  return GACHA_PRIZES.filter((prize) => prize.rarity === rarity);
}
