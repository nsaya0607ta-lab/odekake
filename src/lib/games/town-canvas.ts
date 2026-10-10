import type { Town } from "./town-builder";
import { TownScene, type SceneOptions } from "./town-renderer";

/** Paint a complete frame before touching the visible canvas, including viewport changes. */
export class TownCanvas {
  private readonly buffer: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly output: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private ratio = 1;

  constructor(private readonly canvas: HTMLCanvasElement, readonly scene: TownScene) {
    this.buffer = canvas.ownerDocument.createElement("canvas");
    const context = this.buffer.getContext("2d", { alpha: false });
    const output = canvas.getContext("2d", { alpha: false });
    if (!context || !output) throw new Error("Canvas is unavailable");
    this.context = context;
    this.output = output;
  }

  resize(width: number, height: number, ratio: number, town: Town, options: SceneOptions) {
    if (width < 1 || height < 1) return;
    const nextRatio = Math.max(1, Math.min(ratio || 1, 2));
    if (width === this.width && height === this.height && nextRatio === this.ratio) return;
    if (!this.width) {
      this.scene.camera.zoom = width < 600 ? .85 : 1.12;
      this.scene.camera.x = width / 2 + 32 * this.scene.camera.zoom;
      this.scene.camera.y = height * .48 - 320 * this.scene.camera.zoom;
    } else {
      this.scene.camera.x += (width - this.width) / 2;
      this.scene.camera.y += (height - this.height) / 2;
    }
    this.width = width; this.height = height; this.ratio = nextRatio;
    const pixelsWide = Math.round(width * nextRatio), pixelsHigh = Math.round(height * nextRatio);
    if (this.buffer.width !== pixelsWide) this.buffer.width = pixelsWide;
    if (this.buffer.height !== pixelsHigh) this.buffer.height = pixelsHigh;
    // ResizeObserver runs before paint. Never leave an empty bitmap until the next RAF.
    this.draw(town, options, 0);
  }

  draw(town: Town, options: SceneOptions, dt: number) {
    if (!this.width || !this.height) return;
    this.context.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    this.scene.render(this.context, this.width, this.height, town, options, dt);
    // Only clear the display when its backing dimensions actually change; immediately blit.
    if (this.canvas.width !== this.buffer.width) this.canvas.width = this.buffer.width;
    if (this.canvas.height !== this.buffer.height) this.canvas.height = this.buffer.height;
    this.output.setTransform(1, 0, 0, 1, 0, 0);
    this.output.drawImage(this.buffer, 0, 0);
  }
}
