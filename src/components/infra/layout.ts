/**
 * 盤面のパーツの位置（0〜1 の割合）と、パーツどうしをつなぐ線。
 * 上から 利用者 → 入口（DNS・CDN・WAF）→ ロードバランサー → サーバー → データ → 裏方。
 * ステージでは、マスの位置はマスの並びだけで決まる（置いても外しても、ほかのマスは動かない）。
 *
 * つなぎ方は「リンク」（a → b。a が利用者に近いほう）で表す。シミュレーターはリンクのとおりにアクセスを流す。
 * ステージでは置いたパーツから自動で決まり（computeLinks）、ラボ（自由設計）では自分でつなぎかえられる。
 * 画面の線（Wire）は、リンクの「利用者」を6人ぶんに広げたもの。
 */
import { PARTS, USER_COUNT, compareIds, kindOf, type NodeId, type PartKind, type Tier } from "./model";

export type Pt = { x: number; y: number };

export type BoardLayout = {
  pos: Map<string, Pt>;
  /** 段の名前と高さ（左はしに小さく出す） */
  rows: { label: string; y: number }[];
  /** 遠くの町の利用者の範囲（x の左右） */
  farSpan: { from: number; to: number } | null;
  usersY: number;
};

/** ctl = オートスケール・監視が見張っている線（点線） */
export type WireKind = "main" | "data" | "dns" | "repl" | "job" | "user" | "ctl";
export type Wire = { a: string; b: string; kind: WireKind };

/** リンクの「利用者」側の名前 */
export const USERS = "users";
/** a → b のつながり（a は USERS か、パーツの id） */
export type Link = { a: string; b: NodeId; kind: WireKind };

const TIER_ORDER: Tier[] = ["edge", "lb", "app", "data", "back"];
const TIER_LABEL: Record<Tier, string> = { edge: "入口", lb: "振り分け", app: "サーバー", data: "データ", back: "裏方" };
/** 1行に並べるパーツの数（これより多いと、2行に分ける） */
const PER_ROW = 5;

const tierOf = (id: NodeId): Tier => PARTS[kindOf(id)].tier;
const spread = (n: number, from: number, to: number) => Array.from({ length: n }, (_, i) => from + ((i + 0.5) / n) * (to - from));

/** 盤面の行の数（ラボで、盤面の高さを決めるのに使う） */
export function lineCount(slots: readonly NodeId[]): number {
  let n = 0;
  for (const tier of TIER_ORDER) {
    const k = slots.filter((s) => tierOf(s) === tier).length;
    if (k) n += tier === "app" || tier === "data" ? Math.ceil(k / PER_ROW) : 1;
  }
  return n;
}

/** range … パーツの行を並べる高さの範囲（0〜1。省くと 0.28〜0.82） */
export function computeLayout(slots: readonly NodeId[], opts: { bot: boolean; farUsers: number; range?: { top: number; bottom: number } }): BoardLayout {
  const pos = new Map<string, Pt>();
  const usersY = 0.075;
  const ids = [...slots].sort(compareIds);
  const present = TIER_ORDER.filter((t) => ids.some((s) => tierOf(s) === t));
  // サーバーとデータの段は、多すぎると2行に分ける
  const lines: { tier: Tier; ids: NodeId[] }[] = [];
  for (const tier of present) {
    const inTier = ids.filter((s) => tierOf(s) === tier);
    const n = tier === "app" || tier === "data" ? Math.ceil(inTier.length / PER_ROW) : 1;
    const per = Math.ceil(inTier.length / n);
    for (let k = 0; k < n; k++) lines.push({ tier, ids: inTier.slice(k * per, (k + 1) * per) });
  }
  // 下は少しあけておく（タイルの下の名前・数字と、組み立て中の案内が重ならないように）
  const { top, bottom } = opts.range ?? { top: 0.28, bottom: 0.82 };
  const lineY = lines.map((_, i) => (lines.length === 1 ? 0.55 : top + (i * (bottom - top)) / (lines.length - 1)));

  // 利用者（攻撃があるステージは、右はしにロボット）
  const userTo = opts.bot ? 0.8 : 0.94;
  spread(USER_COUNT, 0.06, userTo).forEach((x, i) => pos.set(`u${i}`, { x, y: usersY }));
  if (opts.bot) pos.set("bot", { x: 0.915, y: usersY });

  const workers: NodeId[] = [];
  let backY = 0;
  lines.forEach(({ tier, ids: row }, li) => {
    const y = lineY[li]!;
    if (tier === "edge") {
      // DNS は道のわき（左）。CDN・WAF は利用者からの道の上。予備の拠点（大阪）は遠く（右はし）
      const main = row.filter((s) => kindOf(s) !== "dns" && kindOf(s) !== "region");
      const dns = row.find((s) => kindOf(s) === "dns");
      const region = row.find((s) => kindOf(s) === "region");
      if (dns) pos.set(dns, { x: main.length || region ? 0.13 : 0.18, y: main.length || region ? y - 0.035 : y });
      if (region) pos.set(region, { x: 0.88, y: y - 0.035 });
      const xs = main.length === 1 ? [region ? 0.5 : 0.56] : spread(main.length, 0.3, region ? 0.74 : 0.92);
      main.forEach((s, i) => pos.set(s, { x: xs[i]!, y }));
      return;
    }
    if (tier === "lb") {
      // オートスケールは、ロードバランサーの横で見張る
      const lb = row.find((s) => kindOf(s) === "lb");
      const auto = row.find((s) => kindOf(s) === "auto");
      if (lb) pos.set(lb, { x: 0.5, y });
      if (auto) pos.set(auto, { x: lb ? 0.84 : 0.5, y });
      return;
    }
    if (tier === "back") {
      // 監視は左はし。ワーカーは、あとでキューの真下あたりに
      backY = y;
      const ws = row.filter((s) => kindOf(s) === "worker");
      workers.push(...ws);
      const monitor = row.find((s) => kindOf(s) === "monitor");
      if (monitor) pos.set(monitor, { x: ws.length ? 0.14 : 0.5, y });
      const xs = ws.length === 1 ? [0.5] : ws.length === 2 ? [0.385, 0.615] : spread(ws.length, monitor ? 0.28 : 0.06, 0.94);
      ws.forEach((s, i) => pos.set(s, { x: xs[i]!, y }));
      return;
    }
    const xs = row.length === 1 ? [0.5] : spread(row.length, 0.06, 0.94);
    row.forEach((s, i) => pos.set(s, { x: xs[i]!, y }));
  });
  // ワーカーは、キューの真下あたりに
  const queue = ids.find((s) => kindOf(s) === "queue");
  const qp = queue ? pos.get(queue) : undefined;
  if (qp && workers.length) {
    const by = backY || qp.y + 0.12;
    const gap = 0.22;
    const half = ((workers.length - 1) * gap) / 2;
    const lo = (ids.some((s) => kindOf(s) === "monitor") ? 0.3 : 0.08) + half;
    const cx = Math.min(0.92 - half, Math.max(lo, workers.length <= 2 ? Math.min(0.86, Math.max(0.14, qp.x - 0.05)) : qp.x));
    workers.forEach((s, i) => pos.set(s, { x: workers.length === 1 ? cx : cx - half + i * gap, y: by }));
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

  // 段の名前は、その段の行のまんなかに
  const rows = present.map((t) => {
    const ys = lines.flatMap((l, i) => (l.tier === t ? [lineY[i]!] : []));
    return { label: TIER_LABEL[t], y: ys.reduce((a, b) => a + b, 0) / ys.length };
  });
  return { pos, rows, farSpan, usersY };
}

/**
 * 置いてあるパーツから、ふつうのつなぎ方を決める（ステージはいつもこれ。ラボの「自動でつなぐ」もこれ）。
 * 入口は WAF → ロードバランサー → いちばん前のサーバー の順にあるもの。
 */
export function computeLinks(placed: Iterable<NodeId>): Link[] {
  const ids = [...placed].sort(compareIds);
  const of = (k: PartKind) => ids.filter((s) => kindOf(s) === k);
  const one = (k: PartKind): NodeId | undefined => of(k)[0];
  const apps = of("app");
  const dbs = [...of("db"), ...of("replica")];
  const [waf, lb, cdn, region, dns, cache, queue, db, backup, auto, monitor] = (["waf", "lb", "cdn", "region", "dns", "cache", "queue", "db", "backup", "auto", "monitor"] as const).map(one);
  const links: Link[] = [];
  const origin = waf ?? lb ?? apps[0];
  const behindWaf = lb ?? apps[0];
  if (origin) links.push({ a: USERS, b: origin, kind: "user" });
  if (cdn) links.push({ a: USERS, b: cdn, kind: "user" });
  if (region) links.push({ a: USERS, b: region, kind: "user" });
  if (dns) links.push({ a: USERS, b: dns, kind: "dns" });
  if (cdn && origin) links.push({ a: cdn, b: origin, kind: "main" });
  if (waf && behindWaf) links.push({ a: waf, b: behindWaf, kind: "main" });
  if (lb) for (const a of apps) links.push({ a: lb, b: a, kind: "main" });
  for (const a of apps) {
    if (cache) links.push({ a, b: cache, kind: "data" });
    for (const d of dbs) links.push({ a, b: d, kind: "data" });
    if (queue) links.push({ a, b: queue, kind: "data" });
  }
  for (const w of of("worker")) {
    if (queue) links.push({ a: queue, b: w, kind: "job" });
    for (const d of dbs) links.push({ a: w, b: d, kind: "job" });
  }
  if (db) for (const r of of("replica")) links.push({ a: db, b: r, kind: "repl" });
  if (backup && dbs[0]) links.push({ a: dbs[0], b: backup, kind: "repl" });
  if (auto) for (const a of apps) links.push({ a: auto, b: a, kind: "ctl" });
  if (monitor) for (const t of [...apps, ...dbs]) links.push({ a: monitor, b: t, kind: "ctl" });
  return links;
}

/** 画面に出す線（利用者とのリンクは、6人ぶんに広げる） */
export function expandWires(links: readonly Link[]): Wire[] {
  const wires: Wire[] = [];
  const fromUsers = links.filter((l) => l.a === USERS);
  for (let i = 0; i < USER_COUNT; i++) for (const l of fromUsers) wires.push({ a: `u${i}`, b: l.b, kind: l.kind });
  for (const l of links) if (l.a !== USERS) wires.push({ a: l.a, b: l.b, kind: l.kind });
  return wires;
}

/** 置いてあるパーツから、つなぐ線を決める（ステージ用） */
export function computeWires(placed: ReadonlySet<NodeId>): Wire[] {
  return expandWires(computeLinks(placed));
}

/** つないでよい組み合わせ（a が利用者に近いほう）と、その線の種類 */
const CAN_LINK: Partial<Record<PartKind | typeof USERS, Partial<Record<PartKind, WireKind>>>> = {
  users: { dns: "dns", cdn: "user", waf: "user", lb: "user", app: "user", region: "user" },
  cdn: { waf: "main", lb: "main", app: "main" },
  waf: { lb: "main", app: "main" },
  lb: { app: "main" },
  auto: { app: "ctl" },
  app: { cache: "data", db: "data", replica: "data", queue: "data" },
  queue: { worker: "job" },
  worker: { db: "job", replica: "job" },
  db: { replica: "repl", backup: "repl" },
  monitor: { app: "ctl", db: "ctl", replica: "ctl" },
};

/** a と b をつなげるなら、向きをそろえたリンクを返す（どちらから選んでもよい） */
export function linkBetween(a: string, b: string): Link | null {
  const ka = a === USERS ? USERS : kindOf(a);
  const kb = b === USERS ? USERS : kindOf(b);
  const ab = CAN_LINK[ka]?.[kb as PartKind];
  if (ab && b !== USERS) return { a, b, kind: ab };
  const ba = CAN_LINK[kb]?.[ka as PartKind];
  if (ba && a !== USERS) return { a: b, b: a, kind: ba };
  return null;
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
