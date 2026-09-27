/**
 * おさんぽフレンチーのキャンバス描画（障害物・小物・色の計算）。
 * どれも状態を持たない関数で、座標は論理ピクセル（engine.ts の SC で拡大される）。
 */
import type { OsanpoRunStageId } from "@/lib/games/osanpo-run/config";

export type Ctx = CanvasRenderingContext2D;
export type RGB = [number, number, number];

let canvasFont = '"M PLUS Rounded 1c", sans-serif';
/** next/font で読み込んだ本文フォントをキャンバスの文字にも使う */
export function setCanvasFontFamily(family: string): void {
  canvasFont = family;
}
export function font(size: number): string {
  return `800 ${size}px ${canvasFont}`;
}

/* ---------- 色 ---------- */
export const WHITE: RGB = [255, 255, 255];
export const BLACK: RGB = [0, 0, 0];
export function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
export function rgb(a: RGB, alpha = 1): string {
  return `rgba(${a[0] | 0},${a[1] | 0},${a[2] | 0},${alpha})`;
}
export function shade(c: RGB, amount: number): RGB {
  return mix(c, amount > 0 ? WHITE : BLACK, Math.abs(amount));
}
/** 色相(0-360)を、MR アイテムの虹色に使う淡い "r,g,b" に変換する */
export function hslRgb(h: number): string {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (0.72 - 0.28 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return `${f(0)},${f(8)},${f(4)}`;
}

/* ---------- 図形 ---------- */
export function ell(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  c.beginPath();
  c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}
export function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  if (typeof c.roundRect === "function") c.roundRect(x, y, w, h, r);
  else c.rect(x, y, w, h);
}
export function glow(c: Ctx, x: number, y: number, r: number, col: string, a: number): void {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${col},${a})`);
  g.addColorStop(1, `rgba(${col},0)`);
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}
export function star(c: Ctx, x: number, y: number, r: number, col: string): void {
  c.fillStyle = col;
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const rad = i % 2 ? r * 0.38 : r;
    c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  c.closePath();
  c.fill();
}
function text(c: Ctx, s: string, x: number, y: number, size: number, color: string): void {
  c.fillStyle = color;
  c.font = font(size);
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(s, x, y);
}


/* Shared toy-like materials: crisp outlines, warm highlights, cool shaded edges.
 * Paths are fixed artwork, cached once; animation only changes the canvas transform.
 * No external textures, asynchronous loading, or per-frame image allocations. */
const artPaths = new Map<string, Path2D>();
function art(c: Ctx, d: string, fill: string | CanvasGradient, edge = "#493C50", width = 1.1): void {
  let p = artPaths.get(d);
  if (!p) { p = new Path2D(d); artPaths.set(d, p); }
  c.fillStyle = fill; c.fill(p);
  if (width > 0) { c.strokeStyle = edge; c.lineWidth = width; c.lineJoin = "round"; c.stroke(p); }
}
function material(c: Ctx, top: number, bottom: number, light: string, dark: string): CanvasGradient {
  const g = c.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, light); g.addColorStop(1, dark); return g;
}
function bead(c: Ctx, x: number, y: number, rx: number, ry: number, color: string): void {
  c.fillStyle = color; ell(c, x, y, rx, ry); c.fill();
}

/* ---------- まちの障害物 ---------- */
export function drawCone(c: Ctx, x: number, gy: number, w: number, h: number): void {
  c.save(); c.translate(x, gy); c.scale(w / 24, h / 34);
  art(c, "M1 -5 L22 -5 L24 -1 Q24 0 22 0 L2 0 Q0 0 0 -2 Z", material(c, -5, 0, "#5C6076", "#32364D"));
  art(c, "M9 -32 Q12 -34 15 -32 L22 -5 Q12 -2 2 -5 Z", material(c, -32, -4, "#FFBC67", "#E56A36"));
  art(c, "M7 -24 L17 -24 L18.5 -18 Q12 -16 5.5 -18 Z M4 -12 Q12 -10 20 -12 L21 -7 Q12 -4 3 -7 Z", "#FFF4D8", "#FFF4D8", 0);
  art(c, "M14 -31 L15 -31 L22 -5 L17 -4 Z", "rgba(144,64,44,.25)", "", 0);
  c.strokeStyle = "#FFE3AF"; c.lineWidth = 1.3; c.lineCap = "round"; c.beginPath(); c.moveTo(10, -29); c.lineTo(5, -9); c.stroke();
  bead(c, 12, -32, 2.6, 0.9, "#FFE5B2"); c.restore();
}

export function drawBike(c: Ctx, x: number, gy: number, w: number): void {
  const r = 12, rx = x + 13, fx = x + w - 13, wy = gy - r;
  c.lineCap = "round"; c.lineJoin = "round";
  c.strokeStyle = "rgba(42,36,64,.55)"; c.lineWidth = 0.8;
  for (const hx of [rx, fx]) {
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 4;
      c.beginPath(); c.moveTo(hx - Math.cos(a) * r, wy - Math.sin(a) * r); c.lineTo(hx + Math.cos(a) * r, wy + Math.sin(a) * r); c.stroke();
    }
  }
  c.strokeStyle = "#303C52"; c.lineWidth = 4;
  for (const hx of [rx, fx]) { c.beginPath(); c.arc(hx, wy, r, 0, Math.PI * 2); c.stroke(); }
  c.strokeStyle = "#C9CEDC"; c.lineWidth = 2;
  for (const hx of [rx, fx]) { c.beginPath(); c.arc(hx, wy, r + 3, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
  const bbX = x + w * 0.44, bbY = gy - 10, seatX = x + w * 0.34, seatY = gy - 33, headX = fx - 6, headY = gy - 31;
  c.strokeStyle = material(c, gy - 34, gy - 8, "#A2E4D6", "#339A9C"); c.lineWidth = 4.5;
  c.beginPath(); c.moveTo(rx, wy); c.lineTo(bbX, bbY); c.lineTo(seatX, seatY); c.lineTo(rx, wy);
  c.moveTo(bbX, bbY); c.quadraticCurveTo(x + w * 0.6, gy - 14, headX, headY); c.lineTo(fx, wy); c.stroke();
  c.fillStyle = "rgba(92,200,181,.55)"; rr(c, rx + 2, wy - 4, bbX - rx - 2, 6, 3); c.fill();
  c.strokeStyle = "#2A2440"; c.lineWidth = 2.4;
  c.beginPath(); c.moveTo(headX, headY); c.lineTo(headX - 3, gy - 42); c.lineTo(headX - 11, gy - 43); c.stroke();
  c.beginPath(); c.moveTo(bbX - 2, bbY); c.lineTo(bbX - 8, gy); c.stroke();
  c.fillStyle = "#2A2440"; ell(c, seatX - 1, seatY - 2, 7, 2.6); c.fill();
  c.fillStyle = material(c, gy - 45, gy - 34, "#FFE7BD", "#C79F7B"); rr(c, fx - 4, gy - 45, 17, 11, 2); c.fill();
  c.strokeStyle = "#9D7C69"; c.lineWidth = 0.8; c.beginPath();
  for (let i = 1; i < 4; i++) { c.moveTo(fx - 4 + i * 4.25, gy - 45); c.lineTo(fx - 4 + i * 4.25, gy - 34); }
  c.moveTo(fx - 4, gy - 39.5); c.lineTo(fx + 13, gy - 39.5); c.stroke();
  for (const hx of [rx, fx]) { bead(c, hx, wy, 2.6, 2.6, "#E0E8EF"); bead(c, hx, wy, 1.1, 1.1, "#5F718E"); }
  bead(c, fx + 10, gy - 32, 2, 2.3, "#FFD582");
}

export function drawPuddle(c: Ctx, x: number, gy: number, w: number, t: number, night: number, look: OsanpoRunStageId): void {
  const cx = x + w / 2, cy = gy + 5, rx = w / 2, ry = 7;
  const shape = (k: number, dx = 0, dy = 0) => {
    c.beginPath();
    c.ellipse(cx + dx, cy + dy, rx * k, ry * k, 0, 0, Math.PI * 2);
    c.ellipse(cx - rx * 0.35 + dx, cy + 1.2 + dy, rx * 0.55 * k, ry * 0.8 * k, 0, 0, Math.PI * 2);
  };
  // 濡れた縁（歩道が濃くなっている部分）
  c.fillStyle = "rgba(28,30,70,.28)"; shape(1.16, 0, 0.6); c.fill();
  // 水面：空を映した濃い青（山道は泥、雪国は氷）
  const g = c.createLinearGradient(0, cy - ry, 0, cy + ry);
  if (look === "hiking") { g.addColorStop(0, "#9A7652"); g.addColorStop(0.55, "#6E4E33"); g.addColorStop(1, "#4E3522"); }
  else if (look === "snow") { g.addColorStop(0, "#E8F6FF"); g.addColorStop(0.55, "#9FD0F0"); g.addColorStop(1, "#6FA8D8"); }
  else { g.addColorStop(0, night > 0.5 ? "#6E86D8" : "#8FC0FF"); g.addColorStop(0.55, "#3C6FD0"); g.addColorStop(1, "#244A9E"); }
  c.fillStyle = g; shape(1); c.fill();
  // 奥側のふち（光を受けて白っぽく光る）
  c.strokeStyle = `rgba(225,242,255,${0.75 + night * 0.25})`; c.lineWidth = 1.6;
  c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
  c.fillStyle = "rgba(255,255,255,.85)"; rr(c, cx - rx * 0.45, cy - 2.6, rx * 0.42, 1.8, 1); c.fill();
  c.fillStyle = "rgba(255,255,255,.55)"; rr(c, cx + rx * 0.12, cy - 0.6, rx * 0.22, 1.4, 0.7); c.fill();
  for (const off of [0, 0.5]) {
    const k = (t * 0.9 + off) % 1;
    c.strokeStyle = `rgba(235,246,255,${(1 - k) * 0.8})`; c.lineWidth = 1.1;
    ell(c, cx + rx * (off ? -0.3 : 0.2), cy + 0.8, rx * 0.08 + k * rx * 0.38, 1 + k * 3.2); c.stroke();
  }
}

export function drawCat(c: Ctx, x: number, gy: number, w: number, t: number, night: number, white: boolean): void {
  c.save(); c.translate(x, gy); c.scale(w / 34, 1); c.lineCap = "round";
  const coat = material(c, -23, -2, white ? "#FFFDF5" : "#FFD28D", white ? "#B9C9D9" : "#D98041");
  const stripe = white ? "#8D9FB9" : "#AF643B", ph = t * 12;
  // Tail stays behind the body and inside the original 34 × 24 footprint.
  c.save(); c.translate(27, -10); c.rotate(Math.sin(ph * 0.5) * 0.1);
  art(c, "M-2 1 Q8 -1 5 -11 Q4 -14 2 -12 Q1 -11 3 -8 Q5 -5 -3 -3 Z", coat); c.restore();
  for (const [lx, phase, far] of [[12, 0, true], [25, Math.PI, true], [10, Math.PI, false], [23, 0, false]] as const) {
    const swing = Math.sin(ph + phase) * 1.5, lift = Math.max(0, Math.cos(ph + phase)) * 1.4;
    c.save(); c.translate(lx + swing, -lift);
    art(c, "M-2 -9 L2 -8 L2 -2 Q4 0 1 0 L-3 0 Q-4 -1 -2 -3 Z", far ? stripe : coat);
    bead(c, -0.5, -1.4, 2, 0.8, white ? "#FFFDF6" : "#FFF0D2"); c.restore();
  }
  art(c, "M8 -17 Q15 -20 25 -16 Q31 -13 28 -7 Q22 -3 10 -7 Z", coat);
  bead(c, 18, -7.5, 7, 1.8, white ? "#F7F6F1" : "#FFE9C4");
  c.strokeStyle = stripe; c.lineWidth = 1.8; c.beginPath();
  for (const xx of [17, 21, 25]) { c.moveTo(xx, -16.4); c.lineTo(xx - 0.8, -13.2); } c.stroke();
  // Oversized cheeks, pointed ears, muzzle and bright eyes remain readable on a phone.
  art(c, "M2 -15 L1 -23 Q4 -24 7 -20 Q10 -21 12 -20 L16 -23 L16 -15 Q18 -9 12 -7 Q4 -6 1 -11 Z", coat);
  art(c, "M3 -21 L4 -16 L6 -19 Z M12 -19 L15 -21 L14 -16 Z", "#EE9C9F", "#EE9C9F", 0);
  bead(c, 7.5, -10, 5, 2.7, "#FFF4DB");
  for (const xx of [4.5, 11.5]) {
    bead(c, xx, -14, 2, 2.5, "#FFF9E9");
    bead(c, xx - 0.4, -13.8, 1.15, 1.85, night > 0.3 ? "#537D56" : "#344A48");
    bead(c, xx - 0.7, -14.7, 0.5, 0.6, "#FFFFFF");
  }
  art(c, "M6 -11 L9 -11 L7.5 -9.5 Z", "#C96979", "#8F4F64", 0.45);
  c.strokeStyle = "#78565A"; c.lineWidth = 0.55; c.beginPath();
  c.moveTo(7.5, -9.5); c.quadraticCurveTo(6.5, -8, 5.5, -9);
  c.moveTo(7.5, -9.5); c.quadraticCurveTo(8.5, -8, 9.5, -9);
  c.moveTo(3, -10); c.lineTo(0, -11); c.moveTo(12, -10); c.lineTo(15, -11); c.stroke();
  c.restore();
}

export function drawSign(c: Ctx, x: number, gy: number, w: number, h: number, t: number, night: number): void {
  const top = gy - h;
  c.strokeStyle = "#3A3550"; c.lineWidth = 3; c.lineCap = "round";
  c.beginPath(); c.moveTo(x + 6, gy); c.lineTo(x + 11, top + 6); c.moveTo(x + w - 6, gy); c.lineTo(x + w - 11, top + 6); c.stroke();
  c.save(); rr(c, x, top + 4, w, 11, 2); c.clip();
  c.fillStyle = material(c, top + 4, top + 15, "#FFE99B", "#F4B653"); c.fillRect(x, top + 4, w, 11);
  c.fillStyle = "#23202E";
  for (let i = -2; i < w / 7 + 2; i++) {
    c.beginPath(); c.moveTo(x + i * 9, top + 15); c.lineTo(x + i * 9 + 5, top + 15); c.lineTo(x + i * 9 + 12, top + 4); c.lineTo(x + i * 9 + 7, top + 4); c.closePath(); c.fill();
  }
  c.restore();
  c.fillStyle = material(c, top + 19, top + 33, "#FFFCED", "#DED6C7"); rr(c, x + 5, top + 19, w - 10, 14, 2); c.fill(); c.strokeStyle = "#77667A"; c.lineWidth = 1; c.stroke();
  for (const xx of [x + 4, x + w - 4]) bead(c, xx, top + 9, 1.3, 1.3, "#FFF8CE");
  text(c, "工事中", x + w / 2, top + 26.5, 9, "#E4572E");
  const on = Math.sin(t * 6) > 0;
  c.fillStyle = on ? "#FF4B3A" : "#8A2A22"; c.beginPath(); c.arc(x + w / 2, top + 1, 3, 0, Math.PI * 2); c.fill();
  if (on && night > 0.2) glow(c, x + w / 2, top + 1, 16, "255,80,60", 0.5 * night);
}

export type Pigeon = { dx: number; p: number; delay: number };
export function drawPigeons(c: Ctx, x: number, birds: readonly Pigeon[], flee: boolean, fleeT: number, gy: number, t: number): void {
  birds.forEach((b, i) => {
    const k = flee ? Math.max(0, fleeT - b.delay) : 0, flying = k > 0;
    const bx = x + b.dx - k * 40 + k * k * 30, by = gy - k * 140 - k * k * 60;
    c.save(); c.translate(bx, by); c.lineCap = "round";
    const body = material(c, -15, 0, "#E0E8F4", "#7C8DAB");
    art(c, "M6 -8 L12 -10 L11 -5 L5 -3 Z", "#657491");
    if (!flying) {
      c.strokeStyle = "#BA6E66"; c.lineWidth = 1.1; c.beginPath();
      for (const xx of [0, 4]) { c.moveTo(xx, -4); c.lineTo(xx, -0.5); c.lineTo(xx - 2, -0.5); } c.stroke();
    }
    art(c, "M-5 -10 Q0 -14 6 -10 Q11 -6 6 -3 Q1 0 -5 -4 Z", body);
    const peck = flying ? 0 : Math.max(0, Math.sin(t * 5 + b.p)) * 2;
    c.save(); c.translate(0, peck);
    art(c, "M-7 -13 Q-2 -15 0 -9 L1 -6 Q-3 -5 -6 -8 Z", "#568E91");
    art(c, "M-5 -8 Q-2 -10 0 -9 L0 -7 Q-3 -6 -5 -8", "#A397C9", "#A397C9", 0);
    bead(c, -5, -12, 4.1, 3.6, "#AEBFDA");
    art(c, "M-8 -12 L-11 -10.6 L-7 -10 Z", "#E8BA7C", "#68566B", 0.65);
    bead(c, -6.3, -12.6, 1.25, 1.35, "#F8E3B4");
    bead(c, -6.6, -12.7, 0.7, 0.85, "#303749"); bead(c, -6.9, -13.1, 0.25, 0.3, "#FFF");
    c.restore();
    // The first flight pose starts folded, so takeoff does not pop between shapes.
    c.save(); c.translate(0, -8);
    c.rotate(flying ? Math.sin(k * 30 + i * 0.4) * Math.min(1, k * 12) : 0);
    art(c, "M-1 -1 Q5 -4 9 1 Q7 5 2 4 Q-2 3 -1 -1 Z", material(c, -3, 5, "#C7D3E7", "#8193B1"));
    c.strokeStyle = "#5A6D8D"; c.lineWidth = 1.2; c.beginPath();
    c.moveTo(4, 0); c.lineTo(6, 3); c.moveTo(6, -0.5); c.lineTo(8, 2); c.stroke();
    bead(c, 1, -0.4, 1.7, 0.7, "#E9F0F9"); c.restore(); c.restore();
  });
}

export function drawCrow(c: Ctx, x: number, y: number, w: number, h: number, t: number): void {
  c.save(); c.translate(x, y); c.scale(w / 34, h / 20);
  const flap = Math.sin(t * 16);
  art(c, "M23 8 L33 6 L31 12 L24 13 Z", "#394459", "#252C42");
  art(c, "M9 7 Q20 3 27 10 Q28 16 18 17 Q10 17 7 12 Z", material(c, 4, 18, "#62748D", "#293349"), "#20283D");
  c.save(); c.translate(16, 10); c.scale(1, 0.55 + flap * 0.4);
  art(c, "M-3 1 Q-1 -10 8 -10 L7 -6 L10 -7 L8 -3 L10 -3 Q7 4 -3 1 Z", "#52647E", "#252C42");
  art(c, "M0 -2 Q3 -7 6 -7 L3 -2 Z", "#8797AD", "#8797AD", 0); c.restore();
  art(c, "M4 6 Q5 1 10 3 Q16 3 15 10 Q13 15 7 13 Q3 12 4 6 Z", material(c, 2, 14, "#65758E", "#2F384F"), "#252C42");
  art(c, "M5 8 Q1 7 0 11 L6 11 Z", "#919BAB", "#313C53", 0.7);
  bead(c, 7.8, 6.6, 2.2, 2.5, "#FFDF91"); bead(c, 7.2, 6.8, 1.25, 1.6, "#212D41"); bead(c, 6.8, 5.9, 0.65, 0.7, "#FFF");
  c.strokeStyle = "#B1C3D5"; c.lineWidth = 0.7; c.beginPath(); c.moveTo(10, 13); c.quadraticCurveTo(14, 15, 16, 13); c.stroke();
  c.restore();
}

/* ---------- 季節ステージの障害物 ---------- */
export function drawRock(c: Ctx, x: number, gy: number, w: number, h: number): void {
  c.save(); c.translate(x, gy); c.scale(w / 24, h / 34);
  art(c, "M1 -1 L2 -17 L8 -30 L17 -32 L23 -18 L24 -2 Q13 1 1 -1 Z", material(c, -32, 0, "#B8B7C4", "#777C95"));
  art(c, "M2 -17 L8 -30 L17 -32 L14 -19 L6 -9 Z", "#D2D0D6", "", 0);
  art(c, "M14 -19 L17 -32 L23 -18 L24 -2 L17 -7 Z", "#636C83", "", 0);
  art(c, "M4 -23 Q9 -32 17 -30 L19 -25 L15 -24 L13 -26 L10 -23 L8 -25 Z", "#87B16A", "#516F52", 0.7);
  c.strokeStyle = "#626A82"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(8,-8); c.lineTo(11,-14); c.lineTo(9,-18); c.stroke();
  bead(c, 5, -4, 1, 0.6, "#C9CED8"); c.restore();
}

export function drawSnowman(c: Ctx, x: number, gy: number, w: number, big: boolean): void {
  c.save(); c.translate(x, gy); c.scale(w / 32, (big ? 48 : 34) / 48);
  const snow = material(c, -47, 0, "#FFFFFF", "#B8D5EF");
  art(c, "M3 -14 Q2 -26 16 -27 Q30 -26 29 -13 Q29 0 16 0 Q2 0 3 -14 Z", snow, "#728DAD");
  art(c, "M6 -35 Q6 -46 16 -46 Q27 -45 26 -35 Q27 -25 16 -24 Q5 -25 6 -35 Z", snow, "#728DAD");
  art(c, "M6 -28 Q16 -23 26 -28 L26 -23 Q16 -18 6 -23 Z M21 -23 L25 -22 L27 -13 L22 -13 Z", big ? "#568DD5" : "#E6677A");
  art(c, "M5 -44 L8 -47 L24 -47 L27 -44 Z", big ? "#568DD5" : "#E6677A");
  bead(c, 11, -35, 1.5, 1.8, "#39465D"); bead(c, 20, -35, 1.5, 1.8, "#39465D");
  art(c, "M14 -33 L4 -30 L15 -29 Z", "#F9AA56", "#B97A48", 0.6);
  bead(c, 22, -31, 2.1, 1.2, "#F3B7C1");
  for (const yy of [-17, -10]) bead(c, 16, yy, 1.5, 1.5, "#566B88");
  bead(c, 9, -11, 2, 5, "#F5FBFF"); c.restore();
}

export function drawWatermelon(c: Ctx, x: number, gy: number, w: number): void {
  c.save(); c.translate(x, gy); c.scale(w / 24, 1);
  art(c, "M1 -16 Q1 -32 12 -33 Q23 -32 23 -16 Q24 0 12 0 Q0 0 1 -16 Z", material(c,-33,0,"#B1D973","#438D64"), "#375D52");
  c.strokeStyle = "#38785C"; c.lineWidth = 2.6; c.beginPath();
  for (const dx of [-5, 2, 7]) { c.moveTo(12+dx*0.5,-31); c.bezierCurveTo(12+dx*1.5,-23,12+dx*1.5,-9,12+dx*0.5,-2); } c.stroke();
  bead(c,7,-23,2.2,5,"rgba(255,255,220,.55)");
  c.strokeStyle="#526E44"; c.lineWidth=1.3; c.beginPath(); c.moveTo(12,-32); c.quadraticCurveTo(16,-35,17,-32); c.stroke(); c.restore();
}

export function drawLog(c: Ctx, x: number, gy: number, w: number): void {
  c.fillStyle = material(c, gy - 24, gy - 2, "#C69769", "#805B4B"); rr(c, x, gy - 24, w, 22, 11); c.fill(); c.strokeStyle = "#604951"; c.lineWidth = 1.2; c.stroke();
  c.strokeStyle = "#5B3A23"; c.lineWidth = 1.4; c.beginPath();
  for (let i = 1; i < 4; i++) { c.moveTo(x + 10 + i * 10, gy - 20); c.lineTo(x + 20 + i * 10, gy - 20); }
  c.stroke();
  c.fillStyle = material(c, gy - 24, gy - 2, "#FFE2AA", "#D6AE7E"); ell(c, x + w - 4, gy - 13, 6, 11); c.fill();
  c.strokeStyle = "#A57A45"; c.lineWidth = 1; ell(c, x + w - 4, gy - 13, 3, 6); c.stroke(); ell(c, x + w - 4, gy - 13, 1.2, 2.5); c.stroke();
  c.fillStyle = "#7A5134"; c.beginPath(); c.moveTo(x + 18, gy - 22); c.lineTo(x + 14, gy - 40); c.lineTo(x + 22, gy - 23); c.fill();
  c.fillStyle = "#6FA35A"; c.beginPath(); c.arc(x + 14, gy - 42, 6, 0, Math.PI * 2); c.fill();
}

export function drawSled(c: Ctx, x: number, gy: number, w: number): void {
  c.strokeStyle = "#8A93AE"; c.lineWidth = 2.6; c.lineCap = "round";
  c.beginPath(); c.moveTo(x + 4, gy - 2); c.lineTo(x + w - 10, gy - 2); c.quadraticCurveTo(x + w, gy - 2, x + w - 2, gy - 14); c.stroke();
  c.beginPath(); c.moveTo(x + 12, gy - 2); c.lineTo(x + 12, gy - 12); c.moveTo(x + w - 18, gy - 2); c.lineTo(x + w - 18, gy - 12); c.stroke();
  c.fillStyle = material(c, gy - 20, gy - 11, "#F799A3", "#BB536A"); rr(c, x + 2, gy - 20, w - 8, 9, 3); c.fill(); c.strokeStyle = "#74495D"; c.lineWidth = 1; c.stroke();
  c.fillStyle = "#F4F7FD"; rr(c, x + 6, gy - 34, 22, 14, 6); c.fill();
  c.fillStyle = material(c, gy - 30, gy - 20, "#9DCAE8", "#5A86B8"); rr(c, x + 24, gy - 30, 16, 10, 3); c.fill();
}

export function drawGoldfishTub(c: Ctx, x: number, gy: number, w: number): void {
  c.fillStyle = material(c, gy - 30, gy, "#91CEE9", "#4D77AB"); c.beginPath(); c.moveTo(x, gy - 30); c.lineTo(x + w, gy - 30); c.lineTo(x + w - 5, gy); c.lineTo(x + 5, gy); c.closePath(); c.fill(); c.strokeStyle = "#425D86"; c.lineWidth = 1.1; c.stroke();
  c.fillStyle = material(c, gy - 35, gy - 25, "#D2F2F8", "#81C4E1"); ell(c, x + w / 2, gy - 30, w / 2, 5); c.fill();
  c.fillStyle = "#FF6A3D";
  for (const [fx, fy] of [[0.3, -1], [0.55, 1], [0.72, -2]] as const) { ell(c, x + w * fx, gy - 30 + fy, 3.5, 1.8); c.fill(); c.beginPath(); c.moveTo(x + w * fx + 2, gy - 30 + fy); c.lineTo(x + w * fx + 6, gy - 32 + fy); c.lineTo(x + w * fx + 6, gy - 28 + fy); c.closePath(); c.fill(); }
  text(c, "きんぎょ", x + w / 2, gy - 15, 9, "#fff");
}

export function drawSignpost(c: Ctx, x: number, gy: number, w: number, h: number): void {
  c.fillStyle = "#7A5134"; c.fillRect(x + w / 2 - 3, gy - h, 6, h);
  c.fillStyle = material(c, gy - h, gy - h + 34, "#F1D09C", "#BA886A");
  c.beginPath(); c.moveTo(x - 4, gy - h + 4); c.lineTo(x + w - 2, gy - h + 4); c.lineTo(x + w + 6, gy - h + 11); c.lineTo(x + w - 2, gy - h + 18); c.lineTo(x - 4, gy - h + 18); c.closePath(); c.fill(); c.strokeStyle = "#735953"; c.lineWidth = 1.2; c.stroke();
  text(c, "山頂", x + w / 2, gy - h + 11.5, 8, "#4A2E1A");
  c.fillStyle = material(c, gy - h, gy - h + 34, "#F1D09C", "#BA886A"); rr(c, x + 2, gy - h + 22, w - 4, 11, 1); c.fill();
  text(c, "展望台", x + w / 2, gy - h + 28, 8, "#4A2E1A");
}

export function drawKakigoriFlag(c: Ctx, x: number, gy: number, w: number, h: number, t: number): void {
  c.fillStyle = "#6E6A80"; c.fillRect(x + 4, gy - h - 4, 3, h + 4);
  const sway = Math.sin(t * 3) * 1.5;
  c.fillStyle = material(c, gy - h, gy - h + 36, "#FFFFFF", "#CCE0F0");
  c.beginPath(); c.moveTo(x + 7, gy - h); c.lineTo(x + w + sway, gy - h + 2); c.lineTo(x + w + sway, gy - h + 34); c.lineTo(x + 7, gy - h + 36); c.closePath(); c.fill(); c.strokeStyle = "#748CA9"; c.lineWidth = 0.8; c.stroke();
  c.strokeStyle = "#3F7CD6"; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(x + 7, gy - h + 30); c.quadraticCurveTo(x + 14, gy - h + 25, x + 20, gy - h + 30); c.quadraticCurveTo(x + 27, gy - h + 35, x + w + sway, gy - h + 30); c.stroke();
  text(c, "氷", x + 7 + (w - 7) / 2 + sway / 2, gy - h + 15, 18, "#E43B3B");
  c.fillStyle = "#E4E0EA"; rr(c, x, gy - 5, 12, 5, 2); c.fill();
}

/** 上から垂れていて、スライディングでしかくぐれない障害物（のれん・枝・つらら） */
export function drawNoren(c: Ctx, x: number, w: number, gy: number, t: number, look: OsanpoRunStageId): void {
  const bot = gy - 30, top = gy - 88;
  if (look === "hiking") {
    c.strokeStyle = "#5B3A23"; c.lineWidth = 6; c.lineCap = "round";
    c.beginPath(); c.moveTo(x - 30, top - 40); c.quadraticCurveTo(x + w * 0.3, top - 4, x + w + 10, top + 8); c.stroke();
    c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(x + w * 0.2, top); c.lineTo(x + w * 0.3, bot - 10); c.moveTo(x + w * 0.7, top + 5); c.lineTo(x + w * 0.65, bot - 6); c.stroke();
    for (const [lx, ly, r] of [[0.1, 0.25, 11], [0.35, 0.55, 12], [0.62, 0.8, 12], [0.85, 0.45, 10], [0.45, 0.2, 10], [0.25, 0.85, 9], [0.72, 0.98, 8]] as const) {
      c.fillStyle = "#4E8A4A"; c.beginPath(); c.arc(x + w * lx, top + (bot - top) * ly, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#6FAE5E"; c.beginPath(); c.arc(x + w * lx - 2, top + (bot - top) * ly - 3, r * 0.55, 0, Math.PI * 2); c.fill();
    }
    return;
  }
  if (look === "snow") {
    c.fillStyle = "#5A4A5E"; c.fillRect(x - 10, top - 14, w + 20, 12);
    c.fillStyle = "#F4F7FD"; rr(c, x - 12, top - 22, w + 24, 10, 5); c.fill();
    c.fillStyle = "rgba(210,235,255,.95)"; c.strokeStyle = "rgba(160,200,240,.9)"; c.lineWidth = 1;
    const lens = [0.55, 0.8, 1, 0.7, 0.9, 0.6, 0.85];
    lens.forEach((len, i) => {
      const ix = x - 6 + (i * (w + 12)) / (lens.length - 1), L = (bot - top + 2) * len;
      c.beginPath(); c.moveTo(ix - 4, top - 2); c.lineTo(ix + 4, top - 2); c.lineTo(ix, top - 2 + L); c.closePath(); c.fill(); c.stroke();
    });
    return;
  }
  c.strokeStyle = "#6E6A80"; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(x + 4, 0); c.lineTo(x + 4, top); c.moveTo(x + w - 4, 0); c.lineTo(x + w - 4, top); c.stroke();
  c.fillStyle = "#7A5134"; rr(c, x - 6, top - 3, w + 12, 5, 2.5); c.fill();
  const col = look === "summer" ? "#D63A3A" : "#2F3F8F", panels = 3, pw = w / panels;
  for (let i = 0; i < panels; i++) {
    const sw = Math.sin(t * 2.4 + i) * 1.5;
    c.fillStyle = material(c, top, bot, look === "summer" ? "#F58988" : "#8395CA", col);
    c.beginPath(); c.moveTo(x + i * pw + 1, top + 2); c.lineTo(x + (i + 1) * pw - 1, top + 2); c.lineTo(x + (i + 1) * pw - 1 + sw, bot); c.lineTo(x + i * pw + 1 + sw, bot); c.closePath(); c.fill(); c.strokeStyle = look === "summer" ? "#8F495E" : "#374C7A"; c.lineWidth = 1; c.stroke();
    c.strokeStyle = "rgba(255,235,206,.65)"; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x + i * pw + 3 + sw, bot - 4); c.lineTo(x + (i + 1) * pw - 3 + sw, bot - 4); c.stroke();
  }
  text(c, look === "summer" ? "祭" : "ゆ", x + w / 2, top + (bot - top) * 0.45, 16, "#fff");
}

/* ---------- 追加の障害物 ---------- */

/** 転がってくるもの（まち: お掃除ロボ／山道: ウリ坊／雪国: 雪玉／夏まつり: ビーチボール） */
export function drawRoller(c: Ctx, x: number, gy: number, w: number, h: number, t: number, look: OsanpoRunStageId): void {
  c.save(); c.translate(x, gy); c.scale(w / 30, h / 18); c.lineCap = "round";
  if (look === "town") {
    art(c, "M1 -10 Q1 -17 15 -17 Q29 -17 29 -10 L28 -4 Q26 0 15 0 Q3 0 1 -5 Z", material(c, -17, 0, "#EDF3FA", "#8B9DAF"));
    art(c, "M1 -7 Q15 -2 29 -7 L28 -3 Q15 2 2 -3 Z", "#48526B");
    bead(c, 15, -11, 11, 4.2, "#DAE7F1"); bead(c, 15, -12, 4, 2.3, "#66778F"); bead(c, 15, -12.6, 3.2, 1.3, "#A9BCCB");
    bead(c, 6, -8, 1, 0.8, "#4AE1C0"); bead(c, 5, -4, 1.3, 0.7, Math.sin(t*10)>0 ? "#9AFFE5" : "#53ABAA");
    c.strokeStyle = "#809DB0"; c.lineWidth = 1; c.beginPath();
    for (let i = 0; i < 3; i++) { const a=t*30+i*2.1; c.moveTo(2,-2); c.lineTo(2+Math.cos(a)*2,-2+Math.sin(a)); } c.stroke();
  } else if (look === "hiking") {
    for (const [xx, ph] of [[10, 0], [23, Math.PI]]) {
      c.save(); c.translate(xx! + Math.sin(t*16+ph!)*1.2, 0); art(c,"M-2 -7 L2 -7 L2 0 L-2 0 Z","#694B44"); c.restore();
    }
    art(c, "M7 -13 Q17 -19 26 -13 Q31 -8 25 -4 Q17 -2 9 -5 Z", material(c,-17,-3,"#DCB784","#9B704F"));
    c.strokeStyle="#F9DEAA"; c.lineWidth=1.5; c.beginPath();
    for(const yy of [-13,-10]) { c.moveTo(13,yy); c.quadraticCurveTo(19,yy-2,25,yy); } c.stroke();
    art(c,"M4 -13 L4 -17 L8 -15 Q14 -14 12 -7 Q10 -3 4 -5 L1 -6 L1 -10 Z",material(c,-17,-4,"#DEB681","#AF805C"));
    bead(c,3,-7.5,2.7,2,"#E3A296"); bead(c,2,-7.6,0.5,0.65,"#855766");
    bead(c,7,-11,1.6,1.9,"#FFF1D9"); bead(c,6.7,-11,0.9,1.2,"#3B3341"); bead(c,6.4,-11.6,0.35,0.4,"#FFF");
  } else {
    // Elliptical footprint matches the existing width/height and collision rectangle.
    c.save(); c.translate(15,-9); c.scale(14,8.5);
    c.beginPath(); c.arc(0,0,1,0,Math.PI*2); c.fillStyle=look === "snow" ? "#D2E7F7" : "#FFF2D3"; c.fill(); c.strokeStyle="#66819C"; c.lineWidth=0.08; c.stroke(); c.clip();
    c.rotate(-t*8);
    if(look === "summer") {
      ["#F17C83","#FFECB3","#71BED9","#FFF7E3","#F8C666","#FFF7E3"].forEach((col,i)=>{
        c.fillStyle=col; c.beginPath(); c.moveTo(0,0); c.arc(0,0,1,i*Math.PI/3,(i+1)*Math.PI/3); c.closePath(); c.fill();
      });
    } else {
      for(let i=0;i<5;i++) { const a=i*1.26; bead(c,Math.cos(a)*0.6,Math.sin(a)*0.6,0.14,0.08,"#A2C3E0"); }
    }
    c.restore(); bead(c,11,-12,5,2,"rgba(255,255,255,.7)");
  }
  c.restore();
}

/** 上から落ちてくるもの（まち: 植木鉢／山道: まつぼっくり／雪国: 屋根の雪／夏まつり: 風鈴） */
export function drawDropper(c: Ctx, cx: number, by: number, w: number, look: OsanpoRunStageId, landed: boolean): void {
  c.save(); c.translate(cx - w / 2, by); c.scale(w / 22, (landed ? 16 : 22) / 22);
  if (look === "town") {
    art(c,"M2 -16 L20 -16 L17 0 L5 0 Z",material(c,-16,0,"#F8BB8A","#BE684F"));
    art(c,"M1 -17 Q11 -20 21 -17 L21 -13 Q11 -11 1 -13 Z",material(c,-19,-12,"#FFD4A2","#DF8B63"));
    bead(c,11,-17,8,1.5,"#735247");
    if (!landed) {
      art(c,"M11 -16 Q3 -16 4 -22 Q11 -22 11 -16 M11 -16 Q11 -22 19 -21 Q19 -16 11 -16", "#8BC586", "#507C63", 0.7);
      bead(c,13,-20,2,1.8,"#F2A8B0"); bead(c,13,-20,0.7,0.7,"#FFEAC1");
    } else {
      c.strokeStyle="#804A48"; c.lineWidth=1; c.beginPath(); c.moveTo(12,-12); c.lineTo(9,-8); c.lineTo(12,-6); c.lineTo(10,-1); c.stroke();
    }
    bead(c,6,-8,1.1,3,"#FFCCA0");
  } else if (look === "hiking") {
    art(c,"M5 -3 Q1 -10 7 -19 Q11 -24 15 -19 Q22 -10 17 -3 Q11 2 5 -3 Z",material(c,-22,0,"#D9AC7D","#885D50"));
    for(let row=0;row<4;row++) {
      c.save(); c.translate(11,-17+row*4); c.scale(0.65+row*0.1,1);
      art(c,"M-7 0 Q-3 -3 0 0 Q3 -3 7 0 L3 3 L0 1 L-3 3 Z","#D9A777","#885D50",0.7); c.restore();
    }
  } else if (look === "snow") {
    art(c,"M1 -5 Q-1 -13 5 -13 Q3 -22 11 -21 Q18 -22 18 -15 Q24 -13 21 -5 Q20 0 10 0 Q2 0 1 -5 Z",material(c,-22,0,"#FFFFFF","#B6D7EE"),"#799DB8");
    bead(c,8,-15,3,2,"#FFF"); bead(c,15,-5,3,1.4,"#92BCD8");
  } else {
    art(c,"M2 -9 Q1 -21 11 -22 Q21 -21 20 -9 Z",material(c,-22,-9,"#F2FDFF","#9DD5E4"),"#5B8FA7");
    bead(c,6,-16,1.2,3,"#FFF"); bead(c,14,-14,2.6,2.6,"#EF8F9C"); bead(c,17,-12,1.4,1.4,"#FFD7A2");
    c.strokeStyle="#6A7186"; c.lineWidth=0.8; c.beginPath(); c.moveTo(11,-9); c.lineTo(11,-6); c.stroke();
    art(c,"M8 -6 L14 -6 L14 0 L8 0 Z","#FFDE8D","#B99669",0.6);
  }
  c.restore();
}

/** ほかのわんこ。ぶつかっても大丈夫で、あいさつすると点がもらえる */
export function drawBuddy(c: Ctx, x: number, gy: number, w: number, t: number, variant: number, greeted: boolean): void {
  const palettes = [
    ["#E9B872", "#C98F46", "#FFF3DE"], // 柴っぽい
    ["#F3F0EA", "#C9C2B6", "#FFFFFF"], // 白い子
    ["#6A5A52", "#453A34", "#D8CBBE"], // チョコ
    ["#2E2A2A", "#1A1717", "#EDE4DA"], // 黒
  ] as const;
  const [BODY, DARK, LIGHT] = palettes[variant % palettes.length]!;
  const cx = x + w / 2, by = gy - 12, wag = Math.sin(t * (greeted ? 22 : 10)) * (greeted ? 5 : 3);
  // しっぽ（右側）。あいさつすると、ぶんぶん振る
  c.strokeStyle = BODY; c.lineWidth = 3.5; c.lineCap = "round";
  c.beginPath(); c.moveTo(x + w - 4, by - 3); c.quadraticCurveTo(x + w + 4, by - 10 + wag, x + w + 2 + wag * 0.5, by - 16); c.stroke();
  c.fillStyle = DARK; rr(c, x + 7, by + 3, 4, 9, 2); c.fill(); rr(c, x + w - 11, by + 3, 4, 9, 2); c.fill();
  c.fillStyle = BODY; ell(c, cx + 2, by, w * 0.4, 7.5); c.fill();
  c.fillStyle = LIGHT; ell(c, cx, by + 3.5, w * 0.24, 3); c.fill();
  // 頭（左向き、こっちを見ている）
  const hx = x + 6, hy = by - 9;
  c.fillStyle = BODY; c.beginPath(); c.arc(hx, hy, 8, 0, Math.PI * 2); c.fill();
  c.fillStyle = DARK; ell(c, hx - 7, hy - 1, 3, 6, 0.3); c.fill(); ell(c, hx + 6, hy - 2, 3, 6, -0.3); c.fill();
  c.fillStyle = LIGHT; ell(c, hx - 2, hy + 3.5, 4.5, 3); c.fill();
  c.fillStyle = "#1A1410"; c.beginPath(); c.arc(hx - 3, hy - 1.5, 1.3, 0, Math.PI * 2); c.arc(hx + 2, hy - 1.5, 1.3, 0, Math.PI * 2); c.arc(hx - 2, hy + 2.2, 1.4, 0, Math.PI * 2); c.fill();
  if (greeted) { c.fillStyle = "#FF6B8A"; c.font = font(11); c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("♥", hx + 2, hy - 14 - Math.abs(Math.sin(t * 6)) * 3); }
}

/** 水が出たり止まったりするところ（まち: スプリンクラー／山道: 間欠泉／雪国: 除雪機の雪／夏まつり: 噴水） */
export function drawGeyser(c: Ctx, x: number, gy: number, w: number, top: number, t: number, look: OsanpoRunStageId): void {
  c.save(); c.translate(x, gy); c.scale(w / 24, 1);
  const base = look === "snow" ? "#E87384" : look === "hiking" ? "#ACA497" : look === "summer" ? "#E4C69A" : "#87B5BA";
  art(c,"M3 0 L4 -5 Q12 -8 20 -5 L21 0 Z", material(c,-7,0,base,"#667E8F"));
  art(c,"M8 -5 L8 -8 L16 -8 L16 -5 Z","#D0E1DF","#4C6375",0.8);
  if (top <= 0) {
    // Residual water is decorative; it never resembles an active column.
    bead(c,12,-8,2,0.6,"#D4F7FC"); c.restore(); return;
  }
  // Use exactly the engine's current height, including the 0.1 s ramp-up.
  // The base stays visible; all spray is clipped inside the 24 × top footprint.
  c.save(); c.beginPath(); c.rect(0,-top,24,top); c.clip();
  const snow=look === "snow";
  c.fillStyle=material(c,-top,0,snow ? "#FFFFFF" : "#CEFAFF",snow ? "#C3E1F2" : "#55BBD9");
  c.beginPath(); c.moveTo(5,0);
  for(let i=0;i<=10;i++) { const f=i/10; c.lineTo(4+Math.sin(t*18+i)*1.4,-top*f); }
  for(let i=10;i>=0;i--) { const f=i/10; c.lineTo(20+Math.sin(t*18+i+2)*1.4,-top*f); }
  c.closePath(); c.fill(); c.strokeStyle=snow ? "#A5CBDD" : "#468FAF"; c.lineWidth=0.8; c.stroke();
  c.strokeStyle="rgba(255,255,255,.85)"; c.lineWidth=2; c.lineCap="round"; c.beginPath();
  for(let i=0;i<3;i++) { const yy=-((t*65+i*top/3)%top); c.moveTo(8+i*4,yy); c.lineTo(8+i*4,Math.min(0,yy+10)); } c.stroke();
  for(let i=0;i<4;i++) { const yy=-((t*80+i*top/4)%top); bead(c,2+i*6,yy,1.2,2,"#E6FAFF"); }
  c.restore(); c.restore();
}
