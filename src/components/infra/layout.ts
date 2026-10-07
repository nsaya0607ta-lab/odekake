/**
 * 盤面のマスの位置（0〜1 の割合）と、パーツどうしをつなぐ線。
 * 上から 利用者 → 入口（DNS・CDN・WAF）→ ロードバランサー → サーバー → データ → 裏方。
 * マスの位置はステージのマスの並びだけで決まる（置いても外しても、ほかのマスは動かない）。
 */
import { SLOT_KIND, USER_COUNT, type SlotId, type Tier } from "./model";

export type Pt = { x: number; y: number };

export type BoardLayout = {
  pos: Map<string, Pt>;
  /** 段の名前と高さ（左はしに小さく出す） */
  rows: { label: string; y: number }[];
  /** 遠くの町の利用者の範囲（x の左右） */
  farSpan: { from: number; to: number } | null;
  usersY: number;
};

export type Wire = { a: string; b: string; kind: "main" | "data" | "dns" | "repl" | "job" | "user" };

const TIER_ORDER: Tier[] = ["edge", "lb", "app", "data", "back"];
const TIER_LABEL: Record<Tier, string> = { edge: "入口", lb: "振り分け", app: "サーバー", data: "データ", back: "裏方" };
const TIER_OF: Record<SlotId, Tier> = {
  dns: "edge",
  cdn: "edge",
  waf: "edge",
  lb: "lb",
  app1: "app",
  app2: "app",
  app3: "app",
  app4: "app",
  cache: "data",
  db: "data",
  replica: "data",
  queue: "data",
  worker1: "back",
  worker2: "back",
};

const spread = (n: number, from: number, to: number) => Array.from({ length: n }, (_, i) => from + ((i + 0.5) / n) * (to - from));

export function computeLayout(slots: readonly SlotId[], opts: { bot: boolean; farUsers: number }): BoardLayout {
  const pos = new Map<string, Pt>();
  const usersY = 0.075;
  const present = TIER_ORDER.filter((t) => slots.some((s) => TIER_OF[s] === t));
  // 下は少しあけておく（タイルの下の名前・数字と、組み立て中の案内が重ならないように）
  const top = 0.28, bottom = 0.82;
  const tierY = new Map<Tier, number>();
  present.forEach((t, i) => tierY.set(t, present.length === 1 ? 0.55 : top + (i * (bottom - top)) / (present.length - 1)));

  // 利用者（攻撃があるステージは、右はしにロボット）
  const userTo = opts.bot ? 0.8 : 0.94;
  spread(USER_COUNT, 0.06, userTo).forEach((x, i) => pos.set(`u${i}`, { x, y: usersY }));
  if (opts.bot) pos.set("bot", { x: 0.915, y: usersY });

  for (const tier of present) {
    const y = tierY.get(tier)!;
    const inTier = slots.filter((s) => TIER_OF[s] === tier);
    if (tier === "edge") {
      // DNS は道のわき（左）。CDN・WAF は利用者からの道の上
      const main = inTier.filter((s) => s !== "dns");
      if (inTier.includes("dns")) pos.set("dns", { x: main.length ? 0.13 : 0.18, y: main.length ? y - 0.035 : y });
      const xs = main.length === 1 ? [0.56] : spread(main.length, 0.3, 0.92);
      main.forEach((s, i) => pos.set(s, { x: xs[i]!, y }));
      continue;
    }
    if (tier === "back") {
      inTier.forEach((s, i) => pos.set(s, { x: inTier.length === 1 ? 0.5 : i === 0 ? 0.385 : 0.615, y }));
      continue;
    }
    const order = tier === "data" ? (["cache", "db", "replica", "queue"] as SlotId[]).filter((s) => inTier.includes(s)) : inTier;
    const xs = order.length === 1 ? [0.5] : spread(order.length, 0.06, 0.94);
    order.forEach((s, i) => pos.set(s, { x: xs[i]!, y }));
  }
  // ワーカーは、キューの真下あたりに
  const queue = pos.get("queue");
  if (queue) {
    const workers = slots.filter((s) => TIER_OF[s] === "back");
    const by = tierY.get("back") ?? queue.y + 0.12;
    const cx = Math.min(0.86, Math.max(0.14, queue.x - 0.05));
    workers.forEach((s, i) => pos.set(s, { x: workers.length === 1 ? cx : cx + (i === 0 ? -0.11 : 0.11), y: by }));
  }

  const farSpan =
    opts.farUsers > 0
      ? (() => {
          const xs = spread(USER_COUNT, 0.06, userTo);
          const first = xs[USER_COUNT - opts.farUsers]!;
          const last = xs[USER_COUNT - 1]!;
          const half = (xs[1]! - xs[0]!) / 2;
          return { from: first - half * 0.92, to: last + half * 0.92 };
        })()
      : null;

  const rows = present.map((t) => ({ label: TIER_LABEL[t], y: tierY.get(t)! }));
  return { pos, rows, farSpan, usersY };
}

/** 置いてあるパーツから、つなぐ線を決める（シミュレーターの道順と同じ考え方） */
export function computeWires(placed: ReadonlySet<SlotId>): Wire[] {
  const has = (s: SlotId) => placed.has(s);
  const apps = (["app1", "app2", "app3", "app4"] as SlotId[]).filter(has);
  const wires: Wire[] = [];
  const origin: SlotId | undefined = has("waf") ? "waf" : has("lb") ? "lb" : apps[0];
  const behindWaf: SlotId | undefined = has("lb") ? "lb" : apps[0];
  for (let i = 0; i < USER_COUNT; i++) {
    if (origin) wires.push({ a: `u${i}`, b: origin, kind: "user" });
    if (has("cdn")) wires.push({ a: `u${i}`, b: "cdn", kind: "user" });
    if (has("dns")) wires.push({ a: `u${i}`, b: "dns", kind: "dns" });
  }
  if (has("cdn") && origin) wires.push({ a: "cdn", b: origin, kind: "main" });
  if (has("waf") && behindWaf) wires.push({ a: "waf", b: behindWaf, kind: "main" });
  if (has("lb")) for (const a of apps) wires.push({ a: "lb", b: a, kind: "main" });
  const dbs = (["db", "replica"] as SlotId[]).filter(has);
  for (const a of apps) {
    if (has("cache")) wires.push({ a, b: "cache", kind: "data" });
    for (const d of dbs) wires.push({ a, b: d, kind: "data" });
    if (has("queue")) wires.push({ a, b: "queue", kind: "data" });
  }
  for (const w of ["worker1", "worker2"] as SlotId[]) {
    if (!has(w)) continue;
    if (has("queue")) wires.push({ a: "queue", b: w, kind: "job" });
    for (const d of dbs) wires.push({ a: w, b: d, kind: "job" });
  }
  if (has("db") && has("replica")) wires.push({ a: "db", b: "replica", kind: "repl" });
  return wires;
}

/** 2点を結ぶなめらかな曲線の上の点（t: 0〜1）。上下につなぐときは縦向きに出入りする */
export function curvePoint(a: Pt, b: Pt, t: number): Pt {
  // 下から上へ向かうときは、上→下の同じ曲線を逆にたどる（行きと帰りで同じ道を通るように）
  if (a.y > b.y + 1e-6) return curvePoint(b, a, 1 - t);
  const dy = b.y - a.y;
  if (dy < 0.02) {
    // 同じ段：下にふくらむ弧
    const lift = 0.05 + Math.abs(b.x - a.x) * 0.08;
    const c1 = { x: a.x + (b.x - a.x) * 0.25, y: a.y + lift };
    const c2 = { x: a.x + (b.x - a.x) * 0.75, y: b.y + lift };
    return bez(a, c1, c2, b, t);
  }
  const c1 = { x: a.x, y: a.y + dy * 0.55 };
  const c2 = { x: b.x, y: b.y - dy * 0.55 };
  return bez(a, c1, c2, b, t);
}

function bez(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

export const slotTier = (slot: SlotId) => TIER_OF[slot];
export const slotKind = (slot: SlotId) => SLOT_KIND[slot];
