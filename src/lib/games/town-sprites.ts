export type SpriteBounds = { left: number; top: number; width: number; height: number };
type Sprite = { canvas: HTMLCanvasElement; bounds: SpriteBounds; pixels: number };

/** Reuse vector artwork as crisp 2× sprites. Bound memory even in a fully built city. */
export class TownSprites {
  private readonly entries = new Map<string, Sprite>();
  private pixels = 0;
  private readonly maxPixels = 8 * 1024 * 1024;
  constructor(private readonly createCanvas: () => HTMLCanvasElement) {}

  draw(c: CanvasRenderingContext2D, key: string, x: number, y: number, bounds: SpriteBounds, paint: (context: CanvasRenderingContext2D) => void) {
    let sprite = this.entries.get(key);
    if (!sprite) {
      const canvas = this.createCanvas(), context = canvas.getContext("2d");
      if (!context) { c.save(); c.translate(x, y); paint(c); c.restore(); return; }
      canvas.width = Math.ceil(bounds.width * 2); canvas.height = Math.ceil(bounds.height * 2);
      context.setTransform(2, 0, 0, 2, -bounds.left * 2, -bounds.top * 2);
      paint(context);
      sprite = { canvas, bounds, pixels: canvas.width * canvas.height };
      this.pixels += sprite.pixels;
    } else this.entries.delete(key);
    this.entries.set(key, sprite);
    while (this.pixels > this.maxPixels && this.entries.size > 1) {
      const oldest = this.entries.keys().next().value!;
      this.pixels -= this.entries.get(oldest)!.pixels; this.entries.delete(oldest);
    }
    c.drawImage(sprite.canvas, x + sprite.bounds.left, y + sprite.bounds.top, sprite.bounds.width, sprite.bounds.height);
  }
}
