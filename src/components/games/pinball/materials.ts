/**
 * ご当地ピンボールの部品の「材質」の描き方（金属・ゴム・プラスチック・影）
 * =============================================================
 * 台の部品が本物の材質に見えるように描くための道具。光は左上から当たる決まりにしてあり、
 * 光の筋は左上に、影は右下に出る。
 * ・影（shadowBlur）は重いので、前もって一度だけ描く絵（床・ランプ）でだけ使う。毎フレームの絵では使わない。
 * ・shadowBlur / shadowOffset はキャンバスの変換を受けない（画面の画素で指定する）ので、k（1mm の画素数）をかける。
 */

const TAU = Math.PI * 2;

export type Rgba = readonly [number, number, number, number];

/** "#rgb" "#rrggbb" "#rrggbbaa" "rgb()" "rgba()" を読む */
export function parseColor(input: string): Rgba {
  const s = input.trim();
  if (s.startsWith("#")) {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    const n = parseInt(h.slice(0, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
  }
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const parts = m[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
  }
  return [255, 255, 255, 1];
}

function toCss([r, g, b, a]: Rgba): string {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

/** 色の不透明度を変える（alpha を省くと元のまま） */
export function rgba(color: string, alpha?: number): string {
  const c = parseColor(color);
  return toCss([c[0], c[1], c[2], alpha ?? c[3]]);
}

/** 2つの色を混ぜる（t=0 で a、1 で b）。alpha を渡すとその不透明度にする */
export function mix(a: string, b: string, t: number, alpha?: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  const c: [number, number, number, number] = [0, 0, 0, 0];
  for (let i = 0; i < 4; i += 1) c[i] = ca[i]! + (cb[i]! - ca[i]!) * t;
  if (alpha !== undefined) c[3] = alpha;
  return toCss(c);
}

/** 白に寄せる・黒に寄せる（不透明にしてから混ぜる） */
export const lighten = (c: string, t: number, alpha = 1) => mix(rgba(c, 1), "#ffffff", t, alpha);
export const darken = (c: string, t: number, alpha = 1) => mix(rgba(c, 1), "#000000", t, alpha);

/* ---------- 影 ---------- */

/** 影をつける（mm で指定）。必ず noShadow で戻す */
export function shadow(ctx: CanvasRenderingContext2D, k: number, dx: number, dy: number, blur: number, color = "rgba(0,0,0,0.5)"): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = Math.max(0, blur * k);
  ctx.shadowOffsetX = dx * k;
  ctx.shadowOffsetY = dy * k;
}

export function noShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = "rgba(0,0,0,0)";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/* ---------- 形 ---------- */

export type P = { x: number; y: number };

export function polyline(pts: readonly P[], closed = false): Path2D {
  const path = new Path2D();
  pts.forEach((p, i) => (i === 0 ? path.moveTo(p.x, p.y) : path.lineTo(p.x, p.y)));
  if (closed) path.closePath();
  return path;
}

export function circlePath(x: number, y: number, r: number): Path2D {
  const path = new Path2D();
  path.arc(x, y, r, 0, TAU);
  return path;
}

/** 線を左右にずらした線（d > 0 で進む向きの右がわ） */
export function offsetLine(pts: readonly P[], d: number): P[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: p.x - (dy / l) * d, y: p.y + (dx / l) * d };
  });
}

/** 折れ線の長さに沿って、一定の間かくで点と向きを取る */
export function alongLine(pts: readonly P[], step: number, from = 0, to = Infinity): { x: number; y: number; dx: number; dy: number; s: number }[] {
  const out: { x: number; y: number; dx: number; dy: number; s: number }[] = [];
  let acc = 0;
  let next = from;
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len <= 0) continue;
    while (next <= acc + len && next <= to) {
      const t = (next - acc) / len;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dx: (b.x - a.x) / len, dy: (b.y - a.y) / len, s: next });
      next += step;
    }
    acc += len;
  }
  return out;
}

export function lineLength(pts: readonly P[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i += 1) len += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  return len;
}

/* ---------- 金属 ---------- */

/**
 * 金属のレール（めっきした丸い棒）。太さ width（mm）。
 * いちばん外が暗いふち、中に向かって明るくなり、左上にずらした白い筋がつや。lift は影の高さ（0 で影なし）
 */
export function chromeTube(ctx: CanvasRenderingContext2D, k: number, path: Path2D, width: number, opts: { lift?: number; tint?: string } = {}): void {
  const lift = opts.lift ?? 1;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (lift > 0) shadow(ctx, k, 1.1 * lift, 2 * lift, 2.2 * lift, "rgba(0,0,0,0.6)");
  ctx.lineWidth = width;
  ctx.strokeStyle = "#262b31";
  ctx.stroke(path);
  noShadow(ctx);
  ctx.lineWidth = width * 0.8;
  ctx.strokeStyle = "#6f7a87";
  ctx.stroke(path);
  ctx.translate(-width * 0.07, -width * 0.11);
  ctx.lineWidth = width * 0.54;
  ctx.strokeStyle = opts.tint ? mix("#b9c3ce", opts.tint, 0.45) : "#b9c3ce";
  ctx.stroke(path);
  ctx.translate(-width * 0.06, -width * 0.08);
  ctx.lineWidth = Math.max(0.35, width * 0.2);
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.stroke(path);
  ctx.restore();
}

/** ねじ・ポストの頭（めっきの丸）。slot でねじの溝 */
export function chromeDisc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, slot = false): void {
  const g = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.04, x, y, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.3, "#e1e6ec");
  g.addColorStop(0.72, "#7d8895");
  g.addColorStop(1, "#353b43");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  if (slot) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(38,43,50,0.8)";
    ctx.lineWidth = Math.max(0.3, r * 0.24);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.52, y + r * 0.28);
    ctx.lineTo(x + r * 0.52, y - r * 0.28);
    ctx.stroke();
    ctx.restore();
  }
}

/** めっきの輪（バンパーのリングなど）。左上が明るく、右下が暗い */
export function chromeRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, width: number): void {
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.28, "#d9dfe6");
  g.addColorStop(0.55, "#8994a1");
  g.addColorStop(0.8, "#4a525c");
  g.addColorStop(1, "#9aa5b2");
  ctx.save();
  ctx.lineWidth = width;
  ctx.strokeStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.3, width * 0.16);
  ctx.strokeStyle = "rgba(20,24,29,0.55)";
  ctx.beginPath();
  ctx.arc(x, y, r + width / 2, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r - width / 2, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/* ---------- ゴム ---------- */

const RUBBER = { base: "#ddd6c7", mid: "#f4f0e7", edge: "#6e665a" };

/** ゴムのひも（スリングショットのまわりなど）。太さ width（mm） */
export function rubberBand(ctx: CanvasRenderingContext2D, k: number, path: Path2D, width: number, opts: { lift?: number; color?: string } = {}): void {
  const lift = opts.lift ?? 1;
  const mid = opts.color ?? RUBBER.mid;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (lift > 0) shadow(ctx, k, 1 * lift, 1.8 * lift, 2 * lift, "rgba(0,0,0,0.55)");
  ctx.lineWidth = width;
  ctx.strokeStyle = RUBBER.edge;
  ctx.stroke(path);
  noShadow(ctx);
  ctx.lineWidth = width * 0.84;
  ctx.strokeStyle = darken(mid, 0.12);
  ctx.stroke(path);
  ctx.translate(-width * 0.06, -width * 0.1);
  ctx.lineWidth = width * 0.58;
  ctx.strokeStyle = mid;
  ctx.stroke(path);
  ctx.translate(-width * 0.05, -width * 0.07);
  ctx.lineWidth = Math.max(0.3, width * 0.16);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.stroke(path);
  ctx.restore();
}

/** ポストのまわりのゴムの輪。外の半径 r、太さ w */
export function rubberRing(ctx: CanvasRenderingContext2D, k: number, x: number, y: number, r: number, w: number, opts: { lift?: number } = {}): void {
  const lift = opts.lift ?? 1;
  const rr = r - w / 2;
  ctx.save();
  if (lift > 0) shadow(ctx, k, 1 * lift, 1.8 * lift, 2 * lift, "rgba(0,0,0,0.55)");
  ctx.beginPath();
  ctx.arc(x, y, rr, 0, TAU);
  ctx.lineWidth = w;
  ctx.strokeStyle = RUBBER.base;
  ctx.stroke();
  noShadow(ctx);
  const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.45, "rgba(250,247,240,0.6)");
  g.addColorStop(1, "rgba(120,110,96,0.6)");
  ctx.lineWidth = w * 0.72;
  ctx.strokeStyle = g;
  ctx.stroke();
  ctx.lineWidth = Math.max(0.3, w * 0.14);
  ctx.strokeStyle = "rgba(80,72,62,0.6)";
  ctx.beginPath();
  ctx.arc(x, y, r - 0.1, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/* ---------- プラスチック ---------- */

export type Box = { x: number; y: number; w: number; h: number };

/**
 * 色つきの透明プラスチックの板（スリングショットのカバーなど）。左上がつやで光り、右下へ影が落ちる。
 * lift は板の高さ（影の長さ）
 */
export function plasticSheet(ctx: CanvasRenderingContext2D, k: number, path: Path2D, color: string, box: Box, opts: { lift?: number; opacity?: number } = {}): void {
  const lift = opts.lift ?? 1;
  const op = opts.opacity ?? 0.86;
  ctx.save();
  if (lift > 0) shadow(ctx, k, 2.2 * lift, 3.8 * lift, 4.5 * lift, "rgba(0,0,0,0.5)");
  const g = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
  g.addColorStop(0, lighten(color, 0.42, op));
  g.addColorStop(0.45, rgba(color, op * 0.92));
  g.addColorStop(1, darken(color, 0.38, op));
  ctx.fillStyle = g;
  ctx.fill(path);
  noShadow(ctx);
  ctx.clip(path);
  // つや：左上から斜めに入る光の帯
  const gl = ctx.createLinearGradient(box.x, box.y, box.x + box.w * 0.7, box.y + box.h * 0.7);
  gl.addColorStop(0, "rgba(255,255,255,0.5)");
  gl.addColorStop(0.28, "rgba(255,255,255,0.12)");
  gl.addColorStop(0.3, "rgba(255,255,255,0)");
  gl.addColorStop(0.62, "rgba(255,255,255,0)");
  gl.addColorStop(0.66, "rgba(255,255,255,0.1)");
  gl.addColorStop(0.72, "rgba(255,255,255,0)");
  ctx.fillStyle = gl;
  ctx.fill(path);
  ctx.restore();
  // ふち：内がわに明るい面取り、外がわに細い暗い線
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.stroke(path);
  ctx.clip(path);
  ctx.translate(0.5, 0.7);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.stroke(path);
  ctx.restore();
}

/** 色つきプラスチックの小さなポスト（上のレーンのしきりの頭など）。まんなかにねじ */
export function plasticPost(ctx: CanvasRenderingContext2D, k: number, x: number, y: number, r: number, color: string, opts: { lift?: number } = {}): void {
  const lift = opts.lift ?? 1;
  ctx.save();
  if (lift > 0) shadow(ctx, k, 1.2 * lift, 2 * lift, 2.2 * lift, "rgba(0,0,0,0.55)");
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, lighten(color, 0.55));
  g.addColorStop(0.55, rgba(color, 1));
  g.addColorStop(1, darken(color, 0.45));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  noShadow(ctx);
  ctx.lineWidth = Math.max(0.3, r * 0.12);
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.stroke();
  ctx.restore();
  chromeDisc(ctx, x, y, r * 0.42, true);
}
