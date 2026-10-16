import { MAP_SIZE } from "./town-builder";

/**
 * Where pedestrians walk: the sidewalk corners of every road tile, joined along the curb, across tile edges,
 * and over the road where there is a crosswalk (junctions, marked crossings). Crossing anywhere else is
 * allowed only when there is no other way, so people keep to the sidewalk and use the zebra crossings.
 */
type Point = { x: number; y: number };
export type Walkways = { nodes: Point[]; links: { to: number; cost: number }[][]; corners: Map<number, readonly [number, number, number, number]> };
/** Distance of the walking line from the tile edge: on the sidewalk, next to the curb. */
export const SIDEWALK = .2;
/** Extra cost of stepping onto the road: small at a crosswalk, large anywhere else. */
const CROSSWALK = .25, JAYWALK = 3;
const TL = 0, TR = 1, BL = 2, BR = 3;

/** `crosswalk(tile, arms)` says whether pedestrians may cross the road on this tile. */
export function walkways(roads: ReadonlyMap<number, readonly number[]>, crosswalk: (tile: number, arms: number) => boolean): Walkways {
  const nodes: Point[] = [], links: { to: number; cost: number }[][] = [], corners = new Map<number, readonly [number, number, number, number]>();
  const node = (p: Point) => { nodes.push(p); links.push([]); return nodes.length - 1; };
  const link = (a: number, b: number, extra = 0) => { const cost = Math.hypot(nodes[a]!.x - nodes[b]!.x, nodes[a]!.y - nodes[b]!.y) + extra; links[a]!.push({ to: b, cost }); links[b]!.push({ to: a, cost }); };
  for (const tile of roads.keys()) {
    const x = tile % MAP_SIZE, y = Math.floor(tile / MAP_SIZE), s = SIDEWALK;
    corners.set(tile, [node({ x: x + s, y: y + s }), node({ x: x + 1 - s, y: y + s }), node({ x: x + s, y: y + 1 - s }), node({ x: x + 1 - s, y: y + 1 - s })]);
  }
  for (const [tile, near] of roads) {
    const c = corners.get(tile)!, up = near.includes(tile - MAP_SIZE), down = near.includes(tile + MAP_SIZE), left = near.includes(tile - 1), right = near.includes(tile + 1);
    const cross = crosswalk(tile, near.length) ? CROSSWALK : JAYWALK;
    // Each side of the tile is either a curb to walk along or a road arm to cross.
    link(c[TL], c[TR], up ? cross : 0); link(c[BL], c[BR], down ? cross : 0);
    link(c[TL], c[BL], left ? cross : 0); link(c[TR], c[BR], right ? cross : 0);
    // The sidewalks carry on into the next tile of the road.
    if (right) { const n = corners.get(tile + 1)!; link(c[TR], n[TL]); link(c[BR], n[BL]); }
    if (down) { const n = corners.get(tile + MAP_SIZE)!; link(c[BL], n[TL]); link(c[BR], n[TR]); }
  }
  return { nodes, links, corners };
}

/** The sidewalk in front of a building: `side` points from the road tile towards the building. */
function front(w: Walkways, road: number, side: { dx: number; dy: number }) {
  const c = w.corners.get(road); if (!c) return null;
  const x = road % MAP_SIZE + .5 + side.dx * (.5 - SIDEWALK), y = Math.floor(road / MAP_SIZE) + .5 + side.dy * (.5 - SIDEWALK);
  const ends = side.dy < 0 ? [c[TL], c[TR]] : side.dy > 0 ? [c[BL], c[BR]] : side.dx < 0 ? [c[TL], c[BL]] : [c[TR], c[BR]];
  return { point: { x, y }, ends };
}

/** Points along the sidewalks from the front of one building to the front of another, or null when the roads do not connect. */
export function sidewalkRoute(w: Walkways, from: { road: number; side: { dx: number; dy: number } }, to: { road: number; side: { dx: number; dy: number } }): Point[] | null {
  const a = front(w, from.road, from.side), b = front(w, to.road, to.side);
  if (!a || !b) return null;
  if (from.road === to.road && from.side.dx === to.side.dx && from.side.dy === to.side.dy) return [a.point, b.point];
  const n = w.nodes.length, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  const heap: [number, number][] = [];
  const push = (cost: number, at: number) => {
    heap.push([cost, at]);
    for (let j = heap.length - 1; j > 0;) { const p = (j - 1) >> 1; if (heap[p]![0] <= heap[j]![0]) break; [heap[p], heap[j]] = [heap[j]!, heap[p]!]; j = p; }
  };
  const pop = () => {
    const top = heap[0]!, last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let j = 0; ;) { const l = j * 2 + 1, r = l + 1; let m = j; if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l; if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r; if (m === j) break; [heap[m], heap[j]] = [heap[j]!, heap[m]!]; j = m; }
    }
    return top;
  };
  for (const e of a.ends) { const d = Math.hypot(w.nodes[e]!.x - a.point.x, w.nodes[e]!.y - a.point.y); if (d < dist[e]!) { dist[e] = d; push(d, e); } }
  const finish = new Map(b.ends.map(e => [e, Math.hypot(w.nodes[e]!.x - b.point.x, w.nodes[e]!.y - b.point.y)]));
  let best = Infinity, last = -1;
  while (heap.length) {
    const [cost, u] = pop();
    if (done[u] || cost > dist[u]!) continue;
    if (cost >= best) break;
    done[u] = 1;
    const end = finish.get(u);
    if (end !== undefined && cost + end < best) { best = cost + end; last = u; }
    for (const { to: v, cost: step } of w.links[u]!) if (cost + step < dist[v]!) { dist[v] = cost + step; prev[v] = u; push(dist[v]!, v); }
  }
  if (last < 0) return null;
  const points: Point[] = [b.point];
  for (let u = last; u >= 0; u = prev[u]!) points.unshift(w.nodes[u]!);
  points.unshift(a.point);
  return points;
}
