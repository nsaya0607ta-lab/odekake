/**
 * 四季めぐり：季節（日本時間の月）で、ひとりでに変わる。
 * - 春：桜の花びらが、くるくる裏返りながら舞う。画面のはしから桜の枝がのぞく
 * - 夏：夕やみの草むらで、ほたるがふわっと光っては消える
 * - 秋：もみじとイチョウが、ひらひら落ちて、下にたまる
 * - 冬：やわらかい雪と結晶。下の雪と、すみのもみの木に、すこしずつ雪がつもる
 * 飾り（枝・草むら・木）は大きさが変わったときだけ描き、毎回は貼るだけにしている。
 */
import { seasonOf, type Season } from "@/lib/app-backgrounds";
import { addCanvas, clamp, context2d, makeSprite, seededRandom, startLoop, type CanvasSize, type LiveMount } from "./engine";

const BACKGROUND: Record<Season, string> = {
  spring: "linear-gradient(180deg, #fde6ee 0%, #fef2f1 55%, #fdf8f0 100%)",
  summer: "linear-gradient(180deg, #0f2236 0%, #153440 52%, #1b4436 100%)",
  autumn: "linear-gradient(180deg, #fcefe0 0%, #f9e2cb 60%, #f4d4b8 100%)",
  winter: "linear-gradient(180deg, #d9e5f1 0%, #ebf1f7 55%, #f8fafc 100%)",
};

/** ひらひら落ちるもの（花びら・葉・雪）と、ほたる */
type Particle = { x: number; y: number; size: number; speed: number; swayA: number; swayF: number; p: number; spin: number; rot: number; flip: number; sprite: number };

const petalSprite = (tip: string) =>
  makeSprite(36, 44, (g) => {
    g.translate(18, 22);
    const grad = g.createLinearGradient(0, 18, 0, -18);
    grad.addColorStop(0, "#fff3f6");
    grad.addColorStop(1, tip);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, 18);
    g.bezierCurveTo(-13, 6, -12, -12, -4, -17);
    g.lineTo(0, -12);
    g.lineTo(4, -17);
    g.bezierCurveTo(12, -12, 13, 6, 0, 18);
    g.closePath();
    g.fill();
  });

const mapleSprite = (fill: string, edge: string) =>
  makeSprite(44, 44, (g) => {
    g.translate(22, 20);
    const pts = [[0, -16], [3.4, -7.5], [12, -12], [8.6, -3.2], [16.5, 2.2], [6.5, 3.2], [7.6, 10], [1.2, 5.6], [0, 13], [-1.2, 5.6], [-7.6, 10], [-6.5, 3.2], [-16.5, 2.2], [-8.6, -3.2], [-12, -12], [-3.4, -7.5]] as const;
    const grad = g.createRadialGradient(0, 2, 2, 0, 0, 18);
    grad.addColorStop(0, edge);
    grad.addColorStop(1, fill);
    g.fillStyle = grad;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(120,40,20,0.35)";
    g.lineWidth = 0.8;
    g.lineCap = "round";
    for (const [x, y] of [[0, -16], [12, -12], [16.5, 2.2], [7.6, 10], [-7.6, 10], [-16.5, 2.2], [-12, -12]] as const) {
      g.beginPath();
      g.moveTo(0, 4);
      g.lineTo(x * 0.85, y * 0.85 + 0.6);
      g.stroke();
    }
    g.strokeStyle = "rgba(110,50,25,0.6)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(0, 4);
    g.lineTo(0.6, 20);
    g.stroke();
  });

const ginkgoSprite = () =>
  makeSprite(40, 44, (g) => {
    g.translate(20, 22);
    const grad = g.createLinearGradient(0, 8, 0, -16);
    grad.addColorStop(0, "#e9b43d");
    grad.addColorStop(1, "#f7d36a");
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, 8);
    g.bezierCurveTo(-13, 2, -17, -11, -12, -16);
    g.quadraticCurveTo(-5, -19, -1, -13.5);
    g.lineTo(0, -9.5);
    g.lineTo(1, -13.5);
    g.quadraticCurveTo(5, -19, 12, -16);
    g.bezierCurveTo(17, -11, 13, 2, 0, 8);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(170,120,30,0.28)";
    g.lineWidth = 0.6;
    for (let k = -4; k <= 4; k += 1) {
      g.beginPath();
      g.moveTo(0, 7);
      g.lineTo(k * 3.2, -14 + Math.abs(k) * 0.6);
      g.stroke();
    }
    g.strokeStyle = "rgba(170,120,30,0.7)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(0, 8);
    g.lineTo(0, 20);
    g.stroke();
  });

const softDot = (color: string, size = 32) =>
  makeSprite(size, size, (g) => {
    const c = size / 2;
    const grad = g.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, color.replace("ALPHA", "1"));
    grad.addColorStop(0.4, color.replace("ALPHA", "0.7"));
    grad.addColorStop(1, color.replace("ALPHA", "0"));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  });

/** 桜の花（5まいの花びら） */
function blossom(g: CanvasRenderingContext2D, x: number, y: number, r: number, turn: number) {
  g.save();
  g.translate(x, y);
  g.rotate(turn);
  for (let k = 0; k < 5; k += 1) {
    g.rotate((Math.PI * 2) / 5);
    const grad = g.createLinearGradient(0, 0, 0, -r);
    grad.addColorStop(0, "#fde9ef");
    grad.addColorStop(1, "#f4a9bf");
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(-r * 0.62, -r * 0.3, -r * 0.5, -r * 0.95, -r * 0.16, -r);
    g.lineTo(0, -r * 0.82);
    g.lineTo(r * 0.16, -r);
    g.bezierCurveTo(r * 0.5, -r * 0.95, r * 0.62, -r * 0.3, 0, 0);
    g.fill();
  }
  g.fillStyle = "#f08aa6";
  g.beginPath();
  g.arc(0, 0, r * 0.18, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#e9a23f";
  for (let k = 0; k < 6; k += 1) {
    const a = (k / 6) * Math.PI * 2;
    g.beginPath();
    g.arc(Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.32, r * 0.06, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** 季節ごとの飾り（大きさが変わったときだけ描く） */
function drawDecor(season: Season, { w, h, dpr }: CanvasSize): HTMLCanvasElement {
  const u = clamp(w / 390, 0.75, 1.3);
  const rand = seededRandom(9);
  return makeSprite(w * dpr, h * dpr, (g) => {
    g.scale(dpr, dpr);
    if (season === "spring") {
      // 右上と左の枝
      const branch = (pts: [number, number][], width: number) => {
        g.strokeStyle = "#8b6b5d";
        g.lineCap = "round";
        g.lineWidth = width;
        g.beginPath();
        g.moveTo(pts[0]![0], pts[0]![1]);
        g.bezierCurveTo(pts[1]![0], pts[1]![1], pts[2]![0], pts[2]![1], pts[3]![0], pts[3]![1]);
        g.stroke();
      };
      const right: [number, number][] = [[w + 10, h * 0.025], [w * 0.88, h * 0.04], [w * 0.78, h * 0.09], [w * 0.6, h * 0.1]];
      branch(right, 6 * u);
      branch([[w * 0.83, h * 0.05], [w * 0.8, h * 0.08], [w * 0.82, h * 0.12], [w * 0.78, h * 0.15]], 3 * u);
      branch([[w * 0.7, h * 0.09], [w * 0.66, h * 0.07], [w * 0.62, h * 0.05], [w * 0.57, h * 0.045]], 2.4 * u);
      const left: [number, number][] = [[-10, h * 0.6], [w * 0.06, h * 0.585], [w * 0.12, h * 0.6], [w * 0.2, h * 0.57]];
      branch(left, 5 * u);
      branch([[w * 0.08, h * 0.592], [w * 0.1, h * 0.62], [w * 0.13, h * 0.63], [w * 0.15, h * 0.65]], 2.4 * u);
      const spots: [number, number][] = [
        [0.62, 0.1], [0.66, 0.085], [0.71, 0.098], [0.76, 0.088], [0.8, 0.064], [0.86, 0.05], [0.9, 0.04], [0.78, 0.15], [0.82, 0.12], [0.58, 0.05], [0.63, 0.06], [0.95, 0.03],
        [0.05, 0.585], [0.1, 0.6], [0.14, 0.593], [0.19, 0.572], [0.13, 0.632], [0.16, 0.65], [0.02, 0.6],
      ];
      for (const [px, py] of spots) blossom(g, w * px + (rand() - 0.5) * 8, h * py + (rand() - 0.5) * 8, (8 + rand() * 4) * u, rand() * 6);
      return;
    }
    if (season === "summer") {
      // 夜空の星と、下の草むら
      for (let k = 0; k < 40; k += 1) {
        g.fillStyle = `rgba(255,255,240,${0.2 + rand() * 0.5})`;
        g.beginPath();
        g.arc(rand() * w, Math.pow(rand(), 1.5) * h * 0.4, 0.4 + rand() * 0.8, 0, Math.PI * 2);
        g.fill();
      }
      for (let layer = 0; layer < 2; layer += 1) {
        g.fillStyle = layer === 0 ? "#123327" : "#0b241b";
        for (let x = -10; x < w + 10; x += 4 + rand() * 4) {
          const bh = (layer === 0 ? 50 : 30) * u * (0.5 + rand());
          const lean = (rand() - 0.5) * 22;
          g.beginPath();
          g.moveTo(x - 2.5, h);
          g.quadraticCurveTo(x + lean * 0.3, h - bh * 0.6, x + lean, h - bh);
          g.quadraticCurveTo(x + lean * 0.3 + 1.4, h - bh * 0.5, x + 2.5, h);
          g.fill();
        }
      }
      return;
    }
    if (season === "autumn") {
      // 下にたまった落ち葉
      const maple = [mapleSprite("#d9573f", "#ef8d4f"), mapleSprite("#e8853d", "#f6b456")];
      const ginkgo = ginkgoSprite();
      for (let k = 0; k < Math.round(16 * u * (w / 390)); k += 1) {
        const sprite = k % 3 === 0 ? ginkgo : maple[k % 2]!;
        const s = (18 + rand() * 8) * u;
        g.save();
        g.translate(rand() * w, h - 4 - rand() * 18);
        g.rotate(rand() * Math.PI * 2);
        g.scale(1, 0.55 + rand() * 0.35);
        g.globalAlpha = 0.9;
        g.drawImage(sprite, -s / 2, -s / 2, s, s);
        g.restore();
      }
      return;
    }
    // 冬：すみのもみの木
    const tree = (x: number, base: number, size: number) => {
      for (let k = 0; k < 3; k += 1) {
        const tw = size * (1 - k * 0.24);
        const ty = base - k * size * 0.42;
        g.fillStyle = "#b9cbdc";
        g.beginPath();
        g.moveTo(x - tw / 2, ty);
        g.lineTo(x, ty - size * 0.62);
        g.lineTo(x + tw / 2, ty);
        g.closePath();
        g.fill();
        g.fillStyle = "rgba(255,255,255,0.95)";
        g.beginPath();
        g.moveTo(x - tw * 0.3, ty - size * 0.25);
        g.lineTo(x, ty - size * 0.62);
        g.lineTo(x + tw * 0.3, ty - size * 0.25);
        g.quadraticCurveTo(x, ty - size * 0.36, x - tw * 0.3, ty - size * 0.25);
        g.fill();
      }
    };
    tree(w * 0.07, h - 8, 60 * u);
    tree(w * 0.95, h - 12, 76 * u);
    tree(w * 0.84, h - 4, 46 * u);
  });
}

/** 花びら・葉・ほたる・雪の絵（何枚の見本を並べても、描くのは1回だけ） */
let cachedSprites: Record<Season, HTMLCanvasElement[]> | null = null;
const seasonSprites = () => (cachedSprites ??= buildSeasonSprites());

function buildSeasonSprites(): Record<Season, HTMLCanvasElement[]> {
  return {
    spring: [petalSprite("#f4a3ba"), petalSprite("#f7bccb"), petalSprite("#ef93ae")],
    summer: [softDot("rgba(232,255,140,ALPHA)", 48)],
    autumn: [mapleSprite("#d9573f", "#ef8d4f"), mapleSprite("#e8853d", "#f6b456"), mapleSprite("#c94a3a", "#e67a45"), ginkgoSprite()],
    winter: [softDot("rgba(255,255,255,ALPHA)", 32)],
  };
}

export const mount: LiveMount = (host, { mode, reducedMotion, signals }) => {
  const still = mode === "still" || reducedMotion;
  const rand = seededRandom(still ? 41 : Date.now() & 0xffff);
  let season: Season = signals.season ?? seasonOf(new Date());
  let decor: HTMLCanvasElement | null = null;
  let particles: Particle[] = [];
  let snowpack = 0;

  const sprites = seasonSprites();

  const spawn = (size: CanvasSize, anywhere: boolean): Particle => {
    const u = clamp(size.w / 390, 0.75, 1.3);
    const depth = Math.pow(rand(), 1.4);
    const base = { x: rand() * size.w, y: anywhere ? rand() * size.h : -30 - rand() * 60, p: rand() * Math.PI * 2, rot: rand() * Math.PI * 2, flip: rand() * Math.PI * 2, sprite: Math.floor(rand() * sprites[season].length) };
    if (season === "spring") return { ...base, size: (13 + depth * 10) * u, speed: 26 + depth * 30, swayA: 18 + rand() * 30, swayF: 0.5 + rand() * 0.6, spin: (rand() - 0.5) * 2.4 };
    if (season === "autumn") return { ...base, size: (24 + depth * 16) * u, speed: 30 + depth * 34, swayA: 26 + rand() * 40, swayF: 0.35 + rand() * 0.5, spin: (rand() - 0.5) * 2 };
    if (season === "summer") return { ...base, y: size.h * (0.25 + rand() * 0.75), size: (16 + depth * 14) * u, speed: 0, swayA: 30 + rand() * 50, swayF: 0.08 + rand() * 0.1, spin: 2.6 + rand() * 2.4 };
    return { ...base, size: (1.6 + depth * 3.2) * u, speed: 18 + depth * 42, swayA: 6 + rand() * 16, swayF: 0.3 + rand() * 0.8, spin: rand() < 0.07 ? 1 : 0 };
  };

  const setup = (size: CanvasSize) => {
    host.style.background = BACKGROUND[season];
    decor = drawDecor(season, size);
    const area = (size.w * size.h) / (390 * 844);
    const count = Math.round({ spring: 38, summer: 24, autumn: 26, winter: 120 }[season] * area);
    particles = Array.from({ length: count }, () => spawn(size, true));
  };
  const layer = addCanvas(host, { onResize: setup });
  const ctx = context2d(layer.canvas, layer.size);

  const crystal = makeSprite(40, 40, (g) => {
    g.translate(20, 20);
    g.strokeStyle = "rgba(255,255,255,0.95)";
    g.lineWidth = 1.6;
    g.lineCap = "round";
    for (let k = 0; k < 6; k += 1) {
      g.rotate(Math.PI / 3);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -15);
      g.moveTo(0, -8);
      g.lineTo(-4, -12);
      g.moveTo(0, -8);
      g.lineTo(4, -12);
      g.stroke();
    }
  });

  const frame = (t: number, dt: number) => {
    if (!ctx) return;
    const size = layer.size;
    const { w, h, dpr } = size;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (decor) ctx.drawImage(decor, 0, 0, w, h);
    const list = sprites[season];

    for (const p of particles) {
      if (season === "summer") {
        // ほたる：ふらふら飛んで、ふわっと光っては消える
        const x = p.x + Math.sin(t * p.swayF + p.p) * p.swayA + Math.sin(t * p.swayF * 2.3 + p.p * 2) * p.swayA * 0.4;
        const y = p.y + Math.cos(t * p.swayF * 1.3 + p.p) * p.swayA * 0.6;
        const cycle = ((t + p.p * 3) % (p.spin + 1.6)) / (p.spin + 1.6);
        const on = cycle < 0.38 ? Math.sin((cycle / 0.38) * Math.PI) : 0;
        const a = 0.12 + on * 0.88;
        ctx.globalAlpha = a;
        ctx.drawImage(list[0]!, x - p.size / 2, y - p.size / 2, p.size, p.size);
        ctx.globalAlpha = Math.min(1, a + 0.2);
        ctx.fillStyle = "#fbffd2";
        ctx.beginPath();
        ctx.arc(x, y, 1.1, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      p.y += p.speed * dt;
      p.rot += p.spin * dt;
      if (p.y > h + 30) Object.assign(p, spawn(size, false));
      const x = p.x + Math.sin(t * p.swayF + p.p) * p.swayA;
      if (season === "winter") {
        if (p.spin) {
          ctx.save();
          ctx.translate(x, p.y);
          ctx.rotate(t * 0.4 + p.p);
          ctx.globalAlpha = 0.85;
          ctx.drawImage(crystal, -9, -9, 18, 18);
          ctx.restore();
        } else {
          ctx.globalAlpha = 0.95;
          ctx.drawImage(list[0]!, x - p.size * 2, p.y - p.size * 2, p.size * 4, p.size * 4);
        }
        continue;
      }
      // 花びら・葉：くるくる裏返りながら（横の幅を cos で変えて、立体に見せる）
      const flip = Math.cos(t * (season === "spring" ? 2.2 : 1.6) + p.flip);
      ctx.save();
      ctx.translate(x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(Math.max(season === "autumn" ? 0.35 : 0.15, Math.abs(flip)), 1);
      ctx.globalAlpha = 0.9;
      ctx.drawImage(list[p.sprite]!, -p.size / 2, -p.size * 0.6, p.size, p.size * 1.2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    if (season === "winter") {
      // 下に、すこしずつ雪がつもる
      snowpack = still ? 16 : Math.min(20, snowpack + dt * 0.1);
      if (snowpack > 0.5) {
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w + 8; x += 8) ctx.lineTo(x, h - snowpack - Math.sin(x * 0.045) * 3 - Math.sin(x * 0.012 + 1) * 4);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
      }
    }
  };

  const stop = startLoop(host, frame, { still });

  return {
    update: (next) => {
      const value = next.season ?? seasonOf(new Date());
      if (value === season) return;
      season = value;
      snowpack = 0;
      setup(layer.size);
      if (still) frame(14, 0);
    },
    destroy: () => {
      stop();
      layer.destroy();
      host.style.background = "";
    },
  };
};
