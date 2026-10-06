/**
 * ビー玉：ガラスのビー玉が、スマホをかたむけた方へ転がってぶつかり合う。タップすると、まわりのビー玉がはじける。
 * かたむきが取れないとき（パソコン・許可がない iPhone）は、ゆっくり向きの変わる「見えないかたむき」で転がす。
 * ビー玉の中の模様は転がった距離だけ回し、光るところ（つや）は回さずに上から重ねる。
 */
import { addCanvas, clamp, context2d, makeSprite, onBackgroundTap, onTilt, seededRandom, startLoop, STILL_TIME, type CanvasSize, type LiveMount } from "./engine";

type Marble = { x: number; y: number; vx: number; vy: number; r: number; spin: number; sprite: number };

const GLASS: readonly [string, string, string][] = [
  ["#7fc4ff", "#2f7fd6", "#ffd36b"], ["#ff9fb5", "#d9506f", "#ffffff"], ["#9fe0b5", "#3f9f68", "#ffe26b"],
  ["#ffd38a", "#e08a2f", "#5aa0e8"], ["#c8b0ff", "#7a5ad6", "#ff9fd0"], ["#9ee8e6", "#2fa6a0", "#ff8f6b"],
  ["#f2f2f2", "#a9b3c2", "#e85a5a"],
];
const SIZE = 96;

/** 中の模様（回るところ） */
function drawCore(g: CanvasRenderingContext2D, [light, dark, swirl]: readonly [string, string, string], seed: number) {
  const r = seededRandom(seed);
  const c = SIZE / 2, rad = SIZE * 0.46;
  const body = g.createRadialGradient(c - rad * 0.3, c - rad * 0.3, rad * 0.1, c, c, rad);
  body.addColorStop(0, light);
  body.addColorStop(1, dark);
  g.globalAlpha = 0.78;
  g.fillStyle = body;
  g.beginPath(); g.arc(c, c, rad, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 1;
  g.save();
  g.beginPath(); g.arc(c, c, rad * 0.92, 0, Math.PI * 2); g.clip();
  // ねじれた色の帯（キャッツアイ）
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + r() * 0.4;
    g.fillStyle = k === 1 ? "rgba(255,255,255,0.75)" : swirl;
    g.beginPath();
    g.moveTo(c, c);
    g.bezierCurveTo(c + Math.cos(a) * rad * 0.5, c + Math.sin(a) * rad * 0.5, c + Math.cos(a + 0.9) * rad * 1.1, c + Math.sin(a + 0.9) * rad * 1.1, c + Math.cos(a + 0.5) * rad, c + Math.sin(a + 0.5) * rad);
    g.bezierCurveTo(c + Math.cos(a + 0.6) * rad * 0.6, c + Math.sin(a + 0.6) * rad * 0.6, c + Math.cos(a + 0.2) * rad * 0.3, c + Math.sin(a + 0.2) * rad * 0.3, c, c);
    g.fill();
  }
  // 小さな気泡
  g.fillStyle = "rgba(255,255,255,0.5)";
  for (let i = 0; i < 4; i++) {
    g.beginPath(); g.arc(c + (r() - 0.5) * rad, c + (r() - 0.5) * rad, 1 + r() * 2, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

/** 回らないところ（ふちの暗さ・つや） */
function drawShine(g: CanvasRenderingContext2D) {
  const c = SIZE / 2, rad = SIZE * 0.46;
  const rim = g.createRadialGradient(c, c, rad * 0.7, c, c, rad);
  rim.addColorStop(0, "rgba(0,0,0,0)");
  rim.addColorStop(1, "rgba(20,30,60,0.32)");
  g.fillStyle = rim;
  g.beginPath(); g.arc(c, c, rad, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.beginPath(); g.ellipse(c - rad * 0.38, c - rad * 0.42, rad * 0.22, rad * 0.13, -0.7, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(255,255,255,0.35)";
  g.beginPath(); g.ellipse(c + rad * 0.35, c + rad * 0.45, rad * 0.18, rad * 0.07, -0.7, 0, Math.PI * 2); g.fill();
}

let cachedCores: HTMLCanvasElement[] | null = null;
let cachedShine: HTMLCanvasElement | null = null;
const cores = () => (cachedCores ??= GLASS.map((c, i) => makeSprite(SIZE, SIZE, (g) => drawCore(g, c, i * 7 + 3))));
const shine = () => (cachedShine ??= makeSprite(SIZE, SIZE, drawShine));

export const mount: LiveMount = (host, { mode, reducedMotion }) => {
  const still = mode === "still" || reducedMotion;
  const rand = seededRandom(still ? 21 : Date.now() & 0xffff);
  const coreArt = cores();
  const shineArt = shine();
  let marbles: Marble[] = [];
  let scale = 1;
  let tilt: { gx: number; gy: number; at: number } | null = null;
  let clock = 0;

  const layer = addCanvas(host, {
    onResize: (size) => {
      scale = clamp(size.w / 390, 0.8, 1.4);
      const count = Math.round(16 * clamp((size.w * size.h) / (390 * 844), 0.6, 1.5));
      marbles = Array.from({ length: count }, (_, i) => {
        const r = (13 + rand() * 9 + (i === 0 ? 8 : 0)) * scale;
        return { x: r + rand() * (size.w - r * 2), y: r + rand() * (size.h - r * 2), vx: 0, vy: 0, r, spin: rand() * 6, sprite: i % GLASS.length };
      });
    },
  });

  const gravity = (): [number, number] => {
    if (tilt && clock - tilt.at < 3) return [tilt.gx, tilt.gy];
    // かたむきが取れないとき：ゆっくり向きの変わる、弱いかたむき
    return [Math.sin(clock * 0.37) * 0.22, Math.cos(clock * 0.29) * 0.2];
  };

  const step = (size: CanvasSize, dt: number) => {
    clock += dt;
    const [gx, gy] = gravity();
    const G = 900 * scale;
    // 1回を小さく分けて、速いときもすり抜けないようにする
    const sub = 3;
    const h = dt / sub;
    for (let s = 0; s < sub; s++) {
      for (const m of marbles) {
        m.vx += gx * G * h;
        m.vy += gy * G * h;
        // ころがり抵抗
        m.vx *= 1 - h * 0.9;
        m.vy *= 1 - h * 0.9;
        m.x += m.vx * h;
        m.y += m.vy * h;
        if (m.x < m.r) { m.x = m.r; m.vx = Math.abs(m.vx) * 0.6; }
        if (m.x > size.w - m.r) { m.x = size.w - m.r; m.vx = -Math.abs(m.vx) * 0.6; }
        if (m.y < m.r) { m.y = m.r; m.vy = Math.abs(m.vy) * 0.6; }
        if (m.y > size.h - m.r) { m.y = size.h - m.r; m.vy = -Math.abs(m.vy) * 0.6; }
      }
      for (let i = 0; i < marbles.length; i++) {
        for (let j = i + 1; j < marbles.length; j++) {
          const a = marbles[i]!, b = marbles[j]!;
          const dx = b.x - a.x, dy = b.y - a.y;
          const min = a.r + b.r;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 === 0) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d, ny = dy / d;
          // 重さは大きさの2乗に比例
          const ma = a.r * a.r, mb = b.r * b.r;
          const overlap = min - d;
          a.x -= nx * overlap * (mb / (ma + mb));
          a.y -= ny * overlap * (mb / (ma + mb));
          b.x += nx * overlap * (ma / (ma + mb));
          b.y += ny * overlap * (ma / (ma + mb));
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel > 0) continue;
          const impulse = (-(1 + 0.82) * rel) / (1 / ma + 1 / mb);
          a.vx -= (impulse / ma) * nx; a.vy -= (impulse / ma) * ny;
          b.vx += (impulse / mb) * nx; b.vy += (impulse / mb) * ny;
        }
      }
    }
    for (const m of marbles) m.spin += (Math.hypot(m.vx, m.vy) * dt) / m.r * Math.sign(m.vx || 1);
  };

  const draw = (size: CanvasSize) => {
    const g = context2d(layer.canvas, size);
    if (!g) return;
    g.clearRect(0, 0, size.w, size.h);
    // かげ（光は左上から）
    for (const m of marbles) {
      g.fillStyle = "rgba(70,55,35,0.16)";
      g.beginPath(); g.ellipse(m.x + m.r * 0.28, m.y + m.r * 0.38, m.r * 0.95, m.r * 0.8, 0, 0, Math.PI * 2); g.fill();
    }
    for (const m of marbles) {
      const d = (m.r / 0.46) ;
      g.save();
      g.translate(m.x, m.y);
      g.rotate(m.spin);
      g.drawImage(coreArt[m.sprite]!, -d / 2, -d / 2, d, d);
      g.restore();
      g.drawImage(shineArt, m.x - d / 2, m.y - d / 2, d, d);
      // 床にうつる色の光（ガラスごしの光）
      g.fillStyle = "rgba(255,255,255,0.22)";
      g.beginPath(); g.ellipse(m.x + m.r * 0.55, m.y + m.r * 0.75, m.r * 0.35, m.r * 0.15, 0.3, 0, Math.PI * 2); g.fill();
    }
  };

  const frame = (t: number, dt: number) => {
    const size = layer.size;
    if (still) {
      if (t === STILL_TIME) {
        // 見本：散らばったまま、重なりだけほどく
        tilt = { gx: 0, gy: 0, at: 0 };
        for (let i = 0; i < 20; i++) step(size, 1 / 30);
        draw(size);
      }
      return;
    }
    step(size, Math.min(dt, 1 / 20));
    draw(size);
  };

  const stopTilt = onTilt(mode, (gx, gy) => {
    tilt = { gx, gy, at: clock };
  });
  const stopTap = onBackgroundTap(host, mode, (x, y) => {
    if (still) return;
    for (const m of marbles) {
      const dx = m.x - x, dy = m.y - y;
      const d = Math.hypot(dx, dy) || 1;
      const reach = 150 * scale;
      if (d > reach) continue;
      const power = (1 - d / reach) * 900 * scale;
      m.vx += (dx / d) * power;
      m.vy += (dy / d) * power;
    }
  });
  const stop = startLoop(host, frame, { still, fps: 45 });

  return {
    update: () => {},
    destroy: () => {
      stop();
      stopTilt();
      stopTap();
      layer.destroy();
    },
  };
};
