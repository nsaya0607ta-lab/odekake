/**
 * にじむ絵の具：画用紙の上を指でなぞると、水彩の絵の具がじわっとにじんで広がる。
 * 色はなぞるうちに少しずつ変わり、乾いた絵の具は「かけ算」で重ねるので、重なったところは混ざって深い色になる。
 * ときどき、ぽたっと絵の具のしずくが落ちる。乾いた絵は1分ほどかけて、ゆっくり薄れて消える。
 *
 * キャンバスは2枚：にじんでいる途中（毎回描きなおす）／乾いたもの（にじみ終わったら1回だけ写す）。
 */
import { addCanvas, clamp, context2d, onBackgroundDrag, onBackgroundTap, seededRandom, startLoop, STILL_TIME, type CanvasSize, type LiveMount } from "./engine";

type Blob = { x: number; y: number; r: number; color: [number, number, number]; age: number; dur: number; seed: number; grow: number; rim: boolean };

const PALETTE: readonly [number, number, number][] = [
  [232, 112, 136], [242, 156, 92], [240, 200, 90], [126, 190, 120], [92, 168, 200], [128, 128, 210], [186, 120, 200],
];

const mix = (a: readonly number[], b: readonly number[], t: number): [number, number, number] => [
  Math.round(a[0]! + (b[0]! - a[0]!) * t), Math.round(a[1]! + (b[1]! - a[1]!) * t), Math.round(a[2]! + (b[2]! - a[2]!) * t),
];

export const mount: LiveMount = (host, { mode, reducedMotion }) => {
  const still = mode === "still" || reducedMotion;
  const rand = seededRandom(still ? 12 : Date.now() & 0xffff);
  let scale = 1;
  let blobs: Blob[] = [];
  let last: { x: number; y: number } | null = null;
  let travelled = rand() * PALETTE.length * 400;
  let dropWait = 2;
  let idle = 999;

  const dried = addCanvas(host, {
    onResize: (size) => {
      scale = clamp(size.w / 390, 0.8, 1.4);
    },
  });
  const wet = addCanvas(host);

  const colorAt = (d: number): [number, number, number] => {
    const k = (d / (360 * scale)) % PALETTE.length;
    const i = Math.floor(k);
    return mix(PALETTE[i]!, PALETTE[(i + 1) % PALETTE.length]!, k - i);
  };

  const blobPath = (g: CanvasRenderingContext2D, b: Blob, r: number) => {
    const rr = seededRandom(b.seed);
    const n = 18;
    const offs = Array.from({ length: n }, () => 0.82 + rr() * 0.3);
    const pts = offs.map((o, i) => {
      const a = (i / n) * Math.PI * 2;
      return [b.x + Math.cos(a) * r * o, b.y + Math.sin(a) * r * o] as const;
    });
    // 点と点のまん中を通る曲線で、角のないにじみの形に
    g.beginPath();
    const mid = (i: number) => {
      const p = pts[i % n]!, q = pts[(i + 1) % n]!;
      return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as const;
    };
    const start = mid(0);
    g.moveTo(start[0], start[1]);
    for (let i = 1; i <= n; i++) {
      const p = pts[i % n]!, m = mid(i);
      g.quadraticCurveTo(p[0], p[1], m[0], m[1]);
    }
    g.closePath();
  };

  /** 水彩らしく、中はうすく・ふちは少し濃く */
  const paintBlob = (g: CanvasRenderingContext2D, b: Blob, k: number) => {
    const r = b.r * (1 + b.grow * (1 - Math.pow(1 - k, 3)));
    const [cr, cg, cb] = b.color;
    blobPath(g, b, r);
    if (b.rim) {
      // しずく：中はうすく、ふちに絵の具がたまる
      const fill = g.createRadialGradient(b.x, b.y, r * 0.1, b.x, b.y, r);
      fill.addColorStop(0, `rgba(${cr},${cg},${cb},0.16)`);
      fill.addColorStop(0.75, `rgba(${cr},${cg},${cb},0.22)`);
      fill.addColorStop(1, `rgba(${cr},${cg},${cb},0.34)`);
      g.fillStyle = fill;
      g.fill();
      g.strokeStyle = `rgba(${Math.round(cr * 0.8)},${Math.round(cg * 0.8)},${Math.round(cb * 0.8)},0.28)`;
      g.lineWidth = 1.2;
      g.stroke();
    } else {
      // なぞった線：ふちをぼかして、となりの粒と1本の筆あとにつながるように
      const fill = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
      fill.addColorStop(0, `rgba(${cr},${cg},${cb},0.14)`);
      fill.addColorStop(0.6, `rgba(${cr},${cg},${cb},0.12)`);
      fill.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      g.fillStyle = fill;
      g.fill();
    }
  };

  const addBlob = (x: number, y: number, r: number, color: [number, number, number], dur = 1.4, grow = 0.55, rim = false) => {
    blobs.push({ x, y, r, color, age: 0, dur, seed: Math.floor(rand() * 1e6), grow, rim });
    idle = 0;
  };

  const drop = (x: number, y: number) => {
    const color = colorAt(travelled + rand() * 900);
    const r = (26 + rand() * 18) * scale;
    addBlob(x, y, r, color, 2.4, 0.9, true);
    for (let i = 0; i < 4; i++) {
      const a = rand() * Math.PI * 2, d = r * (1.4 + rand() * 0.8);
      addBlob(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.12 + rand() * 0.16), color, 1.6, 0.4, true);
    }
  };

  const drag = (x: number, y: number, start: boolean) => {
    if (start || !last) {
      last = { x, y };
      addBlob(x, y, 22 * scale, colorAt(travelled));
      return;
    }
    const d = Math.hypot(x - last.x, y - last.y);
    const spacing = 6 * scale;
    if (d < spacing) return;
    const n = Math.floor(d / spacing);
    for (let i = 1; i <= n; i++) {
      travelled += spacing;
      const k = i / n;
      addBlob(last.x + (x - last.x) * k + (rand() - 0.5) * 4, last.y + (y - last.y) * k + (rand() - 0.5) * 4, (18 + rand() * 9) * scale, colorAt(travelled));
    }
    last = { x, y };
  };

  const bake = (b: Blob) => {
    const g = context2d(dried.canvas, dried.size);
    if (!g) return;
    g.globalCompositeOperation = "multiply";
    paintBlob(g, b, 1);
    g.globalCompositeOperation = "source-over";
  };

  const step = (size: CanvasSize, dt: number) => {
    idle += dt;
    dropWait -= dt;
    if (dropWait <= 0) {
      drop(size.w * (0.1 + rand() * 0.8), size.h * (0.1 + rand() * 0.8));
      dropWait = 6 + rand() * 6;
    }
    for (const b of blobs) b.age += dt;
    const done = blobs.filter((b) => b.age >= b.dur);
    for (const b of done) bake(b);
    blobs = blobs.filter((b) => b.age < b.dur);
    // 乾いた絵は、ゆっくり薄れていく
    const g = dried.canvas.getContext("2d");
    if (g && idle < 120) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = "destination-out";
      g.fillStyle = `rgba(0,0,0,${Math.min(0.1, 0.075 * dt)})`;
      g.fillRect(0, 0, dried.canvas.width, dried.canvas.height);
      g.globalCompositeOperation = "source-over";
    }
  };

  const draw = (size: CanvasSize) => {
    const g = context2d(wet.canvas, size);
    if (!g) return;
    g.clearRect(0, 0, size.w, size.h);
    for (const b of blobs) paintBlob(g, b, b.age / b.dur);
  };

  const frame = (t: number, dt: number) => {
    const size = wet.size;
    if (still) {
      if (t === STILL_TIME) {
        // 見本：なぞった線を2本と、しずくを1つ
        const stroke = (y0: number, amp: number, from: number) => {
          last = null;
          travelled = from;
          for (let i = 0; i <= 40; i++) {
            const k = i / 40;
            drag(size.w * (0.08 + k * 0.84), size.h * (y0 + Math.sin(k * Math.PI * 2) * amp), i === 0);
          }
        };
        stroke(0.3, 0.06, 0);
        stroke(0.56, -0.05, 900 * scale);
        drop(size.w * 0.7, size.h * 0.78);
        for (const b of blobs) bake(b);
        blobs = [];
      }
      return;
    }
    step(size, dt);
    draw(size);
  };

  const stopDrag = onBackgroundDrag(host, mode, (x, y, start) => {
    if (!still) drag(x, y, start);
  });
  // なぞらずに、ぽんとタップしたときは しずく
  let downAt: { x: number; y: number; t: number } | null = null;
  const stopTap = onBackgroundTap(host, mode, (x, y) => {
    downAt = { x, y, t: performance.now() };
  });
  const onUp = (event: PointerEvent) => {
    if (!downAt || still) return;
    const quick = performance.now() - downAt.t < 260;
    const rect = host.getBoundingClientRect();
    const moved = Math.hypot(event.clientX - rect.left - downAt.x, event.clientY - rect.top - downAt.y);
    if (quick && moved < 10) drop(downAt.x, downAt.y);
    downAt = null;
  };
  if (mode !== "still") window.addEventListener("pointerup", onUp, { passive: true });
  const stop = startLoop(host, frame, { still });

  return {
    update: () => {},
    destroy: () => {
      stop();
      stopDrag();
      stopTap();
      window.removeEventListener("pointerup", onUp);
      wet.destroy();
      dried.destroy();
    },
  };
};
