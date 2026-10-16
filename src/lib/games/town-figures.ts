import { shade } from "./town-paint";

/**
 * The town's small people and animals, drawn with a handful of strokes so a crowd stays cheap.
 * A pose changes only the limbs and the height of the body; the look (clothes, hair, bag) is the same
 * person whether they walk, sit on a bench, ride a carousel horse or hang from a bar.
 */
export type Point = { x: number; y: number };
export const TAU = Math.PI * 2;
export function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
  c.beginPath(); c.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), 0, 0, TAU); c.fillStyle = color; c.fill();
}
export function stroke(c: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, color: string, width: number) {
  c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.strokeStyle = color; c.lineWidth = width; c.stroke();
}
/** Something held in the hand: a balloon on a string, an ice cream, a cup, a ball or a letter to post. */
export type Carry = "balloon" | "icecream" | "drink" | "ball" | "letter";
export type Look = {
  top: string; bottom: string; hair: string; skin: string; accent: string; umbrella: string; scale: number;
  bag: "none" | "randoseru" | "tote" | "briefcase"; hat: boolean; parasol: boolean; dog: string | null;
  kind: "adult" | "child" | "elder" | "jogger";
  carry?: Carry; carryColor?: string;
};
/**
 * walk/stand: legs stride with `walk`. sit: on a seat, legs forward. ride: astride a horse or seesaw.
 * crouch: squatting in the sand. hang: both hands up on a bar. cheer: arms raised in a V (splashing,
 * shooting a ball, waving to a friend). clap: applauding. bend: leaning forward to drink.
 */
export type Pose = "walk" | "sit" | "ride" | "crouch" | "hang" | "cheer" | "clap" | "bend";
export type PersonOptions = {
  rain: boolean; detail: boolean; sit?: boolean; jump?: number; pose?: Pose;
  /** Screen side (+1 right, -1 left) that legs point to when sitting and the body leans to when bending. */
  side?: number;
  /** Phase for clapping, waving and other repeated arm movements. */
  beat?: number;
  /** Hide the item in the hand (the balloon string is tied to the wrist while riding). */
  empty?: boolean;
};

/** Draw one small person; `walk` is the stride phase, `facing` is +1 towards the viewer. */
export function drawPerson(c: CanvasRenderingContext2D, p: Point, look: Look, walk: number, facing: number, night: number, options: PersonOptions) {
  const s = look.scale, n = (color: string) => shade(color, night), lift = options.jump ?? 0;
  // `sit` keeps the legs folded on a seat or on the grass whatever the arms are doing (clapping, cheering).
  const pose: Pose = options.pose ?? (options.sit ? "sit" : "walk"), side = options.side ?? 1, beat = options.beat ?? 0, seated = pose === "sit" || Boolean(options.sit);
  const low = pose === "crouch" ? 1.5 * s : 0, bend = pose === "bend" ? 1 : 0;
  const base = { x: p.x, y: p.y - lift };
  // The upper body: shifted down when squatting and forward when leaning over.
  const ux = base.x + bend * side * .9 * s, uy = base.y + low + bend * .7 * s;
  if (pose !== "hang" && !seated) ellipse(c, p.x + .6, p.y + .2, 2.1 * s, .85 * s, "#1e332a33");
  if (!options.detail) {
    ellipse(c, ux, uy - 3.6 * s, 1.35 * s, 2.6 * s, n(look.top));
    ellipse(c, ux + bend * side * .9 * s, uy - 7.1 * s + bend * .9 * s, 1.1 * s, 1.1 * s, n(look.skin));
    if (options.rain) ellipse(c, ux, uy - 9.6 * s, 4 * s, 1.6 * s, n(look.umbrella));
    else if (look.carry === "balloon" && !options.empty) balloon(c, base, look, s, night, beat);
    return;
  }
  const stride = Math.sin(walk) * 1.15 * s, legTop = base.y - 3.1 * s, leg = n(look.bottom), lw = 1.05 * s;
  if (seated) {
    stroke(c, base.x - .5 * s, legTop + .4, base.x + side * 1.6 * s, legTop + 1.1 * s, leg, lw);
    stroke(c, base.x + .5 * s, legTop + .4, base.x + side * 2.2 * s, legTop + 1.3 * s, leg, lw);
  } else if (pose === "ride") {
    for (const k of [-1, 1]) stroke(c, base.x + k * .55 * s, legTop + .3 * s, base.x + k * 1.25 * s, base.y + .5 * s, leg, lw);
  } else if (pose === "crouch") {
    for (const k of [-1, 1]) { stroke(c, base.x + k * .5 * s, uy - 3.1 * s, base.x + k * 1.25 * s, base.y - 1.2 * s, leg, lw); stroke(c, base.x + k * 1.25 * s, base.y - 1.2 * s, base.x + k * .7 * s, base.y, leg, lw); }
  } else if (pose === "hang") {
    const kick = Math.sin(beat * 2) * .5 * s;
    stroke(c, base.x - .4 * s, legTop, base.x - .4 * s + kick, base.y, leg, lw);
    stroke(c, base.x + .4 * s, legTop, base.x + .4 * s - kick, base.y, leg, lw);
  } else {
    const swing = pose === "walk" ? stride : 0;
    stroke(c, base.x - .45 * s, legTop, base.x - .45 * s + swing * .7, base.y, leg, lw);
    stroke(c, base.x + .45 * s, legTop, base.x + .45 * s - swing * .7, base.y, leg, lw);
  }
  if (look.bag === "randoseru" && facing < 0) ellipse(c, ux, uy - 4.7 * s, 1.5 * s, 1.6 * s, n(look.accent));
  c.beginPath(); c.ellipse(ux, uy - 4.6 * s, 1.5 * s, 2.15 * s, bend * side * .5, 0, TAU); c.fillStyle = n(look.top); c.fill();
  // Arms: swinging while walking, raised on a bar or in a cheer, clapping in front of the body.
  const arm = n(look.top), aw = .8 * s, shoulder = uy - 5.6 * s;
  const hands: [Point, Point] = pose === "hang" ? [{ x: ux - .75 * s, y: base.y - 10.3 * s }, { x: ux + .75 * s, y: base.y - 10.3 * s }]
    : pose === "cheer" ? [{ x: ux - 2.1 * s, y: uy - 9.4 * s + Math.sin(beat) * .8 * s }, { x: ux + 2.1 * s, y: uy - 9.4 * s - Math.sin(beat) * .8 * s }]
    : pose === "clap" ? [{ x: ux - (.25 + Math.abs(Math.sin(beat)) * .9) * s, y: uy - 5.4 * s }, { x: ux + (.25 + Math.abs(Math.sin(beat)) * .9) * s, y: uy - 5.4 * s }]
    : pose === "ride" ? [{ x: ux - .9 * s, y: uy - 4.6 * s }, { x: ux + .9 * s, y: uy - 4.6 * s }]
    : pose === "bend" ? [{ x: ux + side * 2.2 * s, y: uy - 4.2 * s }, { x: ux + side * 1.6 * s, y: uy - 3.4 * s }]
    : pose === "crouch" ? [{ x: ux - 1.6 * s, y: uy - 2.4 * s }, { x: ux + 1.6 * s, y: uy - 2.6 * s }]
    : [{ x: ux - 1.4 * s - (pose === "walk" ? stride * .55 : 0), y: uy - 3.3 * s }, { x: ux + 1.4 * s + (pose === "walk" ? stride * .55 : 0), y: uy - 3.3 * s }];
  stroke(c, ux - 1.2 * s, shoulder, hands[0].x, hands[0].y, arm, aw);
  const holdsCanopy = (options.rain || look.parasol) && pose === "walk";
  if (!holdsCanopy) stroke(c, ux + 1.2 * s, shoulder, hands[1].x, hands[1].y, arm, aw);
  if (look.bag === "tote") ellipse(c, ux + 1.6 * s, uy - 3.4 * s, .9 * s, 1.1 * s, n(look.accent));
  if (look.bag === "briefcase" && pose === "walk") ellipse(c, ux - 1.7 * s, uy - 3.1 * s, 1 * s, .7 * s, n("#4a3d33"));
  if (look.bag === "randoseru" && facing >= 0) ellipse(c, ux, uy - 5.1 * s, 1.55 * s, 1.5 * s, n(look.accent));
  const hx = ux + bend * side * .9 * s, hy = uy - 7.7 * s + bend * .9 * s;
  ellipse(c, hx, hy, 1.18 * s, 1.18 * s, n(look.skin));
  c.beginPath(); c.fillStyle = n(look.hair);
  if (facing >= 0) c.ellipse(hx, hy - .45 * s, 1.24 * s, .85 * s, 0, Math.PI, TAU);
  else c.ellipse(hx, hy - .1 * s, 1.24 * s, 1.24 * s, 0, 0, TAU);
  c.fill();
  if (look.hat && !options.rain) ellipse(c, hx, hy - 1.1 * s, 1.6 * s, .55 * s, n(look.accent));
  if (!options.empty && !options.rain) held(c, look, hands[1], base, s, night, beat, pose);
  const canopy = options.rain ? look.umbrella : look.parasol && pose === "walk" ? "#f4efe6dd" : null;
  if (canopy) {
    const top = uy - 11.2 * s;
    stroke(c, ux + .9 * s, uy - 4.8 * s, ux + .2 * s, top + .6 * s, n("#5a5752"), .45 * s);
    c.beginPath(); c.ellipse(ux + .2 * s, top + 1.4 * s, 4.4 * s, 1.5 * s, 0, Math.PI, TAU); c.fillStyle = n(canopy); c.fill();
    c.beginPath(); c.moveTo(ux - 4.2 * s, top + 1.4 * s); c.quadraticCurveTo(ux + .2 * s, top - 2.2 * s, ux + 4.6 * s, top + 1.4 * s); c.fill();
  }
}
function balloon(c: CanvasRenderingContext2D, base: Point, look: Look, s: number, night: number, beat: number) {
  const bob = Math.sin(beat * .7) * .7, bx = base.x + 2.6 * s + Math.sin(beat * .45) * .6, by = base.y - 14.5 * s + bob;
  c.beginPath(); c.moveTo(base.x + 1.4 * s, base.y - 3.4 * s); c.quadraticCurveTo(bx - 1.2, (by + base.y) / 2, bx, by + 2.3 * s);
  c.strokeStyle = shade("#f4f1e8", night); c.lineWidth = .3; c.stroke();
  ellipse(c, bx, by, 1.9 * s, 2.3 * s, shade(look.carryColor ?? "#e8604f", night));
  ellipse(c, bx - .6 * s, by - .8 * s, .45 * s, .7 * s, "#ffffff88");
}
function held(c: CanvasRenderingContext2D, look: Look, hand: Point, base: Point, s: number, night: number, beat: number, pose: Pose) {
  const n = (color: string) => shade(color, night);
  if (look.carry === "balloon") { if (pose !== "hang" && pose !== "cheer") balloon(c, base, look, s, night, beat); return; }
  if (look.carry === "icecream") {
    c.beginPath(); c.moveTo(hand.x - .7 * s, hand.y - 1.2 * s); c.lineTo(hand.x + .7 * s, hand.y - 1.2 * s); c.lineTo(hand.x, hand.y + .6 * s); c.closePath(); c.fillStyle = n("#d8a25f"); c.fill();
    ellipse(c, hand.x, hand.y - 1.6 * s, .85 * s, .75 * s, n(look.carryColor ?? "#f7d7df"));
    return;
  }
  if (look.carry === "drink") { ellipse(c, hand.x, hand.y - .6 * s, .55 * s, .9 * s, n(look.carryColor ?? "#f1ebdc")); ellipse(c, hand.x, hand.y - 1.4 * s, .55 * s, .22 * s, n("#8a5a3c")); return; }
  if (look.carry === "ball") { ellipse(c, hand.x + .3 * s, hand.y - .2 * s, 1 * s, 1 * s, n(look.carryColor ?? "#e9873f")); ellipse(c, hand.x, hand.y - .5 * s, .3 * s, .3 * s, "#ffffff66"); }
  if (look.carry === "letter") { c.fillStyle = n("#f7f3e8"); c.fillRect(hand.x - .2 * s, hand.y - 1.5 * s, 1.5 * s, 1 * s); stroke(c, hand.x - .2 * s, hand.y - 1.5 * s, hand.x + .55 * s, hand.y - 1 * s, n("#c9bfa9"), .2 * s); }
}

/** A tiny French bulldog: cream body, grey eye patch and bat ears, like the app's own dog. */
export function drawDog(c: CanvasRenderingContext2D, p: Point, dir: number, step: number, night: number, color = "#efe6d6", options: { sleep?: boolean; wag?: number; jump?: number; size?: number } = {}) {
  if (options.size && options.size !== 1) {
    c.save(); c.translate(p.x, p.y); c.scale(options.size, options.size); c.translate(-p.x, -p.y);
    drawDog(c, p, dir, step, night, color, { ...options, size: 1 });
    c.restore(); return;
  }
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

/** A feral pigeon: grey body, darker wings, a green-violet sheen on the neck. `flap` > 0 while flying. */
export function drawPigeon(c: CanvasRenderingContext2D, p: Point, dir: number, peck: number, flap: number, night: number) {
  c.save(); c.translate(p.x, p.y); c.scale(.72, .72); c.translate(-p.x, -p.y);
  pigeon(c, p, dir, peck, flap, night);
  c.restore();
}
function pigeon(c: CanvasRenderingContext2D, p: Point, dir: number, peck: number, flap: number, night: number) {
  const n = (col: string) => shade(col, night), f = dir >= 0 ? 1 : -1;
  if (flap <= 0) ellipse(c, p.x, p.y + .2, 1.5, .5, "#1e332a2a");
  const y = p.y - (flap > 0 ? 0 : 0);
  if (flap > 0) {
    const w = Math.sin(flap) * 2.2;
    c.beginPath(); c.moveTo(p.x - f * .3, y - 1.4); c.lineTo(p.x - f * 1.2, y - 1.4 - w); c.lineTo(p.x + f * .6, y - 1.6); c.closePath(); c.fillStyle = n("#8e97a3"); c.fill();
  }
  ellipse(c, p.x, y - 1.2, 1.5, .95, n("#a9b0ba"));
  ellipse(c, p.x - f * .3, y - 1.35, .95, .6, n("#8b939e"));
  const head = peck > 0 ? { x: p.x + f * 1.5, y: y - .7 } : { x: p.x + f * 1.2, y: y - 2.2 };
  ellipse(c, (p.x + head.x) / 2 + f * .1, (y - 1.6 + head.y) / 2, .55, .6, n("#7d9a92"));
  ellipse(c, head.x, head.y, .62, .58, n("#9aa3ae"));
  ellipse(c, head.x + f * .55, head.y + .1, .28, .14, n("#d8c4a4"));
  stroke(c, p.x - f * 1.3, y - 1.1, p.x - f * 2.1, y - .9, n("#6f7782"), .7);
}

/**
 * A bicycle under its rider: two thin wheels along the way it goes, the frame, turning pedals and a front basket.
 * `p` is the ground point; returns the saddle, where the rider sits.
 */
export function drawBicycle(c: CanvasRenderingContext2D, p: Point, dx: number, dy: number, phase: number, night: number, frame = "#3f6f9a"): Point {
  const n = (color: string) => shade(color, night), wx = (dx - dy) * 32, wy = (dx + dy) * 16, len = Math.hypot(wx, wy) || 1, ux = wx / len, uy = wy / len;
  const wheel = (t: number) => ({ x: p.x + ux * t, y: p.y + uy * t - 1.8 }), back = wheel(-2.6), fore = wheel(2.6);
  ellipse(c, p.x + .5, p.y + .3, 4.2, 1.1, "#1e332a30");
  for (const q of [back, fore]) { c.beginPath(); c.ellipse(q.x, q.y, Math.max(.6, Math.abs(ux) * 1.9), 1.9, 0, 0, TAU); c.strokeStyle = n("#2b2f2d"); c.lineWidth = .55; c.stroke(); }
  const seat = { x: p.x - ux * .8, y: p.y - 4.6 + uy * -.4 }, bar = { x: p.x + ux * 1.7, y: p.y - 5.2 }, crank = { x: p.x + ux * .3, y: p.y - 2 };
  for (const [a, b] of [[back, seat], [seat, bar], [bar, fore], [back, crank], [crank, bar], [crank, seat]] as const) stroke(c, a.x, a.y, b.x, b.y, n(frame), .55);
  const turn = phase * 2.2;
  stroke(c, crank.x + Math.cos(turn), crank.y + Math.sin(turn) * .6, crank.x - Math.cos(turn), crank.y - Math.sin(turn) * .6, n("#2b2f2d"), .5);
  c.beginPath(); c.moveTo(fore.x - 1, fore.y - 3.4); c.lineTo(fore.x + 1, fore.y - 3.6); c.lineTo(fore.x + .8, fore.y - 2.2); c.lineTo(fore.x - .8, fore.y - 2); c.closePath(); c.fillStyle = n("#c9c3b2"); c.fill();
  return { x: seat.x, y: seat.y + 3.4 };
}
