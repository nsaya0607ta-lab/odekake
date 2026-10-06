/**
 * わんこパレード：いろいろな服のフレブルたちが、画面の下をとことこ歩いていく。
 * 歩く絵と小走りの絵を交互に出して足を動かし、うしろに小さな足あとが残って消えていく。
 * ときどき立ち止まってにおいをかいだり、ふり返ったりする。画面をタップすると、いちばん近い子がジャンプする。
 * アプリの背景では、下のナビ（約80px）にかくれないよう、その少し上を歩く。
 */
import { addCanvas, clamp, context2d, onBackgroundTap, seededRandom, startLoop, STILL_TIME, type CanvasSize, type LiveMount } from "./engine";

const SKINS = ["default", "summer", "hiking", "snow", "aichi", "gifu", "mie", "shizuoka", "nagano", "fukui"] as const;
const POSES = ["walk", "trot", "cheer", "sniff", "wave"] as const;
type Pose = (typeof POSES)[number];

/** 画像（300×254・足もとは上から240）。左向きなので、そのまま左へ歩かせる */
const IMG_W = 300, IMG_H = 254, FOOT = 240;

const images = new Map<string, HTMLImageElement>();
function dogImage(skin: string, pose: Pose): HTMLImageElement {
  const key = `${skin}/${pose}`;
  let img = images.get(key);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.src = `/characters/${skin}/${pose}.webp`;
    images.set(key, img);
  }
  return img;
}

type Dog = {
  skin: string; x: number; speed: number; size: number; ph: number;
  stopT: number; stopPose: Pose; nextStop: number;
  jumpY: number; jumpV: number; printT: number;
};
type Print = { x: number; y: number; t: number; side: number };

export const mount: LiveMount = (host, { mode, reducedMotion }) => {
  const still = mode === "still" || reducedMotion;
  const rand = seededRandom(still ? 4 : Date.now() & 0xffff);
  let dogs: Dog[] = [];
  let prints: Print[] = [];
  let scale = 1;
  let clock = 0;
  let next = 3;

  const groundY = (size: CanvasSize) => size.h - (mode === "full" ? 92 : 16);

  const newDog = (size: CanvasSize, x?: number): Dog => {
    const size0 = (52 + rand() * 18) * scale;
    return {
      skin: SKINS[Math.floor(rand() * SKINS.length)]!,
      x: x ?? size.w + size0, speed: (26 + rand() * 18) * scale, size: size0, ph: rand() * 6,
      stopT: 0, stopPose: "sniff", nextStop: 4 + rand() * 8, jumpY: 0, jumpV: 0, printT: 0,
    };
  };

  const fill = (size: CanvasSize) => {
    scale = clamp(size.w / 390, 0.8, 1.3);
    const n = clamp(Math.round(size.w / 100), 3, 6);
    dogs = Array.from({ length: n }, (_, i) => newDog(size, (size.w / n) * (i + 0.5) + (rand() - 0.5) * 40));
    for (const d of dogs) for (const p of POSES) dogImage(d.skin, p);
  };
  const layer = addCanvas(host, { onResize: fill });
  const ctx = context2d(layer.canvas, layer.size);

  const step = (size: CanvasSize, dt: number) => {
    clock += dt;
    const gy = groundY(size);
    next -= dt;
    if (next <= 0 && dogs.length < 7) { const d = newDog(size); dogs.push(d); for (const p of POSES) dogImage(d.skin, p); next = 3 + rand() * 5; }
    for (const d of dogs) {
      if (d.jumpV !== 0 || d.jumpY < 0) {
        d.jumpV += 1500 * dt; d.jumpY += d.jumpV * dt;
        if (d.jumpY >= 0) { d.jumpY = 0; d.jumpV = 0; }
      }
      if (d.stopT > 0) { d.stopT -= dt; continue; }
      d.nextStop -= dt;
      if (d.nextStop <= 0) { d.stopT = 1.4 + rand() * 1.4; d.stopPose = rand() < 0.6 ? "sniff" : "wave"; d.nextStop = 6 + rand() * 9; continue; }
      d.x -= d.speed * dt;
      d.ph += dt * d.speed / (9 * scale);
      d.printT -= dt;
      if (d.printT <= 0 && d.jumpY === 0) { d.printT = 0.42; prints.push({ x: d.x + d.size * 0.15, y: gy + 2, t: clock, side: prints.length % 2 }); }
    }
    dogs = dogs.filter((d) => d.x > -d.size * 1.5);
    prints = prints.filter((p) => clock - p.t < 4);
  };

  const drawPrint = (p: Print) => {
    if (!ctx) return;
    const a = (1 - (clock - p.t) / 4) * 0.35;
    const r = 2.2 * scale;
    ctx.fillStyle = `rgba(120,90,70,${a})`;
    const y = p.y + (p.side ? -3 : 3) * scale;
    ctx.beginPath(); ctx.ellipse(p.x, y, r * 1.3, r, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(p.x - r * 1.6, y + i * r * 0.9, r * 0.45, 0, Math.PI * 2); ctx.fill(); }
  };

  const draw = (size: CanvasSize) => {
    if (!ctx) return;
    ctx.clearRect(0, 0, size.w, size.h);
    const gy = groundY(size);
    for (const p of prints) drawPrint(p);
    for (const d of dogs) {
      const pose: Pose = d.jumpY < -1 ? "cheer" : d.stopT > 0 ? d.stopPose : Math.floor(d.ph) % 2 ? "trot" : "walk";
      const img = dogImage(d.skin, pose);
      const w = d.size * 1.18, h = (w * IMG_H) / IMG_W;
      const bob = d.stopT > 0 || d.jumpY < 0 ? 0 : -Math.abs(Math.sin(d.ph * Math.PI)) * 2 * scale;
      // 足もとの影（跳ぶと小さく薄く）
      const k = 1 + d.jumpY / 120;
      ctx.fillStyle = `rgba(80,60,40,${0.16 * clamp(k, 0.3, 1)})`;
      ctx.beginPath(); ctx.ellipse(d.x, gy + 1, w * 0.32 * clamp(k, 0.5, 1), 3.5 * scale, 0, 0, Math.PI * 2); ctx.fill();
      if (img.complete && img.naturalWidth) ctx.drawImage(img, d.x - w / 2, gy - (h * FOOT) / IMG_H + d.jumpY + bob, w, h);
    }
  };

  const frame = (t: number, dt: number) => {
    const size = layer.size;
    if (still) {
      if (t === STILL_TIME) {
        // 見本は画像が読みこめてから描く
        const paint = () => { for (let i = 0; i < 40; i++) step(size, 1 / 30); draw(size); };
        const pending = dogs.map((d) => dogImage(d.skin, "walk")).filter((img) => !img.complete);
        if (pending.length) Promise.all(pending.map((img) => img.decode().catch(() => undefined))).then(paint);
        else paint();
      }
      return;
    }
    step(size, dt);
    draw(size);
  };

  const stopTap = onBackgroundTap(host, mode, (x) => {
    if (still || !dogs.length) return;
    const near = dogs.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a));
    if (near.jumpY === 0) { near.jumpV = -480; near.jumpY = -0.1; near.stopT = 0; }
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
