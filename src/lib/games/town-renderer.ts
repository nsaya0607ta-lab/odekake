import { MAP_SIZE, neighbours, touchesRoad, type Tile, type Town, type Tool } from "./town-builder";
import { DIRECTIONS, elevationAt, measureTransportRoute, sampleTransportDistance, sampleTransportPath, stationAxis, trackPaths, trackPoint, transportHeight, transportMask, transportOutline, type TransportKind, type TransportRoute } from "./town-transport";
import { TownSprites, type SpriteBounds } from "./town-sprites";

type Point = { x: number; y: number };
export type TownCamera = { x: number; y: number; zoom: number };
export type SceneOptions = { night: boolean; grid: boolean; hover: number | null; selected: number | null; preview: number[]; tool: Tool | "inspect" | "pan"; routes: number[][]; paused: boolean; speed: number };
const W = 32, H = 16;
const iso = (x: number, y: number, z = 0): Point => ({ x: (x - y) * W, y: (x + y) * H - z });
const hash = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
function poly(c: CanvasRenderingContext2D, points: Point[], fill: string | CanvasGradient, stroke?: string, width = .6) {
  c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.fillStyle = fill; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
function line(c: CanvasRenderingContext2D, a: Point, b: Point, color: string, width = 1) {
  c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.strokeStyle = color; c.lineWidth = width; c.stroke();
}
function ellipse(c: CanvasRenderingContext2D, p: Point, rx: number, ry: number, color: string | CanvasGradient) {
  c.beginPath(); c.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = color; c.fill();
}
function patch(c: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, fill: string, z = 0) {
  poly(c, [iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)], fill);
}
function box(c: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, h: number, colors: string[], z = 0) {
  poly(c, [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)], colors[0]!);
  poly(c, [iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)], colors[1]!);
  patch(c, x, y, w, d, colors[2]!, z + h);
}
function shadow(c: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, h: number) {
  const p = iso(x + w, y + d);
  poly(c, [iso(x, y + d), p, { x: p.x + h * .8, y: p.y + h * .22 }, { x: iso(x + w, y).x + h * .8, y: iso(x + w, y).y + h * .22 }, iso(x + w, y)], "#234e3735");
}
function tree(c: CanvasRenderingContext2D, x: number, y: number, size: number, variant: number, time = 0) {
  const p = iso(x, y), sway = Math.sin(time * .6 + x) * .4;
  ellipse(c, { x: p.x + 5, y: p.y + 1 }, size * .6, size * .25, "#245a3436");
  line(c, p, { x: p.x + sway, y: p.y - size }, "#786744", size * .17);
  if (variant < .3) {
    poly(c, [{ x: p.x - size * .6, y: p.y - size * .48 }, { x: p.x + sway, y: p.y - size * 2.25 }, { x: p.x + size * .6, y: p.y - size * .48 }], "#326b50");
    poly(c, [{ x: p.x - size * .43, y: p.y - size }, { x: p.x + sway, y: p.y - size * 2.25 }, { x: p.x, y: p.y - size }], "#4a9166");
  } else {
    const colors = variant > .88 ? ["#c99767", "#ebbb7b", "#f5d191"] : ["#3e7955", "#62a565", "#80b872"];
    ellipse(c, { x: p.x + sway, y: p.y - size * 1.25 }, size * .7, size * .8, colors[0]!);
    ellipse(c, { x: p.x - size * .18 + sway, y: p.y - size * 1.55 }, size * .58, size * .65, colors[1]!);
    ellipse(c, { x: p.x - size * .25 + sway, y: p.y - size * 1.75 }, size * .32, size * .36, colors[2]!);
  }
}
function windows(c: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, floors: number, night: boolean, seed: number, entrance = true) {
  for (let floor = 0; floor < floors; floor++) {
    for (let j = 0; j < 3; j++) {
      const z = 7 + floor * 12;
      const color = night && hash(seed + j + floor * 7) > .25 ? "#ffe6a2" : "#779f9e";
      const wx = x + .09 + j * w / 3;
      if (!(entrance && floor === 0 && j === 1)) {
        poly(c, [iso(wx, y + d + .004, z), iso(wx + .105, y + d + .004, z), iso(wx + .105, y + d + .004, z + 6), iso(wx, y + d + .004, z + 6)], color);
        line(c, iso(wx - .015, y + d + .005, z), iso(wx + .12, y + d + .005, z), "#f6ecd2", 1);
      }
      const wy = y + .09 + j * d / 3;
      poly(c, [iso(x + w + .004, wy, z), iso(x + w + .004, wy + .10, z), iso(x + w + .004, wy + .10, z + 6), iso(x + w + .004, wy, z + 6)], color);
    }
  }
}
function pitchedRoof(c: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, h: number, color: string, dark: string) {
  const ridgeA = iso(x, y + d / 2, h + 13), ridgeB = iso(x + w, y + d / 2, h + 13);
  poly(c, [iso(x, y, h), iso(x + w, y, h), ridgeB, ridgeA], dark);
  poly(c, [ridgeA, ridgeB, iso(x + w, y + d, h), iso(x, y + d, h)], color);
  poly(c, [iso(x + w, y, h), ridgeB, iso(x + w, y + d, h)], "#e8d7b8");
  for (let t = .13; t < 1; t += .13) line(c, iso(x + w * t, y + d / 2, h + 13), iso(x + w * t, y + d, h), "#ffffff21", .7);
  line(c, ridgeA, ridgeB, "#ffffff6b", 1);
}
function lamp(c: CanvasRenderingContext2D, x: number, y: number, night: boolean) {
  const p = iso(x, y); line(c, p, { x: p.x, y: p.y - 21 }, "#486365", 1.2);
  line(c, { x: p.x, y: p.y - 21 }, { x: p.x + 5, y: p.y - 23 }, "#486365", 1.2);
  ellipse(c, { x: p.x + 5, y: p.y - 23 }, 3, 1.5, night ? "#ffe6a1" : "#dfead8");
  if (night) { const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 19); g.addColorStop(0, "#ffdd7745"); g.addColorStop(1, "#ffdd7700"); ellipse(c, p, 19, 10, g); }
}
function station(c: CanvasRenderingContext2D, x: number, y: number, axis: "x" | "y", night: boolean, roof: boolean) {
  const alongX = axis === "x", px = x + (alongX ? .04 : .65), py = y + (alongX ? .65 : .04), w = alongX ? .92 : .31, d = alongX ? .31 : .92;
  if (!roof) {
    box(c, px, py, w, d, 3, ["#b6b8a3", "#919f92", "#e6dbc3"]);
    patch(c, px + .02, py + .02, alongX ? .88 : .045, alongX ? .045 : .88, "#e1c887", 3.1);
    box(c, x + .10, y + .10, .22, .23, 13, ["#f4e6c7", "#caba98", "#cf9361"]);
    poly(c, [iso(x + .14, y + .332, 4), iso(x + .28, y + .332, 4), iso(x + .28, y + .332, 10), iso(x + .14, y + .332, 10)], night ? "#ffe6a2" : "#779f9e");
    return;
  }
  for (const t of [.16, .82]) box(c, x + (alongX ? t : .86), y + (alongX ? .86 : t), .028, .028, 18, ["#809d96", "#587a73", "#cfe0d2"], 3);
  box(c, x + (alongX ? .04 : .55), y + (alongX ? .55 : .04), alongX ? .92 : .41, alongX ? .41 : .92, 3, ["#477f78", "#326760", "#75aca1"], 21);
  const sx = x + (alongX ? .42 : .93), sy = y + (alongX ? .93 : .42);
  const signX = sx + (alongX ? .115 : 0), signY = sy + (alongX ? 0 : .115);
  line(c, iso(signX, signY, 3), iso(signX, signY, 21), "#587a73", 1.1);
  box(c, sx, sy, alongX ? .23 : .025, alongX ? .025 : .23, 3, ["#3f766c", "#315d55", "#cde0c4"], 12);
  const clock = iso(signX, signY, 19); ellipse(c, clock, 3, 3, "#f9f1d9");
  line(c, clock, { x: clock.x + 1.4, y: clock.y - 1.4 }, "#536c64", .7);
}
function factorySmoke(c: CanvasRenderingContext2D, x: number, y: number, time: number) {
  for (let j = 0; j < 4; j++) {
    const t = (time * .23 + j / 4 + hash(y * MAP_SIZE + x)) % 1, p = iso(x + .82, y + .22, 47);
    c.save(); c.globalAlpha *= (1 - t) * .24; ellipse(c, { x: p.x + t * 12, y: p.y - t * 32 }, 3 + t * 7, 3 + t * 4, "#eaf0dc"); c.restore();
  }
}
function plot(c: CanvasRenderingContext2D, kind: Tile, x: number, y: number, access: number) {
  patch(c, x + .05, y + .05, .9, .9, "#c8c9af");
  if (kind !== "park" && kind !== "station") {
    // Connect the lot to its actual road edge, including side and rear entrances.
    for (const { bit, dx, dy } of DIRECTIONS) if (access & bit) patch(c, x + (dx < 0 ? 0 : dx > 0 ? .78 : .44), y + (dy < 0 ? 0 : dy > 0 ? .78 : .44), dx ? .22 : .12, dy ? .22 : .12, "#e4d9bc");
  }
}
function building(c: CanvasRenderingContext2D, kind: Tile, x: number, y: number, level: number, night: boolean, time: number, showSmoke = true, axis: "x" | "y" = "x", access = 0, showPlot = true) {
  // Twenty consistent facade variants share artwork even when every city tile is developed.
  const style = Math.floor(hash(y * MAP_SIZE + x) * 20), seed = style * 31, v = (style + .5) / 20, bx = x + .16, by = y + .15;
  if (showPlot) plot(c, kind, x, y, access);
  if (kind === "park") {
    patch(c, x + .07, y + .07, .86, .86, "#a9c790");
    patch(c, x + .43, y + .07, .15, .86, "#e2d5b5"); patch(c, x + .07, y + .43, .86, .15, "#e2d5b5");
    tree(c, x + .2, y + .2, 9, .5, time); tree(c, x + .8, y + .25, 8, .95, time);
    const p = iso(x + .5, y + .5);
    ellipse(c, p, 11, 5.5, "#c6d2c3"); ellipse(c, { x: p.x, y: p.y - 1 }, 8, 3.5, "#6eb3c1");
    if (showSmoke) line(c, { x: p.x, y: p.y - 1 }, { x: p.x, y: p.y - 9 - Math.sin(time * 3) }, "#d9f7f0", 2);
    box(c, x + .1, y + .75, .22, .08, 3, ["#9a7856", "#755d43", "#d7b084"]);
    for (let j = 0; j < 7; j++) ellipse(c, iso(x + .72 + hash(seed + j) * .13, y + .72 + hash(seed + j + 42) * .15), 1.3, 1, j % 2 ? "#efcf7c" : "#d98187");
    return;
  }
  if (kind === "station") {
    patch(c, x + (axis === "x" ? .04 : .30), y + (axis === "x" ? .30 : .04), axis === "x" ? .92 : .40, axis === "x" ? .40 : .92, "#b6b49a");
    for (const side of [.405, .595]) line(c, iso(x + (axis === "x" ? .04 : side), y + (axis === "x" ? side : .04), .8), iso(x + (axis === "x" ? .96 : side), y + (axis === "x" ? side : .96), .8), "#d6dfcf", 1.2);
    station(c, x, y, axis, night, false); station(c, x, y, axis, night, true); return;
  }
  if (kind === "factory") {
    shadow(c, bx, by, .7, .65, 26);
    const height = 23 + level * 3;
    box(c, bx, by, .72, .64, height, ["#c3c8be", "#959f9c", "#e0deca"]);
    windows(c, bx, by, .72, .64, 2, night, seed, false);
    for (let j = 0; j < 3; j++) box(c, bx + j * .23, by + .08, .22, .48, 5, ["#739c9f", "#547b81", "#9cb9b4"], height);
    box(c, x + .77, y + .17, .1, .1, 47, ["#bf8d75", "#8e6557", "#e1b199"]);
    if (showSmoke) factorySmoke(c, x, y, time);
    box(c, x + .12, y + .86, .25, .08, 4, ["#a6b6aa", "#6f8b7d", "#c9d4bb"]); return;
  }
  const floors = kind === "house" ? level === 1 ? 1 : level * 2 : level + 1;
  const height = floors * 12 + 5;
  const roofs = ["#bd7962", "#7898a0", "#9a9a74", "#c89868", "#8b8ba6"];
  const walls = ["#f4e9cc", "#ebd3b6", "#dee8df", "#f0d8c6"];
  shadow(c, bx, by, .67, .65, height + 8);
  box(c, bx, by, .67, .65, height, [walls[Math.floor(v * 4)]!, "#bdbaa0", "#e8dcc1"]);
  windows(c, bx, by, .67, .65, floors, night, seed);
  // Foundation, doorstep and planted hedge.
  box(c, bx - .015, by + .63, .7, .055, 2, ["#c1b294", "#aa9b81", "#efe2c2"]);
  const door = [iso(bx + .27, by + .652, 2), iso(bx + .39, by + .652, 2), iso(bx + .39, by + .652, 11), iso(bx + .27, by + .652, 11)];
  poly(c, door, "#677d70");
  if (kind === "house" && level === 1) {
    pitchedRoof(c, bx - .05, by - .05, .77, .75, height, roofs[Math.floor(v * 5)]!, "#8c7565");
    box(c, bx + .44, by + .05, .08, .09, 9, ["#caa790", "#987763", "#ead3b3"], height + 6);
    for (const offset of [.14, .70]) box(c, x + offset, y + .88, .18, .09, 4, ["#709464", "#567853", "#96b777"]);
  } else {
    box(c, bx - .025, by - .025, .72, .70, 3, ["#c1b8a1", "#969f96", roofs[Math.floor(v * 5)]!], height);
    box(c, bx + .1, by + .15, .16, .12, 5, ["#aebbad", "#8b9d94", "#d9e0cc"], height + 3);
    patch(c, bx + .37, by + .12, .2, .26, "#5a858e", height + 3.2);
    for (let j = 1; j < 3; j++) line(c, iso(bx + .37, by + .12 + j * .08, height + 3.4), iso(bx + .57, by + .12 + j * .08, height + 3.4), "#99b9bb", .6);
    if (kind === "shop") {
      poly(c, [iso(bx + .04, by + .653, 3), iso(bx + .24, by + .653, 3), iso(bx + .24, by + .653, 12), iso(bx + .04, by + .653, 12)], night ? "#ffe7ad" : "#8bbab4");
      poly(c, [iso(bx + .43, by + .653, 3), iso(bx + .63, by + .653, 3), iso(bx + .63, by + .653, 12), iso(bx + .43, by + .653, 12)], night ? "#ffe7ad" : "#8bbab4");
      for (let j = 0; j < 6; j++) patch(c, bx - .03 + j * .12, by + .64, .12, .22, j % 2 ? "#f9ecd1" : "#ce8572", 13);
      // A window and display counter identify the shop without labels on the artwork.
      box(c, bx + .05, by + .82, .20, .09, 3, ["#ab8d60", "#7e684c", "#ead3a2"]);
      box(c, x + .84, y + .85, .07, .09, 6, ["#927856", "#6e604d", "#e1c89a"]);
    }
  }
  if (v > .3) tree(c, x + .86, y + .14, 6.5, .6, time);
}
function transport(c: CanvasRenderingContext2D, town: Town, x: number, y: number, kind: TransportKind) {
  const i = y * MAP_SIZE + x, mask = transportMask(town, i, kind), bridge = town.terrain[i];
  const point = (p: Point, lift = 0) => iso(x + p.x, y + p.y, transportHeight(town, i, p.x, p.y, kind) + lift);
  const outer = transportOutline(kind === "rail" && !mask ? 3 : mask, kind === "road" ? .19 : .28);
  if (!bridge) patch(c, x, y, 1, 1, kind === "road" ? "#bdc7ad" : "#b6c49c");
  if (bridge) {
    // A solid deck and piers replace floating pavement over the river.
    for (let j = 0; j < outer.length; j++) {
      const a = outer[j]!, b = outer[(j + 1) % outer.length]!;
      poly(c, [point(a), point(b), iso(x + b.x, y + b.y, -3), iso(x + a.x, y + a.y, -3)], "#869b8c");
    }
    box(c, x + .43, y + .43, .14, .14, 8, ["#b6bda5", "#839786", "#d4d5bb"], -3);
  }
  poly(c, outer.map(p => point(p)), kind === "road" ? "#d5d8c2" : "#b6b49a");
  if (kind === "road") {
    poly(c, transportOutline(mask, .24).map(p => point(p, .15)), "#6c817b");
    const directions = DIRECTIONS.filter(d => mask & d.bit);
    if (directions.length === 2) {
      const [a, b] = directions, path = { a: { x: .5 + a!.dx * .5, y: .5 + a!.dy * .5 }, b: { x: .5 + b!.dx * .5, y: .5 + b!.dy * .5 }, curve: Boolean(a!.dx !== -b!.dx || a!.dy !== -b!.dy) };
      // Dash spacing is shared across tile edges; curves follow the drivable bend.
      for (let j = 0; j < 5; j++) line(c, point(trackPoint(path, (j + .15) / 5), .25), point(trackPoint(path, (j + .57) / 5), .25), "#e6e4b0", .8);
    } else {
      for (const { dx, dy } of directions) {
        for (const t of [.38, .46]) line(c, point({ x: .5 + dx * t, y: .5 + dy * t }, .25), point({ x: .5 + dx * (t + .035), y: .5 + dy * (t + .035) }, .25), "#e6e4b0", .8);
        if (directions.length >= 3) for (let j = 0; j < 4; j++) {
          const offset = (j - 1.5) * .095;
          line(c, point({ x: .5 + dx * .28 + dy * offset, y: .5 + dy * .28 + dx * offset }, .3), point({ x: .5 + dx * .35 + dy * offset, y: .5 + dy * .35 + dx * offset }, .3), "#e2e6d1", 1.6);
        }
      }
      if (directions.length === 1) {
        const { dx, dy } = directions[0]!;
        line(c, point({ x: .5 - dx * .16 + dy * .16, y: .5 - dy * .16 + dx * .16 }, .3), point({ x: .5 - dx * .16 - dy * .16, y: .5 - dy * .16 - dx * .16 }, .3), "#e2e6d1", 1);
      }
    }
  } else {
    for (const path of trackPaths(mask)) {
      for (let j = 0; j <= 7; j++) {
        const p = trackPoint(path, j / 7);
        line(c, point({ x: p.x + p.dy * .17, y: p.y - p.dx * .17 }, .25), point({ x: p.x - p.dy * .17, y: p.y + p.dx * .17 }, .25), "#837862", 2.2);
      }
      for (const side of [-1, 1]) {
        const rail = Array.from({ length: 13 }, (_, j) => { const p = trackPoint(path, j / 12); return point({ x: p.x + p.dy * side * .095, y: p.y - p.dx * side * .095 }, .8); });
        c.beginPath(); rail.forEach((p, j) => j ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.strokeStyle = "#d6dfcf"; c.lineWidth = 1.2; c.stroke();
      }
    }
    if (mask && DIRECTIONS.filter(d => mask & d.bit).length === 1) {
      const { dx, dy } = DIRECTIONS.find(d => mask & d.bit)!;
      line(c, point({ x: .5 - dx * .12 + dy * .13, y: .5 - dy * .12 - dx * .13 }, 3), point({ x: .5 - dx * .12 - dy * .13, y: .5 - dy * .12 + dx * .13 }, 3), "#735f4d", 2);
    }
  }
}
function bridgeRails(c: CanvasRenderingContext2D, town: Town, x: number, y: number, kind: TransportKind) {
  const i = y * MAP_SIZE + x, mask = transportMask(town, i, kind), outline = transportOutline(kind === "rail" && !mask ? 3 : mask, kind === "road" ? .2 : .27);
  for (let j = 0; j < outline.length; j++) {
    const a = outline[j]!, b = outline[(j + 1) % outline.length]!;
    if (a.x === b.x && (a.x === 0 || a.x === 1) || a.y === b.y && (a.y === 0 || a.y === 1)) continue;
    line(c, iso(x + a.x, y + a.y, 11), iso(x + b.x, y + b.y, 11), "#d9e0c5", 1.3);
    const steps = Math.max(1, Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) * 4));
    for (let n = 0; n <= steps; n++) {
      const px = x + a.x + (b.x - a.x) * n / steps, py = y + a.y + (b.y - a.y) * n / steps;
      line(c, iso(px, py, 5), iso(px, py, 11), "#839b8b", .9);
    }
  }
}
function orientedBox(c: CanvasRenderingContext2D, x: number, y: number, length: number, width: number, height: number, dx: number, dy: number, colors: string[], z: number) {
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([along, across]) => ({ x: x + dx * along! * length / 2 - dy * across! * width / 2, y: y + dy * along! * length / 2 + dx * across! * width / 2 }));
  const edges = corners.map((a, j) => ({ a, b: corners[(j + 1) % 4]!, depth: a.x + a.y + corners[(j + 1) % 4]!.x + corners[(j + 1) % 4]!.y })).sort((a, b) => a.depth - b.depth).slice(2);
  edges.forEach(({ a, b }, j) => poly(c, [iso(a.x, a.y, z), iso(b.x, b.y, z), iso(b.x, b.y, z + height), iso(a.x, a.y, z + height)], colors[j]!));
  poly(c, corners.map(p => iso(p.x, p.y, z + height)), colors[2]!);
  return edges;
}
type Vehicle = { from: number; to: number; next: number; previous: number; t: number; color: string; seed: number };
function contains(p: Point, vertices: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i]!, b = vertices[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function boxFaces(x: number, y: number, w: number, d: number, h: number, z = 0): Point[][] {
  return [
    [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)],
    [iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)],
    [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)],
  ];
}
function buildingFaces(kind: Tile, x: number, y: number, level: number, axis: "x" | "y" = "x"): Point[][] {
  if (kind === "station") return [...boxFaces(x + (axis === "x" ? .04 : .55), y + (axis === "x" ? .55 : .04), axis === "x" ? .92 : .41, axis === "x" ? .41 : .92, 3, 21), ...boxFaces(x + .1, y + .1, .22, .23, 13)];
  if (kind === "factory") return [...boxFaces(x + .16, y + .15, .72, .64, 23 + level * 3), ...boxFaces(x + .77, y + .17, .1, .1, 47), ...boxFaces(x + .16, y + .23, .68, .48, 5, 23 + level * 3)];
  if (kind !== "house" && kind !== "shop") return [];
  const h = (kind === "house" ? level === 1 ? 1 : level * 2 : level + 1) * 12 + 5;
  const faces = boxFaces(x + .16, y + .15, .67, .65, h);
  if (kind === "house" && level === 1) {
    const bx = x + .11, by = y + .10, w = .77, d = .75;
    const a = iso(bx, by + d / 2, h + 13), b = iso(bx + w, by + d / 2, h + 13);
    faces.push([iso(bx, by, h), iso(bx + w, by, h), b, a], [a, b, iso(bx + w, by + d, h), iso(bx, by + d, h)], [iso(bx + w, by, h), b, iso(bx + w, by + d, h)]);
  } else faces.push(...boxFaces(x + .135, y + .125, .72, .70, 3, h), ...boxFaces(x + .26, y + .30, .16, .12, 5, h + 3));
  return faces;
}
type SceneObject = { depth: number; x: number; y: number; bounds: SpriteBounds; key?: string; paint: (c: CanvasRenderingContext2D) => void };
const GROUND_BOUNDS = { left: -824, top: -30, width: 1648, height: 850 };
function drawTerrain(c: CanvasRenderingContext2D, town: Town, options: SceneOptions) {
  ellipse(c, iso(12, 12), 820, 390, "#2f605f15");
  const edge = MAP_SIZE;
  poly(c, [iso(0, edge), iso(edge, edge), { ...iso(edge, edge), y: iso(edge, edge).y + 22 }, { ...iso(0, edge), y: iso(0, edge).y + 22 }], "#829d6d");
  poly(c, [iso(edge, 0), iso(edge, edge), { ...iso(edge, edge), y: iso(edge, edge).y + 22 }, { ...iso(edge, 0), y: iso(edge, 0).y + 22 }], "#6f8e64");
  // Finish the land first so a later neighbouring cell cannot paint over a curb or bridge.
  for (let y = 0; y < MAP_SIZE; y++) for (let x = 0; x < MAP_SIZE; x++) {
    const i = y * MAP_SIZE + x, tile = town.tiles[i]!, water = town.terrain[i] || tile === "water";
    patch(c, x, y, 1.008, 1.008, water ? "#78b6bd" : ["#adca91", "#b1cc95", "#b6cf97", "#abc78e"][Math.floor(hash(i) * 4)]!);
    if (water) {
      if (tile === "water") for (let j = 0; j < 3; j++) {
        const p = iso(x + .15 + hash(i + j) * .7, y + .2 + j * .24);
        line(c, { x: p.x - 3, y: p.y }, { x: p.x + 4, y: p.y }, "#d5ebe67a", .8);
      }
      for (const n of neighbours(x, y)) if (!town.terrain[n] && town.tiles[n] !== "water") {
        const dx = n % MAP_SIZE - x, dy = Math.floor(n / MAP_SIZE) - y;
        line(c, iso(x + (dx === 1 ? 1 : 0), y + (dy === 1 ? 1 : 0)), iso(x + (dx === -1 ? 0 : 1), y + (dy === -1 ? 0 : 1)), "#d0dbc1", 2);
      }
    } else if (tile === "grass") {
      for (let j = 0; j < 3; j++) { const p = iso(x + hash(i * 7 + j) * .8 + .1, y + hash(i * 9 + j) * .8 + .1); ellipse(c, p, 1, .6, j === 1 && hash(i) > .7 ? "#e8dd9a" : "#91b37c"); }
    }
    if (options.grid && !water) poly(c, [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)], "#ffffff00", "#547b4933", .6);
  }
  for (let y = 0; y < MAP_SIZE; y++) for (let x = 0; x < MAP_SIZE; x++) {
    const i = y * MAP_SIZE + x, tile = town.tiles[i]!;
    if (["house", "shop", "factory", "station", "park"].includes(tile)) plot(c, tile, x, y, transportMask(town, i, "road"));
  }
  for (let depth = 0; depth < MAP_SIZE * 2 - 1; depth++) for (let y = Math.max(0, depth - MAP_SIZE + 1); y <= Math.min(depth, MAP_SIZE - 1); y++) {
    const x = depth - y, tile = town.tiles[y * MAP_SIZE + x];
    if (tile === "road" || tile === "rail" || tile === "station") transport(c, town, x, y, tile === "road" ? "road" : "rail");
  }
}
export class TownScene {
  private vehicles: Vehicle[] = [];
  private lastTiles: Tile[] | null = null;
  private lastLevels: number[] | null = null;
  private lastTerrain: boolean[] | null = null;
  private lastNight = false;
  private objects: SceneObject[] = [];
  private effects: { kind: Tile; x: number; y: number }[] = [];
  private roadNeighbours = new Map<number, number[]>();
  private lastRoutes: number[][] | null = null;
  private lastRouteTiles: Tile[] | null = null;
  private trainRoutes: TransportRoute[] = [];
  private readonly createCanvas: (() => HTMLCanvasElement) | null;
  private readonly sprites: TownSprites | null;
  private ground: HTMLCanvasElement | null = null;
  private groundState: { tiles: Tile[]; terrain: boolean[]; grid: boolean } | null = null;
  constructor(createCanvas?: () => HTMLCanvasElement) {
    this.createCanvas = createCanvas ?? (typeof document !== "undefined" ? () => document.createElement("canvas") : null);
    this.sprites = this.createCanvas ? new TownSprites(this.createCanvas) : null;
  }
  private time = 0;
  private readonly reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  camera: TownCamera = { x: 0, y: 0, zoom: 1 };
  fit(width: number, height: number) {
    this.camera = { x: width / 2, y: height * .53 - MAP_SIZE * H * Math.min(width / 1680, height / 930), zoom: Math.min(width / 1680, height / 930) };
  }
  zoomAt(factor: number, px: number, py: number) {
    const old = this.camera.zoom, next = Math.max(.12, Math.min(2.8, old * factor));
    this.camera.x = px - (px - this.camera.x) * next / old; this.camera.y = py - (py - this.camera.y) * next / old; this.camera.zoom = next;
  }
  tileAt(px: number, py: number): number | null {
    const a = (px - this.camera.x) / this.camera.zoom / W, b = (py - this.camera.y) / this.camera.zoom / H;
    const x = Math.floor((a + b) / 2), y = Math.floor((b - a) / 2);
    return x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE ? y * MAP_SIZE + x : null;
  }
  pickTile(px: number, py: number, town: Town): number | null {
    const p = { x: (px - this.camera.x) / this.camera.zoom, y: (py - this.camera.y) / this.camera.zoom };
    // Reverse the renderer's painter order so visible roofs and walls select their own building.
    for (let depth = (MAP_SIZE - 1) * 2; depth >= 0; depth--) {
      for (let y = Math.min(depth, MAP_SIZE - 1); y >= Math.max(0, depth - MAP_SIZE + 1); y--) {
        const x = depth - y, i = y * MAP_SIZE + x, origin = iso(x, y);
        if (Math.abs(p.x - origin.x) > 36 || p.y < origin.y - 85 || p.y > origin.y + 33) continue;
        if (buildingFaces(town.tiles[i]!, x, y, town.levels[i] || 1, stationAxis(town, i)).some(face => contains(p, face))) return i;
      }
    }
    return this.tileAt(px, py);
  }
  tileBounds(i: number, town: Town) {
    const x = i % MAP_SIZE, y = Math.floor(i / MAP_SIZE), { camera } = this;
    const points = [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1), ...buildingFaces(town.tiles[i]!, x, y, town.levels[i] || 1, stationAxis(town, i)).flat()];
    if (town.tiles[i] === "park") points.push(iso(x + .5, y + .5, 40));
    return {
      left: camera.x + Math.min(...points.map(p => p.x)) * camera.zoom,
      right: camera.x + Math.max(...points.map(p => p.x)) * camera.zoom,
      top: camera.y + Math.min(...points.map(p => p.y)) * camera.zoom,
      bottom: camera.y + Math.max(...points.map(p => p.y)) * camera.zoom,
    };
  }
  private prepareObjects(town: Town, night: boolean) {
    if (this.lastTiles === town.tiles && this.lastLevels === town.levels && this.lastTerrain === town.terrain && this.lastNight === night) return;
    if (this.lastTiles !== town.tiles) {
      this.roadNeighbours = new Map(town.tiles.flatMap((tile, i) => tile === "road" ? [[i, neighbours(i % MAP_SIZE, Math.floor(i / MAP_SIZE)).filter(n => town.tiles[n] === "road")] as const] : []));
      const roads = [...this.roadNeighbours].filter(([, next]) => next.length).map(([i]) => i);
      this.vehicles = this.vehicles.filter(v => town.tiles[v.previous] === "road" && town.tiles[v.from] === "road" && town.tiles[v.to] === "road" && town.tiles[v.next] === "road");
      const target = Math.min(22, Math.floor(roads.length / 3));
      while (this.vehicles.length < target) {
        const j = this.vehicles.length, from = roads[Math.floor(hash(j + 8) * roads.length)]!, to = this.roadNeighbours.get(from)![0]!;
        const previous = this.roadNeighbours.get(from)!.find(n => n !== to) ?? to;
        const next = this.roadNeighbours.get(to)!.find(n => n !== from) ?? from;
        this.vehicles.push({ from, to, previous, next, t: hash(j), seed: j, color: ["#f0d29d", "#c8786c", "#60899b", "#eee7cf", "#879677"][j % 5]! });
      }
      this.vehicles = this.vehicles.slice(0, target);
    }
    const objects: SceneObject[] = [], effects: typeof this.effects = [];
    const add = (x: number, y: number, depth: number, key: string, bounds: SpriteBounds, paint: SceneObject["paint"]) => {
      const origin = iso(x, y); objects.push({ x: origin.x, y: origin.y, depth: x + y + depth, key, bounds, paint });
    };
    for (let y = 0; y < MAP_SIZE; y++) for (let x = 0; x < MAP_SIZE; x++) {
      const i = y * MAP_SIZE + x, tile = town.tiles[i]!, level = town.levels[i] || 1;
      if (["house", "shop", "factory", "station", "park"].includes(tile)) {
        const axis = tile === "station" ? stationAxis(town, i) : "x";
        const style = tile === "station" || tile === "factory" && !night ? 0 : Math.floor(hash(i) * 20);
        const key = `${tile}:${style}:${level}:${night}:${axis}`;
        const faces = buildingFaces(tile, x, y, level, axis).flat(), origin = iso(x, y);
        const top = Math.min(-24, ...faces.map(p => p.y - origin.y)) - 4;
        const h = tile === "house" ? (level === 1 ? 1 : level * 2) * 12 + 13 : tile === "shop" ? (level + 1) * 12 + 13 : 32;
        const right = Math.max(38, h * .8 + 24), bottom = Math.max(38, h * .22 + 32);
        const bounds = { left: -38, top, width: right + 38, height: bottom - top };
        if (tile === "station") {
          add(x, y, .35, key + ":base", bounds, c => station(c, x, y, axis, night, false));
          // Trains run between the platform and canopy, with visible supporting pillars.
          add(x, y, 1.55, key + ":roof", bounds, c => station(c, x, y, axis, night, true));
        } else add(x, y, 1, key, bounds, c => building(c, tile, x, y, level, night, 0, false, axis, 0, false));
        if (tile === "factory" || tile === "park") effects.push({ kind: tile, x, y });
      }
      if (tile === "grass" && hash(i * 3) > .63 && !neighbours(x, y).some(n => ["road", "rail", "station"].includes(town.tiles[n]!))) {
        const size = Math.round((8 + hash(i * 7) * 9) * 2) / 2, v = hash(i * 5), variant = v < .3 ? .1 : v > .88 ? .95 : .5;
        const bounds = { left: -size - 2, top: 16 - size * 2.3 - 2, width: size * 2 + 12, height: size * 2.3 + 8 };
        // Reuse identical trees instead of retaining hundreds of almost identical bitmaps.
        const origin = iso(x, y);
        objects.push({ x: origin.x, y: origin.y, depth: x + y + 1, key: `tree:${size}:${variant}`, bounds, paint: c => tree(c, x + .5, y + .5, size, variant) });
      }
      if (tile === "road" && !town.terrain[i] && (x + y) % 7 === 0) {
        const mask = transportMask(town, i, "road"), corner = Boolean(mask & 3) && Boolean(mask & 12), alongX = Boolean(mask & 3);
        const position = corner ? "corner" : alongX ? "x" : "y";
        add(x, y, 1.3, `lamp:${night}:${position}`, { left: -40, top: -16, width: 80, height: 64 }, c => lamp(c, x + (corner ? .87 : alongX ? .42 : .86), y + (corner ? .87 : alongX ? .86 : .42), night));
      }
      if ((tile === "road" || tile === "rail") && town.terrain[i]) add(x, y, 1.4, `bridge:${tile}:${transportMask(town, i, tile)}`, { left: -36, top: -14, width: 72, height: 52 }, c => bridgeRails(c, town, x, y, tile));
    }
    this.objects = objects.sort((a, b) => a.depth - b.depth); this.effects = effects;
    this.lastTiles = town.tiles; this.lastLevels = town.levels; this.lastTerrain = town.terrain; this.lastNight = night;
  }
  private drawGround(c: CanvasRenderingContext2D, town: Town, options: SceneOptions) {
    if (!this.createCanvas) { drawTerrain(c, town, options); return; }
    if (!this.ground) {
      this.ground = this.createCanvas(); this.ground.width = GROUND_BOUNDS.width * 2; this.ground.height = GROUND_BOUNDS.height * 2;
    }
    const previous = this.groundState;
    if (!previous || previous.tiles !== town.tiles || previous.terrain !== town.terrain || previous.grid !== options.grid) {
      const context = this.ground.getContext("2d"); if (!context) { drawTerrain(c, town, options); return; }
      context.setTransform(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, this.ground.width, this.ground.height);
      context.setTransform(2, 0, 0, 2, -GROUND_BOUNDS.left * 2, -GROUND_BOUNDS.top * 2); drawTerrain(context, town, options);
      this.groundState = { tiles: town.tiles, terrain: town.terrain, grid: options.grid };
    }
    c.drawImage(this.ground, GROUND_BOUNDS.left, GROUND_BOUNDS.top, GROUND_BOUNDS.width, GROUND_BOUNDS.height);
  }
  render(c: CanvasRenderingContext2D, width: number, height: number, town: Town, options: SceneOptions, dt: number) {
    if (!options.paused) this.time += Math.min(dt, .1) * options.speed;
    const time = this.time;
    this.prepareObjects(town, options.night);
    if (this.lastRoutes !== options.routes || this.lastRouteTiles !== town.tiles) {
      this.trainRoutes = options.routes.slice(0, 12).filter(route => route.length >= 3 && route.every(i => town.tiles[i] === "rail" || town.tiles[i] === "station")).map(measureTransportRoute);
      this.lastRoutes = options.routes;
      this.lastRouteTiles = town.tiles;
    }
    const sky = c.createLinearGradient(0, 0, 0, height); sky.addColorStop(0, options.night ? "#203e51" : "#b8d8cf"); sky.addColorStop(1, options.night ? "#314e53" : "#e9ecd8");
    c.fillStyle = sky; c.fillRect(0, 0, width, height);
    for (let j = 0; j < 4; j++) { const px = ((j * .27 + time * .0007) % 1.5 - .2) * width; ellipse(c, { x: px, y: 55 + j * 47 }, 85, 15, options.night ? "#ffffff03" : "#fffef014"); }
    c.save(); c.translate(this.camera.x, this.camera.y); c.scale(this.camera.zoom, this.camera.zoom);
    this.drawGround(c, town, options);
    const detail = this.camera.zoom > 1.5;
    if (detail) {
      // At close range, draw the few visible streets as vectors to retain sharp rails and markings.
      const left = -this.camera.x / this.camera.zoom - 40, right = (width - this.camera.x) / this.camera.zoom + 40;
      const top = -this.camera.y / this.camera.zoom - 40, bottom = (height - this.camera.y) / this.camera.zoom + 20;
      for (let depth = 0; depth < MAP_SIZE * 2 - 1; depth++) for (let y = Math.max(0, depth - MAP_SIZE + 1); y <= Math.min(depth, MAP_SIZE - 1); y++) {
        const x = depth - y, tile = town.tiles[y * MAP_SIZE + x], p = iso(x, y);
        if (p.x < left || p.x > right || p.y < top || p.y > bottom) continue;
        if (tile === "road" || tile === "rail" || tile === "station") transport(c, town, x, y, tile === "road" ? "road" : "rail");
      }
    }
    const highlight = (i: number, color: string, fill: string) => { const x = i % MAP_SIZE, y = Math.floor(i / MAP_SIZE), z = town.terrain[i] ? 5.5 : 1; poly(c, [iso(x, y, z), iso(x + 1, y, z), iso(x + 1, y + 1, z), iso(x, y + 1, z)], fill, color, 1.8); };
    const previewTiles = options.preview.length ? options.preview : options.hover !== null && options.tool !== "pan" && options.tool !== "inspect" ? [options.hover] : [];
    const allowedAt = (i: number) => {
      const tile = town.tiles[i];
      const hasAccess = !["house", "shop", "factory"].includes(options.tool) || touchesRoad(town.tiles, i % MAP_SIZE, Math.floor(i / MAP_SIZE));
      return options.tool === "bulldoze" || tile === "grass" && hasAccess || tile === "water" && ["rail", "road"].includes(options.tool);
    };
    if (options.selected !== null) highlight(options.selected, "#f4d184", "#d8b56618");
    for (const i of previewTiles) highlight(i, allowedAt(i) ? "#efdaa0" : "#d87962", allowedAt(i) ? "#e6dba222" : "#ef957922");
    const moving: SceneObject[] = [];
    const add = (x: number, y: number, depth: number, paint: SceneObject["paint"]) => { const origin = iso(x, y); moving.push({ x: origin.x, y: origin.y, depth: x + y + depth, bounds: { left: -28, top: -85, width: 66, height: 110 }, paint }); };
    for (const { kind, x, y } of this.effects) {
      if (kind === "factory" && !this.reducedMotion) add(x, y, 1.01, c => factorySmoke(c, x, y, time));
      if (kind === "park") add(x, y, 1.01, c => { const p = iso(x + .5, y + .5); line(c, { x: p.x, y: p.y - 1 }, { x: p.x, y: p.y - 9 - (this.reducedMotion ? 0 : Math.sin(time * 3)) }, "#d9f7f0", 2); });
    }
    for (const v of this.vehicles) {
      if (!options.paused) v.t += Math.min(dt, .1) * options.speed * .65;
      if (v.t >= 1) {
        v.t -= 1; v.previous = v.from; v.from = v.to; v.to = v.next;
        const choices = this.roadNeighbours.get(v.to)!.filter(n => n !== v.from);
        v.next = choices.length ? choices[Math.floor(hash(time * .1 + v.seed) * choices.length)]! : v.from;
      }
      const p = sampleTransportPath([v.previous, v.from, v.to, v.next], 1 + v.t), { dx, dy } = p;
      const x = p.x + (p.laneApplied ? 0 : dy * .13), y = p.y - (p.laneApplied ? 0 : dx * .13), z = elevationAt(town, x, y, "road");
      add(x, y, 0, c => {
        ellipse(c, iso(x, y, z), 5, 2.5, "#29443d44");
        orientedBox(c, x, y, .23, .12, 4, dx, dy, [v.color, "#64796c", v.color], z);
        orientedBox(c, x - dx * .015, y - dy * .015, .13, .09, 2, dx, dy, ["#b8dbd1", "#6b9397", "#e1ecdc"], z + 4);
        if (options.night) ellipse(c, iso(x + dx * .12, y + dy * .12, z + 2), 2, 1.2, "#fff1b4");
      });
    }
    for (let r = 0; r < this.trainRoutes.length; r++) {
      const route = this.trainRoutes[r]!, max = route.length, travel = max - .68, phase = (time * .45 + r * 4) % (travel * 2 + 4);
      const center = .34 + Math.min(travel, phase <= travel + 2 ? Math.max(0, phase - 1) : Math.max(0, travel * 2 + 3 - phase));
      for (let wagon = 0; wagon < 3; wagon++) {
        const pos = Math.max(0, Math.min(max, center + (wagon - 1) * .34)), { x, y, dx, dy } = sampleTransportDistance(route, pos), z = elevationAt(town, x, y, "rail");
        add(x, y, 0, c => {
          const faces = orientedBox(c, x, y, .29, .18, 9, dx, dy, ["#f3e5bf", "#8d9e94", "#d9e1cb"], z);
          for (const { a, b } of faces) {
            line(c, iso(a.x, a.y, z + 4), iso(b.x, b.y, z + 4), "#c37c5e", 1.5);
            const p = { x: a.x + (b.x - a.x) * .2, y: a.y + (b.y - a.y) * .2 }, q = { x: a.x + (b.x - a.x) * .8, y: a.y + (b.y - a.y) * .8 };
            poly(c, [iso(p.x, p.y, z + 5), iso(q.x, q.y, z + 5), iso(q.x, q.y, z + 8), iso(p.x, p.y, z + 8)], options.night ? "#ffe9a7" : "#739a9c");
          }
        });
      }
    }
    moving.sort((a, b) => a.depth - b.depth);
    const visible = (o: SceneObject) => {
      const left = this.camera.x + (o.x + o.bounds.left) * this.camera.zoom, top = this.camera.y + (o.y + o.bounds.top) * this.camera.zoom;
      return left < width && top < height && left + o.bounds.width * this.camera.zoom > 0 && top + o.bounds.height * this.camera.zoom > 0;
    };
    const draw = (o: SceneObject) => {
      if (!visible(o)) return;
      if (o.key && this.sprites && !detail) this.sprites.draw(c, o.key, o.x, o.y, o.bounds, context => { context.save(); context.translate(-o.x, -o.y); o.paint(context); context.restore(); });
      else o.paint(c);
    };
    // The immutable scene is already sorted; merge only the small moving layer each frame.
    let movingIndex = 0;
    for (const o of this.objects) {
      while (movingIndex < moving.length && moving[movingIndex]!.depth < o.depth) draw(moving[movingIndex++]!);
      draw(o);
    }
    while (movingIndex < moving.length) draw(moving[movingIndex++]!);
    if (options.night) { c.save(); c.globalCompositeOperation = "multiply"; patch(c, 0, 0, MAP_SIZE, MAP_SIZE, "#849fad"); c.restore(); }
    for (const i of previewTiles) {
      if (allowedAt(i) && ["house", "shop", "factory", "park", "station"].includes(options.tool)) {
        c.save(); c.globalAlpha *= .55; building(c, options.tool as Tile, i % MAP_SIZE, Math.floor(i / MAP_SIZE), 1, options.night, time, true, stationAxis(town, i), transportMask(town, i, "road")); c.restore();
      }
    }
    c.restore();
  }
}
export function drawTownIcon(c: CanvasRenderingContext2D, kind: Tool, width: number, height: number) {
  // Leave room for the taller buildings and their cast shadows on all four sides.
  const scale = .72;
  c.clearRect(0, 0, width, height); c.save(); c.translate(width * .5 - 4, height - 32 * scale - 5); c.scale(scale, scale);
  if (kind === "bulldoze") {
    box(c, -.34, -.30, .65, .12, 4, ["#667569", "#4b6055", "#839589"]);
    box(c, -.34, .10, .65, .12, 4, ["#667569", "#4b6055", "#839589"]);
    box(c, -.3, -.25, .6, .4, 8, ["#d9ac5d", "#b98843", "#f2cb7e"]);
    box(c, -.15, -.22, .25, .28, 12, ["#8caca4", "#527d78", "#f0c775"], 8);
    box(c, .3, -.3, .05, .6, 8, ["#b4b9a2", "#7f917f", "#d5d5be"]);
  } else if (kind === "road" || kind === "rail") {
    const town = createIconTown(kind); transport(c, town, 0, 0, kind);
  } else building(c, kind, 0, 0, 1, false, 0, false);
  c.restore();
}
function createIconTown(kind: "road" | "rail"): Town {
  const tiles = Array<Tile>(MAP_SIZE ** 2).fill("grass"); tiles[0] = kind; tiles[1] = kind;
  return { tiles, levels: [], terrain: [], rewards: [], money: 0, day: 1, paused: true };
}
