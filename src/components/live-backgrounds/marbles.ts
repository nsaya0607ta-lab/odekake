/**
 * ビー玉：木のテーブルの上で、ガラスのビー玉がスマホをかたむけた方へ転がり、ぶつかり合う。タップすると、まわりのビー玉がはじける。
 * かたむきが取れないとき（パソコン・許可がない iPhone）は、ゆっくり向きの変わる「見えないかたむき」で転がす。
 *
 * - テーブル（板目・木目・ランプの光）は大きさが変わったときだけ描く
 * - ビー玉は、回る中身（キャッツアイ・うず巻き・泡入り・ラメ・不透明）と、回らないガラスの光（ふちの暗さ・つや）を分けて前もって描き、
 *   転がった距離だけ中身を回す。床には、やわらかい影と、ガラスを通って集まった色の光（集光）を落とす
 */
import { addCanvas, clamp, context2d, makeSprite, onBackgroundTap, onTilt, seededRandom, startLoop, STILL_TIME, type CanvasSize, type LiveMount } from "./engine";

type Kind = "cat" | "swirl" | "clear" | "glitter" | "solid";
type Marble = { x: number; y: number; vx: number; vy: number; r: number; rot: number; sprite: number };
type Clink = { x: number; y: number; life: number };

const GLASS: readonly { tint: string; core: string[]; kind: Kind; light: string }[] = [
  { tint: "120,185,255", core: ["#ffd25e", "#ff7a59", "#ffffff"], kind: "cat", light: "150,200,255" },
  { tint: "255,150,175", core: ["#ffffff", "#ffd1dc"], kind: "swirl", light: "255,170,190" },
  { tint: "140,225,180", core: ["#2f9d6a", "#ffe066"], kind: "cat", light: "150,235,190" },
  { tint: "210,235,255", core: [], kind: "clear", light: "220,240,255" },
  { tint: "255,205,120", core: ["#e0702a", "#ffe9b0"], kind: "swirl", light: "255,210,140" },
  { tint: "190,160,255", core: ["#ffffff"], kind: "glitter", light: "200,170,255" },
  { tint: "110,215,215", core: ["#ff8a65", "#ffffff"], kind: "cat", light: "130,225,225" },
  { tint: "240,240,240", core: ["#e84a5f", "#2a72c9", "#f6c945"], kind: "solid", light: "255,240,220" },
];
const SIZE = 128;

/** 回る中身 */
function drawCore(g: CanvasRenderingContext2D, def: (typeof GLASS)[number], seed: number) {
  const r = seededRandom(seed);
  const c = SIZE / 2, rad = SIZE * 0.47;
  g.save();
  g.beginPath(); g.arc(c, c, rad, 0, Math.PI * 2); g.clip();
  // ガラスの地の色（すけている）
  const body = g.createRadialGradient(c - rad * 0.25, c - rad * 0.3, rad * 0.05, c, c, rad);
  body.addColorStop(0, `rgba(${def.tint},0.18)`);
  body.addColorStop(0.7, `rgba(${def.tint},0.42)`);
  body.addColorStop(1, `rgba(${def.tint},0.75)`);
  g.fillStyle = body;
  g.fillRect(0, 0, SIZE, SIZE);
  if (def.kind === "cat") {
    // キャッツアイ：まん中から広がる、ねじれた羽根
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + r() * 0.3;
      const color = def.core[k % def.core.length]!;
      const grad = g.createLinearGradient(c, c, c + Math.cos(a) * rad, c + Math.sin(a) * rad);
      grad.addColorStop(0, color);
      grad.addColorStop(1, `${color}00`);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(c, c);
      g.bezierCurveTo(c + Math.cos(a - 0.5) * rad * 0.5, c + Math.sin(a - 0.5) * rad * 0.5, c + Math.cos(a + 0.2) * rad * 0.9, c + Math.sin(a + 0.2) * rad * 0.9, c + Math.cos(a + 0.45) * rad, c + Math.sin(a + 0.45) * rad);
      g.bezierCurveTo(c + Math.cos(a + 0.6) * rad * 0.7, c + Math.sin(a + 0.6) * rad * 0.7, c + Math.cos(a + 0.25) * rad * 0.25, c + Math.sin(a + 0.25) * rad * 0.25, c, c);
      g.fill();
    }
  } else if (def.kind === "swirl") {
    // うず巻き：太さの変わる帯を何本か
    for (let k = 0; k < 6; k++) {
      g.strokeStyle = def.core[k % def.core.length]!;
      g.globalAlpha = 0.75;
      g.lineWidth = 5 + r() * 6;
      g.lineCap = "round";
      g.beginPath();
      const a0 = (k / 6) * Math.PI * 2;
      for (let t = 0; t <= 1.001; t += 0.05) {
        const a = a0 + t * 2.6;
        const d = rad * (0.15 + t * 0.85);
        const x = c + Math.cos(a) * d, y = c + Math.sin(a) * d;
        if (t === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  } else if (def.kind === "clear") {
    // 泡入りの透明
    for (let i = 0; i < 9; i++) {
      const x = c + (r() - 0.5) * rad * 1.3, y = c + (r() - 0.5) * rad * 1.3, br = 1.5 + r() * 4;
      g.strokeStyle = "rgba(255,255,255,0.7)";
      g.lineWidth = 1;
      g.beginPath(); g.arc(x, y, br, 0, Math.PI * 2); g.stroke();
      g.fillStyle = "rgba(255,255,255,0.5)";
      g.beginPath(); g.arc(x - br * 0.35, y - br * 0.35, br * 0.3, 0, Math.PI * 2); g.fill();
    }
  } else if (def.kind === "glitter") {
    // ラメ
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad * 0.9;
      g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.95)" : "rgba(255,230,160,0.9)";
      g.fillRect(c + Math.cos(a) * d, c + Math.sin(a) * d, 1.6 + r() * 1.6, 1.6 + r() * 1.6);
    }
  } else {
    // 不透明（陶器のような、色の帯）
    g.fillStyle = "#f6f1e6";
    g.fillRect(0, 0, SIZE, SIZE);
    def.core.forEach((color, k) => {
      g.fillStyle = color;
      g.beginPath();
      g.ellipse(c, c + (k - 1) * rad * 0.62, rad * 1.2, rad * 0.2, 0.15, 0, Math.PI * 2);
      g.fill();
    });
  }
  g.restore();
}

/** 回らないガラスの光（ふちの暗さ・下の明るみ・つや） */
function drawShine(g: CanvasRenderingContext2D) {
  const c = SIZE / 2, rad = SIZE * 0.47;
  // ふちの暗さ（フレネル）
  const rim = g.createRadialGradient(c, c, rad * 0.62, c, c, rad);
  rim.addColorStop(0, "rgba(10,20,40,0)");
  rim.addColorStop(0.85, "rgba(10,20,40,0.18)");
  rim.addColorStop(1, "rgba(10,20,40,0.45)");
  g.fillStyle = rim;
  g.beginPath(); g.arc(c, c, rad, 0, Math.PI * 2); g.fill();
  // 光が中を通って、反対側（右下）に集まる明るみ
  const glow = g.createRadialGradient(c + rad * 0.38, c + rad * 0.42, 0, c + rad * 0.38, c + rad * 0.42, rad * 0.5);
  glow.addColorStop(0, "rgba(255,255,255,0.55)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = glow;
  g.beginPath(); g.arc(c, c, rad, 0, Math.PI * 2); g.fill();
  // つや（ランプのうつりこみ）
  g.fillStyle = "rgba(255,255,255,0.95)";
  g.beginPath(); g.ellipse(c - rad * 0.38, c - rad * 0.44, rad * 0.2, rad * 0.11, -0.75, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(255,255,255,0.5)";
  g.beginPath(); g.ellipse(c - rad * 0.15, c - rad * 0.62, rad * 0.08, rad * 0.04, -0.3, 0, Math.PI * 2); g.fill();
  // 窓のうつりこみ（細い弧）
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.lineWidth = 2;
  g.beginPath(); g.arc(c, c, rad * 0.82, Math.PI * 1.05, Math.PI * 1.4); g.stroke();
}

let cachedCores: HTMLCanvasElement[] | null = null;
let cachedShine: HTMLCanvasElement | null = null;
const cores = () => (cachedCores ??= GLASS.map((def, i) => makeSprite(SIZE, SIZE, (g) => drawCore(g, def, i * 7 + 3))));
const shine = () => (cachedShine ??= makeSprite(SIZE, SIZE, drawShine));
/** 色つきのやわらかい丸を、その場でぬる（影は黒、集光は色） */
function blob(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, angle: number, color: string, alpha: number) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.globalAlpha = alpha;
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  grad.addColorStop(0, `rgba(${color},1)`);
  grad.addColorStop(0.55, `rgba(${color},0.45)`);
  grad.addColorStop(1, `rgba(${color},0)`);
  g.scale(rx, ry);
  g.fillStyle = grad;
  g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.fill();
  g.restore();
}

export const mount: LiveMount = (host, { mode, reducedMotion }) => {
  const still = mode === "still" || reducedMotion;
  const rand = seededRandom(still ? 21 : Date.now() & 0xffff);
  const coreArt = cores();
  const shineArt = shine();
  let marbles: Marble[] = [];
  let clinks: Clink[] = [];
  let scale = 1;
  let tilt: { gx: number; gy: number; at: number } | null = null;
  let clock = 0;
  let dirty = true;

  const table = addCanvas(host, {
    onResize: (size) => {
      scale = clamp(size.w / 390, 0.8, 1.4);
      const count = Math.round(13 * clamp((size.w * size.h) / (390 * 844), 0.6, 1.5));
      marbles = Array.from({ length: count }, (_, i) => {
        const big = i < 2;
        const r = (big ? 34 + rand() * 6 : 19 + rand() * 8) * scale;
        return { x: r + rand() * (size.w - r * 2), y: r + rand() * (size.h - r * 2), vx: 0, vy: 0, r, rot: rand() * 6, sprite: i % GLASS.length };
      });
      dirty = true;
    },
  });
  const layer = addCanvas(host);

  /* ---------------------------------------------------------------- テーブル */
  function paintTable(size: CanvasSize) {
    const g = context2d(table.canvas, size);
    if (!g) return;
    const { w, h } = size;
    const r = seededRandom(33);
    const plank = 74 * scale;
    // 板ごとに少しちがう色
    for (let x = -plank * 0.3, i = 0; x < w; x += plank, i++) {
      const TONES: readonly [number, number, number][] = [[214, 168, 118], [204, 156, 106], [222, 178, 128], [208, 162, 112]];
      const tone = TONES[i % 4]!;
      const base = g.createLinearGradient(x, 0, x + plank, 0);
      base.addColorStop(0, `rgb(${tone[0] - 8},${tone[1] - 8},${tone[2] - 8})`);
      base.addColorStop(0.5, `rgb(${tone[0]},${tone[1]},${tone[2]})`);
      base.addColorStop(1, `rgb(${tone[0] - 6},${tone[1] - 6},${tone[2] - 6})`);
      g.fillStyle = base;
      g.fillRect(x, 0, plank, h);
      // 木目（ゆるく波打つ縦の線）
      for (let k = 0; k < 14; k++) {
        const gx = x + r() * plank;
        const amp = 2 + r() * 5, freq = 0.004 + r() * 0.008, ph = r() * 6;
        g.strokeStyle = `rgba(${110 + r() * 30},${70 + r() * 20},${35},${0.08 + r() * 0.12})`;
        g.lineWidth = 0.6 + r() * 1.4;
        g.beginPath();
        for (let y = 0; y <= h; y += 8) {
          const xx = gx + Math.sin(y * freq + ph) * amp + Math.sin(y * freq * 3.1 + ph) * amp * 0.3;
          if (y === 0) g.moveTo(xx, y); else g.lineTo(xx, y);
        }
        g.stroke();
      }
      // 節
      if (r() < 0.6) {
        const kx = x + plank * (0.3 + r() * 0.4), ky = r() * h;
        for (let k = 5; k > 0; k--) {
          g.strokeStyle = `rgba(110,65,30,${0.06 + (5 - k) * 0.03})`;
          g.lineWidth = 1;
          g.beginPath(); g.ellipse(kx, ky, k * 2.6 * scale, k * 5 * scale, 0, 0, Math.PI * 2); g.stroke();
        }
      }
      // 板のすきま
      g.fillStyle = "rgba(80,45,20,0.45)";
      g.fillRect(x + plank - 1.2, 0, 1.6, h);
      g.fillStyle = "rgba(255,240,220,0.25)";
      g.fillRect(x + 0.4, 0, 1, h);
    }
    // ニスのつや（ランプの光が左上から）
    const lamp = g.createRadialGradient(w * 0.22, h * 0.18, 0, w * 0.22, h * 0.18, Math.max(w, h) * 0.85);
    lamp.addColorStop(0, "rgba(255,244,214,0.38)");
    lamp.addColorStop(0.45, "rgba(255,236,200,0.08)");
    lamp.addColorStop(1, "rgba(60,30,10,0.32)");
    g.fillStyle = lamp;
    g.fillRect(0, 0, w, h);
  }

  /* ---------------------------------------------------------------- 動き */
  const gravity = (): [number, number] => {
    if (tilt && clock - tilt.at < 3) return [tilt.gx, tilt.gy];
    // かたむきが取れないとき：ゆっくり向きの変わる、弱いかたむき
    return [Math.sin(clock * 0.37) * 0.22, Math.cos(clock * 0.29) * 0.2];
  };

  const step = (size: CanvasSize, dt: number) => {
    clock += dt;
    const [gx, gy] = gravity();
    const G = 900 * scale;
    const sub = 3;
    const h = dt / sub;
    for (let s = 0; s < sub; s++) {
      for (const m of marbles) {
        m.vx += gx * G * h;
        m.vy += gy * G * h;
        m.vx *= 1 - h * 0.8;
        m.vy *= 1 - h * 0.8;
        m.x += m.vx * h;
        m.y += m.vy * h;
        const bounce = (v: number) => {
          if (Math.abs(v) > 160 * scale) clinks.push({ x: m.x, y: m.y, life: 1 });
          return Math.abs(v) * 0.55;
        };
        if (m.x < m.r) { m.x = m.r; m.vx = bounce(m.vx); }
        if (m.x > size.w - m.r) { m.x = size.w - m.r; m.vx = -bounce(m.vx); }
        if (m.y < m.r) { m.y = m.r; m.vy = bounce(m.vy); }
        if (m.y > size.h - m.r) { m.y = size.h - m.r; m.vy = -bounce(m.vy); }
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
          const ma = a.r * a.r, mb = b.r * b.r;
          const overlap = min - d;
          a.x -= nx * overlap * (mb / (ma + mb));
          a.y -= ny * overlap * (mb / (ma + mb));
          b.x += nx * overlap * (ma / (ma + mb));
          b.y += ny * overlap * (ma / (ma + mb));
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel > 0) continue;
          // 強くぶつかったら、当たったところが小さく光る
          if (-rel > 180 * scale && clinks.length < 12) clinks.push({ x: a.x + nx * a.r, y: a.y + ny * a.r, life: 1 });
          const impulse = (-(1 + 0.85) * rel) / (1 / ma + 1 / mb);
          a.vx -= (impulse / ma) * nx; a.vy -= (impulse / ma) * ny;
          b.vx += (impulse / mb) * nx; b.vy += (impulse / mb) * ny;
        }
      }
    }
    // 転がった距離だけ、中身を回す（進む向きに合わせて）
    for (const m of marbles) m.rot += ((m.vx - m.vy * 0.3) * dt) / m.r;
    for (const c of clinks) c.life -= dt * 4;
    clinks = clinks.filter((c) => c.life > 0);
  };

  const draw = (size: CanvasSize) => {
    if (dirty) { dirty = false; paintTable(table.size); }
    const g = context2d(layer.canvas, size);
    if (!g) return;
    g.clearRect(0, 0, size.w, size.h);
    // 影（光は左上のランプから。右下へ長くのびる）と、ガラスを通って集まった色の光
    for (const m of marbles) {
      blob(g, m.x + m.r * 0.55, m.y + m.r * 0.6, m.r * 1.35, m.r * 0.85, 0.75, "60,30,10", 0.38);
      blob(g, m.x + m.r * 0.15, m.y + m.r * 0.2, m.r * 0.7, m.r * 0.6, 0, "40,20,5", 0.45);
    }
    g.globalCompositeOperation = "lighter";
    for (const m of marbles) {
      const def = GLASS[m.sprite]!;
      if (def.kind === "solid") continue;
      blob(g, m.x + m.r * 0.85, m.y + m.r * 0.95, m.r * 0.55, m.r * 0.32, 0.75, def.light, 0.55);
    }
    g.globalCompositeOperation = "source-over";
    // ビー玉
    for (const m of marbles) {
      const d = (m.r / 0.47) ;
      g.save();
      g.translate(m.x, m.y);
      g.rotate(m.rot);
      g.drawImage(coreArt[m.sprite]!, -d / 2, -d / 2, d, d);
      g.restore();
      g.drawImage(shineArt, m.x - d / 2, m.y - d / 2, d, d);
    }
    // ぶつかったときの光
    for (const c of clinks) {
      const L = 9 * scale * c.life;
      g.strokeStyle = `rgba(255,255,255,${c.life * 0.9})`;
      g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(c.x - L, c.y); g.lineTo(c.x + L, c.y); g.moveTo(c.x, c.y - L); g.lineTo(c.x, c.y + L); g.stroke();
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
      const reach = 160 * scale;
      if (d > reach) continue;
      const power = (1 - d / reach) * 950 * scale;
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
      table.destroy();
    },
  };
};
