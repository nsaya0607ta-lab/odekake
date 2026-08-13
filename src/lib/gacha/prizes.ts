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
  // --- 通常ガチャ：わんこのおもちゃ 第1弾 ----------------------------
  { id: "toy_colorful_ball", name: "カラフルボール", rarity: "N", type: "item", pool: "regular", image: "/collection/items/colorful-ball.webp" },
  { id: "toy_rope", name: "ロープおもちゃ", rarity: "N", type: "item", pool: "regular", image: "/collection/items/rope-toy.webp" },
  { id: "toy_bone", name: "ほねのおもちゃ", rarity: "N", type: "item", pool: "regular", image: "/collection/items/bone-toy.webp" },
  { id: "toy_squeaky_ball", name: "ぴこぴこボール", rarity: "N", type: "item", pool: "regular", image: "/collection/items/squeaky-ball.webp" },
  { id: "toy_duck_plush", name: "あひるのぬいぐるみ", rarity: "R", type: "item", pool: "regular", image: "/collection/items/duck-plush.webp" },
  { id: "toy_carrot", name: "にんじんトイ", rarity: "R", type: "item", pool: "regular", image: "/collection/items/carrot-toy.webp" },
  { id: "toy_frisbee", name: "フリスビー", rarity: "R", type: "item", pool: "regular", image: "/collection/items/frisbee.webp" },
  { id: "toy_treasure_puzzle", name: "宝箱おやつパズル", rarity: "SR", type: "item", pool: "regular", image: "/collection/items/treasure-puzzle.webp" },
  { id: "toy_frenchie_plush", name: "フレブルぬいぐるみ", rarity: "SR", type: "item", pool: "regular", image: "/collection/items/frenchie-plush.webp" },
  { id: "toy_rainbow_ball", name: "虹色わんこボール", rarity: "SSR", type: "item", pool: "regular", image: "/collection/items/rainbow-ball.webp" },

  // --- 通常ガチャ：わんこのおもちゃ 第2弾 ----------------------------
  { id: "toy_tennis_ball", name: "テニスボール", rarity: "N", type: "item", pool: "regular", image: "/collection/items/tennis-ball.webp" },
  { id: "toy_red_slipper", name: "赤いスリッパ", rarity: "N", type: "item", pool: "regular", image: "/collection/items/red-slipper.webp" },
  { id: "toy_wood_stick", name: "木の枝", rarity: "N", type: "item", pool: "regular", image: "/collection/items/wood-stick.webp" },
  { id: "toy_donut_rope", name: "ドーナツ型ロープ", rarity: "N", type: "item", pool: "regular", image: "/collection/items/donut-rope.webp" },
  { id: "toy_soccer_ball", name: "サッカーボール", rarity: "R", type: "item", pool: "regular", image: "/collection/items/soccer-ball.webp" },
  { id: "toy_taiyaki_plush", name: "たい焼きぬいぐるみ", rarity: "R", type: "item", pool: "regular", image: "/collection/items/taiyaki-plush.webp" },
  { id: "toy_bear_plush", name: "くまのぬいぐるみ", rarity: "R", type: "item", pool: "regular", image: "/collection/items/bear-plush.webp" },
  { id: "toy_meat", name: "大きな肉のおもちゃ", rarity: "SR", type: "item", pool: "regular", image: "/collection/items/meat-toy.webp" },
  { id: "toy_frenchie_cushion", name: "フレブル型クッション", rarity: "SR", type: "item", pool: "regular", image: "/collection/items/frenchie-cushion.webp" },
  { id: "toy_golden_crown_ball", name: "王冠つき黄金ボール", rarity: "SSR", type: "item", pool: "regular", image: "/collection/items/golden-crown-ball.webp" },

  // --- 通常ガチャ：食べもの ------------------------------------------
  { id: "food_paw_bowl", name: "肉球フードボウル", rarity: "R", type: "item", pool: "regular", image: "/collection/items/paw-food-bowl.webp" },

  // --- 通常ガチャ：インテリア ----------------------------------------
  { id: "interior_anball", name: "アンボール", rarity: "UR", type: "item", pool: "regular", image: "/collection/items/anball.webp" },

  // --- 通常ガチャ：その他 --------------------------------------------
  { id: "other_azubee", name: "あずびー", rarity: "UR", type: "item", pool: "regular", image: "/collection/items/two-dogs-icon-transparent.webp" },

  // --- 犬スキン（すべてSSR・共通ガチャから排出） ----------------------
  { id: "hiking_frenchie", name: "登山のフレブル", rarity: "SSR", type: "dog_skin", pool: "regular", image: "/collection/skins/hiking-frenchie.webp" },
  { id: "snow_frenchie", name: "雪国のフレブル", rarity: "SSR", type: "dog_skin", pool: "regular", image: "/collection/skins/snow-frenchie.webp" },
  { id: "summer_frenchie", name: "夏のフレブル", rarity: "SSR", type: "dog_skin", pool: "summer", image: "/collection/skins/summer-frenchie.webp" },
];

const PRIZE_BY_ID = new Map(GACHA_PRIZES.map((prize) => [prize.id, prize]));

export function getPrize(id: string): GachaPrize | null {
  return PRIZE_BY_ID.get(id) ?? null;
}

export function getPrizesByRarity(rarity: GachaRarity, pool: GachaType): GachaPrize[] {
  return GACHA_PRIZES.filter((prize) => prize.rarity === rarity && prize.pool === pool);
}
