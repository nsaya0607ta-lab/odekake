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

/* ---------- まちの障害物 ---------- */
export function drawCone(c: Ctx, x: number, gy: number, w: number, h: number): void {
  const cx = x + w / 2, topW = 7, botW = w - 2, y0 = gy - h, y1 = gy - 5;
  c.fillStyle = "#2A2440"; rr(c, x - 3, gy - 5, w + 6, 5, 2); c.fill();
  const edge = (t: number): [number, number, number] => {
    const ww = topW + (botW - topW) * t;
    return [cx - ww / 2, cx + ww / 2, y0 + (y1 - y0) * t];
  };
  c.fillStyle = "#FF7A30";
  c.beginPath(); c.moveTo(cx - topW / 2, y0); c.lineTo(cx + topW / 2, y0); c.lineTo(cx + botW / 2, y1); c.lineTo(cx - botW / 2, y1); c.closePath(); c.fill();
  c.fillStyle = "#FFF4E6";
  for (const [a, b] of [[0.26, 0.42], [0.6, 0.76]] as const) {
    const A = edge(a), B = edge(b);
    c.beginPath(); c.moveTo(A[0], A[2]); c.lineTo(A[1], A[2]); c.lineTo(B[1], B[2]); c.lineTo(B[0], B[2]); c.closePath(); c.fill();
  }
  c.fillStyle = "rgba(40,10,0,.16)";
  c.beginPath(); c.moveTo(cx + 1, y0); c.lineTo(cx + topW / 2, y0); c.lineTo(cx + botW / 2, y1); c.lineTo(cx + 3, y1); c.closePath(); c.fill();
  c.fillStyle = "#FFA468"; ell(c, cx, y0, topW / 2, 1.6); c.fill();
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
  c.strokeStyle = "#2A2440"; c.lineWidth = 3;
  for (const hx of [rx, fx]) { c.beginPath(); c.arc(hx, wy, r, 0, Math.PI * 2); c.stroke(); }
  c.strokeStyle = "#C9CEDC"; c.lineWidth = 2;
  for (const hx of [rx, fx]) { c.beginPath(); c.arc(hx, wy, r + 3, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
  const bbX = x + w * 0.44, bbY = gy - 10, seatX = x + w * 0.34, seatY = gy - 33, headX = fx - 6, headY = gy - 31;
  c.strokeStyle = "#5CC8B5"; c.lineWidth = 3.2;
  c.beginPath(); c.moveTo(rx, wy); c.lineTo(bbX, bbY); c.lineTo(seatX, seatY); c.lineTo(rx, wy);
  c.moveTo(bbX, bbY); c.quadraticCurveTo(x + w * 0.6, gy - 14, headX, headY); c.lineTo(fx, wy); c.stroke();
  c.fillStyle = "rgba(92,200,181,.55)"; rr(c, rx + 2, wy - 4, bbX - rx - 2, 6, 3); c.fill();
  c.strokeStyle = "#2A2440"; c.lineWidth = 2.4;
  c.beginPath(); c.moveTo(headX, headY); c.lineTo(headX - 3, gy - 42); c.lineTo(headX - 11, gy - 43); c.stroke();
  c.beginPath(); c.moveTo(bbX - 2, bbY); c.lineTo(bbX - 8, gy); c.stroke();
  c.fillStyle = "#2A2440"; ell(c, seatX - 1, seatY - 2, 7, 2.6); c.fill();
  c.fillStyle = "rgba(226,230,240,.95)"; rr(c, fx - 4, gy - 45, 17, 11, 2); c.fill();
  c.strokeStyle = "#8A90A8"; c.lineWidth = 0.8; c.beginPath();
  for (let i = 1; i < 4; i++) { c.moveTo(fx - 4 + i * 4.25, gy - 45); c.lineTo(fx - 4 + i * 4.25, gy - 34); }
  c.moveTo(fx - 4, gy - 39.5); c.lineTo(fx + 13, gy - 39.5); c.stroke();
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
  const ph = t * 12, cx = x + w / 2, by = gy - 13;
  const BODY = white ? "#F4F2EE" : "#F2A65A", DARK = white ? "#C9C4BC" : "#C9772F", LIGHT = white ? "#FFFFFF" : "#FFE2BF";
  c.strokeStyle = BODY; c.lineWidth = 4.5; c.lineCap = "round";
  c.beginPath(); c.moveTo(x + w - 5, by - 2); c.quadraticCurveTo(x + w + 6, by - 12 + Math.sin(ph * 0.5) * 2, x + w + 1, by - 22); c.stroke();
  c.fillStyle = DARK;
  for (const [lx, a] of [[x + 8, 0], [x + 12, Math.PI], [x + w - 10, Math.PI], [x + w - 6, 0]] as const) {
    const sw = Math.sin(ph + a) * 3;
    rr(c, lx + sw - 2, by + 3, 4, 10, 2); c.fill();
  }
  c.fillStyle = BODY; ell(c, cx + 1, by, w * 0.42, 7.5); c.fill();
  c.strokeStyle = DARK; c.lineWidth = 1.6; c.beginPath();
  for (let i = 0; i < 3; i++) { const sx = cx - 2 + i * 5; c.moveTo(sx, by - 7); c.lineTo(sx + 1.5, by - 2); }
  c.stroke();
  c.fillStyle = LIGHT; ell(c, cx - 2, by + 4, w * 0.25, 2.6); c.fill();
  const hx = x + 5, hy = by - 7;
  c.fillStyle = BODY; c.beginPath(); c.arc(hx, hy, 7.5, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(hx - 6.5, hy - 3); c.lineTo(hx - 5, hy - 12); c.lineTo(hx - 1, hy - 6); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(hx + 1, hy - 6); c.lineTo(hx + 5, hy - 12); c.lineTo(hx + 6.5, hy - 3); c.closePath(); c.fill();
  c.fillStyle = LIGHT; ell(c, hx - 1.5, hy + 3, 4, 2.6); c.fill();
  c.fillStyle = night > 0.3 ? "#E8FF6A" : "#2A1E14";
  c.beginPath(); c.arc(hx - 3, hy - 1, 1.4, 0, Math.PI * 2); c.arc(hx + 2, hy - 1, 1.4, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#E86A7A"; c.beginPath(); c.arc(hx - 1, hy + 1.8, 1, 0, Math.PI * 2); c.fill();
}

export function drawSign(c: Ctx, x: number, gy: number, w: number, h: number, t: number, night: number): void {
  const top = gy - h;
  c.strokeStyle = "#3A3550"; c.lineWidth = 3; c.lineCap = "round";
  c.beginPath(); c.moveTo(x + 6, gy); c.lineTo(x + 11, top + 6); c.moveTo(x + w - 6, gy); c.lineTo(x + w - 11, top + 6); c.stroke();
  c.save(); rr(c, x, top + 4, w, 11, 2); c.clip();
  c.fillStyle = "#FFD23F"; c.fillRect(x, top + 4, w, 11);
  c.fillStyle = "#23202E";
  for (let i = -2; i < w / 7 + 2; i++) {
    c.beginPath(); c.moveTo(x + i * 9, top + 15); c.lineTo(x + i * 9 + 5, top + 15); c.lineTo(x + i * 9 + 12, top + 4); c.lineTo(x + i * 9 + 7, top + 4); c.closePath(); c.fill();
  }
  c.restore();
  c.fillStyle = "#F6F3EA"; rr(c, x + 5, top + 19, w - 10, 14, 2); c.fill();
  text(c, "工事中", x + w / 2, top + 26.5, 9, "#E4572E");
  const on = Math.sin(t * 6) > 0;
  c.fillStyle = on ? "#FF4B3A" : "#8A2A22"; c.beginPath(); c.arc(x + w / 2, top + 1, 3, 0, Math.PI * 2); c.fill();
  if (on && night > 0.2) glow(c, x + w / 2, top + 1, 16, "255,80,60", 0.5 * night);
}

export type Pigeon = { dx: number; p: number; delay: number };
export function drawPigeons(c: Ctx, x: number, birds: readonly Pigeon[], flee: boolean, fleeT: number, gy: number, t: number): void {
  birds.forEach((b, i) => {
    let bx = x + b.dx, by = gy - 7, flap = 0;
    if (flee) {
      const k = fleeT - b.delay;
      if (k > 0) { bx += -k * 40 + k * k * 30; by -= k * 140 + k * k * 60; flap = Math.sin(t * 30 + i); }
    }
    const peck = flee ? 0 : Math.max(0, Math.sin(t * 5 + b.p)) * 3;
    c.fillStyle = "#8E93A8"; ell(c, bx + 2, by, 8, 5.5); c.fill();
    c.fillStyle = "#6E7390"; c.beginPath(); c.moveTo(bx + 7, by - 1); c.lineTo(bx + 13, by - 3); c.lineTo(bx + 12, by + 2); c.closePath(); c.fill();
    if (flap) { c.beginPath(); c.moveTo(bx, by - 2); c.lineTo(bx + 6, by - 2 - flap * 9); c.lineTo(bx + 9, by - 1); c.closePath(); c.fill(); }
    c.fillStyle = "#5E8C7E"; c.beginPath(); c.arc(bx - 4, by - 4 + peck, 3.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#A7ACC0"; c.beginPath(); c.arc(bx - 5, by - 6 + peck, 3.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#E3A13A"; c.beginPath(); c.moveTo(bx - 8, by - 6 + peck); c.lineTo(bx - 11, by - 5 + peck); c.lineTo(bx - 8, by - 4.6 + peck); c.closePath(); c.fill();
    c.fillStyle = "#E4572E"; c.beginPath(); c.arc(bx - 6, by - 7 + peck, 0.9, 0, Math.PI * 2); c.fill();
    if (!flee) {
      c.strokeStyle = "#D8736A"; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(bx, by + 4); c.lineTo(bx - 1, by + 7); c.moveTo(bx + 3, by + 4); c.lineTo(bx + 3, by + 7); c.stroke();
    }
  });
}

export function drawCrow(c: Ctx, x: number, y: number, w: number, h: number, t: number): void {
  const cx = x + w / 2, cy = y + h / 2, flap = Math.sin(t * 16);
  c.fillStyle = "#231F3A"; c.beginPath(); c.moveTo(cx - 4, cy); c.lineTo(cx + 6, cy + 2 + flap * 12); c.lineTo(cx + 12, cy + 1); c.closePath(); c.fill();
  c.fillStyle = "#16132A";
  ell(c, cx + 2, cy + 1, w * 0.36, h * 0.32); c.fill();
  c.beginPath(); c.moveTo(cx + w * 0.3, cy - 1); c.lineTo(x + w + 5, cy - 5); c.lineTo(x + w + 3, cy + 5); c.closePath(); c.fill();
  c.beginPath(); c.arc(x + 8, cy - 2, 7, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#6A6488"; c.beginPath(); c.moveTo(x + 3, cy - 5); c.lineTo(x - 8, cy - 1); c.lineTo(x + 3, cy + 1); c.closePath(); c.fill();
  c.fillStyle = "#16132A"; c.beginPath(); c.moveTo(cx - 6, cy - 1); c.lineTo(cx + 4, cy - 2 - flap * 15); c.lineTo(cx + 14, cy - 1); c.closePath(); c.fill();
  c.shadowBlur = 0;
  c.fillStyle = "#FFD166"; c.beginPath(); c.arc(x + 6, cy - 4, 1.9, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#16132A"; c.beginPath(); c.arc(x + 5.6, cy - 4, 0.8, 0, Math.PI * 2); c.fill();
}

/* ---------- 季節ステージの障害物 ---------- */
export function drawRock(c: Ctx, x: number, gy: number, w: number, h: number): void {
  c.fillStyle = "#7E7A8C";
  c.beginPath(); c.moveTo(x - 2, gy); c.lineTo(x + 2, gy - h * 0.55); c.lineTo(x + w * 0.35, gy - h * 0.9); c.lineTo(x + w * 0.75, gy - h * 0.8); c.lineTo(x + w + 3, gy - h * 0.35); c.lineTo(x + w + 3, gy); c.closePath(); c.fill();
  c.fillStyle = "#A29EB0";
  c.beginPath(); c.moveTo(x + 2, gy - h * 0.55); c.lineTo(x + w * 0.35, gy - h * 0.9); c.lineTo(x + w * 0.5, gy - h * 0.5); c.lineTo(x + w * 0.15, gy - h * 0.3); c.closePath(); c.fill();
  c.fillStyle = "#7FA86A"; ell(c, x + w * 0.6, gy - h * 0.82, 6, 2.4); c.fill();
}

export function drawSnowman(c: Ctx, x: number, gy: number, w: number, big: boolean): void {
  const r1 = w * 0.5, r2 = w * 0.36, r3 = big ? w * 0.28 : 0;
  c.fillStyle = "#F4F7FD"; c.strokeStyle = "#B9C4DE"; c.lineWidth = 1.2;
  c.beginPath(); c.arc(x + w / 2, gy - r1, r1, 0, Math.PI * 2); c.fill(); c.stroke();
  const y2 = gy - r1 * 2 - r2 + 3;
  c.beginPath(); c.arc(x + w / 2, y2, r2, 0, Math.PI * 2); c.fill(); c.stroke();
  let hy = y2;
  if (big) { hy = y2 - r2 - r3 + 3; c.beginPath(); c.arc(x + w / 2, hy, r3, 0, Math.PI * 2); c.fill(); c.stroke(); }
  const fr = big ? r3 : r2;
  c.fillStyle = "#2A2440"; c.beginPath(); c.arc(x + w / 2 - fr * 0.35, hy - 1, 1.3, 0, Math.PI * 2); c.arc(x + w / 2 + fr * 0.1, hy - 1, 1.3, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#F08A3A"; c.beginPath(); c.moveTo(x + w / 2 - fr * 0.2, hy + 1.5); c.lineTo(x + w / 2 - fr - 4, hy + 3); c.lineTo(x + w / 2 - fr * 0.2, hy + 4); c.closePath(); c.fill();
  c.fillStyle = "#D6334B"; c.fillRect(x + w / 2 - fr - 1, hy + fr * 0.55, fr * 2 + 2, 3);
  if (big) { c.fillStyle = "#3F7CD6"; rr(c, x + w / 2 - r3 * 0.8, hy - r3 - 5, r3 * 1.6, 7, 2); c.fill(); }
}

export function drawWatermelon(c: Ctx, x: number, gy: number, w: number): void {
  const cx = x + w / 2, r = w * 0.56;
  c.fillStyle = "#2F8F4E"; ell(c, cx, gy - r * 0.9, r, r * 0.9); c.fill();
  c.strokeStyle = "#1D5E31"; c.lineWidth = 2.2; c.beginPath();
  for (let i = -2; i <= 2; i++) { c.moveTo(cx + i * r * 0.35, gy - r * 1.75); c.quadraticCurveTo(cx + i * r * 0.5 + 3, gy - r * 0.9, cx + i * r * 0.35, gy - 1); }
  c.stroke();
  c.fillStyle = "rgba(255,255,255,.3)"; ell(c, cx - r * 0.35, gy - r * 1.25, r * 0.3, r * 0.16); c.fill();
}

export function drawLog(c: Ctx, x: number, gy: number, w: number): void {
  c.fillStyle = "#7A5134"; rr(c, x, gy - 24, w, 22, 11); c.fill();
  c.strokeStyle = "#5B3A23"; c.lineWidth = 1.4; c.beginPath();
  for (let i = 1; i < 4; i++) { c.moveTo(x + 10 + i * 10, gy - 20); c.lineTo(x + 20 + i * 10, gy - 20); }
  c.stroke();
  c.fillStyle = "#D9B07A"; ell(c, x + w - 4, gy - 13, 6, 11); c.fill();
  c.strokeStyle = "#A57A45"; c.lineWidth = 1; ell(c, x + w - 4, gy - 13, 3, 6); c.stroke();
  c.fillStyle = "#7A5134"; c.beginPath(); c.moveTo(x + 18, gy - 22); c.lineTo(x + 14, gy - 40); c.lineTo(x + 22, gy - 23); c.fill();
  c.fillStyle = "#6FA35A"; c.beginPath(); c.arc(x + 14, gy - 42, 6, 0, Math.PI * 2); c.fill();
}

export function drawSled(c: Ctx, x: number, gy: number, w: number): void {
  c.strokeStyle = "#8A93AE"; c.lineWidth = 2.6; c.lineCap = "round";
  c.beginPath(); c.moveTo(x + 4, gy - 2); c.lineTo(x + w - 10, gy - 2); c.quadraticCurveTo(x + w, gy - 2, x + w - 2, gy - 14); c.stroke();
  c.beginPath(); c.moveTo(x + 12, gy - 2); c.lineTo(x + 12, gy - 12); c.moveTo(x + w - 18, gy - 2); c.lineTo(x + w - 18, gy - 12); c.stroke();
  c.fillStyle = "#D6334B"; rr(c, x + 2, gy - 20, w - 8, 9, 3); c.fill();
  c.fillStyle = "#F4F7FD"; rr(c, x + 6, gy - 34, 22, 14, 6); c.fill();
  c.fillStyle = "#3F7CD6"; rr(c, x + 24, gy - 30, 16, 10, 3); c.fill();
}

export function drawGoldfishTub(c: Ctx, x: number, gy: number, w: number): void {
  c.fillStyle = "#3F7CD6"; c.beginPath(); c.moveTo(x, gy - 30); c.lineTo(x + w, gy - 30); c.lineTo(x + w - 5, gy); c.lineTo(x + 5, gy); c.closePath(); c.fill();
  c.fillStyle = "#9FD8FF"; ell(c, x + w / 2, gy - 30, w / 2, 5); c.fill();
  c.fillStyle = "#FF6A3D";
  for (const [fx, fy] of [[0.3, -1], [0.55, 1], [0.72, -2]] as const) { ell(c, x + w * fx, gy - 30 + fy, 3.5, 1.8); c.fill(); }
  text(c, "きんぎょ", x + w / 2, gy - 15, 9, "#fff");
}

export function drawSignpost(c: Ctx, x: number, gy: number, w: number, h: number): void {
  c.fillStyle = "#7A5134"; c.fillRect(x + w / 2 - 3, gy - h, 6, h);
  c.fillStyle = "#C99A62";
  c.beginPath(); c.moveTo(x - 4, gy - h + 4); c.lineTo(x + w - 2, gy - h + 4); c.lineTo(x + w + 6, gy - h + 11); c.lineTo(x + w - 2, gy - h + 18); c.lineTo(x - 4, gy - h + 18); c.closePath(); c.fill();
  text(c, "山頂", x + w / 2, gy - h + 11.5, 8, "#4A2E1A");
  c.fillStyle = "#C99A62"; rr(c, x + 2, gy - h + 22, w - 4, 11, 1); c.fill();
  text(c, "展望台", x + w / 2, gy - h + 28, 8, "#4A2E1A");
}

export function drawKakigoriFlag(c: Ctx, x: number, gy: number, w: number, h: number, t: number): void {
  c.fillStyle = "#6E6A80"; c.fillRect(x + 4, gy - h - 4, 3, h + 4);
  const sway = Math.sin(t * 3) * 1.5;
  c.fillStyle = "#FFFFFF";
  c.beginPath(); c.moveTo(x + 7, gy - h); c.lineTo(x + w + sway, gy - h + 2); c.lineTo(x + w + sway, gy - h + 34); c.lineTo(x + 7, gy - h + 36); c.closePath(); c.fill();
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
    c.fillStyle = col;
    c.beginPath(); c.moveTo(x + i * pw + 1, top + 2); c.lineTo(x + (i + 1) * pw - 1, top + 2); c.lineTo(x + (i + 1) * pw - 1 + sw, bot); c.lineTo(x + i * pw + 1 + sw, bot); c.closePath(); c.fill();
  }
  text(c, look === "summer" ? "祭" : "ゆ", x + w / 2, top + (bot - top) * 0.45, 16, "#fff");
}
