/**
 * 図鑑のアイテム一覧
 * =============================================================
 * id はガチャ景品 id / user_gacha_items.item_id と一致させる。
 * series: null は通常図鑑、hiking / snow / summer はシリーズ図鑑。
 */
import type { GachaRarity } from "@/lib/gacha/config";
import { GACHA_PRIZES } from "@/lib/gacha/prizes";

export const COLLECTION_CATEGORIES = ["toy", "food", "interior", "other"] as const;
export type CollectionCategory = (typeof COLLECTION_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<CollectionCategory, string> = {
  toy: "おもちゃ",
  food: "食べもの",
  interior: "インテリア",
  other: "その他",
};

export const COLLECTION_SERIES_IDS = ["hiking", "snow", "summer"] as const;
export type CollectionSeriesId = (typeof COLLECTION_SERIES_IDS)[number];

export function isCollectionSeriesId(value: unknown): value is CollectionSeriesId {
  return typeof value === "string" && (COLLECTION_SERIES_IDS as readonly string[]).includes(value);
}

export function isCollectionCategory(value: unknown): value is CollectionCategory {
  return typeof value === "string" && (COLLECTION_CATEGORIES as readonly string[]).includes(value);
}

export type ItemArtKey = "dogHiking" | "dogSnow" | "dogSummer";

export type CollectionItem = {
  id: string;
  name: string;
  image: string | null;
  category: CollectionCategory;
  series: CollectionSeriesId | null;
  rarity: GachaRarity;
  art?: ItemArtKey;
};

export type CollectionSeries = {
  id: CollectionSeriesId;
  name: string;
  description: string;
  tone: {
    header: string;
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

const PAW_FOOD_BOWL_IMAGE = "/collection/items/paw-food-bowl.svg";

const CURATED_ITEMS: readonly CollectionItem[] = [
  { id: "toy_colorful_ball", name: "カラフルボール", image: "/collection/items/colorful-ball.webp", category: "toy", series: null, rarity: "N" },
  { id: "toy_rope", name: "ロープおもちゃ", image: "/collection/items/rope-toy.webp", category: "toy", series: null, rarity: "N" },
  { id: "toy_bone", name: "ほねのおもちゃ", image: "/collection/items/bone-toy.webp", category: "toy", series: null, rarity: "N" },
  { id: "toy_squeaky_ball", name: "ぴこぴこボール", image: "/collection/items/squeaky-ball.webp", category: "toy", series: null, rarity: "N" },
  { id: "toy_duck_plush", name: "あひるのぬいぐるみ", image: "/collection/items/duck-plush.webp", category: "toy", series: null, rarity: "R" },
  { id: "toy_carrot", name: "にんじんトイ", image: "/collection/items/carrot-toy.webp", category: "toy", series: null, rarity: "R" },
  { id: "toy_frisbee", name: "フリスビー", image: "/collection/items/frisbee.webp", category: "toy", series: null, rarity: "R" },
  { id: "toy_treasure_puzzle", name: "宝箱おやつパズル", image: "/collection/items/treasure-puzzle.webp", category: "toy", series: null, rarity: "SR" },
  { id: "toy_frenchie_plush", name: "フレブルぬいぐるみ", image: "/collection/items/frenchie-plush.webp", category: "toy", series: null, rarity: "SR" },
  { id: "toy_rainbow_ball", name: "虹色わんこボール", image: "/collection/items/rainbow-ball.webp", category: "toy", series: null, rarity: "SSR" },
  { id: "toy_tennis_ball", name: "テニスボール", image: "/collection/items/tennis-ball.webp", category: "toy", series: null, rarity: "N" },
  { id: "toy_red_slipper", name: "赤いスリッパ", image: "/collection/items/red-slipper.webp", category: "toy", series: null, rarity: "N" },
  { id: "toy_wood_stick", name: "木の枝", image: "/collection/items/wood-stick.webp", category: "toy", series: null, rarity: "N" },
  { id: "toy_donut_rope", name: "ドーナツ型ロープ", image: "/collection/items/donut-rope.webp", category: "toy", series: null, rarity: "N" },
  { id: "toy_soccer_ball", name: "サッカーボール", image: "/collection/items/soccer-ball.webp", category: "toy", series: null, rarity: "R" },
  { id: "toy_taiyaki_plush", name: "たい焼きぬいぐるみ", image: "/collection/items/taiyaki-plush.webp", category: "toy", series: null, rarity: "R" },
  { id: "toy_bear_plush", name: "くまのぬいぐるみ", image: "/collection/items/bear-plush.webp", category: "toy", series: null, rarity: "R" },
  { id: "toy_meat", name: "大きな肉のおもちゃ", image: "/collection/items/meat-toy.webp", category: "toy", series: null, rarity: "SR" },
  { id: "toy_frenchie_cushion", name: "フレブル型クッション", image: "/collection/items/frenchie-cushion.webp", category: "toy", series: null, rarity: "SR" },
  { id: "toy_golden_crown_ball", name: "王冠つき黄金ボール", image: "/collection/items/golden-crown-ball.webp", category: "toy", series: null, rarity: "SSR" },
  { id: "food_paw_bowl", name: "肉球フードボウル", image: PAW_FOOD_BOWL_IMAGE, category: "food", series: null, rarity: "R" },
  { id: "hiking_frenchie", name: "登山のフレブル", image: "/collection/skins/hiking-frenchie.webp", category: "other", series: "hiking", rarity: "SSR", art: "dogHiking" },
  { id: "snow_frenchie", name: "雪国のフレブル", image: "/collection/skins/snow-frenchie.webp", category: "other", series: "snow", rarity: "SSR", art: "dogSnow" },
  { id: "summer_frenchie", name: "夏のフレブル", image: "/collection/skins/summer-frenchie.webp", category: "other", series: "summer", rarity: "SSR", art: "dogSummer" },
];

const CURATED_IDS = new Set(CURATED_ITEMS.map((item) => item.id));

const UNLISTED_PRIZES: readonly CollectionItem[] = GACHA_PRIZES.filter(
  (prize) => !CURATED_IDS.has(prize.id),
).map((prize) => ({
  id: prize.id,
  name: prize.name,
  image: prize.image,
  category: "other" as const,
  series: null,
  rarity: prize.rarity,
}));

export const COLLECTION_ITEMS: readonly CollectionItem[] = [...CURATED_ITEMS, ...UNLISTED_PRIZES];
export const REGULAR_ITEMS: readonly CollectionItem[] = COLLECTION_ITEMS.filter((item) => item.series === null);

export function getSeriesItems(seriesId: CollectionSeriesId): CollectionItem[] {
  return COLLECTION_ITEMS.filter((item) => item.series === seriesId);
}

export function countOwned(items: readonly CollectionItem[], owned: ReadonlySet<string>): number {
  return items.reduce((count, item) => (owned.has(item.id) ? count + 1 : count), 0);
}

export const RARITY_STARS: Record<GachaRarity, number> = { N: 1, R: 2, SR: 3, SSR: 4 };
