/**
 * 自分で作るステージ（ご当地ピンボール）
 * =============================================================
 * ステージは「骨組み（どのマップも同じ）＋上半分に置いた部品」。部品は赤コインで買う（はじめから持っているぶんもある）。
 * 作ったステージはフレンドに公開して、おたがいに遊べる（記録はステージごと。docs/pinball.md の「ステージ」）。
 *
 * ここにあるのは、ステージのデータの形・部品のカタログ・確かめ（validateStage）・台の形への組み立て（buildStageTable）。
 * エディター（ブラウザ）・保存の API（サーバー）・シミュレーターが同じものを使う（地図や図鑑のデータは読まない軽いファイル）。
 *
 * 玉が止まらないように、置いた部品どうし・部品と骨組みのすき間は、どこも STAGE_GAP（31mm）以上にする
 * （玉の直径は 27mm。せまいすき間や、2つの部品のくぼみに玉が乗ると止まる。かざぐるまは羽根のとどく円で数える）。
 * 部品の値段・はじめから持っている数・持てる数を変えたら、マイグレーションの pinball_part_* も同じにする（いまは 0138）。
 */
import { COASTER_RAMP, COASTER_RAMP_RIGHT, DEFAULT_MAP_ID, SHOT_SPOTS, TOP_RAMP } from "./maps";
import { buildTable, CX, p, type CircleDef, type MapSpec, type Pt, type SlingDef, type TableGeometry } from "./table";

/* ---------- 部品のカタログ ---------- */

export type PinballPartId = "bumper" | "pinwheel" | "post" | "peg" | "sling" | "ramp_top" | "ramp_cross";

export type PinballPartInfo = {
  id: PinballPartId;
  name: string;
  /** 1回の買い物の値段（赤コイン） */
  price: number;
  /** 1回で買える数（くぎは10本ずつ） */
  pack: number;
  /** はじめから持っている数 */
  free: number;
  /** 持てる数（はじめのぶんもふくめて）。1つのステージに置けるのも、この数まで */
  max: number;
  /** 部品の説明（ショップに出す） */
  lead: string;
};

export const PINBALL_PARTS: readonly PinballPartInfo[] = [
  { id: "bumper", name: "バンパー", price: 300, pack: 1, free: 3, max: 8, lead: "当たると玉をはじき飛ばす。大きさは3つからえらべる" },
  { id: "pinwheel", name: "かざぐるま", price: 400, pack: 1, free: 1, max: 4, lead: "いつも回っている羽根。回る向きをえらべる" },
  { id: "post", name: "ゴムのポスト", price: 50, pack: 1, free: 4, max: 16, lead: "小さなゴムの柱。玉の通り道を作る" },
  { id: "peg", name: "くぎ（10本）", price: 100, pack: 10, free: 10, max: 60, lead: "パチンコのくぎ。カチカチ当たりながら落ちてくる" },
  { id: "sling", name: "ミニスリングショット", price: 400, pack: 1, free: 0, max: 4, lead: "ゴムの面に当たると、横へはじく。向きをえらべる" },
  { id: "ramp_top", name: "てっぺんランプ", price: 1200, pack: 1, free: 0, max: 1, lead: "ランプをのぼった玉を、インレーンではなく台のてっぺんに落とす" },
  { id: "ramp_cross", name: "コースターランプ", price: 1800, pack: 1, free: 0, max: 1, lead: "左右のランプがXに交わって、反対がわのインレーンへ降りてくる" },
];

export function getPinballPart(id: string): PinballPartInfo | null {
  return PINBALL_PARTS.find((part) => part.id === id) ?? null;
}

export type OwnedParts = Record<PinballPartId, number>;

/** 持っている部品の数（はじめのぶん＋買ったぶん）。rows は user_pinball_parts の行（買ったぶん） */
export function ownedPinballParts(bought: Partial<Record<string, number>>): OwnedParts {
  const out = {} as OwnedParts;
  for (const part of PINBALL_PARTS) out[part.id] = Math.min(part.max, part.free + Math.max(0, Math.floor(bought[part.id] ?? 0)));
  return out;
}

/* ---------- ステージのデータ ---------- */

export type BumperSize = "s" | "m" | "l";
export const BUMPER_RADIUS: Record<BumperSize, number> = { s: 18, m: 23, l: 28 };

/** 置ける部品（ランプは部品ではなくステージの設定） */
export type StagePart =
  | { kind: "bumper"; x: number; y: number; size: BumperSize }
  | { kind: "pinwheel"; x: number; y: number; /** 1 が時計まわり */ dir: 1 | -1 }
  | { kind: "post"; x: number; y: number }
  | { kind: "peg"; x: number; y: number }
  | { kind: "sling"; x: number; y: number; /** ゴムの面が向いているがわ */ face: "left" | "right" };

export type StagePartKind = StagePart["kind"];
export const STAGE_PART_KINDS: readonly StagePartKind[] = ["bumper", "pinwheel", "post", "peg", "sling"];

export type StageRamp = "standard" | "top" | "cross";
export const STAGE_RAMPS: readonly StageRamp[] = ["standard", "top", "cross"];
/** ランプを使うのに要る部品（ふつうのランプはいらない） */
export const RAMP_PART: Record<StageRamp, PinballPartId | null> = { standard: null, top: "ramp_top", cross: "ramp_cross" };
export const RAMP_NAMES: Record<StageRamp, string> = { standard: "ふつうのランプ", top: "てっぺんランプ", cross: "コースターランプ" };

/**
 * 見た目（色・床の模様・曲）は、マップの見た目からえらぶ（themes.ts の id）。
 * データベースの save_pinball_stage も同じ一覧を持っているので、足すときは両方に足す（いまは 0138）
 */
export const STAGE_LOOKS: readonly string[] = ["default", "bumper", "pachinko", "coaster"];

export type StageSpec = {
  v: 1;
  look: string;
  ramp: StageRamp;
  parts: StagePart[];
  /** アイテムが浮かぶ場所（台の上のほう3か所。ガチャ穴やランプの入口の7か所は、どのステージも同じ） */
  items: [Pt, Pt, Pt];
};

/** 記録の台の id（ステージのプレイは、この id と、ステージの番号で記録する） */
export const STAGE_TABLE_ID = "stage";
/** 1人が作れるステージの数 */
export const STAGE_LIMIT = 6;
/** ステージの名前の長さ（文字） */
export const STAGE_NAME_MAX = 16;
/** 1つのステージに置ける部品の数（全部あわせて） */
export const STAGE_PARTS_MAX = 120;

/** 部品どうし・部品と骨組みのあいだにあける幅（mm）。玉の直径 27mm より少し広く */
export const STAGE_GAP = 31;
/** アイテムの絵（半径 20mm）が部品や壁に重ならないように */
const ITEM_CLEAR = 20;
/** アイテムどうしの間 */
const ITEM_SPACING = 44;
/** てっぺんランプの出口のまわりにあける幅（落ちてきた玉がすぐ部品に当たらないように） */
const RAMP_EXIT_CLEAR = 40;

/** 部品を置ける所（部品のまん中）。台の上半分（上のレーンの下から、ガチャ穴の上まで） */
export const STAGE_AREA = { x0: 40, x1: 440, y0: 168, y1: 424 } as const;

/** スタンドアップターゲットの組の位置（いつもの台と同じ） */
const STANDUP_CENTER = p(96, 215);

const SLING_HALF = 42;
const SLING_DEPTH = 12;
const PINWHEEL = { arms: 4, len: 19, r: 4.5, hubR: 6.5, omega: 2.6 } as const;
const POST_R = 6;
const PEG_R = 3.5;

export const PART_NAMES: Record<StagePartKind, string> = {
  bumper: "バンパー",
  pinwheel: "かざぐるま",
  post: "ポスト",
  peg: "くぎ",
  sling: "スリングショット",
};

/** はじめのアイテムの場所（いつもの台と同じ） */
export const DEFAULT_STAGE_ITEMS: [Pt, Pt, Pt] = [p(128, 300), p(352, 300), p(240, 277)];

/**
 * 新しいステージ（はじめから持っている部品だけで作った形）。
 * バンパー3つの三角・まん中のかざぐるま・ポスト4本。どれも STAGE_GAP を守っている（validateStage で確かめてある）
 */
export function starterStage(look: string = DEFAULT_MAP_ID): StageSpec {
  return {
    v: 1,
    look,
    ramp: "standard",
    parts: [
      { kind: "bumper", x: 156, y: 262, size: "l" },
      { kind: "bumper", x: 324, y: 262, size: "l" },
      { kind: "bumper", x: 240, y: 340, size: "l" },
      { kind: "pinwheel", x: 240, y: 222, dir: 1 },
      { kind: "post", x: 100, y: 340 },
      { kind: "post", x: 380, y: 340 },
      { kind: "post", x: 176, y: 404 },
      { kind: "post", x: 304, y: 404 },
    ],
    items: [p(120, 300), p(360, 300), p(240, 280)],
  };
}

/* ---------- 読みこみ（形の確かめ） ---------- */

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const intIn = (v: unknown, min: number, max: number): number | null => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null);

function parsePart(raw: unknown): StagePart | null {
  if (!isObj(raw)) return null;
  const x = intIn(raw.x, 0, 480);
  const y = intIn(raw.y, 0, 1000);
  if (x === null || y === null) return null;
  switch (raw.kind) {
    case "bumper":
      return raw.size === "s" || raw.size === "m" || raw.size === "l" ? { kind: "bumper", x, y, size: raw.size } : null;
    case "pinwheel":
      return raw.dir === 1 || raw.dir === -1 ? { kind: "pinwheel", x, y, dir: raw.dir } : null;
    case "post":
      return { kind: "post", x, y };
    case "peg":
      return { kind: "peg", x, y };
    case "sling":
      return raw.face === "left" || raw.face === "right" ? { kind: "sling", x, y, face: raw.face } : null;
    default:
      return null;
  }
}

/**
 * データベースや API から来たステージを読む（形がちがえば null）。座標は整数（mm）。
 * ここでは形だけを見る。置き方（すき間・数）は validateStage で確かめる
 */
export function parseStageSpec(raw: unknown): StageSpec | null {
  if (!isObj(raw) || raw.v !== 1) return null;
  if (typeof raw.look !== "string" || !STAGE_LOOKS.includes(raw.look)) return null;
  if (typeof raw.ramp !== "string" || !STAGE_RAMPS.includes(raw.ramp as StageRamp)) return null;
  if (!Array.isArray(raw.parts) || raw.parts.length > STAGE_PARTS_MAX) return null;
  if (!Array.isArray(raw.items) || raw.items.length !== 3) return null;
  const parts: StagePart[] = [];
  for (const item of raw.parts) {
    const part = parsePart(item);
    if (!part) return null;
    parts.push(part);
  }
  const items: Pt[] = [];
  for (const item of raw.items) {
    if (!isObj(item)) return null;
    const x = intIn(item.x, 0, 480);
    const y = intIn(item.y, 0, 1000);
    if (x === null || y === null) return null;
    items.push(p(x, y));
  }
  return { v: 1, look: raw.look, ramp: raw.ramp as StageRamp, parts, items: [items[0]!, items[1]!, items[2]!] };
}

/** ステージの名前（前後の空白をとって 1〜16 文字・改行などは使わない）。だめなら null */
export function cleanStageName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim();
  const length = [...name].length;
  if (length < 1 || length > STAGE_NAME_MAX || /[\u0000-\u001f\u007f]/.test(name)) return null;
  return name;
}

/* ---------- 形（当たり判定の円と線） ---------- */

/** 太さのある線（a と b が同じなら円） */
type Prim = { ax: number; ay: number; bx: number; by: number; r: number };
const circlePrim = (x: number, y: number, r: number): Prim => ({ ax: x, ay: y, bx: x, by: y, r });
const segPrim = (a: Pt, b: Pt, r: number): Prim => ({ ax: a.x, ay: a.y, bx: b.x, by: b.y, r });

function ptSeg(px: number, py: number, s: Prim): number {
  const dx = s.bx - s.ax;
  const dy = s.by - s.ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - s.ax) * dx + (py - s.ay) * dy) / len2)) : 0;
  return Math.hypot(px - s.ax - dx * t, py - s.ay - dy * t);
}

function cross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

/** 2本の線の中心線どうしの近さ（交わっていれば 0） */
function primDist(u: Prim, v: Prim): number {
  const d1 = cross(u.ax, u.ay, u.bx, u.by, v.ax, v.ay);
  const d2 = cross(u.ax, u.ay, u.bx, u.by, v.bx, v.by);
  const d3 = cross(v.ax, v.ay, v.bx, v.by, u.ax, u.ay);
  const d4 = cross(v.ax, v.ay, v.bx, v.by, u.bx, u.by);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
  return Math.min(ptSeg(u.ax, u.ay, v), ptSeg(u.bx, u.by, v), ptSeg(v.ax, v.ay, u), ptSeg(v.bx, v.by, u));
}

/** 2つの形の、表面どうしのすき間 */
function gapOf(a: readonly Prim[], b: readonly Prim[]): number {
  let best = Infinity;
  for (const u of a) for (const v of b) best = Math.min(best, primDist(u, v) - u.r - v.r);
  return best;
}

/** スリングショットの三角（上・外がわ・下。ゴムの面は上と下を結ぶ線で、face のがわを向く） */
export function stageSlingDef(part: Extract<StagePart, { kind: "sling" }>): SlingDef {
  const out = part.face === "right" ? -SLING_DEPTH : SLING_DEPTH;
  const top = p(part.x, part.y - SLING_HALF);
  const back = p(part.x + out, part.y);
  const bottom = p(part.x, part.y + SLING_HALF);
  // SlingDef の side は描くときの左右（ゴムの面が右を向くのは、台の左がわに置くスリングと同じ）
  return part.face === "right" ? { side: "left", a: top, b: back, c: bottom } : { side: "right", a: bottom, b: back, c: top };
}

/** 部品の形（すき間を数えるときの形。かざぐるまは羽根のとどく円、スリングショットは三角のふち） */
export function partShape(part: StagePart): Prim[] {
  switch (part.kind) {
    case "bumper":
      return [circlePrim(part.x, part.y, BUMPER_RADIUS[part.size])];
    case "pinwheel":
      return [circlePrim(part.x, part.y, PINWHEEL.len + PINWHEEL.r)];
    case "post":
      return [circlePrim(part.x, part.y, POST_R)];
    case "peg":
      return [circlePrim(part.x, part.y, PEG_R)];
    case "sling": {
      const s = stageSlingDef(part);
      return [segPrim(s.a, s.b, 5), segPrim(s.b, s.c, 5), segPrim(s.a, s.c, 5)];
    }
  }
}

/** 点から部品の表面までの近さ（中なら 0 以下）。エディターで、タップした部品をさがすのに使う */
export function partShapeDistance(part: StagePart, at: Pt): number {
  return gapOf(partShape(part), [circlePrim(at.x, at.y, 0)]);
}

/** 部品の大きさ（まん中からいちばん遠いところまで。エディターで、えらんだ部品のまわりに輪を描くのに使う） */
export function partRadius(part: StagePart): number {
  switch (part.kind) {
    case "bumper":
      return BUMPER_RADIUS[part.size];
    case "pinwheel":
      return PINWHEEL.len + PINWHEEL.r;
    case "post":
      return POST_R;
    case "peg":
      return PEG_R;
    case "sling":
      return SLING_HALF + 5;
  }
}

/* ---------- 骨組みの形（部品を置いていないステージ） ---------- */

type SkeletonPrim = Prim & { name: string };

const SKELETON_NAMES: Record<string, string> = {
  frame: "台のふち",
  shooter: "打ち出しレーン",
  rail: "オービットのレール",
  guide: "ガイド",
  lane: "上のレーン",
  scoop: "ガチャ穴",
  "ramp-mouth": "ランプの入口",
  "ramp-roof": "ランプの入口",
  inlane: "インレーン",
  sling: "スリングショット",
  "standup-back": "ターゲット",
};

let skeleton: SkeletonPrim[] | null = null;

function skeletonPrims(): SkeletonPrim[] {
  if (skeleton) return skeleton;
  const table = buildTable({ id: STAGE_TABLE_ID, bumpers: [], pinwheels: [], standupCenter: STANDUP_CENTER, itemSpots: [] });
  const out: SkeletonPrim[] = [];
  for (const w of table.walls) {
    const pts = w.closed ? [...w.pts, w.pts[0]!] : w.pts;
    const name = SKELETON_NAMES[w.look ?? ""] ?? "台のかべ";
    for (let i = 0; i + 1 < pts.length; i += 1) out.push({ ...segPrim(pts[i]!, pts[i + 1]!, w.r), name });
  }
  for (const c of table.circles) out.push({ ...circlePrim(c.x, c.y, c.r), name: c.look === "lane-post" ? "上のレーン" : "ポスト" });
  for (const bank of table.standups) for (const t of bank.targets) out.push({ ...segPrim(t.a, t.b, 2.5), name: "ターゲット" });
  for (const d of table.drops) out.push({ ...segPrim(d.a, d.b, 3.5), name: "ドロップターゲット" });
  out.push({ ...segPrim(table.shooterGate.a, table.shooterGate.b, 2), name: "打ち出しレーン" });
  skeleton = out;
  return out;
}

/** てっぺんランプで玉が落ちてくる所（左右） */
function rampExits(ramp: StageRamp): Pt[] {
  if (ramp !== "top") return [];
  const end = TOP_RAMP.path[TOP_RAMP.path.length - 1]!;
  return [end, p(CX * 2 - end.x, end.y)];
}

/* ---------- 確かめ ---------- */

export type StageIssue = {
  /** どこの問題か（部品の番号・アイテムの番号・ステージ全体） */
  target: { type: "part"; index: number } | { type: "item"; index: number } | { type: "stage" };
  message: string;
};

const inArea = (pt: Pt) => pt.x >= STAGE_AREA.x0 && pt.x <= STAGE_AREA.x1 && pt.y >= STAGE_AREA.y0 && pt.y <= STAGE_AREA.y1;
const mm = (n: number) => `${Math.max(0, Math.floor(n))}mm`;

/** 部品 i の置き方の問題（無ければ null）。エディターで、動かしている部品が置けるかを見るのにも使う */
export function partProblem(spec: StageSpec, index: number): string | null {
  const part = spec.parts[index];
  if (!part) return null;
  if (!inArea(part)) return "ここには置けません（台の上のほうに置いてね）";
  const shape = partShape(part);
  for (const s of skeletonPrims()) {
    const gap = gapOf(shape, [s]);
    if (gap < STAGE_GAP - 0.01) return `${s.name}に近すぎます（すき間 ${mm(gap)}・${STAGE_GAP}mm 以上あけてね）`;
  }
  for (let j = 0; j < spec.parts.length; j += 1) {
    if (j === index) continue;
    const other = spec.parts[j]!;
    // 遠いものは計算しない
    if (Math.abs(other.x - part.x) > 160 || Math.abs(other.y - part.y) > 160) continue;
    const gap = gapOf(shape, partShape(other));
    if (gap < STAGE_GAP - 0.01) return `${PART_NAMES[other.kind]}に近すぎます（すき間 ${mm(gap)}・${STAGE_GAP}mm 以上あけてね）`;
  }
  for (const exit of rampExits(spec.ramp)) {
    if (gapOf(shape, [circlePrim(exit.x, exit.y, 0)]) < RAMP_EXIT_CLEAR) return "ランプの出口（玉が落ちてくる所）に近すぎます";
  }
  for (const spot of [...spec.items, ...SHOT_SPOTS]) {
    if (gapOf(shape, [circlePrim(spot.x, spot.y, 0)]) < ITEM_CLEAR) return "アイテムが浮かぶ場所に重なっています";
  }
  return null;
}

/**
 * 部品を置ける所（step mm ごとの点）。エディターで、置ける所を点で見せるのに使う。
 * make はその場所に置く部品（スリングショットは場所で向きが変わるので）。ignore は動かしている部品の番号
 * （その部品は、ほかの場所へ動かすものとして数える）
 */
export function placeableSpots(spec: StageSpec, make: (at: Pt) => StagePart, ignore: number | null, step = 12): Pt[] {
  const out: Pt[] = [];
  for (let y = STAGE_AREA.y0; y <= STAGE_AREA.y1; y += step) {
    for (let x = STAGE_AREA.x0; x <= STAGE_AREA.x1; x += step) {
      const moved = make(p(x, y));
      const parts = ignore === null ? [...spec.parts, moved] : spec.parts.map((other, i) => (i === ignore ? moved : other));
      if (!partProblem({ ...spec, parts }, ignore ?? parts.length - 1)) out.push(p(x, y));
    }
  }
  return out;
}

/** アイテムの場所 i の問題（無ければ null） */
export function itemProblem(spec: StageSpec, index: number): string | null {
  const item = spec.items[index];
  if (!item) return null;
  if (!inArea(item)) return "ここには置けません（台の上のほうに置いてね）";
  const at = [circlePrim(item.x, item.y, 0)];
  for (const s of skeletonPrims()) {
    if (gapOf(at, [s]) < ITEM_CLEAR) return `${s.name}に近すぎます`;
  }
  for (const part of spec.parts) {
    if (gapOf(at, partShape(part)) < ITEM_CLEAR) return `${PART_NAMES[part.kind]}に重なっています`;
  }
  for (let j = 0; j < spec.items.length; j += 1) {
    if (j === index) continue;
    const other = spec.items[j]!;
    if (Math.hypot(other.x - item.x, other.y - item.y) < ITEM_SPACING) return "ほかのアイテムの場所に近すぎます";
  }
  for (const spot of SHOT_SPOTS) {
    if (Math.hypot(spot.x - item.x, spot.y - item.y) < ITEM_SPACING) return "ほかのアイテムの場所に近すぎます";
  }
  return null;
}

/** ステージで使っている部品の数（ランプもふくむ） */
export function stagePartCounts(spec: StageSpec): OwnedParts {
  const out = {} as OwnedParts;
  for (const part of PINBALL_PARTS) out[part.id] = 0;
  for (const part of spec.parts) out[part.kind] += 1;
  const ramp = RAMP_PART[spec.ramp];
  if (ramp) out[ramp] = 1;
  return out;
}

/**
 * ステージ全体を確かめる。owned を渡すと、持っている部品の数もこえていないか見る（保存のとき）。
 * 問題が無ければ空の配列
 */
export function validateStage(spec: StageSpec, owned?: OwnedParts): StageIssue[] {
  const issues: StageIssue[] = [];
  if (spec.parts.length > STAGE_PARTS_MAX) issues.push({ target: { type: "stage" }, message: `部品は全部で${STAGE_PARTS_MAX}こまでです` });
  const counts = stagePartCounts(spec);
  for (const part of PINBALL_PARTS) {
    const limit = Math.min(part.max, owned ? owned[part.id] : part.max);
    if (counts[part.id] > limit) {
      issues.push({
        target: { type: "stage" },
        message: part.id.startsWith("ramp_") ? `${part.name}を持っていません` : `${PART_NAMES[part.id as StagePartKind] ?? part.name}は${limit}こまでです（いま${counts[part.id]}こ）`,
      });
    }
  }
  spec.parts.forEach((_, index) => {
    const message = partProblem(spec, index);
    if (message) issues.push({ target: { type: "part", index }, message });
  });
  spec.items.forEach((_, index) => {
    const message = itemProblem(spec, index);
    if (message) issues.push({ target: { type: "item", index }, message });
  });
  return issues;
}

/* ---------- 台の形へ ---------- */

/** ステージの形（骨組み＋置いた部品）。物理・描画・シミュレーターはこれを使う */
export function buildStageTable(spec: StageSpec): TableGeometry {
  const posts: CircleDef[] = [];
  for (const part of spec.parts) {
    if (part.kind === "post") posts.push({ x: part.x, y: part.y, r: POST_R, mat: "post", look: "post" });
    // くぎのはね返りもゴムのポストと同じ（金属だと勢いをなくして、くぎの上にのりやすい）
    else if (part.kind === "peg") posts.push({ x: part.x, y: part.y, r: PEG_R, mat: "post", look: "peg" });
  }
  const mapSpec: MapSpec = {
    id: STAGE_TABLE_ID,
    bumpers: spec.parts.flatMap((part) => (part.kind === "bumper" ? [{ x: part.x, y: part.y, r: BUMPER_RADIUS[part.size] }] : [])),
    pinwheels: spec.parts.flatMap((part) => (part.kind === "pinwheel" ? [{ x: part.x, y: part.y, ...PINWHEEL, omega: PINWHEEL.omega * part.dir }] : [])),
    standupCenter: STANDUP_CENTER,
    posts,
    slings: spec.parts.flatMap((part) => (part.kind === "sling" ? [stageSlingDef(part)] : [])),
    itemSpots: [...spec.items.map((item) => ({ x: item.x, y: item.y, tier: 0 as const })), ...SHOT_SPOTS],
    ramp: spec.ramp === "top" ? TOP_RAMP : spec.ramp === "cross" ? COASTER_RAMP : undefined,
    rampRight: spec.ramp === "cross" ? COASTER_RAMP_RIGHT : undefined,
  };
  return buildTable(mapSpec);
}

/** 置ける所にそろえる（エディターで指の位置を部品の位置にするとき。2mm ごと） */
export function snapStagePoint(x: number, y: number): Pt {
  const snap = (v: number) => Math.round(v / 2) * 2;
  return p(Math.max(0, Math.min(480, snap(x))), Math.max(0, Math.min(1000, snap(y))));
}

/** 左右を折り返した部品（エディターの「左右に置く」） */
export function mirrorPart(part: StagePart): StagePart {
  const x = CX * 2 - part.x;
  switch (part.kind) {
    case "pinwheel":
      return { ...part, x, dir: part.dir === 1 ? -1 : 1 };
    case "sling":
      return { ...part, x, face: part.face === "left" ? "right" : "left" };
    default:
      return { ...part, x };
  }
}

/** 部品のおおまかな位置で、ステージが同じかどうか（名前・見た目・公開だけを変えたときは、記録を消さない） */
export function sameStageLayout(a: StageSpec, b: StageSpec): boolean {
  return JSON.stringify([a.ramp, a.parts, a.items]) === JSON.stringify([b.ramp, b.parts, b.items]);
}
