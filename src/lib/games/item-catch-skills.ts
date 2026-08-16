/**
 * アイテムキャッチのスキル説明
 * =============================================================
 * 効果の実体は frenchie-catch-game.tsx の LV テーブルと switch 文にある。
 * ここはそれを人が読む形へ書き起こしたものなので、数値を変えたら両方直す。
 *
 * 名前・レアリティ・画像は COLLECTION_ITEMS から id で引くため、ここには持たない。
 * （持たせると図鑑側と食い違ったときに気づけない）
 */

export type ItemCatchSkill = {
  /** COLLECTION_ITEMS の id と一致させる */
  id: string;
  /** Lv1〜Lv.MAX の効果。5つで固定 */
  levels: readonly [string, string, string, string, string];
  /** 補足説明。効果の意味が名前から読み取れないものだけ書く */
  note?: string;
};

export const ITEM_CATCH_SKILLS: readonly ItemCatchSkill[] = [
  // --- R ---------------------------------------------------------
  { id: "toy_duck_plush", levels: ["+2秒", "+3秒", "+4秒", "+5秒", "+7秒"] },
  { id: "toy_carrot", levels: ["+2秒", "+3秒", "+4秒", "+6秒", "+8秒"] },
  { id: "toy_frisbee", levels: ["次の1個 ×2", "次の1個 ×2.2", "次の1個 ×2.4", "次の1個 ×2.7", "次の1個 ×3"] },
  { id: "toy_soccer_ball", levels: ["+10pt", "+15pt", "+20pt", "+30pt", "+40pt"] },
  { id: "toy_taiyaki_plush", levels: ["次の2個 +5pt", "次の2個 +7pt", "次の2個 +10pt", "次の2個 +13pt", "次の2個 +15pt"] },
  { id: "toy_bear_plush", levels: ["保護1回", "保護1回 +10pt", "保護2回", "保護2回 +20pt", "保護3回"], note: "コンボ保護は4つまで持てる" },
  { id: "food_paw_bowl", levels: ["次の3個 +5pt", "次の3個 +7pt", "次の3個 +10pt", "次の3個 +13pt", "次の3個 +15pt"] },
  { id: "food_paw_pudding", levels: ["+15pt", "+20pt", "+30pt", "+40pt", "+50pt"] },
  { id: "food_paw_melon_bread", levels: ["+2秒 +5pt", "+3秒 +10pt", "+4秒 +15pt", "+5秒 +20pt", "+7秒 +30pt"] },

  // --- SR --------------------------------------------------------
  { id: "toy_treasure_puzzle", levels: ["+20pt / +40pt / +3秒", "+25pt / +50pt / +4秒", "+30pt / +60pt / +5秒", "+40pt / +80pt / +6秒", "+50pt / +100pt / +8秒"], note: "3つのうちどれか1つがランダムで出る" },
  { id: "toy_frenchie_plush", levels: ["次の3個 +10pt", "次の3個 +13pt", "次の4個 +15pt", "次の4個 +20pt", "次の5個 +25pt"] },
  { id: "toy_meat", levels: ["5秒間 ×1.5", "6秒間 ×1.5", "7秒間 ×1.6", "8秒間 ×1.7", "10秒間 ×1.8"], note: "その間ずっと得点倍率がかかる" },
  { id: "toy_frenchie_cushion", levels: ["+30pt", "+40pt", "+50pt", "+65pt", "+80pt"] },
  { id: "toy_paw_macaron", levels: ["3秒間", "4秒間", "5秒間", "6秒間", "8秒間"], note: "段ボールが1.5倍に広がる" },
  { id: "toy_star_wan_wand", levels: ["残り秒数 ×2", "残り秒数 ×2.3", "残り秒数 ×2.6", "残り秒数 ×3", "残り秒数 ×3.5"], note: "取った瞬間の残り時間がそのままptになる" },
  { id: "food_strawberry_roll_cake", levels: ["次の1個 ×1.5", "次の1個 ×1.7", "次の1個 ×2", "次の2個 ×2", "次の2個 ×2.5"] },
  { id: "food_paw_cupcake", levels: ["4秒間", "5秒間", "6秒間", "7秒間", "10秒間"], note: "段ボールが1.5倍に広がる" },
  { id: "interior_sleepy_moon", levels: ["保護3回", "保護4回", "保護5回", "保護6回", "保護8回"], note: "コンボ保護は4つまで持てる" },
  { id: "interior_spring_flower_wreath", levels: ["5秒間", "6秒間", "7秒間", "9秒間", "12秒間"], note: "その間コンボ倍率が1段階アップ" },
  { id: "other_sparkle_rope_crown", levels: ["4秒間 弱", "5秒間 弱", "6秒間 弱", "8秒間 弱", "10秒間 中"], note: "アイテムを段ボールの方へ引き寄せる" },

  // --- SSR -------------------------------------------------------
  { id: "toy_rainbow_ball", levels: ["UR出現率 +10", "UR出現率 +12", "UR出現率 +15", "UR出現率 +20", "UR出現率 +25"], note: "ゲーム終了まで積み上がる（合計+30まで）" },
  { id: "toy_golden_crown_ball", levels: ["次の2個 ×2", "次の2個 ×2.2", "次の3個 ×2.2", "次の3個 ×2.5", "次の4個 ×2.5"] },
  { id: "other_nakayoshi_azubee", levels: ["+30pt 保護2回", "+40pt 保護2回", "+50pt 保護3回", "+65pt 保護4回", "+80pt 保護5回"], note: "コンボ保護は4つまで持てる" },
  { id: "other_kamunayo", levels: ["5秒間", "6秒間", "8秒間", "10秒間", "13秒間"], note: "その間は取り逃してもコンボが切れない" },
  { id: "other_hamigaki", levels: ["一掃のみ", "一掃 +2秒間出ない", "一掃 +3秒間 +10pt", "一掃 +4秒間 +15pt", "一掃 +5秒間 +20pt"], note: "画面のうんちをその場で消す" },
  { id: "other_ikea", levels: ["4秒間", "5秒間", "6秒間", "7秒間", "8秒間"], note: "効果中に取った個数×10ptを、終了時にまとめて加算。もう一度取ると時間が延びる（上限なし）" },
  { id: "other_orusuban", levels: ["5秒間 落下×1.8 保護1", "6秒間 落下×2 保護1", "7秒間 落下×2.2 保護2", "8秒間 落下×2.4 保護2", "10秒間 落下×2.8 保護3"] },
  { id: "other_kurumari_a", levels: ["5秒間 落下×1.8 保護1", "6秒間 落下×2 保護1", "7秒間 落下×2.2 保護2", "8秒間 落下×2.4 保護2", "10秒間 落下×2.8 保護3"], note: "おるすばんと同じスキル" },
  { id: "other_pondeomo", levels: ["4秒間", "5秒間", "6秒間", "8秒間", "10秒間"], note: "その間アイテムが2倍の量で降ってくる" },
  { id: "other_pondear", levels: ["4秒間", "5秒間", "6秒間", "8秒間", "10秒間"], note: "ぽんでおもと同じスキル" },
  { id: "other_oyatsu_no_jikan", levels: ["80pt", "100pt", "120pt", "140pt", "180pt"], note: "次にキャッチする1個を、レアリティに関係なく固定得点に格上げする" },
  { id: "hiking_frenchie", levels: ["5秒間 強", "6秒間 強", "7秒間 強", "9秒間 強", "12秒間 強"], note: "アイテムを段ボールの方へ強く引き寄せる" },
  { id: "snow_frenchie", levels: ["5秒間", "6秒間", "7秒間", "9秒間", "12秒間"], note: "段ボールが1.7倍に広がる" },
  { id: "summer_frenchie", levels: ["+5秒 5秒間×1.5", "+6秒 6秒間×1.5", "+7秒 7秒間×1.6", "+9秒 8秒間×1.7", "+12秒 10秒間×1.8"] },

  // --- UR --------------------------------------------------------
  { id: "interior_anball", levels: ["+100pt +3秒", "+125pt +4秒", "+150pt +5秒", "+180pt +7秒", "+220pt +10秒"] },
  { id: "other_azubee", levels: ["6秒間 ×2", "7秒間 ×2", "8秒間 ×2.1", "10秒間 ×2.2", "12秒間 ×2.5"], note: "その間ずっと得点倍率がかかる" },
  { id: "other_omojii", levels: ["+10秒 +30pt", "+13秒 +45pt", "+16秒 +60pt", "+20秒 +80pt", "+25秒 +100pt"] },
  { id: "interior_kinoko_azubee", levels: ["6秒間 落下×1.7 無敵 得点×1.5", "7秒間 落下×1.8 無敵 得点×1.5", "8秒間 落下×1.9 無敵 得点×1.6", "10秒間 落下×2 無敵 得点×1.7", "12秒間 落下×2.2 無敵 得点×2"], note: "落下速度・無敵コンボ・得点倍率が同時にかかる" },
  { id: "other_komochi", levels: ["次の5個 ×2 保護4回", "次の5個 ×2.1 保護4回", "次の6個 ×2.2 保護4回", "次の7個 ×2.3 保護4回", "次の8個 ×2.5 保護4回"], note: "コンボ保護は4つまで持てる" },
  { id: "other_azuki", levels: ["+5秒 +50pt", "+7秒 +65pt", "+9秒 +80pt", "+12秒 +100pt", "+15秒 +130pt"] },
  { id: "other_kobee", levels: ["+50pt 8秒間無敵", "+65pt 9秒間無敵", "+80pt 11秒間無敵", "+100pt 13秒間無敵", "+130pt 16秒間無敵"] },

  // --- LR --------------------------------------------------------
  { id: "interior_shikkoku_no_ar", levels: ["8秒間 落下×2 無敵 得点×2", "10秒間 落下×2.2 無敵 得点×2.2", "12秒間 落下×2.4 無敵 得点×2.4", "15秒間 落下×2.6 無敵 得点×2.7", "20秒間 落下×3 無敵 得点×3"], note: "きのこあずびーの上位版。3つの効果が同時にかかる" },
  { id: "interior_ragby_ar", levels: ["5秒間", "6秒間", "7秒間", "9秒間", "12秒間"], note: "その間アイテムが3倍の量で降ってくる" },
];

const SKILL_BY_ID = new Map(ITEM_CATCH_SKILLS.map((skill) => [skill.id, skill]));

export function getItemCatchSkill(id: string): ItemCatchSkill | null {
  return SKILL_BY_ID.get(id) ?? null;
}
