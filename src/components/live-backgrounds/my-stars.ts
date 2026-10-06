/**
 * おでかけ星図：夜空に、日本じゅうの市区町村が かすかな星くずになって日本の形を描き、
 * あなたが行った市区町村は明るい星になる（たくさん行った町ほど大きい）。同じ県の星どうしは線でつながって、
 * あなただけの星座に。ときどき流れ星。タップすると、いちばん近い星がきらっと光る。
 */
import { MUNICIPALITIES, PREFECTURES, projectPoint, viewBoxFor } from "@/lib/geo";
import type { RecordsKind } from "@/lib/app-backgrounds";
import { addCanvas, clamp, context2d, makeSprite, onBackgroundTap, seededRandom, startLoop, STILL_TIME, type CanvasSize, type LiveMount } from "./engine";
import { loadPlaces, placesAreStale, type PlaceData } from "./records";

type Star = { x: number; y: number; size: number; phase: number; speed: number; flare: number };
type Meteor = { x: number; y: number; vx: number; vy: number; life: number };

const VIEW = viewBoxFor(PREFECTURES, "national").split(" ").map(Number) as [number, number, number, number];
let cachedPaths: Map<string, Path2D> | null = null;
const paths = () => (cachedPaths ??= new Map(PREFECTURES.map((p) => [p.code, new Path2D(p.d)])));

let cachedGlow: HTMLCanvasElement | null = null;
const glowSprite = () =>
  (cachedGlow ??= makeSprite(64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.1, "rgba(255,246,214,0.95)");
    grad.addColorStop(0.3, "rgba(255,226,160,0.35)");
    grad.addColorStop(1, "rgba(255,210,140,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }));

export const mount: LiveMount = (host, { mode, reducedMotion, signals }) => {
  const still = mode === "still" || reducedMotion;
  const rand = seededRandom(still ? 3 : Date.now() & 0xffff);
  const glow = glowSprite();
  let kind: RecordsKind = signals.records ?? "mine";
  let places: PlaceData | null = null;
  let dirty = true;
  let fit = { k: 1, ox: 0, oy: 0 };
  let stars: Star[] = [];
  let meteors: Meteor[] = [];
  let meteorWait = 4;
  let scale = 1;
  let alive = true;

  const sky = addCanvas(host, {
    onResize: (size) => {
      scale = clamp(size.w / 390, 0.8, 1.4);
      const [, , vw, vh] = VIEW;
      const k = Math.min((size.w * 1.02) / vw, (size.h * 0.8) / vh);
      fit = { k, ox: (size.w - vw * k) / 2, oy: size.h * 0.45 - (vh * k) / 2 };
      dirty = true;
    },
  });
  const layer = addCanvas(host);

  const toScreen = (mx: number, my: number): [number, number] => [fit.ox + (mx - VIEW[0]) * fit.k, fit.oy + (my - VIEW[1]) * fit.k];

  function paintSky(size: CanvasSize) {
    const g = context2d(sky.canvas, size);
    if (!g) return;
    const r = seededRandom(19);
    g.clearRect(0, 0, size.w, size.h);
    // 遠くの星
    for (let i = 0; i < 120; i++) {
      g.fillStyle = `rgba(220,226,255,${0.12 + r() * 0.35})`;
      g.beginPath(); g.arc(r() * size.w, r() * size.h, r() * 0.9 + 0.2, 0, Math.PI * 2); g.fill();
    }
    const visitedPrefs = places?.prefectures ?? {};
    // 行った県のふちを、うっすら光らせる
    const { dpr } = size;
    g.setTransform(dpr * fit.k, 0, 0, dpr * fit.k, dpr * (fit.ox - VIEW[0] * fit.k), dpr * (fit.oy - VIEW[1] * fit.k));
    const shapes = paths();
    for (const p of PREFECTURES) {
      const path = shapes.get(p.code)!;
      if (visitedPrefs[p.code]) {
        g.fillStyle = "rgba(140,170,255,0.07)";
        g.fill(path);
        g.strokeStyle = "rgba(170,195,255,0.28)";
        g.lineWidth = 0.9 / fit.k;
      } else {
        g.strokeStyle = "rgba(150,170,230,0.07)";
        g.lineWidth = 0.6 / fit.k;
      }
      g.stroke(path);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 日本じゅうの町の星くず
    const visited = places?.municipalities ?? {};
    const byPref = new Map<string, { x: number; y: number; count: number }[]>();
    for (const m of MUNICIPALITIES) {
      if (m.lat === null || m.lng === null) continue;
      const [x, y] = toScreen(...projectPoint(m.lat, m.lng, "national", m.prefectureCode));
      const count = visited[m.code] ?? 0;
      if (count > 0) {
        const list = byPref.get(m.prefectureCode) ?? [];
        list.push({ x, y, count });
        byPref.set(m.prefectureCode, list);
      } else {
        g.fillStyle = `rgba(190,205,255,${0.14 + r() * 0.16})`;
        g.fillRect(x - 0.5, y - 0.5, 1.1, 1.1);
      }
    }
    // 県ごとの星座の線（いちばん短い線でぜんぶをつなぐ）
    g.strokeStyle = "rgba(190,210,255,0.32)";
    g.lineWidth = 0.8;
    stars = [];
    for (const list of byPref.values()) {
      const inTree = [0];
      const rest = new Set(list.map((_, i) => i).slice(1));
      while (rest.size) {
        let best: [number, number, number] | null = null;
        for (const a of inTree) {
          for (const b of rest) {
            const d = Math.hypot(list[a]!.x - list[b]!.x, list[a]!.y - list[b]!.y);
            if (!best || d < best[2]) best = [a, b, d];
          }
        }
        if (!best) break;
        const [a, b, d] = best;
        // 遠すぎる星どうしは、つながない
        if (d < 60 * scale) {
          g.beginPath(); g.moveTo(list[a]!.x, list[a]!.y); g.lineTo(list[b]!.x, list[b]!.y); g.stroke();
        }
        inTree.push(b);
        rest.delete(b);
      }
      for (const s of list) {
        stars.push({ x: s.x, y: s.y, size: (5 + Math.min(4, Math.log2(s.count + 1)) * 3.2) * scale, phase: r() * 6, speed: 0.8 + r() * 1.6, flare: 0 });
      }
    }
  }

  const step = (size: CanvasSize, dt: number) => {
    meteorWait -= dt;
    if (meteorWait <= 0) {
      const sp = (380 + rand() * 200) * scale;
      const a = Math.PI * (0.15 + rand() * 0.15);
      meteors.push({ x: size.w * (0.2 + rand() * 0.9), y: -10, vx: -Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 });
      meteorWait = 7 + rand() * 9;
    }
    for (const m of meteors) { m.x += m.vx * dt; m.y += m.vy * dt; m.life -= dt * 0.9; }
    meteors = meteors.filter((m) => m.life > 0);
    for (const s of stars) { s.phase += dt * s.speed; s.flare = Math.max(0, s.flare - dt * 0.8); }
  };

  const draw = (size: CanvasSize) => {
    if (dirty && places) {
      dirty = false;
      paintSky(sky.size);
    }
    const g = context2d(layer.canvas, size);
    if (!g) return;
    g.clearRect(0, 0, size.w, size.h);
    g.globalCompositeOperation = "lighter";
    for (const s of stars) {
      const tw = 0.7 + Math.sin(s.phase) * 0.3;
      const d = s.size * (tw + s.flare * 2.4);
      g.globalAlpha = clamp(0.55 + tw * 0.45, 0, 1);
      g.drawImage(glow, s.x - d / 2, s.y - d / 2, d, d);
      if (s.flare > 0) {
        // 十字の光
        g.strokeStyle = `rgba(255,240,200,${s.flare * 0.8})`;
        g.lineWidth = 1;
        const L = d * 0.9;
        g.beginPath(); g.moveTo(s.x - L, s.y); g.lineTo(s.x + L, s.y); g.moveTo(s.x, s.y - L); g.lineTo(s.x, s.y + L); g.stroke();
      }
    }
    g.globalAlpha = 1;
    for (const m of meteors) {
      const tail = g.createLinearGradient(m.x, m.y, m.x - m.vx * 0.18, m.y - m.vy * 0.18);
      tail.addColorStop(0, `rgba(255,255,255,${m.life})`);
      tail.addColorStop(1, "rgba(255,255,255,0)");
      g.strokeStyle = tail;
      g.lineWidth = 1.6 * scale;
      g.beginPath(); g.moveTo(m.x, m.y); g.lineTo(m.x - m.vx * 0.18, m.y - m.vy * 0.18); g.stroke();
    }
    g.globalCompositeOperation = "source-over";
  };

  const load = () => {
    void loadPlaces(kind).then((data) => {
      if (!alive) return;
      places = data;
      dirty = true;
      if (still) draw(layer.size);
    });
  };
  load();

  const frame = (t: number, dt: number) => {
    if (still) {
      if (t === STILL_TIME && places) draw(layer.size);
      return;
    }
    step(layer.size, dt);
    draw(layer.size);
  };
  const onVisible = () => {
    if (document.visibilityState === "visible" && kind === "mine" && placesAreStale()) load();
  };
  document.addEventListener("visibilitychange", onVisible);
  const stopTap = onBackgroundTap(host, mode, (x, y) => {
    if (still) return;
    let best: Star | null = null;
    let bestD = 120 * scale;
    for (const s of stars) {
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bestD) { best = s; bestD = d; }
    }
    if (best) best.flare = 1;
    else meteors.push({ x, y, vx: -260 * scale, vy: 160 * scale, life: 0.8 });
  });
  const stop = startLoop(host, frame, { still, fps: 24 });

  return {
    update: (next) => {
      const nextKind = next.records ?? "mine";
      if (nextKind === kind) return;
      kind = nextKind;
      load();
    },
    destroy: () => {
      alive = false;
      stop();
      stopTap();
      document.removeEventListener("visibilitychange", onVisible);
      layer.destroy();
      sky.destroy();
    },
  };
};
