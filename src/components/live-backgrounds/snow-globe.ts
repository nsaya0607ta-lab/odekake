/**
 * スノードーム：雪の町を閉じこめたスノードーム。ふだんは雪がしんしんと降り、
 * スマホをかたむけたり画面をなぞったりすると、雪がうずを巻いて舞い上がり、ゆっくり降りつもる。タップでひとふり。
 * 町（丘・家・木・雪だるまわんこ）とガラスの光は、大きさが変わったときに1回だけ描く。
 */
import { addCanvas, clamp, context2d, onBackgroundDrag, onBackgroundTap, onTilt, seededRandom, startLoop, STILL_TIME, type CanvasSize, type LiveMount } from "./engine";

type Flake = { x: number; y: number; vx: number; vy: number; r: number; drift: number };

export const mount: LiveMount = (host, { mode, reducedMotion }) => {
  const still = mode === "still" || reducedMotion;
  const rand = seededRandom(still ? 14 : Date.now() & 0xffff);
  let scale = 1;
  let flakes: Flake[] = [];
  let dirty = true;
  /** うずの強さ（0〜1）。ふると上がって、少しずつおさまる */
  let swirl = 0;
  let tilt: { gx: number; gy: number } = { gx: 0, gy: 0 };
  let lastTilt: { gx: number; gy: number } | null = null;
  let lastDrag: { x: number; y: number; t: number } | null = null;
  let clock = 0;
  let groundY = (x: number) => x;

  const scene = addCanvas(host, {
    onResize: (size) => {
      scale = clamp(size.w / 390, 0.8, 1.4);
      const base = size.h * 0.8;
      groundY = (x: number) => base + Math.sin(x * 0.012) * 12 * scale + Math.sin(x * 0.031 + 1) * 6 * scale;
      flakes = Array.from({ length: Math.round(240 * clamp((size.w * size.h) / (390 * 844), 0.5, 1.6)) }, () => ({
        x: rand() * size.w, y: rand() * size.h * 0.8, vx: 0, vy: 0, r: (0.8 + rand() * 2.2) * scale, drift: rand() * 6,
      }));
      dirty = true;
    },
  });
  const layer = addCanvas(host);
  const glass = addCanvas(host);

  function paintScene(size: CanvasSize) {
    const g = context2d(scene.canvas, size);
    if (!g) return;
    const r = seededRandom(9);
    const { w, h } = size;
    g.clearRect(0, 0, w, h);
    // 遠くの丘
    g.fillStyle = "#dfe8f4";
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w + 8; x += 8) g.lineTo(x, h * 0.72 - Math.sin(x * 0.008 + 2) * 26 * scale - 10 * scale);
    g.lineTo(w, h);
    g.fill();
    // もみの木
    const tree = (x: number, y: number, s: number) => {
      g.fillStyle = "#6f5a48";
      g.fillRect(x - 2 * s, y - 6 * s, 4 * s, 7 * s);
      for (let k = 0; k < 3; k++) {
        const ty = y - 6 * s - k * 11 * s, tw = (16 - k * 4) * s;
        g.fillStyle = "#4e8a6e";
        g.beginPath(); g.moveTo(x - tw, ty); g.lineTo(x, ty - 16 * s); g.lineTo(x + tw, ty); g.closePath(); g.fill();
        g.fillStyle = "#ffffff";
        g.beginPath(); g.moveTo(x - tw * 0.55, ty - 7 * s); g.lineTo(x, ty - 16 * s); g.lineTo(x + tw * 0.55, ty - 7 * s); g.quadraticCurveTo(x, ty - 10 * s, x - tw * 0.55, ty - 7 * s); g.fill();
      }
    };
    // 家（窓に明かり）
    const house = (x: number, y: number, s: number, roof: string) => {
      g.fillStyle = "#f3e6d4";
      g.fillRect(x, y - 22 * s, 30 * s, 22 * s);
      g.fillStyle = roof;
      g.beginPath(); g.moveTo(x - 5 * s, y - 21 * s); g.lineTo(x + 15 * s, y - 38 * s); g.lineTo(x + 35 * s, y - 21 * s); g.closePath(); g.fill();
      g.fillStyle = "#ffffff";
      g.beginPath(); g.moveTo(x - 5 * s, y - 21 * s); g.lineTo(x + 15 * s, y - 38 * s); g.lineTo(x + 35 * s, y - 21 * s); g.lineTo(x + 30 * s, y - 24 * s); g.lineTo(x + 15 * s, y - 33 * s); g.lineTo(x, y - 24 * s); g.closePath(); g.fill();
      const lit = g.createRadialGradient(x + 9 * s, y - 12 * s, 0, x + 9 * s, y - 12 * s, 16 * s);
      lit.addColorStop(0, "rgba(255,210,120,0.55)");
      lit.addColorStop(1, "rgba(255,210,120,0)");
      g.fillStyle = lit;
      g.beginPath(); g.arc(x + 9 * s, y - 12 * s, 16 * s, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#ffd27a";
      g.fillRect(x + 5 * s, y - 16 * s, 8 * s, 7 * s);
      g.fillStyle = "#8a6a52";
      g.fillRect(x + 18 * s, y - 13 * s, 7 * s, 13 * s);
      g.fillStyle = "#ffffff";
      g.fillRect(x + 24 * s, y - 44 * s, 5 * s, 3 * s);
      g.fillStyle = "#9a7f6a";
      g.fillRect(x + 24 * s, y - 41 * s, 5 * s, 10 * s);
    };
    const s = scale * 1.5;
    tree(w * 0.08, groundY(w * 0.08) + 2 * s, s * 1.1);
    house(w * 0.16, groundY(w * 0.2) + 4 * s, s, "#c9655a");
    tree(w * 0.42, groundY(w * 0.42) + 2 * s, s * 0.8);
    house(w * 0.58, groundY(w * 0.62) + 4 * s, s * 0.9, "#4f7fb0");
    tree(w * 0.88, groundY(w * 0.88) + 2 * s, s * 1.3);
    tree(w * 0.79, groundY(w * 0.79) + 4 * s, s * 0.9);
    // 雪だるまわんこ
    const sx = w * 0.4, sy = groundY(w * 0.4) + 6 * s;
    g.fillStyle = "#ffffff";
    g.strokeStyle = "rgba(150,170,200,0.6)";
    g.lineWidth = 1;
    g.beginPath(); g.arc(sx, sy - 12 * s, 14 * s, 0, Math.PI * 2); g.fill(); g.stroke();
    for (const side of [-1, 1]) {
      g.beginPath(); g.moveTo(sx + side * 4 * s, sy - 36 * s); g.lineTo(sx + side * 12 * s, sy - 48 * s); g.lineTo(sx + side * 13 * s, sy - 32 * s); g.closePath(); g.fill(); g.stroke();
    }
    g.beginPath(); g.arc(sx, sy - 33 * s, 11 * s, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = "#3b3632";
    g.beginPath(); g.arc(sx - 4 * s, sy - 35 * s, 1.5 * s, 0, Math.PI * 2); g.arc(sx + 4 * s, sy - 35 * s, 1.5 * s, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(sx, sy - 30 * s, 2.4 * s, 1.7 * s, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#d9534f";
    g.fillRect(sx - 11 * s, sy - 25 * s, 22 * s, 4 * s);
    g.fillRect(sx + 4 * s, sy - 23 * s, 4 * s, 9 * s);
    // 手前の雪の地面
    const ground = g.createLinearGradient(0, h * 0.78, 0, h);
    ground.addColorStop(0, "#ffffff");
    ground.addColorStop(1, "#e5edf8");
    g.fillStyle = ground;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w + 4; x += 4) g.lineTo(x, groundY(x));
    g.lineTo(w, h);
    g.fill();
    g.fillStyle = "rgba(160,180,215,0.25)";
    for (let i = 0; i < 18; i++) {
      const x = r() * w, y = groundY(x) + 10 * s + r() * (h - groundY(x));
      g.beginPath(); g.ellipse(x, y, (14 + r() * 26) * s, 2.4 * s, 0, 0, Math.PI * 2); g.fill();
    }
    // ガラスの光（ドームのふちの反射）
    const gl = context2d(glass.canvas, size);
    if (!gl) return;
    gl.clearRect(0, 0, w, h);
    const edge = gl.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h * 0.45, Math.max(w, h) * 0.75);
    edge.addColorStop(0, "rgba(255,255,255,0)");
    edge.addColorStop(1, "rgba(220,235,255,0.45)");
    gl.fillStyle = edge;
    gl.fillRect(0, 0, w, h);
    gl.strokeStyle = "rgba(255,255,255,0.55)";
    gl.lineCap = "round";
    gl.lineWidth = 7 * s;
    gl.beginPath(); gl.arc(w * 0.62, h * 0.42, Math.min(w, h) * 0.9, Math.PI * 1.06, Math.PI * 1.22); gl.stroke();
    gl.lineWidth = 3 * s;
    gl.strokeStyle = "rgba(255,255,255,0.4)";
    gl.beginPath(); gl.arc(w * 0.62, h * 0.42, Math.min(w, h) * 0.86, Math.PI * 1.25, Math.PI * 1.3); gl.stroke();
    gl.lineWidth = 4 * s;
    gl.beginPath(); gl.arc(w * 0.4, h * 0.5, Math.min(w, h) * 0.85, Math.PI * 1.85, Math.PI * 1.95); gl.stroke();
  }

  const respawn = (f: Flake, size: CanvasSize) => {
    f.x = rand() * size.w;
    f.y = -10 - rand() * 40;
    f.vx = 0;
    f.vy = 0;
  };

  const shake = (power: number) => {
    swirl = Math.min(1, swirl + power);
    for (const f of flakes) {
      f.vx += (rand() - 0.5) * 300 * scale * power;
      f.vy -= rand() * 360 * scale * power;
    }
  };

  const step = (size: CanvasSize, dt: number) => {
    clock += dt;
    swirl = Math.max(0, swirl - dt * 0.22);
    const fall = 26 * scale;
    for (const f of flakes) {
      // 雪は軽いので、かたむいた方へゆっくり流れる
      const tx = Math.sin(clock * 0.6 + f.drift) * 8 * scale + tilt.gx * 40 * scale;
      const ty = fall * (0.6 + f.r / (3 * scale)) * (1 + tilt.gy * 0.4);
      // うず（場所と時間で向きの変わる流れ）
      const sx = Math.sin(f.y * 0.011 + clock * 1.3) + Math.sin(f.y * 0.023 - clock * 0.7) * 0.5;
      const sy = Math.cos(f.x * 0.012 - clock * 1.1) + Math.cos(f.x * 0.027 + clock * 0.9) * 0.5;
      const k = swirl * swirl;
      const ax = tx + sx * 220 * scale * k;
      const ay = ty * (1 - k) + sy * 200 * scale * k - 60 * scale * k;
      f.vx += (ax - f.vx) * Math.min(1, dt * 2.2);
      f.vy += (ay - f.vy) * Math.min(1, dt * 2.2);
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.x < -10) f.x = size.w + 10;
      if (f.x > size.w + 10) f.x = -10;
      if (f.y < -60) f.y = -60;
      if (f.y > groundY(f.x)) {
        if (swirl > 0.3) { f.y = groundY(f.x) - 2; f.vy = -Math.abs(f.vy) * 0.5; }
        else respawn(f, size);
      }
    }
  };

  const draw = (size: CanvasSize) => {
    const g = context2d(layer.canvas, size);
    if (!g) return;
    g.clearRect(0, 0, size.w, size.h);
    g.fillStyle = "#ffffff";
    for (const f of flakes) {
      g.globalAlpha = 0.55 + (f.r / (3 * scale)) * 0.45;
      g.beginPath(); g.arc(f.x, f.y, f.r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  };

  const frame = (t: number, dt: number) => {
    const size = layer.size;
    if (dirty) {
      dirty = false;
      paintScene(scene.size);
    }
    if (still) {
      if (t === STILL_TIME) {
        shake(0.9);
        for (let i = 0; i < 40; i++) step(size, 1 / 30);
        draw(size);
      }
      return;
    }
    step(size, dt);
    draw(size);
  };

  const stopTilt = onTilt(mode, (gx, gy) => {
    tilt = { gx, gy };
    // 急にかたむけたら、ふったことにする
    if (lastTilt) {
      const change = Math.hypot(gx - lastTilt.gx, gy - lastTilt.gy);
      if (change > 0.06) shake(Math.min(0.5, change * 0.8));
    }
    lastTilt = { gx, gy };
  });
  const stopTap = onBackgroundTap(host, mode, () => {
    if (!still) shake(0.8);
  });
  const stopDrag = onBackgroundDrag(host, mode, (x, y, start) => {
    if (still) return;
    if (start || !lastDrag) {
      lastDrag = { x, y, t: clock };
      return;
    }
    const dt = Math.max(1 / 60, clock - lastDrag.t);
    const vx = (x - lastDrag.x) / dt, vy = (y - lastDrag.y) / dt;
    // 指のまわりの雪を、指の動きの方へかきまぜる
    for (const f of flakes) {
      const d = Math.hypot(f.x - x, f.y - y);
      if (d > 90 * scale) continue;
      const k = 1 - d / (90 * scale);
      f.vx += vx * 0.5 * k;
      f.vy += vy * 0.5 * k;
    }
    swirl = Math.min(1, swirl + 0.03);
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
