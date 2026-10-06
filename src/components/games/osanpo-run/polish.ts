/**
 * おさんぽフレンチーの「見た目だけ」の演出。点数・出現・速さ・当たり判定にはさわらない。
 * - drawSunFlare：太陽のまわりの光の筋（ゆっくり回る）とレンズのきらめき
 * - drawForeground：画面のいちばん手前を、ぼけた草花などが速く流れる（奥行き）
 * - drawSpeedLines：ラッシュ中や速いときの風の線
 * - drawVignette：画面の四すみを少し暗くして、まんなかに目がいくように
 * - drawBeam / drawBurst：レアアイテムを拾ったときの光の柱と、放射する光
 * どれも状態を持たない関数（位置は呼ぶ側から渡す）。座標は engine.ts と同じ論理ピクセル。
 */
import type { OsanpoRunStageId } from "@/lib/games/osanpo-run/config";
import { mix, rgb, type Ctx, type RGB } from "./draw";

/** 0〜1 の決まった乱数（同じ i なら同じ値。手前の草花の並びに使う） */
function hash01(i: number, salt = 0): number {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/* ---------- 太陽 ---------- */
export function drawSunFlare(
  c: Ctx,
  o: { sx: number; sy: number; col: RGB; warm: number; day: number; t: number; vw: number; vh: number; still: boolean },
): void {
  const { sx, sy, col, warm, day, t, vw, vh, still } = o;
  if (day < 0.15) return;
  const base = `${col[0] | 0},${col[1] | 0},${col[2] | 0}`;
  c.save();
  c.globalCompositeOperation = "lighter";

  // ゆっくり回る光の筋（夕方ほど強く、長い）。太い筋と細い筋を薄く重ねて、ふちをやわらかく
  const rays = 9;
  const len = 95 + warm * 75;
  const spin = still ? 0 : t * 0.04;
  for (const [widen, alpha] of [[2.2, 0.03], [1, 0.045]] as const) {
    const g = c.createRadialGradient(sx, sy, 12, sx, sy, len);
    g.addColorStop(0, `rgba(${base},${(alpha + warm * alpha) * day})`);
    g.addColorStop(0.55, `rgba(${base},${(alpha + warm * alpha) * 0.35 * day})`);
    g.addColorStop(1, `rgba(${base},0)`);
    c.fillStyle = g;
    c.beginPath();
    for (let i = 0; i < rays; i += 1) {
      const a = spin + (i / rays) * Math.PI * 2 + hash01(i, 5) * 0.4;
      const w = (0.025 + hash01(i, 3) * 0.035) * widen;
      const l = len * (0.55 + hash01(i, 7) * 0.45);
      c.moveTo(sx, sy);
      c.lineTo(sx + Math.cos(a - w) * l, sy + Math.sin(a - w) * l);
      c.lineTo(sx + Math.cos(a + w) * l, sy + Math.sin(a + w) * l);
      c.closePath();
    }
    c.fill();
  }

  // 太陽のまわりのやわらかい暈（かさ）
  const halo = c.createRadialGradient(sx, sy, 16, sx, sy, 46);
  halo.addColorStop(0, `rgba(255,252,240,${0.35 * day})`);
  halo.addColorStop(1, "rgba(255,252,240,0)");
  c.fillStyle = halo;
  c.beginPath(); c.arc(sx, sy, 46, 0, Math.PI * 2); c.fill();

  // レンズのきらめき：太陽から画面のまんなかを通る線の上に、色つきの丸がならぶ
  const cx = vw / 2, cy = vh * 0.42;
  const ghosts: [number, number, string, number][] = [
    [0.35, 7, "255,236,190", 0.12],
    [0.62, 13, "190,230,255", 0.08],
    [0.9, 4, "255,210,240", 0.14],
    [1.25, 20, "210,255,220", 0.06],
    [1.55, 9, "255,226,170", 0.1],
  ];
  for (const [k, r, color, a] of ghosts) {
    const gx = sx + (cx - sx) * k * 2, gy = sy + (cy - sy) * k * 2;
    const gg = c.createRadialGradient(gx, gy, 0, gx, gy, r);
    gg.addColorStop(0, `rgba(${color},${a * day * (0.6 + warm * 0.4)})`);
    gg.addColorStop(0.7, `rgba(${color},${a * 0.5 * day})`);
    gg.addColorStop(1, `rgba(${color},0)`);
    c.fillStyle = gg;
    c.beginPath(); c.arc(gx, gy, r, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

/* ---------- 手前の草花（ぼけた前景） ---------- */
const FORE_TILE = 38;

export function drawForeground(
  c: Ctx,
  o: { stage: OsanpoRunStageId; cam: number; vw: number; vh: number; ground: number; night: number; side: RGB; t: number },
): void {
  const { stage, cam, vw, vh, ground, night, side, t } = o;
  // 道の下半分だけに置く（障害物やアイテムがある地面の高さにはかからない）
  const room = vh - ground;
  if (room < 40) return;
  const bottom = vh + 2;
  const maxH = Math.min(38, room * 0.5);
  const dark: RGB = mix(stage === "snow" ? [210, 220, 240] : [40, 56, 46], [14, 12, 30], night * 0.8);
  const leaf: RGB = mix(
    stage === "snow" ? [236, 242, 252] : stage === "hiking" ? [74, 120, 70] : stage === "summer" ? [86, 140, 82] : [96, 138, 92],
    [24, 26, 48],
    night * 0.75,
  );
  const flowerCols: RGB[] = stage === "snow"
    ? [[255, 255, 255], [200, 220, 255]]
    : stage === "summer"
      ? [[255, 150, 90], [255, 220, 110], [255, 120, 160]]
      : stage === "hiking"
        ? [[255, 236, 150], [220, 200, 255]]
        : [[255, 190, 210], [255, 240, 170], [200, 220, 255]];

  const shift = cam * 1.35;
  const first = Math.floor(shift / FORE_TILE) - 1;
  const count = Math.ceil(vw / FORE_TILE) + 3;
  c.save();
  for (let n = 0; n < count; n += 1) {
    const i = first + n;
    if (hash01(i, 1) < 0.32) continue; // すきまをあけて、ところどころに
    const x = i * FORE_TILE - shift + hash01(i, 2) * FORE_TILE;
    const h = maxH * (0.55 + hash01(i, 4) * 0.45);
    const sway = Math.sin(t * 1.6 + i) * 2;
    if (stage === "snow" && hash01(i, 5) < 0.5) {
      // 雪のかたまり
      c.fillStyle = rgb(dark, 0.85);
      c.beginPath(); c.ellipse(x, bottom, 26 + hash01(i, 6) * 18, h * 0.55, 0, Math.PI, 0); c.fill();
      c.fillStyle = "rgba(255,255,255,0.35)";
      c.beginPath(); c.ellipse(x - 6, bottom - h * 0.32, 12, 3, -0.1, 0, Math.PI * 2); c.fill();
      continue;
    }
    // 草のかたまり：外側をうすく、内側を濃く重ねて「ぼけ」に見せる
    for (const [spread, alpha] of [[1.25, 0.28], [1, 0.75]] as const) {
      c.fillStyle = rgb(alpha === 0.75 ? leaf : dark, alpha);
      c.beginPath();
      c.moveTo(x - 18 * spread, bottom);
      const blades = 5;
      for (let b = 0; b < blades; b += 1) {
        const bx = x - 14 * spread + (b / (blades - 1)) * 28 * spread;
        const bh = h * spread * (0.6 + hash01(i * 7 + b, 8) * 0.5);
        c.quadraticCurveTo(bx - 3, bottom - bh * 0.5, bx + sway * (bh / maxH), bottom - bh);
        c.quadraticCurveTo(bx + 3, bottom - bh * 0.45, bx + 5 * spread, bottom);
      }
      c.lineTo(x + 18 * spread, bottom);
      c.closePath();
      c.fill();
    }
    // ときどき花
    if (hash01(i, 9) < 0.45) {
      const fc = flowerCols[Math.floor(hash01(i, 10) * flowerCols.length)]!;
      const fx = x + (hash01(i, 11) - 0.5) * 16 + sway, fy = bottom - h * 0.95;
      c.fillStyle = rgb(mix(fc, [30, 26, 60], night * 0.6), 0.8);
      for (let p = 0; p < 5; p += 1) {
        const a = (p / 5) * Math.PI * 2;
        c.beginPath(); c.arc(fx + Math.cos(a) * 3.2, fy + Math.sin(a) * 3.2, 2.6, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = rgb(mix([255, 230, 120], [40, 30, 50], night * 0.6), 0.9);
      c.beginPath(); c.arc(fx, fy, 1.8, 0, Math.PI * 2); c.fill();
    }
  }
  // 手前の地面のかげ（道の下のはしを暗くして、奥行きを出す）
  const g = c.createLinearGradient(0, bottom - maxH * 1.4, 0, bottom);
  g.addColorStop(0, rgb(side, 0));
  g.addColorStop(1, rgb(mix(side, [10, 8, 24], 0.6), 0.35));
  c.fillStyle = g;
  c.fillRect(0, bottom - maxH * 1.4, vw, maxH * 1.4);
  c.restore();
}

/* ---------- 風の線 ---------- */
export type SpeedLine = { x: number; y: number; len: number; v: number };

export function makeSpeedLines(n: number): SpeedLine[] {
  return Array.from({ length: n }, (_, i) => ({ x: hash01(i, 21), y: hash01(i, 22), len: 30 + hash01(i, 23) * 60, v: 0.8 + hash01(i, 24) * 0.8 }));
}

/** strength 0〜1。dtX は画面の幅に対する1フレームの移動量 */
export function drawSpeedLines(c: Ctx, lines: SpeedLine[], o: { strength: number; dt: number; vw: number; ground: number; color: string }): void {
  const { strength, dt, vw, ground, color } = o;
  if (strength <= 0.01) return;
  c.save();
  c.globalCompositeOperation = "lighter";
  c.lineCap = "round";
  for (const l of lines) {
    l.x -= dt * 2.6 * l.v;
    if (l.x < -0.3) { l.x = 1.1 + Math.random() * 0.3; l.y = Math.random(); }
    const x = l.x * vw, y = 24 + l.y * (ground - 60);
    const grad = c.createLinearGradient(x, y, x + l.len, y);
    grad.addColorStop(0, `rgba(${color},0)`);
    grad.addColorStop(0.4, `rgba(${color},${0.42 * strength})`);
    grad.addColorStop(1, `rgba(${color},0)`);
    c.strokeStyle = grad;
    c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + l.len * (0.7 + strength * 0.6), y); c.stroke();
  }
  c.restore();
}

/* ---------- 画面のふち ---------- */
export function drawVignette(c: Ctx, vw: number, vh: number, a: number): void {
  if (a <= 0.005) return;
  const g = c.createRadialGradient(vw / 2, vh * 0.5, Math.min(vw, vh) * 0.45, vw / 2, vh * 0.5, Math.max(vw, vh) * 0.78);
  g.addColorStop(0, "rgba(16,12,36,0)");
  g.addColorStop(1, `rgba(16,12,36,${a})`);
  c.fillStyle = g;
  c.fillRect(-20, -20, vw + 40, vh + 40);
}

/* ---------- レアアイテムの光 ---------- */
/** k は 0（出たて）→1（消える） */
export function drawBeam(c: Ctx, x: number, ground: number, color: string, k: number): void {
  const a = Math.sin(Math.min(1, k * 1.4) * Math.PI) * (1 - k * 0.4);
  if (a <= 0.01) return;
  const w = 14 + k * 26;
  c.save();
  c.globalCompositeOperation = "lighter";
  const g = c.createLinearGradient(x - w, 0, x + w, 0);
  g.addColorStop(0, `rgba(${color},0)`);
  g.addColorStop(0.5, `rgba(${color},${0.5 * a})`);
  g.addColorStop(1, `rgba(${color},0)`);
  c.fillStyle = g;
  c.fillRect(x - w, -20, w * 2, ground + 20);
  const core = c.createLinearGradient(x - w * 0.25, 0, x + w * 0.25, 0);
  core.addColorStop(0, "rgba(255,255,255,0)");
  core.addColorStop(0.5, `rgba(255,255,255,${0.55 * a})`);
  core.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = core;
  c.fillRect(x - w * 0.25, -20, w * 0.5, ground + 20);
  c.restore();
}

export function drawBurst(c: Ctx, x: number, y: number, color: string, k: number, rot: number): void {
  const a = 1 - k;
  if (a <= 0.01) return;
  const r = 18 + k * 70;
  c.save();
  c.globalCompositeOperation = "lighter";
  c.translate(x, y);
  c.rotate(rot);
  const g = c.createRadialGradient(0, 0, 4, 0, 0, r);
  g.addColorStop(0, `rgba(${color},${0.55 * a})`);
  g.addColorStop(1, `rgba(${color},0)`);
  c.fillStyle = g;
  c.beginPath();
  const n = 10;
  for (let i = 0; i < n; i += 1) {
    const ang = (i / n) * Math.PI * 2;
    c.moveTo(0, 0);
    c.lineTo(Math.cos(ang - 0.09) * r, Math.sin(ang - 0.09) * r);
    c.lineTo(Math.cos(ang + 0.09) * r, Math.sin(ang + 0.09) * r);
    c.closePath();
  }
  c.fill();
  c.strokeStyle = `rgba(255,255,255,${0.6 * a})`;
  c.lineWidth = 1.5;
  c.beginPath(); c.arc(0, 0, 10 + k * 40, 0, Math.PI * 2); c.stroke();
  c.restore();
}
