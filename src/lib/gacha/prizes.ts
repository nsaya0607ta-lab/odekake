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
  // 犬のスキン。絵は素材の立ち姿をそのまま使う（どのスキンも同じ大きさ・同じ位置で
  // 描いてあるので、結果の並びで犬だけがずれることがない）
  {
    id: "summer_frenchie",
    name: "夏のフレブル",
    rarity: "SR",
    type: "dog_skin",
    image: "/characters/frenchie/summer/stand.webp",
  },
  {
    id: "winter_frenchie",
    name: "冬のフレブル",
    rarity: "SR",
    type: "dog_skin",
    image: "/characters/frenchie/winter/stand.webp",
  },
  {
    id: "explorer_frenchie",
    name: "探検のフレブル",
    rarity: "SR",
    type: "dog_skin",
    image: "/characters/frenchie/explorer/stand.webp",
  },

  // --- 以下は抽選を動かすための仮の景品 ---------------------------------
  // TODO: 本番の景品に差し替える。N / R / SSR に景品が1つも無いと、
  //       そのレアリティが当たったときに配るものが無くなるため置いてある。
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
