import type { ParkPart } from "./town-builder";
import { lightGradient, paintState, snowy } from "./town-paint";

/**
 * Artwork for the park parts added on 2026-10-15: play equipment that moves, seasonal plants, places to
 * eat and rest, and landmarks. Static pieces are painted once into the sprite cache; pieces that move
 * (a seesaw plank, carousel horses, windmill sails…) are painted by the moving layer every frame while
 * `paintState.liveParts` is on, and in a resting pose otherwise (shop icons, placement ghosts).
 * Every drawing goes through the same tile-local kit, so a part looks right in all four rotations and the
 * sunlight stays fixed in world space (lit from the left, shaded on the right).
 */
type Point = { x: number; y: number };
export type Shade = (color: string) => string;
const keep: Shade = color => color;
const TAU = Math.PI * 2;
const iso = (x: number, y: number, z = 0): Point => ({ x: (x - y) * 32, y: (x + y) * 16 - z });
const noise = (i: number) => { const v = Math.sin(i * 71.3 + 19.7) * 42135.7; return v - Math.floor(v); };
/** One tile unit is about 45 px of world length; a world circle of radius r tiles is an ellipse of 45.25r × 22.63r on screen. */
export const TILE_PX = 45.25;
const WOOD = ["#b18b63", "#826345", "#d4b28a"], STONE = ["#b3b6a6", "#868f86", "#d8d9c6"], METAL = ["#6c8c80", "#476b65", "#adc1a7"];

export function parkKit(c: CanvasRenderingContext2D, x: number, y: number, rotation = 0, n: Shade = keep) {
  const r = ((rotation % 4) + 4) % 4;
  const world = (u: number, v: number): Point => r === 1 ? { x: x + 1 - v, y: y + u } : r === 2 ? { x: x + 1 - u, y: y + 1 - v } : r === 3 ? { x: x + v, y: y + 1 - u } : { x: x + u, y: y + v };
  const at = (u: number, v: number, z = 0) => { const p = world(u, v); return iso(p.x, p.y, z); };
  /** World depth (x + y) of a local point: larger is nearer the viewer. */
  const depth = (u: number, v: number) => { const p = world(u, v); return p.x + p.y; };
  /** Screen direction (+1 right, -1 left) of a local direction. */
  const side = (du: number, dv: number) => { const a = at(.5 + du, .5 + dv), b = at(.5, .5); return a.x - b.x >= 0 ? 1 : -1; };
  const fill = (style: string | CanvasGradient) => typeof style === "string" ? n(style) : style;
  const path = (ps: Point[]) => { c.beginPath(); ps.forEach((p, j) => j ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); };
  const poly = (ps: Point[], style: string | CanvasGradient, outline?: string, width = .5) => {
    path(ps); c.fillStyle = fill(style); c.fill();
    if (outline) { c.strokeStyle = n(outline); c.lineWidth = width; c.stroke(); }
  };
  const line = (a: Point, b: Point, color: string, width = .8) => { c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.strokeStyle = n(color); c.lineWidth = width; c.stroke(); };
  const curve = (ps: Point[], color: string, width = .8) => { c.beginPath(); ps.forEach((p, j) => j ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.strokeStyle = n(color); c.lineWidth = width; c.stroke(); };
  const oval = (p: Point, rx: number, ry: number, style: string | CanvasGradient, tilt = 0) => { c.beginPath(); c.ellipse(p.x, p.y, Math.max(.01, rx), Math.max(.01, ry), tilt, 0, TAU); c.fillStyle = fill(style); c.fill(); };
  const gradient = (a: Point, b: Point, stops: [number, string][]) => { const g = c.createLinearGradient(a.x, a.y, b.x, b.y); for (const [t, color] of stops) g.addColorStop(t, n(color)); return g; };
  const visibleFaces = (u: number, v: number, w: number, d: number) => {
    const vertices = [[u, v], [u + w, v], [u + w, v + d], [u, v + d]].map(([a, b]) => ({ u: a!, v: b!, p: world(a!, b!) }));
    return vertices.map((a, j) => ({ a, b: vertices[(j + 1) % 4]! })).sort((a, b) => a.a.p.x + a.a.p.y + a.b.p.x + a.b.p.y - b.a.p.x - b.a.p.y - b.b.p.x - b.b.p.y).slice(2);
  };
  const box = (u: number, v: number, w: number, d: number, h: number, colors: readonly string[], z = 1) => {
    const sides = visibleFaces(u, v, w, d);
    for (const { a, b } of sides) {
      const lit = Math.abs(a.p.x - b.p.x) < 1e-6 ? 1 : 0;
      poly([at(a.u, a.v, z), at(b.u, b.v, z), at(b.u, b.v, z + h), at(a.u, a.v, z + h)], colors[lit]!);
    }
    poly([at(u, v, z + h), at(u + w, v, z + h), at(u + w, v + d, z + h), at(u, v + d, z + h)], snowy(colors[2]!));
    for (const { a, b } of sides) line(at(a.u, a.v, z + h), at(b.u, b.v, z + h), "#f4edcb60", .45);
    return sides;
  };
  /** An upright cylinder, shaded from the lit left to the shaded right. */
  const cylinder = (u: number, v: number, radius: number, h: number, colors: readonly string[], z = 1) => {
    const p0 = at(u, v, z), p1 = at(u, v, z + h), rx = radius * TILE_PX, ry = radius * TILE_PX / 2;
    c.beginPath(); c.moveTo(p1.x - rx, p1.y); c.lineTo(p0.x - rx, p0.y); c.ellipse(p0.x, p0.y, rx, ry, 0, Math.PI, 0, true); c.lineTo(p1.x + rx, p1.y); c.ellipse(p1.x, p1.y, rx, ry, 0, 0, Math.PI, true); c.closePath();
    c.fillStyle = gradient({ x: p0.x - rx, y: 0 }, { x: p0.x + rx, y: 0 }, [[0, colors[0]!], [.45, colors[0]!], [1, colors[1]!]]); c.fill();
    oval(p1, rx, ry, snowy(colors[2]!));
  };
  /** A cone or a pointed roof standing on a circle. */
  const cone = (u: number, v: number, radius: number, h: number, colors: readonly string[], z = 1) => {
    const p0 = at(u, v, z), apex = at(u, v, z + h), rx = radius * TILE_PX, ry = radius * TILE_PX / 2;
    c.beginPath(); c.moveTo(apex.x, apex.y); c.lineTo(p0.x - rx, p0.y); c.ellipse(p0.x, p0.y, rx, ry, 0, Math.PI, 0, true); c.closePath();
    c.fillStyle = gradient({ x: p0.x - rx, y: 0 }, { x: p0.x + rx, y: 0 }, [[0, snowy(colors[0]!, .5)], [.5, snowy(colors[0]!, .5)], [1, colors[1]!]]); c.fill();
  };
  const disc = (u: number, v: number, radius: number, z: number, style: string | CanvasGradient) => oval(at(u, v, z), radius * TILE_PX, radius * TILE_PX / 2, style);
  /** Points round a world circle (radius in tiles) from angle a0 to a1; angle 0 points along world +x. */
  const circle = (u: number, v: number, radius: number, z: number, count = 24, a0 = 0, a1 = TAU) => {
    const o = world(u, v);
    return Array.from({ length: count + 1 }, (_, j) => { const a = a0 + (a1 - a0) * j / count; return iso(o.x + Math.cos(a) * radius, o.y + Math.sin(a) * radius, z); });
  };
  const leaf = (p: Point, rx: number, ry: number, palette: readonly string[]) => {
    const g = c.createRadialGradient(p.x - rx * .3, p.y - ry * .4, 0, p.x, p.y, Math.max(rx, ry) * 1.2);
    g.addColorStop(0, n(palette[2]!)); g.addColorStop(.55, n(palette[1]!)); g.addColorStop(1, n(palette[0]!)); oval(p, rx, ry, g);
  };
  const bloom = (p: Point, color: string, size = 1, petals = 5) => {
    for (let j = 0; j < petals; j++) { const a = j * TAU / petals; oval({ x: p.x + Math.cos(a) * size, y: p.y + Math.sin(a) * size * .7 }, size * .65, size * .5, color); }
    oval(p, size * .32, size * .25, "#f6d786");
  };
  /** Paint pieces from the back of the tile to the front. */
  const assemble = (parts: { u: number; v: number; paint: () => void }[]) => parts.map(part => ({ ...part, d: depth(part.u, part.v) })).sort((a, b) => a.d - b.d).forEach(part => part.paint());
  return { c, n, r, world, at, depth, side, path, poly, line, curve, oval, gradient, box, cylinder, cone, disc, circle, leaf, bloom, assemble, visibleFaces };
}
export type Kit = ReturnType<typeof parkKit>;

/** A ring of small garden stones around a tree, with a little moss. */
function stoneRing(k: Kit, radius = .13) {
  k.disc(.5, .5, radius + .015, 1.02, "#8d7d62");
  k.disc(.5, .5, radius, 1.1, paintState.snow ? "#eef2f4" : "#7a6a52");
  for (let j = 0; j < 12; j++) {
    const a = j * TAU / 12, p = k.at(.5 + Math.cos(a) * radius, .5 + Math.sin(a) * radius, 1.6);
    k.oval(p, 2.1, 1.2, j % 3 ? "#bdb8a4" : "#a9a490"); k.oval({ x: p.x - .5, y: p.y - .4 }, .9, .45, "#d9d6c4");
    if (j % 4 === 1) k.oval({ x: p.x + .6, y: p.y - .2 }, .8, .4, "#7f9c5c");
  }
}
type Palette = readonly string[];
const MAPLE: Record<string, Palette> = {
  default: ["#3f7a4a", "#5f9a54", "#8bbd68"], fresh: ["#6f9d48", "#93c25e", "#c3df86"], lush: ["#2f6a40", "#4f8f4c", "#78b062"],
  turning: ["#a9532c", "#df7a35", "#f5b058"], red: ["#8f2a25", "#cf3f33", "#f2774f"],
};
function maplePalette(): Palette | null {
  if (paintState.bare > .5) return null;
  if (paintState.foliage > .55) return MAPLE.red!;
  if (paintState.foliage > .22) return MAPLE.turning!;
  if (paintState.season === "spring") return MAPLE.fresh!;
  if (paintState.lush > .35) return MAPLE.lush!;
  return MAPLE.default!;
}
/** Japanese maple: a low, layered umbrella that turns scarlet in late autumn and drops a red carpet. */
function maple(k: Kit) {
  const { at, line, oval, leaf } = k, trunk = "#7b5a45", palette = maplePalette();
  stoneRing(k);
  if (paintState.foliage > .5 || paintState.bare > .15 && paintState.bare < .7) for (let j = 0; j < 26; j++) {
    const a = noise(j * 3) * TAU, d = Math.sqrt(noise(j * 7 + 1)), p = at(.5 + Math.cos(a) * .36 * d, .5 + Math.sin(a) * .36 * d, 1.1);
    oval(p, .9, .5, j % 3 ? "#c8452f" : "#e0703e", a);
  }
  line(at(.5, .5, 1), at(.49, .5, 8), trunk, 2.4); line(at(.49, .5, 8), at(.51, .5, 13), trunk, 1.8);
  const branches = [[.49, 8, .3, .47, 15], [.5, 10, .7, .53, 16], [.51, 12, .4, .5, 21], [.51, 12, .63, .5, 22], [.5, 11, .5, .36, 18], [.5, 11, .5, .66, 18]] as const;
  for (const [u0, z0, u1, v1, z1] of branches) line(at(u0, .5, z0), at(u1, v1, z1), trunk, 1);
  if (!palette) {
    for (let j = 0; j < 22; j++) {
      const [, , u1, v1, z1] = branches[j % branches.length]!, from = at(u1, v1, z1), a = -Math.PI / 2 + (noise(j + 5) - .5) * 2.4, to = { x: from.x + Math.cos(a) * 5, y: from.y + Math.sin(a) * 4 };
      line(from, to, "#86705a", .5);
      if (paintState.snow) line({ x: to.x - .8, y: to.y }, { x: to.x + .8, y: to.y - .2 }, "#f3f6f9", .7);
    }
    return;
  }
  // Three flat tiers of leaf clusters, the back of each tier first.
  for (const [z, rx, ry, count] of [[15, 15, 5.6, 9], [20, 12.5, 4.8, 8], [24.5, 8, 3.4, 6]] as const) {
    const center = at(.5, .5, z);
    oval({ x: center.x + 1, y: center.y + 1.6 }, rx * .95, ry * .8, palette[0]!);
    const blobs = Array.from({ length: count }, (_, j) => j * TAU / count + z).sort((a, b) => Math.sin(a) - Math.sin(b));
    for (const a of blobs) leaf({ x: center.x + Math.cos(a) * rx * .6, y: center.y + Math.sin(a) * ry * .55 }, 4.6, 2.5, palette);
    leaf(center, rx * .55, ry * .7, palette);
    for (let j = 0; j < 10; j++) oval({ x: center.x + (noise(j * 13 + z) - .5) * rx * 1.5, y: center.y + (noise(j * 17 + z) - .7) * ry * 1.3 }, .75, .45, palette[2]!, noise(j) * 3);
    if (paintState.snow) oval({ x: center.x - 1, y: center.y - ry * .5 }, rx * .6, ry * .35, "#f3f6f9e0");
  }
  if (paintState.season === "spring" && palette === MAPLE.fresh) for (let j = 0; j < 9; j++) oval(at(.3 + noise(j * 5) * .4, .5, 16 + noise(j * 9) * 9), .7, .45, "#c96a4a");
}
const GINKGO: Record<string, Palette> = {
  green: ["#4a8a3c", "#6aa64a", "#97c56a"], fresh: ["#79a845", "#9cc95e", "#c8e38a"], turning: ["#9fae35", "#c9c53f", "#e8e07a"], gold: ["#c89418", "#ecbf2d", "#f9e27a"],
};
/** Ginkgo: a tall egg of fan-shaped leaves that turns gold and lays a yellow carpet in late autumn. */
function ginkgo(k: Kit) {
  const { at, line, oval, leaf, c } = k, trunk = "#6f5a48";
  stoneRing(k, .11);
  const gold = paintState.bare <= .5 && paintState.foliage > .45;
  if (paintState.foliage > .6 || paintState.bare > .1 && paintState.bare < .6) {
    oval(at(.5, .52, 1.08), 17, 7.4, "#f0cd45b8");
    for (let j = 0; j < 20; j++) oval(at(.5 + (noise(j * 3) - .5) * .7, .5 + (noise(j * 5) - .5) * .7, 1.12), .9, .5, j % 2 ? "#e5b62c" : "#f7dc69");
  }
  line(at(.5, .5, 1), at(.5, .5, 17), trunk, 2.6); line(at(.5, .5, 1), at(.5, .5, 17), "#8b7560", .7);
  if (paintState.bare > .5) {
    // A broom of rising branches.
    for (let j = 0; j < 11; j++) {
      const z0 = 10 + j * 2.2, side = j % 2 ? 1 : -1, len = 7 - j * .35;
      const from = at(.5, .5, z0), to = { x: from.x + side * len * .8, y: from.y - len };
      line(from, to, trunk, j < 4 ? 1.1 : .7);
      line(to, { x: to.x + side * 1.6, y: to.y - 2.2 }, "#86705a", .45);
      if (paintState.snow) line({ x: to.x - .7, y: to.y }, { x: to.x + .7, y: to.y - .2 }, "#f3f6f9", .7);
    }
    line(at(.5, .5, 17), at(.5, .5, 37), trunk, 1.2);
    return;
  }
  const palette = gold ? GINKGO.gold! : paintState.foliage > .22 ? GINKGO.turning! : paintState.season === "spring" ? GINKGO.fresh! : GINKGO.green!;
  for (const [z, rx, ry] of [[16.5, 11, 6.5], [21.5, 12.5, 7.5], [27, 11, 7], [32, 8.3, 6], [36, 4.8, 4.2]] as const) {
    const p = at(.5, .5, z);
    leaf({ x: p.x - rx * .42, y: p.y + .4 }, rx * .62, ry, palette);
    leaf({ x: p.x + rx * .42, y: p.y + .6 }, rx * .62, ry, palette);
    leaf(p, rx * .7, ry * 1.05, palette);
  }
  // Fan-shaped leaves catch the light.
  for (let j = 0; j < 34; j++) {
    const z = 15 + noise(j * 3 + 1) * 23, spread = (1 - Math.abs(z - 24) / 20) * 11, p = at(.5, .5, z), q = { x: p.x + (noise(j * 7) - .5) * 2 * spread, y: p.y + (noise(j * 11) - .5) * 5 };
    c.beginPath(); c.moveTo(q.x, q.y + .8); c.arc(q.x, q.y + .8, 1.15, Math.PI * 1.15, Math.PI * 1.85); c.closePath(); c.fillStyle = k.n(j % 3 ? palette[2]! : palette[1]!); c.fill();
  }
  if (paintState.snow) for (const [z, rx] of [[37, 3.5], [32.5, 6], [27.5, 8]] as const) oval(at(.5, .5, z), rx, 1.6, "#f3f6f9e0");
}
/** A clump of bamboo culms with ringed nodes and drooping leaf sprays. */
function bamboo(k: Kit) {
  const { at, line, oval, c } = k;
  k.disc(.5, .5, .24, 1.04, "#8d7d62"); k.disc(.5, .5, .22, 1.1, paintState.snow ? "#eef2f4" : "#6d5d47");
  for (let j = 0; j < 16; j++) { const a = j * TAU / 16, p = at(.5 + Math.cos(a) * .22, .5 + Math.sin(a) * .22, 1.6); oval(p, 2, 1.1, j % 2 ? "#c2bca6" : "#aaa58f"); }
  const culms = [[.44, .42, 34, -.03, -.02], [.56, .43, 41, .02, -.03], [.5, .52, 45, 0, 0], [.37, .55, 30, -.05, .02], [.63, .56, 37, .04, .03], [.46, .63, 33, -.02, .05], [.58, .66, 28, .03, .05], [.53, .35, 31, 0, -.05]] as const;
  const order = [...culms].sort((a, b) => k.depth(a[0], a[1]) - k.depth(b[0], b[1]));
  for (const [j, [u, v, h, lu, lv]] of order.entries()) {
    const base = at(u, v, 1), top = at(u + lu, v + lv, h);
    line(base, top, j % 3 ? "#6b9a4c" : "#5d8c41", 1.8);
    line({ x: base.x - .55, y: base.y }, { x: top.x - .55, y: top.y }, "#a8d073", .45);
    for (let z = 5; z < h - 2; z += 4.5) { const t = z / h, p = { x: base.x + (top.x - base.x) * t, y: base.y + (top.y - base.y) * t }; line({ x: p.x - 1, y: p.y }, { x: p.x + 1, y: p.y }, "#4b7835", .55); }
    // Leaf sprays from the upper nodes, drooping outwards.
    for (let z = h * .45; z < h; z += 3.2) {
      const t = z / h, p = { x: base.x + (top.x - base.x) * t, y: base.y + (top.y - base.y) * t };
      for (let l = 0; l < 3; l++) {
        const out = (noise(j * 31 + z * 3 + l) - .5) * 2, tilt = out * .9 + (out > 0 ? .25 : -.25);
        c.beginPath(); c.ellipse(p.x + out * 3.2, p.y + 1 + l * .5, 3.4, .75, tilt, 0, TAU); c.fillStyle = k.n(["#4f8a3f", "#6aa64a", "#8cc160"][(j + l) % 3]!); c.fill();
      }
    }
    oval(top, 2.6, 1.4, "#6aa64a");
    if (paintState.snow) oval({ x: top.x, y: top.y - .6 }, 2.2, .9, "#f3f6f9e8");
  }
}
/**
 * Wisteria pergola: four posts, beams and a lattice under a roof of leaves. Purple racemes hang from it about
 * a month after the cherry blossom; leaves turn yellow in autumn and the bare vine shows in winter.
 */
function wisteria(k: Kit) {
  const { at, poly, line, oval, box, assemble } = k, bloom = paintState.wisteria;
  poly([at(.08, .08, 1.02), at(.92, .08, 1.02), at(.92, .92, 1.02), at(.08, .92, 1.02)], snowy("#d9cfb3"));
  for (let j = 0; j < 14; j++) oval(at(.12 + noise(j) * .76, .12 + noise(j * 3) * .76, 1.1), .7, .4, "#bfb397");
  const post = (u: number, v: number) => ({ u, v, paint: () => { box(u - .03, v - .03, .06, .06, 19, WOOD); box(u - .045, v - .045, .09, .09, 1.2, STONE); } });
  assemble([
    post(.14, .14), post(.86, .14), post(.14, .86), post(.86, .86),
    // A low bench under the trellis to sit and look up at the flowers.
    { u: .5, v: .5, paint: () => { for (const u of [.32, .66]) box(u, .46, .04, .1, 3.5, WOOD); box(.29, .45, .42, .12, 1, WOOD, 4.5); } },
  ]);
  // The trunk of the vine climbs the front-left post.
  const vine = Array.from({ length: 9 }, (_, j) => at(.14 + Math.sin(j * 1.3) * .025, .86 + Math.cos(j * 1.3) * .02, 1 + j * 2.4));
  k.curve(vine, "#7d6650", 1.6); k.curve(vine.map(p => ({ x: p.x - .4, y: p.y })), "#9c8469", .5);
  for (const v of [.14, .86]) box(.1, v - .025, .8, .05, 1.4, WOOD, 20);
  for (const u of [.14, .86]) box(u - .025, .1, .05, .8, 1.4, WOOD, 21.4);
  for (const t of [.32, .5, .68]) { line(at(.1, t, 22.9), at(.9, t, 22.9), "#a07c58", .9); line(at(t, .1, 22.9), at(t, .9, 22.9), "#b48f68", .8); }
  const leaves = paintState.bare > .5 ? null : paintState.foliage > .35 ? ["#9a8d3c", "#c2b14f", "#e0d27b"] : paintState.season === "spring" ? ["#5f8f45", "#86b55c", "#b4d585"] : ["#4d7c42", "#6d9c51", "#9cc271"];
  if (!leaves) {
    for (let j = 0; j < 7; j++) k.curve(Array.from({ length: 6 }, (_, i) => at(.14 + i * .14, .2 + j * .1 + Math.sin(i * 1.7 + j) * .03, 23.4)), "#86705a", .6);
    if (paintState.snow) for (const v of [.14, .86]) line(at(.1, v, 21.5), at(.9, v, 21.5), "#f3f6f9", 1);
  } else {
    // A loose roof of leaves with gaps where the lattice shows through.
    for (let j = 0; j < 46; j++) {
      const u = .12 + noise(j * 3 + 1) * .76, v = .12 + noise(j * 7 + 2) * .76;
      k.leaf(at(u, v, 23.6 + noise(j) * 1.4), 3.4 + noise(j * 5) * 1.6, 1.6 + noise(j * 9) * .8, leaves);
    }
    if (paintState.snow) for (let j = 0; j < 10; j++) oval(at(.2 + noise(j * 4) * .6, .2 + noise(j * 6) * .6, 25.2), 3, 1.2, "#f3f6f9e0");
  }
  if (bloom > .05) {
    // Hanging racemes, back to front, darkest at the stalk and pale at the tip.
    const racemes: { u: number; v: number; len: number; j: number }[] = [];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) racemes.push({ u: .16 + i * .136 + (noise(i * 9 + j) - .5) * .05, v: .18 + j * .16 + (noise(i + j * 5) - .5) * .05, len: (4.5 + noise(i * 3 + j * 7) * 5) * (.45 + bloom * .55), j: i * 5 + j });
    racemes.sort((a, b) => k.depth(a.u, a.v) - k.depth(b.u, b.v));
    for (const { u, v, len, j } of racemes) {
      const top = at(u, v, 22);
      for (let s = 0; s < 4; s++) { const t = s / 3; oval({ x: top.x + Math.sin(j + t * 2) * .3, y: top.y + t * len }, 1.5 * (1 - t * .55), 1.25 * (1 - t * .4), ["#7f5eb3", "#9a7bcc", "#b9a0de", "#dccdf2"][s]!); }
      oval({ x: top.x - .4, y: top.y + len * .3 }, .35, .5, "#efe6fa");
    }
    for (let j = 0; j < 22; j++) oval(at(.12 + noise(j * 11) * .76, .12 + noise(j * 13) * .76, 25), 1, .6, j % 2 ? "#a487d3" : "#c7b2e8");
  } else if (leaves && paintState.season === "summer") {
    // Velvety seed pods in summer.
    for (let j = 0; j < 9; j++) { const top = at(.2 + noise(j * 4) * .6, .2 + noise(j * 8) * .6, 22); line(top, { x: top.x + .4, y: top.y + 4.5 }, "#7f9a5a", 1.1); }
  }
}
type Flora = "tulip" | "hydrangea" | "sunflower" | "cosmos" | "pansy";
/** A raised bed whose flowers follow the year: tulips, hydrangeas, sunflowers, cosmos and winter pansies. */
function flowerField(k: Kit) {
  const { at, box, oval, line, c } = k, flora: Flora = paintState.flora === "default" ? "tulip" : paintState.flora;
  box(.06, .06, .88, .88, 2, ["#b8735a", "#94584a", "#d38b6f"]);
  k.poly([at(.1, .1, 3.05), at(.9, .1, 3.05), at(.9, .9, 3.05), at(.1, .9, 3.05)], paintState.snow ? "#eef2f4" : "#6e5a44");
  for (let j = 0; j < 4; j++) line(at(.12, .22 + j * .18, 3.1), at(.88, .22 + j * .18, 3.1), "#5c4a37", .5);
  const tall = flora === "sunflower", rows = tall ? [.25, .5, .75] : [.2, .38, .56, .74], cols = tall ? [.24, .42, .6, .78] : [.18, .34, .5, .66, .82];
  const plants: { u: number; v: number; j: number; row: number }[] = [];
  rows.forEach((v, row) => cols.forEach((u, i) => plants.push({ u: u + (noise(row * 7 + i) - .5) * .04, v, j: row * 9 + i, row })));
  plants.sort((a, b) => k.depth(a.u, a.v) - k.depth(b.u, b.v));
  for (const { u, v, j, row } of plants) {
    const g = at(u, v, 3);
    if (paintState.snow && flora !== "pansy") { oval({ x: g.x, y: g.y - 1 }, 2.4, 1.3, "#f3f6f9"); continue; }
    if (flora === "tulip") {
      line(g, { x: g.x, y: g.y - 4.6 }, "#5f9a48", .6);
      c.beginPath(); c.ellipse(g.x - .9, g.y - 1.6, 1.6, .5, -.9, 0, TAU); c.fillStyle = k.n("#6fae52"); c.fill();
      const color = ["#e5463f", "#f5c53b", "#f294b4", "#fbf5ea"][row % 4]!, top = { x: g.x, y: g.y - 5.4 };
      oval(top, 1.05, 1.2, color); oval({ x: top.x - .5, y: top.y - .5 }, .45, .8, color); oval({ x: top.x + .5, y: top.y - .5 }, .45, .8, color);
      oval({ x: top.x - .3, y: top.y - .2 }, .25, .45, "#ffffff70");
    } else if (flora === "hydrangea") {
      k.leaf({ x: g.x, y: g.y - 1.6 }, 3.2, 2, ["#3f6e3c", "#5c8f4c", "#86b46a"]);
      const color = ["#7f9fd6", "#a68ad1", "#e3a3c3"][(j + row) % 3]!;
      k.leaf({ x: g.x, y: g.y - 3.6 }, 2.5, 2.1, [color, color, "#ffffff"]);
      for (let d = 0; d < 5; d++) oval({ x: g.x + (noise(j * 5 + d) - .5) * 3.2, y: g.y - 3.6 + (noise(j * 9 + d) - .5) * 2.6 }, .35, .3, "#f4f1ff");
    } else if (flora === "sunflower") {
      line(g, { x: g.x, y: g.y - 12 }, "#4f8a3a", .9);
      for (const s of [-1, 1]) { c.beginPath(); c.ellipse(g.x + s * 1.4, g.y - 6 + s * .8, 1.8, .7, s * .5, 0, TAU); c.fillStyle = k.n("#5f9e46"); c.fill(); }
      const head = { x: g.x, y: g.y - 12.8 };
      for (let p = 0; p < 12; p++) { const a = p * TAU / 12; oval({ x: head.x + Math.cos(a) * 1.8, y: head.y + Math.sin(a) * 1.65 }, 1, .55, "#f6c62f", a); }
      oval(head, 1.25, 1.15, "#6b4423"); oval({ x: head.x - .35, y: head.y - .35 }, .4, .35, "#8a5c33");
    } else if (flora === "cosmos") {
      const lean = (noise(j) - .5) * 1.6;
      line(g, { x: g.x + lean, y: g.y - 6.5 }, "#7bab55", .45);
      for (let f = 0; f < 6; f++) line({ x: g.x + lean * .5, y: g.y - 3 }, { x: g.x + lean * .5 + (noise(j * 3 + f) - .5) * 3, y: g.y - 3.6 - noise(j + f) * 2 }, "#9fcd72", .35);
      k.bloom({ x: g.x + lean, y: g.y - 7 }, ["#f39ac0", "#fbf3f5", "#d1488a"][(j + row) % 3]!, .95, 8);
      if (j % 2) k.bloom({ x: g.x + lean - 1.4, y: g.y - 5.2 }, ["#fbf3f5", "#f39ac0", "#d1488a"][(j + row) % 3]!, .75, 8);
    } else {
      k.leaf({ x: g.x, y: g.y - 1 }, 2.4, 1.3, ["#3e6a3c", "#58864c", "#7ba765"]);
      for (let f = 0; f < 3; f++) {
        const p = { x: g.x + (f - 1) * 1.3, y: g.y - 1.6 - (f % 2) * .6 }, color = ["#7a5bb5", "#f1cc3f", "#f7f2ea"][(j + f) % 3]!;
        oval(p, .95, .8, color); oval({ x: p.x, y: p.y + .1 }, .3, .25, color === "#f1cc3f" ? "#5b3f8f" : "#f3d65a");
      }
      if (paintState.snow) oval({ x: g.x + .8, y: g.y - 2.2 }, 1.2, .5, "#f3f6f9e0");
    }
  }
}

/** Mix two #rrggbb colours (alpha suffixes are kept from the first). */
export function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i]! - v) * t).toString(16).padStart(2, "0")).join("") + a.slice(7);
}
/** A soft shadow where a part touches the ground. */
function footprint(k: Kit, u: number, v: number, w: number, d: number) {
  const q = (a: number, b: number) => { const p = k.at(a, b, .6); return { x: p.x + 1.2, y: p.y + .6 }; };
  k.poly([q(u, v), q(u + w, v), q(u + w, v + d), q(u, v + d)], "#294f3c2b");
}

// ---- Play equipment ------------------------------------------------------------------------------

function tyre(k: Kit, u: number) {
  const arc = Array.from({ length: 11 }, (_, j) => { const a = Math.PI * j / 10; return k.at(u, .5 + Math.cos(a) * .085, 1 + Math.sin(a) * 4.2); });
  k.oval(k.at(u, .5, 1), 4.6, 1.7, "#2f3b2f30");
  k.curve(arc, "#353331", 2.8);
  k.curve(arc.map(p => ({ x: p.x, y: p.y - .8 })), "#625d57", .6);
}
/** The seesaw plank tilted by `angle` (negative: the +u end is down). `seat` receives both seat points. */
export function seesawPlank(k: Kit, angle: number, seat?: (p: Point, end: number) => void) {
  const L = .4, pz = 8.6;
  const pt = (s: number, v: number, dz = 0) => k.at(.5 + s * L * Math.cos(angle), v, pz + s * L * TILE_PX * Math.sin(angle) + dz);
  const sideV = k.depth(.5, .56) > k.depth(.5, .44) ? .56 : .44, end = k.depth(.5 + L, .5) > k.depth(.5 - L, .5) ? 1 : -1;
  k.poly([pt(-1, sideV), pt(1, sideV), pt(1, sideV, 1.5), pt(-1, sideV, 1.5)], "#ad4c3c");
  k.poly([pt(end, .44), pt(end, .56), pt(end, .56, 1.5), pt(end, .44, 1.5)], "#8f3d31");
  k.poly([pt(-1, .44, 1.5), pt(1, .44, 1.5), pt(1, .56, 1.5), pt(-1, .56, 1.5)], "#e0735c");
  for (const s of [-1, 1]) k.poly([pt(s * .62, .45, 1.55), pt(s * .95, .45, 1.55), pt(s * .95, .55, 1.55), pt(s * .62, .55, 1.55)], "#c65a47");
  k.line(pt(-1, .5, 1.6), pt(1, .5, 1.6), "#f19a84", .35);
  k.oval(k.at(.5, .5, pz + .9), 1.4, .9, "#8b6b2a");
  for (const s of [-.5, .5]) { k.line(pt(s, .5, 1.5), pt(s, .5, 5.4), "#e8c14e", .9); k.line(pt(s, .44, 5.4), pt(s, .56, 5.4), "#f0cf5e", 1.1); }
  seat?.(pt(-.8, .5, 1.5), -1); seat?.(pt(.8, .5, 1.5), 1);
}
function seesaw(k: Kit) {
  footprint(k, .08, .38, .84, .24);
  for (const u of [.12, .88]) tyre(k, u);
  k.box(.43, .4, .14, .2, 1.4, STONE);
  for (const v of [.42, .58]) { k.line(k.at(.5, v, 2.4), k.at(.5, .5, 8.5), "#c9962f", 1.7); k.line(k.at(.5, v, 2.4), k.at(.5, .5, 8.5), "#f1cf6a", .45); }
  if (!paintState.liveParts) seesawPlank(k, -.17);
}

/** Two animals on springs side by side, facing local +v. */
export const SPRING_SEATS = [.3, .7] as const;
export function springAnimal(k: Kit, slot: number, variant: number, tilt: number, rider?: (seat: Point, side: number) => void) {
  const u = SPRING_SEATS[slot]!, f = k.side(0, 1), base = k.at(u, .5, 1.4), B = k.at(u, .5, 5.6), c = k.c;
  const panda = (slot + variant) % 2 === 0;
  c.save(); c.translate(base.x, base.y); c.rotate(tilt * f); c.translate(-base.x, -base.y);
  // The animals are drawn a little larger than life so they read at a distance.
  const grow = (draw: () => void) => { c.save(); c.translate(B.x, B.y); c.scale(1.18, 1.18); c.translate(-B.x, -B.y); draw(); c.restore(); };
  const coil = Array.from({ length: 11 }, (_, j) => ({ x: base.x + (j % 2 ? 1.5 : -1.5), y: base.y + (B.y - base.y) * j / 10 }));
  k.curve(coil, panda ? "#4f86b8" : "#d75b4d", 1.05); k.curve(coil.map(p => ({ x: p.x - .3, y: p.y - .3 })), "#ffffff60", .3);
  let seat: Point = B;
  grow(() => { if (panda) {
    for (const dx of [2.3, 1.2, -1.4, -2.4]) k.oval({ x: B.x + f * dx, y: B.y - .4 }, .95, 1.4, "#2c2c2e");
    k.oval({ x: B.x, y: B.y - 2.7 }, 4.3, 2.8, "#f7f5ef");
    k.oval({ x: B.x - f * .3, y: B.y - 1.8 }, 3.4, 1.2, "#e6e2d8");
    k.oval({ x: B.x + f * 1.7, y: B.y - 3 }, 1.3, 2.5, "#2c2c2e");
    const h = { x: B.x + f * 4.2, y: B.y - 4.9 };
    for (const e of [-1, 1]) k.oval({ x: h.x + e * 1.35, y: h.y - 2 }, .85, .8, "#2c2c2e");
    k.oval(h, 2.5, 2.3, "#f7f5ef");
    k.oval({ x: h.x + f * .3, y: h.y - .1 }, .55, .75, "#2c2c2e"); k.oval({ x: h.x + f * 1.45, y: h.y - .1 }, .5, .7, "#2c2c2e");
    k.oval({ x: h.x + f * 2.2, y: h.y + .7 }, .45, .35, "#2c2c2e");
    k.oval({ x: B.x - f * 4.1, y: B.y - 3 }, .8, .8, "#f7f5ef");
    k.line({ x: B.x + f * 2.4, y: B.y - 5.5 }, { x: B.x + f * 3.1, y: B.y - 6.6 }, "#f0c14b", .9); k.oval({ x: B.x + f * 3.15, y: B.y - 6.7 }, .5, .45, "#f0c14b");
    seat = { x: B.x - f * .6, y: B.y - 5.3 };
  } else {
    for (const [dx, back] of [[2.5, 0], [1.4, 0], [-1.6, 1], [-2.6, 1]] as const) k.line({ x: B.x + f * dx, y: B.y - 2 }, { x: B.x + f * (dx + (back ? -.5 : .5)), y: B.y + .3 }, "#d99a32", .9);
    k.oval({ x: B.x, y: B.y - 2.6 }, 4.4, 2.4, "#f2c14e");
    k.oval({ x: B.x - f * .4, y: B.y - 3.4 }, 3.2, 1.1, "#f8d980");
    k.poly([{ x: B.x + f * 2.4, y: B.y - 4.2 }, { x: B.x + f * 3.6, y: B.y - 7.2 }, { x: B.x + f * 4.8, y: B.y - 6.4 }, { x: B.x + f * 3.8, y: B.y - 2.6 }], "#f2c14e");
    const h = { x: B.x + f * 4.6, y: B.y - 6.6 };
    k.oval(h, 2.3, 1.25, "#f2c14e", f * .45);
    k.oval({ x: h.x + f * 1.6, y: h.y + .7 }, .9, .7, "#e0a93a");
    k.oval({ x: h.x + f * .2, y: h.y - .4 }, .3, .3, "#3b2f2a");
    k.poly([{ x: h.x - f * .5, y: h.y - 1 }, { x: h.x - f * .1, y: h.y - 2.6 }, { x: h.x + f * .4, y: h.y - .9 }], "#f2c14e");
    k.curve([{ x: B.x + f * 2.6, y: B.y - 4.6 }, { x: B.x + f * 3.2, y: B.y - 6.6 }, { x: h.x - f * .7, y: h.y - 1.2 }], "#d9534f", 1.2);
    k.curve([{ x: B.x - f * 4.1, y: B.y - 3.2 }, { x: B.x - f * 5.2, y: B.y - 2.2 }, { x: B.x - f * 5.3, y: B.y - .4 }], "#d9534f", 1.2);
    k.oval({ x: B.x - f * .5, y: B.y - 4.6 }, 1.7, .8, "#d9534f");
    k.line({ x: B.x + f * 2.6, y: B.y - 6 }, { x: B.x + f * 3.4, y: B.y - 6.7 }, "#f0f0e6", .8);
    seat = { x: B.x - f * .5, y: B.y - 5 };
  } });
  seat = { x: B.x + (seat.x - B.x) * 1.18, y: B.y + (seat.y - B.y) * 1.18 };
  rider?.(seat, f);
  c.restore();
}
function springRider(k: Kit, variant: number) {
  for (const u of SPRING_SEATS) { k.disc(u, .5, .15, 1.04, "#c97a5c"); k.disc(u, .5, .125, 1.1, "#e39a78"); k.oval(k.at(u, .5, 1.15), 2, 1, "#8f6b5a"); }
  if (!paintState.liveParts) SPRING_SEATS.forEach((_, slot) => springAnimal(k, slot, variant, 0));
}

/** A rotating climbing globe of coloured bars. Riders are drawn behind the dome first, in front of it last. */
export const GLOBE = { radius: 10, center: 8.2 };
export function globeDome(k: Kit, angle: number, riders?: (front: boolean) => void) {
  const o = k.world(.5, .5), { radius: R, center: zc } = GLOBE;
  const point = (lat: number, lon: number) => { const rr = R * Math.cos(lat) / TILE_PX; return iso(o.x + Math.cos(lon) * rr, o.y + Math.sin(lon) * rr, zc + R * Math.sin(lat)); };
  const colors = ["#d9534f", "#f0c14b", "#4f8fc0", "#5aa469"], deg = Math.PI / 180;
  const meridian = (lon: number, j: number, back: boolean) => k.curve(Array.from({ length: 10 }, (_, i) => point(-48 * deg + i * 138 * deg / 9, lon)), back ? mix(colors[j % 4]!, "#203030", .45) : colors[j % 4]!, back ? .9 : 1.25);
  const ring = (lat: number, back: boolean) => k.curve(Array.from({ length: 13 }, (_, i) => point(lat, (back ? Math.PI * .75 : -Math.PI * .25) + i * Math.PI / 12)), back ? "#8d9895" : "#d4dad7", back ? .8 : 1);
  const front = (lon: number) => Math.cos(lon - Math.PI / 4) > 0;
  riders?.(false);
  for (const lat of [-40, -12, 18, 48]) ring(lat * deg, true);
  for (let j = 0; j < 10; j++) { const lon = angle + j * TAU / 10; if (!front(lon)) meridian(lon, j, true); }
  for (const lat of [-40, -12, 18, 48]) ring(lat * deg, false);
  for (let j = 0; j < 10; j++) { const lon = angle + j * TAU / 10; if (front(lon)) meridian(lon, j, false); }
  k.oval(point(Math.PI / 2, 0), 1.5, .8, "#e6c178");
  riders?.(true);
}
function globe(k: Kit) {
  k.disc(.5, .5, .32, 1.02, "#a39d8c"); k.disc(.5, .5, .3, 1.07, "#cfc9b8"); k.disc(.5, .5, .24, 1.1, "#c2b59c");
  for (let j = 0; j < 30; j++) k.oval(k.at(.5 + (noise(j) - .5) * .42, .5 + (noise(j * 3) - .5) * .42, 1.12), .5, .3, "#a8987c");
  k.cylinder(.5, .5, .035, 2.6, ["#9aa39f", "#6e7a76", "#c6ccc8"], 1.1);
  if (!paintState.liveParts) globeDome(k, .3);
}

/** Carousel horse in profile, prancing; `f` is the screen side it faces. */
export function carouselHorse(k: Kit, p: Point, f: number, color: string, saddle: string, gallop: number) {
  const dark = mix(color, "#4a3a44", .42), g = Math.sin(gallop) * .35, P = (dx: number, dy: number) => ({ x: p.x + f * dx, y: p.y + dy });
  k.curve([P(1.8, .6), P(2.9, .4 + g), P(3.5, 1.3 + g)], dark, .8);
  k.curve([P(1.2, .8), P(2, 1.8 - g), P(2.6, 2.4 - g)], dark, .8);
  k.curve([P(-1.8, .6), P(-2.8, 1.8 + g), P(-3.6, 2.6 + g)], dark, .8);
  k.curve([P(-1.2, .8), P(-1.9, 2 - g), P(-2.5, 3 - g)], dark, .8);
  k.curve([P(-3.1, -.6), P(-4.4, -.3), P(-5, 1.4)], "#e6c178", 1.4);
  k.oval(p, 3.4, 1.85, dark); k.oval(P(-.05, -.1), 3.15, 1.6, color);
  k.poly([P(1.5, -1.2), P(2.5, -3.9), P(3.8, -3.7), P(3.3, -.3)], dark);
  k.poly([P(1.75, -1.1), P(2.65, -3.65), P(3.55, -3.5), P(3.05, -.4)], color);
  k.oval(P(4.25, -3.15), 1.95, .9, dark, f * .65); k.oval(P(4.2, -3.2), 1.75, .72, color, f * .65);
  k.oval(P(5.25, -2.25), .7, .55, dark);
  k.poly([P(3.2, -4.1), P(3.45, -5.4), P(3.9, -4.1)], color);
  k.oval(P(3.9, -3.5), .26, .26, "#2b2b2b");
  k.curve([P(1.6, -1.5), P(2.3, -3.7), P(3.3, -4.7)], "#e6c178", 1.25);
  k.oval(P(-.5, -.75), 2, .45, mix(color, "#ffffff", .55));
  k.oval(P(-.4, -1.45), 1.6, .75, saddle); k.line(P(-1.7, -1.15), P(.9, -1.15), "#f3d98a", .4);
  k.line(P(4.7, -2.6), P(1.9, -1.5), "#c0392b", .3);
}
const HORSES = ["#f7f1e6", "#f2b8c6", "#a9d2ef", "#bfe3c9", "#d4c4ec", "#f5dfae"], SADDLES = ["#d9534f", "#3f6fa8", "#e8a33d", "#8e5bb5", "#3f9a6c", "#d9534f"];
/**
 * Everything of the carousel above its drum, at rotation `angle`: poles and bobbing horses behind the centre
 * column, the column, the horses in front, then the striped roof, valance and bulbs. `rider` draws a child on
 * a horse right after that horse.
 */
export function carouselTop(k: Kit, angle: number, time: number, options: { lit?: boolean; rider?: (slot: number, seat: Point, f: number, toward: number) => void } = {}) {
  const o = k.world(.5, .5), deck = 4.4, roof = 22.5;
  const pos = (a: number, radius: number, z: number) => iso(o.x + Math.cos(a) * radius, o.y + Math.sin(a) * radius, z);
  const horses = Array.from({ length: 6 }, (_, j) => { const a = angle + j * TAU / 6; return { j, a, d: Math.cos(a) + Math.sin(a) }; }).sort((x, y) => x.d - y.d);
  const drawHorse = ({ j, a }: { j: number; a: number }) => {
    const bob = Math.sin(time * 2.2 + j * 2.1) * 2.1, base = pos(a, .29, deck), top = pos(a, .29, roof), body = pos(a, .29, 10.5 + bob);
    k.line(base, top, "#e6c178", .9); k.line({ x: base.x - .3, y: base.y }, { x: top.x - .3, y: top.y }, "#fff3cf80", .3);
    const f = (-Math.sin(a) - Math.cos(a)) >= 0 ? 1 : -1;
    carouselHorse(k, body, f, HORSES[j]!, SADDLES[j]!, time * 6 + j);
    options.rider?.(j, { x: body.x - f * .3, y: body.y - 1.7 }, f, Math.cos(a) - Math.sin(a) >= 0 ? 1 : -1);
  };
  for (const h of horses) if (h.d < 0) drawHorse(h);
  k.cylinder(.5, .5, .075, roof - deck, ["#f0d78c", "#b88a3a", "#f6e3a8"], deck);
  for (let j = 0; j < 8; j++) {
    const a = angle * 1.0 + j * TAU / 8, facing = Math.cos(a - Math.PI / 4); if (facing < .2) continue;
    k.line(pos(a, .072, deck + 2), pos(a, .072, roof - 2), facing > .7 ? "#e8f6f8" : "#bfd6da", .9);
  }
  for (const h of horses) if (h.d >= 0) drawHorse(h);
  // Valance: scallops hanging under the front of the eave.
  for (let j = 0; j <= 16; j++) { const a = -Math.PI / 4 + j * Math.PI / 16; k.oval(pos(a, .48, roof - .6), 1.9, 1.5, j % 2 ? "#d64f45" : "#f8eedc"); }
  // Striped cone, turning with the horses; facets toward the light (screen left) are brighter.
  const segs = 16, apex = iso(o.x, o.y, roof + 12.5), facets: { a0: number; a1: number; j: number; d: number }[] = [];
  for (let j = 0; j < segs; j++) { const a0 = angle + j * TAU / segs, a1 = a0 + TAU / segs, mid = (a0 + a1) / 2; facets.push({ a0, a1, j, d: Math.cos(mid - Math.PI / 4) }); }
  facets.sort((x, y) => x.d - y.d);
  for (const { a0, a1, j } of facets) {
    const mid = (a0 + a1) / 2, light = .5 + .5 * Math.cos(mid - Math.PI * .75), base = j % 2 ? "#f8eedc" : "#d64f45";
    k.poly([apex, pos(a0, .5, roof), pos(a1, .5, roof)], snowy(mix(base, "#3c2a2a", (1 - light) * .32), .5));
  }
  k.curve(Array.from({ length: 17 }, (_, i) => pos(-Math.PI / 4 + i * Math.PI / 16, .5, roof)), "#e6c178", .9);
  for (let j = 0; j <= 18; j++) {
    const p = pos(-Math.PI / 4 + j * Math.PI / 18, .5, roof - 1.1);
    if (options.lit) { const g = lightGradient(k.c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 3.4)); g.addColorStop(0, "#fff1b4aa"); g.addColorStop(1, "#fff1b400"); k.oval(p, 3.4, 3.4, g); }
    k.oval(p, .55, .55, options.lit ? "#fff1b4" : "#f3e7c4");
  }
  k.oval(apex, 1.5, 1.5, "#e6c178"); k.line(apex, { x: apex.x, y: apex.y - 4.5 }, "#c9a24f", .5);
  k.poly([{ x: apex.x, y: apex.y - 4.5 }, { x: apex.x + 3.2, y: apex.y - 3.7 + Math.sin(time * 4) * .4 }, { x: apex.x, y: apex.y - 2.9 }], "#d64f45");
}
function carousel(k: Kit) {
  k.disc(.5, .5, .48, 1.02, "#c9bea3");
  k.cylinder(.5, .5, .43, 3.4, ["#f4e6c2", "#c9b183", "#e8d7ad"], 1.05);
  k.curve(k.circle(.5, .5, .43, 2.4, 24, -Math.PI / 4, Math.PI * .75), "#c9473f", 1.3);
  k.curve(k.circle(.5, .5, .43, 4.3, 24, -Math.PI / 4, Math.PI * .75), "#e6c178", .6);
  for (let j = 0; j < 12; j++) k.oval(k.circle(.5, .5, .43, 1.6, 12, -Math.PI / 4, Math.PI * .75)[j]!, .5, .5, "#f3d98a");
  k.box(.42, .9, .16, .07, 1.7, STONE);
  if (!paintState.liveParts) carouselTop(k, .35, 0);
}

/** A 3×3×3 climbing frame; the bars are listed back to front so a climber can be tucked between them. */
export type Bar = { a: Point; b: Point; d: number; color: string; vertical: boolean };
export function jungleBars(k: Kit): Bar[] {
  const us = [.2, .4, .6, .8], bars: Bar[] = [], level = ["#d9534f", "#f0c14b", "#5aa469"];
  for (const u of us) for (const v of us) bars.push({ a: k.at(u, v, 1), b: k.at(u, v, 16), d: k.depth(u, v), color: "#4f8fc0", vertical: true });
  [6, 11, 16].forEach((z, l) => {
    for (const v of us) for (let i = 0; i < 3; i++) bars.push({ a: k.at(us[i]!, v, z), b: k.at(us[i + 1]!, v, z), d: k.depth((us[i]! + us[i + 1]!) / 2, v) + .001, color: level[l]!, vertical: false });
    for (const u of us) for (let i = 0; i < 3; i++) bars.push({ a: k.at(u, us[i]!, z), b: k.at(u, us[i + 1]!, z), d: k.depth(u, (us[i]! + us[i + 1]!) / 2) + .001, color: level[l]!, vertical: false });
  });
  return bars.sort((a, b) => a.d - b.d);
}
export function drawBar(k: Kit, bar: Bar) {
  k.line(bar.a, bar.b, bar.color, bar.vertical ? 1.15 : 1.05);
  k.line({ x: bar.a.x - .35, y: bar.a.y - .25 }, { x: bar.b.x - .35, y: bar.b.y - .25 }, "#ffffff50", .35);
}
function jungleGym(k: Kit) {
  k.poly([k.at(.12, .12, 1.03), k.at(.88, .12, 1.03), k.at(.88, .88, 1.03), k.at(.12, .88, 1.03)], "#c99a6b");
  for (let j = 0; j < 26; j++) k.oval(k.at(.15 + noise(j) * .7, .15 + noise(j * 3) * .7, 1.08), .55, .3, j % 2 ? "#b88a5c" : "#ddb383");
  footprint(k, .18, .18, .64, .64);
  for (const bar of jungleBars(k)) drawBar(k, bar);
  for (const u of [.2, .4, .6, .8]) for (const v of [.2, .4, .6, .8]) k.oval(k.at(u, v, 16), .55, .4, "#e9eef0");
}

/** Water play pad: blue tiles, coloured nozzles, a mushroom shower and a frog that spits water. */
export const SPLASH_JETS: readonly [number, number][] = [[.5, .52], [.5, .76], [.29, .62], [.71, .64], [.38, .38], [.62, .4]];
export const SPLASH_MUSHROOM = [.74, .28] as const, SPLASH_FROG = [.25, .3] as const;
function splashPad(k: Kit) {
  const { at, oval, curve } = k;
  k.disc(.5, .5, .46, 1.02, "#bfc8c2"); k.disc(.5, .5, .43, 1.08, "#8fcadb");
  for (const radius of [.12, .22, .32, .41]) curve(k.circle(.5, .5, radius, 1.12, 32), "#c4e7f0", .45);
  for (let j = 0; j < 12; j++) { const a = j * TAU / 12; k.line(at(.5 + Math.cos(a) * .12, .5 + Math.sin(a) * .12, 1.12), at(.5 + Math.cos(a) * .42, .5 + Math.sin(a) * .42, 1.12), "#b0dbe7", .4); }
  SPLASH_JETS.forEach(([u, v], j) => { oval(at(u, v, 1.15), 1.7, .85, ["#f08fae", "#f5cf4c", "#7cc489"][j % 3]!); oval(at(u, v, 1.2), .7, .35, "#3f6b78"); });
  // Mushroom shower.
  const [mu, mv] = SPLASH_MUSHROOM;
  k.cylinder(mu, mv, .025, 10.5, ["#efeae0", "#bdb7aa", "#f6f2ea"], 1.1);
  const cap = at(mu, mv, 11.6);
  oval({ x: cap.x, y: cap.y + .4 }, 5.4, 2.3, "#b8463c");
  k.c.beginPath(); k.c.ellipse(cap.x, cap.y, 5.4, 4.2, 0, Math.PI, TAU); k.c.closePath(); k.c.fillStyle = k.gradient({ x: cap.x - 5, y: 0 }, { x: cap.x + 5, y: 0 }, [[0, "#ee6e5f"], [1, "#c24a3f"]]); k.c.fill();
  for (const [dx, dy, r] of [[-2.4, -1.4, .9], [.6, -2.9, .8], [2.6, -1.2, .7], [-.6, -.6, .6]] as const) oval({ x: cap.x + dx, y: cap.y + dy }, r, r * .8, "#fbf6ec");
  // Frog fountain.
  const [fu, fv] = SPLASH_FROG, f = at(fu, fv, 1.2), s = k.side(1, 1);
  oval({ x: f.x, y: f.y - 1.8 }, 3.2, 2.2, "#5fae55"); oval({ x: f.x - s * .5, y: f.y - 1.2 }, 2.2, 1, "#c9e7a6");
  for (const e of [-1, 1]) { oval({ x: f.x + e * 1.4, y: f.y - 4 }, .95, .9, "#5fae55"); oval({ x: f.x + e * 1.4, y: f.y - 4.15 }, .6, .6, "#ffffff"); oval({ x: f.x + e * 1.4 + s * .15, y: f.y - 4.1 }, .3, .3, "#2b2b2b"); }
  k.line({ x: f.x - 1, y: f.y - 2.6 }, { x: f.x + 1, y: f.y - 2.6 }, "#2f6a35", .4);
}

/** Three bars at three heights, for small, middle and big children. */
export const BAR_SPECS = [{ u0: .12, u1: .38, z: 7 }, { u0: .38, u1: .62, z: 9.5 }, { u0: .62, u1: .88, z: 12 }] as const;
function bars(k: Kit) {
  const { at, poly, line, oval } = k;
  poly([at(.06, .3, 1.03), at(.94, .3, 1.03), at(.94, .7, 1.03), at(.06, .7, 1.03)], "#dcc7a0");
  for (let j = 0; j < 22; j++) oval(at(.08 + noise(j) * .84, .32 + noise(j * 5) * .36, 1.08), .6, .3, j % 2 ? "#cdb68c" : "#e9d8b3");
  const posts = [[.12, 7.6, "#e15b4f"], [.38, 10.1, "#f0c14b"], [.62, 12.6, "#4f8fc0"], [.88, 12.6, "#5aa469"]] as const;
  const pieces: { u: number; v: number; paint: () => void }[] = posts.map(([u, h, cap]) => ({ u, v: .5, paint: () => { k.cylinder(u, .5, .022, h, ["#f2efe6", "#bdb8aa", "#f8f6f0"], 1); oval(at(u, .5, 1 + h), 1.1, .6, cap); } }));
  for (const { u0, u1, z } of BAR_SPECS) pieces.push({ u: (u0 + u1) / 2, v: .5, paint: () => { line(at(u0, .5, z), at(u1, .5, z), "#7f8f8c", 1.25); line(at(u0, .5, z + .4), at(u1, .5, z + .4), "#eef3f1", .4); } });
  k.assemble(pieces);
}

/** A half court with a hoop at the back edge of the tile. */
export const HOOP = { u: .5, v: .215, z: 17.4 } as const;
function basketball(k: Kit) {
  const { at, poly, line, curve } = k;
  poly([at(.05, .05, 1.03), at(.95, .05, 1.03), at(.95, .95, 1.03), at(.05, .95, 1.03)], "#86928e");
  for (let j = 0; j < 30; j++) k.oval(at(.08 + noise(j) * .84, .08 + noise(j * 7) * .84, 1.06), .7, .35, j % 2 ? "#7b8783" : "#929e9a");
  const white = "#eef0e8";
  curve([at(.08, .08, 1.1), at(.92, .08, 1.1), at(.92, .92, 1.1), at(.08, .92, 1.1), at(.08, .08, 1.1)], white, .55);
  curve([at(.37, .08, 1.1), at(.37, .44, 1.1), at(.63, .44, 1.1), at(.63, .08, 1.1)], white, .55);
  poly([at(.37, .08, 1.08), at(.63, .08, 1.08), at(.63, .44, 1.08), at(.37, .44, 1.08)], "#b65a3f55");
  curve(Array.from({ length: 13 }, (_, i) => { const t = i / 12 * Math.PI; return at(.5 + Math.cos(t) * .13, .44 + Math.sin(t) * .13, 1.1); }), white, .55);
  curve(Array.from({ length: 21 }, (_, i) => { const t = .12 + i / 20 * (Math.PI - .24); return at(.5 + Math.cos(t) * .4, .12 + Math.sin(t) * .4, 1.1); }), white, .55);
  footprint(k, .46, .03, .08, .08);
  k.cylinder(.5, .065, .024, 20.5, ["#5b6b67", "#3d4a47", "#7d8c88"], 1);
  k.box(.485, .07, .03, .085, 1, METAL, 20.2);
  poly([at(.37, .155, 16.4), at(.63, .155, 16.4), at(.63, .155, 24.6), at(.37, .155, 24.6)], "#f7f7f2", "#43504d", .6);
  poly([at(.455, .156, 17.6), at(.545, .156, 17.6), at(.545, .156, 20.6), at(.455, .156, 20.6)], "#f7f7f200", "#e0623d", .55);
  const rim = k.circle(HOOP.u, HOOP.v, .055, HOOP.z, 16);
  rim.slice(0, 16).forEach((p, j) => { if (j % 2 === 0) line(p, { x: (p.x * 2 + at(HOOP.u, HOOP.v, HOOP.z - 3.4).x) / 3, y: at(HOOP.u, HOOP.v, HOOP.z - 3.4).y + (p.y - at(HOOP.u, HOOP.v, HOOP.z).y) * .5 }, "#f4f4ee", .4); });
  curve(rim, "#e2622f", .85);
}

// ---- Eating and resting --------------------------------------------------------------------------

const CART_BODY = [["#9fd3c7", "#79b3a6", "#c4ebe1"], ["#f2b8a2", "#d39582", "#f9d4c5"], ["#f3d98c", "#d4b965", "#f8e8b5"]];
const CART_AWNING = ["#e15b4f", "#3f9a8c", "#e8a33d"];
/** The serving window of the food truck faces local +v, where the queue stands. */
export const CART_WINDOW = { u0: .25, u1: .57, v: .72 } as const;
function foodCart(k: Kit, night: boolean, variant: number) {
  const { at, poly, line, oval, box } = k, body = CART_BODY[variant % 3]!, stripe = CART_AWNING[variant % 3]!, open = !night || paintState.shopsOpen;
  footprint(k, .12, .32, .78, .44);
  const front = k.depth(.5, .74) > k.depth(.5, .33), nose = k.depth(.9, .53) > k.depth(.1, .53);
  const wheel = (u: number, v: number) => { const p = at(u, v, 2.4); oval(p, 2.3, 2.1, "#2f3133"); oval(p, 1, .95, "#b9bdbd"); };
  wheel(.26, front ? .33 : .73); wheel(.74, front ? .33 : .73);
  box(.14, .34, .56, .38, 10.5, body, 3);
  box(.7, .36, .17, .34, 7.6, body, 3);
  box(.15, .35, .54, .36, 1.1, ["#f4f1ea", "#cfcac0", "#fbf9f4"], 13.5);
  // Windscreen and cab window.
  if (nose) poly([at(.87, .39, 6.8), at(.87, .67, 6.8), at(.87, .65, 10), at(.87, .41, 10)], "#3d5560", "#e8eef0", .4);
  const cabSide = front ? .7 : .36;
  poly([at(.73, cabSide, 6.8), at(.84, cabSide, 6.8), at(.84, cabSide, 9.6), at(.75, cabSide, 9.6)], "#46616b");
  line(at(.14, cabSide === .7 ? .72 : .34, 4.6), at(.87, cabSide === .7 ? .72 : .34, 4.6), mix(body[1]!, "#000000", .15), .5);
  if (front) {
    const { u0, u1, v } = CART_WINDOW;
    poly([at(u0, v + .002, 5.4), at(u1, v + .002, 5.4), at(u1, v + .002, 11.8), at(u0, v + .002, 11.8)], open ? night ? "#ffe6a2" : "#5b4a3e" : "#c9cfd0");
    if (open) {
      // The vendor behind the counter, and a row of cones on the shelf.
      const head = at((u0 + u1) / 2 - .05, v - .02, 8.6);
      oval({ x: head.x, y: head.y + 2.4 }, 1.7, 1.9, "#f6f3ec"); oval(head, 1.15, 1.15, "#f1d3b8"); oval({ x: head.x, y: head.y - .95 }, 1.3, .6, "#f6f3ec");
      for (let j = 0; j < 4; j++) { const p = at(u0 + .19 + j * .03, v + .003, 6.4); poly([{ x: p.x - .5, y: p.y - 1.4 }, { x: p.x + .5, y: p.y - 1.4 }, { x: p.x, y: p.y }], "#d8a25f"); oval({ x: p.x, y: p.y - 1.7 }, .6, .5, ["#f6c6d4", "#fbf3e6", "#a8d8b9", "#8a5a3c"][j]!); }
    } else for (let j = 1; j < 8; j++) line(at(u0, v + .003, 5.4 + j * .8), at(u1, v + .003, 5.4 + j * .8), "#a9b0b2", .35);
    box(u0 - .01, v, u1 - u0 + .02, .05, .7, ["#f1ede4", "#c7c2b6", "#faf8f3"], 4.9);
    // Striped awning out over the counter, scalloped edge, string lights.
    if (open) {
      const n = 6, du = (u1 - u0 + .04) / n;
      for (let j = 0; j < n; j++) { const a = u0 - .02 + j * du; poly([at(a, v, 13.3), at(a + du, v, 13.3), at(a + du, v + .075, 12), at(a, v + .075, 12)], j % 2 ? stripe : "#f6f1e6"); }
      for (let j = 0; j <= n * 2; j++) { const p = at(u0 - .02 + j * du / 2, v + .075, 12); oval({ x: p.x, y: p.y + .35 }, .85, .6, j % 2 ? stripe : "#f6f1e6"); }
      for (let j = 0; j <= 8; j++) { const p = at(u0 + j * (u1 - u0) / 8, v + .075, 11.2 - Math.sin(j / 8 * Math.PI) * .6); oval(p, .45, .45, ["#ffe6a2", "#ffb5a0", "#fff1b4"][j % 3]!); }
    } else box(u0 - .02, v, u1 - u0 + .04, .03, .8, [stripe, mix(stripe, "#000000", .2), stripe], 12.4);
    // A chalkboard menu on the pavement.
    const board = at(.2, .88, 1);
    poly([{ x: board.x - 2.2, y: board.y }, { x: board.x - 1.4, y: board.y - 6.4 }, { x: board.x + 1.4, y: board.y - 6.4 }, { x: board.x + 2.2, y: board.y }], "#8a6b4a");
    poly([{ x: board.x - 1.6, y: board.y - .8 }, { x: board.x - 1.1, y: board.y - 5.8 }, { x: board.x + 1.1, y: board.y - 5.8 }, { x: board.x + 1.6, y: board.y - .8 }], "#2f4a3e");
    for (let j = 0; j < 4; j++) line({ x: board.x - 1, y: board.y - 4.9 + j * 1.1 }, { x: board.x + .4 + noise(j) * .6, y: board.y - 4.9 + j * 1.1 }, ["#f4e6c8", "#f2a6b8", "#f6d36b", "#bfe3c9"][j]!, .45);
  }
  // The ice-cream sign on the roof.
  const sign = at(.42, .53, 14.6);
  poly([{ x: sign.x - 2.1, y: sign.y - 4.8 }, { x: sign.x + 2.1, y: sign.y - 4.8 }, { x: sign.x, y: sign.y + .2 }], "#d8a25f");
  for (let j = 0; j < 3; j++) line({ x: sign.x - 1.6 + j * 1.1, y: sign.y - 4.6 }, { x: sign.x - .4 + j * .5, y: sign.y - 1 }, "#b98446", .3);
  oval({ x: sign.x, y: sign.y - 5.6 }, 2.4, 1.9, "#f6c6d4"); oval({ x: sign.x + .2, y: sign.y - 7.6 }, 1.9, 1.6, "#fbf3e6"); oval({ x: sign.x + .5, y: sign.y - 9 }, .6, .6, "#d9534f");
}

const PARASOLS: [string, string][] = [["#e15b4f", "#f6f1e6"], ["#3f6fa8", "#f6f1e6"], ["#3f9a6c", "#f3ecd4"], ["#f0b83c", "#f6f1e6"]];
/** A café table under a big striped parasol, with three chairs. */
export const PARASOL_CHAIRS = [-2.3, -.5, 1.4].map(a => ({ a, u: .5 + Math.cos(a) * .22, v: .5 + Math.sin(a) * .22 }));
function parasol(k: Kit, night: boolean, variant: number) {
  const { at, oval, line, box, poly } = k, [color, cream] = PARASOLS[variant % 4]!, open = !night || paintState.shopsOpen;
  k.disc(.5, .5, .38, 1.02, "#d8cdb2");
  for (let j = 0; j < 8; j++) { const a = j * TAU / 8; line(at(.5 + Math.cos(a) * .1, .5 + Math.sin(a) * .1, 1.06), at(.5 + Math.cos(a) * .37, .5 + Math.sin(a) * .37, 1.06), "#c8bc9f", .35); }
  footprint(k, .4, .4, .2, .2);
  k.assemble([
    ...PARASOL_CHAIRS.map(({ a, u, v }) => ({ u, v, paint: () => {
      for (const [du, dv] of [[-.03, -.03], [.03, -.03], [.03, .03], [-.03, .03]] as const) line(at(u + du, v + dv, 1), at(u + du, v + dv, 4.6), "#7a8f8a", .45);
      box(u - .04, v - .04, .08, .08, .7, ["#8cc3b3", "#6a9e90", "#a9d6c8"], 4.6);
      const bu = u + Math.cos(a) * .045, bv = v + Math.sin(a) * .045, tu = -Math.sin(a) * .045, tv = Math.cos(a) * .045;
      poly([at(bu - tu, bv - tv, 5.2), at(bu + tu, bv + tv, 5.2), at(bu + tu, bv + tv, 9.6), at(bu - tu, bv - tv, 9.6)], "#7fb8a7", "#5f8f82", .3);
    } })),
    { u: .5, v: .5, paint: () => { k.disc(.5, .5, .05, 1.1, "#9aa39f"); line(at(.5, .5, 1), at(.5, .5, 7.6), "#9aa39f", 1); k.disc(.5, .5, .11, 8, "#e9e6dd"); k.disc(.5, .5, .1, 8.4, "#f6f4ee"); } },
  ]);
  line(at(.5, .5, 8.4), at(.5, .5, 24.6), "#d9d4c8", 1); line(at(.5, .5, 8.4), at(.5, .5, 24.6), "#9c968a", .3);
  const apex = at(.5, .5, 25.8), o = k.world(.5, .5), rim = (a: number, z: number) => iso(o.x + Math.cos(a) * .34, o.y + Math.sin(a) * .34, z);
  if (!open) {
    poly([at(.5, .5, 13), { x: apex.x - 1.6, y: apex.y + 7 }, apex, { x: apex.x + 1.6, y: apex.y + 7 }], color, cream, .3);
    return;
  }
  const panels = Array.from({ length: 8 }, (_, j) => ({ a0: j * TAU / 8, a1: (j + 1) * TAU / 8, j })).sort((p, q) => Math.cos((p.a0 + p.a1) / 2 - Math.PI / 4) - Math.cos((q.a0 + q.a1) / 2 - Math.PI / 4));
  for (const { a0, a1, j } of panels) {
    const mid = (a0 + a1) / 2, light = .5 + .5 * Math.cos(mid - Math.PI * .75);
    poly([apex, rim(a0, 21.2), rim(mid, 21.6), rim(a1, 21.2)], snowy(mix(j % 2 ? cream : color, "#2a2a30", (1 - light) * .28), .55));
  }
  for (let j = 0; j <= 12; j++) { const a = -Math.PI / 4 + j * Math.PI / 12; oval(rim(a, 20.7), 1.3, .9, j % 2 ? cream : color); }
  oval(apex, .9, .7, "#e9e3d4");
}

/** Drinking fountain with a low bowl for dogs. */
export const FAUCET = { u: .5, v: .5, z: 11.8 } as const;
function drinkFountain(k: Kit) {
  const { at, poly, line, oval } = k;
  poly([at(.33, .33, 1.03), at(.67, .33, 1.03), at(.67, .67, 1.03), at(.33, .67, 1.03)], "#7f8a86");
  for (let j = 1; j < 6; j++) { line(at(.33 + j * .057, .33, 1.06), at(.33 + j * .057, .67, 1.06), "#5d6763", .35); line(at(.33, .33 + j * .057, 1.06), at(.67, .33 + j * .057, 1.06), "#5d6763", .35); }
  k.cylinder(.5, .5, .075, 8.6, ["#d4d1c4", "#9d9a8e", "#e2dfd4"], 1);
  const top = at(.5, .5, 9.7);
  oval(top, 5.3, 2.7, "#e4e1d7"); oval({ x: top.x, y: top.y + .2 }, 3.9, 1.9, "#9fcad3"); oval({ x: top.x - 1.2, y: top.y - .2 }, 1.2, .4, "#e2f3f4");
  line(at(.5, .44, 9.7), at(.5, .44, 11.8), "#b7bcbc", .9); line(at(.5, .44, 11.8), at(.5, .5, 11.8), "#c9cfcf", .9);
  const bowl = at(.7, .64, 1.6);
  oval({ x: bowl.x, y: bowl.y + .5 }, 2.6, 1.3, "#a9a69c"); oval(bowl, 2.3, 1.1, "#c4c1b6"); oval({ x: bowl.x, y: bowl.y + .1 }, 1.6, .7, "#a6d0d8");
  // A paw print on the bowl's stand, just for fun.
  const paw = at(.7, .64, .9);
  oval({ x: paw.x + 2.4, y: paw.y }, .45, .3, "#8f8a7f"); for (const dx of [-.5, 0, .5]) oval({ x: paw.x + 2.4 + dx, y: paw.y - .55 }, .18, .15, "#8f8a7f");
}

/** Round bandstand: a raised stage under an octagonal copper roof with bunting and stage lights. */
export const STAGE = { radius: .36, deck: 5.4 } as const;
const STAGE_COLUMNS = Array.from({ length: 6 }, (_, j) => Math.PI / 6 + j * TAU / 6);
export function bandstandColumns(k: Kit, front: boolean, z0 = 5.4, z1 = 21.6) {
  const o = k.world(.5, .5);
  for (const a of STAGE_COLUMNS) {
    const d = Math.cos(a - Math.PI / 4); if (front !== d > 0) continue;
    const p0 = iso(o.x + Math.cos(a) * STAGE.radius, o.y + Math.sin(a) * STAGE.radius, z0), p1 = iso(o.x + Math.cos(a) * STAGE.radius, o.y + Math.sin(a) * STAGE.radius, z1);
    k.line(p0, p1, "#f4f1e8", 1.5); k.line({ x: p0.x + .5, y: p0.y }, { x: p1.x + .5, y: p1.y }, "#cfc9b9", .5);
  }
}
function bandstand(k: Kit, night: boolean) {
  const { at, oval, line, poly } = k, o = k.world(.5, .5);
  const ring = (a: number, radius: number, z: number) => iso(o.x + Math.cos(a) * radius, o.y + Math.sin(a) * radius, z);
  k.cylinder(.5, .5, .42, 4.4, ["#f4f1e8", "#cfc9b9", "#c9a679"], 1);
  for (let j = 0; j < 14; j++) { const a = -Math.PI / 4 + (j + .5) * Math.PI / 14; line(ring(a, .42, 1.6), ring(a + Math.PI / 14, .42, 4.6), "#c9c2b0", .35); line(ring(a, .42, 4.6), ring(a + Math.PI / 14, .42, 1.6), "#c9c2b0", .35); }
  k.curve(k.circle(.5, .5, .42, 5.4, 24, -Math.PI / 4, Math.PI * .75), "#5f9d8c", .7);
  for (let j = 0; j < 9; j++) { const a = j * TAU / 9; line(ring(a, .1, 5.45), ring(a, .4, 5.45), "#b8946a", .35); }
  k.box(.38, .88, .24, .08, 2.3, STONE); k.box(.4, .95, .2, .045, 1.2, STONE);
  bandstandColumns(k, false); bandstandColumns(k, true);
  // Bunting between the front columns.
  const fronts = STAGE_COLUMNS.filter(a => Math.cos(a - Math.PI / 4) > -.2).sort((a, b) => ring(a, 1, 0).x - ring(b, 1, 0).x);
  for (let j = 0; j + 1 < fronts.length; j++) {
    const a = ring(fronts[j]!, STAGE.radius, 19.5), b = ring(fronts[j + 1]!, STAGE.radius, 19.5);
    for (let f = 0; f < 5; f++) {
      const t0 = f / 5, t1 = (f + .5) / 5, sag = (t: number) => Math.sin(t * Math.PI) * 1.6, p = { x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 + sag(t0) }, q = { x: a.x + (b.x - a.x) * t1, y: a.y + (b.y - a.y) * t1 + sag(t1) };
      poly([p, q, { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 + 2 }], ["#e15b4f", "#f0c14b", "#4f8fc0", "#5aa469", "#f294b4"][(j * 5 + f) % 5]!);
    }
  }
  // Octagonal copper roof, lit from the left.
  const apex = iso(o.x, o.y, 32.5), facets = Array.from({ length: 8 }, (_, j) => ({ a0: j * TAU / 8 + Math.PI / 8, a1: (j + 1) * TAU / 8 + Math.PI / 8 })).sort((p, q) => Math.cos((p.a0 + p.a1) / 2 - Math.PI / 4) - Math.cos((q.a0 + q.a1) / 2 - Math.PI / 4));
  for (const { a0, a1 } of facets) { const mid = (a0 + a1) / 2, light = .5 + .5 * Math.cos(mid - Math.PI * .75); poly([apex, ring(a0, .47, 22), ring(a1, .47, 22)], snowy(mix("#7cbcaa", "#2f5f55", (1 - light) * .55), .55), "#a9d4c6", .3); }
  k.curve(Array.from({ length: 9 }, (_, j) => ring(-Math.PI / 4 + j * Math.PI / 8, .47, 22)), "#f4f1e8", 1);
  for (let j = 0; j < 5; j++) { const p = ring(-Math.PI / 8 + j * Math.PI / 5, .4, 20.8); oval(p, .8, .55, night ? "#fff3cf" : "#e9e4d6"); }
  oval({ x: apex.x, y: apex.y - .6 }, 1.4, 1.4, "#e6c178"); line({ x: apex.x, y: apex.y - 1.5 }, { x: apex.x, y: apex.y - 5.5 }, "#c9a24f", .5);
  poly([{ x: apex.x, y: apex.y - 5.5 }, { x: apex.x + 3, y: apex.y - 4.8 }, { x: apex.x, y: apex.y - 4.1 }], "#e15b4f");
  if (night && paintState.shopsOpen) { const g = lightGradient(k.c.createRadialGradient(at(.5, .5, 6).x, at(.5, .5, 6).y, 0, at(.5, .5, 6).x, at(.5, .5, 6).y, 16)); g.addColorStop(0, "#fff3cf66"); g.addColorStop(1, "#fff3cf00"); oval(at(.5, .5, 6), 16, 8, g); }
}

// ---- Landmarks -----------------------------------------------------------------------------------

/** A tapered round body: radius r0 at the bottom, r1 at the top. */
function frustum(k: Kit, r0: number, r1: number, z: number, h: number, colors: readonly string[]) {
  const p0 = k.at(.5, .5, z), p1 = k.at(.5, .5, z + h), rx0 = r0 * TILE_PX, ry0 = rx0 / 2, rx1 = r1 * TILE_PX, ry1 = rx1 / 2, c = k.c;
  c.beginPath(); c.moveTo(p1.x - rx1, p1.y); c.lineTo(p0.x - rx0, p0.y); c.ellipse(p0.x, p0.y, rx0, ry0, 0, Math.PI, 0, true); c.lineTo(p1.x + rx1, p1.y); c.ellipse(p1.x, p1.y, rx1, ry1, 0, 0, Math.PI, true); c.closePath();
  c.fillStyle = k.gradient({ x: p0.x - rx0, y: 0 }, { x: p0.x + rx0, y: 0 }, [[0, colors[0]!], [.4, colors[0]!], [1, colors[1]!]]); c.fill();
}
/** The windmill's sails turn in the plane across local v, around a hub in front of the cap. */
export const WINDMILL_HUB = { u: .5, v: .73, z: 31.5 } as const;
export function windmillSails(k: Kit, angle: number) {
  const { u, v, z } = WINDMILL_HUB;
  const P = (r: number, w: number, a: number) => k.at(u + (r * Math.cos(a) - w * Math.sin(a)) / TILE_PX, v, z + r * Math.sin(a) + w * Math.cos(a));
  for (let j = 0; j < 4; j++) {
    const a = angle + j * Math.PI / 2;
    k.poly([P(5, .4, a), P(27, .4, a), P(27, 5.6, a), P(5, 5.6, a)], "#f3ead6d0", "#7a5c40", .45);
    for (let t = 1; t < 6; t++) k.line(P(5 + t * 3.7, .4, a), P(5 + t * 3.7, 5.6, a), "#8a6b4a", .32);
    for (const w of [2.1, 3.9]) k.line(P(5, w, a), P(27, w, a), "#8a6b4a", .28);
    k.line(P(0, 0, a), P(28, 0, a), "#5b4636", 1.1);
  }
  const hub = P(0, 0, 0);
  k.oval(hub, 1.9, 1.9, "#4f3f33"); k.oval({ x: hub.x - .5, y: hub.y - .5 }, .6, .6, "#8a7058");
}
function windmill(k: Kit, night: boolean) {
  const { at, oval, line, poly, c } = k, o = k.world(.5, .5);
  const ring = (a: number, radius: number, z: number) => iso(o.x + Math.cos(a) * radius, o.y + Math.sin(a) * radius, z);
  k.disc(.5, .5, .42, 1.02, "#9fae86");
  // Flowers round the foot in spring and summer.
  if (!paintState.snow && (paintState.season === "spring" || paintState.season === "summer" || paintState.season === "default")) for (let j = 0; j < 28; j++) {
    const a = j * TAU / 28, p = ring(a, .38 + noise(j) * .03, 1.6);
    oval(p, .9, .7, (paintState.season === "summer" ? ["#f6c62f", "#e8604f", "#f39ac0"] : ["#e5463f", "#f5c53b", "#f294b4", "#fbf5ea"])[j % (paintState.season === "summer" ? 3 : 4)]!);
  }
  const gallery = (front: boolean) => {
    const a0 = front ? -Math.PI / 4 : Math.PI * .75, pts = Array.from({ length: 13 }, (_, j) => ring(a0 + j * Math.PI / 12, .36, 12));
    const inner = Array.from({ length: 13 }, (_, j) => ring(a0 + j * Math.PI / 12, .25, 12));
    poly([...pts, ...inner.reverse()], "#9b7553");
    k.curve(pts.map(p => ({ x: p.x, y: p.y + .9 })), "#6f523a", .9);
    if (front) { for (let j = 0; j <= 12; j += 2) line(pts[j]!, { x: pts[j]!.x, y: pts[j]!.y - 3.4 }, "#5b4636", .45); k.curve(pts.map(p => ({ x: p.x, y: p.y - 3.4 })), "#6f523a", .55); }
  };
  gallery(false);
  frustum(k, .29, .265, 1, 10.5, ["#bf6d55", "#8e4a3c"]);
  for (let z = 3; z < 11; z += 2.2) k.curve(Array.from({ length: 9 }, (_, j) => ring(-Math.PI / 4 + j * Math.PI / 8, .28, z)), "#a65a46", .3);
  frustum(k, .265, .175, 11.5, 22, ["#f3eee4", "#c8c0b0"]);
  for (let z = 14; z < 33; z += 3) k.curve(Array.from({ length: 9 }, (_, j) => ring(-Math.PI / 4 + j * Math.PI / 8, .265 - (z - 11.5) / 22 * .09, z)), "#ddd5c6", .3);
  // Door and windows face the sails.
  const face = (radius: number, z: number) => at(.5, .5 + radius, z);
  const door = face(.29, 1);
  poly([{ x: door.x - 1.8, y: door.y + .3 }, { x: door.x - 1.8, y: door.y - 4.6 }, { x: door.x, y: door.y - 6 }, { x: door.x + 1.8, y: door.y - 4.6 }, { x: door.x + 1.8, y: door.y + .3 }], "#5a3f2e");
  const lit = night ? "#ffe6a2" : "#4a6372";
  for (const [radius, z] of [[.24, 19.5], [.205, 27]] as const) { const w = face(radius, z); k.oval(w, 1.4, 1.8, "#f6f2ea"); k.oval(w, .95, 1.35, lit); k.line({ x: w.x, y: w.y - 1.3 }, { x: w.x, y: w.y + 1.3 }, "#f6f2ea", .3); }
  gallery(true);
  // Thatched cap.
  const cap = at(.5, .5, 33.5);
  c.beginPath(); c.ellipse(cap.x, cap.y, 8.6, 4.2, 0, 0, Math.PI); c.ellipse(cap.x, cap.y, 8.6, 7.4, 0, Math.PI, TAU); c.closePath();
  c.fillStyle = k.gradient({ x: cap.x - 8, y: 0 }, { x: cap.x + 8, y: 0 }, [[0, snowy("#8a745c", .6)], [.45, snowy("#7a654f", .6)], [1, "#55463a"]]); c.fill();
  for (let j = 0; j < 7; j++) line({ x: cap.x - 6 + j * 2, y: cap.y - 5.5 + Math.abs(j - 3) * .5 }, { x: cap.x - 6.4 + j * 2.1, y: cap.y + 2 }, "#6a5643", .3);
  if (!paintState.liveParts) windmillSails(k, .45);
}

/** The flower clock is a round bed sloping up towards the back; (a, b) are face coordinates in -1..1. */
export function flowerClockPoint(k: Kit, a: number, b: number, lift = 0) { return k.at(.5 + a * .4, .5 + b * .36, 6.4 - b * 5 + lift); }
export function flowerClockHands(k: Kit, minutes: number, seconds = false) {
  const tip = (angle: number, length: number) => flowerClockPoint(k, Math.sin(angle) * length, -Math.cos(angle) * length, .7), center = flowerClockPoint(k, 0, 0, .7);
  const hour = (minutes / 60 % 12) / 12 * TAU, minute = minutes % 60 / 60 * TAU;
  k.line({ x: center.x + .5, y: center.y + .5 }, { x: tip(hour, .5).x + .5, y: tip(hour, .5).y + .5 }, "#1e332a40", 1.6);
  k.line({ x: center.x + .5, y: center.y + .5 }, { x: tip(minute, .8).x + .5, y: tip(minute, .8).y + .5 }, "#1e332a40", 1.1);
  k.line(center, tip(hour, .5), "#2f4f3c", 1.7); k.line(center, tip(minute, .8), "#2f4f3c", 1.15);
  if (seconds) k.line(center, tip(minutes * TAU, .84), "#d9534f", .4);
  k.oval(center, 1.2, .8, "#e6c178");
}
const CLOCK_FLOWERS: Record<string, [string, string, string]> = {
  default: ["#e5463f", "#f5c53b", "#f294b4"], tulip: ["#e5463f", "#f5c53b", "#f294b4"], hydrangea: ["#7f9fd6", "#a68ad1", "#e3a3c3"],
  sunflower: ["#f29a2e", "#e04a3a", "#f6d33f"], cosmos: ["#f39ac0", "#fbf3f5", "#d1488a"], pansy: ["#7a5bb5", "#f1cc3f", "#f7f2ea"],
};
function flowerClock(k: Kit) {
  const { oval, poly } = k, outline = Array.from({ length: 48 }, (_, j) => { const t = j / 48 * TAU; return { a: Math.cos(t), b: Math.sin(t) }; });
  const face = outline.map(o => flowerClockPoint(k, o.a, o.b)), ground = outline.map(o => k.at(.5 + o.a * .4, .5 + o.b * .36, 1));
  // The sides of the sloping mound, then the face.
  for (let j = 0; j < 48; j++) {
    const n = (j + 1) % 48, mid = (outline[j]!.a + outline[n]!.a) / 2, midB = (outline[j]!.b + outline[n]!.b) / 2;
    if (k.depth(.5 + mid * .4, .5 + midB * .36) < k.depth(.5, .5) - .02) continue;
    poly([ground[j]!, ground[n]!, face[n]!, face[j]!], snowy(midB > .2 ? "#6f9a52" : "#5e8a46"));
  }
  poly(face, paintState.snow ? "#eef2f4" : "#7fae5c");
  const [c1, c2, c3] = CLOCK_FLOWERS[paintState.flora] ?? CLOCK_FLOWERS.default!;
  if (!paintState.snow) {
    for (let j = 0; j < 44; j++) { const t = j / 44 * TAU; oval(flowerClockPoint(k, Math.cos(t) * .9, Math.sin(t) * .9, .3), 1.1, .7, j % 2 ? c1 : c2); }
    for (let j = 0; j < 36; j++) { const t = j / 36 * TAU; oval(flowerClockPoint(k, Math.cos(t) * .79, Math.sin(t) * .79, .3), .5, .35, "#f8f6ee"); }
    for (let h = 0; h < 12; h++) { const t = h / 12 * TAU, big = h % 3 === 0; oval(flowerClockPoint(k, Math.sin(t) * .66, -Math.cos(t) * .66, .4), big ? 1.6 : .9, big ? 1 : .6, big ? "#fbf7ea" : "#f1ead2"); }
    for (let j = 0; j < 8; j++) { const t = j / 8 * TAU; oval(flowerClockPoint(k, Math.cos(t) * .28, Math.sin(t) * .28, .4), 1.7, 1, c3, t); }
    oval(flowerClockPoint(k, 0, 0, .4), 1.6, 1, c2);
  }
  k.curve([...face, face[0]!], "#d6d0bd", 1.4); k.curve([...face, face[0]!].map(p => ({ x: p.x, y: p.y + .8 })), "#9c977f", .5);
  if (!paintState.liveParts) flowerClockHands(k, 10 * 60 + 8);
}

/** Kasuga-style stone lantern; its fire box glows at night. */
function lantern(k: Kit, night: boolean) {
  const { at, poly, oval, box, c } = k, stone = ["#bdb9aa", "#8f8c80", "#d4d0c2"];
  footprint(k, .34, .34, .32, .32);
  box(.35, .35, .3, .3, 2, stone); box(.39, .39, .22, .22, 1.3, stone, 3);
  k.cylinder(.5, .5, .045, 8, stone, 4.3);
  box(.38, .38, .24, .24, 1.8, stone, 12.3);
  const sides = box(.42, .42, .16, .16, 5, ["#c6c2b3", "#97948a", "#d8d4c6"], 14.1);
  for (const { a, b } of sides) {
    const m = (t: number) => ({ u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t });
    const p = m(.25), q = m(.75);
    poly([at(p.u, p.v, 15.1), at(q.u, q.v, 15.1), at(q.u, q.v, 18.2), at(p.u, p.v, 18.2)], night ? "#ffcf7a" : "#3f3b33");
  }
  if (night) { const g = lightGradient(c.createRadialGradient(at(.5, .5, 16.6).x, at(.5, .5, 16.6).y, 0, at(.5, .5, 16.6).x, at(.5, .5, 16.6).y, 11)); g.addColorStop(0, "#ffcf7a70"); g.addColorStop(1, "#ffcf7a00"); oval(at(.5, .5, 16.6), 11, 8, g); }
  // A flared roof with curled corners and a jewel on top.
  const apex = at(.5, .5, 23.6), corners = [[.31, .31], [.69, .31], [.69, .69], [.31, .69]] as const;
  const faces = corners.map((p, j) => ({ p, q: corners[(j + 1) % 4]!, d: k.depth((p[0] + corners[(j + 1) % 4]![0]) / 2, (p[1] + corners[(j + 1) % 4]![1]) / 2) })).sort((x, y) => x.d - y.d);
  for (const { p, q } of faces) {
    const lit = Math.abs(k.world(p[0], p[1]).x - k.world(q[0], q[1]).x) < 1e-6;
    poly([at(p[0], p[1], 19.2), at(q[0], q[1], 19.2), apex], snowy(lit ? "#8c897e" : "#b1ad9f", .6));
  }
  for (const [u, v] of corners) { const p = at(u, v, 19.6); oval({ x: p.x, y: p.y - .7 }, .8, 1, "#a7a395"); }
  for (let j = 0; j < 6; j++) oval(at(.35 + noise(j) * .3, .35 + noise(j * 3) * .3, 20.5 + noise(j * 5) * 2), .7, .4, "#7f9c5c");
  oval({ x: apex.x, y: apex.y - 1.1 }, 1.4, 1.5, "#bdb9aa"); poly([{ x: apex.x - .6, y: apex.y - 2.2 }, { x: apex.x, y: apex.y - 4 }, { x: apex.x + .6, y: apex.y - 2.2 }], "#bdb9aa");
}

/** Flag on a tall pole. In spring it flies carp streamers (koinobori) instead. `wave` animates the cloth. */
export const FLAG_TOP = 44.5;
export function flagCloth(k: Kit, time: number, wind: number, windX: number, koinobori: boolean) {
  const top = k.at(.5, .5, FLAG_TOP - 1.5), dir = windX >= 0 ? 1 : -1, strength = Math.min(1, Math.max(.12, wind / 22)), c = k.c;
  // Spine of a streamer: points along its length, rising with the wind and rippling.
  const spine = (start: Point, length: number, phase: number) => Array.from({ length: 9 }, (_, i) => {
    const t = i / 8, droop = (1 - strength) * length * .9 * t * t;
    return { x: start.x + dir * length * t * (.35 + strength * .65), y: start.y + droop + Math.sin(time * (3 + strength * 4) - t * 5 + phase) * (.6 + strength * 1.4) * t };
  });
  const tube = (pts: Point[], thick: number, taper: number, fill: string, edge: string) => {
    const upper = pts.map((p, i) => ({ x: p.x, y: p.y - thick * (1 - taper * i / 8) })), lower = pts.map((p, i) => ({ x: p.x, y: p.y + thick * (1 - taper * i / 8) }));
    k.poly([...upper, ...lower.reverse()], fill, edge, .35);
  };
  if (!koinobori) {
    const pts = spine(top, 15, 0);
    tube(pts, 3.6, 0, "#3f8f5a", "#2f6e45");
    const mid = pts[4]!;
    for (let j = 0; j < 5; j++) { const a = j * TAU / 5 - Math.PI / 2; k.oval({ x: mid.x + Math.cos(a) * 1.15, y: mid.y + Math.sin(a) * 1.05 }, .75, .6, "#f6f1e6"); }
    k.oval(mid, .55, .5, "#f2c43c");
    return;
  }
  // Five-coloured streamer, then the black father carp, red mother carp and blue child.
  const streamer = spine(top, 16, 0);
  ["#3f6fb5", "#e04a3a", "#f2c43c", "#f6f1e6", "#3f9a5c"].forEach((color, j) => tube(streamer.map(p => ({ x: p.x, y: p.y - 2 + j * 1 })), .55, 0, color, color));
  for (const [z, length, body, belly, phase] of [[FLAG_TOP - 7, 15, "#2f3a46", "#e6c14e", 1], [FLAG_TOP - 13, 13, "#d9443a", "#f6d6c4", 2], [FLAG_TOP - 18.5, 11, "#3f7fc0", "#f6f1e6", 3]] as const) {
    const start = k.at(.5, .5, z), pts = spine(start, length, phase);
    tube(pts, 2.4, .55, body, mix(body, "#000000", .3));
    for (let i = 2; i < 7; i++) { const p = pts[i]!; c.beginPath(); c.arc(p.x, p.y - .2, 1, Math.PI * (dir > 0 ? .6 : .4), Math.PI * (dir > 0 ? 1.4 : 1.6) * 1); c.strokeStyle = k.n(belly); c.lineWidth = .35; c.stroke(); }
    const head = pts[0]!, eye = { x: head.x + dir * 1.6, y: head.y - .8 };
    k.oval({ x: head.x, y: head.y }, .9, 2.4, "#f6f1e6"); k.oval(eye, 1.1, 1.1, "#f6f1e6"); k.oval({ x: eye.x + dir * .2, y: eye.y }, .55, .55, "#1f2328");
    const tail = pts[8]!; k.poly([tail, { x: tail.x + dir * 2.2, y: tail.y - 1.8 }, { x: tail.x + dir * 1.4, y: tail.y }, { x: tail.x + dir * 2.2, y: tail.y + 1.8 }], body);
  }
}
function flagPole(k: Kit) {
  footprint(k, .4, .4, .2, .2);
  k.cylinder(.5, .5, .085, 1.4, STONE, 1);
  k.cylinder(.5, .5, .02, FLAG_TOP - 2.4, ["#f4f4ee", "#bdbdb5", "#ffffff"], 2.4);
  k.oval(k.at(.5, .5, FLAG_TOP), 1.4, 1.4, "#e8c25a"); k.oval({ x: k.at(.5, .5, FLAG_TOP).x - .4, y: k.at(.5, .5, FLAG_TOP).y - .4 }, .45, .45, "#fff3cf");
  if (!paintState.liveParts) flagCloth(k, 0, 14, 1, false);
}

// ---- Dispatcher ----------------------------------------------------------------------------------

export const PARK_ART: ReadonlySet<string> = new Set<ParkPart>(["seesaw", "springRider", "globe", "carousel", "jungleGym", "splashPad", "bars", "basketball", "maple", "ginkgo", "wisteria", "flowerField", "bamboo", "foodCart", "parasol", "drinkFountain", "bandstand", "windmill", "flowerClock", "lantern", "flagPole"]);
/** Height of each part for tapping it above its ground tile. */
export const PARK_ART_HEIGHT: Partial<Record<ParkPart, number>> = {
  seesaw: 9, springRider: 14, globe: 18, carousel: 36, jungleGym: 16, splashPad: 12, bars: 12, basketball: 25, maple: 27, ginkgo: 38, wisteria: 25,
  flowerField: 6, bamboo: 44, foodCart: 22, parasol: 26, drinkFountain: 12, bandstand: 33, windmill: 46, flowerClock: 12, lantern: 27, flagPole: 46,
};
/** Parts that sway in the wind like trees. */
export const PARK_ART_SWAY: ReadonlySet<string> = new Set(["maple", "ginkgo", "bamboo"]);
/** Parts with lights, painted lit in the night artwork. */
export const PARK_ART_LIGHTS: ReadonlySet<string> = new Set(["foodCart", "bandstand", "windmill", "lantern"]);
/** Colour variant of a part on a tile (food trucks and parasols differ from place to place). */
export function parkArtVariant(kind: ParkPart, tile: number) {
  const count = kind === "foodCart" ? 3 : kind === "parasol" ? 4 : kind === "springRider" ? 2 : 1;
  return count > 1 ? Math.floor(noise(tile * 1.37 + 3) * count) : 0;
}
/** Paint a new park part; returns false for parts drawn elsewhere. */
export function drawParkArt(c: CanvasRenderingContext2D, kind: string, x: number, y: number, rotation = 0, night = false, variant = 0): boolean {
  if (!PARK_ART.has(kind)) return false;
  const k = parkKit(c, x, y, rotation);
  switch (kind as ParkPart) {
    case "seesaw": seesaw(k); break;
    case "springRider": springRider(k, variant); break;
    case "globe": globe(k); break;
    case "carousel": carousel(k); break;
    case "jungleGym": jungleGym(k); break;
    case "splashPad": splashPad(k); break;
    case "bars": bars(k); break;
    case "basketball": basketball(k); break;
    case "maple": maple(k); break;
    case "ginkgo": ginkgo(k); break;
    case "wisteria": wisteria(k); break;
    case "flowerField": flowerField(k); break;
    case "bamboo": bamboo(k); break;
    case "foodCart": foodCart(k, night, variant); break;
    case "parasol": parasol(k, night, variant); break;
    case "drinkFountain": drinkFountain(k); break;
    case "bandstand": bandstand(k, night); break;
    case "windmill": windmill(k, night); break;
    case "flowerClock": flowerClock(k); break;
    case "lantern": lantern(k, night); break;
    case "flagPole": flagPole(k); break;
    default: return false;
  }
  return true;
}
