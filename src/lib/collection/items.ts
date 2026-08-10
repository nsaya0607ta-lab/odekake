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

/** 内蔵イラストの種類。item-art.tsx がこのキーぶんの絵を持つ */
export type ItemArtKey =
  // おもちゃ
  | "ball"
  | "rope"
  | "bone"
  | "duck"
  | "frisbee"
  // 食べもの
  | "jerky"
  | "biscuit"
  | "bowl"
  | "cake"
  | "apple"
  // インテリア
  | "pillow"
  | "blanket"
  | "dogBed"
  | "lamp"
  | "plant"
  // その他
  | "medal"
  | "ribbon"
  | "crown"
  | "leash"
  | "photoFrame"
  // 登山
  | "backpack"
  | "hikingHat"
  | "pickaxe"
  | "compass"
  | "carabiner"
  | "bottle"
  // 雪国
  | "knitHat"
  | "scarf"
  | "mittens"
  | "snowball"
  | "sled"
  | "snowBoots"
  // 夏
  | "dogSkin"
  | "strawHat"
  | "floatRing"
  | "shavedIce"
  | "sunflower"
  | "watermelon";

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

/** 手で並べたアイテム。ここに足していく */
const CURATED_ITEMS: readonly CollectionItem[] = [
  // --- 通常の図鑑 / おもちゃ -------------------------------------------
  { id: "toy_ball", name: "カラフルボール", image: null, category: "toy", series: null, rarity: "R", art: "ball" },
  { id: "toy_rope", name: "ロープおもちゃ", image: null, category: "toy", series: null, rarity: "N", art: "rope" },
  { id: "toy_bone", name: "ほねのおもちゃ", image: null, category: "toy", series: null, rarity: "N", art: "bone" },
  { id: "toy_duck", name: "アヒルのおもちゃ", image: null, category: "toy", series: null, rarity: "R", art: "duck" },
  { id: "toy_frisbee", name: "フリスビー", image: null, category: "toy", series: null, rarity: "R", art: "frisbee" },

  // --- 通常の図鑑 / 食べもの -------------------------------------------
  { id: "food_jerky", name: "ジャーキー", image: null, category: "food", series: null, rarity: "N", art: "jerky" },
  { id: "food_biscuit", name: "ビスケット", image: null, category: "food", series: null, rarity: "N", art: "biscuit" },
  { id: "food_bowl", name: "ごはんボウル", image: null, category: "food", series: null, rarity: "R", art: "bowl" },
  { id: "food_cake", name: "おいわいケーキ", image: null, category: "food", series: null, rarity: "SR", art: "cake" },
  { id: "food_apple", name: "りんご", image: null, category: "food", series: null, rarity: "N", art: "apple" },

  // --- 通常の図鑑 / インテリア -----------------------------------------
  { id: "interior_pillow", name: "まくら", image: null, category: "interior", series: null, rarity: "R", art: "pillow" },
  { id: "interior_blanket", name: "ブランケット", image: null, category: "interior", series: null, rarity: "R", art: "blanket" },
  { id: "interior_bed", name: "ドッグベッド", image: null, category: "interior", series: null, rarity: "SR", art: "dogBed" },
  { id: "interior_lamp", name: "まるいランプ", image: null, category: "interior", series: null, rarity: "R", art: "lamp" },
  { id: "interior_plant", name: "かんようしょくぶつ", image: null, category: "interior", series: null, rarity: "N", art: "plant" },

  // --- 通常の図鑑 / その他 ---------------------------------------------
  // placeholder_* は既存のガチャ景品。id はそのままにして名前だけ図鑑と揃える。
  { id: "placeholder_n", name: "おさんぽメダル", image: null, category: "other", series: null, rarity: "N", art: "medal" },
  { id: "placeholder_r", name: "きらきらリボン", image: null, category: "other", series: null, rarity: "R", art: "ribbon" },
  { id: "placeholder_ssr", name: "ゴールドクラウン", image: null, category: "other", series: null, rarity: "SSR", art: "crown" },
  { id: "other_leash", name: "おさんぽリード", image: null, category: "other", series: null, rarity: "N", art: "leash" },
  { id: "other_photo_frame", name: "しゃしんたて", image: null, category: "other", series: null, rarity: "SR", art: "photoFrame" },

  // --- 登山シリーズ -----------------------------------------------------
  { id: "hiking_backpack", name: "登山リュック", image: null, category: "other", series: "hiking", rarity: "R", art: "backpack" },
  { id: "hiking_hat", name: "登山ハット", image: null, category: "other", series: "hiking", rarity: "R", art: "hikingHat" },
  { id: "hiking_pickaxe", name: "ピッケル", image: null, category: "other", series: "hiking", rarity: "SR", art: "pickaxe" },
  { id: "hiking_compass", name: "コンパス", image: null, category: "other", series: "hiking", rarity: "N", art: "compass" },
  { id: "hiking_carabiner", name: "カラビナ", image: null, category: "other", series: "hiking", rarity: "N", art: "carabiner" },
  { id: "hiking_bottle", name: "すいとう", image: null, category: "other", series: "hiking", rarity: "R", art: "bottle" },

  // --- 雪国シリーズ -----------------------------------------------------
  { id: "snow_knit_hat", name: "ニット帽", image: null, category: "other", series: "snow", rarity: "R", art: "knitHat" },
  { id: "snow_scarf", name: "マフラー", image: null, category: "other", series: "snow", rarity: "R", art: "scarf" },
  { id: "snow_mittens", name: "てぶくろ", image: null, category: "other", series: "snow", rarity: "N", art: "mittens" },
  { id: "snow_ball", name: "雪のボール", image: null, category: "other", series: "snow", rarity: "N", art: "snowball" },
  { id: "snow_sled", name: "そり", image: null, category: "other", series: "snow", rarity: "SR", art: "sled" },
  { id: "snow_boots", name: "スノーブーツ", image: null, category: "other", series: "snow", rarity: "R", art: "snowBoots" },

  // --- 夏シリーズ -------------------------------------------------------
  // summer_frenchie は既存のガチャ景品（犬のスキン）。
  { id: "summer_frenchie", name: "夏のフレブル", image: null, category: "other", series: "summer", rarity: "SR", art: "dogSkin" },
  { id: "summer_straw_hat", name: "むぎわらぼう", image: null, category: "other", series: "summer", rarity: "R", art: "strawHat" },
  { id: "summer_float", name: "うきわ", image: null, category: "other", series: "summer", rarity: "R", art: "floatRing" },
  { id: "summer_shaved_ice", name: "かきごおり", image: null, category: "other", series: "summer", rarity: "N", art: "shavedIce" },
  { id: "summer_sunflower", name: "ひまわり", image: null, category: "other", series: "summer", rarity: "N", art: "sunflower" },
  { id: "summer_watermelon", name: "スイカ", image: null, category: "other", series: "summer", rarity: "R", art: "watermelon" },
];

const CURATED_IDS = new Set(CURATED_ITEMS.map((item) => item.id));

/**
 * 図鑑に載っていないガチャ景品を拾って「その他」に足す。
 * これがあるので、prizes.ts に景品を足しただけでも図鑑に出る。
 */
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
