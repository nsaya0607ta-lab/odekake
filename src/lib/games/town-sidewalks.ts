import { MAP_SIZE } from "./town-builder";

/**
 * Where pedestrians walk: the sidewalk corners of every road tile, joined along the curb, across tile edges,
 * and over the road where there is a crosswalk (junctions, marked crossings) or a footbridge. Crossing anywhere
 * else is allowed only when there is no other way, so people keep to the sidewalk and use the zebra crossings.
 */
type Point = { x: number; y: number };
/**
 * A point on a walk. `z` lifts it (a footbridge); `cross` marks the step that ends here as a crossing of the road
 * on `tile`, over the arm towards bit `arm` (1 left, 2 right, 4 up, 8 down; 0 a crossing in the middle of the road).
 */
export type WalkPoint = Point & { z?: number; cross?: { tile: number; arm: number; marked: boolean } };
type Link = { to: number; cost: number; cross?: WalkPoint["cross"]; via?: WalkPoint[] };
export type Walkways = { nodes: Point[]; links: Link[][]; corners: Map<number, readonly [number, number, number, number]> };
/** Distance of the walking line from the tile edge: on the sidewalk, next to the curb. */
export const SIDEWALK = .2;
/** Extra cost of stepping onto the road: small at a crosswalk, large anywhere else; climbing a footbridge costs a little. */
const CROSSWALK = .25, JAYWALK = 3, STAIRS = .6;
const TL = 0, TR = 1, BL = 2, BR = 3;
/** How the road on a tile can be crossed besides its junction crosswalks: a marked crossing in the middle, or a footbridge. */
export type CrossingPlan = { middle?: "x" | "y"; bridge?: { x: number; y: number; z: number }[] };

/** `crosswalk(tile, arms)` says whether the arms of this tile have crosswalks; `plan(tile)` adds mid-road crossings and footbridges. */
export function walkways(roads: ReadonlyMap<number, readonly number[]>, crosswalk: (tile: number, arms: number) => boolean, plan: (tile: number) => CrossingPlan | undefined = () => undefined): Walkways {
  const nodes: Point[] = [], links: Link[][] = [], corners = new Map<number, readonly [number, number, number, number]>();
  const node = (p: Point) => { nodes.push(p); links.push([]); return nodes.length - 1; };
  const link = (a: number, b: number, extra = 0, cross?: WalkPoint["cross"], via?: WalkPoint[]) => {
    let length = 0, at: Point = nodes[a]!;
    for (const p of [...via ?? [], nodes[b]!]) { length += Math.hypot(p.x - at.x, p.y - at.y); at = p; }
    links[a]!.push({ to: b, cost: length + extra, cross, via }); links[b]!.push({ to: a, cost: length + extra, cross, via: via && [...via].reverse() });
  };
  for (const tile of roads.keys()) {
    const x = tile % MAP_SIZE, y = Math.floor(tile / MAP_SIZE), s = SIDEWALK;
    corners.set(tile, [node({ x: x + s, y: y + s }), node({ x: x + 1 - s, y: y + s }), node({ x: x + s, y: y + 1 - s }), node({ x: x + 1 - s, y: y + 1 - s })]);
  }
  for (const [tile, near] of roads) {
    const c = corners.get(tile)!, up = near.includes(tile - MAP_SIZE), down = near.includes(tile + MAP_SIZE), left = near.includes(tile - 1), right = near.includes(tile + 1);
    const marked = crosswalk(tile, near.length), cross = marked ? CROSSWALK : JAYWALK, over = (arm: number) => ({ tile, arm, marked });
    // Each side of the tile is either a curb to walk along or a road arm to cross.
    link(c[TL], c[TR], up ? cross : 0, up ? over(4) : undefined); link(c[BL], c[BR], down ? cross : 0, down ? over(8) : undefined);
    link(c[TL], c[BL], left ? cross : 0, left ? over(1) : undefined); link(c[TR], c[BR], right ? cross : 0, right ? over(2) : undefined);
    // The sidewalks carry on into the next tile of the road.
    if (right) { const n = corners.get(tile + 1)!; link(c[TR], n[TL]); link(c[BR], n[BL]); }
    if (down) { const n = corners.get(tile + MAP_SIZE)!; link(c[BL], n[TL]); link(c[BR], n[TR]); }
    const extra = plan(tile);
    if (extra?.middle) {
      // A zebra crossing in the middle of a straight road, met from both ways along each sidewalk.
      const x = tile % MAP_SIZE, y = Math.floor(tile / MAP_SIZE), alongX = extra.middle === "x";
      const lo = node(alongX ? { x: x + .5, y: y + SIDEWALK } : { x: x + SIDEWALK, y: y + .5 }), hi = node(alongX ? { x: x + .5, y: y + 1 - SIDEWALK } : { x: x + 1 - SIDEWALK, y: y + .5 });
      if (alongX) { link(c[TL], lo); link(lo, c[TR]); link(c[BL], hi); link(hi, c[BR]); } else { link(c[TL], lo); link(lo, c[BL]); link(c[TR], hi); link(hi, c[BR]); }
      link(lo, hi, CROSSWALK, { tile, arm: 0, marked: true });
    }
    // A footbridge from the low corner up the stairs, across and down to the high corner.
    if (extra?.bridge) link(c[TL], c[BR], STAIRS, undefined, extra.bridge);
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
export function sidewalkRoute(w: Walkways, from: { road: number; side: { dx: number; dy: number } }, to: { road: number; side: { dx: number; dy: number } }): WalkPoint[] | null {
  const a = front(w, from.road, from.side), b = front(w, to.road, to.side);
  if (!a || !b) return null;
  if (from.road === to.road && from.side.dx === to.side.dx && from.side.dy === to.side.dy) return [a.point, b.point];
  const n = w.nodes.length, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n), used: (Link | undefined)[] = [];
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
    for (const link of w.links[u]!) if (cost + link.cost < dist[link.to]!) { dist[link.to] = cost + link.cost; prev[link.to] = u; used[link.to] = link; push(dist[link.to]!, link.to); }
  }
  if (last < 0) return null;
  const points: WalkPoint[] = [b.point];
  for (let u = last; u >= 0; u = prev[u]!) {
    const link = prev[u]! >= 0 ? used[u] : undefined;
    points.unshift(link?.cross ? { ...w.nodes[u]!, cross: link.cross } : w.nodes[u]!);
    if (link?.via) points.unshift(...link.via);
  }
  points.unshift(a.point);
  return points;
}
