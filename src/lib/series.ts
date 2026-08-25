/**
 * シリーズの定義
 * =============================================================
 * ガチャの排出プールと図鑑のシリーズ分類は、ここを唯一の真実源とする。
 * 新しいシリーズを追加する手順:
 *   1. この配列に1件追加する（ガチャ種別・排出率・図鑑の見た目が自動で揃う）
 *   2. gacha/prizes.ts に景品を追加し、pool にこの id を指定する
 *   3. collection/items.ts の CURATED_ITEMS に図鑑用エントリを追加する
 *   4. DB の gacha_rarity_for_item() にも景品のレアリティを追記する
 */
import type { GachaRarity } from "./gacha/config";

export const SERIES_IDS = ["hiking", "snow", "summer"] as const;
export type SeriesId = (typeof SERIES_IDS)[number];

export function isSeriesId(value: unknown): value is SeriesId {
  return typeof value === "string" && (SERIES_IDS as readonly string[]).includes(value);
}

export type SeriesDefinition = {
  id: SeriesId;
  name: string;
  description: string;
  tone: {
    header: string;
    accent: string;
    bar: string;
  };
  /** ガチャ選択タブなどに出す短いラベル */
  gachaLabel: string;
  /** このシリーズガチャの排出率（合計100%）。実際の抽選に使う内部値。 */
  rarityRates: Record<GachaRarity, number>;
};

export const SERIES: readonly SeriesDefinition[] = [
  {
    id: "hiking",
    name: "登山シリーズ",
    description: "山のおでかけで集まるアイテム",
    tone: {
      header: "border-leaf bg-leaf-soft text-leaf-deep",
      accent: "border-leaf bg-leaf-soft text-leaf-deep",
      bar: "bg-leaf",
    },
    gachaLabel: "登山限定",
    rarityRates: { N: 0, R: 0, SR: 0, SSR: 0, UR: 0, LR: 100, MR: 0 },
  },
  {
    id: "snow",
    name: "雪国シリーズ",
    description: "雪のまちで集まるアイテム",
    tone: {
      header: "border-sky bg-sky-soft text-[#42718f]",
      accent: "border-sky bg-sky-soft text-[#42718f]",
      bar: "bg-sky",
    },
    gachaLabel: "雪国限定",
    rarityRates: { N: 0, R: 0, SR: 0, SSR: 0, UR: 0, LR: 100, MR: 0 },
  },
  {
    id: "summer",
    name: "夏シリーズ",
    description: "夏のおでかけで集まるアイテム",
    tone: {
      header: "border-sun bg-sun-soft text-[#8a6a2a]",
      accent: "border-sun bg-sun-soft text-[#8a6a2a]",
      bar: "bg-sun",
    },
    gachaLabel: "夏限定",
    rarityRates: { N: 45, R: 30, SR: 15, SSR: 6, UR: 2, LR: 2, MR: 0 },
  },
] as const;

const SERIES_BY_ID = new Map(SERIES.map((series) => [series.id, series]));

export function getSeriesDefinition(id: SeriesId): SeriesDefinition | null {
  return SERIES_BY_ID.get(id) ?? null;
}
