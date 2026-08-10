/**
 * ガチャの景品一覧
 * =============================================================
 * 景品を増やすときはこの配列に足すだけでよい。
 * id は台帳（coin_events.metadata）と所持（user_gacha_items.item_id）に
 * そのまま入るので、一度出した id は変えないこと。
 *
 * image は public/ からのパス。まだ絵がないものは null にしておくと、
 * 結果画面はプレースホルダー（？のわく）を出す。
 */
import type { GachaRarity } from "./config";

/** 景品の種類。使い道が増えたらここに足す */
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
    // TODO: 夏スキンの画像を用意したらパスを入れる（例: /gacha/summer_frenchie.webp）
    image: null,
  },
  {
    id: "hiking_frenchie",
    name: "登山のフレブル",
    rarity: "SR",
    type: "dog_skin",
    // TODO: 登山スキンの画像を用意したらパスを入れる
    image: null,
  },
  {
    id: "snow_frenchie",
    name: "雪国のフレブル",
    rarity: "SR",
    type: "dog_skin",
    // TODO: 雪国スキンの画像を用意したらパスを入れる
    image: null,
  },

  // --- 以下は抽選を動かすための仮の景品 ---------------------------------
  // TODO: 本番の景品に差し替える。N / R / SSR に景品が1つも無いと、
  //       そのレアリティが当たったときに配るものが無くなるため置いてある。
  //       図鑑には出さない（src/lib/collection/items.ts の HIDDEN_PRIZE_IDS）。
  { id: "placeholder_n", name: "おさんぽメダル", rarity: "N", type: "item", image: null },
  { id: "placeholder_r", name: "きらきらリボン", rarity: "R", type: "item", image: null },
  { id: "placeholder_ssr", name: "ゴールドクラウン", rarity: "SSR", type: "item", image: null },
];

const PRIZE_BY_ID = new Map(GACHA_PRIZES.map((prize) => [prize.id, prize]));

export function getPrize(id: string): GachaPrize | null {
  return PRIZE_BY_ID.get(id) ?? null;
}

export function getPrizesByRarity(rarity: GachaRarity): GachaPrize[] {
  return GACHA_PRIZES.filter((prize) => prize.rarity === rarity);
}
