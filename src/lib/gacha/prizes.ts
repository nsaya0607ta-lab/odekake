/**
 * ガチャの景品一覧
 * =============================================================
 * id は user_gacha_items.item_id に保存されるため、一度公開した id は変更しない。
 */
import type { GachaRarity, GachaType } from "./config";

export type GachaPrizeType = "dog_skin" | "item";

export type GachaPrize = {
  id: string;
  name: string;
  rarity: GachaRarity;
  type: GachaPrizeType;
  pool: GachaType;
  /** public/ からのパス。未用意なら null */
  image: string | null;
};

export const GACHA_PRIZES: readonly GachaPrize[] = [
  // --- 通常ガチャ：わんこのおもちゃ ----------------------------------
  {
    id: "toy_colorful_ball",
    name: "カラフルボール",
    rarity: "N",
    type: "item",
    pool: "regular",
    image: "/collection/items/colorful-ball.webp",
  },
  {
    id: "toy_rope",
    name: "ロープおもちゃ",
    rarity: "N",
    type: "item",
    pool: "regular",
    image: "/collection/items/rope-toy.webp",
  },
  {
    id: "toy_bone",
    name: "ほねのおもちゃ",
    rarity: "N",
    type: "item",
    pool: "regular",
    image: "/collection/items/bone-toy.webp",
  },
  {
    id: "toy_squeaky_ball",
    name: "ぴこぴこボール",
    rarity: "N",
    type: "item",
    pool: "regular",
    image: "/collection/items/squeaky-ball.webp",
  },
  {
    id: "toy_duck_plush",
    name: "あひるのぬいぐるみ",
    rarity: "R",
    type: "item",
    pool: "regular",
    image: "/collection/items/duck-plush.webp",
  },
  {
    id: "toy_carrot",
    name: "にんじんトイ",
    rarity: "R",
    type: "item",
    pool: "regular",
    image: "/collection/items/carrot-toy.webp",
  },
  {
    id: "toy_frisbee",
    name: "フリスビー",
    rarity: "R",
    type: "item",
    pool: "regular",
    image: "/collection/items/frisbee.webp",
  },
  {
    id: "toy_treasure_puzzle",
    name: "宝箱おやつパズル",
    rarity: "SR",
    type: "item",
    pool: "regular",
    image: "/collection/items/treasure-puzzle.webp",
  },
  {
    id: "toy_frenchie_plush",
    name: "フレブルぬいぐるみ",
    rarity: "SR",
    type: "item",
    pool: "regular",
    image: "/collection/items/frenchie-plush.webp",
  },
  {
    id: "toy_rainbow_ball",
    name: "虹色わんこボール",
    rarity: "SSR",
    type: "item",
    pool: "regular",
    image: "/collection/items/rainbow-ball.webp",
  },

  // --- 夏限定 -----------------------------------------------------------
  {
    id: "summer_frenchie",
    name: "夏のフレブル",
    rarity: "SR",
    type: "dog_skin",
    pool: "summer",
    image: "/collection/skins/summer-frenchie.webp",
  },
];

const PRIZE_BY_ID = new Map(GACHA_PRIZES.map((prize) => [prize.id, prize]));

export function getPrize(id: string): GachaPrize | null {
  return PRIZE_BY_ID.get(id) ?? null;
}

export function getPrizesByRarity(rarity: GachaRarity, pool: GachaType): GachaPrize[] {
  return GACHA_PRIZES.filter((prize) => prize.rarity === rarity && prize.pool === pool);
}
