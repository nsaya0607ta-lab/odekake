/**
 * ガチャの景品一覧
 * =============================================================
 * id は user_gacha_items.item_id に保存されるため、一度公開した id は変更しない。
 * すべて単一の通常ガチャから排出される（シリーズ限定ガチャは設けない）。
 */
import type { GachaRarity } from "./config";

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
  // --- 通常ガチャ：わんこのおもちゃ 第1弾 ----------------------------
  { id: "toy_colorful_ball", name: "カラフルボール", rarity: "N", type: "item", image: "/collection/items/colorful-ball.webp" },
  { id: "toy_rope", name: "ロープおもちゃ", rarity: "N", type: "item", image: "/collection/items/rope-toy.webp" },
  { id: "toy_bone", name: "ほねのおもちゃ", rarity: "N", type: "item", image: "/collection/items/bone-toy.webp" },
  { id: "toy_squeaky_ball", name: "ぴこぴこボール", rarity: "N", type: "item", image: "/collection/items/squeaky-ball.webp" },
  { id: "toy_duck_plush", name: "あひるのぬいぐるみ", rarity: "R", type: "item", image: "/collection/items/duck-plush.webp" },
  { id: "toy_carrot", name: "にんじんトイ", rarity: "R", type: "item", image: "/collection/items/carrot-toy.webp" },
  { id: "toy_frisbee", name: "フリスビー", rarity: "R", type: "item", image: "/collection/items/frisbee.webp" },
  { id: "toy_treasure_puzzle", name: "宝箱おやつパズル", rarity: "SR", type: "item", image: "/collection/items/treasure-puzzle.webp" },
  { id: "toy_frenchie_plush", name: "フレブルぬいぐるみ", rarity: "SR", type: "item", image: "/collection/items/frenchie-plush.webp" },
  { id: "toy_rainbow_ball", name: "虹色わんこボール", rarity: "SSR", type: "item", image: "/collection/items/rainbow-ball.webp" },

  // --- 通常ガチャ：わんこのおもちゃ 第2弾 ----------------------------
  { id: "toy_tennis_ball", name: "テニスボール", rarity: "N", type: "item", image: "/collection/items/tennis-ball.webp" },
  { id: "toy_red_slipper", name: "赤いスリッパ", rarity: "N", type: "item", image: "/collection/items/red-slipper.webp" },
  { id: "toy_wood_stick", name: "木の枝", rarity: "N", type: "item", image: "/collection/items/wood-stick.webp" },
  { id: "toy_donut_rope", name: "ドーナツ型ロープ", rarity: "N", type: "item", image: "/collection/items/donut-rope.webp" },
  { id: "toy_soccer_ball", name: "サッカーボール", rarity: "R", type: "item", image: "/collection/items/soccer-ball.webp" },
  { id: "toy_taiyaki_plush", name: "たい焼きぬいぐるみ", rarity: "R", type: "item", image: "/collection/items/taiyaki-plush.webp" },
  { id: "toy_bear_plush", name: "くまのぬいぐるみ", rarity: "R", type: "item", image: "/collection/items/bear-plush.webp" },
  { id: "toy_meat", name: "大きな肉のおもちゃ", rarity: "SR", type: "item", image: "/collection/items/meat-toy.webp" },
  { id: "toy_frenchie_cushion", name: "フレブル型クッション", rarity: "SR", type: "item", image: "/collection/items/frenchie-cushion.webp" },
  { id: "toy_paw_macaron", name: "にくきゅうマカロン", rarity: "SR", type: "item", image: "/collection/items/paw-macaron.webp" },
  { id: "toy_star_wan_wand", name: "スターわんステッキ", rarity: "SR", type: "item", image: "/collection/items/star-wan-wand.webp" },
  { id: "toy_golden_crown_ball", name: "王冠つき黄金ボール", rarity: "SSR", type: "item", image: "/collection/items/golden-crown-ball.webp" },

  // --- 通常ガチャ：食べもの ------------------------------------------
  { id: "food_paw_bowl", name: "肉球フードボウル", rarity: "R", type: "item", image: "/collection/items/paw-food-bowl.webp" },
  { id: "food_strawberry_roll_cake", name: "いちごロールケーキ", rarity: "SR", type: "item", image: "/collection/items/strawberry-roll-cake.webp" },
  { id: "food_paw_pudding", name: "肉球プリン", rarity: "R", type: "item", image: "/collection/items/paw-pudding.webp" },
  { id: "food_paw_melon_bread", name: "肉球メロンパン", rarity: "R", type: "item", image: "/collection/items/paw-melon-bread.webp" },
  { id: "food_smile_onigiri", name: "にこにこおにぎり", rarity: "N", type: "item", image: "/collection/items/smile-onigiri.webp" },
  { id: "food_paw_cupcake", name: "肉球カップケーキ", rarity: "SR", type: "item", image: "/collection/items/paw-cupcake.webp" },
  { id: "food_paw_taiyaki", name: "にくきゅうたい焼き", rarity: "N", type: "item", image: "/collection/items/paw-taiyaki.webp" },
  { id: "food_dog_milk", name: "わんこミルク", rarity: "N", type: "item", image: "/collection/items/dog-milk.webp" },
  { id: "food_cheese_cubes", name: "ころころチーズ", rarity: "N", type: "item", image: "/collection/items/cheese-cubes.webp" },
  { id: "food_roasted_sweet_potato", name: "ほくほく焼きいも", rarity: "N", type: "item", image: "/collection/items/roasted-sweet-potato.webp" },
  { id: "food_honey_butter_toast", name: "はちみつバタートースト", rarity: "N", type: "item", image: "/collection/items/honey-butter-toast.webp" },
  { id: "food_fruit_basket", name: "フルーツバスケット", rarity: "SR", type: "item", image: "/collection/items/fruit-basket.webp" },
  { id: "food_kamikami", name: "かみかみ", rarity: "R", type: "item", image: "/collection/items/kamikami.webp" },
  { id: "food_mocchurin", name: "もっちゅりん", rarity: "UR", type: "item", image: "/collection/items/mocchurin.webp" },

  // --- 通常ガチャ：インテリア ----------------------------------------
  { id: "interior_stretch_rod", name: "ストレッチ棒", rarity: "R", type: "item", image: "/collection/items/stretch-rod.webp" },
  { id: "interior_anball", name: "アンボール", rarity: "UR", type: "item", image: "/collection/items/anball.webp" },
  { id: "interior_kinoko_azubee", name: "きのこあずびー", rarity: "UR", type: "item", image: "/collection/items/3365FE0A-4198-4C04-BA73-A7BAC18F73F5.webp" },
  { id: "interior_gold_ball", name: "ゴールドボール", rarity: "SSR", type: "item", image: "/collection/items/gold-ball.webp" },
  { id: "interior_sleepy_moon", name: "おやすみムーン", rarity: "SR", type: "item", image: "/collection/items/sleepy-moon.webp" },
  { id: "interior_spring_flower_wreath", name: "はるいろフラワーリース", rarity: "SR", type: "item", image: "/collection/items/spring-flower-wreath.webp" },
  { id: "interior_shikkoku_no_ar", name: "漆黒のアー", rarity: "LR", type: "item", image: "/collection/items/shikkoku-no-ar.webp" },
  { id: "interior_ragby_ar", name: "ラグビーアー", rarity: "LR", type: "item", image: "/collection/items/ragby-ar.webp" },

  // --- 通常ガチャ：その他 --------------------------------------------
  { id: "other_azubee", name: "あずびー", rarity: "UR", type: "item", image: "/collection/items/two-dogs-icon-transparent.webp" },
  { id: "other_omojii", name: "おもじぃ", rarity: "UR", type: "item", image: "/collection/items/8B027535-244F-4729-86F5-A69CDD91D103.webp" },
  { id: "other_nakayoshi_azubee", name: "なかよしあずびー", rarity: "SSR", type: "item", image: "/collection/items/890D1313-B79F-493C-97C2-1898F7663C01.webp" },
  { id: "other_komochi", name: "こもち", rarity: "UR", type: "item", image: "/collection/items/C7DF48F4-588E-4B31-983E-A52623328924.webp" },
  { id: "other_azuki", name: "小豆(あずき)", rarity: "UR", type: "item", image: "/collection/items/6F31AD19-B242-42D6-83D3-380A3F3D3FC0.webp" },
  { id: "other_omoi_bashira", name: "一家の大オモ柱", rarity: "UR", type: "item", image: "/collection/items/omoi-bashira.webp" },
  { id: "other_kobee", name: "こびー", rarity: "UR", type: "item", image: "/collection/items/4FA70BBA-6CBA-42B2-9A96-4B07AFDF56E0.webp" },
  { id: "other_kamunayo", name: "かむなよ", rarity: "SSR", type: "item", image: "/collection/items/7FEA86AD-6904-4151-BEA8-5A33F7C97B01.webp" },
  { id: "other_hamigaki", name: "はみがき", rarity: "SSR", type: "item", image: "/collection/items/hamigaki.webp" },
  { id: "other_ikea", name: "IKEA", rarity: "SSR", type: "item", image: "/collection/items/ikea.webp" },
  { id: "other_orusuban", name: "おるすばん", rarity: "SSR", type: "item", image: "/collection/items/orusuban.webp" },
  { id: "other_kurumari_a", name: "くるまりアー", rarity: "SSR", type: "item", image: "/collection/items/kurumari-a.webp" },
  { id: "other_pondeomo", name: "ぽんでおも", rarity: "SSR", type: "item", image: "/collection/items/pondeomo.webp" },
  { id: "other_pondear", name: "ぽんでアー", rarity: "SSR", type: "item", image: "/collection/items/pondear.webp" },
  { id: "other_oyatsu_no_jikan", name: "おやつのじかん", rarity: "SSR", type: "item", image: "/collection/items/oyatsu-no-jikan.webp" },
  { id: "other_jare_a", name: "じゃれアー", rarity: "SSR", type: "item", image: "/collection/items/jare-a.webp" },
  { id: "other_ketsunade_a", name: "けつなでアー", rarity: "SSR", type: "item", image: "/collection/items/ketsunade-a.webp" },
  { id: "other_omochi_janai", name: "おもちじゃない...!?", rarity: "SSR", type: "item", image: "/collection/items/omochi-janai.webp" },
  { id: "other_oyasumi", name: "おやすみ", rarity: "SSR", type: "item", image: "/collection/items/oyasumi.webp" },
  { id: "other_nisoku_a", name: "二足アー", rarity: "SSR", type: "item", image: "/collection/items/nisoku-a.webp" },
  { id: "other_listen_to_the_a", name: "Listen to the a-", rarity: "LR", type: "item", image: "/collection/items/listen-to-the-a.webp" },
  { id: "other_okaeri", name: "おかえり", rarity: "LR", type: "item", image: "/collection/items/okaeri.webp" },
  { id: "other_sparkle_rope_crown", name: "きらきらロープクラウン", rarity: "SR", type: "item", image: "/collection/items/sparkle-rope-crown.webp" },

  // --- 通常ガチャ：MR --------------------------------------------------
  { id: "other_burebur", name: "ブレブル", rarity: "MR", type: "item", image: "/collection/items/burebur.webp" },
  { id: "other_xmas_party", name: "Xmas Party", rarity: "MR", type: "item", image: "/collection/items/xmas-party.webp" },

  // --- 通常ガチャ：その他 追加分 --------------------------------------
  { id: "other_clawd", name: "Clawd", rarity: "SSR", type: "item", image: "/collection/items/clawd.webp" },

  // --- 通常ガチャ：おでかけ小物 ----------------------------------------
  { id: "other_yellow_rain_boots", name: "きいろのながぐつ", rarity: "N", type: "item", image: "/collection/items/yellow-rain-boots.webp" },
  { id: "accessory_red_bandana", name: "あかいバンダナ", rarity: "N", type: "item", image: "/collection/items/red-bandana.webp" },
  { id: "other_acorns", name: "ころころどんぐり", rarity: "N", type: "item", image: "/collection/items/acorns.webp" },
  { id: "toy_paper_airplane", name: "しろい紙ひこうき", rarity: "N", type: "item", image: "/collection/items/paper-airplane.webp" },
  { id: "other_walk_water_bottle", name: "おさんぽ水筒", rarity: "N", type: "item", image: "/collection/items/walk-water-bottle.webp" },
  { id: "other_shiny_pinecone", name: "つやつやまつぼっくり", rarity: "N", type: "item", image: "/collection/items/pinecone.webp" },
  { id: "accessory_blue_handkerchief", name: "あおいハンカチ", rarity: "N", type: "item", image: "/collection/items/paw-picnic-blanket.webp" },
  { id: "toy_red_balloon", name: "あかい風船", rarity: "N", type: "item", image: "/collection/items/red-balloon.webp" },
  { id: "toy_sand_bucket", name: "おすなばバケツ", rarity: "N", type: "item", image: "/collection/items/flower-sand-bucket.webp" },
  { id: "accessory_walk_pouch", name: "おさんぽポーチ", rarity: "N", type: "item", image: "/collection/items/pet-outing-bag.webp" },

  // --- 犬スキン（すべてLR） -------------------------------------------
  { id: "hiking_frenchie", name: "登山のフレブル", rarity: "LR", type: "dog_skin", image: "/collection/skins/hiking-frenchie.webp" },
  { id: "snow_frenchie", name: "雪国のフレブル", rarity: "LR", type: "dog_skin", image: "/collection/skins/snow-frenchie.webp" },
  { id: "summer_frenchie", name: "夏のフレブル", rarity: "LR", type: "dog_skin", image: "/collection/skins/summer-frenchie.webp" },

  // --- 夏シリーズの小物 -------------------------------------------------
  { id: "toy_beach_ball", name: "ビーチボール", rarity: "N", type: "item", image: "/collection/items/beach-ball.webp" },
  { id: "toy_bug_net", name: "虫取り網", rarity: "N", type: "item", image: "/collection/items/bug-net.webp" },
  { id: "food_watermelon", name: "スイカ", rarity: "N", type: "item", image: "/collection/items/watermelon.webp" },
  { id: "food_ramune", name: "ラムネ", rarity: "N", type: "item", image: "/collection/items/ramune.webp" },
  { id: "food_popsicle", name: "アイスキャンディー", rarity: "N", type: "item", image: "/collection/items/popsicle.webp" },
  { id: "toy_water_gun", name: "水鉄砲", rarity: "R", type: "item", image: "/collection/items/water-gun.webp" },
  { id: "food_shaved_ice", name: "かき氷", rarity: "R", type: "item", image: "/collection/items/shaved-ice.webp" },
  { id: "food_somen", name: "そうめん", rarity: "R", type: "item", image: "/collection/items/somen.webp" },
  { id: "interior_sudare", name: "すだれ", rarity: "R", type: "item", image: "/collection/items/sudare.webp" },
  { id: "accessory_straw_hat", name: "麦わら帽子", rarity: "R", type: "item", image: "/collection/items/straw-hat.webp" },
  { id: "accessory_sunglasses", name: "サングラス", rarity: "R", type: "item", image: "/collection/items/sunglasses.webp" },
  { id: "other_cotton_candy", name: "縁日わたあめ", rarity: "R", type: "item", image: "/collection/items/cotton-candy.webp" },
  { id: "accessory_jinbei", name: "甚平", rarity: "SR", type: "item", image: "/collection/items/jinbei.webp" },
  { id: "other_sparkler", name: "線香花火", rarity: "SR", type: "item", image: "/collection/items/sparkler.webp" },
  { id: "other_goldfish_scoop", name: "金魚すくい", rarity: "SSR", type: "item", image: "/collection/items/goldfish-scoop.webp" },
  { id: "interior_beach_parasol", name: "ビーチパラソル", rarity: "SSR", type: "item", image: "/collection/items/beach-parasol.webp" },
  { id: "toy_fireworks_set", name: "花火セット", rarity: "UR", type: "item", image: "/collection/items/fireworks-set.webp" },

  // --- 夏シリーズの小物 追加分 ------------------------------------------
  { id: "toy_yoyo_scoop", name: "ヨーヨー釣り", rarity: "N", type: "item", image: "/collection/items/yoyo-scoop.webp" },
  { id: "toy_bubbles", name: "シャボン玉", rarity: "N", type: "item", image: "/collection/items/bubbles.webp" },
  { id: "toy_water_balloon", name: "水風船", rarity: "N", type: "item", image: "/collection/items/water-balloon.webp" },
  { id: "toy_watermelon_bat", name: "スイカ割りバット", rarity: "R", type: "item", image: "/collection/items/watermelon-bat.webp" },
  { id: "food_grilled_corn", name: "焼きとうもろこし", rarity: "N", type: "item", image: "/collection/items/grilled-corn.webp" },
  { id: "food_takoyaki", name: "たこ焼き", rarity: "R", type: "item", image: "/collection/items/takoyaki.webp" },
  { id: "food_melon_soda", name: "メロンソーダ", rarity: "R", type: "item", image: "/collection/items/melon-soda.webp" },
  { id: "food_fruit_punch", name: "フルーツポンチ", rarity: "R", type: "item", image: "/collection/items/fruit-punch.webp" },
  { id: "food_hiyashi_chuka", name: "冷やし中華", rarity: "R", type: "item", image: "/collection/items/hiyashi-chuka.webp" },
  { id: "interior_uchiwa", name: "うちわ", rarity: "N", type: "item", image: "/collection/items/uchiwa.webp" },
  { id: "interior_mosquito_coil", name: "蚊取り線香", rarity: "SR", type: "item", image: "/collection/items/mosquito-coil.webp" },
  { id: "interior_hammock", name: "ハンモック", rarity: "SR", type: "item", image: "/collection/items/hammock.webp" },
  { id: "accessory_beach_sandals", name: "ビーチサンダル", rarity: "R", type: "item", image: "/collection/items/beach-sandals.webp" },
  { id: "accessory_shell_bracelet", name: "貝殻のブレスレット", rarity: "R", type: "item", image: "/collection/items/shell-bracelet.webp" },
  { id: "accessory_yukata_kanzashi", name: "花柄の浴衣かんざし", rarity: "SR", type: "item", image: "/collection/items/yukata-kanzashi.webp" },
  { id: "other_lantern", name: "提灯", rarity: "SSR", type: "item", image: "/collection/items/lantern.webp" },
  { id: "other_shooting_gallery", name: "射的セット", rarity: "SSR", type: "item", image: "/collection/items/shooting-gallery.webp" },
];

const PRIZE_BY_ID = new Map(GACHA_PRIZES.map((prize) => [prize.id, prize]));

export function getPrize(id: string): GachaPrize | null {
  return PRIZE_BY_ID.get(id) ?? null;
}

export function getPrizesByRarity(rarity: GachaRarity): GachaPrize[] {
  return GACHA_PRIZES.filter((prize) => prize.rarity === rarity);
}
