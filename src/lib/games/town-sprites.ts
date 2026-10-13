export type SpriteBounds = { left: number; top: number; width: number; height: number };
type Sprite = { canvas: HTMLCanvasElement; bounds: SpriteBounds; pixels: number };

/** Match cached artwork to screen density while bounding memory in a fully built city. */
export class TownSprites {
  private readonly entries = new Map<string, Sprite>();
  private pixels = 0;
  private readonly maxPixels = 8 * 1024 * 1024;
  constructor(private readonly createCanvas: () => HTMLCanvasElement) {}

  draw(c: CanvasRenderingContext2D, key: string, x: number, y: number, bounds: SpriteBounds, paint: (context: CanvasRenderingContext2D) => void, resolution = 3) {
    const scale = Math.max(3, Math.min(7, Math.ceil(resolution))), cacheKey = scale === 3 ? key : `${key}@${scale}`;
    let sprite = this.entries.get(cacheKey);
    if (!sprite) {
      const canvas = this.createCanvas(), context = canvas.getContext("2d");
      if (!context) { c.save(); c.translate(x, y); paint(c); c.restore(); return; }
      canvas.width = Math.ceil(bounds.width * scale); canvas.height = Math.ceil(bounds.height * scale);
      context.setTransform(scale, 0, 0, scale, -bounds.left * scale, -bounds.top * scale);
      paint(context);
      sprite = { canvas, bounds, pixels: canvas.width * canvas.height };
      this.pixels += sprite.pixels;
    } else this.entries.delete(cacheKey);
    this.entries.set(cacheKey, sprite);
    while (this.pixels > this.maxPixels && this.entries.size > 1) {
      const oldest = this.entries.keys().next().value!;
      this.pixels -= this.entries.get(oldest)!.pixels; this.entries.delete(oldest);
    }
    c.drawImage(sprite.canvas, x + sprite.bounds.left, y + sprite.bounds.top, sprite.bounds.width, sprite.bounds.height);
  }
}
