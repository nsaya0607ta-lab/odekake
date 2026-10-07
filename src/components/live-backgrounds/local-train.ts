/**
 * ローカル線：山と田んぼのあいだを、わんこたちを乗せた2両の電車が走る。
 *
 * - 空は開いている時刻（日本時間）で、朝・昼・夕方・夜に変わる。夜は窓に明かりがともり、前照灯の光がのびる
 * - 景色（空・山・林・田んぼ・線路・電柱と架線）は、大きさか時間帯が変わったときだけ描く
 *   木・家・雲はスプラッシュと同じ水彩の絵（public/splash）を使う
 * - 毎回描くのは、雲・鳥・田んぼの水面のきらめき・電車だけ
 * - 画面をタップすると電車がすぐ来る。走っているときは汽笛が鳴って（ふきだし）、窓のわんこが跳ねる
 */
import { skyTimeOf, type SkyTime } from "@/lib/app-backgrounds";
import { addCanvas, clamp, context2d, lerp, onBackgroundTap, seededRandom, startLoop, STILL_TIME, type CanvasSize, type LiveMount } from "./engine";

type Train = { x: number; speed: number; jump: number; toot: number; dogs: number[] };
type Bird = { x: number; y: number; v: number; flap: number; s: number };
type Cloud = { x: number; y: number; s: number; v: number; img: number };
type Palette = {
  sky: [string, string, string];
  sun: { x: number; y: number; color: string; r: number; moon?: boolean };
  far: [string, string];
  mid: [string, string];
  forest: [string, string, string];
  paddyTop: string;
  paddyBottom: string;
  water: string;
  bank: [string, string];
  haze: string;
  shade: number;
  night: boolean;
};

const DOG_FUR: readonly [string, string][] = [
  ["#f3ede3", "#3b3632"], ["#3b3632", "#f3ede3"], ["#d9b48a", "#3b3632"], ["#f3ede3", "#3b3632"], ["#8c8079", "#f3ede3"], ["#e8d3b8", "#3b3632"],
];

const PALETTES: Record<SkyTime, Palette> = {
  morning: {
    sky: ["#8fbfe8", "#cfe4f3", "#fde7cf"], sun: { x: 0.18, y: 0.2, color: "255,236,200", r: 34 },
    far: ["#9bb6cc", "#c9d8e2"], mid: ["#7da486", "#a9c4a6"], forest: ["#5f8a5d", "#7aa66f", "#a3c78f"],
    paddyTop: "#b7d69a", paddyBottom: "#a2c97e", water: "#dbe9f2", bank: ["#9cbf6f", "#7c9c56"], haze: "253,240,225", shade: 0, night: false,
  },
  day: {
    sky: ["#6fa8e0", "#a9d2f0", "#e6f3f8"], sun: { x: 0.82, y: 0.12, color: "255,250,225", r: 30 },
    far: ["#8fb0cb", "#c4d7e4"], mid: ["#6f9d75", "#9fc29b"], forest: ["#4f7f4f", "#6e9e62", "#96c07f"],
    paddyTop: "#b5d98f", paddyBottom: "#9cc970", water: "#cfe6f5", bank: ["#9bc26a", "#79a052"], haze: "232,243,248", shade: 0, night: false,
  },
  evening: {
    sky: ["#55689f", "#e59b7c", "#fbd6a0"], sun: { x: 0.72, y: 0.36, color: "255,200,140", r: 44 },
    far: ["#7f7398", "#c59aa0"], mid: ["#6b6f78", "#a18a86"], forest: ["#4a5a4c", "#62735c", "#8a8f6c"],
    paddyTop: "#c8b67e", paddyBottom: "#a9a066", water: "#f4c39b", bank: ["#8d8f5a", "#6c6f45"], haze: "251,206,160", shade: 0.12, night: false,
  },
  night: {
    sky: ["#0b1330", "#1d2a58", "#3a4677"], sun: { x: 0.8, y: 0.14, color: "255,246,214", r: 20, moon: true },
    far: ["#1e2748", "#2c3762"], mid: ["#18243a", "#22324a"], forest: ["#132033", "#1a2a3e", "#24374c"],
    paddyTop: "#22334a", paddyBottom: "#1b2a3d", water: "#33456e", bank: ["#1d2c38", "#16222c"], haze: "60,72,120", shade: 0.55, night: true,
  },
};

/** 1次元のなめらかなノイズ（山の稜線） */
function ridgeNoise(seed: number) {
  const r = seededRandom(seed);
  const pts = Array.from({ length: 64 }, () => r());
  const at = (x: number) => {
    const i = Math.floor(x), f = x - i;
    const a = pts[((i % 64) + 64) % 64]!, b = pts[(((i + 1) % 64) + 64) % 64]!;
    const t = f * f * (3 - 2 * f);
    return a + (b - a) * t;
  };
  return (x: number) => at(x) * 0.55 + at(x * 2.1 + 7) * 0.28 + at(x * 4.3 + 13) * 0.12 + at(x * 9.7 + 3) * 0.05;
}

const SPRITES = ["/splash/cloud-1.webp", "/splash/cloud-2.webp", "/splash/cloud-3.webp", "/splash/tree-a.webp", "/splash/tree-b.webp", "/splash/house.webp"] as const;
let cachedImages: HTMLImageElement[] | null = null;
function loadImages(onReady: () => void): HTMLImageElement[] {
  if (!cachedImages) {
    cachedImages = SPRITES.map((src) => {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
      return img;
    });
  }
  for (const img of cachedImages) if (!img.complete) img.addEventListener("load", onReady, { once: true });
  return cachedImages;
}
const ready = (img: HTMLImageElement | undefined) => Boolean(img && img.complete && img.naturalWidth > 0);

export const mount: LiveMount = (host, { mode, reducedMotion, signals }) => {
  const still = mode === "still" || reducedMotion;
  const rand = seededRandom(still ? 4 : Date.now() & 0xffff);
  let scale = 1;
  let horizon = 0;
  let trackY = 0;
  let wireY = 0;
  // 時間帯はアプリから受けとる（ショップの見本では「夜のとき」などを選べる）。届かなければ自分で時計を見る
  let forced: SkyTime | undefined = signals.skyTime;
  let time: SkyTime = forced ?? skyTimeOf(new Date());
  let pal = PALETTES[time];
  let train: Train | null = null;
  let wait = 2.5;
  let clouds: Cloud[] = [];
  let birds: Bird[] = [];
  let birdWait = 5;
  let clock = 0;
  let sceneDirty = true;
  let glints: { x: number; y: number; w: number; p: number }[] = [];
  let stars: { x: number; y: number; r: number; p: number }[] = [];

  const images = loadImages(() => {
    sceneDirty = true;
    if (still) frame(STILL_TIME, 0);
  });

  const scene = addCanvas(host, {
    onResize: (size) => {
      scale = clamp(size.w / 390, 0.8, 1.4);
      trackY = size.h - Math.max(112, size.h * 0.14);
      horizon = Math.max(size.h * 0.4, trackY - 300 * scale);
      wireY = trackY - 84 * scale;
      // 雲は空の中だけ（山にかからない高さ）
      clouds = Array.from({ length: 5 }, (_, i) => {
        const cs = (0.5 + rand() * 0.55) * scale;
        return { x: rand() * size.w, y: Math.max(4, (horizon - 150 * cs) * (0.05 + (i / 5) * 0.75)), s: cs, v: (3 + rand() * 4) * scale, img: i % 3 };
      });
      const r = seededRandom(5);
      glints = Array.from({ length: 26 }, () => ({ x: r() * size.w, y: lerp(horizon + 40 * scale, trackY - 10 * scale, r()), w: (6 + r() * 18) * scale, p: r() * 6 }));
      stars = Array.from({ length: 90 }, () => ({ x: r() * size.w, y: r() * horizon * 0.85, r: 0.4 + r() * 1.1, p: r() * 6 }));
      sceneDirty = true;
    },
  });
  const layer = addCanvas(host);

  /* ---------------------------------------------------------------- 景色 */
  function paintScene(size: CanvasSize) {
    const g = context2d(scene.canvas, size);
    if (!g) return;
    const { w, h } = size;
    const s = scale;
    const r = seededRandom(17);
    g.clearRect(0, 0, w, h);

    // 空
    const sky = g.createLinearGradient(0, 0, 0, horizon + 20 * s);
    sky.addColorStop(0, pal.sky[0]);
    sky.addColorStop(0.55, pal.sky[1]);
    sky.addColorStop(1, pal.sky[2]);
    g.fillStyle = sky;
    g.fillRect(0, 0, w, horizon + 40 * s);
    // お日さま・お月さま
    const sx = w * pal.sun.x, sy = horizon * pal.sun.y + (time === "evening" ? horizon * 0.25 : 0);
    const halo = g.createRadialGradient(sx, sy, 0, sx, sy, pal.sun.r * s * 7);
    halo.addColorStop(0, `rgba(${pal.sun.color},0.55)`);
    halo.addColorStop(0.25, `rgba(${pal.sun.color},0.18)`);
    halo.addColorStop(1, `rgba(${pal.sun.color},0)`);
    g.fillStyle = halo;
    g.fillRect(0, 0, w, horizon + 40 * s);
    g.fillStyle = `rgba(${pal.sun.color},${pal.sun.moon ? 1 : 0.95})`;
    g.beginPath(); g.arc(sx, sy, pal.sun.r * s, 0, Math.PI * 2); g.fill();
    if (pal.sun.moon) {
      g.fillStyle = "rgba(200,190,160,0.35)";
      g.beginPath(); g.arc(sx - 5 * s, sy + 3 * s, 4 * s, 0, Math.PI * 2); g.arc(sx + 6 * s, sy - 5 * s, 2.6 * s, 0, Math.PI * 2); g.fill();
    }

    // 山（遠い山ほど、空の色にかすむ）
    const mountain = (seed: number, base: number, amp: number, freq: number, top: string, bottom: string, rim: number) => {
      const n = ridgeNoise(seed);
      const pts: [number, number][] = [];
      for (let x = -10; x <= w + 10; x += 4) pts.push([x, base - amp * n(x * freq)]);
      const grad = g.createLinearGradient(0, base - amp, 0, base + 30 * s);
      grad.addColorStop(0, top);
      grad.addColorStop(1, bottom);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(-10, trackY);
      for (const [x, y] of pts) g.lineTo(x, y);
      g.lineTo(w + 10, trackY);
      g.closePath();
      g.fill();
      // 稜線の光
      if (rim > 0) {
        g.strokeStyle = `rgba(255,255,255,${rim})`;
        g.lineWidth = 1.2;
        g.beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo(x, y + 1) : g.moveTo(x, y + 1)));
        g.stroke();
      }
      // 山肌の陰（谷すじ）
      g.strokeStyle = `rgba(40,60,80,${pal.night ? 0.12 : 0.07})`;
      g.lineWidth = 1;
      for (let i = 0; i < pts.length; i += 9) {
        const [x, y] = pts[i]!;
        g.beginPath(); g.moveTo(x, y + 4); g.quadraticCurveTo(x + 6 * s, y + 20 * s, x + 2 * s, y + 40 * s); g.stroke();
      }
    };
    mountain(3, horizon - 6 * s, 190 * s, 0.005, pal.far[0], pal.far[1], pal.night ? 0.05 : 0.35);
    // もや
    const haze = g.createLinearGradient(0, horizon - 70 * s, 0, horizon + 10 * s);
    haze.addColorStop(0, `rgba(${pal.haze},0)`);
    haze.addColorStop(1, `rgba(${pal.haze},0.55)`);
    g.fillStyle = haze;
    g.fillRect(0, horizon - 70 * s, w, 80 * s);
    mountain(9, horizon + 8 * s, 110 * s, 0.009, pal.mid[0], pal.mid[1], pal.night ? 0.03 : 0.25);

    // 林（もこもこした木のかたまりを、奥から手前へ）
    const forestBase = horizon + 20 * s;
    for (let row = 0; row < 3; row++) {
      const y0 = forestBase + row * 6 * s;
      for (let x = -20; x < w + 20; x += (7 + row * 2) * s) {
        const rad = (7 + r() * 7 + row * 2) * s;
        const yy = y0 - Math.sin(x * 0.03 + row) * 4 * s - r() * 4 * s;
        g.fillStyle = pal.forest[row]!;
        g.beginPath(); g.arc(x, yy, rad, 0, Math.PI * 2); g.fill();
        if (!pal.night) {
          g.fillStyle = "rgba(255,255,240,0.12)";
          g.beginPath(); g.arc(x - rad * 0.3, yy - rad * 0.35, rad * 0.5, 0, Math.PI * 2); g.fill();
        }
      }
    }

    // 水を張った田んぼ（空がうつる）と、苗の列
    const paddyTop = forestBase + 14 * s;
    const ground = g.createLinearGradient(0, paddyTop, 0, trackY);
    ground.addColorStop(0, pal.paddyTop);
    ground.addColorStop(1, pal.paddyBottom);
    g.fillStyle = ground;
    g.fillRect(0, paddyTop, w, trackY - paddyTop + 4 * s);
    // 奥ほど うすく せまい区画。区画ごとに、空のうつった水面と苗の列
    const rows = 6;
    for (let i = 0; i < rows; i++) {
      const t0 = i / rows, t1 = (i + 1) / rows;
      const y0 = lerp(paddyTop, trackY, t0 * t0 * 0.9 + t0 * 0.1), y1 = lerp(paddyTop, trackY, t1 * t1 * 0.9 + t1 * 0.1);
      const k = 0.35 + t1 * 1.1;
      const levee = 2.4 * s * k;
      const water = g.createLinearGradient(0, y0, 0, y1);
      water.addColorStop(0, pal.water);
      water.addColorStop(1, pal.sky[2]);
      g.globalAlpha = 0.62;
      g.fillStyle = water;
      g.fillRect(0, y0 + levee, w, y1 - y0 - levee);
      g.globalAlpha = 1;
      // 水面にうつる空の明るい帯
      g.fillStyle = pal.night ? "rgba(140,160,220,0.12)" : "rgba(255,255,255,0.18)";
      g.fillRect(0, y0 + levee + (y1 - y0) * 0.25, w, Math.max(1, (y1 - y0) * 0.12));
      // 苗：まっすぐな小さな株を、列にそろえて
      const gapX = 9 * s * k, gapY = 5 * s * k;
      g.strokeStyle = pal.night ? "rgba(70,110,90,0.4)" : `rgba(${88 - i * 4},${150 - i * 3},${70},${0.4 + t1 * 0.2})`;
      g.lineWidth = Math.max(0.7, 1 * k);
      g.lineCap = "round";
      let rowN = 0;
      for (let yy = y0 + levee + gapY * 0.8; yy < y1 - gapY * 0.3; yy += gapY, rowN++) {
        const off = (rowN % 2) * gapX * 0.5;
        for (let x = off - gapX; x < w + gapX; x += gapX) {
          const hgt = 2.6 * s * Math.min(k, 1.1);
          g.beginPath();
          g.moveTo(x, yy);
          g.lineTo(x - hgt * 0.25, yy - hgt);
          g.moveTo(x, yy);
          g.lineTo(x + hgt * 0.25, yy - hgt * 0.9);
          g.stroke();
        }
      }
      // あぜ（草の生えた土手）
      g.fillStyle = pal.night ? "#1f2d2a" : "#8fb565";
      g.fillRect(0, y0, w, levee);
      g.fillStyle = pal.night ? "rgba(255,255,255,0.04)" : "rgba(255,255,230,0.35)";
      g.fillRect(0, y0, w, Math.max(0.6, levee * 0.3));
    }
    // 田んぼの中の道（手前から奥の家へ）
    g.fillStyle = pal.night ? "rgba(70,70,80,0.55)" : "rgba(214,196,150,0.9)";
    g.beginPath();
    g.moveTo(w * 0.2 - 3 * s, paddyTop + 12 * s);
    g.lineTo(w * 0.2 + 3 * s, paddyTop + 12 * s);
    g.lineTo(w * 0.42 + 20 * s, trackY);
    g.lineTo(w * 0.42 - 10 * s, trackY);
    g.closePath();
    g.fill();

    // 木と家（水彩の絵）
    const tree = images[3], tree2 = images[4], house = images[5];
    const putImg = (img: HTMLImageElement | undefined, x: number, baseY: number, height: number) => {
      if (!ready(img)) return;
      const ww = (img!.naturalWidth / img!.naturalHeight) * height;
      g.save();
      if (pal.shade > 0) g.filter = `brightness(${1 - pal.shade * 0.8}) saturate(${1 - pal.shade * 0.5})`;
      g.drawImage(img!, x - ww / 2, baseY - height, ww, height);
      g.restore();
    };
    putImg(house, w * 0.2, paddyTop + 16 * s, 34 * s);
    putImg(tree, w * 0.31, paddyTop + 14 * s, 46 * s);
    putImg(tree2, w * 0.09, paddyTop + 12 * s, 40 * s);
    putImg(tree, w * 0.86, paddyTop + 20 * s, 60 * s);
    putImg(tree2, w * 0.94, paddyTop + 18 * s, 52 * s);
    if (pal.night && ready(house)) {
      // 夜は家の窓に明かり
      const hx = w * 0.2, hy = paddyTop + 16 * s - 14 * s;
      const glow = g.createRadialGradient(hx, hy, 0, hx, hy, 18 * s);
      glow.addColorStop(0, "rgba(255,210,120,0.6)");
      glow.addColorStop(1, "rgba(255,210,120,0)");
      g.fillStyle = glow;
      g.beginPath(); g.arc(hx, hy, 18 * s, 0, Math.PI * 2); g.fill();
    }

    // 土手
    const bank = g.createLinearGradient(0, trackY - 4 * s, 0, h);
    bank.addColorStop(0, pal.bank[0]);
    bank.addColorStop(1, pal.bank[1]);
    g.fillStyle = bank;
    g.beginPath();
    g.moveTo(0, trackY + 2 * s);
    g.lineTo(w, trackY + 2 * s);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.closePath();
    g.fill();
    // バラスト（小石）
    const ballastTop = trackY + 2 * s, ballastBottom = trackY + 16 * s;
    const bal = g.createLinearGradient(0, ballastTop, 0, ballastBottom);
    bal.addColorStop(0, pal.night ? "#4a4d58" : "#b9b0a2");
    bal.addColorStop(1, pal.night ? "#2d303a" : "#8f877b");
    g.fillStyle = bal;
    g.beginPath();
    g.moveTo(0, ballastTop);
    g.lineTo(w, ballastTop);
    g.lineTo(w, ballastBottom);
    g.lineTo(0, ballastBottom);
    g.fill();
    for (let i = 0; i < w * 1.6; i++) {
      const x = r() * w, y = lerp(ballastTop, ballastBottom, r());
      g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.18)" : "rgba(40,30,20,0.18)";
      g.fillRect(x, y, 1.4, 1.1);
    }
    // まくら木とレール
    for (let x = 0; x < w + 10; x += 11 * s) {
      g.fillStyle = pal.night ? "#3a2f28" : "#6d5644";
      g.fillRect(x, trackY + 3 * s, 7 * s, 6 * s);
      g.fillStyle = "rgba(255,255,255,0.12)";
      g.fillRect(x, trackY + 3 * s, 7 * s, 1.2 * s);
    }
    for (const ry of [trackY + 2.4 * s, trackY + 7.6 * s]) {
      g.fillStyle = pal.night ? "#5b6070" : "#7b7f8a";
      g.fillRect(0, ry, w, 2 * s);
      g.fillStyle = pal.night ? "rgba(180,190,220,0.45)" : "rgba(255,255,255,0.7)";
      g.fillRect(0, ry, w, 0.7 * s);
    }

    // 電柱と架線（電車が走る線）
    const poles: number[] = [];
    for (let x = 30 * s; x < w + 180 * s; x += 170 * s) poles.push(x);
    for (const x of poles) {
      const pole = g.createLinearGradient(x - 2 * s, 0, x + 2 * s, 0);
      pole.addColorStop(0, pal.night ? "#3a3f4c" : "#9a9488");
      pole.addColorStop(1, pal.night ? "#272b35" : "#6e695f");
      g.fillStyle = pole;
      g.fillRect(x - 2 * s, wireY - 26 * s, 4 * s, trackY - wireY + 26 * s);
      // うで金と碍子
      g.fillStyle = pal.night ? "#2f3440" : "#77716a";
      g.fillRect(x - 2 * s, wireY - 4 * s, 26 * s, 2.4 * s);
      g.fillRect(x - 10 * s, wireY - 22 * s, 20 * s, 2 * s);
      g.fillStyle = pal.night ? "#6a7186" : "#e8e4da";
      for (const dx of [-8, 8]) g.fillRect(x + dx * s - 1.5 * s, wireY - 26 * s, 3 * s, 4 * s);
    }
    g.lineWidth = 1;
    for (let i = 0; i < poles.length - 1; i++) {
      const a = poles[i]!, b = poles[i + 1]!;
      // 架線（ぴんと張る）と、上の電線（たるむ）
      g.strokeStyle = pal.night ? "rgba(150,160,190,0.45)" : "rgba(60,60,70,0.55)";
      g.beginPath(); g.moveTo(a + 20 * s, wireY - 3 * s); g.lineTo(b + 20 * s, wireY - 3 * s); g.stroke();
      g.strokeStyle = pal.night ? "rgba(150,160,190,0.3)" : "rgba(60,60,70,0.35)";
      for (const dx of [-8, 8]) {
        g.beginPath(); g.moveTo(a + dx * s, wireY - 24 * s); g.quadraticCurveTo((a + b) / 2, wireY - 12 * s, b + dx * s, wireY - 24 * s); g.stroke();
      }
    }

    // 手前の草と花
    for (let x = 0; x < w; x += 3) {
      const y = trackY + 18 * s + r() * (h - trackY - 18 * s);
      const len = (5 + r() * 10) * s;
      g.strokeStyle = pal.night ? `rgba(40,70,60,${0.5 + r() * 0.3})` : `rgba(${80 + r() * 30},${130 + r() * 30},${60 + r() * 20},0.75)`;
      g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 4, y - len * 0.6, x + (r() - 0.5) * 6, y - len); g.stroke();
    }
    if (!pal.night) {
      for (let i = 0; i < 22; i++) {
        const x = r() * w, y = trackY + 24 * s + r() * (h - trackY - 24 * s);
        g.fillStyle = ["#fff6e8", "#ffd9e2", "#fff0a8"][i % 3]!;
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          g.beginPath(); g.arc(x + Math.cos(a) * 1.8 * s, y + Math.sin(a) * 1.8 * s, 1.4 * s, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = "#f0b84a";
        g.beginPath(); g.arc(x, y, 1 * s, 0, Math.PI * 2); g.fill();
      }
    }
  }

  /* ---------------------------------------------------------------- 電車 */
  const newTrain = (): Train => ({ x: -340 * scale, speed: (62 + rand() * 14) * scale, jump: 0, toot: 0, dogs: Array.from({ length: 8 }, () => Math.floor(rand() * DOG_FUR.length)) });

  const drawDog = (g: CanvasRenderingContext2D, x: number, y: number, s: number, fur: readonly [string, string], hop: number, tilt: number) => {
    g.save();
    g.translate(x, y - hop);
    g.rotate(tilt);
    g.fillStyle = fur[0];
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(side * 2.6 * s, -5.5 * s);
      g.quadraticCurveTo(side * 8.5 * s, -14 * s, side * 7.6 * s, -3 * s);
      g.closePath();
      g.fill();
    }
    g.beginPath(); g.ellipse(0, 0, 7.4 * s, 6.6 * s, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = fur[1];
    g.beginPath(); g.arc(-2.7 * s, -0.8 * s, 1.05 * s, 0, Math.PI * 2); g.arc(2.7 * s, -0.8 * s, 1.05 * s, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(0, 1.9 * s, 1.6 * s, 1.05 * s, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,140,150,0.45)";
    g.beginPath(); g.ellipse(-4.6 * s, 2 * s, 1.4 * s, 0.9 * s, 0, 0, Math.PI * 2); g.ellipse(4.6 * s, 2 * s, 1.4 * s, 0.9 * s, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  };

  const roundRect = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) => {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
  };

  /** 1両ぶん。front は先頭車（右が前） */
  const drawCar = (g: CanvasRenderingContext2D, tr: Train, x: number, base: number, front: boolean, carIndex: number) => {
    const s = scale;
    const L = 150 * s, H = 44 * s;
    const top = base - H - 9 * s;
    const night = pal.night;
    const bob = Math.sin(clock * 5.2 + carIndex * 1.7) * 0.35 * s;
    const y = top + bob;

    // 台車と車輪
    for (const bx of [x + 26 * s, x + L - 26 * s]) {
      g.fillStyle = night ? "#20232b" : "#3c3f47";
      roundRect(g, bx - 17 * s, base - 11 * s, 34 * s, 7 * s, 2 * s);
      g.fill();
      for (const wx of [bx - 10 * s, bx + 10 * s]) {
        g.fillStyle = night ? "#1a1c22" : "#2e3036";
        g.beginPath(); g.arc(wx, base - 3 * s, 5.2 * s, 0, Math.PI * 2); g.fill();
        g.strokeStyle = night ? "rgba(150,160,190,0.4)" : "rgba(200,200,210,0.7)";
        g.lineWidth = 0.9;
        g.beginPath(); g.arc(wx, base - 3 * s, 3.6 * s, 0, Math.PI * 2); g.stroke();
        const a = (tr.x / (5.2 * s)) % (Math.PI * 2);
        g.beginPath();
        for (let k = 0; k < 3; k++) {
          const aa = a + (k * Math.PI * 2) / 3;
          g.moveTo(wx, base - 3 * s);
          g.lineTo(wx + Math.cos(aa) * 3.6 * s, base - 3 * s + Math.sin(aa) * 3.6 * s);
        }
        g.stroke();
      }
    }
    // 床下の機器
    g.fillStyle = night ? "#22252d" : "#4a4d55";
    g.fillRect(x + 48 * s, y + H, L - 96 * s, 6 * s);
    g.fillStyle = night ? "#2a2e38" : "#5b5f68";
    g.fillRect(x + 56 * s, y + H + 1 * s, 20 * s, 4 * s);
    g.fillRect(x + 84 * s, y + H + 1 * s, 14 * s, 4 * s);

    // 車体（上が明るく、下が少し暗い）
    const body = g.createLinearGradient(0, y, 0, y + H);
    body.addColorStop(0, night ? "#c9c3b4" : "#fbf8ef");
    body.addColorStop(0.6, night ? "#b4ae9f" : "#efe8d8");
    body.addColorStop(1, night ? "#9a9486" : "#d9d1bf");
    g.fillStyle = body;
    const noseR = front ? 18 * s : 6 * s;
    roundRect(g, x, y, L, H, [7 * s, noseR, 3 * s, 3 * s]);
    g.fill();
    // 屋根
    const roof = g.createLinearGradient(0, y - 6 * s, 0, y + 2 * s);
    roof.addColorStop(0, night ? "#7a7f8c" : "#c6c9cf");
    roof.addColorStop(1, night ? "#4f5360" : "#8f939c");
    g.fillStyle = roof;
    roundRect(g, x + 5 * s, y - 5 * s, L - (front ? 18 : 10) * s, 7 * s, [5 * s, 5 * s, 0, 0]);
    g.fill();
    // 屋根の冷房装置
    g.fillStyle = night ? "#5a5f6b" : "#b0b4bb";
    roundRect(g, x + L * 0.42, y - 10 * s, 30 * s, 6 * s, 2 * s);
    g.fill();
    g.fillStyle = night ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.5)";
    g.fillRect(x + L * 0.42 + 2 * s, y - 9.4 * s, 26 * s, 1 * s);

    // 帯（緑と黄色）
    g.save();
    roundRect(g, x, y, L, H, [7 * s, noseR, 3 * s, 3 * s]);
    g.clip();
    g.fillStyle = night ? "#2f6447" : "#3f8a5c";
    g.fillRect(x, y + H - 15 * s, L, 7 * s);
    g.fillStyle = night ? "#a68a3c" : "#e8bf4f";
    g.fillRect(x, y + H - 8 * s, L, 1.8 * s);
    g.fillStyle = night ? "#2f6447" : "#3f8a5c";
    g.fillRect(x, y + 3 * s, L, 1.6 * s);
    // 車体のつや
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.fillRect(x, y + 1 * s, L, 2 * s);
    g.restore();

    // 窓とドア
    const winY = y + 9 * s, winH = 15 * s;
    // 窓 → ドア → 窓・窓 → ドア → （運転台／窓）の順に、重ならないよう並べる
    const doors = [x + 30 * s, x + 102 * s];
    const windows = [x + 6 * s, x + 54 * s, x + 78 * s];
    let dogIndex = carIndex * 4;
    const glass = (wx: number, wy: number, ww: number, wh: number, withDog: boolean) => {
      g.save();
      roundRect(g, wx, wy, ww, wh, 2.5 * s);
      g.clip();
      if (night) {
        const lit = g.createLinearGradient(0, wy, 0, wy + wh);
        lit.addColorStop(0, "#fff1c8");
        lit.addColorStop(1, "#f3cf86");
        g.fillStyle = lit;
      } else {
        const sky = g.createLinearGradient(wx, wy, wx + ww, wy + wh);
        sky.addColorStop(0, "#2d4258");
        sky.addColorStop(1, "#5d7f9c");
        g.fillStyle = sky;
      }
      g.fillRect(wx, wy, ww, wh);
      if (withDog) {
        const fur = DOG_FUR[tr.dogs[dogIndex % tr.dogs.length]!]!;
        const jumping = tr.jump > 0 ? Math.sin(Math.min(1, tr.jump) * Math.PI) * 7 * s * (1 + (dogIndex % 2) * 0.4) : 0;
        const idle = Math.max(0, Math.sin(clock * 2.2 + dogIndex * 1.3)) * 1.2 * s;
        drawDog(g, wx + ww / 2, wy + wh - 1 * s, s, night ? fur : fur, jumping + idle, Math.sin(clock * 1.3 + dogIndex) * 0.08);
        dogIndex++;
      }
      // ガラスの映りこみ（斜めの光）
      g.fillStyle = night ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.22)";
      g.beginPath();
      const sh = ((tr.x * 0.15 + wx) % (ww * 3)) - ww;
      g.moveTo(wx + sh, wy + wh);
      g.lineTo(wx + sh + 6 * s, wy + wh);
      g.lineTo(wx + sh + 14 * s, wy);
      g.lineTo(wx + sh + 8 * s, wy);
      g.fill();
      g.restore();
      g.strokeStyle = night ? "rgba(60,50,40,0.6)" : "rgba(80,80,90,0.55)";
      g.lineWidth = 0.9;
      roundRect(g, wx, wy, ww, wh, 2.5 * s);
      g.stroke();
    };
    for (const wx of windows) glass(wx, winY, 20 * s, winH, true);
    if (!front) glass(x + 126 * s, winY, 18 * s, winH, true);
    // ドア（縦長・小窓つき）
    for (const dx of doors) {
      g.strokeStyle = night ? "rgba(70,60,50,0.55)" : "rgba(120,110,95,0.6)";
      g.lineWidth = 1;
      roundRect(g, dx, y + 6 * s, 18 * s, H - 8 * s, 1.5 * s);
      g.stroke();
      g.beginPath(); g.moveTo(dx + 9 * s, y + 6 * s); g.lineTo(dx + 9 * s, y + H - 2 * s); g.stroke();
      glass(dx + 2 * s, winY - 1 * s, 5.5 * s, winH - 2 * s, false);
      glass(dx + 10.5 * s, winY - 1 * s, 5.5 * s, winH - 2 * s, false);
    }

    if (front) {
      // 運転台の窓・行き先表示・前照灯
      const fx = x + L - 20 * s;
      g.save();
      roundRect(g, fx, winY - 2 * s, 14 * s, winH + 3 * s, [2 * s, 9 * s, 2 * s, 2 * s]);
      g.clip();
      const wind = g.createLinearGradient(fx, winY, fx + 14 * s, winY + winH);
      wind.addColorStop(0, night ? "#1d2a3e" : "#35506a");
      wind.addColorStop(1, night ? "#33445e" : "#7fa1bc");
      g.fillStyle = wind;
      g.fillRect(fx, winY - 2 * s, 14 * s, winH + 3 * s);
      g.fillStyle = "rgba(255,255,255,0.25)";
      g.fillRect(fx + 3 * s, winY - 2 * s, 2 * s, winH + 3 * s);
      g.restore();
      // 行き先（おでかけ）
      g.fillStyle = "#1c1d22";
      roundRect(g, x + L - 52 * s, y - 0.5 * s, 28 * s, 6.5 * s, 1.2 * s);
      g.fill();
      g.fillStyle = "#ffb347";
      g.font = `bold ${4.6 * s}px sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("おでかけ", x + L - 38 * s, y + 2.8 * s);
      // 前照灯
      const ly = y + H - 20 * s;
      if (night) {
        g.save();
        g.globalCompositeOperation = "lighter";
        const beam = g.createLinearGradient(x + L, 0, x + L + 220 * s, 0);
        beam.addColorStop(0, "rgba(255,240,190,0.35)");
        beam.addColorStop(1, "rgba(255,240,190,0)");
        g.fillStyle = beam;
        g.beginPath();
        g.moveTo(x + L - 2 * s, ly - 3 * s);
        g.lineTo(x + L + 220 * s, ly - 34 * s);
        g.lineTo(x + L + 220 * s, ly + 40 * s);
        g.lineTo(x + L - 2 * s, ly + 3 * s);
        g.closePath();
        g.fill();
        g.restore();
      }
      const lamp = g.createRadialGradient(x + L - 3 * s, ly, 0, x + L - 3 * s, ly, (night ? 22 : 12) * s);
      lamp.addColorStop(0, "rgba(255,248,210,0.95)");
      lamp.addColorStop(1, "rgba(255,248,210,0)");
      g.fillStyle = lamp;
      g.beginPath(); g.arc(x + L - 3 * s, ly, (night ? 22 : 12) * s, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#fffbe6";
      g.beginPath(); g.arc(x + L - 3.5 * s, ly, 2.2 * s, 0, Math.PI * 2); g.fill();
      // 尾灯ふうの小さな赤
      g.fillStyle = "#d84a3a";
      g.beginPath(); g.arc(x + L - 4.5 * s, ly + 7 * s, 1.2 * s, 0, Math.PI * 2); g.fill();
      // パンタグラフ（架線にふれる）
      const px = x + L * 0.62;
      g.strokeStyle = night ? "#8a90a0" : "#5c606a";
      g.lineWidth = 1.3 * s;
      g.beginPath();
      g.moveTo(px - 12 * s, y - 5 * s);
      g.lineTo(px, (y - 5 * s + wireY) / 2);
      g.lineTo(px - 6 * s, wireY - 2 * s);
      g.moveTo(px + 12 * s, y - 5 * s);
      g.lineTo(px, (y - 5 * s + wireY) / 2);
      g.stroke();
      g.lineWidth = 2 * s;
      g.beginPath(); g.moveTo(px - 16 * s, wireY - 2 * s); g.lineTo(px + 4 * s, wireY - 2 * s); g.stroke();
      // 架線とこすれる小さな光（夜だけ）
      if (night && Math.sin(clock * 23) > 0.85) {
        g.fillStyle = "rgba(190,220,255,0.9)";
        g.beginPath(); g.arc(px - 6 * s, wireY - 3 * s, 1.6 * s, 0, Math.PI * 2); g.fill();
      }
    }
  };

  const drawTrain = (g: CanvasRenderingContext2D, tr: Train) => {
    const s = scale;
    const base = trackY + 1 * s;
    const L = 150 * s, gap = 7 * s;
    // 地面のかげ
    g.fillStyle = "rgba(20,25,20,0.22)";
    g.beginPath();
    g.ellipse(tr.x - L / 2 - gap / 2, trackY + 11 * s, L + 20 * s, 4 * s, 0, 0, Math.PI * 2);
    g.fill();
    // ほろ（車両のつなぎ目）
    g.fillStyle = pal.night ? "#2b2e36" : "#55585f";
    g.fillRect(tr.x - L - gap - 1, base - 50 * s, gap + 2, 34 * s);
    drawCar(g, tr, tr.x - 2 * L - gap, base, false, 1);
    drawCar(g, tr, tr.x - L, base, true, 0);
    // 汽笛のふきだし
    if (tr.toot > 0) {
      const k = tr.toot;
      g.globalAlpha = Math.min(1, k * 2);
      const bx = tr.x + 18 * s, by = base - 82 * s - (1 - k) * 12 * s;
      g.fillStyle = "rgba(255,255,255,0.92)";
      roundRect(g, bx - 26 * s, by - 11 * s, 52 * s, 22 * s, 11 * s);
      g.fill();
      g.beginPath(); g.moveTo(bx - 10 * s, by + 10 * s); g.lineTo(bx - 18 * s, by + 18 * s); g.lineTo(bx - 2 * s, by + 10 * s); g.fill();
      g.fillStyle = "#3b3632";
      g.font = `bold ${10 * s}px sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("ぽぉー♪", bx, by + 0.5 * s);
      g.globalAlpha = 1;
    }
  };

  /* ---------------------------------------------------------------- 動き */
  const step = (size: CanvasSize, dt: number) => {
    clock += dt;
    for (const c of clouds) { c.x += c.v * dt; if (c.x > size.w + 30) c.x = -280 * c.s; }
    if (train) {
      train.x += train.speed * dt;
      if (train.jump > 0) { train.jump += dt * 1.5; if (train.jump > 1) train.jump = 0; }
      if (train.toot > 0) train.toot = Math.max(0, train.toot - dt * 0.6);
      if (train.x - 320 * scale > size.w) { train = null; wait = 9 + rand() * 7; }
    } else {
      wait -= dt;
      if (wait <= 0) train = newTrain();
    }
    if (!pal.night) {
      birdWait -= dt;
      if (birdWait <= 0) {
        const y = horizon * (0.25 + rand() * 0.4);
        const n = 3 + Math.floor(rand() * 4);
        for (let i = 0; i < n; i++) birds.push({ x: -20 - i * 14 * scale, y: y + Math.abs(i - n / 2) * 6 * scale, v: (30 + rand() * 6) * scale, flap: rand() * 6, s: (0.8 + rand() * 0.4) * scale });
        birdWait = 14 + rand() * 14;
      }
    }
    for (const b of birds) { b.x += b.v * dt; b.flap += dt * 8; }
    birds = birds.filter((b) => b.x < size.w + 30);
  };

  const draw = (size: CanvasSize) => {
    const now = forced ?? skyTimeOf(new Date());
    if (now !== time) { time = now; pal = PALETTES[time]; sceneDirty = true; }
    if (sceneDirty) { sceneDirty = false; paintScene(scene.size); }
    const g = context2d(layer.canvas, size);
    if (!g) return;
    g.clearRect(0, 0, size.w, size.h);
    // 星（夜）
    if (pal.night) {
      for (const st of stars) {
        g.fillStyle = `rgba(255,255,240,${0.35 + Math.sin(clock * 1.5 + st.p) * 0.3})`;
        g.beginPath(); g.arc(st.x, st.y, st.r, 0, Math.PI * 2); g.fill();
      }
    }
    // 雲（水彩の絵）
    for (const c of clouds) {
      const img = images[c.img];
      if (!ready(img)) continue;
      g.globalAlpha = pal.night ? 0.18 : time === "evening" ? 0.75 : 0.9;
      g.drawImage(img!, c.x, c.y, img!.naturalWidth * c.s, img!.naturalHeight * c.s);
    }
    g.globalAlpha = 1;
    // 田んぼの水面のきらめき
    for (const gl of glints) {
      const a = Math.max(0, Math.sin(clock * 0.9 + gl.p)) * (pal.night ? 0.25 : 0.5);
      if (a <= 0.02) continue;
      g.strokeStyle = pal.night ? `rgba(200,210,255,${a})` : `rgba(255,255,255,${a})`;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(gl.x, gl.y); g.lineTo(gl.x + gl.w, gl.y); g.stroke();
    }
    // 鳥
    g.strokeStyle = "rgba(60,60,70,0.65)";
    g.lineCap = "round";
    for (const b of birds) {
      const f = Math.sin(b.flap) * 3 * b.s;
      g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(b.x - 6 * b.s, b.y - f);
      g.quadraticCurveTo(b.x - 2 * b.s, b.y - 2 * b.s, b.x, b.y);
      g.quadraticCurveTo(b.x + 2 * b.s, b.y - 2 * b.s, b.x + 6 * b.s, b.y - f);
      g.stroke();
    }
    if (train) drawTrain(g, train);
  };

  function frame(t: number, dt: number) {
    const size = layer.size;
    if (still) {
      if (t === STILL_TIME) {
        train = newTrain();
        train.x = size.w * 0.86;
        sceneDirty = true;
        draw(size);
      }
      return;
    }
    step(size, dt);
    draw(size);
  }

  const stopTap = onBackgroundTap(host, mode, () => {
    if (still) return;
    if (train) {
      train.jump = train.jump || 0.01;
      train.toot = 1;
    } else {
      train = newTrain();
      train.toot = 1;
    }
  });
  const stop = startLoop(host, frame, { still });

  return {
    update: (next) => {
      forced = next.skyTime;
      if (still) frame(STILL_TIME, 0);
    },
    destroy: () => {
      stop();
      stopTap();
      layer.destroy();
      scene.destroy();
    },
  };
};
