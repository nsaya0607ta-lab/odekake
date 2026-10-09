/**
 * 自分で作るステージ（ご当地ピンボール）
 * =============================================================
 * 新しいステージは白紙から作る。base が無い旧ステージは従来の骨組みを保つ。
 * 作ったステージはフレンドに公開して、おたがいに遊べる（記録はステージごと。docs/pinball.md の「ステージ」）。
 *
 * ここにあるのは、ステージのデータの形・部品のカタログ・確かめ（validateStage）・台の形への組み立て（buildStageTable）。
 * エディター（ブラウザ）・保存の API（サーバー）・シミュレーターが同じものを使う（地図や図鑑のデータは読まない軽いファイル）。
 *
 * 玉が止まらないように、置いた部品どうし・部品と骨組みのすき間は、どこも STAGE_GAP（31mm）以上にする
 * （玉の直径は 27mm。せまいすき間や、2つの部品のくぼみに玉が乗ると止まる。かざぐるまは羽根のとどく円で数える）。
 * 部品の値段・はじめから持っている数・持てる数を変えたら、マイグレーションの pinball_part_* も同じにする（いまは 0139）。
 * 部品の種類を足したら、データベースの save_pinball_stage の種類の一覧にも足す（いまは 0139）。
 */
import { COASTER_RAMP, COASTER_RAMP_RIGHT, DEFAULT_MAP_ID, SHOT_SPOTS, TOP_RAMP } from "./maps";
import { STAGE_DROP_R } from "./physics";
import { buildTable, CX, p, type CircleDef, type DropTargetDef, type MapSpec, type PinwheelDef, type Pt, type SlingDef, type SpinnerDef, type TableGeometry, type WallDef } from "./table";

/* ---------- 部品のカタログ ---------- */

export type PinballPartId = "bumper" | "pinwheel" | "post" | "peg" | "sling" | "rail" | "rubber" | "block" | "bar" | "spinner" | "drop" | "ramp_top" | "ramp_cross";

export type PinballPartInfo = {
  id: PinballPartId;
  name: string;
  /** 1回の買い物の値段（赤コイン） */
  price: number;
  /** 1回で買える数（くぎは10本ずつ） */
  pack: number;
  /** はじめから持っている数 */
  free: number;
  /**
   * 持てる数（はじめのぶんもふくめて）。null は上限なし（2026-10-09〜、ランプのほかは上限なし。ユーザー指定）。
   * 1つのステージに置ける数は、持っている数まで。部品どうしのすき間（STAGE_GAP）があるので、置ける数は台の広さで自然に決まる
   */
  max: number | null;
  /** 部品の説明（ショップに出す） */
  lead: string;
};

export const PINBALL_PARTS: readonly PinballPartInfo[] = [
  { id: "bumper", name: "バンパー", price: 900, pack: 1, free: 3, max: null, lead: "当たると玉をはじき飛ばす。大きさは3つからえらべる" },
  { id: "pinwheel", name: "かざぐるま", price: 1200, pack: 1, free: 1, max: null, lead: "いつも回っている羽根。回る向きをえらべる" },
  { id: "post", name: "ゴムのポスト", price: 150, pack: 1, free: 4, max: null, lead: "小さなゴムの柱。玉の通り道を作る" },
  { id: "peg", name: "くぎ（10本）", price: 300, pack: 10, free: 10, max: null, lead: "パチンコのくぎ。カチカチ当たりながら落ちてくる" },
  { id: "sling", name: "ミニスリングショット", price: 1200, pack: 1, free: 0, max: null, lead: "ゴムの面に当たると、横へはじく。向きをえらべる" },
  { id: "rail", name: "ガイドレール", price: 450, pack: 1, free: 2, max: null, lead: "まっすぐな金属のレール。玉の通り道を作る。向きを変えられる" },
  { id: "rubber", name: "ゴムのかべ", price: 600, pack: 1, free: 0, max: null, lead: "2本のポストに張ったゴム。当たった玉がよくはねる。向きを変えられる" },
  { id: "block", name: "ブロック", price: 450, pack: 1, free: 0, max: null, lead: "ひし形のプラスチックのかたまり。玉をななめにはね返す" },
  { id: "bar", name: "回転バー", price: 1500, pack: 1, free: 0, max: null, lead: "ゆっくり回る長いバー。近くの玉をはらいのける。回る向きをえらべる" },
  { id: "spinner", name: "スピナー", price: 1200, pack: 1, free: 0, max: null, lead: "玉がくぐると板がくるくる回って、回ったぶん点が入る" },
  { id: "drop", name: "ドロップターゲット", price: 900, pack: 1, free: 0, max: null, lead: "当てるとたおれる的。全部たおすとボーナスが入って、また立つ。向きを変えられる" },
  { id: "ramp_top", name: "てっぺんランプ", price: 3600, pack: 1, free: 0, max: 1, lead: "ランプをのぼった玉を、インレーンではなく台のてっぺんに落とす" },
  { id: "ramp_cross", name: "コースターランプ", price: 5400, pack: 1, free: 0, max: 1, lead: "左右のランプがXに交わって、反対がわのインレーンへ降りてくる" },
];

export function getPinballPart(id: string): PinballPartInfo | null {
  return PINBALL_PARTS.find((part) => part.id === id) ?? null;
}

export type OwnedParts = Record<PinballPartId, number>;

/** 持っている部品の数（はじめのぶん＋買ったぶん）。rows は user_pinball_parts の行（買ったぶん） */
export function ownedPinballParts(bought: Partial<Record<string, number>>): OwnedParts {
  const out = {} as OwnedParts;
  for (const part of PINBALL_PARTS) {
    const have = part.free + Math.max(0, Math.floor(bought[part.id] ?? 0));
    out[part.id] = part.max === null ? have : Math.min(part.max, have);
  }
  return out;
}

/* ---------- ステージのデータ ---------- */

export type BumperSize = "s" | "m" | "l";
export const BUMPER_RADIUS: Record<BumperSize, number> = { s: 18, m: 23, l: 28 };

/**
 * 置ける部品（ランプは部品ではなくステージの設定）。angle は向き（度。0 が横、90 がたて。y は下向きなので、
 * 30 は右下がりの「＼」、150 は左下がりの「／」）。えらべる向きは WALL_ANGLES・DROP_ANGLES
 */
export type StagePart =
  | { kind: "bumper"; x: number; y: number; size: BumperSize }
  | { kind: "pinwheel"; x: number; y: number; /** 1 が時計まわり */ dir: 1 | -1 }
  | { kind: "post"; x: number; y: number }
  | { kind: "peg"; x: number; y: number }
  | { kind: "sling"; x: number; y: number; /** ゴムの面が向いているがわ */ face: "left" | "right" }
  | { kind: "rail"; x: number; y: number; angle: number }
  | { kind: "rubber"; x: number; y: number; angle: number }
  | { kind: "block"; x: number; y: number }
  | { kind: "bar"; x: number; y: number; /** 1 が時計まわり */ dir: 1 | -1 }
  | { kind: "spinner"; x: number; y: number }
  | { kind: "drop"; x: number; y: number; angle: number };

export type StagePartKind = StagePart["kind"];
export const STAGE_PART_KINDS: readonly StagePartKind[] = ["bumper", "pinwheel", "post", "peg", "sling", "rail", "rubber", "block", "bar", "spinner", "drop"];

/**
 * ガイドレール・ゴムのかべの向き。横（0°）に近い向きはえらべない（平らな面に玉が乗って止まる）。
 * 左右を折り返しても、この中のどれかになる
 */
export const WALL_ANGLES: readonly number[] = [30, 45, 60, 90, 120, 135, 150];
/** ドロップターゲットの向き（横もえらべる。上に乗った玉も、落ちてきた勢いでたおれる） */
export const DROP_ANGLES: readonly number[] = [0, 30, 60, 90, 120, 150];

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
  /** 新規作成は白紙。省略した旧データは従来の骨組みで読む（保存形式の互換性） */
  base?: "blank";
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
export const FREE_STAGE_AREA = { x0: 26, x1: 454, y0: 64, y1: 818 } as const;
export function stageArea(spec: StageSpec) {
  return spec.base === "blank" ? FREE_STAGE_AREA : STAGE_AREA;
}

/** スタンドアップターゲットの組の位置（いつもの台と同じ） */
const STANDUP_CENTER = p(96, 215);

const SLING_HALF = 42;
const SLING_DEPTH = 12;
const PINWHEEL = { arms: 4, len: 19, r: 4.5, hubR: 6.5, omega: 2.6 } as const;
const POST_R = 6;
const PEG_R = 3.5;
/** ガイドレール（金属の丸い棒）・ゴムのかべ（2本のポストに張ったゴム）の長さと太さ（半径） */
const RAIL = { len: 64, r: 4 } as const;
const RUBBER = { len: 56, r: 4 } as const;
/** ブロック：中心線のひし形（まん中から角まで d）を r だけ太らせた形（外の大きさは 40mm） */
const BLOCK = { d: 17, r: 3 } as const;
/** 回転バー：2本の長い羽根のかざぐるま（ゆっくり回る） */
const BAR = { arms: 2, len: 34, r: 4.5, hubR: 7, omega: 1.8 } as const;
/** スピナーの板の幅（両はしの金具は板から 3mm 外） */
const SPINNER_W = 40;
/** ドロップターゲットの幅 */
const DROP_W = 28;

export const PART_NAMES: Record<StagePartKind, string> = {
  bumper: "バンパー",
  pinwheel: "かざぐるま",
  post: "ポスト",
  peg: "くぎ",
  sling: "スリングショット",
  rail: "ガイドレール",
  rubber: "ゴムのかべ",
  block: "ブロック",
  bar: "回転バー",
  spinner: "スピナー",
  drop: "ドロップターゲット",
};

/** はじめのアイテムの場所（いつもの台と同じ） */
export const DEFAULT_STAGE_ITEMS: [Pt, Pt, Pt] = [p(128, 300), p(352, 300), p(240, 277)];

/** 部品・ランプ・固定のレーンを置いていない、新しい台 */
export function emptyStage(look: string = DEFAULT_MAP_ID): StageSpec {
  return { v: 1, base: "blank", look, ramp: "standard", parts: [], items: DEFAULT_STAGE_ITEMS.map((pt) => ({ ...pt })) as [Pt, Pt, Pt] };
}

/** 白紙の台では standard は「ランプなし」。ほかの2種類は購入したランプを設置する */
export function stageRampName(spec: StageSpec, ramp: StageRamp): string {
  return spec.base === "blank" && ramp === "standard" ? "ランプなし" : RAMP_NAMES[ramp];
}

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
    case "rail":
    case "rubber":
      return typeof raw.angle === "number" && WALL_ANGLES.includes(raw.angle) ? { kind: raw.kind, x, y, angle: raw.angle } : null;
    case "drop":
      return typeof raw.angle === "number" && DROP_ANGLES.includes(raw.angle) ? { kind: "drop", x, y, angle: raw.angle } : null;
    case "block":
      return { kind: "block", x, y };
    case "bar":
      return raw.dir === 1 || raw.dir === -1 ? { kind: "bar", x, y, dir: raw.dir } : null;
    case "spinner":
      return { kind: "spinner", x, y };
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
  if (raw.base !== undefined && raw.base !== "blank") return null;
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
  return { v: 1, ...(raw.base === "blank" ? { base: "blank" as const } : {}), look: raw.look, ramp: raw.ramp as StageRamp, parts, items: [items[0]!, items[1]!, items[2]!] };
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

/** 太さのある線（a と b が同じなら円）。エディターで、動かしている部品の形を描くのにも使う */
export type StagePrim = { ax: number; ay: number; bx: number; by: number; r: number };
type Prim = StagePrim;
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

/** 形をかこむ四角（太さもふくめ、まわりに margin を足す） */
type Box = { x0: number; x1: number; y0: number; y1: number };

function boxOf(shape: readonly Prim[], margin: number): Box {
  const box: Box = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  for (const u of shape) {
    box.x0 = Math.min(box.x0, u.ax - u.r - margin, u.bx - u.r - margin);
    box.x1 = Math.max(box.x1, u.ax + u.r + margin, u.bx + u.r + margin);
    box.y0 = Math.min(box.y0, u.ay - u.r - margin, u.by - u.r - margin);
    box.y1 = Math.max(box.y1, u.ay + u.r + margin, u.by + u.r + margin);
  }
  return box;
}

/** 四角どうしが重ならない（＝margin をつけた形どうしのすき間は margin より広い） */
const apart = (a: Box, b: Box) => a.x0 > b.x1 || a.x1 < b.x0 || a.y0 > b.y1 || a.y1 < b.y0;

/** スリングショットの三角（上・外がわ・下。ゴムの面は上と下を結ぶ線で、face のがわを向く） */
export function stageSlingDef(part: Extract<StagePart, { kind: "sling" }>): SlingDef {
  const out = part.face === "right" ? -SLING_DEPTH : SLING_DEPTH;
  const top = p(part.x, part.y - SLING_HALF);
  const back = p(part.x + out, part.y);
  const bottom = p(part.x, part.y + SLING_HALF);
  // SlingDef の side は描くときの左右（ゴムの面が右を向くのは、台の左がわに置くスリングと同じ）
  return part.face === "right" ? { side: "left", a: top, b: back, c: bottom } : { side: "right", a: bottom, b: back, c: top };
}

/** 向きのある部品（ガイドレール・ゴムのかべ・ドロップターゲット）の両はし */
function partEnds(part: { x: number; y: number; angle: number }, len: number): [Pt, Pt] {
  const a = (part.angle * Math.PI) / 180;
  const dx = (Math.cos(a) * len) / 2;
  const dy = (Math.sin(a) * len) / 2;
  return [p(part.x - dx, part.y - dy), p(part.x + dx, part.y + dy)];
}

/** ブロックの中心線のひし形（上・右・下・左） */
function blockCorners(part: { x: number; y: number }): Pt[] {
  return [p(part.x, part.y - BLOCK.d), p(part.x + BLOCK.d, part.y), p(part.x, part.y + BLOCK.d), p(part.x - BLOCK.d, part.y)];
}

/** スピナーの板の両はしの金具（板の幅 + 3mm ずつ外） */
function spinnerEnds(part: { x: number; y: number }): [Pt, Pt] {
  return [p(part.x - SPINNER_W / 2 - 3, part.y), p(part.x + SPINNER_W / 2 + 3, part.y)];
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
    case "rail": {
      const [a, b] = partEnds(part, RAIL.len);
      return [segPrim(a, b, RAIL.r)];
    }
    case "rubber": {
      const [a, b] = partEnds(part, RUBBER.len);
      return [segPrim(a, b, RUBBER.r)];
    }
    case "block": {
      const c = blockCorners(part);
      return c.map((pt, i) => segPrim(pt, c[(i + 1) % c.length]!, BLOCK.r));
    }
    case "bar":
      return [circlePrim(part.x, part.y, BAR.len + BAR.r)];
    case "spinner": {
      // 玉は板に当たらないが、まわりに部品を寄せない（板と金具の絵が重ならないように）
      const [a, b] = spinnerEnds(part);
      return [segPrim(a, b, 3)];
    }
    case "drop": {
      const [a, b] = partEnds(part, DROP_W);
      return [segPrim(a, b, STAGE_DROP_R)];
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
    case "rail":
      return RAIL.len / 2 + RAIL.r;
    case "rubber":
      return RUBBER.len / 2 + RUBBER.r;
    case "block":
      return BLOCK.d + BLOCK.r;
    case "bar":
      return BAR.len + BAR.r;
    case "spinner":
      return SPINNER_W / 2 + 6;
    case "drop":
      return DROP_W / 2 + STAGE_DROP_R;
  }
}

/* ---------- 骨組みの形（部品を置いていないステージ） ---------- */

/** 骨組みの線と、それをかこむ四角（置ける所をたくさん調べるので、遠い線は四角だけ見てとばす） */
type SkeletonPrim = Prim & { name: string; box: Box };

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
const freeSkeleton = new Map<StageRamp, SkeletonPrim[]>();

function skeletonPrims(spec: StageSpec): SkeletonPrim[] {
  const free = spec.base === "blank";
  const cached = free ? freeSkeleton.get(spec.ramp) : skeleton;
  if (cached) return cached;
  const table = buildStageTable({ ...spec, parts: [] });
  const out: SkeletonPrim[] = [];
  const add = (prim: Prim, name: string) => out.push({ ...prim, name, box: boxOf([prim], 0) });
  for (const w of table.walls) {
    const pts = w.closed ? [...w.pts, w.pts[0]!] : w.pts;
    const name = SKELETON_NAMES[w.look ?? ""] ?? "台のかべ";
    for (let i = 0; i + 1 < pts.length; i += 1) add(segPrim(pts[i]!, pts[i + 1]!, w.r), name);
  }
  for (const c of table.circles) add(circlePrim(c.x, c.y, c.r), c.look === "lane-post" ? "上のレーン" : "ポスト");
  for (const bank of table.standups) for (const t of bank.targets) add(segPrim(t.a, t.b, 2.5), "ターゲット");
  for (const d of table.drops) add(segPrim(d.a, d.b, 3.5), "ドロップターゲット");
  add(segPrim(table.shooterGate.a, table.shooterGate.b, 2), "打ち出しレーン");
  if (free) {
    // フリッパーの振れる範囲をあける。部品を置いて操作をふさがない
    for (const f of table.flippers) add(circlePrim(f.pivot.x, f.pivot.y, f.len + f.r0), "フリッパーの動く範囲");
    freeSkeleton.set(spec.ramp, out);
  } else skeleton = out;
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

const inArea = (spec: StageSpec, pt: Pt) => {
  const area = stageArea(spec);
  return pt.x >= area.x0 && pt.x <= area.x1 && pt.y >= area.y0 && pt.y <= area.y1;
};
const stageItemSpots = (spec: StageSpec): readonly Pt[] => spec.base === "blank" ? spec.items : [...spec.items, ...SHOT_SPOTS];
const mm = (n: number) => `${Math.max(0, Math.floor(n))}mm`;

/** 部品 i の置き方の問題（無ければ null）。エディターで、動かしている部品が置けるかを見るのにも使う */
export function partProblem(spec: StageSpec, index: number): string | null {
  const part = spec.parts[index];
  if (!part) return null;
  if (!inArea(spec, part)) return spec.base === "blank" ? "ここには置けません（点線の中に置いてね）" : "ここには置けません（台の上のほうに置いてね）";
  const shape = partShape(part);
  const near = boxOf(shape, STAGE_GAP);
  for (const s of skeletonPrims(spec)) {
    if (apart(near, s.box)) continue;
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
  for (const spot of stageItemSpots(spec)) {
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
  const area = stageArea(spec);
  for (let y = area.y0; y <= area.y1; y += step) {
    for (let x = area.x0; x <= area.x1; x += step) {
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
  if (!inArea(spec, item)) return "ここには置けません（点線の中に置いてね）";
  const at = [circlePrim(item.x, item.y, 0)];
  const near = boxOf(at, ITEM_CLEAR);
  for (const s of skeletonPrims(spec)) {
    if (apart(near, s.box)) continue;
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
  for (const spot of spec.base === "blank" ? [] : SHOT_SPOTS) {
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
    const limit = Math.min(part.max ?? Infinity, owned ? owned[part.id] : Infinity);
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
  const walls: WallDef[] = [];
  const pinwheels: PinwheelDef[] = [];
  const spinners: SpinnerDef[] = [];
  const stageDrops: DropTargetDef[] = [];
  for (const part of spec.parts) {
    switch (part.kind) {
      case "post":
        posts.push({ x: part.x, y: part.y, r: POST_R, mat: "post", look: "post" });
        break;
      case "peg":
        // くぎのはね返りもゴムのポストと同じ（金属だと勢いをなくして、くぎの上にのりやすい）
        posts.push({ x: part.x, y: part.y, r: PEG_R, mat: "post", look: "peg" });
        break;
      case "pinwheel":
        pinwheels.push({ x: part.x, y: part.y, ...PINWHEEL, omega: PINWHEEL.omega * part.dir });
        break;
      case "bar":
        pinwheels.push({ x: part.x, y: part.y, ...BAR, omega: BAR.omega * part.dir });
        break;
      case "rail":
        walls.push({ pts: partEnds(part, RAIL.len), r: RAIL.r, mat: "metal", look: "guide" });
        break;
      case "rubber":
        walls.push({ pts: partEnds(part, RUBBER.len), r: RUBBER.r, mat: "rubber", look: "rubber" });
        break;
      case "block":
        walls.push({ pts: blockCorners(part), r: BLOCK.r, mat: "plastic", closed: true, look: "block" });
        break;
      case "spinner":
        spinners.push({ x: part.x, y: part.y, w: SPINNER_W });
        break;
      case "drop": {
        const [a, b] = partEnds(part, DROP_W);
        stageDrops.push({ a, b });
        break;
      }
      default:
        break;
    }
  }
  const mapSpec: MapSpec = {
    id: STAGE_TABLE_ID,
    bare: spec.base === "blank",
    bumpers: spec.parts.flatMap((part) => (part.kind === "bumper" ? [{ x: part.x, y: part.y, r: BUMPER_RADIUS[part.size] }] : [])),
    pinwheels,
    standupCenter: STANDUP_CENTER,
    posts,
    walls,
    spinners,
    stageDrops,
    slings: spec.parts.flatMap((part) => (part.kind === "sling" ? [stageSlingDef(part)] : [])),
    itemSpots: [...spec.items.map((item) => ({ x: item.x, y: item.y, tier: 0 as const })), ...(spec.base === "blank" ? [] : SHOT_SPOTS)],
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
    case "bar":
      return { ...part, x, dir: part.dir === 1 ? -1 : 1 };
    case "sling":
      return { ...part, x, face: part.face === "left" ? "right" : "left" };
    case "rail":
    case "rubber":
    case "drop":
      return { ...part, x, angle: (180 - part.angle) % 180 };
    default:
      return { ...part, x };
  }
}

/** 向きを変えられる部品か */
export function canRotatePart(part: StagePart): part is Extract<StagePart, { angle: number }> {
  return part.kind === "rail" || part.kind === "rubber" || part.kind === "drop";
}

/** 向きを次の向きにした部品（エディターの「向きを変える」。向きの無い部品はそのまま） */
export function rotatePart(part: StagePart): StagePart {
  if (!canRotatePart(part)) return part;
  const list = part.kind === "drop" ? DROP_ANGLES : WALL_ANGLES;
  const i = list.indexOf(part.angle);
  return { ...part, angle: list[(i + 1) % list.length]! };
}

/** 部品のおおまかな位置で、ステージが同じかどうか（名前・見た目・公開だけを変えたときは、記録を消さない） */
export function sameStageLayout(a: StageSpec, b: StageSpec): boolean {
  return JSON.stringify([a.base, a.ramp, a.parts, a.items]) === JSON.stringify([b.base, b.ramp, b.parts, b.items]);
}
