/**
 * シャボン玉：虹色の膜（前もって描いた絵を回して使う）と、動かない光の反射を重ねて描く。
 * ふわふわ上がり、ゆらゆら形がゆれ、寿命がくるとパチンとはじける。ときどき、ふーっとまとめて飛んでくる。
 * タップすると、さわったシャボン玉がはじける（何もないところなら、小さなシャボン玉が生まれる）。
 */
import { addCanvas, clamp, context2d, makeSprite, onBackgroundTap, seededRandom, startLoop, STILL_TIME, type CanvasSize, type LiveMount } from "./engine";

type Bubble = {
  x: number;
  baseX: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  cruise: number;
  swayA: number;
  swayF: number;
  swayP: number;
  wob: number;
  spin: number;
  film: number;
  born: number;
  life: number;
  popAt: number;
};

const SPRITE = 220;
const R = SPRITE * 0.47;

/** 虹色の膜。ふちほど色が濃く、まんなかはほとんど透明 */
function makeFilm(hueShift: number) {
  return makeSprite(SPRITE, SPRITE, (g) => {
    const c = SPRITE / 2;
    const colors = ["255,120,205", "255,214,120", "140,240,205", "120,182,255", "205,140,255", "255,120,205"];
    // 円すい形のグラデーションが使えない古い端末では、ななめのグラデーションで代わりにする
    const conic = typeof (g as Partial<CanvasRenderingContext2D>).createConicGradient === "function";
    const paint = (cx: number, cy: number, alpha: number) => {
      const grad = conic ? g.createConicGradient(hueShift, cx, cy) : g.createLinearGradient(c - R, c - R, c + R, c + R);
      colors.forEach((col, i) => grad.addColorStop(i / (colors.length - 1), `rgba(${col},${alpha})`));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(c, c, R, 0, Math.PI * 2);
      g.fill();
    };
    paint(c, c, 1);
    // 中心をずらしてもう1枚重ねると、膜の色の帯がうねって見える
    paint(c + R * 0.28, c - R * 0.18, 0.55);
    g.globalCompositeOperation = "destination-in";
    const mask = g.createRadialGradient(c, c, 0, c, c, R);
    mask.addColorStop(0, "rgba(0,0,0,0.07)");
    mask.addColorStop(0.55, "rgba(0,0,0,0.14)");
    mask.addColorStop(0.84, "rgba(0,0,0,0.48)");
    mask.addColorStop(0.965, "rgba(0,0,0,0.8)");
    mask.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = mask;
    g.fillRect(0, 0, SPRITE, SPRITE);
    g.globalCompositeOperation = "source-over";
    g.lineWidth = 1.6;
    g.strokeStyle = "rgba(255,255,255,0.55)";
    g.beginPath();
    g.arc(c, c, R * 0.985, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 1;
    g.strokeStyle = "rgba(70,90,140,0.24)";
    g.beginPath();
    g.arc(c, c, R, 0, Math.PI * 2);
    g.stroke();
  });
}

/** 光の反射（左上の窓の映りこみと、右下の三日月）。回さずに貼る */
const makeShine = () =>
  makeSprite(SPRITE, SPRITE, (g) => {
    const c = SPRITE / 2;
    g.save();
    g.translate(c - R * 0.4, c - R * 0.44);
    g.rotate(-0.7);
    g.scale(1, 0.55);
    const hg = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.34);
    hg.addColorStop(0, "rgba(255,255,255,0.95)");
    hg.addColorStop(0.45, "rgba(255,255,255,0.55)");
    hg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = hg;
    g.beginPath();
    g.arc(0, 0, R * 0.34, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.beginPath();
    g.arc(c - R * 0.12, c - R * 0.62, R * 0.045, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.42)";
    g.lineWidth = R * 0.05;
    g.lineCap = "round";
    g.beginPath();
    g.arc(c, c, R * 0.8, 0.3, 1.15);
    g.stroke();
  });

/** シャボン玉の絵（何枚の見本を並べても、描くのは1回だけ） */
let cachedSprites: { films: HTMLCanvasElement[]; shine: HTMLCanvasElement } | null = null;
const bubbleSprites = () => (cachedSprites ??= { films: [makeFilm(0), makeFilm(2.1), makeFilm(4.2)], shine: makeShine() });

export const mount: LiveMount = (host, { mode, reducedMotion }) => {
  const still = mode === "still" || reducedMotion;
  const rand = seededRandom(still ? 3 : Date.now() & 0xffff);
  const { films, shine } = bubbleSprites();
  let bubbles: Bubble[] = [];
  let clock = 0;
  let nextBlow = 9;
  let scale = 1;

  const spawn = (size: CanvasSize, t: number, opts: { x?: number; y?: number; r?: number; vx?: number; vy?: number; anywhere?: boolean } = {}): Bubble => {
    const r = opts.r ?? (10 + 44 * Math.pow(rand(), 1.3)) * scale;
    const cruise = -(12 + 22 * (1 - r / (54 * scale)) + rand() * 8);
    const x = opts.x ?? rand() * size.w;
    return {
      x,
      baseX: x,
      y: opts.y ?? (opts.anywhere ? rand() * size.h : size.h + r + rand() * 40),
      r,
      vx: opts.vx ?? (rand() - 0.5) * 8,
      vy: opts.vy ?? cruise,
      cruise,
      swayA: 6 + rand() * 14,
      swayF: 0.4 + rand() * 0.6,
      swayP: rand() * Math.PI * 2,
      wob: rand() * Math.PI * 2,
      spin: (rand() - 0.5) * 0.5,
      film: Math.floor(rand() * films.length),
      born: t,
      life: 10 + rand() * 22,
      popAt: -1,
    };
  };

  const fill = (size: CanvasSize) => {
    scale = clamp(size.w / 390, 0.7, 1.4);
    const count = clamp(Math.round((size.w * size.h) / 24000), 6, 18);
    bubbles = Array.from({ length: count }, () => {
      const b = spawn(size, clock, { anywhere: true });
      b.born = clock - rand() * b.life * 0.7;
      return b;
    });
  };
  const layer = addCanvas(host, { onResize: fill });
  const ctx = context2d(layer.canvas, layer.size);

  const pop = (b: Bubble) => {
    if (b.popAt < 0) b.popAt = clock;
  };

  const stopTap = onBackgroundTap(host, mode, (x, y) => {
    const hit = bubbles.find((b) => b.popAt < 0 && Math.hypot(b.x - x, b.y - y) < b.r + 10);
    if (hit) {
      pop(hit);
      return;
    }
    if (bubbles.length < 28) {
      for (let i = 0; i < 2; i += 1) {
        bubbles.push(spawn(layer.size, clock, { x: x + (rand() - 0.5) * 20, y: y + (rand() - 0.5) * 10, r: (6 + rand() * 8) * scale, vy: -30 - rand() * 20 }));
      }
    }
  });

  const blow = (size: CanvasSize, t: number) => {
    // ふーっ：画面の下の角から、まとめて6〜8こ
    const fromLeft = rand() < 0.5;
    const n = 6 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i += 1) {
      bubbles.push(
        spawn(size, t, {
          x: fromLeft ? -10 - rand() * 30 : size.w + 10 + rand() * 30,
          y: size.h * (0.7 + rand() * 0.25),
          r: (8 + rand() * 22) * scale,
          vx: (fromLeft ? 1 : -1) * (50 + rand() * 70),
          vy: -(30 + rand() * 40),
        }),
      );
    }
  };

  const draw = (c: CanvasRenderingContext2D, b: Bubble, t: number) => {
    if (b.popAt >= 0) {
      const p = (t - b.popAt) / 0.32;
      if (p >= 1) return;
      c.strokeStyle = `rgba(255,255,255,${0.6 * (1 - p)})`;
      c.lineWidth = 1.4;
      c.beginPath();
      c.arc(b.x, b.y, b.r * (1 + 0.35 * p), 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = `rgba(255,255,255,${0.85 * (1 - p)})`;
      for (let k = 0; k < 8; k += 1) {
        const a = (k / 8) * Math.PI * 2 + b.wob;
        const d = b.r * (0.95 + 0.9 * p);
        c.beginPath();
        c.arc(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, 1.7 * (1 - p) + 0.4, 0, Math.PI * 2);
        c.fill();
      }
      return;
    }
    const age = t - b.born;
    const appear = clamp(age / 0.6, 0, 1);
    const wobble = 0.045 * Math.sin(t * 2.6 + b.wob);
    const size = (b.r / R) * SPRITE * (0.6 + 0.4 * appear);
    c.save();
    c.translate(b.x, b.y);
    c.scale(1 + wobble, 1 - wobble);
    c.rotate(b.wob + t * b.spin);
    c.globalAlpha = appear;
    c.drawImage(films[b.film]!, -size / 2, -size / 2, size, size);
    c.rotate(-(b.wob + t * b.spin));
    c.drawImage(shine, -size / 2, -size / 2, size, size);
    c.restore();
    c.globalAlpha = 1;
  };

  const frame = (t: number, dt: number) => {
    clock = t;
    if (!ctx) return;
    const size = layer.size;
    if (!still && t >= nextBlow) {
      blow(size, t);
      nextBlow = t + 16 + rand() * 12;
    }
    for (const b of bubbles) {
      if (b.popAt >= 0 || dt === 0) continue;
      b.vx += (0 - b.vx) * Math.min(1, dt * 0.7);
      b.vy += (b.cruise - b.vy) * Math.min(1, dt * 0.5);
      b.baseX += b.vx * dt;
      b.y += b.vy * dt;
      b.x = b.baseX + Math.sin((t - b.born) * b.swayF + b.swayP) * b.swayA;
      if (t - b.born > b.life) pop(b);
    }
    // はじけ終わったもの・上へ抜けたものは、下から新しく
    const target = clamp(Math.round((size.w * size.h) / 24000), 6, 18);
    bubbles = bubbles.filter((b) => !(b.popAt >= 0 && t - b.popAt > 0.32) && b.y > -b.r - 20);
    while (bubbles.length < target) bubbles.push(spawn(size, t));

    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    const order = [...bubbles].sort((a, b) => a.r - b.r);
    for (const b of order) draw(ctx, b, t);
  };

  if (still) {
    // 見本：はじける瞬間を1つ入れておく
    const b = bubbles[1];
    if (b) b.popAt = STILL_TIME - 0.12;
  }

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
