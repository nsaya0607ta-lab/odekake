/**
 * 図鑑のアイテム一覧
 * =============================================================
 * 図鑑に並ぶものはすべてここに書く。増やすときは COLLECTION_ITEMS に1行足すだけ。
 *
 * - id ……… ガチャの景品 id（src/lib/gacha/prizes.ts）と同じ文字列にする。
 *            所持判定は user_gacha_items.item_id と突き合わせるため、
 *            id が一致していないと「取得済み」にならない。一度出した id は変えないこと。
 * - series … null なら「通常の図鑑」、hiking / snow / summer なら「シリーズ図鑑」。
 * - image … public/ からのパス。素材がまだ無いものは null にしておくと、
 *            内蔵のイラスト（src/components/collection/item-art.tsx）を使う。
 * - art …… 内蔵イラストの種類。image を入れたら見た目はそちらが優先される。
 *
 * ガチャに景品を足したとき（prizes.ts だけ更新したとき）は、ここに同じ id が
 * 無くても図鑑の「その他」へ自動で並ぶ。名前・カテゴリ・シリーズを整えたいときに
 * この一覧へ追記すればよい。
 *
 * いまは犬のスキン3種（登山・雪国・夏）だけ。通常の図鑑のアイテムは未登録。
 */
import type { GachaRarity } from "@/lib/gacha/config";
import { GACHA_PRIZES } from "@/lib/gacha/prizes";

/** 通常の図鑑のカテゴリ */
export const COLLECTION_CATEGORIES = ["toy", "food", "interior", "other"] as const;
export type CollectionCategory = (typeof COLLECTION_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<CollectionCategory, string> = {
  toy: "おもちゃ",
  food: "食べもの",
  interior: "インテリア",
  other: "その他",
};

/** シリーズ図鑑のシリーズ */
export const COLLECTION_SERIES_IDS = ["hiking", "snow", "summer"] as const;
export type CollectionSeriesId = (typeof COLLECTION_SERIES_IDS)[number];

export function isCollectionSeriesId(value: unknown): value is CollectionSeriesId {
  return typeof value === "string" && (COLLECTION_SERIES_IDS as readonly string[]).includes(value);
}

export function isCollectionCategory(value: unknown): value is CollectionCategory {
  return typeof value === "string" && (COLLECTION_CATEGORIES as readonly string[]).includes(value);
}

/**
 * 内蔵イラストの種類。item-art.tsx がこのキーぶんの絵を持つ。
 * アイテムを足すときは、ここにキーを足して item-art.tsx に絵を描く。
 */
export type ItemArtKey = "dogHiking" | "dogSnow" | "dogSummer";

export type CollectionItem = {
  id: string;
  name: string;
  /** public/ からのパス。素材が無いなら null */
  image: string | null;
  category: CollectionCategory;
  series: CollectionSeriesId | null;
  rarity: GachaRarity;
  /** image が null のときに描く内蔵イラスト */
  art?: ItemArtKey;
};

export type CollectionSeries = {
  id: CollectionSeriesId;
  name: string;
  description: string;
  /** カードの見た目。シリーズごとの淡い色 */
  tone: {
    /** 見出し帯 */
    header: string;
    /** タブや進捗バーのアクセント */
    accent: string;
    bar: string;
  };
};

export const COLLECTION_SERIES: readonly CollectionSeries[] = [
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
];

const SERIES_BY_ID = new Map(COLLECTION_SERIES.map((series) => [series.id, series]));

export function getSeries(id: CollectionSeriesId): CollectionSeries | null {
  return SERIES_BY_ID.get(id) ?? null;
}

/**
 * 図鑑に出さないガチャ景品。
 * placeholder_* は「N / R / SSR に景品がゼロだと抽選が止まる」ための仮の景品なので、
 * 本物の景品に差し替えるまで図鑑には並べない。差し替えたらここから外す。
 */
const HIDDEN_PRIZE_IDS = new Set(["placeholder_n", "placeholder_r", "placeholder_ssr"]);

/** 図鑑に並べるアイテム。ここに足していく */
const CURATED_ITEMS: readonly CollectionItem[] = [
  // --- 登山シリーズ -----------------------------------------------------
  {
    id: "hiking_frenchie",
    name: "登山のフレブル",
    image: null,
    category: "other",
    series: "hiking",
    rarity: "SR",
    art: "dogHiking",
  },

  // --- 雪国シリーズ -----------------------------------------------------
  {
    id: "snow_frenchie",
    name: "雪国のフレブル",
    image: null,
    category: "other",
    series: "snow",
    rarity: "SR",
    art: "dogSnow",
  },

  // --- 夏シリーズ -------------------------------------------------------
  {
    id: "summer_frenchie",
    name: "夏のフレブル",
    image: "/collection/skins/summer-frenchie.webp",
    category: "other",
    series: "summer",
    rarity: "SR",
    art: "dogSummer",
  },

  // TODO: 通常の図鑑（series: null）のアイテムはまだ無い。
  //       おもちゃ・食べもの・インテリア・その他 のアイテムが決まったらここに足す。
];

const CURATED_IDS = new Set(CURATED_ITEMS.map((item) => item.id));

/**
 * 図鑑に載っていないガチャ景品を拾って「その他」に足す。
 * これがあるので、prizes.ts に景品を足しただけでも図鑑に出る。
 * HIDDEN_PRIZE_IDS に入れたものだけは出さない。
 */
const UNLISTED_PRIZES: readonly CollectionItem[] = GACHA_PRIZES.filter(
  (prize) => !CURATED_IDS.has(prize.id) && !HIDDEN_PRIZE_IDS.has(prize.id),
).map((prize) => ({
  id: prize.id,
  name: prize.name,
  image: prize.image,
  category: "other" as const,
  series: null,
  rarity: prize.rarity,
}));

export const COLLECTION_ITEMS: readonly CollectionItem[] = [...CURATED_ITEMS, ...UNLISTED_PRIZES];

/** 通常の図鑑（シリーズに属さないもの） */
export const REGULAR_ITEMS: readonly CollectionItem[] = COLLECTION_ITEMS.filter(
  (item) => item.series === null,
);

export function getSeriesItems(seriesId: CollectionSeriesId): CollectionItem[] {
  return COLLECTION_ITEMS.filter((item) => item.series === seriesId);
}

/** 所持している数を数える */
export function countOwned(items: readonly CollectionItem[], owned: ReadonlySet<string>): number {
  return items.reduce((count, item) => (owned.has(item.id) ? count + 1 : count), 0);
}

/** レアリティを星の数にする（図鑑では★で見せる） */
export const RARITY_STARS: Record<GachaRarity, number> = { N: 1, R: 2, SR: 3, SSR: 4 };
