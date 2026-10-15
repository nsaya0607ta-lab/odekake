import { MAP_SIZE, lotTiles, neighbours, type ParkLot, type Tile, type Town } from "./town-builder";
import type { TownEnvironment } from "./town-environment";
import { shade } from "./town-paint";
import { elevationAt, sampleTransportPath } from "./town-transport";

/**
 * People, animals and small effects that bring the town to life. Everything is driven by a seeded
 * random generator and the scene clock, so the same sequence of frames always looks the same.
 */
type Point = { x: number; y: number };
type Bounds = { left: number; top: number; width: number; height: number };
export type LifeAdd = (x: number, y: number, depth: number, paint: (c: CanvasRenderingContext2D) => void, bounds?: Bounds) => void;
const TAU = Math.PI * 2;
const iso = (x: number, y: number, z = 0): Point => ({ x: (x - y) * 32, y: (x + y) * 16 - z });
const hash = (n: number) => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fillStyle = color; c.fill();
}
function stroke(c: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, color: string, width: number) {
  c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.strokeStyle = color; c.lineWidth = width; c.stroke();
}

type Door = { tile: number; kind: Tile; road: number; dx: number; dy: number };
type Look = { top: string; bottom: string; hair: string; skin: string; accent: string; umbrella: string; scale: number; bag: "none" | "randoseru" | "tote" | "briefcase"; hat: boolean; parasol: boolean; dog: string | null; kind: "adult" | "child" | "elder" | "jogger" };
type Walker = { points: Point[]; lengths: number[]; total: number; s: number; speed: number; look: Look; seed: number; phase: number };
/** A place in a park where someone does something: swings, slides, digs in the sand, sits or looks. */
type SpotKind = "swing" | "slide" | "sand" | "seat" | "watch";
type Spot = { key: string; lot: number; kind: SpotKind; x: number; y: number; tile: number; rotation: number; u: number; v: number; z: number; facing: number; child: boolean };
/** `spot` is the place they are heading to or using; `using` counts seconds of use (below 0 while still walking there). */
type Visitor = { lot: number; x: number; y: number; tx: number; ty: number; rest: number; life: number; age: number; look: Look; seed: number; phase: number; spot: string | null; using: number; duration: number };
/** Local (u, v) inside a tile, turned the same way as the park artwork. */
const turn = (x: number, y: number, rotation: number, u: number, v: number): Point => {
  const r = ((rotation % 4) + 4) % 4;
  return r === 1 ? { x: x + 1 - v, y: y + u } : r === 2 ? { x: x + 1 - u, y: y + 1 - v } : r === 3 ? { x: x + v, y: y + 1 - u } : { x: x + u, y: y + v };
};
/** +1 when a local direction points towards the viewer on screen. */
const facingOf = (rotation: number, du: number, dv: number) => { const a = turn(0, 0, rotation, du, dv), o = turn(0, 0, rotation, 0, 0); return a.x - o.x + a.y - o.y >= 0 ? 1 : -1; };
/** Swing seats hang below the top bar; the pendulum swings along the seat's local v. */
const SWING_SEATS = [.365, .625];
const swingSeat = (angle: number) => ({ v: .55 + Math.sin(angle) * .42, z: 25 - 18 * Math.cos(angle) });
/** One trip round the slide: up the steps, across the deck, down the chute and back round to the steps. */
const SLIDE: { from: [number, number, number]; to: [number, number, number]; time: number; sit?: boolean; via?: [number, number][] }[] = [
  { from: [.28, .05, 0], to: [.30, .22, 14], time: 1.5 },
  { from: [.30, .22, 14], to: [.365, .47, 14], time: .6 },
  { from: [.365, .52, 13.5], to: [.555, .88, 2], time: .75, sit: true },
  { from: [.555, .88, 2], to: [.6, .97, 0], time: .35 },
  { from: [.6, .97, 0], to: [.28, .05, 0], time: 3.4, via: [[.9, .8], [.9, .08]] },
];
const SLIDE_TIME = SLIDE.reduce((sum, s) => sum + s.time, 0);
function slidePose(t: number) {
  let k = ((t % SLIDE_TIME) + SLIDE_TIME) % SLIDE_TIME;
  for (const seg of SLIDE) {
    if (k > seg.time) { k -= seg.time; continue; }
    const f = k / seg.time;
    if (!seg.via) return { u: seg.from[0] + (seg.to[0] - seg.from[0]) * f, v: seg.from[1] + (seg.to[1] - seg.from[1]) * f, z: seg.from[2] + (seg.to[2] - seg.from[2]) * f, sit: Boolean(seg.sit), du: seg.to[0] - seg.from[0], dv: seg.to[1] - seg.from[1] };
    const pts = [{ x: seg.from[0], y: seg.from[1] }, ...seg.via.map(([x, y]) => ({ x, y })), { x: seg.to[0], y: seg.to[1] }], line = { points: pts, ...polyline(pts) }, q = at(line, f * line.total);
    return { u: q.x, v: q.y, z: 0, sit: false, du: q.dx, dv: q.dy };
  }
  return { u: .28, v: .05, z: 0, sit: false, du: 0, dv: 1 };
}
type Duck = { x: number; y: number; heading: number; speed: number; seed: number; pond: boolean; turn: number };
type Effect = { kind: "build" | "remove" | "upgrade" | "part"; x: number; y: number; start: number };
type Spark = { x: number; y: number; z: number; vx: number; vy: number; vz: number; color: string; start: number; life: number; size: number };

const SKIN = ["#f1d3b8", "#e8c2a0", "#d9a982", "#f5dcc6"];
const HAIR = ["#2f2a28", "#3b302a", "#5a4334", "#1f1d1f", "#7a6a5c", "#c9c2b8"];
const UMBRELLAS = ["#eef4f6cc", "#eef4f6cc", "#3f5f86", "#b9505a", "#e2b84a", "#4f8c6a", "#8a6fae"];
const PALETTE = {
  summer: ["#f2efe4", "#9cc3d8", "#e9c7a3", "#f3d9a4", "#c7dcc0", "#e7b8b8", "#ffffff"],
  winter: ["#4c5d6e", "#6d5b52", "#3f4b45", "#8a7d6e", "#5e6f87", "#a0574e", "#d8cfbf"],
  mild: ["#7d9cb4", "#c58b6c", "#8faa7c", "#d8c7a3", "#6c7f9a", "#b9a0c4", "#e3dccb"],
};
/** A small seeded generator: the whole town's life is reproducible from its seed. */
class Random {
  constructor(private state: number) {}
  next() { this.state = (this.state + 0x6d2b79f5) | 0; let t = this.state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  pick<T>(items: readonly T[]) { return items[Math.floor(this.next() * items.length)]!; }
}
function polyline(points: Point[]) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y));
  return { lengths, total: lengths[lengths.length - 1]! };
}
function at(w: { points: Point[]; lengths: number[] }, s: number) {
  let i = 1; while (i < w.lengths.length - 1 && w.lengths[i]! < s) i++;
  const a = w.points[i - 1]!, b = w.points[i]!, span = w.lengths[i]! - w.lengths[i - 1]! || 1, t = Math.max(0, Math.min(1, (s - w.lengths[i - 1]!) / span));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dx: (b.x - a.x) / span, dy: (b.y - a.y) / span };
}

/** Draw one small person; `walk` is the stride phase, `facing` is +1 towards the viewer. */
export function drawPerson(c: CanvasRenderingContext2D, p: Point, look: Look, walk: number, facing: number, night: number, options: { rain: boolean; sit?: boolean; jump?: number; detail: boolean }) {
  const s = look.scale, n = (color: string) => shade(color, night), lift = options.jump ?? 0;
  const base = { x: p.x, y: p.y - lift };
  ellipse(c, p.x + .6, p.y + .2, 2.1 * s, .85 * s, "#1e332a33");
  if (!options.detail) {
    ellipse(c, base.x, base.y - 3.6 * s, 1.35 * s, 2.6 * s, n(look.top));
    ellipse(c, base.x, base.y - 7.1 * s, 1.1 * s, 1.1 * s, n(look.skin));
    if (options.rain) ellipse(c, base.x, base.y - 9.6 * s, 4 * s, 1.6 * s, n(look.umbrella));
    return;
  }
  const stride = Math.sin(walk) * 1.15 * s, legTop = base.y - 3.1 * s;
  if (options.sit) {
    stroke(c, base.x - .5 * s, legTop + .4, base.x + 1.6 * s, legTop + 1.1 * s, n(look.bottom), 1.05 * s);
    stroke(c, base.x + .5 * s, legTop + .4, base.x + 2.2 * s, legTop + 1.3 * s, n(look.bottom), 1.05 * s);
  } else {
    stroke(c, base.x - .45 * s, legTop, base.x - .45 * s + stride * .7, base.y, n(look.bottom), 1.05 * s);
    stroke(c, base.x + .45 * s, legTop, base.x + .45 * s - stride * .7, base.y, n(look.bottom), 1.05 * s);
  }
  if (look.bag === "randoseru" && facing < 0) ellipse(c, base.x, base.y - 4.7 * s, 1.5 * s, 1.6 * s, n(look.accent));
  // Body, then arms swinging opposite to the legs.
  c.beginPath(); c.ellipse(base.x, base.y - 4.6 * s, 1.5 * s, 2.15 * s, 0, 0, TAU); c.fillStyle = n(look.top); c.fill();
  const swing = options.sit ? 0 : -stride * .55;
  stroke(c, base.x - 1.2 * s, base.y - 5.6 * s, base.x - 1.4 * s + swing, base.y - 3.3 * s, n(look.top), .8 * s);
  if (!options.rain && !look.parasol) stroke(c, base.x + 1.2 * s, base.y - 5.6 * s, base.x + 1.4 * s - swing, base.y - 3.3 * s, n(look.top), .8 * s);
  if (look.bag === "tote") ellipse(c, base.x + 1.6 * s, base.y - 3.4 * s, .9 * s, 1.1 * s, n(look.accent));
  if (look.bag === "briefcase") ellipse(c, base.x - 1.7 * s, base.y - 3.1 * s, 1 * s, .7 * s, n("#4a3d33"));
  if (look.bag === "randoseru" && facing >= 0) ellipse(c, base.x, base.y - 5.1 * s, 1.55 * s, 1.5 * s, n(look.accent));
  ellipse(c, base.x, base.y - 7.7 * s, 1.18 * s, 1.18 * s, n(look.skin));
  c.beginPath(); c.fillStyle = n(look.hair);
  if (facing >= 0) c.ellipse(base.x, base.y - 8.15 * s, 1.24 * s, .85 * s, 0, Math.PI, TAU);
  else c.ellipse(base.x, base.y - 7.8 * s, 1.24 * s, 1.24 * s, 0, 0, TAU);
  c.fill();
  if (look.hat && !options.rain) ellipse(c, base.x, base.y - 8.8 * s, 1.6 * s, .55 * s, n(look.accent));
  const canopy = options.rain ? look.umbrella : look.parasol ? "#f4efe6dd" : null;
  if (canopy) {
    const top = base.y - 11.2 * s;
    stroke(c, base.x + .9 * s, base.y - 4.8 * s, base.x + .2 * s, top + .6 * s, n("#5a5752"), .45 * s);
    c.beginPath(); c.ellipse(base.x + .2 * s, top + 1.4 * s, 4.4 * s, 1.5 * s, 0, Math.PI, TAU); c.fillStyle = n(canopy); c.fill();
    c.beginPath(); c.moveTo(base.x - 4.2 * s, top + 1.4 * s); c.quadraticCurveTo(base.x + .2 * s, top - 2.2 * s, base.x + 4.6 * s, top + 1.4 * s); c.fill();
  }
}
/** A tiny French bulldog: cream body, grey eye patch and bat ears, like the app's own dog. */
export function drawDog(c: CanvasRenderingContext2D, p: Point, dir: number, step: number, night: number, color = "#efe6d6", options: { sleep?: boolean; wag?: number; jump?: number } = {}) {
  const n = (col: string) => shade(col, night), y = p.y - (options.jump ?? 0), f = dir >= 0 ? 1 : -1;
  ellipse(c, p.x, p.y + .3, 2.3, .8, "#1e332a30");
  if (options.sleep) {
    ellipse(c, p.x, y - 1.1, 2.4, 1.3, n(color));
    ellipse(c, p.x + f * 1.6, y - 1.5, 1.2, 1, n(color));
    ellipse(c, p.x + f * 1.9, y - 1.6, .45, .35, n("#8a8f94"));
    return;
  }
  const legs = Math.sin(step) * .6;
  for (const [u, k] of [[-1, 1], [1, -1]] as const) stroke(c, p.x + u * 1.1, y - 1.3, p.x + u * 1.1 + legs * k * .8, y, n("#d9cdb8"), .7);
  ellipse(c, p.x, y - 2, 2.2, 1.3, n(color));
  const wag = options.wag ? Math.sin(options.wag) * .8 : 0;
  stroke(c, p.x - f * 2.1, y - 2.4, p.x - f * 2.8, y - 3.1 + wag, n(color), .55);
  const hx = p.x + f * 1.9, hy = y - 3.2;
  ellipse(c, hx, hy, 1.35, 1.2, n(color));
  ellipse(c, hx + f * .35, hy - .1, .55, .5, n("#8f9196"));
  for (const k of [-1, 1]) { c.beginPath(); c.moveTo(hx + k * .55 - .3, hy - .8); c.lineTo(hx + k * .9, hy - 2); c.lineTo(hx + k * .9 + .5 * (k > 0 ? 0 : 1), hy - .7); c.closePath(); c.fillStyle = n(color); c.fill(); }
  ellipse(c, hx + f * .9, hy + .25, .32, .25, n("#3c3a3a"));
  ellipse(c, p.x + f * .9, y - 2.7, .9, .35, n("#a9c98a"));
}

export class TownLife {
  private random = new Random(20261014);
  private walkers: Walker[] = [];
  private visitors: Visitor[] = [];
  private ducks: Duck[] = [];
  private effects: Effect[] = [];
  private sparks: Spark[] = [];
  private doors: Door[] = [];
  private roads = new Map<number, number[]>();
  private water: number[] = [];
  private parks: ParkLot[] = [];
  private spots = new Map<string, Spot>();
  private swings: { tile: number; rotation: number }[] = [];
  private blooms: Point[] = [];
  private chimneys: { x: number; y: number; z: number; seed: number }[] = [];
  private tiles: Tile[] | null = null;
  private parkRef: ParkLot[] | null = null;
  private spawnClock = 0;
  private started = false;
  private show: { start: number; night: boolean } | null = null;
  private population = 0;
  private time = 0;

  /** Rebuild doors, water and park spots after construction; existing people keep walking. */
  sync(town: Town, roads: Map<number, number[]>) {
    if (this.tiles === town.tiles && this.parkRef === town.parks) return;
    const tilesChanged = this.tiles !== town.tiles;
    this.tiles = town.tiles; this.parkRef = town.parks; this.roads = roads; this.parks = town.parks.filter(p => p.parts.some(part => part.kind !== "path" && part.kind !== "stones"));
    this.doors = [];
    this.chimneys = [];
    for (let i = 0; i < town.tiles.length; i++) {
      const kind = town.tiles[i]!;
      if (!["house", "shop", "factory", "station", "home"].includes(kind)) continue;
      const x = i % MAP_SIZE, y = Math.floor(i / MAP_SIZE);
      const road = neighbours(x, y).find(n => town.tiles[n] === "road");
      if (road !== undefined) this.doors.push({ tile: i, kind, road, dx: road % MAP_SIZE - x, dy: Math.floor(road / MAP_SIZE) - y });
      if (kind === "house" && (town.levels[i] || 1) === 1 && hash(i * 1.7) > .45) this.chimneys.push({ x: x + .16 + .48, y: y + .15 + .095, z: 32, seed: i });
      if (kind === "home") this.chimneys.push({ x: x + .63, y: y + .3, z: 47, seed: i });
    }
    this.water = town.tiles.flatMap((t, i) => t === "water" ? [i] : []);
    this.population = town.tiles.reduce((sum, t, i) => sum + (t === "house" ? 18 * (town.levels[i] || 1) : 0), 0);
    this.blooms = [];
    for (const lot of town.parks) for (const part of lot.parts) if (["flowers", "arch", "cherry"].includes(part.kind)) this.blooms.push({ x: part.tile % MAP_SIZE + .5, y: Math.floor(part.tile / MAP_SIZE) + .5 });
    this.buildSpots(town.parks);
    for (let i = 0; i < town.tiles.length; i++) if (town.tiles[i] === "grass" && hash(i * 3) > .63 && hash(i * 5) > .8) this.blooms.push({ x: i % MAP_SIZE + .5, y: Math.floor(i / MAP_SIZE) + .5 });
    if (tilesChanged) {
      // People whose street was removed step aside; ducks stay on water.
      this.walkers = this.walkers.filter(w => w.points.every(p => { const t = town.tiles[Math.floor(p.y) * MAP_SIZE + Math.floor(p.x)]; return t !== undefined && t !== "water"; }));
      this.ducks = this.ducks.filter(d => d.pond || this.water.includes(Math.floor(d.y) * MAP_SIZE + Math.floor(d.x)));
      const ponds = town.parks.flatMap(l => l.parts.filter(p => p.kind === "pond").map(p => p.tile));
      const target = Math.min(7, Math.floor(this.water.length / 14));
      while (this.ducks.filter(d => !d.pond).length < target && this.water.length) {
        const i = this.water[Math.floor(this.random.next() * this.water.length)]!;
        this.ducks.push({ x: i % MAP_SIZE + .3 + this.random.next() * .4, y: Math.floor(i / MAP_SIZE) + .3 + this.random.next() * .4, heading: this.random.next() * TAU, speed: .05 + this.random.next() * .05, seed: this.ducks.length * 7 + 3, pond: false, turn: 0 });
      }
      this.ducks = this.ducks.filter(d => !d.pond).concat(ponds.slice(0, 6).map((tile, j) => ({ x: tile % MAP_SIZE + .5, y: Math.floor(tile / MAP_SIZE) + .5, heading: j, speed: .03, seed: tile, pond: true, turn: 0 })));
    }
  }
  /** Where people use the park furniture. Rebuilt with the parks; anyone whose spot was removed walks on. */
  private buildSpots(parks: ParkLot[]) {
    this.spots.clear(); this.swings = [];
    for (const lot of parks) for (const part of lot.parts) {
      const x = part.tile % MAP_SIZE, y = Math.floor(part.tile / MAP_SIZE), r = part.rotation;
      const spot = (slot: number, kind: SpotKind, u: number, v: number, z: number, du: number, dv: number, child = false) => {
        const p = turn(x, y, r, u, v), key = `${part.tile}:${part.kind}:${slot}`;
        this.spots.set(key, { key, lot: lot.id, kind, x: p.x, y: p.y, tile: part.tile, rotation: r, u, v, z, facing: facingOf(r, du, dv), child });
      };
      switch (part.kind) {
        case "swings": this.swings.push({ tile: part.tile, rotation: r }); SWING_SEATS.forEach((u, j) => spot(j, "swing", u, .8, 0, 0, 1, true)); break;
        case "playground": spot(0, "slide", .28, .05, 0, 0, 1, true); break;
        case "sandbox": spot(0, "sand", .45, .6, 3.2, 0, 1, true); spot(1, "sand", .64, .4, 3.2, -1, 0, true); break;
        case "bench": spot(0, "seat", .36, .5, 5.6, 0, 1); spot(1, "seat", .64, .5, 5.6, 0, 1); break;
        case "picnic": spot(0, "seat", .36, .23, 6, 0, 1); spot(1, "seat", .64, .23, 6, 0, 1); spot(2, "seat", .4, .8, 6, 0, -1); spot(3, "seat", .62, .8, 6, 0, -1); break;
        case "gazebo": spot(0, "seat", .5, .3, 9.4, 0, 1); spot(1, "seat", .3, .58, 9.4, 1, 0); break;
        case "fountain": spot(0, "watch", .5, .95, 1, 0, -1, true); spot(1, "watch", .95, .55, 1, -1, 0); spot(2, "watch", .08, .45, 1, 1, 0); break;
        case "pond": spot(0, "watch", .5, .96, 1, 0, -1, true); spot(1, "watch", .96, .6, 1, -1, 0); break;
        case "cherry": case "flowers": case "sculpture": case "clock": case "arch": spot(0, "watch", .5, .93, 1, 0, -1); break;
      }
    }
    for (const v of this.visitors) if (v.spot && !this.spots.has(v.spot)) this.leaveSpot(v);
  }
  private occupied(key: string, except?: Visitor) { return this.visitors.some(v => v !== except && v.spot === key); }
  /** Choose something to do in the park; children like the play equipment, grown-ups the seats and the view. */
  private chooseSpot(v: Visitor) {
    const r = this.random, child = v.look.kind === "child";
    const free = [...this.spots.values()].filter(s => s.lot === v.lot && (child ? s.child : s.kind === "seat" || s.kind === "watch") && !this.occupied(s.key, v));
    if (!free.length || r.next() < .2) return false;
    const spot = r.pick(free);
    v.spot = spot.key; v.using = -1;
    v.duration = spot.kind === "slide" ? SLIDE_TIME * (2 + Math.floor(r.next() * 3)) : spot.kind === "swing" ? 9 + r.next() * 10 : spot.kind === "seat" ? 12 + r.next() * 20 : 6 + r.next() * 8;
    v.tx = spot.x; v.ty = spot.y;
    return true;
  }
  private leaveSpot(v: Visitor) {
    const spot = v.spot ? this.spots.get(v.spot) : undefined;
    // Step off in front of the thing they used, then wander or pick the next thing.
    if (spot && v.using >= 0) { const p = spot.kind === "swing" ? turn(Math.floor(spot.tile % MAP_SIZE), Math.floor(spot.tile / MAP_SIZE), spot.rotation, spot.u, .92) : { x: spot.x, y: spot.y }; v.x = p.x; v.y = p.y; }
    v.spot = null; v.using = 0; v.tx = v.x; v.ty = v.y; v.rest = .5 + this.random.next() * 1.5;
  }
  /** Construction feedback: rising dust for a new building, a dust cloud for demolition, sparkles for upgrades. */
  changed(before: Town, after: Town) {
    for (let i = 0; i < after.tiles.length; i++) {
      const a = before.tiles[i], b = after.tiles[i], x = i % MAP_SIZE + .5, y = Math.floor(i / MAP_SIZE) + .5;
      if (a !== b) this.effects.push({ kind: b === "grass" || b === "water" ? "remove" : "build", x, y, start: this.time });
      else if ((after.levels[i] ?? 0) > (before.levels[i] ?? 0)) this.effects.push({ kind: "upgrade", x, y, start: this.time });
    }
    const parts = (town: Town) => new Set(town.parks.flatMap(l => l.parts.map(p => `${p.tile}:${p.kind}`)));
    const old = parts(before);
    for (const key of parts(after)) if (!old.has(key)) { const tile = Number(key.split(":")[0]); this.effects.push({ kind: "part", x: tile % MAP_SIZE + .5, y: Math.floor(tile / MAP_SIZE) + .5, start: this.time }); }
    const fittings = (town: Town) => new Set(town.attachments.flatMap(a => a.parts.map(p => `${a.tile}:${p}`)));
    const oldFittings = fittings(before);
    for (const key of fittings(after)) if (!oldFittings.has(key)) { const tile = Number(key.split(":")[0]); this.effects.push({ kind: "upgrade", x: tile % MAP_SIZE + .5, y: Math.floor(tile / MAP_SIZE) + .5, start: this.time }); }
    if (this.effects.length > 40) this.effects.splice(0, this.effects.length - 40);
    for (const e of this.effects) if (e.start === this.time) this.burst(e);
  }
  /** Rising scale (0..1, with a small overshoot) of a building that was just built at this tile. */
  rise(tile: number) {
    const x = tile % MAP_SIZE + .5, y = Math.floor(tile / MAP_SIZE) + .5;
    const e = this.effects.find(e => e.x === x && e.y === y && (e.kind === "build" || e.kind === "upgrade") && this.time - e.start < .75);
    if (!e) return 1;
    const t = (this.time - e.start) / .75;
    return e.kind === "upgrade" ? 1 + Math.sin(t * Math.PI) * .05 : t < .7 ? .15 + .95 * (1 - Math.pow(1 - t / .7, 3)) : 1.1 - .1 * ((t - .7) / .3);
  }
  private burst(e: Effect) {
    const count = e.kind === "remove" ? 16 : e.kind === "part" ? 10 : 14;
    for (let j = 0; j < count; j++) {
      const a = this.random.next() * TAU, speed = .4 + this.random.next() * .6;
      const color = e.kind === "remove" ? this.random.pick(["#b5a78d", "#9a8c74", "#cfc2a6"]) : e.kind === "part" ? this.random.pick(["#f5d77e", "#b7d98c", "#f0b9c6"]) : this.random.pick(["#ffe7a3", "#fff6d6", "#c9e8d4"]);
      this.sparks.push({ x: e.x + Math.cos(a) * .2, y: e.y + Math.sin(a) * .2, z: e.kind === "remove" ? 2 : 10 + this.random.next() * 20, vx: Math.cos(a) * speed * .5, vy: Math.sin(a) * speed * .5, vz: e.kind === "remove" ? 10 + this.random.next() * 14 : 6 + this.random.next() * 18, color, start: this.time, life: e.kind === "remove" ? 1.4 : 1.1, size: e.kind === "remove" ? 2.4 + this.random.next() * 2 : 1 + this.random.next() * .8 });
    }
  }
  /** A celebration over the town: fireworks at night, confetti by day. Drawn in screen space by `screen`. */
  celebrate(night: boolean) { this.show = { start: this.time, night }; }
  /** Level-up fireworks or confetti, sized for the screen so they read at any zoom. */
  screen(c: CanvasRenderingContext2D, width: number, height: number) {
    if (!this.show) return;
    const age = this.time - this.show.start;
    if (age > 4.6) { this.show = null; return; }
    if (this.show.night) {
      c.save(); c.globalCompositeOperation = "lighter";
      for (let j = 0; j < 6; j++) {
        const t = age - j * .55; if (t < 0) continue;
        const bx = width * (.15 + hash(j * 3.1 + 1) * .7), by = height * (.27 + hash(j * 5.7 + 2) * .2), lx = bx + (hash(j * 9) - .5) * 40;
        const color = ["#ffcf6e", "#ff8fa3", "#8fd7ff", "#b9f59a", "#e9b6ff", "#ffe9a8"][j % 6]!;
        if (t < .75) {
          // The shell climbs with a short sparkling trail.
          const k = t / .75, ease = 1 - (1 - k) * (1 - k), x = lx + (bx - lx) * ease, y = height * .78 + (by - height * .78) * ease;
          for (let s = 0; s < 6; s++) { c.globalAlpha = (1 - s / 6) * .8; ellipse(c, x + (hash(s + j) - .5) * 2, y + s * 5, 1.4 - s * .18, 1.4 - s * .18, "#ffe7b8"); }
          continue;
        }
        const b = t - .75; if (b > 2) continue;
        const fade = Math.max(0, 1 - b / 2);
        if (b < .35) {
          const glow = c.createRadialGradient(bx, by, 0, bx, by, 46); glow.addColorStop(0, color); glow.addColorStop(1, "rgba(0,0,0,0)");
          c.globalAlpha = (1 - b / .35) * .45; c.fillStyle = glow; c.beginPath(); c.arc(bx, by, 46, 0, TAU); c.fill();
        }
        c.lineCap = "round";
        for (let k = 0; k < 44; k++) {
          const a = k / 44 * TAU + hash(k + j * 50) * .12, speed = 70 + hash(k * 3 + j) * 45, drag = 1 - Math.exp(-b * 2.2);
          const at = (q: number) => ({ x: bx + Math.cos(a) * speed * (1 - Math.exp(-q * 2.2)) / 2.2, y: by + Math.sin(a) * speed * (1 - Math.exp(-q * 2.2)) / 2.2 + 26 * q * q });
          const p = at(b), q = at(Math.max(0, b - .12));
          c.globalAlpha = fade * (.55 + .45 * Math.sin(b * 20 + k)); c.strokeStyle = color; c.lineWidth = 1.6 - drag * .6;
          c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(p.x, p.y); c.stroke();
          ellipse(c, p.x, p.y, 1.3 - drag * .4, 1.3 - drag * .4, "#fff7e6");
        }
      }
      c.restore();
      return;
    }
    // Confetti drifts down over the town by day.
    const colors = ["#f2c14e", "#e27d7d", "#7bb4d9", "#9bd18b", "#c9a2e2", "#f7a35c"];
    c.save();
    for (let k = 0; k < 90; k++) {
      const delay = hash(k * 1.3) * .8, t = age - delay; if (t < 0) continue;
      const x = width * hash(k * 7.1) + Math.sin(t * 2.4 + k) * 18, y = -20 - hash(k * 3.7) * 60 + t * (85 + hash(k * 2.9) * 70);
      if (y > height + 20) continue;
      c.save(); c.globalAlpha = Math.min(1, (4.4 - age) / .8);
      c.translate(x, y); c.rotate(t * (2 + hash(k) * 4) + k); c.scale(1, Math.cos(t * 5 + k) || .05);
      c.fillStyle = colors[k % colors.length]!; c.fillRect(-3, -1.6, 6, 3.2);
      c.restore();
    }
    c.restore();
  }
  private doorPoint(d: Door) {
    const x = d.tile % MAP_SIZE + .5 + d.dx * .4, y = Math.floor(d.tile / MAP_SIZE) + .5 + d.dy * .4;
    return { x, y };
  }
  private route(from: number, to: number): number[] | null {
    if (from === to) return [from];
    const parents = new Map<number, number>([[from, -1]]), queue = [from];
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q]!;
      if (i === to) break;
      for (const n of this.roads.get(i) ?? []) if (!parents.has(n)) { parents.set(n, i); queue.push(n); }
    }
    if (!parents.has(to)) return null;
    const path: number[] = []; let at = to;
    while (at >= 0) { path.push(at); at = parents.get(at) ?? -1; }
    return path.reverse();
  }
  private look(env: TownEnvironment, kind: Look["kind"], purpose: "work" | "school" | "shop" | "home" | "walk", r = this.random): Look {
    const warm = (env.temperature ?? 18) >= 25 || env.season === "summer", cold = (env.temperature ?? 18) < 11 || env.season === "winter";
    const palette = warm ? PALETTE.summer : cold ? PALETTE.winter : PALETTE.mild;
    const child = kind === "child", elder = kind === "elder";
    return {
      top: kind === "jogger" ? r.pick(["#e46f5e", "#4f8fc0", "#f0c35a"]) : purpose === "work" && !warm ? r.pick(["#3d4652", "#4a4f5a", "#5a5f69"]) : r.pick(palette),
      bottom: kind === "jogger" ? "#3a3f47" : r.pick(child ? ["#3f5a7a", "#6d5a4c", "#2f3a4b"] : ["#3b4250", "#56606e", "#6c5c4c", "#2f3540", "#8d8576"]),
      hair: elder ? r.pick(["#c9c2b8", "#d8d2c8", "#9c958c"]) : r.pick(HAIR), skin: r.pick(SKIN),
      accent: purpose === "school" ? r.pick(["#b7413c", "#2f2b2b", "#b7413c", "#7a4a8c"]) : r.pick(["#c97b5b", "#7c9d6c", "#d2b05a", "#8b6fa8", "#5c84a6"]),
      umbrella: child ? r.pick(["#e2b84a", "#e2b84a", "#6fb0d6", "#e88b9b"]) : r.pick(UMBRELLAS),
      scale: child ? .6 : elder ? .76 : .79 + r.next() * .07,
      bag: purpose === "school" ? "randoseru" : purpose === "work" ? r.pick(["briefcase", "briefcase", "none"]) : purpose === "shop" ? r.pick(["tote", "tote", "none"]) : "none",
      hat: (child && warm) || (elder && r.next() < .5) || (cold && r.next() < .3),
      parasol: warm && env.night < .3 && env.weather === "clear" && !child && kind !== "jogger" && r.next() < .3,
      dog: purpose === "walk" && kind !== "jogger" && r.next() < .7 ? r.pick(["#efe6d6", "#c8a27a", "#3d3631", "#f5f1ea"]) : null,
      kind,
    };
  }
  /** Who goes where depends on the hour: commuters to stations and work, children to school, shoppers to shops. */
  private spawnWalker(env: TownEnvironment) {
    if (this.doors.length < 2) return;
    const r = this.random, hour = env.minutes / 60, weekday = env.weekday > 0 && env.weekday < 6;
    const homes = this.doors.filter(d => d.kind === "house" || d.kind === "home");
    const of = (kinds: Tile[]) => this.doors.filter(d => kinds.includes(d.kind));
    let purpose: "work" | "school" | "shop" | "home" | "walk" = "walk", from: Door | undefined, to: Door | undefined, kind: Look["kind"] = "adult";
    const morning = hour >= 6.5 && hour < 9.5, evening = hour >= 16.5 && hour < 20.5, schoolIn = weekday && hour >= 7.1 && hour < 8.4, schoolOut = weekday && hour >= 14.5 && hour < 17;
    const roll = r.next();
    if ((schoolIn || schoolOut) && roll < .3) { purpose = "school"; kind = "child"; }
    else if (weekday && (morning || evening) && roll < .65) purpose = "work";
    else if (hour >= 9.5 && hour < 20 && roll < .55) purpose = "shop";
    else if (roll < .75) { purpose = "walk"; kind = hour < 8 && r.next() < .4 ? "jogger" : r.next() < .35 ? "elder" : "adult"; }
    else purpose = "home";
    const work = of(["station", "factory", "shop"]), shops = of(["shop", "station"]);
    if (purpose === "work") { if (morning) { from = r.pick(homes.length ? homes : this.doors); to = r.pick(work.length ? work : this.doors); } else { from = r.pick(work.length ? work : this.doors); to = r.pick(homes.length ? homes : this.doors); } }
    else if (purpose === "school") { const far = this.doors; if (schoolIn) { from = r.pick(homes.length ? homes : far); to = r.pick(far); } else { from = r.pick(far); to = r.pick(homes.length ? homes : far); } }
    else if (purpose === "shop") { if (r.next() < .5) { from = r.pick(homes.length ? homes : this.doors); to = r.pick(shops.length ? shops : this.doors); } else { from = r.pick(shops.length ? shops : this.doors); to = r.pick(homes.length ? homes : this.doors); } }
    else { from = r.pick(homes.length ? homes : this.doors); to = r.pick(this.doors); }
    if (!from || !to || from.tile === to.tile && purpose !== "walk") return;
    const path = this.route(from.road, to.road);
    if (!path) return;
    const points: Point[] = [this.doorPoint(from)];
    const side = r.next() < .5 ? 1 : -1;
    if (path.length === 1) points.push({ x: path[0]! % MAP_SIZE + .5, y: Math.floor(path[0]! / MAP_SIZE) + .5 });
    else {
      // Walk on the sidewalk: the road centreline, offset to one side of the direction of travel.
      const steps = (path.length - 1) * 6;
      for (let j = 0; j <= steps; j++) {
        const q = sampleTransportPath(path, j / 6), length = Math.hypot(q.dx, q.dy) || 1;
        points.push({ x: q.x + q.dy / length * .3 * side, y: q.y - q.dx / length * .3 * side });
      }
    }
    points.push(this.doorPoint(to));
    const { lengths, total } = polyline(points);
    const speed = (kind === "jogger" ? .55 : kind === "child" ? .3 : kind === "elder" ? .17 : .24) * (.9 + r.next() * .2) * (env.rain > .5 ? 1.15 : 1);
    this.walkers.push({ points, lengths, total, s: 0, speed, look: this.look(env, kind, purpose), seed: Math.floor(r.next() * 1e6), phase: r.next() * TAU });
  }
  private spawnVisitor(env: TownEnvironment): Visitor | undefined {
    if (!this.parks.length) return;
    const r = this.random, lot = r.pick(this.parks), cells = lotTiles(lot), cell = r.pick(cells);
    const play = [...this.spots.values()].some(s => s.lot === lot.id && s.child && s.kind !== "watch");
    const kind: Look["kind"] = play && r.next() < .6 ? "child" : r.next() < .3 ? "elder" : "adult";
    const x = cell % MAP_SIZE + .2 + r.next() * .6, y = Math.floor(cell / MAP_SIZE) + .2 + r.next() * .6;
    const v: Visitor = { lot: lot.id, x, y, tx: x, ty: y, rest: 0, life: 30 + r.next() * 40, age: 0, look: this.look(env, kind, "walk"), seed: Math.floor(r.next() * 1e6), phase: r.next() * TAU, spot: null, using: 0, duration: 0 };
    this.visitors.push(v);
    this.chooseSpot(v);
    return v;
  }
  /** Advance people and animals. `dt` follows the town speed; `ambientDt` is real time. */
  update(dt: number, ambientDt: number, env: TownEnvironment) {
    const population = this.population;
    this.time += ambientDt;
    const r = this.random, daylight = 1 - env.night;
    const walkers = Math.round(Math.min(64, 4 + population / 12) * env.activity);
    const visitors = Math.round(Math.min(32, this.parks.length * 3 + this.spots.size * .6) * env.activity * (.25 + daylight * .75) * (env.rain > .3 || env.snow > 0 ? .15 : 1));
    if (!this.started && this.doors.length > 1) {
      // Open the town mid-day rather than empty: people are already on their way, part-way along.
      this.started = true;
      for (let j = 0; j < walkers; j++) { this.spawnWalker(env); const w = this.walkers[this.walkers.length - 1]; if (w) w.s = r.next() * w.total * .9; }
      for (let j = 0; j < visitors; j++) {
        const v = this.spawnVisitor(env); if (!v) continue;
        v.age = 1 + r.next() * v.life * .5;
        if (v.spot) { v.x = v.tx; v.y = v.ty; v.using = r.next() * v.duration * .6; } else { v.x = v.tx + (r.next() - .5) * .2; v.y = v.ty + (r.next() - .5) * .2; }
      }
    }
    this.spawnClock -= dt;
    if (this.spawnClock <= 0) {
      if (this.walkers.length < walkers) this.spawnWalker(env);
      if (this.visitors.length < visitors) this.spawnVisitor(env);
      this.spawnClock = (this.walkers.length < walkers * .6 ? .15 : .4) + r.next() * .4;
    }
    for (const w of this.walkers) { w.s += w.speed * dt; w.phase += dt * (w.look.kind === "jogger" ? 15 : 9.5); }
    this.walkers = this.walkers.filter(w => w.s < w.total);
    for (const v of this.visitors) {
      v.age += dt; v.phase += dt * 9;
      if (v.spot && v.using >= 0) {
        // Using something runs on real time, so the town speed does not make a swing fly round.
        v.using += ambientDt;
        if (v.using >= v.duration) { this.leaveSpot(v); if (v.age < v.life - 8 && r.next() < .5) this.chooseSpot(v); else v.life = Math.max(v.life, v.age + .6); }
        continue;
      }
      const d = Math.hypot(v.tx - v.x, v.ty - v.y);
      if (d > .03) { const step = Math.min(d, dt * .2); v.x += (v.tx - v.x) / d * step; v.y += (v.ty - v.y) / d * step; }
      else if (v.spot) v.using = 0;
      else if ((v.rest -= dt) <= 0) {
        const lot = this.parks.find(l => l.id === v.lot);
        if (lot && !(r.next() < .45 && this.chooseSpot(v))) { v.tx = lot.x + .2 + r.next() * (lot.width - .4); v.ty = lot.y + .2 + r.next() * (lot.height - .4); v.rest = 2 + r.next() * 5; }
      }
    }
    // Nobody vanishes in mid-swing: people finish what they are doing before they go home.
    this.visitors = this.visitors.filter(v => (v.age < v.life || v.spot && v.using >= 0) && this.parks.some(l => l.id === v.lot));
    for (const duck of this.ducks) {
      if (env.night > .7) continue;
      duck.turn -= dt;
      if (duck.turn <= 0) { duck.heading += (r.next() - .5) * 2.2; duck.turn = 1.5 + r.next() * 3; }
      const nx = duck.x + Math.cos(duck.heading) * duck.speed * dt, ny = duck.y + Math.sin(duck.heading) * duck.speed * dt;
      const ok = duck.pond ? Math.hypot(nx - Math.floor(duck.x) - .5, ny - Math.floor(duck.y) - .5) < .28 : this.water.includes(Math.floor(ny) * MAP_SIZE + Math.floor(nx)) && this.water.includes(Math.floor(ny + Math.sin(duck.heading) * .2) * MAP_SIZE + Math.floor(nx + Math.cos(duck.heading) * .2));
      if (ok) { duck.x = nx; duck.y = ny; } else { duck.heading += Math.PI * (.6 + r.next() * .5); duck.turn = 1; }
    }
    this.effects = this.effects.filter(e => this.time - e.start < 1.6);
    this.sparks = this.sparks.filter(s => this.time - s.start < s.life);
  }
  /** Passengers waiting on station platforms; they board while a train stands at the station. */
  platforms(add: LifeAdd, stations: { tile: number; axis: "x" | "y"; crowd: number }[], env: TownEnvironment, night: number, zoom: number) {
    const detail = zoom > 1.25, rain = false;
    for (const { tile, axis, crowd } of stations) {
      const x = tile % MAP_SIZE, y = Math.floor(tile / MAP_SIZE), count = Math.round(crowd);
      for (let k = 0; k < count; k++) {
        // Each waiting passenger keeps the same look from frame to frame.
        const look = this.look(env, hash(tile + k) < .15 ? "child" : hash(tile * 3 + k) < .2 ? "elder" : "adult", k % 3 ? "work" : "shop", new Random(tile * 7919 + k * 31 + 7));
        const along = .16 + (k + hash(tile + k * 7) * .5) / Math.max(4, count + 1) * .7, u = axis === "x" ? along : .76, v = axis === "x" ? .76 : along;
        const sway = Math.sin(this.time * .7 + k * 1.9) * .4, p = iso(x + u, y + v, 3);
        add(x + u, y + v, .25, c => drawPerson(c, { x: p.x + sway, y: p.y }, look, 0, -1, night, { rain, detail }), { left: -10, top: -18, width: 20, height: 22 });
      }
    }
  }
  /** Add people and animals to the depth-sorted moving layer. */
  collect(add: LifeAdd, town: Town, env: TownEnvironment, night: number, zoom: number) {
    // Up close people get legs, arms, bags and hair; from afar three shapes read the same and cost far less.
    const detail = zoom > 1.25, rain = env.rain > .2 || env.snow > 0;
    for (const w of this.walkers) {
      const p = at(w, w.s), fade = Math.min(1, w.s / .15, (w.total - w.s) / .15);
      const z = elevationAt(town, p.x, p.y, "road"), screen = iso(p.x, p.y, z), facing = p.dy + p.dx > 0 ? 1 : -1;
      add(p.x, p.y, .02, c => {
        if (fade < 1) { c.save(); c.globalAlpha *= Math.max(0, fade); }
        if (w.look.dog) {
          const back = at(w, Math.max(0, w.s - .14)), dz = elevationAt(town, back.x, back.y, "road"), dog = iso(back.x + p.dy * .06, back.y - p.dx * .06, dz);
          stroke(c, screen.x - 1.3 * w.look.scale, screen.y - 3.6, dog.x, dog.y - 2.6, shade("#5a5046", night), .3);
          drawDog(c, dog, iso(p.dx, p.dy).x >= 0 ? 1 : -1, w.phase * 1.4, night, w.look.dog, { wag: w.phase * 2 });
        }
        drawPerson(c, screen, w.look, w.phase, facing, night, { rain, detail });
        if (fade < 1) c.restore();
      }, { left: -10, top: -18, width: 20, height: 22 });
    }
    const riders = new Map<string, Visitor>();
    for (const v of this.visitors) {
      const spot = v.spot && v.using >= 0 ? this.spots.get(v.spot) : undefined;
      if (spot?.kind === "swing") { riders.set(spot.key, v); continue; }
      const fade = Math.min(1, v.age / .6, Math.max(0, v.life - v.age) / .6 || (spot ? 1 : 0));
      const bounds = { left: -10, top: -20, width: 20, height: 24 };
      const draw = (c: CanvasRenderingContext2D, paint: () => void) => {
        if (fade < 1) { c.save(); c.globalAlpha *= Math.max(0, fade); }
        paint();
        if (fade < 1) c.restore();
      };
      if (spot?.kind === "slide") {
        const tx = spot.tile % MAP_SIZE, ty = Math.floor(spot.tile / MAP_SIZE), pose = slidePose(v.using), w = turn(tx, ty, spot.rotation, pose.u, pose.v), p = iso(w.x, w.y, pose.z + 1);
        const facing = facingOf(spot.rotation, pose.du, pose.dv);
        // Above the playground artwork while on the steps, deck or chute; on the ground they sort like anyone else.
        add(pose.z > 0 ? tx + .5 : w.x, pose.z > 0 ? ty + .5 : w.y, pose.z > 0 ? .56 : .03, c => draw(c, () => {
          drawPerson(c, p, v.look, pose.sit ? 0 : v.using * 9, facing, night, { rain, sit: pose.sit, detail });
          if (pose.sit && detail && hash(v.seed) > .4) stroke(c, p.x - 1.4 * v.look.scale, p.y - 6.2 * v.look.scale, p.x - 2.6 * v.look.scale, p.y - 8.6 * v.look.scale, shade(v.look.top, night), .7 * v.look.scale);
        }), { left: -10, top: -20, width: 20, height: 24 });
        continue;
      }
      if (spot) {
        const p = iso(spot.x, spot.y, spot.z), sway = spot.kind === "watch" ? Math.sin(v.using * .8 + v.seed) * .35 : 0;
        // Children at the fountain hop; at the sandbox they crouch and scoop.
        const jump = spot.kind === "watch" && v.look.kind === "child" ? Math.max(0, Math.sin(v.using * 4.2)) * 1.8 : 0;
        add(spot.x, spot.y, spot.kind === "seat" ? .4 : .03, c => draw(c, () => {
          drawPerson(c, { x: p.x + sway, y: p.y }, v.look, 0, spot.facing, night, { rain, sit: spot.kind === "seat" || spot.kind === "sand", jump, detail });
          if (spot.kind === "sand") {
            const k = (v.using * .9 + hash(v.seed)) % 1, hand = { x: p.x - 1.6 * v.look.scale, y: p.y - 2.6 };
            stroke(c, p.x - 1 * v.look.scale, p.y - 5.4 * v.look.scale, hand.x, hand.y - Math.sin(k * Math.PI) * 1.2, shade(v.look.top, night), .8 * v.look.scale);
            if (k > .45) for (let j = 0; j < 3; j++) { const q = (k - .45) / .55; ellipse(c, hand.x - 1.5 * q - j * .6, hand.y - 2.6 * Math.sin(q * Math.PI) + j * .5, .45, .3, shade(j % 2 ? "#e4ce9d" : "#bfa76f", night)); }
          }
        }), bounds);
        continue;
      }
      const p = iso(v.x, v.y, 1), moving = Math.hypot(v.tx - v.x, v.ty - v.y) > .03;
      add(v.x, v.y, .03, c => draw(c, () => drawPerson(c, p, v.look, moving ? v.phase : 0, v.ty >= v.y ? 1 : -1, night, { rain, detail })), bounds);
    }
    // Swing seats hang here rather than in the cached artwork, so they can carry a child back and forth.
    const windSway = Math.min(.12, env.wind / 120);
    for (const { tile, rotation } of this.swings) {
      const tx = tile % MAP_SIZE, ty = Math.floor(tile / MAP_SIZE), facing = facingOf(rotation, 0, 1);
      const at3 = (u: number, v: number, z: number) => { const w = turn(tx, ty, rotation, u, v); return iso(w.x, w.y, z); };
      add(tx + .5, ty + .5, .55, c => {
        SWING_SEATS.forEach((u, j) => {
          const rider = riders.get(`${tile}:swings:${j}`);
          // Pump up to full height, then slow down before hopping off.
          const ramp = rider ? Math.min(1, rider.using / 3, Math.max(0, rider.duration - rider.using) / 2.5) : 0;
          const angle = rider ? ramp * .75 * Math.sin(rider.using * 2.4 + j) : windSway * Math.sin(this.time * 1.3 + j * 1.7 + tile);
          const seat = swingSeat(angle);
          for (const a of [-.055, .055]) stroke(c, at3(u + a, .48, 25).x, at3(u + a, .48, 25).y, at3(u + a, seat.v, seat.z + .6).x, at3(u + a, seat.v, seat.z + .6).y, shade("#d6d7b9", night), .65);
          const corners = [at3(u - .065, seat.v - .05, seat.z), at3(u + .065, seat.v - .05, seat.z), at3(u + .065, seat.v + .05, seat.z), at3(u - .065, seat.v + .05, seat.z)];
          c.beginPath(); corners.forEach((q, k) => k ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.closePath(); c.fillStyle = shade("#be9167", night); c.fill();
          c.beginPath(); c.moveTo(corners[3]!.x, corners[3]!.y); c.lineTo(corners[2]!.x, corners[2]!.y); c.lineTo(corners[2]!.x, corners[2]!.y + 1); c.lineTo(corners[3]!.x, corners[3]!.y + 1); c.closePath(); c.fillStyle = shade("#926b4e", night); c.fill();
          if (rider) drawPerson(c, at3(u, seat.v, seat.z), rider.look, 0, facing, night, { rain, sit: true, detail });
        });
      }, { left: -40, top: -50, width: 80, height: 74 });
    }
    for (const duck of this.ducks) {
      const p = iso(duck.x, duck.y), dir = Math.cos(duck.heading) - Math.sin(duck.heading) >= 0 ? 1 : -1, bob = Math.sin(this.time * 2 + duck.seed) * .25, asleep = env.night > .7;
      add(duck.x, duck.y, -.4, c => {
        if (!asleep) {
          c.strokeStyle = shade("#e4f1ee88", night); c.lineWidth = .5; c.beginPath();
          const back = iso(duck.x - Math.cos(duck.heading) * .18, duck.y - Math.sin(duck.heading) * .18);
          for (const k of [-1, 1]) { c.moveTo(p.x - dir * 1.5, p.y + .4); c.lineTo(back.x + k * 2.2, back.y + 1); }
          c.stroke();
        }
        ellipse(c, p.x, p.y - .6 + bob, 2.1, 1.05, shade(duck.seed % 3 ? "#8a6d4f" : "#b8a58a", night));
        ellipse(c, p.x - dir * 1.2, p.y - 1 + bob, .9, .5, shade("#6b5640", night));
        if (asleep) ellipse(c, p.x + dir * .8, p.y - 1.2 + bob, .85, .7, shade(duck.seed % 3 ? "#3f6e4f" : "#9a8a72", night));
        else {
          ellipse(c, p.x + dir * 1.5, p.y - 2.2 + bob, .85, .85, shade(duck.seed % 3 ? "#3f6e4f" : "#9a8a72", night));
          ellipse(c, p.x + dir * 2.35, p.y - 2.05 + bob, .55, .25, shade("#e3a84a", night));
        }
      }, { left: -8, top: -8, width: 16, height: 12 });
    }
  }
  /** Ground effects under everything else: the flowing river and sun glints on the water. */
  drawWater(c: CanvasRenderingContext2D, env: TownEnvironment, time: number, reduced: boolean) {
    if (!this.water.length) return;
    const t = reduced ? 0 : time, sunny = (1 - env.night) * (1 - env.overcast);
    c.strokeStyle = env.night > .5 ? "rgba(150,175,210,.28)" : "rgba(226,243,240,.55)"; c.lineWidth = .8; c.beginPath();
    for (const i of this.water) {
      const x = i % MAP_SIZE, y = Math.floor(i / MAP_SIZE);
      for (let j = 0; j < 2; j++) {
        const v = ((hash(i * 3 + j) + t * .07) % 1), u = .2 + hash(i * 7 + j) * .6, a = iso(x + u, y + v), b = iso(x + u, y + Math.min(1, v + .16));
        c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
      }
    }
    c.stroke();
    if (sunny > .2) {
      c.fillStyle = `rgba(255,253,236,${(sunny * .8).toFixed(3)})`;
      for (const i of this.water) {
        const tw = Math.sin(t * 2.3 + i * 1.7); if (tw < .55) continue;
        const p = iso(i % MAP_SIZE + hash(i) * .8 + .1, Math.floor(i / MAP_SIZE) + hash(i * 5) * .8 + .1), r = (tw - .55) * 3;
        c.beginPath(); c.moveTo(p.x - r * 1.6, p.y); c.lineTo(p.x, p.y - r * .5); c.lineTo(p.x + r * 1.6, p.y); c.lineTo(p.x, p.y + r * .5); c.closePath(); c.fill();
      }
    }
  }
  /** Over everything: smoke, petals, leaves, insects, fireflies, construction dust and celebrations. */
  overlay(c: CanvasRenderingContext2D, env: TownEnvironment, time: number, night: number, reduced: boolean) {
    const t = reduced ? 0 : time, wind = Math.cos(env.windAngle) * (.4 + env.wind / 30);
    const cold = (env.temperature ?? 18) < 15 || env.season === "winter";
    if (cold && !reduced) for (const ch of this.chimneys) for (let j = 0; j < 3; j++) {
      const k = (t * .18 + j / 3 + hash(ch.seed)) % 1, p = iso(ch.x, ch.y, ch.z);
      c.globalAlpha = (1 - k) * .22; ellipse(c, p.x + k * 9 * wind, p.y - k * 18, 1.8 + k * 4, 1.6 + k * 2.6, shade("#f2f1ea", night * .8));
    }
    c.globalAlpha = 1;
    // Cherry petals in blossom season, falling leaves in late autumn.
    const petals = env.blossom > .2 ? Math.round(40 * env.blossom) : 0, leaves = env.foliage > .45 && env.bare < .8 ? Math.round(26 * env.foliage) : 0;
    if (petals + leaves && !reduced) {
      for (let j = 0; j < petals + leaves; j++) {
        const leaf = j >= petals, cycle = 6 + hash(j) * 5, k = ((t + hash(j * 3) * cycle) % cycle) / cycle;
        const x0 = hash(j * 7 + 1) * MAP_SIZE, y0 = hash(j * 11 + 2) * MAP_SIZE, p = iso(x0 + k * wind * 1.5, y0 + k * .6, 40 * (1 - k));
        const spin = Math.sin(t * 3 + j);
        c.globalAlpha = Math.min(1, (1 - k) * 4);
        ellipse(c, p.x + Math.sin(t * 1.4 + j) * 3, p.y, (leaf ? 1.3 : 1) * Math.abs(spin) + .3, leaf ? .8 : .6, shade(leaf ? ["#d9893f", "#c4553b", "#e0b23f"][j % 3]! : j % 2 ? "#f6c9d4" : "#fbe3e8", night));
      }
      c.globalAlpha = 1;
    }
    // Butterflies on spring and summer days, red dragonflies in early autumn, fireflies on early summer nights.
    const month = new Date(env.time + 9 * 3600_000).getUTCMonth() + 1;
    if (!reduced && this.blooms.length) {
      const day = env.night < .4 && env.rain === 0 && env.snow === 0;
      if (day && (env.season === "spring" || env.season === "summer")) for (const [j, b] of this.blooms.slice(0, 10).entries()) {
        const p = iso(b.x + Math.sin(t * .7 + j) * .35, b.y + Math.cos(t * .9 + j * 2) * .3, 9 + Math.sin(t * 1.3 + j) * 4), flap = Math.abs(Math.sin(t * 14 + j));
        const color = shade(j % 3 ? "#fff6dc" : "#f3d36b", night);
        ellipse(c, p.x - flap * 1.1, p.y, flap * 1.2 + .2, 1.1, color); ellipse(c, p.x + flap * 1.1, p.y, flap * 1.2 + .2, 1.1, color);
      }
      if (day && month >= 8 && month <= 10) for (let j = 0; j < 6; j++) {
        const b = this.blooms[j % this.blooms.length]!, p = iso(b.x + Math.sin(t * .5 + j * 1.3) * 1.2, b.y + Math.sin(t * .37 + j) * 1.2, 18 + Math.sin(t + j) * 3);
        stroke(c, p.x - 1.6, p.y, p.x + 1.6, p.y, "#c84b3a", .7); stroke(c, p.x - .2, p.y - 1, p.x + .2, p.y + 1, "#e8eef0aa", .8);
      }
    }
    if (!reduced && env.night > .6 && (month === 6 || month === 7) && env.rain < .3) {
      for (let j = 0; j < Math.min(30, this.water.length + 8); j++) {
        const i = this.water.length ? this.water[j % this.water.length]! : 0, glow = Math.max(0, Math.sin(t * (1.4 + hash(j)) + j * 2));
        if (glow < .3) continue;
        const p = iso(i % MAP_SIZE + hash(j * 3) + Math.sin(t * .3 + j) * .3, Math.floor(i / MAP_SIZE) + hash(j * 5) + Math.cos(t * .4 + j) * .3, 6 + Math.sin(t + j) * 3);
        c.globalAlpha = glow; ellipse(c, p.x, p.y, 2.4, 2.4, "#d8ff8a33"); ellipse(c, p.x, p.y, .8, .8, "#f1ffb8");
      }
      c.globalAlpha = 1;
    }
    for (const e of this.effects) {
      const k = (this.time - e.start) / 1.6; if (k < 0 || k > 1) continue;
      const p = iso(e.x, e.y);
      if (e.kind !== "part") { c.globalAlpha = (1 - k) * .55; c.strokeStyle = e.kind === "remove" ? "#bdae92" : "#f6e7b8"; c.lineWidth = 1.4; c.beginPath(); c.ellipse(p.x, p.y, 14 + k * 26, 7 + k * 13, 0, 0, TAU); c.stroke(); }
    }
    c.globalAlpha = 1;
    for (const s of this.sparks) {
      const k = (this.time - s.start) / s.life; if (k < 0) continue;
      const age = this.time - s.start, x = s.x + s.vx * age, y = s.y + s.vy * age, z = s.z + s.vz * age - 22 * age * age, p = iso(x, y, Math.max(0, z));
      c.globalAlpha = Math.max(0, 1 - k);
      ellipse(c, p.x, p.y, s.size, s.size * (s.z > 100 ? 1 : .8), s.color);
    }
    c.globalAlpha = 1;
  }
}
