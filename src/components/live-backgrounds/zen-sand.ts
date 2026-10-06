/**
 * 枯山水：石と苔のまわりに砂の波もよう。画面をなぞると、熊手でかいたような5本の筋が砂に残り、
 * しばらくすると元の模様にもどる。ときどき紅葉がひらりと落ちてきて、砂の上でしばらく休む。
 *
 * キャンバスは4枚重ね：元の模様（大きさが変わったときだけ描く）／なぞった帯（砂の色で元の模様を隠す）／
 * なぞった筋／落ち葉。帯と筋を分けているのは、つぎの帯が前の筋を消してしまわないようにするため。
 */
import { addCanvas, clamp, context2d, onBackgroundDrag, seededRandom, startLoop, STILL_TIME, type CanvasSize, type LiveMount } from "./engine";

type Stone = { x: number; y: number; r: number; seed: number };
type Leaf = { x: number; y: number; vy: number; sway: number; p: number; rot: number; vr: number; color: string; landed: number; life: number };

const SAND = "#ebe2cd";
const SHADE = "rgba(150,124,86,0.34)";
const LIGHT = "rgba(255,252,240,0.75)";
const LEAF_COLORS = ["#d9573f", "#e57a3a", "#e8a33a", "#c94a4a"];

export const mount: LiveMount = (host, { mode, reducedMotion }) => {
  const still = mode === "still" || reducedMotion;
  const rand = seededRandom(still ? 2 : Date.now() & 0xffff);
  let scale = 1;
  let gap = 10;
  let stones: Stone[] = [];
  let leaves: Leaf[] = [];
  let leafWait = 3;
  let dirty = true;
  let last: { x: number; y: number } | null = null;
  /** 最後になぞってからの時間。消えきったら、消す処理を止める */
  let idle = 999;

  const base = addCanvas(host, {
    onResize: (size) => {
      scale = clamp(size.w / 390, 0.8, 1.4);
      gap = 9.5 * scale;
      stones = [
        { x: size.w * 0.8, y: size.h * 0.17, r: 30 * scale, seed: 3 },
        { x: size.w * 0.68, y: size.h * 0.2, r: 15 * scale, seed: 8 },
        { x: size.w * 0.2, y: size.h * 0.52, r: 26 * scale, seed: 5 },
        { x: size.w * 0.74, y: size.h * 0.8, r: 38 * scale, seed: 11 },
      ];
      dirty = true;
    },
  });
  const band = addCanvas(host);
  const groove = addCanvas(host);
  const fx = addCanvas(host);

  const ringOuter = (s: Stone) => s.r * 1.25 + gap * 4.5;

  const line = (g: CanvasRenderingContext2D, pts: [number, number][], color: string, width: number, dy: number) => {
    if (pts.length < 2) return;
    g.strokeStyle = color;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(pts[0]![0], pts[0]![1] + dy);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i]![0], pts[i]![1] + dy);
    g.stroke();
  };
  const grooveLine = (g: CanvasRenderingContext2D, pts: [number, number][]) => {
    line(g, pts, SHADE, 1.7, 0.8);
    line(g, pts, LIGHT, 1.1, -0.8);
  };

  const drawStone = (g: CanvasRenderingContext2D, s: Stone) => {
    const r = seededRandom(s.seed);
    // 苔
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = s.r * (0.9 + r() * 0.42);
      g.fillStyle = i % 3 ? "rgba(122,152,88,0.85)" : "rgba(150,178,104,0.9)";
      g.beginPath(); g.ellipse(s.x + Math.cos(a) * d, s.y + Math.sin(a) * d * 0.7 + s.r * 0.15, s.r * 0.28, s.r * 0.18, a, 0, Math.PI * 2); g.fill();
    }
    // 石
    const pts: [number, number][] = [];
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      const d = s.r * (0.82 + r() * 0.24);
      pts.push([s.x + Math.cos(a) * d, s.y + Math.sin(a) * d * 0.78]);
    }
    const grad = g.createLinearGradient(s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r);
    grad.addColorStop(0, "#a6a39c");
    grad.addColorStop(0.55, "#7f7c76");
    grad.addColorStop(1, "#5d5b57");
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo((pts[0]![0] + pts[1]![0]) / 2, (pts[0]![1] + pts[1]![1]) / 2);
    for (let i = 1; i <= pts.length; i++) {
      const p = pts[i % pts.length]!, q = pts[(i + 1) % pts.length]!;
      g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.beginPath(); g.ellipse(s.x - s.r * 0.3, s.y - s.r * 0.35, s.r * 0.35, s.r * 0.16, -0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(140,170,96,0.75)";
    g.beginPath(); g.ellipse(s.x + s.r * 0.2, s.y - s.r * 0.55, s.r * 0.3, s.r * 0.12, 0.2, 0, Math.PI * 2); g.fill();
  };

  function paintBase(size: CanvasSize) {
    const g = context2d(base.canvas, size);
    if (!g) return;
    g.clearRect(0, 0, size.w, size.h);
    g.lineCap = "round";
    g.lineJoin = "round";
    // 横の波もよう（石のまわりの輪には入らない）
    for (let y = gap * 0.5, row = 0; y < size.h + gap; y += gap, row++) {
      let pts: [number, number][] = [];
      for (let x = -4; x <= size.w + 4; x += 4) {
        const yy = y + Math.sin(x * 0.018 + row * 0.35) * 2.6 * scale;
        const inside = stones.some((s) => Math.hypot(x - s.x, (yy - s.y) * 1.0) < ringOuter(s) + gap * 0.4);
        if (inside) {
          grooveLine(g, pts);
          pts = [];
        } else pts.push([x, yy]);
      }
      grooveLine(g, pts);
    }
    // 石のまわりの輪
    for (const s of stones) {
      for (let k = 0; k < 5; k++) {
        const rad = s.r * 1.25 + gap * (k + 0.5);
        const pts: [number, number][] = [];
        for (let i = 0; i <= 72; i++) {
          const a = (i / 72) * Math.PI * 2;
          const wob = 1 + Math.sin(a * 3 + s.seed) * 0.025;
          pts.push([s.x + Math.cos(a) * rad * wob, s.y + Math.sin(a) * rad * wob]);
        }
        // ほかの石の輪と重なるところは描かない
        const keep = pts.filter(([x, y]) => stones.every((o) => o === s || Math.hypot(x - o.x, y - o.y) > ringOuter(o) + gap * 0.4));
        if (keep.length === pts.length) grooveLine(g, pts);
        else {
          let run: [number, number][] = [];
          for (const p of pts) {
            if (keep.includes(p)) run.push(p);
            else { grooveLine(g, run); run = []; }
          }
          grooveLine(g, run);
        }
      }
    }
    for (const s of stones) drawStone(g, s);
  }

  /** なぞった1区間に、5本の筋を引く */
  const rake = (ax: number, ay: number, bx: number, by: number) => {
    const gb = band.canvas.getContext("2d");
    const gg = groove.canvas.getContext("2d");
    if (!gb || !gg) return;
    const { dpr } = band.size;
    gb.setTransform(dpr, 0, 0, dpr, 0, 0);
    gg.setTransform(dpr, 0, 0, dpr, 0, 0);
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / len, ny = (bx - ax) / len;
    gb.strokeStyle = SAND;
    gb.lineCap = "round";
    gb.lineWidth = gap * 5;
    gb.beginPath(); gb.moveTo(ax, ay); gb.lineTo(bx, by); gb.stroke();
    gg.lineCap = "round";
    for (let i = -2; i <= 2; i++) {
      const ox = nx * i * gap, oy = ny * i * gap;
      grooveLine(gg, [[ax + ox, ay + oy], [bx + ox, by + oy]]);
    }
  };

  const drag = (x: number, y: number, start: boolean) => {
    if (start || !last) {
      last = { x, y };
      return;
    }
    const d = Math.hypot(x - last.x, y - last.y);
    if (d < 3) return;
    // 速くなぞったときも、なめらかにつながるよう細かく分ける
    const n = Math.ceil(d / (gap * 1.2));
    for (let i = 0; i < n; i++) {
      const a = { x: last.x + ((x - last.x) * i) / n, y: last.y + ((y - last.y) * i) / n };
      const b = { x: last.x + ((x - last.x) * (i + 1)) / n, y: last.y + ((y - last.y) * (i + 1)) / n };
      rake(a.x, a.y, b.x, b.y);
    }
    last = { x, y };
    idle = 0;
  };

  const fade = (dt: number) => {
    if (idle > 40) return;
    for (const layer of [band, groove]) {
      const g = layer.canvas.getContext("2d");
      if (!g) continue;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = "destination-out";
      g.fillStyle = `rgba(0,0,0,${Math.min(0.2, 0.18 * dt)})`;
      g.fillRect(0, 0, layer.canvas.width, layer.canvas.height);
      g.globalCompositeOperation = "source-over";
    }
  };

  const drawLeaf = (g: CanvasRenderingContext2D, l: Leaf) => {
    g.save();
    g.translate(l.x, l.y);
    g.rotate(l.rot);
    g.globalAlpha = clamp(l.life, 0, 1);
    const s = 7 * scale;
    if (l.landed > 0) {
      g.fillStyle = "rgba(90,70,40,0.18)";
      g.beginPath(); g.ellipse(1.5, 2, s * 1.1, s * 0.9, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = l.color;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const d = i % 2 === 0 ? s : s * 0.45;
      g.lineTo(Math.cos(a) * d, Math.sin(a) * d);
    }
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(120,40,30,0.5)";
    g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, s * 1.3); g.stroke();
    g.restore();
  };

  const stepLeaves = (size: CanvasSize, t: number, dt: number) => {
    leafWait -= dt;
    if (leafWait <= 0 && leaves.length < 5) {
      leaves.push({ x: size.w * (0.1 + rand() * 0.8), y: -12, vy: (22 + rand() * 12) * scale, sway: (18 + rand() * 14) * scale, p: rand() * 6, rot: rand() * 6, vr: (rand() - 0.5) * 2, color: LEAF_COLORS[Math.floor(rand() * LEAF_COLORS.length)]!, landed: 0, life: 1 });
      leafWait = 9 + rand() * 9;
    }
    for (const l of leaves) {
      if (l.landed > 0) {
        l.landed += dt;
        if (l.landed > 8) l.life -= dt / 2;
        continue;
      }
      l.y += l.vy * dt;
      l.x += Math.cos(t * 1.4 + l.p) * l.sway * dt;
      l.rot += l.vr * dt + Math.sin(t * 2 + l.p) * dt;
      // 画面の中ほど〜下のどこかで、砂の上に落ちる
      if (l.y > size.h * (0.35 + ((l.p * 37) % 1) * 0.55)) l.landed = 0.01;
    }
    leaves = leaves.filter((l) => l.life > 0);
  };

  const frame = (t: number, dt: number) => {
    const size = fx.size;
    if (dirty) {
      dirty = false;
      paintBase(base.size);
    }
    if (still) {
      if (t === STILL_TIME) {
        // 見本：なぞった筋を1本見せる
        const pts: [number, number][] = [];
        for (let i = 0; i <= 30; i++) {
          const k = i / 30;
          pts.push([size.w * (0.12 + k * 0.5), size.h * (0.32 + Math.sin(k * Math.PI * 1.4) * 0.06 + k * 0.08)]);
        }
        last = null;
        drag(pts[0]![0], pts[0]![1], true);
        for (const [x, y] of pts.slice(1)) drag(x, y, false);
        const g = context2d(fx.canvas, size);
        if (g) drawLeaf(g, { x: size.w * 0.45, y: size.h * 0.66, vy: 0, sway: 0, p: 0, rot: 0.6, vr: 0, color: LEAF_COLORS[0]!, landed: 1, life: 1 });
      }
      return;
    }
    idle += dt;
    fade(dt);
    stepLeaves(size, t, dt);
    const g = context2d(fx.canvas, size);
    if (!g) return;
    g.clearRect(0, 0, size.w, size.h);
    for (const l of leaves) drawLeaf(g, l);
  };

  const stopDrag = onBackgroundDrag(host, mode, (x, y, start) => {
    if (!still) drag(x, y, start);
  });
  const stop = startLoop(host, frame, { still });

  return {
    update: () => {},
    destroy: () => {
      stop();
      stopDrag();
      for (const layer of [fx, groove, band, base]) layer.destroy();
    },
  };
};
