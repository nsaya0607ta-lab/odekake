import { emissiveContext } from "./town-paint";

export type SpriteBounds = { left: number; top: number; width: number; height: number };
type Sprite = { canvas: HTMLCanvasElement; bounds: SpriteBounds; pixels: number };
/** A night variant multiplies the artwork by the ambient colour, then adds its lights and a soft glow. */
export type NightBake = { ambient: string; emissive: (context: CanvasRenderingContext2D) => void };
export type SpriteDrawOptions = { alpha?: number; night?: NightBake; optional?: boolean };
type Scratch = { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D };

/** Match cached artwork to screen density while bounding memory in a fully built city. */
export class TownSprites {
  private readonly entries = new Map<string, Sprite>();
  private pixels = 0;
  private readonly maxPixels = 8 * 1024 * 1024;
  private scratch: Scratch | null = null;
  private glow: Scratch | null = null;
  private spent = 0;
  private budget = Infinity;
  constructor(private readonly createCanvas: () => HTMLCanvasElement) {}

  /** Optional sprites (a night variant that is still fading in) share this much painting time per frame. */
  beginFrame(budgetMs: number) {
    this.spent = 0; this.budget = budgetMs;
  }
  has(key: string, resolution = 3) {
    const scale = Math.max(3, Math.min(7, Math.ceil(resolution)));
    return this.entries.has(scale === 3 ? key : `${key}@${scale}`);
  }
  draw(c: CanvasRenderingContext2D, key: string, x: number, y: number, bounds: SpriteBounds, paint: (context: CanvasRenderingContext2D) => void, resolution = 3, options: SpriteDrawOptions = {}): boolean {
    const scale = Math.max(3, Math.min(7, Math.ceil(resolution))), cacheKey = scale === 3 ? key : `${key}@${scale}`;
    let sprite = this.entries.get(cacheKey);
    if (!sprite) {
      if (options.optional && this.spent >= this.budget) return false;
      const started = typeof performance !== "undefined" ? performance.now() : 0;
      const canvas = this.createCanvas(), context = canvas.getContext("2d");
      if (!context) { c.save(); c.translate(x, y); paint(c); c.restore(); return true; }
      canvas.width = Math.ceil(bounds.width * scale); canvas.height = Math.ceil(bounds.height * scale);
      context.setTransform(scale, 0, 0, scale, -bounds.left * scale, -bounds.top * scale);
      paint(context);
      if (options.night) this.bakeNight(canvas, context, bounds, scale, options.night);
      if (typeof performance !== "undefined") this.spent += performance.now() - started;
      sprite = { canvas, bounds, pixels: canvas.width * canvas.height };
      this.pixels += sprite.pixels;
    } else this.entries.delete(cacheKey);
    this.entries.set(cacheKey, sprite);
    while (this.pixels > this.maxPixels && this.entries.size > 1) {
      const oldest = this.entries.keys().next().value!;
      this.pixels -= this.entries.get(oldest)!.pixels; this.entries.delete(oldest);
    }
    const alpha = options.alpha ?? 1;
    if (alpha <= 0) return true;
    if (alpha < 1) { c.save(); c.globalAlpha *= alpha; }
    c.drawImage(sprite.canvas, x + sprite.bounds.left, y + sprite.bounds.top, sprite.bounds.width, sprite.bounds.height);
    if (alpha < 1) c.restore();
    return true;
  }
  private surface(slot: "scratch" | "glow", width: number, height: number): Scratch | null {
    let s = this[slot];
    if (!s) {
      const canvas = this.createCanvas(), context = canvas.getContext("2d");
      if (!context) return null;
      s = this[slot] = { canvas, context };
    }
    if (s.canvas.width < width) s.canvas.width = width;
    if (s.canvas.height < height) s.canvas.height = height;
    s.context.setTransform(1, 0, 0, 1, 0, 0); s.context.globalCompositeOperation = "source-over"; s.context.globalAlpha = 1;
    s.context.clearRect(0, 0, width, height);
    return s;
  }
  private bakeNight(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, bounds: SpriteBounds, scale: number, night: NightBake) {
    const { width, height } = canvas, copy = this.surface("scratch", width, height);
    if (!copy) return;
    copy.context.drawImage(canvas, 0, 0);
    context.save(); context.setTransform(1, 0, 0, 1, 0, 0);
    // Darken only the artwork's own pixels: over black (so soft shadows stay dark), multiply, then restore the coverage.
    context.globalCompositeOperation = "destination-over"; context.fillStyle = "#000"; context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "multiply"; context.fillStyle = night.ambient; context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "destination-in"; context.drawImage(copy.canvas, 0, 0, width, height, 0, 0, width, height);
    // Lights keep their full colour. A quarter-size copy, scaled back up, is a cheap soft bloom.
    copy.context.clearRect(0, 0, width, height);
    copy.context.setTransform(scale, 0, 0, scale, -bounds.left * scale, -bounds.top * scale);
    night.emissive(emissiveContext(copy.context));
    copy.context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalCompositeOperation = "source-over"; context.drawImage(copy.canvas, 0, 0, width, height, 0, 0, width, height);
    const gw = Math.max(1, Math.ceil(width / 4)), gh = Math.max(1, Math.ceil(height / 4)), glow = this.surface("glow", gw, gh);
    if (glow) {
      glow.context.imageSmoothingEnabled = true;
      glow.context.drawImage(copy.canvas, 0, 0, width, height, 0, 0, gw, gh);
      context.imageSmoothingEnabled = true;
      context.globalCompositeOperation = "lighter"; context.globalAlpha = .26;
      context.drawImage(glow.canvas, 0, 0, gw, gh, -scale, -scale, width + scale * 2, height + scale * 2);
    }
    context.restore();
  }
}
