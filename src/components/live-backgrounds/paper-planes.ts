/**
 * 紙ひこうき：青空を、色紙の紙ひこうきがすーっと飛んでいく。うしろに点線の跡を残し、ときどき宙がえり。
 * 雲はゆっくり流れる。画面をタップすると、そこから1機飛んでいく。
 * 紙ひこうきは「折り目のある三角」を2枚（明るい面・かげの面）で描き、進む向きに合わせて回す。
 */
import { addCanvas, clamp, context2d, makeSprite, onBackgroundTap, seededRandom, startLoop, STILL_TIME, type CanvasSize, type LiveMount } from "./engine";

type Plane = {
  x: number; y: number; vx: number; vy: number;
  baseVy: number; bobA: number; bobF: number; bobP: number;
  color: string; shade: string; size: number;
  loopAt: number; loopT: number; trail: { x: number; y: number; t: number }[]; age: number;
};
type Cloud = { x: number; y: number; s: number; v: number; sprite: number };

const PAPERS: readonly [string, string][] = [
  ["#ffffff", "#d9e2ee"], ["#ffd7de", "#efb2bf"], ["#fff1b8", "#ecd27f"], ["#cfeedd", "#9fd3b8"], ["#d6e4ff", "#a9bfeb"], ["#ffe1c2", "#f0b98a"],
];

const makeCloud = (seed: number) =>
  makeSprite(260, 110, (g) => {
    const r = seededRandom(seed);
    for (let i = 0; i < 9; i++) {
      const x = 40 + r() * 180, y = 55 + (r() - 0.5) * 30, rad = 22 + r() * 30;
      const grad = g.createRadialGradient(x, y - rad * 0.3, 0, x, y, rad);
      grad.addColorStop(0, "rgba(255,255,255,0.95)");
      grad.addColorStop(0.6, "rgba(255,255,255,0.75)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    }
  });
let cachedClouds: HTMLCanvasElement[] | null = null;
const cloudSprites = () => (cachedClouds ??= [makeCloud(3), makeCloud(8), makeCloud(21)]);

export const mount: LiveMount = (host, { mode, reducedMotion }) => {
  const still = mode === "still" || reducedMotion;
  const rand = seededRandom(still ? 5 : Date.now() & 0xffff);
  const sprites = cloudSprites();
  let planes: Plane[] = [];
  let clouds: Cloud[] = [];
  let next = 1.5;
  let scale = 1;
  let clock = 0;

  const newPlane = (size: CanvasSize, from?: { x: number; y: number }): Plane => {
    const [color, shade] = PAPERS[Math.floor(rand() * PAPERS.length)]!;
    const speed = (70 + rand() * 50) * scale;
    const y = from?.y ?? size.h * (0.12 + rand() * 0.6);
    return {
      x: from?.x ?? -40, y, vx: speed, vy: from ? -speed * 0.35 : 0, baseVy: (rand() - 0.55) * 14 * scale,
      bobA: (14 + rand() * 18) * scale, bobF: 0.6 + rand() * 0.6, bobP: rand() * 6,
      color, shade, size: (16 + rand() * 9) * scale,
      loopAt: rand() < 0.35 ? 2 + rand() * 4 : -1, loopT: -1, trail: [], age: 0,
    };
  };

  const fill = (size: CanvasSize) => {
    scale = clamp(size.w / 390, 0.75, 1.4);
    clouds = Array.from({ length: 5 }, (_, i) => ({ x: rand() * size.w, y: size.h * (0.08 + i * 0.17 + rand() * 0.05), s: (0.6 + rand() * 0.7) * scale, v: (4 + rand() * 6) * scale, sprite: i % sprites.length }));
    planes = Array.from({ length: 3 }, () => {
      const p = newPlane(size);
      p.x = rand() * size.w;
      return p;
    });
  };
  const layer = addCanvas(host, { onResize: fill });
  const ctx = context2d(layer.canvas, layer.size);

  const drawPlane = (p: Plane) => {
    if (!ctx) return;
    const ang = Math.atan2(p.vy, p.vx);
    const s = p.size;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    // かげ（下に少しずらして、地面ではなく空に浮いている感じに）
    ctx.fillStyle = "rgba(70,90,130,0.12)";
    ctx.beginPath(); ctx.moveTo(s * 1.1, 6); ctx.lineTo(-s, -s * 0.45 + 6); ctx.lineTo(-s * 0.6, 6); ctx.lineTo(-s, s * 0.45 + 6); ctx.closePath(); ctx.fill();
    // 上の翼（明るい面）
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.moveTo(s * 1.1, 0); ctx.lineTo(-s, -s * 0.55); ctx.lineTo(-s * 0.55, 0); ctx.closePath(); ctx.fill();
    // 下の翼（かげの面）
    ctx.fillStyle = p.shade;
    ctx.beginPath(); ctx.moveTo(s * 1.1, 0); ctx.lineTo(-s, s * 0.42); ctx.lineTo(-s * 0.55, 0); ctx.closePath(); ctx.fill();
    // 胴体の折り目
    ctx.fillStyle = "rgba(60,70,100,0.18)";
    ctx.beginPath(); ctx.moveTo(s * 1.1, 0); ctx.lineTo(-s * 0.55, 0); ctx.lineTo(-s * 0.75, s * 0.14); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(60,70,100,0.25)";
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(s * 1.1, 0); ctx.lineTo(-s * 0.55, 0); ctx.stroke();
    ctx.restore();
  };

  const step = (size: CanvasSize, dt: number) => {
    clock += dt;
    for (const c of clouds) { c.x += c.v * dt; if (c.x > size.w + 140) { c.x = -260 * c.s; } }
    next -= dt;
    if (next <= 0 && planes.length < 6) { planes.push(newPlane(size)); next = 2.5 + rand() * 3.5; }
    for (const p of planes) {
      p.age += dt;
      if (p.loopAt > 0 && p.age > p.loopAt && p.loopT < 0) p.loopT = 0;
      const speed = Math.hypot(p.vx, p.vy);
      if (p.loopT >= 0 && p.loopT < 1) {
        // 宙がえり：向きをぐるっと1回転
        p.loopT += dt / 1.6;
        const a = Math.atan2(p.vy, p.vx) - dt * (Math.PI * 2) / 1.6;
        p.vx = Math.cos(a) * speed; p.vy = Math.sin(a) * speed;
      } else {
        // ふわっと上下にゆれながら、まっすぐ飛ぶ
        const targetVy = p.baseVy + Math.cos(p.age * p.bobF + p.bobP) * p.bobA * p.bobF;
        p.vy += (targetVy - p.vy) * Math.min(1, dt * 1.5);
        const targetVx = Math.max(60 * scale, speed * 0.99);
        p.vx += (targetVx - p.vx) * Math.min(1, dt * 1.2);
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (!p.trail.length || Math.hypot(p.trail[p.trail.length - 1]!.x - p.x, p.trail[p.trail.length - 1]!.y - p.y) > 9 * scale) p.trail.push({ x: p.x, y: p.y, t: clock });
      p.trail = p.trail.filter((d) => clock - d.t < 2.6);
    }
    planes = planes.filter((p) => p.x < size.w + 80 && p.y > -120 && p.y < size.h + 120);
  };

  const draw = (size: CanvasSize) => {
    if (!ctx) return;
    ctx.clearRect(0, 0, size.w, size.h);
    for (const c of clouds) {
      const sp = sprites[c.sprite]!;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(sp, c.x, c.y, sp.width * c.s, sp.height * c.s);
    }
    ctx.globalAlpha = 1;
    for (const p of planes) {
      for (const d of p.trail) {
        const k = 1 - (clock - d.t) / 2.6;
        ctx.fillStyle = `rgba(255,255,255,${0.75 * k})`;
        ctx.beginPath(); ctx.arc(d.x, d.y, 1.6 * scale, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const p of planes) drawPlane(p);
  };

  const frame = (t: number, dt: number) => {
    const size = layer.size;
    if (still) {
      if (t === STILL_TIME) {
        // 見本：飛んでいる途中（跡つき）を1枚に
        for (let i = 0; i < 45; i++) step(size, 1 / 30);
        draw(size);
      }
      return;
    }
    step(size, dt);
    draw(size);
  };

  const stopTap = onBackgroundTap(host, mode, (x, y) => {
    if (still) return;
    planes.push(newPlane(layer.size, { x, y }));
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
