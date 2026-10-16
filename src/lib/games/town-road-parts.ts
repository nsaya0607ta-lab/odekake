import { MAP_SIZE, roadShape, type FacilityPart, type Town } from "./town-builder";

/**
 * Where the parts bought for a road tile stand: lamps, signals, a bus stop, a footbridge, street trees, a utility
 * pole, a curve mirror, a post box, a vending machine and stop signs on the sidewalks, and the markings and paving
 * on the road itself. Each part takes the first free place it likes for the shape of the road (straight, corner,
 * T junction, crossroads), so any mix of parts stands apart. The renderer draws from this layout and the town life
 * uses it for where people wait, cross and stop.
 */
type Point = { x: number; y: number };
export type Facing = { dx: number; dy: number };
export type SignalHead = { x: number; y: number; z: number; facing: Facing; approach: "x" | "y"; walk?: boolean };
export type RoadItem =
  | { kind: "lamp"; x: number; y: number }
  | { kind: "signal"; x: number; y: number; arms: { to: Point; head: SignalHead }[]; walks: SignalHead[] }
  | { kind: "busShelter"; x: number; y: number; along: Facing; facing: Facing }
  | { kind: "busSign"; x: number; y: number; facing: Facing }
  | { kind: "footbridge"; x: number; y: number }
  | { kind: "tree"; x: number; y: number; seed: number }
  | { kind: "pole"; x: number; y: number; seed: number }
  | { kind: "mirror"; x: number; y: number; faces: Facing[] }
  | { kind: "postbox"; x: number; y: number; facing: Facing }
  | { kind: "vending"; x: number; y: number; facing: Facing }
  | { kind: "stopSign"; x: number; y: number; facing: Facing };
export type RoadLayout = {
  tile: number; x: number; y: number;
  shape: ReturnType<typeof roadShape>["shape"]; mask: number; axis: "x" | "y"; bridge: boolean;
  parts: ReadonlySet<FacilityPart>;
  items: RoadItem[];
  /** A marked crossing in the middle of a straight road (a crosswalk, or the one a signal brings). */
  crosswalk: boolean;
  /** Traffic lights: at a junction, or a pedestrian crossing on a straight road. */
  signal: "junction" | "crossing" | null;
  /** Arms (towards a neighbour) whose traffic stops before entering: stop lines are painted there. */
  stopArms: Facing[];
  /** Guardrail runs on the curb, in world coordinates. */
  rails: Point[][];
  paving: boolean;
  /** Where waiting passengers stand on each side (side -1 is the low-coordinate side). */
  busWait: { side: -1 | 1; x: number; y: number; along: Facing; a: number; shelter: boolean }[];
  /** The way over a footbridge, from the low side to the high side: stair foot, top, across, top, foot. */
  bridgeWay: { x: number; y: number; z: number }[] | null;
};

/** The side of a straight road (-1 low, 1 high) where traffic going the +x or +y way drives: cars keep left. */
export const plusSide = (axis: "x" | "y"): -1 | 1 => axis === "x" ? -1 : 1;
const ROAD_PARTS: readonly FacilityPart[] = ["light", "signal", "crosswalk", "stopSign", "busStop", "footbridge", "roadTrees", "pole", "mirror", "guardrail", "postbox", "paving", "vending"];
/** Height of a footbridge deck above the road (px). */
export const BRIDGE_Z = 18;
const hash = (n: number) => { const v = Math.sin(n * 91.7 + 3.1) * 43758.5453; return v - Math.floor(v); };

/** The road parts of one tile placed for its current shape. `defaultLamp` is the plain street lamp some tiles get for free. */
export function roadLayout(town: Pick<Town, "tiles" | "terrain" | "attachments">, tile: number, defaultLamp = false): RoadLayout {
  const x = tile % MAP_SIZE, y = Math.floor(tile / MAP_SIZE), { mask, shape, axis } = roadShape(town.tiles, tile), bridge = Boolean(town.terrain[tile]);
  const owned = town.attachments.find(a => a.tile === tile && a.kind === "road")?.parts ?? [];
  const parts = new Set(owned.filter(p => ROAD_PARTS.includes(p)));
  const layout: RoadLayout = { tile, x, y, shape, mask, axis, bridge, parts, items: [], crosswalk: false, signal: null, stopArms: [], rails: [], paving: parts.has("paving"), busWait: [], bridgeWay: null };
  if (shape === "straight" || shape === "end" || shape === "none") straight(layout, defaultLamp);
  else junction(layout, defaultLamp);
  return layout;
}

/** Straight roads (and dead ends): two sidewalks, each a row of places measured along the road. */
function straight(l: RoadLayout, defaultLamp: boolean) {
  const { x, y, axis, parts, bridge } = l, straightRoad = l.shape === "straight";
  // A point `a` along the road, on side `side` (-1: low x/y), `d` in from the outer edge of the tile.
  const at = (a: number, side: -1 | 1, d: number): Point => axis === "x" ? { x: x + a, y: y + (side < 0 ? d : 1 - d) } : { x: x + (side < 0 ? d : 1 - d), y: y + a };
  const toRoad = (side: -1 | 1): Facing => axis === "x" ? { dx: 0, dy: -side } : { dx: -side, dy: 0 };
  const along: Facing = axis === "x" ? { dx: 1, dy: 0 } : { dx: 0, dy: 1 };
  const rows: Record<number, [number, number][]> = { [-1]: [], [1]: [] };
  const free = (side: -1 | 1, a: number, w: number) => a - w / 2 >= -.001 && a + w / 2 <= 1.001 && rows[side]!.every(([p, q]) => a + w / 2 <= p || a - w / 2 >= q);
  const place = (options: [-1 | 1, number, number][][]) => {
    for (const option of options) if (option.every(([s, a, w]) => free(s, a, w))) { for (const [s, a, w] of option) rows[s]!.push([a - w / 2, a + w / 2]); return option; }
    return null;
  };
  if (!bridge && straightRoad && parts.has("footbridge") && place([[[-1, .27, .36], [1, .73, .36]]])) {
    l.items.push({ kind: "footbridge", x: x + .5, y: y + .5 });
    l.bridgeWay = [{ ...at(.1, -1, .1), z: 0 }, { ...at(.44, -1, .1), z: BRIDGE_Z }, { ...at(.5, -1, .12), z: BRIDGE_Z }, { ...at(.5, 1, .12), z: BRIDGE_Z }, { ...at(.56, 1, .1), z: BRIDGE_Z }, { ...at(.9, 1, .1), z: 0 }];
  }
  if (!bridge && straightRoad && parts.has("busStop")) {
    const spot = place([[[-1, .72, .4], [1, .5, .06]], [[1, .72, .4], [-1, .5, .06]], [[-1, .28, .4], [1, .5, .06]], [[1, .28, .4], [-1, .5, .06]]]);
    if (spot) {
      const [[shelterSide, a], [signSide]] = spot as [[-1 | 1, number, number], [-1 | 1, number, number]];
      const end = a < .5 ? a + .2 : a - .2;
      l.items.push({ kind: "busShelter", ...at(a!, shelterSide, .1), along, facing: toRoad(shelterSide) });
      l.items.push({ kind: "busSign", ...at(end, shelterSide, .17), facing: toRoad(shelterSide) });
      l.items.push({ kind: "busSign", ...at(.5, signSide, .17), facing: toRoad(signSide) });
      l.busWait.push({ side: shelterSide, ...at(a!, shelterSide, .13), along, a: a!, shelter: true }, { side: signSide, ...at(.5, signSide, .12), along, a: .5, shelter: false });
    }
  }
  if (!bridge && straightRoad && parts.has("signal")) {
    // Each pole stands just past the crossing on the left of the traffic it controls (cars keep left).
    const plus = plusSide(axis), minus = -plus as -1 | 1;
    const spot = place([[[plus, .7, .06], [minus, .3, .06]]]);
    if (spot) {
      l.signal = "crossing"; l.crosswalk = true;
      const first = at(.7, plus, .16), second = at(.3, minus, .16), back: Facing = { dx: -along.dx, dy: -along.dy }, across = axis === "x" ? "y" : "x";
      l.items.push({ kind: "signal", ...first, arms: [{ to: at(.7, plus, .36), head: { ...at(.7, plus, .36), z: 25, facing: back, approach: axis } }], walks: [{ ...first, z: 15, facing: toRoad(plus), approach: across, walk: true }] });
      l.items.push({ kind: "signal", ...second, arms: [{ to: at(.3, minus, .36), head: { ...at(.3, minus, .36), z: 25, facing: along, approach: axis } }], walks: [{ ...second, z: 15, facing: toRoad(minus), approach: across, walk: true }] });
    }
  }
  if (straightRoad && parts.has("crosswalk") && !bridge) l.crosswalk = true;
  if (bridge) {
    // On a bridge the lamps stand on the deck, inside the railings.
    if (parts.has("light") || defaultLamp) l.items.push({ kind: "lamp", ...at(.42, -1, .22) });
    if (parts.has("light")) l.items.push({ kind: "lamp", ...at(.72, 1, .22) });
    return;
  }
  if (parts.has("light") || defaultLamp) {
    const first = place([[[1, .42, .08]], [[1, .2, .08]], [[1, .85, .08]], [[1, .6, .08]]]);
    if (first) l.items.push({ kind: "lamp", ...at(first[0]![1], 1, .14) });
    if (parts.has("light")) {
      const second = place([[[-1, .72, .08]], [[-1, .9, .08]], [[-1, .3, .08]], [[-1, .1, .08]]]);
      if (second) l.items.push({ kind: "lamp", ...at(second[0]![1], -1, .14) });
    }
  }
  if (parts.has("roadTrees")) {
    // A pair across the road from each other (one behind the other would hide it).
    const spot = place([[[-1, .18, .16], [1, .18, .16]], [[-1, .82, .16], [1, .82, .16]], [[-1, .5, .16], [1, .5, .16]], [[-1, .18, .16]], [[1, .82, .16]], [[-1, .82, .16]], [[1, .18, .16]], [[-1, .5, .16]], [[1, .5, .16]]]);
    for (const [s, a] of spot ?? []) l.items.push({ kind: "tree", ...at(a, s, .11), seed: l.tile * 2 + (s > 0 ? 1 : 0) });
  }
  if (parts.has("pole")) {
    // The same place on every tile when it can, so a row of poles stands evenly spaced along the street.
    const spot = place([[[-1, .93, .06]], [[-1, .75, .06]], [[-1, .55, .06]], [[1, .93, .06]], [[1, .75, .06]], [[-1, .07, .06]], [[1, .07, .06]], [[1, .45, .06]]]);
    if (spot) l.items.push({ kind: "pole", ...at(spot[0]![1], spot[0]![0], .07), seed: l.tile });
  }
  if (parts.has("vending")) {
    const spot = place([[[-1, .45, .14]], [[1, .58, .14]], [[-1, .6, .14]], [[1, .3, .14]], [[-1, .3, .14]], [[1, .15, .14]]]);
    if (spot) l.items.push({ kind: "vending", ...at(spot[0]![1], spot[0]![0], .09), facing: toRoad(spot[0]![0]) });
  }
  if (parts.has("postbox")) {
    const spot = place([[[1, .62, .07]], [[-1, .62, .07]], [[1, .3, .07]], [[-1, .3, .07]], [[1, .1, .07]], [[-1, .1, .07]]]);
    if (spot) l.items.push({ kind: "postbox", ...at(spot[0]![1], spot[0]![0], .1), facing: toRoad(spot[0]![0]) });
  }
  if (parts.has("guardrail")) {
    // Along both curbs, open where people step off: at the crossing and where the bus stops.
    for (const side of [-1, 1] as const) {
      const gaps: [number, number][] = [];
      if (l.crosswalk) gaps.push([.33, .67]);
      for (const w of l.busWait) if (w.side === side) gaps.push(w.shelter ? [w.a - .24, w.a + .24] : [.42, .58]);
      const ends = l.shape === "end" ? [l.mask & (axis === "x" ? 1 : 4) ? 0 : .76, l.mask & (axis === "x" ? 2 : 8) ? 1 : .24].sort((p, q) => p - q) : [0, 1];
      let from = ends[0]!;
      for (const [p, q] of [...gaps.sort((g, h) => g[0] - h[0]), [ends[1]!, ends[1]!] as [number, number]]) {
        if (p - from > .05) l.rails.push([at(from, side, .235), at(Math.min(p, ends[1]!), side, .235)]);
        from = Math.max(from, q);
      }
    }
  }
}

/** Corners, T junctions and crossroads: a sidewalk square at each corner, and whole sides where no road joins. */
function junction(l: RoadLayout, defaultLamp: boolean) {
  const { x, y, mask, parts, shape, bridge } = l;
  const arms: Facing[] = [{ dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 }].filter((_, j) => mask & (1 << j));
  const has = (dx: number, dy: number) => arms.some(a => a.dx === dx && a.dy === dy);
  const taken = new Set<string>();
  const spots: Record<string, Point> = { c00: { x: .12, y: .12 }, c10: { x: .88, y: .12 }, c01: { x: .12, y: .88 }, c11: { x: .88, y: .88 } };
  // Whole sides of the tile where no road joins (the outside of a bend, the top of a T).
  if (!has(0, -1)) Object.assign(spots, { u1: { x: .36, y: .1 }, u2: { x: .64, y: .1 }, um: { x: .5, y: .1 } });
  if (!has(0, 1)) Object.assign(spots, { d1: { x: .36, y: .9 }, d2: { x: .64, y: .9 }, dm: { x: .5, y: .9 } });
  if (!has(-1, 0)) Object.assign(spots, { l1: { x: .1, y: .36 }, l2: { x: .1, y: .64 }, lm: { x: .1, y: .5 } });
  if (!has(1, 0)) Object.assign(spots, { r1: { x: .9, y: .36 }, r2: { x: .9, y: .64 }, rm: { x: .9, y: .5 } });
  // Middle points block their quarter points and the other way round.
  const blocks: Record<string, string[]> = { um: ["u1", "u2"], u1: ["um"], u2: ["um"], dm: ["d1", "d2"], d1: ["dm"], d2: ["dm"], lm: ["l1", "l2"], l1: ["lm"], l2: ["lm"], rm: ["r1", "r2"], r1: ["rm"], r2: ["rm"] };
  const place = (options: string[][]) => {
    for (const option of options) if (option.every(id => spots[id] && !taken.has(id))) { for (const id of option) { taken.add(id); for (const b of blocks[id] ?? []) taken.add(b); } return option.map(id => ({ x: x + spots[id]!.x, y: y + spots[id]!.y })); }
    return null;
  };
  const toward = (p: Point): Facing => { const dx = x + .5 - p.x, dy = y + .5 - p.y; return Math.abs(dx) > Math.abs(dy) ? { dx: Math.sign(dx), dy: 0 } : { dx: 0, dy: Math.sign(dy) }; };
  const junctionTile = shape === "tee" || shape === "cross";
  if (!bridge && junctionTile && parts.has("signal") && place([["c10", "c01"]])) {
    l.signal = "junction";
    // Each head hangs past the junction on the far side from the traffic it faces.
    const pole = (corner: Point, heads: { arm: Facing; approach: Facing }[], walks: SignalHead[]) => ({
      kind: "signal" as const, x: x + corner.x, y: y + corner.y, walks,
      arms: heads.filter(h => has(-h.approach.dx, -h.approach.dy)).map(h => {
        const to = { x: x + corner.x + h.arm.dx * .26, y: y + corner.y + h.arm.dy * .26 };
        return { to, head: { ...to, z: 25, facing: { dx: -h.approach.dx, dy: -h.approach.dy }, approach: h.approach.dx ? "x" as const : "y" as const } };
      }),
    });
    // Walk lights face the people crossing towards them; they walk with the traffic going their way.
    const walk = (p: Point, facing: Facing): SignalHead => ({ x: x + p.x, y: y + p.y, z: 14, facing, approach: facing.dx ? "x" : "y", walk: true });
    l.items.push(pole(spots.c10!, [{ arm: { dx: 0, dy: 1 }, approach: { dx: 1, dy: 0 } }, { arm: { dx: -1, dy: 0 }, approach: { dx: 0, dy: -1 } }], [walk(spots.c10!, { dx: -1, dy: 0 }), walk(spots.c10!, { dx: 0, dy: 1 })]));
    l.items.push(pole(spots.c01!, [{ arm: { dx: 0, dy: -1 }, approach: { dx: -1, dy: 0 } }, { arm: { dx: 1, dy: 0 }, approach: { dx: 0, dy: 1 } }], [walk(spots.c01!, { dx: 1, dy: 0 }), walk(spots.c01!, { dx: 0, dy: -1 })]));
  }
  if (!bridge && junctionTile && parts.has("stopSign") && !l.signal) {
    // A sign on the left of each way in, just before the stop line (cars keep left).
    for (const arm of arms) {
      const sx = arm.dx < 0 ? .04 : arm.dx > 0 ? .96 : arm.dy < 0 ? .8 : .2, sy = arm.dy < 0 ? .04 : arm.dy > 0 ? .96 : arm.dx < 0 ? .2 : .8;
      l.items.push({ kind: "stopSign", x: x + sx, y: y + sy, facing: arm });
      l.stopArms.push(arm);
    }
  }
  if (!bridge && parts.has("mirror") && (shape === "corner" || shape === "tee")) {
    const sx = arms.reduce((s, a) => s + a.dx, 0), sy = arms.reduce((s, a) => s + a.dy, 0);
    const outer = shape === "corner" ? `c${sx < 0 ? 1 : 0}${sy < 0 ? 1 : 0}` : sy > 0 ? "um" : sy < 0 ? "dm" : sx > 0 ? "lm" : "rm";
    const spot = place([[outer], ["u1"], ["r1"], ["d2"], ["l2"]]);
    // Two round mirrors: at a bend one looks down each road; at a T they look both ways along the top road, for the
    // cars coming up the stem.
    const stem = { dx: Math.sign(x + .5 - (spot?.[0]?.x ?? 0)), dy: Math.sign(y + .5 - (spot?.[0]?.y ?? 0)) };
    const faces = shape === "corner" ? arms.map(a => ({ dx: a.dx, dy: a.dy })) : stem.dx ? [{ dx: stem.dx * .8, dy: -.6 }, { dx: stem.dx * .8, dy: .6 }] : [{ dx: -.6, dy: stem.dy * .8 }, { dx: .6, dy: stem.dy * .8 }];
    if (spot) l.items.push({ kind: "mirror", ...spot[0]!, faces });
  }
  if (bridge) {
    if (parts.has("light") || defaultLamp) l.items.push({ kind: "lamp", x: x + .77, y: y + .77 });
    if (parts.has("light")) l.items.push({ kind: "lamp", x: x + .23, y: y + .23 });
    return;
  }
  if (parts.has("light") || defaultLamp) {
    const first = place([["c11"], ["d2"], ["r2"], ["c10"], ["c01"]]);
    if (first) l.items.push({ kind: "lamp", ...first[0]! });
    if (parts.has("light")) { const second = place([["c00"], ["u1"], ["l1"], ["c01"], ["c10"]]); if (second) l.items.push({ kind: "lamp", ...second[0]! }); }
  }
  if (parts.has("roadTrees") && shape === "corner") {
    // One tree on the outside of the bend (two would stand one behind the other).
    const sx = arms.reduce((s, a) => s + a.dx, 0), sy = arms.reduce((s, a) => s + a.dy, 0);
    const spot = place([[`c${sx < 0 ? 1 : 0}${sy < 0 ? 1 : 0}`], ["um"], ["rm"], ["dm"], ["lm"]]);
    if (spot) l.items.push({ kind: "tree", ...spot[0]!, seed: l.tile * 2 });
  }
  if (parts.has("pole")) { const spot = place([["c10"], ["c01"], ["c00"], ["c11"], ["u2"], ["r1"], ["d1"], ["l2"]]); if (spot) l.items.push({ kind: "pole", ...spot[0]!, seed: l.tile }); }
  if (parts.has("vending")) { const spot = place([["u1"], ["d2"], ["l1"], ["r2"], ["um"], ["dm"], ["lm"], ["rm"], ["c00"], ["c11"]]); if (spot) l.items.push({ kind: "vending", ...spot[0]!, facing: toward(spot[0]!) }); }
  if (parts.has("postbox")) { const spot = place([["d1"], ["u2"], ["r1"], ["l2"], ["dm"], ["um"], ["c01"], ["c10"], ["c11"], ["c00"]]); if (spot) l.items.push({ kind: "postbox", ...spot[0]!, facing: toward(spot[0]!) }); }
  if (parts.has("guardrail")) {
    // On every curb, open at the corners of a junction where the crosswalks reach the sidewalk.
    const lo = .235, hi = 1 - lo, open = shape === "tee" || shape === "cross" ? .13 : lo;
    const L = has(-1, 0), R = has(1, 0), U = has(0, -1), D = has(0, 1);
    const run = (a: Point, b: Point) => { if (Math.hypot(a.x - b.x, a.y - b.y) > .05) l.rails.push([{ x: x + a.x, y: y + a.y }, { x: x + b.x, y: y + b.y }]); };
    // A whole side with no road joining, broken where the crosswalks of the arms beside it land.
    const side = (fixed: number, horizontal: boolean, before: boolean, after: boolean) => {
      const p = (t: number) => horizontal ? { x: t, y: fixed } : { x: fixed, y: t };
      // The top of a T: both arms beside it carry crosswalks.
      if (shape === "tee") { run(p(0), p(open)); run(p(lo), p(hi)); run(p(1 - open), p(1)); }
      else run(p(before ? 0 : lo), p(after ? 1 : hi));
    };
    if (!U) side(lo, true, L, R);
    if (!D) side(hi, true, L, R);
    if (!L) side(lo, false, U, D);
    if (!R) side(hi, false, U, D);
    // The inside corner between two arms (at a junction the crosswalks take it).
    if (shape === "corner") for (const [cx, cy, a, b] of [[0, 0, L, U], [1, 0, R, U], [0, 1, L, D], [1, 1, R, D]] as const) if (a && b) {
      const ex = cx ? 1 : 0, ey = cy ? 1 : 0, kx = cx ? hi : lo, ky = cy ? hi : lo, ox = cx ? 1 - open : open, oy = cy ? 1 - open : open;
      run({ x: ex, y: ky }, { x: ox, y: ky }); run({ x: kx, y: ey }, { x: kx, y: oy });
    }
  }
}
/** Utility poles carry wires to the poles of the neighbouring road tiles. */
export function poleWires(layouts: ReadonlyMap<number, RoadLayout>) {
  const wires: { from: Point; to: Point; tiles: [number, number] }[] = [];
  for (const [tile, layout] of layouts) {
    const pole = layout.items.find(i => i.kind === "pole"); if (!pole) continue;
    for (const n of [tile + 1, tile + MAP_SIZE]) {
      if (n === tile + 1 && tile % MAP_SIZE === MAP_SIZE - 1) continue;
      if (!(layout.mask & (n === tile + 1 ? 2 : 8))) continue;
      const other = layouts.get(n)?.items.find(i => i.kind === "pole");
      if (other) wires.push({ from: { x: pole.x, y: pole.y }, to: { x: other.x, y: other.y }, tiles: [tile, n] });
    }
  }
  return wires;
}
export const roadSeed = hash;

export type Light = "green" | "yellow" | "red";
export type Walk = "walk" | "flash" | "stop";
/**
 * What the signals of a road tile show at town time `time`: the light for traffic along each axis, and the walk
 * light for people walking along each axis (they go with the traffic beside them). Each junction runs its own cycle.
 */
export function signalState(l: Pick<RoadLayout, "signal" | "axis" | "tile">, time: number): { x: Light; y: Light; walkX: Walk; walkY: Walk } {
  if (l.signal === "junction") {
    const cycle = 21, t = ((time + hash(l.tile) * cycle) % cycle + cycle) % cycle;
    const light = (start: number): Light => t >= start && t < start + 7 ? "green" : t >= start + 7 && t < start + 9 ? "yellow" : "red";
    const walk = (start: number): Walk => t >= start && t < start + 4.6 ? "walk" : t >= start + 4.6 && t < start + 6.6 ? "flash" : "stop";
    return { x: light(0), y: light(10.5), walkX: walk(0), walkY: walk(10.5) };
  }
  if (l.signal === "crossing") {
    // A push-button crossing: the road stays green most of the time, then people cross.
    const cycle = 17, t = ((time + hash(l.tile) * cycle) % cycle + cycle) % cycle;
    const cars: Light = t < 9 ? "green" : t < 11 ? "yellow" : "red", walk: Walk = t >= 12 && t < 14.6 ? "walk" : t >= 14.6 && t < 16.2 ? "flash" : "stop";
    return l.axis === "x" ? { x: cars, y: "red", walkX: "stop", walkY: walk } : { x: "red", y: cars, walkX: walk, walkY: "stop" };
  }
  return { x: "green", y: "green", walkX: "walk", walkY: "walk" };
}
