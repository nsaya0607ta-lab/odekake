#!/usr/bin/env node
/**
 * アプリ「インフラ」の各ステージを、いくつかの構成で何度も動かして、目標値（★）がちょうどよいか確かめる。
 *
 *   node scripts/simulate-infra.mjs            … 全ステージを 40 回ずつ
 *   node scripts/simulate-infra.mjs 100 s3 s5  … s3 と s5 を 100 回ずつ
 *
 * 見るところ：
 * - 「そのまま」（はじめから置いてあるものだけ）では ★0（クリアできない）こと
 * - 「お手本」では、ほぼ毎回 ★3 がとれること
 * - 別のやり方（力ずく・まちがった直し方）では、★ が欠けること（学んでほしいことが伝わるか）
 *
 * src/components/infra の model.ts / layout.ts / sim.ts / stages.ts を TypeScript のまま読みこむ（その場で JS に変換する）。
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src/components/infra");
const out = mkdtempSync(join(tmpdir(), "infra-sim-"));
for (const name of ["model", "layout", "sim", "stages"]) {
  const code = readFileSync(join(src, `${name}.ts`), "utf8");
  const js = ts
    .transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
    .outputText.replace(/from "\.\/(\w+)"/g, 'from "./$1.mjs"');
  writeFileSync(join(out, `${name}.mjs`), js);
}
const { InfraSim } = await import(pathToFileURL(join(out, "sim.mjs")).href);
const { STAGES, evaluate } = await import(pathToFileURL(join(out, "stages.mjs")).href);
rmSync(out, { recursive: true, force: true });

const args = process.argv.slice(2);
const runs = Number(args.find((a) => /^\d+$/.test(a)) ?? 40);
const only = new Set(args.filter((a) => !/^\d+$/.test(a)));

const P = (slot, kind, size = 0, at) => (at == null ? { slot, kind, size } : { slot, kind, size, at });

/** ステージごとの「別のやり方」 */
const ALTERNATIVES = {
  s1: { "M サイズ": [P("app1", "app", 1)] },
  s2: {},
  s3: {
    "LB なしで4台": [P("app2", "app"), P("app3", "app"), P("app4", "app")],
    "L サイズ1台": [P("app1", "app", 2)],
    "LB + 3台（はじめから）": [P("lb", "lb"), P("app2", "app"), P("app3", "app")],
    "LB + 4台（はじめから）": [P("lb", "lb"), P("app2", "app"), P("app3", "app"), P("app4", "app")],
    "LB + M 2台": [P("lb", "lb"), P("app1", "app", 1), P("app2", "app", 1)],
  },
  s4: { "DB を M で": [P("db", "db", 1)] },
  s5: { "DB を M に": [P("db", "db", 1)], "キャッシュ + DB M": [P("cache", "cache"), P("db", "db", 1)] },
  s6: { "CDN なしでサーバー4台": [P("app3", "app"), P("app4", "app")], "CDN なしで M 4台": [P("app1", "app", 1), P("app2", "app", 1), P("app3", "app", 1), P("app4", "app", 1)] },
  s7: { "サーバーだけ足す": [P("app2", "app")], "予備DB だけ足す": [P("replica", "replica")], "サーバー3台 + 予備DB": [P("app2", "app"), P("app3", "app"), P("replica", "replica")] },
  s8: {
    "サーバー4台（キューなし）": [P("app3", "app"), P("app4", "app")],
    "キュー + ワーカー1": [P("queue", "queue"), P("worker1", "worker")],
  },
  s9: { "サーバー4台（WAFなし）": [P("app3", "app"), P("app4", "app")] },
  s10: {
    "CDN なし": "-cdn",
    "WAF なし": "-waf",
    "キューなし": "-queue,-worker1,-worker2",
    "予備DB なし": "-replica",
    "キャッシュなし": "-cache",
    "サーバー2台": "-app3",
    "サーバー4台": "+app4",
  },
  s11: {
    "サーバー4台（オートなし）": [P("app2", "app"), P("app3", "app"), P("app4", "app")],
    "サーバー3台（オートなし）": [P("app2", "app"), P("app3", "app")],
    "オート + サーバー3台": [P("auto", "auto"), P("app2", "app"), P("app3", "app")],
  },
  s12: { "サーバー4台（監視なし）": [P("app4", "app")], "DB を M に（監視なし）": [P("app4", "app"), P("db", "db", 1)] },
  s13: { "消えてからバックアップ": [P("backup", "backup", 0, 25)] },
  s14: {
    "大阪だけ（TTL ふつう）": [P("region", "region")],
    "TTL 短めだけ": [P("dns", "dns", 1)],
  },
};

function runOnce(stage, placements, seed) {
  const timed = placements.filter((p) => p.at != null).sort((a, b) => a.at - b.at);
  let current = placements.filter((p) => p.at == null).map(({ at: _at, ...p }) => p);
  const sim = new InfraSim(stage.setup, current, seed);
  let i = 0;
  while (!sim.finished) {
    while (i < timed.length && timed[i].at <= sim.now + 1e-9) {
      const { at: _at, ...p } = timed[i++];
      current = [...current.filter((c) => c.slot !== p.slot), p];
      sim.setPlacements(current);
    }
    sim.step(0.25);
  }
  const r = evaluate(stage.goal, sim.successRate(), sim.avgLatency(), sim.avgCost());
  return { ...r, m: sim.m };
}

function summarize(stage, name, placements) {
  const results = [];
  for (let seed = 1; seed <= runs; seed++) results.push(runOnce(stage, placements, seed * 7919));
  const mean = (f) => results.reduce((s, r) => s + f(r), 0) / results.length;
  const min = (f) => Math.min(...results.map(f));
  const max = (f) => Math.max(...results.map(f));
  const stars = [0, 0, 0, 0];
  for (const r of results) stars[r.stars]++;
  const fails = {};
  for (const r of results) for (const [k, v] of Object.entries(r.m.failBy)) fails[k] = (fails[k] ?? 0) + v / results.length;
  const failText = Object.entries(fails)
    .filter(([, v]) => v >= 0.5)
    .map(([k, v]) => `${k}:${v.toFixed(0)}`)
    .join(" ");
  const extra = [];
  if (results.some((r) => r.m.attacks)) extra.push(`攻撃 ${mean((r) => r.m.attacks).toFixed(0)} 防 ${mean((r) => r.m.blocked).toFixed(0)} 被害 ${mean((r) => r.m.attackHit).toFixed(0)}`);
  if (results.some((r) => r.m.jobsMade)) extra.push(`加工 受付 ${mean((r) => r.m.jobsMade).toFixed(0)} 完了 ${mean((r) => r.m.jobsDone).toFixed(0)}`);
  console.log(
    `  ${name.padEnd(22, "　")} 成功 ${(mean((r) => r.success) * 100).toFixed(1).padStart(5)}%（最低 ${(min((r) => r.success) * 100).toFixed(1).padStart(5)}%）` +
      ` 速さ ${mean((r) => Math.min(r.latency, 9999)).toFixed(0).padStart(4)}ms（最大 ${max((r) => Math.min(r.latency, 9999)).toFixed(0).padStart(4)}）` +
      ` 月額 ¥${mean((r) => r.cost).toFixed(0).padStart(6)}  ★0:${stars[0]} ★1:${stars[1]} ★2:${stars[2]} ★3:${stars[3]}` +
      (failText ? `  失敗[${failText}]` : "") +
      (extra.length ? `  ${extra.join(" / ")}` : ""),
  );
}

function applyDiff(solution, diff) {
  let list = solution.map((p) => ({ ...p }));
  for (const part of diff.split(",")) {
    const slot = part.slice(1);
    if (part.startsWith("-")) list = list.filter((p) => p.slot !== slot);
    else list.push(P(slot, slot.replace(/\d$/, "") === "app" ? "app" : slot.replace(/\d$/, ""), 0));
  }
  return list;
}

for (const stage of STAGES) {
  if (only.size && !only.has(stage.id)) continue;
  const g = stage.goal;
  console.log(`\n■ ${stage.no}. ${stage.title}  目標: 成功 ${(g.success * 100).toFixed(0)}% / ${g.latency}ms / ¥${g.cost}（予算 ¥${stage.budget}）`);
  summarize(stage, "そのまま", stage.fixed);
  summarize(stage, "お手本", stage.solution);
  for (const [name, alt] of Object.entries(ALTERNATIVES[stage.id] ?? {})) {
    const placements = typeof alt === "string" ? applyDiff(stage.solution, alt) : [...stage.fixed.filter((f) => !alt.some((a) => a.slot === f.slot)), ...alt];
    summarize(stage, name, placements);
  }
}
