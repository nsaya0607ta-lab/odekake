/**
 * 動く・変わる背景の共通部品
 * =============================================================
 * 背景は画面の一番うしろでずっと動くので、電池と動作の軽さを優先している。
 * - 1秒あたりの描き直しは 30 回まで（startLoop）。画面が見えていないとき・枠が画面外のときは止める
 * - 「動きを減らす」設定の人と、ショップ一覧の見本（mode: "still"）は、1枚だけ描いて止める
 * - キャンバスの細かさは端末の倍率を 1.5 倍までにおさえる（ぼかしの多い絵は、さらに粗くして引きのばす）
 */
import type { BackgroundSignals } from "@/lib/app-backgrounds";

/** full: アプリの背景／preview: ショップの大きな見本（動く）／still: ショップ一覧の見本（1枚だけ描く） */
export type LiveMode = "full" | "preview" | "still";

export type LiveOptions = {
  mode: LiveMode;
  /** 「動きを減らす」設定。true なら1枚だけ描いて止める */
  reducedMotion: boolean;
  signals: BackgroundSignals;
};

export type LiveInstance = {
  /** 天気・歩数・季節などが変わったとき */
  update(signals: BackgroundSignals): void;
  destroy(): void;
};

export type LiveMount = (host: HTMLElement, options: LiveOptions) => LiveInstance;

/** 1枚だけ描くときの時刻（秒）。粒が画面に散らばった、きれいなところを選んでいる */
export const STILL_TIME = 14;

/** 決まった並びの乱数（0〜1）。同じ seed なら毎回同じ並びになる */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * 描き直しのくり返し。frame(t, dt) の t は「動いていた時間」の合計（止まっていた間は進まない）。
 * still なら STILL_TIME で1回だけ描く。返り値は止める関数。
 */
export function startLoop(
  host: HTMLElement,
  frame: (t: number, dt: number) => void,
  { still = false, fps = 30 }: { still?: boolean; fps?: number } = {},
): () => void {
  if (still) {
    frame(STILL_TIME, 0);
    return () => {};
  }
  const interval = 1000 / fps;
  let raf = 0;
  let last = 0;
  let t = 0;
  let running = false;
  let onScreen = true;

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (!last) {
      last = now;
      frame(t, 0);
      return;
    }
    const elapsed = now - last;
    if (elapsed < interval - 2) return;
    last = now - (elapsed % interval);
    // 長く止まっていたあとでも、粒が一気に飛ばないように1回ぶんは0.1秒まで
    const dt = Math.min(elapsed, 100) / 1000;
    t += dt;
    frame(t, dt);
  };
  const sync = () => {
    const should = onScreen && document.visibilityState === "visible";
    if (should && !running) {
      running = true;
      last = 0;
      raf = requestAnimationFrame(tick);
    } else if (!should && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  };
  const observer = new IntersectionObserver((entries) => {
    onScreen = entries.some((entry) => entry.isIntersecting);
    sync();
  });
  observer.observe(host);
  document.addEventListener("visibilitychange", sync);
  sync();
  return () => {
    running = false;
    cancelAnimationFrame(raf);
    observer.disconnect();
    document.removeEventListener("visibilitychange", sync);
  };
}

export type CanvasSize = { w: number; h: number; dpr: number };

/**
 * 枠いっぱいのキャンバスを置く。枠の大きさが変わったら描き直しの大きさも合わせる。
 * resolution は端末の倍率に掛ける値（ぼかしの多い絵は 0.5 などにして軽くする）。
 */
export function addCanvas(
  host: HTMLElement,
  { resolution = 1, maxDpr = 1.5, onResize }: { resolution?: number; maxDpr?: number; onResize?: (size: CanvasSize) => void } = {},
): { canvas: HTMLCanvasElement; size: CanvasSize; destroy: () => void } {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
  host.appendChild(canvas);
  const size: CanvasSize = { w: 1, h: 1, dpr: 1 };
  const apply = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr) * resolution;
    const pw = Math.max(1, Math.round(w * dpr));
    const ph = Math.max(1, Math.round(h * dpr));
    if (canvas.width === pw && canvas.height === ph && size.w === w && size.h === h) return;
    canvas.width = pw;
    canvas.height = ph;
    size.w = w;
    size.h = h;
    size.dpr = dpr;
    onResize?.(size);
  };
  apply();
  const observer = new ResizeObserver(apply);
  observer.observe(host);
  return {
    canvas,
    size,
    destroy: () => {
      observer.disconnect();
      canvas.remove();
    },
  };
}

/**
 * 画面をタップした位置を、背景の枠の中の位置（CSSピクセル）で受けとる。
 * アプリの背景（full）は、ボタンなどの上をタップしても反応する（背景は一番うしろにあり、さわれないため）。
 * ショップの大きな見本は、見本の枠（data-live-tap）をタップしたときだけ。
 */
export function onBackgroundTap(host: HTMLElement, mode: LiveMode, callback: (x: number, y: number) => void): () => void {
  if (mode === "still") return () => {};
  const target: EventTarget | null = mode === "full" ? window : host.closest("[data-live-tap]");
  if (!target) return () => {};
  const handler = (event: Event) => {
    const e = event as PointerEvent;
    // 大きな見本の上の切りかえボタンなどを押したときは、見本へのタップにしない
    if (mode === "preview" && e.target instanceof Element && e.target.closest("button, a")) return;
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((e.clientX - rect.left) / rect.width) * host.clientWidth;
    const y = ((e.clientY - rect.top) / rect.height) * host.clientHeight;
    callback(x, y);
  };
  target.addEventListener("pointerdown", handler, { passive: true });
  return () => target.removeEventListener("pointerdown", handler);
}

/** キャンバス2Dの準備（倍率を合わせて、CSSピクセルで描けるようにする） */
export function context2d(canvas: HTMLCanvasElement, size: CanvasSize): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
  return ctx;
}

/** 小さな絵を前もって描いておく（毎回描くと重いものを、貼るだけにする） */
export function makeSprite(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const sprite = document.createElement("canvas");
  sprite.width = Math.max(1, Math.ceil(width));
  sprite.height = Math.max(1, Math.ceil(height));
  const ctx = sprite.getContext("2d");
  if (ctx) draw(ctx);
  return sprite;
}
