/**
 * ご当地ピンボールのスキル
 * =============================================================
 * 台に光ったご当地アイテムにボールを当てて集めると、その場でスキルが発動する。
 * スキルLvはアイテムキャッチと同じ図鑑のLv（所持数で Lv1〜5。getSkillLevel）。N とカプセルはスキルなし（得点だけ）。
 *
 * 効果の強さは「種類 × Lv」で決まり、秒数のあるものはレア度でも少しのびる（RARITY_TIME）。
 * Lv5（MAX）になると「覚醒」して、効果がひとつ増える（build の「覚醒」）。
 * Lv5 のあとも同じアイテムを引くと限界突破の★がつき（starsForCount）、★1つで秒数と得点が STAR_RATE ずつ上がる。
 * 名前（title）はアイテムごとに付けている。図鑑に新しい県・アイテムが増えてここに無いときは、
 * レア度に応じた基本のスキルが自動で付く（defaultRecipe）。ちゃんとした名前を付けるときは RECIPES に足す。
 */
import type { GachaRarity } from "@/lib/gacha/config";
import { SKILL_LEVEL_THRESHOLDS } from "@/lib/gacha/skill-levels";
import { STAR_MAX, STAR_RATE } from "./config";

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
  | "signature"
  | "magnet"
  | "stamp2"
  | "encore"
  | "jackpot";

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
  | { type: "points"; value: number }
  /** ガチャ穴の前を上っていく玉を、穴へ吸い寄せる */
  | { type: "magnet"; sec: number }
  /** この間に取ったアイテムは、スタンプが2つ進む */
  | { type: "stamp2"; sec: number }
  /** さっき取ったアイテムを、台にもう一度出す（取るとスキルももう一度） */
  | { type: "encore"; count: number }
  /** 次のランプ shots 回がジャックポット（value 点 × (1 + 制覇の回数)） */
  | { type: "jackpot"; shots: number; value: number };

export type PinballSkill = {
  kind: PinballSkillKind;
  title: string;
  level: number;
  /** 限界突破の★（0〜STAR_MAX） */
  stars: number;
  effects: SkillEffect[];
  /** 画面に出す短い説明（例：「ボールセーブ 8秒」） */
  text: string;
};

type Recipe = { title: string; kind: PinballSkillKind };

const RECIPES: Record<string, Recipe> = {
  // --- 福井県 ---
  fukui_yakisaba_sushi: { title: "焼き鯖寿司のおかわり", kind: "encore" },
  fukui_mizu_yokan: { title: "ひんやりスロー", kind: "slow" },
  fukui_sabae_glasses: { title: "よく見えるめがね", kind: "call" },
  fukui_eiheiji: { title: "永平寺の御朱印", kind: "stamp2" },
  fukui_echizen_crab: { title: "カニばさみガード", kind: "guard" },
  fukui_tojinbo: { title: "断崖の荒波マルチボール", kind: "multiball" },
  fukui_dinosaur: { title: "恐竜大行進", kind: "signature" },
  // --- 長野県 ---
  nagano_apple: { title: "りんごの実り", kind: "bonusx" },
  nagano_shichimi: { title: "ピリ辛2倍", kind: "double" },
  nagano_snow_monkey: { title: "ゆったり温泉", kind: "slow" },
  nagano_onbashira: { title: "御柱の綱引き", kind: "magnet" },
  nagano_zenkoji: { title: "善光寺の御朱印", kind: "stamp2" },
  nagano_matsumoto_castle: { title: "黒い天守の守り", kind: "guard" },
  nagano_kamikochi: { title: "河童の大はしゃぎ", kind: "signature" },
  // --- 岐阜県 ---
  gifu_keichan: { title: "鶏ちゃんおかわり", kind: "encore" },
  gifu_kuri_kinton: { title: "栗きんとんのおまもり", kind: "save" },
  gifu_mino_washi: { title: "美濃和紙の二度押し", kind: "stamp2" },
  gifu_ayu: { title: "鮎の川のぼり", kind: "combo" },
  gifu_minoyaki: { title: "窯変ボーナス", kind: "bonusx" },
  gifu_seki_hamono: { title: "スパッと全倒し", kind: "drops" },
  gifu_gujo_hachiman: { title: "徹夜おどりのバンパー祭り", kind: "bumper" },
  gifu_gero_onsen: { title: "名湯のいやし", kind: "save" },
  gifu_hida_takayama: { title: "からくり屋台のお祭り", kind: "fever" },
  gifu_nagara_ukai: { title: "鵜匠の手縄", kind: "magnet" },
  gifu_hida_beef: { title: "霜降りトリプル", kind: "triple" },
  gifu_gifu_castle: { title: "天下取りのジャックポット", kind: "jackpot" },
  gifu_shinhotaka: { title: "ロープウェイでふたり乗り", kind: "multiball" },
  gifu_shirakawago: { title: "合掌造りの結（ゆい）", kind: "signature" },
  // --- 愛知県 ---
  aichi_miso_katsu: { title: "味噌だれバンパー", kind: "bumper" },
  aichi_takeshima: { title: "竹島の橋わたり", kind: "save" },
  aichi_tokoname: { title: "招き猫の手まねき", kind: "magnet" },
  aichi_toyokawa_inari: { title: "商売繁盛の大当たり", kind: "jackpot" },
  aichi_hitsumabushi: { title: "三度おいしいトリプル", kind: "triple" },
  aichi_inuyama_castle: { title: "国宝天守の守り", kind: "guard" },
  aichi_nagoya_castle: { title: "金のしゃちほこ大ぶるまい", kind: "signature" },
  // --- 静岡県 ---
  shizuoka_hamamatsu_gyoza: { title: "浜松餃子おかわり", kind: "encore" },
  shizuoka_green_tea: { title: "茶柱が立つ大当たり", kind: "jackpot" },
  shizuoka_miho_no_matsubara: { title: "松原の防風林", kind: "gate" },
  shizuoka_atami_onsen: { title: "湯けむりセーブ", kind: "save" },
  shizuoka_hamanako_unagi: { title: "うなぎのぼりコンボ", kind: "combo" },
  shizuoka_omuroyama: { title: "お鉢めぐりマルチボール", kind: "multiball" },
  shizuoka_mt_fuji_tea: { title: "日本一の富士", kind: "signature" },
  // --- 三重県 ---
  mie_yokkaichi_tonteki: { title: "とんてきおかわり", kind: "encore" },
  mie_pearl: { title: "真珠の大当たり", kind: "jackpot" },
  mie_iga_ninja: { title: "分身の術", kind: "multiball" },
  mie_meoto_iwa: { title: "夫婦岩のしめ縄", kind: "kickback" },
  mie_ise_ebi: { title: "伊勢海老のピチピチ祭り", kind: "fever" },
  mie_matsusaka_beef: { title: "特選霜降り3倍", kind: "triple" },
  mie_ise_jingu: { title: "お伊勢参りのご加護", kind: "signature" },
};

/** 秒数ののびかた（レア度が高いほど同じ種類でも長く効く） */
const RARITY_TIME: Record<GachaRarity, number> = { N: 1, R: 1, SR: 1.15, SSR: 1.3, UR: 1.45, LR: 1.6, MR: 1.8 };

/**
 * Lv1〜5 の強さ。Lv5 の数字は Lv4 と同じにしてある（Lv5 は数字ではなく「覚醒」で効果がひとつ増える。
 * 覚醒と★のぶんで強くなりすぎないように）
 */
const LV = {
  save: [6, 7, 8, 10, 10],
  double: [8, 10, 12, 14, 14],
  triple: [6, 7, 8, 10, 10],
  bumper: [10, 12, 14, 17, 17],
  slow: [5, 6, 7, 8, 8],
  gate: [6, 7, 8, 10, 10],
  bonusx: [1, 1, 2, 2, 2],
  dropsPoints: [10000, 15000, 20000, 30000, 30000],
  call: [1, 1, 1, 2, 2],
  comboAdd: [1.5, 2, 2.5, 3, 3],
  guardGate: [5, 6, 7, 8, 8],
  guardSave: [3, 4, 5, 6, 6],
  multiSave: [3, 4, 6, 8, 8],
  fever: [6, 8, 10, 12, 12],
  points: [20000, 30000, 45000, 65000, 65000],
  sigDouble: [10, 12, 14, 16, 16],
  sigGate: [8, 9, 10, 12, 12],
  magnet: [6, 7, 8, 10, 10],
  stamp2: [8, 10, 12, 14, 14],
  encore: [1, 1, 1, 1, 1],
  jackpot: [50000, 60000, 75000, 100000, 100000],
} as const;

/** 覚醒（Lv5）で足す効果の秒数（レア度と★でのびる前の値） */
const AWAKEN_SEC = { save: 5, magnet: 6, stamp2: 8 } as const;

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

/** 限界突破の★で、秒数と得点がのびる割合 */
const starBoost = (stars: number) => 1 + STAR_RATE * Math.max(0, Math.min(STAR_MAX, stars));
/** Lv の表から値を取る（i は 0〜4） */
const at = (table: readonly number[], i: number): number => table[i] ?? table[0] ?? 0;
const man = (value: number) => (value % 10000 === 0 ? `${value / 10000}万点` : `${value.toLocaleString("ja-JP")}点`);

/**
 * スキルの中身（効果と説明の文字）。level は 1〜5、stars は限界突破の★。
 * Lv5 は「覚醒」：それぞれの種類に、効果をひとつ足す（キックバック・マルチボール・おかわりは、もとの効果が強くなる）。
 * 覚醒で足すのは、得点がのびるもの（ボーナス倍率・アイテムをよぶ など）。玉が長く残る効果を足すと、
 * 1プレイが長くなって得点がふくらみすぎる（シミュレーターで確かめた。docs/pinball.md）
 */
function build(kind: PinballSkillKind, rarity: GachaRarity, level: number, stars: number): { effects: SkillEffect[]; text: string } {
  const i = Math.max(0, Math.min(4, level - 1));
  const boost = starBoost(stars);
  const awake = level >= 5;
  /** 秒数（レア度と★でのびる） */
  const sec = (base: number) => Math.round(base * RARITY_TIME[rarity] * boost);
  /** 得点（レア度と★でのびる。千点単位） */
  const pts = (base: number) => Math.round((base * RARITY_TIME[rarity] * boost) / 1000) * 1000;
  const effects: SkillEffect[] = [];
  let text = "";
  /** 覚醒：ボーナス倍率 +1 */
  const awakenBonus = () => {
    effects.push({ type: "bonusX", add: 1 });
    text += "＋ボーナス+1";
  };
  /** 覚醒：アイテムをもう1か所よぶ */
  const awakenCall = () => {
    effects.push({ type: "call", count: 1 });
    text += "＋もう1か所よぶ";
  };
  switch (kind) {
    case "save": {
      const s = sec(at(LV.save, i));
      effects.push({ type: "save", sec: s });
      text = `ボールセーブ ${s}秒`;
      if (awake) awakenBonus();
      break;
    }
    case "double": {
      const s = sec(at(LV.double, i));
      effects.push({ type: "mult", factor: 2, sec: s });
      text = `${s}秒間 得点2倍`;
      if (awake) awakenBonus();
      break;
    }
    case "triple": {
      const s = sec(at(LV.triple, i));
      effects.push({ type: "mult", factor: 3, sec: s });
      text = `${s}秒間 得点3倍`;
      if (awake) awakenBonus();
      break;
    }
    case "bumper": {
      const s = sec(at(LV.bumper, i));
      effects.push({ type: "bumperMult", factor: BUMPER_SKILL_FACTOR, sec: s });
      text = `${s}秒間 バンパー${BUMPER_SKILL_FACTOR}倍`;
      if (awake) awakenBonus();
      break;
    }
    case "slow": {
      const s = sec(at(LV.slow, i));
      effects.push({ type: "slow", sec: s });
      text = `${s}秒間 スローモーション`;
      if (awake) awakenCall();
      break;
    }
    case "gate": {
      const s = sec(at(LV.gate, i));
      effects.push({ type: "gate", sec: s });
      text = `${s}秒間 アウトレーンをふさぐ`;
      if (awake) awakenCall();
      break;
    }
    case "kickback": {
      const both = level >= 3;
      effects.push({ type: "kickback", both });
      text = both ? "左右のキックバック点灯" : "左のキックバック点灯";
      if (awake) {
        const g = sec(AWAKEN_SEC.save);
        effects.push({ type: "save", sec: g });
        text = `左右キックバック＋セーブ${g}秒`;
      }
      break;
    }
    case "bonusx": {
      const n = at(LV.bonusx, i);
      effects.push({ type: "bonusX", add: n });
      text = `ボーナス倍率 +${n}`;
      if (awake) awakenCall();
      break;
    }
    case "drops": {
      const v = pts(at(LV.dropsPoints, i));
      effects.push({ type: "drops" }, { type: "points", value: v });
      text = `ターゲット全倒し＋${man(v)}`;
      if (awake) {
        const m = sec(AWAKEN_SEC.magnet);
        effects.push({ type: "magnet", sec: m });
        text += `＋マグネット${m}秒`;
      }
      break;
    }
    case "call": {
      const n = at(LV.call, i);
      effects.push({ type: "call", count: n });
      text = n > 1 ? `アイテムを${n}か所よぶ` : "アイテムをもう1か所よぶ";
      if (awake) {
        const t = sec(AWAKEN_SEC.stamp2);
        effects.push({ type: "stamp2", sec: t });
        text += `＋スタンプ2倍${t}秒`;
      }
      break;
    }
    case "combo": {
      const add = at(LV.comboAdd, i);
      effects.push({ type: "combo", addSec: add, sec: COMBO_SKILL_SEC });
      text = `${COMBO_SKILL_SEC}秒間 コンボ受付 +${add}秒`;
      if (awake) awakenBonus();
      break;
    }
    case "guard": {
      const g = sec(at(LV.guardGate, i));
      const s = sec(at(LV.guardSave, i));
      effects.push({ type: "gate", sec: g }, { type: "save", sec: s });
      text = `${g}秒ふさぐ＋セーブ${s}秒`;
      if (awake) awakenBonus();
      break;
    }
    case "multiball": {
      const balls = awake ? 2 : 1;
      const s = sec(at(LV.multiSave, i));
      effects.push({ type: "multiball", balls, saveSec: s });
      text = `ボール+${balls}（セーブ${s}秒）`;
      break;
    }
    case "fever": {
      const s = sec(at(LV.fever, i));
      effects.push({ type: "mult", factor: 2, sec: s }, { type: "bumperMult", factor: BUMPER_SKILL_FACTOR, sec: s });
      text = `${s}秒間 2倍＋バンパー${BUMPER_SKILL_FACTOR}倍`;
      if (awake) awakenBonus();
      break;
    }
    case "points": {
      const v = pts(at(LV.points, i));
      effects.push({ type: "points", value: v });
      text = `その場で ${man(v)}`;
      if (awake) awakenBonus();
      break;
    }
    case "signature": {
      const balls = level >= 4 ? 2 : 1;
      // 奥義は秒数の表がもともと強いので、レア度ではのばさない（★ではのびる）
      const d = Math.round(at(LV.sigDouble, i) * boost);
      const g = Math.round(at(LV.sigGate, i) * boost);
      effects.push({ type: "multiball", balls, saveSec: g }, { type: "mult", factor: 2, sec: d }, { type: "gate", sec: g });
      text = `ボール+${balls}・${d}秒2倍・${g}秒ふさぐ`;
      if (awake) awakenBonus();
      break;
    }
    case "magnet": {
      // 穴の前のターゲットは、マグネットが倒して開けたままにする（game.ts）
      const s = sec(at(LV.magnet, i));
      effects.push({ type: "magnet", sec: s });
      text = `${s}秒間 ガチャ穴マグネット`;
      if (awake) awakenBonus();
      break;
    }
    case "stamp2": {
      const s = sec(at(LV.stamp2, i));
      effects.push({ type: "stamp2", sec: s });
      text = `${s}秒間 スタンプ2倍`;
      if (awake) awakenCall();
      break;
    }
    case "encore": {
      // 覚醒すると、おかわりが2つになる
      const n = at(LV.encore, i) + (awake ? 1 : 0);
      effects.push({ type: "encore", count: n });
      text = `さっきのアイテムを${n}つおかわり`;
      break;
    }
    case "jackpot": {
      const v = Math.round((at(LV.jackpot, i) * boost) / 1000) * 1000;
      effects.push({ type: "jackpot", shots: 1, value: v });
      text = `次のランプ1回が ${man(v)}ジャックポット`;
      if (awake) awakenBonus();
      break;
    }
  }
  return { effects, text };
}

/**
 * 限界突破の★：スキルLvが MAX になる数（図鑑の決まり）をこえて引いたぶん。1つごとに★1つ、STAR_MAX まで。
 * N（スキルLvの無いレア度）は 0
 */
export function starsForCount(rarity: GachaRarity, count: number): number {
  const thresholds = SKILL_LEVEL_THRESHOLDS[rarity];
  const max = thresholds[thresholds.length - 1];
  if (max === undefined || count <= max) return 0;
  return Math.min(STAR_MAX, count - max);
}

/**
 * アイテムのスキル。N・カプセル・スキルLvが0（持っていない）のときは null（得点だけ）。
 * @param level 図鑑のスキルLv（getSkillLevel の値。1〜5）
 * @param stars 限界突破の★（starsForCount の値）
 */
export function getPinballSkill(id: string, name: string, rarity: GachaRarity, level: number, stars = 0): PinballSkill | null {
  if (rarity === "N" || level <= 0) return null;
  const recipe = RECIPES[id] ?? defaultRecipe(name, rarity);
  if (!recipe) return null;
  const s = level >= 5 ? Math.max(0, Math.min(STAR_MAX, stars)) : 0;
  const { effects, text } = build(recipe.kind, rarity, level, s);
  return { kind: recipe.kind, title: recipe.title, level, stars: s, effects, text };
}

/** ルール説明用：Lv1〜5 の効果の文字（★なし）。Lv5 は覚醒した強さ */
export function describeSkillLevels(id: string, name: string, rarity: GachaRarity): { title: string; kind: PinballSkillKind; levels: string[] } | null {
  if (rarity === "N") return null;
  const recipe = RECIPES[id] ?? defaultRecipe(name, rarity);
  if (!recipe) return null;
  return { title: recipe.title, kind: recipe.kind, levels: [1, 2, 3, 4, 5].map((lv) => build(recipe.kind, rarity, lv, 0).text) };
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
  magnet: "マグネット",
  stamp2: "スタンプ2倍",
  encore: "おかわり",
  jackpot: "JP予約",
};
