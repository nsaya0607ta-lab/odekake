/**
 * スノードーム：夕ぐれの雪の町を閉じこめたスノードーム。
 * ふだんは雪がしんしんと降り、スマホをかたむけると雪がその向きへ流れ、急にかたむけたり画面をなぞったりタップしたりすると、
 * 雪がうずを巻いて舞い上がって、ゆっくり降りつもる。
 *
 * - 景色（空・雪山・森・町・雪だまり・雪だるまわんこ）とガラスの光は、大きさが変わったときだけ描く
 * - 毎回描くのは、えんとつのけむり・窓と街灯のゆらぎ・雪（遠い／中くらい／手前の大きくぼけた粒の3層）・きらめき
 */
import { addCanvas, clamp, context2d, lerp, makeSprite, onBackgroundDrag, onBackgroundTap, onTilt, seededRandom, startLoop, STILL_TIME, type CanvasSize, type LiveMount } from "./engine";

type Flake = { x: number; y: number; vx: number; vy: number; r: number; layer: 0 | 1 | 2; drift: number; spin: number; rot: number };
type Puff = { x: number; y: number; r: number; life: number; vx: number };
type Light = { x: number; y: number; r: number; p: number; warm: boolean };
type Chimney = { x: number; y: number; t: number };

/** 1次元のなめらかなノイズ（山の稜線） */
function ridgeNoise(seed: number) {
  const r = seededRandom(seed);
  const pts = Array.from({ length: 64 }, () => r());
  const at = (x: number) => {
    const i = Math.floor(x), f = x - i;
    const a = pts[((i % 64) + 64) % 64]!, b = pts[(((i + 1) % 64) + 64) % 64]!;
    return a + (b - a) * f * f * (3 - 2 * f);
  };
  return (x: number) => at(x) * 0.6 + at(x * 2.3 + 5) * 0.25 + at(x * 5.1 + 9) * 0.1 + at(x * 11 + 2) * 0.05;
}

/** 手前の大きな雪（ぼけた丸）と、中くらいの雪（六角の結晶）を前もって描いておく */
let cachedSprites: { soft: HTMLCanvasElement; crystal: HTMLCanvasElement; glow: HTMLCanvasElement } | null = null;
function sprites() {
  if (cachedSprites) return cachedSprites;
  const soft = makeSprite(64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.45, "rgba(255,255,255,0.55)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  });
  const crystal = makeSprite(48, 48, (g) => {
    g.translate(24, 24);
    g.strokeStyle = "rgba(255,255,255,0.95)";
    g.lineCap = "round";
    g.lineWidth = 2.6;
    for (let i = 0; i < 6; i++) {
      g.rotate(Math.PI / 3);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -18); g.stroke();
      g.beginPath(); g.moveTo(0, -10); g.lineTo(-5, -15); g.moveTo(0, -10); g.lineTo(5, -15); g.stroke();
    }
    const c = g.createRadialGradient(0, 0, 0, 0, 0, 6);
    c.addColorStop(0, "rgba(255,255,255,1)");
    c.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = c;
    g.beginPath(); g.arc(0, 0, 6, 0, Math.PI * 2); g.fill();
  });
  const glow = makeSprite(64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,214,140,0.9)");
    grad.addColorStop(0.3, "rgba(255,190,110,0.35)");
    grad.addColorStop(1, "rgba(255,180,100,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  });
  cachedSprites = { soft, crystal, glow };
  return cachedSprites;
}

export const mount: LiveMount = (host, { mode, reducedMotion }) => {
  const still = mode === "still" || reducedMotion;
  const rand = seededRandom(still ? 14 : Date.now() & 0xffff);
  const art = sprites();
  let scale = 1;
  let flakes: Flake[] = [];
  let puffs: Puff[] = [];
  let lights: Light[] = [];
  let chimneys: Chimney[] = [];
  let sparkles: { x: number; y: number; p: number }[] = [];
  let dirty = true;
  /** うずの強さ（0〜1）。ふると上がって、少しずつおさまる */
  let swirl = 0;
  let tilt = { gx: 0, gy: 0, at: -99 };
  let lastTilt: { gx: number; gy: number } | null = null;
  let lastDrag: { x: number; y: number; t: number } | null = null;
  let clock = 0;
  let groundAt = (x: number) => x;
  let townY = 0;

  const newFlake = (size: CanvasSize, anywhere: boolean): Flake => {
    const roll = rand();
    const layer: 0 | 1 | 2 = roll < 0.55 ? 0 : roll < 0.9 ? 1 : 2;
    const r = (layer === 0 ? 0.8 + rand() * 1 : layer === 1 ? 2 + rand() * 1.6 : 7 + rand() * 8) * scale;
    return {
      x: rand() * size.w, y: anywhere ? rand() * size.h : -20 - rand() * 60,
      vx: 0, vy: 0, r, layer, drift: rand() * 6, spin: (rand() - 0.5) * 1.5, rot: rand() * 6,
    };
  };

  const scene = addCanvas(host, {
    onResize: (size) => {
      scale = clamp(size.w / 390, 0.8, 1.4);
      townY = size.h * 0.68;
      const base = size.h * 0.8;
      groundAt = (x: number) => base + Math.sin(x * 0.011 + 0.6) * 14 * scale + Math.sin(x * 0.029 + 2) * 6 * scale;
      const count = Math.round(260 * clamp((size.w * size.h) / (390 * 844), 0.5, 1.6));
      flakes = Array.from({ length: count }, () => newFlake(size, true));
      dirty = true;
    },
  });
  const layer = addCanvas(host);
  const glass = addCanvas(host);

  /* ---------------------------------------------------------------- 景色 */
  function paintScene(size: CanvasSize) {
    const g = context2d(scene.canvas, size);
    if (!g) return;
    const r = seededRandom(9);
    const { w, h } = size;
    let s = scale;
    g.clearRect(0, 0, w, h);
    lights = [];
    chimneys = [];

    // 空（夕ぐれの青から、地平線の桃色へ）
    const sky = g.createLinearGradient(0, 0, 0, townY);
    sky.addColorStop(0, "#5d6fae");
    sky.addColorStop(0.45, "#97a6d6");
    sky.addColorStop(0.8, "#d9cde6");
    sky.addColorStop(1, "#f6d9d8");
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    // 月と、空の星
    const mx = w * 0.78, my = h * 0.12;
    const halo = g.createRadialGradient(mx, my, 0, mx, my, 120 * s);
    halo.addColorStop(0, "rgba(255,248,226,0.55)");
    halo.addColorStop(1, "rgba(255,248,226,0)");
    g.fillStyle = halo;
    g.fillRect(0, 0, w, h * 0.4);
    const moon = g.createRadialGradient(mx - 5 * s, my - 5 * s, 2 * s, mx, my, 17 * s);
    moon.addColorStop(0, "#fffdf2");
    moon.addColorStop(1, "#f3e7c6");
    g.fillStyle = moon;
    g.beginPath(); g.arc(mx, my, 17 * s, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(210,195,160,0.18)";
    g.beginPath(); g.arc(mx - 4 * s, my + 4 * s, 5 * s, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(mx + 6 * s, my - 3 * s, 3 * s, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.5})`;
      g.beginPath(); g.arc(r() * w, r() * h * 0.4, 0.4 + r() * 0.9, 0, Math.PI * 2); g.fill();
    }

    // 雪山（なめらかな稜線。月のある右から光が当たり、左向きの斜面はかげになる）
    const range = (seed: number, base: number, amp: number, freq: number, top: string, bottom: string, shadow: string) => {
      const n = ridgeNoise(seed);
      const pts: number[] = [];
      for (let x = -6; x <= w + 6; x += 3) pts.push(base - amp * Math.max(0.05, (n(x * freq) - 0.22) * 1.7));
      const grad = g.createLinearGradient(0, base - amp, 0, townY);
      grad.addColorStop(0, top);
      grad.addColorStop(1, bottom);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(-6, townY + 10 * s);
      pts.forEach((y, i) => g.lineTo(-6 + i * 3, y));
      g.lineTo(w + 6, townY + 10 * s);
      g.closePath();
      g.fill();
      // 斜面のかげ：峰ごとに、月と反対の左の斜面を、峰から麓へ向かう面としてぬる
      const xs = (i: number) => -6 + i * 3;
      for (let i = 2; i < pts.length - 2; i++) {
        const y = pts[i]!;
        if (!(y < pts[i - 1]! && y <= pts[i + 1]! && y < pts[i - 2]! && y <= pts[i + 2]!)) continue;
        // 左の谷まで
        let j = i;
        while (j > 0 && pts[j - 1]! >= pts[j]!) j--;
        if (i - j < 3) continue;
        const px = xs(i), foot = base + 4 * s;
        const sh = g.createLinearGradient(0, y, 0, foot);
        sh.addColorStop(0, shadow.replace("A", "0.38"));
        sh.addColorStop(1, shadow.replace("A", "0.06"));
        g.fillStyle = sh;
        g.beginPath();
        g.moveTo(xs(j), pts[j]!);
        for (let k = j + 1; k <= i; k++) g.lineTo(xs(k), pts[k]!);
        g.lineTo(px + (foot - y) * 0.18, foot);
        g.lineTo(xs(j), foot);
        g.closePath();
        g.fill();
      }
      // 稜線の光
      g.strokeStyle = "rgba(255,255,255,0.8)";
      g.lineWidth = 1.2;
      g.beginPath();
      pts.forEach((y, i) => (i ? g.lineTo(-6 + i * 3, y + 0.5) : g.moveTo(-6, y + 0.5)));
      g.stroke();
    };
    range(4, townY - 30 * s, h * 0.24, 0.0062, "#f7f8fd", "#c9d0ea", "rgba(110,125,185,A)");
    range(11, townY - 8 * s, h * 0.13, 0.0105, "#eef1fb", "#bcc6e4", "rgba(100,115,175,A)");
    // かすみ
    const mist = g.createLinearGradient(0, townY - 120 * s, 0, townY);
    mist.addColorStop(0, "rgba(246,226,232,0)");
    mist.addColorStop(1, "rgba(246,226,232,0.7)");
    g.fillStyle = mist;
    g.fillRect(0, townY - 120 * s, w, 120 * s);

    // もみの木（雪つき）
    const pine = (x: number, y: number, hgt: number, color: string, snow = 0.9) => {
      const tiers = 4;
      g.fillStyle = "#5a4636";
      g.fillRect(x - hgt * 0.04, y - hgt * 0.12, hgt * 0.08, hgt * 0.14);
      for (let i = 0; i < tiers; i++) {
        const ty = y - hgt * 0.1 - i * hgt * 0.21;
        const tw = hgt * (0.36 - i * 0.07);
        g.fillStyle = color;
        g.beginPath(); g.moveTo(x - tw, ty); g.lineTo(x, ty - hgt * 0.32); g.lineTo(x + tw, ty); g.closePath(); g.fill();
        g.fillStyle = `rgba(255,255,255,${snow})`;
        g.beginPath();
        g.moveTo(x - tw * 0.7, ty - hgt * 0.08);
        g.lineTo(x, ty - hgt * 0.32);
        g.lineTo(x + tw * 0.7, ty - hgt * 0.08);
        g.quadraticCurveTo(x + tw * 0.3, ty - hgt * 0.04, x + tw * 0.1, ty - hgt * 0.1);
        g.quadraticCurveTo(x - tw * 0.2, ty - hgt * 0.02, x - tw * 0.7, ty - hgt * 0.08);
        g.fill();
      }
    };
    // 奥の森（青くかすむ）
    for (let x = -10; x < w + 20; x += 9 * s) pine(x, townY + 2 * s + r() * 4 * s, (24 + r() * 16) * s, "#7f90b8", 0.8);
    // 雪原（奥）
    const field = g.createLinearGradient(0, townY - 4 * s, 0, h);
    field.addColorStop(0, "#eef1fa");
    field.addColorStop(1, "#dbe2f3");
    g.fillStyle = field;
    g.fillRect(0, townY, w, h - townY);

    // 町（家・教会・街灯）
    const house = (x: number, base: number, ww: number, hh: number, wall: string, roof: string, chimney: boolean) => {
      // かべ
      const wallG = g.createLinearGradient(x, 0, x + ww, 0);
      wallG.addColorStop(0, wall);
      wallG.addColorStop(1, "#cbbfd2");
      g.fillStyle = wallG;
      g.fillRect(x, base - hh, ww, hh);
      g.fillStyle = "rgba(90,80,120,0.25)";
      g.fillRect(x + ww * 0.62, base - hh, ww * 0.38, hh);
      // 屋根
      const rh = hh * 0.75;
      g.fillStyle = roof;
      g.beginPath(); g.moveTo(x - ww * 0.12, base - hh + 2 * s); g.lineTo(x + ww / 2, base - hh - rh); g.lineTo(x + ww * 1.12, base - hh + 2 * s); g.closePath(); g.fill();
      // 屋根の雪（ぼってり、ふちが垂れる）
      g.fillStyle = "#fbfcff";
      g.beginPath();
      g.moveTo(x - ww * 0.14, base - hh + 1 * s);
      g.lineTo(x + ww / 2, base - hh - rh - 3 * s);
      g.lineTo(x + ww * 1.14, base - hh + 1 * s);
      for (let k = 0; k <= 6; k++) {
        const t = 1 - k / 6;
        const px = lerp(x - ww * 0.14, x + ww * 1.14, t);
        const py = base - hh + 1 * s + (k % 2 ? 4 * s : 1 * s) - Math.abs(t - 0.5) * 0;
        g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(140,155,210,0.35)";
      g.beginPath(); g.moveTo(x + ww / 2, base - hh - rh - 3 * s); g.lineTo(x + ww * 1.14, base - hh + 1 * s); g.lineTo(x + ww * 0.9, base - hh + 1 * s); g.closePath(); g.fill();
      // えんとつ
      if (chimney) {
        const cx = x + ww * 0.72;
        const cy = base - hh - rh * 0.55;
        g.fillStyle = "#8a5f4f";
        g.fillRect(cx, cy - 8 * s, 6 * s, 12 * s);
        g.fillStyle = "#fbfcff";
        g.fillRect(cx - 1 * s, cy - 10 * s, 8 * s, 3 * s);
        chimneys.push({ x: cx + 3 * s, y: cy - 10 * s, t: r() * 2 });
      }
      // 窓（あたたかい明かり）
      const wins = Math.max(1, Math.round(ww / (14 * s)));
      for (let i = 0; i < wins; i++) {
        const wx = x + ((i + 0.5) / wins) * ww - 3.5 * s;
        const wy = base - hh * 0.62;
        g.fillStyle = "#ffd98a";
        g.fillRect(wx, wy, 7 * s, 8 * s);
        g.fillStyle = "rgba(160,90,40,0.5)";
        g.fillRect(wx + 3.2 * s, wy, 0.8 * s, 8 * s);
        g.fillRect(wx, wy + 3.6 * s, 7 * s, 0.8 * s);
        g.fillStyle = "#fbfcff";
        g.fillRect(wx - 1 * s, wy + 8 * s, 9 * s, 1.6 * s);
        lights.push({ x: wx + 3.5 * s, y: wy + 4 * s, r: 16 * s, p: r() * 6, warm: true });
      }
      // ドア
      g.fillStyle = "#6b4a3c";
      g.beginPath(); g.roundRect(x + ww * 0.12, base - 11 * s, 6 * s, 11 * s, [3 * s, 3 * s, 0, 0]); g.fill();
    };
    // 町は大きめに（s を一時的に大きくする）
    const s0 = s;
    s = scale * 1.7;
    const by = townY + 26 * s0;
    house(w * 0.04, by + 2 * s, 34 * s, 22 * s, "#e9d7c2", "#b5544c", true);
    pine(w * 0.16 + 26 * s, by + 4 * s, 44 * s, "#4d7a68");
    house(w * 0.3, by + 6 * s, 40 * s, 26 * s, "#f1e4cf", "#4f6fa6", true);
    // 教会（とんがり屋根と鐘の窓）
    {
      const cx = w * 0.55, cb = by + 2 * s;
      g.fillStyle = "#efe6da";
      g.fillRect(cx - 10 * s, cb - 54 * s, 20 * s, 54 * s);
      g.fillStyle = "#6a5a8e";
      g.beginPath(); g.moveTo(cx - 13 * s, cb - 52 * s); g.lineTo(cx, cb - 82 * s); g.lineTo(cx + 13 * s, cb - 52 * s); g.closePath(); g.fill();
      g.fillStyle = "#fbfcff";
      g.beginPath(); g.moveTo(cx - 13 * s, cb - 52 * s); g.lineTo(cx, cb - 82 * s); g.lineTo(cx - 4 * s, cb - 60 * s); g.closePath(); g.fill();
      g.fillStyle = "#ffd98a";
      g.beginPath(); g.arc(cx, cb - 40 * s, 4 * s, Math.PI, 0); g.fillRect(cx - 4 * s, cb - 40 * s, 8 * s, 7 * s); g.fill();
      lights.push({ x: cx, y: cb - 38 * s, r: 22 * s, p: 1, warm: true });
      g.strokeStyle = "#c9b98a";
      g.lineWidth = 1.4 * s;
      g.beginPath(); g.moveTo(cx, cb - 82 * s); g.lineTo(cx, cb - 92 * s); g.moveTo(cx - 3.5 * s, cb - 88 * s); g.lineTo(cx + 3.5 * s, cb - 88 * s); g.stroke();
    }
    house(w * 0.66, by + 4 * s, 36 * s, 24 * s, "#e3d3e6", "#7a5c86", true);
    pine(w * 0.86, by + 6 * s, 56 * s, "#3f6e5c");
    house(w * 0.88, by + 2 * s, 30 * s, 20 * s, "#f0dcc4", "#a45a48", false);
    pine(w * 0.24, by + 10 * s, 36 * s, "#466f60");

    // 街灯
    for (const lx of [w * 0.2, w * 0.5, w * 0.8]) {
      const ly = by + 22 * s;
      g.fillStyle = "#3e3a4a";
      g.fillRect(lx - 1 * s, ly - 34 * s, 2 * s, 34 * s);
      g.fillRect(lx - 4 * s, ly - 38 * s, 8 * s, 5 * s);
      g.fillStyle = "#fff0c2";
      g.fillRect(lx - 3 * s, ly - 37 * s, 6 * s, 3.4 * s);
      g.fillStyle = "#fbfcff";
      g.fillRect(lx - 5 * s, ly - 40 * s, 10 * s, 2 * s);
      lights.push({ x: lx, y: ly - 35 * s, r: 30 * s, p: lx, warm: true });
    }

    s = s0;
    // 手前の雪だまり（青いかげと、ふちの光）
    const drift = (y0: number, amp: number, phase: number, top: string, bottom: string) => {
      const grad = g.createLinearGradient(0, y0 - amp, 0, h);
      grad.addColorStop(0, top);
      grad.addColorStop(1, bottom);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, h);
      for (let x = 0; x <= w + 6; x += 6) g.lineTo(x, y0 - Math.sin(x * 0.013 + phase) * amp - Math.sin(x * 0.031 + phase * 2) * amp * 0.4);
      g.lineTo(w, h);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.85)";
      g.lineWidth = 1.4;
      g.beginPath();
      for (let x = 0; x <= w + 6; x += 6) {
        const y = y0 - Math.sin(x * 0.013 + phase) * amp - Math.sin(x * 0.031 + phase * 2) * amp * 0.4;
        if (x === 0) g.moveTo(x, y + 1); else g.lineTo(x, y + 1);
      }
      g.stroke();
    };
    drift(h * 0.84, 12 * s, 0.4, "#f5f7fd", "#cfd8ee");
    // 雪だるまわんこ（マフラーと帽子）
    {
      const sx = w * 0.7, sy = h * 0.86;
      const d = 1.25 * s;
      g.fillStyle = "rgba(120,140,190,0.25)";
      g.beginPath(); g.ellipse(sx + 4 * d, sy + 2 * d, 26 * d, 6 * d, 0, 0, Math.PI * 2); g.fill();
      const ball = (cx: number, cy: number, rr: number) => {
        const gr = g.createRadialGradient(cx - rr * 0.35, cy - rr * 0.4, rr * 0.1, cx, cy, rr);
        gr.addColorStop(0, "#ffffff");
        gr.addColorStop(1, "#d3dcf0");
        g.fillStyle = gr;
        g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.fill();
      };
      ball(sx, sy - 14 * d, 18 * d);
      // 耳
      for (const side of [-1, 1]) {
        g.fillStyle = "#f4f6fd";
        g.beginPath(); g.moveTo(sx + side * 5 * d, sy - 44 * d); g.quadraticCurveTo(sx + side * 17 * d, sy - 62 * d, sx + side * 15 * d, sy - 38 * d); g.closePath(); g.fill();
        g.fillStyle = "rgba(240,170,180,0.55)";
        g.beginPath(); g.moveTo(sx + side * 7 * d, sy - 44 * d); g.quadraticCurveTo(sx + side * 14.5 * d, sy - 56 * d, sx + side * 13.5 * d, sy - 41 * d); g.closePath(); g.fill();
      }
      ball(sx, sy - 38 * d, 13 * d);
      // 顔
      g.fillStyle = "#35303a";
      g.beginPath(); g.arc(sx - 4.5 * d, sy - 40 * d, 1.6 * d, 0, Math.PI * 2); g.arc(sx + 4.5 * d, sy - 40 * d, 1.6 * d, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(sx, sy - 35.5 * d, 2.6 * d, 1.8 * d, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,150,160,0.5)";
      g.beginPath(); g.ellipse(sx - 8 * d, sy - 35 * d, 2.4 * d, 1.4 * d, 0, 0, Math.PI * 2); g.ellipse(sx + 8 * d, sy - 35 * d, 2.4 * d, 1.4 * d, 0, 0, Math.PI * 2); g.fill();
      // マフラー
      g.fillStyle = "#d9534f";
      g.beginPath(); g.roundRect(sx - 13 * d, sy - 29 * d, 26 * d, 5 * d, 2.5 * d); g.fill();
      g.beginPath(); g.roundRect(sx + 4 * d, sy - 27 * d, 5 * d, 13 * d, 2 * d); g.fill();
      g.fillStyle = "rgba(255,255,255,0.35)";
      for (let k = 0; k < 4; k++) g.fillRect(sx - 11 * d + k * 6 * d, sy - 29 * d, 2 * d, 5 * d);
      // ボタン
      g.fillStyle = "#4b4452";
      for (const by2 of [-18, -11]) { g.beginPath(); g.arc(sx, sy + by2 * d, 1.6 * d, 0, Math.PI * 2); g.fill(); }
    }
    // わんこの足あと（雪だるまのほうへ、くねくねと）
    {
      const steps = 16;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const px = lerp(w * 0.05, w * 0.62, t) + Math.sin(t * 7) * 14 * s;
        const py = lerp(h * 0.97, h * 0.885, t) + (i % 2 ? 5 : -5) * s * (1 - t * 0.5);
        const k = (1 - t * 0.55) * s;
        g.fillStyle = "rgba(150,165,210,0.5)";
        g.beginPath(); g.ellipse(px, py, 3.2 * k, 2.4 * k, 0, 0, Math.PI * 2); g.fill();
        for (const [dx, dy] of [[-3.2, -3.4], [-1.1, -4.6], [1.1, -4.6], [3.2, -3.4]] as const) {
          g.beginPath(); g.ellipse(px + dx * k, py + dy * k * 0.8, 1.1 * k, 0.9 * k, 0, 0, Math.PI * 2); g.fill();
        }
      }
    }
    drift(h * 0.93, 8 * s, 2.2, "#f8f9fe", "#dfe6f6");
    // 手前の大きなもみの木（画面のはしで切れて、奥行きを出す）
    pine(-8 * s, h * 1.01, 170 * s, "#355f52", 0.95);
    pine(w + 14 * s, h * 0.99, 210 * s, "#2f5849", 0.95);

    // 雪のきらめきの場所
    sparkles = Array.from({ length: 40 }, () => {
      const x = r() * w;
      return { x, y: lerp(h * 0.8, h, r()), p: r() * 6 };
    });

    // ガラスの光（ドームのふちの反射と、うっすら丸い暗がり）
    const gl = context2d(glass.canvas, size);
    if (!gl) return;
    gl.clearRect(0, 0, w, h);
    const vig = gl.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.45, w / 2, h * 0.45, Math.hypot(w, h) * 0.62);
    vig.addColorStop(0, "rgba(40,50,90,0)");
    vig.addColorStop(1, "rgba(40,50,90,0.28)");
    gl.fillStyle = vig;
    gl.fillRect(0, 0, w, h);
    gl.lineCap = "round";
    const R = Math.max(w, h) * 0.62;
    const arc = (cx: number, cy: number, rr: number, a0: number, a1: number, width: number, alpha: number) => {
      const grad = gl.createLinearGradient(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr, cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      gl.strokeStyle = grad;
      gl.lineWidth = width;
      gl.beginPath(); gl.arc(cx, cy, rr, a0, a1); gl.stroke();
    };
    arc(w * 0.62, h * 0.48, R, Math.PI * 1.02, Math.PI * 1.3, 16 * s, 0.35);
    arc(w * 0.62, h * 0.48, R * 0.95, Math.PI * 1.08, Math.PI * 1.22, 4 * s, 0.5);
    arc(w * 0.4, h * 0.52, R * 0.98, Math.PI * 1.72, Math.PI * 1.9, 8 * s, 0.22);
    // 小さな光の点
    gl.fillStyle = "rgba(255,255,255,0.7)";
    gl.beginPath(); gl.ellipse(w * 0.15, h * 0.14, 7 * s, 3 * s, -0.7, 0, Math.PI * 2); gl.fill();
    gl.fillStyle = "rgba(255,255,255,0.45)";
    gl.beginPath(); gl.ellipse(w * 0.11, h * 0.19, 3 * s, 1.5 * s, -0.7, 0, Math.PI * 2); gl.fill();
  }

  /* ---------------------------------------------------------------- 雪 */
  const shake = (power: number) => {
    swirl = Math.min(1, swirl + power);
    for (const f of flakes) {
      const k = f.layer === 2 ? 0.6 : 1;
      f.vx += (rand() - 0.5) * 320 * scale * power * k;
      f.vy -= (120 + rand() * 300) * scale * power * k;
    }
  };

  const step = (size: CanvasSize, dt: number) => {
    clock += dt;
    swirl = Math.max(0, swirl - dt * 0.2);
    const tiltOn = clock - tilt.at < 3;
    const gx = tiltOn ? tilt.gx : Math.sin(clock * 0.13) * 0.12;
    const gy = tiltOn ? tilt.gy : 0;
    const k2 = swirl * swirl;
    for (const f of flakes) {
      const depth = f.layer === 0 ? 0.55 : f.layer === 1 ? 1 : 1.6;
      const fall = (14 + f.r * 3) * scale * depth * 0.5;
      // ふだん：ふわふわ横にゆれながら、かたむいた方へ
      const tx = Math.sin(clock * 0.7 + f.drift) * 10 * scale * depth + gx * 70 * scale * depth;
      const ty = fall * (1 + gy * 0.5);
      // うず：場所と時間で向きの変わる流れ（上向きに少しもちあげる）
      const sx = Math.sin(f.y * 0.009 + clock * 1.2) + Math.sin(f.y * 0.021 - clock * 0.8) * 0.6;
      const sy = Math.cos(f.x * 0.01 - clock * 1.05) + Math.cos(f.x * 0.025 + clock * 0.7) * 0.6;
      const ax = tx + sx * 230 * scale * k2 * depth;
      const ay = ty * (1 - k2) + sy * 190 * scale * k2 * depth - 50 * scale * k2;
      const ease = Math.min(1, dt * (f.layer === 2 ? 1.6 : 2.4));
      f.vx += (ax - f.vx) * ease;
      f.vy += (ay - f.vy) * ease;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.spin * dt;
      if (f.x < -30) f.x = size.w + 30;
      if (f.x > size.w + 30) f.x = -30;
      if (f.y < -80) f.y = -80;
      const floor = f.layer === 0 ? townY + 20 * scale : f.layer === 1 ? groundAt(f.x) : size.h + 30;
      if (f.y > floor) {
        if (swirl > 0.35) { f.y = floor - 2; f.vy = -Math.abs(f.vy) * 0.4; }
        else Object.assign(f, newFlake(size, false));
      }
    }
    // えんとつのけむり
    for (const c of chimneys) {
      c.t -= dt;
      if (c.t <= 0) {
        puffs.push({ x: c.x, y: c.y, r: 3 * scale, life: 1, vx: (4 + gx * 20) * scale });
        c.t = 0.5 + rand() * 0.5;
      }
    }
    for (const p of puffs) {
      p.life -= dt * 0.22;
      p.r += dt * 5 * scale;
      p.y -= dt * 12 * scale;
      p.x += p.vx * dt + Math.sin(clock + p.y * 0.05) * dt * 3;
    }
    puffs = puffs.filter((p) => p.life > 0);
  };

  const draw = (size: CanvasSize) => {
    if (dirty) { dirty = false; paintScene(scene.size); }
    const g = context2d(layer.canvas, size);
    if (!g) return;
    g.clearRect(0, 0, size.w, size.h);
    // けむり
    for (const p of puffs) {
      g.fillStyle = `rgba(235,236,248,${p.life * 0.45})`;
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
    }
    // 明かりのゆらぎ（窓・街灯）
    g.globalCompositeOperation = "lighter";
    for (const l of lights) {
      const flick = 0.75 + Math.sin(clock * 3 + l.p) * 0.08 + Math.sin(clock * 7.3 + l.p * 2) * 0.05;
      g.globalAlpha = flick * 0.7;
      g.drawImage(art.glow, l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    g.globalAlpha = 1;
    // 雪原のきらめき
    for (const sp of sparkles) {
      const a = Math.pow(Math.max(0, Math.sin(clock * 1.6 + sp.p)), 8);
      if (a < 0.05) continue;
      g.fillStyle = `rgba(255,255,255,${a})`;
      const L = 3 * scale * a;
      g.fillRect(sp.x - L, sp.y - 0.5, L * 2, 1);
      g.fillRect(sp.x - 0.5, sp.y - L, 1, L * 2);
    }
    g.globalCompositeOperation = "source-over";
    // 雪：遠い → 中 → 手前（大きくぼけた粒）
    g.fillStyle = "rgba(255,255,255,0.75)";
    for (const f of flakes) {
      if (f.layer !== 0) continue;
      g.beginPath(); g.arc(f.x, f.y, f.r, 0, Math.PI * 2); g.fill();
    }
    for (const f of flakes) {
      if (f.layer !== 1) continue;
      const d = f.r * 3.4;
      g.save();
      g.translate(f.x, f.y);
      g.rotate(f.rot);
      g.globalAlpha = 0.9;
      g.drawImage(art.crystal, -d / 2, -d / 2, d, d);
      g.restore();
    }
    for (const f of flakes) {
      if (f.layer !== 2) continue;
      const d = f.r * 2.4;
      g.globalAlpha = 0.5;
      g.drawImage(art.soft, f.x - d / 2, f.y - d / 2, d, d);
    }
    g.globalAlpha = 1;
  };

  const frame = (t: number, dt: number) => {
    const size = layer.size;
    if (still) {
      if (t === STILL_TIME) {
        shake(0.7);
        for (let i = 0; i < 50; i++) step(size, 1 / 30);
        draw(size);
      }
      return;
    }
    step(size, dt);
    draw(size);
  };

  const stopTilt = onTilt(mode, (gx, gy) => {
    tilt = { gx, gy, at: clock };
    // 急にかたむけたら、ふったことにする
    if (lastTilt) {
      const change = Math.hypot(gx - lastTilt.gx, gy - lastTilt.gy);
      if (change > 0.08) shake(Math.min(0.45, change * 0.7));
    }
    lastTilt = { gx, gy };
  });
  const stopTap = onBackgroundTap(host, mode, () => {
    if (!still) shake(0.75);
  });
  const stopDrag = onBackgroundDrag(host, mode, (x, y, start) => {
    if (still) return;
    if (start || !lastDrag) {
      lastDrag = { x, y, t: clock };
      return;
    }
    const dt = Math.max(1 / 60, clock - lastDrag.t);
    const vx = clamp((x - lastDrag.x) / dt, -1500, 1500), vy = clamp((y - lastDrag.y) / dt, -1500, 1500);
    // 指のまわりの雪を、指の動きの方へかきまぜる
    for (const f of flakes) {
      const d = Math.hypot(f.x - x, f.y - y);
      if (d > 110 * scale) continue;
      const k = 1 - d / (110 * scale);
      f.vx += vx * 0.45 * k;
      f.vy += vy * 0.45 * k;
    }
    swirl = Math.min(1, swirl + 0.025);
    lastDrag = { x, y, t: clock };
  });
  const stop = startLoop(host, frame, { still });

  return {
    update: () => {},
    destroy: () => {
      stop();
      stopTilt();
      stopTap();
      stopDrag();
      glass.destroy();
      layer.destroy();
      scene.destroy();
    },
  };
};
