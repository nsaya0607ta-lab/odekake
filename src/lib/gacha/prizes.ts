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
  { id: "toy_paw_macaron", name: "にくきゅうマカロン", rarity: "SR", type: "item", pool: "regular", image: "/collection/items/paw-macaron.webp" },
  { id: "toy_star_wan_wand", name: "スターわんステッキ", rarity: "SR", type: "item", pool: "regular", image: "/collection/items/star-wan-wand.webp" },
  { id: "toy_golden_crown_ball", name: "王冠つき黄金ボール", rarity: "SSR", type: "item", pool: "regular", image: "/collection/items/golden-crown-ball.webp" },

  // --- 通常ガチャ：食べもの ------------------------------------------
  { id: "food_paw_bowl", name: "肉球フードボウル", rarity: "R", type: "item", pool: "regular", image: "/collection/items/paw-food-bowl.webp" },
  { id: "food_strawberry_roll_cake", name: "いちごロールケーキ", rarity: "SR", type: "item", pool: "regular", image: "/collection/items/strawberry-roll-cake.webp" },
  { id: "food_paw_pudding", name: "肉球プリン", rarity: "R", type: "item", pool: "regular", image: "/collection/items/paw-pudding.webp" },
  { id: "food_paw_melon_bread", name: "肉球メロンパン", rarity: "R", type: "item", pool: "regular", image: "/collection/items/paw-melon-bread.webp" },
  { id: "food_smile_onigiri", name: "にこにこおにぎり", rarity: "N", type: "item", pool: "regular", image: "/collection/items/smile-onigiri.webp" },
  { id: "food_paw_cupcake", name: "肉球カップケーキ", rarity: "SR", type: "item", pool: "regular", image: "/collection/items/paw-cupcake.webp" },
  { id: "food_paw_taiyaki", name: "にくきゅうたい焼き", rarity: "N", type: "item", pool: "regular", image: "/collection/items/paw-taiyaki.webp" },
  { id: "food_dog_milk", name: "わんこミルク", rarity: "N", type: "item", pool: "regular", image: "/collection/items/dog-milk.webp" },
  { id: "food_cheese_cubes", name: "ころころチーズ", rarity: "N", type: "item", pool: "regular", image: "/collection/items/cheese-cubes.webp" },
  { id: "food_roasted_sweet_potato", name: "ほくほく焼きいも", rarity: "N", type: "item", pool: "regular", image: "/collection/items/roasted-sweet-potato.webp" },
  { id: "food_honey_butter_toast", name: "はちみつバタートースト", rarity: "N", type: "item", pool: "regular", image: "/collection/items/honey-butter-toast.webp" },

  // --- 通常ガチャ：インテリア ----------------------------------------
  { id: "interior_anball", name: "アンボール", rarity: "UR", type: "item", pool: "regular", image: "/collection/items/anball.webp" },
  { id: "interior_kinoko_azubee", name: "きのこあずびー", rarity: "UR", type: "item", pool: "regular", image: "/collection/items/3365FE0A-4198-4C04-BA73-A7BAC18F73F5.png" },
  { id: "interior_sleepy_moon", name: "おやすみムーン", rarity: "SR", type: "item", pool: "regular", image: "/collection/items/sleepy-moon.webp" },
  { id: "interior_spring_flower_wreath", name: "はるいろフラワーリース", rarity: "SR", type: "item", pool: "regular", image: "/collection/items/spring-flower-wreath.webp" },

  // --- 通常ガチャ：その他 --------------------------------------------
  { id: "other_azubee", name: "あずびー", rarity: "UR", type: "item", pool: "regular", image: "/collection/items/two-dogs-icon-transparent.webp" },
  { id: "other_omojii", name: "おもじぃ", rarity: "UR", type: "item", pool: "regular", image: "/collection/items/8B027535-244F-4729-86F5-A69CDD91D103.png" },
  { id: "other_nakayoshi_azubee", name: "なかよしあずびー", rarity: "SSR", type: "item", pool: "regular", image: "/collection/items/890D1313-B79F-493C-97C2-1898F7663C01.png" },
  { id: "other_komochi", name: "こもち", rarity: "UR", type: "item", pool: "regular", image: "/collection/items/4FA70BBA-6CBA-42B2-9A96-4B07AFDF56E0.png" },
  { id: "other_azuki", name: "小豆(あずき)", rarity: "UR", type: "item", pool: "regular", image: "/collection/items/6F31AD19-B242-42D6-83D3-380A3F3D3FC0.png" },
  { id: "other_kobee", name: "こびー", rarity: "UR", type: "item", pool: "regular", image: "/collection/items/C7DF48F4-588E-4B31-983E-A52623328924.png" },
  { id: "other_kamunayo", name: "かむなよ", rarity: "SSR", type: "item", pool: "regular", image: "/collection/items/7FEA86AD-6904-4151-BEA8-5A33F7C97B01.png" },
  { id: "other_sparkle_rope_crown", name: "きらきらロープクラウン", rarity: "SR", type: "item", pool: "regular", image: "/collection/items/sparkle-rope-crown.webp" },

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
