import type { CollectionItem } from "@/lib/collection/items";

export type SnackTrailSkillKind =
  | "slow"
  | "trim"
  | "score"
  | "double"
  | "gold"
  | "shield"
  | "noGrow"
  | "wide"
  | "combo"
  | "ultimate";

export type SnackTrailSkill = {
  title: string;
  kind: SnackTrailSkillKind;
  miniValue: number;
  boostedValue: number;
  miniText: string;
  boostedText: string;
};

type SkillRecipe = { title: string; kind: SnackTrailSkillKind };

const RECIPES: Record<string, SkillRecipe> = {
  toy_colorful_ball: { title: "カラフルボーナス", kind: "score" },
  toy_rope: { title: "ロープカット", kind: "trim" },
  toy_bone: { title: "ほねパワー", kind: "score" },
  toy_squeaky_ball: { title: "ぴこぴこブレーキ", kind: "slow" },
  toy_duck_plush: { title: "ぷかぷか走行", kind: "slow" },
  toy_carrot: { title: "にんじんブレーキ", kind: "slow" },
  toy_frisbee: { title: "スピンカット", kind: "trim" },
  toy_treasure_puzzle: { title: "宝箱の近道", kind: "combo" },
  toy_frenchie_plush: { title: "ぬいぐるみガード", kind: "shield" },
  toy_rainbow_ball: { title: "レインボータイム", kind: "gold" },
  toy_tennis_ball: { title: "近くにポン", kind: "wide" },
  toy_red_slipper: { title: "すべり止め", kind: "slow" },
  toy_wood_stick: { title: "枝払い", kind: "trim" },
  toy_donut_rope: { title: "輪っかくぐり", kind: "noGrow" },
  toy_soccer_ball: { title: "おやつシュート", kind: "wide" },
  toy_taiyaki_plush: { title: "たい焼きボーナス", kind: "double" },
  toy_bear_plush: { title: "くまさんガード", kind: "shield" },
  toy_meat: { title: "肉パワー", kind: "double" },
  toy_frenchie_cushion: { title: "ふかふか救助", kind: "shield" },
  toy_paw_macaron: { title: "マカロンスタンプ", kind: "combo" },
  toy_star_wan_wand: { title: "おやつ魔法", kind: "gold" },
  toy_golden_crown_ball: { title: "ゴールデンキング", kind: "gold" },
  food_paw_bowl: { title: "おかわり", kind: "score" },
  food_strawberry_roll_cake: { title: "ロールコンボ", kind: "double" },
  food_paw_pudding: { title: "ぷるぷるタイム", kind: "slow" },
  food_paw_melon_bread: { title: "ふっくらしっぽ", kind: "noGrow" },
  food_smile_onigiri: { title: "元気チャージ", kind: "score" },
  food_paw_cupcake: { title: "ごほうび短縮", kind: "combo" },
  food_paw_taiyaki: { title: "たい焼き倍増", kind: "double" },
  food_dog_milk: { title: "ミルク休憩", kind: "slow" },
  food_cheese_cubes: { title: "チーズキャッチ", kind: "wide" },
  food_roasted_sweet_potato: { title: "ほくほくカット", kind: "trim" },
  food_honey_butter_toast: { title: "はちみつボーナス", kind: "double" },
  food_fruit_basket: { title: "フルーツラッシュ", kind: "combo" },
  food_kamikami: { title: "かみかみカット", kind: "trim" },
  food_mocchurin: { title: "もちもち無敵", kind: "shield" },
  interior_stretch_rod: { title: "しっぽストレッチ", kind: "trim" },
  interior_anball: { title: "アンバウンド", kind: "shield" },
  interior_kinoko_azubee: { title: "きのこワープ", kind: "combo" },
  interior_gold_ball: { title: "黄金変換", kind: "gold" },
  interior_sleepy_moon: { title: "お月さまスロー", kind: "slow" },
  interior_spring_flower_wreath: { title: "春風ガード", kind: "shield" },
  interior_shikkoku_no_ar: { title: "漆黒すり抜け", kind: "shield" },
  interior_ragby_ar: { title: "無敵のトライ", kind: "double" },
  other_sparkle_rope_crown: { title: "王冠オーラ", kind: "wide" },
  other_azubee: { title: "あずびーの道案内", kind: "shield" },
  other_omojii: { title: "おもじぃの貫禄", kind: "slow" },
  other_nakayoshi_azubee: { title: "なかよしチョイス", kind: "combo" },
  other_komochi: { title: "ちいさなお手伝い", kind: "wide" },
  other_azuki: { title: "小豆パワー", kind: "double" },
  other_kobee: { title: "こびーラッシュ", kind: "combo" },
  other_kamunayo: { title: "かむなよバリア", kind: "shield" },
  other_hamigaki: { title: "ぴかぴかクリア", kind: "trim" },
  other_ikea: { title: "ルート組み立て", kind: "wide" },
  other_orusuban: { title: "おるすばんモード", kind: "slow" },
  other_kurumari_a: { title: "ぬくぬくガード", kind: "shield" },
  other_pondeomo: { title: "もちもちリング", kind: "noGrow" },
  other_pondear: { title: "ぽんでボーナス", kind: "double" },
  other_oyatsu_no_jikan: { title: "おやつフィーバー", kind: "gold" },
  other_jare_a: { title: "じゃれつき磁石", kind: "wide" },
  other_ketsunade_a: { title: "ごきげんタイム", kind: "score" },
  other_omochi_janai: { title: "おもち化", kind: "noGrow" },
  other_oyasumi: { title: "おひるねタイム", kind: "slow" },
  other_nisoku_a: { title: "二足キャッチ", kind: "wide" },
  other_listen_to_the_a: { title: "アーの号令", kind: "shield" },
  other_okaeri: { title: "おかえり復活", kind: "shield" },
  other_omoi_bashira: { title: "大黒柱ガード", kind: "shield" },
  other_burebur: { title: "ブレブル覚醒", kind: "ultimate" },
  other_xmas_party: { title: "プレゼントラッシュ", kind: "ultimate" },
  other_clawd: { title: "未来予測", kind: "combo" },
  other_yellow_rain_boots: { title: "水たまりジャンプ", kind: "noGrow" },
  accessory_red_bandana: { title: "赤い応援", kind: "combo" },
  other_acorns: { title: "どんぐりころころ", kind: "wide" },
  toy_paper_airplane: { title: "ひとっとび", kind: "combo" },
  other_walk_water_bottle: { title: "水分休憩", kind: "slow" },
  other_shiny_pinecone: { title: "まつぼっくりカット", kind: "trim" },
  accessory_blue_handkerchief: { title: "さっぱりカット", kind: "trim" },
  toy_red_balloon: { title: "ふわふわしっぽ", kind: "noGrow" },
  toy_sand_bucket: { title: "砂のクッション", kind: "shield" },
  accessory_walk_pouch: { title: "予備のおやつ", kind: "combo" },
};

const RARITY_POWER = { N: 1, R: 2, SR: 3, SSR: 4, UR: 5, LR: 6, MR: 7 } as const;

function effectText(kind: SnackTrailSkillKind, value: number, boosted: boolean): string {
  if (kind === "slow") return `${value}秒間ゆっくり`;
  if (kind === "trim") return `肉球の道を${value}マス短縮`;
  if (kind === "score") return `${value}点ボーナス`;
  if (kind === "double") return `次の${value}個が得点×2`;
  if (kind === "gold") return `次の${value}個が金色`;
  if (kind === "shield") return `壁ガードを${value}回追加`;
  if (kind === "noGrow") return `次の${value}個は道が伸びない`;
  if (kind === "wide") return `次の${value}個は取得範囲アップ`;
  if (kind === "combo") return `肉球コンボを${value}追加`;
  return boosted ? "壁ガード2回＋金色3個＋得点×2" : "金色1個＋次の1個が得点×2";
}

export function getSnackTrailSkill(item: CollectionItem): SnackTrailSkill {
  const recipe = RECIPES[item.id] ?? { title: `${item.name}パワー`, kind: "score" as const };
  const power = RARITY_POWER[item.rarity];
  let miniValue = 1;
  let boostedValue = Math.min(6, power + 1);

  if (recipe.kind === "slow") {
    miniValue = Math.min(4, 1 + Math.ceil(power / 2));
    boostedValue = Math.min(12, 4 + power);
  } else if (recipe.kind === "trim") {
    miniValue = Math.max(1, Math.ceil(power / 3));
    boostedValue = Math.min(7, power + 1);
  } else if (recipe.kind === "score") {
    miniValue = power;
    boostedValue = power * 3;
  } else if (recipe.kind === "double" || recipe.kind === "gold") {
    miniValue = 1;
    boostedValue = Math.min(5, 1 + Math.ceil(power / 2));
  } else if (recipe.kind === "shield") {
    miniValue = 1;
    boostedValue = power >= 5 ? 2 : 1;
  } else if (recipe.kind === "noGrow" || recipe.kind === "wide") {
    miniValue = 1;
    boostedValue = Math.min(5, 1 + Math.ceil(power / 2));
  } else if (recipe.kind === "combo") {
    miniValue = 1;
    boostedValue = Math.min(6, power + 1);
  }

  return {
    title: recipe.title,
    kind: recipe.kind,
    miniValue,
    boostedValue,
    miniText: effectText(recipe.kind, miniValue, false),
    boostedText: effectText(recipe.kind, boostedValue, true),
  };
}
