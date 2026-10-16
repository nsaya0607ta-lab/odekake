import { MAP_SIZE, type ParkLot, type Tile } from "./town-builder";

/**
 * How people get round a park: along the gaps between tiles, inside the fence and across open lawn,
 * never through a pond, a fountain or a climbing frame. They come in from the street through a gate.
 */
type Point = { x: number; y: number };
/**
 * An entrance on one side of the park: just inside the fence, on the sidewalk in front, and along the sidewalk both ways.
 * `entry` is set when a part stands on the gate tile: people then keep to the fence as far as the gap beside it.
 */
export type ParkGate = { cell: number; dx: number; dy: number; inside: Point; outside: Point; ends: Point[]; entry?: number[] };
export type ParkWays = { lot: ParkLot; nodes: Point[]; links: { to: number; cost: number }[][]; cells: Map<number, number[]>; blocked: Set<number>; open: number[]; gaps: number[]; gates: ParkGate[] };

const SIDES = [{ dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 }] as const;
/** Distance kept from the fence when walking round the edge of the park. */
const INSET = .14;
/** How far into a tile with a part a shortcut may cut: a walker keeps to the gap. */
const MARGIN = .06;

/** One gate per side that faces a road: on a free tile if there is one, nearest the middle of that side. */
export function parkGates(lot: Pick<ParkLot, "x" | "y" | "width" | "height" | "parts">, tiles: readonly Tile[]) {
  const gates: { cell: number; dx: number; dy: number }[] = [];
  const taken = new Set(lot.parts.filter(p => p.kind !== "path" && p.kind !== "stones").map(p => p.tile));
  for (const { dx, dy } of SIDES) {
    const count = dx ? lot.height : lot.width;
    let cell = -1, best = Infinity;
    for (let k = 0; k < count; k++) {
      const x = dx ? dx < 0 ? lot.x : lot.x + lot.width - 1 : lot.x + k, y = dy ? dy < 0 ? lot.y : lot.y + lot.height - 1 : lot.y + k;
      const nx = x + dx, ny = y + dy, score = Math.abs(k - (count - 1) / 2) + (taken.has(y * MAP_SIZE + x) ? MAP_SIZE : 0);
      if (nx < 0 || ny < 0 || nx >= MAP_SIZE || ny >= MAP_SIZE || tiles[ny * MAP_SIZE + nx] !== "road" || score >= best) continue;
      cell = y * MAP_SIZE + x; best = score;
    }
    if (cell >= 0) gates.push({ cell, dx, dy });
  }
  return gates;
}

/** The walkable network of a park: tile corners joined along the gaps, and the middles of free tiles. */
export function parkWays(lot: ParkLot, tiles: readonly Tile[]): ParkWays {
  const { x: X, y: Y, width: W, height: H } = lot;
  const blocked = new Set(lot.parts.filter(p => p.kind !== "path" && p.kind !== "stones").map(p => p.tile));
  const cellAt = (i: number, j: number) => (Y + j) * MAP_SIZE + X + i, free = (i: number, j: number) => !blocked.has(cellAt(i, j));
  const nodes: Point[] = [], links: { to: number; cost: number }[][] = [];
  const node = (p: Point) => { nodes.push(p); links.push([]); return nodes.length - 1; };
  const link = (a: number, b: number) => { const cost = Math.hypot(nodes[a]!.x - nodes[b]!.x, nodes[a]!.y - nodes[b]!.y); links[a]!.push({ to: b, cost }); links[b]!.push({ to: a, cost }); };
  const inset = (v: number, size: number) => Math.min(size - INSET, Math.max(INSET, v));
  const corners: number[] = [];
  for (let j = 0; j <= H; j++) for (let i = 0; i <= W; i++) corners.push(node({ x: X + inset(i, W), y: Y + inset(j, H) }));
  const corner = (i: number, j: number) => corners[j * (W + 1) + i]!;
  // Between two tiles there is always a way; along the fence only beside a free tile.
  for (let j = 0; j <= H; j++) for (let i = 0; i < W; i++) if (j > 0 && j < H || free(i, j === 0 ? 0 : H - 1)) link(corner(i, j), corner(i + 1, j));
  for (let i = 0; i <= W; i++) for (let j = 0; j < H; j++) if (i > 0 && i < W || free(i === 0 ? 0 : W - 1, j)) link(corner(i, j), corner(i, j + 1));
  const cells = new Map<number, number[]>(), middles = new Map<number, number>(), open: number[] = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const near = [corner(i, j), corner(i + 1, j), corner(i, j + 1), corner(i + 1, j + 1)];
    if (free(i, j)) {
      const m = node({ x: X + i + .5, y: Y + j + .5 });
      for (const c of near) link(m, c);
      for (const n of [i > 0 ? middles.get(cellAt(i - 1, j)) : undefined, j > 0 ? middles.get(cellAt(i, j - 1)) : undefined]) if (n !== undefined) link(m, n);
      middles.set(cellAt(i, j), m); near.push(m); open.push(cellAt(i, j));
    }
    cells.set(cellAt(i, j), near);
  }
  const gaps: number[] = [];
  for (let j = 1; j < H; j++) for (let i = 1; i < W; i++) gaps.push(corner(i, j));
  const road = (p: Point) => tiles[Math.floor(p.y) * MAP_SIZE + Math.floor(p.x)] === "road";
  const gates = parkGates(lot, tiles).map(({ cell, dx, dy }): ParkGate => {
    const ex = cell % MAP_SIZE + .5 + dx * .5, ey = Math.floor(cell / MAP_SIZE) + .5 + dy * .5, busy = blocked.has(cell);
    const inside = { x: ex - dx * (busy ? .1 : .16), y: ey - dy * (busy ? .1 : .16) }, outside = { x: ex + dx * .2, y: ey + dy * .2 };
    // Along the sidewalk in both directions, as far as the road goes.
    const ends = [-1, 1].map(s => ({ x: outside.x + (dy ? s * .9 : 0), y: outside.y + (dx ? s * .9 : 0) })).filter(road);
    const i = cell % MAP_SIZE - X, j = Math.floor(cell / MAP_SIZE) - Y;
    const entry = !busy ? undefined : dx ? [corner(dx < 0 ? 0 : W, j), corner(dx < 0 ? 0 : W, j + 1)] : [corner(i, dy < 0 ? 0 : H), corner(i + 1, dy < 0 ? 0 : H)];
    return { cell, dx, dy, inside, outside, ends: ends.length ? ends : [outside], entry };
  });
  return { lot, nodes, links, cells, blocked, open, gaps, gates };
}

function cellOf(w: ParkWays, p: Point) {
  const { x, y, width, height } = w.lot;
  return (y + Math.min(height - 1, Math.max(0, Math.floor(p.y - y)))) * MAP_SIZE + x + Math.min(width - 1, Math.max(0, Math.floor(p.x - x)));
}
/** A straight walk that only crosses free tiles and the gaps between parts (and its own start and end tiles). */
function clear(w: ParkWays, from: Point, to: Point, ends: number[]) {
  const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / .05);
  for (let s = 1; s < steps; s++) {
    const x = from.x + (to.x - from.x) * s / steps, y = from.y + (to.y - from.y) * s / steps, cell = Math.floor(y) * MAP_SIZE + Math.floor(x);
    if (!w.blocked.has(cell) || ends.includes(cell)) continue;
    const fx = x - Math.floor(x), fy = y - Math.floor(y);
    if (Math.min(fx, 1 - fx, fy, 1 - fy) > MARGIN) return false;
  }
  return true;
}
/**
 * The points to walk through from `from` to `to` (ending with `to`), round anything standing in the park.
 * `starts` / `ends` limit where the walk may join or leave the network (a gate with a part on its tile).
 */
export function parkRoute(w: ParkWays, from: Point, to: Point, starts?: number[], ends?: number[]): Point[] {
  const a = cellOf(w, from), b = cellOf(w, to), pass = [...starts ? [] : [a], ...ends ? [] : [b]];
  if (a === b && !starts && !ends || clear(w, from, to, pass)) return [to];
  const n = w.nodes.length, dist = new Array<number>(n).fill(Infinity), prev = new Array<number>(n).fill(-1), done = new Array<boolean>(n).fill(false);
  for (const s of starts ?? w.cells.get(a) ?? []) dist[s] = Math.hypot(w.nodes[s]!.x - from.x, w.nodes[s]!.y - from.y);
  const finish = new Map((ends ?? w.cells.get(b) ?? []).map(e => [e, Math.hypot(w.nodes[e]!.x - to.x, w.nodes[e]!.y - to.y)]));
  let best = Infinity, last = -1;
  for (;;) {
    let u = -1;
    for (let k = 0; k < n; k++) if (!done[k] && dist[k]! < Infinity && (u < 0 || dist[k]! < dist[u]!)) u = k;
    if (u < 0 || dist[u]! >= best) break;
    done[u] = true;
    const end = finish.get(u);
    if (end !== undefined && dist[u]! + end < best) { best = dist[u]! + end; last = u; }
    for (const { to: v, cost } of w.links[u]!) if (dist[u]! + cost < dist[v]!) { dist[v] = dist[u]! + cost; prev[v] = u; }
  }
  if (last < 0) return [to];
  const points: Point[] = [to];
  for (let u = last; u >= 0; u = prev[u]!) points.unshift(w.nodes[u]!);
  // Cut corners where nothing is in the way, so people stroll rather than march along the grid.
  const smooth: Point[] = [];
  let anchor = from;
  for (let k = 0; k < points.length;) {
    let far = k;
    for (let j = points.length - 1; j > k; j--) if (clear(w, anchor, points[j]!, pass)) { far = j; break; }
    smooth.push(points[far]!); anchor = points[far]!; k = far + 1;
  }
  return smooth;
}
/** Somewhere to stand for a while: a free tile, or the gap between parts when the park is full. */
export function parkStroll(w: ParkWays, random: () => number): Point {
  if (w.open.length) {
    const cell = w.open[Math.floor(random() * w.open.length)]!;
    return { x: cell % MAP_SIZE + .25 + random() * .5, y: Math.floor(cell / MAP_SIZE) + .25 + random() * .5 };
  }
  const pool = w.gaps.length ? w.gaps : w.nodes.map((_, k) => k);
  return { ...w.nodes[pool[Math.floor(random() * pool.length)]!]! };
}
/** Walking length of a route from a point. */
export function routeLength(from: Point, points: readonly Point[]) {
  let total = 0, at = from;
  for (const p of points) { total += Math.hypot(p.x - at.x, p.y - at.y); at = p; }
  return total;
}
