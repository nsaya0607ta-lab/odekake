import { MAP_SIZE, isRailTile, isRoadTile, opens, type Town } from "./town-builder";

export type GroundPoint = { x: number; y: number };
export const DIRECTIONS = [
  { bit: 1, dx: -1, dy: 0 }, { bit: 2, dx: 1, dy: 0 },
  { bit: 4, dx: 0, dy: -1 }, { bit: 8, dx: 0, dy: 1 },
] as const;
export type TransportKind = "road" | "rail";

export function transportMask(town: Town, i: number, kind: TransportKind): number {
  const x = i % MAP_SIZE, y = Math.floor(i / MAP_SIZE);
  return DIRECTIONS.reduce((mask, { bit, dx, dy }) => {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= MAP_SIZE || ny >= MAP_SIZE) return mask;
    const n = ny * MAP_SIZE + nx, tile = town.tiles[n];
    return (kind === "road" ? isRoadTile(tile) : isRailTile(tile)) && opens(town.tiles, i, n, kind) ? mask | bit : mask;
  }, 0);
}

const outlines = new Map<string, GroundPoint[]>();
/** One continuous outline, with open ends exactly on the neighbouring tile edge. */
export function transportOutline(mask: number, inset: number): GroundPoint[] {
  const key = `${mask}:${inset}`, cached = outlines.get(key); if (cached) return cached;
  const cells = new Set([4]);
  if (mask & 1) cells.add(3); if (mask & 2) cells.add(5);
  if (mask & 4) cells.add(1); if (mask & 8) cells.add(7);
  const edges: { a: GroundPoint; b: GroundPoint }[] = [];
  for (const cell of cells) {
    const x = cell % 3, y = Math.floor(cell / 3);
    if (y === 0 || !cells.has(cell - 3)) edges.push({ a: { x, y }, b: { x: x + 1, y } });
    if (x === 2 || !cells.has(cell + 1)) edges.push({ a: { x: x + 1, y }, b: { x: x + 1, y: y + 1 } });
    if (y === 2 || !cells.has(cell + 3)) edges.push({ a: { x: x + 1, y: y + 1 }, b: { x, y: y + 1 } });
    if (x === 0 || !cells.has(cell - 1)) edges.push({ a: { x, y: y + 1 }, b: { x, y } });
  }
  const chain = [edges[0]!.a]; let end = edges[0]!.b;
  while (end.x !== chain[0]!.x || end.y !== chain[0]!.y) {
    chain.push(end);
    const next = edges.find(e => e.a.x === end.x && e.a.y === end.y);
    if (!next) break; end = next.b;
  }
  const coordinates = [0, inset, 1 - inset, 1];
  const points = chain.filter((p, j) => {
    const a = chain[(j + chain.length - 1) % chain.length]!, b = chain[(j + 1) % chain.length]!;
    return (p.x - a.x) * (b.y - p.y) !== (p.y - a.y) * (b.x - p.x);
  }).map(p => ({ x: coordinates[p.x]!, y: coordinates[p.y]! }));
  outlines.set(key, points); return points;
}

/** Bridge decks meet a slope on the adjoining land, rather than a vertical 5px step. */
export function transportHeight(town: Town, i: number, x: number, y: number, kind: TransportKind): number {
  if (town.terrain[i]) return 5;
  const tx = i % MAP_SIZE, ty = Math.floor(i / MAP_SIZE), mask = transportMask(town, i, kind);
  let height = 0;
  for (const { bit, dx, dy } of DIRECTIONS) if (mask & bit) {
    const n = (ty + dy) * MAP_SIZE + tx + dx;
    if (town.terrain[n]) height = Math.max(height, ((x - .5) * dx + (y - .5) * dy) * 10);
  }
  return Math.max(0, height);
}

export function stationAxis(town: Town, i: number): "x" | "y" {
  const mask = transportMask(town, i, "rail");
  const x = Number(Boolean(mask & 1)) + Number(Boolean(mask & 2));
  const y = Number(Boolean(mask & 4)) + Number(Boolean(mask & 8));
  return y > x ? "y" : "x";
}

export type TrackPath = { a: GroundPoint; b: GroundPoint; curve: boolean };
export function trackPaths(mask: number): TrackPath[] {
  const ends = DIRECTIONS.filter(d => mask & d.bit).map(d => ({ x: .5 + d.dx * .5, y: .5 + d.dy * .5 }));
  if (!ends.length) return [{ a: { x: .12, y: .5 }, b: { x: .88, y: .5 }, curve: false }];
  if (ends.length === 1) {
    const a = ends[0]!; return [{ a, b: { x: .5 - (a.x - .5) * .3, y: .5 - (a.y - .5) * .3 }, curve: false }];
  }
  return ends.flatMap((a, j) => ends.slice(j + 1).map(b => ({ a, b, curve: a.x !== b.x && a.y !== b.y })));
}

export function trackPoint(path: TrackPath, t: number) {
  const { a, b, curve } = path, u = 1 - t;
  const x = curve ? u * u * a.x + u * t + t * t * b.x : a.x + (b.x - a.x) * t;
  const y = curve ? u * u * a.y + u * t + t * t * b.y : a.y + (b.y - a.y) * t;
  const dx = curve ? 2 * (u * (.5 - a.x) + t * (b.x - .5)) : b.x - a.x;
  const dy = curve ? 2 * (u * (.5 - a.y) + t * (b.y - .5)) : b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x, y, dx: dx / length, dy: dy / length };
}

/** Round turns across tile centres, keeping a continuous position and heading. */
export function sampleTransportPath(route: number[], position: number) {
  const segment = Math.max(0, Math.min(route.length - 2, Math.floor(position))), t = Math.max(0, Math.min(1, position - segment));
  const at = (j: number) => ({ x: route[j]! % MAP_SIZE + .5, y: Math.floor(route[j]! / MAP_SIZE) + .5 });
  const a = at(segment), b = at(segment + 1), incoming = segment > 0 ? at(segment - 1) : null, outgoing = segment + 2 < route.length ? at(segment + 2) : null;
  const start = t < .5 ? incoming : a, center = t < .5 ? a : b, end = t < .5 ? b : outgoing;
  if (start && end && (center.x - start.x !== end.x - center.x || center.y - start.y !== end.y - center.y)) {
    const u = t < .5 ? t + .5 : t - .5, v = 1 - u;
    const p = { x: (start.x + center.x) / 2, y: (start.y + center.y) / 2 }, q = { x: (center.x + end.x) / 2, y: (center.y + end.y) / 2 };
    // A small semicircle makes a dead-end reversal continuous in the driving lane.
    if (start.x === end.x && start.y === end.y) {
      const dx = center.x - start.x, dy = center.y - start.y, angle = u * Math.PI;
      const vx = dx * Math.cos(angle) * .24 - dy * Math.sin(angle) * .13, vy = dy * Math.cos(angle) * .24 + dx * Math.sin(angle) * .13, length = Math.hypot(vx, vy);
      return { x: p.x + dx * Math.sin(angle) * .24 + dy * Math.cos(angle) * .13, y: p.y + dy * Math.sin(angle) * .24 - dx * Math.cos(angle) * .13, dx: vx / length, dy: vy / length, laneApplied: true };
    }
    const dx = v * (center.x - p.x) + u * (q.x - center.x), dy = v * (center.y - p.y) + u * (q.y - center.y), length = Math.hypot(dx, dy) || 1;
    return { x: v * v * p.x + 2 * v * u * center.x + u * u * q.x, y: v * v * p.y + 2 * v * u * center.y + u * u * q.y, dx: dx / length, dy: dy / length, laneApplied: false };
  }
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dx: b.x - a.x, dy: b.y - a.y, laneApplied: false };
}

export type TransportRoute = { tiles: number[]; samples: { position: number; distance: number }[]; length: number };
export function measureTransportRoute(tiles: number[]): TransportRoute {
  const samples = [{ position: 0, distance: 0 }]; let distance = 0, previous = sampleTransportPath(tiles, 0);
  for (let step = 1; step <= (tiles.length - 1) * 24; step++) {
    const position = step / 24, point = sampleTransportPath(tiles, position);
    distance += Math.hypot(point.x - previous.x, point.y - previous.y); samples.push({ position, distance }); previous = point;
  }
  return { tiles, samples, length: distance };
}
export function sampleTransportDistance(route: TransportRoute, distance: number) {
  let low = 0, high = route.samples.length - 1;
  const target = Math.max(0, Math.min(route.length, distance));
  while (low + 1 < high) { const mid = (low + high) >>> 1; if (route.samples[mid]!.distance < target) low = mid; else high = mid; }
  const a = route.samples[low]!, b = route.samples[high]!, t = (target - a.distance) / (b.distance - a.distance || 1);
  return sampleTransportPath(route.tiles, a.position + (b.position - a.position) * t);
}

export function elevationAt(town: Town, x: number, y: number, kind: TransportKind) {
  const tx = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(x))), ty = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(y)));
  return transportHeight(town, ty * MAP_SIZE + tx, x - tx, y - ty, kind);
}

