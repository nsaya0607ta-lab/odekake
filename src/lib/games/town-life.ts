import { MAP_SIZE, isRoadTile, lotTiles, neighbours, type ParkLot, type ParkPart, type Tile, type Town } from "./town-builder";
import type { TownEnvironment } from "./town-environment";
import { TAU, drawBicycle, drawDog, drawPerson, drawPigeon, ellipse, stroke, type Look, type Point } from "./town-figures";
import { parkArtVariant } from "./town-park-art";
import { PAINTED, PART_MOTION, PART_SPOTS, illuminationSeason, motionDepth, motionKit, spotDuration, spotOpen, type PartFrame, type PartState, type Rider, type SpotKind, type Who } from "./town-park-motion";
import { parkRoute, parkStroll, parkWays, routeLength, type ParkGate, type ParkWays } from "./town-park-paths";
import { shade } from "./town-paint";
import type { RoadLayout } from "./town-road-parts";
import { sidewalkRoute, walkways, type WalkPoint, type Walkways } from "./town-sidewalks";
import { elevationAt } from "./town-transport";

export { drawDog, drawPerson } from "./town-figures";

/**
 * People, animals and small effects that bring the town to life. Everything is driven by a seeded
 * random generator and the scene clock, so the same sequence of frames always looks the same.
 */
type Bounds = { left: number; top: number; width: number; height: number };
export type LifeAdd = (x: number, y: number, depth: number, paint: (c: CanvasRenderingContext2D) => void, bounds?: Bounds) => void;
const iso = (x: number, y: number, z = 0): Point => ({ x: (x - y) * 32, y: (x + y) * 16 - z });
const hash = (n: number) => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

type Door = { tile: number; kind: Tile; road: number; dx: number; dy: number };
type Walker = {
  points: WalkPoint[]; lengths: number[]; total: number; s: number; speed: number; look: Look; seed: number; phase: number;
  /** Seconds left standing at a post box or a vending machine, the way they face meanwhile, and the stops passed. */
  pause: number; face: number; passed: number[];
  /** Riding a bicycle along the sidewalk (in the frame's colour): faster, and nobody stops to post a letter on a bike. */
  bike: string | null;
};
/** People waiting at one side of a bus stop. */
type Queue = { key: string; tile: number; side: -1 | 1; x: number; y: number; along: { dx: number; dy: number }; toRoad: { dx: number; dy: number }; shelter: boolean; count: number; clock: number; looks: Look[]; boarding: boolean };
/** A post box or vending machine people may stop at on their way: where they stand and the way they face. */
type Stop = { x: number; y: number; dx: number; dy: number; kind: "postbox" | "vending" };
/** A place in a park where someone does something: plays on a part, sits, looks, queues, or plays on the lawn. */
type Spot = { key: string; lot: number; kind: SpotKind; part: ParkPart | null; slot: number; x: number; y: number; tile: number; rotation: number; u: number; v: number; z: number; facing: number; side: number; who: Who };
/**
 * Games on an open patch of lawn: a picnic blanket, cherry-blossom viewing, catch, tag, a kite, soap bubbles, fetch with the dog;
 * and while it snows, building a snowman and a snowball fight.
 */
type Lawn = "blanket" | "hanami" | "ball" | "tag" | "kite" | "bubbles" | "fetch" | "snowman" | "snowball";
const SNOW_GAMES: ReadonlySet<Lawn> = new Set<Lawn>(["snowman", "snowball"]);
const LAWN: Record<Lawn, { who: Who; slots: [number, number][]; weight: number }> = {
  snowman: { who: "child", slots: [[.28, .6], [.72, .56]], weight: 4 },
  snowball: { who: "child", slots: [[.16, .54], [.84, .46]], weight: 3 },
  blanket: { who: "any", slots: [[.36, .44], [.63, .42], [.5, .63]], weight: 3 },
  hanami: { who: "adult", slots: [[.32, .42], [.6, .36], [.66, .6], [.38, .64]], weight: 5 },
  ball: { who: "child", slots: [[.16, .52], [.84, .48]], weight: 2 },
  tag: { who: "child", slots: [[.24, .5], [.76, .5]], weight: 2 },
  kite: { who: "any", slots: [[.5, .64]], weight: 2 },
  bubbles: { who: "child", slots: [[.5, .58]], weight: 2 },
  fetch: { who: "adult", slots: [[.3, .62]], weight: 2 },
};
/**
 * `spot` is the place they are heading to or using; `using` counts seconds of use (below 0 while still walking there).
 * `path` is the rest of the walk there, round the parts; `leaving` means on the way out through a gate.
 */
type Visitor = { lot: number; x: number; y: number; tx: number; ty: number; rest: number; life: number; age: number; look: Look; seed: number; phase: number; spot: string | null; using: number; duration: number; lawn?: Lawn; path?: Point[]; leaving?: boolean; patience?: number };
type Pigeon = { lot: number; x: number; y: number; dir: number; peck: number; wait: number; fly: { fx: number; fy: number; tx: number; ty: number; t: number } | null; seed: number };
type MotionPart = { tile: number; kind: ParkPart; rotation: number; x: number; y: number; variant: number; depth: number };
/** Local (u, v) inside a tile, turned the same way as the park artwork. */
const turn = (x: number, y: number, rotation: number, u: number, v: number): Point => {
  const r = ((rotation % 4) + 4) % 4;
  return r === 1 ? { x: x + 1 - v, y: y + u } : r === 2 ? { x: x + 1 - u, y: y + 1 - v } : r === 3 ? { x: x + v, y: y + 1 - u } : { x: x + u, y: y + v };
};
/** +1 when a local direction points towards the viewer on screen. */
const facingOf = (rotation: number, du: number, dv: number) => { const a = turn(0, 0, rotation, du, dv), o = turn(0, 0, rotation, 0, 0); return a.x - o.x + a.y - o.y >= 0 ? 1 : -1; };
/** Screen side (+1 right, -1 left) of a local direction. */
const sideOf = (rotation: number, du: number, dv: number) => { const a = turn(0, 0, rotation, du, dv), o = turn(0, 0, rotation, 0, 0); return a.x - o.x - (a.y - o.y) >= 0 ? 1 : -1; };
const BALLOONS = ["#e8604f", "#f2c43c", "#4f8fc0", "#5aa469", "#e889b5", "#9a7bcc"], ICE_CREAM = ["#f6c6d4", "#fbf3e6", "#a8d8b9", "#8a5a3c", "#f5d66b"];
/** Feet point that puts the hips of a sitting person on the seat. */
const onSeat = (p: Point, look: Look) => ({ x: p.x, y: p.y + 2.8 * look.scale });
/** A picnic blanket (gingham) or the blue sheet of a cherry-blossom party, with a basket and lunch boxes. */
function blanket(c: CanvasRenderingContext2D, cx: number, cy: number, game: Lawn, night: number) {
  const at = (u: number, v: number) => iso(cx + u, cy + v, 1.05), n = (color: string) => shade(color, night);
  const quad = (u0: number, v0: number, u1: number, v1: number, color: string) => { const ps = [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)]; c.beginPath(); ps.forEach((q, j) => j ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.closePath(); c.fillStyle = n(color); c.fill(); };
  if (game === "hanami") {
    quad(.16, .22, .84, .8, "#3f7fd0");
    for (const u of [.38, .62]) { const a = at(u, .22), b = at(u, .8); stroke(c, a.x, a.y, b.x, b.y, n("#7aa8ea"), .4); }
    quad(.44, .44, .56, .52, "#e9d7b0"); quad(.46, .46, .5, .5, "#d9534f"); quad(.51, .46, .55, .5, "#f6f1e6");
    const bottle = at(.57, .55); ellipse(c, bottle.x, bottle.y - 1.4, .5, 1.4, n("#5f8f5a"));
    return;
  }
  quad(.22, .28, .78, .74, "#f6efe2");
  for (let j = 0; j < 4; j++) { quad(.22 + j * .14, .28, .29 + j * .14, .74, "#e0757066"); quad(.22, .28 + j * .115, .78, .335 + j * .115, "#e0757066"); }
  const basket = at(.7, .34); ellipse(c, basket.x, basket.y - 1, 2.2, 1.4, n("#a0703f")); ellipse(c, basket.x, basket.y - 1.6, 2, .8, n("#c08a52"));
  c.beginPath(); c.ellipse(basket.x, basket.y - 1.6, 1.6, 1.8, 0, Math.PI, TAU); c.strokeStyle = n("#7a5530"); c.lineWidth = .4; c.stroke();
  quad(.42, .46, .5, .53, "#d9534f"); quad(.52, .46, .58, .53, "#f2c43c");
}
function kite(c: CanvasRenderingContext2D, hand: Point, time: number, env: TownEnvironment, night: number, seed: number) {
  const wx = Math.cos(env.windAngle), wy = Math.sin(env.windAngle), n = (color: string) => shade(color, night);
  const k = { x: hand.x + wx * 34 + Math.sin(time * .8 + seed) * 3, y: hand.y - 58 + wy * 8 + Math.sin(time * 1.3 + seed) * 2.5 };
  c.beginPath(); c.moveTo(hand.x, hand.y); c.quadraticCurveTo((hand.x + k.x) / 2 + wx * 5, (hand.y + k.y) / 2 + 12, k.x, k.y + 3.5); c.strokeStyle = n("#f4f1e8"); c.lineWidth = .3; c.stroke();
  const top = { x: k.x, y: k.y - 5 }, right = { x: k.x + 4, y: k.y - .5 }, bottom = { x: k.x, y: k.y + 4.5 }, left = { x: k.x - 4, y: k.y - .5 };
  const tri = (a: Point, b: Point, color: string) => { c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(k.x, k.y - .5); c.closePath(); c.fillStyle = n(color); c.fill(); };
  tri(top, right, "#e15b4f"); tri(right, bottom, "#f0c14b"); tri(bottom, left, "#4f8fc0"); tri(left, top, "#5aa469");
  stroke(c, top.x, top.y, bottom.x, bottom.y, n("#6b5a46"), .3); stroke(c, left.x, left.y, right.x, right.y, n("#6b5a46"), .3);
  c.beginPath(); c.moveTo(bottom.x, bottom.y);
  const tail: Point[] = [];
  for (let j = 1; j <= 7; j++) { const q = { x: bottom.x - wx * j * 2.4, y: bottom.y + j * 1.5 + Math.sin(time * 5 + j * .9) * 1.3 }; tail.push(q); c.lineTo(q.x, q.y); }
  c.strokeStyle = n("#f4f1e8"); c.lineWidth = .35; c.stroke();
  tail.forEach((q, j) => { if (j % 2) ellipse(c, q.x, q.y, .9, .45, n(j % 4 === 1 ? "#e15b4f" : "#f0c14b")); });
}
/** What people are doing, in the words of the park's card. Quiet things (looking, drinking) only count as people. */
const DOING: Partial<Record<SpotKind, string>> = {
  swing: "ブランコ", slide: "すべり台", sand: "砂遊び", seesaw: "シーソー", spring: "ゆらゆら遊具", globe: "回転ジャングル", carousel: "メリーゴーランド", climb: "ジャングルジム",
  splash: "水遊び", bars: "鉄棒", hoop: "バスケット", queue: "アイス", audience: "演奏", seat: "ひと休み",
};
const PLAYING: Record<Lawn, string> = { blanket: "ピクニック", hanami: "お花見", ball: "キャッチボール", tag: "おにごっこ", kite: "たこあげ", bubbles: "シャボン玉", fetch: "犬とボール遊び", snowman: "雪だるま", snowball: "雪合戦" };
/** A snowman of two packed balls; `size` 0..1 grows while children build it and shrinks as it melts. Finished, it gets a face, arms and a hat. */
function snowman(c: CanvasRenderingContext2D, p: Point, size: number, night: number, seed: number) {
  const n = (color: string) => shade(color, night), r1 = 3.4 * Math.min(1, size / .6), r2 = size > .55 ? 2.3 * Math.min(1, (size - .55) / .3) : 0;
  if (r1 < .2) return;
  ellipse(c, p.x + 1, p.y + .3, r1 * 1.15, r1 * .4, "#3a4b5a26");
  ellipse(c, p.x, p.y - r1 * .85, r1, r1 * .9, n("#dbe4ec")); ellipse(c, p.x - r1 * .22, p.y - r1 * 1.02, r1 * .7, r1 * .6, n("#f7fafc"));
  if (r2 < .2) return;
  const h = { x: p.x + .1, y: p.y - r1 * 1.6 - r2 * .8 };
  ellipse(c, h.x, h.y, r2, r2 * .92, n("#dee6ed")); ellipse(c, h.x - r2 * .2, h.y - r2 * .16, r2 * .68, r2 * .58, n("#f8fbfd"));
  if (size < .95) return;
  for (const e of [-1, 1]) ellipse(c, h.x + e * .75, h.y - .3, .28, .28, n("#2e2a28"));
  c.beginPath(); c.moveTo(h.x, h.y + .15); c.lineTo(h.x + 1.9, h.y + .5); c.lineTo(h.x, h.y + .75); c.closePath(); c.fillStyle = n("#e8823a"); c.fill();
  for (let j = 0; j < 2; j++) ellipse(c, p.x + .1, p.y - r1 * (1.2 - j * .55), .3, .3, n("#3a3532"));
  for (const e of [-1, 1]) stroke(c, p.x + e * r1 * .78, p.y - r1 * 1.3, p.x + e * (r1 + 2.6), p.y - r1 * 1.85 - (e > 0 ? .6 : 0), n("#6b5236"), .4);
  c.beginPath(); c.moveTo(h.x - 1.6, h.y - r2 * .62); c.lineTo(h.x + 1.6, h.y - r2 * .62); c.lineTo(h.x + 1.15, h.y - r2 * .62 - 2.2); c.lineTo(h.x - 1.15, h.y - r2 * .62 - 2.2); c.closePath();
  c.fillStyle = n(seed % 2 ? "#c94b3f" : "#3f6fa8"); c.fill();
}
/** Where the Christmas lights wind round each kind of park tree: from the bottom of the crown to the top, in screen pixels. */
const CROWNS: Partial<Record<ParkPart, { z0: number; z1: number; w0: number; w1: number; turns: number }>> = {
  tree: { z0: 12, z1: 26, w0: 9, w1: 4, turns: 3 }, cherry: { z0: 17, z1: 33, w0: 12, w1: 5, turns: 3 }, pine: { z0: 9, z1: 34, w0: 10.5, w1: 1.5, turns: 4 },
  maple: { z0: 13, z1: 26, w0: 13, w1: 6, turns: 3 }, ginkgo: { z0: 15, z1: 37, w0: 7.5, w1: 2, turns: 4 },
};
/** Twinkling lights wound round a tree, and a star on top of a pine dressed as a Christmas tree. */
function treeLights(c: CanvasRenderingContext2D, p: Point, kind: ParkPart, time: number, seed: number, detail: boolean) {
  const crown = CROWNS[kind]; if (!crown) return;
  const pine = kind === "pine", count = pine ? 34 : 26;
  c.save(); c.globalCompositeOperation = "lighter";
  for (let j = 0; j < count; j++) {
    const t = (j + .5) / count, a = t * TAU * crown.turns + seed, front = Math.sin(a);
    if (front < -.35) continue;
    const w = crown.w0 + (crown.w1 - crown.w0) * t, x = p.x + Math.cos(a) * w, y = p.y - crown.z0 - (crown.z1 - crown.z0) * t + front * w * .3;
    const on = .55 + .45 * Math.sin(time * (2 + hash(j + seed) * 2) + j * 2.1), color = pine ? ["#ff6b6b", "#ffd15c", "#6bc4ff", "#8dff9a", "#ffffff"][j % 5]! : "#ffe3a0";
    if (detail) { c.globalAlpha = on * .3; ellipse(c, x, y, 2, 2, color); }
    c.globalAlpha = .55 + on * .45; ellipse(c, x, y, .55, .55, color);
  }
  if (pine) {
    const top = { x: p.x, y: p.y - crown.z1 - 3 };
    c.globalAlpha = .45; ellipse(c, top.x, top.y, 3.6, 3.6, "#ffd84a");
    c.globalAlpha = 1; c.beginPath();
    for (let j = 0; j < 10; j++) { const r = j % 2 ? .9 : 2.2, a = -Math.PI / 2 + j * Math.PI / 5; c.lineTo(top.x + Math.cos(a) * r, top.y + Math.sin(a) * r); }
    c.closePath(); c.fillStyle = "#ffe066"; c.fill();
  }
  c.restore();
}
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
function at(w: { points: (Point & { z?: number })[]; lengths: number[] }, s: number) {
  let i = 1; while (i < w.lengths.length - 1 && w.lengths[i]! < s) i++;
  const a = w.points[i - 1]!, b = w.points[i]!, span = w.lengths[i]! - w.lengths[i - 1]! || 1, t = Math.max(0, Math.min(1, (s - w.lengths[i - 1]!) / span));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t, dx: (b.x - a.x) / span, dy: (b.y - a.y) / span };
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
  /** The sidewalk network, rebuilt when the roads change. */
  private walkway: Walkways | null = null;
  private water: number[] = [];
  private parks: ParkLot[] = [];
  private spots = new Map<string, Spot>();
  private ways = new Map<number, ParkWays>();
  private motions: MotionPart[] = [];
  private states = new Map<number, PartState>();
  private lawnPlans = new Map<number, Lawn>();
  /** Snowmen on the lawn by tile, 0..1 built; they stay while it snows and melt away after. */
  private snowmen = new Map<number, number>();
  /** Park trees that are lit up at Christmas. */
  private lit: { x: number; y: number; kind: ParkPart; seed: number }[] = [];
  private cherries = new Set<number>();
  private fallers: { x: number; y: number; kind: ParkPart }[] = [];
  private pigeons: Pigeon[] = [];
  private lots: ParkLot[] = [];
  private env: TownEnvironment | null = null;
  /** Set by the renderer when the viewer prefers reduced motion: decorative turning and splashing stop. */
  reduced = false;
  /** Level crossings whose barriers are down: people wait before them. Set by the renderer every frame. */
  closed: ReadonlySet<number> = new Set();
  /** May someone step onto the road here now (the walk light, cars coming)? Set by the renderer. */
  mayCross: (cross: NonNullable<WalkPoint["cross"]>, along: "x" | "y") => boolean = () => true;
  /** People on the road right now, by `${tile}:${arm}` (arm 0: a crossing in the middle of the road). Cars wait for them. */
  crossing = new Map<string, number>();
  /** Buses standing at a stop: the stop tile and the side whose passengers get on. Set by the renderer. */
  boarding = new Map<number, -1 | 1>();
  private roadParts: ReadonlyMap<number, RoadLayout> = new Map();
  private queues: Queue[] = [];
  private stops: Stop[] = [];
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
    this.tiles = town.tiles; this.parkRef = town.parks; this.roads = roads; this.walkway = null; this.parks = town.parks.filter(p => p.parts.some(part => part.kind !== "path" && part.kind !== "stones"));
    this.doors = [];
    this.chimneys = [];
    for (let i = 0; i < town.tiles.length; i++) {
      const kind = town.tiles[i]!;
      if (!["house", "shop", "factory", "station", "home"].includes(kind)) continue;
      const x = i % MAP_SIZE, y = Math.floor(i / MAP_SIZE);
      const road = neighbours(x, y).find(n => isRoadTile(town.tiles[n]));
      if (road !== undefined) this.doors.push({ tile: i, kind, road, dx: road % MAP_SIZE - x, dy: Math.floor(road / MAP_SIZE) - y });
      if (kind === "house" && (town.levels[i] || 1) === 1 && hash(i * 1.7) > .45) this.chimneys.push({ x: x + .16 + .48, y: y + .15 + .095, z: 32, seed: i });
      if (kind === "home") this.chimneys.push({ x: x + .63, y: y + .3, z: 47, seed: i });
    }
    this.water = town.tiles.flatMap((t, i) => t === "water" ? [i] : []);
    this.population = town.tiles.reduce((sum, t, i) => sum + (t === "house" ? 18 * (town.levels[i] || 1) : 0), 0);
    this.blooms = [];
    for (const lot of town.parks) for (const part of lot.parts) if (["flowers", "arch", "cherry"].includes(part.kind)) this.blooms.push({ x: part.tile % MAP_SIZE + .5, y: Math.floor(part.tile / MAP_SIZE) + .5 });
    this.lots = town.parks;
    this.buildSpots(town.parks);
    this.syncPigeons(town.parks);
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
  /** Where people use the park parts. Rebuilt with the parks; anyone whose spot was removed walks on. */
  private buildSpots(parks: ParkLot[]) {
    this.spots.clear(); this.motions = []; this.cherries.clear(); this.fallers = []; this.ways.clear(); this.lit = [];
    const live = new Set<number>();
    for (const lot of parks) {
      this.ways.set(lot.id, parkWays(lot, this.tiles ?? []));
      const objects = new Map(lot.parts.filter(q => q.kind !== "path" && q.kind !== "stones").map(q => [q.tile, q.kind] as const));
      for (const part of lot.parts) {
        const x = part.tile % MAP_SIZE, y = Math.floor(part.tile / MAP_SIZE), r = part.rotation;
        if (part.kind === "cherry") this.cherries.add(part.tile);
        if (CROWNS[part.kind]) this.lit.push({ x: x + .5, y: y + .5, kind: part.kind, seed: hash(part.tile) * TAU });
        if (part.kind === "cherry" || part.kind === "maple" || part.kind === "ginkgo") this.fallers.push({ x: x + .5, y: y + .5, kind: part.kind });
        for (const def of PART_SPOTS[part.kind] ?? []) {
          const p = turn(x, y, r, def.u, def.v), key = `${part.tile}:${part.kind}:${def.slot}`, cell = Math.floor(p.y) * MAP_SIZE + Math.floor(p.x);
          // People who wait, watch or listen stand inside the fence and never inside another part (they may use the next tile).
          const m = def.kind === "watch" || def.kind === "audience" ? .16 : .1, outside = cell !== part.tile, standing = def.kind === "watch" || def.kind === "audience" || def.kind === "queue" || def.kind === "drink";
          if ((standing || outside) && (p.x < lot.x + m || p.y < lot.y + m || p.x > lot.x + lot.width - m || p.y > lot.y + lot.height - m || outside && objects.has(cell))) continue;
          this.spots.set(key, { key, lot: lot.id, kind: def.kind, part: part.kind, slot: def.slot, x: p.x, y: p.y, tile: part.tile, rotation: r, u: def.u, v: def.v, z: def.z ?? 0, facing: facingOf(r, def.du ?? 0, def.dv ?? 1), side: sideOf(r, def.du ?? 0, def.dv ?? 1), who: def.who });
        }
        if (PART_MOTION[part.kind]) {
          live.add(part.tile);
          this.motions.push({ tile: part.tile, kind: part.kind, rotation: r, x, y, variant: parkArtVariant(part.kind, part.tile), depth: motionDepth(part.kind, { c: {} as CanvasRenderingContext2D, x, y, rotation: r }) });
          if (!this.states.has(part.tile)) this.states.set(part.tile, { angle: hash(part.tile) * TAU, speed: 0, bob: 0 });
        }
      }
      // Open lawn (or paving on a plaza) for games and picnics: up to four people per tile.
      for (const cell of lotTiles(lot)) if (!objects.has(cell)) for (let slot = 0; slot < 4; slot++) {
        const key = `${cell}:lawn:${slot}`, x = cell % MAP_SIZE, y = Math.floor(cell / MAP_SIZE);
        this.spots.set(key, { key, lot: lot.id, kind: "lawn", part: null, slot, x: x + .5, y: y + .5, tile: cell, rotation: 0, u: .5, v: .5, z: 1, facing: 1, side: 1, who: "any" });
      }
    }
    for (const tile of [...this.states.keys()]) if (!live.has(tile)) this.states.delete(tile);
    for (const cell of [...this.snowmen.keys()]) if (!this.spots.has(`${cell}:lawn:0`)) this.snowmen.delete(cell);
    for (const v of this.visitors) {
      if (v.spot && !this.spots.has(v.spot)) this.leaveSpot(v);
      // Something new may stand in the way: walk round it.
      else if (v.path?.length && !v.leaving) this.walkTo(v, v.tx, v.ty);
    }
  }
  /** Somewhere free to stand in the park, so strollers and pigeons never stop inside a pond or a hedge. */
  private strollPoint(lot: ParkLot) {
    const w = this.ways.get(lot.id);
    if (w) return parkStroll(w, () => this.random.next());
    const cell = this.random.pick(lotTiles(lot));
    return { x: cell % MAP_SIZE + .5, y: Math.floor(cell / MAP_SIZE) + .5 };
  }
  private nearestGate(w: ParkWays, x: number, y: number) {
    let best: ParkGate | undefined;
    for (const g of w.gates) if (!best || Math.hypot(g.inside.x - x, g.inside.y - y) < Math.hypot(best.inside.x - x, best.inside.y - y)) best = g;
    return best;
  }
  /** Head for a point in the park round anything in the way; from the street, in through the nearest gate. */
  private walkTo(v: Visitor, x: number, y: number) {
    const w = this.ways.get(v.lot), to = { x, y };
    v.tx = x; v.ty = y;
    if (!w) { v.path = [to]; return; }
    const { lot } = w, outside = v.x < lot.x || v.y < lot.y || v.x > lot.x + lot.width || v.y > lot.y + lot.height, gate = outside ? this.nearestGate(w, v.x, v.y) : undefined;
    v.path = gate ? [gate.outside, gate.inside, ...parkRoute(w, gate.inside, to, gate.entry)] : parkRoute(w, { x: v.x, y: v.y }, to);
    v.patience = 25 + routeLength(v, v.path) / .2;
  }
  /** Out through the nearest gate and along the sidewalk; false when the park has no gate. */
  private leave(v: Visitor) {
    const w = this.ways.get(v.lot), gate = w && this.nearestGate(w, v.x, v.y);
    if (!w || !gate) return false;
    const end = this.random.pick(gate.ends);
    v.leaving = true; v.tx = end.x; v.ty = end.y;
    v.path = [...parkRoute(w, { x: v.x, y: v.y }, gate.inside, undefined, gate.entry), gate.outside, end];
    return true;
  }
  /** Move along the path; true while still on the way. */
  private walk(v: Visitor, step: number) {
    const path = v.path ?? (v.path = []);
    if (!path.length && Math.hypot(v.tx - v.x, v.ty - v.y) > .03) path.push({ x: v.tx, y: v.ty });
    while (path.length && step > 0) {
      const p = path[0]!, d = Math.hypot(p.x - v.x, p.y - v.y);
      if (d <= step) { v.x = p.x; v.y = p.y; step -= d; path.shift(); }
      else { v.x += (p.x - v.x) / d * step; v.y += (p.y - v.y) / d * step; step = 0; }
    }
    return path.length > 0;
  }
  private occupied(key: string, except?: Visitor) { return this.visitors.some(v => v !== except && v.spot === key); }
  private fits(who: Who, v: Visitor) { return who === "any" || (who === "child") === (v.look.kind === "child"); }
  /** Snow games while it snows (not in a blizzard); everything else on a dry day. */
  private lawnWeather(game: Lawn, env: TownEnvironment) {
    return SNOW_GAMES.has(game) ? env.snow > 0 && env.snow < .8 && env.rain < .2 : env.rain < .2 && env.snow === 0;
  }
  /** Lawn games that suit the weather, the time of day and the place. */
  private lawnAllowed(game: Lawn, cell: number, lot: ParkLot, v: Visitor, env: TownEnvironment) {
    const day = env.night < .35, temp = env.temperature ?? 20, x = cell % MAP_SIZE, y = Math.floor(cell / MAP_SIZE);
    if (!this.lawnWeather(game, env) || !this.fits(LAWN[game].who, v)) return false;
    switch (game) {
      case "blanket": return day && lot.kind === "park" && temp >= 10 && temp <= 31;
      case "hanami": return env.blossom > .3 && env.night < .8 && [...this.cherries].some(t => Math.abs(t % MAP_SIZE - x) <= 1 && Math.abs(Math.floor(t / MAP_SIZE) - y) <= 1);
      case "kite": return day && lot.kind === "park" && env.wind >= 12;
      case "bubbles": return day && env.wind < 28;
      case "fetch": return day && lot.kind === "park" && Boolean(v.look.dog);
      default: return day;
    }
  }
  /** Choose something to do in the park: children like the play equipment, grown-ups the seats and the view, everyone the lawn. */
  private chooseSpot(v: Visitor) {
    const r = this.random, env = this.env, child = v.look.kind === "child";
    if (!env || r.next() < .15) return false;
    const lot = this.parks.find(l => l.id === v.lot);
    if (!lot) return false;
    const options: { spot: Spot; weight: number; game?: Lawn }[] = [];
    const queues = new Map<number, Spot[]>();
    for (const spot of this.spots.values()) {
      if (spot.lot !== v.lot || spot.kind === "lawn" || !this.fits(spot.who, v) || !spotOpen(spot.kind, env) || this.occupied(spot.key, v)) continue;
      // A queue is joined at its end.
      if (spot.kind === "queue") { const line = queues.get(spot.tile) ?? []; line.push(spot); queues.set(spot.tile, line); continue; }
      options.push({ spot, weight: PAINTED.has(spot.kind) || spot.kind === "slide" ? child ? 2.4 : 1 : spot.kind === "audience" ? 2 : 1 });
    }
    for (const line of queues.values()) options.push({ spot: line.sort((a, b) => a.slot - b.slot)[0]!, weight: 1.6 });
    // Lawn: join a game already going on, or start one on a free patch.
    const cells = [...new Set([...this.spots.values()].filter(s => s.lot === v.lot && s.kind === "lawn").map(s => s.tile))];
    for (const cell of cells) {
      const plan = this.lawnPlans.get(cell), used = [0, 1, 2, 3].filter(slot => this.occupied(`${cell}:lawn:${slot}`, v));
      if (plan) {
        const free = LAWN[plan].slots.findIndex((_, slot) => !used.includes(slot));
        if (free >= 0 && this.lawnAllowed(plan, cell, lot, v, env)) options.push({ spot: this.spots.get(`${cell}:lawn:${free}`)!, weight: 2.2, game: plan });
      } else if (!used.length) {
        const games = (Object.keys(LAWN) as Lawn[]).filter(g => this.lawnAllowed(g, cell, lot, v, env));
        if (games.length) {
          let roll = r.next() * games.reduce((sum, g) => sum + LAWN[g].weight, 0), game = games[0]!;
          for (const g of games) { roll -= LAWN[g].weight; if (roll <= 0) { game = g; break; } }
          options.push({ spot: this.spots.get(`${cell}:lawn:0`)!, weight: .5 / Math.max(1, cells.length / 3), game });
        }
      }
    }
    if (!options.length) return false;
    let roll = r.next() * options.reduce((sum, o) => sum + o.weight, 0), choice = options[0]!;
    for (const o of options) { roll -= o.weight; if (roll <= 0) { choice = o; break; } }
    const spot = choice.spot;
    if (choice.game) {
      // Lawn spots take their place from the game.
      this.lawnPlans.set(spot.tile, choice.game);
      const [u, w] = LAWN[choice.game].slots[spot.slot]!, cx = spot.tile % MAP_SIZE, cy = Math.floor(spot.tile / MAP_SIZE);
      Object.assign(spot, { x: cx + u, y: cy + w, u, v: w, z: 1, facing: facingOf(0, .5 - u, .5 - w), side: sideOf(0, .5 - u, .5 - w) });
      v.lawn = choice.game;
    } else v.lawn = undefined;
    v.spot = spot.key; v.using = -1;
    v.duration = spot.kind === "slide" ? SLIDE_TIME * (2 + Math.floor(r.next() * 3)) : spot.kind === "queue" && spot.slot > 0 ? 45 : spotDuration(spot.kind, r.next(), spot.slot);
    this.walkTo(v, spot.x, spot.y);
    return true;
  }
  private leaveSpot(v: Visitor) {
    const spot = v.spot ? this.spots.get(v.spot) : undefined;
    // Step off in front of the thing they used, then wander or pick the next thing.
    if (spot && v.using >= 0) { const p = spot.kind === "swing" ? turn(Math.floor(spot.tile % MAP_SIZE), Math.floor(spot.tile / MAP_SIZE), spot.rotation, spot.u, .92) : { x: spot.x, y: spot.y }; v.x = p.x; v.y = p.y; }
    v.spot = null; v.using = 0; v.tx = v.x; v.ty = v.y; v.path = []; v.rest = .5 + this.random.next() * 1.5; v.lawn = undefined;
  }
  /** Who is on each slot of a part right now, for its painter and its motion. */
  private ridersOf(tile: number): (Rider | undefined)[] {
    const riders: (Rider | undefined)[] = [];
    for (const v of this.visitors) {
      if (!v.spot || v.using < 0) continue;
      const spot = this.spots.get(v.spot);
      if (spot && spot.tile === tile && spot.kind !== "lawn") riders[spot.slot] = { look: v.look, using: v.using, duration: v.duration, seed: v.seed };
    }
    return riders;
  }
  /** Pigeons peck round plazas, paths and benches, and take off when someone walks up to them. */
  private syncPigeons(lots: ParkLot[]) {
    this.pigeons = this.pigeons.filter(p => lots.some(l => l.id === p.lot));
    for (const lot of lots) {
      const busy = lot.kind === "plaza" || lot.parts.some(p => ["bench", "path", "picnic", "foodCart", "fountain", "parasol"].includes(p.kind));
      let have = this.pigeons.filter(p => p.lot === lot.id).length;
      const want = busy ? Math.min(6, 2 + Math.floor(lot.width * lot.height / 3)) : 0;
      while (have < want) {
        const p = this.strollPoint(lot);
        this.pigeons.push({ lot: lot.id, x: p.x, y: p.y, dir: 1, peck: 0, wait: this.random.next() * 2, fly: null, seed: this.random.next() * 100 });
        have++;
      }
    }
  }
  private updatePigeons(dt: number, ambientDt: number, env: TownEnvironment) {
    if (env.night > .55) return;
    const r = this.random;
    for (const p of this.pigeons) {
      const lot = this.lots.find(l => l.id === p.lot); if (!lot) continue;
      if (p.fly) { p.fly.t += ambientDt / 1.5; if (p.fly.t >= 1) { p.x = p.fly.tx; p.y = p.fly.ty; p.fly = null; p.wait = 1 + r.next() * 2; } continue; }
      const startled = this.visitors.some(v => v.lot === p.lot && Math.hypot(v.x - p.x, v.y - p.y) < (v.look.kind === "child" ? .32 : .2) && (Boolean(v.path?.length) || Math.hypot(v.tx - v.x, v.ty - v.y) > .03 || v.look.kind === "child" && !v.spot));
      if (startled) {
        const { x: tx, y: ty } = this.strollPoint(lot);
        p.fly = { fx: p.x, fy: p.y, tx, ty, t: 0 }; p.dir = tx - ty - (p.x - p.y) >= 0 ? 1 : -1;
        continue;
      }
      p.peck = Math.max(0, p.peck - dt);
      if ((p.wait -= dt) <= 0) {
        if (r.next() < .55) p.peck = .35;
        else {
          const a = r.next() * TAU, nx = p.x + Math.cos(a) * .07, ny = p.y + Math.sin(a) * .07;
          if (nx > lot.x + .1 && ny > lot.y + .1 && nx < lot.x + lot.width - .1 && ny < lot.y + lot.height - .1) { p.dir = Math.cos(a) - Math.sin(a) >= 0 ? 1 : -1; p.x = nx; p.y = ny; }
        }
        p.wait = .4 + r.next() * 1.2;
      }
    }
  }
  /** Games on the lawn, drawn group by group so a ball or a dog can travel between the players. */
  private drawLawn(add: LifeAdd, cells: Map<number, Visitor[]>, env: TownEnvironment, night: number, detail: boolean) {
    const t = this.time;
    for (const [cell, people] of cells) {
      const game = this.lawnPlans.get(cell); if (!game) continue;
      const cx = cell % MAP_SIZE, cy = Math.floor(cell / MAP_SIZE), slot = (v: Visitor) => this.spots.get(v.spot!)?.slot ?? 0;
      if (game === "blanket" || game === "hanami") add(cx + .5, cy + .5, -.48, c => blanket(c, cx, cy, game, night), { left: -30, top: -6, width: 60, height: 24 });
      if (game === "snowball") {
        // Each throws in turn: scoop, throw, and the snowball flies across.
        const a = people.find(v => slot(v) === 0), b = people.find(v => slot(v) === 1), cycle = (t % 2.6) / 1.3, q = cycle % 1;
        if (a && b && q > .34 && q < .78) {
          const from = cycle >= 1 ? { x: cx + .84, y: cy + .46, s: b.look.scale } : { x: cx + .16, y: cy + .54, s: a.look.scale }, to = cycle >= 1 ? { x: cx + .16, y: cy + .54 } : { x: cx + .84, y: cy + .46 };
          const k = (q - .34) / .44, x = from.x + (to.x - from.x) * k, y = from.y + (to.y - from.y) * k, z = 1 + 9 * from.s + Math.sin(k * Math.PI) * 7 - k * 5;
          add(x, y, .02, c => { const p = iso(x, y, z), g = iso(x, y, 1); ellipse(c, g.x + .3, g.y + .2, 1, .35, "#3a4b5a26"); ellipse(c, p.x, p.y, 1, 1, shade("#fbfdff", night)); ellipse(c, p.x + .3, p.y + .25, .55, .45, shade("#d9e3ec", night)); }, { left: -4, top: -24, width: 8, height: 26 });
        }
      }
      if (game === "ball") {
        const a = people.find(v => slot(v) === 0), b = people.find(v => slot(v) === 1);
        const pa = { x: cx + .16, y: cy + .52 }, pb = { x: cx + .84, y: cy + .48 }, cycle = (t % 2.4) / 1.2, q = cycle % 1, there = cycle >= 1;
        const from = there ? pb : pa, to = there ? pa : pb, both = Boolean(a && b);
        const ball = both ? { x: from.x + (to.x - from.x) * q, y: from.y + (to.y - from.y) * q, z: 1.4 + Math.sin(q * Math.PI) * 5 } : { x: (a ? pa : pb).x + .06, y: (a ? pa : pb).y + .03, z: 1.4 + Math.abs(Math.sin(t * 4)) * 4 };
        add(ball.x, ball.y, .02, c => { const p = iso(ball.x, ball.y, ball.z), g = iso(ball.x, ball.y, 1); ellipse(c, g.x + .3, g.y + .2, 1.1, .4, "#1e332a30"); ellipse(c, p.x, p.y, 1.1, 1.1, shade("#f6f3ee", night)); ellipse(c, p.x + .3, p.y + .2, .45, .45, shade("#3f6fa8", night)); }, { left: -4, top: -12, width: 8, height: 14 });
      }
      for (const v of people) {
        const spot = this.spots.get(v.spot!); if (!spot) continue;
        const beat = t * 2.4 + v.seed, s = v.look.scale;
        if (game === "tag") {
          // Chasing each other round in a circle.
          const a = t * 1.7 + slot(v) * Math.PI, x = cx + .5 + Math.cos(a) * .24, y = cy + .5 + Math.sin(a) * .24, tangent = -Math.sin(a) + Math.cos(a);
          add(x, y, .03, c => drawPerson(c, iso(x, y, 1), v.look, t * 14 + v.seed, tangent >= 0 ? 1 : -1, night, { rain: false, detail, beat }), { left: -12, top: -26, width: 24, height: 30 });
          continue;
        }
        const p = iso(spot.x, spot.y, 1.2);
        add(spot.x, spot.y, .03, c => {
          if (game === "blanket" || game === "hanami") {
            const kanpai = game === "hanami" && (t + v.seed) % 9 < 1.1, look = game === "hanami" ? { ...v.look, carry: "drink" as const, carryColor: "#f1ebdc" } : v.look;
            drawPerson(c, onSeat(p, v.look), look, 0, spot.facing, night, { rain: false, pose: kanpai ? "cheer" : "sit", sit: true, side: spot.side, detail, beat });
          } else if (game === "kite") {
            const hand = { x: p.x + spot.side * 1.6 * s, y: p.y - 9 * s };
            kite(c, hand, t, env, night, v.seed);
            drawPerson(c, p, v.look, 0, spot.facing, night, { rain: false, pose: "cheer", detail, beat: Math.sin(t * .6) * .4, empty: true });
          } else if (game === "bubbles") {
            const hand = { x: p.x + 1.8 * s, y: p.y - 8.8 * s }, wx = Math.cos(env.windAngle);
            drawPerson(c, p, v.look, 0, spot.facing, night, { rain: false, pose: Math.sin(t * .9 + v.seed) > 0 ? "cheer" : "walk", detail, beat, empty: true });
            for (let j = 0; j < 8; j++) {
              const a = (t * .5 + j / 8 + hash(v.seed)) % 1, x = hand.x + wx * a * 24 + Math.sin(t * 2 + j) * 2, y = hand.y - a * 18 - Math.sin(a * Math.PI) * 2, r = .7 + a * 1.4;
              c.save(); c.globalAlpha *= 1 - a; c.beginPath(); c.arc(x, y, r, 0, TAU); c.strokeStyle = shade(j % 2 ? "#ffffff" : "#d9ccff", night); c.lineWidth = .3; c.stroke(); ellipse(c, x - r * .35, y - r * .35, r * .25, r * .2, "#ffffffbb"); c.restore();
            }
          } else if (game === "snowman") {
            // Rolling and patting the snow into shape.
            drawPerson(c, p, v.look, 0, spot.facing, night, { rain: false, pose: Math.sin(t * 2.4 + v.seed) > 0 ? "crouch" : "bend", side: spot.side, detail, beat });
          } else if (game === "snowball") {
            const cycle = (t % 2.6) / 1.3, q = cycle % 1, throwing = (cycle >= 1) === (slot(v) === 1);
            const pose = throwing ? q < .26 ? "bend" : q < .42 ? "cheer" : "walk" : "walk", jump = !throwing && q > .7 && q < .88 ? Math.sin((q - .7) / .18 * Math.PI) * 1.6 : 0;
            drawPerson(c, p, v.look, 0, spot.facing, night, { rain: false, pose, side: spot.side, detail, beat, jump });
          } else if (game === "fetch") {
            // Throw, the dog runs out for the ball and brings it back.
            const tau = (t + v.seed) % 4, far = { x: cx + .84, y: cy + .3 }, me = { x: spot.x + .08, y: spot.y + .02 };
            const out = Math.min(1, Math.max(0, (tau - .4) / 1.2)), back = Math.min(1, Math.max(0, (tau - 1.7) / 1.5)), dogAt = tau < 1.7 ? out : 1 - back;
            const dx = me.x + (far.x - me.x) * dogAt, dy = me.y + (far.y - me.y) * dogAt, dogPoint = iso(dx, dy, 1), runningOut = tau < 1.7;
            drawPerson(c, p, v.look, 0, spot.facing, night, { rain: false, pose: tau < .45 ? "cheer" : "walk", detail, beat });
            if (tau >= .4 && tau < 1.5) { const q = (tau - .4) / 1.1, bp = iso(me.x + (far.x - me.x) * q, me.y + (far.y - me.y) * q, 1 + 9 * s + Math.sin(q * Math.PI) * 10 - q * 9 * s); ellipse(c, bp.x, bp.y, .7, .7, shade("#c8e04f", night)); }
            drawDog(c, dogPoint, (runningOut ? far.x - far.y - (me.x - me.y) : me.x - me.y - (far.x - far.y)) >= 0 ? 1 : -1, tau * 14, night, v.look.dog ?? "#efe6d6", { wag: tau * 20, jump: tau > 3.3 ? Math.abs(Math.sin(tau * 9)) : 0, size: .78 });
            if (tau >= 1.5 && tau < 3.2) { const dir = (me.x - me.y - (far.x - far.y)) >= 0 ? 1 : -1; ellipse(c, dogPoint.x + dir * 2.1, dogPoint.y - 2.4, .55, .55, shade("#c8e04f", night)); }
          } else {
            const kick = game === "ball" && ((t % 2.4) / 1.2) % 1 < .18;
            drawPerson(c, p, v.look, kick ? 1.4 : 0, spot.facing, night, { rain: false, detail, beat, jump: game === "ball" ? 0 : Math.max(0, Math.sin(t * 3 + v.seed)) * .8 });
          }
        }, game === "kite" ? { left: -44, top: -90, width: 88, height: 96 } : game === "bubbles" ? { left: -30, top: -50, width: 60, height: 56 } : game === "fetch" ? { left: -40, top: -40, width: 80, height: 50 } : { left: -12, top: -26, width: 24, height: 30 });
      }
    }
  }
  /** How many people are in a park right now and the two things most of them are doing, for the park's card. */
  activity(lotId: number) {
    const lot = this.lots.find(l => l.id === lotId), counts = new Map<string, number>();
    let people = 0;
    if (!lot) return { people, doing: [] as string[] };
    for (const v of this.visitors) {
      if (v.lot !== lotId || v.leaving || v.x < lot.x || v.y < lot.y || v.x > lot.x + lot.width || v.y > lot.y + lot.height) continue;
      people++;
      const spot = v.spot && v.using >= 0 ? this.spots.get(v.spot) : undefined, doing = spot ? spot.kind === "lawn" ? v.lawn && PLAYING[v.lawn] : DOING[spot.kind] : undefined;
      if (doing) counts.set(doing, (counts.get(doing) ?? 0) + 1);
    }
    return { people, doing: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([doing]) => doing) };
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
  /** Along the sidewalks from one door to another, crossing at the zebra crossings of junctions. */
  /** The road parts people use: crossings and footbridges for routes, bus stops to wait at, post boxes and vending machines to stop at. */
  setRoadParts(layouts: ReadonlyMap<number, RoadLayout>) {
    if (layouts === this.roadParts) return;
    this.roadParts = layouts; this.walkway = null;
    const old = new Map(this.queues.map(q => [q.key, q]));
    this.queues = [...layouts.values()].flatMap(l => l.busWait.map(w => {
      const key = `${l.tile}:${w.side}`, toRoad = l.axis === "x" ? { dx: 0, dy: -w.side } : { dx: -w.side, dy: 0 };
      return { ...(old.get(key) ?? { count: 0, clock: 2 + hash(l.tile) * 6, looks: [], boarding: false }), key, tile: l.tile, side: w.side, x: w.x, y: w.y, along: w.along, toRoad, shelter: w.shelter };
    }));
    this.stops = [...layouts.values()].flatMap(l => l.items.flatMap(i => i.kind === "postbox" || i.kind === "vending" ? [{ x: i.x + i.facing.dx * .1, y: i.y + i.facing.dy * .1, dx: -i.facing.dx, dy: -i.facing.dy, kind: i.kind }] : []));
  }
  private sidewalks(from: Door, to: Door) {
    this.walkway ??= walkways(this.roads, (_tile, arms) => arms >= 3, tile => {
      const l = this.roadParts.get(tile);
      return l && (l.crosswalk || l.bridgeWay) ? { middle: l.crosswalk ? l.axis : undefined, bridge: l.bridgeWay ?? undefined } : undefined;
    });
    const route = sidewalkRoute(this.walkway, { road: from.road, side: { dx: -from.dx, dy: -from.dy } }, { road: to.road, side: { dx: -to.dx, dy: -to.dy } });
    return route && [this.doorPoint(from), ...route, this.doorPoint(to)];
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
    const points = this.sidewalks(from, to);
    if (!points) return;
    const { lengths, total } = polyline(points);
    // About one in six goes by bicycle (school children, shoppers, commuters to the station), not in heavy rain or snow.
    const bike = kind !== "jogger" && kind !== "elder" && env.rain < .5 && env.snow < .3 && r.next() < .17 ? r.pick(["#3f6f9a", "#c8786c", "#e6e2d6", "#4f7f62", "#2f3437"]) : null;
    const speed = (bike ? .52 : kind === "jogger" ? .55 : kind === "child" ? .3 : kind === "elder" ? .17 : .24) * (.9 + r.next() * .2) * (env.rain > .5 ? 1.15 : 1);
    const look = this.look(env, kind, purpose); if (bike) { look.dog = null; look.parasol = false; }
    this.walkers.push({ points, lengths, total, s: 0, speed, look, seed: Math.floor(r.next() * 1e6), phase: r.next() * TAU, pause: 0, face: 1, passed: [], bike });
  }
  private spawnVisitor(env: TownEnvironment): Visitor | undefined {
    if (!this.parks.length) return;
    const r = this.random, lot = r.pick(this.parks), gates = this.ways.get(lot.id)?.gates ?? [];
    const play = [...this.spots.values()].some(s => s.lot === lot.id && s.who === "child");
    // Children are the first out in the snow.
    const kind: Look["kind"] = play && r.next() < .55 || r.next() < (env.snow > 0 ? .55 : .12) ? "child" : r.next() < .3 ? "elder" : "adult";
    // People come along the sidewalk and in through a gate; a park without one fills from the inside.
    const { x, y } = gates.length ? r.pick(r.pick(gates).ends) : this.strollPoint(lot);
    const look = this.look(env, kind, "walk");
    // About a third of grown-ups bring the dog; children come with a balloon now and then.
    if (look.dog && (kind === "child" || r.next() < .5)) look.dog = null;
    if (kind === "child" && r.next() < .14) { look.carry = "balloon"; look.carryColor = r.pick(BALLOONS); }
    const v: Visitor = { lot: lot.id, x, y, tx: x, ty: y, rest: 0, life: 34 + r.next() * 46, age: 0, look, seed: Math.floor(r.next() * 1e6), phase: r.next() * TAU, spot: null, using: 0, duration: 0, path: [] };
    this.visitors.push(v);
    if (!this.chooseSpot(v) && gates.length) { const p = this.strollPoint(lot); this.walkTo(v, p.x, p.y); v.rest = 1 + r.next() * 3; }
    return v;
  }
  /** Advance people and animals. `dt` follows the town speed; `ambientDt` is real time. */
  update(dt: number, ambientDt: number, env: TownEnvironment) {
    const population = this.population;
    this.time += ambientDt; this.env = env;
    const r = this.random, daylight = 1 - env.night;
    const walkers = Math.round(Math.min(64, 4 + population / 12) * env.activity);
    let partSpots = 0, lawn = 0;
    for (const s of this.spots.values()) if (s.kind === "lawn") { if (s.slot === 0) lawn++; } else partSpots++;
    const visitors = Math.round(Math.min(48, this.parks.length * 3 + partSpots * .6 + lawn * .5) * env.activity * (.25 + daylight * .75) * (env.rain > .3 || env.snow >= .8 ? .15 : env.snow > 0 ? .4 : 1));
    if (!this.started && this.doors.length > 1) {
      // Open the town mid-day rather than empty: people are already on their way, part-way along.
      this.started = true;
      for (let j = 0; j < walkers; j++) {
        this.spawnWalker(env); const w = this.walkers[this.walkers.length - 1]; if (!w) continue;
        w.s = r.next() * w.total * .9;
        // Nobody starts out in the middle of the road: those would be standing on a crossing wait at its curb.
        let k = 0; while (k < w.lengths.length - 2 && w.lengths[k + 1]! <= w.s) k++;
        if (w.points[k + 1]?.cross) w.s = Math.max(0, w.lengths[k]! - .03);
      }
      for (let j = 0; j < visitors; j++) {
        const v = this.spawnVisitor(env); if (!v) continue;
        v.age = 1 + r.next() * v.life * .5; v.path = [];
        if (v.spot) { v.x = v.tx; v.y = v.ty; v.using = r.next() * v.duration * .6; } else { v.x = v.tx + (r.next() - .5) * .2; v.y = v.ty + (r.next() - .5) * .2; }
      }
    }
    this.spawnClock -= dt;
    if (this.spawnClock <= 0) {
      if (this.walkers.length < walkers) this.spawnWalker(env);
      if (this.visitors.length < visitors) this.spawnVisitor(env);
      this.spawnClock = (this.walkers.length < walkers * .6 ? .15 : .4) + r.next() * .4;
    }
    this.crossing = new Map();
    for (const w of this.walkers) {
      // Standing at a post box (posting a letter) or a vending machine (and walking on with a drink).
      if (w.pause > 0) {
        w.pause -= dt;
        if (w.look.carry === "letter" && w.pause < .7) w.look.carry = undefined;
        if (w.pause <= 0 && w.passed.length && this.stops[w.passed[w.passed.length - 1]!]?.kind === "vending") { w.look.carry = "drink"; w.look.carryColor = r.pick(["#e9473f", "#f1ebdc", "#3f78b5", "#e5b62c"]); }
        continue;
      }
      // Wait at a level crossing while the barrier is down.
      if (this.closed.size) {
        const here = at(w, w.s), next = at(w, Math.min(w.total, w.s + .22)), tile = Math.floor(next.y) * MAP_SIZE + Math.floor(next.x);
        if (this.closed.has(tile) && tile !== Math.floor(here.y) * MAP_SIZE + Math.floor(here.x)) continue;
      }
      const step = w.speed * dt;
      let j = 0; while (j < w.lengths.length - 2 && w.lengths[j + 1]! <= w.s) j++;
      const end = w.points[j + 1], after = w.points[j + 2];
      // On the road: the cars wait.
      if (end?.cross) { const key = `${end.cross.tile}:${end.cross.arm}`; this.crossing.set(key, (this.crossing.get(key) ?? 0) + 1); }
      // At the curb (or the corner between two crossings): wait for the walk light and for the cars.
      if (end && after?.cross && w.s + step >= w.lengths[j + 1]! - .03 && !this.mayCross(after.cross, Math.abs(after.x - end.x) > Math.abs(after.y - end.y) ? "x" : "y")) {
        w.s = Math.max(w.s, Math.min(w.s + step, w.lengths[j + 1]! - .03)); w.phase = 0; continue;
      }
      if (this.stops.length && w.look.kind !== "jogger" && !w.bike) {
        const p = at(w, w.s);
        for (const [k, stop] of this.stops.entries()) {
          if (w.passed.includes(k) || Math.abs(p.x - stop.x) > .14 || Math.abs(p.y - stop.y) > .14) continue;
          w.passed.push(k);
          if (hash(w.seed * .37 + k * 7.1) < (stop.kind === "postbox" ? .25 : .2) && !w.look.carry) {
            w.pause = 1.6 + hash(w.seed + k) * 1.2; w.face = stop.dx + stop.dy > 0 ? 1 : -1;
            if (stop.kind === "postbox") w.look.carry = "letter";
          }
        }
        if (w.pause > 0) continue;
      }
      w.s += step; w.phase += dt * (w.look.kind === "jogger" ? 15 : 9.5);
    }
    this.walkers = this.walkers.filter(w => w.s < w.total);
    // Passengers gather at the bus stops and get on when a bus stands there.
    for (const q of this.queues) {
      const max = q.shelter ? 3 : 2;
      if (this.boarding.get(q.tile) === q.side) {
        // One after another through the door while the bus stands there.
        if (!q.boarding) { q.boarding = true; q.clock = .35; }
        q.clock -= dt; if (q.clock <= 0 && q.count > 0) { q.count--; q.looks.shift(); q.clock = .5; }
        continue;
      }
      if (q.boarding) { q.boarding = false; q.clock = 4 + r.next() * 6; }
      q.clock -= dt * Math.max(.15, env.activity);
      if (q.clock <= 0) {
        if (q.count < max) { q.count++; q.looks.push(this.look(env, r.next() < .15 ? "child" : r.next() < .25 ? "elder" : "adult", r.next() < .5 ? "work" : "shop")); }
        q.clock = 5 + r.next() * 9;
      }
    }
    for (const v of this.visitors) {
      v.age += dt; v.phase += dt * 9;
      const spot = v.spot ? this.spots.get(v.spot) : undefined;
      // The carousel stops, the band goes home, the rain starts: people leave what has closed.
      if (spot && (spot.kind === "lawn" ? !v.lawn || !this.lawnWeather(v.lawn, env) : !spotOpen(spot.kind, env))) { this.leaveSpot(v); continue; }
      // A queue moves up when the person in front has been served.
      if (spot?.kind === "queue" && spot.slot > 0 && !this.occupied(`${spot.tile}:${spot.part}:${spot.slot - 1}`, v)) {
        const ahead = this.spots.get(`${spot.tile}:${spot.part}:${spot.slot - 1}`);
        if (ahead) { v.spot = ahead.key; v.using = -1; this.walkTo(v, ahead.x, ahead.y); v.duration = ahead.slot === 0 ? spotDuration("queue", r.next()) : 45; continue; }
      }
      if (v.spot && v.using >= 0) {
        // Using something runs on real time, so the town speed does not make a swing fly round.
        v.using += ambientDt;
        if (v.using >= v.duration) {
          const served = spot?.kind === "queue" && spot.slot === 0;
          this.leaveSpot(v);
          if (served) { v.look.carry = "icecream"; v.look.carryColor = r.pick(ICE_CREAM); }
          // With an ice cream, a seat or a spot on the lawn is the next stop.
          if (v.age < v.life - 8 && (served || r.next() < .5)) this.chooseSpot(v); else v.life = Math.max(v.life, v.age + .6);
        }
        continue;
      }
      // Time to go home: out through the gate (a park without one: they fade away where they stand).
      if (!v.spot && !v.leaving && v.age >= v.life) this.leave(v);
      if (this.walk(v, dt * .2)) {
        // Someone who cannot get to their spot gives up and strolls on.
        if (v.spot && (v.using -= dt) < -(v.patience ?? 25)) this.leaveSpot(v);
      }
      else if (v.spot) v.using = 0;
      else if (!v.leaving && (v.rest -= dt) <= 0) {
        const lot = this.parks.find(l => l.id === v.lot);
        if (lot && !(r.next() < .45 && this.chooseSpot(v))) { const p = this.strollPoint(lot); this.walkTo(v, p.x, p.y); v.rest = 2 + r.next() * 5; }
      }
    }
    // Nobody vanishes in mid-swing: people finish what they are doing before they go home, and walk out of the gate.
    this.visitors = this.visitors.filter(v => this.parks.some(l => l.id === v.lot) && (v.leaving ? Boolean(v.path?.length) : v.age < v.life || v.spot));
    // Snowmen grow while children pack the snow, stay while it snows and melt away after.
    for (const [cell, game] of this.lawnPlans) if (game === "snowman" && this.visitors.some(v => v.spot?.startsWith(`${cell}:lawn:`) && v.using >= 0)) this.snowmen.set(cell, Math.min(1, (this.snowmen.get(cell) ?? 0) + ambientDt / 24));
    if (env.snow === 0) for (const [cell, size] of this.snowmen) { if (size - ambientDt / 6 <= 0) this.snowmen.delete(cell); else this.snowmen.set(cell, size - ambientDt / 6); }
    // Lawn games end when the last player leaves.
    for (const cell of [...this.lawnPlans.keys()]) if (![0, 1, 2, 3].some(slot => this.occupied(`${cell}:lawn:${slot}`))) this.lawnPlans.delete(cell);
    // Moving parts: the carousel speeds up and slows down, the globe is pushed, the windmill follows the wind.
    for (const m of this.motions) {
      const motion = PART_MOTION[m.kind], state = this.states.get(m.tile);
      if (motion?.update && state) motion.update(state, ambientDt, this.ridersOf(m.tile), env, this.reduced);
    }
    this.updatePigeons(dt, ambientDt, env);
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
      // Up on a footbridge people are drawn over its deck.
      const z = elevationAt(town, p.x, p.y, "road") + p.z, screen = iso(p.x, p.y, z), facing = w.pause > 0 ? w.face : p.dy + p.dx > 0 ? 1 : -1;
      add(p.x, p.y, p.z > 1 ? .62 : .02, c => {
        if (fade < 1) { c.save(); c.globalAlpha *= Math.max(0, fade); }
        if (w.look.dog) {
          const back = at(w, Math.max(0, w.s - .14)), dz = elevationAt(town, back.x, back.y, "road") + back.z, dog = iso(back.x + p.dy * .06, back.y - p.dx * .06, dz);
          stroke(c, screen.x - 1.3 * w.look.scale, screen.y - 3.6, dog.x, dog.y - 2.6, shade("#5a5046", night), .3);
          drawDog(c, dog, iso(p.dx, p.dy).x >= 0 ? 1 : -1, w.phase * 1.4, night, w.look.dog, { wag: w.phase * 2 });
        }
        if (w.bike) {
          // The rider sits on the saddle, legs on the pedals.
          const seat = drawBicycle(c, screen, p.dx, p.dy, w.phase, night, w.bike);
          drawPerson(c, seat, w.look, w.phase, facing, night, { rain: false, detail, pose: "ride", side: iso(p.dx, p.dy).x >= 0 ? 1 : -1 });
        } else drawPerson(c, screen, w.look, w.phase, facing, night, { rain, detail });
        if (fade < 1) c.restore();
      }, { left: -10, top: -18, width: 20, height: 22 });
    }
    // People waiting at the bus stops: one sits on the shelter bench, the others stand facing the road. Inside a
    // shelter that faces away they are seen through its glass back.
    for (const q of this.queues) for (let k = 0; k < q.count; k++) {
      const look = q.looks[k]; if (!look) continue;
      const sit = q.shelter && k === 0, spread = q.shelter ? [0, -.1, .1][k] ?? 0 : (k - .5) * .1, front = q.toRoad.dx + q.toRoad.dy > 0;
      const x = q.x + q.along.dx * spread - (sit ? q.toRoad.dx * .055 : 0), y = q.y + q.along.dy * spread - (sit ? q.toRoad.dy * .055 : 0);
      const center = { x: q.x - q.toRoad.dx * .03, y: q.y - q.toRoad.dy * .03 }, depth = q.shelter ? center.x + center.y + (front ? .15 : -.15) - x - y : .05;
      const z = elevationAt(town, x, y, "road"), screen = iso(x, y, z + (sit ? 4.6 : 0)), sway = sit ? 0 : Math.sin(this.time * .8 + k * 2.1 + q.tile) * .3;
      add(x, y, depth, c => drawPerson(c, { x: screen.x + sway, y: screen.y }, look, 0, front ? 1 : -1, night, { rain: rain && !q.shelter, detail, sit }), { left: -10, top: -18, width: 20, height: 22 });
    }
    const lawnCells = new Map<number, Visitor[]>(), riders = new Map<number, (Rider | undefined)[]>();
    for (const v of this.visitors) {
      const spot = v.spot && v.using >= 0 ? this.spots.get(v.spot) : undefined;
      if (spot && spot.kind !== "lawn") { const list = riders.get(spot.tile) ?? []; list[spot.slot] = { look: v.look, using: v.using, duration: v.duration, seed: v.seed }; riders.set(spot.tile, list); }
      if (spot && PAINTED.has(spot.kind)) continue;
      if (spot?.kind === "lawn") { const list = lawnCells.get(spot.tile) ?? []; list.push(v); lawnCells.set(spot.tile, list); continue; }
      // Fade in on arrival; on the way out, fade at the end of the sidewalk (or where they stand in a park without a gate).
      const gated = Boolean(this.ways.get(v.lot)?.gates.length);
      const fade = Math.min(1, v.age / .6, v.spot ? 1 : v.leaving ? routeLength(v, v.path ?? []) / .2 : gated ? 1 : Math.max(0, v.life - v.age) / .6);
      const bounds = { left: -12, top: -26, width: 24, height: 30 };
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
          drawPerson(c, pose.sit ? onSeat(p, v.look) : p, v.look, pose.sit ? 0 : v.using * 9, facing, night, { rain, pose: pose.sit ? "sit" : "walk", side: sideOf(spot.rotation, pose.du, pose.dv), detail, beat: this.time * 2 });
          if (pose.sit && detail && hash(v.seed) > .4) stroke(c, p.x - 1.4 * v.look.scale, p.y + 2.8 * v.look.scale - 6.2 * v.look.scale, p.x - 2.6 * v.look.scale, p.y + 2.8 * v.look.scale - 8.6 * v.look.scale, shade(v.look.top, night), .7 * v.look.scale);
        }), bounds);
        continue;
      }
      if (spot) {
        const p = iso(spot.x, spot.y, spot.z || 1), s = v.look.scale, beat = this.time * 2.4 + v.seed, side = spot.side;
        add(spot.x, spot.y, spot.kind === "seat" ? .4 : .03, c => draw(c, () => {
          const dog = (sit: boolean) => { if (v.look.dog) drawDog(c, { x: p.x + side * 3, y: p.y + (spot.kind === "seat" ? 2.8 * s + .4 : .6) }, -side, 0, night, v.look.dog, { sleep: sit, wag: beat * 3, size: .78 }); };
          switch (spot.kind) {
            case "seat":
              dog(true);
              drawPerson(c, onSeat(p, v.look), v.look, 0, spot.facing, night, { rain: false, pose: "sit", side, detail, beat });
              break;
            case "sand": {
              drawPerson(c, p, v.look, 0, spot.facing, night, { rain, pose: "crouch", side, detail, beat });
              const k = (v.using * .9 + hash(v.seed)) % 1, hand = { x: p.x + side * 1.6 * s, y: p.y - 1.4 * s };
              if (k > .45) for (let j = 0; j < 3; j++) { const q = (k - .45) / .55; ellipse(c, hand.x + side * (1.5 * q + j * .6), hand.y - 2.6 * Math.sin(q * Math.PI) + j * .5, .45, .3, shade(j % 2 ? "#e4ce9d" : "#bfa76f", night)); }
              break;
            }
            case "queue":
              dog(false);
              drawPerson(c, p, v.look, 0, spot.facing, night, { rain, pose: spot.slot === 0 && v.using > 1.2 ? "bend" : "walk", side, detail, beat });
              break;
            case "drink":
              drawPerson(c, p, v.look, 0, spot.facing, night, { rain, pose: v.using > .5 && v.using < v.duration - .4 ? "bend" : "walk", side, detail, beat });
              if (v.look.dog) drawDog(c, iso(spot.x + .14, spot.y - .02, 1), 1, 0, night, v.look.dog, { wag: beat * 3, size: .78 });
              break;
            case "audience": {
              // Sitting on the grass in front of the stage, clapping along.
              const cheer = v.look.kind === "child" && Math.sin(beat * .4) > .85;
              drawPerson(c, onSeat({ x: p.x, y: p.y + .4 }, v.look), v.look, 0, spot.facing, night, { rain: false, pose: cheer ? "cheer" : "clap", sit: true, side, detail, beat: this.time * 11.3 + v.seed });
              break;
            }
            default: {
              // Looking at a fountain, flowers, a windmill or a clock; children hop with excitement.
              dog(false);
              const sway = Math.sin(v.using * .8 + v.seed) * .35, jump = v.look.kind === "child" ? Math.max(0, Math.sin(v.using * 4.2)) * 1.8 : 0;
              drawPerson(c, { x: p.x + sway, y: p.y }, v.look, 0, spot.facing, night, { rain, jump, detail, beat });
            }
          }
        }), bounds);
        continue;
      }
      const goal = v.path?.[0] ?? { x: v.tx, y: v.ty }, p = iso(v.x, v.y, 1), dx = goal.x - v.x, dy = goal.y - v.y, length = Math.hypot(dx, dy), moving = length > .03;
      const facing = !moving || dx + dy >= 0 ? 1 : -1;
      add(v.x, v.y, .03, c => draw(c, () => {
        if (v.look.dog) {
          // A dog on a lead trots behind, or sits beside its owner.
          const back = moving ? { x: v.x - dx / length * .13, y: v.y - dy / length * .13 } : { x: v.x + .1, y: v.y + .04 }, d = iso(back.x, back.y, 1);
          stroke(c, p.x - 1.3 * v.look.scale, p.y - 3.6, d.x, d.y - 2.6, shade("#5a5046", night), .3);
          drawDog(c, d, moving ? dx - dy >= 0 ? 1 : -1 : -1, v.phase * 1.4, night, v.look.dog, { wag: v.phase * 2, size: .78 });
        }
        drawPerson(c, p, v.look, moving ? v.phase : 0, facing, night, { rain, detail, beat: this.time * 2 + v.seed });
      }), bounds);
    }
    this.drawLawn(add, lawnCells, env, night, detail);
    for (const [cell, size] of this.snowmen) {
      const x = cell % MAP_SIZE + .5, y = Math.floor(cell / MAP_SIZE) + .42;
      add(x, y, .02, c => snowman(c, iso(x, y, 1), size, night, cell), { left: -12, top: -22, width: 24, height: 26 });
    }
    // Christmas lights on the park trees in December, from dusk (steady when motion is reduced).
    if (illuminationSeason(env) && env.night > .2) for (const tree of this.lit) add(tree.x, tree.y, .001, c => treeLights(c, iso(tree.x, tree.y), tree.kind, this.reduced ? 0 : this.time, tree.seed, detail), { left: -22, top: -50, width: 44, height: 54 });
    // Moving parts and the people riding them.
    for (const m of this.motions) {
      const motion = PART_MOTION[m.kind], state = this.states.get(m.tile);
      if (!motion || !state) continue;
      add(m.x + .5, m.y + .5, m.depth, c => {
        const f: PartFrame = { c, x: m.x, y: m.y, tile: m.tile, rotation: m.rotation, variant: m.variant, time: this.time, env, night, detail, rain, reduced: this.reduced, state, riders: riders.get(m.tile) ?? [] };
        motion.paint(f, motionKit(f));
      }, motion.bounds);
    }
    if (env.night <= .55) for (const pigeon of this.pigeons) {
      const fly = pigeon.fly, q = fly ? fly.t : 0, x = fly ? fly.fx + (fly.tx - fly.fx) * q : pigeon.x, y = fly ? fly.fy + (fly.ty - fly.fy) * q : pigeon.y, z = fly ? Math.sin(q * Math.PI) * 18 : 0;
      add(x, y, .02, c => drawPigeon(c, iso(x, y, z + 1), pigeon.dir, pigeon.peck > 0 ? 1 : 0, fly ? this.time * 24 + pigeon.seed : 0, night), { left: -6, top: -26, width: 12, height: 28 });
    }
    for (const duck of this.ducks) {
      const p = iso(duck.x, duck.y), dir = Math.cos(duck.heading) - Math.sin(duck.heading) >= 0 ? 1 : -1, bob = Math.sin(this.time * 2 + duck.seed) * .25, asleep = env.night > .7;
      // River ducks swim on the ground layer; pond ducks above the pond's artwork.
      add(duck.x, duck.y, duck.pond ? .05 : -.4, c => {
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
    // Petals and leaves drifting down from the park's own cherries, maples and ginkgos.
    if (!reduced) for (const [i, tree] of this.fallers.entries()) {
      const on = tree.kind === "cherry" ? env.blossom > .2 : env.foliage > (tree.kind === "ginkgo" ? .45 : .4) && env.bare < .8;
      if (!on) continue;
      const colors = tree.kind === "cherry" ? ["#f6c9d4", "#fbe3e8"] : tree.kind === "maple" ? ["#d0473a", "#e0703e"] : ["#f0c537", "#e5b62c"];
      for (let j = 0; j < 5; j++) {
        const cycle = 4 + hash(i * 7 + j) * 3, k = ((t + hash(i * 3 + j) * cycle) % cycle) / cycle;
        const p = iso(tree.x + (hash(i + j * 5) - .5) * .7 + k * wind * .6, tree.y + (hash(i * 5 + j) - .5) * .5 + k * .2, (tree.kind === "ginkgo" ? 30 : 22) * (1 - k));
        c.globalAlpha = Math.min(1, (1 - k) * 4);
        const spin = Math.sin(t * 3 + j + i);
        ellipse(c, p.x + Math.sin(t * 1.6 + j) * 2.4, p.y, (tree.kind === "cherry" ? .9 : 1.2) * Math.abs(spin) + .3, tree.kind === "cherry" ? .55 : .75, shade(colors[j % 2]!, night));
      }
    }
    c.globalAlpha = 1;
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
