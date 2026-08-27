/**
 * 図鑑のアイテム一覧
 * =============================================================
 * id はガチャ景品 id / user_gacha_items.item_id と一致させる。
 * series: null は通常図鑑、hiking / snow / summer はシリーズ図鑑。
 * シリーズそのものの定義（名前・見た目）は series.ts を唯一の真実源とする。
 * シリーズのアイテムもガチャは分けず、通常ガチャから排出される。
 */
import type { GachaRarity } from "@/lib/gacha/config";
import { GACHA_PRIZES } from "@/lib/gacha/prizes";
import { SERIES, SERIES_IDS, isSeriesId, type SeriesId } from "@/lib/series";

export const COLLECTION_CATEGORIES = ["toy", "food", "interior", "accessory", "other"] as const;
export type CollectionCategory = (typeof COLLECTION_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<CollectionCategory, string> = {
  toy: "おもちゃ",
  food: "食べもの",
  interior: "インテリア",
  accessory: "アクセサリー",
  other: "その他",
};

export const COLLECTION_SERIES_IDS = SERIES_IDS;
export type CollectionSeriesId = SeriesId;

export const isCollectionSeriesId = isSeriesId;

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

export const COLLECTION_SERIES: readonly CollectionSeries[] = SERIES.map((series) => ({
  id: series.id,
  name: series.name,
  description: series.description,
  tone: series.tone,
}));

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
  { id: "food_fruit_basket", name: "フルーツバスケット", image: "/collection/items/fruit-basket.webp", category: "food", series: null, rarity: "SR" },
  { id: "food_kamikami", name: "かみかみ", image: "/collection/items/kamikami.webp", category: "food", series: null, rarity: "R" },
  { id: "food_mocchurin", name: "もっちゅりん", image: "/collection/items/mocchurin.webp", category: "food", series: null, rarity: "UR" },

  // --- 通常図鑑：インテリア ------------------------------------------
  { id: "interior_stretch_rod", name: "ストレッチ棒", image: "/collection/items/stretch-rod.webp", category: "interior", series: null, rarity: "R" },
  { id: "interior_anball", name: "アンボール", image: "/collection/items/anball.webp", category: "interior", series: null, rarity: "UR" },
  { id: "interior_kinoko_azubee", name: "きのこあずびー", image: "/collection/items/3365FE0A-4198-4C04-BA73-A7BAC18F73F5.webp", category: "interior", series: null, rarity: "UR" },
  { id: "interior_gold_ball", name: "ゴールドボール", image: "/collection/items/gold-ball.webp", category: "interior", series: null, rarity: "SSR" },
  { id: "interior_sleepy_moon", name: "おやすみムーン", image: "/collection/items/sleepy-moon.webp", category: "interior", series: null, rarity: "SR" },
  { id: "interior_spring_flower_wreath", name: "はるいろフラワーリース", image: "/collection/items/spring-flower-wreath.webp", category: "interior", series: null, rarity: "SR" },
  { id: "interior_shikkoku_no_ar", name: "漆黒のアー", image: "/collection/items/shikkoku-no-ar.webp", category: "interior", series: null, rarity: "LR" },
  { id: "interior_ragby_ar", name: "ラグビーアー", image: "/collection/items/ragby-ar.webp", category: "interior", series: null, rarity: "LR" },

  // --- 通常図鑑：アクセサリー ----------------------------------------
  { id: "other_sparkle_rope_crown", name: "きらきらロープクラウン", image: "/collection/items/sparkle-rope-crown.webp", category: "accessory", series: null, rarity: "SR" },

  // --- 通常図鑑：その他 ----------------------------------------------
  { id: "other_azubee", name: "あずびー", image: "/collection/items/two-dogs-icon-transparent.webp", category: "other", series: null, rarity: "UR" },
  { id: "other_omojii", name: "おもじぃ", image: "/collection/items/8B027535-244F-4729-86F5-A69CDD91D103.webp", category: "other", series: null, rarity: "UR" },
  { id: "other_nakayoshi_azubee", name: "なかよしあずびー", image: "/collection/items/890D1313-B79F-493C-97C2-1898F7663C01.webp", category: "other", series: null, rarity: "SSR" },
  { id: "other_komochi", name: "こもち", image: "/collection/items/C7DF48F4-588E-4B31-983E-A52623328924.webp", category: "other", series: null, rarity: "UR" },
  { id: "other_azuki", name: "小豆(あずき)", image: "/collection/items/6F31AD19-B242-42D6-83D3-380A3F3D3FC0.webp", category: "other", series: null, rarity: "UR" },
  { id: "other_kobee", name: "こびー", image: "/collection/items/4FA70BBA-6CBA-42B2-9A96-4B07AFDF56E0.webp", category: "other", series: null, rarity: "UR" },
  { id: "other_kamunayo", name: "かむなよ", image: "/collection/items/7FEA86AD-6904-4151-BEA8-5A33F7C97B01.webp", category: "other", series: null, rarity: "SSR" },
  { id: "other_hamigaki", name: "はみがき", image: "/collection/items/hamigaki.webp", category: "other", series: null, rarity: "SSR" },
  { id: "other_ikea", name: "IKEA", image: "/collection/items/ikea.webp", category: "other", series: null, rarity: "SSR" },
  { id: "other_orusuban", name: "おるすばん", image: "/collection/items/orusuban.webp", category: "other", series: null, rarity: "SSR" },
  { id: "other_kurumari_a", name: "くるまりアー", image: "/collection/items/kurumari-a.webp", category: "other", series: null, rarity: "SSR" },
  { id: "other_pondeomo", name: "ぽんでおも", image: "/collection/items/pondeomo.webp", category: "other", series: null, rarity: "SSR" },
  { id: "other_pondear", name: "ぽんでアー", image: "/collection/items/pondear.webp", category: "other", series: null, rarity: "SSR" },
  { id: "other_oyatsu_no_jikan", name: "おやつのじかん", image: "/collection/items/oyatsu-no-jikan.webp", category: "other", series: null, rarity: "SSR" },
  { id: "other_jare_a", name: "じゃれアー", image: "/collection/items/jare-a.webp", category: "other", series: null, rarity: "SSR" },
  { id: "other_ketsunade_a", name: "けつなでアー", image: "/collection/items/ketsunade-a.webp", category: "other", series: null, rarity: "SSR" },
  { id: "other_omochi_janai", name: "おもちじゃない...!?", image: "/collection/items/omochi-janai.webp", category: "other", series: null, rarity: "SSR" },
  { id: "other_oyasumi", name: "おやすみ", image: "/collection/items/oyasumi.webp", category: "other", series: null, rarity: "SSR" },
  { id: "other_nisoku_a", name: "二足アー", image: "/collection/items/nisoku-a.webp", category: "other", series: null, rarity: "SSR" },
  { id: "other_listen_to_the_a", name: "Listen to the a-", image: "/collection/items/listen-to-the-a.webp", category: "other", series: null, rarity: "LR" },
  { id: "other_okaeri", name: "おかえり", image: "/collection/items/okaeri.webp", category: "other", series: null, rarity: "LR" },
  { id: "other_omoi_bashira", name: "一家の大オモ柱", image: "/collection/items/omoi-bashira.webp", category: "other", series: null, rarity: "UR" },

  // --- 通常図鑑：MR ----------------------------------------------------
  { id: "other_burebur", name: "ブレブル", image: "/collection/items/burebur.webp", category: "other", series: null, rarity: "MR" },
  { id: "other_xmas_party", name: "Xmas Party", image: "/collection/items/xmas-party.webp", category: "other", series: null, rarity: "MR" },

  // --- 通常図鑑：その他 追加分 ------------------------------------------
  { id: "other_clawd", name: "Clawd", image: "/collection/items/clawd.webp", category: "other", series: null, rarity: "SSR" },

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
  { id: "hiking_frenchie", name: "登山のフレブル", image: "/collection/skins/hiking-frenchie.webp", category: "other", series: "hiking", rarity: "LR", art: "dogHiking" },
  { id: "toy_hiking_stick", name: "木の枝ステッキ", image: "/collection/items/hiking-stick.webp", category: "toy", series: "hiking", rarity: "N" },
  { id: "toy_rock_ball", name: "ごつごつ岩ボール", image: "/collection/items/rock-ball.webp", category: "toy", series: "hiking", rarity: "N" },
  { id: "toy_echo_whistle", name: "山びこホイッスル", image: "/collection/items/echo-whistle.webp", category: "toy", series: "hiking", rarity: "N" },
  { id: "toy_rope_swing", name: "ターザンロープ", image: "/collection/items/rope-swing.webp", category: "toy", series: "hiking", rarity: "R" },
  { id: "food_ume_onigiri", name: "梅干しおにぎり", image: "/collection/items/ume-onigiri.webp", category: "food", series: "hiking", rarity: "N" },
  { id: "food_hut_curry", name: "山小屋カレー", image: "/collection/items/hut-curry.webp", category: "food", series: "hiking", rarity: "N" },
  { id: "food_onsen_tamago", name: "温泉たまご", image: "/collection/items/onsen-tamago.webp", category: "food", series: "hiking", rarity: "R" },
  { id: "food_summit_cup_ramen", name: "山頂カップラーメン", image: "/collection/items/summit-cup-ramen.webp", category: "food", series: "hiking", rarity: "R" },
  { id: "interior_led_lantern", name: "LEDランタン", image: "/collection/items/led-lantern.webp", category: "interior", series: "hiking", rarity: "N" },
  { id: "interior_campfire_set", name: "焚き火セット", image: "/collection/items/campfire-set.webp", category: "interior", series: "hiking", rarity: "R" },
  { id: "interior_hut_fireplace", name: "山小屋の暖炉", image: "/collection/items/hut-fireplace.webp", category: "interior", series: "hiking", rarity: "SR" },
  { id: "interior_stargazing_telescope", name: "星空の天体望遠鏡", image: "/collection/items/stargazing-telescope.webp", category: "interior", series: "hiking", rarity: "SSR" },
  { id: "accessory_bear_bell", name: "熊よけ鈴", image: "/collection/items/bear-bell.webp", category: "accessory", series: "hiking", rarity: "N" },
  { id: "accessory_hiking_backpack", name: "リュックサック", image: "/collection/items/hiking-backpack.webp", category: "accessory", series: "hiking", rarity: "N" },
  { id: "accessory_trekking_poles", name: "トレッキングポール", image: "/collection/items/trekking-poles.webp", category: "accessory", series: "hiking", rarity: "R" },
  { id: "accessory_hiking_pin_hat", name: "登山バッジ帽子", image: "/collection/items/hiking-pin-hat.webp", category: "accessory", series: "hiking", rarity: "SR" },
  { id: "other_trail_map_compass", name: "山の地図とコンパス", image: "/collection/items/trail-map-compass.webp", category: "other", series: "hiking", rarity: "R" },
  { id: "other_cairn", name: "ケルン(積み石)", image: "/collection/items/cairn.webp", category: "other", series: "hiking", rarity: "SR" },
  { id: "other_sunrise_view", name: "ご来光", image: "/collection/items/sunrise-view.webp", category: "other", series: "hiking", rarity: "SSR" },
  { id: "other_sea_of_clouds", name: "雲海", image: "/collection/items/sea-of-clouds.webp", category: "other", series: "hiking", rarity: "UR" },
  // --- 雪国シリーズ ----------------------------------------------------
  { id: "snow_frenchie", name: "雪国のフレブル", image: "/collection/skins/snow-frenchie.webp", category: "other", series: "snow", rarity: "LR", art: "dogSnow" },
  { id: "toy_sled", name: "雪ぞり", image: "/collection/items/sled.webp", category: "toy", series: "snow", rarity: "N" },
  { id: "toy_snowman_kit", name: "雪だるまキット", image: "/collection/items/snowman-kit.webp", category: "toy", series: "snow", rarity: "N" },
  { id: "toy_snowball", name: "雪玉(雪合戦用)", image: "/collection/items/snowball.webp", category: "toy", series: "snow", rarity: "N" },
  { id: "toy_mini_skis", name: "ミニスキー板", image: "/collection/items/mini-skis.webp", category: "toy", series: "snow", rarity: "R" },
  { id: "food_snow_roasted_sweet_potato", name: "焼き芋", image: "/collection/items/snow-roasted-sweet-potato.webp", category: "food", series: "snow", rarity: "N" },
  { id: "food_oshiruko", name: "おしるこ", image: "/collection/items/oshiruko.webp", category: "food", series: "snow", rarity: "N" },
  { id: "food_oden", name: "熱々おでん", image: "/collection/items/oden.webp", category: "food", series: "snow", rarity: "R" },
  { id: "food_hot_chocolate", name: "ホットチョコレート", image: "/collection/items/hot-chocolate.webp", category: "food", series: "snow", rarity: "R" },
  { id: "interior_yutanpo", name: "湯たんぽ", image: "/collection/items/yutanpo.webp", category: "interior", series: "snow", rarity: "N" },
  { id: "interior_fluffy_blanket", name: "もこもこ毛布", image: "/collection/items/fluffy-blanket.webp", category: "interior", series: "snow", rarity: "R" },
  { id: "interior_kerosene_stove", name: "石油ストーブ", image: "/collection/items/kerosene-stove.webp", category: "interior", series: "snow", rarity: "SR" },
  { id: "interior_kotatsu", name: "こたつ", image: "/collection/items/kotatsu.webp", category: "interior", series: "snow", rarity: "SSR" },
  { id: "accessory_knit_hat", name: "ニット帽", image: "/collection/items/knit-hat.webp", category: "accessory", series: "snow", rarity: "N" },
  { id: "accessory_muffler", name: "マフラー", image: "/collection/items/muffler.webp", category: "accessory", series: "snow", rarity: "N" },
  { id: "accessory_mittens", name: "ミトン手袋", image: "/collection/items/mittens.webp", category: "accessory", series: "snow", rarity: "R" },
  { id: "accessory_fluffy_boots", name: "もこもこブーツ", image: "/collection/items/fluffy-boots.webp", category: "accessory", series: "snow", rarity: "SR" },
  { id: "other_icicle", name: "つらら", image: "/collection/items/icicle.webp", category: "other", series: "snow", rarity: "R" },
  { id: "other_snowflake_ornament", name: "雪の結晶オーナメント", image: "/collection/items/snowflake-ornament.webp", category: "other", series: "snow", rarity: "SR" },
  { id: "other_snow_lantern", name: "雪灯篭", image: "/collection/items/snow-lantern.webp", category: "other", series: "snow", rarity: "SSR" },
  { id: "other_kamakura", name: "かまくら", image: "/collection/items/kamakura.webp", category: "other", series: "snow", rarity: "UR" },
  // --- 夏シリーズ ------------------------------------------------------
  { id: "summer_frenchie", name: "夏のフレブル", image: "/collection/skins/summer-frenchie.webp", category: "other", series: "summer", rarity: "LR", art: "dogSummer" },
  { id: "toy_beach_ball", name: "ビーチボール", image: "/collection/items/beach-ball.webp", category: "toy", series: "summer", rarity: "N" },
  { id: "toy_bug_net", name: "虫取り網", image: "/collection/items/bug-net.webp", category: "toy", series: "summer", rarity: "N" },
  { id: "food_watermelon", name: "スイカ", image: "/collection/items/watermelon.webp", category: "food", series: "summer", rarity: "N" },
  { id: "food_ramune", name: "ラムネ", image: "/collection/items/ramune.webp", category: "food", series: "summer", rarity: "N" },
  { id: "food_popsicle", name: "アイスキャンディー", image: "/collection/items/popsicle.webp", category: "food", series: "summer", rarity: "N" },
  { id: "toy_water_gun", name: "水鉄砲", image: "/collection/items/water-gun.webp", category: "toy", series: "summer", rarity: "R" },
  { id: "food_shaved_ice", name: "かき氷", image: "/collection/items/shaved-ice.webp", category: "food", series: "summer", rarity: "R" },
  { id: "food_somen", name: "そうめん", image: "/collection/items/somen.webp", category: "food", series: "summer", rarity: "R" },
  { id: "interior_sudare", name: "すだれ", image: "/collection/items/sudare.webp", category: "interior", series: "summer", rarity: "R" },
  { id: "accessory_straw_hat", name: "麦わら帽子", image: "/collection/items/straw-hat.webp", category: "accessory", series: "summer", rarity: "R" },
  { id: "accessory_sunglasses", name: "サングラス", image: "/collection/items/sunglasses.webp", category: "accessory", series: "summer", rarity: "R" },
  { id: "other_cotton_candy", name: "縁日わたあめ", image: "/collection/items/cotton-candy.webp", category: "other", series: "summer", rarity: "R" },
  { id: "accessory_jinbei", name: "甚平", image: "/collection/items/jinbei.webp", category: "accessory", series: "summer", rarity: "SR" },
  { id: "other_sparkler", name: "線香花火", image: "/collection/items/sparkler.webp", category: "other", series: "summer", rarity: "SR" },
  { id: "other_goldfish_scoop", name: "金魚すくい", image: "/collection/items/goldfish-scoop.webp", category: "other", series: "summer", rarity: "SSR" },
  { id: "interior_beach_parasol", name: "ビーチパラソル", image: "/collection/items/beach-parasol.webp", category: "interior", series: "summer", rarity: "SSR" },
  { id: "toy_fireworks_set", name: "花火セット", image: "/collection/items/fireworks-set.webp", category: "toy", series: "summer", rarity: "UR" },
  { id: "toy_yoyo_scoop", name: "ヨーヨー釣り", image: "/collection/items/yoyo-scoop.webp", category: "toy", series: "summer", rarity: "N" },
  { id: "toy_bubbles", name: "シャボン玉", image: "/collection/items/bubbles.webp", category: "toy", series: "summer", rarity: "N" },
  { id: "toy_water_balloon", name: "水風船", image: "/collection/items/water-balloon.webp", category: "toy", series: "summer", rarity: "N" },
  { id: "toy_watermelon_bat", name: "スイカ割りバット", image: "/collection/items/watermelon-bat.webp", category: "toy", series: "summer", rarity: "R" },
  { id: "food_grilled_corn", name: "焼きとうもろこし", image: "/collection/items/grilled-corn.webp", category: "food", series: "summer", rarity: "N" },
  { id: "food_takoyaki", name: "たこ焼き", image: "/collection/items/takoyaki.webp", category: "food", series: "summer", rarity: "R" },
  { id: "food_melon_soda", name: "メロンソーダ", image: "/collection/items/melon-soda.webp", category: "food", series: "summer", rarity: "R" },
  { id: "food_fruit_punch", name: "フルーツポンチ", image: "/collection/items/fruit-punch.webp", category: "food", series: "summer", rarity: "R" },
  { id: "food_hiyashi_chuka", name: "冷やし中華", image: "/collection/items/hiyashi-chuka.webp", category: "food", series: "summer", rarity: "R" },
  { id: "interior_uchiwa", name: "うちわ", image: "/collection/items/uchiwa.webp", category: "interior", series: "summer", rarity: "N" },
  { id: "interior_mosquito_coil", name: "蚊取り線香", image: "/collection/items/mosquito-coil.webp", category: "interior", series: "summer", rarity: "SR" },
  { id: "interior_hammock", name: "ハンモック", image: "/collection/items/hammock.webp", category: "interior", series: "summer", rarity: "SR" },
  { id: "accessory_beach_sandals", name: "ビーチサンダル", image: "/collection/items/beach-sandals.webp", category: "accessory", series: "summer", rarity: "R" },
  { id: "accessory_shell_bracelet", name: "貝殻のブレスレット", image: "/collection/items/shell-bracelet.webp", category: "accessory", series: "summer", rarity: "R" },
  { id: "accessory_yukata_kanzashi", name: "花柄の浴衣かんざし", image: "/collection/items/yukata-kanzashi.webp", category: "accessory", series: "summer", rarity: "SR" },
  { id: "other_lantern", name: "提灯", image: "/collection/items/lantern.webp", category: "other", series: "summer", rarity: "SSR" },
  { id: "other_shooting_gallery", name: "射的セット", image: "/collection/items/shooting-gallery.webp", category: "other", series: "summer", rarity: "SSR" },
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

export const RARITY_STARS: Record<GachaRarity, number> = { N: 1, R: 2, SR: 3, SSR: 4, UR: 5, LR: 6, MR: 7 };
