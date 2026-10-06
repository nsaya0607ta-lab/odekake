/**
 * ふうせん：色とりどりのふうせん（ときどき、わんこの顔のふうせん）が、ゆらゆら空へのぼっていく。
 * ふうせんをタップすると割れて紙ふぶき、空いているところをタップすると、そこから1つ飛んでいく。
 * ふうせん本体は色ごとに前もって描いておき（makeSprite）、毎回はひもと位置だけを描く。
 */
import { addCanvas, clamp, context2d, makeSprite, onBackgroundTap, seededRandom, startLoop, STILL_TIME, type CanvasSize, type LiveMount } from "./engine";

type Balloon = {
  x: number; y: number; vy: number; r: number;
  sway: number; swayF: number; swayP: number; tilt: number;
  sprite: number; age: number;
};
type Bit = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; color: string; life: number; w: number; h: number };
type Ring = { x: number; y: number; r: number; life: number; color: string };

const COLORS: readonly [string, string][] = [
  ["#ff8fa3", "#e5607c"], ["#ffc56b", "#eb9d34"], ["#8fd3a8", "#4fae79"], ["#8ec5ff", "#4f93dc"],
  ["#c9a7ff", "#9a74e0"], ["#ffe07a", "#e8bd2e"], ["#ff9f80", "#e3704d"], ["#9fe3e0", "#51b8b2"],
];
const CONFETTI = ["#ff8fa3", "#ffc56b", "#8fd3a8", "#8ec5ff", "#c9a7ff", "#ffe07a"];
const BASE = 64;

/** ふうせん1つぶんの絵（ふつうの丸いもの／わんこの顔） */
function drawBalloon(g: CanvasRenderingContext2D, [light, dark]: readonly [string, string], dog: boolean) {
  const cx = BASE, cy = BASE * 0.95, r = BASE * 0.62;
  g.save();
  if (dog) {
    // 耳（フレブルの立ち耳）
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + side * r * 0.35, cy - r * 0.7);
      g.quadraticCurveTo(cx + side * r * 0.95, cy - r * 1.55, cx + side * r * 0.98, cy - r * 0.42);
      g.closePath();
      g.fillStyle = dark;
      g.fill();
      g.beginPath();
      g.moveTo(cx + side * r * 0.45, cy - r * 0.68);
      g.quadraticCurveTo(cx + side * r * 0.86, cy - r * 1.28, cx + side * r * 0.88, cy - r * 0.5);
      g.closePath();
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.fill();
    }
  }
  const body = g.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05);
  body.addColorStop(0, light);
  body.addColorStop(0.7, light);
  body.addColorStop(1, dark);
  g.fillStyle = body;
  g.beginPath();
  if (dog) g.ellipse(cx, cy, r, r * 0.9, 0, 0, Math.PI * 2);
  else g.ellipse(cx, cy, r * 0.86, r, 0, 0, Math.PI * 2);
  g.fill();
  // むすび目
  g.fillStyle = dark;
  g.beginPath();
  const by = cy + (dog ? r * 0.9 : r);
  g.moveTo(cx, by - 2);
  g.lineTo(cx - 5, by + 6);
  g.lineTo(cx + 5, by + 6);
  g.closePath();
  g.fill();
  if (dog) {
    // 顔（目・鼻・口・ほっぺ）
    g.fillStyle = "rgba(60,40,40,0.82)";
    for (const side of [-1, 1]) {
      g.beginPath(); g.arc(cx + side * r * 0.32, cy - r * 0.08, r * 0.09, 0, Math.PI * 2); g.fill();
    }
    g.beginPath(); g.ellipse(cx, cy + r * 0.16, r * 0.13, r * 0.09, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(60,40,40,0.75)";
    g.lineWidth = 2;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(cx - r * 0.16, cy + r * 0.3);
    g.quadraticCurveTo(cx - r * 0.08, cy + r * 0.38, cx, cy + r * 0.27);
    g.quadraticCurveTo(cx + r * 0.08, cy + r * 0.38, cx + r * 0.16, cy + r * 0.3);
    g.stroke();
    g.fillStyle = "rgba(255,120,140,0.35)";
    for (const side of [-1, 1]) {
      g.beginPath(); g.ellipse(cx + side * r * 0.55, cy + r * 0.18, r * 0.13, r * 0.08, 0, 0, Math.PI * 2); g.fill();
    }
  }
  // つや
  g.fillStyle = "rgba(255,255,255,0.6)";
  g.beginPath();
  g.ellipse(cx - r * 0.38, cy - r * 0.45, r * 0.14, r * 0.26, 0.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.35)";
  g.beginPath();
  g.arc(cx - r * 0.18, cy - r * 0.7, r * 0.06, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

let cachedSprites: HTMLCanvasElement[] | null = null;
/** 0〜7 はふつうのふうせん、8〜11 はわんこの顔 */
const sprites = () =>
  (cachedSprites ??= [
    ...COLORS.map((c) => makeSprite(BASE * 2, BASE * 2, (g) => drawBalloon(g, c, false))),
    ...[COLORS[0]!, COLORS[3]!, COLORS[5]!, COLORS[4]!].map((c) => makeSprite(BASE * 2, BASE * 2, (g) => drawBalloon(g, c, true))),
  ]);

export const mount: LiveMount = (host, { mode, reducedMotion }) => {
  const still = mode === "still" || reducedMotion;
  const rand = seededRandom(still ? 9 : Date.now() & 0xffff);
  const art = sprites();
  let balloons: Balloon[] = [];
  let bits: Bit[] = [];
  let rings: Ring[] = [];
  let scale = 1;
  let next = 1;
  let clouds: { x: number; y: number; s: number; v: number }[] = [];

  const newBalloon = (size: CanvasSize, at?: { x: number; y: number }): Balloon => {
    const dog = rand() < 0.16;
    return {
      x: at?.x ?? size.w * (0.05 + rand() * 0.9),
      y: at?.y ?? size.h + 80 * scale,
      vy: -(28 + rand() * 26) * scale,
      r: (22 + rand() * 14) * scale * (dog ? 1.1 : 1),
      sway: (8 + rand() * 12) * scale,
      swayF: 0.5 + rand() * 0.5,
      swayP: rand() * 6.28,
      tilt: 0,
      sprite: dog ? 8 + Math.floor(rand() * 4) : Math.floor(rand() * 8),
      age: 0,
    };
  };

  const fill = (size: CanvasSize) => {
    scale = clamp(size.w / 390, 0.75, 1.35);
    balloons = Array.from({ length: 9 }, () => {
      const b = newBalloon(size);
      b.y = size.h * (0.1 + rand() * 0.95);
      return b;
    });
    clouds = Array.from({ length: 4 }, (_, i) => ({ x: rand() * size.w, y: size.h * (0.1 + i * 0.22), s: (0.7 + rand() * 0.6) * scale, v: (3 + rand() * 4) * scale }));
  };
  const layer = addCanvas(host, { onResize: fill });
  const ctx = context2d(layer.canvas, layer.size);

  const pop = (b: Balloon) => {
    const color = COLORS[b.sprite % 8]![0];
    rings.push({ x: b.x, y: b.y, r: b.r * 0.6, life: 1, color });
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2;
      const sp = (60 + rand() * 180) * scale;
      bits.push({
        x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40 * scale, rot: rand() * 6, vr: (rand() - 0.5) * 12,
        color: i % 3 === 0 ? color : CONFETTI[Math.floor(rand() * CONFETTI.length)]!, life: 1.6 + rand() * 0.8,
        w: (4 + rand() * 4) * scale, h: (2.5 + rand() * 2.5) * scale,
      });
    }
  };

  const drawCloud = (x: number, y: number, s: number) => {
    if (!ctx) return;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.arc(x, y, 22 * s, 0, Math.PI * 2);
    ctx.arc(x + 26 * s, y - 10 * s, 28 * s, 0, Math.PI * 2);
    ctx.arc(x + 56 * s, y, 22 * s, 0, Math.PI * 2);
    ctx.rect(x, y, 56 * s, 18 * s);
    ctx.fill();
  };

  const step = (size: CanvasSize, t: number, dt: number) => {
    for (const c of clouds) { c.x += c.v * dt; if (c.x > size.w + 20) c.x = -110 * c.s; }
    next -= dt;
    if (next <= 0 && balloons.length < 14) {
      balloons.push(newBalloon(size));
      // ときどき、まとめて3つ
      if (rand() < 0.15) for (let i = 0; i < 2; i++) { const b = newBalloon(size); b.y += 30 + i * 40; balloons.push(b); }
      next = 1.6 + rand() * 2.2;
    }
    for (const b of balloons) {
      b.age += dt;
      b.y += b.vy * dt;
      const vx = Math.cos(t * b.swayF + b.swayP) * b.sway * b.swayF;
      b.x += vx * dt;
      b.tilt += (vx * 0.012 - b.tilt) * Math.min(1, dt * 3);
    }
    balloons = balloons.filter((b) => b.y > -b.r * 4);
    for (const p of bits) {
      p.vx *= 1 - dt * 1.8; p.vy = p.vy * (1 - dt * 1.8) + 160 * scale * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= dt;
    }
    bits = bits.filter((p) => p.life > 0);
    for (const r of rings) { r.life -= dt * 3; r.r += 140 * scale * dt; }
    rings = rings.filter((r) => r.life > 0);
  };

  const draw = (size: CanvasSize) => {
    if (!ctx) return;
    // 大きさが変わるとキャンバスの倍率が戻るので、毎回そろえる
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    for (const c of clouds) drawCloud(c.x, c.y, c.s);
    // 小さい（遠い）ものから描く
    const order = [...balloons].sort((a, b) => a.r - b.r);
    for (const b of order) {
      const s = (b.r / (BASE * 0.62));
      const sp = art[b.sprite]!;
      const knotY = b.y + b.r * (b.sprite >= 8 ? 0.9 : 1) + 6 * s;
      // ひも
      ctx.strokeStyle = "rgba(110,100,90,0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b.x, knotY);
      const len = b.r * 2.4;
      ctx.bezierCurveTo(b.x - b.tilt * 40 + 6, knotY + len * 0.35, b.x - b.tilt * 60 - 6, knotY + len * 0.7, b.x - b.tilt * 80, knotY + len);
      ctx.stroke();
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.tilt);
      ctx.drawImage(sp, -BASE * s, -BASE * 0.95 * s, BASE * 2 * s, BASE * 2 * s);
      ctx.restore();
    }
    for (const r of rings) {
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = Math.max(0, r.life) * 0.6;
      ctx.lineWidth = 3 * scale;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
    }
    for (const p of bits) {
      ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.rot * 1.7));
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };

  const frame = (t: number, dt: number) => {
    const size = layer.size;
    if (still) {
      if (t === STILL_TIME) draw(size);
      return;
    }
    step(size, t, dt);
    draw(size);
  };

  const stopTap = onBackgroundTap(host, mode, (x, y) => {
    if (still) return;
    // いちばん手前（大きい）のふうせんから当たりを見る
    const hit = [...balloons].sort((a, b) => b.r - a.r).find((b) => Math.hypot(b.x - x, b.y - y) < b.r * 1.15);
    if (hit) {
      pop(hit);
      balloons = balloons.filter((b) => b !== hit);
    } else if (balloons.length < 22) {
      const b = newBalloon(layer.size, { x, y: y + 20 * scale });
      b.vy *= 1.6;
      balloons.push(b);
    }
  });
  const stop = startLoop(host, frame, { still });

  return {
    update: () => {},
    destroy: () => {
      stop();
      stopTap();
      layer.destroy();
    },
  };
};
