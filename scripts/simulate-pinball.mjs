#!/usr/bin/env node
/**
 * ご当地ピンボールのシミュレーター
 * =============================================================
 * 本番と同じ物理・ルール（src/lib/games/pinball/*.ts）を Node でそのまま動かし、
 * 人に近い打ち方をするボットに何ゲームも遊ばせて、1プレイの長さ・得点・赤コインの分布を測る。
 * 台の形や数字を変えたら、これで確かめてから docs/pinball.md の結果を更新すること。
 *
 * 使い方（マップは maps.ts の id。"all" で全部のマップ、書かなければ いつもの台＝default）:
 *   node scripts/simulate-pinball.mjs [ゲーム数(既定300)] [beginner|average|good|all(既定)] [持っているアイテム数(既定8)] [マップ]
 *   node scripts/simulate-pinball.mjs shotmap [マップ]          … フリッパーのどこで打つとどこへ飛ぶか（台の形の確認）
 *   node scripts/simulate-pinball.mjs plunger [マップ]          … 打ち出しの強さごとに、玉が最初に通るところ
 *   node scripts/simulate-pinball.mjs stuck [ゲーム数] [マップ] … 玉が止まってしまう場所（形を変えたら、ここに何も出ないことを確かめる）
 *   node scripts/simulate-pinball.mjs gaps [マップ]             … 動かない部品どうしの 14〜31mm のすき間（玉がはさまりやすい。いつもの台にもあるものはのぞく）
 *   node scripts/simulate-pinball.mjs stagefuzz [ステージ数] [ゲーム数] … でたらめに作ったステージ（エディターで作れる形）で玉が止まらないか
 *   node scripts/simulate-pinball.mjs stagebalance [ステージ数] [ゲーム数] [腕前] … でたらめなステージで、赤コインをどれくらい稼げるか
 * マップのかわりに stage:starter（はじめのステージ）・stage:<JSON のファイル>（自分で作るステージ）も使える。
 * 持っているアイテムは ALL_ITEMS の前から（8 = 岐阜県の N〜SSR）。図鑑ボーナスは全部の県のうち何種類持っているか。
 *
 * ボットの腕前（SKILLS）は「ふつう」を、ピンボールを少し遊んだことがある人くらいにしてある：
 *   反応のばらつき（秒）・何もしないで見送ってしまう確率・玉を止めて狙う確率・狙いのずれ（mm）
 * Node 22.18 以上（TypeScript の型をそのまま外して読み込める版）が必要。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// "@/..." と拡張子なしの import を src/ の .ts へ向ける（Next.js と同じ解決のしかた）
const loader = `
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
const SRC = ${JSON.stringify(path.join(ROOT, "src"))};
export async function resolve(specifier, context, next) {
  let spec = specifier;
  if (spec.startsWith("@/")) spec = pathToFileURL(path.join(SRC, spec.slice(2))).href;
  const rel = spec.startsWith("./") || spec.startsWith("../");
  const file = spec.startsWith("file://");
  if ((rel || file) && !path.extname(spec) && context.parentURL) {
    const base = file ? fileURLToPath(spec) : path.resolve(path.dirname(fileURLToPath(context.parentURL)), spec);
    for (const ext of [".ts", ".tsx", "/index.ts"]) if (existsSync(base + ext)) return next(pathToFileURL(base + ext).href, context);
  }
  return next(spec, context);
}`;
register(`data:text/javascript,${encodeURIComponent(loader)}`);
process.removeAllListeners("warning");

const load = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const G = await load("src/lib/games/pinball/game.ts");
const P = await load("src/lib/games/pinball/physics.ts");
const T = await load("src/lib/games/pinball/table.ts");
const C = await load("src/lib/games/pinball/config.ts");
const S = await load("src/lib/games/pinball/skills.ts");
const M = await load("src/lib/games/pinball/maps.ts");
const I = await load("src/lib/games/pinball/items.ts");
const ST = await load("src/lib/games/pinball/stage.ts");

/* ---------- 台 ---------- */

/**
 * 台の形。マップの id か、自分で作るステージ（"stage:starter" ＝はじめのステージ、"stage:<JSON のファイル>"）。
 * ステージは validateStage を通らないものは使わない（エディターで作れない形は、確かめても意味がないので）
 */
const stageTables = new Map();
function tableFor(id) {
  if (!id.startsWith("stage:")) return M.getPinballTable(id);
  const cached = stageTables.get(id);
  if (cached) return cached;
  const src = id.slice(6);
  const spec = src === "starter" ? ST.starterStage() : ST.parseStageSpec(JSON.parse(readFileSync(src, "utf8")));
  if (!spec) throw new Error(`${src} はステージの形になっていません`);
  const issues = ST.validateStage(spec);
  if (issues.length) throw new Error(`${src} は置き方に問題があります：${issues.map((i) => i.message).join(" / ")}`);
  const table = ST.buildStageTable(spec);
  stageTables.set(id, table);
  return table;
}
const tableLabel = (id) => (id === M.DEFAULT_MAP_ID ? "" : id.startsWith("stage:") ? `ステージ ${id.slice(6)}・` : `マップ ${id}・`);

/* ---------- ボット ---------- */

const SKILLS = {
  beginner: { reaction: 0.045, miss: 0.16, catch: 0.0, aim: 14, skillTry: 0.1, plungeSigma: 0.06 },
  average: { reaction: 0.028, miss: 0.07, catch: 0.3, aim: 9, skillTry: 0.35, plungeSigma: 0.035 },
  good: { reaction: 0.016, miss: 0.025, catch: 0.75, aim: 5, skillTry: 0.75, plungeSigma: 0.02 },
};
/** スキルショットのレーンに入りやすい引き量 */
const LANE_POWER = C.SKILL_SHOT_POWER;
/** 玉の速さ（ふだんは config.ts の GAME_SPEED。PINBALL_SPEED=0.7 のように変えて試せる） */
const SPEED = Number(process.env.PINBALL_SPEED) || C.GAME_SPEED;
/** 止めた玉を落としてから打つとき、フリッパーのどこ（支点からの距離 mm）で打つとどこへ行くか */
const AIM_ALONG = { center: 32, ramp: 62, orbit: 71 };

function gauss(rand) {
  const u = Math.max(1e-9, rand());
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function flipperFrame(f, side, b) {
  const ux = Math.cos(f.def.rest);
  const uy = Math.sin(f.def.rest);
  const nx = side === 0 ? uy : -uy;
  const ny = side === 0 ? -ux : ux;
  const dx = b.x - f.def.pivot.x;
  const dy = b.y - f.def.pivot.y;
  return { along: dx * ux + dy * uy, height: dx * nx + dy * ny, vn: b.vx * nx + b.vy * ny, va: b.vx * ux + b.vy * uy };
}

function makeBot(skill, rand) {
  return {
    skill,
    rand,
    plungeAt: -1,
    side: [
      { holdUntil: 0, flipAt: -1, mode: "idle", decided: -1, aimAlong: 0, releasedAt: 0, settledAt: 0 },
      { holdUntil: 0, flipAt: -1, mode: "idle", decided: -1, aimAlong: 0, releasedAt: 0, settledAt: 0 },
    ],
  };
}

function botStep(g, bot) {
  const { skill, rand } = bot;
  const now = g.clock;
  // 打ち出し
  if (G.canLaunch(g)) {
    if (bot.plungeAt < 0) bot.plungeAt = now + 0.5 + rand() * 1.2;
    else if (now >= bot.plungeAt) {
      const power = g.phase === "serve" && g.skillLane >= 0 && rand() < skill.skillTry
        ? LANE_POWER[g.skillLane] + gauss(rand) * skill.plungeSigma
        : 0.72 + rand() * 0.28;
      G.launch(g, power);
      bot.plungeAt = -1;
    }
  } else {
    bot.plungeAt = -1;
  }

  for (const side of [0, 1]) {
    const f = g.world.flippers[side];
    const st = bot.side[side];
    let press = now < st.holdUntil;
    // いちばん近い玉
    let best = null;
    for (const b of g.world.balls) {
      if (b.mode !== "field") continue;
      const fr = flipperFrame(f, side, b);
      if (fr.along < 8 || fr.along > 92 || fr.height > 120 || fr.height < -10) continue;
      if (!best || fr.height < best.fr.height) best = { b, fr };
    }
    if (!best) {
      if (st.mode !== "idle" && now > st.holdUntil) st.mode = "idle";
      st.decided = -1;
      G.setFlipper(g, side, press);
      continue;
    }
    const { fr, b } = best;
    const speed = Math.hypot(b.vx, b.vy);

    if (st.mode === "cradle") {
      // 止めている：落ち着いたら、狙いを決めて落とす
      press = true;
      if (speed < 40) {
        if (!st.settledAt) st.settledAt = now;
        if (now - st.settledAt > 0.35 + rand() * 0.4) {
          const targets = aimTargets(g, side);
          st.aimAlong = targets[Math.floor(rand() * targets.length)] + gauss(rand) * skill.aim;
          st.mode = "dropShot";
          st.releasedAt = now;
          press = false;
        }
      } else {
        st.settledAt = 0;
      }
    } else if (st.mode === "dropShot") {
      press = false;
      if (fr.along >= st.aimAlong && fr.height < 40) {
        st.mode = "idle";
        st.holdUntil = now + 0.22 + rand() * 0.12;
        press = true;
      } else if (now - st.releasedAt > 0.8) {
        st.mode = "idle";
      }
    } else if (st.decided < 0 && fr.height < 90 && (fr.vn < -50 || speed < 600)) {
      // 新しく玉が来た：見送る？ 止める？ 打つ？
      const r = rand();
      st.decided = now;
      if (r < skill.miss) st.mode = "miss";
      else if (rand() < skill.catch && speed < 2600) st.mode = "catch";
      else {
        st.mode = "hit";
        st.flipAt = -1;
        st.aimAlong = 30 + rand() * 45 + gauss(rand) * skill.aim * 0.5;
      }
    }

    if (st.mode === "catch") {
      // 当たる少し前に上げて、そのまま持つ
      // 当たるまでの時間は台の上の時間。人の反応のばらつき（実際の秒）は、玉が遅いぶん台の上では小さくなる
      const ttc = fr.vn < -1 ? (fr.height - 24) / -fr.vn : 0;
      if (ttc < 0.12 + gauss(rand) * skill.reaction * g.speed) {
        press = true;
        st.mode = "cradle";
        st.settledAt = 0;
      }
    } else if (st.mode === "hit") {
      const onIt = fr.height < 34;
      const ttc = fr.vn < -1 ? (fr.height - 24) / -fr.vn : 99;
      if ((onIt && (fr.along >= st.aimAlong || fr.along > 78)) || (!onIt && ttc < 0.01 && fr.along > 25)) {
        if (st.flipAt < 0) st.flipAt = now + Math.max(0, Math.abs(gauss(rand)) * skill.reaction);
      }
      if (st.flipAt >= 0 && now >= st.flipAt) {
        st.holdUntil = now + 0.18 + rand() * 0.15;
        press = true;
        st.mode = "idle";
        st.flipAt = -1;
      }
    }
    if (st.mode === "idle" && st.decided >= 0 && now - st.decided > 0.5 && now > st.holdUntil) st.decided = -1;
    if (st.mode === "miss" && now - st.decided > 0.6) {
      st.mode = "idle";
      st.decided = -1;
    }
    G.setFlipper(g, side, press);
  }
}

/** 狙う場所（浮かんでいるアイテム・ジャックポットを優先）。アイテムの場所を通るショットは、台の itemSpots の shot */
function aimTargets(g, side) {
  const cross = side === 0 ? ["rightRamp", "rightOrbit"] : ["leftRamp", "leftOrbit"];
  const lit = new Set();
  for (const l of g.lit) {
    const shot = g.world.table.itemSpots[l.spot]?.shot;
    if (shot) lit.add(shot);
  }
  for (const id of T.SHOT_IDS) if (g.jackpots[id]) lit.add(id);
  if (g.superLit) lit.add("scoop");
  // スキルが効いているあいだは、人もそこを狙う（マグネット＝ガチャ穴、ジャックポット予約＝ランプ）
  if (g.clock < g.magnetUntil) lit.add("scoop");
  if (g.reserves.length) lit.add(side === 0 ? "rightRamp" : "leftRamp");
  const want = [...lit].filter((id) => cross.includes(id) || id === "scoop");
  const pick = want.length ? want : [...cross, "scoop"];
  return pick.map((id) => (id === "scoop" ? AIM_ALONG.center : id.endsWith("Ramp") ? AIM_ALONG.ramp : AIM_ALONG.orbit));
}

/* ---------- 1ゲーム ---------- */

/** アイテムのLv（ふだんは Lv1〜3 のランダム。PINBALL_LV=5 のように決めて試せる） */
const FIXED_LV = Number(process.env.PINBALL_LV) || 0;
/** 限界突破の★（Lv5 のときだけ。PINBALL_STARS=5 のように決めて試せる） */
const FIXED_STARS = Number(process.env.PINBALL_STARS) || 0;

/**
 * 持っているアイテムの並び。前から n 個を持っていることにする（8 = 岐阜県の N〜SSR、18 = 岐阜県の全部、
 * そのあとにほかの県のアイテムが続く。全部で ALL_ITEMS.length 種）。岐阜県を先にしてあるのは、前の結果と比べられるように
 */
const GIFU_ITEMS = [
  ["gifu_gohei_mochi", "五平餅", "N"], ["gifu_meiho_ham", "明宝ハム", "N"], ["gifu_keichan", "鶏ちゃん", "R"],
  ["gifu_kuri_kinton", "栗きんとん", "R"], ["gifu_ayu", "鮎", "R"], ["gifu_minoyaki", "美濃焼", "SR"],
  ["gifu_seki_hamono", "関の刃物", "SR"], ["gifu_gero_onsen", "下呂温泉", "SSR"], ["gifu_hida_takayama", "飛騨高山の古い町並み", "SSR"],
  ["gifu_hida_beef", "飛騨牛", "UR"], ["gifu_shinhotaka", "新穂高ロープウェイ", "UR"], ["gifu_shirakawago", "白川郷・合掌造り", "LR"],
  ["gifu_shirakawa_tea", "白川茶", "N"], ["gifu_hoba_miso", "朴葉味噌", "N"], ["gifu_mino_washi", "美濃和紙", "R"],
  ["gifu_gujo_hachiman", "郡上八幡", "SR"], ["gifu_nagara_ukai", "長良川鵜飼", "SSR"], ["gifu_gifu_castle", "岐阜城・金華山", "UR"],
];
const ALL_ITEMS = [
  ...GIFU_ITEMS,
  ...I.pinballItems()
    .filter((item) => !GIFU_ITEMS.some(([id]) => id === item.id))
    .map((item) => [item.id, item.name, item.rarity]),
];

function samplePool(n, rand) {
  return ALL_ITEMS.slice(0, n).map(([id, name, rarity]) => {
    let level = 0;
    if (rarity !== "N") {
      const roll = 1 + Math.floor(rand() * 3);
      level = FIXED_LV || roll;
    }
    const stars = level >= 5 ? FIXED_STARS : 0;
    return { id, name, rarity, level, stars, skill: S.getPinballSkill(id, name, rarity, level, stars), image: null };
  });
}

function playGame(skillName, seed, poolSize, mapId = M.DEFAULT_MAP_ID, table = tableFor(mapId)) {
  const rand = P.mulberry32(seed * 7919 + 13);
  // 図鑑ボーナスは、台に出るご当地アイテム（全部の県）のうち何種類持っているか（0種は 1 倍）
  const zukan = C.zukanBonus(poolSize, ALL_ITEMS.length);
  const g = G.createGame({ table, pool: samplePool(poolSize, rand), tableName: "岐阜県", zukan, seed, speed: SPEED });
  const bot = makeBot(SKILLS[skillName], rand);
  const ballTimes = [];
  let ballStart = 0;
  let lastBall = 1;
  let outlanes = 0;
  let centers = 0;
  for (let frame = 0; frame < 60 * 60 * 30 && g.phase !== "over"; frame += 1) {
    botStep(g, bot);
    G.stepGame(g, 1 / 60);
    for (const fx of G.takeFx(g)) {
      if (fx.type === "sfx" && fx.id === "outlane") outlanes += 1;
    }
    if (g.ball !== lastBall) {
      ballTimes.push(g.clock - ballStart);
      ballStart = g.clock;
      lastBall = g.ball;
    }
  }
  ballTimes.push(g.clock - ballStart);
  return {
    time: g.playTime,
    score: g.score,
    items: g.stats.items,
    conquests: g.conquests,
    coins: C.coinsForScore(g.score),
    saves: g.stats.saves,
    jackpots: g.stats.jackpots,
    scoops: g.stats.scoops,
    ramps: g.stats.ramps,
    orbits: g.stats.orbits,
    bumpers: g.stats.bumpers,
    skillShots: g.stats.skillShots,
    outlanes,
    centers,
  };
}

function stats(values) {
  const v = [...values].sort((a, b) => a - b);
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  const mean = v.reduce((s, x) => s + x, 0) / v.length;
  return { mean, p10: q(0.1), p50: q(0.5), p90: q(0.9) };
}

function fmt(n, digits = 0) {
  return n.toLocaleString("ja-JP", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function runGames(count, skillName, poolSize, mapId = M.DEFAULT_MAP_ID) {
  const rows = [];
  for (let i = 0; i < count; i += 1) rows.push(playGame(skillName, i + 1, poolSize, mapId));
  const col = (k) => stats(rows.map((r) => r[k]));
  const t = col("time");
  const sc = col("score");
  const coins = col("coins");
  const zukan = C.zukanBonus(poolSize, ALL_ITEMS.length);
  console.log(`\n=== ${skillName}（${tableLabel(mapId)}${count}ゲーム・アイテム${poolSize}種${FIXED_LV ? `・Lv${FIXED_LV}` : ""}${FIXED_STARS ? `・★${FIXED_STARS}` : ""}・図鑑×${zukan}・玉の速さ ${SPEED}）===`);
  console.log(`プレイ時間  平均 ${fmt(t.mean, 1)}秒  中央 ${fmt(t.p50, 1)}  10% ${fmt(t.p10, 1)}  90% ${fmt(t.p90, 1)}`);
  console.log(`スコア      平均 ${fmt(sc.mean)}  中央 ${fmt(sc.p50)}  10% ${fmt(sc.p10)}  90% ${fmt(sc.p90)}`);
  console.log(`赤コイン    平均 ${fmt(coins.mean, 1)}枚  中央 ${fmt(coins.p50)}  10% ${fmt(coins.p10)}  90% ${fmt(coins.p90)}`);
  const per = (k) => fmt(col(k).mean, 2);
  console.log(`1ゲームあたり  アイテム ${per("items")}  県制覇 ${per("conquests")}  ジャックポット ${per("jackpots")}  ランプ ${per("ramps")}  オービット ${per("orbits")}  スキルショット ${per("skillShots")}  ガチャ穴 ${per("scoops")}  ボールセーブ ${per("saves")}  アウトレーン ${per("outlanes")}  バンパー ${per("bumpers")}`);
  const conquered = rows.filter((r) => r.conquests > 0).length;
  console.log(`県制覇できたゲーム ${fmt((conquered / count) * 100, 1)}%`);
  return rows;
}

/* ---------- 台の確認 ---------- */

function shotmap(mapId) {
  const table = tableFor(mapId);
  for (const side of ["left", "right"]) {
    const fi = side === "left" ? 0 : 1;
    const start = side === "left" ? { x: 64, y: 760 } : { x: 416, y: 760 };
    console.log(`\n=== ${side === "left" ? "左" : "右"}フリッパー（インレーンから転がってきた玉を、フリッパーのどこで打つか） ===`);
    for (let tf = 0; tf <= 0.42; tf += 0.01) {
      const w = P.createWorld(3, table);
      P.addBall(w, start.x, start.y, 0, 200);
      let entered = -1;
      let flipAt = -1;
      let along = 0;
      let target = null;
      for (let k = 0; k < 3000 && !target; k += 1) {
        P.stepWorld(w, 1);
        const b = w.balls[0];
        if (!b) {
          target = "drain";
          break;
        }
        if (entered < 0 && b.y > 845) entered = w.time;
        if (entered >= 0 && flipAt < 0 && w.time - entered >= tf) {
          w.flippers[fi].pressed = true;
          flipAt = w.time;
          along = Math.hypot(b.x - w.flippers[fi].def.pivot.x, b.y - w.flippers[fi].def.pivot.y);
        }
        if (flipAt > 0 && w.time - flipAt > 0.3) w.flippers[fi].pressed = false;
        for (const e of w.events) {
          if (target || flipAt < 0) continue;
          if (e.type === "rampEnter") target = `ランプ(${e.id})`;
          else if (e.type === "drop") target = `ドロップ${e.index}`;
          else if (e.type === "bumper") target = "バンパー";
          else if (e.type === "scoop") target = "ガチャ穴";
          else if (e.type === "standup") target = `立ち的${e.index}`;
          else if (e.type === "pinwheel") target = "かざぐるま";
          else if (e.type === "sensor" && /orbit.*Mouth/.test(e.id) && e.vy < 0) target = e.id;
          else if (e.type === "sensor" && /^lane/.test(e.id)) target = "上のレーン";
          else if (e.type === "drain") target = "drain";
        }
        w.events.length = 0;
      }
      console.log(`  ${tf.toFixed(2)}秒後  支点から${along.toFixed(0)}mm → ${target ?? "-"}`);
    }
  }
}

function plunger(mapId) {
  const table = tableFor(mapId);
  console.log("引いた量  速さ  最初に通ったところ（シード5つ）");
  for (let power = 0.2; power <= 1.0001; power += 0.02) {
    const res = {};
    for (let seed = 1; seed <= 5; seed += 1) {
      const w = P.createWorld(seed, table);
      P.addBall(w, table.plungerRest.x, table.plungerRest.y);
      P.stepWorld(w, 300);
      P.releasePlunger(w, power);
      let first = "もどる";
      for (let k = 0; k < 3000; k += 1) {
        P.stepWorld(w, 1);
        const e = w.events.find((ev) => (ev.type === "sensor" && (ev.id.startsWith("lane") || ev.id === "spinner")) || ev.type === "bumper");
        w.events.length = 0;
        if (e) {
          first = e.type === "bumper" ? "バンパー" : e.id === "spinner" ? "1周" : `レーン「${"おでかけ"[Number(e.id.slice(4))]}」`;
          break;
        }
      }
      res[first] = (res[first] ?? 0) + 1;
    }
    console.log(`  ${(power * 100).toFixed(0)}%  ${Math.round(P.plungerSpeed(power))}mm/s  ${JSON.stringify(res)}`);
  }
}

/** 1つの台で count ゲーム遊ばせて、玉が止まった回数と場所を数える（stuck・stagefuzz で使う） */
function stuckRun(table, count) {
  const spots = new Map();
  let episodes = 0;
  let long = 0;
  let totalTime = 0;
  const mark = (b, field) => {
    const key = `${Math.round(b.x / 10) * 10},${Math.round(b.y / 10) * 10}`;
    const spot = spots.get(key) ?? { n: 0, long: 0 };
    spot[field] += 1;
    spots.set(key, spot);
  };
  for (let i = 0; i < count; i += 1) {
    const rand = P.mulberry32((i + 1) * 7919 + 13);
    const g = G.createGame({ table, pool: samplePool(8, rand), tableName: "岐阜県", seed: i + 1, speed: SPEED });
    const bot = makeBot(SKILLS.average, rand);
    const flagged = new Map();
    for (let frame = 0; frame < 60 * 60 * 30 && g.phase !== "over"; frame += 1) {
      botStep(g, bot);
      G.stepGame(g, 1 / 60);
      G.takeFx(g);
      for (const b of g.world.balls) {
        if (b.mode !== "field") continue;
        const state = flagged.get(b.id) ?? 0;
        if (b.still > 0.5 && state === 0) {
          flagged.set(b.id, 1);
          episodes += 1;
          mark(b, "n");
        } else if (b.still > 2.3 && state === 1) {
          flagged.set(b.id, 2);
          long += 1;
          mark(b, "long");
        } else if (b.still < 0.05 && state !== 0) {
          flagged.set(b.id, 0);
        }
      }
    }
    totalTime += g.playTime;
  }
  return { spots, episodes, long, totalTime };
}

/**
 * 玉が止まってしまう場所：ふつうの腕前で遊ばせて、玉がほとんど動かないまま 0.5秒（台の時間）たった場所を数える。
 * フリッパーで止めている玉・打ち出しレーン・ガチャ穴の中は数えない（ここに出る場所は、形を直すべきところ）
 */
function stuckReport(count, mapId) {
  const { spots, episodes, long, totalTime } = stuckRun(tableFor(mapId), count);
  console.log(`\n=== 玉が止まった場所（${tableLabel(mapId)}${count}ゲーム・合計 ${fmt(totalTime / 60, 1)}分） ===`);
  console.log(`0.5秒以上止まった回数 ${episodes}（1ゲーム ${fmt(episodes / count, 2)}回）・2.3秒以上（玉ゆらしが入る）${long}回`);
  const list = [...spots.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 30);
  for (const [key, v] of list) console.log(`  (${key})  ${v.n}回  うち長く止まった ${v.long}回`);
}

/* ---------- 自分で作るステージ ---------- */

/**
 * でたらめなステージ（エディターで作れるもの＝validateStage を通るものだけ）。部品の数もでたらめにして、
 * 置ける所をさがして詰めこむ（たくさん置くほど、ちょうど 31mm のすき間がたくさんできる）
 */
function randomStage(rand) {
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const spec = { v: 1, look: pick(ST.STAGE_LOOKS), ramp: pick(ST.STAGE_RAMPS), parts: [], items: ST.DEFAULT_STAGE_ITEMS.map((pt) => ({ ...pt })) };
  const area = ST.STAGE_AREA;
  const at = () => ST.snapStagePoint(area.x0 + rand() * (area.x1 - area.x0), area.y0 + rand() * (area.y1 - area.y0));
  // アイテムの場所を先にずらす（置けなければ、はじめの場所のまま）
  for (let k = 0; k < 3; k += 1) {
    for (let tries = 0; tries < 30; tries += 1) {
      const prev = spec.items[k];
      spec.items[k] = at();
      if (!ST.itemProblem(spec, k)) break;
      spec.items[k] = prev;
    }
  }
  const dense = rand() < 0.5;
  const want = {
    bumper: Math.floor(rand() * 9),
    pinwheel: Math.floor(rand() * 5),
    post: Math.floor(rand() * 17),
    peg: dense ? 30 + Math.floor(rand() * 31) : Math.floor(rand() * 20),
    sling: Math.floor(rand() * 5),
  };
  const make = (kind, pt) => {
    if (kind === "bumper") return { kind, ...pt, size: pick(["s", "m", "l"]) };
    if (kind === "pinwheel") return { kind, ...pt, dir: rand() < 0.5 ? 1 : -1 };
    if (kind === "sling") return { kind, ...pt, face: rand() < 0.5 ? "left" : "right" };
    return { kind, ...pt };
  };
  for (const kind of ["sling", "pinwheel", "bumper", "post", "peg"]) {
    for (let n = 0; n < want[kind]; n += 1) {
      for (let tries = 0; tries < 60; tries += 1) {
        spec.parts.push(make(kind, at()));
        if (!ST.partProblem(spec, spec.parts.length - 1)) break;
        spec.parts.pop();
      }
    }
  }
  const issues = ST.validateStage(spec);
  if (issues.length) throw new Error(`でたらめなステージが validateStage を通りません：${issues[0].message}`);
  return spec;
}

/**
 * でたらめなステージで、どれくらい赤コインを稼げるか（ステージごとの平均の分布。いつもの台とくらべる）。
 * いちばん稼げたステージ・いちばん稼げなかったステージは JSON に書き出す
 */
function stageBalance(stages, games, skillName = "average") {
  const base = [];
  for (let i = 0; i < games; i += 1) base.push(playGame(skillName, i + 1, 8).coins);
  const baseMean = base.reduce((a, b) => a + b, 0) / games;
  const rows = [];
  for (let s = 0; s < stages; s += 1) {
    const spec = randomStage(P.mulberry32((s + 1) * 104729 + 7));
    const table = ST.buildStageTable(spec);
    let sum = 0;
    let time = 0;
    for (let i = 0; i < games; i += 1) {
      const r = playGame(skillName, i + 1, 8, M.DEFAULT_MAP_ID, table);
      sum += r.coins;
      time += r.time;
    }
    rows.push({ s, mean: sum / games, time: time / games, parts: spec.parts.length, ramp: spec.ramp, spec });
  }
  rows.sort((a, b) => a.mean - b.mean);
  const means = rows.map((r) => r.mean);
  const q = (p) => means[Math.min(means.length - 1, Math.floor(p * means.length))];
  console.log(`\n=== でたらめなステージ ${stages}こ × ${games}ゲーム（${skillName}・アイテム8種） ===`);
  console.log(`いつもの台 ${fmt(baseMean, 1)}枚（同じ ${games}ゲーム）`);
  console.log(`ステージごとの赤コインの平均  いちばん少ない ${fmt(means[0], 1)}  10% ${fmt(q(0.1), 1)}  中央 ${fmt(q(0.5), 1)}  90% ${fmt(q(0.9), 1)}  いちばん多い ${fmt(means[means.length - 1], 1)}`);
  console.log(`いつもの台とくらべて  中央 ${fmt((q(0.5) / baseMean - 1) * 100, 0)}%  90% ${fmt((q(0.9) / baseMean - 1) * 100, 0)}%  いちばん多い ${fmt((means[means.length - 1] / baseMean - 1) * 100, 0)}%`);
  for (const r of [...rows.slice(0, 2), ...rows.slice(-3)]) {
    const file = `stagebalance-${r.s}.json`;
    writeFileSync(file, JSON.stringify(r.spec));
    console.log(`  ステージ${r.s}  ${fmt(r.mean, 1)}枚・${fmt(r.time, 0)}秒・部品${r.parts}こ・ランプ ${r.ramp}  → ${file}`);
  }
}

/** でたらめなステージをたくさん作って、玉が止まらないかを確かめる（止まったステージは JSON に書き出す） */
function stageFuzz(stages, games) {
  let long = 0;
  let episodes = 0;
  let totalGames = 0;
  const bad = [];
  for (let s = 0; s < stages; s += 1) {
    const spec = randomStage(P.mulberry32((s + 1) * 104729 + 7));
    const res = stuckRun(ST.buildStageTable(spec), games);
    long += res.long;
    episodes += res.episodes;
    totalGames += games;
    if (res.long > 0) {
      const where = [...res.spots.entries()].filter(([, v]) => v.long > 0).map(([k, v]) => `(${k})×${v.long}`).join(" ");
      bad.push({ s, long: res.long, where, spec });
    }
  }
  console.log(`\n=== でたらめなステージ ${stages}こ × ${games}ゲーム（ふつうの腕前） ===`);
  console.log(`0.5秒以上止まった回数 ${episodes}（1ゲーム ${fmt(episodes / totalGames, 2)}回）・2.3秒以上（玉ゆらしが入る）${long}回・止まったステージ ${bad.length}こ`);
  for (const b of bad.slice(0, 20)) {
    const file = `stagefuzz-${b.s}.json`;
    writeFileSync(file, JSON.stringify(b.spec));
    console.log(`  ステージ${b.s}  長く止まった ${b.long}回  ${b.where}  → ${file}（node scripts/simulate-pinball.mjs stuck 100 stage:${file}）`);
  }
}

/**
 * 動かない部品（壁・ポスト・くぎ・風車の軸・ターゲット）どうしのすき間のうち、玉（直径27mm）がはさまりやすい 14〜31mm のもの。
 * いつもの台にもあるもの（骨組みのインレーンなど、わざとせまくしてある通り道）はのぞいて、マップで足した部品のぶんだけ出す。
 * ここに出たところは stuck で止まらないかを必ず確かめる（バンパーのように、はじく部品とのすき間は出さない）
 */
function narrowGaps(table) {
  // group が同じもの（1本の壁の続き・同じ組のターゲット）どうしは、つながっているので数えない
  const parts = [];
  table.walls.forEach((w, wi) => {
    if (w.look === "frame") return;
    for (let i = 0; i + 1 < w.pts.length; i += 1) parts.push({ a: w.pts[i], b: w.pts[i + 1], r: w.r, name: w.look ?? "wall", group: `w${wi}` });
  });
  table.circles.forEach((c, i) => parts.push({ a: c, r: c.r, name: c.look, group: `c${i}` }));
  table.pinwheels.forEach((pw, i) => parts.push({ a: pw, r: pw.hubR, name: "風車の軸", group: `p${i}` }));
  table.standups.forEach((bank, bi) => bank.targets.forEach((t) => parts.push({ a: t.a, b: t.b, r: 2.5, name: "standup", group: `s${bi}` })));
  for (const d of table.drops) parts.push({ a: d.a, b: d.b, r: 3.5, name: "drop", group: "drops" });
  const segPt = (q, a, b) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(q.x - a.x - dx * t, q.y - a.y - dy * t);
  };
  const dist = (u, v) => {
    if (!u.b && !v.b) return Math.hypot(u.a.x - v.a.x, u.a.y - v.a.y);
    if (!u.b) return segPt(u.a, v.a, v.b);
    if (!v.b) return segPt(v.a, u.a, u.b);
    return Math.min(segPt(u.a, v.a, v.b), segPt(u.b, v.a, v.b), segPt(v.a, u.a, u.b), segPt(v.b, u.a, u.b));
  };
  const key = (q) => `${q.name}(${Math.round(q.a.x)},${Math.round(q.a.y)})`;
  const out = new Map();
  for (let i = 0; i < parts.length; i += 1) {
    for (let j = i + 1; j < parts.length; j += 1) {
      if (parts[i].group === parts[j].group) continue;
      const gap = dist(parts[i], parts[j]) - parts[i].r - parts[j].r;
      // 31mm ちょうど（くぎのこうしなど、わざとその幅にしたもの）は出さない
      if (gap > 14 && gap < 30.5) out.set(`${key(parts[i])} <-> ${key(parts[j])}`, gap);
    }
  }
  return out;
}

function gapReport(mapId) {
  const base = narrowGaps(M.getPinballTable(M.DEFAULT_MAP_ID));
  const gaps = narrowGaps(tableFor(mapId));
  const list = [...gaps.entries()].filter(([k]) => mapId === M.DEFAULT_MAP_ID || !base.has(k)).sort((a, b) => a[1] - b[1]);
  console.log(`\n=== せまいすき間（マップ ${mapId}${mapId === M.DEFAULT_MAP_ID ? "" : "・いつもの台にもあるものはのぞく"}）: ${list.length}か所 ===`);
  for (const [k, gap] of list) console.log(`  ${gap.toFixed(1)}mm  ${k}`);
}

// PINBALL_DEBUG_EXPORT があるときは、中身を渡すだけで何も回さない（調べもの用のスクリプトから import して使う）
if (process.env.PINBALL_DEBUG_EXPORT) {
  globalThis.__pb = { G, P, T, C, S, M, I, ST, SKILLS, makeBot, botStep, samplePool, playGame, GIFU_ITEMS, ALL_ITEMS, SPEED };
} else {
  const args = process.argv.slice(2);
  /** マップ（"all" で全部のマップ。無ければ、いつもの台） */
  const mapsOf = (arg) => (arg === "all" ? [...M.PINBALL_MAP_IDS] : [arg ?? M.DEFAULT_MAP_ID]);
  const mapArgs = args[0] === "shotmap" || args[0] === "plunger" || args[0] === "gaps" ? mapsOf(args[1]) : args[0] === "stuck" ? mapsOf(args[2]) : args[0] === "stagefuzz" || args[0] === "stagebalance" ? [] : mapsOf(args[3]);
  for (const id of mapArgs) {
    if (!M.isPinballMapId(id) && !id.startsWith("stage:")) throw new Error(`マップ ${id} はありません（${M.PINBALL_MAP_IDS.join(" / ")}・または stage:<ファイル>）`);
  }
  if (args[0] === "stagefuzz") stageFuzz(Number(args[1]) || 100, Number(args[2]) || 20);
  else if (args[0] === "stagebalance") stageBalance(Number(args[1]) || 40, Number(args[2]) || 100, args[3] ?? "average");
  else if (args[0] === "shotmap") for (const id of mapsOf(args[1])) shotmap(id);
  else if (args[0] === "plunger") for (const id of mapsOf(args[1])) plunger(id);
  else if (args[0] === "stuck") for (const id of mapsOf(args[2])) stuckReport(Number(args[1]) || 300, id);
  else if (args[0] === "gaps") for (const id of mapsOf(args[1])) gapReport(id);
  else {
    const [arg1 = "300", arg2 = "all", arg3 = "8"] = args;
    const count = Number(arg1) || 300;
    const poolSize = Number(arg3) || 0;
    const names = arg2 === "all" ? ["beginner", "average", "good"] : [arg2];
    for (const id of mapsOf(args[3])) for (const name of names) runGames(count, name, poolSize, id);
  }
}
