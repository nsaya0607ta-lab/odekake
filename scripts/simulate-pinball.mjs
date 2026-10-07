#!/usr/bin/env node
/**
 * ご当地ピンボールのシミュレーター
 * =============================================================
 * 本番と同じ物理・ルール（src/lib/games/pinball/*.ts）を Node でそのまま動かし、
 * 人に近い打ち方をするボットに何ゲームも遊ばせて、1プレイの長さ・得点・赤コインの分布を測る。
 * 台の形や数字を変えたら、これで確かめてから docs/pinball.md の結果を更新すること。
 *
 * 使い方:
 *   node scripts/simulate-pinball.mjs [ゲーム数(既定300)] [beginner|average|good|all(既定)] [持っているアイテム数(既定8)]
 *   node scripts/simulate-pinball.mjs shotmap      … フリッパーのどこで打つとどこへ飛ぶか（台の形の確認）
 *   node scripts/simulate-pinball.mjs plunger      … 打ち出しの強さごとに、玉が最初に通るところ
 *
 * ボットの腕前（SKILLS）は「ふつう」を、ピンボールを少し遊んだことがある人くらいにしてある：
 *   反応のばらつき（秒）・何もしないで見送ってしまう確率・玉を止めて狙う確率・狙いのずれ（mm）
 * Node 22.18 以上（TypeScript の型をそのまま外して読み込める版）が必要。
 */
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

/* ---------- ボット ---------- */

const SKILLS = {
  beginner: { reaction: 0.045, miss: 0.16, catch: 0.0, aim: 14, skillTry: 0.1, plungeSigma: 0.06 },
  average: { reaction: 0.028, miss: 0.07, catch: 0.3, aim: 9, skillTry: 0.35, plungeSigma: 0.035 },
  good: { reaction: 0.016, miss: 0.025, catch: 0.75, aim: 5, skillTry: 0.75, plungeSigma: 0.02 },
};
/** スキルショットのレーンに入りやすい引き量 */
const LANE_POWER = C.SKILL_SHOT_POWER;
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
      const ttc = fr.vn < -1 ? (fr.height - 24) / -fr.vn : 0;
      if (ttc < 0.12 + gauss(rand) * skill.reaction) {
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

/** 狙う場所（浮かんでいるアイテム・ジャックポットを優先） */
const SPOT_SHOT = { 3: "scoop", 4: "scoop", 5: "scoop", 6: "leftRamp", 7: "rightRamp", 8: "leftOrbit", 9: "rightOrbit" };
function aimTargets(g, side) {
  const cross = side === 0 ? ["rightRamp", "rightOrbit"] : ["leftRamp", "leftOrbit"];
  const lit = new Set();
  for (const s of g.stamps) if (!s.collected && s.spot !== null && SPOT_SHOT[s.spot]) lit.add(SPOT_SHOT[s.spot]);
  for (const id of T.SHOT_IDS) if (g.jackpots[id]) lit.add(id);
  if (g.superLit) lit.add("scoop");
  const want = [...lit].filter((id) => cross.includes(id) || id === "scoop");
  const pick = want.length ? want : [...cross, "scoop"];
  return pick.map((id) => (id === "scoop" ? AIM_ALONG.center : id.endsWith("Ramp") ? AIM_ALONG.ramp : AIM_ALONG.orbit));
}

/* ---------- 1ゲーム ---------- */

function samplePool(n, rand) {
  const prefItems = [
    ["gifu_gohei_mochi", "五平餅", "N"], ["gifu_meiho_ham", "明宝ハム", "N"], ["gifu_keichan", "鶏ちゃん", "R"],
    ["gifu_kuri_kinton", "栗きんとん", "R"], ["gifu_ayu", "鮎", "R"], ["gifu_minoyaki", "美濃焼", "SR"],
    ["gifu_seki_hamono", "関の刃物", "SR"], ["gifu_gero_onsen", "下呂温泉", "SSR"], ["gifu_hida_takayama", "飛騨高山の古い町並み", "SSR"],
    ["gifu_hida_beef", "飛騨牛", "UR"], ["gifu_shinhotaka", "新穂高ロープウェイ", "UR"], ["gifu_shirakawago", "白川郷・合掌造り", "LR"],
  ];
  return prefItems.slice(0, n).map(([id, name, rarity]) => {
    const level = rarity === "N" ? 0 : 1 + Math.floor(rand() * 3);
    return { id, name, rarity, level, skill: S.getPinballSkill(id, name, rarity, level), image: null };
  });
}

function playGame(skillName, seed, poolSize) {
  const rand = P.mulberry32(seed * 7919 + 13);
  const g = G.createGame({ pool: samplePool(poolSize, rand), tableName: "岐阜県", seed });
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
    coins: C.redCoinsForScore(g.score),
    saves: g.stats.saves,
    jackpots: g.stats.jackpots,
    ramps: g.stats.ramps,
    orbits: g.stats.orbits,
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

function runGames(count, skillName, poolSize) {
  const rows = [];
  for (let i = 0; i < count; i += 1) rows.push(playGame(skillName, i + 1, poolSize));
  const col = (k) => stats(rows.map((r) => r[k]));
  const t = col("time");
  const sc = col("score");
  const coins = col("coins");
  console.log(`\n=== ${skillName}（${count}ゲーム・アイテム${poolSize}種）===`);
  console.log(`プレイ時間  平均 ${fmt(t.mean, 1)}秒  中央 ${fmt(t.p50, 1)}  10% ${fmt(t.p10, 1)}  90% ${fmt(t.p90, 1)}`);
  console.log(`スコア      平均 ${fmt(sc.mean)}  中央 ${fmt(sc.p50)}  10% ${fmt(sc.p10)}  90% ${fmt(sc.p90)}`);
  console.log(`赤コイン    平均 ${fmt(coins.mean, 1)}枚  中央 ${fmt(coins.p50)}  10% ${fmt(coins.p10)}  90% ${fmt(coins.p90)}`);
  const per = (k) => fmt(col(k).mean, 2);
  console.log(`1ゲームあたり  アイテム ${per("items")}  県制覇 ${per("conquests")}  ジャックポット ${per("jackpots")}  ランプ ${per("ramps")}  オービット ${per("orbits")}  スキルショット ${per("skillShots")}  ボールセーブ ${per("saves")}  アウトレーン ${per("outlanes")}`);
  const conquered = rows.filter((r) => r.conquests > 0).length;
  console.log(`県制覇できたゲーム ${fmt((conquered / count) * 100, 1)}%`);
  return rows;
}

/* ---------- 台の確認 ---------- */

function shotmap() {
  for (const side of ["left", "right"]) {
    const fi = side === "left" ? 0 : 1;
    const start = side === "left" ? { x: 64, y: 760 } : { x: 416, y: 760 };
    console.log(`\n=== ${side === "left" ? "左" : "右"}フリッパー（インレーンから転がってきた玉を、フリッパーのどこで打つか） ===`);
    for (let tf = 0; tf <= 0.42; tf += 0.01) {
      const w = P.createWorld(3);
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

function plunger() {
  console.log("引いた量  速さ  最初に通ったところ（シード5つ）");
  for (let power = 0.2; power <= 1.0001; power += 0.02) {
    const res = {};
    for (let seed = 1; seed <= 5; seed += 1) {
      const w = P.createWorld(seed);
      P.addBall(w, T.TABLE.plungerRest.x, T.TABLE.plungerRest.y);
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

const [arg1 = "300", arg2 = "all", arg3 = "8"] = process.argv.slice(2);
if (arg1 === "shotmap") shotmap();
else if (arg1 === "plunger") plunger();
else {
  const count = Number(arg1) || 300;
  const poolSize = Number(arg3) || 0;
  const names = arg2 === "all" ? ["beginner", "average", "good"] : [arg2];
  for (const name of names) runGames(count, name, poolSize);
}
