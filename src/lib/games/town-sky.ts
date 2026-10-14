import { MAP_SIZE } from "./town-builder";
import { mixColor, type TownEnvironment } from "./town-environment";

/**
 * Screen-space sky and weather layers. All motion is a function of the scene clock and fixed seeds,
 * so a frame can be reproduced exactly (tests compare frames) and nothing allocates per particle.
 */
type Point = { x: number; y: number };
const TAU = Math.PI * 2;
const hash = (n: number) => { const v = Math.sin(n * 91.17 + 47.3) * 24634.6345; return v - Math.floor(v); };
const iso = (x: number, y: number, z = 0): Point => ({ x: (x - y) * 32, y: (x + y) * 16 - z });
const rgba = (hex: string, alpha: number) => `rgba(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(",")},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;

/** The sky is a distant backdrop: its horizon stays put while the town is panned and zoomed. */
export function skyHorizon(height: number) {
  return height * .44;
}
/** East is screen-left and west screen-right: the town looks south, where the sun crosses the sky. */
function celestial(width: number, horizon: number, altitude: number, azimuth: number) {
  const across = Math.max(-1.2, Math.min(1.2, (((azimuth - 180) % 360 + 540) % 360 - 180) / 120));
  return { x: width * (.5 + across * .42), y: horizon - Math.max(-.2, altitude) / 70 * Math.max(60, horizon - 26) };
}
export function cloudColors(env: TownEnvironment) {
  const day = 1 - env.night, dark = env.weather === "thunder" ? .55 : env.weather === "rain" ? .38 : env.weather === "drizzle" || env.weather === "snow" ? .22 : env.weather === "cloudy" || env.weather === "fog" ? .12 : 0;
  let light = mixColor("#ffffff", "#c9cdd3", dark * 1.6), shadow = mixColor("#dfe6ef", "#8f99a5", dark * 1.5);
  light = mixColor(light, "#ffd6bf", env.warm * .7 * day); shadow = mixColor(shadow, "#c58f9c", env.warm * .6 * day);
  light = mixColor(light, "#454f75", env.night * .86); shadow = mixColor(shadow, "#1d2442", env.night * .9);
  const rim = mixColor(mixColor("#ffffff", "#ffe2c8", env.warm * day), "#8f9bc4", env.night);
  return { light, shadow, rim };
}
/** One stylised cumulus: rounded tops on a flat, shaded base, with a bright rim towards the light. */
function cloud(c: CanvasRenderingContext2D, x: number, y: number, size: number, seed: number, colors: { light: string; shadow: string; rim: string }, alpha: number) {
  const parts = 4 + Math.floor(hash(seed) * 3), puffs: { x: number; y: number; r: number }[] = [];
  for (let j = 0; j < parts; j++) {
    // A tall centre and lower shoulders: the familiar cumulus silhouette.
    const u = (j / (parts - 1) - .5) * 2, r = size * (.34 + .42 * (1 - Math.abs(u)) ** 1.4) * (.85 + hash(seed + j * 7) * .3);
    puffs.push({ x: x + u * size * 1.15, y: y - r * .62 - (1 - Math.abs(u)) * size * .16, r });
  }
  puffs.push({ x: x - size * .2 + hash(seed) * size * .4, y: y - size * .78, r: size * .46 });
  c.save(); c.globalAlpha *= alpha;
  c.beginPath(); c.rect(x - size * 3, y - size * 3, size * 6, size * 3); c.clip();
  const body = c.createLinearGradient(0, y - size * 1.2, 0, y);
  body.addColorStop(0, colors.light); body.addColorStop(.55, colors.light); body.addColorStop(1, colors.shadow);
  c.fillStyle = body; c.beginPath();
  for (const p of puffs) { c.moveTo(p.x + p.r, p.y); c.arc(p.x, p.y, p.r, 0, TAU); }
  c.fill();
  c.fillStyle = colors.rim; c.globalAlpha *= .55; c.beginPath();
  for (const p of puffs) { c.moveTo(p.x + p.r * .55, p.y - p.r * .45); c.arc(p.x - p.r * .18, p.y - p.r * .45, p.r * .62, 0, TAU); }
  c.fill();
  c.restore();
}
/** The moon's lit part only, with a faint earthshine on the rest of the disc. */
function moon(c: CanvasRenderingContext2D, p: Point, r: number, phase: number, glow: number) {
  const halo = c.createRadialGradient(p.x, p.y, r * .6, p.x, p.y, r * 4.2);
  halo.addColorStop(0, `rgba(240,236,210,${.2 * glow})`); halo.addColorStop(1, "rgba(240,236,210,0)");
  c.fillStyle = halo; c.beginPath(); c.arc(p.x, p.y, r * 4.2, 0, TAU); c.fill();
  c.fillStyle = "rgba(200,206,226,.07)"; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill();
  const waxing = phase < .5, k = Math.cos(phase * TAU);
  c.save(); c.translate(p.x, p.y); if (!waxing) c.scale(-1, 1);
  // Right half of the disc, back along the terminator: a crescent when k > 0, gibbous when k < 0.
  c.fillStyle = "#f4eed3"; c.beginPath(); c.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
  c.ellipse(0, 0, Math.max(.01, Math.abs(k) * r), r, 0, Math.PI / 2, -Math.PI / 2, k > 0); c.fill();
  c.globalAlpha = .16; c.fillStyle = "#c9c3a6";
  for (const [u, v, s] of [[.3, -.2, .2], [.45, .3, .14], [.12, -.45, .11]] as const) { c.beginPath(); c.arc(u * r * (k > 0 ? 1 : .5), v * r, s * r, 0, TAU); c.fill(); }
  c.restore();
}
function bird(c: CanvasRenderingContext2D, x: number, y: number, s: number, flap: number) {
  const w = Math.sin(flap) * .8;
  c.moveTo(x - s, y - s * (.15 + w * .55)); c.quadraticCurveTo(x - s * .45, y - s * (.45 + w * .2), x, y);
  c.quadraticCurveTo(x + s * .45, y - s * (.45 + w * .2), x + s, y - s * (.15 + w * .55));
}
/** Sky, sun or moon, stars, distant clouds and birds, behind the town. */
export function drawSky(c: CanvasRenderingContext2D, width: number, height: number, env: TownEnvironment, time: number, horizon: number, reduced: boolean) {
  new SkyPainter(null).draw(c, width, height, env, time, horizon, reduced);
}
function skyBackground(c: CanvasRenderingContext2D, width: number, height: number, env: TownEnvironment, horizon: number) {
  const g = c.createLinearGradient(0, 0, 0, Math.max(horizon * 1.35, height * .5));
  g.addColorStop(0, env.skyTop); g.addColorStop(1, env.skyBottom);
  c.fillStyle = g; c.fillRect(0, 0, width, height);
  const visibleSun = 1 - env.overcast * .85;
  if (env.sun.altitude > -6) {
    const p = celestial(width, horizon, env.sun.altitude, env.sun.azimuth), low = Math.max(0, 1 - env.sun.altitude / 25), r = 150 + low * 120;
    const glow = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r), tone = mixColor("#fff6dc", "#ffb27a", low);
    glow.addColorStop(0, rgba(tone, .55 * visibleSun)); glow.addColorStop(.35, rgba(tone, .18 * visibleSun)); glow.addColorStop(1, rgba(tone, 0));
    c.fillStyle = glow; c.fillRect(p.x - r, p.y - r, r * 2, r * 2);
  }
  if (env.overcast > .45) {
    // A low ceiling of grey cloud for overcast, rainy and snowy weather.
    const colors = cloudColors(env), deck = c.createLinearGradient(0, 0, 0, horizon * 1.2);
    deck.addColorStop(0, rgba(colors.shadow, Math.min(.85, (env.overcast - .4) * 1.4))); deck.addColorStop(1, rgba(colors.light, 0));
    c.fillStyle = deck; c.fillRect(0, 0, width, horizon * 1.2);
  }
}
/**
 * Paints the sky. The soft background (gradient, sun glow, cloud ceiling) changes only minute to minute,
 * so it is kept in a small canvas and scaled up; each cloud is a cached sprite that drifts every frame.
 */
export class SkyPainter {
  private background: HTMLCanvasElement | null = null;
  private backgroundKey = "";
  private readonly clouds = new Map<string, HTMLCanvasElement>();
  constructor(private readonly create: (() => HTMLCanvasElement) | null) {}
  draw(c: CanvasRenderingContext2D, width: number, height: number, env: TownEnvironment, time: number, horizon: number, reduced: boolean) {
    const ratio = Math.max(1, c.getTransform?.()?.a ?? 1);
    const key = [Math.round(width), Math.round(height), ratio, env.skyTop, env.skyBottom, Math.round(env.sun.altitude * 2), Math.round(env.sun.azimuth), env.overcast.toFixed(2), env.warm.toFixed(2), env.night.toFixed(2), Math.round(horizon)].join("|");
    if (this.create) {
      // Kept at screen resolution, so each frame is a plain copy rather than a scaled redraw.
      const scale = ratio, w = Math.max(1, Math.ceil(width * scale)), h = Math.max(1, Math.ceil(height * scale));
      if (!this.background) this.background = this.create();
      const bg = this.background, context = bg.getContext("2d");
      if (context && key !== this.backgroundKey) {
        if (bg.width !== w) bg.width = w;
        if (bg.height !== h) bg.height = h;
        context.setTransform(scale, 0, 0, scale, 0, 0); skyBackground(context, width, height, env, horizon); this.backgroundKey = key;
      }
      if (context) c.drawImage(bg, 0, 0, w, h, 0, 0, width, height);
      else skyBackground(c, width, height, env, horizon);
    } else skyBackground(c, width, height, env, horizon);
    if (env.stars > .02) {
      c.fillStyle = "#fffbe9";
      const field = Math.round(160 + width * height / 2600);
      for (let j = 0; j < field; j++) {
        const x = hash(j * 3 + 1) * width, y = hash(j * 5 + 2) * Math.max(horizon * 1.4, height * .55), twinkle = reduced ? .8 : .55 + .45 * Math.sin(time * (1.2 + hash(j) * 2.4) + j);
        c.globalAlpha = env.stars * twinkle * (.3 + hash(j * 7) * .7) * Math.max(0, 1 - y / (horizon * 1.5));
        if (c.globalAlpha < .03) continue;
        const r = hash(j * 11) > .94 ? 1.6 : hash(j * 13) > .6 ? 1 : .7; c.fillRect(x - r / 2, y - r / 2, r, r);
      }
      c.globalAlpha = 1;
    }
    const visibleSun = 1 - env.overcast * .85;
    if (env.sun.altitude > -1.5 && visibleSun > .2) {
      const p = celestial(width, horizon, env.sun.altitude, env.sun.azimuth), low = Math.max(0, 1 - env.sun.altitude / 25);
      c.fillStyle = rgba(mixColor("#fffbea", "#ffc58e", low), visibleSun); c.beginPath(); c.arc(p.x, p.y, 13, 0, TAU); c.fill();
    }
    if (env.moon.altitude > -3 && env.night > .15) {
      const p = celestial(width, horizon, env.moon.altitude, env.moon.azimuth), lit = Math.sin(env.moon.phase * Math.PI);
      c.save(); c.globalAlpha = Math.min(1, env.night * 1.4) * (1 - env.overcast * .8);
      if (lit > .04) moon(c, p, 10, env.moon.phase, lit);
      c.restore();
    }
    // Distant clouds sit on the horizon line and drift with the real wind.
    const colors = cloudColors(env), count = Math.round(2 + env.cloud * 9), drift = (env.wind * .9 + 4) * Math.cos(env.windAngle) * (reduced ? 0 : 1), alpha = .78 + env.cloud * .2;
    for (let j = 0; j < count; j++) {
      const span = width + 520, x = ((hash(j * 13) * span + time * drift * (.6 + hash(j) * .5)) % span + span) % span - 260;
      const depth = hash(j * 17), y = horizon * (.2 + depth * .78), size = (14 + hash(j * 19) * 18 + env.cloud * 10) * (.6 + depth * .6);
      if (!this.create) { cloud(c, x, y, size, j * 31 + 5, colors, alpha); continue; }
      const cloudKey = `${j}|${Math.round(size)}|${colors.light}|${colors.shadow}|${colors.rim}|${alpha.toFixed(2)}`;
      let sprite = this.clouds.get(cloudKey);
      if (!sprite) {
        sprite = this.create(); const s = Math.round(size), context = sprite.getContext("2d");
        sprite.width = s * 12; sprite.height = s * 6;
        if (context) { context.setTransform(2, 0, 0, 2, 0, 0); cloud(context, s * 3, s * 3, s, j * 31 + 5, colors, alpha); }
        if (this.clouds.size > 48) this.clouds.clear();
        this.clouds.set(cloudKey, sprite);
      }
      const s = Math.round(size); c.drawImage(sprite, x - s * 3, y - s * 3, s * 6, s * 3);
    }
    if (!reduced && env.night < .6 && env.rain < .4 && env.snow === 0 && env.weather !== "fog") drawBirds(c, width, horizon, env, time);
    if (env.thunder && !reduced) drawLightning(c, width, horizon, time);
  }
}
function drawBirds(c: CanvasRenderingContext2D, width: number, horizon: number, env: TownEnvironment, time: number) {
  const evening = env.warm > .5;
  c.strokeStyle = evening ? "#2d2a33" : "#4c5a5e"; c.lineWidth = 1.1; c.lineCap = "round"; c.beginPath();
  for (let f = 0; f < 2; f++) {
    const period = 46 + f * 17, cycle = Math.floor((time + f * 23) / period), t = ((time + f * 23) % period) / period;
    if (hash(cycle * 7 + f) < .35) continue;
    const dir = hash(cycle + f * 3) > .5 ? 1 : -1, y0 = horizon * (.25 + hash(cycle * 11 + f) * .5);
    const x0 = dir > 0 ? -60 + t * (width + 120) : width + 60 - t * (width + 120), size = evening ? 4.2 : 3.4;
    for (let b = 0; b < 7; b++) {
      const row = Math.ceil(b / 2), side = b % 2 ? 1 : -1;
      bird(c, x0 - dir * row * 11, y0 + side * row * 6 + Math.sin(time * 1.4 + b) * 1.5, size, time * 9 + b * 1.3);
    }
  }
  c.stroke(); c.lineCap = "butt";
}
/** Lightning every 9–20 seconds; the flash itself is returned by lightningFlash for the whole frame. */
function strike(time: number) {
  const period = 13, cycle = Math.floor(time / period), local = time - cycle * period, at = 1 + hash(cycle * 5) * 9;
  return { cycle, age: local - at };
}
export function lightningFlash(env: TownEnvironment, time: number, reduced: boolean) {
  if (!env.thunder || reduced) return 0;
  const { age } = strike(time);
  return age < 0 || age > .45 ? 0 : (age < .08 ? .55 : age < .14 ? .12 : age < .2 ? .38 : .38 * (1 - (age - .2) / .25));
}
function drawLightning(c: CanvasRenderingContext2D, width: number, horizon: number, time: number) {
  const { cycle, age } = strike(time);
  if (age < 0 || age > .3) return;
  let x = width * (.15 + hash(cycle * 3) * .7), y = 0;
  c.strokeStyle = "rgba(244,246,255,.9)"; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y);
  for (let j = 1; j < 9; j++) { x += (hash(cycle * 17 + j) - .5) * 26; y = horizon * .95 * j / 8; c.lineTo(x, y); }
  c.stroke();
}
/** Soft shadows of passing clouds on the ground, in world coordinates (inside the camera transform). */
export function drawCloudShadows(c: CanvasRenderingContext2D, env: TownEnvironment, time: number, reduced: boolean) {
  // Distinct shadows need broken cloud and sunshine; overcast light is diffuse.
  const count = env.overcast > .7 ? 0 : Math.round(env.cloud * 6);
  if (count <= 0 || env.night > .7) return;
  const strength = (1 - env.night) * (env.overcast > .7 ? .05 : .1), speed = reduced ? 0 : (env.wind * .012 + .04);
  const vx = Math.cos(env.windAngle), vy = Math.sin(env.windAngle);
  for (let j = 0; j < count; j++) {
    const span = MAP_SIZE + 16, u = (((hash(j * 7) * span + time * speed * vx * 2) % span) + span) % span - 8;
    const v = (((hash(j * 9) * span + time * speed * vy * 2) % span) + span) % span - 8;
    const p = iso(u, v), r = 120 + hash(j * 3) * 110;
    const g = c.createRadialGradient(p.x, p.y, r * .2, p.x, p.y, r);
    g.addColorStop(0, `rgba(36,58,66,${strength})`); g.addColorStop(1, "rgba(36,58,66,0)");
    c.fillStyle = g; c.beginPath(); c.ellipse(p.x, p.y, r, r * .5, 0, 0, TAU); c.fill();
  }
}
/** Rain splashes and ripples on the ground and water. */
export function drawSplashes(c: CanvasRenderingContext2D, env: TownEnvironment, time: number, reduced: boolean) {
  if (env.rain <= 0 || reduced) return;
  const count = Math.round(20 + env.rain * 60);
  c.strokeStyle = env.night > .5 ? "rgba(170,190,220,.45)" : "rgba(235,242,248,.6)"; c.lineWidth = .7; c.beginPath();
  for (let j = 0; j < count; j++) {
    const rate = 1.6 + hash(j) * .8, phase = time * rate + hash(j * 3), cycle = Math.floor(phase), age = phase - cycle;
    const p = iso(hash(j * 13 + cycle * 7) * MAP_SIZE, hash(j * 29 + cycle * 3) * MAP_SIZE), r = 1 + age * 4.5;
    c.moveTo(p.x + r, p.y); c.ellipse(p.x, p.y, r, r * .45, 0, 0, TAU);
  }
  c.stroke();
}
/** Falling rain and snow in screen space, slanted by the wind. */
export function drawPrecipitation(c: CanvasRenderingContext2D, width: number, height: number, env: TownEnvironment, time: number, reduced: boolean) {
  const area = width * height / (390 * 844), t = reduced ? 0 : time;
  if (env.rain > 0) {
    const slant = Math.max(-.6, Math.min(.6, Math.cos(env.windAngle) * env.wind / 40));
    for (const layer of [0, 1]) {
      const count = Math.round(area * (layer ? 110 : 70) * (.35 + env.rain)), len = layer ? 15 : 9, speed = layer ? 820 : 560;
      c.strokeStyle = env.night > .5 ? `rgba(165,185,220,${layer ? .34 : .22})` : `rgba(228,236,246,${layer ? .46 : .3})`;
      c.lineWidth = layer ? 1.05 : .8; c.beginPath();
      for (let j = 0; j < count; j++) {
        const s = j * 2 + layer * 977, y = ((hash(s) * (height + 60) + t * speed * (.85 + hash(s + 1) * .3)) % (height + 60)) - 30;
        const x = ((hash(s + 2) * (width + 80) + y * slant) % (width + 80) + width + 80) % (width + 80) - 40;
        c.moveTo(x, y); c.lineTo(x + slant * len, y + len);
      }
      c.stroke();
    }
  }
  if (env.snow > 0) {
    const count = Math.round(area * (60 + env.snow * 170)), drift = Math.cos(env.windAngle) * (8 + env.wind * .8);
    c.fillStyle = env.night > .5 ? "rgba(214,224,242,.82)" : "rgba(255,255,255,.92)"; c.beginPath();
    for (let j = 0; j < count; j++) {
      const fall = 26 + hash(j * 5) * 30, r = .8 + hash(j * 7) * 1.7;
      const y = ((hash(j) * (height + 20) + t * fall) % (height + 20)) - 10;
      const x = ((hash(j * 3) * width + t * drift + Math.sin(t * (.6 + hash(j * 11)) + j) * 9) % width + width) % width;
      c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU);
    }
    c.fill();
  }
}
/** Morning mist and fog: a veil, plus slow drifting banks when it is really foggy. */
let fogBank: HTMLCanvasElement | null = null;
export function drawFog(c: CanvasRenderingContext2D, width: number, height: number, env: TownEnvironment, time: number) {
  if (env.fog < .15) return;
  const tone = env.night > .5 ? "#7d879f" : "#eef1f0";
  c.fillStyle = rgba(tone, env.fog * .32); c.fillRect(0, 0, width, height);
  if (env.fog < .4) return;
  if (!fogBank && typeof document !== "undefined") {
    // One soft bank, painted once and stretched: far cheaper than a full-screen gradient per frame.
    fogBank = document.createElement("canvas"); fogBank.width = 128; fogBank.height = 64;
    const f = fogBank.getContext("2d");
    if (f) { const g = f.createRadialGradient(64, 32, 2, 64, 32, 62); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)"); f.setTransform(1, 0, 0, .5, 0, 16); f.fillStyle = g; f.fillRect(0, 0, 128, 128); }
  }
  if (!fogBank) return;
  c.save(); c.globalAlpha = env.fog * .45;
  if (env.night > .5) c.globalAlpha *= .6;
  for (let j = 0; j < 3; j++) {
    const y = height * (.3 + j * .22), x = ((time * (5 + j * 2) + hash(j) * width) % (width * 1.6)) - width * .5;
    c.drawImage(fogBank, x, y - height * .14, width * 1.1, height * .28);
  }
  c.restore();
}
