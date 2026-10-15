/**
 * Shared painting state for the town artwork. Cached sprites are painted once per variant, so
 * everything that changes their look (season, snow, lit windows, shop hours) is part of the cache key
 * and is read from here while that variant is painted.
 */
export type TreePalette = "default" | "fresh" | "lush" | "yellow" | "orange" | "red" | "bare";
export const paintState = {
  /** Hash threshold above which a window is lit at night (0.25 → three quarters lit). */
  litThreshold: .25,
  shopsOpen: true,
  snow: false,
  /** "default" keeps the original fixed tree colours; a real season assigns each tree its own palette. */
  season: "default" as "default" | "spring" | "summer" | "autumn" | "winter",
  blossom: 0,
  foliage: 0,
  bare: 0,
  lush: 0,
  /** Live clocks are drawn as animated hands on top of the dial artwork. */
  liveClocks: false,
  /** Swing seats hang from the moving layer (so children can swing on them) instead of the cached frame. */
  liveSwings: false,
};
export function resetPaintState() {
  Object.assign(paintState, { litThreshold: .25, shopsOpen: true, snow: false, season: "default", blossom: 0, foliage: 0, bare: 0, lush: 0, liveClocks: false, liveSwings: false });
}

/** Multiplied into everything that is not a light source once it is fully dark. */
export const NIGHT_AMBIENT = "#5c6a93";
const AMBIENT = [0x5c, 0x6a, 0x93];
const shadeCache = new Map<string, string>();
/** Darken a colour for the current amount of night. Keeps any alpha suffix. */
export function shade(color: string, night: number): string {
  if (night <= 0 || color[0] !== "#" || (color.length !== 7 && color.length !== 9)) return color;
  const q = Math.round(Math.min(1, night) * 32), key = `${color}|${q}`;
  let out = shadeCache.get(key);
  if (!out) {
    const t = q / 32;
    out = "#" + [1, 3, 5].map((i, j) => Math.round(parseInt(color.slice(i, i + 2), 16) * (1 - t + t * AMBIENT[j]! / 255)).toString(16).padStart(2, "0")).join("") + color.slice(7);
    if (shadeCache.size > 4000) shadeCache.clear();
    shadeCache.set(key, out);
  }
  return out;
}
const SNOW = [0xf2, 0xf5, 0xf8];
/** Horizontal surfaces collect snow while it is snowing. */
export function snowy(color: string, amount = .84): string {
  if (!paintState.snow || color[0] !== "#" || (color.length !== 7 && color.length !== 9)) return color;
  return "#" + [1, 3, 5].map((i, j) => Math.round(parseInt(color.slice(i, i + 2), 16) * (1 - amount) + SNOW[j]! * amount).toString(16).padStart(2, "0")).join("") + color.slice(7);
}

/** Colours that are lights in the night artwork: windows, lamps, signs and headlights. */
export const LIGHT_COLORS = [
  "#ffe6a2", "#ffdda0", "#edcf8e", "#f5dba4", "#dfc694", "#ffe7ad", "#f1d6a2", "#e2c78866", "#e8d09a", "#c9e6c3",
  "#ffe6a1", "#fff1b4", "#ffe9a7", "#ffdf9d", "#ffe4a8", "#ffd88a", "#fff3cf", "#ffcf7a", "#ffefc4", "#ffb5a0",
];
const lightGradients = new WeakSet<object>();
/** Mark a gradient (lamp glow, beam) as emitted light. */
export function lightGradient<T extends object>(gradient: T): T { lightGradients.add(gradient); return gradient; }
let normalized: Set<string> | null = null;
function lightSet(c: CanvasRenderingContext2D) {
  if (normalized) return normalized;
  const previous = c.fillStyle;
  normalized = new Set(LIGHT_COLORS.flatMap(color => { c.fillStyle = color; return [String(c.fillStyle), color]; }));
  c.fillStyle = previous;
  return normalized;
}
/**
 * A view of a context that keeps only light sources. Everything else is drawn as an eraser, so a
 * window frame painted over a lit pane still divides it, exactly as in the normal artwork.
 */
export function emissiveContext(target: CanvasRenderingContext2D): CanvasRenderingContext2D {
  const lights = lightSet(target);
  const isLight = (style: unknown) => typeof style === "string" ? lights.has(style) : typeof style === "object" && style !== null && lightGradients.has(style);
  const run = (light: boolean, draw: () => void) => {
    const op = target.globalCompositeOperation;
    target.globalCompositeOperation = light ? "source-over" : "destination-out";
    draw();
    target.globalCompositeOperation = op;
  };
  return new Proxy(target, {
    get(object, key) {
      if (key === "fill") return (...args: unknown[]) => run(isLight(object.fillStyle), () => Reflect.apply(object.fill, object, args));
      if (key === "stroke") return (...args: unknown[]) => run(isLight(object.strokeStyle), () => Reflect.apply(object.stroke, object, args));
      if (key === "fillRect") return (x: number, y: number, w: number, h: number) => run(isLight(object.fillStyle), () => object.fillRect(x, y, w, h));
      if (key === "drawImage") return () => {};
      const value = Reflect.get(object, key);
      return typeof value === "function" ? value.bind(object) : value;
    },
    set(object, key, value) { return Reflect.set(object, key, value); },
  });
}
