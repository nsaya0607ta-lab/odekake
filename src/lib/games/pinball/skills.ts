/**
 * ご当地ピンボールのスキル
 * =============================================================
 * 台に光ったご当地アイテムにボールを当てて集めると、その場でスキルが発動する。
 * スキルLvはアイテムキャッチと同じ図鑑のLv（所持数で Lv1〜5。getSkillLevel）。N とカプセルはスキルなし（得点だけ）。
 *
 * 効果の強さは「種類 × Lv」で決まり、秒数のあるものはレア度でも少しのびる（RARITY_TIME）。
 * 名前（title）はアイテムごとに付けている。図鑑に新しい県・アイテムが増えてここに無いときは、
 * レア度に応じた基本のスキルが自動で付く（defaultRecipe）。ちゃんとした名前を付けるときは RECIPES に足す。
 */
import type { GachaRarity } from "@/lib/gacha/config";

export type PinballSkillKind =
  | "save"
  | "double"
  | "triple"
  | "bumper"
  | "slow"
  | "gate"
  | "kickback"
  | "bonusx"
  | "drops"
  | "call"
  | "combo"
  | "guard"
  | "multiball"
  | "fever"
  | "points"
  | "signature";

/** 1回の発動で起きること（ゲームのルール側 game.ts がこれを実行する） */
export type SkillEffect =
  | { type: "save"; sec: number }
  | { type: "mult"; factor: number; sec: number }
  | { type: "bumperMult"; factor: number; sec: number }
  | { type: "slow"; sec: number }
  | { type: "gate"; sec: number }
  | { type: "kickback"; both: boolean }
  | { type: "bonusX"; add: number }
  | { type: "drops" }
  | { type: "call"; count: number }
  | { type: "combo"; addSec: number; sec: number }
  | { type: "multiball"; balls: number; saveSec: number }
  | { type: "points"; value: number };

export type PinballSkill = {
  kind: PinballSkillKind;
  title: string;
  level: number;
  effects: SkillEffect[];
  /** 画面に出す短い説明（例：「ボールセーブ 8秒」） */
  text: string;
};

type Recipe = { title: string; kind: PinballSkillKind };

const RECIPES: Record<string, Recipe> = {
  // --- 福井県 ---
  fukui_yakisaba_sushi: { title: "炙りたてボーナス", kind: "points" },
  fukui_mizu_yokan: { title: "ひんやりスロー", kind: "slow" },
  fukui_sabae_glasses: { title: "よく見えるめがね", kind: "call" },
  fukui_eiheiji: { title: "山門で通せんぼ", kind: "gate" },
  fukui_echizen_crab: { title: "カニばさみガード", kind: "guard" },
  fukui_tojinbo: { title: "断崖の荒波マルチボール", kind: "multiball" },
  fukui_dinosaur: { title: "恐竜大行進", kind: "signature" },
  // --- 長野県 ---
  nagano_apple: { title: "りんごの実り", kind: "bonusx" },
  nagano_shichimi: { title: "ピリ辛2倍", kind: "double" },
  nagano_snow_monkey: { title: "ゆったり温泉", kind: "slow" },
  nagano_onbashira: { title: "御柱の通せんぼ", kind: "gate" },
  nagano_zenkoji: { title: "ご本尊のご加護", kind: "save" },
  nagano_matsumoto_castle: { title: "黒い天守の守り", kind: "guard" },
  nagano_kamikochi: { title: "河童の大はしゃぎ", kind: "signature" },
  // --- 岐阜県 ---
  gifu_keichan: { title: "ジュージュー鶏ちゃん", kind: "bumper" },
  gifu_kuri_kinton: { title: "栗きんとんのおまもり", kind: "save" },
  gifu_mino_washi: { title: "和紙ひこうき", kind: "points" },
  gifu_ayu: { title: "鮎の川のぼり", kind: "combo" },
  gifu_minoyaki: { title: "窯変ボーナス", kind: "bonusx" },
  gifu_seki_hamono: { title: "スパッと全倒し", kind: "drops" },
  gifu_gujo_hachiman: { title: "徹夜おどりのバンパー祭り", kind: "bumper" },
  gifu_gero_onsen: { title: "名湯のいやし", kind: "save" },
  gifu_hida_takayama: { title: "からくり屋台のお祭り", kind: "fever" },
  gifu_nagara_ukai: { title: "鵜がひろってくる", kind: "call" },
  gifu_hida_beef: { title: "霜降りトリプル", kind: "triple" },
  gifu_gifu_castle: { title: "金華山の天守の守り", kind: "guard" },
  gifu_shinhotaka: { title: "ロープウェイでふたり乗り", kind: "multiball" },
  gifu_shirakawago: { title: "合掌造りの結（ゆい）", kind: "signature" },
  // --- 愛知県 ---
  aichi_miso_katsu: { title: "味噌だれバンパー", kind: "bumper" },
  aichi_takeshima: { title: "竹島の橋わたり", kind: "save" },
  aichi_tokoname: { title: "招き猫のお招き", kind: "call" },
  aichi_toyokawa_inari: { title: "お稲荷さんのご利益", kind: "bonusx" },
  aichi_hitsumabushi: { title: "三度おいしいトリプル", kind: "triple" },
  aichi_inuyama_castle: { title: "国宝天守の守り", kind: "guard" },
  aichi_nagoya_castle: { title: "金のしゃちほこ大ぶるまい", kind: "signature" },
  // --- 静岡県 ---
  shizuoka_hamamatsu_gyoza: { title: "焼き餃子バンパー", kind: "bumper" },
  shizuoka_green_tea: { title: "茶柱でひと息", kind: "slow" },
  shizuoka_miho_no_matsubara: { title: "松原の防風林", kind: "gate" },
  shizuoka_atami_onsen: { title: "湯けむりセーブ", kind: "save" },
  shizuoka_hamanako_unagi: { title: "うなぎのぼりコンボ", kind: "combo" },
  shizuoka_omuroyama: { title: "お鉢めぐりマルチボール", kind: "multiball" },
  shizuoka_mt_fuji_tea: { title: "日本一の富士", kind: "signature" },
  // --- 三重県 ---
  mie_yokkaichi_tonteki: { title: "とんてきパワー", kind: "points" },
  mie_pearl: { title: "真珠のかがやき", kind: "bonusx" },
  mie_iga_ninja: { title: "分身の術", kind: "multiball" },
  mie_meoto_iwa: { title: "夫婦岩のしめ縄", kind: "kickback" },
  mie_ise_ebi: { title: "伊勢海老のピチピチ祭り", kind: "fever" },
  mie_matsusaka_beef: { title: "特選霜降り3倍", kind: "triple" },
  mie_ise_jingu: { title: "お伊勢参りのご加護", kind: "signature" },
};

/** 秒数ののびかた（レア度が高いほど同じ種類でも長く効く） */
const RARITY_TIME: Record<GachaRarity, number> = { N: 1, R: 1, SR: 1.15, SSR: 1.3, UR: 1.45, LR: 1.6, MR: 1.8 };

const LV = {
  save: [6, 7, 8, 10, 12],
  double: [8, 10, 12, 14, 17],
  triple: [6, 7, 8, 10, 12],
  bumper: [10, 12, 14, 17, 20],
  slow: [5, 6, 7, 8, 10],
  gate: [6, 7, 8, 10, 12],
  bonusx: [1, 1, 2, 2, 3],
  dropsPoints: [10000, 15000, 20000, 30000, 40000],
  call: [1, 1, 1, 2, 2],
  comboAdd: [1.5, 2, 2.5, 3, 4],
  guardGate: [5, 6, 7, 8, 10],
  guardSave: [3, 4, 5, 6, 8],
  multiSave: [3, 4, 6, 8, 10],
  fever: [6, 8, 10, 12, 15],
  points: [20000, 30000, 45000, 65000, 90000],
  sigDouble: [10, 12, 14, 16, 20],
  sigGate: [8, 9, 10, 12, 15],
} as const;

/** バンパー強化の倍率 */
export const BUMPER_SKILL_FACTOR = 5;
/** コンボの受付をのばす効果が続く秒数 */
const COMBO_SKILL_SEC = 30;

function defaultRecipe(name: string, rarity: GachaRarity): Recipe | null {
  switch (rarity) {
    case "R":
      return { title: `${name}のおまもり`, kind: "save" };
    case "SR":
      return { title: `${name}パワー`, kind: "double" };
    case "SSR":
      return { title: `${name}のまもり`, kind: "guard" };
    case "UR":
      return { title: `${name}マルチボール`, kind: "multiball" };
    case "LR":
    case "MR":
      return { title: `${name}の奥義`, kind: "signature" };
    default:
      return null;
  }
}

const sec = (base: number, rarity: GachaRarity) => Math.round(base * RARITY_TIME[rarity]);
/** Lv の表から値を取る（i は 0〜4） */
const at = (table: readonly number[], i: number): number => table[i] ?? table[0] ?? 0;
const man = (value: number) => (value % 10000 === 0 ? `${value / 10000}万点` : `${value.toLocaleString("ja-JP")}点`);

function build(kind: PinballSkillKind, rarity: GachaRarity, level: number): { effects: SkillEffect[]; text: string } {
  const i = Math.max(0, Math.min(4, level - 1));
  switch (kind) {
    case "save": {
      const s = sec(at(LV.save, i), rarity);
      return { effects: [{ type: "save", sec: s }], text: `ボールセーブ ${s}秒` };
    }
    case "double": {
      const s = sec(at(LV.double, i), rarity);
      return { effects: [{ type: "mult", factor: 2, sec: s }], text: `${s}秒間 得点2倍` };
    }
    case "triple": {
      const s = sec(at(LV.triple, i), rarity);
      return { effects: [{ type: "mult", factor: 3, sec: s }], text: `${s}秒間 得点3倍` };
    }
    case "bumper": {
      const s = sec(at(LV.bumper, i), rarity);
      return { effects: [{ type: "bumperMult", factor: BUMPER_SKILL_FACTOR, sec: s }], text: `${s}秒間 バンパー${BUMPER_SKILL_FACTOR}倍` };
    }
    case "slow": {
      const s = sec(at(LV.slow, i), rarity);
      return { effects: [{ type: "slow", sec: s }], text: `${s}秒間 スローモーション` };
    }
    case "gate": {
      const s = sec(at(LV.gate, i), rarity);
      return { effects: [{ type: "gate", sec: s }], text: `${s}秒間 アウトレーンをふさぐ` };
    }
    case "kickback": {
      const both = level >= 3;
      const effects: SkillEffect[] = [{ type: "kickback", both }];
      if (level >= 5) effects.push({ type: "save", sec: sec(5, rarity) });
      return { effects, text: both ? (level >= 5 ? "左右キックバック＋セーブ" : "左右のキックバック点灯") : "左のキックバック点灯" };
    }
    case "bonusx": {
      const n = at(LV.bonusx, i);
      return { effects: [{ type: "bonusX", add: n }], text: `ボーナス倍率 +${n}` };
    }
    case "drops": {
      const v = Math.round((at(LV.dropsPoints, i) * RARITY_TIME[rarity]) / 1000) * 1000;
      return { effects: [{ type: "drops" }, { type: "points", value: v }], text: `ターゲット全倒し＋${man(v)}` };
    }
    case "call": {
      const n = at(LV.call, i);
      return { effects: [{ type: "call", count: n }], text: n > 1 ? `アイテムを${n}か所よぶ` : "アイテムをもう1か所よぶ" };
    }
    case "combo": {
      const add = at(LV.comboAdd, i);
      return { effects: [{ type: "combo", addSec: add, sec: COMBO_SKILL_SEC }], text: `${COMBO_SKILL_SEC}秒間 コンボ受付 +${add}秒` };
    }
    case "guard": {
      const g = sec(at(LV.guardGate, i), rarity);
      const s = sec(at(LV.guardSave, i), rarity);
      return { effects: [{ type: "gate", sec: g }, { type: "save", sec: s }], text: `${g}秒ふさぐ＋セーブ${s}秒` };
    }
    case "multiball": {
      const balls = level >= 5 ? 2 : 1;
      const s = sec(at(LV.multiSave, i), rarity);
      return { effects: [{ type: "multiball", balls, saveSec: s }], text: `ボール+${balls}（セーブ${s}秒）` };
    }
    case "fever": {
      const s = sec(at(LV.fever, i), rarity);
      return {
        effects: [{ type: "mult", factor: 2, sec: s }, { type: "bumperMult", factor: BUMPER_SKILL_FACTOR, sec: s }],
        text: `${s}秒間 2倍＋バンパー${BUMPER_SKILL_FACTOR}倍`,
      };
    }
    case "points": {
      const v = Math.round((at(LV.points, i) * RARITY_TIME[rarity]) / 1000) * 1000;
      return { effects: [{ type: "points", value: v }], text: `その場で ${man(v)}` };
    }
    case "signature": {
      const balls = level >= 4 ? 2 : 1;
      const d = at(LV.sigDouble, i);
      const g = at(LV.sigGate, i);
      return {
        effects: [
          { type: "multiball", balls, saveSec: g },
          { type: "mult", factor: 2, sec: d },
          { type: "gate", sec: g },
        ],
        text: `ボール+${balls}・${d}秒2倍・${g}秒ふさぐ`,
      };
    }
  }
}

/**
 * アイテムのスキル。N・カプセル・スキルLvが0（持っていない）のときは null（得点だけ）。
 * @param level 図鑑のスキルLv（getSkillLevel の値。1〜5）
 */
export function getPinballSkill(id: string, name: string, rarity: GachaRarity, level: number): PinballSkill | null {
  if (rarity === "N" || level <= 0) return null;
  const recipe = RECIPES[id] ?? defaultRecipe(name, rarity);
  if (!recipe) return null;
  const { effects, text } = build(recipe.kind, rarity, level);
  return { kind: recipe.kind, title: recipe.title, level, effects, text };
}

/** ルール説明用：Lv1〜5 の効果の文字 */
export function describeSkillLevels(id: string, name: string, rarity: GachaRarity): { title: string; kind: PinballSkillKind; levels: string[] } | null {
  if (rarity === "N") return null;
  const recipe = RECIPES[id] ?? defaultRecipe(name, rarity);
  if (!recipe) return null;
  return { title: recipe.title, kind: recipe.kind, levels: [1, 2, 3, 4, 5].map((lv) => build(recipe.kind, rarity, lv).text) };
}

/** スキルの種類ごとのアイコン（HUD の効果中の表示に使う） */
export const SKILL_KIND_LABEL: Record<PinballSkillKind, string> = {
  save: "セーブ",
  double: "2倍",
  triple: "3倍",
  bumper: "バンパー",
  slow: "スロー",
  gate: "ふさぐ",
  kickback: "キックバック",
  bonusx: "ボーナス",
  drops: "全倒し",
  call: "よぶ",
  combo: "コンボ",
  guard: "まもり",
  multiball: "マルチ",
  fever: "フィーバー",
  points: "得点",
  signature: "奥義",
};
