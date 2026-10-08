/**
 * 盤面の canvas 描画。
 * - うしろの canvas：線（流れる光）・アクセスの光る点・待ち行列の点
 * - まえの canvas（パーツのタイルより上）：飛び散る粒・「503」「HIT」などの文字
 * パーツのタイルと利用者は DOM（board.tsx）。
 */
import { curvePoint, type BoardLayout, type Pt, type Wire } from "./layout";
import { JOB_COLOR, LOOKUP_COLOR, PARTS, REPL_COLOR, REQ_INFO, RESPONSE_COLOR, kindOf, type ReqType } from "./model";
import { isUserId, type Fx, type InfraSim, type SimReq } from "./sim";

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };
type FloatText = { x: number; y: number; text: string; color: string; age: number; big: boolean; anchor: string };
type WirePath = { wire: Wire; path: Path2D; color: string };

const FONT = '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif';

function packetColor(r: SimReq): string {
  if (r.dns) return LOOKUP_COLOR;
  if (r.kind === "job") return JOB_COLOR;
  if (r.kind === "repl") return REPL_COLOR;
  if (r.kind === "snap") return PARTS.backup.color;
  if (r.returning && !r.miss) return r.kind === "attack" ? REQ_INFO.attack.color : RESPONSE_COLOR;
  return REQ_INFO[r.kind as ReqType].color;
}

const ease = (p: number) => 0.45 * p + 0.55 * p * p * (3 - 2 * p);

export class BoardRenderer {
  private readonly back: CanvasRenderingContext2D;
  private readonly front: CanvasRenderingContext2D;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private tile = 52;
  /** タイルの下の数字の行を出していない（小さい画面） */
  private compact = false;
  private layout: BoardLayout | null = null;
  private wirePaths: WirePath[] = [];
  private wires: Wire[] = [];
  private readonly sprites = new Map<string, HTMLCanvasElement>();
  private particles: Particle[] = [];
  private texts: FloatText[] = [];
  /** 線をつなぐときに選んでいるパーツ（その線を目立たせる。"users" なら利用者の線） */
  private focus: string | null = null;
  reduced = false;

  constructor(back: HTMLCanvasElement, front: HTMLCanvasElement) {
    this.back = back.getContext("2d")!;
    this.front = front.getContext("2d")!;
  }

  resize(w: number, h: number, dpr: number, tile: number, compact = false) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.dpr = dpr;
    this.tile = tile;
    this.compact = compact;
    for (const canvas of [this.back.canvas, this.front.canvas]) {
      canvas.width = Math.round(this.w * dpr);
      canvas.height = Math.round(this.h * dpr);
    }
    this.buildWires();
  }

  setFocus(id: string | null) {
    this.focus = id;
  }

  setLayout(layout: BoardLayout, wires: Wire[]) {
    this.layout = layout;
    this.wires = wires;
    this.buildWires();
  }

  /** パーツ・利用者の画面上の位置（px） */
  px(id: string): Pt | null {
    const p = this.layout?.pos.get(id);
    return p ? { x: p.x * this.w, y: p.y * this.h } : null;
  }

  private curvePx(a: string, b: string, t: number): Pt | null {
    const pa = this.layout?.pos.get(a), pb = this.layout?.pos.get(b);
    if (!pa || !pb) return null;
    const p = curvePoint(pa, pb, t);
    return { x: p.x * this.w, y: p.y * this.h };
  }

  private buildWires() {
    const layout = this.layout;
    if (!layout) return;
    this.wirePaths = [];
    for (const wire of this.wires) {
      const a = layout.pos.get(wire.a), b = layout.pos.get(wire.b);
      if (!a || !b) continue;
      const path = new Path2D();
      for (let i = 0; i <= 24; i++) {
        const p = curvePoint(a, b, i / 24);
        if (i === 0) path.moveTo(p.x * this.w, p.y * this.h);
        else path.lineTo(p.x * this.w, p.y * this.h);
      }
      const color = isUserId(wire.b) ? "#9fb4ff" : PARTS[kindOf(wire.b)].color;
      this.wirePaths.push({ wire, path, color });
    }
  }

  private sprite(color: string): HTMLCanvasElement {
    let s = this.sprites.get(color);
    if (s) return s;
    s = document.createElement("canvas");
    const size = 64;
    s.width = size;
    s.height = size;
    const c = s.getContext("2d")!;
    const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, color);
    g.addColorStop(0.28, hexA(color, 0.55));
    g.addColorStop(1, hexA(color, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
    this.sprites.set(color, s);
    return s;
  }

  /** 1こま描く。dt は前のこまからの実時間（線を流れる光は、シミュレーターの時計で動く。止めると止まる） */
  draw(sim: InfraSim | null, dt: number) {
    const t = sim ? sim.now : 0;
    const b = this.back, f = this.front;
    b.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    f.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    b.clearRect(0, 0, this.w, this.h);
    f.clearRect(0, 0, this.w, this.h);
    this.drawWires(sim, t);
    if (sim) {
      this.drawQueues(sim);
      this.drawPackets(sim);
      this.takeFx(sim);
    }
    this.drawFx(dt);
  }

  private drawWires(sim: InfraSim | null, t: number) {
    const b = this.back;
    b.lineCap = "round";
    const focus = this.focus;
    for (const { wire, path, color } of this.wirePaths) {
      const user = wire.kind === "user" || wire.kind === "dns";
      const ctl = wire.kind === "ctl";
      b.setLineDash(wire.kind === "dns" || wire.kind === "repl" ? [2, 6] : ctl ? [1, 5] : []);
      if (focus) {
        // 選んでいるパーツの線だけ、くっきり（ほかはうすく）
        const mine = wire.a === focus || wire.b === focus || (focus === "users" && isUserId(wire.a));
        b.lineWidth = mine ? 2.2 : 1;
        b.strokeStyle = mine ? hexA("#ffd27a", 0.75) : "rgba(170, 196, 255, 0.05)";
      } else {
        b.lineWidth = user || ctl ? 1 : 1.6;
        b.strokeStyle = user || ctl ? "rgba(170, 196, 255, 0.07)" : "rgba(170, 196, 255, 0.14)";
      }
      b.stroke(path);
      if (!sim) continue;
      const na = isUserId(wire.a) ? null : sim.nodes.get(wire.a);
      const nb = sim.nodes.get(wire.b);
      const act = Math.min(na ? na.activity : 9, nb ? nb.activity : 0);
      if (act < 0.06 || nb?.down || na?.down) continue;
      const alpha = Math.min(user ? 0.22 : 0.6, act * (user ? 0.03 : 0.09));
      b.save();
      b.globalCompositeOperation = "lighter";
      b.setLineDash([3, 11]);
      b.lineDashOffset = -t * 26;
      b.lineWidth = user ? 1.4 : 2.2;
      b.strokeStyle = hexA(color, alpha);
      b.stroke(path);
      b.restore();
    }
    b.setLineDash([]);
  }

  /** 待っているアクセス（丸）と、キューにたまった仕事（四角）を、タイルの名前の下に並べる */
  private drawQueues(sim: InfraSim) {
    const b = this.back;
    const half = this.tile / 2;
    const gap = 6.4;
    for (const node of sim.nodes.values()) {
      const p = this.px(node.id);
      if (!p) continue;
      const jobs = node.kind === "queue" ? node.jobs.length : 0;
      const n = node.wait.length + jobs;
      if (!n) continue;
      const show = Math.min(n, 10);
      const y = p.y + half + (this.compact ? 21 : 33);
      const x0 = p.x - ((show - 1) * gap) / 2;
      for (let i = 0; i < show; i++) {
        const x = x0 + i * gap;
        if (i < node.wait.length) {
          b.fillStyle = hexA(packetColor(node.wait[i]!), 0.92);
          b.beginPath();
          b.arc(x, y, 2.3, 0, Math.PI * 2);
          b.fill();
        } else {
          b.fillStyle = hexA(JOB_COLOR, 0.92);
          b.fillRect(x - 2.2, y - 2.2, 4.4, 4.4);
        }
      }
      if (n > show) {
        b.font = `700 9px ${FONT}`;
        b.fillStyle = "rgba(255,255,255,0.8)";
        b.textAlign = "left";
        b.fillText(`+${n - show}`, x0 + show * gap - 1, y + 3);
      }
    }
  }

  private drawPackets(sim: InfraSim) {
    const b = this.back;
    const now = sim.now;
    b.save();
    for (const r of sim.reqs) {
      if (r.state !== "travel" || r.from === r.to) continue;
      const span = Math.max(1e-6, r.t1 - r.t0);
      const p = Math.min(1, Math.max(0, (now - r.t0) / span));
      const pos = this.curvePx(r.from, r.to, ease(p));
      if (!pos) continue;
      const color = packetColor(r);
      const small = r.kind === "repl" || r.kind === "snap" ? 0.6 : r.returning ? 0.82 : 1;
      // 尾
      if (!this.reduced) {
        b.globalCompositeOperation = "lighter";
        for (let k = 1; k <= 4; k++) {
          const q = p - k * 0.035;
          if (q <= 0) break;
          const tp = this.curvePx(r.from, r.to, ease(q));
          if (!tp) break;
          b.fillStyle = hexA(color, 0.32 - k * 0.065);
          b.beginPath();
          b.arc(tp.x, tp.y, (3.2 - k * 0.45) * small, 0, Math.PI * 2);
          b.fill();
        }
      }
      // 光
      b.globalCompositeOperation = "lighter";
      const g = 20 * small;
      b.drawImage(this.sprite(color), pos.x - g / 2, pos.y - g / 2, g, g);
      b.globalCompositeOperation = "source-over";
      if (r.dns) {
        b.strokeStyle = color;
        b.lineWidth = 1.6;
        b.beginPath();
        b.arc(pos.x, pos.y, 3.4, 0, Math.PI * 2);
        b.stroke();
      } else if (r.kind === "job") {
        b.fillStyle = "#fff4ea";
        b.fillRect(pos.x - 2.4, pos.y - 2.4, 4.8, 4.8);
      } else {
        b.fillStyle = r.kind === "attack" && !r.returning ? "#ffd6dc" : "#ffffff";
        b.beginPath();
        b.arc(pos.x, pos.y, 2.3 * small, 0, Math.PI * 2);
        b.fill();
        b.fillStyle = hexA(color, 0.95);
        b.beginPath();
        b.arc(pos.x, pos.y, 1.5 * small, 0, Math.PI * 2);
        b.fill();
      }
    }
    b.restore();
  }

  private fxPoint(e: Fx): Pt | null {
    if (e.to && e.p != null) return this.curvePx(e.at, e.to, ease(e.p));
    return this.px(e.at);
  }

  private takeFx(sim: InfraSim) {
    if (!sim.fx.length) return;
    const list = sim.fx;
    sim.fx = [];
    for (const e of list) {
      const p = this.fxPoint(e);
      if (!p) continue;
      const onTile = !e.to && !isUserId(e.at);
      if (e.kind === "text") {
        // 1つのタイルに出す文字は1つずつ（重なって読めなくならないように）。大事なもの（停止・復旧など）は前のものと入れかえる
        const anchor = onTile ? e.at : "";
        if (anchor) {
          const showing = this.texts.find((t) => t.anchor === anchor);
          if (showing && !e.big && (showing.big || showing.age < 0.6)) continue;
          if (showing) this.texts = this.texts.filter((t) => t !== showing);
        } else if (this.texts.some((t) => !t.anchor && Math.abs(t.x - p.x) < 26 && Math.abs(t.y - p.y) < 16 && t.age < 0.5)) continue;
        if (this.texts.length > 30) this.texts.shift();
        this.texts.push({ x: p.x, y: p.y - (onTile ? 0 : 8), text: e.text, color: e.color, age: 0, big: Boolean(e.big), anchor });
      } else {
        const n = this.reduced ? Math.min(3, e.n) : e.n;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const v = 26 + Math.random() * 46;
          if (this.particles.length > 260) this.particles.shift();
          this.particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, life: 0, max: 0.45 + Math.random() * 0.35, color: e.color, size: 1.4 + Math.random() * 1.8 });
        }
      }
    }
  }

  private drawFx(dt: number) {
    const f = this.front;
    const step = Math.min(0.05, dt);
    if (this.particles.length) {
      f.save();
      f.globalCompositeOperation = "lighter";
      for (const q of this.particles) {
        q.life += step;
        q.x += q.vx * step;
        q.y += q.vy * step;
        q.vx *= 0.94;
        q.vy = q.vy * 0.94 + 30 * step;
        const k = 1 - q.life / q.max;
        if (k <= 0) continue;
        f.fillStyle = hexA(q.color, 0.9 * k);
        f.beginPath();
        f.arc(q.x, q.y, q.size * (0.6 + 0.4 * k), 0, Math.PI * 2);
        f.fill();
      }
      f.restore();
      this.particles = this.particles.filter((q) => q.life < q.max);
    }
    if (this.texts.length) {
      f.save();
      f.textAlign = "center";
      f.textBaseline = "middle";
      for (const t of this.texts) {
        t.age += step;
        const life = t.big ? 1.7 : 0.95;
        const k = t.age / life;
        if (k >= 1) continue;
        const rise = (t.big ? 6 : 10) * Math.sqrt(k);
        const alpha = k < 0.08 ? k / 0.08 : 1 - Math.max(0, (k - 0.62) / 0.38);
        const scale = 1 + (t.big ? 0.35 : 0.22) * Math.max(0, 1 - t.age * 7);
        const size = (t.big ? 12.5 : 10) * scale;
        f.font = `800 ${size.toFixed(1)}px ${FONT}`;
        const w = f.measureText(t.text).width + 10 * scale;
        const h = size + 7 * scale;
        const y = t.y - rise;
        f.globalAlpha = alpha;
        f.fillStyle = "rgba(6, 10, 24, 0.86)";
        f.strokeStyle = hexA(t.color, 0.75);
        f.lineWidth = 1.2;
        f.beginPath();
        f.roundRect(t.x - w / 2, y - h / 2, w, h, h / 2);
        f.fill();
        f.stroke();
        f.fillStyle = t.color;
        f.fillText(t.text, t.x, y + 0.5);
      }
      f.restore();
      this.texts = this.texts.filter((t) => t.age < (t.big ? 1.7 : 0.95));
    }
  }

  /** 効果を消す（やりなおすとき） */
  clearFx() {
    this.particles = [];
    this.texts = [];
  }
}

/** #rrggbb に透明度をつける */
export function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, bl = n & 255;
  return `rgba(${r}, ${g}, ${bl}, ${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}
