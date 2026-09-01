#!/usr/bin/env node
/**
 * アイテムキャッチのプレイ時間・スコアをモンテカルロシミュレーションで検算するツール。
 * =============================================================
 * docs/minigame-time-balance.md で繰り返し「別途スクリプトで管理」とだけ書かれ実体が
 * 存在しなかったシミュレータをリポジトリ内に置いたもの。時間増加系アイテムやガチャの
 * 重み・スキルLv値を調整するたびに、このスクリプトで実際の期待値を検算してから
 * frenchie-catch-game.tsx / item-catch-skills.ts / docs を直すという運用を想定している。
 *
 * `src/lib/collection/items.ts` と `src/components/frenchie-catch-game.tsx` を直接読み込み、
 * 正規表現+evalでLVテーブル・出現重み・？アイテムの抽選プール・ROUND_SECONDS等を抽出するため、
 * 実装側の数値を変更すればこのスクリプトも自動的に追従する（値を二重管理しない）。
 *
 * 使い方: node scripts/simulate-item-catch.mjs [試行回数(デフォルト300)] [avoid|all] [時間増加系7種の実キャッチ率(デフォルト1)]
 *   第2引数 "avoid"（デフォルト）: 時間減少ハザードとチョコレートは回避する（キャッチしない）前提
 *   第2引数 "all": ハザードも含めて全てのスポーンを100%キャッチする前提
 *     （時間減少は-3秒、チョコレートは即座にラウンド終了）
 *   第3引数: 時間増加系7種(あひる/にんじん/肉球メロンパン/アンボール/小豆/おもじぃ/夏のフレブル)が
 *     出現した際に実際にキャッチできる確率。例: 0.9 を渡すと「時間増加系を9割しか取れない」プレイを再現する
 *     （見送った分は何も起きない＝ハズレでも他のアイテムでもなく、ただ落下していくだけとして扱う）
 *
 * 既知の簡略化（完全な再現ではない点に注意）:
 * - もっちゅりんの「エコー」（直前に捕まえたアイテムのスキルを再発動）は未実装
 * - JUSTボーナス（着地位置がド真ん中に近いと+25%）は正確な位置判定の代わりに一律30%確率で近似
 * - ミラーおもちの「しびれ/ダンボール縮小への反転加点」は未実装（時間減少の反転pt加算のみ実装）
 * - エンティティ同時出現数の上限(NORMAL/DOUBLE/TRIPLE_ENTITY_CAP)による出現抑制は未実装
 * - 「100%キャッチできる」という理想化前提（実プレイの体感時間・スコアはこれより下振れするのが通常）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ITEMS_TS = fs.readFileSync(path.join(ROOT, "src/lib/collection/items.ts"), "utf8");
const GAME_TSX = fs.readFileSync(path.join(ROOT, "src/components/frenchie-catch-game.tsx"), "utf8");

/** "as const" 等TypeScript専用構文を取り除いた上でオブジェクト/配列リテラルとしてevalする */
function evalLiteral(src) {
  const cleaned = src.replace(/\s+as\s+const/g, "");
  // eslint-disable-next-line no-new-func
  return new Function(`"use strict"; return (${cleaned});`)();
}

function extractBlock(src, startMarker, openChar, closeChar) {
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error(`marker not found: ${startMarker}`);
  // startMarker は必ず開き括弧そのもので終わる前提（型注釈中の"[]"等を誤って開き括弧と
  // 誤認しないよう、markerの終端位置からそのまま開き括弧を取る）
  const openIdx = start + startMarker.length - 1;
  if (src[openIdx] !== openChar) throw new Error(`marker does not end with '${openChar}': ${startMarker}`);
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === openChar) depth++;
    else if (src[i] === closeChar) {
      depth--;
      if (depth === 0) return src.slice(openIdx, i + 1);
    }
  }
  throw new Error(`unbalanced block for: ${startMarker}`);
}

// --- itemPool（ミニゲームで実際に出現する全アイテム。図鑑本体から復元） ---------------
function buildItemPool() {
  const re = /\{ id: "([^"]+)", name: "[^"]*", image: (?:null|"[^"]*"), category: "([^"]+)", series: (null|"[^"]+"), rarity: "([^"]+)"(?:, art: "([^"]+)")? \}/g;
  const all = [];
  let m;
  while ((m = re.exec(ITEMS_TS))) {
    all.push({ id: m[1], category: m[2], series: m[3] === "null" ? null : m[3].slice(1, -1), rarity: m[4], art: m[5] || null });
  }
  // item-catch/page.tsx のフィルタ条件を再現：series===nullの通常アイテム、またはシリーズの犬スキン(art持ち)のみ
  return all.filter((x) => x.series === null || x.art !== null);
}

const LV = evalLiteral(extractBlock(GAME_TSX, "const LV = {", "{", "}"));
const ITEM_SPAWN_WEIGHTS = evalLiteral(extractBlock(GAME_TSX, "const ITEM_SPAWN_WEIGHTS: Partial<Record<string, number>> = {", "{", "}"));
const MYSTERY_SKILL_ITEM_IDS = evalLiteral(extractBlock(GAME_TSX, "const MYSTERY_SKILL_ITEM_IDS = [", "[", "]"));
const TREASURE_OUTCOME_WEIGHTS = evalLiteral(extractBlock(GAME_TSX, "const TREASURE_OUTCOME_WEIGHTS: { outcome: string; weight: number }[] = [", "[", "]"));
const ROUND_SECONDS = Number(GAME_TSX.match(/const ROUND_SECONDS = (\d+);/)[1]);
const DOG_SPAWN_RATIO = Number(GAME_TSX.match(/const DOG_SPAWN_RATIO = ([\d.]+);/)[1]);
const FRENCHIE_SKIN_SPAWN_CHANCE = Number(GAME_TSX.match(/const FRENCHIE_SKIN_SPAWN_CHANCE = ([\d.]+);/)[1]);
const SPAWN_MIN_MS = Number(GAME_TSX.match(/const SPAWN_INTERVAL_MIN_MS = (\d+);/)[1]);
const SPAWN_MAX_MS = Number(GAME_TSX.match(/const SPAWN_INTERVAL_MAX_MS = (\d+);/)[1]);
const UR_BOOST_MAX = Number(GAME_TSX.match(/const UR_BOOST_MAX = (\d+);/)[1]);
const UR_BOOST_DECAY_STEP = Number(GAME_TSX.match(/const UR_BOOST_DECAY_STEP = (\d+);/)[1]);
const UR_BOOST_DECAY_INTERVAL_MS = Number(GAME_TSX.match(/const UR_BOOST_DECAY_INTERVAL_MS = (\d+);/)[1]);
const POOP_SPAWN_CHANCE = Number(GAME_TSX.match(/const POOP_SPAWN_CHANCE = ([\d.]+);/)[1]);
const MYSTERY_SPAWN_CHANCE = Number(GAME_TSX.match(/const MYSTERY_SPAWN_CHANCE = ([\d.]+);/)[1]);
const BAG_SPAWN_CHANCE = Number(GAME_TSX.match(/const BAG_SPAWN_CHANCE = ([\d.]+);/)[1]);
const BAG_MAX_STOCK = Number(GAME_TSX.match(/const BAG_MAX_STOCK = (\d+);/)[1]);
const TIME_MINUS_SPAWN_CHANCE = Number(GAME_TSX.match(/const TIME_MINUS_SPAWN_CHANCE = ([\d.]+);/)[1]);
const TIME_MINUS_BASE_WEIGHT = Number(GAME_TSX.match(/const TIME_MINUS_BASE_WEIGHT = (\d+);/)[1]);
const TIME_MINUS_BOOSTED_WEIGHT = Number(GAME_TSX.match(/const TIME_MINUS_BOOSTED_WEIGHT = (\d+);/)[1]);
const TIME_MINUS_BOOST_AFTER_SEC = Number(GAME_TSX.match(/const TIME_MINUS_BOOST_AFTER_SEC = (\d+);/)[1]);
const BOX_SHRINK_SPAWN_CHANCE = Number(GAME_TSX.match(/const BOX_SHRINK_SPAWN_CHANCE = ([\d.]+);/)[1]);
const BLACKOUT_SPAWN_CHANCE = Number(GAME_TSX.match(/const BLACKOUT_SPAWN_CHANCE = ([\d.]+);/)[1]);
const STUN_SPAWN_CHANCE = Number(GAME_TSX.match(/const STUN_SPAWN_CHANCE = ([\d.]+);/)[1]);
const CHOCOLATE_SPAWN_CHANCE = Number(GAME_TSX.match(/const CHOCOLATE_SPAWN_CHANCE = ([\d.]+);/)[1]);
const TIME_MINUS_SECONDS = Number(GAME_TSX.match(/const TIME_MINUS_SECONDS = (\d+);/)[1]);
const TREASURE_POOP_FLOOD_COUNT = Number(GAME_TSX.match(/const TREASURE_POOP_FLOOD_COUNT = (\d+);/)[1]);
const TREASURE_MINUS5_SEC = Number(GAME_TSX.match(/const TREASURE_MINUS5_SEC = (\d+);/)[1]);
const TREASURE_DOUBLE_MULT = Number(GAME_TSX.match(/const TREASURE_DOUBLE_MULT = (\d+);/)[1]);
const STRETCH_ROD_SECONDS = Number(GAME_TSX.match(/const STRETCH_ROD_SECONDS = (\d+);/)[1]);
const OYASUMI_SECONDS = Number(GAME_TSX.match(/const OYASUMI_SECONDS = (\d+);/)[1]);
const DOG_FLOOD_SPAWN_RATE = Number(GAME_TSX.match(/const DOG_FLOOD_SPAWN_RATE = ([\d.]+);/)[1]);
const POOP_FLOOD_SPAWN_RATE = Number(GAME_TSX.match(/const POOP_FLOOD_SPAWN_RATE = ([\d.]+);/)[1]);

const POINTS = evalLiteral(extractBlock(GAME_TSX, 'const POINTS: Record<FrenchieCatchItem["rarity"], number> = {', "{", "}"));
const MYSTERY_BASE_POINTS = Number(GAME_TSX.match(/const MYSTERY_BASE_POINTS = (\d+);/)[1]);
const IKEA_PT_PER_ITEM = Number(GAME_TSX.match(/const IKEA_PT_PER_ITEM = (\d+);/)[1]);
const POOP_PENALTY = Number(GAME_TSX.match(/const POOP_PENALTY = (\d+);/)[1]);

const pool = buildItemPool();
const POOL_SIZE = pool.length;
const byId = new Map(pool.map((x) => [x.id, x]));
const DEFAULT_WEIGHT = 100;
const JUST_CHANCE = 0.3; // JUST_RADIUS_RATIO=0.3の近似（正確な着地位置は未実装）
const JUST_MULTIPLIER = Number(GAME_TSX.match(/const JUST_MULTIPLIER = ([\d.]+);/)[1]);
const DOG_POINTS = 15;
const DOG_FLOOD_RATE = DOG_FLOOD_SPAWN_RATE;
const POOP_FLOOD_RATE = POOP_FLOOD_SPAWN_RATE;

const HIGH_RARITY = new Set(["SSR", "UR", "LR"]); // 宝箱の「レア枠確定出現」対象
const BUREBUR_RARITY = new Set(["UR", "LR"]); // ブレブルの限定対象（宝箱より絞り込み）
const OTHER_CATEGORY_IDS = new Set(pool.filter((x) => x.category === "other").map((x) => x.id));
const FOOD_CATEGORY_IDS = new Set(pool.filter((x) => x.category === "food").map((x) => x.id));
const PERSON_IDS = ["other_omochi_janai", "other_listen_to_the_a", "other_omoi_bashira", "other_xmas_party"];
const TIME_BONUS_IDS = new Set(["toy_duck_plush", "toy_carrot", "food_paw_melon_bread", "interior_anball", "other_azuki", "other_omojii", "summer_frenchie"]);
// UR出現率アップ・その他抑制・SSR/UR/LR限定出現・出現量アップなど出現重みの計算式自体を書き換える
// アイテム。ボーナス出現タイマー側で発動頻度が実質的に上がると時間増加系の取得ペースが間接的に
// 揺らぐため、TIME_BONUS_IDSと合わせてボーナス側では除外する（frenchie-catch-game.tsxのSPAWN_DYNAMICS_ITEM_IDSと同一）
const SPAWN_DYNAMICS_IDS = new Set(["toy_rainbow_ball", "interior_stretch_rod", "toy_treasure_puzzle", "other_burebur", "other_xmas_party", "other_pondeomo", "other_pondear", "other_jare_a", "interior_ragby_ar"]);

function rollTreasureOutcome() {
  const total = TREASURE_OUTCOME_WEIGHTS.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of TREASURE_OUTCOME_WEIGHTS) { r -= e.weight; if (r < 0) return e.outcome; }
  return TREASURE_OUTCOME_WEIGHTS[TREASURE_OUTCOME_WEIGHTS.length - 1].outcome;
}
function uniform(min, max) { return min + Math.random() * (max - min); }
function weightOf(id) { return ITEM_SPAWN_WEIGHTS[id] ?? DEFAULT_WEIGHT; }
function clamp1to5(x) { return Math.min(5, Math.max(1, x)); }

function simulateOneRound(lv, catchAll, timeBonusCatchRate = 1) {
  let t = 0;
  let endAt = ROUND_SECONDS * 1000;
  let score = 0;
  let dogCaught = 0;

  let urBoost = 0, urBoostDecayNextAt = 0;
  let otherSuppressUntil = 0, otherSuppressValue = 1;
  let highRarityLockUntil = 0, highRarityLockCount = 0;
  let dogFloodRemaining = 0, poopFloodRemaining = 0, personFloodRemaining = 0, clawdFloodRemaining = 0;
  let nextBonus5 = 0, nextBonus5Value = 0;
  let nextBonus10 = 0, nextBonus10Value = 0;
  let nextMultCount = 0, nextMultValue = 1;
  let rewardTimeCount = 0, rewardTimeValue = 0;
  let multiplier2Until = 0, multiplier2Value = 2;
  let multiplier15Until = 0, multiplier15Value = 1.5;
  let treasureStreakActive = false, treasureStreakMult = 1;
  let omochiUntil = 0, omochiPtValue = 10;
  let nisokuUntil = 0, nisokuMultValue = 3;
  let dogGoldenUntil = 0, dogGoldenPtValue = 0;
  let ikeaUntil = 0, ikeaCount = 0;
  let bagStock = 0;
  let spawnRateBoostUntil = 0, spawnRateBoostValue = 1;
  let narcissistUntil = 0;
  let mafiaDogBonusMult = 1;

  function addBonusTime(sec) { endAt += sec * 1000; }

  function finishIkeaIfDone() {
    if (ikeaUntil > 0 && t >= ikeaUntil) {
      ikeaUntil = 0;
      if (ikeaCount > 0) { score += ikeaCount * IKEA_PT_PER_ITEM; ikeaCount = 0; }
    }
  }

  function runItemSkillEffect(skillId, lvIdx) {
    let points = 0;
    switch (skillId) {
      case "toy_soccer_ball": points += LV.SOCCER_PT[lvIdx]; break;
      case "toy_taiyaki_plush": nextBonus5 += 2; nextBonus5Value = LV.TAIYAKI_PT[lvIdx]; break;
      case "toy_bear_plush": points += LV.BEAR_PT[lvIdx]; break;
      case "toy_duck_plush": addBonusTime(LV.DUCK_SEC[lvIdx]); break;
      case "toy_carrot": addBonusTime(LV.CARROT_SEC[lvIdx]); break;
      case "toy_frisbee": nextMultValue = LV.FRISBEE_MULT[lvIdx]; nextMultCount = 1; break;
      case "food_paw_bowl": nextBonus5 += 3; nextBonus5Value = LV.BOWL_PT[lvIdx]; break;
      case "toy_meat": multiplier15Until = t + LV.MEAT_SEC[lvIdx] * 1000; multiplier15Value = LV.MEAT_MULT[lvIdx]; break;
      case "toy_frenchie_cushion": points += LV.CUSHION_PT[lvIdx]; break;
      case "toy_treasure_puzzle": {
        treasureStreakActive = false;
        const outcome = rollTreasureOutcome();
        if (outcome === "low_pt") points += LV.TREASURE_LOW[lvIdx];
        else if (outcome === "high_pt") points += LV.TREASURE_HIGH[lvIdx];
        else if (outcome === "time_plus") addBonusTime(LV.TREASURE_SEC[lvIdx]);
        else if (outcome === "poop_flood") poopFloodRemaining += TREASURE_POOP_FLOOD_COUNT;
        else if (outcome === "time_minus5") addBonusTime(-TREASURE_MINUS5_SEC);
        else if (outcome === "item_double") { multiplier15Until = t + LV.TREASURE_SEC[lvIdx] * 1000; multiplier15Value = TREASURE_DOUBLE_MULT; }
        else if (outcome === "rare_lock") highRarityLockUntil = t + LV.TREASURE_SEC[lvIdx] * 1000;
        else { treasureStreakActive = true; treasureStreakMult = 1 + LV.TREASURE_STREAK_PCT[lvIdx] / 100; }
        break;
      }
      case "toy_frenchie_plush": nextBonus10 += LV.FRENCHIE_PLUSH_COUNT[lvIdx]; nextBonus10Value = LV.FRENCHIE_PLUSH_PT[lvIdx]; break;
      case "toy_rainbow_ball": urBoost = Math.min(UR_BOOST_MAX, urBoost + LV.RAINBOW_STEP[lvIdx]); urBoostDecayNextAt = t + UR_BOOST_DECAY_INTERVAL_MS; break;
      case "toy_golden_crown_ball": nextMultValue = LV.GOLDEN_MULT[lvIdx]; nextMultCount = LV.GOLDEN_COUNT[lvIdx]; break;
      case "interior_anball": points += LV.ANBALL_PT[lvIdx]; addBonusTime(LV.ANBALL_SEC[lvIdx]); break;
      case "interior_stretch_rod": otherSuppressUntil = t + STRETCH_ROD_SECONDS * 1000; otherSuppressValue = LV.STRETCH_ROD_MULT[lvIdx]; break;
      case "other_burebur": highRarityLockCount = LV.BUREBUR_COUNT[lvIdx]; break;
      case "other_xmas_party":
        multiplier15Until = t + LV.XMAS_SEC[lvIdx] * 1000; multiplier15Value = LV.XMAS_SCORE[lvIdx];
        spawnRateBoostUntil = t + LV.XMAS_SEC[lvIdx] * 1000; spawnRateBoostValue = LV.XMAS_SPAWN[lvIdx];
        dogFloodRemaining += LV.XMAS_DOG_COUNT[lvIdx];
        break;
      case "other_listen_to_the_a": dogFloodRemaining += LV.LISTEN_DOG_COUNT[lvIdx]; break;
      case "other_azubee": multiplier2Until = t + LV.AZUBEE_SEC[lvIdx] * 1000; multiplier2Value = LV.AZUBEE_MULT[lvIdx]; break;
      case "other_omojii": addBonusTime(LV.OMOJII_SEC[lvIdx]); points += LV.OMOJII_PT[lvIdx]; break;
      case "food_paw_pudding": points += LV.PUDDING_PT[lvIdx]; break;
      case "food_kamikami": points += LV.KAMIKAMI_PT[lvIdx]; break;
      case "food_mocchurin": points += LV.MOCCHURIN_PT[lvIdx]; break;
      case "food_paw_melon_bread": addBonusTime(LV.MELON_SEC[lvIdx]); points += LV.MELON_PT[lvIdx]; break;
      case "food_strawberry_roll_cake": nextMultValue = LV.STRAWBERRY_MULT[lvIdx]; nextMultCount = LV.STRAWBERRY_COUNT[lvIdx]; break;
      case "toy_star_wan_wand": { const rem = Math.round(Math.max(0, (endAt - t) / 1000)); points += Math.round(rem * LV.STARWAND_MULT[lvIdx]); break; }
      case "other_hia": { const rem = Math.round(Math.max(0, (endAt - t) / 1000)); points += Math.round(rem * LV.HIA_MULT[lvIdx]); break; }
      case "interior_spring_flower_wreath": multiplier15Until = t + LV.SPRING_SEC[lvIdx] * 1000; multiplier15Value = LV.SPRING_MULT[lvIdx]; break;
      case "other_nisoku_a": nisokuUntil = t + LV.NISOKU_A_SEC[lvIdx] * 1000; nisokuMultValue = LV.NISOKU_A_MULT[lvIdx]; break;
      case "food_fruit_basket": personFloodRemaining += LV.FRUIT_BASKET_COUNT[lvIdx]; break;
      case "other_clawd": clawdFloodRemaining += LV.CLAWD_BALL_COUNT[lvIdx]; break;
      case "other_oyasumi": multiplier15Until = t + OYASUMI_SECONDS * 1000; multiplier15Value = LV.OYASUMI_MULT[lvIdx]; break;
      case "other_omochi_janai": omochiUntil = t + LV.OMOCHI_SEC[lvIdx] * 1000; omochiPtValue = LV.OMOCHI_PT[lvIdx]; break;
      case "other_nakayoshi_azubee": points += LV.NAKAYOSHI_PT[lvIdx]; break;
      case "other_mah": points += LV.MAH_PT[lvIdx]; break;
      case "other_toorematen": dogGoldenUntil = t + LV.TOOREMATEN_SEC[lvIdx] * 1000; dogGoldenPtValue = LV.TOOREMATEN_PT[lvIdx]; break;
      case "other_kamunayo": multiplier15Until = t + LV.KAMUNAYO_SEC[lvIdx] * 1000; multiplier15Value = LV.KAMUNAYO_MULT[lvIdx]; break;
      case "summer_frenchie": addBonusTime(LV.SUMMER_ADD[lvIdx]); multiplier15Until = t + LV.SUMMER_MULTSEC[lvIdx] * 1000; multiplier15Value = LV.SUMMER_MULT[lvIdx]; break;
      case "interior_kinoko_azubee": multiplier15Until = t + LV.KINOKO_SEC[lvIdx] * 1000; multiplier15Value = LV.KINOKO_SCORE[lvIdx]; break;
      case "other_komochi": nextMultValue = LV.KOMOCHI_MULT[lvIdx]; nextMultCount = LV.KOMOCHI_COUNT[lvIdx]; break;
      case "other_azuki": addBonusTime(LV.AZUKI_SEC[lvIdx]); points += LV.AZUKI_PT[lvIdx]; break;
      case "other_kobee": points += LV.KOBEE_PT[lvIdx]; multiplier15Until = t + LV.KOBEE_SEC[lvIdx] * 1000; multiplier15Value = LV.KOBEE_MULT[lvIdx]; break;
      case "other_hamigaki": points += LV.HAMIGAKI_PT[lvIdx]; break;
      case "other_ikea": { const addSec = LV.IKEA_SEC[lvIdx]; const base = t < ikeaUntil ? ikeaUntil : t; ikeaUntil = base + addSec * 1000; break; }
      case "other_pondeomo": spawnRateBoostUntil = t + LV.PONDEOMO_SEC[lvIdx] * 1000; spawnRateBoostValue = LV.PONDEOMO_SPAWN[lvIdx]; break;
      case "other_pondear": spawnRateBoostUntil = t + LV.PONDEAR_SEC[lvIdx] * 1000; spawnRateBoostValue = LV.PONDEAR_SPAWN[lvIdx]; break;
      case "other_jare_a": spawnRateBoostUntil = t + LV.JARE_A_SEC[lvIdx] * 1000; spawnRateBoostValue = LV.JARE_A_SPAWN[lvIdx]; break;
      case "interior_ragby_ar": spawnRateBoostUntil = t + LV.RAGBY_SEC[lvIdx] * 1000; spawnRateBoostValue = LV.RAGBY_SPAWN[lvIdx]; break;
      case "interior_shikkoku_no_ar": multiplier15Until = t + LV.SHIKKOKU_SEC[lvIdx] * 1000; multiplier15Value = LV.SHIKKOKU_MULT[lvIdx]; break;
      case "other_oyatsu_no_jikan": rewardTimeCount = 1; rewardTimeValue = LV.OYATSU_PT[lvIdx]; break;
      case "interior_gold_ball": break; // コイン加算のみ。スコアには含めない
      case "other_narcissist_a": narcissistUntil = Math.max(t, narcissistUntil) + LV.NARCISSIST_SEC[lvIdx] * 1000; break;
      case "other_mafia_a": mafiaDogBonusMult *= LV.MAFIA_MULT[lvIdx]; break;
      default: break; // その他の効果はスコア・秒数に影響しない（磁石・ダンボール拡大・ガード付与・ハザード反転など）
    }
    return points;
  }

  function resolveCatch(entityKind, itemId, rarity, itemLevel) {
    let basePoints;
    if (entityKind === "dog") {
      basePoints = (itemId === "toorematen_golden_dog") ? dogGoldenPtValue : DOG_POINTS;
    } else if (itemId === "mystery_item") {
      basePoints = MYSTERY_BASE_POINTS;
    } else {
      basePoints = POINTS[rarity];
    }
    if (rewardTimeCount > 0) { basePoints = rewardTimeValue; rewardTimeCount -= 1; }

    let pendingBonus = 0;
    if (nextBonus5 > 0) { pendingBonus += nextBonus5Value; nextBonus5 -= 1; }
    if (nextBonus10 > 0) { pendingBonus += nextBonus10Value; nextBonus10 -= 1; }

    const timedMultiplier = t < multiplier2Until ? multiplier2Value : t < multiplier15Until ? multiplier15Value : 1;
    let nextMultiplier = 1;
    if (nextMultCount > 0) { nextMultiplier = nextMultValue; nextMultCount -= 1; if (nextMultCount === 0) nextMultValue = 1; }
    const foodMultiplier = (t < nisokuUntil && FOOD_CATEGORY_IDS.has(itemId ?? "")) ? nisokuMultValue : 1;
    const streakMultiplier = treasureStreakActive ? treasureStreakMult : 1;
    const multiplier = Math.max(timedMultiplier, nextMultiplier, foodMultiplier, streakMultiplier);
    let points = Math.round((basePoints + pendingBonus) * multiplier);

    if (t < ikeaUntil) ikeaCount += 1;

    let skillId = itemId;
    let skillLvIdx = clamp1to5(itemLevel) - 1;
    if (itemId === "mystery_item") {
      skillId = MYSTERY_SKILL_ITEM_IDS[Math.floor(Math.random() * MYSTERY_SKILL_ITEM_IDS.length)];
      skillLvIdx = lv; // フルコンプ想定なので？が選んだアイテムも同じLv扱い
    }
    // ナルシストアー有効中は、捕まえた全アイテムのスキルがレベル5(MAX)として発動する
    if (t < narcissistUntil) skillLvIdx = 4;
    if (skillId) points += runItemSkillEffect(skillId, skillLvIdx);

    if (Math.random() < JUST_CHANCE) points = Math.round(points * JUST_MULTIPLIER);

    score += points;
    if (entityKind === "dog") dogCaught += 1;
  }

  function catchPoop() {
    if (t < omochiUntil) { score += omochiPtValue; }
    else if (bagStock > 0) { bagStock -= 1; }
    else { score = Math.max(0, score - POOP_PENALTY); }
  }

  // 稀に発生しうる暴走（時間増加の連鎖でendAtが際限なく伸びる）でシミュレータ自体が
  // ハングしないための安全弁。到達したら打ち切ってフラグを立てる（実プレイでは起き得ない前提）。
  const MAX_PLAY_SECONDS = 3600;
  let cappedOut = false;
  // frenchie-catch-game.tsxのnextSpawnRef(通常)/extraSpawnRef(ボーナス、時間増加系除外)と
  // 同じく、完全に独立した2本のタイマーとしてスケジュールする。「同一レートの1本を50%で
  // 間引く」近似は、一様分布の間隔をベルヌーイ間引きすると分散が実際より大幅に大きくなり
  // （待ち時間が幾何分布的に伸びるため）、暴走判定に偽陽性を生むことが判明したため採用しない。
  let nextT = 0, nextExtraT = 0;
  while (t < endAt) {
    if (t > MAX_PLAY_SECONDS * 1000) { cappedOut = true; break; }
    while (urBoost > 0 && t >= urBoostDecayNextAt) { urBoost = Math.max(0, urBoost - UR_BOOST_DECAY_STEP); urBoostDecayNextAt += UR_BOOST_DECAY_INTERVAL_MS; }
    finishIkeaIfDone();
    if (spawnRateBoostUntil > 0 && t >= spawnRateBoostUntil) spawnRateBoostUntil = 0;
    if (multiplier2Until > 0 && t >= multiplier2Until) multiplier2Until = 0;
    if (multiplier15Until > 0 && t >= multiplier15Until) multiplier15Until = 0;

    t = Math.min(nextT, nextExtraT);
    if (t >= endAt) break;
    const excludeTimeBonus = nextExtraT <= nextT;

    const spawnRateMult = dogFloodRemaining > 0 ? DOG_FLOOD_RATE
      : poopFloodRemaining > 0 ? POOP_FLOOD_RATE
      : (t < spawnRateBoostUntil ? spawnRateBoostValue : 1);
    const dt = uniform(SPAWN_MIN_MS, SPAWN_MAX_MS) / spawnRateMult;
    if (excludeTimeBonus) nextExtraT = t + dt; else nextT = t + dt;

    if (dogFloodRemaining > 0) { dogFloodRemaining -= 1; resolveCatch("dog", null, null, 0); continue; }
    if (personFloodRemaining > 0) {
      personFloodRemaining -= 1;
      const pid = PERSON_IDS[Math.floor(Math.random() * PERSON_IDS.length)];
      const item = byId.get(pid);
      resolveCatch("item", pid, item.rarity, lv + 1);
      continue;
    }
    if (poopFloodRemaining > 0) { poopFloodRemaining -= 1; catchPoop(); continue; }
    // Clawdのボールは通常アイテムの抽選をブロックせず並行して降る(独立タイマーの近似として、
    // このtickの通常ロールを妨げずに追加の1catchとして処理する)
    if (clawdFloodRemaining > 0) {
      clawdFloodRemaining -= 1;
      const isGold = Math.random() < 0.2;
      const pid = isGold ? "interior_gold_ball" : "toy_soccer_ball";
      const item = byId.get(pid);
      resolveCatch("item", pid, item.rarity, lv + 1);
    }

    const elapsedSec = t / 1000;
    const timeMinusChance = elapsedSec > TIME_MINUS_BOOST_AFTER_SEC
      ? TIME_MINUS_SPAWN_CHANCE * (TIME_MINUS_BOOSTED_WEIGHT / TIME_MINUS_BASE_WEIGHT)
      : TIME_MINUS_SPAWN_CHANCE;
    let cum = 0;
    const u = Math.random();
    // ？アイテムは所持スキルからランダムに時間増加系を引く可能性があるため、ボーナス出現タイマー分は除外する
    const mysteryChance = excludeTimeBonus ? 0 : MYSTERY_SPAWN_CHANCE;
    cum += POOP_SPAWN_CHANCE; if (u < cum) { catchPoop(); continue; }
    cum += mysteryChance; if (u < cum) { resolveCatch("item", "mystery_item", null, 0); continue; }
    cum += BAG_SPAWN_CHANCE;
    if (u < cum) { if (bagStock < BAG_MAX_STOCK) bagStock += 1; continue; }
    cum += timeMinusChance;
    if (u < cum) {
      if (catchAll) endAt -= TIME_MINUS_SECONDS * 1000;
      continue; // avoidモードでは回避する前提のため未キャッチ
    }
    cum += BOX_SHRINK_SPAWN_CHANCE; if (u < cum) continue;
    cum += BLACKOUT_SPAWN_CHANCE; if (u < cum) continue;
    cum += STUN_SPAWN_CHANCE; if (u < cum) continue;
    cum += CHOCOLATE_SPAWN_CHANCE;
    if (u < cum) {
      if (catchAll) endAt = t; // 呪いのチョコレート：キャッチした瞬間ラウンド終了
      continue; // avoidモードでは回避する前提のため未キャッチ
    }

    const otherSuppressActive = t < otherSuppressUntil;
    const treasureRareLockActive = t < highRarityLockUntil;
    const bureburLockActive = highRarityLockCount > 0;
    const highRarityLockActive = treasureRareLockActive || bureburLockActive;
    // 両方同時に有効なら宝箱側(SSR/UR/LR)を優先。ブレブル単体ならUR/LRのみに絞る
    const allowedHighRarities = treasureRareLockActive ? HIGH_RARITY : BUREBUR_RARITY;
    const urBoostFactor = 1 + Math.min(urBoost, UR_BOOST_MAX) / 100;
    const spawnRateBoostActive = t < spawnRateBoostUntil;

    let itemWeightTotal = 0;
    const weights = new Array(pool.length);
    for (let i = 0; i < pool.length; i++) {
      const item = pool[i];
      let w = weightOf(item.id);
      if (item.rarity === "UR") w *= urBoostFactor;
      if (otherSuppressActive && item.id !== "interior_stretch_rod" && OTHER_CATEGORY_IDS.has(item.id)) w *= otherSuppressValue;
      if (highRarityLockActive && !allowedHighRarities.has(item.rarity)) w = 0;
      if (excludeTimeBonus && (TIME_BONUS_IDS.has(item.id) || SPAWN_DYNAMICS_IDS.has(item.id))) w = 0;
      if (spawnRateBoostActive && TIME_BONUS_IDS.has(item.id)) w /= spawnRateBoostValue;
      weights[i] = w;
      itemWeightTotal += w;
    }
    const dogWeight = POOL_SIZE * DEFAULT_WEIGHT * (DOG_SPAWN_RATIO / (1 - DOG_SPAWN_RATIO));
    let roll = Math.random() * (dogWeight + itemWeightTotal);
    if (roll < dogWeight) {
      if (Math.random() < FRENCHIE_SKIN_SPAWN_CHANCE) {
        const skinIds = ["hiking_frenchie", "snow_frenchie", "summer_frenchie"].filter((id) => !(excludeTimeBonus && TIME_BONUS_IDS.has(id)));
        const sid = skinIds[Math.floor(Math.random() * skinIds.length)];
        // 時間増加系(夏のフレブル)はtimeBonusCatchRateの確率でしか実際にはキャッチできない前提
        if (!TIME_BONUS_IDS.has(sid) || Math.random() < timeBonusCatchRate) {
          const item = byId.get(sid);
          resolveCatch("item", sid, item.rarity, lv + 1);
        }
      } else {
        const dogGoldenActive = t < dogGoldenUntil;
        resolveCatch("dog", dogGoldenActive ? "toorematen_golden_dog" : null, null, 0);
      }
      continue;
    }
    roll -= dogWeight;
    let pickedId = pool[pool.length - 1].id;
    for (let i = 0; i < pool.length; i++) { roll -= weights[i]; if (roll <= 0) { pickedId = pool[i].id; break; } }
    if (highRarityLockCount > 0) highRarityLockCount -= 1;
    // 時間増加系7種はtimeBonusCatchRateの確率でしか実際にはキャッチできない前提（見送ると何も起きない）
    if (!TIME_BONUS_IDS.has(pickedId) || Math.random() < timeBonusCatchRate) {
      const item = byId.get(pickedId);
      resolveCatch("item", pickedId, item.rarity, lv + 1);
    }
  }

  const playSeconds = cappedOut ? MAX_PLAY_SECONDS : endAt / 1000;
  score += Math.floor(dogCaught * playSeconds * mafiaDogBonusMult);
  return { score, playSeconds, cappedOut };
}

function percentile(sortedArr, p) {
  return sortedArr[Math.min(sortedArr.length - 1, Math.floor(p * sortedArr.length))];
}

function main() {
  const trials = Number(process.argv[2] ?? 300);
  const mode = process.argv[3] ?? "avoid";
  if (mode !== "avoid" && mode !== "all") throw new Error(`unknown mode: ${mode} (use "avoid" or "all")`);
  const catchAll = mode === "all";
  const timeBonusCatchRate = process.argv[4] !== undefined ? Number(process.argv[4]) : 1;
  console.log(`itemPool N=${POOL_SIZE} / ROUND_SECONDS=${ROUND_SECONDS} / 試行回数=${trials} / モード=${mode}${catchAll ? "（時間減少・チョコレートも100%キャッチ）" : "（時間減少・チョコレートは回避）"} / 時間増加系7種の実キャッチ率=${timeBonusCatchRate}\n`);
  for (let lvIdx = 0; lvIdx < 5; lvIdx++) {
    const scores = [], secs = [];
    let cappedCount = 0;
    for (let i = 0; i < trials; i++) {
      const r = simulateOneRound(lvIdx, catchAll, timeBonusCatchRate);
      scores.push(r.score);
      secs.push(r.playSeconds);
      if (r.cappedOut) cappedCount += 1;
    }
    scores.sort((a, b) => a - b);
    secs.sort((a, b) => a - b);
    const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
    console.log(
      `Lv${lvIdx + 1}: ` +
      `秒数 平均=${mean(secs).toFixed(1)} 中央値=${percentile(secs, 0.5).toFixed(1)} p90=${percentile(secs, 0.9).toFixed(1)} p99=${percentile(secs, 0.99).toFixed(1)} 最大=${secs[secs.length - 1].toFixed(1)} | ` +
      `スコア 平均=${Math.round(mean(scores))} 中央値=${Math.round(percentile(scores, 0.5))} 最小=${Math.round(scores[0])} 最大=${Math.round(scores[scores.length - 1])}` +
      (cappedCount > 0 ? ` | ⚠️安全弁到達=${cappedCount}/${trials}試行` : "")
    );
  }
}

main();
