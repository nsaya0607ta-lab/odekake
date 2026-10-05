/**
 * わんこの足あと：見えないわんこが、画面のはしからはしへ歩いて、足あとを残していく。
 * - ふつうに歩く／くんくん（ジグザグ）／うれしくて走りまわる（くるっと輪をかく）／とちゅうでおすわり
 * - ときどき親子で歩く。ときどきペンキをふんで、カラフルな足あとになる
 * - タップすると、そこへかけよってきておすわりする
 * 足あとはキャンバスに描く（色ごとに前もって描いた肉球を貼る）。足あとが1つもないあいだは描き直さない。
 */
import { addCanvas, clamp, context2d, makeSprite, onBackgroundTap, seededRandom, startLoop, type LiveMount } from "./engine";

type Point = { x: number; y: number };
type Print = { x: number; y: number; angle: number; at: number; size: number; color: string; opacity: number };
/** 置いたあとの足あと（born は置いた時刻） */
type Placed = Print & { born: number; fixedAlpha?: number };

/** 足あとが出てから消えるまで（秒） */
const LIFE = 6.5;
type Walk = { prints: Print[]; index: number };

const MUD = "#7a5c42";
const PAINTS = ["#ef8fa3", "#6fb4e6", "#f0b647", "#86c777", "#ad8de0"];
const RAINBOW = ["#f28b8b", "#f4b45e", "#f2d65c", "#8fd07f", "#6fc0e8", "#8f9de6", "#c792e6"];

/** 点を通るなめらかな線（Catmull-Rom）を、細かい点の並びにする */
function spline(points: Point[], step = 4): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const segments = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / step));
    for (let s = 0; s < segments; s += 1) {
      const t = s / segments;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(points[points.length - 1]!);
  return out;
}

export const mount: LiveMount = (host, { mode, reducedMotion }) => {
  const still = mode === "still" || reducedMotion;
  const rand = seededRandom(still ? 21 : Date.now() & 0xffff);
  const layer = addCanvas(host);
  const ctx = context2d(layer.canvas, layer.size);
  // 大きさは ResizeObserver が入れてくれる値を使う（毎回 clientWidth を読むと、そのたびに画面の計算が走る）
  const size = () => ({ w: layer.size.w, h: layer.size.h });
  const unit = () => clamp(size().w / 390, 0.75, 1.3);

  /** 肉球の絵（色ごとに1回だけ描く） */
  const sprites = new Map<string, HTMLCanvasElement>();
  const spriteOf = (color: string) => {
    let sprite = sprites.get(color);
    if (!sprite) {
      sprite = makeSprite(64, 64, (g) => {
        g.scale(64 / 24, 64 / 24);
        g.fillStyle = color;
        g.beginPath();
        g.moveTo(12, 22.6);
        g.bezierCurveTo(8.1, 22.6, 5.1, 20.4, 5.1, 17.7);
        g.bezierCurveTo(5.1, 15, 8.2, 10.8, 12, 10.8);
        g.bezierCurveTo(15.8, 10.8, 18.9, 15, 18.9, 17.7);
        g.bezierCurveTo(18.9, 20.4, 15.9, 22.6, 12, 22.6);
        g.fill();
        const toe = (cx: number, cy: number, rx: number, ry: number, deg: number) => {
          g.beginPath();
          g.ellipse(cx, cy, rx, ry, (deg * Math.PI) / 180, 0, Math.PI * 2);
          g.fill();
        };
        toe(4.5, 10.3, 2.3, 3, -22);
        toe(9.1, 5.6, 2.4, 3.2, -7);
        toe(14.9, 5.6, 2.4, 3.2, 7);
        toe(19.5, 10.3, 2.3, 3, 22);
      });
      sprites.set(color, sprite);
    }
    return sprite;
  };

  /** 画面の外（はしの少し外）の点。side: 0上 1右 2下 3左 */
  const edgePoint = (side: number): Point => {
    const { w, h } = size();
    const m = 30;
    if (side === 0) return { x: w * (0.1 + rand() * 0.8), y: -m };
    if (side === 1) return { x: w + m, y: h * (0.1 + rand() * 0.8) };
    if (side === 2) return { x: w * (0.1 + rand() * 0.8), y: h + m };
    return { x: -m, y: h * (0.1 + rand() * 0.8) };
  };
  const inner = (): Point => {
    const { w, h } = size();
    return { x: w * (0.15 + rand() * 0.7), y: h * (0.12 + rand() * 0.76) };
  };

  /**
   * 線にそって足あとを並べる。左右の足を交互に、少し横へずらす。
   * sitAt（0〜1）があれば、そこで前足をそろえておすわりして、pause 秒とまる。
   */
  const layPrints = (
    path: Point[],
    start: number,
    { paw, interval, color, opacity, zigzag = 0, sitAt, pause = 1.4, rainbow = false }: { paw: number; interval: number; color: string; opacity: number; zigzag?: number; sitAt?: number; pause?: number; rainbow?: boolean },
  ): Print[] => {
    const stride = paw * 1.32;
    const prints: Print[] = [];
    let acc = 0;
    let at = start;
    let left = true;
    let sat = sitAt === undefined;
    for (let i = 1; i < path.length; i += 1) {
      const a = path[i - 1]!;
      const b = path[i]!;
      acc += Math.hypot(b.x - a.x, b.y - a.y);
      if (acc < stride) continue;
      acc = 0;
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const nx = -Math.sin(angle);
      const ny = Math.cos(angle);
      const n = prints.length;
      const side = (left ? -1 : 1) * paw * 0.42 + Math.sin(n * 1.35) * zigzag;
      const tint = rainbow ? RAINBOW[n % RAINBOW.length]! : color;
      prints.push({ x: b.x + nx * side, y: b.y + ny * side, angle, at, size: paw, color: tint, opacity });
      left = !left;
      at += interval;
      if (!sat && sitAt !== undefined && i / path.length >= sitAt) {
        // おすわり：前足を左右にそろえて、しばらく止まる
        sat = true;
        const other = left ? -1 : 1;
        prints.push({ x: b.x + nx * other * paw * 0.42 + Math.cos(angle) * paw * 0.2, y: b.y + ny * other * paw * 0.42 + Math.sin(angle) * paw * 0.2, angle, at, size: paw, color: tint, opacity });
        at += pause;
      }
    }
    return prints;
  };

  /** 1回ぶんのおさんぽ（いくつかの歩き方からえらぶ） */
  const makeWalks = (start: number, summon?: Point): Walk[] => {
    const u = unit();
    const paint = rand();
    const color = paint < 0.16 ? PAINTS[Math.floor(rand() * PAINTS.length)]! : MUD;
    const rainbow = paint >= 0.16 && paint < 0.21;
    const opacity = color === MUD && !rainbow ? 0.3 + rand() * 0.1 : 0.66;
    const paw = (20 + rand() * 4) * u;
    const from = Math.floor(rand() * 4);
    const to = (from + 1 + Math.floor(rand() * 3)) % 4;

    if (summon) {
      const path = spline([edgePoint(nearestSide(summon)), summon, inner(), edgePoint(to)]);
      const reach = path.findIndex((p) => Math.hypot(p.x - summon.x, p.y - summon.y) < 6);
      return [{ prints: layPrints(path, start, { paw, interval: 0.16, color, opacity, sitAt: Math.max(0.05, reach / path.length), pause: 1.8, rainbow }), index: 0 }];
    }

    const style = rand();
    if (style < 0.14) {
      // うれしくて走りまわる：まんなかで、くるっと輪をかく
      const c = inner();
      const r = (44 + rand() * 24) * u;
      const ring: Point[] = [];
      const turns = 1.3;
      const a0 = rand() * Math.PI * 2;
      for (let k = 0; k <= 14; k += 1) {
        const a = a0 + (k / 14) * Math.PI * 2 * turns;
        ring.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
      }
      const path = spline([edgePoint(from), ...ring, edgePoint(to)]);
      return [{ prints: layPrints(path, start, { paw, interval: 0.12, color, opacity, rainbow }), index: 0 }];
    }
    const path = spline([edgePoint(from), inner(), inner(), edgePoint(to)]);
    if (style < 0.3) {
      // くんくん：ジグザグに、ゆっくり
      return [{ prints: layPrints(path, start, { paw, interval: 0.34, color, opacity, zigzag: paw * 0.9, rainbow }), index: 0 }];
    }
    const sitAt = style < 0.45 ? 0.35 + rand() * 0.3 : undefined;
    const walks: Walk[] = [{ prints: layPrints(path, start, { paw, interval: 0.26, color, opacity, sitAt, rainbow }), index: 0 }];
    if (rand() < 0.18) {
      // 親子：小さな足あとが、となりを少しおくれてついてくる
      const side = rand() < 0.5 ? 1 : -1;
      const pup = path.map((p, i) => {
        const q = path[Math.min(path.length - 1, i + 1)]!;
        const a = Math.atan2(q.y - p.y, q.x - p.x);
        return { x: p.x - Math.sin(a) * 30 * u * side, y: p.y + Math.cos(a) * 30 * u * side };
      });
      walks.push({ prints: layPrints(pup, start + 0.5, { paw: paw * 0.66, interval: 0.17, color, opacity, sitAt, rainbow }), index: 0 });
    }
    return walks;
  };

  const nearestSide = (p: Point) => {
    const { w, h } = size();
    const d = [p.y, w - p.x, h - p.y, p.x];
    return d.indexOf(Math.min(...d));
  };

  let placed: Placed[] = [];
  const place = (p: Print, t: number, fixedAlpha?: number) => {
    placed.push({ ...p, born: t, fixedAlpha });
  };

  let dirty = true;
  const draw = (t: number) => {
    if (!ctx) return;
    const { w, h, dpr } = layer.size;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const p of placed) {
      const k = (t - p.born) / LIFE;
      // ポンと押して（大きめ→少し小さく→ぴったり）、しばらくして、うすれて消える
      let alpha = p.fixedAlpha ?? (k < 0.05 ? k / 0.05 : k < 0.6 ? 1 : Math.max(0, 1 - (k - 0.6) / 0.4));
      if (p.fixedAlpha === undefined) alpha *= p.opacity;
      const scale = p.fixedAlpha !== undefined ? 1 : k < 0.05 ? 1.4 - (0.48 * k) / 0.05 : k < 0.09 ? 0.92 + (0.08 * (k - 0.05)) / 0.04 : 1;
      if (alpha <= 0.01) continue;
      const s = p.size * scale;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle + Math.PI / 2);
      ctx.globalAlpha = alpha;
      ctx.drawImage(spriteOf(p.color), -s / 2, -s / 2, s, s);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };

  let walks: Walk[] = [];
  let nextWalk = 0.6;
  let lastSummon = -10;
  let clock = 0;

  const stopTap = onBackgroundTap(host, mode, (x, y) => {
    if (clock - lastSummon < 3.5) return;
    lastSummon = clock;
    walks.push(...makeWalks(clock, { x, y }));
  });

  const frame = (t: number) => {
    clock = t;
    if (t >= nextWalk && walks.length < 3) {
      walks.push(...makeWalks(t));
      nextWalk = t + 3 + rand() * 4;
    }
    for (const walk of walks) {
      while (walk.index < walk.prints.length && walk.prints[walk.index]!.at <= t) {
        place(walk.prints[walk.index]!, t);
        walk.index += 1;
        dirty = true;
      }
    }
    walks = walks.filter((walk) => walk.index < walk.prints.length);
    const before = placed.length;
    placed = placed.filter((p) => t - p.born < LIFE);
    // 足あとが1つもなければ、描き直さない
    if (placed.length || before || dirty) draw(t);
    dirty = false;
  };

  let stop = () => {};
  if (still) {
    // 見本：歩いてきた2本の足あとを、古いほどうすくして描く
    const all = [...makeWalks(0), ...makeWalks(0.8)].flatMap((walk) => walk.prints);
    const end = Math.max(...all.map((p) => p.at), 1);
    for (const p of all) place(p, 0, Math.min(0.75, p.opacity * 1.25) * clamp(1 - (end - p.at) / 12, 0.35, 1));
    draw(0);
  } else {
    stop = startLoop(host, frame);
  }

  return {
    update: () => {},
    destroy: () => {
      stop();
      stopTap();
      layer.destroy();
    },
  };
};
