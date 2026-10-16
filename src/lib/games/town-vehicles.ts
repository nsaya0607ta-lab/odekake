import { shade } from "./town-paint";
import { vehicleLength, type Vehicle, type VehicleModel } from "./town-traffic";

/**
 * The town's vehicles, drawn from a few stacked boxes in the vehicle's own frame (along its heading and across it):
 * a darker sill, the body, a glasshouse with its pillars and roof, then lamps, mirrors and the details of each
 * model — the tall kei wagon, the minivan, the light truck with its cargo box, the taxi with its roof lamp and the
 * city bus with its window band, door and destination sign. Lit from the left like everything else in town.
 */
type Point = { x: number; y: number };
const iso = (x: number, y: number, z = 0): Point => ({ x: (x - y) * 32, y: (x + y) * 16 - z });
function poly(c: CanvasRenderingContext2D, ps: Point[], color: string) { c.beginPath(); ps.forEach((p, j) => j ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.fillStyle = color; c.fill(); }
function ellipse(c: CanvasRenderingContext2D, p: Point, rx: number, ry: number, color: string | CanvasGradient) { c.beginPath(); c.ellipse(p.x, p.y, Math.max(.01, rx), Math.max(.01, ry), 0, 0, Math.PI * 2); c.fillStyle = color; c.fill(); }
function line(c: CanvasRenderingContext2D, a: Point, b: Point, color: string, width: number) { c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.strokeStyle = color; c.lineWidth = width; c.stroke(); }
/** Mix a colour towards black (amount > 0) or white (amount < 0). */
function tone(color: string, amount: number) {
  const target = amount > 0 ? 0 : 255, t = Math.abs(amount);
  return "#" + [1, 3, 5].map(i => Math.round(parseInt(color.slice(i, i + 2), 16) * (1 - t) + target * t).toString(16).padStart(2, "0")).join("");
}
export const VEHICLE_WIDTH: Record<VehicleModel, number> = { sedan: .12, taxi: .12, kei: .11, van: .12, truck: .12, bus: .145 };

/** Draw a vehicle centred at ground point (x, y) heading (dx, dy); `lights` turns on the lamps (at night or in the rain). */
export function drawVehicle(c: CanvasRenderingContext2D, v: Vehicle, x: number, y: number, z: number, dx: number, dy: number, night: number, lights: boolean) {
  const n = (color: string) => shade(color, night), model = v.model, L = vehicleLength(model), W = VEHICLE_WIDTH[model];
  // A point `a` along the heading, `b` to the left of it, `h` up.
  const at = (a: number, b: number, h: number) => iso(x + dx * a + dy * b, y + dy * a - dx * b, z + h);
  /** A box from a0..a1 along, b0..b1 across, h0..h1 up: its two sides that face the viewer, then its top. */
  const block = (a0: number, a1: number, b0: number, b1: number, h0: number, h1: number, sideLit: string, sideShade: string, top: string) => {
    const corners = [[a0, b0], [a1, b0], [a1, b1], [a0, b1]].map(([a, b]) => ({ a: a!, b: b!, w: { x: x + dx * a! + dy * b!, y: y + dy * a! - dx * b! } }));
    const edges = corners.map((p, j) => ({ p, q: corners[(j + 1) % 4]! })).sort((e, f) => e.p.w.x + e.p.w.y + e.q.w.x + e.q.w.y - f.p.w.x - f.p.w.y - f.q.w.x - f.q.w.y).slice(2);
    for (const { p, q } of edges) poly(c, [at(p.a, p.b, h0), at(q.a, q.b, h0), at(q.a, q.b, h1), at(p.a, p.b, h1)], Math.abs(p.w.x - q.w.x) < 1e-6 ? sideShade : sideLit);
    poly(c, corners.map(p => at(p.a, p.b, h1)), top);
  };

  const body = n(v.color), bodyShade = n(tone(v.color, .22)), bodyTop = n(tone(v.color, -.12)), sill = n(tone(v.color, .42));
  const glass = n("#9fc3c4"), glassShade = n("#5d8487");
  // Which sides face the viewer: the front or the back, the left or the right.
  const frontSeen = dx + dy > 0, leftSeen = dy - dx > 0, side = leftSeen ? 1 : -1;
  // The headlight beam on the road first, so the body covers its own end of it; then the shadow and tyres.
  if (lights) headBeam(c, at, L, night);
  ellipse(c, at(0, 0, 0), L * 23, model === "bus" ? 3.6 : 2.6, "#22382f40");
  const axle = model === "bus" ? [-L * .32, L * .3] : model === "truck" ? [-L * .3, L * .33] : [-L * .3, L * .3];
  // Only the tyres on the side we see: the others are hidden under the body.
  for (const a of axle) {
    const p = at(a, side * (W / 2 - .004), 1.15), r = model === "bus" ? 1.65 : 1.25;
    ellipse(c, p, r * .8, r, n("#2a3431")); ellipse(c, p, r * .35, r * .45, n("#a9ad9d"));
  }
  if (model === "bus") {
    // Skirt in the town's green, a cream body, the window band with its pillars, the roof and the cooler on it.
    block(-L / 2, L / 2, -W / 2, W / 2, .8, 2.7, body, bodyShade, body);
    block(-L / 2, L / 2, -W / 2, W / 2, 2.7, 4.3, n("#eef0e6"), n("#c9cec2"), n("#f4f6ee"));
    block(-L / 2 + .004, L / 2 - .002, -W / 2 + .003, W / 2 - .003, 4.3, 7.3, glass, glassShade, n("#f2f4ec"));
    block(-L / 2, L / 2, -W / 2, W / 2, 7.3, 8, n("#eef0e6"), n("#c9cec2"), n("#f6f7f1"));
    block(-.08, .06, -.04, .04, 8, 9.1, n("#dfe3dc"), n("#b7bdb4"), n("#eef1ea"));
    // Pillars down the visible side, and the door on the left (kerb) side near the front.
    for (let j = 0; j <= 6; j++) { const a = -L / 2 + .01 + j * (L - .02) / 6; line(c, at(a, side * W / 2, 4.3), at(a, side * W / 2, 7.3), n("#e9ece4"), .65); }
    if (leftSeen) { poly(c, [at(L * .26, W / 2 + .001, 1.2), at(L * .4, W / 2 + .001, 1.2), at(L * .4, W / 2 + .001, 7.1), at(L * .26, W / 2 + .001, 7.1)], n("#3e5450")); line(c, at(L * .33, W / 2 + .002, 1.3), at(L * .33, W / 2 + .002, 7), n("#86a29b"), .4); }
    // A green stripe along the body, and the lit destination sign.
    line(c, at(-L / 2, side * W / 2, 3.4), at(L / 2, side * W / 2, 3.4), body, 1);
    if (frontSeen) {
      poly(c, [at(L / 2 + .001, -W * .42, 6.6), at(L / 2 + .001, W * .42, 6.6), at(L / 2 + .001, W * .42, 7.2), at(L / 2 + .001, -W * .42, 7.2)], lights ? "#ffd88a" : n("#3a4442"));
      for (const k of [-1, 1]) ellipse(c, at(L / 2 + .002, k * W * .36, 2), .9, .6, lights ? "#fff1b4" : n("#f0ecd8"));
    } else for (const k of [-1, 1]) ellipse(c, at(-L / 2 - .002, k * W * .38, 2.4), .8, .55, lights ? "#ff8a76" : n("#b9574c"));
    return;
  }
  if (model === "truck") {
    // A light truck: the cab in front, a white cargo box behind it.
    const cab0 = L * .12, cab1 = L / 2;
    block(-L / 2, L / 2, -W / 2, W / 2, .8, 1.7, sill, sill, sill);
    block(cab0, cab1, -W / 2, W / 2, 1.7, 3.8, body, bodyShade, body);
    block(cab0 + .004, cab1 - .012, -W / 2 + .006, W / 2 - .006, 3.8, 5.6, glass, glassShade, bodyTop);
    block(-L / 2, cab0 - .006, -W / 2 - .004, W / 2 + .004, 1.7, 7, n("#eceae0"), n("#b9bdb4"), n("#f5f4ec"));
    line(c, at(-L / 2, side * (W / 2 + .004), 4.4), at(cab0 - .006, side * (W / 2 + .004), 4.4), n("#c9cbc2"), .5);
    lamps(c, at, L, W, frontSeen, lights, n, 2.4);
    return;
  }
  // Cars: the sill, the body, then the glasshouse set back a little with the roof on top.
  const shape = model === "kei" ? { body: 3.3, glass: 2.4, a0: -L * .42, a1: L * .32, inset: .007 }
    : model === "van" ? { body: 3.6, glass: 2.2, a0: -L * .44, a1: L * .26, inset: .006 }
    : { body: 3.4, glass: 1.8, a0: -L * .3, a1: L * .16, inset: .012 };
  block(-L / 2, L / 2, -W / 2, W / 2, .8, 1.8, sill, sill, sill);
  block(-L / 2 + .003, L / 2 - .003, -W / 2, W / 2, 1.8, shape.body, body, bodyShade, bodyTop);
  const g0 = shape.body, g1 = shape.body + shape.glass;
  block(shape.a0, shape.a1, -W / 2 + shape.inset, W / 2 - shape.inset, g0, g1, glass, glassShade, body);
  // Door pillars on the visible side, the beltline, a mirror by the windscreen.
  const pillars = model === "sedan" || model === "taxi" ? [shape.a0 + (shape.a1 - shape.a0) * .48] : [shape.a0 + (shape.a1 - shape.a0) * .36, shape.a0 + (shape.a1 - shape.a0) * .7];
  for (const a of pillars) line(c, at(a, side * (W / 2 - shape.inset + .001), g0), at(a, side * (W / 2 - shape.inset + .001), g1), bodyShade, .8);
  line(c, at(-L / 2 + .004, side * W / 2, shape.body - .15), at(L / 2 - .004, side * W / 2, shape.body - .15), bodyTop, .45);
  ellipse(c, at(shape.a1 - .005, side * (W / 2 + .008), g0 + .3), .6, .4, body);
  if (model === "taxi") {
    // The roof lamp (行灯), lit while the lights are on.
    block(-.02, .015, -.022, .022, g1, g1 + 1.3, lights ? "#ffe6a1" : n("#f3ead2"), lights ? "#ffd88a" : n("#c9c0a4"), lights ? "#fff3cf" : n("#fbf5e4"));
    line(c, at(-L / 2 + .004, side * W / 2, 2.6), at(L / 2 - .004, side * W / 2, 2.6), n(v.color === "#2f3437" ? "#e3c35a" : "#f4f1e6"), .55);
  }
  lamps(c, at, L, W, frontSeen, lights, n, 2.5);
}
/** Head and tail lamps at the corners of whichever end faces the viewer. */
function lamps(c: CanvasRenderingContext2D, at: (a: number, b: number, h: number) => Point, L: number, W: number, frontSeen: boolean, lights: boolean, n: (color: string) => string, h: number) {
  for (const k of [-1, 1]) {
    if (frontSeen) { ellipse(c, at(L / 2 + .002, k * W * .34, h), .85, .55, lights ? "#fff1b4" : n("#eef0e2")); }
    else ellipse(c, at(-L / 2 - .002, k * W * .36, h + .2), .75, .5, lights ? "#ff8a76" : n("#b9574c"));
  }
}
/** A soft beam of the headlights on the road ahead. */
function headBeam(c: CanvasRenderingContext2D, at: (a: number, b: number, h: number) => Point, L: number, night: number) {
  // An oval of light on the road just ahead, brightest in its middle.
  const a = at(L / 2, 0, 0), b = at(L / 2 + .44, 0, 0), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  c.save(); c.globalCompositeOperation = "lighter"; c.translate(m.x, m.y); c.rotate(Math.atan2(b.y - a.y, b.x - a.x)); c.scale(1, .5);
  const beam = c.createRadialGradient(0, 0, 0, 0, 0, 12); beam.addColorStop(0, `rgba(255,240,190,${.3 * Math.max(night, .45)})`); beam.addColorStop(1, "rgba(255,240,190,0)");
  c.fillStyle = beam; c.beginPath(); c.arc(0, 0, 12, 0, Math.PI * 2); c.fill(); c.restore();
}
