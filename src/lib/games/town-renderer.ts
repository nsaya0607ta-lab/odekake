import { MAP_SIZE, PARK_PARTS, canBuyPark, canCross, canPlaceParkPart, crossingAxis, isRailTile, isRoadTile, lotTiles, neighbours, opens, parkAt, parkFootprint, strokeAxes, touchesRoad, type FacilityPart, type ParkLot, type ParkPart, type ParkSize, type Tile, type Town, type Tool } from "./town-builder";
import { DIRECTIONS, elevationAt, measureTransportRoute, sampleTransportDistance, stationAxis, trackPaths, trackPoint, transportHeight, transportMask, transportOutline, type TransportKind, type TransportRoute } from "./town-transport";
import { clockDials, drawTownDecoration, decorationPickFaces } from "./town-decorations";
import { PARK_ART_HEIGHT, PARK_ART_LIGHTS, PARK_ART_SWAY, drawParkArt, parkArtVariant } from "./town-park-art";
import { tanabataSeason } from "./town-park-motion";
import { parkGates } from "./town-park-paths";
import { Traffic } from "./town-traffic";
import { drawVehicle } from "./town-vehicles";
import { plusSide, poleWires as wireSpans, roadLayout, signalState, type RoadLayout } from "./town-road-parts";
import { busShelter, busSign, curveMirror, facesViewer, footbridge, guardrail, poleWires, postBox, roadMarkings, roadPaving, signalLight, signalPost, stopSign, streetTree, utilityPole, vendingMachine, walkLight, wireBird, wirePoint } from "./town-road-art";
import { TownSprites, type SpriteBounds } from "./town-sprites";
import { buildingHeight, buildingLevel, buildingVolumes, factoryLayout, facilityLayout, roofFeatures, type FacilityPlacement } from "./town-building-models";
import { lightGradient, NIGHT_AMBIENT, paintState, resetPaintState, shade, snowy, type TreePalette } from "./town-paint";
import { mixColor, type TownEnvironment } from "./town-environment";
import { drawCloudShadows, drawFog, drawPrecipitation, drawSplashes, lightningFlash, SkyPainter, skyHorizon } from "./town-sky";
import { drawDog, TownLife } from "./town-life";

type Point = { x: number; y: number };
export type TownCamera = { x: number; y: number; zoom: number };
export type SceneOptions = { night: boolean; environment?: TownEnvironment; grid: boolean; hover: number | null; selected: number | null; preview: number[]; tool: Tool | "inspect" | "pan" | "decorate"; routes: number[][]; paused: boolean; speed: number; parkSize?: ParkSize; parkKind?: ParkLot["kind"]; parkRotated?: boolean; editLot?: number; parkPart?: ParkPart | "remove"; partRotation?: number };
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
  poly(c, [iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)], snowy(fill));
}
function box(c: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, h: number, colors: string[], z = 0) {
  poly(c, [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)], colors[0]!);
  poly(c, [iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)], colors[1]!);
  patch(c, x, y, w, d, colors[2]!, z + h);
  // Shared bevels and contact edges make even the smallest fittings read as solids.
  line(c, iso(x, y + d, z + h), iso(x + w, y + d, z + h), "#fff9e747", .45);
  line(c, iso(x + w, y, z + h), iso(x + w, y + d, z + h), "#f7f9e32b", .4);
  line(c, iso(x + w, y + d, z), iso(x + w, y + d, z + h), "#30483830", .45);
}
function glaze(c: CanvasRenderingContext2D, points: Point[], light: string, dark: string) {
  const top = Math.min(...points.map(p => p.y)), bottom = Math.max(...points.map(p => p.y));
  const g = c.createLinearGradient(0, top, 0, bottom); g.addColorStop(0, light); g.addColorStop(1, dark); poly(c, points, g);
}
function blossom(c: CanvasRenderingContext2D, p: Point, color: string, size = 1) {
  line(c, { x: p.x, y: p.y + 2 }, p, "#4d7950", .45);
  for (let j = 0; j < 5; j++) { const a = j * Math.PI * 2 / 5; ellipse(c, { x: p.x + Math.cos(a) * size, y: p.y + Math.sin(a) * size * .6 }, size * .72, size * .55, color); }
  ellipse(c, p, size * .4, size * .3, "#f4d783");
}
function shadow(c: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, h: number) {
  const p = iso(x + w, y + d);
  c.save(); c.shadowColor = "#25463225"; c.shadowBlur = 2;
  poly(c, [iso(x, y + d), p, { x: p.x + h * .8, y: p.y + h * .22 }, { x: iso(x + w, y).x + h * .8, y: iso(x + w, y).y + h * .22 }, iso(x + w, y)], "#234e3735");
  c.restore();
  line(c, iso(x, y + d), iso(x + w, y + d), "#526d453a", 1.5);
}
const PALETTES: Record<Exclude<TreePalette, "bare">, string[]> = {
  default: ["#3e7955", "#62a565", "#80b872"], fresh: ["#4f8e57", "#7db866", "#b2d68a"], lush: ["#2d6745", "#4b8f55", "#70aa63"],
  yellow: ["#b7892c", "#dcb447", "#f2d778"], orange: ["#c99767", "#ebbb7b", "#f5d191"], red: ["#a54a3b", "#cf6c4c", "#eb9a6e"],
};
const BLOSSOM = ["#cf8aa0", "#eeb6c6", "#ffe6ec"];
/** Season of one deciduous tree: each tree turns and drops its leaves at its own time. */
function treePalette(seed: number, variant: number): TreePalette | "blossom" {
  if (paintState.season === "default") return variant > .88 ? "orange" : "default";
  const h = hash(seed * 1.37 + 5);
  // Japanese streets are lined with cherry trees: a third of the round trees bloom together.
  if (paintState.blossom > .15 && (variant > .8 || hash(seed * 2.31 + 9) < .34)) return "blossom";
  if (h < paintState.bare) return "bare";
  if (h < paintState.foliage * 1.05) return (["yellow", "orange", "red"] as const)[Math.floor(hash(seed * 3.1) * 3)]!;
  return paintState.lush > .35 ? "lush" : paintState.season === "spring" ? "fresh" : "default";
}
function tree(c: CanvasRenderingContext2D, x: number, y: number, size: number, variant: number, time = 0, chosen?: TreePalette | "blossom") {
  // Trees inside building artwork follow the season too, each at its own pace.
  const palette = chosen ?? (paintState.season === "default" ? variant > .88 ? "orange" : "default" : treePalette(Math.round(x * 97 + y * 13), variant));
  const p = iso(x, y), sway = Math.sin(time * .6 + x) * .4;
  ellipse(c, { x: p.x + 5, y: p.y + 1 }, size * .6, size * .25, "#245a3436");
  line(c, p, { x: p.x + sway, y: p.y - size }, "#786744", size * .17);
  line(c, { x: p.x - size * .03, y: p.y - 1 }, { x: p.x - size * .03 + sway, y: p.y - size }, "#b5a07a", size * .04);
  for (const s of [-1, 1]) line(c, { x: p.x, y: p.y - size * .55 }, { x: p.x + s * size * .3, y: p.y - size * 1.15 }, "#796c4f", size * .075);
  if (variant < .3) {
    for (let j = 0; j < 4; j++) { const base = p.y - size * (.38 + j * .39), spread = size * (.64 - j * .13), tip = base - size * .92;
      glaze(c, [{ x: p.x - spread, y: base }, { x: p.x + sway, y: tip }, { x: p.x + spread, y: base - size * .03 }, { x: p.x + spread * .28, y: base + size * .12 }], "#5b9270", "#285c47");
      line(c, { x: p.x - spread * .80, y: base - size * .06 }, { x: p.x + sway, y: tip + size * .15 }, paintState.snow ? "#f3f6f8" : "#94b77b55", paintState.snow ? size * .09 : .7);
    }
  } else if (palette === "bare") {
    // Winter branches: a fine crown of twigs, with snow resting on the upper boughs.
    for (let j = 0; j < 9; j++) {
      const a = -Math.PI / 2 + (j - 4) * .3, len = size * (.55 + hash(j + x) * .35), from = { x: p.x, y: p.y - size * (.7 + (j % 3) * .2) };
      const to = { x: from.x + Math.cos(a) * len * .8 + sway, y: from.y + Math.sin(a) * len };
      line(c, from, to, "#7a6a52", size * .045);
      line(c, to, { x: to.x + Math.cos(a - .5) * len * .3, y: to.y + Math.sin(a - .5) * len * .3 }, "#8a7a62", size * .025);
      if (paintState.snow) line(c, { x: to.x - 1, y: to.y }, { x: to.x + 1, y: to.y - .4 }, "#f4f7f9", size * .05);
    }
  } else {
    const colors = palette === "blossom" ? BLOSSOM : PALETTES[palette];
    for (const [u, v, r] of [[.26, 1.19, .48], [-.30, 1.24, .46], [.02, 1.65, .54], [-.28, 1.71, .34], [.32, 1.52, .31]]) {
      const q = { x: p.x + u! * size + sway, y: p.y - v! * size }, radius = size * r!;
      const g = c.createRadialGradient(q.x - radius * .35, q.y - radius * .45, 0, q.x, q.y, radius * 1.15);
      g.addColorStop(0, colors[2]!); g.addColorStop(.48, colors[1]!); g.addColorStop(1, colors[0]!); ellipse(c, q, radius, radius * 1.05, g);
      if (paintState.snow) ellipse(c, { x: q.x - radius * .15, y: q.y - radius * .55 }, radius * .7, radius * .38, "#f2f5f8e6");
    }
    for (let j = 0; j < 10; j++) { const a = j * 2.4, r = size * (.16 + hash(j + 5) * .38); ellipse(c, { x: p.x + Math.cos(a) * r + sway, y: p.y - size * 1.5 + Math.sin(a) * r }, size * .055, size * .034, palette === "blossom" ? j % 3 ? "#fff3f6c0" : "#b8708650" : j % 3 ? "#d5e6ae50" : "#23533e38"); }
  }
}
function windows(c: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, floors: number, night: boolean, seed: number, entrance = true, base = 0) {
  for (let floor = 0; floor < floors; floor++) {
    for (let j = 0; j < 3; j++) {
      const z = base + 7 + floor * 12;
      const color = night && hash(seed + j + floor * 7) > paintState.litThreshold ? "#ffe6a2" : "#779f9e";
      const wx = x + .09 + j * w / 3;
      if (!(entrance && floor === 0 && j === 1)) {
        poly(c, [iso(wx - .018, y + d + .003, z - .8), iso(wx + .123, y + d + .003, z - .8), iso(wx + .123, y + d + .003, z + 6.8), iso(wx - .018, y + d + .003, z + 6.8)], "#536c614d");
        poly(c, [iso(wx, y + d + .004, z), iso(wx + .105, y + d + .004, z), iso(wx + .105, y + d + .004, z + 6), iso(wx, y + d + .004, z + 6)], color);
        line(c, iso(wx - .015, y + d + .005, z), iso(wx + .12, y + d + .005, z), "#f6ecd2", 1);
        line(c, iso(wx + .052, y + d + .009, z), iso(wx + .052, y + d + .009, z + 6), "#ece9d4", .55);
        line(c, iso(wx, y + d + .009, z + 3), iso(wx + .105, y + d + .009, z + 3), "#f7efda96", .45);
        line(c, iso(wx + .015, y + d + .01, z + 4.5), iso(wx + .045, y + d + .01, z + 5.8), "#ffffff78", .6);
      }
      const wy = y + .09 + j * d / 3;
      poly(c, [iso(x + w + .004, wy, z), iso(x + w + .004, wy + .10, z), iso(x + w + .004, wy + .10, z + 6), iso(x + w + .004, wy, z + 6)], color);
      line(c, iso(x + w + .008, wy, z), iso(x + w + .008, wy + .10, z), "#eee2c0", .7);
      line(c, iso(x + w + .008, wy + .05, z), iso(x + w + .008, wy + .05, z + 6), "#cfcbb2", .5);
    }
  }
}
function pitchedRoof(c: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, h: number, roof: string, shadowSide: string) {
  const ridgeA = iso(x, y + d / 2, h + 13), ridgeB = iso(x + w, y + d / 2, h + 13), color = snowy(roof, .8), dark = snowy(shadowSide, .7);
  poly(c, [iso(x, y, h), iso(x + w, y, h), ridgeB, ridgeA], dark);
  poly(c, [ridgeA, ridgeB, iso(x + w, y + d, h), iso(x, y + d, h)], color);
  poly(c, [iso(x + w, y, h), ridgeB, iso(x + w, y + d, h)], "#e8d7b8");
  glaze(c, [ridgeA, ridgeB, iso(x + w, y + d, h), iso(x, y + d, h)], "#ffffff24", "#352d3e35");
  for (let row = 1; row < 5; row++) { const t = row / 5, yy = y + d / 2 + t * d / 2, z = h + 13 * (1 - t);
    line(c, iso(x, yy, z), iso(x + w, yy, z), "#493f4938", .5);
    for (let col = 0; col < 7; col++) { const xx = x + (col + (row % 2 ? .5 : 0)) * w / 7; line(c, iso(xx, yy, z), iso(xx, yy + d / 10, z - 2.6), "#f5e7d522", .4); }
  }
  for (let t = .13; t < 1; t += .13) line(c, iso(x + w * t, y + d / 2, h + 13), iso(x + w * t, y + d, h), "#ffffff21", .7);
  line(c, ridgeA, ridgeB, "#ffffff6b", 1);
  line(c, iso(x, y + d, h - .8), iso(x + w, y + d, h - .8), "#675b54", 1.2);
  line(c, iso(x + w, y + d, h), iso(x + w, y + d, h - 3), "#c9b692", .8);
}
function lamp(c: CanvasRenderingContext2D, x: number, y: number, night: boolean) {
  const p = iso(x, y); ellipse(c, { x: p.x + 3, y: p.y + 1 }, 4, 1.8, "#25453728");
  box(c, x - .025, y - .025, .05, .05, 1.6, ["#688079", "#405e5a", "#a3b7a1"]);
  line(c, p, { x: p.x, y: p.y - 21 }, "#486365", 1.5);
  line(c, { x: p.x - .35, y: p.y - 2 }, { x: p.x - .35, y: p.y - 20.5 }, "#b6c8b4", .45);
  line(c, { x: p.x, y: p.y - 21 }, { x: p.x + 5, y: p.y - 23 }, "#486365", 1.2);
  ellipse(c, { x: p.x + 5, y: p.y - 23 }, 3, 1.5, night ? "#ffe6a1" : "#dfead8");
  line(c, { x: p.x + 2, y: p.y - 24 }, { x: p.x + 7, y: p.y - 24 }, "#617975", .75);
  if (night) {
    const g = lightGradient(c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 19)); g.addColorStop(0, "#ffdd7745"); g.addColorStop(1, "#ffdd7700"); ellipse(c, p, 19, 10, g);
    const bulb = lightGradient(c.createRadialGradient(p.x + 5, p.y - 23, 0, p.x + 5, p.y - 23, 9)); bulb.addColorStop(0, "#ffe7a866"); bulb.addColorStop(1, "#ffe7a800"); ellipse(c, { x: p.x + 5, y: p.y - 21 }, 9, 7, bulb);
  }
}
function parkPart(c: CanvasRenderingContext2D, kind: ParkPart, x: number, y: number, rotation: number, night: boolean, palette?: TreePalette | "blossom", variant = 0) {
  if (drawParkArt(c, kind, x, y, rotation, night, variant)) return;
  if (drawTownDecoration(c, kind, x, y, rotation, night)) return;
  const at = (u: number, v: number, z = 0) => {
    const p = rotation % 4 === 1 ? [1 - v, u] : rotation % 4 === 2 ? [1 - u, 1 - v] : rotation % 4 === 3 ? [v, 1 - u] : [u, v];
    return iso(x + p[0]!, y + p[1]!, z);
  };
  const b = (u: number, v: number, w: number, d: number, h: number, colors: string[], z = 1) => {
    const p = rotation % 4 === 1 ? [1 - v - d / 2, u + w / 2] : rotation % 4 === 2 ? [1 - u - w / 2, 1 - v - d / 2] : rotation % 4 === 3 ? [v + d / 2, 1 - u - w / 2] : [u + w / 2, v + d / 2];
    const dx = [1, 0, -1, 0][rotation % 4]!, dy = [0, 1, 0, -1][rotation % 4]!;
    orientedBox(c, x + p[0]!, y + p[1]!, w, d, h, dx, dy, colors, z);
  };
  if (kind === "tree") {
    box(c, x + .30, y + .30, .4, .4, 1, ["#a29270", "#7b815c", "#a8b67e"]);
    for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4; ellipse(c, iso(x + .5 + Math.cos(a) * .19, y + .5 + Math.sin(a) * .19, 1.6), 1.2, .6, "#c6c4a3"); }
    tree(c, x + .5, y + .5, 13, .6, 0, palette && palette in PALETTES || palette === "bare" || palette === "blossom" ? palette : "default"); return;
  }
  if (kind === "light") { lamp(c, x + .5, y + .5, night); return; }
  if (kind === "path") { b(.08, .32, .84, .36, .8, ["#b8ac90", "#a89980", "#e4d7b6"], 0); for (let j = 1; j < 5; j++) line(c, at(.08 + j * .168, .32, .9), at(.08 + j * .168, .68, .9), "#b4a78a", .5); line(c, at(.08, .50, .9), at(.92, .50, .9), "#c6b899", .4); return; }
  if (kind === "flowers") {
    b(.14, .18, .72, .62, 2, ["#b4a389", "#938672", "#cabc9d"]);
    b(.18, .22, .64, .54, .3, ["#71805c", "#627454", "#6c7650"], 3);
    const dormant = paintState.snow || paintState.season === "winter" && paintState.bare > .5;
    for (let j = 0; j < 18; j++) {
      const p = at(.22 + hash(j + 31) * .55, .27 + hash(j + 8) * .43, 5);
      ellipse(c, { x: p.x - .9, y: p.y + 1.2 }, 1.8, .7, dormant ? paintState.snow ? "#eef2f4" : "#8c8a6e" : "#8dac67");
      if (!dormant || j % 6 === 0) blossom(c, p, dormant ? "#e9e4d6" : ["#f0c968", "#d57b96", "#f6efd5", "#9b92c0"][j % 4]!, .95);
    }
    return;
  }
  if (kind === "fountain") {
    const p = at(.5, .5); ellipse(c, { x: p.x + 3, y: p.y + 2 }, 17, 7.5, "#324e3c30");
    ellipse(c, p, 15.8, 7.5, "#7e928c"); ellipse(c, { x: p.x, y: p.y - 1.8 }, 15.8, 7.5, "#a2b4ac"); ellipse(c, { x: p.x, y: p.y - 3 }, 15.8, 7.5, "#e5e5d4");
    ellipse(c, { x: p.x, y: p.y - 3 }, 12.7, 5.8, "#859f98");
    const water = c.createRadialGradient(p.x - 5, p.y - 4, 1, p.x, p.y - 3, 13); water.addColorStop(0, "#c4ede3"); water.addColorStop(.5, "#7bc9c8"); water.addColorStop(1, "#4f9fae");
    ellipse(c, { x: p.x, y: p.y - 2.6 }, 12, 5.2, water);
    for (let j = 0; j < 10; j++) { const a = j * Math.PI / 5; line(c, { x: p.x + Math.cos(a) * 13, y: p.y - 3 + Math.sin(a) * 6 }, { x: p.x + Math.cos(a) * 15.6, y: p.y - 3 + Math.sin(a) * 7.3 }, "#b0b6a1", .55); }
    b(.45, .45, .10, .10, 5, ["#abc6ba", "#759e96", "#e2ece0"], 2);
    ellipse(c, { x: p.x, y: p.y - 6 }, 4.8, 2.1, "#e2e5d3"); ellipse(c, { x: p.x, y: p.y - 6.4 }, 3.8, 1.5, "#80c7c9");
    for (const s of [-1, 1]) { line(c, { x: p.x + s * 3.4, y: p.y - 6 }, { x: p.x + s * 6.5, y: p.y - 2.5 }, "#e0f5e995", .7); }
    ellipse(c, { x: p.x - 6, y: p.y - 2 }, 2.8, .6, "#d7f2e58a"); return;
  }
  if (kind === "bench") {
    const pieces = [
      { depth: at(.51, .39).y, paint: () => {
        for (const u of [.20, .78]) line(c, at(u, .39, 4), at(u, .39, 10.6), "#496d5d", 1);
        for (let j = 0; j < 3; j++) b(.17, .37, .68, .04, 1.3, ["#b69470", "#896e50", "#e0c297"], 6 + j * 1.65);
      } },
      { depth: at(.51, .50).y, paint: () => {
        for (const u of [.23, .68]) b(u, .40, .045, .19, 3, ["#4e6d62", "#395d53", "#6f8b75"]);
        for (let j = 0; j < 4; j++) b(.17, .37 + j * .063, .68, .052, 1.5, ["#ab825c", "#785b43", j % 2 ? "#d9b788" : "#cba577"], 4);
      } },
      ...[.20, .78].map(u => ({ depth: at(u, .51).y, paint: () => { line(c, at(u, .39, 8), at(u, .61, 8), "#547663", 1); line(c, at(u, .61, 5.5), at(u, .61, 8), "#496d5d", .8); } })),
    ];
    pieces.sort((a, b) => a.depth - b.depth).forEach(piece => piece.paint());
    return;
  }
  // Four narrow columns support the platform; separate posts meet the pitched roof.
  b(.08, .08, .82, .84, .7, ["#be9b80", "#a58471", "#dbc3a1"], 0);
  const pieces = [
    { depth: at(.27, .14).y, paint: () => {
      line(c, at(.18, .20, 14), at(.08, .08, .7), "#749b93", 1.2); line(c, at(.48, .20, 14), at(.37, .08, .7), "#749b93", 1.2);
      for (let j = 1; j < 6; j++) { const t = j / 6, v = .20 - .12 * t, z = 14 - 13.3 * t; line(c, at(.18 - .10 * t, v, z), at(.48 - .11 * t, v, z), "#d4d3aa", .8); }
    } },
    { depth: at(.34, .35).y, paint: () => {
      const posts = [[.19, .20], [.455, .20], [.19, .455], [.455, .455]].sort((a, b) => at(a[0]!, a[1]!).y - at(b[0]!, b[1]!).y);
      for (const [u, v] of posts) b(u!, v!, .035, .035, 11.3, ["#967553", "#765d45", "#c09f75"], .7);
      b(.18, .18, .32, .34, 2, ["#d18c74", "#a77160", "#eac3a1"], 12);
      for (const u of [.19, .46]) for (const v of [.18, .48]) {
        const roof = 25 - 3 * Math.abs(v - .34) / .22;
        b(u - .012, v - .012, .024, .024, roof - .6 - 14, ["#648e80", "#4e7b70", "#a7c3a0"], 14);
      }
      for (const u of [.19, .46]) { line(c, at(u, .18, 19), at(u, .48, 19), "#a7c3a0", 1); for (const v of [.28, .38]) line(c, at(u, v, 14), at(u, v, 19), "#648e80", .7); }
      line(c, at(.19, .18, 19), at(.46, .18, 19), "#a7c3a0", 1);
    } },
    { depth: at(.48, .71).y, paint: () => {
      b(.43, .85, .25, .055, .7, ["#7a9e99", "#587f79", "#abc5b1"], .7);
      poly(c, [at(.27, .51, 13), at(.46, .51, 13), at(.68, .90, 1.4), at(.43, .90, 1.4)], "#98bdc3", "#e2e9d7", .6);
      const rails = [[.27, .43], [.46, .68]].sort((a, b) => at((a[0]! + a[1]!) / 2, .71).y - at((b[0]! + b[1]!) / 2, .71).y);
      for (const [u, end] of rails) poly(c, [at(u!, .51, 13), at(end!, .90, 1.4), at(end!, .90, 2.4), at(u!, .51, 15)], "#b3cec4", "#e2e9d7", .5);
    } },
  ];
  pieces.sort((a, b) => a.depth - b.depth).forEach(piece => piece.paint());
  const panels = [.12, .56].map(v => ({ v, depth: at(.32, (.34 + v) / 2).y })).sort((a, b) => a.depth - b.depth);
  for (const { v } of panels) {
    const edgeA = at(.12, v, 22), edgeB = at(.52, v, 22), ridgeA = at(.12, .34, 25), ridgeB = at(.52, .34, 25);
    poly(c, [edgeA, edgeB, ridgeB, ridgeA], at(.32, v).y > at(.32, .34).y ? "#9abda5" : "#659183", "#b8d0b26b", .5);
    for (let j = 1; j < 4; j++) { const t = j / 4; line(c, at(.12, .34 + (v - .34) * t, 25 - 3 * t), at(.52, .34 + (v - .34) * t, 25 - 3 * t), "#d0debe55", .4); }
  }
  const end = at(.52, .34).y > at(.12, .34).y ? .52 : .12;
  poly(c, [at(end, .12, 22), at(end, .34, 25), at(end, .56, 22)], "#759d86", "#b8d0b26b", .4);
}
function crate(c: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, h: number, z = 0) {
  box(c, x, y, w, d, h, ["#b79b72", "#8e795b", "#d9c29a"], z);
  for (let j = 1; j < 4; j++) { line(c, iso(x, y + d, z + h * j / 4), iso(x + w, y + d, z + h * j / 4), "#826845", .4); line(c, iso(x + w, y, z + h * j / 4), iso(x + w, y + d, z + h * j / 4), "#6c624a", .4); }
  line(c, iso(x + .015, y + d, z + .5), iso(x + w - .015, y + d, z + h - .5), "#e1c49a", .8);
  line(c, iso(x + w, y + .01, z + h), iso(x + w, y + d - .01, z + .5), "#b49f77", .7);
}
function solarPanel(c: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, z: number) {
  const at = (u: number, v: number, lift = 0) => iso(x + u, y + v, z + 1.2 + 3 * (1 - v / d) + lift);
  patch(c, x, y, w, d, "#254f4024", z + .05);
  for (const u of [.035, w - .035]) for (const v of [.025, d - .025]) {
    const height = 1.2 + 3 * (1 - v / d);
    box(c, x + u - .01, y + v - .01, .02, .02, height, ["#98aba0", "#5e7e79", "#c6d2bb"], z);
  }
  poly(c, [at(0, d, -.6), at(w, d, -.6), at(w, d), at(0, d)], "#708d8a");
  poly(c, [at(w, 0, -.6), at(w, d, -.6), at(w, d), at(w, 0)], "#476d72");
  poly(c, [at(0, 0), at(w, 0), at(w, d), at(0, d)], "#a8bbb0", "#cfe0cf", .4);
  for (let u = 0; u < 4; u++) for (let v = 0; v < 2; v++) {
    const sx = .015 + u * (w - .03) / 4, sy = .012 + v * (d - .024) / 2;
    const cw = (w - .03) / 4 - .008, cd = (d - .024) / 2 - .006;
    poly(c, [at(sx, sy, .1), at(sx + cw, sy, .1), at(sx + cw, sy + cd, .1), at(sx, sy + cd, .1)], u % 2 ? "#476f89" : "#315b77");
    line(c, at(sx + cw * .5, sy, .2), at(sx + cw * .5, sy + cd, .2), "#9cc6d16b", .3);
  }
  glaze(c, [at(0, 0, .2), at(w, 0, .2), at(w, d, .2), at(0, d, .2)], "#cee4df25", "#25496612");
}
function facilityPlanter(c: CanvasRenderingContext2D, x: number, y: number, p: FacilityPlacement, level: number, flowers: boolean) {
  const u = x + p.u, v = y + p.v, rim = flowers ? 2.6 : 3.5;
  box(c, u, v, p.w, p.d, rim, level === 1 ? ["#b99b79", "#907955", "#dec49b"] : ["#b6c5ad", "#829e8b", "#e0e1c4"], p.z);
  patch(c, u + .008, v + .008, p.w - .016, p.d - .016, "#626f49", p.z + rim + .05);
  for (let j = 0; j < (flowers ? 4 : 3); j++) {
    const center = iso(u + p.w * (j + .5) / (flowers ? 4 : 3), v + p.d / 2, p.z + rim);
    line(c, center, { x: center.x, y: center.y - (flowers ? 1.5 : 2) }, "#63864f", .4);
    if (flowers) blossom(c, { x: center.x, y: center.y - 1.5 }, j % 2 ? "#e5c278" : "#d9979d", .55);
    else {
      ellipse(c, { x: center.x - .5, y: center.y - 1.2 }, .8, 1.1, "#5d8956");
      ellipse(c, { x: center.x + .5, y: center.y - 2 }, .75, 1.0, "#92b476");
    }
  }
}
function seating(c: CanvasRenderingContext2D, x: number, y: number, p: FacilityPlacement, level: number, night: boolean, furnished: boolean, covered: boolean) {
  const u = x + p.u, v = y + p.v, { w, d, z } = p, floor = z + .8;
  const at = (a: number, b: number, h: number) => iso(u + a * w, v + b * d, h);
  box(c, u, v, w, d, .8, level === 1 ? ["#b29875", "#887658", "#d6bd94"] : ["#a9b6a2", "#7f978b", "#e4dfc5"], z);
  for (let j = 1; j < 6; j++) line(c, at(j / 6, 0, floor + .05), at(j / 6, 1, floor + .05), "#8b957b5c", .35);
  const post = (a: number, b: number) => {
    const roof = floor + 9.5 + (1 - b) * .8;
    box(c, u + a * w - .007, v + b * d - .007, .014, .014, roof - .5 - floor, ["#93a78d", "#678879", "#d3dfbd"], floor);
    line(c, at(a, b, roof - 2), at(a + (a < .5 ? .11 : -.11), b, roof - .5), "#9bb196", .5);
  };
  if (covered) for (const a of [.07, .93]) post(a, .08);
  if (p.mount === "roof") for (const a of [0, 1]) {
    poly(c, [at(a, 0, floor), at(a, 1, floor), at(a, 1, floor + 3), at(a, 0, floor + 3)], level === 3 ? "#bfd9cb55" : "#bbcdb64a", "#8eac95", .4);
    line(c, at(a, 0, floor + 3), at(a, 1, floor + 3), "#cdddbe", .5);
  }
  if (furnished) {
    // Chair feet and table pedestals meet the deck; the backs rise from the seat.
    for (const a of [.12, .72]) {
      const cx = u + a * w, cy = v + .30 * d, cw = w * .16, cd = d * .40;
      for (const du of [0, cw - .009]) for (const dv of [0, cd - .009]) box(c, cx + du, cy + dv, .009, .009, 2.5, ["#809c89", "#597965", "#c5d3b0"], floor);
      box(c, cx, cy, cw, cd, .6, ["#a3b798", "#7a967d", "#d2dbc0"], floor + 2.5);
      box(c, cx, cy, cw, .013, 2.6, ["#9fb490", "#72916d", "#d1dcb8"], floor + 3.1);
    }
    box(c, u + w * .47, v + d * .44, .025, .025, 4, ["#8fa28a", "#657f70", "#cfdbb5"], floor);
    box(c, u + w * .35, v + d * .29, w * .29, d * .43, .6, ["#bba985", "#8f8469", "#e5d4ad"], floor + 4);
    ellipse(c, at(.52, .46, floor + 4.65), .7, .4, "#edf0d1");
    if (!covered) {
      line(c, at(.52, .50, floor), at(.52, .50, floor + 10.5), "#7e896e", .6);
      const center = at(.52, .50, floor + 10.5), ring = Array.from({ length: 6 }, (_, j) => { const a = j * Math.PI / 3; return at(.52 + Math.cos(a) * .39, .50 + Math.sin(a) * .40, floor + 9); });
      ring.map((a, j) => ({ a, b: ring[(j + 1) % 6]!, j })).sort((a, b) => a.a.y + a.b.y - b.a.y - b.b.y).forEach(({ a, b, j }) => poly(c, [center, a, b], j % 2 ? "#e7dfbf" : "#a3bba1", "#b5b89770", .35));
    }
  }
  if (p.mount === "roof") {
    poly(c, [at(0, 1, floor), at(1, 1, floor), at(1, 1, floor + 3), at(0, 1, floor + 3)], level === 3 ? "#bfd9cb55" : "#bbcdb64a");
    for (const a of [0, .5, 1]) line(c, at(a, 1, floor), at(a, 1, floor + 3), "#8caa91", .4);
    line(c, at(0, 1, floor + 3), at(1, 1, floor + 3), "#dae3c5", .55);
  }
  if (covered) {
    for (const a of [.07, .93]) post(a, .92);
    const roofAt = (a: number, b: number, h = 0) => at(a, b, floor + 9.5 + (1 - b) * .8 + h);
    poly(c, [roofAt(0, 1, -.5), roofAt(1, 1, -.5), roofAt(1, 1), roofAt(0, 1)], "#91a68b");
    poly(c, [roofAt(1, 0, -.5), roofAt(1, 1, -.5), roofAt(1, 1), roofAt(1, 0)], "#718f7d");
    for (let j = 0; j < 5; j++) poly(c, [roofAt(j / 5, 0), roofAt((j + 1) / 5, 0), roofAt((j + 1) / 5, 1), roofAt(j / 5, 1)], j % 2 ? "#e7dfbe" : "#a4bca0");
    if (night) line(c, roofAt(.1, .92, -.7), roofAt(.9, .92, -.7), "#e8d09a", .55);
  }
}
function compactVending(c: CanvasRenderingContext2D, x: number, y: number, p: FacilityPlacement, night: boolean) {
  const u = x + p.u, v = y + p.v, z = p.z;
  box(c, u, v, p.w, p.d, p.height, ["#a7bab0", "#688d85", "#d9dac4"], z);
  const at = (a: number, h: number) => iso(u + a * p.w, v + p.d + .003, z + h * p.height);
  poly(c, [at(.1, .34), at(.73, .34), at(.73, .86), at(.1, .86)], night ? "#c9e6c3" : "#6a9c9d");
  for (let row = 0; row < 3; row++) for (let j = 0; j < 3; j++) line(c, at(.20 + j * .20, .42 + row * .15), at(.20 + j * .20, .50 + row * .15), ["#e5be7c", "#d98b85", "#dbe4bf"][j]!, .45);
  poly(c, [at(.12, .10), at(.73, .10), at(.73, .23), at(.12, .23)], "#3b5c54");
  for (const h of [.45, .60, .75]) ellipse(c, at(.87, h), .27, .27, "#e2dcb5");
}
function facilityParts(c: CanvasRenderingContext2D, kind: Tile, x: number, y: number, level: number, parts: FacilityPart[], night: boolean, axis: "x" | "y", behind = false) {
  if (kind === "station") {
    if (behind) return;
    const extra = (part: string, u: number, v: number, scale: number, r = 0) => {
      const p = iso(x + u, y + v, 3 - scale);
      c.save(); c.translate(p.x, p.y); c.scale(scale, scale); drawTownDecoration(c, part, 0, 0, r, night); c.restore();
    };
    if (parts.includes("vending")) extra("vending", axis === "x" ? .075 : .56, axis === "x" ? .59 : .075, .40, axis === "x" ? 0 : 3);
    if (parts.includes("planter")) extra("planter", axis === "x" ? .70 : .61, axis === "x" ? .61 : .70, .30);
    if (parts.includes("light")) { c.save(); c.translate(0, -3); lamp(c, x + (axis === "y" ? .98 : .91), y + (axis === "x" ? .98 : .86), night); c.restore(); }
    if (parts.includes("bench")) {
      box(c, x + (axis === "x" ? .39 : .77), y + (axis === "x" ? .77 : .39), axis === "x" ? .32 : .09, axis === "x" ? .09 : .32, 3, ["#a48461", "#896e50", "#d5b387"], 3);
      for (let j = 0; j < 3; j++) line(c, iso(x + (axis === "x" ? .39 : .79 + j * .02), y + (axis === "x" ? .79 + j * .02 : .39), 6.2), iso(x + (axis === "x" ? .71 : .79 + j * .02), y + (axis === "x" ? .79 + j * .02 : .71), 6.2), "#866345", .45);
    }
    return;
  }
  const layout = facilityLayout(kind, level, parts).filter(p => Boolean(p.behind) === behind).sort((a, b) => a.z - b.z || a.u + a.v - b.u - b.v);
  for (const p of layout) {
    const u = x + p.u, v = y + p.v;
    if (p.part === "terrace" || p.part === "canopy") {
      if (p.part === "canopy" && parts.includes("terrace")) continue;
      seating(c, x, y, p, level, night, parts.includes("terrace"), parts.includes("canopy"));
    } else if (p.part === "garden" || p.part === "planter" || p.part === "greenbelt") {
      if (p.behind) for (let j = 0; j < 5; j++) {
        const a = p.u + j * .18;
        box(c, x + a, v, .15, p.d, 2, ["#8c9b77", "#6b8069", "#b6b995"]);
        tree(c, x + a + .075, v + p.d / 2, 4.5, .6);
      }
      else facilityPlanter(c, x, y, p, level, p.part !== "planter");
    } else if (p.part === "vending") compactVending(c, x, y, p, night);
    else if (p.part === "light") lamp(c, u + p.w / 2, v + p.d / 2, night);
    else if (p.part === "sign") {
      line(c, iso(u + .01, v + p.d / 2, 0), iso(u + .01, v + p.d / 2, 16), "#7d7056", 1.1);
      box(c, u, v, p.w, p.d, 5, ["#6c9881", "#476f63", "#d5caaa"], 10);
      const q = iso(u + p.w, v + p.d / 2, 12.5); ellipse(c, q, 1.8, 1.8, "#ead7a9"); line(c, { x: q.x - 1, y: q.y }, { x: q.x + 1, y: q.y }, "#778b67", .5);
    } else if (p.part === "storage") {
      box(c, u, v, p.w, p.d, .8, ["#8c9e8b", "#667f70", "#becaae"]);
      for (let j = 0; j < 3; j++) {
        const h = j === 1 ? 5 : 3.5, a = u + .012 + j * .115;
        crate(c, a, v + .012, .10, .065, h, .8);
        if (level === 3 && j === 1) crate(c, a + .01, v + .018, .08, .055, 3, .8 + h);
      }
    } else if (p.part === "solar") solarPanel(c, u, v, p.w, p.d, p.z);
  }
}
function station(c: CanvasRenderingContext2D, x: number, y: number, axis: "x" | "y", night: boolean, roof: boolean) {
  const alongX = axis === "x", px = x + (alongX ? .04 : .65), py = y + (alongX ? .65 : .04), w = alongX ? .92 : .34, d = alongX ? .34 : .92;
  if (!roof) {
    box(c, px, py, w, d, 3, ["#b6b8a3", "#919f92", "#e6dbc3"]);
    patch(c, px + .02, py + .02, alongX ? .88 : .045, alongX ? .045 : .88, "#e1c887", 3.1);
    for (let j = 1; j < 7; j++) { const t = j * .13; line(c, iso(px + (alongX ? t : 0), py + (alongX ? 0 : t), 3.2), iso(px + (alongX ? t : w), py + (alongX ? d : t), 3.2), "#bdbba26b", .4); }
    for (let j = 0; j < 10; j++) { const t = .08 + j * .08; ellipse(c, iso(px + (alongX ? t : .04), py + (alongX ? .04 : t), 3.3), .5, .3, "#a99759"); }
    box(c, x + .10, y + .10, .22, .23, 13, ["#f4e6c7", "#caba98", "#cf9361"]);
    poly(c, [iso(x + .14, y + .332, 4), iso(x + .28, y + .332, 4), iso(x + .28, y + .332, 10), iso(x + .14, y + .332, 10)], night ? "#ffe6a2" : "#779f9e");
    return;
  }
  for (const t of [.16, .82]) box(c, x + (alongX ? t : .86), y + (alongX ? .86 : t), .028, .028, 18, ["#809d96", "#587a73", "#cfe0d2"], 3);
  box(c, x + (alongX ? .04 : .55), y + (alongX ? .55 : .04), alongX ? .92 : .41, alongX ? .41 : .92, 3, ["#477f78", "#326760", "#75aca1"], 21);
  const rx = x + (alongX ? .04 : .55), ry = y + (alongX ? .55 : .04);
  for (let j = 1; j < 7; j++) { const t = j * .13; line(c, iso(rx + (alongX ? t : .02), ry + (alongX ? .02 : t), 24.1), iso(rx + (alongX ? t : .39), ry + (alongX ? .39 : t), 24.1), "#accbb355", .6); }
  line(c, iso(rx, ry + (alongX ? .41 : .92), 21), iso(rx + (alongX ? .92 : .41), ry + (alongX ? .41 : .92), 21), "#d0dac1", .8);
  const sx = x + (alongX ? .42 : .93), sy = y + (alongX ? .93 : .42);
  const signX = sx + (alongX ? .115 : 0), signY = sy + (alongX ? 0 : .115);
  line(c, iso(signX, signY, 3), iso(signX, signY, 21), "#587a73", 1.1);
  box(c, sx, sy, alongX ? .23 : .025, alongX ? .025 : .23, 3, ["#3f766c", "#315d55", "#cde0c4"], 12);
  const clock = iso(signX, signY, 19); ellipse(c, clock, 3, 3, night ? "#ffefc4" : "#f9f1d9");
  if (!paintState.liveClocks) {
    line(c, clock, { x: clock.x + 1.4, y: clock.y - 1.4 }, "#536c64", .7);
    line(c, clock, { x: clock.x - 1.5, y: clock.y - .3 }, "#536c64", .6);
  }
  for (let j = 0; j < 4; j++) { const a = j * Math.PI / 2; ellipse(c, { x: clock.x + Math.cos(a) * 2.3, y: clock.y + Math.sin(a) * 2.3 }, .3, .3, "#9a967b"); }
}
function factorySmoke(c: CanvasRenderingContext2D, x: number, y: number, time: number, level = 1, wind = 1, night = 0) {
  for (const [k, stack] of factoryLayout(level).stacks.entries()) for (let j = 0; j < 4; j++) {
    const t = (time * .23 + j / 4 + hash(y * MAP_SIZE + x) + k * .37) % 1, p = iso(x + stack.u + stack.w / 2, y + stack.v + stack.d / 2, stack.z + stack.height);
    c.save(); c.globalAlpha *= (1 - t) * .24; ellipse(c, { x: p.x + t * 12 * wind, y: p.y - t * (32 - Math.min(14, Math.abs(wind) * 5)) }, 3 + t * 7, 3 + t * 4, shade("#eaf0dc", night * .8)); c.restore();
  }
}
function balcony(c: CanvasRenderingContext2D, x: number, y: number, w: number, z: number, night: boolean) {
  poly(c, [iso(x + .012, y + .003, z + 1), iso(x + w - .012, y + .003, z + 1), iso(x + w - .012, y + .003, z + 10), iso(x + .012, y + .003, z + 10)], night ? "#f1d6a2" : "#83aea8");
  for (let j = 1; j < 3; j++) line(c, iso(x + w * j / 3, y + .006, z + 1), iso(x + w * j / 3, y + .006, z + 10), "#d3dfc3", .5);
  box(c, x, y, w, .075, 1, ["#b5ba9e", "#849789", "#e4dec3"], z);
  poly(c, [iso(x, y + .075, z + 1), iso(x + w, y + .075, z + 1), iso(x + w, y + .075, z + 4), iso(x, y + .075, z + 4)], night ? "#e2c78866" : "#b9d6cb7a", "#739586", .5);
  line(c, iso(x, y + .075, z + 4), iso(x + w, y + .075, z + 4), "#f1e9ca", .7);
  for (let j = 0; j <= 3; j++) line(c, iso(x + w * j / 3, y + .075, z), iso(x + w * j / 3, y + .075, z + 4), "#819b89", .45);
}
function developedBuilding(c: CanvasRenderingContext2D, kind: "house" | "shop", x: number, y: number, level: number, night: boolean, seed: number) {
  const volumes = buildingVolumes(kind, level), top = volumes[volumes.length - 1]!, total = top.z + top.height;
  shadow(c, x + .14, y + .13, .72, .70, total + 4);
  const warm = ["#d9c1a2", "#e0cbaa", "#c8d5c4"][seed % 3]!;
  for (const [k, block] of volumes.entries()) {
    const u = x + block.u, v = y + block.v, { w, d, height, z } = block;
    const colors = level === 3 ? [kind === "house" ? "#d6e1ce" : "#c6d8cd", "#8daaa0", "#e7e7ce"] : [warm, "#b3b09b", "#e6dcc1"];
    box(c, u, v, w, d, height, colors, z);
    glaze(c, [iso(u, v + d, z), iso(u + w, v + d, z), iso(u + w, v + d, z + height), iso(u, v + d, z + height)], "#fffced26", "#68806b27");
    glaze(c, [iso(u + w, v, z), iso(u + w, v + d, z), iso(u + w, v + d, z + height), iso(u + w, v, z + height)], "#c8ddd020", "#436f683d");
    const floors = Math.floor((height - 1) / 12);
    windows(c, u, v, w, d, floors, night, seed + k * 11, k === 0, z);
    for (let floor = 1; floor < floors; floor++) {
      const band = z + floor * 12 + 3;
      box(c, u - .008, v + d, w + .016, .018, .8, ["#e2dcc2", "#a9b3a0", "#f4eed5"], band);
      line(c, iso(u + w + .005, v, band), iso(u + w + .005, v + d, band), "#bfd0b7", .65);
    }
    if (kind === "house" && (level === 2 || k > 0)) for (let floor = 1; floor < floors; floor++) {
      const band = z + floor * 12 + 2;
      if (level === 2) { balcony(c, u + .045, v + d, .24, band, night); balcony(c, u + w - .285, v + d, .24, band, night); }
      else balcony(c, u + .035, v + d, w - .07, band, night);
    }
    if (kind === "shop") {
      const glass = night ? paintState.shopsOpen ? "#f5dba4" : "#56676b" : level === 3 ? "#699d9a" : "#82b4ad";
      const low = z + 3, high = z + Math.min(height - 3, k === 0 ? 13 : 10);
      poly(c, [iso(u + .035, v + d + .004, low), iso(u + w - .035, v + d + .004, low), iso(u + w - .035, v + d + .004, high), iso(u + .035, v + d + .004, high)], glass);
      for (let j = 1; j < 5; j++) line(c, iso(u + w * j / 5, v + d + .009, low), iso(u + w * j / 5, v + d + .009, high), "#e5e8cb", .65);
      poly(c, [iso(u + w + .004, v + .045, low), iso(u + w + .004, v + d - .045, low), iso(u + w + .004, v + d - .045, high), iso(u + w + .004, v + .045, high)], night ? paintState.shopsOpen ? "#dfc694" : "#4e5e62" : "#608e91");
      for (let j = 1; j < 4; j++) line(c, iso(u + w + .009, v + d * j / 4, low), iso(u + w + .009, v + d * j / 4, high), "#b8d0bb", .55);
    }
    box(c, u - .012, v - .012, w + .024, d + .024, 2, ["#aab7a2", "#7e988d", "#e4e5c9"], z + height);
  }
  const base = volumes[0]!, front = y + base.v + base.d + .008, doorX = x + base.u + base.w / 2;
  poly(c, [iso(doorX - .065, front, 2), iso(doorX + .065, front, 2), iso(doorX + .065, front, 12), iso(doorX - .065, front, 12)], "#677d70");
  poly(c, [iso(doorX - .05, front + .003, 5), iso(doorX + .05, front + .003, 5), iso(doorX + .05, front + .003, 11), iso(doorX - .05, front + .003, 11)], night ? "#ffdda0" : "#a3c7bc");
  // A broad entrance canopy belongs to the podium; balconies belong to their floors.
  box(c, doorX - .14, front - .01, .28, .13, 1.2, ["#829f8c", "#5f8076", "#c8d8b9"], 12);
  for (const u of [doorX - .13, doorX + .12]) box(c, u, front + .095, .012, .015, 12, ["#a9b69b", "#7f9b86", "#d8dfbd"]);
  if (level === 3) {
    const roof = total + 2;
    for (const v of [top.v + .04, top.v + top.d - .035]) line(c, iso(x + top.u + .03, y + v, roof + 2.8), iso(x + top.u + top.w - .03, y + v, roof + 2.8), "#b7caae", .65);
    for (const u of [top.u + .03, top.u + top.w - .03]) for (const v of [top.v + .04, top.v + top.d - .035]) line(c, iso(x + u, y + v, roof), iso(x + u, y + v, roof + 2.8), "#85a48c", .55);
  }
  for (const [j, f] of roofFeatures(kind, level).entries()) {
    if (kind === "house" && level === 3 && j === 1) {
      box(c, x + f.u, y + f.v, f.w, f.d, 2, ["#b5b494", "#8d9e7d", "#758a5f"], f.z);
      c.save(); c.translate(0, -f.z - 2); tree(c, x + f.u + f.w / 2, y + f.v + f.d / 2, 2.2, .6); c.restore();
    } else {
      box(c, x + f.u, y + f.v, f.w, f.d, f.height, kind === "shop" && level === 3 ? ["#a7c8b6", "#608e91", "#d3e2c7"] : ["#b3c4ae", "#889f92", "#e1e6cf"], f.z);
      for (let k = 1; k < 4; k++) line(c, iso(x + f.u + f.w * k / 4, y + f.v, f.z + f.height + .1), iso(x + f.u + f.w * k / 4, y + f.v + f.d, f.z + f.height + .1), "#789f9559", .4);
    }
  }
}
/** The player's own home: the entrance to My Room. Cream walls, a terracotta gable, a doghouse and a mailbox. */
function myHome(c: CanvasRenderingContext2D, x: number, y: number, night: boolean, access: number) {
  const glass = (lit: boolean) => night && lit ? "#ffe4a8" : "#8fb5b3", wall = ["#f6eedf", "#dcd1bf", "#efe4d0"], trim = "#fbf7ee";
  const fence = (bit: number, front: boolean) => {
    const gate = Boolean(access & bit), a = bit === 1 ? { u: .04, v: .04 } : bit === 2 ? { u: .96, v: .04 } : bit === 4 ? { u: .04, v: .04 } : { u: .04, v: .96 };
    const b = bit === 1 || bit === 2 ? { u: a.u, v: .96 } : { u: .96, v: a.v };
    if ((bit === 2 || bit === 8) !== front) return;
    const point = (t: number, z: number) => iso(x + a.u + (b.u - a.u) * t, y + a.v + (b.v - a.v) * t, z);
    for (const [start, end] of gate ? [[0, .36], [.64, 1]] : [[0, 1]]) {
      line(c, point(start!, 4.2), point(end!, 4.2), snowy("#f1ece0", .3), 1);
      line(c, point(start!, 2.2), point(end!, 2.2), "#e0d8c6", .7);
      const posts = Math.ceil((end! - start!) * 9);
      for (let j = 0; j <= posts; j++) { const t = start! + (end! - start!) * j / posts; line(c, point(t, 0), point(t, 5.2), "#f7f3ea", 1.1); line(c, { x: point(t, 0).x + .4, y: point(t, 0).y }, { x: point(t, 5.2).x + .4, y: point(t, 5.2).y }, "#cfc6b2", .35); }
    }
  };
  // Back fences and the garden tree stand behind the house.
  fence(1, false); fence(4, false);
  tree(c, x + .86, y + .17, 7.5, .6, 0, paintState.season === "default" ? "default" : treePalette(y * MAP_SIZE + x + 3, .6));
  shadow(c, x + .16, y + .16, .44, .40, 34);
  // Main two-storey volume.
  box(c, x + .16, y + .16, .44, .40, 24, wall);
  glaze(c, [iso(x + .16, y + .56), iso(x + .60, y + .56), iso(x + .60, y + .56, 24), iso(x + .16, y + .56, 24)], "#fffcf026", "#8a7a6224");
  line(c, iso(x + .16, y + .563, 12.4), iso(x + .60, y + .563, 12.4), "#e2d6c0", .8);
  const pane = (u: number, z: number, w: number, lit: boolean) => {
    poly(c, [iso(x + u - .012, y + .562, z - .8), iso(x + u + w + .012, y + .562, z - .8), iso(x + u + w + .012, y + .562, z + 6.8), iso(x + u - .012, y + .562, z + 6.8)], trim);
    poly(c, [iso(x + u, y + .565, z), iso(x + u + w, y + .565, z), iso(x + u + w, y + .565, z + 6), iso(x + u, y + .565, z + 6)], glass(lit));
    line(c, iso(x + u + w / 2, y + .568, z), iso(x + u + w / 2, y + .568, z + 6), "#f4efe2", .5);
    line(c, iso(x + u + .01, y + .568, z + 4.6), iso(x + u + .035, y + .568, z + 5.7), "#ffffff70", .55);
  };
  pane(.43, 3.5, .12, true); pane(.20, 15, .1, hash(x * 7 + y) > .3); pane(.43, 15, .1, true);
  // Flower box under the ground-floor window.
  box(c, x + .42, y + .56, .14, .035, 1.6, ["#a0705a", "#7f5a48", "#6f9a5c"], 2.4);
  for (let j = 0; j < 4; j++) blossom(c, iso(x + .44 + j * .032, y + .58, 4.6), j % 2 ? "#f2c2cf" : "#f6dc8a", .5);
  // Side window above the sunroom, and the door with its lamp and canopy.
  poly(c, [iso(x + .604, y + .22, 15), iso(x + .604, y + .31, 15), iso(x + .604, y + .31, 21), iso(x + .604, y + .22, 21)], glass(true));
  line(c, iso(x + .608, y + .22, 18), iso(x + .608, y + .31, 18), "#f4efe2", .5);
  poly(c, [iso(x + .245, y + .563, 1), iso(x + .345, y + .563, 1), iso(x + .345, y + .563, 10.5), iso(x + .245, y + .563, 10.5)], "#9b6a46");
  poly(c, [iso(x + .27, y + .566, 6), iso(x + .32, y + .566, 6), iso(x + .32, y + .566, 9.4), iso(x + .27, y + .566, 9.4)], night ? "#ffdda0" : "#c9d8cf");
  ellipse(c, iso(x + .335, y + .57, 5), .45, .45, "#e9c46a");
  box(c, x + .22, y + .56, .15, .09, 1, ["#b88a5e", "#8f6a49", snowy("#d8b48a")], 11);
  box(c, x + .23, y + .56, .13, .1, 1, ["#cfc5b2", "#a8a08f", snowy("#e6dfcf")]);
  const porch = iso(x + .38, y + .575, 10);
  ellipse(c, porch, 1.2, 1.4, night ? "#ffe6a1" : "#f2e7c9");
  if (night) { const g = lightGradient(c.createRadialGradient(porch.x, porch.y + 6, 0, porch.x, porch.y + 6, 16)); g.addColorStop(0, "#ffdd7740"); g.addColorStop(1, "#ffdd7700"); ellipse(c, { x: porch.x, y: porch.y + 7 }, 16, 9, g); }
  // Terracotta gable roof with a round attic window and a chimney.
  pitchedRoof(c, x + .12, y + .12, .52, .48, 24, "#c8664c", "#93493a");
  const gable = iso(x + .64, y + .36, 30.5);
  ellipse(c, gable, 2.2, 2.4, trim); ellipse(c, gable, 1.6, 1.8, glass(true));
  line(c, { x: gable.x - 1.6, y: gable.y }, { x: gable.x + 1.6, y: gable.y }, "#f4efe2", .45);
  const chimney = (u: number, v: number, z: number) => iso(x + u, y + v, z);
  poly(c, [chimney(.22, .24, 31), chimney(.29, .24, 31), chimney(.29, .24, 45), chimney(.22, .24, 45)], "#b9846b");
  poly(c, [chimney(.29, .17, 34), chimney(.29, .24, 31), chimney(.29, .24, 45), chimney(.29, .17, 45)], "#8f604f");
  patch(c, x + .215, y + .165, .08, .08, "#d9b39b", 45); patch(c, x + .23, y + .18, .05, .05, "#5d4b42", 45.1);
  // Single-storey sunroom with a balcony on its roof.
  box(c, x + .58, y + .32, .25, .26, 12, wall);
  poly(c, [iso(x + .62, y + .583, 1.5), iso(x + .79, y + .583, 1.5), iso(x + .79, y + .583, 9.5), iso(x + .62, y + .583, 9.5)], glass(true));
  for (const u of [.675, .735]) line(c, iso(x + u, y + .586, 1.5), iso(x + u, y + .586, 9.5), "#f4efe2", .55);
  poly(c, [iso(x + .834, y + .37, 3.5), iso(x + .834, y + .5, 3.5), iso(x + .834, y + .5, 9.5), iso(x + .834, y + .37, 9.5)], glass(hash(x + y * 3) > .4));
  for (const [a, b] of [[[.58, .58], [.83, .58]], [[.83, .32], [.83, .58]]] as const) {
    line(c, iso(x + a[0], y + a[1], 15.5), iso(x + b[0], y + b[1], 15.5), "#f3eee2", .9);
    for (let j = 0; j <= 6; j++) { const t = j / 6; line(c, iso(x + a[0] + (b[0] - a[0]) * t, y + a[1] + (b[1] - a[1]) * t, 12), iso(x + a[0] + (b[0] - a[0]) * t, y + a[1] + (b[1] - a[1]) * t, 15.5), "#e6dfd0", .45); }
  }
  // Doghouse with a red roof, the mailbox and the front fences.
  box(c, x + .67, y + .68, .13, .12, 4.6, ["#d9b48a", "#b48d63", "#e2c39b"]);
  poly(c, [iso(x + .715, y + .801, .4), iso(x + .755, y + .801, .4), iso(x + .755, y + .801, 3), iso(x + .715, y + .801, 3)], "#4a3a30");
  const ridgeA = iso(x + .66, y + .74, 8.8), ridgeB = iso(x + .81, y + .74, 8.8);
  poly(c, [iso(x + .66, y + .67, 4.6), iso(x + .81, y + .67, 4.6), ridgeB, ridgeA], snowy("#8f3d33", .75));
  poly(c, [ridgeA, ridgeB, iso(x + .81, y + .81, 4.6), iso(x + .66, y + .81, 4.6)], snowy("#c45546", .8));
  line(c, iso(x + .14, y + .9, 0), iso(x + .14, y + .9, 7), "#8a6a4f", .9);
  box(c, x + .11, y + .87, .07, .05, 3, ["#c8473d", "#9d342d", snowy("#d8574b")], 7);
  line(c, iso(x + .18, y + .9, 9), iso(x + .18, y + .9, 11.5), "#e7c35a", .6);
  fence(2, true); fence(8, true);
}
function industrialTank(c: CanvasRenderingContext2D, x: number, y: number, z: number, height: number) {
  const a = iso(x, y, z), b = iso(x, y, z + height);
  const g = c.createLinearGradient(a.x - 3.3, 0, a.x + 3.3, 0); g.addColorStop(0, "#78958e"); g.addColorStop(.35, "#d8e1c9"); g.addColorStop(1, "#5f827d");
  poly(c, [{ x: a.x - 3.3, y: a.y }, { x: a.x + 3.3, y: a.y }, { x: b.x + 3.3, y: b.y }, { x: b.x - 3.3, y: b.y }], g);
  ellipse(c, a, 3.3, 1.6, "#7b9589"); ellipse(c, b, 3.3, 1.6, "#dce4ca");
  for (const t of [.25, .70]) line(c, { x: a.x - 3.2, y: a.y - height * t }, { x: a.x + 3.2, y: a.y - height * t }, "#8eada150", .6);
  line(c, { x: b.x + 2.3, y: b.y }, { x: a.x + 2.3, y: a.y }, "#557f75", .7);
}
function plot(c: CanvasRenderingContext2D, kind: Tile, x: number, y: number, access: number) {
  if (kind === "home") {
    patch(c, x + .04, y + .04, .92, .92, "#a7c98b");
    for (let j = 0; j < 14; j++) { const p = iso(x + .08 + hash(x * 31 + y * 7 + j) * .84, y + .08 + hash(x * 17 + y * 13 + j * 3) * .84); line(c, p, { x: p.x + 1.4, y: p.y - .6 }, "#86ab6d55", .5); }
    // Stepping stones from the door to each street-side gate.
    for (const { bit, dx, dy } of DIRECTIONS) if (access & bit) for (let j = 0; j < 5; j++) {
      const t = (j + .5) / 5, from = { u: .3, v: .64 }, to = { u: .5 + dx * .48, v: .5 + dy * .48 }, q = iso(x + from.u + (to.u - from.u) * t, y + from.v + (to.v - from.v) * t, .2);
      ellipse(c, { x: q.x, y: q.y + .4 }, 3.4, 1.6, "#9c9a86"); ellipse(c, q, 3.3, 1.5, snowy("#e2dccb"));
    }
    return;
  }
  patch(c, x + .05, y + .05, .9, .9, "#c8c9af");
  for (let j = 1; j < 5; j++) { const u = .05 + j * .18; line(c, iso(x + u, y + .05), iso(x + u, y + .95), "#a5af973b", .45); line(c, iso(x + .05, y + u), iso(x + .95, y + u), "#edf0cf39", .4); }
  if (kind !== "park" && kind !== "station") {
    // Connect the lot to its actual road edge, including side and rear entrances.
    for (const { bit, dx, dy } of DIRECTIONS) if (access & bit) patch(c, x + (dx < 0 ? 0 : dx > 0 ? .78 : .44), y + (dy < 0 ? 0 : dy > 0 ? .78 : .44), dx ? .22 : .12, dy ? .22 : .12, "#e4d9bc");
  }
}
function building(c: CanvasRenderingContext2D, kind: Tile, x: number, y: number, level: number, night: boolean, time: number, showSmoke = true, axis: "x" | "y" = "x", access = 0, showPlot = true, parts: FacilityPart[] = []) {
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
  if (kind === "home") { myHome(c, x, y, night, access); return; }
  if (kind === "station") {
    patch(c, x + (axis === "x" ? .04 : .30), y + (axis === "x" ? .30 : .04), axis === "x" ? .92 : .40, axis === "x" ? .40 : .92, "#b6b49a");
    for (const side of [.405, .595]) line(c, iso(x + (axis === "x" ? .04 : side), y + (axis === "x" ? side : .04), .8), iso(x + (axis === "x" ? .96 : side), y + (axis === "x" ? side : .96), .8), "#d6dfcf", 1.2);
    station(c, x, y, axis, night, false); station(c, x, y, axis, night, true); return;
  }
  if ((kind === "house" || kind === "shop") && level > 1) {
    developedBuilding(c, kind, x, y, buildingLevel(level), night, seed); return;
  }
  if (kind === "factory") {
    const layout = factoryLayout(level), stage = buildingLevel(level), height = layout.main.height;
    shadow(c, x + layout.main.u, y + layout.main.v, layout.main.w, .68, height + 8);
    for (const [k, block] of layout.volumes.entries()) {
      const u = x + block.u, v = y + block.v;
      box(c, u, v, block.w, block.d, block.height, stage === 3 ? ["#b9cec4", "#7f9b97", "#e2e4cb"] : ["#c3c8be", "#959f9c", "#e0deca"]);
      glaze(c, [iso(u, v + block.d), iso(u + block.w, v + block.d), iso(u + block.w, v + block.d, block.height), iso(u, v + block.d, block.height)], "#fff9e718", "#41564f35");
      for (let j = 1; j < 8; j++) line(c, iso(u + j * block.w / 8, v + block.d + .001, 2), iso(u + j * block.w / 8, v + block.d + .001, block.height - 2), "#758c803b", .6);
      windows(c, u, v, block.w, block.d, Math.floor((block.height - 1) / 12), night, seed + k * 11, false);
    }
    const vent = layout.vent;
    for (let j = 0; j < 3; j++) {
      const u = x + vent.u + j * vent.spacing;
      box(c, u, y + vent.v, vent.w, vent.d, 5, ["#739c9f", "#547b81", "#9cb9b4"], height);
      for (let k = 1; k < 5; k++) line(c, iso(u + .015, y + vent.v + k * vent.d / 5, height + 5.1), iso(u + vent.w - .015, y + vent.v + k * vent.d / 5, height + 5.1), "#476e7478", .45);
    }
    for (const stack of layout.stacks) {
      box(c, x + stack.u, y + stack.v, stack.w, stack.d, stack.height, ["#bf8d75", "#8e6557", "#e1b199"], stack.z);
      for (let z = stack.z + 6; z < stack.z + stack.height; z += 10) { line(c, iso(x + stack.u, y + stack.v + stack.d, z), iso(x + stack.u + stack.w, y + stack.v + stack.d, z), "#efd6af", 1.2); line(c, iso(x + stack.u + stack.w, y + stack.v, z), iso(x + stack.u + stack.w, y + stack.v + stack.d, z), "#c5b194", 1); }
      patch(c, x + stack.u + .015, y + stack.v + .012, stack.w - .03, stack.d - .024, "#685f56", stack.z + stack.height + .1);
    }
    const front = layout.volumes[layout.volumes.length - 1]!;
    if (stage > 1) {
      const tankPositions = stage === 2 ? [.70] : [.34, .68];
      for (const u of tankPositions) industrialTank(c, x + u, y + .69, front.height, stage === 2 ? 13 : 16);
      line(c, iso(x + front.u + .03, y + front.v + front.d, front.height + 3), iso(x + front.u + front.w - .03, y + front.v + front.d, front.height + 3), "#bdd0b5", .75);
      for (let j = 0; j < 5; j++) line(c, iso(x + front.u + .03 + j * (front.w - .06) / 4, y + front.v + front.d, front.height), iso(x + front.u + .03 + j * (front.w - .06) / 4, y + front.v + front.d, front.height + 3), "#82a190", .6);
    }
    const bays = stage === 1 ? 1 : stage === 2 ? 2 : 3;
    for (let j = 0; j < bays; j++) {
      const u = x + front.u + (j + .5) * front.w / bays, v = y + front.v + front.d + .005, w = bays === 1 ? .22 : .15;
      poly(c, [iso(u - w / 2, v, 1), iso(u + w / 2, v, 1), iso(u + w / 2, v, stage === 3 ? 18 : 12), iso(u - w / 2, v, stage === 3 ? 18 : 12)], "#678984");
      for (let k = 1; k < (stage === 3 ? 9 : 6); k++) line(c, iso(u - w / 2 + .005, v + .005, k * 2), iso(u + w / 2 - .005, v + .005, k * 2), "#9ab2a354", .6);
    }
    if (showSmoke) factorySmoke(c, x, y, time, level);
    if (!parts.includes("storage")) box(c, x + .29, y + .87, .25, .09, 4, ["#a6b6aa", "#6f8b7d", "#c9d4bb"]); return;
  }
  const floors = kind === "house" ? level === 1 ? 1 : level * 2 : level + 1;
  const height = floors * 12 + 5;
  const roofs = ["#bd7962", "#7898a0", "#9a9a74", "#c89868", "#8b8ba6"];
  const walls = ["#f4e9cc", "#ebd3b6", "#dee8df", "#f0d8c6"];
  shadow(c, bx, by, .67, .65, height + 8);
  box(c, bx, by, .67, .65, height, [walls[Math.floor(v * 4)]!, "#bdbaa0", "#e8dcc1"]);
  glaze(c, [iso(bx, by + .65), iso(bx + .67, by + .65), iso(bx + .67, by + .65, height), iso(bx, by + .65, height)], "#fff9ec25", "#82755e1c");
  glaze(c, [iso(bx + .67, by), iso(bx + .67, by + .65), iso(bx + .67, by + .65, height), iso(bx + .67, by, height)], "#e7dbc615", "#484c402b");
  for (let floor = 1; floor < floors; floor++) { const z = floor * 12 + 3; line(c, iso(bx, by + .655, z), iso(bx + .67, by + .655, z), "#f4ead395", .75); line(c, iso(bx + .675, by, z), iso(bx + .675, by + .65, z), "#aaa68c", .6); }
  windows(c, bx, by, .67, .65, floors, night, seed);
  // Foundation, doorstep and planted hedge.
  box(c, bx - .015, by + .63, .7, .055, 2, ["#c1b294", "#aa9b81", "#efe2c2"]);
  const door = [iso(bx + .27, by + .652, 2), iso(bx + .39, by + .652, 2), iso(bx + .39, by + .652, 11), iso(bx + .27, by + .652, 11)];
  poly(c, door, "#677d70");
  poly(c, [iso(bx + .285, by + .657, 5), iso(bx + .375, by + .657, 5), iso(bx + .375, by + .657, 10), iso(bx + .285, by + .657, 10)], night ? "#edcf8e" : "#97b7ac");
  ellipse(c, iso(bx + .38, by + .66, 5), .6, .6, "#e4c27b");
  patch(c, bx + .23, by + .69, .21, .07, "#aa9c7c", 1.1);
  if (kind === "house" && level === 1) {
    pitchedRoof(c, bx - .05, by - .05, .77, .75, height, roofs[Math.floor(v * 5)]!, "#8c7565");
    const chimneyTop = height + 15, roofAt = (u: number, v: number) => iso(bx + u, by + v, height + 13 * (1 - Math.abs(v - .325) / .375));
    poly(c, [roofAt(.44, .14), roofAt(.52, .14), iso(bx + .52, by + .14, chimneyTop), iso(bx + .44, by + .14, chimneyTop)], "#caa790");
    poly(c, [roofAt(.52, .05), roofAt(.52, .14), iso(bx + .52, by + .14, chimneyTop), iso(bx + .52, by + .05, chimneyTop)], "#987763");
    patch(c, bx + .44, by + .05, .08, .09, "#ead3b3", chimneyTop);
    patch(c, bx + .455, by + .065, .05, .06, "#716757", height + 15.1);
    line(c, iso(bx + .50, by + .64, 17), iso(bx + .50, by + .64, 2), "#8f958580", .8);
    box(c, bx + .24, by + .65, .18, .12, 1, ["#a78b67", "#7f775b", "#d6c2a0"], 11.5);
    for (const u of [.245, .405]) line(c, iso(bx + u, by + .755, 1), iso(bx + u, by + .755, 11.5), "#a8ad90", .65);
    for (const u of [.09, .45]) { box(c, bx + u, by + .66, .11, .04, 1.6, ["#af997b", "#827960", "#7b9e66"], 6); for (let j = 0; j < 3; j++) blossom(c, iso(bx + u + .025 + j * .027, by + .68, 8), j % 2 ? "#ede1b1" : "#d78f91", .55); }
    for (const offset of [.14, .70]) if (!parts.includes("garden") && !(offset === .14 && parts.includes("planter")) && !(offset === .70 && (parts.includes("terrace") || parts.includes("canopy")))) box(c, x + offset, y + .88, .18, .09, 4, ["#709464", "#567853", "#96b777"]);
  } else {
    box(c, bx - .025, by - .025, .72, .70, 3, ["#c1b8a1", "#969f96", roofs[Math.floor(v * 5)]!], height);
    for (const u of [0, .65]) box(c, bx + u, by, .028, .65, 1.8, ["#c9c6ad", "#969f96", "#e8dfc4"], height + 3);
    box(c, bx, by + .64, .67, .03, 1.8, ["#c9c6ad", "#969f96", "#e8dfc4"], height + 3);
    box(c, bx + .1, by + .15, .16, .12, 5, ["#aebbad", "#8b9d94", "#d9e0cc"], height + 3);
    patch(c, bx + .37, by + .12, .2, .26, "#5a858e", height + 3.2);
    for (let j = 1; j < 3; j++) line(c, iso(bx + .37, by + .12 + j * .08, height + 3.4), iso(bx + .57, by + .12 + j * .08, height + 3.4), "#99b9bb", .6);
    if (kind === "shop") {
      poly(c, [iso(bx + .04, by + .653, 3), iso(bx + .24, by + .653, 3), iso(bx + .24, by + .653, 12), iso(bx + .04, by + .653, 12)], night ? paintState.shopsOpen ? "#ffe7ad" : "#5a6b6d" : "#8bbab4");
      poly(c, [iso(bx + .43, by + .653, 3), iso(bx + .63, by + .653, 3), iso(bx + .63, by + .653, 12), iso(bx + .43, by + .653, 12)], night ? paintState.shopsOpen ? "#ffe7ad" : "#5a6b6d" : "#8bbab4");
      for (let j = 0; j < 6; j++) patch(c, bx - .03 + j * .12, by + .64, .12, .22, j % 2 ? "#f9ecd1" : "#ce8572", 13);
      for (let j = 0; j < 6; j++) { const xx = bx - .03 + j * .12; poly(c, [iso(xx, by + .86, 13), iso(xx + .12, by + .86, 13), iso(xx + .12, by + .86, 11), iso(xx, by + .86, 11)], j % 2 ? "#e7d8b9" : "#b46858"); }
      // A window and display counter identify the shop without labels on the artwork.
      if (!parts.includes("planter")) {
        box(c, x + .235, y + .90, .13, .06, 3, ["#ab8d60", "#7e684c", "#ead3a2"]);
        for (let j = 0; j < 4; j++) ellipse(c, iso(x + .25 + j * .03, y + .93, 4), .7, .5, j % 2 ? "#db9b69" : "#88a15c");
      }
      if (!parts.includes("garden")) box(c, x + .84, y + .85, .07, .09, 6, ["#927856", "#6e604d", "#e1c89a"]);
    }
    if (kind === "house") for (let floor = 1; floor < floors; floor += 2) {
      const z = floor * 12 + 5; box(c, bx + .055, by + .65, .16, .065, 1, ["#bdb09b", "#979c8a", "#e3d7b7"], z);
      line(c, iso(bx + .055, by + .715, z + 4), iso(bx + .215, by + .715, z + 4), "#82937e", .7);
      for (let j = 0; j < 4; j++) line(c, iso(bx + .055 + j * .053, by + .715, z), iso(bx + .055 + j * .053, by + .715, z + 4), "#96a18b", .5);
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
    const surface = transportOutline(mask, .24), parts = town.tiles[i] === "road" ? town.attachments.find(a => a.tile === i)?.parts : undefined;
    const layout = parts?.some(p => ROAD_MARKING_PARTS.has(p)) ? roadLayout(town, i) : null, paved = Boolean(layout?.paving);
    poly(c, surface.map(p => point(p, .15)), "#6c817b");
    if (paved) roadPaving(c, { x, y }, surface, point);
    else for (let j = 0; j < 14; j++) { const u = hash(j * 13 + 8), v = hash(j * 7 + 11); if (contains({ x: u, y: v }, surface)) ellipse(c, point({ x: u, y: v }, .18), .45, .25, j % 2 ? "#bdc7ad24" : "#354e4620"); }
    if (!paved) for (const { dx, dy, bit } of DIRECTIONS) if (mask & bit) for (const side of [-1, 1]) {
      for (const t of [.30, .43]) line(c, point({ x: .5 + dx * t + dy * .26 * side, y: .5 + dy * t + dx * .26 * side }, .2), point({ x: .5 + dx * t + dy * .30 * side, y: .5 + dy * t + dx * .30 * side }, .2), "#a2ad975e", .45);
    }
    if (layout) roadMarkings(c, layout, point);
    const directions = DIRECTIONS.filter(d => mask & d.bit);
    // Street furniture in the road itself: a manhole on some stretches, drain covers along the curb.
    if (!town.terrain[i] && directions.length === 2 && !paved && !layout?.crosswalk) {
      const [a, b] = directions, alongX = Boolean(mask & 3) && !(mask & 12);
      if (a!.dx === -b!.dx && a!.dy === -b!.dy && hash(i * 13.1 + 2) > .55) {
        const u = .3 + hash(i * 3.3) * .4, lane = hash(i * 5.7) > .5 ? .38 : .62, m = point(alongX ? { x: u, y: lane } : { x: lane, y: u }, .22);
        ellipse(c, m, 2.3, 1.15, "#4b5552"); ellipse(c, m, 1.75, .85, paintState.snow ? "#cfd5d6" : "#727d79");
        line(c, { x: m.x - 1.2, y: m.y }, { x: m.x + 1.2, y: m.y }, "#5b6562", .35); line(c, { x: m.x, y: m.y - .6 }, { x: m.x, y: m.y + .6 }, "#5b6562", .35);
      }
      if (a!.dx === -b!.dx && a!.dy === -b!.dy) for (const side of [.26, .74]) {
        const u = .2 + hash(i * 7.9 + side) * .6, q = (t: number, d: number) => point(alongX ? { x: t, y: d } : { x: d, y: t }, .21);
        poly(c, [q(u - .05, side - .012), q(u + .05, side - .012), q(u + .05, side + .012), q(u - .05, side + .012)], "#4f5a57");
        for (let j = 1; j < 4; j++) line(c, q(u - .05 + j * .025, side - .01), q(u - .05 + j * .025, side + .01), "#7b8783", .3);
      }
    }
    // Snow piled along the curbs where the plough left it.
    if (paintState.snow && !town.terrain[i]) for (let j = 0; j < surface.length; j++) {
      const p = surface[j]!, q = surface[(j + 1) % surface.length]!;
      if (p.x === q.x && (p.x === 0 || p.x === 1) || p.y === q.y && (p.y === 0 || p.y === 1)) continue;
      line(c, point(p, .3), point(q, .3), "#eef2f4", 2.2); line(c, point(p, .32), point(q, .32), "#ffffffaa", .8);
    }
    if (directions.length === 2 && !paved) {
      const [a, b] = directions, path = { a: { x: .5 + a!.dx * .5, y: .5 + a!.dy * .5 }, b: { x: .5 + b!.dx * .5, y: .5 + b!.dy * .5 }, curve: Boolean(a!.dx !== -b!.dx || a!.dy !== -b!.dy) };
      // Dash spacing is shared across tile edges; curves follow the drivable bend. A crossing interrupts the middle dash.
      for (let j = 0; j < 5; j++) if (!(layout?.crosswalk && j === 2)) line(c, point(trackPoint(path, (j + .15) / 5), .25), point(trackPoint(path, (j + .57) / 5), .25), "#e6e4b0", .8);
    } else if (directions.length !== 2) {
      for (const { dx, dy } of directions) {
        if (!paved) for (const t of [.38, .46]) line(c, point({ x: .5 + dx * t, y: .5 + dy * t }, .25), point({ x: .5 + dx * (t + .035), y: .5 + dy * (t + .035) }, .25), "#e6e4b0", .8);
        // Zebra crossings over every arm of a junction: bars along the road, from curb to curb, before the junction box.
        if (directions.length >= 3) for (let j = 0; j < 6; j++) {
          const offset = (j - 2.5) * .08, at = (t: number, o: number) => point({ x: .5 + dx * t + dy * o, y: .5 + dy * t + dx * o }, .3);
          poly(c, [at(.27, offset - .023), at(.37, offset - .023), at(.37, offset + .023), at(.27, offset + .023)], paintState.snow ? "#f4f6f4" : "#e2e6d1");
        }
      }
      if (directions.length === 1) {
        const { dx, dy } = directions[0]!;
        line(c, point({ x: .5 - dx * .16 + dy * .16, y: .5 - dy * .16 + dx * .16 }, .3), point({ x: .5 - dx * .16 - dy * .16, y: .5 - dy * .16 - dx * .16 }, .3), "#e2e6d1", 1);
      }
    }
  } else {
    const bed = transportOutline(mask || 3, .28);
    for (let j = 0; j < 22; j++) { const u = hash(j * 11 + 31), v = hash(j * 17 + 42); if (contains({ x: u, y: v }, bed)) ellipse(c, point({ x: u, y: v }, .12), .8, .45, j % 2 ? "#d9d2b488" : "#786f5f55"); }
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
/** Road parts painted on the road surface (the ground layer), not stood on the sidewalk. */
const ROAD_MARKING_PARTS: ReadonlySet<FacilityPart> = new Set<FacilityPart>(["paving", "crosswalk", "signal", "stopSign"]);
/** Where the middle car of the train on route `r` is (distance along the route) and which way it runs. */
export function trainAt(route: TransportRoute, r: number, time: number) {
  const travel = route.length - .68, phase = (time * .45 + r * 4) % (travel * 2 + 4);
  return { center: .34 + Math.min(travel, phase <= travel + 2 ? Math.max(0, phase - 1) : Math.max(0, travel * 2 + 3 - phase)), heading: phase <= travel + 2 ? 1 : -1 };
}
/** Ground artwork of a road, a railway, a station's track or a level crossing. */
function transportTile(c: CanvasRenderingContext2D, town: Town, x: number, y: number, tile: Tile) {
  if (tile === "road" || tile === "rail" || tile === "station") transport(c, town, x, y, tile === "road" ? "road" : "rail");
  else if (tile === "crossing") { transport(c, town, x, y, "road"); crossingTrack(c, town, x, y); }
}
/** Points on a crossing tile measured along the railway and across it. */
function crossingFrame(x: number, y: number, axis: "x" | "y") {
  return (along: number, across: number, z = 0) => axis === "x" ? iso(x + along, y + across, z) : iso(x + across, y + along, z);
}
/**
 * The barrier and warning post for each way into a level crossing, on the curb beside the lane that comes towards the
 * track (traffic keeps left), with the arm swinging out over that lane to the centre line.
 */
function crossingGates(axis: "x" | "y") {
  return axis === "x" ? [{ along: .8, across: .2, arm: -1 }, { along: .2, across: .8, arm: 1 }] : [{ along: .2, across: .2, arm: 1 }, { along: .8, across: .8, arm: -1 }];
}
/** Level crossing: rails set into the road between rubber panels, ballast beside the road, stop lines before the track. */
function crossingTrack(c: CanvasRenderingContext2D, town: Town, x: number, y: number) {
  const axis = crossingAxis(town.tiles, y * MAP_SIZE + x), at = crossingFrame(x, y, axis);
  for (const [a0, a1] of [[0, .22], [.78, 1]] as const) {
    poly(c, [at(a0, .22, .1), at(a1, .22, .1), at(a1, .78, .1), at(a0, .78, .1)], "#b6b49a");
    for (let j = 0; j < 22; j++) { const a = a0 + hash(j * 7 + x) * (a1 - a0), b = .25 + hash(j * 11 + y) * .5; ellipse(c, at(a, b, .14), .8, .45, j % 2 ? "#d9d2b488" : "#786f5f55"); }
    for (let j = 0; j < 2; j++) { const a = a0 + (a1 - a0) * (j + .5) / 2; line(c, at(a, .33, .25), at(a, .67, .25), "#837862", 2.2); }
  }
  poly(c, [at(.22, .3, .3), at(.78, .3, .3), at(.78, .7, .3), at(.22, .7, .3)], "#5d6763");
  for (const k of [.3, .7]) line(c, at(.22, k, .32), at(.78, k, .32), "#e6e4b0", .7);
  for (let j = 1; j < 5; j++) line(c, at(.22 + j * .112, .3, .33), at(.22 + j * .112, .7, .33), "#4b5451", .35);
  for (const side of [-1, 1]) {
    line(c, at(.22, .5 + side * .07, .34), at(.78, .5 + side * .07, .34), "#2c3230", .7);
    line(c, at(0, .5 + side * .095, .8), at(1, .5 + side * .095, .8), "#d6dfcf", 1.2);
  }
  // Stop lines across the lane that comes towards the track, on both sides.
  for (const gate of crossingGates(axis)) {
    const across = gate.across < .5 ? .13 : .87, from = gate.arm < 0 ? .5 : .26, to = gate.arm < 0 ? .74 : .5;
    line(c, at(from, across, .3), at(to, across, .3), "#eceadb", 1.4);
  }
}
/** The warning post: crossbuck, two red lamps facing the traffic, the barrier housing and a striped foot. */
function crossingPost(c: CanvasRenderingContext2D, x: number, y: number, axis: "x" | "y", gate: { along: number; across: number; arm: number }) {
  const at = crossingFrame(x, y, axis), foot = at(gate.along, gate.across), head = at(gate.along, gate.across, 24);
  ellipse(c, { x: foot.x + 1.2, y: foot.y + .5 }, 3, 1.2, "#22322e33");
  box(c, x + (axis === "x" ? gate.along : gate.across) - .035, y + (axis === "x" ? gate.across : gate.along) - .035, .07, .07, 6, ["#7f8a86", "#5e6865", "#a5aeaa"]);
  line(c, foot, head, "#c9cfcb", 1.5);
  for (let j = 0; j < 4; j++) line(c, { x: foot.x, y: foot.y - j * 1.6 }, { x: foot.x, y: foot.y - j * 1.6 - .8 }, "#2b2b2b", 1.7);
  // The lamp board across the road, with two dark lenses (they flash in the moving layer).
  const lamp = at(gate.along, gate.across, 15), side = at(gate.along + .06, gate.across, 15), sx = side.x - lamp.x, sy = side.y - lamp.y;
  line(c, { x: lamp.x - sx, y: lamp.y - sy }, { x: lamp.x + sx, y: lamp.y + sy }, "#2a2c2c", 2.6);
  for (const k of [-1, 1]) ellipse(c, { x: lamp.x + sx * k * .8, y: lamp.y + sy * k * .8 + .3 }, 1.15, 1.15, "#5c2420");
  // Crossbuck: two crossed boards, yellow with black edges.
  const top = at(gate.along, gate.across, 21.5);
  for (const k of [-1, 1]) { line(c, { x: top.x - 3.4, y: top.y - 2 * k }, { x: top.x + 3.4, y: top.y + 2 * k }, "#262626", 2.4); line(c, { x: top.x - 3.2, y: top.y - 1.9 * k }, { x: top.x + 3.2, y: top.y + 1.9 * k }, "#f2c43c", 1.4); }
  // Barrier housing on the side facing the road.
  const hinge = at(gate.along + gate.arm * .03, gate.across, 7);
  ellipse(c, hinge, 1.8, 1.5, "#3c4442"); ellipse(c, { x: hinge.x - .4, y: hinge.y - .4 }, .8, .6, "#7c8784");
}
/** A barrier arm, `down` 0 (raised, upright) to 1 (lowered across the lane), and the lamps flashing in turn while it rings. */
function crossingArm(c: CanvasRenderingContext2D, x: number, y: number, axis: "x" | "y", gate: { along: number; across: number; arm: number }, down: number, ringing: boolean, time: number, night: number) {
  const at = crossingFrame(x, y, axis), length = .3, angle = down * Math.PI / 2;
  const reach = Math.sin(angle) * length, rise = Math.cos(angle) * length * 36;
  const start = at(gate.along + gate.arm * .03, gate.across, 7), end = at(gate.along + gate.arm * (.03 + reach), gate.across, 7 + rise);
  for (let j = 0; j < 7; j++) {
    const a = { x: start.x + (end.x - start.x) * j / 7, y: start.y + (end.y - start.y) * j / 7 }, b = { x: start.x + (end.x - start.x) * (j + 1) / 7, y: start.y + (end.y - start.y) * (j + 1) / 7 };
    line(c, a, b, shade(j % 2 ? "#2b2b2b" : "#f2c43c", night), 1.3);
  }
  if (!ringing) return;
  const lamp = at(gate.along, gate.across, 15), side = at(gate.along + .06, gate.across, 15), sx = side.x - lamp.x, sy = side.y - lamp.y, lit = Math.floor(time * 2.4) % 2 ? 1 : -1;
  const p = { x: lamp.x + sx * lit * .8, y: lamp.y + sy * lit * .8 + .3 };
  c.save(); c.globalCompositeOperation = "lighter";
  const glow = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 6); glow.addColorStop(0, "rgba(255,90,70,.55)"); glow.addColorStop(1, "rgba(255,90,70,0)");
  c.fillStyle = glow; c.beginPath(); c.arc(p.x, p.y, 6, 0, Math.PI * 2); c.fill(); c.restore();
  ellipse(c, p, 1.15, 1.15, "#ff5a43");
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
      ellipse(c, iso(px, py, 11), .9, .5, "#e5e3c9");
    }
  }
}
function orientedBox(c: CanvasRenderingContext2D, x: number, y: number, length: number, width: number, height: number, dx: number, dy: number, colors: string[], z: number) {
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([along, across]) => ({ x: x + dx * along! * length / 2 - dy * across! * width / 2, y: y + dy * along! * length / 2 + dx * across! * width / 2 }));
  const edges = corners.map((a, j) => ({ a, b: corners[(j + 1) % 4]!, depth: a.x + a.y + corners[(j + 1) % 4]!.x + corners[(j + 1) % 4]!.y })).sort((a, b) => a.depth - b.depth).slice(2);
  edges.forEach(({ a, b }, j) => poly(c, [iso(a.x, a.y, z), iso(b.x, b.y, z), iso(b.x, b.y, z + height), iso(a.x, a.y, z + height)], colors[Math.abs(a.x - b.x) < 1e-6 ? 1 : Math.abs(a.y - b.y) < 1e-6 ? 0 : j]!));
  poly(c, corners.map(p => iso(p.x, p.y, z + height)), colors[2]!);
  return edges;
}
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
  if (kind === "factory") {
    const layout = factoryLayout(level), volumes = [...layout.volumes, ...layout.stacks, ...Array.from({ length: 3 }, (_, j) => ({ ...layout.vent, u: layout.vent.u + j * layout.vent.spacing, height: 5, z: layout.main.height }))];
    return volumes.flatMap(b => boxFaces(x + b.u, y + b.v, b.w, b.d, b.height, b.z));
  }
  if (kind === "home") {
    const faces = [...boxFaces(x + .16, y + .16, .44, .40, 24), ...boxFaces(x + .58, y + .32, .25, .26, 15.5), ...boxFaces(x + .22, y + .17, .07, .07, 45), ...boxFaces(x + .66, y + .67, .15, .14, 8.8)];
    const a = iso(x + .12, y + .36, 37), b = iso(x + .64, y + .36, 37);
    faces.push([iso(x + .12, y + .12, 24), iso(x + .64, y + .12, 24), b, a], [a, b, iso(x + .64, y + .6, 24), iso(x + .12, y + .6, 24)], [iso(x + .64, y + .12, 24), b, iso(x + .64, y + .6, 24)]);
    return faces;
  }
  if (kind !== "house" && kind !== "shop") return [];
  if (level > 1) {
    const volumes = buildingVolumes(kind, level), top = volumes[volumes.length - 1]!;
    return [...volumes, { ...top, u: top.u - .012, v: top.v - .012, w: top.w + .024, d: top.d + .024, z: top.z + top.height, height: 2 }, ...roofFeatures(kind, level)].flatMap(b => boxFaces(x + b.u, y + b.v, b.w, b.d, b.height, b.z));
  }
  const h = (kind === "house" ? level === 1 ? 1 : level * 2 : level + 1) * 12 + 5;
  const faces = boxFaces(x + .16, y + .15, .67, .65, h);
  if (kind === "house" && level === 1) {
    const bx = x + .11, by = y + .10, w = .77, d = .75;
    const a = iso(bx, by + d / 2, h + 13), b = iso(bx + w, by + d / 2, h + 13);
    faces.push([iso(bx, by, h), iso(bx + w, by, h), b, a], [a, b, iso(bx + w, by + d, h), iso(bx, by + d, h)], [iso(bx + w, by, h), b, iso(bx + w, by + d, h)]);
  } else faces.push(...boxFaces(x + .135, y + .125, .72, .70, 3, h), ...boxFaces(x + .26, y + .30, .16, .12, 5, h + 3));
  return faces;
}
function facilityFaces(kind: Tile, x: number, y: number, level: number, parts: FacilityPart[]): Point[][] {
  return facilityLayout(kind, level, parts).flatMap(p => boxFaces(x + p.u, y + p.v, p.w, p.d, p.height, p.z));
}
type SceneObject = {
  depth: number; x: number; y: number; bounds: SpriteBounds;
  key?: string;
  /** Cache key of the lit night artwork, when it differs from the day key. */
  nightKey?: string;
  /** Has windows, signs or lamps that light up at night. */
  emits?: boolean;
  /** A street lamp switches on when the share of lit lamps passes this threshold. */
  lamp?: number;
  /** Trees bend in the wind around their trunk base. */
  sway?: boolean;
  tile?: number;
  paint: (c: CanvasRenderingContext2D, night: boolean, lit: boolean) => void;
};
const GROUND_BOUNDS = { left: -824, top: -30, width: 1648, height: 850 };
function parkGround(c: CanvasRenderingContext2D, lot: ParkLot, town: Town) {
  // The lawn follows the seasons like the grass around it, a shade greener because it is looked after.
  const lawn = paintState.season === "default" ? "#a8c58a" : mixColor(grassPalette().grass[2]!, "#8fc276", .35);
  box(c, lot.x + .035, lot.y + .035, lot.width - .07, lot.height - .07, 1, ["#8eaa79", "#7c9b6b", lot.kind === "park" ? lawn : "#e1d4b3"]);
  // Mowing stripes across the lawn.
  if (lot.kind === "park" && !paintState.snow) for (let u = .21, j = 0; u < lot.width - .21; u += .5, j++) if (j % 2 === 0) patch(c, lot.x + u, lot.y + .21, Math.min(.5, lot.width - .21 - u), lot.height - .42, "#f6ffe61c", 1.01);
  for (const v of [.09, lot.height - .21]) patch(c, lot.x + .09, lot.y + v, lot.width - .18, .12, "#ded5b5", 1.1);
  for (const u of [.09, lot.width - .21]) patch(c, lot.x + u, lot.y + .09, .12, lot.height - .18, "#ded5b5", 1.1);
  for (const i of lotTiles(lot)) { const x = i % MAP_SIZE, y = Math.floor(i / MAP_SIZE);
    if (lot.kind === "plaza") { for (const t of [.25, .50, .75]) { line(c, iso(x + t, y + .05, 1.02), iso(x + t, y + .95, 1.02), "#bcae903f", .45); line(c, iso(x + .05, y + t, 1.02), iso(x + .95, y + t, 1.02), "#f2e8cb70", .4); } }
    else for (let j = 0; j < 6; j++) { const p = iso(x + .2 + hash(i + j * 31) * .60, y + .2 + hash(i * 3 + j) * .60, 1.02); line(c, p, { x: p.x + 1.5, y: p.y - .5 }, "#7c9c6440", .55); }
  }
  const paths = new Set(lot.parts.filter(p => p.kind === "path").map(p => p.tile));
  for (const part of lot.parts) if (part.kind === "path") {
    const x = part.tile % MAP_SIZE, y = Math.floor(part.tile / MAP_SIZE), neighboursHere = neighbours(x, y).filter(n => paths.has(n) || isRoadTile(town.tiles[n]));
    patch(c, x + .34, y + .34, .32, .32, "#e4d7b6", 1.2);
    if (!neighboursHere.length) patch(c, x + (part.rotation % 2 ? .34 : .08), y + (part.rotation % 2 ? .08 : .34), part.rotation % 2 ? .32 : .84, part.rotation % 2 ? .84 : .32, "#e4d7b6", 1.2);
    for (const n of neighboursHere) {
      const dx = n % MAP_SIZE - x, dy = Math.floor(n / MAP_SIZE) - y;
      patch(c, x + (dx < 0 ? 0 : .34), y + (dy < 0 ? 0 : .34), dx ? .66 : .32, dy ? .66 : .32, "#e4d7b6", 1.2);
    }
  }
}
/** One side of a park's fence, or the stretch of it from `from` to `to` (0..1 along the side). */
function parkFence(c: CanvasRenderingContext2D, x: number, y: number, bit: number, gate: boolean, from = 0, to = 1) {
  const a = bit === 1 ? { x: .04, y: .04 } : bit === 2 ? { x: .96, y: .04 } : bit === 4 ? { x: .04, y: .04 } : { x: .04, y: .96 };
  const b = bit === 1 || bit === 2 ? { x: a.x, y: .96 } : { x: .96, y: a.y };
  const at = (t: number, z: number) => iso(x + a.x + (b.x - a.x) * t, y + a.y + (b.y - a.y) * t, z);
  const here = (t: number) => t >= from && (t < to || t === 1);
  for (const [start, end] of gate ? [[0, .29], [.71, 1]] : [[0, 1]]) {
    const s = Math.max(start!, from), e = Math.min(end!, to);
    if (e > s) {
      line(c, at(s, 6), at(e, 6), "#819b6a", 1.2);
      line(c, at(s, 3.5), at(e, 3.5), "#8da076", .75);
      line(c, at(s, 6.5), at(e, 6.5), "#c9cba080", .55);
    }
    const posts = Math.ceil((end! - start!) * 4);
    for (let j = 0; j <= posts; j++) { const t = start! + (end! - start!) * j / posts; if (!here(t)) continue; line(c, at(t, 1), at(t, 7), "#6c8b5d", 1.6); line(c, { x: at(t, 1).x - .35, y: at(t, 1).y }, { x: at(t, 7).x - .35, y: at(t, 7).y }, "#c3c398", .5); ellipse(c, at(t, 7.2), 1, .55, "#ded2ad"); }
  }
  // Stone gateposts either side of the entrance.
  if (gate) for (const t of [.27, .73]) {
    if (!here(t)) continue;
    const foot = at(t, 0), head = at(t, 10.5);
    ellipse(c, { x: foot.x + .8, y: foot.y + .3 }, 2.6, 1.1, "#3c4a3a33");
    line(c, foot, head, "#c4b9a1", 3.4);
    line(c, { x: foot.x + .95, y: foot.y }, { x: head.x + .95, y: head.y }, "#a2977f", 1.3);
    line(c, { x: foot.x - 1.05, y: foot.y }, { x: head.x - 1.05, y: head.y }, "#e2dac6", .6);
    ellipse(c, at(t, 10.9), 2.4, 1.25, "#ebe3d0"); ellipse(c, at(t, 11.1), 1.9, .9, "#d9cfb8"); ellipse(c, at(t, 12), 1.05, .95, "#cfc4ab");
  }
}
/** Grass colour through the year: fresh in spring, deep in summer, warm in autumn, dry in winter. */
function grassPalette() {
  const s = paintState.season;
  if (s === "default") return { grass: ["#adca91", "#b1cc95", "#b6cf97", "#abc78e"], tuft: "#91b37c" };
  if (s === "winter" && paintState.bare >= .5) return { grass: ["#bcc59d", "#c0c8a1", "#c5cba5", "#b8c199"], tuft: "#a3ad83" };
  if (s === "autumn" && paintState.foliage > .35 || s === "winter" && paintState.bare < .5) return { grass: ["#b3c68e", "#b7c992", "#bccc95", "#b0c38b"], tuft: "#9fae74" };
  if (s === "autumn") return { grass: ["#adca91", "#b1cc95", "#b6cf97", "#abc78e"], tuft: "#91b37c" };
  if (paintState.lush > .35) return { grass: ["#a1c386", "#a5c68a", "#aac98d", "#9ec083"], tuft: "#84aa6c" };
  return { grass: ["#b0d095", "#b4d399", "#b9d59c", "#add093"], tuft: "#91b87c" };
}
function drawTerrain(c: CanvasRenderingContext2D, town: Town, options: SceneOptions) {
  const { grass, tuft } = grassPalette();
  ellipse(c, iso(12, 12), 820, 390, "#2f605f15");
  const edge = MAP_SIZE;
  poly(c, [iso(0, edge), iso(edge, edge), { ...iso(edge, edge), y: iso(edge, edge).y + 22 }, { ...iso(0, edge), y: iso(0, edge).y + 22 }], "#829d6d");
  poly(c, [iso(edge, 0), iso(edge, edge), { ...iso(edge, edge), y: iso(edge, edge).y + 22 }, { ...iso(edge, 0), y: iso(edge, 0).y + 22 }], "#6f8e64");
  // Finish the land first so a later neighbouring cell cannot paint over a curb or bridge.
  for (let y = 0; y < MAP_SIZE; y++) for (let x = 0; x < MAP_SIZE; x++) {
    const i = y * MAP_SIZE + x, tile = town.tiles[i]!, water = town.terrain[i] || tile === "water";
    if (water) poly(c, [iso(x, y), iso(x + 1.008, y), iso(x + 1.008, y + 1.008), iso(x, y + 1.008)], "#78b6bd");
    else patch(c, x, y, 1.008, 1.008, grass[Math.floor(hash(i) * 4)]!);
    if (water) {
      glaze(c, [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)], "#b8dacf18", "#3e829d27");
      if (tile === "water") for (let j = 0; j < 3; j++) {
        const p = iso(x + .15 + hash(i + j) * .7, y + .2 + j * .24);
        line(c, { x: p.x - 3, y: p.y }, { x: p.x + 4, y: p.y }, "#d5ebe67a", .8); line(c, { x: p.x - 1, y: p.y + 1.3 }, { x: p.x + 2, y: p.y + 1.3 }, "#d5ebe638", .45);
      }
      for (const n of neighbours(x, y)) if (!town.terrain[n] && town.tiles[n] !== "water") {
        const dx = n % MAP_SIZE - x, dy = Math.floor(n / MAP_SIZE) - y;
        line(c, iso(x + (dx === 1 ? 1 : 0), y + (dy === 1 ? 1 : 0)), iso(x + (dx === -1 ? 0 : 1), y + (dy === -1 ? 0 : 1)), "#d0dbc1", 2);
      }
    } else if (tile === "grass" && !paintState.snow) {
      for (let j = 0; j < 3; j++) { const p = iso(x + hash(i * 7 + j) * .8 + .1, y + hash(i * 9 + j) * .8 + .1); ellipse(c, p, 1, .6, j === 1 && hash(i) > .7 ? paintState.season === "spring" ? "#f4c9d4" : paintState.season === "autumn" ? "#e7b977" : "#e8dd9a" : tuft); }
    }
    if (options.grid && !water) poly(c, [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)], "#ffffff00", "#547b4933", .6);
  }
  const covered = new Set((town.parks ?? []).flatMap(lotTiles));
  for (let y = 0; y < MAP_SIZE; y++) for (let x = 0; x < MAP_SIZE; x++) {
    const i = y * MAP_SIZE + x, tile = town.tiles[i]!;
    if (["house", "shop", "factory", "station", "park", "home"].includes(tile) && !covered.has(i)) plot(c, tile, x, y, transportMask(town, i, "road"));
  }
  for (const lot of town.parks ?? []) parkGround(c, lot, town);
  for (let depth = 0; depth < MAP_SIZE * 2 - 1; depth++) for (let y = Math.max(0, depth - MAP_SIZE + 1); y <= Math.min(depth, MAP_SIZE - 1); y++) {
    const x = depth - y, tile = town.tiles[y * MAP_SIZE + x];
    transportTile(c, town, x, y, tile!);
  }
}
function groundPath(c: CanvasRenderingContext2D) {
  const a = iso(0, 0), b = iso(MAP_SIZE, 0), d = iso(MAP_SIZE, MAP_SIZE), e = iso(0, MAP_SIZE);
  c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(b.x, b.y + 22); c.lineTo(d.x, d.y + 22); c.lineTo(e.x, e.y + 22); c.lineTo(e.x, e.y); c.closePath();
}
/** Station dial position, shared by the painted face and the live hands. */
function stationClock(x: number, y: number, axis: "x" | "y") {
  const alongX = axis === "x", sx = x + (alongX ? .42 : .93), sy = y + (alongX ? .93 : .42);
  return iso(sx + (alongX ? .115 : 0), sy + (alongX ? 0 : .115), 19);
}
function clockHands(c: CanvasRenderingContext2D, minutes: number, at: (angle: number, length: number) => Point, center: Point, color: string, width: number) {
  const minute = minutes % 60 / 60 * Math.PI * 2, hour = (minutes / 60 % 12) / 12 * Math.PI * 2;
  line(c, center, at(hour, .5), color, width * 1.2); line(c, center, at(minute, .78), color, width);
}
/**
 * Scene objects for the parts standing on a road tile: lamps, signals, the bus stop, a footbridge, street trees, a
 * utility pole, a curve mirror, a post box, a vending machine, stop signs and guardrails. Keys hold everything that
 * changes the artwork relative to its origin, so identical parts share one cached sprite.
 */
function roadObjects(objects: SceneObject[], l: RoadLayout, lampAt: number) {
  const lift = l.bridge ? 5 : 0, tile = l.tile, rel = (n: number) => n.toFixed(3);
  const put = (px: number, py: number, depth: number, key: string, bounds: SpriteBounds, paint: SceneObject["paint"], extra: Partial<SceneObject> = {}) => {
    const origin = iso(px, py);
    objects.push({
      x: origin.x, y: origin.y, depth: px + py + depth, key: lift ? `${key}:b` : key, bounds: lift ? { ...bounds, top: bounds.top - lift, height: bounds.height + lift } : bounds,
      paint: lift ? (c, night, lit) => { c.save(); c.translate(0, -lift); paint(c, night, lit); c.restore(); } : paint, tile, ...extra,
    });
  };
  const across = l.axis === "x" ? "y" as const : "x" as const, straight = l.shape === "straight" || l.shape === "end" || l.shape === "none";
  for (const item of l.items) {
    const f = "facing" in item ? `${item.facing.dx},${item.facing.dy}` : "";
    switch (item.kind) {
      case "lamp": put(item.x, item.y, .05, "rlamp", { left: -21, top: -33, width: 46, height: 45 }, (c, _night, lit) => lamp(c, item.x, item.y, lit), { lamp: lampAt, emits: true }); break;
      case "signal": {
        const key = `signal:${item.arms.map(a => `${rel(a.to.x - item.x)},${rel(a.to.y - item.y)},${a.head.facing.dx},${a.head.facing.dy}`).join("|")}:${item.walks.map(w => `${w.facing.dx},${w.facing.dy}`).join("|")}`;
        put(item.x, item.y, .1, key, { left: -24, top: -34, width: 48, height: 40 }, c => signalPost(c, item)); break;
      }
      case "busShelter": put(item.x, item.y, 0, `shelter:${f}`, { left: -27, top: -24, width: 54, height: 36 }, (c, night) => busShelter(c, item, night), { emits: true }); break;
      case "busSign": put(item.x, item.y, .02, `busSign:${f}`, { left: -6, top: -24, width: 12, height: 28 }, c => busSign(c, item)); break;
      case "footbridge":
        for (const [piece, depth] of [["loStair", .45], ["deckLo", 1], ["deckHi", 1.3], ["hiStair", 1.55], ["rail", 1.75]] as const) {
          put(l.x, l.y, depth, `footbridge:${l.axis}:${piece}`, { left: -34, top: -32, width: 68, height: 70 }, (c, night) => footbridge(c, l, piece, night), { emits: piece === "rail" });
        }
        break;
      case "tree": {
        // Anchored half a tile up, like the park trees, so it bends in the wind about its trunk.
        const origin = iso(item.x - .5, item.y - .5);
        objects.push({ x: origin.x, y: origin.y, depth: item.x + item.y + .02, key: "street-tree", bounds: { left: -18, top: -20, width: 36, height: 42 }, paint: c => streetTree(c, item), tile, sway: true });
        break;
      }
      case "pole": {
        const dx = l.x + .5 - item.x, dy = l.y + .5 - item.y;
        const toRoad = straight ? l.axis === "x" ? { dx: 0, dy: Math.sign(dy) } : { dx: Math.sign(dx), dy: 0 } : Math.abs(dx) > Math.abs(dy) ? { dx: Math.sign(dx), dy: 0 } : { dx: 0, dy: Math.sign(dy) };
        const lit = item.seed % 2 === 1;
        put(item.x, item.y, .03, `pole:${across}:${toRoad.dx},${toRoad.dy}:${item.seed % 6}`, { left: -12, top: -39, width: 26, height: 45 }, (c, _night, on) => utilityPole(c, item, across, toRoad, on), lit ? { lamp: lampAt, emits: true } : {});
        break;
      }
      case "mirror": put(item.x, item.y, .03, `mirror:${item.faces.map(m => `${m.dx},${m.dy}`).join("|")}`, { left: -10, top: -24, width: 20, height: 28 }, c => curveMirror(c, item)); break;
      case "postbox": put(item.x, item.y, .02, `postbox:${f}`, { left: -6, top: -15, width: 13, height: 18 }, c => postBox(c, item)); break;
      case "vending": put(item.x, item.y, .02, `road-vending:${f}:${tile % 4}`, { left: -16, top: -22, width: 32, height: 32 }, (c, night) => vendingMachine(c, item, tile, night), { emits: true }); break;
      case "stopSign": put(item.x, item.y, .02, `stop:${f}`, { left: -6, top: -24, width: 12, height: 27 }, c => stopSign(c, item)); break;
    }
  }
  // Guardrails in short pieces, so cars and people sort in front of or behind each piece.
  for (const [a, b] of l.rails) {
    const pieces = Math.max(1, Math.ceil(Math.hypot(b!.x - a!.x, b!.y - a!.y) / .26));
    for (let k = 0; k < pieces; k++) {
      const p = { x: a!.x + (b!.x - a!.x) * k / pieces, y: a!.y + (b!.y - a!.y) * k / pieces }, q = { x: a!.x + (b!.x - a!.x) * (k + 1) / pieces, y: a!.y + (b!.y - a!.y) * (k + 1) / pieces };
      const v = iso(q.x - p.x, q.y - p.y);
      put(p.x, p.y, (q.x - p.x + q.y - p.y) / 2 + .01, `rail:${rel(q.x - p.x)},${rel(q.y - p.y)}`, { left: Math.min(0, v.x) - 3, top: Math.min(0, v.y) - 8, width: Math.abs(v.x) + 6, height: Math.abs(v.y) + 11 }, c => guardrail(c, p, q));
    }
  }
}
export class TownScene {
  private readonly traffic = new Traffic();
  private lastTiles: Tile[] | null = null;
  private lastLevels: number[] | null = null;
  private lastTerrain: boolean[] | null = null;
  private lastLook = "";
  private lastParks: ParkLot[] | null = null;
  private lastAttachments: Town["attachments"] | null = null;
  private objects: SceneObject[] = [];
  private effects: { kind: Tile; x: number; y: number; level?: number }[] = [];
  private clocks: { x: number; y: number; depth: number; dials: ((across: number, high: number) => Point)[] }[] = [];
  private homes: number[] = [];
  private readonly life = new TownLife();
  private readonly sky: SkyPainter;
  private roadNeighbours = new Map<number, number[]>();
  private lastRoutes: number[][] | null = null;
  private lastRouteTiles: Tile[] | null = null;
  private trainRoutes: TransportRoute[] = [];
  /** Level crossings: where train routes pass them, every crossing tile, and each barrier from 0 (up) to 1 (down). */
  private crossingStops: { tile: number; route: number; distance: number }[] = [];
  private crossingTiles: number[] = [];
  private barriers = new Map<number, number>();
  private ringing = new Set<number>();
  private readonly createCanvas: (() => HTMLCanvasElement) | null;
  private readonly sprites: TownSprites | null;
  private ground: HTMLCanvasElement | null = null;
  private groundState: { tiles: Tile[]; terrain: boolean[]; grid: boolean; parks: ParkLot[]; attachments: Town["attachments"]; look: string } | null = null;
  /** Road parts of every road tile, as placed for its shape; the wires between utility poles; tiles with traffic lights. */
  private roadLayouts = new Map<number, RoadLayout>();
  private wires: { from: Point; to: Point; across: ["x" | "y", "x" | "y"]; depth: number; seed: number }[] = [];
  private signalLayouts: RoadLayout[] = [];
  private busStops = "";
  constructor(createCanvas?: () => HTMLCanvasElement) {
    this.life.reduced = this.reducedMotion;
    this.createCanvas = createCanvas ?? (typeof document !== "undefined" ? () => document.createElement("canvas") : null);
    this.sprites = this.createCanvas ? new TownSprites(this.createCanvas) : null;
    this.sky = new SkyPainter(this.createCanvas);
  }
  private time = 0;
  /** Weather, sky and wind keep moving at their own pace, independent of the 1×/2×/4× town speed. */
  private ambient = 0;
  private readonly reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  camera: TownCamera = { x: 0, y: 0, zoom: 1 };
  /** Fireworks over the town at night, confetti by day (level ups). */
  celebrate(night: boolean) { if (!this.reducedMotion) this.life.celebrate(night); }
  /** People in a park right now and what they are mostly doing. */
  parkActivity(lotId: number) { return this.life.activity(lotId); }
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
    const extras = new Map((town.attachments ?? []).map(a => [a.tile, a.parts]));
    // Reverse the renderer's painter order so visible roofs and walls select their own building.
    for (let depth = (MAP_SIZE - 1) * 2; depth >= 0; depth--) {
      for (let y = Math.min(depth, MAP_SIZE - 1); y >= Math.max(0, depth - MAP_SIZE + 1); y--) {
        const x = depth - y, i = y * MAP_SIZE + x, origin = iso(x, y);
        if (Math.abs(p.x - origin.x) > 36 || p.y > origin.y + 33) continue;
        const kind = town.tiles[i]!, level = town.levels[i] || 1, parts = extras.get(i) ?? [];
        const fittings = facilityLayout(kind, level, parts), height = Math.max(85, ...fittings.map(f => f.z + f.height + 4));
        if (p.y < origin.y - height) continue;
        if ([...buildingFaces(kind, x, y, level, stationAxis(town, i)), ...facilityFaces(kind, x, y, level, parts)].some(face => contains(p, face))) return i;
        const part = parkAt(town, i)?.parts.find(p => p.tile === i && PARK_PARTS.find(s => s.id === p.kind)?.layer === "object");
        if (part && part.kind === "tree") {
          const center = iso(x + .5, y + .5);
          if (contains(p, [{ x: center.x - 9, y: center.y - 10 }, { x: center.x - 10, y: center.y - 21 }, { x: center.x, y: center.y - 29 }, { x: center.x + 10, y: center.y - 21 }, { x: center.x + 9, y: center.y - 10 }])) return i;
        } else if (part && decorationPickFaces(part.kind, x, y, part.rotation).some(face => contains(p, face))) return i;
        else if (part && PARK_ART_HEIGHT[part.kind] && boxFaces(x + .12, y + .12, .76, .76, PARK_ART_HEIGHT[part.kind]!).some(face => contains(p, face))) return i;
        else if (part && boxFaces(x + .15, y + .2, .7, .6, part.kind === "playground" ? 15 : part.kind === "light" ? 23 : 8).some(face => contains(p, face))) return i;
      }
    }
    return this.tileAt(px, py);
  }
  tileBounds(i: number, town: Town) {
    const x = i % MAP_SIZE, y = Math.floor(i / MAP_SIZE), { camera } = this;
    const parts = town.attachments?.find(a => a.tile === i)?.parts ?? [];
    const points = [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1), ...buildingFaces(town.tiles[i]!, x, y, town.levels[i] || 1, stationAxis(town, i)).flat(), ...facilityFaces(town.tiles[i]!, x, y, town.levels[i] || 1, parts).flat()];
    const lot = parkAt(town, i);
    if (lot) {
      points.push(iso(lot.x, lot.y), iso(lot.x + lot.width, lot.y), iso(lot.x + lot.width, lot.y + lot.height), iso(lot.x, lot.y + lot.height));
      points.push(iso(lot.x + .5, lot.y + .5, 40));
      for (const part of lot.parts) points.push(iso(part.tile % MAP_SIZE + .5, Math.floor(part.tile / MAP_SIZE) + .5, ["tree", "cherry", "pine", "gazebo", "clock", "arch", "swings"].includes(part.kind) ? 42 : PARK_ART_HEIGHT[part.kind] ?? 25));
    } else if (town.tiles[i] === "park") points.push(iso(x + .5, y + .5, 40));
    return {
      left: camera.x + Math.min(...points.map(p => p.x)) * camera.zoom,
      right: camera.x + Math.max(...points.map(p => p.x)) * camera.zoom,
      top: camera.y + Math.min(...points.map(p => p.y)) * camera.zoom,
      bottom: camera.y + Math.max(...points.map(p => p.y)) * camera.zoom,
    };
  }
  /** Season palettes and snow change artwork, so they take part in the cache keys. */
  private look() {
    return `${paintState.season}:${paintState.blossom > .15 ? "b" : ""}${Math.round(paintState.foliage * 8)}:${Math.round(paintState.bare * 8)}:${paintState.lush > .35 ? "l" : ""}${paintState.snow ? ":s" : ""}${paintState.liveClocks ? ":c" : ""}${paintState.liveParts ? ":w" : ""}:${paintState.flora}:${Math.round(paintState.wisteria * 8)}${paintState.tanabata ? ":t" : ""}`;
  }
  private prepareObjects(town: Town) {
    const look = this.look();
    if (this.lastTiles === town.tiles && this.lastLevels === town.levels && this.lastTerrain === town.terrain && this.lastLook === look && this.lastParks === town.parks && this.lastAttachments === town.attachments) return;
    const tilesChanged = this.lastTiles !== town.tiles;
    if (tilesChanged) {
      this.roadNeighbours = new Map(town.tiles.flatMap((tile, i) => isRoadTile(tile) ? [[i, neighbours(i % MAP_SIZE, Math.floor(i / MAP_SIZE)).filter(n => isRoadTile(town.tiles[n]) && opens(town.tiles, i, n, "road"))] as const] : []));
      this.crossingTiles = town.tiles.flatMap((tile, i) => tile === "crossing" ? [i] : []);
      for (const tile of [...this.barriers.keys()]) if (!this.crossingTiles.includes(tile)) this.barriers.delete(tile);
    }
    const objects: SceneObject[] = [], effects: typeof this.effects = [], clocks: typeof this.clocks = [], homes: number[] = [];
    const add = (x: number, y: number, depth: number, key: string, bounds: SpriteBounds, paint: SceneObject["paint"], extra: Partial<SceneObject> = {}) => {
      const origin = iso(x, y); objects.push({ x: origin.x, y: origin.y, depth: x + y + depth, key, bounds, paint, tile: y * MAP_SIZE + x, ...extra });
    };
    const extras = new Map((town.attachments ?? []).map(a => [a.tile, a.parts])), covered = new Set((town.parks ?? []).flatMap(lotTiles)), layouts = new Map<number, RoadLayout>();
    for (let y = 0; y < MAP_SIZE; y++) for (let x = 0; x < MAP_SIZE; x++) {
      const i = y * MAP_SIZE + x, tile = town.tiles[i]!, level = town.levels[i] || 1;
      if (["house", "shop", "factory", "station", "park", "home"].includes(tile) && !covered.has(i)) {
        const axis = tile === "station" ? stationAxis(town, i) : "x", access = tile === "home" ? transportMask(town, i, "road") : 0;
        if (tile === "home") homes.push(i);
        // Daytime upper floors share one palette at Lv.3 and three at Lv.2; lit windows vary by building.
        const nightStyle = tile === "station" ? 0 : Math.floor(hash(i) * 20);
        let dayStyle = tile === "station" || tile === "factory" ? 0 : nightStyle;
        if ((tile === "house" || tile === "shop") && level > 1) dayStyle = level >= 3 ? 0 : dayStyle % 3;
        const parts = extras.get(i) ?? [], base = `${tile}:${level}:${axis}:${parts.slice().sort().join(",")}${tile === "home" ? `:${access}` : ""}`;
        const keys = { key: `${base}:${dayStyle}`, nightKey: `${base}:${nightStyle}`, emits: true };
        const faces = [...buildingFaces(tile, x, y, level, axis), ...facilityFaces(tile, x, y, level, parts)].flat(), origin = iso(x, y);
        const top = Math.min(-24, ...faces.map(p => p.y - origin.y)) - 4;
        const h = Math.max(tile === "house" || tile === "shop" || tile === "factory" ? buildingHeight(tile, level) : tile === "home" ? 48 : 32, ...facilityLayout(tile, level, parts).map(p => p.z + p.height));
        const right = Math.max(38, h * .8 + 24), bottom = Math.max(parts.includes("light") ? 52 : 38, h * .22 + 32);
        const bounds = { left: -38, top, width: right + 38, height: bottom - top };
        if (tile === "station") {
          add(x, y, .35, keys.key + ":base", bounds, (c, night) => station(c, x, y, axis, night, false), { nightKey: keys.nightKey + ":base", emits: true });
          // Platform furniture has its own depth so a train cannot paint through it.
          for (const part of parts.filter(p => p !== "light")) add(x, y, part === "planter" ? 1.62 : part === "bench" ? 1.37 : 1.07, keys.key + ":part:" + part, bounds, (c, night) => facilityParts(c, tile, x, y, level, [part], night, axis), { nightKey: keys.nightKey + ":part:" + part, emits: part === "vending" });
          // Trains run between the platform and canopy, with visible supporting pillars.
          add(x, y, 1.55, keys.key + ":roof", bounds, (c, night) => { station(c, x, y, axis, night, true); facilityParts(c, tile, x, y, level, parts.filter(p => p === "light"), night, axis); }, { nightKey: keys.nightKey + ":roof", emits: true });
          clocks.push({ x, y, depth: x + y + 1.56, dials: [] });
        } else add(x, y, 1, keys.key, bounds, (c, night) => { facilityParts(c, tile, x, y, level, parts, night, axis, true); building(c, tile, x, y, level, night, 0, false, axis, access, false, parts); facilityParts(c, tile, x, y, level, parts, night, axis); }, keys);
        if (tile === "factory" || tile === "park") effects.push({ kind: tile, x, y, level });
      }
      if (tile === "grass" && hash(i * 3) > .63 && !neighbours(x, y).some(n => ["road", "rail", "station", "crossing"].includes(town.tiles[n]!))) {
        const size = Math.round((8 + hash(i * 7) * 9) * 2) / 2, v = hash(i * 5), variant = v < .3 ? .1 : v > .88 ? .95 : .5;
        const palette = variant < .3 ? "conifer" : treePalette(i, variant), bounds = { left: -size - 2, top: 16 - size * 2.55 - 2, width: size * 2 + 12, height: size * 2.55 + 8 };
        // Reuse identical trees instead of retaining hundreds of almost identical bitmaps.
        add(x, y, 1, `tree:${size}:${variant}:${palette}`, bounds, c => tree(c, x + .5, y + .5, size, variant, 0, palette === "conifer" ? "default" : palette), { sway: true });
      }
      if (tile === "crossing") {
        const axis = crossingAxis(town.tiles, i);
        crossingGates(axis).forEach((gate, k) => {
          const u = axis === "x" ? gate.along : gate.across, v = axis === "x" ? gate.across : gate.along;
          add(x, y, u + v, `crossing-post:${axis}:${k}`, { left: -34, top: -16, width: 68, height: 40 }, c => crossingPost(c, x, y, axis, gate));
        });
      }
      if (tile === "road") {
        const layout = roadLayout(town, i, !town.terrain[i] && (x + y) % 7 === 0);
        layouts.set(i, layout);
        roadObjects(objects, layout, hash(i * 5.3 + 2));
      }
      if ((tile === "road" || tile === "rail") && town.terrain[i]) add(x, y, 1.4, `bridge:${tile}:${transportMask(town, i, tile)}`, { left: -36, top: -14, width: 72, height: 52 }, c => bridgeRails(c, town, x, y, tile));
    }
    for (const lot of town.parks ?? []) {
      for (const part of lot.parts) if (part.kind !== "path") {
        const x = part.tile % MAP_SIZE, y = Math.floor(part.tile / MAP_SIZE), tall = part.kind === "tree" || part.kind === "cherry" || part.kind === "pine" || PARK_ART_SWAY.has(part.kind);
        const variant = parkArtVariant(part.kind, part.tile), lamp = part.kind === "light" || part.kind === "lantern";
        const palette = part.kind === "tree" ? treePalette(part.tile, .6) : part.kind === "cherry" ? `${paintState.blossom > .15 || paintState.season === "default" ? "bloom" : paintState.bare > .5 ? "bare" : paintState.foliage > .35 ? "red" : "green"}` : part.kind === "flowers" ? paintState.snow || paintState.season === "winter" && paintState.bare > .5 ? "dormant" : "bloom" : "";
        add(x, y, PARK_PARTS.find(p => p.id === part.kind)?.layer === "ground" ? .08 : 1, `park-part:${part.kind}:${part.rotation}:${palette}:${variant}`, { left: -40, top: -36, width: 80, height: 86 },
          (c, night, lit) => parkPart(c, part.kind, x, y, part.rotation, lamp ? lit : night, palette as TreePalette, variant),
          { sway: tall, emits: part.kind === "light" || part.kind === "clock" || PARK_ART_LIGHTS.has(part.kind) || part.kind === "parasol", ...(lamp ? { lamp: hash(part.tile * 3.7 + 1) } : {}) });
        if (part.kind === "clock") clocks.push({ x, y, depth: x + y + 1.001, dials: clockDials(x, y, part.rotation) });
      }
      // One gate on each side that faces a road; people come and go through it.
      const gates = new Set(parkGates(lot, town.tiles).map(g => `${g.cell}:${g.dx}:${g.dy}`));
      for (const i of lotTiles(lot)) {
        const x = i % MAP_SIZE, y = Math.floor(i / MAP_SIZE);
        for (const { bit, dx, dy } of DIRECTIONS) {
          if (!(dx < 0 && x === lot.x || dx > 0 && x === lot.x + lot.width - 1 || dy < 0 && y === lot.y || dy > 0 && y === lot.y + lot.height - 1)) continue;
          const gate = gates.has(`${i}:${dx}:${dy}`), nx = x + dx, ny = y + dy, back = dx < 0 || dy < 0;
          if (nx < 0 || ny < 0 || nx >= MAP_SIZE || ny >= MAP_SIZE || !isRoadTile(town.tiles[ny * MAP_SIZE + nx])) {
            add(x, y, back ? .05 : 1.9, `fence:${bit}:${gate}`, { left: -36, top: -8, width: 72, height: 48 }, c => parkFence(c, x, y, bit, gate));
            continue;
          }
          // Along a street the fence goes in four stretches, each sorted where it stands, so people on the
          // sidewalk and passing cars are drawn in front of it and visitors inside behind it.
          for (let k = 0; k < 4; k++) add(x, y, back ? .08 + .92 * (k + .5) / 4 : .99 + .92 * (k + 1) / 4, `fence:${bit}:${gate}:${k}`, { left: -36, top: -8, width: 72, height: 48 }, c => parkFence(c, x, y, bit, gate, k / 4, (k + 1) / 4));
        }
      }
    }
    if (this.lastTiles && this.lastLevels && this.lastParks && this.lastAttachments && (this.lastTiles !== town.tiles || this.lastLevels !== town.levels || this.lastParks !== town.parks || this.lastAttachments !== town.attachments)) {
      this.life.changed({ ...town, tiles: this.lastTiles, levels: this.lastLevels, parks: this.lastParks, attachments: this.lastAttachments }, town);
    }
    // Wires hang between the utility poles of neighbouring road tiles, drawn after both poles.
    this.wires = wireSpans(layouts).map(w => {
      const a = layouts.get(w.tiles[0])!, b = layouts.get(w.tiles[1])!;
      return { from: w.from, to: w.to, across: [a.axis === "x" ? "y" : "x", b.axis === "x" ? "y" : "x"] as ["x" | "y", "x" | "y"], depth: Math.max(w.from.x + w.from.y, w.to.x + w.to.y) + .06, seed: w.tiles[0] };
    });
    for (const w of this.wires) {
      const origin = iso(w.from.x, w.from.y), v = iso(w.to.x - w.from.x, w.to.y - w.from.y);
      objects.push({ x: origin.x, y: origin.y, depth: w.depth, key: `wire:${(w.to.x - w.from.x).toFixed(3)},${(w.to.y - w.from.y).toFixed(3)}:${w.across.join("")}`, bounds: { left: Math.min(0, v.x) - 6, top: Math.min(0, v.y) - 40, width: Math.abs(v.x) + 12, height: Math.abs(v.y) + 30 }, paint: c => poleWires(c, w.from, w.to, w.across[0], w.across[1]), tile: w.seed });
    }
    this.roadLayouts = layouts; this.signalLayouts = [...layouts.values()].filter(l => l.signal);
    const stops = [...layouts.values()].filter(l => l.busWait.length).map(l => l.tile), stopKey = stops.join();
    if (tilesChanged || stopKey !== this.busStops) {
      this.busStops = stopKey;
      this.traffic.sync(this.roadNeighbours, tile => isRoadTile(town.tiles[tile]), tile => town.tiles[tile] === "crossing", new Set(stops));
    }
    this.life.setRoadParts(layouts);
    this.objects = objects.sort((a, b) => a.depth - b.depth); this.effects = effects; this.clocks = clocks; this.homes = homes;
    this.lastTiles = town.tiles; this.lastLevels = town.levels; this.lastTerrain = town.terrain; this.lastLook = look;
    this.lastParks = town.parks; this.lastAttachments = town.attachments;
  }
  private drawGround(c: CanvasRenderingContext2D, town: Town, options: SceneOptions) {
    if (!this.createCanvas) { drawTerrain(c, town, options); return; }
    if (!this.ground) {
      this.ground = this.createCanvas(); this.ground.width = GROUND_BOUNDS.width * 2; this.ground.height = GROUND_BOUNDS.height * 2;
    }
    const previous = this.groundState, look = this.look();
    if (!previous || previous.tiles !== town.tiles || previous.terrain !== town.terrain || previous.grid !== options.grid || previous.parks !== town.parks || previous.attachments !== town.attachments || previous.look !== look) {
      const context = this.ground.getContext("2d"); if (!context) { drawTerrain(c, town, options); return; }
      context.setTransform(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, this.ground.width, this.ground.height);
      context.setTransform(2, 0, 0, 2, -GROUND_BOUNDS.left * 2, -GROUND_BOUNDS.top * 2); drawTerrain(context, town, options);
      this.groundState = { tiles: town.tiles, terrain: town.terrain, grid: options.grid, parks: town.parks, attachments: town.attachments, look };
    }
    c.drawImage(this.ground, GROUND_BOUNDS.left, GROUND_BOUNDS.top, GROUND_BOUNDS.width, GROUND_BOUNDS.height);
  }
  private applyPaintState(env: TownEnvironment | undefined) {
    if (!env) return;
    Object.assign(paintState, {
      litThreshold: env.windows === "late" ? .8 : .25, shopsOpen: env.shopsOpen, snow: env.snowCover, season: env.season,
      blossom: env.blossom, foliage: env.foliage, bare: env.bare, lush: env.lush, liveClocks: true, liveParts: true, wisteria: env.wisteria, flora: env.flora, tanabata: tanabataSeason(env),
    });
  }
  render(c: CanvasRenderingContext2D, width: number, height: number, town: Town, options: SceneOptions, dt: number) {
    const env = options.environment, step = Math.min(dt, .1);
    if (!options.paused) { this.time += step * options.speed; this.ambient += step; }
    this.applyPaintState(env);
    try { this.paintFrame(c, width, height, town, options, env, step); }
    finally { resetPaintState(); }
  }
  private paintFrame(c: CanvasRenderingContext2D, width: number, height: number, town: Town, options: SceneOptions, env: TownEnvironment | undefined, step: number) {
    const time = this.time, ambient = this.ambient, reduced = this.reducedMotion;
    const night = env ? env.night : options.night ? 1 : 0;
    this.prepareObjects(town);
    this.sprites?.beginFrame(6);
    if (this.lastRoutes !== options.routes || this.lastRouteTiles !== town.tiles) {
      this.trainRoutes = options.routes.slice(0, 12).filter(route => route.length >= 3 && route.every(i => isRailTile(town.tiles[i]))).map(measureTransportRoute);
      // Where each train route passes a level crossing, as a distance along the route.
      this.crossingStops = this.trainRoutes.flatMap((route, r) => route.tiles.flatMap((tile, k) => town.tiles[tile] === "crossing" ? [{ tile, route: r, distance: route.samples[Math.min(route.samples.length - 1, k * 24)]!.distance }] : []));
      this.lastRoutes = options.routes;
      this.lastRouteTiles = town.tiles;
    }
    if (env) this.sky.draw(c, width, height, env, ambient, skyHorizon(height), reduced);
    else {
      const sky = c.createLinearGradient(0, 0, 0, height); sky.addColorStop(0, options.night ? "#203e51" : "#b8d8cf"); sky.addColorStop(1, options.night ? "#314e53" : "#e9ecd8");
      c.fillStyle = sky; c.fillRect(0, 0, width, height);
      for (let j = 0; j < 4; j++) { const px = ((j * .27 + time * .0007) % 1.5 - .2) * width; ellipse(c, { x: px, y: 55 + j * 47 }, 85, 15, options.night ? "#ffffff03" : "#fffef014"); }
    }
    c.save(); c.translate(this.camera.x, this.camera.y); c.scale(this.camera.zoom, this.camera.zoom);
    this.drawGround(c, town, options);
    const transform = c.getTransform?.();
    const spriteResolution = Math.max(3, Math.min(7, Math.ceil(transform ? Math.hypot(transform.a, transform.b) : this.camera.zoom * 2)));
    const detail = this.camera.zoom > 1.5;
    if (detail) {
      // At close range, draw the few visible streets as vectors to retain sharp rails and markings.
      const left = -this.camera.x / this.camera.zoom - 40, right = (width - this.camera.x) / this.camera.zoom + 40;
      const top = -this.camera.y / this.camera.zoom - 40, bottom = (height - this.camera.y) / this.camera.zoom + 20;
      for (let depth = 0; depth < MAP_SIZE * 2 - 1; depth++) for (let y = Math.max(0, depth - MAP_SIZE + 1); y <= Math.min(depth, MAP_SIZE - 1); y++) {
        const x = depth - y, tile = town.tiles[y * MAP_SIZE + x], p = iso(x, y);
        if (p.x < left || p.x > right || p.y < top || p.y > bottom) continue;
        transportTile(c, town, x, y, tile!);
      }
    }
    // Level crossings ring and lower their barriers while a train comes near, and lift them once it has passed.
    const townStep = options.paused ? 0 : step * options.speed;
    this.ringing = new Set(this.crossingStops.filter(stop => {
      const { center, heading } = trainAt(this.trainRoutes[stop.route]!, stop.route, time), ahead = (stop.distance - center) * heading;
      return ahead > -.9 && ahead < 1.6;
    }).map(stop => stop.tile));
    for (const tile of this.crossingTiles) {
      const now = this.barriers.get(tile) ?? 0, target = this.ringing.has(tile) ? 1 : 0;
      this.barriers.set(tile, now + Math.max(-townStep / 1.1, Math.min(townStep / 1.1, target - now)));
    }
    const closed = new Set(this.crossingTiles.filter(tile => this.ringing.has(tile) || (this.barriers.get(tile) ?? 0) > .02));
    // People cross on the walk light and when no car is coming; at a crossing without lights they let a car
    // that has waited a while go first. Passengers get on a bus standing at their side of the stop.
    const armTile = (tile: number, arm: number) => arm === 1 ? tile - 1 : arm === 2 ? tile + 1 : arm === 4 ? tile - MAP_SIZE : arm === 8 ? tile + MAP_SIZE : null;
    this.life.mayCross = (cross, along) => {
      const l = this.roadLayouts.get(cross.tile);
      if (l?.signal) { const state = signalState(l, time); if ((along === "x" ? state.walkX : state.walkY) !== "walk") return false; }
      const near = armTile(cross.tile, cross.arm);
      if (this.traffic.occupied(cross.tile, near)) return false;
      return Boolean(l?.signal) || this.traffic.waiting(cross.tile, near) < 3;
    };
    this.life.boarding = new Map(this.traffic.dwelling().flatMap(d => {
      const l = this.roadLayouts.get(d.tile); if (!l) return [];
      const ahead = (l.axis === "x" ? d.dx : d.dy) > 0, side = plusSide(l.axis);
      return [[d.tile, (ahead ? side : -side) as -1 | 1] as const];
    }));
    if (env) {
      this.life.sync(town, this.roadNeighbours);
      this.life.closed = closed;
      if (!options.paused) this.life.update(step * options.speed, step, env);
      this.life.drawWater(c, env, ambient, reduced);
      drawCloudShadows(c, env, ambient, reduced);
      if (night > 0) {
        c.save(); c.globalCompositeOperation = "multiply"; c.fillStyle = mixColor("#ffffff", NIGHT_AMBIENT, night); groundPath(c); c.fill();
        // The soft shadow under the island darkens with the sky as well.
        c.globalAlpha = .5; c.beginPath(); c.ellipse(iso(12, 12).x, iso(12, 12).y, 820, 390, 0, 0, Math.PI * 2); c.fill(); c.restore();
      }
    }
    const highlight = (i: number, color: string, fill: string) => { const x = i % MAP_SIZE, y = Math.floor(i / MAP_SIZE), z = town.terrain[i] ? 5.5 : 1; poly(c, [iso(x, y, z), iso(x + 1, y, z), iso(x + 1, y + 1, z), iso(x, y + 1, z)], fill, color, 1.8); };
    const previewTiles = options.preview.length ? options.preview : options.hover !== null && options.tool !== "pan" && options.tool !== "inspect" ? [options.hover] : [];
    const strokes = new Map(strokeAxes(previewTiles).map((axis, k) => [previewTiles[k]!, axis]));
    const allowedAt = (i: number) => {
      if (options.tool === "decorate") {
        const lot = town.parks.find(l => l.id === options.editLot);
        return Boolean(lot && (options.parkPart === "remove" ? lot.parts.some(p => p.tile === i) : canPlaceParkPart(lot, i, options.parkPart ?? "tree")));
      }
      const tile = town.tiles[i];
      const hasAccess = !["house", "shop", "factory", "home"].includes(options.tool) || touchesRoad(town.tiles, i % MAP_SIZE, Math.floor(i / MAP_SIZE));
      if (options.tool === "home" && town.tiles.includes("home")) return false;
      // A road across a straight railway (or a railway across a straight road) makes a level crossing; the stroke passes over its own kind.
      const line = options.tool === "road" || options.tool === "rail", passes = line && (tile === options.tool || tile === "crossing");
      return options.tool === "bulldoze" || tile === "grass" && hasAccess || tile === "water" && line || passes || (options.tool === "road" || options.tool === "rail") && canCross(town, options.tool, i, strokes.get(i));
    };
    const selectedLot = options.selected === null ? undefined : parkAt(town, options.selected), editor = town.parks?.find(l => l.id === options.editLot);
    if (selectedLot || editor) {
      const lot = editor ?? selectedLot!;
      poly(c, [iso(lot.x, lot.y, 1.5), iso(lot.x + lot.width, lot.y, 1.5), iso(lot.x + lot.width, lot.y + lot.height, 1.5), iso(lot.x, lot.y + lot.height, 1.5)], "#d8b56610", "#f4d184", 1.8);
      if (editor) for (const i of lotTiles(editor)) highlight(i, "#65825b66", "#ffffff00");
    } else if (options.selected !== null) highlight(options.selected, "#f4d184", "#d8b56618");
    if (options.tool === "park" && previewTiles.length) {
      const i = previewTiles[0]!, x = i % MAP_SIZE, y = Math.floor(i / MAP_SIZE), size = options.parkSize ?? "small", lot = parkFootprint(x, y, size, options.parkRotated);
      const valid = canBuyPark(town, x, y, size, options.parkRotated);
      poly(c, [iso(x, y, 1), iso(x + lot.width, y, 1), iso(x + lot.width, y + lot.height, 1), iso(x, y + lot.height, 1)], valid ? "#bdd0a655" : "#ef957944", valid ? "#efdaa0" : "#d87962", 2);
    } else for (const i of previewTiles) highlight(i, allowedAt(i) ? "#efdaa0" : "#d87962", allowedAt(i) ? "#e6dba222" : "#ef957922");
    const moving: SceneObject[] = [];
    const add = (x: number, y: number, depth: number, paint: (c: CanvasRenderingContext2D) => void, bounds: SpriteBounds = { left: -28, top: -85, width: 66, height: 110 }) => { const origin = iso(x, y); moving.push({ x: origin.x, y: origin.y, depth: x + y + depth, bounds, paint }); };
    const windX = env ? Math.cos(env.windAngle) * (.5 + env.wind / 25) : 1;
    for (const { kind, x, y, level } of this.effects) {
      if (kind === "factory" && !reduced) add(x, y, 1.01, c => factorySmoke(c, x, y, time, level, windX, night), { left: -60, top: -112, width: 140, height: 145 });
    }
    if (env) for (const clock of this.clocks) {
      const paint = clock.dials.length
        ? (c: CanvasRenderingContext2D) => { for (const dial of clock.dials) { const probe = dial(1, 0), center = dial(0, 0), flip = probe.x >= center.x ? 1 : -1; clockHands(c, env.minutes, (a, r) => dial(Math.sin(a) * r * flip, Math.cos(a) * r), center, "#3f5a4c", .6); } }
        : (c: CanvasRenderingContext2D) => { const axis = stationAxis(town, clock.y * MAP_SIZE + clock.x), center = stationClock(clock.x, clock.y, axis); clockHands(c, env.minutes, (a, r) => ({ x: center.x + Math.sin(a) * r * 2.6, y: center.y - Math.cos(a) * r * 2.6 }), center, "#4e655e", .55); };
      moving.push({ x: iso(clock.x, clock.y).x, y: iso(clock.x, clock.y).y, depth: clock.depth, bounds: { left: -40, top: -60, width: 80, height: 70 }, paint });
    }
    const traffic = env ? Math.max(.12, env.traffic) : 1, carLights = env ? env.lightsOn > .35 || env.rain > .55 || env.fog > .5 : options.night;
    // Cars stop for a closed level crossing, a red or yellow light, a stop sign (a full stop first) and people on the crossings in their way.
    const armOf = (tile: number, n: number) => n === tile - 1 ? 1 : n === tile + 1 ? 2 : n === tile - MAP_SIZE ? 4 : 8;
    this.traffic.update(step, townStep, traffic, time, (tile, from, v) => {
      if (closed.has(tile)) return false;
      const l = this.roadLayouts.get(tile);
      if (l?.signal && signalState(l, time)[Math.abs(tile - from) === 1 ? "x" : "y"] !== "green") return false;
      if (l?.stopArms.length && !l.signal && v.halt < .9) return false;
      const people = this.life.crossing;
      return !people.size || !(people.has(`${tile}:0`) || people.has(`${tile}:${armOf(tile, from)}`) || people.has(`${tile}:${armOf(tile, v.next)}`));
    });
    // The lamps the signals show now, and the walk lights (blinking before they turn red).
    for (const l of this.signalLayouts) {
      const state = signalState(l, time), blink = Math.floor(ambient * 3) % 2 === 0;
      for (const item of l.items) if (item.kind === "signal") {
        for (const { head } of item.arms) if (facesViewer(head.facing)) {
          const light = state[head.approach], lamp = light === "green" ? 0 : light === "yellow" ? 1 : 2;
          add(item.x, item.y, .11, c => signalLight(c, head, lamp, night), { left: -20, top: -40, width: 40, height: 44 });
        }
        for (const walk of item.walks) if (facesViewer(walk.facing)) {
          const shown = walk.approach === "x" ? state.walkX : state.walkY;
          if (shown !== "flash" || blink) add(item.x, item.y, .11, c => walkLight(c, walk, shown !== "stop", night), { left: -10, top: -26, width: 20, height: 22 });
        }
      }
    }
    // Sparrows sit on the wires between utility poles, and now and then fly off and come back.
    if (env && env.night < .35 && env.rain < .3 && env.snow < .5 && !reduced) for (const w of this.wires) {
      const count = Math.floor(hash(w.seed * 3.7 + 1) * 4);
      for (let k = 0; k < count; k++) {
        const seed = w.seed * 7 + k, period = 34 + hash(seed) * 30, phase = (ambient + hash(seed * 1.3) * period) % period;
        const p = wirePoint(w.from, w.to, w.across[0], w.across[1], Math.floor(hash(seed * 4.3) * 3), .22 + hash(seed * 2.1) * .56);
        const away = phase - (period - 9), dir = hash(seed * 5.9) < .5 ? -1 : 1;
        let q = { x: p.x, y: p.y }, flap = 0;
        if (away > 0) {
          if (away > 3 && away < 6) continue;
          const f = away <= 3 ? away / 3 : (9 - away) / 3;
          q = { x: p.x + dir * 46 * f, y: p.y - 26 * f - 12 * f * f }; flap = ambient + seed;
        }
        const facing = hash(seed * 8.1) < .5 ? -1 : 1, hop = away > 0 ? 0 : Math.max(0, Math.sin(ambient * 1.7 + seed) - .96) * 30;
        moving.push({ x: q.x, y: q.y - hop, depth: p.depth + .07, bounds: { left: -6, top: -6, width: 12, height: 9 }, paint: c => wireBird(c, { x: q.x, y: q.y - hop }, facing, flap, night) });
      }
    }
    for (const tile of this.crossingTiles) {
      const x = tile % MAP_SIZE, y = Math.floor(tile / MAP_SIZE), axis = crossingAxis(town.tiles, tile), down = this.barriers.get(tile) ?? 0, ringing = this.ringing.has(tile) || down > .02;
      for (const gate of crossingGates(axis)) {
        const u = axis === "x" ? gate.along : gate.across, v = axis === "x" ? gate.across : gate.along;
        add(x + u, y + v, .001, c => crossingArm(c, x, y, axis, gate, down, ringing, ambient, night), { left: -36, top: -46, width: 72, height: 54 });
      }
    }
    for (const { vehicle: v, x, y, dx, dy } of this.traffic.poses()) {
      const z = elevationAt(town, x, y, "road");
      add(x, y, 0, c => {
        if (v.alpha < 1) { c.save(); c.globalAlpha *= v.alpha; }
        drawVehicle(c, v, x, y, z, dx, dy, night, carLights);
        if (v.alpha < 1) c.restore();
      });
    }
    if (env) {
      // Passengers gather after a train leaves and board while the next one stands at the platform.
      const crowds = new Map<number, number>(), base = 1 + env.activity * 4;
      for (let r = 0; r < this.trainRoutes.length; r++) {
        const route = this.trainRoutes[r]!, travel = route.length - .68, cycle = travel * 2 + 4, phase = (time * .45 + r * 4) % cycle;
        for (const [tile, departs] of [[route.tiles[0]!, 1], [route.tiles[route.tiles.length - 1]!, travel + 3]] as const) {
          const since = ((phase - departs) % cycle + cycle) % cycle, boarding = since > cycle - 2 ? (cycle - since) / 2 : 1;
          crowds.set(tile, Math.max(crowds.get(tile) ?? 0, base * Math.min(1, since / (cycle * .5) + .25) * boarding));
        }
      }
      this.life.platforms((x, y, depth, paint, bounds) => add(x, y, depth, paint, bounds), [...crowds].map(([tile, crowd]) => ({ tile, crowd, axis: stationAxis(town, tile) })), env, night, this.camera.zoom);
    }
    for (let r = 0; r < this.trainRoutes.length; r++) {
      const route = this.trainRoutes[r]!, max = route.length, { center, heading } = trainAt(route, r, time);
      for (let wagon = 0; wagon < 3; wagon++) {
        const pos = Math.max(0, Math.min(max, center + (wagon - 1) * .34)), { x, y, dx, dy } = sampleTransportDistance(route, pos), z = elevationAt(town, x, y, "rail");
        const lead = wagon === (heading > 0 ? 2 : 0);
        add(x, y, 0, c => {
          const faces = orientedBox(c, x, y, .29, .18, 9, dx, dy, [shade("#f3e5bf", night), shade("#8d9e94", night), shade("#d9e1cb", night)], z);
          orientedBox(c, x, y, .25, .16, .8, dx, dy, [shade("#abbab0", night), shade("#7a918a", night), shade("#e3e7d3", night)], z + 9);
          for (const a of [-.10, .10]) { const p = iso(x + dx * a, y + dy * a, z + 1); ellipse(c, p, 2.4, 1.1, shade("#3b4e46", night)); }
          for (const { a, b } of faces) {
            line(c, iso(a.x, a.y, z + 4), iso(b.x, b.y, z + 4), shade("#c37c5e", night), 1.5);
            const p = { x: a.x + (b.x - a.x) * .2, y: a.y + (b.y - a.y) * .2 }, q = { x: a.x + (b.x - a.x) * .8, y: a.y + (b.y - a.y) * .8 };
            poly(c, [iso(p.x, p.y, z + 5), iso(q.x, q.y, z + 5), iso(q.x, q.y, z + 8), iso(p.x, p.y, z + 8)], night > .4 ? "#ffe9a7" : shade("#739a9c", night));
          }
          if (lead && carLights) { const s = heading > 0 ? 1 : -1; ellipse(c, iso(x + dx * .15 * s, y + dy * .15 * s, z + 4), 1.4, 1, "#fff1b4"); }
        });
      }
    }
    if (env) {
      this.life.collect((x, y, depth, paint, bounds) => add(x, y, depth, paint, bounds), town, env, night, this.camera.zoom);
      for (const i of this.homes) {
        const hx = i % MAP_SIZE, hy = Math.floor(i / MAP_SIZE), selected = options.selected === i, wet = env.rain > .2 || env.snow > 0;
        const asleep = env.night > .75 && (env.windows === "late" || env.activity < .3), loop = (ambient / 16 + hash(i)) % 1;
        const walking = !asleep && !wet && !selected && loop < .62, angle = loop / .62 * Math.PI * 2;
        const u = walking ? .36 + Math.cos(angle) * .15 : .735, v = walking ? .8 + Math.sin(angle) * .065 : wet || asleep ? .84 : .87;
        add(hx + u, hy + v, .02, c => {
          const p = iso(hx + u, hy + v);
          drawDog(c, p, walking ? -Math.sin(angle) >= 0 ? 1 : -1 : 1, ambient * 8, night, "#efe6d6", { sleep: asleep || wet, wag: selected ? ambient * 30 : ambient * 9, jump: selected ? Math.abs(Math.sin(ambient * 6)) * 2.5 : 0 });
          if (asleep && !reduced) for (let j = 0; j < 2; j++) { const k = (ambient * .4 + j * .5) % 1; c.globalAlpha = 1 - k; line(c, { x: p.x + 2 + k * 3, y: p.y - 5 - k * 7 }, { x: p.x + 3.2 + k * 3, y: p.y - 5 - k * 7 }, shade("#eef2f8", night * .3), .45); line(c, { x: p.x + 3.2 + k * 3, y: p.y - 5 - k * 7 }, { x: p.x + 2 + k * 3, y: p.y - 3.8 - k * 7 }, shade("#eef2f8", night * .3), .45); line(c, { x: p.x + 2 + k * 3, y: p.y - 3.8 - k * 7 }, { x: p.x + 3.2 + k * 3, y: p.y - 3.8 - k * 7 }, shade("#eef2f8", night * .3), .45); c.globalAlpha = 1; }
        }, { left: -10, top: -16, width: 22, height: 20 });
      }
    }
    moving.sort((a, b) => a.depth - b.depth);
    const visible = (o: SceneObject) => {
      const left = this.camera.x + (o.x + o.bounds.left) * this.camera.zoom, top = this.camera.y + (o.y + o.bounds.top) * this.camera.zoom;
      return left < width && top < height && left + o.bounds.width * this.camera.zoom > 0 && top + o.bounds.height * this.camera.zoom > 0;
    };
    const sway = env && !reduced ? Math.min(.085, .012 + env.wind / 40 * .07) : 0, swayRate = env ? 1.1 + env.wind * .02 : 1;
    const lightsOn = env ? env.lightsOn : options.night ? 1 : 0, lightsKey = env ? `${env.windows}:${env.shopsOpen ? 1 : 0}` : "", look = this.look();
    const draw = (o: SceneObject) => {
      if (!visible(o)) return;
      const lit = o.lamp === undefined ? night > 0 : lightsOn > o.lamp;
      if (!o.key || !this.sprites) { o.paint(c, night >= .5, o.lamp === undefined ? night >= .5 : lit); return; }
      const bend = o.sway && sway ? Math.sin(ambient * swayRate + o.x * .05 + o.y * .031) * sway : 0;
      const rise = env && o.tile !== undefined && !o.sway ? this.life.rise(o.tile) : 1;
      if (bend || rise !== 1) { c.save(); const base = o.y + 16; c.translate(o.x, base); if (bend) c.transform(1, 0, bend, 1, 0, 0); if (rise !== 1) c.scale(rise < 1 ? .9 + rise * .1 : rise, rise); c.translate(-o.x, -base); }
      if (night < 1) this.sprites.draw(c, `${o.key}|${look}`, o.x, o.y, o.bounds, context => { context.save(); context.translate(-o.x, -o.y); o.paint(context, false, false); context.restore(); }, spriteResolution);
      if (night > 0) {
        const key = `${o.nightKey ?? o.key}|${look}|n${o.emits ? `:${lightsKey}` : ""}${o.lamp === undefined ? "" : lit ? ":on" : ":off"}`;
        const paint = (context: CanvasRenderingContext2D) => { context.save(); context.translate(-o.x, -o.y); o.paint(context, true, lit); context.restore(); };
        // Early dusk fills in night artwork a few sprites per frame; past halfway it must be complete.
        this.sprites.draw(c, key, o.x, o.y, o.bounds, paint, spriteResolution, { alpha: night, optional: night < .5, night: { ambient: NIGHT_AMBIENT, emissive: o.emits ? paint : () => {} } });
      }
      if (bend || rise !== 1) c.restore();
    };
    // The immutable scene is already sorted; merge only the small moving layer each frame.
    let movingIndex = 0;
    for (const o of this.objects) {
      while (movingIndex < moving.length && moving[movingIndex]!.depth < o.depth) draw(moving[movingIndex++]!);
      draw(o);
    }
    while (movingIndex < moving.length) draw(moving[movingIndex++]!);
    if (env) { drawSplashes(c, env, ambient, reduced); this.life.overlay(c, env, ambient, night, reduced); }
    for (const i of previewTiles) {
      if (options.tool === "decorate" && options.parkPart !== "remove" && allowedAt(i)) {
        // The ghost of a new swing keeps its seats: nobody swings on it yet.
        const live = paintState.liveParts; paintState.liveParts = false;
        c.save(); c.globalAlpha *= .5; parkPart(c, options.parkPart ?? "tree", i % MAP_SIZE, Math.floor(i / MAP_SIZE), options.partRotation ?? 0, night >= .5); c.restore();
        paintState.liveParts = live;
      } else if (allowedAt(i) && ["house", "shop", "factory", "station", "home"].includes(options.tool)) {
        c.save(); c.globalAlpha *= .55; building(c, options.tool as Tile, i % MAP_SIZE, Math.floor(i / MAP_SIZE), 1, night >= .5, time, true, stationAxis(town, i), transportMask(town, i, "road")); c.restore();
      }
    }
    c.restore();
    if (env) {
      if (env.grade && Math.min(...[1, 3, 5].map(i => parseInt(env.grade!.slice(i, i + 2), 16))) < 251) { c.save(); c.globalCompositeOperation = "multiply"; c.fillStyle = env.grade; c.fillRect(0, 0, width, height); c.restore(); }
      if (env.grey > .02) { c.save(); c.globalCompositeOperation = "saturation"; c.fillStyle = `rgba(128,128,128,${env.grey.toFixed(3)})`; c.fillRect(0, 0, width, height); c.restore(); }
      drawFog(c, width, height, env, ambient);
      drawPrecipitation(c, width, height, env, ambient, reduced);
      const flash = lightningFlash(env, ambient, reduced);
      if (flash > 0) { c.save(); c.globalCompositeOperation = "lighter"; c.fillStyle = `rgba(210,220,255,${flash * .5})`; c.fillRect(0, 0, width, height); c.restore(); }
      this.life.screen(c, width, height);
    }
  }
}
export function drawTownIcon(c: CanvasRenderingContext2D, kind: Tool, width: number, height: number) {
  // Leave room for the taller buildings and their cast shadows on all four sides.
  const scale = kind === "park" ? .48 : .72;
  c.clearRect(0, 0, width, height); c.save(); c.translate(width * .5 - 4, height - (kind === "park" ? 64 : 32) * scale - 5); c.scale(scale, scale);
  if (kind === "bulldoze") {
    box(c, -.34, -.30, .65, .12, 4, ["#667569", "#4b6055", "#839589"]);
    box(c, -.34, .10, .65, .12, 4, ["#667569", "#4b6055", "#839589"]);
    box(c, -.3, -.25, .6, .4, 8, ["#d9ac5d", "#b98843", "#f2cb7e"]);
    box(c, -.15, -.22, .25, .28, 12, ["#8caca4", "#527d78", "#f0c775"], 8);
    box(c, .3, -.3, .05, .6, 8, ["#b4b9a2", "#7f917f", "#d5d5be"]);
    for (const v of [-.30, .10]) for (let j = 0; j < 6; j++) line(c, iso(-.30 + j * .10, v + .12, .4), iso(-.30 + j * .10, v + .12, 3.6), "#bcc1a3", .7);
    for (const v of [-.18, .13]) line(c, iso(.03, v, 8), iso(.30, v, 5), "#e3c17c", 2);
    patch(c, -.3, -.25, .15, .4, "#e5bb6b", 8.2);
    line(c, iso(-.25, -.05, 8.3), iso(-.12, -.05, 8.3), "#947e50", .8);
  } else if (kind === "park") {
    const town = createIconTown("road"), lot: ParkLot = { id: 0, x: 0, y: 0, width: 2, height: 2, kind: "park", parts: [] };
    parkGround(c, lot, town); for (const bit of [1, 4]) parkFence(c, 0, 0, bit, false); for (const bit of [2, 8]) parkFence(c, 1, 1, bit, false);
    parkPart(c, "tree", 0, 0, 0, false);
  } else if (kind === "road" || kind === "rail") {
    const town = createIconTown(kind); transport(c, town, 0, 0, kind);
  } else building(c, kind, 0, 0, 1, false, 0, false);
  c.restore();
}
function createIconTown(kind: "road" | "rail"): Town {
  const tiles = Array<Tile>(MAP_SIZE ** 2).fill("grass"); tiles[0] = kind; tiles[1] = kind;
  return { tiles, levels: [], terrain: [], rewards: [], parks: [], attachments: [], money: 0, day: 1, paused: true };
}
/** Road parts shown in the shop on a short stretch of road: a T junction for those that belong at one. */
const ROAD_ICON_HEIGHT: Partial<Record<FacilityPart, number>> = { signal: 28, crosswalk: 2, stopSign: 15, busStop: 20, footbridge: 26, roadTrees: 28, pole: 37, mirror: 20, guardrail: 6, postbox: 9, paving: 2 };
function roadPartIcon(c: CanvasRenderingContext2D, part: FacilityPart) {
  const tiles = Array<Tile>(MAP_SIZE ** 2).fill("grass"), at = (x: number, y: number) => y * MAP_SIZE + x, tile = at(1, 1);
  for (const x of [0, 1, 2]) tiles[at(x, 1)] = "road";
  if (part === "stopSign" || part === "mirror") tiles[at(1, 2)] = "road";
  const town: Town = { tiles, levels: [], terrain: Array<boolean>(MAP_SIZE ** 2).fill(false), rewards: [], parks: [], attachments: [{ tile, kind: "road", parts: [part] }], money: 0, day: 1, paused: true };
  const height = ROAD_ICON_HEIGHT[part] ?? 12, scale = Math.min(.85, 50 / (height + 34));
  c.scale(scale, scale); c.translate(0, -(56 - height / 2));
  transport(c, town, 1, 1, "road");
  const layout = roadLayout(town, tile), objects: SceneObject[] = [];
  roadObjects(objects, layout, 1);
  for (const o of objects.sort((a, b) => a.depth - b.depth)) o.paint(c, false, false);
  for (const item of layout.items) {
    // Wires running on along the road, and the signal showing green.
    if (item.kind === "pole") for (const dx of [-1, 1]) poleWires(c, item, { x: item.x + dx, y: item.y }, "y", "y");
    if (item.kind === "signal") { for (const arm of item.arms) signalLight(c, arm.head, 0, 0); for (const walk of item.walks) walkLight(c, walk, false, 0); }
  }
}
export function drawTownPartIcon(c: CanvasRenderingContext2D, part: ParkPart | FacilityPart, width: number, height: number) {
  c.clearRect(0, 0, width, height); c.save(); c.translate(width / 2, height / 2 - 3); c.scale(.9, .9);
  if (part in ROAD_ICON_HEIGHT) { roadPartIcon(c, part as FacilityPart); c.restore(); return; }
  if (part === "terrace" || part === "canopy") {
    c.translate(-4, 5); c.scale(2, 2);
    seating(c, 0, 0, { u: 0, v: 0, w: .32, d: .18, z: 0, height: 12, part, mount: "ground" }, 1, false, part === "terrace", part === "canopy"); c.restore(); return;
  }
  if (part === "vending") {
    compactVending(c, 0, 0, { u: .27, v: .31, w: .46, d: .34, z: 0, height: 23, part, mount: "ground" }, false); c.restore(); return;
  }
  if (part === "planter") {
    facilityPlanter(c, 0, 0, { u: .28, v: .31, w: .44, d: .38, z: 0, height: 7, part, mount: "ground" }, 1, false); c.restore(); return;
  }
  const tall = PARK_ART_HEIGHT[part as ParkPart] ?? 0;
  if (tall > 30) { const s = 30 / tall; c.translate(0, 16 * (1 - s) + 4); c.scale(s, s); }
  if (drawParkArt(c, part, 0, 0, 0, false)) { c.restore(); return; }
  if (drawTownDecoration(c, part, 0, 0, 0, false)) { c.restore(); return; }
  if (["tree", "flowers", "bench", "fountain", "playground", "path", "light"].includes(part)) {
    parkPart(c, part as ParkPart, 0, 0, 0, false);
    if (part === "fountain") line(c, iso(.5, .5, 5), iso(.5, .5, 14), "#d9f7f0", 2);
  } else if (part === "garden") parkPart(c, "flowers", 0, 0, 0, false);
  else if (part === "greenbelt") { box(c, .15, .32, .7, .28, 2, ["#a4a185", "#7e8d6d", "#a4b882"]); for (const u of [.27, .5, .73]) tree(c, u, .46, 7.5, .6); }
  else if (part === "storage") {
    patch(c, .12, .18, .75, .7, "#b6b49a"); for (const [u, v, h] of [[.2, .25, 5], [.55, .3, 8], [.3, .65, 4]]) crate(c, u!, v!, .22, .2, h!);
  } else if (part === "solar") {
    solarPanel(c, .15, .20, .70, .55, 0);
  } else {
    line(c, iso(.5, .5), iso(.5, .5, 15), "#7d7056", 2); box(c, .24, .5, .54, .05, 7, ["#6c9881", "#476f63", "#d5caaa"], 11);
    const p = iso(.51, .56, 14.5); ellipse(c, p, 3, 3, "#e6d6ac"); ellipse(c, p, 1.4, 1.4, "#879c78");
  }
  c.restore();
}
