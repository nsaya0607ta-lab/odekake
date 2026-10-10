import { MAP_SIZE, neighbours, touchesRoad, type Tile, type Town, type Tool } from "./town-builder";

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
function windows(c: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, floors: number, night: boolean, seed: number) {
  for (let floor = 0; floor < floors; floor++) {
    for (let j = 0; j < 3; j++) {
      const z = 7 + floor * 12;
      const color = night && hash(seed + j + floor * 7) > .25 ? "#ffe6a2" : "#779f9e";
      const wx = x + .09 + j * w / 3;
      poly(c, [iso(wx, y + d + .004, z), iso(wx + .105, y + d + .004, z), iso(wx + .105, y + d + .004, z + 6), iso(wx, y + d + .004, z + 6)], color);
      line(c, iso(wx - .015, y + d + .005, z), iso(wx + .12, y + d + .005, z), "#f6ecd2", 1);
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
function building(c: CanvasRenderingContext2D, kind: Tile, x: number, y: number, level: number, night: boolean, time: number, showSmoke = true) {
  const seed = y * MAP_SIZE + x, v = hash(seed), bx = x + .16, by = y + .15;
  patch(c, x + .05, y + .05, .9, .9, "#c8c9af");
  if (kind === "park") {
    patch(c, x + .07, y + .07, .86, .86, "#a9c790");
    patch(c, x + .43, y + .07, .15, .86, "#e2d5b5"); patch(c, x + .07, y + .43, .86, .15, "#e2d5b5");
    const p = iso(x + .5, y + .5);
    ellipse(c, p, 11, 5.5, "#c6d2c3"); ellipse(c, { x: p.x, y: p.y - 1 }, 8, 3.5, "#6eb3c1");
    line(c, { x: p.x, y: p.y - 1 }, { x: p.x, y: p.y - 9 - Math.sin(time * 3) }, "#d9f7f0", 2);
    tree(c, x + .2, y + .2, 9, .5, time); tree(c, x + .8, y + .25, 8, .95, time);
    box(c, x + .1, y + .75, .22, .08, 3, ["#9a7856", "#755d43", "#d7b084"]);
    for (let j = 0; j < 7; j++) ellipse(c, iso(x + .72 + hash(seed + j) * .13, y + .72 + hash(seed + j + 42) * .15), 1.3, 1, j % 2 ? "#efcf7c" : "#d98187");
    return;
  }
  if (kind === "station") {
    patch(c, x + .05, y + .12, .9, .72, "#e6dbc3");
    for (let j = 0; j < 4; j++) box(c, x + .12 + j * .19, y + .32, .035, .035, 19, ["#809d96", "#587a73", "#cfe0d2"]);
    box(c, x + .10, y + .22, .78, .43, 3, ["#477f78", "#326760", "#75aca1"], 19);
    box(c, x + .1, y + .7, .35, .19, 15, ["#f4e6c7", "#caba98", "#cf9361"]);
    // A small physical sign follows the platform perspective; no floating lettering.
    box(c, x + .51, y + .72, .24, .03, 3, ["#3f766c", "#315d55", "#cde0c4"], 7);
    ellipse(c, iso(x + .48, y + .66, 22), 3.3, 3.3, "#f9f1d9");
    line(c, iso(x + .48, y + .66, 22), iso(x + .50, y + .66, 24), "#536c64", .7);
    lamp(c, x + .9, y + .8, night); return;
  }
  if (kind === "factory") {
    shadow(c, bx, by, .7, .65, 26);
    box(c, bx, by, .72, .64, 23 + level * 3, ["#c3c8be", "#959f9c", "#e0deca"]);
    windows(c, bx, by, .72, .64, 2, night, seed);
    for (let j = 0; j < 3; j++) box(c, bx + j * .23, by + .08, .22, .48, 5, ["#739c9f", "#547b81", "#9cb9b4"], 26 + level * 3);
    box(c, x + .77, y + .17, .1, .1, 47, ["#bf8d75", "#8e6557", "#e1b199"]);
    for (let j = 0; showSmoke && j < 4; j++) {
      const t = (time * .23 + j / 4 + v) % 1, p = iso(x + .82, y + .22, 47);
      c.save(); c.globalAlpha *= (1 - t) * .24; ellipse(c, { x: p.x + t * 12, y: p.y - t * 32 }, 3 + t * 7, 3 + t * 4, "#eaf0dc"); c.restore();
    }
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
    for (let j = 0; j < 4; j++) box(c, x + .14 + j * .18, y + .9, .14, .06, 4, ["#709464", "#567853", "#96b777"]);
  } else {
    box(c, bx - .025, by - .025, .72, .70, 3, ["#c1b8a1", "#969f96", roofs[Math.floor(v * 5)]!], height);
    box(c, bx + .1, by + .15, .16, .12, 5, ["#aebbad", "#8b9d94", "#d9e0cc"], height + 3);
    patch(c, bx + .37, by + .12, .2, .26, "#5a858e", height + 3.2);
    for (let j = 1; j < 3; j++) line(c, iso(bx + .37, by + .12 + j * .08, height + 3.4), iso(bx + .57, by + .12 + j * .08, height + 3.4), "#99b9bb", .6);
    if (kind === "shop") {
      for (let j = 0; j < 6; j++) patch(c, bx - .03 + j * .12, by + .64, .12, .22, j % 2 ? "#f9ecd1" : "#ce8572", 13);
      // A window and display counter identify the shop without labels on the artwork.
      poly(c, [iso(bx + .05, by + .66, 4), iso(bx + .21, by + .66, 4), iso(bx + .21, by + .66, 11), iso(bx + .05, by + .66, 11)], night ? "#ffe7ad" : "#8bbab4");
      box(c, bx + .05, by + .82, .20, .09, 3, ["#ab8d60", "#7e684c", "#ead3a2"]);
      box(c, x + .84, y + .85, .07, .09, 6, ["#927856", "#6e604d", "#e1c89a"]);
    }
  }
  if (v > .3) tree(c, x + .86, y + .14, 6.5, .6, time);
}
function transport(c: CanvasRenderingContext2D, town: Town, x: number, y: number, kind: "road" | "rail", night: boolean) {
  const i = y * MAP_SIZE + x, z = town.terrain[i] ? 5 : 0;
  const connects = neighbours(x, y).filter(n => town.tiles[n] === kind || kind === "rail" && town.tiles[n] === "station");
  const directions = connects.map(n => ({ dx: n % MAP_SIZE - x, dy: Math.floor(n / MAP_SIZE) - y }));
  if (!directions.length) directions.push({ dx: 1, dy: 0 }, { dx: -1, dy: 0 });
  if (kind === "road") {
    if (!town.terrain[i]) patch(c, x, y, 1, 1, "#bdc7ad");
    patch(c, x + .27, y + .27, .46, .46, "#657b78", z);
    for (const { dx, dy } of directions) {
      const sx = dx < 0 ? x : x + .27, sy = dy < 0 ? y : y + .27;
      const w = dx ? .73 : .46, d = dy ? .73 : .46;
      patch(c, sx - (dy ? .025 : 0), sy - (dx ? .025 : 0), w + (dy ? .05 : 0), d + (dx ? .05 : 0), "#d5d8c2", z);
      patch(c, sx, sy, w, d, "#6c817b", z + .1);
      c.setLineDash([3, 4]); line(c, iso(x + .5, y + .5, z + .2), iso(x + .5 + dx * .5, y + .5 + dy * .5, z + .2), "#e6e4b0", 1); c.setLineDash([]);
    }
    if (directions.length >= 3) {
      for (const { dx, dy } of directions) for (let j = 0; j < 4; j++) {
        const p = iso(x + .5 + dx * .33 + (dy ? (j - 1.5) * .08 : 0), y + .5 + dy * .33 + (dx ? (j - 1.5) * .08 : 0), z + .3);
        line(c, p, { x: p.x + (dx ? -1.6 : 1.6), y: p.y + .8 }, "#dbe2c9", 1.4);
      }
    }
    if ((x + y) % 4 === 0) lamp(c, x + .82, y + .82, night);
  } else {
    for (const { dx, dy } of directions) {
      const ax = x + .5, ay = y + .5;
      patch(c, dx ? x : x + .27, dy ? y : y + .27, dx ? 1 : .46, dy ? 1 : .46, "#b6b49a", z);
      for (let j = 0; j <= 4; j++) {
        const t = j / 8, tx = ax + dx * t, ty = ay + dy * t;
        line(c, iso(tx + (dy ? .18 : 0), ty + (dx ? .18 : 0), z + .3), iso(tx - (dy ? .18 : 0), ty - (dx ? .18 : 0), z + .3), "#837862", 2.3);
      }
      for (const side of [-1, 1]) line(c, iso(ax + (dy ? side * .10 : 0), ay + (dx ? side * .10 : 0), z + 1), iso(ax + dx * .5 + (dy ? side * .10 : 0), ay + dy * .5 + (dx ? side * .10 : 0), z + 1), "#d6dfcf", 1.4);
    }
  }
  if (town.terrain[i]) {
    const alongX = directions.some(d => d.dx !== 0);
    for (const side of [.21, .79]) {
      line(c, iso(x + (alongX ? 0 : side), y + (alongX ? side : 0), 9), iso(x + (alongX ? 1 : side), y + (alongX ? side : 1), 9), "#d9e0c5", 1.4);
      for (let j = 0; j <= 3; j++) line(c, iso(x + (alongX ? j / 3 : side), y + (alongX ? side : j / 3), 4), iso(x + (alongX ? j / 3 : side), y + (alongX ? side : j / 3), 9), "#839b8b", 1);
    }
  }
}
type Vehicle = { from: number; to: number; previous: number; t: number; color: string; seed: number };
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
function buildingFaces(kind: Tile, x: number, y: number, level: number): Point[][] {
  if (kind === "station") return [...boxFaces(x + .1, y + .22, .78, .43, 3, 19), ...boxFaces(x + .1, y + .7, .35, .19, 15)];
  if (kind === "factory") return [...boxFaces(x + .16, y + .15, .72, .64, 23 + level * 3), ...boxFaces(x + .77, y + .17, .1, .1, 47), ...boxFaces(x + .16, y + .23, .68, .48, 5, 26 + level * 3)];
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
export class TownScene {
  private vehicles: Vehicle[] = [];
  private lastTiles: Tile[] | null = null;
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
        if (buildingFaces(town.tiles[i]!, x, y, town.levels[i] || 1).some(face => contains(p, face))) return i;
      }
    }
    return this.tileAt(px, py);
  }
  render(c: CanvasRenderingContext2D, width: number, height: number, town: Town, options: SceneOptions, dt: number) {
    if (!options.paused) this.time += Math.min(dt, .1) * options.speed;
    const time = this.time;
    const sky = c.createLinearGradient(0, 0, 0, height); sky.addColorStop(0, options.night ? "#203e51" : "#b8d8cf"); sky.addColorStop(1, options.night ? "#314e53" : "#e9ecd8");
    c.fillStyle = sky; c.fillRect(0, 0, width, height);
    // Soft ambient clouds drift around the diorama.
    for (let j = 0; j < 4; j++) { const px = ((j * .27 + time * .0007) % 1.5 - .2) * width; ellipse(c, { x: px, y: 55 + j * 47 }, 85, 15, options.night ? "#ffffff03" : "#fffef014"); }
    c.save(); c.translate(this.camera.x, this.camera.y); c.scale(this.camera.zoom, this.camera.zoom);
    ellipse(c, iso(12, 12), 820, 390, "#2f605f15");
    const edge = MAP_SIZE;
    poly(c, [iso(0, edge), iso(edge, edge), { ...iso(edge, edge), y: iso(edge, edge).y + 22 }, { ...iso(0, edge), y: iso(0, edge).y + 22 }], "#829d6d");
    poly(c, [iso(edge, 0), iso(edge, edge), { ...iso(edge, edge), y: iso(edge, edge).y + 22 }, { ...iso(edge, 0), y: iso(edge, 0).y + 22 }], "#6f8e64");
    for (let y = 0; y < MAP_SIZE; y++) for (let x = 0; x < MAP_SIZE; x++) {
      const i = y * MAP_SIZE + x, tile = town.tiles[i]!;
      const water = town.terrain[i] || tile === "water";
      patch(c, x, y, 1.015, 1.015, water ? "#78b6bd" : ["#adca91", "#b1cc95", "#b6cf97", "#abc78e"][Math.floor(hash(i) * 4)]!);
      if (water) {
        for (let j = 0; j < 3; j++) {
          const p = iso(x + .15 + hash(i + j) * .7, y + .2 + j * .24);
          line(c, { x: p.x - 3, y: p.y + Math.sin(time + i) }, { x: p.x + 4, y: p.y + Math.sin(time + i) }, "#d5ebe67a", .8);
        }
        for (const n of neighbours(x, y)) if (!town.terrain[n] && town.tiles[n] !== "water") {
          const dx = n % MAP_SIZE - x, dy = Math.floor(n / MAP_SIZE) - y;
          line(c, iso(x + (dx === 1 ? 1 : 0), y + (dy === 1 ? 1 : 0)), iso(x + (dx === -1 ? 0 : 1), y + (dy === -1 ? 0 : 1)), "#d0dbc1", 2);
        }
      } else if (tile === "grass") {
        for (let j = 0; j < 3; j++) { const p = iso(x + hash(i * 7 + j) * .8 + .1, y + hash(i * 9 + j) * .8 + .1); ellipse(c, p, 1, .6, j === 1 && hash(i) > .7 ? "#e8dd9a" : "#91b37c"); }
      }
      if (options.grid && !water) poly(c, [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)], "#ffffff00", "#547b4933", .6);
      if (tile === "road" || tile === "rail") transport(c, town, x, y, tile, options.night);
    }
    if (this.lastTiles !== town.tiles) {
      const roads = town.tiles.flatMap((t, i) => t === "road" && neighbours(i % MAP_SIZE, Math.floor(i / MAP_SIZE)).some(n => town.tiles[n] === "road") ? [i] : []);
      this.vehicles = this.vehicles.filter(v => town.tiles[v.from] === "road" && town.tiles[v.to] === "road");
      const target = Math.min(22, Math.floor(roads.length / 3));
      while (this.vehicles.length < target) {
        const j = this.vehicles.length, from = roads[Math.floor(hash(j + 8) * roads.length)]!;
        const to = neighbours(from % MAP_SIZE, Math.floor(from / MAP_SIZE)).find(n => town.tiles[n] === "road")!;
        this.vehicles.push({ from, to, previous: -1, t: hash(j), seed: j, color: ["#f0d29d", "#c8786c", "#60899b", "#eee7cf", "#879677"][j % 5]! });
      }
      this.vehicles = this.vehicles.slice(0, target); this.lastTiles = town.tiles;
    }
    const objects: { depth: number; draw: () => void }[] = [];
    for (let y = 0; y < MAP_SIZE; y++) for (let x = 0; x < MAP_SIZE; x++) {
      const i = y * MAP_SIZE + x, tile = town.tiles[i]!;
      if (["house", "shop", "factory", "station", "park"].includes(tile)) objects.push({ depth: x + y + 1, draw: () => building(c, tile, x, y, town.levels[i] || 1, options.night, this.reducedMotion ? 0 : time) });
      if (tile === "grass" && hash(i * 3) > .63 && !neighbours(x, y).some(n => town.tiles[n] === "road" || town.tiles[n] === "rail")) objects.push({ depth: x + y + 1, draw: () => tree(c, x + .5, y + .5, 8 + hash(i * 7) * 9, hash(i * 5), this.reducedMotion ? 0 : time) });
    }
    for (const v of this.vehicles) {
      if (!options.paused) v.t += Math.min(dt, .1) * options.speed * .65;
      if (v.t >= 1) {
        v.t -= 1; v.previous = v.from; v.from = v.to;
        let next = neighbours(v.from % MAP_SIZE, Math.floor(v.from / MAP_SIZE)).filter(n => town.tiles[n] === "road" && n !== v.previous);
        if (!next.length) next = [v.previous]; v.to = next[Math.floor(hash(time * .1 + v.seed) * next.length)]!;
      }
      const dx = v.to % MAP_SIZE - v.from % MAP_SIZE, dy = Math.floor(v.to / MAP_SIZE) - Math.floor(v.from / MAP_SIZE);
      const x = v.from % MAP_SIZE + .5 + dx * v.t + dy * .13, y = Math.floor(v.from / MAP_SIZE) + .5 + dy * v.t - dx * .13;
      objects.push({ depth: x + y, draw: () => {
        const z = town.terrain[v.from] || town.terrain[v.to] ? 5 : 0;
        const w = dx ? .23 : .12, d = dy ? .23 : .12;
        ellipse(c, iso(x, y), 5, 2.5, "#29443d44");
        box(c, x - w / 2, y - d / 2, w, d, 4, [v.color, "#64796c", v.color], z);
        box(c, x - w * .27, y - d * .27, w * .54, d * .54, 2, ["#b8dbd1", "#6b9397", "#e1ecdc"], z + 4);
        if (options.night) ellipse(c, iso(x + dx * .12, y + dy * .12, z + 2), 3, 1.5, "#fff1b4");
      } });
    }
    for (let r = 0; r < Math.min(options.routes.length, 12); r++) {
      const route = options.routes[r]!;
      const max = route.length - 1, travel = max - .68, phase = (time * .45 + r * 4) % (travel * 2 + 4);
      const center = .34 + Math.min(travel, phase <= travel + 2 ? Math.max(0, phase - 1) : Math.max(0, travel * 2 + 3 - phase));
      for (let wagon = 0; wagon < 3; wagon++) {
        // Keep the whole train on the route; cars must not collapse into one at the terminus.
        const pos = Math.max(0, Math.min(max, center + (wagon - 1) * .34)), segment = Math.min(max - 1, Math.floor(pos));
        const a = route[segment]!, b = route[segment + 1]!, t = pos - segment;
        const dx = b % MAP_SIZE - a % MAP_SIZE, dy = Math.floor(b / MAP_SIZE) - Math.floor(a / MAP_SIZE);
        const x = a % MAP_SIZE + .5 + dx * t, y = Math.floor(a / MAP_SIZE) + .5 + dy * t;
        objects.push({ depth: x + y, draw: () => {
          const w = dy ? .20 : .29, d = dy ? .29 : .20, z = town.terrain[a] || town.terrain[b] ? 5 : 0;
          box(c, x - w / 2, y - d / 2, w, d, 9, ["#f3e5bf", "#8d9e94", "#4d807a"], z);
          patch(c, x - w / 2, y - d / 2, w, d, "#d9e1cb", z + 9);
          line(c, iso(x - w / 2, y + d / 2, z + 4), iso(x + w / 2, y + d / 2, z + 4), "#c37c5e", 2);
          poly(c, [iso(x - w / 3, y + d / 2, z + 5), iso(x + w / 3, y + d / 2, z + 5), iso(x + w / 3, y + d / 2, z + 8), iso(x - w / 3, y + d / 2, z + 8)], options.night ? "#ffe9a7" : "#739a9c");
        } });
      }
    }
    objects.sort((a, b) => a.depth - b.depth).forEach(o => o.draw());
    if (options.night) { c.save(); c.globalCompositeOperation = "multiply"; patch(c, 0, 0, MAP_SIZE, MAP_SIZE, "#849fad"); c.restore(); }
    const highlight = (i: number, color: string, fill: string) => { const x = i % MAP_SIZE, y = Math.floor(i / MAP_SIZE); poly(c, [iso(x, y, 1), iso(x + 1, y, 1), iso(x + 1, y + 1, 1), iso(x, y + 1, 1)], fill, color, 1.8); };
    if (options.selected !== null) highlight(options.selected, "#fbebaf", "#f1d68a20");
    for (const i of options.preview.length ? options.preview : options.hover !== null && options.tool !== "pan" ? [options.hover] : []) {
      const tile = town.tiles[i];
      const hasAccess = !["house", "shop", "factory"].includes(options.tool) || touchesRoad(town.tiles, i % MAP_SIZE, Math.floor(i / MAP_SIZE));
      const allowed = options.tool === "inspect" || options.tool === "bulldoze" || tile === "grass" && hasAccess || tile === "water" && ["rail", "road"].includes(options.tool);
      highlight(i, allowed ? "#ffffdd" : "#e68c76", allowed ? "#fffdc842" : "#ef957944");
      if (allowed && ["house", "shop", "factory", "park", "station"].includes(options.tool)) { c.globalAlpha = .55; building(c, options.tool as Tile, i % MAP_SIZE, Math.floor(i / MAP_SIZE), 1, options.night, time); c.globalAlpha = 1; }
    }
    c.restore();
  }
}
export function drawTownIcon(c: CanvasRenderingContext2D, kind: Tool, width: number, height: number) {
  // Leave room for the taller buildings and their cast shadows on all four sides.
  const scale = .72;
  c.clearRect(0, 0, width, height); c.save(); c.translate(width * .5 - 4, height - 32 * scale - 5); c.scale(scale, scale);
  if (kind === "bulldoze") {
    box(c, -.3, -.25, .6, .4, 8, ["#d9ac5d", "#b98843", "#f2cb7e"]);
    box(c, -.15, -.22, .25, .28, 12, ["#8caca4", "#527d78", "#f0c775"], 8);
    box(c, .3, -.3, .05, .6, 8, ["#b4b9a2", "#7f917f", "#d5d5be"]);
  } else if (kind === "road" || kind === "rail") {
    const town = createIconTown(kind); transport(c, town, 0, 0, kind, false);
  } else building(c, kind, 0, 0, 1, false, 0, false);
  c.restore();
}
function createIconTown(kind: "road" | "rail"): Town {
  const tiles = Array<Tile>(MAP_SIZE ** 2).fill("grass"); tiles[0] = kind; tiles[1] = kind;
  return { tiles, levels: [], terrain: [], rewards: [], money: 0, day: 1, paused: true };
}
