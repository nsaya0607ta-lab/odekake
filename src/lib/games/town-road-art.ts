import { lightGradient, paintState, shade, snowy } from "./town-paint";
import { parkKit, streetGinkgo, TILE_PX } from "./town-park-art";
import { BRIDGE_Z, type Facing, type RoadItem, type RoadLayout, type SignalHead } from "./town-road-parts";

/**
 * Artwork of the road parts: utility poles and their wires, traffic and walk signals, the bus stop, the footbridge,
 * street trees, curve mirrors, post boxes, vending machines, stop signs, guardrails, and the markings and paving on
 * the road. Static pieces are painted once into the sprite cache (lit variants at night use the light colours);
 * the signal lamps that change and the birds on the wires are painted every frame.
 */
type Point = { x: number; y: number };
type Item<K extends RoadItem["kind"]> = Extract<RoadItem, { kind: K }>;
const TAU = Math.PI * 2;
const iso = (x: number, y: number, z = 0): Point => ({ x: (x - y) * 32, y: (x + y) * 16 - z });
const noise = (i: number) => { const v = Math.sin(i * 71.3 + 19.7) * 42135.7; return v - Math.floor(v); };
const rotationOf = (f: Facing) => f.dy > 0 ? 0 : f.dx < 0 ? 1 : f.dy < 0 ? 2 : 3;
/** Does a face looking `f` way face the viewer (who looks from +x +y)? */
export const facesViewer = (f: Facing) => f.dx + f.dy > 0;
const CONCRETE = ["#c6c5ba", "#8f9089", "#dcdbd0"] as const;

function line(c: CanvasRenderingContext2D, a: Point, b: Point, color: string, width = .8) { c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.strokeStyle = color; c.lineWidth = width; c.stroke(); }
function poly(c: CanvasRenderingContext2D, ps: Point[], color: string | CanvasGradient) { c.beginPath(); ps.forEach((p, j) => j ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.fillStyle = color; c.fill(); }
function ellipse(c: CanvasRenderingContext2D, p: Point, rx: number, ry: number, color: string | CanvasGradient) { c.beginPath(); c.ellipse(p.x, p.y, Math.max(.01, rx), Math.max(.01, ry), 0, 0, TAU); c.fillStyle = color; c.fill(); }
/** A box standing on the ground, `length` along (dx, dy) and `width` across it, lit from the left. */
function orientedBox(c: CanvasRenderingContext2D, x: number, y: number, length: number, width: number, height: number, dx: number, dy: number, colors: readonly string[], z = 0) {
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({ x: x + dx * a! * length / 2 - dy * b! * width / 2, y: y + dy * a! * length / 2 + dx * b! * width / 2 }));
  const edges = corners.map((a, j) => ({ a, b: corners[(j + 1) % 4]!, depth: a.x + a.y + corners[(j + 1) % 4]!.x + corners[(j + 1) % 4]!.y })).sort((p, q) => p.depth - q.depth).slice(2);
  for (const { a, b } of edges) poly(c, [iso(a.x, a.y, z), iso(b.x, b.y, z), iso(b.x, b.y, z + height), iso(a.x, a.y, z + height)], colors[Math.abs(a.x - b.x) < 1e-6 ? 1 : 0]!);
  poly(c, corners.map(p => iso(p.x, p.y, z + height)), snowy(colors[2]!));
}
/** An upright post (a thin cylinder) from z0 to z1. */
function post(c: CanvasRenderingContext2D, x: number, y: number, radius: number, z0: number, z1: number, colors: readonly string[]) {
  const a = iso(x, y, z0), b = iso(x, y, z1), rx = radius * TILE_PX, ry = rx / 2;
  const g = c.createLinearGradient(a.x - rx, 0, a.x + rx, 0); g.addColorStop(0, colors[0]!); g.addColorStop(.5, colors[0]!); g.addColorStop(1, colors[1]!);
  c.beginPath(); c.moveTo(b.x - rx, b.y); c.lineTo(a.x - rx, a.y); c.ellipse(a.x, a.y, rx, ry, 0, Math.PI, 0, true); c.lineTo(b.x + rx, b.y); c.ellipse(b.x, b.y, rx, ry, 0, 0, Math.PI, true); c.closePath(); c.fillStyle = g; c.fill();
  ellipse(c, b, rx, ry, snowy(colors[2]!));
}
/** A flat shape standing upright, facing `f`: local (t across the face, h up) to screen, centred at a world point. */
function plate(x: number, y: number, z: number, f: Facing) {
  const n = Math.hypot(f.dx, f.dy) || 1, tx = -f.dy / n, ty = f.dx / n;
  return (t: number, h: number) => iso(x + tx * t, y + ty * t, z + h);
}
function shadow(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry = rx * .42) { const p = iso(x, y); ellipse(c, { x: p.x + rx * .35, y: p.y + .4 }, rx, ry, "#22382f26"); }

/** Concrete utility pole (電柱): striped guard at the foot, step bolts, cross-arms with insulators, sometimes a transformer and a small street light. */
export function utilityPole(c: CanvasRenderingContext2D, item: Item<"pole">, across: "x" | "y", toRoad: Facing, night: boolean) {
  const { x, y, seed } = item, ax = across === "x" ? 1 : 0, ay = across === "y" ? 1 : 0;
  shadow(c, x, y, 4.5);
  post(c, x, y, .032, 0, 40, CONCRETE);
  // The yellow and black guard round the foot.
  post(c, x, y, .036, .5, 8.5, ["#e8c63e", "#b7962b", "#f0d670"]);
  const foot = iso(x, y), rx = .036 * TILE_PX;
  for (let j = 0; j < 4; j++) line(c, { x: foot.x - rx, y: foot.y - 1.6 - j * 1.9 }, { x: foot.x + rx, y: foot.y - 2.9 - j * 1.9 }, "#2d2b26", .85);
  // Step bolts up the pole, and its number plate.
  for (let j = 0; j < 7; j++) { const p = iso(x, y, 15 + j * 2.6), side = j % 2 ? 1 : -1; line(c, { x: p.x + side * .9, y: p.y }, { x: p.x + side * 2.2, y: p.y - .2 }, "#5b5d58", .55); }
  const tag = iso(x, y, 12); poly(c, [{ x: tag.x - 1, y: tag.y }, { x: tag.x + 1.2, y: tag.y - .3 }, { x: tag.x + 1.2, y: tag.y - 2.4 }, { x: tag.x - 1, y: tag.y - 2.1 }], "#e9efe9"); line(c, { x: tag.x - .6, y: tag.y - 1.1 }, { x: tag.x + .8, y: tag.y - 1.3 }, "#3f6f9a", .4);
  // Cross-arms across the road with porcelain insulators.
  for (const [z, reach, count] of [[37.5, .13, 3], [33, .1, 2]] as const) {
    line(c, iso(x - ax * reach, y - ay * reach, z), iso(x + ax * reach, y + ay * reach, z), "#6d6f6a", 1.25);
    for (let j = 0; j < count; j++) { const t = -reach * .8 + j * reach * 1.6 / (count - 1), p = iso(x + ax * t, y + ay * t, z + 1.2); ellipse(c, p, .8, 1.1, "#e9ebe2"); ellipse(c, { x: p.x, y: p.y + .5 }, .9, .35, "#a9aca0"); }
  }
  if (seed % 3 === 0) {
    // A pole transformer on its bracket.
    const t = { x: x + ax * .045 + .02, y: y + ay * .045 + .02 };
    line(c, iso(x, y, 27), iso(t.x, t.y, 27), "#6d6f6a", .9);
    post(c, t.x, t.y, .03, 22, 29, ["#9aa39f", "#6e7773", "#bfc6c1"]);
    for (const h of [24, 26.5]) line(c, iso(t.x - .02, t.y + .02, h), iso(t.x + .02, t.y - .02, h), "#7f8884", .45);
  }
  if (seed % 2 === 1) {
    // A small street light on an arm over the sidewalk.
    const end = { x: x + toRoad.dx * .1, y: y + toRoad.dy * .1 }, p = iso(end.x, end.y, 24.5);
    line(c, iso(x, y, 25.5), p, "#6d6f6a", .9);
    ellipse(c, { x: p.x, y: p.y + .6 }, 1.8, .9, night ? "#fff3cf" : "#dfe6dc");
    if (night) { const g = lightGradient(c.createRadialGradient(p.x, p.y + 1, 0, p.x, p.y + 1, 10)); g.addColorStop(0, "#fff3cf55"); g.addColorStop(1, "#fff3cf00"); ellipse(c, { x: p.x, y: p.y + 3 }, 10, 7, g); }
  }
}
/** The points the wires hang from on a pole (power on the top arm, telephone cable lower down). */
function wirePoints(x: number, y: number, across: "x" | "y") {
  const ax = across === "x" ? 1 : 0, ay = across === "y" ? 1 : 0;
  return [-.104, 0, .104].map(t => ({ x: x + ax * t, y: y + ay * t, z: 38.7 })).concat([{ x, y, z: 22.5 }]);
}
/** Wires sagging between two poles. */
export function poleWires(c: CanvasRenderingContext2D, from: Point, to: Point, across: "x" | "y", acrossTo: "x" | "y") {
  const a = wirePoints(from.x, from.y, across), b = wirePoints(to.x, to.y, acrossTo);
  a.forEach((p, j) => {
    const q = b[j]!, sag = j === 3 ? 2.6 : 3.4, pa = iso(p.x, p.y, p.z), pb = iso(q.x, q.y, q.z), mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 + sag * 2 };
    c.beginPath(); c.moveTo(pa.x, pa.y); c.quadraticCurveTo(mid.x, mid.y, pb.x, pb.y); c.strokeStyle = j === 3 ? "#2c302d" : "#3f4440"; c.lineWidth = j === 3 ? .7 : .42; c.stroke();
  });
}
/** Where a bird can sit on a wire: `t` along it (0..1) and which wire. */
export function wirePoint(from: Point, to: Point, across: "x" | "y", acrossTo: "x" | "y", wire: number, t: number) {
  const p = wirePoints(from.x, from.y, across)[wire]!, q = wirePoints(to.x, to.y, acrossTo)[wire]!, sag = wire === 3 ? 2.6 : 3.4;
  const pa = iso(p.x, p.y, p.z), pb = iso(q.x, q.y, q.z);
  // The quadratic sag: the control point is twice as low as the middle of the curve.
  const ctl = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 + sag * 2 };
  return { x: (1 - t) ** 2 * pa.x + 2 * t * (1 - t) * ctl.x + t * t * pb.x, y: (1 - t) ** 2 * pa.y + 2 * t * (1 - t) * ctl.y + t * t * pb.y, depth: p.x + p.y + (q.x + q.y - p.x - p.y) * t };
}
/** A small bird on a wire (or flying off and back): sparrows by day. */
export function wireBird(c: CanvasRenderingContext2D, p: Point, facing: number, flap: number, night: number, color = "#6f5a46") {
  const n = (col: string) => shade(col, night);
  if (flap > 0) {
    const w = Math.sin(flap * 18) * 2.2;
    line(c, { x: p.x, y: p.y }, { x: p.x - 2.4, y: p.y - 1 - w }, n(color), .8); line(c, { x: p.x, y: p.y }, { x: p.x + 2.4, y: p.y - 1 - w }, n(color), .8);
    ellipse(c, p, 1.3, .8, n(color)); return;
  }
  ellipse(c, { x: p.x, y: p.y - 1.2 }, 1.25, 1, n(color));
  ellipse(c, { x: p.x + facing * .9, y: p.y - 2 }, .7, .65, n("#5b4a3a"));
  ellipse(c, { x: p.x + facing * .5, y: p.y - .8 }, .6, .4, n("#d9cbb1"));
  line(c, { x: p.x - facing * 1, y: p.y - 1 }, { x: p.x - facing * 2.1, y: p.y - .4 }, n("#5b4a3a"), .6);
}

/** A traffic signal post: a pole, arms over the road with three-lamp heads, and small walk signals on the pole. */
export function signalPost(c: CanvasRenderingContext2D, item: Item<"signal">) {
  const { x, y } = item;
  shadow(c, x, y, 3.6);
  orientedBox(c, x, y, .06, .06, 2, 1, 0, CONCRETE);
  post(c, x, y, .022, 0, 27.5, ["#a9b3ae", "#737d78", "#c8d0cb"]);
  for (const arm of item.arms) {
    const top = iso(x, y, 26.6), end = iso(arm.to.x, arm.to.y, 26.6), brace = iso(x, y, 22.5);
    line(c, top, end, "#79837e", 1.35); line(c, brace, { x: (top.x + end.x) / 2, y: (top.y + end.y) / 2 }, "#79837e", .6);
    signalHead(c, arm.head);
  }
  for (const walk of item.walks) walkHead(c, walk);
}
/** Along the head from the driver's left (green) to the right (red). */
function headAxis(head: SignalHead) { return { lx: head.facing.dy, ly: -head.facing.dx }; }
export function signalLens(head: SignalHead, lamp: 0 | 1 | 2) {
  const { lx, ly } = headAxis(head), t = (lamp - 1) * .052;
  return iso(head.x + lx * t + head.facing.dx * .026, head.y + ly * t + head.facing.dy * .026, head.z + 1.6);
}
function signalHead(c: CanvasRenderingContext2D, head: SignalHead) {
  const { lx, ly } = headAxis(head);
  orientedBox(c, head.x, head.y, .17, .045, 3.4, lx, ly, ["#4b524f", "#353b39", "#5f6764"], head.z);
  if (!facesViewer(head.facing)) return;
  for (const lamp of [0, 1, 2] as const) {
    const p = signalLens(head, lamp);
    ellipse(c, p, 1.15, 1.15, ["#21352f", "#3d3a24", "#3d2522"][lamp]!);
    c.beginPath(); c.ellipse(p.x, p.y - .2, 1.35, 1.2, 0, Math.PI * 1.05, Math.PI * 1.95); c.strokeStyle = "#2a2f2d"; c.lineWidth = .55; c.stroke();
  }
}
export function walkLens(head: SignalHead, go: boolean) { return iso(head.x + head.facing.dx * .026, head.y + head.facing.dy * .026, head.z + (go ? 1.3 : 3.9)); }
function walkHead(c: CanvasRenderingContext2D, head: SignalHead) {
  const { lx, ly } = headAxis(head);
  orientedBox(c, head.x + head.facing.dx * .01, head.y + head.facing.dy * .01, .042, .03, 5.4, lx, ly, ["#4b524f", "#353b39", "#5f6764"], head.z);
  if (!facesViewer(head.facing)) return;
  for (const go of [false, true]) { const p = walkLens(head, go); poly(c, [{ x: p.x - 1, y: p.y - 1 }, { x: p.x + 1, y: p.y - 1.3 }, { x: p.x + 1, y: p.y + 1 }, { x: p.x - 1, y: p.y + 1.3 }], go ? "#1f3430" : "#3a2422"); }
}
/** Light the lamp the signal shows now: 0 green (blue-green, 青), 1 yellow, 2 red. */
export function signalLight(c: CanvasRenderingContext2D, head: SignalHead, lamp: 0 | 1 | 2, night: number) {
  if (!facesViewer(head.facing)) return;
  const p = signalLens(head, lamp), color = ["#3fe0b5", "#ffc93c", "#ff4b3a"][lamp]!;
  c.save(); c.globalCompositeOperation = "lighter";
  const r = 3.5 + night * 4, glow = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
  glow.addColorStop(0, color + "88"); glow.addColorStop(1, color + "00"); c.fillStyle = glow; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill(); c.restore();
  ellipse(c, p, 1.1, 1.1, color); ellipse(c, { x: p.x - .3, y: p.y - .35 }, .4, .35, "#ffffffaa");
}
/** The walk signal: a red standing figure, or a blue-green walking figure (blinking near the end). */
export function walkLight(c: CanvasRenderingContext2D, head: SignalHead, go: boolean, night: number) {
  if (!facesViewer(head.facing)) return;
  const p = walkLens(head, go), color = go ? "#3fe0b5" : "#ff4b3a";
  c.save(); c.globalCompositeOperation = "lighter";
  const glow = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 2.5 + night * 3); glow.addColorStop(0, color + "77"); glow.addColorStop(1, color + "00");
  c.fillStyle = glow; c.beginPath(); c.arc(p.x, p.y, 2.5 + night * 3, 0, TAU); c.fill(); c.restore();
  ellipse(c, { x: p.x, y: p.y - .65 }, .3, .3, color);
  line(c, { x: p.x, y: p.y - .35 }, { x: p.x, y: p.y + .35 }, color, .5);
  if (go) { line(c, { x: p.x, y: p.y + .3 }, { x: p.x - .45, y: p.y + .9 }, color, .4); line(c, { x: p.x, y: p.y + .3 }, { x: p.x + .45, y: p.y + .9 }, color, .4); }
  else line(c, { x: p.x - .25, y: p.y + .35 }, { x: p.x + .25, y: p.y + .35 }, color, .4);
}

/** A bus shelter: a translucent roof on four posts, a glass back with a bench, and a lit advertising panel at one end. */
export function busShelter(c: CanvasRenderingContext2D, item: Item<"busShelter">, night: boolean) {
  const k = parkKit(c, item.x - .5, item.y - .5, rotationOf(item.facing));
  const { at, box, poly: kpoly, line: kline } = k, u0 = .31, u1 = .69, back = .435, front = .575;
  shadow(c, item.x, item.y, 12, 4.5);
  box(u0 - .01, back - .015, u1 - u0 + .02, front - back + .03, .6, ["#cfcdc0", "#a9a89c", "#dedcd0"], 0);
  const pillar = (u: number, v: number) => box(u - .009, v - .009, .018, .018, 15, ["#7c8a86", "#56625f", "#9eaaa6"], .6);
  const glass = night ? "#c9e6c344" : "#d4e8ea66";
  const pieces: { u: number; v: number; paint: () => void }[] = [
    { u: u0, v: back, paint: () => pillar(u0, back) }, { u: u1, v: back, paint: () => pillar(u1, back) },
    { u: .5, v: back + .001, paint: () => {
      kpoly([at(u0, back, 2), at(u1, back, 2), at(u1, back, 13.5), at(u0, back, 13.5)], glass);
      kline(at(u0, back, 13.5), at(u1, back, 13.5), "#7c8a86", .5); kline(at(u0, back, 2), at(u1, back, 2), "#7c8a86", .5);
      for (const u of [.44, .56]) kline(at(u, back, 2), at(u, back, 13.5), "#93a29d", .35);
    } },
    { u: .5, v: back + .03, paint: () => {
      // The bench along the back.
      box(.36, back + .012, .28, .055, 1, ["#b28a62", "#8a6a4b", "#d5ae84"], 4.2);
      for (const u of [.38, .62]) box(u - .006, back + .02, .012, .04, 4.2, ["#6c7a76", "#4d5956", "#8a9893"], .6);
      for (let j = 0; j < 3; j++) kline(at(.36, back + .02 + j * .016, 5.25), at(.64, back + .02 + j * .016, 5.25), "#8f6b48", .35);
    } },
    { u: u0 + .004, v: .5, paint: () => {
      // The advertising panel across one end, lit from inside after dark.
      const face = [at(u0 + .004, back + .01, 2.2), at(u0 + .004, front - .025, 2.2), at(u0 + .004, front - .025, 13), at(u0 + .004, back + .01, 13)];
      kpoly(face, "#5a6763");
      const inner = [at(u0 + .006, back + .025, 3), at(u0 + .006, front - .04, 3), at(u0 + .006, front - .04, 12.2), at(u0 + .006, back + .025, 12.2)];
      kpoly(inner, night ? "#ffefc4" : "#e9d6a8");
      if (!night) { kpoly([at(u0 + .007, back + .03, 7.5), at(u0 + .007, front - .045, 7.5), at(u0 + .007, front - .045, 11.6), at(u0 + .007, back + .03, 11.6)], "#d9735d"); kline(at(u0 + .007, back + .04, 5), at(u0 + .007, front - .055, 5), "#5d7f7a", .6); }
    } },
    { u: u0, v: front, paint: () => pillar(u0, front) }, { u: u1, v: front, paint: () => pillar(u1, front) },
  ];
  k.assemble(pieces);
  // The roof: a thin slab of frosted panels.
  const roof = [at(u0 - .03, back - .03, 15.6), at(u1 + .03, back - .03, 15.6), at(u1 + .03, front + .035, 15.6), at(u0 - .03, front + .035, 15.6)];
  kpoly([roof[3]!, roof[2]!, { x: roof[2]!.x, y: roof[2]!.y + 1.2 }, { x: roof[3]!.x, y: roof[3]!.y + 1.2 }], "#6f7d79");
  kpoly(roof, paintState.snow ? "#eef2f4" : "#dbe9ea");
  for (let j = 1; j < 4; j++) { const u = u0 - .03 + (u1 - u0 + .06) * j / 4; kline(at(u, back - .03, 15.7), at(u, front + .035, 15.7), "#b5c8c9", .4); }
  if (night) { const p = at(.5, .5, 14.5), g = lightGradient(c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 16)); g.addColorStop(0, "#fff3cf44"); g.addColorStop(1, "#fff3cf00"); ellipse(c, { x: p.x, y: p.y + 8 }, 16, 8, g); }
}
/** The bus stop sign: a round plate on a pole with the timetable box. */
export function busSign(c: CanvasRenderingContext2D, item: Item<"busSign">) {
  const { x, y } = item, face = plate(x, y, 0, item.facing);
  shadow(c, x, y, 3);
  ellipse(c, iso(x, y, .4), 2.4, 1.1, "#a7a69b"); ellipse(c, iso(x, y, 1.1), 2.1, .95, "#c9c8bc");
  post(c, x, y, .012, 1, 13.5, ["#e7e9e3", "#a8aea8", "#f2f4ee"]);
  // Timetable box.
  poly(c, [face(-.028, 5.6), face(.028, 5.6), face(.028, 9.6), face(-.028, 9.6)], "#f3f2ea"); line(c, face(-.028, 9.6), face(.028, 9.6), "#5f8e7e", .7);
  for (let j = 0; j < 3; j++) line(c, face(-.019, 6.4 + j * 1), face(.019, 6.4 + j * 1), "#9aa59f", .3);
  // The round plate faces along the road.
  const center = iso(x, y, 15.2);
  ellipse(c, center, 3.3, 3.3, "#2f8a66"); ellipse(c, center, 2.5, 2.5, "#f6f6ee");
  poly(c, [{ x: center.x - 1.5, y: center.y - .4 }, { x: center.x + 1.5, y: center.y - .4 }, { x: center.x + 1.5, y: center.y + 1 }, { x: center.x - 1.5, y: center.y + 1 }], "#2f8a66");
  line(c, { x: center.x - 1.1, y: center.y - .1 }, { x: center.x + 1.1, y: center.y - .1 }, "#f6f6ee", .45);
}

/** The footbridge (歩道橋): a painted steel deck across the road on four columns, with a stair down each side along the sidewalk. */
export function footbridge(c: CanvasRenderingContext2D, l: RoadLayout, piece: "loStair" | "deckLo" | "deckHi" | "hiStair" | "rail", night: boolean) {
  const { x, y, axis } = l, Z = BRIDGE_Z;
  // a: along the road, d: across it from the low side (0) to the high side (1).
  const at = (a: number, d: number, z = 0) => axis === "x" ? iso(x + a, y + d, z) : iso(x + d, y + a, z);
  const quad = (p: Point[], color: string) => poly(c, p, color);
  const girder = ["#4f8ea3", "#386d80", "#7db2c1"] as const, panel = night ? "#7f9fa3" : "#dbe6e2", deck = paintState.snow ? "#eef1f3" : "#a77f68";
  const column = (a: number, d: number, z1: number) => {
    const p = axis === "x" ? { x: x + a, y: y + d } : { x: x + d, y: y + a };
    orientedBox(c, p.x, p.y, .035, .035, z1, 1, 0, girder);
  };
  // A stair from the deck end (a0, at full height) down to the sidewalk at a1, across d0..d1.
  const stair = (a0: number, a1: number, d0: number, d1: number) => {
    const span = a1 - a0, steps = 9;
    // A stringer with its handrail along one side of the stair.
    const side = (d: number) => {
      quad([at(a0, d, Z), at(a1, d, 0), at(a1, d, -1.4), at(a0, d, Z - 1.4)], girder[0]);
      line(c, at(a0, d, Z + 4.6), at(a1, d, 4.6), "#e8efec", .8);
      for (let j = 0; j <= 4; j++) { const t = j / 4; line(c, at(a0 + span * t, d, Z * (1 - t)), at(a0 + span * t, d, Z * (1 - t) + 4.6), "#c3d2cf", .45); }
    };
    column(a0 + span * .5, (d0 + d1) / 2, Z / 2);
    side(d0);
    // Steps from the far end to the near end, so each tread covers the one behind it.
    const order = Array.from({ length: steps }, (_, j) => j);
    for (const j of span < 0 ? order.reverse() : order) {
      const t0 = j / steps, t1 = (j + 1) / steps, z0 = Z * (1 - t0), z1 = Z * (1 - t1);
      quad([at(a0 + span * t0, d0, z1 + .01), at(a0 + span * t0, d1, z1 + .01), at(a0 + span * t1, d1, z1), at(a0 + span * t1, d0, z1)], deck);
      if (span > 0) quad([at(a0 + span * t0, d0, z0), at(a0 + span * t0, d1, z0), at(a0 + span * t0, d1, z1), at(a0 + span * t0, d0, z1)], "#8d6b58");
    }
    side(d1);
  };
  const dLo = .06, dHi = .94, a0 = .43, a1 = .57;
  if (piece === "loStair") { stair(.44, .1, .04, .16); return; }
  if (piece === "hiStair") { stair(.56, .9, .84, .96); return; }
  const half = piece === "deckLo" ? [dLo, .5] as const : [.5, dHi] as const;
  if (piece === "deckLo" || piece === "deckHi") {
    for (const a of [.45, .55]) column(a, piece === "deckLo" ? .1 : .9, Z - 3);
    // Girder sides and the walking surface.
    quad([at(a1, half[0], Z - 3.2), at(a1, half[1], Z - 3.2), at(a1, half[1], Z), at(a1, half[0], Z)], girder[0]);
    if (piece === "deckHi") quad([at(a0, dHi, Z - 3.2), at(a1, dHi, Z - 3.2), at(a1, dHi, Z), at(a0, dHi, Z)], girder[1]);
    quad([at(a0, half[0], Z), at(a1, half[0], Z), at(a1, half[1], Z), at(a0, half[1], Z)], deck);
    for (let j = 1; j < 6; j++) { const d = half[0] + (half[1] - half[0]) * j / 6; line(c, at(a0, d, Z + .05), at(a1, d, Z + .05), "#93705b", .3); }
    // The back panel (the front one is drawn after the people on the deck).
    quad([at(a0, half[0], Z), at(a0, half[1], Z), at(a0, half[1], Z + 4.2), at(a0, half[0], Z + 4.2)], panel);
    line(c, at(a0, half[0], Z + 4.6), at(a0, half[1], Z + 4.6), "#e8efec", .9);
    if (piece === "deckHi") {
      // Name plate on the side that faces the road.
      const p = [at(a1 + .002, .44, Z - 2.7), at(a1 + .002, .56, Z - 2.7), at(a1 + .002, .56, Z - .5), at(a1 + .002, .44, Z - .5)];
      quad(p, "#f2f3ec"); line(c, at(a1 + .003, .47, Z - 1.6), at(a1 + .003, .53, Z - 1.6), "#386d80", .5);
    }
    return;
  }
  // The front panel along the whole deck, with lamps at the stair heads.
  quad([at(a1, dLo, Z), at(a1, dHi, Z), at(a1, dHi, Z + 4.2), at(a1, dLo, Z + 4.2)], night ? "#8aa9ad" : "#e6efec");
  for (let j = 1; j < 8; j++) { const d = dLo + (dHi - dLo) * j / 8; line(c, at(a1, d, Z + .5), at(a1, d, Z + 3.9), "#b9cbc8", .35); }
  line(c, at(a1, dLo, Z + 4.6), at(a1, dHi, Z + 4.6), "#f4f8f6", 1);
  if (night) for (const d of [dLo + .02, dHi - .02]) {
    const p = at(a1, d, Z + 5.6); ellipse(c, p, 1.2, .9, "#fff3cf");
    const g = lightGradient(c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 9)); g.addColorStop(0, "#fff3cf55"); g.addColorStop(1, "#fff3cf00"); ellipse(c, { x: p.x, y: p.y + 2 }, 9, 6, g);
  }
}

/** A curve mirror (カーブミラー): an orange pole with two round convex mirrors looking into the bend. */
export function curveMirror(c: CanvasRenderingContext2D, item: Item<"mirror">) {
  const { x, y } = item;
  shadow(c, x, y, 2.6);
  post(c, x, y, .014, 0, 16, ["#ee7a45", "#b8522a", "#f59c6c"]);
  // The far mirror first, so the near one overlaps it.
  const faces = item.faces.map(f => { const n = Math.hypot(f.dx, f.dy) || 1; return { dx: f.dx / n, dy: f.dy / n }; }).sort((a, b) => (a.dx + a.dy) - (b.dx + b.dy));
  for (const f of faces) {
    const center = iso(x + f.dx * .035, y + f.dy * .035, 15.5), r = .062;
    line(c, iso(x, y, 15.5), center, "#b8522a", .8);
    // A vertical disc: its horizontal axis runs across the facing, its vertical axis straight up.
    const t = iso(-f.dy * r, f.dx * r), e2 = { x: 0, y: -r * TILE_PX };
    const disc = (scale: number, color: string | CanvasGradient) => {
      c.save(); c.translate(center.x, center.y); c.transform(t.x * scale, t.y * scale, e2.x * scale, e2.y * scale, 0, 0);
      c.beginPath(); c.arc(0, 0, 1, 0, TAU); c.fillStyle = color; c.fill(); c.restore();
    };
    disc(1.15, "#e8642f");
    if (f.dx + f.dy > .05) {
      const g = c.createLinearGradient(center.x, center.y - 3, center.x, center.y + 3); g.addColorStop(0, "#e2f0f4"); g.addColorStop(.55, "#a9cbd6"); g.addColorStop(1, "#8fae99");
      disc(.9, g);
      line(c, { x: center.x - 1.1, y: center.y - 1.1 }, { x: center.x - .1, y: center.y - 1.8 }, "#ffffffcc", .5);
    } else disc(.9, "#8c9590");
  }
  if (paintState.snow) ellipse(c, iso(x, y, 19), 2.2, .8, "#f3f6f9");
}

/** The round red post box of Japan, with a white postal mark and the collection-time plate. */
export function postBox(c: CanvasRenderingContext2D, item: Item<"postbox">) {
  const { x, y, facing } = item;
  shadow(c, x, y, 3.4);
  ellipse(c, iso(x, y, .3), 2.3, 1.05, "#8a8b82");
  post(c, x, y, .04, .5, 7.4, ["#dd4a3e", "#a22a23", "#e86a5c"]);
  const top = iso(x, y, 8);
  ellipse(c, top, .045 * TILE_PX, .045 * TILE_PX / 2, "#c8392f"); ellipse(c, { x: top.x, y: top.y - .7 }, .034 * TILE_PX, .03 * TILE_PX / 2 + .5, "#e0574b");
  if (!facesViewer(facing)) return;
  const face = plate(x + facing.dx * .039, y + facing.dy * .039, 0, facing);
  line(c, face(-.019, 6.2), face(.019, 6.2), "#3b1612", .8);
  // 〒 in white strokes, and the plate below it.
  line(c, face(-.013, 4.6), face(.013, 4.6), "#f6efe6", .4); line(c, face(-.013, 4.05), face(.013, 4.05), "#f6efe6", .4); line(c, face(0, 4.05), face(0, 2.9), "#f6efe6", .4);
  poly(c, [face(-.015, 1.2), face(.015, 1.2), face(.015, 2.3), face(-.015, 2.3)], "#f2efe4");
}

/** A drinks vending machine against the sidewalk, its front lit after dark. */
export function vendingMachine(c: CanvasRenderingContext2D, item: Item<"vending">, seed: number, night: boolean) {
  const { x, y, facing } = item, body = [["#d0473e", "#a2332c", "#e2675d"], ["#3f78b5", "#2c5786", "#6596cb"], ["#e9ecec", "#b5bcbd", "#f7f9f9"], ["#3e9a6a", "#2c7450", "#62b388"]][seed % 4]!;
  shadow(c, x, y, 5.5);
  const back = { x: x - facing.dx * .015, y: y - facing.dy * .015 };
  orientedBox(c, back.x, back.y, .09, .13, 10.5, facing.dx || 0, facing.dy || 0, body, 0);
  if (!facesViewer(facing)) return;
  const face = plate(x + facing.dx * .031, y + facing.dy * .031, 0, facing);
  poly(c, [face(-.055, 5.2), face(.055, 5.2), face(.055, 9.4), face(-.055, 9.4)], night ? "#c9e6c3" : "#cfe2e4");
  for (let row = 0; row < 3; row++) for (let j = 0; j < 4; j++) {
    const t = -.039 + j * .026, h = 5.7 + row * 1.25, color = ["#e5be7c", "#d98b85", "#8fb3cf", "#dbe4bf", "#e88f6a"][(j + row * 2 + seed) % 5]!;
    poly(c, [face(t - .007, h), face(t + .007, h), face(t + .007, h + .8), face(t - .007, h + .8)], color);
  }
  poly(c, [face(-.042, 1.3), face(.042, 1.3), face(.042, 2.7), face(-.042, 2.7)], "#2b302e");
  for (let j = 0; j < 2; j++) ellipse(c, face(.044, 3.6 + j * .8), .3, .3, "#e2dcb5");
  if (night) { const p = face(0, 7.3), g = lightGradient(c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 12)); g.addColorStop(0, "#fff3cf55"); g.addColorStop(1, "#fff3cf00"); ellipse(c, { x: p.x, y: p.y + 6 }, 12, 8, g); }
}

/** The stop sign (一時停止): a red inverted triangle with a white border on a short pole. */
export function stopSign(c: CanvasRenderingContext2D, item: Item<"stopSign">) {
  const { x, y, facing } = item, face = plate(x, y, 11.6, facing);
  shadow(c, x, y, 2.4);
  post(c, x, y, .011, 0, 12.6, ["#dfe3df", "#9aa19c", "#eef1ee"]);
  const shape = [face(-.075, 0), face(.075, 0), face(0, -6.4)];
  if (!facesViewer(facing)) { poly(c, shape, "#9aa19c"); return; }
  poly(c, shape, "#f5f2ea");
  const inner = [face(-.058, -.65), face(.058, -.65), face(0, -5.5)];
  poly(c, inner, "#d6342c");
}

/** Guardrail (ガードパイプ): white pipes on posts along a curb run. */
export function guardrail(c: CanvasRenderingContext2D, from: Point, to: Point) {
  const length = Math.hypot(to.x - from.x, to.y - from.y), posts = Math.max(1, Math.round(length / .11));
  const at = (t: number, z: number) => iso(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, z);
  line(c, at(0, 0), at(1, 0), "#22382f22", 1.6);
  for (let j = 0; j <= posts; j++) { const t = j / posts; line(c, at(t, 0), at(t, 4.9), "#c9cdc5", 1); line(c, at(t, .2), at(t, 4.7), "#f2f3ee", .45); }
  for (const z of [2.6, 4.6]) { line(c, at(0, z - .35), at(1, z - .35), "#9ea69d", .9); line(c, at(0, z), at(1, z), "#f4f5f0", .85); }
  if (paintState.snow) line(c, at(0, 5.1), at(1, 5.1), "#f3f6f9", .9);
}

/** Street tree: a ginkgo in its grate, a little smaller than a park tree. */
export function streetTree(c: CanvasRenderingContext2D, item: Item<"tree">) {
  const p = iso(item.x, item.y);
  c.save(); c.translate(p.x, p.y); c.scale(.64, .64); c.translate(-p.x, -p.y);
  streetGinkgo(c, item.x, item.y);
  c.restore();
}

/** Stone setts in running bond over the carriageway (石畳), with a darker joint between each stone. */
export function roadPaving(c: CanvasRenderingContext2D, l: Pick<RoadLayout, "x" | "y">, surface: Point[], lift: (p: Point, z: number) => Point) {
  const { x, y } = l, ground = surface.map(p => lift(p, .2));
  c.save(); c.beginPath(); ground.forEach((p, j) => j ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.fillStyle = paintState.snow ? "#d9dcd8" : "#a99f8e"; c.fill(); c.clip();
  for (let row = 0; row < 14; row++) {
    const v = row / 14 + .5 / 14;
    line(c, lift({ x: 0, y: row / 14 }, .25), lift({ x: 1, y: row / 14 }, .25), "#7f7666", .45);
    for (let j = 0; j < 9; j++) {
      // Some stones a shade lighter or darker than the rest.
      const u = (j + (row % 2) * .5) / 8.5, tone = noise(row * 13 + j + x * 7 + y * 3);
      line(c, lift({ x: u, y: row / 14 }, .25), lift({ x: u, y: (row + 1) / 14 }, .25), "#7f7666", .4);
      if (tone > .7) poly(c, [lift({ x: u + .01, y: v - .025 }, .26), lift({ x: u + .1, y: v - .025 }, .26), lift({ x: u + .1, y: v + .025 }, .26), lift({ x: u + .01, y: v + .025 }, .26)], tone > .85 ? "#bdb3a1" : "#968c7b");
    }
  }
  c.restore();
}
/** Markings painted on the road: zebra crossings and stop lines. Points are tile-local. */
export function roadMarkings(c: CanvasRenderingContext2D, l: RoadLayout, lift: (p: Point, z: number) => Point) {
  const { axis } = l, paint = paintState.snow ? "#f4f6f4" : "#ecebdf";
  if (l.crosswalk) {
    // Bars along the road, a gap between each, from curb to curb.
    for (let j = 0; j < 6; j++) {
      const d0 = .26 + j * .082, d1 = d0 + .046, a0 = .38, a1 = .62;
      const q = (a: number, d: number) => axis === "x" ? lift({ x: a, y: d }, .3) : lift({ x: d, y: a }, .3);
      poly(c, [q(a0, d0), q(a1, d0), q(a1, d1), q(a0, d1)], paint);
    }
  }
  if (l.signal === "crossing") {
    // Stop lines before the crossing, across the lane of the traffic coming to it (cars keep left).
    const plus = axis === "x" ? [.26, .49] : [.51, .74], minus = axis === "x" ? [.51, .74] : [.26, .49];
    for (const [a, [d0, d1]] of [[.31, plus], [.69, minus]] as const) {
      const q = (u: number, d: number) => axis === "x" ? lift({ x: u, y: d }, .32) : lift({ x: d, y: u }, .32);
      line(c, q(a, d0!), q(a, d1!), paint, 1.5);
    }
  }
  for (const arm of l.stopArms) {
    // A thick line across the lane coming in from this arm, before its crosswalk; the lane is on the
    // left of the way the cars come in.
    const lx = -arm.dy, ly = arm.dx, q = (s: number) => lift({ x: .5 + arm.dx * .4 + lx * s, y: .5 + arm.dy * .4 + ly * s }, .32);
    line(c, q(.02), q(.25), paint, 1.8);
  }
}
export const roadArtNoise = noise;
