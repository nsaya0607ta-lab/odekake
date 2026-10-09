/**
 * ご当地ピンボールの描画（Canvas 2D）
 * =============================================================
 * 台の座標（mm）のまま描けるように、キャンバスの変換で「1mm = scale px」にしてある。
 * 動かないもの（床・模様・県の形・レール・ポスト・スリングショット・バンパーの台座・ランプの影）は base に、
 * 玉より上に来るもの（ランプ・ワイヤー・エプロン）は overlay に、それぞれ一度だけ描いておき、
 * 毎フレームは光・玉・フリッパー・バンパーの笠・動く部品（ターゲット・スピナー・キックバック）・演出だけを重ねる。
 * 部品の材質（めっき・ゴム・プラスチック）の描き方は materials.ts。光は左上から当たり、影は右下に落ちる。
 * 重い影（shadowBlur）は、一度だけ描く base / overlay と前もって作る絵の中でだけ使う（毎フレームは使わない）。
 */
import { ENCORE_SEC, ITEM_RELOCATE_SEC, STAMP_COUNT } from "@/lib/games/pinball/config";
import { ballsOnTable, collectedCount, isBallSaveOn, scoreMult, type Game, type GameFx, type PinballItem, type Tone } from "@/lib/games/pinball/game";
import { flipperTip, PLUNGER_TRAVEL, rampPoint, type FlipperState } from "@/lib/games/pinball/physics";
import { BALL_R, ITEM_PICKUP_R, TABLE_H, TABLE_W, type Pt, type RampDef, type ShotId, type TableGeometry, type WallDef } from "@/lib/games/pinball/table";
import type { PinballPattern, PinballTheme } from "@/lib/games/pinball/themes";
import {
  alongLine,
  chromeDisc,
  chromeRing,
  chromeTube,
  darken,
  lighten,
  lineLength,
  mix,
  noShadow,
  offsetLine,
  plasticPost,
  plasticSheet,
  polyline,
  rgba,
  rubberBand,
  rubberRing,
  shadow,
} from "./materials";

export type PinballShape = { paths: readonly string[]; bbox: readonly [number, number, number, number] };

export type RenderAssets = {
  /** マップの形（ゲームと同じもの） */
  table: TableGeometry;
  theme: PinballTheme;
  shape: PinballShape | null;
  /** バンパーの上にのせるアイテム（バンパーの数より少なければ、くり返して使う） */
  bumperItems: readonly PinballItem[];
  /** 画面に収める範囲（mm）。無ければ台の全体（ステージのエディターは、台の上のほうだけを大きく見せる） */
  view?: ViewRect;
};

export type ViewRect = { x0: number; y0: number; w: number; h: number };

/** 台のまわりの余白も入れた、画面に収める範囲（mm） */
const VIEW: ViewRect = { x0: -14, y0: -14, w: TABLE_W + 28, h: TABLE_H + 14 };
const FONT = '"Hiragino Maru Gothic ProN","ヒラギノ丸ゴ ProN W4","Arial Rounded MT Bold","Yu Gothic",sans-serif';
const TAU = Math.PI * 2;
const LANE_LETTERS = ["お", "で", "か", "け"];
/** 台の上の電球のあたたかい光 */
const GI_COLOR = "#ffd9a3";
/** ランプの道幅（中心から内がわの壁の面まで）と、壁の中心線 */
const RAMP_FLOOR = 23;
const RAMP_WALL = 26;
/** ランプの壁（透明なプラスチックの板）の見た目の太さ */
const RAMP_WALL_W = 5;
/** ランプの床を玉より下（base）に描く境目。玉はここより下ではまだ床の上を転がっている */
const RAMP_SPLIT_Y = 576;
/** ワイヤーランプの2本のワイヤーの間かく（中心から） */
const WIRE_GAP = 9;
/** ランプの高さ（mm）。physics.ts の RAMP.topZ と同じ */
const RAMP_TOP_Z = 34;
/** キックバックの押し出し板（左右のアウトレーンのいちばん下） */
const KICKER = { y: 886, w: 26, h: 7 };
const KICKER_X = [21, 459] as const;

type InsertId =
  | { kind: "lane"; index: number }
  | { kind: "shot"; id: ShotId }
  | { kind: "kick"; index: number }
  | { kind: "bonus"; index: number }
  | { kind: "standup"; index: number }
  | { kind: "save" };

/** ボールセーブのランプの色 */
const SAVE_COLOR = "#7df9ff";

function circlePathAt(x: number, y: number, r: number): Path2D {
  const path = new Path2D();
  path.arc(x, y, r, 0, TAU);
  return path;
}

/** スタンドアップターゲットの前（床）のランプの位置 */
function standupInsertPos(table: TableGeometry, index: number): Pt {
  const t = table.standups[Math.floor(index / 3)]!.targets[index % 3]!;
  return { x: (t.a.x + t.b.x) / 2 + t.face.x * 19, y: (t.a.y + t.b.y) / 2 + t.face.y * 19 };
}

/** 線分 a→b を太さ r の丸い棒にした形（スタンドアップターゲット・その台） */
function capsulePath(a: Pt, b: Pt, r: number): Path2D {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const path = new Path2D();
  path.arc(a.x, a.y, r, ang + Math.PI / 2, ang - Math.PI / 2);
  path.arc(b.x, b.y, r, ang - Math.PI / 2, ang + Math.PI / 2);
  path.closePath();
  return path;
}

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: "spark" | "confetti" | "star" };
type Popup = { x: number; y: number; text: string; life: number; tone: Tone };
type Flying = { item: PinballItem; x0: number; y0: number; t: number };

const TONE_COLOR: Record<Tone, string> = {
  info: "#ffffff",
  good: "#ffe27a",
  great: "#7df9ff",
  epic: "#ff9de2",
  bad: "#ff8a80",
};

function shotPos(table: TableGeometry, id: ShotId): Pt & { angle: number } {
  return table.shots.find((s) => s.id === id)!.arrow;
}

/** 台の外わく（ここより内側が床） */
function playfieldPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(0, TABLE_H);
  ctx.lineTo(0, 261);
  ctx.arc(261, 261, 261, Math.PI, TAU);
  ctx.lineTo(TABLE_W, TABLE_H);
  ctx.closePath();
}

/** 台の外わくの線を外へ d ずらしたもの（下は開いている） */
function frameLine(d: number): Path2D {
  const path = new Path2D();
  path.moveTo(-d, TABLE_H + 4);
  path.lineTo(-d, 261);
  path.arc(261, 261, 261 + d, Math.PI, TAU);
  path.lineTo(TABLE_W + d, TABLE_H + 4);
  return path;
}

/** 角を丸めた多角形 */
function roundedPolygon(pts: readonly Pt[], r: number): Path2D {
  const path = new Path2D();
  const n = pts.length;
  for (let i = 0; i < n; i += 1) {
    const prev = pts[(i + n - 1) % n]!;
    const cur = pts[i]!;
    const next = pts[(i + 1) % n]!;
    const m0 = { x: (prev.x + cur.x) / 2, y: (prev.y + cur.y) / 2 };
    if (i === 0) path.moveTo(m0.x, m0.y);
    path.arcTo(cur.x, cur.y, (cur.x + next.x) / 2, (cur.y + next.y) / 2, r);
  }
  path.closePath();
  return path;
}

/** 三角形の各辺の内向きの向き（重心のほうを向く単位ベクトル）。辺は a→b, b→c, c→a の順 */
function triangleNormals(a: Pt, b: Pt, c: Pt): [Pt, Pt, Pt] {
  const pts = [a, b, c];
  const cx = (a.x + b.x + c.x) / 3;
  const cy = (a.y + b.y + c.y) / 3;
  return pts.map((p, i) => {
    const q = pts[(i + 1) % 3]!;
    const l = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    let nx = -(q.y - p.y) / l;
    let ny = (q.x - p.x) / l;
    if ((cx - p.x) * nx + (cy - p.y) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    return { x: nx, y: ny };
  }) as [Pt, Pt, Pt];
}

/**
 * 三角形の各辺を内がわへずらした線の交点（d は全部の辺に同じ値か、辺 a→b, b→c, c→a ごとの値。負なら外へ）
 */
function insetTriangle(a: Pt, b: Pt, c: Pt, d: number | readonly [number, number, number]): [Pt, Pt, Pt] {
  const pts = [a, b, c];
  const ns = triangleNormals(a, b, c);
  const lines = pts.map((p, i) => {
    const q = pts[(i + 1) % 3]!;
    const di = typeof d === "number" ? d : d[i]!;
    return { x: p.x + ns[i]!.x * di, y: p.y + ns[i]!.y * di, dx: q.x - p.x, dy: q.y - p.y };
  });
  const cross = (l1: (typeof lines)[number], l2: (typeof lines)[number]): Pt => {
    const den = l1.dx * l2.dy - l1.dy * l2.dx || 1e-9;
    const t = ((l2.x - l1.x) * l2.dy - (l2.y - l1.y) * l2.dx) / den;
    return { x: l1.x + l1.dx * t, y: l1.y + l1.dy * t };
  };
  return [cross(lines[2]!, lines[0]!), cross(lines[0]!, lines[1]!), cross(lines[1]!, lines[2]!)];
}

/** 肉球（スリングショットのカバーの絵）。s は大きさ（mm） */
function pawPath(x: number, y: number, s: number): Path2D {
  const path = new Path2D();
  for (const [dx, dy, r] of [[-0.62, -0.42, 0.2], [-0.22, -0.72, 0.21], [0.22, -0.72, 0.21], [0.62, -0.42, 0.2]] as const) {
    path.moveTo(x + dx * s + r * s, y + dy * s);
    path.ellipse(x + dx * s, y + dy * s, r * s, r * s * 1.12, 0, 0, TAU);
  }
  path.moveTo(x - 0.5 * s, y + 0.25 * s);
  path.bezierCurveTo(x - 0.5 * s, y - 0.2 * s, x - 0.2 * s, y - 0.3 * s, x, y - 0.3 * s);
  path.bezierCurveTo(x + 0.2 * s, y - 0.3 * s, x + 0.5 * s, y - 0.2 * s, x + 0.5 * s, y + 0.25 * s);
  path.bezierCurveTo(x + 0.5 * s, y + 0.55 * s, x + 0.25 * s, y + 0.6 * s, x, y + 0.5 * s);
  path.bezierCurveTo(x - 0.25 * s, y + 0.6 * s, x - 0.5 * s, y + 0.55 * s, x - 0.5 * s, y + 0.25 * s);
  path.closePath();
  return path;
}

/* ---------- 床の模様 ---------- */

function drawPattern(ctx: CanvasRenderingContext2D, pattern: PinballPattern, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.4;
  switch (pattern) {
    case "asanoha": {
      // 麻の葉：正三角形の格子に、中心から頂点への線
      const s = 46;
      const h = (s * Math.sqrt(3)) / 2;
      for (let row = -1; row < TABLE_H / h + 2; row += 1) {
        for (let col = -1; col < TABLE_W / s + 2; col += 1) {
          const x = col * s + (row % 2 ? s / 2 : 0);
          const y = row * h;
          const tri = [
            [x, y, x + s, y, x + s / 2, y + h],
            [x + s / 2, y + h, x + s, y, x + s * 1.5, y + h],
          ];
          for (const [ax, ay, bx, by, cx, cy] of tri) {
            const mx = (ax! + bx! + cx!) / 3;
            const my = (ay! + by! + cy!) / 3;
            ctx.beginPath();
            ctx.moveTo(ax!, ay!);
            ctx.lineTo(bx!, by!);
            ctx.lineTo(cx!, cy!);
            ctx.closePath();
            ctx.moveTo(mx, my);
            ctx.lineTo(ax!, ay!);
            ctx.moveTo(mx, my);
            ctx.lineTo(bx!, by!);
            ctx.moveTo(mx, my);
            ctx.lineTo(cx!, cy!);
            ctx.stroke();
          }
        }
      }
      break;
    }
    case "seigaiha": {
      // 青海波：重なる半円の波
      const r = 30;
      for (let row = 0; row < TABLE_H / (r * 0.5) + 2; row += 1) {
        for (let col = -1; col < TABLE_W / (r * 2) + 2; col += 1) {
          const x = col * r * 2 + (row % 2 ? r : 0);
          const y = row * r * 0.5;
          for (let k = 3; k >= 1; k -= 1) {
            ctx.beginPath();
            ctx.arc(x, y, (r * k) / 3, Math.PI, TAU);
            ctx.stroke();
          }
        }
      }
      break;
    }
    case "shippo": {
      // 七宝：円を半分ずつ重ねる
      const r = 26;
      for (let y = 0; y < TABLE_H + r; y += r) {
        for (let x = 0; x < TABLE_W + r; x += r) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, TAU);
          ctx.stroke();
        }
      }
      break;
    }
    case "yama": {
      // 山形：ジグザグの連なり
      for (let y = 20; y < TABLE_H; y += 34) {
        ctx.beginPath();
        for (let x = -20; x <= TABLE_W + 20; x += 24) {
          const yy = y + ((x / 24) % 2 === 0 ? 0 : -12);
          if (x === -20) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      break;
    }
    case "chabatake": {
      // 茶畑のうね：ゆるやかな波の列
      ctx.lineWidth = 3;
      for (let y = 10; y < TABLE_H; y += 22) {
        ctx.beginPath();
        for (let x = -10; x <= TABLE_W + 10; x += 6) {
          const yy = y + Math.sin(x / 38 + y / 90) * 6;
          if (x === -10) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      break;
    }
    case "footprint": {
      // 恐竜の足あと（3本指）が斜めに続く
      const foot = (x: number, y: number, a: number) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, 4, 6, 7, 0, 0, TAU);
        ctx.fill();
        for (const t of [-0.5, 0, 0.5]) {
          ctx.beginPath();
          ctx.ellipse(Math.sin(t) * 12, -8 + Math.abs(t) * 4, 2.6, 7, t, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      };
      for (let trail = 0; trail < 7; trail += 1) {
        for (let k = 0; k < 14; k += 1) {
          const x = 40 + trail * 70 + k * 18 + (k % 2 ? 10 : -10);
          const y = 40 + k * 72 - trail * 30;
          if (y > -20 && y < TABLE_H + 20) foot(x % (TABLE_W + 40), y, 0.45);
        }
      }
      break;
    }
    case "capsule": {
      // ガチャのカプセル：水玉と小さなカプセル
      let seed = 7;
      const rnd = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      for (let i = 0; i < 70; i += 1) {
        const x = rnd() * TABLE_W;
        const y = rnd() * TABLE_H;
        const r = 5 + rnd() * 9;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        if (i % 3 === 0) {
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x - r, y);
          ctx.lineTo(x + r, y);
          ctx.stroke();
        } else {
          ctx.fill();
        }
      }
      break;
    }
  }
  ctx.restore();
}

/* ---------- 前もって作る絵 ---------- */

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** 光（放射グラデーション）。lighter で重ねて使う */
function makeGlow(color: string, px: number): HTMLCanvasElement {
  const c = makeCanvas(px, px);
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
  g.addColorStop(0, rgba(color, 0.95));
  g.addColorStop(0.25, rgba(color, 0.55));
  g.addColorStop(0.6, rgba(color, 0.15));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, px, px);
  return c;
}

/** 銀の玉 */
function makeBallSprite(px: number): HTMLCanvasElement {
  const c = makeCanvas(px, px);
  const ctx = c.getContext("2d")!;
  const r = px / 2;
  const g = ctx.createRadialGradient(r * 0.62, r * 0.55, r * 0.05, r, r, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.18, "#f1f4f8");
  g.addColorStop(0.5, "#a9b3bf");
  g.addColorStop(0.82, "#5d6875");
  g.addColorStop(1, "#2b3138");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(r, r, r * 0.98, 0, TAU);
  ctx.fill();
  // 下に映りこむ床の光
  const g2 = ctx.createRadialGradient(r * 1.1, r * 1.55, 0, r * 1.1, r * 1.55, r * 0.7);
  g2.addColorStop(0, "rgba(255,255,255,0.35)");
  g2.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.arc(r, r, r * 0.98, 0, TAU);
  ctx.fill();
  return c;
}

/**
 * ぼかした塗り（影）。図形そのものは遠くに描いて、影だけを元の場所に落とす（図形の色は出ない）。
 * k は 1mm の画素数
 */
function softFill(ctx: CanvasRenderingContext2D, k: number, path: Path2D, color: string, blur: number): void {
  const far = 3000;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur * k;
  ctx.shadowOffsetX = far * k;
  ctx.shadowOffsetY = 0;
  ctx.translate(-far, 0);
  ctx.fillStyle = "#000";
  ctx.fill(path);
  ctx.restore();
}

function softStroke(ctx: CanvasRenderingContext2D, k: number, path: Path2D, width: number, color: string, blur: number): void {
  const far = 3000;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur * k;
  ctx.shadowOffsetX = far * k;
  ctx.shadowOffsetY = 0;
  ctx.translate(-far, 0);
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#000";
  ctx.stroke(path);
  ctx.restore();
}

/* ---------- ランプの形 ---------- */

type RampShape = {
  /** プラスチックの坂の中心線（入口 → 頂上） */
  plastic: Pt[];
  /** 各点の高さ（mm） */
  plasticZ: number[];
  /** ワイヤーの中心線（頂上 → インレーン） */
  wire: Pt[];
  wireZ: number[];
};

/** ランプの中心線を、高さつきで取り出す（高さの変わり方は physics.ts の rampPoint と同じ） */
function rampShape(def: RampDef): RampShape {
  const cum = [0];
  for (let i = 1; i < def.path.length; i += 1) cum.push(cum[i - 1]! + Math.hypot(def.path[i]!.x - def.path[i - 1]!.x, def.path[i]!.y - def.path[i - 1]!.y));
  const ascent = cum[def.ascentEnd]!;
  const top = cum[def.topEnd]!;
  const total = cum[cum.length - 1]!;
  const z = (s: number) => (s <= ascent ? (s / ascent) * RAMP_TOP_Z : s <= top ? RAMP_TOP_Z : RAMP_TOP_Z * (1 - (s - top) / Math.max(1, total - top)));
  const plastic = def.path.slice(0, def.topEnd + 1);
  const wire = def.path.slice(def.topEnd);
  return {
    plastic,
    plasticZ: plastic.map((_, i) => z(cum[i]!)),
    wire,
    wireZ: wire.map((_, i) => z(cum[def.topEnd + i]!)),
  };
}

/** 中心線の、y が RAMP_SPLIT_Y より上（玉より上に描くところ）だけを取り出す */
function upperPart(pts: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i]!;
    if (p.y <= RAMP_SPLIT_Y) {
      if (!out.length && i > 0) {
        const q = pts[i - 1]!;
        const t = (q.y - RAMP_SPLIT_Y) / (q.y - p.y || 1);
        out.push({ x: q.x + (p.x - q.x) * t, y: RAMP_SPLIT_Y });
      }
      out.push(p);
    }
  }
  return out;
}

/* ---------- 描画 ---------- */

export class PinballRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private assets: RenderAssets;
  private readonly table: TableGeometry;
  private cssW = 0;
  private cssH = 0;
  private dpr = 1;
  private scale = 1;
  private offX = 0;
  private offY = 0;
  private base: HTMLCanvasElement | null = null;
  private overlay: HTMLCanvasElement | null = null;
  private shapePath: Path2D | null = null;
  private shapeTransform: [number, number, number] = [1, 0, 0];
  private ballSprite: HTMLCanvasElement | null = null;
  private glows = new Map<string, HTMLCanvasElement>();
  private images = new Map<string, HTMLImageElement>();
  private tokens = new Map<string, HTMLCanvasElement>();
  private bumperSprites = new Map<string, HTMLCanvasElement>();
  private readonly ramps: readonly RampShape[];
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  private flying: Flying[] = [];
  private readonly bumperFlash: number[];
  private readonly slingFlash: number[];
  private shotFlash = new Map<string, number>();
  private kickFlash = [0, 0];
  private standupFlash = [0, 0, 0, 0, 0, 0];
  private standupsAllFlash = [0, 0];
  private readonly pinwheelFlash: number[];
  private gateFlash = [0, 0];
  /** 自分で作るステージのスピナー（板の向きと回る速さ）・ドロップターゲットの光（table.spinners・stageDrops と同じ順） */
  private readonly stageSpin: { angle: number; speed: number }[];
  private readonly stageDropFlash: number[];
  /** かざぐるまの羽根の絵（かざぐるまごと） */
  private pinwheelSprites = new Map<number, { body: HTMLCanvasElement; shadow: HTMLCanvasElement; half: number }>();
  private spinAngle = 0;
  private spinSpeed = 0;
  private shake = 0;
  private flash = 0;
  private flashColor = "#ffffff";
  private conquestGlow = 0;
  private time = 0;
  private frameDt = 0;
  /** 直近80msの軌跡。高速の玉を目で追えるようにする（物理には影響しない） */
  private ballTrails = new Map<number, { x: number; y: number; at: number; ramp: boolean }[]>();
  private reducedMotion = false;

  constructor(canvas: HTMLCanvasElement, assets: RenderAssets) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.assets = assets;
    this.table = assets.table;
    this.bumperFlash = this.table.bumpers.map(() => 0);
    this.slingFlash = this.table.slings.map(() => 0);
    this.pinwheelFlash = this.table.pinwheels.map(() => 0);
    this.stageSpin = this.table.spinners.map(() => ({ angle: 0, speed: 0 }));
    this.stageDropFlash = this.table.stageDrops.map(() => 0);
    this.ramps = this.table.ramps.map(rampShape);
    this.reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    if (assets.shape) {
      const [x0, y0, x1, y1] = assets.shape.bbox;
      const box = this.table.artBox;
      const s = Math.min(box.w / (x1 - x0), box.h / (y1 - y0)) * 0.92;
      this.shapeTransform = [s, box.x + box.w / 2 - ((x0 + x1) / 2) * s, box.y + box.h / 2 - ((y0 + y1) / 2) * s];
      const p = new Path2D();
      for (const d of assets.shape.paths) p.addPath(new Path2D(d));
      this.shapePath = p;
    }
  }

  /** 画像を読みこんだら知らせてもらう（読みこみ前はカプセルの絵の代わりに色の丸で描く） */
  setImage(src: string, img: HTMLImageElement): void {
    this.images.set(src, img);
    for (const key of [...this.tokens.keys()]) if (key.startsWith(`${src}|`)) this.tokens.delete(key);
    // バンパーの笠だけ描きなおす（床の絵は画像を使わないので作りなおさない）
    this.bumperSprites.clear();
  }

  /** 表示する大きさ（CSS px）が変わったとき */
  resize(cssW: number, cssH: number, dpr: number): void {
    const view = this.assets.view ?? VIEW;
    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = dpr;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.scale = Math.min(cssW / view.w, cssH / view.h);
    this.offX = (cssW - view.w * this.scale) / 2 - view.x0 * this.scale;
    // 縦に余るときは下にそろえる（フリッパーが親指に近くなる）
    this.offY = cssH - view.h * this.scale - view.y0 * this.scale;
    this.base = null;
    this.overlay = null;
    this.ballSprite = null;
    this.glows.clear();
    this.tokens.clear();
    this.bumperSprites.clear();
    this.pinwheelSprites.clear();
  }

  /** 画面の点（CSS px）→ 台の座標（mm） */
  toTable(x: number, y: number): Pt {
    return { x: (x - this.offX) / this.scale, y: (y - this.offY) / this.scale };
  }

  /** 台の座標（mm）→ 画面の点（CSS px） */
  toScreen(x: number, y: number): Pt {
    return { x: x * this.scale + this.offX, y: y * this.scale + this.offY };
  }

  get mmToPx(): number {
    return this.scale;
  }

  /** キャンバス全体に見えている範囲（台の座標・mm）。上に重ねる SVG の viewBox に使う */
  visibleRect(): ViewRect {
    return { x0: -this.offX / this.scale, y0: -this.offY / this.scale, w: this.cssW / this.scale, h: this.cssH / this.scale };
  }

  /** 1mm がキャンバスの何画素か（影のぼかしの大きさに使う） */
  private get k(): number {
    return this.scale * this.dpr;
  }

  private setTableTransform(ctx: CanvasRenderingContext2D, shakeX = 0, shakeY = 0): void {
    const k = this.scale * this.dpr;
    ctx.setTransform(k, 0, 0, k, (this.offX + shakeX) * this.dpr, (this.offY + shakeY) * this.dpr);
  }

  private glow(color: string): HTMLCanvasElement {
    let g = this.glows.get(color);
    if (!g) {
      g = makeGlow(color, Math.max(32, Math.round(64 * this.scale * this.dpr)));
      this.glows.set(color, g);
    }
    return g;
  }

  /** 丸く切りぬいたアイテムの絵（ふちつき） */
  private token(item: PinballItem, mm: number, rim: string): HTMLCanvasElement | null {
    if (!item.image) return null;
    const px = Math.max(8, Math.round(mm * 2 * this.scale * this.dpr));
    const key = `${item.image}|${px}|${rim}`;
    const cached = this.tokens.get(key);
    if (cached) return cached;
    const img = this.images.get(item.image);
    if (!img || !img.complete || !img.naturalWidth) return null;
    const c = makeCanvas(px, px);
    const ctx = c.getContext("2d")!;
    const r = px / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(r, r, r * 0.96, 0, TAU);
    ctx.fillStyle = "#fffaf0";
    ctx.fill();
    ctx.clip();
    const pad = item.rarity ? 0.92 : 1.02;
    ctx.drawImage(img, r - r * pad, r - r * pad, r * pad * 2, r * pad * 2);
    ctx.restore();
    ctx.lineWidth = Math.max(1.5, px * 0.06);
    ctx.strokeStyle = rim;
    ctx.beginPath();
    ctx.arc(r, r, r * 0.95, 0, TAU);
    ctx.stroke();
    this.tokens.set(key, c);
    return c;
  }

  /* ---------- 演出を受けとる ---------- */

  pushFx(list: readonly GameFx[]): void {
    for (const fx of list) {
      switch (fx.type) {
        case "flash": {
          const [kind, arg, arg2] = fx.id.split(":");
          if (kind === "bumper") {
            const i = Number(arg);
            this.bumperFlash[i] = 1;
            const b = this.table.bumpers[i];
            if (b) this.burst(b.x, b.y, 7, this.assets.theme.colors.accent, 26);
          } else if (kind === "sling") {
            this.slingFlash[Number(arg)] = 1;
          } else if (kind === "spinner") {
            this.spinSpeed = Math.max(this.spinSpeed, Number(arg) * 9);
          } else if (kind === "kickback") {
            this.kickFlash[Number(arg)] = 1;
          } else if (kind === "shot") {
            this.shotFlash.set(arg!, 1);
          } else if (kind === "lanes") {
            for (const x of this.table.laneX) this.burst(x, this.table.laneY, 6, this.assets.theme.colors.accent, 20);
          } else if (kind === "standup") {
            const i = Number(arg);
            this.standupFlash[i] = 1;
            const t = this.table.standups[Math.floor(i / 3)]!.targets[i % 3]!;
            this.burst((t.a.x + t.b.x) / 2 + t.face.x * 4, (t.a.y + t.b.y) / 2 + t.face.y * 4, 6, this.assets.theme.colors.accent2, 18);
          } else if (kind === "standupsAll") {
            const b = Number(arg);
            this.standupsAllFlash[b] = 1;
            const c = this.table.standups[b]!.center;
            this.burst(c.x, c.y, 18, "#ffffff", 34, "star");
          } else if (kind === "pinwheel") {
            const i = Number(arg) || 0;
            if (i < this.pinwheelFlash.length) this.pinwheelFlash[i] = 1;
          } else if (kind === "gate") {
            this.gateFlash[Number(arg)] = 1;
          } else if (kind === "spin") {
            const st = this.stageSpin[Number(arg)];
            if (st) st.speed = Math.max(st.speed, Number(arg2) * 9);
          } else if (kind === "stageDrop") {
            const i = Number(arg);
            const d = this.table.stageDrops[i];
            if (d) {
              this.stageDropFlash[i] = 1;
              this.burst((d.a.x + d.b.x) / 2, (d.a.y + d.b.y) / 2, 6, this.assets.theme.colors.accent, 18);
            }
          } else if (kind === "stageDropsAll") {
            for (const d of this.table.stageDrops) this.burst((d.a.x + d.b.x) / 2, (d.a.y + d.b.y) / 2, 10, "#ffffff", 30, "star");
          }
          break;
        }
        case "pop":
          if (this.popups.length < 18) this.popups.push({ x: fx.x, y: fx.y, text: fx.text, life: 1, tone: fx.tone });
          break;
        case "collect": {
          this.flying.push({ item: fx.item, x0: fx.from.x, y0: fx.from.y, t: 0 });
          this.burst(fx.from.x, fx.from.y, 22, "#ffffff", 40, "star");
          this.flash = Math.max(this.flash, 0.25);
          this.flashColor = this.assets.theme.colors.accent;
          break;
        }
        case "shake":
          if (!this.reducedMotion) this.shake = Math.max(this.shake, fx.power);
          break;
        case "conquest":
          this.conquestGlow = 1;
          this.flash = 0.8;
          this.flashColor = this.assets.theme.colors.shape;
          for (let i = 0; i < 80; i += 1) {
            const colors = [this.assets.theme.colors.accent, this.assets.theme.colors.accent2, "#ffffff", "#7df9ff"];
            this.particles.push({
              x: 40 + Math.random() * 440,
              y: 300 + Math.random() * 400,
              vx: (Math.random() - 0.5) * 220,
              vy: -200 - Math.random() * 300,
              life: 1.6 + Math.random() * 1.2,
              max: 2.8,
              size: 3 + Math.random() * 4,
              color: colors[i % colors.length]!,
              kind: "confetti",
            });
          }
          break;
        case "gacha":
          this.burst(this.table.scoop.x, this.table.scoop.y, 24, this.assets.theme.colors.accent2, 46, "star");
          break;
        case "skill":
          this.flash = Math.max(this.flash, 0.35);
          this.flashColor = this.assets.theme.colors.accent2;
          break;
        default:
          break;
      }
    }
  }

  private burst(x: number, y: number, n: number, color: string, speed: number, kind: Particle["kind"] = "spark"): void {
    if (this.particles.length > 260) return;
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * TAU;
      const v = speed * (0.4 + Math.random()) * 6;
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.35, max: 0.7, size: kind === "star" ? 3.5 : 2, color, kind });
    }
  }

  /* ---------- 動かない絵（床と、床に固定された部品） ---------- */

  private buildBase(): HTMLCanvasElement {
    const c = makeCanvas(this.canvas.width, this.canvas.height);
    const ctx = c.getContext("2d")!;
    const { colors, pattern } = this.assets.theme;
    ctx.fillStyle = colors.frame;
    ctx.fillRect(0, 0, c.width, c.height);
    this.setTableTransform(ctx);

    this.drawCabinet(ctx);

    // 床
    ctx.save();
    playfieldPath(ctx);
    ctx.clip();
    const grad = ctx.createLinearGradient(0, 0, 0, TABLE_H);
    grad.addColorStop(0, colors.bg0);
    grad.addColorStop(1, colors.bg1);
    ctx.fillStyle = grad;
    ctx.fillRect(-20, -20, TABLE_W + 40, TABLE_H + 40);
    drawPattern(ctx, pattern, colors.pattern);
    const center = ctx.createRadialGradient(240, 560, 20, 240, 560, 420);
    center.addColorStop(0, "rgba(255,255,255,0.09)");
    center.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = center;
    ctx.fillRect(0, 0, TABLE_W, TABLE_H);
    this.drawShooterLaneFloor(ctx);

    // 県の形（光る前）
    if (this.shapePath) {
      const [s, tx, ty] = this.shapeTransform;
      ctx.save();
      ctx.transform(s, 0, 0, s, tx, ty);
      ctx.fillStyle = rgba(colors.shape, 0.07);
      ctx.fill(this.shapePath);
      ctx.lineWidth = 2.2 / s;
      ctx.strokeStyle = rgba(colors.shape, 0.45);
      ctx.stroke(this.shapePath);
      ctx.restore();
    }
    this.drawInsertsOff(ctx);
    this.table.pinwheels.forEach((_, i) => this.drawPinwheelBase(ctx, i));
    this.drawGI(ctx);
    this.drawEdgeShade(ctx);
    this.drawRampShadows(ctx);
    this.drawRecesses(ctx);
    this.drawRampFloorLower(ctx);
    ctx.restore();

    this.drawBumperBases(ctx);
    for (const w of this.table.walls) this.drawWall(ctx, w);
    this.drawStandupBanks(ctx);
    this.drawSlingBodies(ctx);
    this.drawPosts(ctx);
    if (!this.table.freeform) this.drawSpinnerFrame(ctx);
    this.drawStageSpinnerFrames(ctx);
    this.drawShooterParts(ctx);
    return c;
  }

  /** キャビネットの木のふちと、玉が当たる金属のふち */
  private drawCabinet(ctx: CanvasRenderingContext2D): void {
    const k = this.k;
    const outer = frameLine(12);
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineWidth = 26;
    ctx.strokeStyle = "#120d09";
    ctx.stroke(outer);
    const wood = ctx.createLinearGradient(0, 0, TABLE_W, TABLE_H);
    wood.addColorStop(0, "#7a5a3e");
    wood.addColorStop(0.45, "#94704d");
    wood.addColorStop(1, "#4a3523");
    ctx.lineWidth = 15;
    ctx.strokeStyle = wood;
    ctx.stroke(frameLine(11));
    // 木目
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = "rgba(40,24,12,0.35)";
    for (const d of [7.5, 10, 13.5, 16]) ctx.stroke(frameLine(d));
    // 内がわへ落ちる段
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.stroke(frameLine(5.6));
    ctx.restore();
    chromeTube(ctx, k, frameLine(2.6), 5.2, { lift: 0, tint: this.assets.theme.colors.rail });
  }

  /** 打ち出しレーンの床（細長いみぞ） */
  private drawShooterLaneFloor(ctx: CanvasRenderingContext2D): void {
    const g = ctx.createLinearGradient(486, 0, 522, 0);
    g.addColorStop(0, "rgba(0,0,0,0.55)");
    g.addColorStop(0.5, "rgba(0,0,0,0.25)");
    g.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = g;
    ctx.fillRect(486, 280, 36, TABLE_H);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(503, 320, 2, TABLE_H);
  }

  /** 台の上の電球の光（スリングショット・バンパー・レーンのまわりがあたたかく明るい） */
  private drawGI(ctx: CanvasRenderingContext2D): void {
    const { colors } = this.assets.theme;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const spot = (x: number, y: number, r: number, color: string, a: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(color, a));
      g.addColorStop(0.55, rgba(color, a * 0.35));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    for (const s of this.table.slings) {
      const cx = (s.a.x + s.b.x + s.c.x) / 3;
      const cy = (s.a.y + s.b.y + s.c.y) / 3;
      spot(cx, cy, 70, GI_COLOR, 0.16);
    }
    for (const b of this.table.bumpers) spot(b.x, b.y, 64, colors.accent, 0.1);
    for (const x of this.table.laneX) spot(x, 132, 30, GI_COLOR, 0.12);
    for (const x of [96, 384]) spot(x, 868, 52, GI_COLOR, 0.1);
    if (this.table.scoop.r > 0) spot(this.table.scoop.x, this.table.scoop.y + 10, 46, colors.accent, 0.1);
    for (const r of this.table.ramps) spot(r.path[0]!.x, 622, 40, GI_COLOR, 0.08);
    ctx.restore();
  }

  /** 床のふちが少し暗くなる（壁の影） */
  private drawEdgeShade(ctx: CanvasRenderingContext2D): void {
    const k = this.k;
    ctx.save();
    shadow(ctx, k, 0, 0, 9, "rgba(0,0,0,0.8)");
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    playfieldPath(ctx);
    ctx.stroke();
    noShadow(ctx);
    ctx.restore();
  }

  /** ランプとワイヤーが床に落とす影（高いところほど右下へ遠くずれる） */
  private drawRampShadows(ctx: CanvasRenderingContext2D): void {
    const k = this.k;
    const shift = (p: Pt, z: number): Pt => ({ x: p.x + 1.5 + z * 0.3, y: p.y + 2.5 + z * 0.45 });
    for (const r of this.ramps) {
      const left = offsetLine(r.plastic, RAMP_WALL + 1.5).map((p, i) => shift(p, r.plasticZ[i]!));
      const right = offsetLine(r.plastic, -RAMP_WALL - 1.5).map((p, i) => shift(p, r.plasticZ[i]!));
      const outline = polyline([...left, ...right.reverse()], true);
      softFill(ctx, k, outline, "rgba(0,0,0,0.42)", 5);
      for (const d of [WIRE_GAP, -WIRE_GAP]) {
        const wire = offsetLine(r.wire, d).map((p, i) => shift(p, r.wireZ[i]!));
        softStroke(ctx, k, polyline(wire), 2, "rgba(0,0,0,0.5)", 1.8);
      }
    }
  }

  /** 床のくぼみ：ガチャ穴・ドロップターゲットのみぞ・キックバックの穴 */
  private drawRecesses(ctx: CanvasRenderingContext2D): void {
    const { colors } = this.assets.theme;
    // ガチャ穴（キックアウトホール）：めっきのふちの、深い穴
    const sc = this.table.scoop;
    if (sc.r > 0) {
      const pit = ctx.createRadialGradient(sc.x + 2, sc.y + 3, 1, sc.x, sc.y, 16);
      pit.addColorStop(0, "#000000");
      pit.addColorStop(0.62, "#05040a");
      pit.addColorStop(0.86, darken(colors.accent, 0.75));
      pit.addColorStop(1, "rgba(0,0,0,0.9)");
      ctx.fillStyle = pit;
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, 16, 0, TAU);
      ctx.fill();
      // 穴の内がわの壁：光が当たるのは向こうがわ（右下）、手前（左上）はふちの影になる
      const wall = ctx.createLinearGradient(sc.x + 11, sc.y + 11, sc.x - 6, sc.y - 6);
      wall.addColorStop(0, "rgba(190,200,214,0.5)");
      wall.addColorStop(0.5, "rgba(80,90,104,0.14)");
      wall.addColorStop(1, "rgba(0,0,0,0)");
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = wall;
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, 13.1, -Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
      ctx.lineWidth = 3.4;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, 13.1, Math.PI * 0.85, Math.PI * 1.75);
      ctx.stroke();
      // 奥のけり出し板
      ctx.fillStyle = "rgba(96,106,118,0.5)";
      ctx.beginPath();
      ctx.ellipse(sc.x, sc.y - 6.5, 6, 1.9, 0, 0, TAU);
      ctx.fill();
      chromeRing(ctx, sc.x, sc.y, 16.6, 2.6);
    }

    // ドロップターゲットのみぞ
    for (const d of this.table.drops) {
      const x0 = d.a.x - 1.2;
      const w = d.b.x - d.a.x + 2.4;
      ctx.fillStyle = "#040507";
      ctx.fillRect(x0, d.a.y - 4.2, w, 8.4);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(x0, d.a.y + 3.4, w, 0.8);
      ctx.strokeStyle = "rgba(170,180,192,0.55)";
      ctx.lineWidth = 0.6;
      ctx.strokeRect(x0, d.a.y - 4.2, w, 8.4);
    }

    // キックバックの押し出し板が入る穴
    for (const x of this.table.freeform ? [] : KICKER_X) {
      ctx.fillStyle = "#040507";
      this.roundRect(ctx, x - KICKER.w / 2 - 1.5, KICKER.y - 1.5, KICKER.w + 3, KICKER.h + 3, 2.5);
      ctx.fill();
      ctx.strokeStyle = "rgba(170,180,192,0.45)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
  }

  /** ランプの床の色（base と overlay で同じものを使い、つなぎ目が見えないようにする） */
  private rampFloorFill(ctx: CanvasRenderingContext2D): CanvasGradient {
    const { colors } = this.assets.theme;
    const g = ctx.createLinearGradient(0, 612, 0, 340);
    g.addColorStop(0, rgba(colors.plastic, 0.2));
    g.addColorStop(0.45, lighten(colors.plastic, 0.12, 0.3));
    g.addColorStop(1, lighten(colors.plastic, 0.3, 0.4));
    return g;
  }

  /** ランプの床（透明なプラスチック）。base の入口と overlay の坂で同じ描き方にして、つなぎ目を見せない */
  private paintRampFloor(ctx: CanvasRenderingContext2D, center: readonly Pt[]): void {
    const floorL = offsetLine(center, RAMP_FLOOR);
    const floorR = offsetLine(center, -RAMP_FLOOR);
    const floor = polyline([...floorL, ...[...floorR].reverse()], true);
    ctx.fillStyle = this.rampFloorFill(ctx);
    ctx.fill(floor);
    ctx.save();
    ctx.clip(floor);
    ctx.lineCap = "butt";
    // 壁ぎわは光が曲がって少し暗く見える
    ctx.lineWidth = 7;
    ctx.strokeStyle = "rgba(0,0,0,0.16)";
    ctx.stroke(polyline(floorL));
    ctx.stroke(polyline(floorR));
    // 床のつやの筋
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.stroke(polyline(offsetLine(center, 11)));
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.stroke(polyline(offsetLine(center, -8)));
    ctx.restore();
  }

  /** ランプの入口（玉がまだ床の上を転がっているところ）：床のつづきと、めっきの入口の板 */
  private drawRampFloorLower(ctx: CanvasRenderingContext2D): void {
    for (const r of this.table.ramps) {
      const x = r.path[0]!.x;
      this.paintRampFloor(ctx, [{ x, y: 604 }, { x, y: RAMP_SPLIT_Y }]);
      // 入口の板（床に乗っている薄いめっきの板）
      const g = ctx.createLinearGradient(0, 603, 0, 612);
      g.addColorStop(0, "#f2f5f8");
      g.addColorStop(0.45, "#a7b2be");
      g.addColorStop(1, "#5d6773");
      ctx.fillStyle = g;
      this.roundRect(ctx, x - RAMP_FLOOR - 1, 603, (RAMP_FLOOR + 1) * 2, 8.5, 1.6);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
      for (const dx of [-15, 15]) chromeDisc(ctx, x + dx, 607.3, 1.5, true);
    }
  }

  /** バンパーの台座：影と、色つきプラスチックのスカート */
  private drawBumperBases(ctx: CanvasRenderingContext2D): void {
    const { colors } = this.assets.theme;
    const k = this.k;
    for (const b of this.table.bumpers) {
      const body = new Path2D();
      body.arc(b.x + 3.5, b.y + 6, b.r + 3, 0, TAU);
      softFill(ctx, k, body, "rgba(0,0,0,0.6)", 7);
      const skirt = new Path2D();
      skirt.arc(b.x, b.y, b.r + 5.5, 0, TAU);
      skirt.moveTo(b.x + b.r - 1, b.y);
      skirt.arc(b.x, b.y, b.r - 1, 0, TAU, true);
      plasticSheet(ctx, k, skirt, colors.accent2, { x: b.x - b.r - 6, y: b.y - b.r - 6, w: (b.r + 6) * 2, h: (b.r + 6) * 2 }, { lift: 0.5, opacity: 0.92 });
      // スカートの切りかき
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * TAU + 0.3;
        ctx.save();
        ctx.translate(b.x + Math.cos(a) * (b.r + 3.2), b.y + Math.sin(a) * (b.r + 3.2));
        ctx.rotate(a);
        this.roundRect(ctx, -1.2, -2.6, 2.4, 5.2, 1);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
  }

  private drawWall(ctx: CanvasRenderingContext2D, w: WallDef): void {
    if (w.look === "frame" || w.look === "sling" || w.look === "standup-back") return;
    if (w.look === "ramp-roof") {
      // ランプの下の支え（入口の箱の山形の屋根）。透明なランプごしに、黒い支えとして見える
      const path = polyline(w.pts);
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = w.r * 2;
      ctx.strokeStyle = "#20242a";
      ctx.stroke(path);
      ctx.translate(-0.5, -0.8);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.stroke(path);
      ctx.restore();
      return;
    }
    // 外わくにかさなるだけの線（アウトレーンの下の外がわ）は外わくで描いてある
    if (w.pts.every((p) => p.x <= 0.5)) return;
    const k = this.k;
    const { colors } = this.assets.theme;
    if (w.look === "ramp-mouth") {
      // ランプの入口の箱：横の壁の、玉がまだ床にいるところだけ（上は overlay のランプの壁につながる）
      const path = new Path2D();
      for (let i = 1; i < w.pts.length; i += 1) {
        let p = w.pts[i - 1]!;
        let q = w.pts[i]!;
        if (p.y < RAMP_SPLIT_Y && q.y < RAMP_SPLIT_Y) continue;
        if (Math.abs(p.y - q.y) < 0.01) continue;
        if (p.y < RAMP_SPLIT_Y) p = { x: p.x + ((q.x - p.x) * (RAMP_SPLIT_Y - p.y)) / (q.y - p.y), y: RAMP_SPLIT_Y };
        if (q.y < RAMP_SPLIT_Y) q = { x: q.x + ((p.x - q.x) * (RAMP_SPLIT_Y - q.y)) / (p.y - q.y), y: RAMP_SPLIT_Y };
        path.moveTo(p.x, p.y);
        path.lineTo(q.x, q.y);
      }
      this.drawClearWall(ctx, path, RAMP_WALL_W, "butt");
      return;
    }
    if (w.look === "rubber") {
      // ゴムのかべ：2本のポストに張ったゴム（太さは当たり判定と同じ）。両はしにポストのめっきの頭
      rubberBand(ctx, k, polyline(w.pts), w.r * 2, { lift: 0.9 });
      for (const v of [w.pts[0]!, w.pts[w.pts.length - 1]!]) chromeDisc(ctx, v.x, v.y, w.r * 0.62, true);
      return;
    }
    if (w.look === "block") {
      this.drawBlock(ctx, w);
      return;
    }
    const path = polyline(w.pts, w.closed);
    chromeTube(ctx, k, path, w.r * 2, { lift: w.look === "lane" ? 0.8 : 1, tint: colors.rail });
  }

  /**
   * プラスチックのブロック（自分で作るステージ）：当たり判定の形（中心線の多角形を r だけ太らせた形）のとおりに、
   * 色つきの透明プラスチックで描く。中に電球の光と、印刷された肉球
   */
  private drawBlock(ctx: CanvasRenderingContext2D, w: WallDef): void {
    const { colors } = this.assets.theme;
    const k = this.k;
    const n = w.pts.length;
    const cx = w.pts.reduce((sum, p) => sum + p.x, 0) / n;
    const cy = w.pts.reduce((sum, p) => sum + p.y, 0) / n;
    // 角を r だけ外へ（各辺を r ずつ外へずらした多角形の角。角の丸みの中心がもとの角になる）
    const outer = w.pts.map((cur, i) => {
      const prev = w.pts[(i + n - 1) % n]!;
      const next = w.pts[(i + 1) % n]!;
      const n1 = { x: cur.y - prev.y, y: prev.x - cur.x };
      const n2 = { x: next.y - cur.y, y: cur.x - next.x };
      const l1 = Math.hypot(n1.x, n1.y) || 1;
      const l2 = Math.hypot(n2.x, n2.y) || 1;
      // 外向きにそろえる（重心から遠ざかる向き）
      const s1 = (cur.x - cx) * n1.x + (cur.y - cy) * n1.y >= 0 ? 1 : -1;
      const s2 = (cur.x - cx) * n2.x + (cur.y - cy) * n2.y >= 0 ? 1 : -1;
      const u1 = { x: (n1.x / l1) * s1, y: (n1.y / l1) * s1 };
      const u2 = { x: (n2.x / l2) * s2, y: (n2.y / l2) * s2 };
      const bis = { x: u1.x + u2.x, y: u1.y + u2.y };
      const bl = Math.hypot(bis.x, bis.y) || 1;
      const cosHalf = (u1.x * bis.x + u1.y * bis.y) / bl;
      const d = w.r / Math.max(0.2, cosHalf);
      return { x: cur.x + (bis.x / bl) * d, y: cur.y + (bis.y / bl) * d };
    });
    const path = roundedPolygon(outer, w.r);
    const xs = outer.map((p) => p.x);
    const ys = outer.map((p) => p.y);
    const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    plasticSheet(ctx, k, path, colors.accent2, box, { lift: 1.2, opacity: 0.9 });
    ctx.save();
    ctx.clip(path);
    ctx.globalCompositeOperation = "lighter";
    const lamp = ctx.createRadialGradient(cx, cy, 0, cx, cy, box.w * 0.55);
    lamp.addColorStop(0, rgba(GI_COLOR, 0.55));
    lamp.addColorStop(1, rgba(GI_COLOR, 0));
    ctx.fillStyle = lamp;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fill(pawPath(cx, cy + 1.5, Math.min(box.w, box.h) * 0.22));
    ctx.restore();
  }

  /** スピナーの軸受け（自分で作るステージ）：板の両はしのめっきの金具と、細い軸。板は毎フレーム drawStageSpinners で描く */
  private drawStageSpinnerFrames(ctx: CanvasRenderingContext2D): void {
    for (const sp of this.table.spinners) {
      const half = sp.w / 2;
      ctx.save();
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(sp.x - half + 1.4, sp.y + 2.4);
      ctx.lineTo(sp.x + half + 1.4, sp.y + 2.4);
      ctx.stroke();
      ctx.restore();
      chromeTube(ctx, this.k, polyline([{ x: sp.x - half - 3, y: sp.y }, { x: sp.x + half + 3, y: sp.y }]), 1.4, { lift: 0.6 });
      for (const x of [sp.x - half - 3, sp.x + half + 3]) chromeDisc(ctx, x, sp.y, 2.8, true);
    }
  }

  /** 透明なプラスチックの壁（ランプの横の壁）。ふちが光り、中は少しだけ色がつく */
  private drawClearWall(ctx: CanvasRenderingContext2D, path: Path2D, width: number, cap: CanvasLineCap = "round"): void {
    const { colors } = this.assets.theme;
    const k = this.k;
    ctx.save();
    ctx.lineCap = cap;
    ctx.lineJoin = "round";
    shadow(ctx, k, 1.6, 2.8, 3, "rgba(0,0,0,0.45)");
    ctx.lineWidth = width;
    ctx.strokeStyle = lighten(colors.plastic, 0.25, 0.42);
    ctx.stroke(path);
    noShadow(ctx);
    ctx.lineWidth = width * 0.45;
    ctx.strokeStyle = lighten(colors.plastic, 0.55, 0.3);
    ctx.stroke(path);
    ctx.translate(-width * 0.12, -width * 0.16);
    ctx.lineWidth = Math.max(0.4, width * 0.16);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.stroke(path);
    ctx.restore();
  }

  /** スリングショットの頂点にあるポストか（カバーの下に描くので、ふつうのポストとは別に描く） */
  private isSlingPost(x: number, y: number): boolean {
    return this.table.slings.some((s) => [s.a, s.b, s.c].some((v) => Math.abs(v.x - x) < 0.01 && Math.abs(v.y - y) < 0.01));
  }

  /**
   * スリングショット：まわりのゴムとポストの上に、色つきプラスチックのカバーをかぶせる。
   * カバーは外がわの2辺ではゴムをおおい、はじく面（上 → 内の下）ではゴムが見えるように少し内がわで切る。
   * はじく面のゴムは drawSlings で毎フレーム描く
   */
  private drawSlingBodies(ctx: CanvasRenderingContext2D): void {
    const { colors } = this.assets.theme;
    const k = this.k;
    for (const s of this.table.slings) {
      // カバーの下：外がわの2辺のゴムと、3本のポストのゴムの輪
      rubberBand(ctx, k, polyline([s.a, s.b, s.c]), 6, { lift: 0.9 });
      for (const v of [s.a, s.b, s.c]) rubberRing(ctx, k, v.x, v.y, 5.3, 2.6, { lift: 0.9 });
      // カバー：辺ごとにずらした線の交点でつくる（外がわの2辺は外へ 3.2mm、はじく面は内へ 4.8mm）
      const nca = triangleNormals(s.a, s.b, s.c)[2];
      const sh = (p: Pt, n: Pt, d: number): Pt => ({ x: p.x + n.x * d, y: p.y + n.y * d });
      const pts = insetTriangle(s.a, s.b, s.c, [-3.2, -3.2, 4.8]);
      const cover = roundedPolygon(pts, 3);
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      plasticSheet(ctx, k, cover, colors.accent, box, { lift: 1.2, opacity: 0.88 });
      // カバーの下の電球の光と、印刷された絵（はじく面にそった2本の線・肉球）
      ctx.save();
      ctx.clip(cover);
      ctx.globalCompositeOperation = "lighter";
      const cx = (s.a.x + s.b.x + s.c.x) / 3;
      const cy = (s.a.y + s.b.y + s.c.y) / 3;
      const lamp = ctx.createRadialGradient(cx, cy, 0, cx, cy, 34);
      lamp.addColorStop(0, rgba(GI_COLOR, 0.6));
      lamp.addColorStop(1, rgba(GI_COLOR, 0));
      ctx.fillStyle = lamp;
      ctx.fillRect(cx - 34, cy - 34, 68, 68);
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      ctx.strokeStyle = rgba(colors.accent2, 0.85);
      for (const d of [8.5, 11.5]) {
        const p0 = sh(s.a, nca, d);
        const p1 = sh(s.c, nca, d);
        ctx.beginPath();
        ctx.moveTo(p0.x + (p1.x - p0.x) * 0.16, p0.y + (p1.y - p0.y) * 0.16);
        ctx.lineTo(p0.x + (p1.x - p0.x) * 0.84, p0.y + (p1.y - p0.y) * 0.84);
        ctx.stroke();
      }
      const inner = insetTriangle(s.a, s.b, s.c, 6);
      const px = (inner[0].x + inner[1].x * 1.2 + inner[2].x) / 3.2;
      const py = (inner[0].y + inner[1].y * 1.2 + inner[2].y) / 3.2;
      ctx.fillStyle = "rgba(255,255,255,0.62)";
      ctx.fill(pawPath(px, py + 4, 7.5));
      ctx.restore();
      // カバーの上に出ているねじ（はじく面の両はしは drawSlings でゴムの上に描く）
      chromeDisc(ctx, s.b.x, s.b.y, 2.6, true);
    }
  }

  /**
   * スタンドアップターゲットの台（黒いプラスチックの台・ねじ）と、消えているときの的。
   * 的は台の前のへりに並び、光ると drawStandupsLit で明るく描きなおす
   */
  private drawStandupBanks(ctx: CanvasRenderingContext2D): void {
    const k = this.k;
    this.table.standups.forEach((bank, bi) => {
      const back = this.table.walls.filter((w) => w.look === "standup-back")[bi];
      if (!back) return;
      const [a, b] = [back.pts[0]!, back.pts[1]!];
      const body = capsulePath(a, b, back.r);
      // 台の影と本体（左上が明るいプラスチック）
      ctx.save();
      shadow(ctx, k, 1.8, 3, 3.4, "rgba(0,0,0,0.6)");
      const g = ctx.createLinearGradient(a.x, a.y - 8, a.x, a.y + 8);
      g.addColorStop(0, "#4b525c");
      g.addColorStop(0.45, "#262a31");
      g.addColorStop(1, "#111317");
      ctx.fillStyle = g;
      ctx.fill(body);
      noShadow(ctx);
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.stroke(body);
      ctx.restore();
      // 上の面のつや
      ctx.save();
      ctx.clip(body);
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      const off = { x: -bank.targets[0].face.x * 3, y: -bank.targets[0].face.y * 3 };
      ctx.beginPath();
      ctx.moveTo(a.x + off.x, a.y + off.y);
      ctx.lineTo(b.x + off.x, b.y + off.y);
      ctx.stroke();
      ctx.restore();
      // 両はしのねじ
      for (const t of [0.04, 0.96]) chromeDisc(ctx, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 2.1, true);
      // 消えている的
      bank.targets.forEach((_, ti) => this.paintStandup(ctx, bi * 3 + ti, 0));
    });
  }

  /**
   * スタンドアップターゲット1つ（on: 0 消えている 〜 1 点いている）。台の前のへりから少し飛び出した、
   * 角の丸い色つきプラスチックの板（玉が当たる前の面は、当たり判定の前の面と同じ位置）
   */
  private paintStandup(ctx: CanvasRenderingContext2D, index: number, on: number): void {
    const { colors } = this.assets.theme;
    const t = this.table.standups[Math.floor(index / 3)]!.targets[index % 3]!;
    const ux = (t.b.x - t.a.x) / (Math.hypot(t.b.x - t.a.x, t.b.y - t.a.y) || 1);
    const uy = (t.b.y - t.a.y) / (Math.hypot(t.b.x - t.a.x, t.b.y - t.a.y) || 1);
    const half = Math.hypot(t.b.x - t.a.x, t.b.y - t.a.y) / 2 + 1.5;
    const cx = (t.a.x + t.b.x) / 2;
    const cy = (t.a.y + t.b.y) / 2;
    const corner = (s: number, d: number): Pt => ({ x: cx + ux * s + t.face.x * d, y: cy + uy * s + t.face.y * d });
    const pts = [corner(-half, -2.5), corner(half, -2.5), corner(half, 2.5), corner(-half, 2.5)];
    const block = roundedPolygon(pts, 1.4);
    const g = ctx.createLinearGradient(cx - t.face.x * 2.5, cy - t.face.y * 2.5, cx + t.face.x * 2.5, cy + t.face.y * 2.5);
    if (on > 0) {
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.45, lighten(colors.accent2, 0.45));
      g.addColorStop(1, lighten(colors.accent2, 0.1));
    } else {
      g.addColorStop(0, lighten(colors.accent2, 0.05));
      g.addColorStop(1, darken(colors.accent2, 0.5));
    }
    ctx.fillStyle = g;
    ctx.fill(block);
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.stroke(block);
    // 前の面のへりのつやと、まんなかの印（点いているときはテーマの色で光る）
    ctx.lineWidth = 0.9;
    ctx.lineCap = "round";
    ctx.strokeStyle = on > 0 ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.4)";
    const e0 = corner(-half + 1.6, 1.5);
    const e1 = corner(half - 1.6, 1.5);
    ctx.beginPath();
    ctx.moveTo(e0.x, e0.y);
    ctx.lineTo(e1.x, e1.y);
    ctx.stroke();
    ctx.fillStyle = on > 0 ? rgba(colors.accent, 1) : "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.arc(cx, cy, 1.4, 0, TAU);
    ctx.fill();
  }

  /** 光っているスタンドアップターゲット（当たった瞬間は白く光る） */
  private drawStandupsLit(ctx: CanvasRenderingContext2D, g: Game, dt: number): void {
    const { colors } = this.assets.theme;
    for (let i = 0; i < 6; i += 1) {
      const f = this.standupFlash[i]!;
      const all = this.standupsAllFlash[Math.floor(i / 3)]!;
      const on = g.standups[i] ? 1 : all > 0 ? (Math.sin(this.time * 50) > 0 ? all : 0) : 0;
      if (on <= 0 && f <= 0) continue;
      const t = this.table.standups[Math.floor(i / 3)]!.targets[i % 3]!;
      const cx = (t.a.x + t.b.x) / 2;
      const cy = (t.a.y + t.b.y) / 2;
      ctx.globalCompositeOperation = "lighter";
      this.lightAt(ctx, cx + t.face.x * 4, cy + t.face.y * 4, 20 + f * 10, colors.accent2, Math.max(on * 0.55, f));
      ctx.globalCompositeOperation = "source-over";
      this.paintStandup(ctx, i, Math.max(on, f));
      if (f > 0) this.standupFlash[i] = Math.max(0, f - dt * 5);
    }
    for (let b = 0; b < 2; b += 1) if (this.standupsAllFlash[b]! > 0) this.standupsAllFlash[b] = Math.max(0, this.standupsAllFlash[b]! - dt * 0.9);
  }

  /** かざぐるまの下の床（印刷の輪）と、軸の影 */
  private drawPinwheelBase(ctx: CanvasRenderingContext2D, index: number): void {
    const { colors } = this.assets.theme;
    const pw = this.table.pinwheels[index]!;
    const R = pw.len + pw.r + 3;
    ctx.save();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = rgba(colors.accent, 0.4);
    ctx.setLineDash([3, 2.4]);
    ctx.beginPath();
    ctx.arc(pw.x, pw.y, R, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = rgba(colors.accent, 0.22);
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * TAU;
      ctx.beginPath();
      ctx.moveTo(pw.x + Math.cos(a) * (pw.hubR + 3), pw.y + Math.sin(a) * (pw.hubR + 3));
      ctx.lineTo(pw.x + Math.cos(a) * (R - 2), pw.y + Math.sin(a) * (R - 2));
      ctx.stroke();
    }
    ctx.restore();
  }

  /** かざぐるまの羽根（前もって描いた絵を回して使う）と、その影 */
  private buildPinwheelSprite(index: number): { body: HTMLCanvasElement; shadow: HTMLCanvasElement; half: number } {
    const { colors } = this.assets.theme;
    const pw = this.table.pinwheels[index]!;
    const k = this.k;
    const half = pw.len + pw.r + 2;
    const px = Math.max(8, Math.ceil(half * 2 * k));
    const paint = (target: HTMLCanvasElement, silhouette: boolean) => {
      const ctx = target.getContext("2d")!;
      ctx.setTransform(k, 0, 0, k, px / 2, px / 2);
      const palette = [colors.accent2, colors.accent, colors.accent2, colors.accent];
      for (let i = 0; i < pw.arms; i += 1) {
        const a = (i / pw.arms) * TAU;
        const ux = Math.cos(a);
        const uy = Math.sin(a);
        const from = { x: ux * (pw.hubR - 1), y: uy * (pw.hubR - 1) };
        const to = { x: ux * pw.len, y: uy * pw.len };
        const blade = capsulePath(from, to, pw.r);
        if (silhouette) {
          ctx.fillStyle = "#000";
          ctx.fill(blade);
          continue;
        }
        const nx = -uy;
        const ny = ux;
        const color = palette[i % palette.length]!;
        const g = ctx.createLinearGradient(nx * pw.r, ny * pw.r, -nx * pw.r, -ny * pw.r);
        g.addColorStop(0, lighten(color, 0.45));
        g.addColorStop(0.5, rgba(color, 1));
        g.addColorStop(1, darken(color, 0.4));
        ctx.fillStyle = g;
        ctx.fill(blade);
        ctx.lineWidth = 0.55;
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.stroke(blade);
        // 羽根の折り目（かざぐるまの紙の折り目）と、先のつや
        ctx.lineWidth = 0.7;
        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.beginPath();
        ctx.moveTo(from.x + nx * 1.2, from.y + ny * 1.2);
        ctx.lineTo(to.x + nx * 1.2, to.y + ny * 1.2);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath();
        ctx.arc(to.x + nx * 1.1, to.y + ny * 1.1, 1.1, 0, TAU);
        ctx.fill();
      }
    };
    const body = makeCanvas(px, px);
    paint(body, false);
    // 影：黒い形をぼかす
    const sil = makeCanvas(px, px);
    paint(sil, true);
    const shadowCanvas = makeCanvas(px, px);
    const sctx = shadowCanvas.getContext("2d")!;
    sctx.filter = `blur(${Math.max(1, 1.6 * k)}px)`;
    sctx.globalAlpha = 0.55;
    sctx.drawImage(sil, 0, 0);
    return { body, shadow: shadowCanvas, half };
  }

  /** かざぐるま：回る羽根（速いときは残像）・影・まんなかのめっきの軸 */
  private drawPinwheel(ctx: CanvasRenderingContext2D, g: Game, dt: number, index: number): void {
    const { colors } = this.assets.theme;
    const pw = this.table.pinwheels[index]!;
    let sprite = this.pinwheelSprites.get(index);
    if (!sprite) {
      sprite = this.buildPinwheelSprite(index);
      this.pinwheelSprites.set(index, sprite);
    }
    const { body, shadow: sh, half } = sprite;
    const { angle, omega } = g.world.pinwheels[index]!;
    const draw = (img: HTMLCanvasElement, x: number, y: number, a: number, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.drawImage(img, -half, -half, half * 2, half * 2);
      ctx.restore();
    };
    draw(sh, pw.x + 2.2, pw.y + 3.6, angle, 1);
    const fast = Math.abs(omega);
    if (fast > 4.5) {
      // 回る向きと逆に、うすい残像
      const step = Math.min(0.5, fast * 0.022) * Math.sign(omega);
      draw(body, pw.x, pw.y, angle - step * 2, 0.16);
      draw(body, pw.x, pw.y, angle - step, 0.3);
    }
    draw(body, pw.x, pw.y, angle, 1);
    const flash = this.pinwheelFlash[index]!;
    if (flash > 0) {
      ctx.globalCompositeOperation = "lighter";
      this.lightAt(ctx, pw.x, pw.y, 34, colors.accent, flash * 0.75);
      ctx.globalCompositeOperation = "source-over";
      this.pinwheelFlash[index] = Math.max(0, flash - dt * 5);
    }
    // 軸（光は回らない）
    ctx.beginPath();
    ctx.arc(pw.x + 0.8, pw.y + 1.3, pw.hubR, 0, TAU);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fill();
    chromeRing(ctx, pw.x, pw.y, pw.hubR - 0.9, 1.8);
    chromeDisc(ctx, pw.x, pw.y, pw.hubR - 1.8, true);
  }

  /** ポスト：ゴムの輪＋めっきの頭。上のレーンのしきりの頭は色つきプラスチック */
  private drawPosts(ctx: CanvasRenderingContext2D): void {
    const { colors } = this.assets.theme;
    const k = this.k;
    for (const ci of this.table.circles) {
      if (this.isSlingPost(ci.x, ci.y)) continue;
      if (ci.look === "peg") {
        // くぎ：しんちゅう（金色）の丸い頭。ゴムの輪はなく、右下に小さな影
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.beginPath();
        ctx.arc(ci.x + 1.1, ci.y + 1.8, ci.r * 0.95, 0, TAU);
        ctx.fill();
        const brass = ctx.createRadialGradient(ci.x - ci.r * 0.4, ci.y - ci.r * 0.45, ci.r * 0.05, ci.x, ci.y, ci.r);
        brass.addColorStop(0, "#fff7dc");
        brass.addColorStop(0.35, "#ecc86e");
        brass.addColorStop(0.8, "#9c6d22");
        brass.addColorStop(1, "#4d340b");
        ctx.fillStyle = brass;
        ctx.beginPath();
        ctx.arc(ci.x, ci.y, ci.r, 0, TAU);
        ctx.fill();
      } else if (ci.look === "lane-post") {
        plasticPost(ctx, k, ci.x, ci.y, ci.r + 0.6, colors.accent2, { lift: 0.9 });
      } else {
        rubberRing(ctx, k, ci.x, ci.y, ci.r + 0.3, 2.6, { lift: 0.9 });
        chromeDisc(ctx, ci.x, ci.y, ci.r - 2.4, true);
      }
    }
  }

  /** スピナーの軸受け（左のオービットの入口） */
  private drawSpinnerFrame(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = "rgba(20,24,30,0.9)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(3, 400);
    ctx.lineTo(46, 400);
    ctx.stroke();
    for (const x of [2.6, 45.4]) {
      const g = ctx.createLinearGradient(x - 2, 0, x + 2, 0);
      g.addColorStop(0, "#f2f5f8");
      g.addColorStop(1, "#5d6773");
      ctx.fillStyle = g;
      this.roundRect(ctx, x - 2, 395.5, 4, 9, 1.2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }

  /** 打ち出しレーン：出口の一方通行のゲートと、プランジャーのケース */
  private drawShooterParts(ctx: CanvasRenderingContext2D): void {
    const k = this.k;
    const gate = this.table.shooterGate;
    chromeTube(ctx, k, polyline([gate.a, gate.b]), 2.6, { lift: 0.9 });
    chromeDisc(ctx, gate.b.x, gate.b.y, 2.4, true);
    // 外わくがわの軸受け
    const bg = ctx.createLinearGradient(gate.a.x - 5, 0, gate.a.x + 1, 0);
    bg.addColorStop(0, "#f2f5f8");
    bg.addColorStop(1, "#5d6773");
    ctx.fillStyle = bg;
    this.roundRect(ctx, gate.a.x - 5, gate.a.y - 4, 6, 8, 1.4);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
    // プランジャーのケース
    const g = ctx.createLinearGradient(487, 0, 521, 0);
    g.addColorStop(0, "#3a4049");
    g.addColorStop(0.35, "#9aa5b1");
    g.addColorStop(0.6, "#545d68");
    g.addColorStop(1, "#262b31");
    ctx.fillStyle = g;
    this.roundRect(ctx, 488, 962, 32, 40, 3);
    ctx.fill();
    ctx.fillStyle = "#0b0d10";
    this.roundRect(ctx, 499, 962, 10, 40, 2);
    ctx.fill();
    for (const y of [970, 992]) {
      chromeDisc(ctx, 492.5, y, 1.6, true);
      chromeDisc(ctx, 515.5, y, 1.6, true);
    }
  }

  /* ---------- 床のランプ（インサート） ---------- */

  /** 矢印の形（ショットの矢印ランプ） */
  private arrowShape(at: Pt & { angle: number }, size = 1): Path2D {
    const c = Math.cos(at.angle) * size;
    const sn = Math.sin(at.angle) * size;
    const pts = [[15, 0], [-3, -11], [-3, -5], [-13, -5], [-13, 5], [-3, 5], [-3, 11]].map(([x, y]) => ({ x: at.x + x! * c - y! * sn, y: at.y + x! * sn + y! * c }));
    return polyline(pts, true);
  }

  private pillShape(x: number, y: number, w: number, h: number, r: number): Path2D {
    const path = new Path2D();
    path.moveTo(x + r, y);
    path.arcTo(x + w, y, x + w, y + h, r);
    path.arcTo(x + w, y + h, x, y + h, r);
    path.arcTo(x, y + h, x, y, r);
    path.arcTo(x, y, x + w, y, r);
    path.closePath();
    return path;
  }

  /**
   * 床に埋めこまれたランプ（色つきの透明な樹脂）。消えていても色がうっすら見え、点くと中の電球で明るく光る。
   * on は 0（消えている）〜1（点いている）
   */
  private paintInsert(ctx: CanvasRenderingContext2D, path: Path2D, box: { x: number; y: number; w: number; h: number }, color: string, on: number): void {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const r = Math.max(box.w, box.h) / 2;
    const g = ctx.createRadialGradient(cx - r * 0.18, cy - r * 0.22, r * 0.04, cx, cy, r * 1.08);
    if (on > 0) {
      g.addColorStop(0, mix("#ffffff", color, 0.2, on));
      g.addColorStop(0.42, lighten(color, 0.3, on));
      g.addColorStop(1, darken(color, 0.22, on));
    } else {
      g.addColorStop(0, darken(color, 0.42, 0.92));
      g.addColorStop(1, darken(color, 0.78, 0.95));
    }
    ctx.fillStyle = g;
    ctx.fill(path);
    // ふちの面取り（左上が明るく、右下が暗い）
    const bevel = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
    bevel.addColorStop(0, "rgba(255,255,255,0.5)");
    bevel.addColorStop(0.5, "rgba(255,255,255,0.06)");
    bevel.addColorStop(1, "rgba(0,0,0,0.6)");
    ctx.lineWidth = 1.1;
    ctx.lineJoin = "round";
    ctx.strokeStyle = bevel;
    ctx.stroke(path);
    // 表面のつや
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = on > 0 ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.13)";
    ctx.beginPath();
    ctx.ellipse(box.x + box.w * 0.34, box.y + box.h * 0.27, box.w * 0.3, box.h * 0.15, -0.45, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /** ランプに印刷された文字 */
  private insertText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, on: boolean): void {
    ctx.font = `bold ${size}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = on ? "rgba(26,22,18,0.92)" : rgba(color, 0.55);
    ctx.fillText(text, x, y);
  }

  /** 床のランプを1つ描く（off の絵は base、点いているときは毎フレーム上から描きなおす） */
  private drawInsert(ctx: CanvasRenderingContext2D, id: InsertId, on: number, color?: string): void {
    const { colors } = this.assets.theme;
    const lit = on > 0;
    if (id.kind === "lane") {
      const x = this.table.laneX[id.index]!;
      this.paintInsert(ctx, circlePathAt(x, 128, 12), { x: x - 12, y: 116, w: 24, h: 24 }, color ?? colors.accent, on);
      this.insertText(ctx, LANE_LETTERS[id.index]!, x, 129, 14, color ?? colors.accent, lit);
    } else if (id.kind === "shot") {
      const at = shotPos(this.table, id.id);
      this.paintInsert(ctx, this.arrowShape(at), { x: at.x - 15, y: at.y - 15, w: 30, h: 30 }, color ?? colors.accent, on);
    } else if (id.kind === "kick") {
      const x = KICKER_X[id.index]!;
      this.paintInsert(ctx, this.pillShape(x - 13, 822, 26, 16, 5), { x: x - 13, y: 822, w: 26, h: 16 }, color ?? colors.accent2, on);
      this.insertText(ctx, "キック", x, 830.5, 7, color ?? colors.accent2, lit);
    } else if (id.kind === "standup") {
      const p = standupInsertPos(this.table, id.index);
      this.paintInsert(ctx, circlePathAt(p.x, p.y, 5.5), { x: p.x - 5.5, y: p.y - 5.5, w: 11, h: 11 }, color ?? colors.accent2, on);
    } else if (id.kind === "bonus") {
      const x = 200 + id.index * 20;
      this.paintInsert(ctx, circlePathAt(x, 838, 7.5), { x: x - 7.5, y: 830.5, w: 15, h: 15 }, color ?? colors.accent, on);
      this.insertText(ctx, `×${id.index + 2}`, x, 838.5, 7, color ?? colors.accent, lit);
    } else {
      this.paintInsert(ctx, this.pillShape(214, 858, 52, 16, 8), { x: 214, y: 858, w: 52, h: 16 }, color ?? SAVE_COLOR, on);
      this.insertText(ctx, "セーブ", 240, 866.5, 8, color ?? SAVE_COLOR, lit);
    }
  }

  /** 床のランプ（消えているとき） */
  private drawInsertsOff(ctx: CanvasRenderingContext2D): void {
    const { colors } = this.assets.theme;
    for (let i = 0; i < this.table.laneX.length; i += 1) this.drawInsert(ctx, { kind: "lane", index: i }, 0);
    for (const s of this.table.shots) this.drawInsert(ctx, { kind: "shot", id: s.id }, 0);
    if (!this.table.freeform) for (let i = 0; i < 2; i += 1) this.drawInsert(ctx, { kind: "kick", index: i }, 0);
    for (let i = 0; i < 5; i += 1) this.drawInsert(ctx, { kind: "bonus", index: i }, 0);
    for (let i = 0; i < this.table.standups.length * 3; i += 1) this.drawInsert(ctx, { kind: "standup", index: i }, 0);
    this.drawInsert(ctx, { kind: "save" }, 0);
    // ガチャ穴の文字（印刷）
    ctx.font = `bold 10px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = rgba(colors.accent, 0.5);
    if (this.table.scoop.r > 0) ctx.fillText("ガチャ穴", 240, 400);
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------- 玉より上に来る絵（ランプ・ワイヤー・エプロン） ---------- */

  private buildOverlay(): HTMLCanvasElement {
    const c = makeCanvas(this.canvas.width, this.canvas.height);
    const ctx = c.getContext("2d")!;
    this.setTableTransform(ctx);
    for (const r of this.ramps) this.drawRamp(ctx, r);
    for (const r of this.ramps) this.drawWireform(ctx, r);
    this.drawApron(ctx);
    return c;
  }

  /** プラスチックのランプ（坂）：透明な床・印刷された矢印・光る壁・頂上の金具 */
  private drawRamp(ctx: CanvasRenderingContext2D, r: RampShape): void {
    const { colors } = this.assets.theme;
    const k = this.k;
    const center = upperPart(r.plastic);
    if (center.length < 2) return;
    this.paintRampFloor(ctx, center);
    // 印刷された矢印（まっすぐなのぼり坂だけ）と、頂上のカーブの線
    const len = lineLength(center);
    const climb = center.slice(0, 2);
    const turn = center.slice(1);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = rgba(colors.accent, 0.42);
    for (const d of [7, -7]) ctx.stroke(polyline(offsetLine(turn, d)));
    ctx.restore();
    for (const p of alongLine(climb, 32, 14, lineLength(climb) - 12)) {
      const ang = Math.atan2(p.dy, p.dx);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(-2.5, -11);
      ctx.lineTo(5.5, 0);
      ctx.lineTo(-2.5, 11);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 3.4;
      ctx.strokeStyle = rgba(colors.accent, 0.5);
      ctx.stroke();
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.stroke();
      ctx.restore();
    }
    // 壁（透明なプラスチックの板）
    for (const d of [RAMP_WALL, -RAMP_WALL]) this.drawClearWall(ctx, polyline(offsetLine(center, d)), RAMP_WALL_W, "butt");
    // 頂上の終わり：ワイヤーへつながる金具
    const end = r.plastic[r.plastic.length - 1]!;
    const prev = r.plastic[r.plastic.length - 2]!;
    const ux = end.x - prev.x;
    const uy = end.y - prev.y;
    const ul = Math.hypot(ux, uy) || 1;
    const nx = -uy / ul;
    const ny = ux / ul;
    ctx.save();
    shadow(ctx, k, 1.2, 2, 2, "rgba(0,0,0,0.5)");
    const bracket = polyline([
      { x: end.x + nx * (RAMP_WALL + 1), y: end.y + ny * (RAMP_WALL + 1) },
      { x: end.x - nx * (RAMP_WALL + 1), y: end.y - ny * (RAMP_WALL + 1) },
    ]);
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#7b8693";
    ctx.stroke(bracket);
    noShadow(ctx);
    ctx.restore();
    chromeTube(ctx, k, bracket, 3.4, { lift: 0 });
    for (const s of [1, -1]) chromeDisc(ctx, end.x + nx * s * (RAMP_WALL - 3), end.y + ny * s * (RAMP_WALL - 3), 1.5, true);
    // 壁をとめるねじ
    for (const p of alongLine(center, 46, 30, len - 10)) {
      for (const s of [1, -1]) chromeDisc(ctx, p.x - p.dy * s * (RAMP_WALL + 2.2), p.y + p.dx * s * (RAMP_WALL + 2.2), 1.2, false);
    }
  }

  /** ワイヤーランプ（頂上からインレーンへ降りる2本のワイヤーと、つなぎの横棒） */
  private drawWireform(ctx: CanvasRenderingContext2D, r: RampShape): void {
    const k = this.k;
    const left = offsetLine(r.wire, WIRE_GAP);
    const right = offsetLine(r.wire, -WIRE_GAP);
    const len = lineLength(r.wire);
    // つなぎの横棒（下に見える）
    for (const p of alongLine(r.wire, 40, 20, len - 12)) {
      const bar = polyline([
        { x: p.x - p.dy * (WIRE_GAP + 1.5), y: p.y + p.dx * (WIRE_GAP + 1.5) },
        { x: p.x + p.dy * (WIRE_GAP + 1.5), y: p.y - p.dx * (WIRE_GAP + 1.5) },
      ]);
      chromeTube(ctx, k, bar, 1.3, { lift: 0 });
    }
    for (const line of [left, right]) chromeTube(ctx, k, polyline(line), 2.4, { lift: 0 });
    // 床にとめる足（途中に2か所）
    for (const p of alongLine(r.wire, len * 0.42, len * 0.3, len * 0.8)) {
      for (const s of [1, -1]) {
        const x = p.x - p.dy * s * (WIRE_GAP + 3.6);
        const y = p.y + p.dx * s * (WIRE_GAP + 3.6);
        chromeDisc(ctx, x, y, 2.1, true);
      }
    }
  }

  /** エプロン（フリッパーの下の金属の板）と、台の名前の板 */
  private drawApron(ctx: CanvasRenderingContext2D): void {
    const { colors, name } = this.assets.theme;
    const k = this.k;
    const apron = new Path2D();
    apron.moveTo(-2, 940);
    apron.lineTo(148, 940);
    apron.quadraticCurveTo(240, 975, 332, 940);
    apron.lineTo(484, 940);
    apron.lineTo(484, TABLE_H + 2);
    apron.lineTo(-2, TABLE_H + 2);
    apron.closePath();
    ctx.save();
    shadow(ctx, k, 0, -2, 4, "rgba(0,0,0,0.7)");
    const metal = ctx.createLinearGradient(0, 940, 0, TABLE_H);
    metal.addColorStop(0, "#3a404a");
    metal.addColorStop(0.18, "#272c33");
    metal.addColorStop(1, "#111418");
    ctx.fillStyle = metal;
    ctx.fill(apron);
    noShadow(ctx);
    // 細かい筋（ヘアライン仕上げ）
    ctx.clip(apron);
    ctx.lineWidth = 0.35;
    for (let x = 0; x < 484; x += 2.2) {
      ctx.strokeStyle = `rgba(255,255,255,${0.025 + ((x * 7) % 5) * 0.006})`;
      ctx.beginPath();
      ctx.moveTo(x, 935);
      ctx.lineTo(x + 6, TABLE_H);
      ctx.stroke();
    }
    ctx.restore();
    // ふちの面取り
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "#8d98a5";
    ctx.beginPath();
    ctx.moveTo(-2, 940.6);
    ctx.lineTo(148, 940.6);
    ctx.quadraticCurveTo(240, 975.6, 332, 940.6);
    ctx.lineTo(483.4, 940.6);
    ctx.lineTo(483.4, TABLE_H + 2);
    ctx.stroke();
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.stroke();
    ctx.restore();
    // 名前の板
    const plateY = 968;
    ctx.save();
    shadow(ctx, k, 0.6, 1.2, 1.5, "rgba(0,0,0,0.6)");
    const plate = ctx.createLinearGradient(0, plateY, 0, plateY + 30);
    plate.addColorStop(0, darken(colors.accent, 0.55));
    plate.addColorStop(1, darken(colors.accent, 0.78));
    ctx.fillStyle = plate;
    this.roundRect(ctx, 150, plateY, 180, 30, 8);
    ctx.fill();
    noShadow(ctx);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = rgba(colors.accent, 0.85);
    ctx.stroke();
    ctx.restore();
    for (const x of [158, 322]) chromeDisc(ctx, x, plateY + 15, 2, true);
    ctx.fillStyle = mix(colors.accent, "#ffffff", 0.2);
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, 240, plateY + 12);
    ctx.font = `bold 6.5px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText("ご当地ピンボール", 240, plateY + 24);
    // エプロンのねじ
    for (const [x, y] of [[12, 952], [470, 952], [12, 992], [470, 992]] as const) chromeDisc(ctx, x, y, 2.2, true);
  }

  /* ---------- 毎フレーム ---------- */

  draw(g: Game, dt: number): void {
    const ctx = this.ctx;
    this.frameDt = dt;
    this.time += dt;
    const live = new Set(g.world.balls.map((ball) => ball.id));
    for (const id of this.ballTrails.keys()) if (!live.has(id)) this.ballTrails.delete(id);
    if (dt > 0 && !this.reducedMotion) {
      for (const b of g.world.balls) {
        if (b.mode !== "field" && b.mode !== "ramp") {
          this.ballTrails.delete(b.id);
          continue;
        }
        const ramp = b.mode === "ramp";
        const trail = (this.ballTrails.get(b.id) ?? []).filter((p) => this.time - p.at < 0.08 && p.ramp === ramp);
        trail.push({ x: b.x, y: b.y, at: this.time, ramp });
        this.ballTrails.set(b.id, trail.slice(-12));
      }
    }
    if (!this.base) this.base = this.buildBase();
    if (!this.overlay) this.overlay = this.buildOverlay();
    if (!this.ballSprite) this.ballSprite = makeBallSprite(Math.max(8, Math.round(BALL_R * 2 * this.scale * this.dpr)));

    let sx = 0;
    let sy = 0;
    if (this.shake > 0) {
      const amp = this.shake * 5;
      sx = (Math.random() - 0.5) * amp;
      sy = (Math.random() - 0.5) * amp;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.base, sx * this.dpr, sy * this.dpr);
    this.setTableTransform(ctx, sx, sy);

    this.drawLitInserts(ctx, g);
    this.drawShapeFill(ctx, g);
    this.drawScoopLight(ctx, g);
    this.drawMagnet(ctx, g);
    this.drawDrops(ctx, g);
    this.drawStageDrops(ctx, g, dt);
    if (!this.table.freeform) {
      this.drawKickers(ctx, g);
      this.drawSpinner(ctx, dt);
    }
    this.drawStandupsLit(ctx, g, dt);
    this.table.pinwheels.forEach((_, i) => this.drawPinwheel(ctx, g, dt, i));
    this.drawBumpers(ctx, dt);
    this.drawSlings(ctx, dt);
    this.drawGates(ctx, g);
    this.drawFlippers(ctx, g.world.flippers);
    this.drawBalls(ctx, g, false);
    // スピナーの板は、下をくぐる玉より上
    this.drawStageSpinners(ctx, dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.overlay, sx * this.dpr, sy * this.dpr);
    this.setTableTransform(ctx, sx, sy);
    // 浮かんでいるアイテムは、ランプやワイヤーより上（ランプの上を走る玉はさらに上）
    this.drawItems(ctx, g);
    this.drawPlunger(ctx, g);
    this.drawBalls(ctx, g, true);
    this.drawParticles(ctx, dt);
    this.drawPopups(ctx, dt);
    this.drawFlying(ctx, dt);

    if (this.flash > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = rgba(this.flashColor, this.flash * 0.35);
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.globalCompositeOperation = "source-over";
      this.flash = Math.max(0, this.flash - dt * 2.2);
    }
  }

  private lightAt(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 1): void {
    const g = this.glow(color);
    ctx.globalAlpha = alpha;
    ctx.drawImage(g, x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  private drawLitInserts(ctx: CanvasRenderingContext2D, g: Game): void {
    const { colors } = this.assets.theme;
    const t = this.time;
    const blink = (hz: number) => (Math.sin(t * hz * TAU) > 0 ? 1 : 0.25);
    const lit: { id: InsertId; on: number; color: string; x: number; y: number; r: number }[] = [];

    // 上のレーン（スキルショットのレーンは点滅）
    this.table.laneX.forEach((x, i) => {
      const skill = g.skillLane === i;
      if (!g.lanes[i] && !skill) return;
      lit.push({ id: { kind: "lane", index: i }, on: skill ? blink(3) : 1, color: skill ? colors.accent2 : colors.accent, x, y: 128, r: 26 });
    });
    // ショットの矢印：コンボ受付中・ジャックポット・ガチャ穴が開いているとき
    const comboOn = g.clock - g.lastMajorAt < 4 && g.combo >= 1;
    for (const s of this.table.shots) {
      let on = 0;
      let color = colors.accent;
      if (g.jackpots[s.id]) {
        on = blink(4);
        color = colors.accent2;
      } else if (g.reserves.length && (s.id === "leftRamp" || s.id === "rightRamp")) {
        on = blink(3);
        color = "#ffd54f";
      } else if (s.id === "scoop" && g.clock < g.magnetUntil) {
        on = blink(5);
        color = "#7df9ff";
      } else if (s.id === "scoop" && g.superLit) {
        on = blink(6);
        color = "#ff9de2";
      } else if (s.id === "scoop" && g.world.dropsUp.every((u) => !u)) {
        on = blink(2);
      } else if (comboOn && g.mode === "normal") {
        on = 0.55 * blink(5);
      }
      const flash = this.shotFlash.get(s.id) ?? 0;
      if (flash > 0) {
        on = Math.max(on, flash);
        this.shotFlash.set(s.id, Math.max(0, flash - this.frameDt * 1.8));
      }
      if (on > 0) lit.push({ id: { kind: "shot", id: s.id }, on, color, x: s.arrow.x, y: s.arrow.y, r: 34 });
    }
    // キックバック
    (this.table.freeform ? [] : KICKER_X).forEach((x, i) => {
      const k = this.kickFlash[i]!;
      const on = g.kickbackLit[i] ? 1 : k;
      if (on > 0) lit.push({ id: { kind: "kick", index: i }, on, color: colors.accent2, x, y: 830, r: 22 });
    });
    // ボーナス倍率
    for (let i = 0; i < 5; i += 1) if (g.bonusX >= i + 2) lit.push({ id: { kind: "bonus", index: i }, on: 1, color: colors.accent, x: 200 + i * 20, y: 838, r: 15 });
    // スタンドアップターゲットの前のランプ（光らせた的・1組そろったときはまとめて点滅）
    for (let i = 0; i < 6; i += 1) {
      const all = this.standupsAllFlash[Math.floor(i / 3)]!;
      const on = g.standups[i] ? 1 : all > 0 ? blink(8) * all : 0;
      if (on > 0) {
        const p = standupInsertPos(this.table, i);
        lit.push({ id: { kind: "standup", index: i }, on, color: colors.accent2, x: p.x, y: p.y, r: 15 });
      }
    }
    // ボールセーブ（切れる前は速く点滅）
    if (isBallSaveOn(g)) {
      const left = g.saveUntil - g.clock;
      lit.push({ id: { kind: "save" }, on: g.phase === "serve" ? 0.8 : left < 2 ? blink(5) : 1, color: SAVE_COLOR, x: 240, y: 866, r: 30 });
    }

    ctx.globalCompositeOperation = "lighter";
    for (const l of lit) this.lightAt(ctx, l.x, l.y, l.r, l.color, l.on);
    // 得点倍率がかかっているときは床がほんのり光る
    if (scoreMult(g) > 1) this.lightAt(ctx, 240, 560, 300, colors.accent2, 0.1 + 0.05 * Math.sin(t * 6));
    ctx.globalCompositeOperation = "source-over";
    // 点いているランプは、中から光る絵で描きなおす（点滅で暗いときは消えた絵のまま）
    for (const l of lit) if (l.on >= 0.5) this.drawInsert(ctx, l.id, Math.min(1, l.on), l.color);
  }

  /** 県の形：集めたアイテムの数だけ下から光で満ちていく（制覇モード中は虹色に脈打つ） */
  private drawShapeFill(ctx: CanvasRenderingContext2D, g: Game): void {
    if (!this.shapePath) return;
    const { colors } = this.assets.theme;
    const done = g.mode === "conquest" ? STAMP_COUNT : collectedCount(g);
    const ratio = done / STAMP_COUNT;
    const box = this.table.artBox;
    const [s, tx, ty] = this.shapeTransform;
    ctx.save();
    ctx.transform(s, 0, 0, s, tx, ty);
    ctx.clip(this.shapePath);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.setTableTransform(ctx);
    if (ratio > 0) {
      const top = box.y + box.h * (1 - ratio);
      const wave = Math.sin(this.time * 3) * 3;
      const fill = ctx.createLinearGradient(0, top, 0, box.y + box.h);
      fill.addColorStop(0, rgba(colors.shape, 0.55));
      fill.addColorStop(1, rgba(colors.accent, 0.25));
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(box.x - 20, box.y + box.h + 20);
      for (let x = box.x - 20; x <= box.x + box.w + 20; x += 8) ctx.lineTo(x, top + Math.sin(x / 18 + this.time * 2) * 3 + wave);
      ctx.lineTo(box.x + box.w + 20, box.y + box.h + 20);
      ctx.closePath();
      ctx.fill();
    }
    if (g.mode === "conquest" || this.conquestGlow > 0) {
      const hue = (this.time * 90) % 360;
      ctx.fillStyle = `hsla(${hue},90%,65%,${0.25 + 0.15 * Math.sin(this.time * 8)})`;
      ctx.fillRect(box.x - 20, box.y - 20, box.w + 40, box.h + 40);
      this.conquestGlow = Math.max(0, this.conquestGlow - 0.004);
    }
    ctx.restore();
    // ふちの光
    ctx.save();
    ctx.transform(s, 0, 0, s, tx, ty);
    ctx.lineWidth = 2.6 / s;
    ctx.strokeStyle = rgba(colors.shape, 0.25 + ratio * 0.6);
    ctx.stroke(this.shapePath);
    ctx.restore();
  }

  /** ガチャ穴が開いているときは、穴のふちが光ってまわる */
  private drawScoopLight(ctx: CanvasRenderingContext2D, g: Game): void {
    if (this.table.scoop.r <= 0) return;
    const open = g.world.dropsUp.every((u) => !u);
    if (!open && !g.superLit && !g.scoopBall) return;
    const { colors } = this.assets.theme;
    const sc = this.table.scoop;
    const color = g.superLit ? "#ff9de2" : colors.accent;
    ctx.globalCompositeOperation = "lighter";
    this.lightAt(ctx, sc.x, sc.y, 34, color, 0.55 + 0.25 * Math.sin(this.time * 6));
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i += 1) {
      const a0 = this.time * 3 + (i * TAU) / 3;
      ctx.strokeStyle = rgba(color, 0.9);
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, 19.5, a0, a0 + 1.1);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  /** スキル「マグネット」：ガチャ穴の口へ向かって縮んでいく光の弧（穴へ吸いこむ）。切れる前はうすくなる */
  private drawMagnet(ctx: CanvasRenderingContext2D, g: Game): void {
    if (this.table.scoop.r <= 0) return;
    if (g.clock >= g.magnetUntil || g.phase === "over") return;
    const fade = Math.min(1, (g.magnetUntil - g.clock) / 0.8);
    const color = "#7df9ff";
    const mouth = { x: this.table.scoop.x, y: 549 };
    ctx.globalCompositeOperation = "lighter";
    this.lightAt(ctx, mouth.x, mouth.y + 18, 70, color, (0.3 + 0.12 * Math.sin(this.time * 7)) * fade);
    ctx.lineCap = "round";
    for (let k = 0; k < 4; k += 1) {
      const phase = (this.time * 0.85 + k / 4) % 1;
      const r = 18 + 92 * (1 - phase);
      ctx.strokeStyle = rgba(color, Math.sin(phase * Math.PI) * 0.8 * fade);
      ctx.lineWidth = 1.4 + 1.6 * phase;
      ctx.beginPath();
      ctx.arc(mouth.x, mouth.y, r, Math.PI * 0.14, Math.PI * 0.86);
      ctx.stroke();
    }
    ctx.strokeStyle = rgba(color, 0.85 * fade);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(this.table.scoop.x, this.table.scoop.y, 18, 0, TAU);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  /** ドロップターゲット：起きているときは上の面と手前の面が見える（当たり判定の 7mm の中に収める） */
  private drawDrops(ctx: CanvasRenderingContext2D, g: Game): void {
    const { colors } = this.assets.theme;
    this.table.drops.forEach((d, i) => {
      const x0 = d.a.x;
      const w = d.b.x - d.a.x;
      const y = d.a.y;
      if (!g.world.dropsUp[i]) {
        // 倒れて床と同じ高さになった頭
        ctx.fillStyle = darken(colors.accent, 0.62);
        ctx.fillRect(x0 + 0.6, y - 2.4, w - 1.2, 4.8);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(x0 + 0.6, y - 2.4, w - 1.2, 0.8);
        return;
      }
      // 右下へ落ちる影
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(x0 + 1.6, y - 1, w, 7.5);
      // 手前の面（玉が当たる面）
      const front = ctx.createLinearGradient(0, y, 0, y + 3.6);
      front.addColorStop(0, lighten(colors.accent, 0.12));
      front.addColorStop(1, darken(colors.accent, 0.42));
      ctx.fillStyle = front;
      ctx.fillRect(x0, y, w, 3.6);
      // 上の面
      const top = ctx.createLinearGradient(x0, 0, x0 + w, 0);
      top.addColorStop(0, lighten(colors.accent, 0.62));
      top.addColorStop(0.5, lighten(colors.accent, 0.35));
      top.addColorStop(1, rgba(colors.accent, 1));
      ctx.fillStyle = top;
      ctx.fillRect(x0, y - 3.5, w, 3.5);
      // 面の絵（まんなかの丸）とふち
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(x0 + w / 2, y + 1.7, 1.2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x0, y - 3.5, w, 7.1);
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.moveTo(x0 + 0.5, y - 3.1);
      ctx.lineTo(x0 + w - 0.5, y - 3.1);
      ctx.stroke();
    });
  }

  /**
   * 自分で作るステージのドロップターゲット。ガチャ穴の前のものと同じ絵を、置いた向きに回して描く
   * （立っているときは手前の面と上の面、たおれたら床と同じ高さの頭だけ）
   */
  private drawStageDrops(ctx: CanvasRenderingContext2D, g: Game, dt: number): void {
    const { colors } = this.assets.theme;
    this.table.stageDrops.forEach((d, i) => {
      const cx = (d.a.x + d.b.x) / 2;
      const cy = (d.a.y + d.b.y) / 2;
      const w = Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y);
      const x0 = -w / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.atan2(d.b.y - d.a.y, d.b.x - d.a.x));
      if (!g.world.stageDropsUp[i]) {
        ctx.fillStyle = darken(colors.accent, 0.62);
        ctx.fillRect(x0 + 0.6, -2.4, w - 1.2, 4.8);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(x0 + 0.6, -2.4, w - 1.2, 0.8);
        ctx.restore();
        return;
      }
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(x0 + 1.6, -1, w, 7.5);
      const front = ctx.createLinearGradient(0, 0, 0, 3.6);
      front.addColorStop(0, lighten(colors.accent, 0.12));
      front.addColorStop(1, darken(colors.accent, 0.42));
      ctx.fillStyle = front;
      ctx.fillRect(x0, 0, w, 3.6);
      const top = ctx.createLinearGradient(x0, 0, x0 + w, 0);
      top.addColorStop(0, lighten(colors.accent, 0.62));
      top.addColorStop(0.5, lighten(colors.accent, 0.35));
      top.addColorStop(1, rgba(colors.accent, 1));
      ctx.fillStyle = top;
      ctx.fillRect(x0, -3.5, w, 3.5);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (const off of [-w / 4, 0, w / 4]) {
        ctx.beginPath();
        ctx.arc(off, 1.7, 1.1, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x0, -3.5, w, 7.1);
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.moveTo(x0 + 0.5, -3.1);
      ctx.lineTo(x0 + w - 0.5, -3.1);
      ctx.stroke();
      ctx.restore();
      const flash = this.stageDropFlash[i]!;
      if (flash > 0) {
        ctx.globalCompositeOperation = "lighter";
        this.lightAt(ctx, cx, cy, 30, colors.accent, flash * 0.7);
        ctx.globalCompositeOperation = "source-over";
        this.stageDropFlash[i] = Math.max(0, flash - dt * 4);
      }
    });
  }

  /** 自分で作るステージのスピナーの板（くぐった玉の速さで回り、だんだん止まる。速いときは残像） */
  private drawStageSpinners(ctx: CanvasRenderingContext2D, dt: number): void {
    const { colors } = this.assets.theme;
    this.table.spinners.forEach((sp, i) => {
      const st = this.stageSpin[i]!;
      st.angle += st.speed * dt;
      st.speed = Math.max(0, st.speed - dt * 40);
      const x0 = sp.x - sp.w / 2;
      const plate = (angle: number, alpha: number) => {
        const c = Math.cos(angle);
        const h = Math.abs(c) * 8.5 + 0.8;
        const front = c >= 0;
        ctx.globalAlpha = alpha;
        const g = ctx.createLinearGradient(0, sp.y - h / 2, 0, sp.y + h / 2);
        if (front) {
          g.addColorStop(0, "#ffffff");
          g.addColorStop(0.5, "#c4ccd5");
          g.addColorStop(1, "#6d7884");
        } else {
          g.addColorStop(0, "#c6ced6");
          g.addColorStop(1, "#4d5661");
        }
        ctx.fillStyle = g;
        ctx.fillRect(x0, sp.y - h / 2, sp.w, h);
        if (front && h > 3) {
          ctx.fillStyle = rgba(colors.accent, 0.9);
          ctx.fillRect(x0 + 4, sp.y - h * 0.18, sp.w - 8, h * 0.36);
        }
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x0, sp.y - h / 2, sp.w, h);
        if (front && Math.abs(c) > 0.93) {
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.fillRect(x0 + 1, sp.y - h / 2 + 0.6, sp.w - 2, 0.7);
        }
        ctx.globalAlpha = 1;
      };
      // 板の影（板が立っているほど細い）
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x0 + 2, sp.y + 1.5, sp.w, Math.abs(Math.cos(st.angle)) * 6 + 1);
      if (st.speed > 8) {
        plate(st.angle - 0.5, 0.18);
        plate(st.angle - 0.25, 0.32);
      }
      plate(st.angle, 1);
    });
  }

  /** キックバックの押し出し板（打ち返す瞬間だけ上へ飛び出す） */
  private drawKickers(ctx: CanvasRenderingContext2D, g: Game): void {
    const { colors } = this.assets.theme;
    KICKER_X.forEach((x, i) => {
      const f = this.kickFlash[i]!;
      const lift = f > 0.55 ? ((f - 0.55) / 0.45) * 8 : 0;
      const y = KICKER.y - lift;
      const x0 = x - KICKER.w / 2;
      if (lift > 0) {
        ctx.fillStyle = "#1a1d22";
        ctx.fillRect(x0 + 1, y + KICKER.h, KICKER.w - 2, lift);
      }
      const body = ctx.createLinearGradient(0, y, 0, y + KICKER.h);
      body.addColorStop(0, "#e9edf2");
      body.addColorStop(0.5, "#9aa5b1");
      body.addColorStop(1, "#4b545e");
      ctx.fillStyle = body;
      this.roundRect(ctx, x0, y, KICKER.w, KICKER.h, 1.6);
      ctx.fill();
      // 玉が当たるゴム
      ctx.fillStyle = "#1b1b1f";
      this.roundRect(ctx, x0 + 1, y - 1.6, KICKER.w - 2, 2.6, 1.2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(x0 + 2, y - 1.3, KICKER.w - 4, 0.6);
      // 点いているときは小さなランプ
      if (g.kickbackLit[i]) {
        ctx.globalCompositeOperation = "lighter";
        this.lightAt(ctx, x, y + KICKER.h / 2, 7, colors.accent2, 0.8);
        ctx.globalCompositeOperation = "source-over";
      }
      if (f > 0) this.kickFlash[i] = Math.max(0, f - 0.04);
    });
  }

  /** スピナー：めっきの板が軸のまわりを回る（速いときは残像） */
  private drawSpinner(ctx: CanvasRenderingContext2D, dt: number): void {
    this.spinAngle += this.spinSpeed * dt;
    this.spinSpeed = Math.max(0, this.spinSpeed - dt * 40);
    const { colors } = this.assets.theme;
    const plate = (angle: number, alpha: number) => {
      const c = Math.cos(angle);
      const h = Math.abs(c) * 7.5 + 0.8;
      const front = c >= 0;
      ctx.globalAlpha = alpha;
      const g = ctx.createLinearGradient(0, 400 - h / 2, 0, 400 + h / 2);
      if (front) {
        g.addColorStop(0, "#ffffff");
        g.addColorStop(0.5, "#c4ccd5");
        g.addColorStop(1, "#6d7884");
      } else {
        g.addColorStop(0, "#c6ced6");
        g.addColorStop(1, "#4d5661");
      }
      ctx.fillStyle = g;
      ctx.fillRect(5, 400 - h / 2, 38, h);
      if (front && h > 3) {
        ctx.fillStyle = rgba(colors.accent, 0.9);
        ctx.fillRect(9, 400 - h * 0.18, 30, h * 0.36);
      }
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(5, 400 - h / 2, 38, h);
      if (front && Math.abs(c) > 0.93) {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillRect(6, 400 - h / 2 + 0.6, 36, 0.7);
      }
      ctx.globalAlpha = 1;
    };
    if (this.spinSpeed > 8) {
      plate(this.spinAngle - 0.5, 0.18);
      plate(this.spinAngle - 0.25, 0.32);
    }
    plate(this.spinAngle, 1);
  }

  /** 浮かんでいるご当地アイテム（おかわりで出たものは金色の輪と札） */
  private drawItems(ctx: CanvasRenderingContext2D, g: Game): void {
    if (g.mode !== "normal") return;
    const { colors } = this.assets.theme;
    for (const l of g.lit) {
      const spot = this.table.itemSpots[l.spot]!;
      const bob = Math.sin(this.time * 3 + l.spot) * 2.5;
      const x = spot.x;
      const y = spot.y + bob;
      const rare = l.item.rarity && ["SSR", "UR", "LR", "MR"].includes(l.item.rarity);
      const ring = l.encore ? "#ffd54f" : rare ? colors.accent2 : colors.accent;
      ctx.globalCompositeOperation = "lighter";
      this.lightAt(ctx, x, y, ITEM_PICKUP_R + 14, ring, 0.65 + 0.25 * Math.sin(this.time * 5));
      ctx.globalCompositeOperation = "source-over";
      // 移動まで（おかわりは消えるまで）の残り時間
      const left = l.encore
        ? Math.max(0, Math.min(1, (l.until - g.clock) / ENCORE_SEC))
        : 1 - Math.min(1, (g.clock - l.litAt) / ITEM_RELOCATE_SEC);
      ctx.beginPath();
      ctx.arc(x, y, ITEM_PICKUP_R - 3, -Math.PI / 2, -Math.PI / 2 + TAU * left);
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = left < 0.2 ? "#ff8a80" : l.encore ? "rgba(255,226,140,0.95)" : "rgba(255,255,255,0.85)";
      ctx.stroke();
      const tok = this.token(l.item, ITEM_PICKUP_R - 6, ring);
      const r = ITEM_PICKUP_R - 6;
      if (tok) ctx.drawImage(tok, x - r, y - r, r * 2, r * 2);
      else {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fillStyle = "#fff4d6";
        ctx.fill();
      }
      if (l.encore) {
        const w = 30;
        const ty = y + r + 5;
        ctx.fillStyle = "rgba(60,36,0,0.85)";
        this.roundRect(ctx, x - w / 2, ty - 5, w, 10, 5);
        ctx.fill();
        ctx.fillStyle = "#ffe08a";
        ctx.font = `900 6.5px ${FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("おかわり", x, ty + 0.3);
      }
    }
  }

  /**
   * バンパーの上半分（光るプラスチックの胴・めっきのリング・アイテムの絵の笠）を前もって描いた絵。
   * lit は当たった瞬間の絵（胴が明るく光り、リングが下がって細く見える）
   */
  private bumperSprite(i: number, lit: boolean): HTMLCanvasElement {
    const b = this.table.bumpers[i]!;
    const items = this.assets.bumperItems;
    const item = items.length ? items[i % items.length] : undefined;
    const img = item?.image ? this.images.get(item.image) : undefined;
    const ready = Boolean(img && img.complete && img.naturalWidth);
    const key = `${i}|${lit ? 1 : 0}|${ready ? 1 : 0}`;
    const cached = this.bumperSprites.get(key);
    if (cached) return cached;
    const { colors } = this.assets.theme;
    const k = this.k;
    const R = b.r;
    const half = R + 3;
    const px = Math.max(8, Math.ceil(half * 2 * k));
    const c = makeCanvas(px, px);
    const ctx = c.getContext("2d")!;
    ctx.setTransform(k, 0, 0, k, px / 2, px / 2);
    const capR = R - 5;

    // 胴（リングと笠のあいだから見える、中の電球で光るプラスチック）
    const body = ctx.createRadialGradient(0, 0, capR * 0.85, 0, 0, R - 0.5);
    if (lit) {
      body.addColorStop(0, "#ffffff");
      body.addColorStop(0.45, lighten(colors.accent, 0.55));
      body.addColorStop(1, rgba(colors.accent, 1));
    } else {
      body.addColorStop(0, lighten(colors.accent, 0.1));
      body.addColorStop(1, darken(colors.accent, 0.5));
    }
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, R - 0.5, 0, TAU);
    ctx.fill();
    // めっきのリング（当たると下がるので、光っているときは細く見せる）
    chromeRing(ctx, 0, 0, R - 0.9, lit ? 2 : 2.9);
    // 笠の影
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.arc(0.7, 1.1, capR + 0.7, 0, TAU);
    ctx.fill();
    // 笠（アイテムの絵）
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, capR, 0, TAU);
    ctx.clip();
    ctx.fillStyle = "#fff8ec";
    ctx.fillRect(-capR, -capR, capR * 2, capR * 2);
    if (ready && img) {
      const pad = item?.rarity ? 0.96 : 1.06;
      ctx.drawImage(img, -capR * pad, -capR * pad, capR * pad * 2, capR * pad * 2);
    } else {
      const ph = ctx.createLinearGradient(0, -capR, 0, capR);
      ph.addColorStop(0, lighten(colors.accent2, 0.3));
      ph.addColorStop(1, darken(colors.accent2, 0.3));
      ctx.fillStyle = ph;
      ctx.fillRect(-capR, -capR, capR * 2, capR * 2);
    }
    // 透明なドーム：左上につや、ふちは少し暗く
    const dome = ctx.createRadialGradient(-capR * 0.38, -capR * 0.45, 0, 0, 0, capR * 1.05);
    dome.addColorStop(0, "rgba(255,255,255,0.5)");
    dome.addColorStop(0.32, "rgba(255,255,255,0.1)");
    dome.addColorStop(0.7, "rgba(255,255,255,0)");
    dome.addColorStop(1, "rgba(0,0,0,0.38)");
    ctx.fillStyle = dome;
    ctx.fillRect(-capR, -capR, capR * 2, capR * 2);
    if (lit) {
      ctx.fillStyle = rgba(colors.accent, 0.22);
      ctx.fillRect(-capR, -capR, capR * 2, capR * 2);
    }
    ctx.restore();
    // 笠のふち（めっきの細い輪）
    chromeRing(ctx, 0, 0, capR + 0.4, 1.3);
    // つやの光
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.ellipse(-capR * 0.42, -capR * 0.52, capR * 0.3, capR * 0.12, -0.62, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(capR * 0.5, capR * 0.42, capR * 0.06, 0, TAU);
    ctx.fill();
    this.bumperSprites.set(key, c);
    return c;
  }

  private drawBumpers(ctx: CanvasRenderingContext2D, dt: number): void {
    const { colors } = this.assets.theme;
    this.table.bumpers.forEach((b, i) => {
      const f = this.bumperFlash[i]!;
      const half = b.r + 3;
      if (f > 0) {
        ctx.globalCompositeOperation = "lighter";
        this.lightAt(ctx, b.x, b.y, b.r + 30, colors.accent, f);
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.drawImage(this.bumperSprite(i, false), b.x - half, b.y - half, half * 2, half * 2);
      if (f > 0) {
        ctx.globalAlpha = Math.min(1, f * 1.4);
        ctx.drawImage(this.bumperSprite(i, true), b.x - half, b.y - half, half * 2, half * 2);
        ctx.globalAlpha = 1;
      }
      this.bumperFlash[i] = Math.max(0, f - dt * 6);
    });
  }

  /** スリングショットのはじく面（ゴム）。当たると外へふくらみ、カバーが光る */
  private drawSlings(ctx: CanvasRenderingContext2D, dt: number): void {
    const { colors } = this.assets.theme;
    this.table.slings.forEach((s, i) => {
      const f = this.slingFlash[i]!;
      const mx = (s.a.x + s.c.x) / 2;
      const my = (s.a.y + s.c.y) / 2;
      const dx = s.c.x - s.a.x;
      const dy = s.c.y - s.a.y;
      const l = Math.hypot(dx, dy) || 1;
      // はじく向き（カバーの外がわ）
      let nx = -dy / l;
      let ny = dx / l;
      if ((s.b.x - mx) * nx + (s.b.y - my) * ny > 0) {
        nx = -nx;
        ny = -ny;
      }
      if (f > 0) {
        ctx.globalCompositeOperation = "lighter";
        this.lightAt(ctx, (s.a.x + s.b.x + s.c.x) / 3, (s.a.y + s.b.y + s.c.y) / 3, 48, colors.accent, f * 0.9);
        this.lightAt(ctx, mx + nx * 10, my + ny * 10, 40, "#ffffff", f * 0.5);
        ctx.globalCompositeOperation = "source-over";
      }
      const bulge = f * 6;
      const path = new Path2D();
      path.moveTo(s.a.x, s.a.y);
      path.quadraticCurveTo(mx + nx * bulge * 2, my + ny * bulge * 2, s.c.x, s.c.y);
      // 影はつけない（毎フレームなので）。かわりに少しずらした暗い線
      ctx.save();
      ctx.lineCap = "round";
      ctx.translate(0.9, 1.6);
      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.stroke(path);
      ctx.restore();
      rubberBand(ctx, 1, path, 8, { lift: 0, color: f > 0 ? "#ffffff" : undefined });
      // 両はしのポストの頭（ゴムの上に見える）
      chromeDisc(ctx, s.a.x, s.a.y, 2.6, true);
      chromeDisc(ctx, s.c.x, s.c.y, 2.6, true);
      this.slingFlash[i] = Math.max(0, f - dt * 6);
    });
  }

  /** スキル「ふさぐ」の光の扉（切れる前は点滅） */
  private drawGates(ctx: CanvasRenderingContext2D, g: Game): void {
    if (!g.world.outlaneGate[0] && !g.world.outlaneGate[1]) return;
    const left = g.gateUntil - g.clock;
    const blinkA = left < 2 ? (Math.sin(this.time * 30) > 0 ? 1 : 0.3) : 1;
    this.table.outlaneGates.forEach((gate, i) => {
      if (!g.world.outlaneGate[i]) return;
      // はね返した瞬間は強く光る
      const kick = this.gateFlash[i]!;
      const a = Math.min(1, blinkA + kick);
      if (kick > 0) {
        ctx.globalCompositeOperation = "lighter";
        this.lightAt(ctx, (gate.a.x + gate.b.x) / 2, (gate.a.y + gate.b.y) / 2 - 6, 46, "#ffffff", kick * 0.9);
        ctx.globalCompositeOperation = "source-over";
        this.gateFlash[i] = Math.max(0, kick - this.frameDt * 3);
      }
      const dx = gate.b.x - gate.a.x;
      const dy = gate.b.y - gate.a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = a;
      ctx.lineCap = "round";
      for (const [w, alpha] of [[8, 0.25], [4.5, 0.55], [1.6, 0.95]] as const) {
        ctx.lineWidth = w;
        ctx.strokeStyle = w < 2 ? "rgba(235,255,255,0.95)" : rgba("#7df9ff", alpha);
        ctx.beginPath();
        ctx.moveTo(gate.a.x, gate.a.y);
        ctx.lineTo(gate.b.x, gate.b.y);
        ctx.stroke();
      }
      // ゆらぐ電気の筋
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = "rgba(200,255,255,0.85)";
      ctx.beginPath();
      const seed = Math.floor(this.time * 24);
      for (let s = 0; s <= 8; s += 1) {
        const t = s / 8;
        const j = s === 0 || s === 8 ? 0 : Math.sin(seed * 12.9898 + s * 78.233) * 2.2;
        const x = gate.a.x + dx * t + nx * j;
        const y = gate.a.y + dy * t + ny * j;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      this.lightAt(ctx, (gate.a.x + gate.b.x) / 2, (gate.a.y + gate.b.y) / 2, 30, "#7df9ff", a * 0.8);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      // 両はしの金具
      chromeDisc(ctx, gate.a.x + dx * 0.02, gate.a.y + dy * 0.02, 2.4, true);
      chromeDisc(ctx, gate.b.x - dx * 0.02, gate.b.y - dy * 0.02, 2.4, true);
    });
  }

  /** フリッパー：白いプラスチックの羽根に色つきのゴム、めっきの軸 */
  private drawFlippers(ctx: CanvasRenderingContext2D, flippers: readonly FlipperState[]): void {
    const { colors } = this.assets.theme;
    for (const f of flippers) {
      const { pivot, r0, r1 } = f.def;
      const tip = flipperTip(f);
      const a = Math.atan2(tip.y - pivot.y, tip.x - pivot.x);
      const outline = (rr0: number, rr1: number, ox = 0, oy = 0) => {
        ctx.beginPath();
        ctx.arc(pivot.x + ox, pivot.y + oy, rr0, a + Math.PI / 2, a - Math.PI / 2);
        ctx.arc(tip.x + ox, tip.y + oy, rr1, a - Math.PI / 2, a + Math.PI / 2);
        ctx.closePath();
      };
      // やわらかい影（2枚重ね）
      outline(r0 + 1.2, r1 + 1.2, 3.4, 5);
      ctx.fillStyle = "rgba(0,0,0,0.16)";
      ctx.fill();
      outline(r0, r1, 2, 3.2);
      ctx.fillStyle = "rgba(0,0,0,0.32)";
      ctx.fill();
      // 光の当たる側（上がわ）と影の側（下がわ）
      let nx = -Math.sin(a);
      let ny = Math.cos(a);
      if (ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      const lightSide = { x: pivot.x - nx * r0, y: pivot.y - ny * r0 };
      const darkSide = { x: pivot.x + nx * r0, y: pivot.y + ny * r0 };
      // ゴム
      const rubber = ctx.createLinearGradient(lightSide.x, lightSide.y, darkSide.x, darkSide.y);
      rubber.addColorStop(0, lighten(colors.accent2, 0.35));
      rubber.addColorStop(0.55, rgba(colors.accent2, 1));
      rubber.addColorStop(1, darken(colors.accent2, 0.45));
      outline(r0, r1);
      ctx.fillStyle = rubber;
      ctx.fill();
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.stroke();
      // 羽根（プラスチック）
      const bodyGrad = ctx.createLinearGradient(lightSide.x, lightSide.y, darkSide.x, darkSide.y);
      bodyGrad.addColorStop(0, "#ffffff");
      bodyGrad.addColorStop(0.6, "#f1eee7");
      bodyGrad.addColorStop(1, "#c9c4b9");
      outline(r0 - 2.3, r1 - 2.1);
      ctx.fillStyle = bodyGrad;
      ctx.fill();
      // 羽根の線（印刷）
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = rgba(colors.accent, 0.9);
      ctx.beginPath();
      const mid = (t: number, off: number) => ({ x: pivot.x + (tip.x - pivot.x) * t - nx * off, y: pivot.y + (tip.y - pivot.y) * t - ny * off });
      const s0 = mid(0.28, 0.2);
      const s1 = mid(0.86, 0.1);
      ctx.moveTo(s0.x, s0.y);
      ctx.lineTo(s1.x, s1.y);
      ctx.stroke();
      // 上がわのつや
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      const h0 = mid(0.12, r0 - 3.4);
      const h1 = mid(0.9, r1 - 2.8);
      ctx.beginPath();
      ctx.moveTo(h0.x, h0.y);
      ctx.lineTo(h1.x, h1.y);
      ctx.stroke();
      ctx.restore();
      // 軸
      chromeDisc(ctx, pivot.x, pivot.y, 4.4, true);
    }
  }

  private drawBalls(ctx: CanvasRenderingContext2D, g: Game, onRamp: boolean): void {
    const sprite = this.ballSprite!;
    for (const b of g.world.balls) {
      const isRamp = b.mode === "ramp";
      if (isRamp !== onRamp) continue;
      let x = b.x;
      let y = b.y;
      let r = BALL_R;
      const trail = this.ballTrails.get(b.id);
      if (trail && trail.length > 1 && !this.reducedMotion) {
        ctx.save();
        ctx.lineCap = "round";
        for (let i = 1; i < trail.length; i += 1) {
          const prev = trail[i - 1]!;
          const at = trail[i]!;
          // けり出しなどの瞬間移動はつながない
          const distance = Math.hypot(at.x - prev.x, at.y - prev.y);
          if (distance < 3 || distance > 100) continue;
          const fade = Math.max(0, 1 - (this.time - at.at) / 0.08);
          ctx.strokeStyle = rgba(this.assets.theme.colors.accent2, fade * 0.22);
          ctx.lineWidth = BALL_R * (0.25 + fade * 0.55);
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(at.x, at.y);
          ctx.stroke();
        }
        ctx.restore();
      }
      if (isRamp && b.ramp) {
        const def = this.table.ramps.find((rp) => rp.id === b.ramp)!;
        const p = rampPoint(def, b.s);
        x = p.x;
        y = p.y;
        r = BALL_R * (1 + p.z / 160);
        ctx.beginPath();
        ctx.ellipse(x + 3 + p.z * 0.25, y + 4 + p.z * 0.35, BALL_R * 0.95, BALL_R * 0.8, 0, 0, TAU);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fill();
      } else if (b.mode === "scoop") {
        r = BALL_R * 0.85;
      } else {
        ctx.beginPath();
        ctx.ellipse(x + 2.5, y + 3.5, BALL_R * 0.95, BALL_R * 0.82, 0, 0, TAU);
        ctx.fillStyle = "rgba(0,0,0,0.32)";
        ctx.fill();
      }
      ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
    }
  }

  /** プランジャー：めっきの棒とばね、先の黒いゴム */
  private drawPlunger(ctx: CanvasRenderingContext2D, g: Game): void {
    const pull = g.world.plungerPull;
    const top = this.table.plungerRest.y + BALL_R + 1 + pull * PLUNGER_TRAVEL;
    const x = 504;
    // 棒
    const rod = ctx.createLinearGradient(x - 2.5, 0, x + 2.5, 0);
    rod.addColorStop(0, "#5b6571");
    rod.addColorStop(0.35, "#f4f6f9");
    rod.addColorStop(1, "#4c555f");
    ctx.fillStyle = rod;
    ctx.fillRect(x - 2.5, top + 4, 5, TABLE_H - top);
    // ばね（手前の線は明るく、奥の線は暗く）
    const coils = 8;
    const y0 = top + 7;
    const y1 = 966;
    const pitch = (y1 - y0) / coils;
    ctx.lineCap = "round";
    for (let i = 0; i < coils; i += 1) {
      const ya = y0 + i * pitch;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#59636e";
      ctx.beginPath();
      ctx.moveTo(x + 8, ya);
      ctx.lineTo(x - 8, ya + pitch / 2);
      ctx.stroke();
      ctx.strokeStyle = "#dfe4ea";
      ctx.beginPath();
      ctx.moveTo(x - 8, ya + pitch / 2);
      ctx.lineTo(x + 8, ya + pitch);
      ctx.stroke();
    }
    // 先（めっきの頭に黒いゴム）
    const head = ctx.createLinearGradient(0, top, 0, top + 7);
    head.addColorStop(0, "#f4f6f9");
    head.addColorStop(1, "#5b6571");
    ctx.fillStyle = head;
    this.roundRect(ctx, x - 11, top + 2.4, 22, 4.6, 1.4);
    ctx.fill();
    ctx.fillStyle = "#18191c";
    this.roundRect(ctx, x - 9, top - 0.6, 18, 3.4, 1.4);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(x - 7.5, top - 0.2, 15, 0.6);
  }

  private drawParticles(ctx: CanvasRenderingContext2D, dt: number): void {
    if (!this.particles.length) return;
    ctx.globalCompositeOperation = "lighter";
    const keep: Particle[] = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "confetti") {
        p.vy += 420 * dt;
        p.vx *= 0.99;
      } else {
        p.vx *= 0.92;
        p.vy *= 0.92;
      }
      const a = Math.min(1, p.life / (p.max * 0.5));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.kind === "confetti") {
        ctx.fillRect(p.x, p.y, p.size, p.size * 0.5);
      } else if (p.kind === "star") {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      keep.push(p);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    this.particles = keep;
  }

  private drawPopups(ctx: CanvasRenderingContext2D, dt: number): void {
    if (!this.popups.length) return;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const keep: Popup[] = [];
    for (const p of this.popups) {
      p.life -= dt * (p.tone === "epic" ? 0.6 : 0.9);
      if (p.life <= 0) continue;
      p.y -= dt * 34;
      const size = p.tone === "epic" ? 21 : p.tone === "great" ? 17 : p.tone === "good" ? 14 : 12;
      ctx.font = `900 ${size}px ${FONT}`;
      ctx.globalAlpha = Math.min(1, p.life * 2.5);
      ctx.lineWidth = size * 0.28;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = TONE_COLOR[p.tone];
      ctx.fillText(p.text, p.x, p.y);
      keep.push(p);
    }
    ctx.globalAlpha = 1;
    this.popups = keep;
  }

  /** 取ったアイテムが、画面の上のスタンプ帳へ飛んでいく */
  private drawFlying(ctx: CanvasRenderingContext2D, dt: number): void {
    if (!this.flying.length) return;
    const keep: Flying[] = [];
    for (const f of this.flying) {
      f.t += dt * 1.4;
      if (f.t >= 1) continue;
      const e = 1 - Math.pow(1 - f.t, 3);
      const x = f.x0 + (240 - f.x0) * e;
      const y = f.y0 + (-40 - f.y0) * e - Math.sin(e * Math.PI) * 60;
      const r = (ITEM_PICKUP_R - 6) * (1 + Math.sin(e * Math.PI) * 0.6);
      const tok = this.token(f.item, ITEM_PICKUP_R - 6, this.assets.theme.colors.accent);
      ctx.globalAlpha = 1 - f.t * 0.3;
      if (tok) ctx.drawImage(tok, x - r, y - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
      keep.push(f);
    }
    this.flying = keep;
  }

  /** 台に玉がいくつ出ているか（演出の判断用） */
  balls(g: Game): number {
    return ballsOnTable(g);
  }
}
