/**
 * 花火大会：夜空に花火が上がって開く。菊・牡丹・しだれ柳・輪・小花の5種類を、色を変えてまぜる。
 * ときどき、まとめて上がる「スターマイン」。画面をタップすると、その場所へ1発上がる。
 * 光は足し算（lighter）で重ね、前の絵を少しずつ消して残像を残す（下地の夜空と町は CSS）。
 */
import { addCanvas, clamp, context2d, onBackgroundTap, seededRandom, startLoop, STILL_TIME, type CanvasSize, type LiveMount } from "./engine";

type Kind = "kiku" | "botan" | "yanagi" | "ring" | "senrin";

type Rocket = { x: number; y: number; vx: number; vy: number; tx: number; ty: number; kind: Kind; hue: number; trail: { x: number; y: number }[] };
type Spark = {
  x: number; y: number; vx: number; vy: number; life: number; max: number;
  hue: number; sat: number; light: number; size: number; drag: number; grav: number;
  glitter: boolean; px: number; py: number;
};

const PALETTES: readonly (readonly [number, number])[] = [
  [350, 6], [28, 14], [48, 4], [140, 12], [195, 8], [265, 10], [320, 8], [8, 42],
];

export const mount: LiveMount = (host, { mode, reducedMotion }) => {
  const still = mode === "still" || reducedMotion;
  const rand = seededRandom(still ? 11 : Date.now() & 0xffff);
  let rockets: Rocket[] = [];
  let sparks: Spark[] = [];
  let next = 0.6;
  let finaleAt = 26 + rand() * 20;
  let finaleLeft = 0;
  let scale = 1;

  const layer = addCanvas(host, { maxDpr: 1.5, onResize: (s) => { scale = clamp(s.w / 390, 0.75, 1.5); } });
  const ctx = context2d(layer.canvas, layer.size);

  const pickKind = (): Kind => {
    const r = rand();
    return r < 0.32 ? "kiku" : r < 0.55 ? "botan" : r < 0.72 ? "yanagi" : r < 0.86 ? "ring" : "senrin";
  };

  const launch = (size: CanvasSize, tx?: number, ty?: number) => {
    const x0 = tx !== undefined ? clamp(tx + (rand() - 0.5) * 30, 20, size.w - 20) : size.w * (0.15 + rand() * 0.7);
    const targetY = ty ?? size.h * (0.14 + rand() * 0.3);
    const [hue] = PALETTES[Math.floor(rand() * PALETTES.length)]!;
    rockets.push({
      x: x0, y: size.h + 10, vx: (rand() - 0.5) * 18, vy: -(size.h - targetY) * 1.25 - 120,
      tx: x0, ty: targetY, kind: pickKind(), hue, trail: [],
    });
  };

  const burst = (r: Rocket) => {
    const [hue, spread] = PALETTES.find((p) => p[0] === r.hue) ?? PALETTES[0]!;
    const big = (0.9 + rand() * 0.35) * scale;
    const add = (n: number, speed: number, opts: Partial<Spark> & { ringTilt?: number } = {}) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand() * 0.05;
        const v = speed * (opts.ringTilt !== undefined ? 1 : 0.55 + Math.sqrt(rand()) * 0.45);
        const vx = Math.cos(a) * v;
        // 輪は、たてにつぶして斜めから見た輪にする
        const vy = Math.sin(a) * v * (opts.ringTilt ?? 1);
        sparks.push({
          x: r.x, y: r.y, vx, vy, px: r.x, py: r.y,
          life: 0, max: opts.max ?? 1.6 + rand() * 0.6,
          hue: (opts.hue ?? hue) + (rand() - 0.5) * spread, sat: opts.sat ?? 95, light: opts.light ?? 64,
          size: (opts.size ?? 1.8) * scale, drag: opts.drag ?? 1.6, grav: opts.grav ?? 70,
          glitter: opts.glitter ?? false,
        });
      }
    };
    switch (r.kind) {
      case "kiku": add(90, 210 * big, { glitter: rand() < 0.4 }); break;
      case "botan": add(70, 180 * big, { size: 2.6, max: 1.3 }); add(40, 90 * big, { hue: (hue + 40) % 360, size: 2 }); break;
      case "yanagi": add(70, 170 * big, { hue: 42, sat: 90, light: 62, max: 3.2, drag: 1.1, grav: 95, glitter: true, size: 1.6 }); break;
      case "ring": add(56, 190 * big, { ringTilt: 0.45 + rand() * 0.5, size: 2.2 }); add(16, 50 * big, { hue: 48, light: 80 }); break;
      case "senrin":
        for (let k = 0; k < 6; k++) {
          const ox = (rand() - 0.5) * 120 * scale, oy = (rand() - 0.5) * 90 * scale;
          const at = { ...r, x: r.x + ox, y: r.y + oy };
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2;
            const v = 60 * big;
            sparks.push({ x: at.x, y: at.y, px: at.x, py: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: -k * 0.08, max: 0.9, hue: (hue + k * 50) % 360, sat: 90, light: 68, size: 1.8 * scale, drag: 1.8, grav: 40, glitter: false });
          }
        }
        break;
    }
    // 開いた瞬間の光
    sparks.push({ x: r.x, y: r.y, px: r.x, py: r.y, vx: 0, vy: 0, life: 0, max: 0.25, hue, sat: 30, light: 92, size: 26 * scale, drag: 0, grav: 0, glitter: false });
  };

  const step = (size: CanvasSize, dt: number, t: number) => {
    // 打ち上げの間かく（スターマインのあいだは、たてつづけ）
    next -= dt;
    if (t > finaleAt && finaleLeft === 0) { finaleLeft = 9; finaleAt = t + 40 + rand() * 30; }
    if (next <= 0) {
      launch(size);
      if (finaleLeft > 0) { finaleLeft--; next = 0.18 + rand() * 0.25; }
      else next = 1.1 + rand() * 1.6;
    }
    for (const r of rockets) {
      r.trail.push({ x: r.x, y: r.y });
      if (r.trail.length > 10) r.trail.shift();
      r.vy += 160 * dt;
      r.x += r.vx * dt; r.y += r.vy * dt;
    }
    rockets = rockets.filter((r) => {
      if (r.y <= r.ty || r.vy >= -30) { burst(r); return false; }
      return true;
    });
    for (const s of sparks) {
      s.life += dt;
      if (s.life < 0) continue;
      s.px = s.x; s.py = s.y;
      const k = Math.exp(-s.drag * dt);
      s.vx *= k; s.vy = s.vy * k + s.grav * dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
    }
    sparks = sparks.filter((s) => s.life < s.max);
    if (sparks.length > 1600) sparks.splice(0, sparks.length - 1600);
  };

  const draw = (size: CanvasSize, fade: number) => {
    if (!ctx) return;
    // 前の絵をうすく消して、光の尾を残す
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = `rgba(0,0,0,${fade})`;
    ctx.fillRect(0, 0, size.w, size.h);
    ctx.globalCompositeOperation = "lighter";
    for (const r of rockets) {
      ctx.lineCap = "round";
      for (let i = 1; i < r.trail.length; i++) {
        const a = r.trail[i - 1]!, b = r.trail[i]!;
        ctx.strokeStyle = `hsla(40, 90%, 70%, ${(i / r.trail.length) * 0.7})`;
        ctx.lineWidth = 2 * scale * (i / r.trail.length);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    for (const s of sparks) {
      if (s.life < 0) continue;
      const k = 1 - s.life / s.max;
      let a = k * k;
      if (s.glitter && k < 0.6) a *= rand() < 0.5 ? 1.4 : 0.15; // ちかちか
      if (s.size > 10) {
        // 開いた瞬間のまるい光
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size);
        g.addColorStop(0, `hsla(${s.hue}, ${s.sat}%, ${s.light}%, ${0.55 * k})`);
        g.addColorStop(1, `hsla(${s.hue}, ${s.sat}%, ${s.light}%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      ctx.strokeStyle = `hsla(${s.hue}, ${s.sat}%, ${Math.min(96, s.light + (1 - k) * -10 + 8)}%, ${clamp(a, 0, 1)})`;
      ctx.lineWidth = s.size * (0.5 + k * 0.6);
      ctx.beginPath(); ctx.moveTo(s.px, s.py); ctx.lineTo(s.x + 0.01, s.y); ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  };

  // 一覧の見本：いくつか開いたところを、尾をつけて1枚に描く
  const renderStill = (size: CanvasSize) => {
    rockets = []; sparks = [];
    const spots: [number, number, Kind, number][] = [[0.3, 0.22, "kiku", 350], [0.7, 0.18, "yanagi", 48], [0.52, 0.36, "botan", 195], [0.2, 0.44, "ring", 265], [0.82, 0.4, "senrin", 140]];
    for (const [x, y, kind, hue] of spots) burst({ x: size.w * x, y: size.h * y, vx: 0, vy: 0, tx: 0, ty: 0, kind, hue, trail: [] });
    for (let i = 0; i < 30; i++) { step(size, 1 / 60, 0); draw(size, 0.12); }
  };

  const frame = (t: number, dt: number) => {
    const size = layer.size;
    if (still) {
      if (t === STILL_TIME) renderStill(size);
      return;
    }
    step(size, dt, t);
    draw(size, clamp(dt * 6, 0.08, 0.3));
  };

  const stopTap = onBackgroundTap(host, mode, (x, y) => {
    if (still) return;
    launch(layer.size, x, clamp(y, layer.size.h * 0.1, layer.size.h * 0.6));
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
