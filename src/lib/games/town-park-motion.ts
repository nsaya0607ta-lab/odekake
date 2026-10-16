import type { ParkPart } from "./town-builder";
import type { TownEnvironment } from "./town-environment";
import { TAU, drawPerson, ellipse, stroke, type Look, type PersonOptions, type Point, type Pose } from "./town-figures";
import { shade } from "./town-paint";
import {
  BAR_SPECS, FAUCET, GLOBE, HOOP, SPLASH_FROG, SPLASH_JETS, SPLASH_MUSHROOM, SPRING_SEATS, STAGE, TILE_PX, WINDMILL_HUB,
  bandstandColumns, carouselTop, drawBar, flagCloth, flowerClockHands, globeDome, jungleBars, parkKit, seesawPlank, springAnimal, windmillSails, type Kit,
} from "./town-park-art";

/**
 * The moving park: what people do at each part, when it is open, and the pieces that move every frame
 * (swing seats, the seesaw, carousel horses, windmill sails, fountain water…). People who ride or play on a
 * part are drawn by that part's painter, in between its moving pieces, so a child sits on the horse and
 * a climber is tucked between the bars of the climbing frame.
 */
const hash = (n: number) => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
type Bounds = { left: number; top: number; width: number; height: number };

export type SpotKind = "swing" | "slide" | "sand" | "seat" | "watch" | "seesaw" | "spring" | "globe" | "carousel" | "climb" | "splash" | "bars" | "hoop" | "queue" | "drink" | "audience" | "lawn";
export type Who = "child" | "adult" | "any";
/** A place on a part (local tile coordinates; positions outside 0..1 are beside the part). */
export type SpotDef = { slot: number; kind: SpotKind; u: number; v: number; z?: number; du?: number; dv?: number; who: Who };
/** Spots whose person is painted with the part. */
export const PAINTED: ReadonlySet<SpotKind> = new Set<SpotKind>(["swing", "seesaw", "spring", "globe", "carousel", "climb", "splash", "bars", "hoop"]);
const seat = (slot: number, u: number, v: number, z: number, du: number, dv: number, who: Who = "adult"): SpotDef => ({ slot, kind: "seat", u, v, z, du, dv, who });
const watch = (slot: number, u: number, v: number, du: number, dv: number, who: Who = "adult"): SpotDef => ({ slot, kind: "watch", u, v, z: 1, du, dv, who });
const around = (count: number, radius: number, phase: number, make: (slot: number, u: number, v: number) => SpotDef) => Array.from({ length: count }, (_, j) => make(j, .5 + Math.cos(phase + j * TAU / count) * radius, .5 + Math.sin(phase + j * TAU / count) * radius));
export const PART_SPOTS: Partial<Record<ParkPart, SpotDef[]>> = {
  swings: [.365, .625].map((u, slot) => ({ slot, kind: "swing", u, v: .8, who: "child" })),
  playground: [{ slot: 0, kind: "slide", u: .28, v: .05, who: "child" }],
  sandbox: [{ slot: 0, kind: "sand", u: .45, v: .6, z: 3.2, du: 0, dv: 1, who: "child" }, { slot: 1, kind: "sand", u: .64, v: .4, z: 3.2, du: -1, dv: 0, who: "child" }],
  bench: [seat(0, .36, .5, 5.6, 0, 1, "any"), seat(1, .64, .5, 5.6, 0, 1)],
  picnic: [seat(0, .36, .23, 6, 0, 1, "any"), seat(1, .64, .23, 6, 0, 1), seat(2, .4, .8, 6, 0, -1, "any"), seat(3, .62, .8, 6, 0, -1)],
  gazebo: [seat(0, .5, .3, 9.4, 0, 1), seat(1, .3, .58, 9.4, 1, 0, "any")],
  fountain: [watch(0, .5, .88, 0, -1, "any"), watch(1, .88, .5, -1, 0), watch(2, .12, .5, 1, 0), watch(3, .5, .12, 0, 1, "any")],
  pond: [watch(0, .5, 1.12, 0, -1, "any"), watch(1, 1.12, .5, -1, 0), watch(2, -.12, .5, 1, 0, "any"), watch(3, .5, -.12, 0, 1)],
  cherry: [watch(0, .5, .86, 0, -1), watch(1, .86, .5, -1, 0)], flowers: [watch(0, .5, .86, 0, -1), watch(1, .86, .5, -1, 0)],
  sculpture: [watch(0, .5, .86, 0, -1), watch(1, .86, .5, -1, 0)], clock: [watch(0, .5, .86, 0, -1), watch(1, .86, .5, -1, 0)],
  arch: [watch(0, .5, .8, 0, -1)],
  seesaw: [{ slot: 0, kind: "seesaw", u: .1, v: .66, who: "child" }, { slot: 1, kind: "seesaw", u: .9, v: .66, who: "child" }],
  springRider: SPRING_SEATS.map((u, slot) => ({ slot, kind: "spring", u, v: .74, who: "child" })),
  globe: around(3, .42, .8, (slot, u, v) => ({ slot, kind: "globe", u, v, who: "child" })),
  carousel: [...[0, 1, 2, 3].map(slot => ({ slot, kind: "carousel" as const, u: .5, v: .97, who: "child" as const })), watch(4, .18, 1.1, 0, -1), watch(5, .82, 1.1, 0, -1)],
  jungleGym: [[.92, .62], [.4, .94], [.3, .95]].map(([u, v], slot) => ({ slot, kind: "climb" as const, u: u!, v: v!, who: "child" as const })),
  splashPad: around(4, .47, .4, (slot, u, v) => ({ slot, kind: "splash", u, v, who: "child" })),
  bars: [0, 1].map(slot => ({ slot, kind: "bars" as const, u: (BAR_SPECS[slot]!.u0 + BAR_SPECS[slot]!.u1) / 2, v: .64, who: "child" as const })),
  basketball: [{ slot: 0, kind: "hoop", u: .5, v: .62, who: "adult" }, { slot: 1, kind: "hoop", u: .3, v: .55, who: "any" }],
  foodCart: [[.41, .84], [.28, .87], [.15, .89], [.03, .9]].map(([u, v], slot) => ({ slot, kind: "queue" as const, u: u!, v: v!, z: 1, du: 0, dv: -1, who: "any" as const })),
  parasol: [-2.3, -.5, 1.4].map((a, slot) => seat(slot, .5 + Math.cos(a) * .22, .5 + Math.sin(a) * .22, 4.9, -Math.cos(a), -Math.sin(a), "any")),
  drinkFountain: [{ slot: 0, kind: "drink", u: .5, v: .64, z: 1, du: 0, dv: -1, who: "any" }],
  bandstand: [[.24, .98], [.5, 1.02], [.76, .98], [.36, 1.18], [.64, 1.18], [.14, 1.14], [.86, 1.14]].map(([u, v], slot) => ({ slot, kind: "audience" as const, u: u!, v: v!, z: 1, du: .5 - u!, dv: .5 - v!, who: "any" as const })),
  windmill: [watch(0, .5, 1.08, 0, -1, "any"), watch(1, 1.08, .5, -1, 0)],
  flowerClock: [watch(0, .5, .99, 0, -1, "any"), watch(1, .22, .96, .3, -1)],
  flowerField: [watch(0, .5, 1.02, 0, -1, "any"), watch(1, 1.02, .5, -1, 0)],
  maple: [watch(0, .5, .88, 0, -1), watch(1, .88, .5, -1, 0)], ginkgo: [watch(0, .5, .88, 0, -1), watch(1, .88, .5, -1, 0)],
  wisteria: [seat(0, .4, .5, 5.6, 0, 1, "any"), seat(1, .6, .5, 5.6, 0, 1), watch(2, .5, .95, 0, -1)],
  lantern: [watch(0, .5, .86, 0, -1)],
};

// ---- When things are open --------------------------------------------------------------------------

/** The carousel turns while the shops are open, unless it is raining hard. */
export const carouselRunning = (env: TownEnvironment) => env.shopsOpen && env.rain < .5 && env.snow < .5;
/** Water play runs on warm summer days; the rest of the year the pad is drained. */
export const splashActive = (env: TownEnvironment) => env.night < .45 && env.rain < .2 && env.snow === 0 && (env.temperature ?? 24) >= 21 && env.season === "summer";
/** The band plays from 11:00 to 20:00 when it is dry. */
export const performing = (env: TownEnvironment) => { const h = env.minutes / 60; return h >= 11 && h < 20 && env.rain < .2 && env.snow === 0; };
/** Carp streamers fly from April to Children's Day (5 May), a few days either side. */
export function koinoboriSeason(env: TownEnvironment) {
  const d = new Date(env.time + 9 * 3600_000), month = d.getUTCMonth() + 1, day = d.getUTCDate();
  return month === 4 || month === 5 && day <= 10;
}
/** Month * 100 + day in Japan time. */
const monthDay = (env: TownEnvironment) => { const d = new Date(env.time + 9 * 3600_000); return (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); };
/** Tanabata: wishes hang on the bamboo from late June to the night of 7 July. */
export const tanabataSeason = (env: TownEnvironment) => monthDay(env) >= 625 && monthDay(env) <= 707;
/** The park trees are lit for Christmas through December up to the 25th, from dusk. */
export const illuminationSeason = (env: TownEnvironment) => monthDay(env) >= 1201 && monthDay(env) <= 1225;
export function spotOpen(kind: SpotKind, env: TownEnvironment) {
  if (kind === "carousel") return carouselRunning(env);
  if (kind === "splash") return splashActive(env);
  if (kind === "audience") return performing(env);
  if (kind === "queue") return env.shopsOpen && env.night < .95;
  if (kind === "hoop" || kind === "lawn" || kind === "sand" || kind === "climb" || kind === "bars") return env.rain < .2 && env.snow === 0;
  return true;
}
export const CLIMB_STEP = .85;
const BAR_CYCLE = 7.2, SHOT = 6.4;
/** How long people stay at a spot, in seconds. */
export function spotDuration(kind: SpotKind, roll: number, slot = 0) {
  switch (kind) {
    case "swing": return 9 + roll * 10;
    case "seesaw": return 12 + roll * 12;
    case "spring": return 6 + roll * 8;
    case "globe": return 10 + roll * 10;
    case "carousel": return 20 + roll * 16;
    case "climb": return (CLIMBS[slot % CLIMBS.length]!.length - 1) * CLIMB_STEP;
    case "splash": return 14 + roll * 16;
    case "bars": return BAR_CYCLE * (1 + Math.floor(roll * 2));
    case "hoop": return SHOT * (3 + Math.floor(roll * 3));
    case "queue": return 4;
    case "drink": return 2.6 + roll * 1.4;
    case "audience": return 24 + roll * 30;
    case "seat": return 12 + roll * 20;
    case "sand": return 10 + roll * 12;
    case "lawn": return 26 + roll * 34;
    default: return 6 + roll * 8;
  }
}

// ---- Painting moving pieces -------------------------------------------------------------------------

export type Rider = { look: Look; using: number; duration: number; seed: number };
export type PartState = { angle: number; speed: number; bob: number };
export type PartFrame = {
  c: CanvasRenderingContext2D; x: number; y: number; tile: number; rotation: number; variant: number;
  time: number; env: TownEnvironment; night: number; detail: boolean; rain: boolean; reduced: boolean;
  state: PartState; riders: (Rider | undefined)[];
};
type Motion = {
  /** Depth after the tile's own artwork (which is at +1): above it by default; below it when the moving piece is behind. */
  depth?: (k: Kit) => number;
  bounds: Bounds;
  paint: (f: PartFrame, k: Kit) => void;
  update?: (state: PartState, dt: number, riders: (Rider | undefined)[], env: TownEnvironment, reduced: boolean) => void;
};
/** +1 when a local direction points towards the viewer. */
const toward = (k: Kit, du: number, dv: number) => k.depth(.5 + du * .1, .5 + dv * .1) >= k.depth(.5, .5) ? 1 : -1;
function person(f: PartFrame, p: Point, r: Rider, facing: number, options: Partial<PersonOptions> & { walk?: number } = {}) {
  drawPerson(f.c, p, r.look, options.walk ?? 0, facing, f.night, { rain: false, detail: f.detail, beat: f.time * 2.5 + r.seed, ...options });
}
/** Feet point that puts the hips of a sitting or riding person on the seat. */
const onSeat = (p: Point, look: Look) => ({ x: p.x, y: p.y + 2.8 * look.scale });
const ramp = (r: Rider, rise: number, fall: number) => clamp(Math.min(r.using / rise, (r.duration - r.using) / fall));

const SWING_SEATS = [.365, .625];
const swingSeat = (angle: number) => ({ v: .55 + Math.sin(angle) * .42, z: 25 - 18 * Math.cos(angle) });
function paintSwings(f: PartFrame, k: Kit) {
  const windSway = Math.min(.12, f.env.wind / 120), facing = toward(k, 0, 1);
  SWING_SEATS.forEach((u, j) => {
    const r = f.riders[j];
    // Pump up to full height, then slow down before hopping off.
    const angle = r ? ramp(r, 3, 2.5) * .75 * Math.sin(r.using * 2.4 + j) : f.reduced ? 0 : windSway * Math.sin(f.time * 1.3 + j * 1.7 + f.tile);
    const s = swingSeat(angle);
    for (const a of [-.055, .055]) k.line(k.at(u + a, .48, 25), k.at(u + a, s.v, s.z + .6), "#d6d7b9", .65);
    const corners = [k.at(u - .065, s.v - .05, s.z), k.at(u + .065, s.v - .05, s.z), k.at(u + .065, s.v + .05, s.z), k.at(u - .065, s.v + .05, s.z)];
    k.poly(corners, "#be9167");
    k.poly([corners[3]!, corners[2]!, { x: corners[2]!.x, y: corners[2]!.y + 1 }, { x: corners[3]!.x, y: corners[3]!.y + 1 }], "#926b4e");
    if (r) person(f, onSeat(k.at(u, s.v, s.z), r.look), r, facing, { pose: "sit", side: k.side(0, 1) });
  });
}
function paintSeesaw(f: PartFrame, k: Kit) {
  const [a, b] = f.riders;
  let angle = -.17;
  if (a && b) angle = .17 * clamp(Math.sin(f.time * 1.9 + f.tile) * 1.7, -1, 1);
  else if (a) angle = .17 - Math.abs(Math.sin(f.time * 2.6)) * .02;
  else if (b) angle = -.17 + Math.abs(Math.sin(f.time * 2.6)) * .02;
  seesawPlank(k, angle, (p, end) => {
    const r = end < 0 ? a : b; if (!r) return;
    person(f, onSeat(p, r.look), r, toward(k, -end, 0), { pose: "ride" });
  });
}
function paintSprings(f: PartFrame, k: Kit) {
  const slots = SPRING_SEATS.map((u, slot) => ({ slot, d: k.depth(u, .5) })).sort((p, q) => p.d - q.d);
  for (const { slot } of slots) {
    const r = f.riders[slot], tilt = r && !f.reduced ? ramp(r, 1.5, 1.5) * .26 * Math.sin(f.time * 5.2 + slot * 1.3) : 0;
    springAnimal(k, slot, f.variant, tilt, r ? (s, side) => person(f, onSeat(s, r.look), r, toward(k, 0, 1), { pose: "ride", side }) : undefined);
  }
}
function paintGlobe(f: PartFrame, k: Kit) {
  f = { ...f, riders: f.riders.slice(0, 3) };
  const o = k.world(.5, .5), R = GLOBE.radius;
  globeDome(k, f.state.angle, front => {
    f.riders.forEach((r, j) => {
      if (!r) return;
      const a = f.state.angle + j * 2.1, isFront = Math.cos(a - Math.PI / 4) > 0;
      if (isFront !== front) return;
      const pushing = r.using < 2.8, radius = pushing ? (R + 4) / TILE_PX : (R * Math.cos(-.62) + 1.6) / TILE_PX;
      const p = { x: o.x + Math.cos(a) * radius, y: o.y + Math.sin(a) * radius }, screen = { x: (p.x - p.y) * 32, y: (p.x + p.y) * 16 - (pushing ? 1 : 2.4) };
      // Running round to push, then riding on the bottom ring, holding the bars.
      const tangent = -Math.sin(a) + Math.cos(a);
      person(f, screen, r, pushing ? tangent >= 0 ? 1 : -1 : isFront ? -1 : 1, pushing ? { pose: "walk", walk: f.time * 13 } : { pose: "hang" });
    });
  });
}
const HORSE_OF = [0, 2, 3, 5];
function paintCarousel(f: PartFrame, k: Kit) {
  const running = f.state.speed > .05, lit = f.env.lightsOn > .25 && running;
  carouselTop(k, f.state.angle, f.state.bob, {
    lit, rider: (slot, s, side, facing) => { const j = HORSE_OF.indexOf(slot), r = j >= 0 ? f.riders[j] : undefined; if (r) person(f, onSeat(s, r.look), r, facing, { pose: "ride", side }); },
  });
  if (running && !f.reduced && f.detail) notes(f, k.at(.5, .5, 38), 3, .3);
}
/** Musical notes floating up and fading. */
function notes(f: PartFrame, from: Point, count: number, rate: number) {
  const c = f.c;
  for (let j = 0; j < count; j++) {
    const k = (f.time * rate + j / count + hash(f.tile) ) % 1, x = from.x + Math.sin(f.time * 1.3 + j * 2) * 3 + (j - count / 2) * 3, y = from.y - k * 16;
    c.save(); c.globalAlpha *= Math.sin(k * Math.PI) * .9;
    const color = shade(["#e15b4f", "#3f6fa8", "#e8a33d", "#3f9a6c"][j % 4]!, f.night);
    ellipse(c, x, y, .9, .65, color); stroke(c, x + .8, y, x + .8, y - 3, color, .35); stroke(c, x + .8, y - 3, x + 1.9, y - 2.2, color, .35);
    c.restore();
  }
}
/** Climbing routes over the frame: (u, v, z) nodes and the pose on the way to each. */
const CLIMBS: [number, number, number, Pose][][] = [
  [[.92, .62, 1, "walk"], [.8, .6, 1, "hang"], [.8, .6, 6, "hang"], [.8, .6, 11, "hang"], [.8, .6, 16, "hang"], [.62, .58, 16.4, "sit"], [.62, .58, 16.4, "sit"], [.62, .58, 16.4, "cheer"], [.8, .4, 16, "hang"], [.8, .4, 11, "hang"], [.8, .4, 6, "hang"], [.8, .4, 1, "hang"], [.92, .4, 1, "walk"]],
  [[.4, .94, 1, "walk"], [.4, .8, 1, "hang"], [.4, .8, 6, "hang"], [.4, .8, 11, "hang"], [.5, .62, 11, "crouch"], [.5, .5, 16, "hang"], [.42, .42, 16.4, "sit"], [.42, .42, 16.4, "cheer"], [.2, .42, 11, "hang"], [.2, .42, 6, "hang"], [.2, .42, 1, "hang"], [.08, .42, 1, "walk"]],
  [[.3, .95, 1, "walk"], [.3, .72, 1, "crouch"], [.5, .5, 1.4, "crouch"], [.5, .5, 6, "hang"], [.6, .5, 11, "hang"], [.7, .7, 11, "crouch"], [.8, .8, 6, "hang"], [.8, .8, 1, "hang"], [.92, .92, 1, "walk"]],
];
function climbPose(slot: number, t: number) {
  const path = CLIMBS[slot % CLIMBS.length]!, i = Math.min(path.length - 2, Math.floor(t / CLIMB_STEP)), q = clamp(t / CLIMB_STEP - i), a = path[i]!, b = path[i + 1]!;
  return { u: a[0] + (b[0] - a[0]) * q, v: a[1] + (b[1] - a[1]) * q, z: a[2] + (b[2] - a[2]) * q, pose: b[3] };
}
function paintJungleGym(f: PartFrame, k: Kit) {
  const climbers = f.riders.slice(0, CLIMBS.length).flatMap((r, slot) => r ? [{ r, ...climbPose(slot, r.using) }] : []);
  if (!climbers.length) return;
  const nearest = Math.min(...climbers.map(m => k.depth(m.u, m.v)));
  // Redraw the bars in front of each climber so they are inside the frame, not pasted on it.
  const items: { d: number; draw: () => void }[] = jungleBars(k).filter(bar => bar.d > nearest - .02).map(bar => ({ d: bar.d, draw: () => drawBar(k, bar) }));
  for (const m of climbers) items.push({ d: k.depth(m.u, m.v) + .005, draw: () => {
    const p = k.at(m.u, m.v, m.z), facing = m.pose === "hang" ? -1 : 1;
    person(f, m.pose === "sit" ? onSeat(p, m.r.look) : p, m.r, facing, { pose: m.pose, walk: f.time * 10, side: 1 });
  } });
  items.sort((a, b) => a.d - b.d).forEach(item => item.draw());
}
function jet(f: PartFrame, k: Kit, u: number, v: number, height: number, j: number) {
  const c = f.c, base = k.at(u, v, 1.2), top = k.at(u, v, 1.2 + height);
  const g = c.createLinearGradient(base.x, base.y, top.x, top.y);
  g.addColorStop(0, shade("#e8f8ffdd", f.night)); g.addColorStop(1, shade("#ffffff66", f.night));
  c.strokeStyle = g; c.lineWidth = 1.3; c.beginPath(); c.moveTo(base.x, base.y); c.lineTo(top.x, top.y); c.stroke();
  if (!f.detail) return;
  for (let d = 0; d < 6; d++) {
    const q = (f.time * 1.7 + d / 6 + j * .13) % 1, a = d * TAU / 6 + j;
    ellipse(c, top.x + Math.cos(a) * q * 3.4, top.y + Math.sin(a) * q * 1.4 + height * q * q * .8, .45, .4, shade("#f2fbffcc", f.night));
  }
  const q = (f.time * .9 + j * .3) % 1;
  c.save(); c.globalAlpha *= 1 - q; c.beginPath(); c.ellipse(base.x, base.y, 1.5 + q * 3.5, .7 + q * 1.6, 0, 0, TAU); c.strokeStyle = shade("#ffffff", f.night); c.lineWidth = .4; c.stroke(); c.restore();
}
function paintSplash(f: PartFrame, k: Kit) {
  f = { ...f, riders: f.riders.slice(0, 4) };
  const active = splashActive(f.env), c = f.c, items: { d: number; draw: () => void }[] = [];
  if (active) {
    k.disc(.5, .5, .4, 1.13, "#e9f8fd38");
    for (let j = 0; j < 8; j++) { const q = (f.time * .5 + hash(j)) % 1; if (q > .5) continue; const p = k.at(.5 + (hash(j * 3) - .5) * .6, .5 + (hash(j * 7) - .5) * .6, 1.15); ellipse(c, p.x, p.y, .9 * (1 - q * 2), .3, "#ffffffaa"); }
    SPLASH_JETS.forEach(([u, v], j) => {
      const h = f.reduced ? 4 : 12.5 * Math.pow(Math.max(0, Math.sin(f.time * 1.15 + j * 1.7)), .6);
      if (h > .6) items.push({ d: k.depth(u, v), draw: () => jet(f, k, u, v, h, j) });
    });
    // The mushroom's curtain of water and the frog's arc.
    const [mu, mv] = SPLASH_MUSHROOM;
    items.push({ d: k.depth(mu, mv) + .01, draw: () => {
      const cap = k.at(mu, mv, 11.6);
      for (let j = 0; j < 11; j++) {
        const a = Math.PI * .05 + j * Math.PI * .9 / 10, x = cap.x + Math.cos(a) * 5.2, y0 = cap.y + Math.sin(a) * 2.2 + .6, y1 = k.at(mu, mv, 1.2).y + Math.sin(a) * 2.2;
        c.save(); c.globalAlpha *= .5; stroke(c, x, y0, x + Math.sin(f.time * 3 + j) * .3, y1, shade("#e6f7ff", f.night), .45); c.restore();
        const q = (f.time * 1.6 + j * .37) % 1; ellipse(c, x, y0 + (y1 - y0) * q, .35, .45, shade("#ffffffcc", f.night));
      }
    } });
    const [fu, fv] = SPLASH_FROG, mouth = k.at(fu, fv, 3.8), land = k.at(.42, .45, 1.2);
    items.push({ d: k.depth(fu, fv) + .01, draw: () => {
      for (let j = 0; j < 9; j++) { const q = ((f.time * 1.3 + j / 9) % 1), x = mouth.x + (land.x - mouth.x) * q, y = mouth.y + (land.y - mouth.y) * q - Math.sin(q * Math.PI) * 6; ellipse(c, x, y, .5, .45, shade("#e8f8ffdd", f.night)); }
    } });
  }
  f.riders.forEach((r, slot) => {
    if (!r) return;
    // Each child runs between points on the pad and jumps with arms up into the water.
    const leg = 1.5, i = Math.floor(r.using / leg), q = clamp(r.using / leg - i);
    const point = (n: number) => { const a = hash(r.seed + n * 7.3) * TAU, d = Math.sqrt(hash(r.seed * 3 + n)) * .3; return { u: .5 + Math.cos(a) * d, v: .5 + Math.sin(a) * d }; };
    const a = point(i), b = point(i + 1), u = a.u + (b.u - a.u) * Math.min(1, q * 1.6), v = a.v + (b.v - a.v) * Math.min(1, q * 1.6), still = q > .62;
    items.push({ d: k.depth(u, v) + .002, draw: () => {
      const jump = still && active ? Math.abs(Math.sin((q - .62) * Math.PI / .38 * 2)) * 2 : 0;
      person(f, k.at(u, v, 1.2), r, toward(k, b.u - a.u, b.v - a.v), still ? { pose: active ? "cheer" : "walk", jump } : { pose: "walk", walk: f.time * 13 + slot });
    } });
  });
  items.sort((a, b) => a.d - b.d).forEach(item => item.draw());
}
function paintBars(f: PartFrame, k: Kit) {
  f.riders.forEach((r, slot) => {
    if (!r || slot > 1) return;
    const spec = BAR_SPECS[slot]!, mid = (spec.u0 + spec.u1) / 2, bar = k.at(mid, .5, spec.z), s = r.look.scale, t = r.using % BAR_CYCLE, c = f.c;
    const hang = { x: bar.x, y: bar.y + 10.3 * s }, spin = (start: number, length: number) => (t - start) / length * TAU * k.side(0, 1);
    const turned = (angle: number, draw: () => void) => { c.save(); c.translate(bar.x, bar.y); c.rotate(angle); c.translate(-bar.x, -bar.y); draw(); c.restore(); };
    if (t < 1) person(f, k.at(mid, .62, 1), r, toward(k, 0, -1), { pose: "walk" });
    else if (t < 2.3) person(f, hang, r, toward(k, 0, -1), { pose: "hang", beat: t * 3 });
    else if (t < 3.4) turned(spin(2.3, 1.1), () => person(f, hang, r, toward(k, 0, -1), { pose: "hang" }));
    else if (t < 5.2) person(f, { x: bar.x, y: bar.y + 3.4 * s }, r, toward(k, 0, 1), { pose: "walk" });
    else if (t < 5.9) turned(-spin(5.2, .7), () => person(f, hang, r, toward(k, 0, -1), { pose: "hang" }));
    else if (t < 6.4) person(f, hang, r, toward(k, 0, -1), { pose: "hang", beat: t * 3 });
    else person(f, k.at(mid, .6, 1), r, toward(k, 0, 1), { pose: "cheer", jump: Math.sin((t - 6.4) / .8 * Math.PI) * 1.2 });
  });
}
/** Ball and players: dribble, shoot, swish (or a bounce off the rim), and the ball comes back. */
function paintHoop(f: PartFrame, k: Kit) {
  const shooters = f.riders.flatMap((r, slot) => r && slot < 2 ? [slot] : []);
  if (!shooters.length) return;
  const t = f.time + f.tile * 3.1, cycle = Math.floor(t / SHOT), tau = t - cycle * SHOT, shooter = shooters[cycle % shooters.length]!;
  const spots = [{ u: .5, v: .62 }, { u: .3, v: .55 }], me = spots[shooter]!, made = hash(cycle * 1.7 + f.tile) < .62, r = f.riders[shooter]!, s = r.look.scale;
  const lerp = (a: number, b: number, q: number) => a + (b - a) * q;
  let ball: { u: number; v: number; z: number }, pose: Pose = "walk";
  const hand = 1 + 5.4 * s, head = 1 + 11 * s;
  if (tau < 2.2) ball = { u: me.u + .05, v: me.v + .02, z: 1.4 + (hand - 1.4) * Math.abs(Math.cos(Math.PI * tau / .42)) };
  else if (tau < 2.6) { ball = { u: me.u, v: me.v - .01, z: head }; pose = "cheer"; }
  else if (tau < 3.5) { const q = (tau - 2.6) / .9; ball = { u: lerp(me.u, HOOP.u, q), v: lerp(me.v, HOOP.v, q), z: lerp(head, HOOP.z + .9, q) + 9 * Math.sin(Math.PI * q) }; pose = q < .3 ? "cheer" : "walk"; }
  else if (made && tau < 3.85) ball = { u: HOOP.u, v: HOOP.v, z: lerp(HOOP.z, 1.4, ((tau - 3.5) / .35) ** 2) };
  else if (!made && tau < 3.9) { const q = (tau - 3.5) / .4; ball = { u: lerp(HOOP.u, HOOP.u + .14, q), v: lerp(HOOP.v, HOOP.v + .16, q), z: lerp(HOOP.z, 1.4, q * q) + 3 * Math.sin(Math.PI * q) }; }
  else if (tau < 5.8) {
    const from = made ? { u: HOOP.u, v: HOOP.v + .02 } : { u: HOOP.u + .14, v: HOOP.v + .16 }, q = (tau - (made ? 3.85 : 3.9)) / (5.8 - (made ? 3.85 : 3.9));
    ball = { u: lerp(from.u, me.u + .04, q), v: lerp(from.v, me.v, q), z: 1.4 + 5 * (1 - q) * Math.abs(Math.sin(3 * Math.PI * q)) };
  } else ball = { u: me.u + .04, v: me.v + .02, z: hand };
  const items: { d: number; draw: () => void }[] = [];
  shooters.forEach(slot => {
    const p = spots[slot]!, rider = f.riders[slot]!;
    items.push({ d: k.depth(p.u, p.v), draw: () => {
      const cheering = slot !== shooter && made && tau > 3.5 && tau < 4.6;
      person(f, k.at(p.u, p.v, 1), rider, toward(k, HOOP.u - p.u, HOOP.v - p.v), slot === shooter ? { pose, side: k.side(.05, 0) } : { pose: cheering ? "cheer" : "walk", jump: cheering ? Math.abs(Math.sin(tau * 9)) * 1.2 : 0 });
    } });
  });
  items.push({ d: k.depth(ball.u, ball.v) + .01, draw: () => {
    const p = k.at(ball.u, ball.v, ball.z), g = k.at(ball.u, ball.v, 1);
    ellipse(f.c, g.x + .4, g.y + .2, 1.3, .5, "#1e332a30");
    ellipse(f.c, p.x, p.y, 1.3, 1.3, shade("#e9783a", f.night)); stroke(f.c, p.x - 1.2, p.y, p.x + 1.2, p.y, shade("#5a2a12", f.night), .25); stroke(f.c, p.x, p.y - 1.2, p.x, p.y + 1.2, shade("#5a2a12", f.night), .25);
  } });
  items.sort((a, b) => a.d - b.d).forEach(item => item.draw());
  if (made && tau > 3.45 && tau < 3.95) {
    const rim = k.circle(HOOP.u, HOOP.v, .055, HOOP.z, 8), low = k.at(HOOP.u, HOOP.v, HOOP.z - 3.4);
    rim.slice(0, 8).forEach((p, j) => k.line(p, { x: (p.x * 2 + low.x) / 3 + Math.sin(f.time * 40 + j) * .5, y: low.y + (p.y - k.at(HOOP.u, HOOP.v, HOOP.z).y) * .5 }, "#f4f4ee", .4));
  }
}
function paintSteam(f: PartFrame, k: Kit) {
  if (!f.env.shopsOpen || f.reduced) return;
  const c = f.c, wind = Math.cos(f.env.windAngle) * (.4 + f.env.wind / 30);
  for (let j = 0; j < 4; j++) {
    const q = (f.time * .45 + j / 4) % 1, p = k.at(.62, .44, 15 + q * 11);
    c.save(); c.globalAlpha *= (1 - q) * .42; ellipse(c, p.x + q * 6 * wind, p.y, 1.2 + q * 2.6, 1 + q * 2, shade("#ffffff", f.night * .6)); c.restore();
  }
}
function paintDrink(f: PartFrame, k: Kit) {
  const r = f.riders[0]; if (!r || r.using < .5 || r.using > r.duration - .4) return;
  const from = k.at(FAUCET.u, FAUCET.v, FAUCET.z), to = k.at(.5, .58, 12.2), c = f.c;
  c.beginPath(); c.moveTo(from.x, from.y); c.quadraticCurveTo((from.x + to.x) / 2, from.y - 2.4, to.x, to.y); c.strokeStyle = shade("#d6f1f8cc", f.night); c.lineWidth = .5; c.stroke();
}
const BAND: Look[] = [
  { top: "#3f6fa8", bottom: "#2f3540", hair: "#2f2a28", skin: "#f1d3b8", accent: "#e15b4f", umbrella: "#eef4f6", scale: .82, bag: "none", hat: false, parasol: false, dog: null, kind: "adult" },
  { top: "#e15b4f", bottom: "#3b4250", hair: "#5a4334", skin: "#e8c2a0", accent: "#f0c14b", umbrella: "#eef4f6", scale: .8, bag: "none", hat: false, parasol: false, dog: null, kind: "adult" },
  { top: "#f0c14b", bottom: "#2f3540", hair: "#1f1d1f", skin: "#d9a982", accent: "#2f3540", umbrella: "#eef4f6", scale: .82, bag: "none", hat: true, parasol: false, dog: null, kind: "adult" },
];
function paintBand(f: PartFrame, k: Kit) {
  if (!performing(f.env)) return;
  const c = f.c, beat = f.time * TAU * 1.8, players = [{ u: .36, v: .56, j: 0 }, { u: .5, v: .42, j: 1 }, { u: .64, v: .56, j: 2 }].sort((a, b) => k.depth(a.u, a.v) - k.depth(b.u, b.v));
  const facing = toward(k, 0, 1), side = k.side(0, 1);
  if (f.env.lightsOn > .2) {
    // Warm stage lights once it is getting dark.
    const p = k.at(.5, .5, STAGE.deck), g = c.createRadialGradient(p.x, p.y - 4, 0, p.x, p.y - 4, 16);
    g.addColorStop(0, "#fff3cf88"); g.addColorStop(1, "#fff3cf00"); c.fillStyle = g; c.beginPath(); c.ellipse(p.x, p.y - 4, 16, 10, 0, 0, TAU); c.fill();
  }
  for (const { u, v, j } of players) {
    const look = BAND[j]!, s = look.scale, p = k.at(u, v, STAGE.deck), bob = Math.abs(Math.sin(beat + j)) * .5;
    drawPerson(c, p, look, 0, facing, f.night, { rain: false, detail: f.detail, jump: bob, pose: j === 1 && Math.sin(f.time * .7) > .6 ? "cheer" : "walk", beat });
    const n = (color: string) => shade(color, f.night);
    if (j === 0) { ellipse(c, p.x + .4, p.y - bob - 3.4 * s, 1.3, 1, n("#a0602f")); stroke(c, p.x + .4, p.y - bob - 3.6 * s, p.x + 2.8, p.y - bob - 6 * s, n("#5a3a20"), .45); }
    if (j === 1) { stroke(c, p.x - side * 1.4, p.y, p.x - side * 1.4, p.y - 7.4 * s, n("#3a3a3a"), .35); ellipse(c, p.x - side * 1.3, p.y - 7.6 * s, .45, .55, n("#4a4a4a")); }
    if (j === 2) { stroke(c, p.x + side * .4, p.y - bob - 7.1 * s, p.x + side * 2.7, p.y - bob - 6.8 * s, n("#e6c178"), .6); ellipse(c, p.x + side * 2.9, p.y - bob - 6.8 * s, .55, .8, n("#e6c178")); }
  }
  bandstandColumns(k, true, STAGE.deck, 19);
  if (!f.reduced && f.detail) notes(f, k.at(.5, .5, 16), 5, .28);
}
function paintFountain(f: PartFrame, k: Kit) {
  const c = f.c, o = k.at(.5, .5), h = 10 + (f.reduced ? 0 : Math.sin(f.time * 1.7) * 1.6), top = { x: o.x, y: o.y - 7 - h }, bowl = o.y - 6.4;
  if (f.env.night > .3) { const g = c.createRadialGradient(o.x, o.y - 3, 0, o.x, o.y - 3, 16); g.addColorStop(0, `rgba(170,220,255,${(.45 * f.env.night).toFixed(2)})`); g.addColorStop(1, "rgba(170,220,255,0)"); c.fillStyle = g; c.beginPath(); c.ellipse(o.x, o.y - 3, 16, 8, 0, 0, TAU); c.fill(); }
  const water = (color: string) => f.env.night > .3 ? "#d8f0ff" : shade(color, f.night);
  const g = c.createLinearGradient(o.x, o.y - 7, top.x, top.y); g.addColorStop(0, water("#e9f8f4")); g.addColorStop(1, "rgba(255,255,255,0.35)");
  c.strokeStyle = g; c.lineWidth = 1.8; c.beginPath(); c.moveTo(o.x, o.y - 7); c.lineTo(top.x, top.y); c.stroke();
  ellipse(c, top.x, top.y, 1.5, .9, water("#f4fbf8"));
  if (f.reduced || !f.detail) return;
  // A crown of drops falling into the upper bowl, overflow strands into the basin, ripples spreading.
  for (let j = 0; j < 10; j++) {
    const a = j * TAU / 10, q = (f.time * 1.3 + j / 10) % 1, x = top.x + Math.cos(a) * q * 4.6, y = top.y + Math.sin(a) * q * 2 + (bowl - top.y) * q * q;
    ellipse(c, x, y, .45, .45, water("#f2fbffdd"));
  }
  for (let j = 0; j < 7; j++) {
    const a = Math.PI * .1 + j * Math.PI * .8 / 6, x = o.x + Math.cos(a) * 4.8, y0 = bowl + Math.sin(a) * 2.1, y1 = o.y - 2.6 + Math.sin(a) * 4;
    c.save(); c.globalAlpha *= .55; stroke(c, x, y0, x + Math.cos(a) * 1.4, y1, water("#dff3f7"), .5); c.restore();
  }
  for (let j = 0; j < 3; j++) {
    const q = (f.time * .45 + j / 3) % 1;
    c.save(); c.globalAlpha *= (1 - q) * .7; c.beginPath(); c.ellipse(o.x, o.y - 2.8, 6 + q * 6, 2.8 + q * 2.8, 0, 0, TAU); c.strokeStyle = water("#ffffff"); c.lineWidth = .45; c.stroke(); c.restore();
  }
  if (f.env.night < .4 && f.env.overcast < .6) for (let j = 0; j < 5; j++) { const tw = Math.sin(f.time * 3 + j * 2.3); if (tw > .6) ellipse(c, o.x + (hash(j * 5) - .5) * 20, o.y - 2.6 + (hash(j * 9) - .5) * 7, (tw - .6) * 2.5, .3, "#ffffffcc"); }
}
function paintKoi(f: PartFrame, k: Kit) {
  if (f.env.night > .75) return;
  const c = f.c, colors: [string, string][] = [["#f07b3a", "#fbf3e8"], ["#fbf3e8", "#d9442f"], ["#e9a23b", "#e9a23b"]];
  for (let j = 0; j < 3; j++) {
    const a = (f.reduced ? 0 : f.time) * (.32 + j * .07) * (j % 2 ? -1 : 1) + j * 2.1, rr = .17 + Math.sin(f.time * .3 + j) * .04;
    const u = .5 + Math.cos(a) * rr, v = .5 + Math.sin(a) * rr * .85, du = -Math.sin(a) * (j % 2 ? -1 : 1), dv = Math.cos(a) * (j % 2 ? -1 : 1) * .85;
    const p = k.at(u, v, 1.3), q = k.at(u + du * .05, v + dv * .05, 1.3), angle = Math.atan2(q.y - p.y, q.x - p.x), [body, spot] = colors[j]!;
    c.save(); c.translate(p.x, p.y); c.rotate(angle); c.globalAlpha *= .82;
    ellipse(c, 0, 0, 2.6, .9, shade(body, f.night)); ellipse(c, .7, -.1, .9, .45, shade(spot, f.night));
    c.beginPath(); c.moveTo(-2.2, 0); c.lineTo(-3.6, -1 + Math.sin(f.time * 6 + j) * .3); c.lineTo(-3.6, 1 + Math.sin(f.time * 6 + j) * .3); c.closePath(); c.fillStyle = shade(body, f.night); c.fill();
    c.restore();
  }
  const q = (f.time * .3 + hash(f.tile)) % 1, ring = k.at(.5 + Math.cos(f.tile) * .12, .5 + Math.sin(f.tile) * .1, 1.3);
  c.save(); c.globalAlpha *= (1 - q) * .6; c.beginPath(); c.ellipse(ring.x, ring.y, 1 + q * 5, .5 + q * 2.4, 0, 0, TAU); c.strokeStyle = shade("#e6f6f2", f.night); c.lineWidth = .4; c.stroke(); c.restore();
}
const box = (left: number, top: number, width: number, height: number): Bounds => ({ left, top, width, height });
/** Live painters by part, drawn every frame just after the part's cached artwork. */
export const PART_MOTION: Partial<Record<ParkPart, Motion>> = {
  swings: { bounds: box(-40, -44, 80, 64), paint: paintSwings },
  seesaw: { bounds: box(-34, -26, 68, 40), paint: paintSeesaw },
  springRider: { bounds: box(-34, -32, 68, 46), paint: paintSprings },
  globe: {
    bounds: box(-30, -34, 60, 50), paint: paintGlobe,
    update(state, dt, riders) {
      const pushing = riders.some(r => r && r.using < 2.8), riding = riders.some(Boolean);
      state.speed = pushing ? Math.min(1.7, state.speed + 1.4 * dt) : state.speed * Math.exp(-(riding ? .18 : .5) * dt);
      state.angle += state.speed * dt;
    },
  },
  carousel: {
    bounds: box(-40, -64, 80, 82), paint: paintCarousel,
    update(state, dt, _riders, env, reduced) {
      const target = carouselRunning(env) && !reduced ? .55 : 0;
      state.speed += clamp(target - state.speed, -.22 * dt, .22 * dt);
      state.angle += state.speed * dt; state.bob += state.speed * dt * 4;
    },
  },
  jungleGym: { bounds: box(-40, -36, 80, 54), paint: paintJungleGym },
  splashPad: { bounds: box(-36, -34, 72, 50), paint: paintSplash },
  bars: { bounds: box(-34, -34, 68, 50), paint: paintBars },
  basketball: { bounds: box(-36, -50, 72, 66), paint: paintHoop },
  foodCart: { bounds: box(-30, -50, 60, 40), paint: paintSteam },
  drinkFountain: { bounds: box(-12, -20, 24, 18), paint: paintDrink },
  bandstand: { bounds: box(-36, -50, 72, 60), paint: paintBand },
  windmill: {
    depth: k => k.depth(WINDMILL_HUB.u, WINDMILL_HUB.v) > k.depth(.5, .5) ? .02 : -.12,
    bounds: box(-44, -80, 88, 80), paint: (f, k) => windmillSails(k, f.state.angle),
    update(state, dt, _riders, env, reduced) { state.angle += (reduced ? 0 : .25 + Math.min(2.2, env.wind / 13)) * dt; },
  },
  flowerClock: { bounds: box(-24, -18, 48, 26), paint: (f, k) => flowerClockHands(k, f.env.minutes, !f.reduced) },
  flagPole: { bounds: box(-48, -60, 96, 50), paint: (f, k) => flagCloth(k, f.reduced ? 0 : f.time, f.env.wind, Math.cos(f.env.windAngle), koinoboriSeason(f.env)) },
  fountain: { bounds: box(-24, -34, 48, 40), paint: paintFountain },
  pond: { bounds: box(-24, -14, 48, 22), paint: paintKoi },
};
/** A kit whose colours follow the night. */
export function motionKit(f: PartFrame) { return parkKit(f.c, f.x, f.y, f.rotation, color => shade(color, f.night)); }
export function motionDepth(kind: ParkPart, f: { c: CanvasRenderingContext2D; x: number; y: number; rotation: number }) {
  const motion = PART_MOTION[kind];
  return motion?.depth ? motion.depth(parkKit(f.c, f.x, f.y, f.rotation)) : .02;
}
