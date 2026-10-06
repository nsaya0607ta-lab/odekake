/**
 * わんこボウリングの演出（見た目だけ。物理・スコア・コインにはさわらない）。
 * - pinImpact：ピンが倒れた場所で、火花と光がはじける（ボールで直接当てたときほど強く）
 * - confettiBurst：上から紙ふぶきが降る（ストライク・ターキー・自己ベスト）
 * - BallTrail：転がるボールのうしろに、光の尾をひく（canvas）
 * どれも要素を足して CSS アニメーションで動かし、終わったら消す。
 */
import fx from "./bowling-fx.module.css";

export const bowlingFx = fx;

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

const removeWhenDone = (el: HTMLElement) => el.addEventListener("animationend", () => el.remove(), { once: true });

/** 一度にのせる演出の数の上限（連鎖で一気に倒れても重くならないように） */
const MAX_LAYER_NODES = 160;

/**
 * ピンが倒れた場所（レーンに対する %）で火花を出す。
 * strength は 0〜1（ボールの速さ・直撃かどうか）。golden はゴールデンピン。
 */
export function pinImpact(
  layer: HTMLElement | null,
  { x, y, strength, color, golden = false, direct = false }: {
    x: number;
    y: number;
    strength: number;
    color: string;
    golden?: boolean;
    direct?: boolean;
  },
) {
  if (!layer || prefersReducedMotion()) return;
  if (layer.childElementCount > MAX_LAYER_NODES) return;
  const s = Math.max(0, Math.min(1, strength));
  const frag = document.createDocumentFragment();
  const sparkColor = golden ? "#ffd84a" : direct ? color : "#fff1c9";

  const flash = document.createElement("span");
  flash.className = fx.flash!;
  const flashSize = (direct ? 42 : 26) + s * 30 + (golden ? 24 : 0);
  flash.style.cssText = `left:${x}%;top:${y}%;--size:${flashSize.toFixed(0)}px;--c:${golden ? "rgba(255,206,60,0.8)" : "rgba(255,236,170,0.65)"}`;
  removeWhenDone(flash);
  frag.appendChild(flash);

  if (direct || golden) {
    const shock = document.createElement("span");
    shock.className = fx.shock!;
    shock.style.cssText = `left:${x}%;top:${y}%;--size:${(24 + s * 26 + (golden ? 16 : 0)).toFixed(0)}px;--c:${golden ? "rgba(255,214,80,0.9)" : "rgba(255,244,214,0.8)"}`;
    removeWhenDone(shock);
    frag.appendChild(shock);
  }

  const count = Math.round((direct ? 7 : 4) + s * 7 + (golden ? 10 : 0));
  for (let i = 0; i < count; i += 1) {
    const p = document.createElement("span");
    const streak = i % 3 !== 0;
    p.className = streak ? `${fx.spark} ${fx.sparkStreak}` : fx.spark!;
    // 奥（画面の上）へ飛び散りやすく、横にも広がる
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
    const dist = 14 + Math.random() * (18 + s * 34 + (golden ? 18 : 0));
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist * 0.7;
    const size = 2.5 + Math.random() * (2 + s * 2.5);
    const rot = (Math.atan2(dy, dx) * 180) / Math.PI;
    const c = golden && i % 2 === 0 ? "#fff6b8" : sparkColor;
    p.style.cssText = `left:${x}%;top:${y}%;--dx:${dx.toFixed(1)}px;--dy:${dy.toFixed(1)}px;--size:${size.toFixed(1)}px;--rot:${rot.toFixed(0)}deg;--c:${c};animation-delay:${(Math.random() * 30).toFixed(0)}ms`;
    removeWhenDone(p);
    frag.appendChild(p);
  }

  layer.appendChild(frag);
}

const CONFETTI_COLORS = ["#ffc95c", "#54d8ff", "#ff7aa8", "#9be36a", "#ffffff", "#b58cff", "#ff8a3d"];

/** 紙ふぶき。layer の上から降らせる */
export function confettiBurst(layer: HTMLElement | null, count = 46, colors = CONFETTI_COLORS) {
  if (!layer || prefersReducedMotion()) return;
  const height = layer.clientHeight || 600;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i += 1) {
    const p = document.createElement("span");
    p.className = fx.confetti!;
    const w = 5 + Math.random() * 5;
    const h = w * (1.2 + Math.random() * 0.9);
    p.style.cssText = [
      `left:${(Math.random() * 100).toFixed(1)}%`,
      `--w:${w.toFixed(1)}px`,
      `--h:${h.toFixed(1)}px`,
      `--c:${colors[i % colors.length]}`,
      `--dx:${((Math.random() - 0.5) * 120).toFixed(0)}px`,
      `--dy:${(height * (0.75 + Math.random() * 0.45)).toFixed(0)}px`,
      `--rot:${((Math.random() - 0.5) * 1080).toFixed(0)}deg`,
      `--dur:${(1300 + Math.random() * 1100).toFixed(0)}ms`,
      `--delay:${(Math.random() * 380).toFixed(0)}ms`,
    ].join(";");
    removeWhenDone(p);
    frag.appendChild(p);
  }
  layer.appendChild(frag);
}

/** 画面がぐっと押される（ストライクのピンアクションなど）。要素の transform は使わず animate で一時的に */
export function punch(el: HTMLElement | null, strength = 1) {
  if (!el || prefersReducedMotion() || typeof el.animate !== "function") return;
  const s = Math.max(0.3, Math.min(1.4, strength));
  el.animate(
    [
      { transform: "translate(0, 0) scale(1)" },
      { transform: `translate(${(-2.5 * s).toFixed(1)}px, ${(2 * s).toFixed(1)}px) scale(${(1 + 0.008 * s).toFixed(4)})` },
      { transform: `translate(${(2 * s).toFixed(1)}px, ${(-1.5 * s).toFixed(1)}px) scale(1.003)` },
      { transform: `translate(${(-1 * s).toFixed(1)}px, ${(0.5 * s).toFixed(1)}px) scale(1)` },
      { transform: "translate(0, 0) scale(1)" },
    ],
    { duration: 300, easing: "ease-out" },
  );
}

type TrailPoint = { x: number; y: number; r: number; t: number };

/**
 * ボールの光の尾。push で位置（px）を足すと、古い点ほど細く薄く描く。
 * 点がなくなったら描くのをやめる（止まっているあいだは何もしない）。
 */
export class BallTrail {
  private ctx: CanvasRenderingContext2D | null;
  private points: TrailPoint[] = [];
  private raf = 0;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private color = "255,236,190";
  private readonly life = 420;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d");
  }

  resize(w: number, h: number) {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = w;
    this.h = h;
    this.canvas.width = Math.max(1, Math.round(w * this.dpr));
    this.canvas.height = Math.max(1, Math.round(h * this.dpr));
  }

  /** "#rrggbb" を受けとって尾の色にする */
  setColor(hex: string) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex);
    if (m) this.color = `${parseInt(m[1]!, 16)},${parseInt(m[2]!, 16)},${parseInt(m[3]!, 16)}`;
  }

  push(x: number, y: number, r: number) {
    if (!this.ctx || prefersReducedMotion()) return;
    const now = performance.now();
    const last = this.points[this.points.length - 1];
    // 近すぎる点は足さない（ゆっくりのときに点だらけにならないように）
    if (last && Math.hypot(last.x - x, last.y - y) < 1.5) {
      last.t = now;
    } else {
      this.points.push({ x, y, r, t: now });
      if (this.points.length > 48) this.points.shift();
    }
    if (!this.raf) this.raf = requestAnimationFrame(this.draw);
  }

  clear() {
    this.points = [];
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private draw = () => {
    this.raf = 0;
    const ctx = this.ctx;
    if (!ctx) return;
    const now = performance.now();
    this.points = this.points.filter((p) => now - p.t < this.life);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const pts = this.points;
    if (pts.length >= 2) {
      ctx.lineCap = "round";
      ctx.globalCompositeOperation = "lighter";
      for (let i = 1; i < pts.length; i += 1) {
        const a = pts[i - 1]!;
        const b = pts[i]!;
        const age = 1 - (now - b.t) / this.life;
        const pos = i / (pts.length - 1);
        const k = Math.max(0, age) * pos;
        if (k <= 0.01) continue;
        // 外側のぼんやりした光
        ctx.strokeStyle = `rgba(${this.color},${(0.22 * k).toFixed(3)})`;
        ctx.lineWidth = b.r * 1.7 * (0.35 + 0.65 * pos);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        // 中心の明るい線
        ctx.strokeStyle = `rgba(255,255,255,${(0.32 * k).toFixed(3)})`;
        ctx.lineWidth = b.r * 0.45 * pos;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    }
    if (this.points.length > 0) this.raf = requestAnimationFrame(this.draw);
  };
}
