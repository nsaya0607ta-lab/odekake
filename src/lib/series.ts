/**
 * シリーズの定義
 * =============================================================
 * 図鑑のシリーズ分類は、ここを唯一の真実源とする。
 * ガチャは単一で、シリーズ限定の抽選プールは設けない
 * （シリーズ景品も他の景品と同じ通常ガチャから排出される）。
 * 新しいシリーズを追加する手順:
 *   1. この配列に1件追加する（図鑑の見た目が自動で揃う）
 *   2. gacha/prizes.ts に景品を追加する
 *   3. collection/items.ts の CURATED_ITEMS に図鑑用エントリを追加する（series にこの id を指定）
 *   4. DB の gacha_rarity_for_item() にも景品のレアリティを追記する
 */

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
  },
] as const;
