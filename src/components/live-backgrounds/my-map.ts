/**
 * あなたの日本地図：行った都道府県が、地方ごとの水彩の色で色づく。たくさん行った県ほど濃く、
 * 行った市区町村には小さな点。いちばんよく行った場所には、ピンが立って ゆれる。
 * 地図は記録か大きさが変わったときだけ描きなおし、毎回はピンと光だけを描く。
 */
import { MAP_INSETS, MUNICIPALITIES, PREFECTURES, projectPoint, viewBoxFor } from "@/lib/geo";
import type { RecordsKind } from "@/lib/app-backgrounds";
import { addCanvas, clamp, context2d, startLoop, STILL_TIME, type CanvasSize, type LiveMount } from "./engine";
import { loadPlaces, placesAreStale, type PlaceData } from "./records";

const TONES: Record<string, [number, number, number]> = {
  pink: [240, 160, 178], green: [150, 200, 128], blue: [138, 186, 228], yellow: [240, 200, 98],
  purple: [180, 158, 226], orange: [242, 168, 112], teal: [122, 200, 190], rose: [232, 138, 162],
};

const VIEW = viewBoxFor(PREFECTURES, "national").split(" ").map(Number) as [number, number, number, number];
let cachedPaths: Map<string, Path2D> | null = null;
const paths = () => (cachedPaths ??= new Map(PREFECTURES.map((p) => [p.code, new Path2D(p.d)])));
const MUNI_BY_CODE = new Map(MUNICIPALITIES.map((m) => [m.code, m]));

const levelOf = (count: number) => (count <= 1 ? 1 : count <= 3 ? 2 : count <= 7 ? 3 : 4);

export const mount: LiveMount = (host, { mode, reducedMotion, signals }) => {
  const still = mode === "still" || reducedMotion;
  let kind: RecordsKind = signals.records ?? "mine";
  let places: PlaceData | null = null;
  let dirty = true;
  let fit = { k: 1, ox: 0, oy: 0 };
  let pins: { x: number; y: number; color: string; delay: number }[] = [];
  let scale = 1;
  let clock = 0;
  let alive = true;

  const map = addCanvas(host, {
    onResize: (size) => {
      scale = clamp(size.w / 390, 0.8, 1.4);
      const [, , vw, vh] = VIEW;
      // 上のヘッダーと下のナビに少しかかってもいいように、画面のまん中より少し上に大きく置く
      const k = Math.min((size.w * 1.02) / vw, (size.h * 0.8) / vh);
      fit = { k, ox: (size.w - vw * k) / 2, oy: size.h * 0.45 - (vh * k) / 2 };
      dirty = true;
    },
  });
  const layer = addCanvas(host);

  const toScreen = (mx: number, my: number): [number, number] => [fit.ox + (mx - VIEW[0]) * fit.k, fit.oy + (my - VIEW[1]) * fit.k];

  function paintMap(size: CanvasSize) {
    const g = context2d(map.canvas, size);
    if (!g) return;
    g.clearRect(0, 0, size.w, size.h);
    // 方眼（地図の紙らしく）
    g.strokeStyle = "rgba(150,130,100,0.07)";
    g.lineWidth = 1;
    for (let x = (fit.ox % (36 * scale)); x < size.w; x += 36 * scale) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, size.h); g.stroke(); }
    for (let y = (fit.oy % (36 * scale)); y < size.h; y += 36 * scale) { g.beginPath(); g.moveTo(0, y); g.lineTo(size.w, y); g.stroke(); }

    const visited = places?.prefectures ?? {};
    const shapes = paths();
    const { dpr } = size;
    const setMap = (dx = 0, dy = 0) => g.setTransform(dpr * fit.k, 0, 0, dpr * fit.k, dpr * (fit.ox - VIEW[0] * fit.k + dx), dpr * (fit.oy - VIEW[1] * fit.k + dy));
    // 地図の影
    setMap(2 * scale, 3 * scale);
    g.fillStyle = "rgba(120,100,70,0.12)";
    for (const p of PREFECTURES) g.fill(shapes.get(p.code)!);
    setMap();
    g.lineJoin = "round";
    for (const p of PREFECTURES) {
      const path = shapes.get(p.code)!;
      const count = visited[p.code] ?? 0;
      if (count > 0) {
        const [r, gg, b] = TONES[p.region.tone] ?? TONES.green!;
        const a = [0, 0.42, 0.56, 0.7, 0.84][levelOf(count)]!;
        g.fillStyle = `rgba(${r},${gg},${b},${a})`;
        g.fill(path);
        // 水彩のふち（少し濃い色）
        g.strokeStyle = `rgba(${Math.round(r * 0.75)},${Math.round(gg * 0.75)},${Math.round(b * 0.75)},0.55)`;
        g.lineWidth = 1.4 / fit.k;
        g.stroke(path);
      } else {
        g.fillStyle = "rgba(244,238,224,0.92)";
        g.fill(path);
        g.strokeStyle = "rgba(196,180,150,0.7)";
        g.lineWidth = 0.8 / fit.k;
        g.stroke(path);
      }
    }
    // 離島の枠
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.setLineDash([4, 3]);
    g.strokeStyle = "rgba(160,140,110,0.45)";
    g.lineWidth = 1;
    for (const inset of MAP_INSETS) {
      const frame = inset.frames.national;
      if (!frame) continue;
      const [x, y] = toScreen(frame[0], frame[1]);
      g.strokeRect(x, y, frame[2] * fit.k, frame[3] * fit.k);
    }
    g.setLineDash([]);
    // 行った市区町村の点
    const top: { x: number; y: number; count: number; color: string }[] = [];
    for (const [code, count] of Object.entries(places?.municipalities ?? {})) {
      const m = MUNI_BY_CODE.get(code);
      if (!m || m.lat === null || m.lng === null) continue;
      const [x, y] = toScreen(...projectPoint(m.lat, m.lng, "national", m.prefectureCode));
      const pref = PREFECTURES.find((p) => p.code === m.prefectureCode);
      const [r, gg, b] = TONES[pref?.region.tone ?? "green"]!;
      const dark = `rgb(${Math.round(r * 0.55)},${Math.round(gg * 0.55)},${Math.round(b * 0.55)})`;
      g.fillStyle = "rgba(255,255,255,0.9)";
      g.beginPath(); g.arc(x, y, 2.4 * scale, 0, Math.PI * 2); g.fill();
      g.fillStyle = dark;
      g.beginPath(); g.arc(x, y, 1.5 * scale, 0, Math.PI * 2); g.fill();
      top.push({ x, y, count, color: dark });
    }
    top.sort((a, b) => b.count - a.count);
    pins = top.slice(0, 5).map((p, i) => ({ x: p.x, y: p.y, color: i === 0 ? "#e5604f" : "#f08a5d", delay: i * 0.35 }));
  }

  const drawPin = (g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) => {
    g.fillStyle = "rgba(80,60,40,0.22)";
    g.beginPath(); g.ellipse(x + 1, y + 1, 4 * s, 1.6 * s, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#8a7d6c";
    g.lineWidth = 1.4 * s;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 14 * s); g.stroke();
    g.fillStyle = color;
    g.beginPath(); g.arc(x, y - 16 * s, 5 * s, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,255,255,0.7)";
    g.beginPath(); g.arc(x - 1.6 * s, y - 17.6 * s, 1.6 * s, 0, Math.PI * 2); g.fill();
  };

  const draw = (size: CanvasSize) => {
    if (dirty && places) {
      dirty = false;
      paintMap(map.size);
    }
    const g = context2d(layer.canvas, size);
    if (!g) return;
    g.clearRect(0, 0, size.w, size.h);
    for (const pin of pins) {
      // 1つずつ、上から落ちてきて立つ。立ったあとは小さくゆれる
      const k = clamp((clock - pin.delay) / 0.5, 0, 1);
      if (k <= 0) continue;
      const drop = (1 - k) * (1 - k) * 40 * scale;
      const sway = Math.sin(clock * 1.6 + pin.delay * 3) * 1.2 * scale * k;
      g.globalAlpha = k;
      drawPin(g, pin.x + sway * 0.3, pin.y - drop - Math.max(0, Math.sin(clock * 1.6 + pin.delay * 3)) * 1.5 * scale, scale, pin.color);
    }
    g.globalAlpha = 1;
  };

  const load = () => {
    void loadPlaces(kind).then((data) => {
      if (!alive) return;
      places = data;
      dirty = true;
      clock = 0;
      if (still) {
        clock = 10;
        draw(layer.size);
      }
    });
  };
  load();

  const frame = (t: number, dt: number) => {
    if (still) {
      if (t === STILL_TIME && places) {
        clock = 10;
        draw(layer.size);
      }
      return;
    }
    clock += dt;
    draw(layer.size);
  };
  // 記録を足して戻ってきたときに、地図も新しくする
  const onVisible = () => {
    if (document.visibilityState === "visible" && kind === "mine" && placesAreStale()) load();
  };
  document.addEventListener("visibilitychange", onVisible);
  const stop = startLoop(host, frame, { still, fps: 20 });

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
      document.removeEventListener("visibilitychange", onVisible);
      layer.destroy();
      map.destroy();
    },
  };
};
