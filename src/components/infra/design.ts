/**
 * ラボ（自由設計）の設計図：置いたパーツと、つなぎ方（リンク）。
 * マスの決まりはなく、パーツは種類ごとの上限（LIMITS）まで好きなだけ置ける。線は自分でつなぎかえられる。
 * この端末に覚えておく（localStorage。読めなくても、その場では遊べる）。
 */
import { USERS, computeLinks, linkBetween, type Link } from "./layout";
import { PARTS, PART_KINDS, compareIds, kindOf, slotLabel, type NodeId, type PartKind, type Placement } from "./model";

export type Design = { placements: Placement[]; links: Link[] };

/** 種類ごとに置ける数 */
export const LIMITS: Record<PartKind, number> = {
  dns: 1,
  cdn: 1,
  waf: 1,
  region: 1,
  lb: 1,
  auto: 1,
  app: 6,
  cache: 1,
  db: 1,
  replica: 2,
  queue: 1,
  backup: 1,
  worker: 4,
  monitor: 1,
};

/** 置いたり外したりしたら、全体のつなぎ方を組みなおすパーツ（入口の並びが変わるので） */
const REWIRE = new Set<PartKind>(["cdn", "waf", "lb"]);

const KEY = "odekake_infra_lab_v2";

export const countOf = (d: Design, kind: PartKind) => d.placements.filter((p) => p.kind === kind).length;

/** 新しく置くパーツの名前（1つしか置けないものは種類の名前、いくつも置けるものは番号つき） */
function newId(d: Design, kind: PartKind): NodeId {
  const used = new Set(d.placements.map((p) => p.slot));
  if (LIMITS[kind] === 1) return kind;
  // 予備DB の1台目は、ステージと同じ "replica"
  if (kind === "replica" && !used.has("replica")) return "replica";
  for (let n = kind === "replica" ? 2 : 1; ; n++) if (!used.has(`${kind}${n}`)) return `${kind}${n}`;
}

const sortDesign = (d: Design): Design => ({ placements: [...d.placements].sort((a, b) => compareIds(a.slot, b.slot)), links: d.links });

const sameLink = (a: Link, b: Link) => a.a === b.a && a.b === b.b;

/** パーツを足す。つなぎ方は、ふつうのつなぎ方のうち、そのパーツにかかわる線だけ足す */
export function addPart(d: Design, kind: PartKind): { design: Design; id: NodeId; rewired: boolean } | null {
  if (countOf(d, kind) >= LIMITS[kind]) return null;
  const id = newId(d, kind);
  const placements = [...d.placements, { slot: id, kind, size: 0 }];
  const ids = placements.map((p) => p.slot);
  if (REWIRE.has(kind)) return { design: sortDesign({ placements, links: computeLinks(ids) }), id, rewired: true };
  const add = computeLinks(ids).filter((l) => (l.a === id || l.b === id) && !d.links.some((x) => sameLink(x, l)));
  return { design: sortDesign({ placements, links: [...d.links, ...add] }), id, rewired: false };
}

export function removePart(d: Design, id: NodeId): { design: Design; rewired: boolean } {
  const placements = d.placements.filter((p) => p.slot !== id);
  if (REWIRE.has(kindOf(id))) return { design: { placements, links: computeLinks(placements.map((p) => p.slot)) }, rewired: true };
  return { design: { placements, links: d.links.filter((l) => l.a !== id && l.b !== id) }, rewired: false };
}

export function resizePart(d: Design, id: NodeId, size: number): Design {
  return { ...d, placements: d.placements.map((p) => (p.slot === id ? { ...p, size } : p)) };
}

/** 2つを、つなぐ（つながっていたら外す）。つなげない組み合わせなら null */
export function toggleLink(d: Design, a: string, b: string): { design: Design; added: boolean } | null {
  const l = linkBetween(a, b);
  if (!l) return null;
  const has = d.links.some((x) => sameLink(x, l));
  return { design: { ...d, links: has ? d.links.filter((x) => !sameLink(x, l)) : [...d.links, l] }, added: !has };
}

export const autoWire = (d: Design): Design => ({ ...d, links: computeLinks(d.placements.map((p) => p.slot)) });

/** つなぎ方の、まちがいやすいところ（気づいたことを短く） */
export function designWarnings(d: Design): string[] {
  const ids = d.placements.map((p) => p.slot);
  const from = (a: string) => d.links.filter((l) => l.a === a).map((l) => l.b);
  const into = (b: string) => d.links.filter((l) => l.b === b).map((l) => l.a);
  // 利用者から、アクセスがたどりつけるところ（裏方のつながりもたどる）
  const reach = new Set<string>();
  const stack = [USERS];
  while (stack.length) {
    const a = stack.pop()!;
    for (const b of from(a)) {
      const k = kindOf(b);
      if (reach.has(b) || k === "dns" || k === "backup") continue;
      reach.add(b);
      stack.push(b);
    }
  }
  const out: string[] = [];
  const has = (k: PartKind) => ids.some((s) => kindOf(s) === k);
  if (!ids.some((s) => ["waf", "lb", "app"].includes(kindOf(s)) && into(s).includes(USERS))) {
    out.push("利用者の入口がありません。利用者の列とサーバー（またはロードバランサー・WAF）をつなごう");
  }
  for (const id of ids) {
    const k = kindOf(id);
    const name = slotLabel(id);
    if (k === "dns") {
      if (!into(id).includes(USERS)) out.push(`${name} が利用者とつながっていないので、住所をしらべられません`);
    } else if (k === "auto" || k === "monitor") {
      if (!from(id).length) out.push(`${name} が見張る相手とつながっていません`);
    } else if (k === "backup") {
      if (!into(id).length) out.push(`${name} が DB とつながっていないので、保存できません`);
    } else if (k === "region") {
      if (!into(id).includes(USERS)) out.push(`${name} が利用者とつながっていません`);
    } else if (!reach.has(id)) out.push(`${name} にはアクセスが届きません`);
    if (k === "app" && from(id).some((b) => kindOf(b) === "replica") && !from(id).some((b) => kindOf(b) === "db")) {
      out.push(`${name} は予備DB としかつながっていないので、投稿を書きこめません（書きこみは本番DB だけ）`);
    }
  }
  if (has("region") && !has("dns")) out.push("予備の拠点に案内するには、DNS が必要です");
  return out;
}

export function defaultDesign(parts: ReadonlySet<PartKind>): Design {
  const placements: Placement[] = [...(parts.has("dns") ? [{ slot: "dns", kind: "dns" as PartKind, size: 0 }] : []), { slot: "app1", kind: "app", size: 0 }];
  return { placements, links: computeLinks(placements.map((p) => p.slot)) };
}

/** 覚えておいた設計図を読む（まだ使えないパーツ・おかしなデータは捨てる） */
export function loadDesign(parts: ReadonlySet<PartKind>): Design {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as unknown;
    if (!raw || typeof raw !== "object") return defaultDesign(parts);
    const r = raw as { placements?: unknown; links?: unknown };
    const placements: Placement[] = [];
    const seen = new Set<string>();
    for (const p of Array.isArray(r.placements) ? r.placements : []) {
      const slot = (p as { slot?: unknown }).slot;
      const size = (p as { size?: unknown }).size;
      if (typeof slot !== "string" || seen.has(slot)) continue;
      const kind = kindOf(slot);
      if (!PART_KINDS.includes(kind) || !parts.has(kind) || !/^[a-z]+\d*$/.test(slot)) continue;
      if (placements.filter((x) => x.kind === kind).length >= LIMITS[kind]) continue;
      seen.add(slot);
      placements.push({ slot, kind, size: typeof size === "number" && size >= 0 && size < PARTS[kind].sizes.length ? Math.floor(size) : 0 });
    }
    if (!placements.length) return defaultDesign(parts);
    const links: Link[] = [];
    for (const l of Array.isArray(r.links) ? r.links : []) {
      const a = (l as { a?: unknown }).a, b = (l as { b?: unknown }).b;
      if (typeof a !== "string" || typeof b !== "string") continue;
      if ((a !== USERS && !seen.has(a)) || !seen.has(b)) continue;
      const ok = linkBetween(a, b);
      if (ok && ok.a === a && !links.some((x) => sameLink(x, ok))) links.push(ok);
    }
    return sortDesign({ placements, links });
  } catch {
    return defaultDesign(parts);
  }
}

export function saveDesign(d: Design) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // 覚えられなくても、この画面のあいだはそのまま遊べる
  }
}
