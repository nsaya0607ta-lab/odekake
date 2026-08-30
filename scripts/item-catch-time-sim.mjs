#!/usr/bin/env node
/**
 * アイテムキャッチ「時間増加系」バランス確認シミュレーター
 * =============================================================
 * `frenchie-catch-game.tsx` のスポーン抽選・キャッチ処理ロジックを
 * ヘッドレスで再現し、モンテカルロシミュレーションで
 * 「フルコンプ・全アイテム同一スキルレベル・時間減少ハザードと
 * チョコレートは一切キャッチしない（避けられる）」という前提での
 * 最終プレイ時間の分布を計算する。
 *
 *   node scripts/item-catch-time-sim.mjs
 *   node scripts/item-catch-time-sim.mjs --trials 20000
 *   node scripts/item-catch-time-sim.mjs --level 5   # Lv5だけ詳しく見る
 *
 * ## なぜこのスクリプトが要るか（2026-08-30の教訓）
 *
 * 以前は `docs/minigame-time-balance.md` に書かれた閉形式の式
 * （per-catch(Lv) × スポーン頻度 = r、最終時間期待値 = 30 / (1 - r)）だけで
 * バランスを判断していたが、これは以下を一切考慮しておらず、実際の分布と
 * 大きく乖離することが判明した：
 *   - 呪いのチョコレート即終了（捕らない前提に切り替えた結果、暗黙の歯止めが消えた）
 *   - 時間減少ハザードの60秒後3倍化
 *   - ビニール袋が満タンのとき抽選枠が時間減少ゾーンに漏れる実装上のクセ
 *   - 虹色わんこボールのUR加算・宝箱のレア枠確定・ブレブルが作る自己強化ループ
 *     （運が良いと同種の効果を連続で引いて雪だるま式に伸びる）
 *   - もっちゅりんのエコー・❓アイテムの一様抽選（**出現重みとは無関係**なので、
 *     重みだけ調整しても❓経由の時間増加は一切減らせない）
 * これらは閉形式の式では原理的に表現できないため、**新アイテムを追加した後は
 * 必ずこのスクリプトを実行して、Lv5の平均が概ね180秒程度に収まっているか
 * 確認すること**（詳細な経緯はdocs/minigame-time-balance.mdの
 * 「2026-08-30 再調整」節を参照）。
 *
 * ## 新アイテムを追加するときにやること
 *
 * アイテムプール（何種類あるか）は`src/lib/collection/items.ts`を毎回自動で読み直すので、
 * 新アイテムをそこに追加しさえすれば、このスクリプト側は何もしなくてもプール総数(N)の
 * 変化を反映する。以下は「時間・出現量・UR優遇・❓アイテムなどに関与するスキル」を
 * 追加・変更したときだけ必要な作業。
 *
 * 1. 下の CONFIG 内の該当箇所（TIME_SEC / ITEM_SPAWN_WEIGHTS / MYSTERY_POOL /
 *    GUARD_ITEMS など）に、`frenchie-catch-game.tsx` に実際に追加した内容と
 *    **完全に同じ値**を追加する（このスクリプトは実装から独立したファイルなので、
 *    値がズレると意味がない）。
 * 2. 時間・出現量・UR優遇・レア枠確定などに関与する新スキルなら、下の
 *    `applySkillEffect` にも対応するcaseを追加する（関与しないなら何もしなくてよい）。
 * 3. `node scripts/item-catch-time-sim.mjs` を実行し、Lv1〜5すべてで単調増加・
 *    Lv5平均が180秒目安から大きく外れていないかを確認する。
 * 4. ズレていたら、まず「時間増加系の秒数」（重みではない。理由は上記）を調整して
 *    再実行する。UR優遇やレア枠確定のような「自己強化ループになりうる」スキルを
 *    新設・強化する場合は、「発動中に同種の効果をもう一度引いて延長・再発動できないか」
 *    を必ず確認すること（できてしまうと分布の裾が異常に重くなる）。
 * 5. 数値を決めたら、このスクリプトの値と `frenchie-catch-game.tsx` /
 *    `src/lib/games/item-catch-skills.ts` の両方に反映し、
 *    `docs/minigame-time-balance.md` にも変更内容と新しい基準値表を追記する。
 */

// ---- CONFIG: frenchie-catch-game.tsx の値をそのまま転記する ----------------

const DEFAULT_W = 100;
const SPECIAL_W = {
  toy_treasure_puzzle: 149,
  other_omojii: 70,
  toy_duck_plush: 102,
  toy_carrot: 102,
  food_paw_melon_bread: 102,
  interior_anball: 102,
  other_azuki: 70,
  summer_frenchie: 102,
  other_listen_to_the_a: 50,
};
const DOG_SPAWN_RATIO = 0.28;

const POOP_SPAWN_CHANCE = 0.04;
const MYSTERY_SPAWN_CHANCE = 0.05;
const BAG_SPAWN_CHANCE = 0.03;
const BAG_MAX_STOCK = 3;
const TIME_MINUS_SPAWN_CHANCE = 0.015;
const TIME_MINUS_BOOSTED_WEIGHT = 300;
const TIME_MINUS_BASE_WEIGHT = 100;
const TIME_MINUS_BOOST_AFTER_SEC = 60;
const TIME_MINUS_SECONDS = 3;
const BOX_SHRINK_SPAWN_CHANCE = 0.02;
const BLACKOUT_SPAWN_CHANCE = 0.01;
const STUN_SPAWN_CHANCE = 0.02;
const CHOCOLATE_SPAWN_CHANCE = 0.002;

/**
 * 「時間減少ハザード」と「チョコレート即終了」は、避けられる（キャッチしない）前提で計算する。
 * 2026-08-30以前は両方とも100%キャッチする前提だったが、実際の判定は箱の受け口に入ったかどうかで
 * 決まるため、プレイヤーは危険なハザードを避けられる。避けられる前提の方が実態に近く、かつ
 * バランス調整の目標値（Lv5平均180秒）もこの前提で決めているため、既定でtrueにしてある。
 * 「100%キャッチする」旧前提で計算したいときだけfalseにすること。
 */
const DODGE_TIME_MINUS_AND_CHOCOLATE = true;

const FRENCHIE_SKIN_IDS = ["hiking_frenchie", "snow_frenchie", "summer_frenchie"];
const FRENCHIE_SKIN_SPAWN_CHANCE = 0.18;
const HIGH_RARITY_LOCK_RARITIES = new Set(["SSR", "UR", "LR"]);

const TIME_BONUS_ITEM_IDS = new Set([
  "toy_duck_plush", "toy_carrot", "food_paw_melon_bread",
  "interior_anball", "other_azuki", "other_omojii", "summer_frenchie",
]);
const TREASURE_ID = "toy_treasure_puzzle";
const TREASURE_SEC = [2, 3, 4, 5, 6];
const TREASURE_MINUS5_SEC = 5;
const TREASURE_OUTCOME_WEIGHTS = [
  ["low_pt", 17], ["high_pt", 10], ["time_plus", 15], ["poop_flood", 10],
  ["time_minus5", 10], ["item_double", 26], ["rare_lock", 4], ["streak_bonus", 8],
];

const RAINBOW_STEP = [3, 4, 5, 6, 8];
const UR_BOOST_MAX = 10;
/** frenchie-catch-game.tsxではミリ秒タイマーの離散チェックだが、シミュレーターでは連続減衰で近似する */
const UR_BOOST_DECAY_PER_SEC = 1 / 0.65; // UR_BOOST_DECAY_STEP(1) / (UR_BOOST_DECAY_INTERVAL_MS(650)/1000)

const STRETCH_ROD_MULT = [0.5, 0.4, 0.3, 0.2, 0.1];
const STRETCH_ROD_SECONDS = 3;
const BUREBUR_COUNT = [2, 3, 3, 4, 5];

const PONDEOMO_SEC = [4, 5, 6, 8, 10], PONDEOMO_SPAWN = [1.5, 1.625, 1.75, 1.875, 2];
const PONDEAR_SEC = [4, 5, 6, 8, 10], PONDEAR_SPAWN = [1.5, 1.625, 1.75, 1.875, 2];
const JARE_A_SEC = [4, 5, 6, 8, 10], JARE_A_SPAWN = [1.5, 1.625, 1.75, 1.875, 2];
const RAGBY_SEC = [5, 6, 7, 9, 12], RAGBY_SPAWN = [2, 2.25, 2.5, 2.75, 3];
const XMAS_SEC = [6, 7, 9, 10, 12], XMAS_SPAWN = [1.5, 1.75, 2, 2.25, 2.5];

const GUARD_ITEMS = [
  "toy_bear_plush", "interior_sleepy_moon", "other_nakayoshi_azubee",
  "other_orusuban", "other_kurumari_a", "other_ketsunade_a", "other_komochi",
];
const GUARD_KINDS = ["stun", "boxShrink", "timeMinus"];

const MOCCHURIN_ID = "food_mocchurin";
/** lv は 0-indexed（lv=3 が「Lv4」）。frenchie-catch-game.tsx の MOCCHURIN_DOUBLE_ECHO_MIN_LV と一致させる */
const MOCCHURIN_DOUBLE_ECHO_MIN_LV = 3;

/** src/lib/games/item-catch-skills.ts の MYSTERY_SKILL_ITEM_IDS と一致させる（57種） */
const MYSTERY_POOL = [
  "toy_soccer_ball", "toy_taiyaki_plush", "toy_bear_plush", "toy_duck_plush", "toy_carrot",
  "toy_frisbee", "food_paw_bowl", "toy_meat", "toy_frenchie_cushion", "toy_treasure_puzzle",
  "toy_frenchie_plush", "toy_rainbow_ball", "toy_golden_crown_ball", "interior_anball", "interior_stretch_rod",
  "other_azubee", "other_omojii", "other_omoi_bashira", "food_paw_pudding", "food_paw_melon_bread", "food_paw_cupcake",
  "toy_paw_macaron", "food_strawberry_roll_cake", "toy_star_wan_wand", "interior_sleepy_moon",
  "interior_spring_flower_wreath", "other_sparkle_rope_crown", "other_nakayoshi_azubee",
  "other_kamunayo", "hiking_frenchie", "snow_frenchie", "summer_frenchie", "interior_kinoko_azubee",
  "other_komochi", "other_azuki", "other_kobee", "other_hamigaki", "other_ikea", "other_orusuban",
  "other_pondeomo", "other_pondear", "other_kurumari_a", "other_jare_a", "other_ketsunade_a", "other_omochi_janai", "other_oyasumi", "other_nisoku_a",
  "interior_shikkoku_no_ar", "interior_ragby_ar", "other_oyatsu_no_jikan", "other_listen_to_the_a", "other_okaeri",
  "food_fruit_basket", "interior_gold_ball", "other_clawd", "food_kamikami", "food_mocchurin",
];

/** 時間増加系7種＋宝箱。frenchie-catch-game.tsxのLVオブジェクトと一致させる（0-indexed、[Lv1,Lv2,Lv3,Lv4,Lv5]） */
const TIME_SEC = {
  toy_duck_plush: [2, 3, 4, 5, 6],
  toy_carrot: [2, 3, 4, 5, 7],
  food_paw_melon_bread: [2, 3, 4, 5, 6],
  interior_anball: [2, 3, 4, 5, 6],
  other_azuki: [3, 5, 6, 7, 8],
  other_omojii: [4, 7, 9, 10, 11],
  summer_frenchie: [3, 4, 5, 6, 7],
};

// ---- ここまでCONFIG。以下はシミュレーション本体（通常は変更不要） ------------

/**
 * フルコンプ時のアイテムプール（N=83、2026-08-30時点）を、
 * src/lib/collection/items.ts のロジック（series===null || art!==undefined）に基づき再構成したもの。
 * 新アイテムを追加した場合は、ここに { id, rarity, category } を1行追加する。
 * rarityは POINTS/RARITY_FALL_SPEED の分岐には影響しない（時間シミュレーションでは未使用）ため省略可だが、
 * UR加算(urBoostFactor)とレア枠確定(highRarityLock)の判定に rarity は必須。categoryは「その他」抑制
 * （のびのびロッド）の判定に必須。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * `src/lib/collection/items.ts` を直接パースして、フルコンプ時のアイテムプール
 * （ミニゲームの`itemPool`と同じ条件：画像あり、かつ series===null || art持ち）を毎回作り直す。
 * キャッシュは持たない（items.tsに新アイテムを追加すれば、このスクリプトは何もしなくても
 * 自動的にプールに反映される）。
 */
function loadPool() {
  const itemsSrcPath = join(__dirname, "..", "src", "lib", "collection", "items.ts");
  const src = readFileSync(itemsSrcPath, "utf8");
  const objRe = /\{\s*id:\s*"([a-zA-Z0-9_]+)"[^}]*?\}/g;
  const items = [];
  let m;
  while ((m = objRe.exec(src))) {
    const block = m[0];
    const idm = block.match(/id:\s*"([a-zA-Z0-9_]+)"/);
    const imgm = block.match(/image:\s*(null|"[^"]*")/);
    const seriesm = block.match(/series:\s*(null|"[a-zA-Z0-9_]+")/);
    const artm = block.match(/art:\s*"([a-zA-Z0-9_]+)"/);
    const rarm = block.match(/rarity:\s*"([A-Z]+)"/);
    const catm = block.match(/category:\s*"([a-zA-Z]+)"/);
    items.push({
      id: idm ? idm[1] : null,
      image: imgm ? imgm[1] : null,
      series: seriesm ? seriesm[1] : null,
      art: artm ? artm[1] : null,
      rarity: rarm ? rarm[1] : null,
      category: catm ? catm[1] : "other",
    });
  }
  return items
    .filter((it) => it.image && it.image !== "null" && (it.series === "null" || it.art))
    .map((it) => ({ id: it.id, rarity: it.rarity, category: it.category }));
}

const items = loadPool();
const N = items.length;
const dogWeight = N * DEFAULT_W * (DOG_SPAWN_RATIO / (1 - DOG_SPAWN_RATIO));

function applySkillEffect(state, itemId, lv) {
  if (TIME_SEC[itemId]) {
    state.endAt += TIME_SEC[itemId][lv];
    return;
  }
  switch (itemId) {
    case TREASURE_ID: {
      const outcome = rollTreasureOutcome();
      if (outcome === "time_plus") state.endAt += TREASURE_SEC[lv];
      else if (outcome === "time_minus5") state.endAt -= TREASURE_MINUS5_SEC;
      else if (outcome === "rare_lock") state.highRarityLockUntil = Math.max(state.highRarityLockUntil, state.now + TREASURE_SEC[lv]);
      return;
    }
    case "toy_rainbow_ball":
      state.urBoost = Math.min(UR_BOOST_MAX, state.urBoost + RAINBOW_STEP[lv]);
      return;
    case "interior_stretch_rod":
      state.otherSuppressUntil = state.now + STRETCH_ROD_SECONDS;
      state.otherSuppressValue = STRETCH_ROD_MULT[lv];
      return;
    case "other_burebur":
      state.highRarityLockCount += BUREBUR_COUNT[lv];
      return;
    case "other_pondeomo":
      state.spawnRateBoostUntil = state.now + PONDEOMO_SEC[lv]; state.spawnRateBoostValue = PONDEOMO_SPAWN[lv]; return;
    case "other_pondear":
      state.spawnRateBoostUntil = state.now + PONDEAR_SEC[lv]; state.spawnRateBoostValue = PONDEAR_SPAWN[lv]; return;
    case "other_jare_a":
      state.spawnRateBoostUntil = state.now + JARE_A_SEC[lv]; state.spawnRateBoostValue = JARE_A_SPAWN[lv]; return;
    case "interior_ragby_ar":
      state.spawnRateBoostUntil = state.now + RAGBY_SEC[lv]; state.spawnRateBoostValue = RAGBY_SPAWN[lv]; return;
    case "other_xmas_party":
      state.spawnRateBoostUntil = state.now + XMAS_SEC[lv]; state.spawnRateBoostValue = XMAS_SPAWN[lv]; return;
    default:
      if (GUARD_ITEMS.includes(itemId)) {
        const candidates = GUARD_KINDS.filter((k) => !state.guard[k]);
        if (candidates.length > 0) state.guard[candidates[Math.floor(Math.random() * candidates.length)]] = true;
      }
      return; // 得点のみ・他の非時間系効果は本シミュレーションの対象外
  }
}

function rollTreasureOutcome() {
  const total = TREASURE_OUTCOME_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  for (const [name, w] of TREASURE_OUTCOME_WEIGHTS) { roll -= w; if (roll < 0) return name; }
  return TREASURE_OUTCOME_WEIGHTS[TREASURE_OUTCOME_WEIGHTS.length - 1][0];
}

function handleRealCatch(state, itemId, lv) {
  applySkillEffect(state, itemId, lv);
  if (itemId === MOCCHURIN_ID) {
    const echoCount = lv >= MOCCHURIN_DOUBLE_ECHO_MIN_LV ? 2 : 1;
    const targets = state.lastCatches.slice(0, echoCount);
    for (const t of targets) applySkillEffect(state, t.itemId, t.level);
  } else {
    state.lastCatches = [{ itemId, level: lv }, ...state.lastCatches].slice(0, 2);
  }
}

function simulateOne(lv) {
  const state = {
    now: 0, endAt: 30,
    urBoost: 0,
    otherSuppressUntil: 0, otherSuppressValue: 1,
    highRarityLockUntil: 0, highRarityLockCount: 0,
    spawnRateBoostUntil: 0, spawnRateBoostValue: 1,
    bagStock: 0,
    guard: { stun: false, boxShrink: false, timeMinus: false },
    lastCatches: [],
  };
  let iterations = 0;
  while (state.now < state.endAt) {
    iterations++;
    if (iterations > 300_000) break; // 安全弁（現実的な理論値では届かない想定）

    const spawnBoostActive = state.now < state.spawnRateBoostUntil;
    const effRate = spawnBoostActive ? state.spawnRateBoostValue : 1;
    const interval = (0.65 + Math.random() * 0.13) / effRate;
    state.now += interval;
    if (state.urBoost > 0) state.urBoost = Math.max(0, state.urBoost - UR_BOOST_DECAY_PER_SEC * interval);
    if (state.now >= state.endAt) break;

    const hazardRoll = Math.random();
    const timeMinusChance = TIME_MINUS_SPAWN_CHANCE * (state.now > TIME_MINUS_BOOST_AFTER_SEC ? TIME_MINUS_BOOSTED_WEIGHT / TIME_MINUS_BASE_WEIGHT : 1);
    const poopThresh = POOP_SPAWN_CHANCE;
    const mysteryThresh = poopThresh + MYSTERY_SPAWN_CHANCE;
    const bagThresh = mysteryThresh + BAG_SPAWN_CHANCE;
    const timeMinusThresh = bagThresh + timeMinusChance;
    const shrinkThresh = timeMinusThresh + BOX_SHRINK_SPAWN_CHANCE;
    const blackoutThresh = shrinkThresh + BLACKOUT_SPAWN_CHANCE;
    const stunThresh = blackoutThresh + STUN_SPAWN_CHANCE;
    const chocolateThresh = stunThresh + CHOCOLATE_SPAWN_CHANCE;

    if (hazardRoll < poopThresh) { if (state.bagStock > 0) state.bagStock--; continue; }
    if (hazardRoll < mysteryThresh) {
      const resolvedId = MYSTERY_POOL[Math.floor(Math.random() * MYSTERY_POOL.length)];
      if (resolvedId === MOCCHURIN_ID) {
        const echoCount = lv >= MOCCHURIN_DOUBLE_ECHO_MIN_LV ? 2 : 1;
        const targets = state.lastCatches.slice(0, echoCount);
        for (const t of targets) applySkillEffect(state, t.itemId, t.level);
      } else {
        applySkillEffect(state, resolvedId, lv);
        state.lastCatches = [{ itemId: resolvedId, level: lv }, ...state.lastCatches].slice(0, 2);
      }
      continue;
    }
    if (hazardRoll < bagThresh) {
      if (state.bagStock < BAG_MAX_STOCK) { state.bagStock++; continue; }
      // 満タンならこのまま次のif（時間減少ゾーン）にフォールスルーする（実装のクセを再現）
    }
    if (hazardRoll < timeMinusThresh) {
      if (DODGE_TIME_MINUS_AND_CHOCOLATE) { continue; }
      if (state.guard.timeMinus) { state.guard.timeMinus = false; }
      else state.endAt -= TIME_MINUS_SECONDS;
      if (state.endAt <= state.now) { state.endAt = state.now; break; }
      continue;
    }
    if (hazardRoll < shrinkThresh) { if (state.guard.boxShrink) state.guard.boxShrink = false; continue; }
    if (hazardRoll < blackoutThresh) { continue; }
    if (hazardRoll < stunThresh) { if (state.guard.stun) state.guard.stun = false; continue; }
    if (hazardRoll < chocolateThresh) {
      if (DODGE_TIME_MINUS_AND_CHOCOLATE) { continue; }
      state.endAt = state.now;
      break;
    }

    const urBoostFactor = 1 + Math.min(state.urBoost, UR_BOOST_MAX) / 100;
    const otherSuppressActive = state.now < state.otherSuppressUntil;
    const highRarityLockActive = state.now < state.highRarityLockUntil || state.highRarityLockCount > 0;
    const spawnRateBoostActiveForTime = state.now < state.spawnRateBoostUntil;

    let itemWeightTotal = 0;
    const weights = new Array(items.length);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      let w = SPECIAL_W[it.id] ?? DEFAULT_W;
      if (it.rarity === "UR") w *= urBoostFactor;
      if (otherSuppressActive && it.id !== "interior_stretch_rod" && it.category === "other") w *= state.otherSuppressValue;
      if (highRarityLockActive && !HIGH_RARITY_LOCK_RARITIES.has(it.rarity)) w = 0;
      if (spawnRateBoostActiveForTime && TIME_BONUS_ITEM_IDS.has(it.id)) w /= state.spawnRateBoostValue;
      weights[i] = w;
      itemWeightTotal += w;
    }

    let roll = Math.random() * (dogWeight + itemWeightTotal);
    if (roll < dogWeight) {
      if (Math.random() < FRENCHIE_SKIN_SPAWN_CHANCE) {
        const skin = FRENCHIE_SKIN_IDS[Math.floor(Math.random() * FRENCHIE_SKIN_IDS.length)];
        handleRealCatch(state, skin, lv);
      }
      continue;
    }
    roll -= dogWeight;
    let chosen = items[items.length - 1];
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll <= 0) { chosen = items[i]; break; }
    }
    if (state.highRarityLockCount > 0) state.highRarityLockCount -= 1;
    handleRealCatch(state, chosen.id, lv);
  }
  return state.endAt;
}

function summarize(times) {
  const n = times.length;
  const sorted = [...times].sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / n;
  const pct = (p) => sorted[Math.min(n - 1, Math.floor(p * n))];
  return {
    mean,
    median: pct(0.5),
    p90: pct(0.9),
    p99: pct(0.99),
    max: sorted[n - 1],
  };
}

function main() {
  const args = process.argv.slice(2);
  const trialsArg = args.indexOf("--trials");
  const trials = trialsArg >= 0 ? parseInt(args[trialsArg + 1], 10) : 3000;
  const levelArg = args.indexOf("--level");
  const onlyLevel = levelArg >= 0 ? parseInt(args[levelArg + 1], 10) : null;

  console.log(`図鑑プール N=${N}、試行回数=${trials}、避ける前提=${DODGE_TIME_MINUS_AND_CHOCOLATE ? "時間減少+チョコレート" : "なし(100%キャッチ)"}\n`);
  console.log("Lv | 平均(秒) | 中央値 | p90 | p99 | 最大(観測)");
  console.log("---|---|---|---|---|---");
  let prevMean = 0;
  for (let lv = 0; lv < 5; lv++) {
    if (onlyLevel && lv !== onlyLevel - 1) continue;
    const times = [];
    for (let i = 0; i < trials; i++) times.push(simulateOne(lv));
    const s = summarize(times);
    const warn = s.mean < prevMean ? "  ← 前レベルより短い！単調増加を確認すること" : "";
    console.log(`Lv${lv + 1} | ${s.mean.toFixed(1)} | ${s.median.toFixed(1)} | ${s.p90.toFixed(1)} | ${s.p99.toFixed(1)} | ${s.max.toFixed(1)}${warn}`);
    prevMean = s.mean;
  }
  console.log("\n目安: Lv5(MAX)の平均が概ね180秒程度（大幅に超過・下回っていないか）。");
  console.log("経緯・詳細はdocs/minigame-time-balance.mdの「2026-08-30 再調整」節を参照。");
}

main();
