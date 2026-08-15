/**
 * 図鑑のアイテム一覧
 * =============================================================
 * id はガチャ景品 id / user_gacha_items.item_id と一致させる。
 * series: null は通常図鑑、hiking / snow / summer はシリーズ図鑑。
 */
import type { GachaRarity } from "@/lib/gacha/config";
import { GACHA_PRIZES } from "@/lib/gacha/prizes";

export const COLLECTION_CATEGORIES = ["toy", "food", "interior", "accessory", "other"] as const;
export type CollectionCategory = (typeof COLLECTION_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<CollectionCategory, string> = {
  toy: "おもちゃ",
  food: "食べもの",
  interior: "インテリア",
  accessory: "アクセサリー",
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

const CURATED_ITEMS: readonly CollectionItem[] = [
  // --- 通常図鑑：おもちゃ 第1弾 --------------------------------------
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

  // --- 通常図鑑：おもちゃ 第2弾 --------------------------------------
  { id: "toy_tennis_ball", name: "テニスボール", image: "/collection/items/tennis-ball.webp", category: "toy", series: null, rarity: "N" },
  { id: "toy_red_slipper", name: "赤いスリッパ", image: "/collection/items/red-slipper.webp", category: "toy", series: null, rarity: "N" },
  { id: "toy_wood_stick", name: "木の枝", image: "/collection/items/wood-stick.webp", category: "toy", series: null, rarity: "N" },
  { id: "toy_donut_rope", name: "ドーナツ型ロープ", image: "/collection/items/donut-rope.webp", category: "toy", series: null, rarity: "N" },
  { id: "toy_soccer_ball", name: "サッカーボール", image: "/collection/items/soccer-ball.webp", category: "toy", series: null, rarity: "R" },
  { id: "toy_taiyaki_plush", name: "たい焼きぬいぐるみ", image: "/collection/items/taiyaki-plush.webp", category: "toy", series: null, rarity: "R" },
  { id: "toy_bear_plush", name: "くまのぬいぐるみ", image: "/collection/items/bear-plush.webp", category: "toy", series: null, rarity: "R" },
  { id: "toy_meat", name: "大きな肉のおもちゃ", image: "/collection/items/meat-toy.webp", category: "toy", series: null, rarity: "SR" },
  { id: "toy_frenchie_cushion", name: "フレブル型クッション", image: "/collection/items/frenchie-cushion.webp", category: "toy", series: null, rarity: "SR" },
  { id: "toy_paw_macaron", name: "にくきゅうマカロン", image: "/collection/items/paw-macaron.webp", category: "toy", series: null, rarity: "SR" },
  { id: "toy_star_wan_wand", name: "スターわんステッキ", image: "/collection/items/star-wan-wand.webp", category: "toy", series: null, rarity: "SR" },
  { id: "toy_golden_crown_ball", name: "王冠つき黄金ボール", image: "/collection/items/golden-crown-ball.webp", category: "toy", series: null, rarity: "SSR" },

  // --- 通常図鑑：食べもの --------------------------------------------
  { id: "food_paw_bowl", name: "肉球フードボウル", image: "/collection/items/paw-food-bowl.webp", category: "food", series: null, rarity: "R" },
  { id: "food_strawberry_roll_cake", name: "いちごロールケーキ", image: "/collection/items/strawberry-roll-cake.webp", category: "food", series: null, rarity: "SR" },
  { id: "food_paw_pudding", name: "肉球プリン", image: "/collection/items/paw-pudding.webp", category: "food", series: null, rarity: "R" },
  { id: "food_paw_melon_bread", name: "肉球メロンパン", image: "/collection/items/paw-melon-bread.webp", category: "food", series: null, rarity: "R" },
  { id: "food_smile_onigiri", name: "にこにこおにぎり", image: "/collection/items/smile-onigiri.webp", category: "food", series: null, rarity: "N" },
  { id: "food_paw_cupcake", name: "肉球カップケーキ", image: "/collection/items/paw-cupcake.webp", category: "food", series: null, rarity: "SR" },
  { id: "food_paw_taiyaki", name: "にくきゅうたい焼き", image: "/collection/items/paw-taiyaki.webp", category: "food", series: null, rarity: "N" },
  { id: "food_dog_milk", name: "わんこミルク", image: "/collection/items/dog-milk.webp", category: "food", series: null, rarity: "N" },
  { id: "food_cheese_cubes", name: "ころころチーズ", image: "/collection/items/cheese-cubes.webp", category: "food", series: null, rarity: "N" },
  { id: "food_roasted_sweet_potato", name: "ほくほく焼きいも", image: "/collection/items/roasted-sweet-potato.webp", category: "food", series: null, rarity: "N" },
  { id: "food_honey_butter_toast", name: "はちみつバタートースト", image: "/collection/items/honey-butter-toast.webp", category: "food", series: null, rarity: "N" },

  // --- 通常図鑑：インテリア ------------------------------------------
  { id: "interior_anball", name: "アンボール", image: "/collection/items/anball.webp", category: "interior", series: null, rarity: "UR" },
  { id: "interior_kinoko_azubee", name: "きのこあずびー", image: "/collection/items/3365FE0A-4198-4C04-BA73-A7BAC18F73F5.png", category: "interior", series: null, rarity: "UR" },
  { id: "interior_sleepy_moon", name: "おやすみムーン", image: "/collection/items/sleepy-moon.webp", category: "interior", series: null, rarity: "SR" },
  { id: "interior_spring_flower_wreath", name: "はるいろフラワーリース", image: "/collection/items/spring-flower-wreath.webp", category: "interior", series: null, rarity: "SR" },
  { id: "interior_shikkoku_no_ar", name: "漆黒のアー", image: "/collection/items/shikkoku-no-ar.webp", category: "interior", series: null, rarity: "LR" },

  // --- 通常図鑑：アクセサリー ----------------------------------------
  { id: "other_sparkle_rope_crown", name: "きらきらロープクラウン", image: "/collection/items/sparkle-rope-crown.webp", category: "accessory", series: null, rarity: "SR" },

  // --- 通常図鑑：その他 ----------------------------------------------
  { id: "other_azubee", name: "あずびー", image: "/collection/items/two-dogs-icon-transparent.webp", category: "other", series: null, rarity: "UR" },
  { id: "other_omojii", name: "おもじぃ", image: "/collection/items/8B027535-244F-4729-86F5-A69CDD91D103.png", category: "other", series: null, rarity: "UR" },
  { id: "other_nakayoshi_azubee", name: "なかよしあずびー", image: "/collection/items/890D1313-B79F-493C-97C2-1898F7663C01.png", category: "other", series: null, rarity: "SSR" },
  { id: "other_komochi", name: "こもち", image: "/collection/items/C7DF48F4-588E-4B31-983E-A52623328924.png", category: "other", series: null, rarity: "UR" },
  { id: "other_azuki", name: "小豆(あずき)", image: "/collection/items/6F31AD19-B242-42D6-83D3-380A3F3D3FC0.png", category: "other", series: null, rarity: "UR" },
  { id: "other_kobee", name: "こびー", image: "/collection/items/4FA70BBA-6CBA-42B2-9A96-4B07AFDF56E0.png", category: "other", series: null, rarity: "UR" },
  { id: "other_kamunayo", name: "かむなよ", image: "/collection/items/7FEA86AD-6904-4151-BEA8-5A33F7C97B01.png", category: "other", series: null, rarity: "SSR" },
  { id: "other_hamigaki", name: "はみがき", image: "/collection/items/hamigaki.webp", category: "other", series: null, rarity: "SSR" },

  // --- 通常図鑑：おでかけ小物 ------------------------------------------
  { id: "other_yellow_rain_boots", name: "きいろのながぐつ", image: "/collection/items/yellow-rain-boots.webp", category: "other", series: null, rarity: "N" },
  { id: "accessory_red_bandana", name: "あかいバンダナ", image: "/collection/items/red-bandana.webp", category: "accessory", series: null, rarity: "N" },
  { id: "other_acorns", name: "ころころどんぐり", image: "/collection/items/acorns.webp", category: "other", series: null, rarity: "N" },
  { id: "toy_paper_airplane", name: "しろい紙ひこうき", image: "/collection/items/paper-airplane.webp", category: "toy", series: null, rarity: "N" },
  { id: "other_walk_water_bottle", name: "おさんぽ水筒", image: "/collection/items/walk-water-bottle.webp", category: "other", series: null, rarity: "N" },
  { id: "other_shiny_pinecone", name: "つやつやまつぼっくり", image: "/collection/items/pinecone.webp", category: "other", series: null, rarity: "N" },
  { id: "accessory_blue_handkerchief", name: "あおいハンカチ", image: "/collection/items/paw-picnic-blanket.webp", category: "accessory", series: null, rarity: "N" },
  { id: "toy_red_balloon", name: "あかい風船", image: "/collection/items/red-balloon.webp", category: "toy", series: null, rarity: "N" },
  { id: "toy_sand_bucket", name: "おすなばバケツ", image: "/collection/items/flower-sand-bucket.webp", category: "toy", series: null, rarity: "N" },
  { id: "accessory_walk_pouch", name: "おさんぽポーチ", image: "/collection/items/pet-outing-bag.webp", category: "accessory", series: null, rarity: "N" },

  // --- 登山シリーズ ----------------------------------------------------
  { id: "hiking_frenchie", name: "登山のフレブル", image: "/collection/skins/hiking-frenchie.webp", category: "other", series: "hiking", rarity: "SSR", art: "dogHiking" },
  // --- 雪国シリーズ ----------------------------------------------------
  { id: "snow_frenchie", name: "雪国のフレブル", image: "/collection/skins/snow-frenchie.webp", category: "other", series: "snow", rarity: "SSR", art: "dogSnow" },
  // --- 夏シリーズ ------------------------------------------------------
  { id: "summer_frenchie", name: "夏のフレブル", image: "/collection/skins/summer-frenchie.webp", category: "other", series: "summer", rarity: "SSR", art: "dogSummer" },
];

const CURATED_IDS = new Set(CURATED_ITEMS.map((item) => item.id));

/** 未整理の新規ガチャ景品は通常図鑑の「その他」へ自動追加する */
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

export const RARITY_STARS: Record<GachaRarity, number> = { N: 1, R: 2, SR: 3, SSR: 4, UR: 5, LR: 6 };
