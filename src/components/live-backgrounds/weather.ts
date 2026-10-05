/**
 * おそとの天気：いまの天気（ホームの天気と同じもの）を、そのまま背景にする。
 * - 空の色：時間帯（朝・昼・夕方・夜）の色に、雲の量だけ灰色をまぜる
 * - 晴れ：お日さまの光（ゆっくり回る光の筋）／夜：月と星
 * - 雲：ふわふわの雲を前もって描いておき、ゆっくり流す
 * - 雨：3段の奥行きの雨つぶと、下のほうの小さなしぶき。雷はときどき光って稲妻が走る
 * - 雪：やわらかい雪と、ときどき大きな結晶／きり：ゆっくり流れるもや
 */
import type { SkyPhase } from "@/lib/home-weather";
import type { WeatherKind } from "@/lib/room/weather";
import { skyTimeOf, type WeatherSignal } from "@/lib/app-backgrounds";
import { addCanvas, clamp, context2d, lerp, makeSprite, seededRandom, startLoop, type CanvasSize, type LiveMount } from "./engine";

type Rgb = [number, number, number];
const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const css = (c: Rgb) => `rgb(${c.map((v) => Math.round(v)).join(",")})`;

const CLEAR: Record<SkyPhase, [string, string, string]> = {
  morning: ["#f5d2c4", "#fbe5d2", "#fdf5ea"],
  day: ["#9ccdef", "#cde5f5", "#f3f6ee"],
  evening: ["#a493cf", "#eeb0a6", "#fbd4a4"],
  night: ["#121a3a", "#222a57", "#393764"],
};
const GREY: Record<SkyPhase, [string, string, string]> = {
  morning: ["#c8c3c8", "#e0dbd7", "#efebe5"],
  day: ["#b5c1cd", "#d7dde4", "#edf0f1"],
  evening: ["#8c88a4", "#c4b2b3", "#ddc7b4"],
  night: ["#1b2134", "#2b3146", "#3b4056"],
};
const SNOW_SKY: Record<SkyPhase, [string, string, string]> = {
  morning: ["#dcdde6", "#eceef2", "#f8f8f9"],
  day: ["#d5dfea", "#e8edf3", "#f7f9fb"],
  evening: ["#b7b2c8", "#d7cfd6", "#ece4e2"],
  night: ["#252c45", "#343b57", "#454b66"],
};
const OVERCAST: Record<WeatherKind, number> = { clear: 0, partly: 0.25, cloudy: 0.75, fog: 0.55, drizzle: 0.8, rain: 0.9, snow: 0.6, thunder: 1 };
const CLOUDS: Record<WeatherKind, number> = { clear: 2, partly: 5, cloudy: 8, fog: 3, drizzle: 8, rain: 9, snow: 7, thunder: 10 };

function skyOf({ kind, phase }: WeatherSignal): string {
  const base = kind === "snow" ? SNOW_SKY[phase] : CLEAR[phase];
  const o = kind === "snow" ? 0 : OVERCAST[kind];
  const stops = base.map((c, i) => {
    let rgb = mix(hex(c), hex(GREY[phase][i]!), o);
    if (kind === "thunder") rgb = mix(rgb, [40, 44, 60], 0.18);
    return css(rgb);
  });
  return `linear-gradient(180deg, ${stops[0]} 0%, ${stops[1]} 48%, ${stops[2]} 100%)`;
}

/** ふわふわの雲（白・灰色・夕焼け色） */
function makeCloud(seed: number, tone: CloudTone) {
  const W = 340;
  const H = 190;
  const rand = seededRandom(seed);
  return makeSprite(W, H, (g) => {
    const puffs: [number, number, number][] = [
      [0.3, 0.62, 0.2], [0.46, 0.44, 0.26], [0.62, 0.5, 0.22], [0.77, 0.62, 0.17], [0.17, 0.7, 0.14], [0.52, 0.68, 0.24], [0.88, 0.72, 0.11],
    ];
    const [fill, edge] = tone === "light" ? ["255,255,255", "255,255,255"] : tone === "dark" ? ["206,212,222", "176,184,198"] : ["255,233,222", "246,214,214"];
    for (const [px, py, pr] of puffs) {
      const x = W * (0.06 + (px + (rand() - 0.5) * 0.04) * 0.88);
      const y = H * (0.12 + (py + (rand() - 0.5) * 0.06) * 0.7);
      // 雲のふくらみが絵のはしで切れないように、はしまでの距離より小さくする
      const r = Math.min(W * pr * 0.9 * (0.9 + rand() * 0.2), y - 2, H - y - 2, x - 2, W - x - 2);
      const grad = g.createRadialGradient(x, y, r * 0.2, x, y, r);
      grad.addColorStop(0, `rgba(${fill},1)`);
      grad.addColorStop(0.55, `rgba(${fill},0.92)`);
      grad.addColorStop(1, `rgba(${edge},0)`);
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    // 雲の下側に、うすい影
    g.globalCompositeOperation = "source-atop";
    const shade = g.createLinearGradient(0, H * 0.3, 0, H);
    shade.addColorStop(0, "rgba(120,130,150,0)");
    shade.addColorStop(1, tone === "dark" ? "rgba(90,100,118,0.45)" : tone === "dusk" ? "rgba(170,120,150,0.35)" : "rgba(140,155,180,0.28)");
    g.fillStyle = shade;
    g.fillRect(0, 0, W, H);
  });
}

type CloudTone = "light" | "dark" | "dusk";
/** 雲・雪・月などの絵（何枚の見本を並べても、描くのは1回だけ） */
let cachedSprites: ReturnType<typeof buildWeatherSprites> | null = null;
const weatherSprites = () => (cachedSprites ??= buildWeatherSprites());

function buildWeatherSprites() {
  const clouds = {
    light: [makeCloud(1, "light"), makeCloud(2, "light"), makeCloud(3, "light")],
    dark: [makeCloud(1, "dark"), makeCloud(2, "dark"), makeCloud(3, "dark")],
    dusk: [makeCloud(1, "dusk"), makeCloud(2, "dusk"), makeCloud(3, "dusk")],
  };
  const flake = makeSprite(32, 32, (g) => {
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.45, "rgba(255,255,255,0.85)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
  });
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
  // 三日月（丸から、ずらした丸をくり抜く）
  const moon = makeSprite(64, 64, (g) => {
    const grad = g.createRadialGradient(28, 30, 2, 32, 32, 27);
    grad.addColorStop(0, "#fffaf0");
    grad.addColorStop(1, "#f6e3b4");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(32, 32, 26, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "destination-out";
    g.beginPath();
    g.arc(44, 24, 23, 0, Math.PI * 2);
    g.fill();
  });
  const glow = makeSprite(64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.3, "rgba(255,248,225,0.35)");
    grad.addColorStop(1, "rgba(255,248,225,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  });

  return { clouds, flake, crystal, moon, glow };
}

type Cloud = { x: number; y: number; w: number; speed: number; sprite: number; alpha: number; tone: CloudTone };
type Drop = { x: number; y: number; speed: number; layer: number };
type Flake = { x: number; y: number; r: number; speed: number; swayA: number; swayF: number; p: number; crystal: boolean };
type Star = { x: number; y: number; r: number; a: number; f: number; p: number };
type Splash = { x: number; y: number; born: number };
type Bolt = { points: [number, number][]; born: number };

const RAIN_LAYERS = [
  { len: 9, width: 0.8, alpha: 0.22, speed: 480 },
  { len: 14, width: 1, alpha: 0.32, speed: 640 },
  { len: 20, width: 1.3, alpha: 0.44, speed: 820 },
];

export const mount: LiveMount = (host, { mode, reducedMotion, signals }) => {
  const still = mode === "still" || reducedMotion;
  const rand = seededRandom(still ? 31 : Date.now() & 0xffff);
  const resolve = (s: WeatherSignal | null | undefined): WeatherSignal => s ?? { kind: "clear", phase: skyTimeOf(new Date()) };
  let state = resolve(signals.weather);

  const { clouds: sprites, flake, crystal, moon, glow } = weatherSprites();

  let clouds: Cloud[] = [];
  let drops: Drop[] = [];
  let flakes: Flake[] = [];
  let stars: Star[] = [];
  let splashes: Splash[] = [];
  let bolt: Bolt | null = null;
  let flashAt = -10;
  let nextFlash = 3;
  let snowpack = 0;

  const populate = ({ w, h }: CanvasSize) => {
    const { kind, phase } = state;
    const area = (w * h) / (390 * 844);
    const u = clamp(w / 390, 0.75, 1.4);
    const r = seededRandom(17);
    const n = CLOUDS[kind];
    const tone: CloudTone = kind === "cloudy" || kind === "drizzle" || kind === "rain" || kind === "thunder" ? "dark" : phase === "evening" ? "dusk" : "light";
    const night = phase === "night";
    clouds = Array.from({ length: n }, (_, i) => {
      const depth = r();
      return {
        x: r() * (w + 300) - 150,
        y: h * (n > 6 ? -0.06 + r() * 0.62 : -0.04 + r() * 0.42) + (i % 2) * 20,
        w: (150 + depth * 190) * u * (n > 6 ? 1.15 : 1),
        speed: (4 + depth * 9) * (kind === "thunder" ? 1.8 : 1),
        sprite: Math.floor(r() * 3),
        alpha: (night ? 0.32 : tone === "light" ? 0.8 : 0.88) * (0.65 + depth * 0.35),
        tone,
      };
    });
    const rainCount = kind === "drizzle" ? 70 : kind === "rain" ? 150 : kind === "thunder" ? 190 : 0;
    drops = Array.from({ length: Math.round(rainCount * area) }, () => ({ x: r() * w, y: r() * h, speed: 0.85 + r() * 0.3, layer: Math.floor(r() * 3) }));
    flakes = Array.from({ length: kind === "snow" ? Math.round(120 * area) : 0 }, () => {
      const depth = Math.pow(r(), 1.6);
      return { x: r() * w, y: r() * h, r: 0.9 + depth * 2.8, speed: 16 + depth * 40, swayA: 6 + r() * 16, swayF: 0.3 + r() * 0.8, p: r() * 6.3, crystal: r() < 0.06 };
    });
    stars = night && (kind === "clear" || kind === "partly")
      ? Array.from({ length: Math.round(110 * area) }, () => ({ x: r() * w, y: Math.pow(r(), 1.3) * h * 0.75, r: 0.4 + r() * 0.9, a: 0.4 + r() * 0.6, f: 0.6 + r() * 2, p: r() * 6.3 }))
      : [];
  };

  const layer = addCanvas(host, { onResize: populate });
  const ctx = context2d(layer.canvas, layer.size);

  const applySky = () => {
    host.style.background = skyOf(state);
  };
  applySky();

  const makeBolt = (w: number, h: number): [number, number][] => {
    let x = w * (0.2 + rand() * 0.6);
    let y = -10;
    const points: [number, number][] = [[x, y]];
    while (y < h * 0.48) {
      y += 18 + rand() * 26;
      x += (rand() - 0.5) * 46;
      points.push([x, y]);
    }
    return points;
  };

  const drawSun = (c: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    const { kind, phase } = state;
    if (phase === "night") {
      // 月（三日月）とにじみ
      const mx = w * 0.8;
      const my = h * 0.1;
      const mr = clamp(w * 0.05, 14, 26);
      const a = kind === "clear" || kind === "partly" ? 1 : 0.35;
      c.globalAlpha = 0.6 * a;
      c.drawImage(glow, mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
      c.globalAlpha = a;
      c.drawImage(moon, mx - mr * 1.23, my - mr * 1.23, mr * 2.46, mr * 2.46);
      c.globalAlpha = 1;
      return;
    }
    if (kind !== "clear" && kind !== "partly" && kind !== "cloudy") return;
    const pos = phase === "morning" ? [0.18, 0.11] : phase === "evening" ? [0.8, 0.22] : [0.84, 0.07];
    const sx = w * pos[0]!;
    const sy = h * pos[1]!;
    const sr = clamp(w * 0.08, 22, 40);
    const warm = phase === "evening" ? "255,186,130" : phase === "morning" ? "255,214,160" : "255,246,214";
    const strength = kind === "cloudy" ? 0.35 : 1;
    const halo = c.createRadialGradient(sx, sy, 0, sx, sy, w * 0.75);
    halo.addColorStop(0, `rgba(${warm},${0.55 * strength})`);
    halo.addColorStop(0.25, `rgba(${warm},${0.2 * strength})`);
    halo.addColorStop(1, `rgba(${warm},0)`);
    c.fillStyle = halo;
    c.fillRect(0, 0, w, h);
    if (kind === "cloudy") return;
    // ゆっくり回る光の筋
    c.save();
    c.translate(sx, sy);
    c.rotate(t * 0.025);
    c.globalCompositeOperation = "lighter";
    for (let k = 0; k < 12; k += 1) {
      c.rotate((Math.PI * 2) / 12);
      const len = w * (k % 2 ? 0.55 : 0.85);
      const ray = c.createLinearGradient(0, 0, len, 0);
      ray.addColorStop(0, `rgba(${warm},0.12)`);
      ray.addColorStop(0.6, `rgba(${warm},0.04)`);
      ray.addColorStop(1, `rgba(${warm},0)`);
      c.fillStyle = ray;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(len, -len * 0.11);
      c.lineTo(len, len * 0.11);
      c.closePath();
      c.fill();
    }
    c.restore();
    const disk = c.createRadialGradient(sx, sy, 0, sx, sy, sr);
    disk.addColorStop(0, "rgba(255,255,250,1)");
    disk.addColorStop(0.7, `rgba(${warm},0.95)`);
    disk.addColorStop(1, `rgba(${warm},0)`);
    c.fillStyle = disk;
    c.beginPath();
    c.arc(sx, sy, sr, 0, Math.PI * 2);
    c.fill();
  };

  const frame = (t: number, dt: number) => {
    if (!ctx) return;
    const { w, h, dpr } = layer.size;
    const { kind, phase } = state;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    for (const s of stars) {
      ctx.fillStyle = `rgba(255,255,255,${s.a * (0.6 + 0.4 * Math.sin(t * s.f + s.p))})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    drawSun(ctx, w, h, t);

    for (const cl of clouds) {
      cl.x -= cl.speed * dt;
      if (cl.x < -cl.w - 40) cl.x = w + 40 + rand() * 120;
      ctx.globalAlpha = cl.alpha;
      ctx.drawImage(sprites[cl.tone][cl.sprite]!, cl.x, cl.y, cl.w, cl.w * (190 / 340));
    }
    ctx.globalAlpha = 1;

    if (kind === "fog") {
      for (let k = 0; k < 4; k += 1) {
        const y = h * (0.2 + k * 0.22);
        const x = ((t * (6 + k * 3) + k * 170) % (w + 400)) - 200;
        const band = ctx.createRadialGradient(x, y, 0, x, y, w * 0.8);
        band.addColorStop(0, "rgba(255,255,255,0.45)");
        band.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = band;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(0, 0, w, h);
    }

    if (drops.length) {
      const color = phase === "night" ? "205,218,240" : "92,110,138";
      const slant = 0.2;
      RAIN_LAYERS.forEach((rl, li) => {
        ctx.strokeStyle = `rgba(${color},${rl.alpha})`;
        ctx.lineWidth = rl.width;
        ctx.lineCap = "round";
        ctx.beginPath();
        for (const d of drops) {
          if (d.layer !== li) continue;
          const v = rl.speed * d.speed;
          d.y += v * dt;
          d.x -= v * slant * dt;
          if (d.y > h + 20) {
            d.y = -20 - rand() * 40;
            d.x = rand() * (w + 60);
          }
          if (d.x < -20) d.x += w + 40;
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + rl.len * slant, d.y - rl.len);
        }
        ctx.stroke();
      });
      // 下のほうの小さなしぶき
      if (dt > 0 && rand() < (kind === "drizzle" ? 0.35 : 0.85)) splashes.push({ x: rand() * w, y: h - 4 - rand() * 70, born: t });
      if (still) for (let k = 0; k < 10; k += 1) splashes.push({ x: rand() * w, y: h - 4 - rand() * 70, born: t - rand() * 0.3 });
      ctx.strokeStyle = `rgba(${color},0.4)`;
      ctx.lineWidth = 0.9;
      splashes = splashes.filter((s) => t - s.born < 0.35);
      for (const s of splashes) {
        const p = (t - s.born) / 0.35;
        ctx.globalAlpha = 1 - p;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, 2 + p * 6, 0.8 + p * 1.8, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    if (kind === "thunder") {
      if (!still && t >= nextFlash) {
        flashAt = t;
        bolt = { points: makeBolt(w, h), born: t };
        nextFlash = t + 6 + rand() * 7;
      }
      const age = still ? 0.05 : t - flashAt;
      const flash = age < 0 ? 0 : Math.max(0, 1 - age / 0.12) * 0.5 + (age > 0.18 && age < 0.34 ? (1 - Math.abs(age - 0.26) / 0.08) * 0.35 : 0);
      if (still && !bolt) bolt = { points: makeBolt(w, h), born: 0 };
      if (bolt && (still || t - bolt.born < 0.3)) {
        ctx.strokeStyle = "rgba(255,255,240,0.35)";
        ctx.lineWidth = 6;
        ctx.lineJoin = "round";
        ctx.beginPath();
        bolt.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,250,0.95)";
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      if (flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${clamp(flash, 0, 0.55)})`;
        ctx.fillRect(0, 0, w, h);
      }
    }

    if (flakes.length) {
      for (const f of flakes) {
        f.y += f.speed * dt;
        if (f.y > h + 10) {
          f.y = -10;
          f.x = rand() * w;
        }
        const x = f.x + Math.sin(t * f.swayF + f.p) * f.swayA;
        if (f.crystal) {
          ctx.save();
          ctx.translate(x, f.y);
          ctx.rotate(t * 0.4 + f.p);
          ctx.globalAlpha = 0.85;
          ctx.drawImage(crystal, -9, -9, 18, 18);
          ctx.restore();
        } else {
          ctx.globalAlpha = 0.92;
          ctx.drawImage(flake, x - f.r * 2, f.y - f.r * 2, f.r * 4, f.r * 4);
        }
      }
      ctx.globalAlpha = 1;
      // 画面の下に、すこしずつ雪がつもる
      snowpack = still ? 16 : Math.min(18, snowpack + dt * 0.12);
      if (snowpack > 0.5) {
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w + 8; x += 8) ctx.lineTo(x, h - snowpack - Math.sin(x * 0.05) * 3 - Math.sin(x * 0.013 + 1) * 4);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
      }
    }
  };

  const stop = startLoop(host, frame, { still });

  return {
    update: (next) => {
      const s = resolve(next.weather);
      if (s.kind === state.kind && s.phase === state.phase) return;
      state = s;
      applySky();
      populate(layer.size);
      if (still) frame(14, 0);
    },
    destroy: () => {
      stop();
      layer.destroy();
      host.style.background = "";
    },
  };
};
