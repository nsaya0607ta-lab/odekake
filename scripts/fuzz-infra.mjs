#!/usr/bin/env node
/**
 * アプリ「インフラ」のシミュレーター・ラボの設計図・設定ファイルの書き出しを、でたらめな構成でたくさん動かして、
 * こわれないか（例外が出ない・数がおかしくならない）を確かめる。
 *
 *   node scripts/fuzz-infra.mjs              … 400 通り
 *   node scripts/fuzz-infra.mjs 3000         … 3000 通り
 *   FUZZ_VALIDATE=1 node scripts/fuzz-infra.mjs 200
 *       … 書き出した設定ファイルを、docker compose config・terraform validate でも確かめる（そのコマンドがあれば）。
 *         terraform は AWS プロバイダを取りにいけること（または TF_CLI_CONFIG_FILE でミラーを指定）
 *
 * 見るところ（どれか1つでも破れたら、その種と中身を出して終了コード 1）
 * - シミュレーター：例外が出ない／成功・失敗の数と内わけが合う／NaN・Infinity にならない／
 *   各パーツの「向かってくる数」が、本当に向かっている数と同じ／待ち行列・処理中の中身が、そのパーツにいる／
 *   休んでいるサーバーは仕事を持っていない
 *   （本番の途中で、ラボのように置く・外す・つなぎかえる・事件を起こす もまぜる）
 * - 設計図：足す・外す・つなぐ・大きさを変える・自動でつなぐ をくり返しても、id とリンクがいつも正しい。
 *   保存して読みもどしても同じ。でたらめな保存データを読んでも例外にならない
 * - 書き出し：undefined・NaN が混ざらない／docker-compose.yml が YAML として読める
 * - サーバー室の小さな部品（パスの直し方・かっこのヒント・CDN の使い回し・ステータスの意味）が思ったとおりに動く
 *   （サーバー室そのものは Web Worker で動くので、ブラウザで確かめる）
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src/components/infra");
const out = mkdtempSync(join(tmpdir(), "infra-fuzz-"));
for (const name of ["model", "layout", "sim", "design", "export", "room", "room-templates"]) {
  const code = readFileSync(join(src, `${name}.ts`), "utf8");
  const js = ts
    .transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
    .outputText.replace(/from "\.\/([\w-]+)"/g, 'from "./$1.mjs"');
  writeFileSync(join(out, `${name}.mjs`), js);
}
const load = (name) => import(pathToFileURL(join(out, `${name}.mjs`)).href);
const { PARTS, PART_KINDS, kindOf } = await load("model");
const { USERS, linkBetween } = await load("layout");
const { InfraSim } = await load("sim");
const D = await load("design");
const { exportDesign } = await load("export");
const room = await load("room");
const { ROOM_TEMPLATES } = await load("room-templates");
rmSync(out, { recursive: true, force: true });

let yaml = null;
try {
  yaml = (await import("js-yaml")).default;
} catch {
  // js-yaml がなければ、YAML として読めるかは見ない
}

// 設計図の保存先（localStorage）の代わり
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  },
};

const runs = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 400);
const validate = process.env.FUZZ_VALIDATE === "1";
const ALL = new Set(PART_KINDS);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];

class Broken extends Error {}
function must(ok, what, detail) {
  if (!ok) throw new Broken(`${what}${detail === undefined ? "" : `：${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`);
}

/* ------------------------------------------------------------ 設計図 */

const validId = (id) => {
  const k = kindOf(id);
  if (!PART_KINDS.includes(k)) return false;
  if (D.LIMITS[k] === 1) return id === k;
  if (k === "replica") return id === "replica" || /^replica[2-9]$/.test(id);
  return /^[a-z]+[1-9]\d*$/.test(id);
};

function checkDesign(d) {
  const ids = d.placements.map((p) => p.slot);
  must(new Set(ids).size === ids.length, "id が重なっている", ids);
  for (const p of d.placements) {
    must(validId(p.slot), "おかしな id", p.slot);
    must(p.kind === kindOf(p.slot), "id と種類がちがう", p);
    must(Number.isInteger(p.size) && p.size >= 0 && p.size < PARTS[p.kind].sizes.length, "おかしな大きさ", p);
  }
  for (const k of PART_KINDS) must(ids.filter((s) => kindOf(s) === k).length <= D.LIMITS[k], "上限より多い", k);
  const keys = new Set();
  for (const l of d.links) {
    must(l.a === USERS || ids.includes(l.a), "リンクの元がない", l);
    must(ids.includes(l.b), "リンクの先がない", l);
    const ok = linkBetween(l.a, l.b);
    must(ok && ok.a === l.a && ok.b === l.b && ok.kind === l.kind, "つないではいけないリンク", l);
    const key = `${l.a}>${l.b}`;
    must(!keys.has(key), "同じリンクが2つ", l);
    keys.add(key);
  }
}

const canon = (d) => JSON.stringify({ p: [...d.placements].map((p) => `${p.slot}:${p.size}`).sort(), l: d.links.map((l) => `${l.a}>${l.b}:${l.kind}`).sort() });

function mutate(r, d) {
  const x = r();
  if (x < 0.4) return D.addPart(d, pick(r, PART_KINDS))?.design ?? d;
  if (x < 0.55 && d.placements.length) return D.removePart(d, pick(r, d.placements).slot).design;
  if (x < 0.88) {
    const ids = [USERS, ...d.placements.map((p) => p.slot)];
    return D.toggleLink(d, pick(r, ids), pick(r, ids))?.design ?? d;
  }
  if (x < 0.96 && d.placements.length) {
    const p = pick(r, d.placements);
    return D.resizePart(d, p.slot, Math.floor(r() * PARTS[p.kind].sizes.length));
  }
  return D.autoWire(d);
}

function randomDesign(r) {
  let d = D.defaultDesign(ALL);
  const steps = 3 + Math.floor(r() * 40);
  for (let i = 0; i < steps; i++) {
    d = mutate(r, d);
    checkDesign(d);
  }
  // 保存して読みもどしても、同じ設計図になる
  D.saveDesign(d);
  const back = D.loadDesign(ALL);
  checkDesign(back);
  must(canon(back) === canon(d), "保存して読みもどすと変わる", { before: canon(d), after: canon(back) });
  return d;
}

/** でたらめな保存データ */
function junk(r, depth = 0) {
  const x = r();
  if (depth > 3 || x < 0.15) return pick(r, [null, true, 0, -1, 1.5, 99, "", "app1", "lb", "lb2", "users", "replica", "replica0", "worker9", "x", "__proto__", "constructor", NaN]);
  if (x < 0.45) return Array.from({ length: Math.floor(r() * 6) }, () => junk(r, depth + 1));
  const o = {};
  for (const k of ["placements", "links", "slot", "kind", "size", "a", "b"]) if (r() < 0.6) o[k] = junk(r, depth + 1);
  return o;
}

function fuzzLoad(r) {
  const parts = new Set(PART_KINDS.filter(() => r() < 0.7));
  parts.add("app");
  const raw = r() < 0.2 ? pick(r, ["{", "null", "[]", "\"x\"", "{\"placements\":5}"]) : JSON.stringify(junk(r));
  store.set("odekake_infra_lab_v2", raw);
  const d = D.loadDesign(parts);
  checkDesign(d);
  for (const p of d.placements) must(parts.has(p.kind), "まだ使えないパーツが読みこまれた", p.kind);
}

/* ------------------------------------------------------------ シミュレーター */

function checkSim(sim) {
  const m = sim.m;
  for (const k of ["ok", "fail", "attacks", "blocked", "attackHit", "jobsMade", "jobsDone", "jobsFailed", "latN"]) must(Number.isInteger(m[k]) && m[k] >= 0, `数がおかしい（${k}）`, m[k]);
  const byReason = Object.values(m.failBy).reduce((a, b) => a + b, 0);
  must(byReason === m.fail, "失敗の数と内わけが合わない", { fail: m.fail, failBy: m.failBy });
  must(Number.isFinite(m.latSum) && m.latSum >= 0, "速さの合計がおかしい", m.latSum);
  must(Number.isFinite(m.costAcc) && Number.isFinite(sim.cost()) && sim.cost() >= 0, "月額がおかしい");
  must(sim.primaryDb === null || sim.nodes.has(sim.primaryDb), "本番DB がいない", sim.primaryDb);
  const incoming = new Map();
  for (const r of sim.reqs) {
    must(r.state !== "gone", "終わったアクセスが残っている", r.id);
    must(Number.isFinite(r.t0) && Number.isFinite(r.t1) && r.t1 >= r.t0 - 1e-9, "移動の時間がおかしい", r);
    if (r.inc) incoming.set(r.inc, (incoming.get(r.inc) ?? 0) + 1);
    if (r.inc) must(r.state === "travel" && !r.returning, "向かっていないのに数えられている", r);
  }
  for (const node of sim.nodes.values()) {
    must(node.incoming === (incoming.get(node.id) ?? 0), "向かってくる数が合わない", { node: node.id, counted: node.incoming, real: incoming.get(node.id) ?? 0 });
    for (const r of node.busy) must(r.state === "service" && r.at === node.id, "処理中のアクセスがおかしい", { node: node.id, r: r.id, state: r.state, at: r.at });
    for (const r of node.wait) must(r.state === "wait" && r.at === node.id, "待っているアクセスがおかしい", { node: node.id, r: r.id, state: r.state, at: r.at });
    for (const r of node.jobs) must(r.state === "wait" && r.kind === "job", "キューの仕事がおかしい", { node: node.id, r: r.id });
    if (node.down) must(!node.busy.length && !node.wait.length, "止まったパーツが仕事を持っている", node.id);
    if (node.asleep) must(!node.busy.length && !node.wait.length, "休んでいるサーバーが仕事を持っている", node.id);
    must(Number.isFinite(node.activity) && Number.isFinite(node.warm), "パーツの数字がおかしい", node.id);
  }
  const rate = sim.successRate();
  must(rate === null || (rate >= 0 && rate <= 1), "成功率がおかしい", rate);
  const lat = sim.avgLatency();
  must(lat === null || Number.isFinite(lat), "速さがおかしい", lat);
}

function randomSetup(r) {
  const duration = 20 + r() * 40;
  const base = { page: r() * 25, static: r() * 15, write: r() * 4, heavy: r() * 3, attack: r() < 0.3 ? r() * 20 : 0 };
  const events = [];
  const n = Math.floor(r() * 6);
  for (let i = 0; i < n; i++) {
    const t = r() * duration;
    const k = pick(r, ["crash-app", "crash-db", "slow", "wipe", "outage", "banner"]);
    if (k === "crash-app") events.push({ t, kind: "crash", target: "app", index: r() < 0.5 ? Math.floor(r() * 4) : undefined, duration: 1 + r() * 20 });
    else if (k === "crash-db") events.push({ t, kind: "crash", target: "db", duration: 1 + r() * 20 });
    else if (k === "slow") events.push({ t, kind: "slow", index: r() < 0.5 ? Math.floor(r() * 4) : undefined, duration: 1 + r() * 30 });
    else if (k === "wipe") events.push({ t, kind: "wipe" });
    else if (k === "outage") events.push({ t, kind: "outage", duration: 1 + r() * 30 });
    else events.push({ t, kind: "banner", text: "テスト", tone: "info" });
  }
  const wave = r() * 6;
  return {
    requiresDns: r() < 0.75,
    farRatio: r() * 0.7,
    duration,
    events,
    traffic: (t) => {
      const k = 1 + 0.6 * Math.sin(t / (1 + wave));
      return { page: base.page * k, static: base.static * k, write: base.write, heavy: base.heavy, attack: base.attack };
    },
  };
}

function runSim(r, seed, d0) {
  let d = d0;
  const sim = new InfraSim(randomSetup(r), d.placements, seed, r() < 0.15 ? undefined : d.links);
  checkSim(sim);
  let guard = 0;
  while (!sim.finished && guard++ < 2000) {
    // ラボのように、本番の途中で置く・外す・つなぎかえる（画面からの操作は、こまとこまのあいだに入る）
    if (r() < 0.12) {
      d = mutate(r, d);
      checkDesign(d);
      sim.setPlacements(d.placements, d.links);
    }
    // ラボの「事件を起こす」ボタン
    if (r() < 0.03) {
      const k = pick(r, ["crash-app", "crash-db", "slow", "wipe", "outage"]);
      if (k === "crash-app") sim.crash("app", 1 + r() * 10);
      else if (k === "crash-db") sim.crash("db", 1 + r() * 10);
      else if (k === "slow") sim.slowDown(1 + r() * 20);
      else if (k === "wipe") sim.wipe();
      else sim.outage(1 + r() * 20);
    }
    sim.step(0.05 + r() * 0.6);
    // 画面が受けとるもの
    sim.fx = [];
    sim.banners = [];
    sim.tips = [];
    checkSim(sim);
  }
  must(sim.finished, "終わらない");
  return sim;
}

/* ------------------------------------------------------------ 書き出し */

const validateDir = join(tmpdir(), `infra-fuzz-validate-${process.pid}`);
let validated = 0;
const has = (cmd, args) => {
  try {
    execFileSync(cmd, args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};
const terraform = process.env.TERRAFORM ?? "terraform";
const canCompose = validate && has("docker", ["compose", "version"]);
const canTerraform = validate && has(terraform, ["version"]);

function checkExport(d, i) {
  const { files, rows } = exportDesign(d);
  must(files.length >= 2, "ファイルが足りない");
  for (const f of files) {
    must(!/\bundefined\b|\bNaN\b|\[object Object\]/.test(f.body), `${f.name} に undefined などが混ざっている`, f.body.split("\n").find((l) => /undefined|NaN|object Object/.test(l)));
  }
  for (const row of rows) must(row.part && row.local && row.aws, "まとめの表がおかしい", row);
  const composeFile = files.find((f) => f.name === "docker-compose.yml");
  if (yaml) {
    for (const f of files.filter((x) => x.lang === "yaml")) {
      try {
        yaml.load(f.body);
      } catch (e) {
        must(false, `${f.name} が YAML として読めない`, String(e));
      }
    }
    try {
      const doc = yaml.load(composeFile.body);
      must(doc && typeof doc.services === "object", "docker-compose.yml に services がない");
      for (const [name, s] of Object.entries(doc.services)) {
        for (const dep of s.depends_on ?? []) must(dep in doc.services, `${name} の depends_on が、ないサービスを指している`, dep);
      }
    } catch (e) {
      if (e instanceof Broken) throw e;
      must(false, "docker-compose.yml が YAML として読めない", String(e));
    }
  }
  if ((canCompose || canTerraform) && i % 7 === 0) {
    const dir = join(validateDir, String(i));
    mkdirSync(dir, { recursive: true });
    for (const f of files) writeFileSync(join(dir, f.name), f.body);
    if (canCompose) {
      try {
        execFileSync("docker", ["compose", "-f", join(dir, "docker-compose.yml"), "config", "-q"], { stdio: "pipe" });
      } catch (e) {
        must(false, "docker compose config が通らない", String(e.stderr ?? e));
      }
    }
    if (canTerraform) {
      try {
        execFileSync(terraform, ["fmt", "-check", "main.tf"], { cwd: dir, stdio: "pipe" });
      } catch (e) {
        must(false, "terraform fmt にそろっていない", String(e.stdout ?? e));
      }
      try {
        execFileSync(terraform, ["init", "-input=false", "-backend=false", "-no-color"], { cwd: dir, stdio: "pipe" });
        execFileSync(terraform, ["validate", "-no-color"], { cwd: dir, stdio: "pipe" });
      } catch (e) {
        must(false, "terraform validate が通らない", String(e.stdout ?? "") + String(e.stderr ?? e));
      }
    }
    validated++;
  }
}

/* ------------------------------------------------------------ サーバー室の部品 */

function checkRoomParts() {
  const eq = (got, want, what) => must(got === want, what, { got, want });
  eq(room.normalizePath("hello"), "/hello", "パス：/ をつける");
  eq(room.normalizePath("  /a b  "), "/a%20b", "パス：空白");
  eq(room.normalizePath("/日本"), "/%E6%97%A5%E6%9C%AC", "パス：日本語");
  eq(room.normalizePath("https://example.com/p?q=1"), "/p?q=1", "パス：URL ごと");
  eq(room.normalizePath(""), "/", "パス：から");
  for (const t of ROOM_TEMPLATES) {
    eq(room.bracketHint(t.code), null, `お手本「${t.name}」で、かっこのヒントがまちがって出る`);
    must(t.steps.length >= 2 && t.tries.length >= 1, `お手本「${t.name}」の「やってみよう」が足りない`);
    must(/\/health/.test(t.code), `お手本「${t.name}」が /health に返事をしない`);
  }
  eq(room.bracketHint("function f() {\n  return (1;\n}"), "2行目の ( と、3行目の } が組になっていません", "かっこのヒント：組ちがい");
  eq(room.bracketHint("if (a) {\n  b();\n"), "1行目の { が閉じていません", "かっこのヒント：閉じわすれ");
  eq(room.bracketHint("x = 1);"), "1行目の ) に、組になる ( がありません", "かっこのヒント：開きわすれ");
  eq(room.bracketHint('s = "abc;\nt = 1;'), '1行目の " が閉じていません', "かっこのヒント：文字列");
  eq(room.bracketHint("// ( かっこ\n/* { */\nconst s = '(';"), null, "かっこのヒント：コメント・文字列の中はとばす");
  const res = (status, cc) => ({ status, statusText: "", headers: cc ? [["Cache-Control", cc]] : [], body: "" });
  eq(room.cacheSeconds(res(200, "public, max-age=20")), 20, "CDN：max-age");
  eq(room.cacheSeconds(res(200, "s-maxage=30")), 30, "CDN：s-maxage");
  eq(room.cacheSeconds(res(200, "no-store")), 0, "CDN：no-store");
  eq(room.cacheSeconds(res(200, "private, max-age=60")), 0, "CDN：private");
  eq(room.cacheSeconds(res(404, "max-age=60")), 0, "CDN：200 以外は使い回さない");
  eq(room.cacheSeconds(res(200, null)), 0, "CDN：書いていなければ使い回さない");
  eq(room.statusMeaning(404), "見つからない", "ステータスの意味：404");
  eq(room.statusMeaning(418), "お願いのまちがい", "ステータスの意味：4xx");
  eq(room.statusMeaning(299), "成功", "ステータスの意味：2xx");
  eq(room.hasBody("PUT") && room.hasBody("POST") && !room.hasBody("GET") && !room.hasBody("DELETE"), true, "本文を送るメソッド");
}

/* ------------------------------------------------------------ 実行 */

try {
  checkRoomParts();
} catch (e) {
  console.error("✗ サーバー室の部品がこわれています");
  console.error(e instanceof Broken ? `  ${e.message}` : e);
  process.exit(1);
}

const t0 = Date.now();
let simSeconds = 0;
const totals = { ok: 0, fail: 0 };
for (let i = 1; i <= runs; i++) {
  const seed = i * 2654435761;
  const r = rng(seed);
  let stage = "設計図";
  let d = null;
  try {
    fuzzLoad(r);
    d = randomDesign(r);
    stage = "書き出し";
    checkExport(d, i);
    stage = "シミュレーター";
    const sim = runSim(r, seed, d);
    simSeconds += sim.now;
    totals.ok += sim.m.ok;
    totals.fail += sim.m.fail;
  } catch (e) {
    console.error(`\n✗ ${i} 番目（種 ${seed}）の${stage}でこわれました`);
    console.error(e instanceof Broken ? `  ${e.message}` : e);
    if (d) console.error(`  設計図：${canon(d)}`);
    process.exit(1);
  }
  if (i % 100 === 0) process.stdout.write(`  ${i} 通り…\n`);
}
rmSync(validateDir, { recursive: true, force: true });
console.log(
  `✓ ${runs} 通り、こわれませんでした（シミュレーター ${Math.round(simSeconds)} 秒ぶん・アクセス ${totals.ok + totals.fail} 件・${((Date.now() - t0) / 1000).toFixed(1)}秒）` +
    (yaml ? "" : "（js-yaml がないので YAML の読みこみは見ていません）") +
    (validate ? `／docker compose${canCompose ? "" : "（なし）"}・terraform${canTerraform ? "" : "（なし）"} で ${validated} 通り確かめました` : ""),
);
