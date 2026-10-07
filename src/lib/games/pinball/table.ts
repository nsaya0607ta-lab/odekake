/**
 * ご当地ピンボールの台の形
 * =============================================================
 * 単位はミリメートル。x は右、y は下（手前）が正。台の大きさ・玉の大きさ・フリッパーの長さは
 * 本物のピンボール台（約52×107cm・玉の直径27mm・フリッパー約7.5cm）に近い比率にしてある。
 * 県ごとの「着せ替え」で変わるのは色・絵・音だけで、形はすべての台で共通（ランキングを1つにできる）。
 *
 * 壁は「中心線＋太さ（r）」で持つ。玉は中心線から r + BALL_R の距離でぶつかる。
 * 物理（physics.ts）と描画（components/games/pinball/render.ts）は、どちらもこのファイルだけを見る。
 * 形を変えたら scripts/simulate-pinball.mjs で、全部のショットがフリッパーから狙えるかを確かめること。
 */

export type Pt = { x: number; y: number };

export const TABLE_W = 522;
export const TABLE_H = 1000;
/** 本物の玉は直径 1-1/16 インチ（27mm） */
export const BALL_R = 13.5;
/** 台の傾き 6.5° ぶんの重力（9810 × sin 6.5° ≒ 1110 mm/s²）。少しだけ速めにしてある */
export const GRAVITY = 1180;

/** 玉が台から落ちたとみなす高さ */
export const DRAIN_Y = 985;

/** 壁の材質。はね返り方と、当たったときの音が変わる */
export type Material = "metal" | "plastic" | "rubber" | "post";

export type WallDef = {
  /** 折れ線の頂点 */
  pts: readonly Pt[];
  r: number;
  mat: Material;
  /** 閉じた図形（スリングショットの三角など） */
  closed?: boolean;
  /**
   * 片側からだけ当たる壁（一方通行のワイヤーゲート）。玉の中心がこの円の内がわにあるときだけ当たる。
   * オービットのガイドは、上から降りてきた玉はインレーンへ導き、キックバックで下から上がる玉は通す
   */
  onlyInside?: { x: number; y: number; r: number };
  /** 描画の種類。物理には関係しない */
  look?: "frame" | "guide" | "rail" | "inlane" | "sling" | "lane" | "scoop" | "ramp-mouth" | "shooter";
};

export type CircleDef = { x: number; y: number; r: number; mat: Material; look: "post" | "lane-post" };

export type BumperDef = { x: number; y: number; r: number };

export type SlingDef = {
  side: "left" | "right";
  /** 三角形の頂点（上・下・内側の下） */
  a: Pt;
  b: Pt;
  c: Pt;
};

export type FlipperDef = {
  side: "left" | "right";
  pivot: Pt;
  /** 支点から先端の円の中心まで */
  len: number;
  /** 支点側の太さ（半径） */
  r0: number;
  /** 先端の太さ（半径） */
  r1: number;
  /** 下がっているときの角度（ラジアン。0 が右向き、y が下なので正が下向き） */
  rest: number;
  /** 上がりきったときの角度 */
  up: number;
};

/** 線の上を玉が通ったことを知るためのセンサー */
export type SensorId =
  | "lane0" | "lane1" | "lane2" | "lane3"
  | "spinner"
  | "orbitLeftMouth" | "orbitRightMouth" | "orbitTop"
  | "inlaneLeft" | "inlaneRight" | "outlaneLeft" | "outlaneRight"
  | "kickbackLeft" | "kickbackRight"
  | "shooterExit";

export type SensorDef = { id: SensorId; a: Pt; b: Pt };

export type RampId = "left" | "right";

export type RampDef = {
  id: RampId;
  /** 入口の線（下から上へ横切るとランプに乗る） */
  mouthA: Pt;
  mouthB: Pt;
  /** ランプの道（入口 → のぼり → 頂上 → ワイヤーで降りて インレーンへ） */
  path: readonly Pt[];
  /** のぼり坂が終わる位置（path の何番目の点か） */
  ascentEnd: number;
  /** 頂上（平ら）が終わる位置 */
  topEnd: number;
  /** 降りたところの向き */
  exitDir: Pt;
};

export type DropTargetDef = { a: Pt; b: Pt };

export type ShotId = "leftOrbit" | "leftRamp" | "scoop" | "rightRamp" | "rightOrbit";
export const SHOT_IDS: readonly ShotId[] = ["leftOrbit", "leftRamp", "scoop", "rightRamp", "rightOrbit"];

export type ShotDef = {
  id: ShotId;
  name: string;
  /** アイテムを浮かべる位置 */
  icon: Pt;
  /** 床の矢印ランプ（向きはラジアン） */
  arrow: Pt & { angle: number };
};

/**
 * ご当地アイテムが浮かぶ場所。玉の中心が r 以内を通ると取れる。
 * tier 0 はよく玉が通るところ、2 はランプやオービットの入口など狙わないと届かないところ。
 */
export type ItemSpot = { x: number; y: number; tier: 0 | 1 | 2 };
export const ITEM_PICKUP_R = 26;

export type TableGeometry = {
  walls: readonly WallDef[];
  circles: readonly CircleDef[];
  bumpers: readonly BumperDef[];
  slings: readonly SlingDef[];
  flippers: readonly [FlipperDef, FlipperDef];
  sensors: readonly SensorDef[];
  ramps: readonly [RampDef, RampDef];
  drops: readonly DropTargetDef[];
  /** ガチャ穴（キックアウトホール）。玉の中心がここに入ると吸いこむ */
  scoop: Pt & { r: number; ejectFrom: Pt };
  /** 打ち出しレーンで玉がのる位置 */
  plungerRest: Pt;
  /** 打ち出しレーンの出口の一方通行ゲート（上へは通れて、上からは通れない） */
  shooterGate: { a: Pt; b: Pt; allow: Pt };
  /** アウトレーンを閉じるスキル用の扉（ふだんは無い） */
  outlaneGates: readonly [{ a: Pt; b: Pt }, { a: Pt; b: Pt }];
  /** 上のレーン「お・で・か・け」の中心 x */
  laneX: readonly [number, number, number, number];
  laneY: number;
  shots: readonly ShotDef[];
  itemSpots: readonly ItemSpot[];
  /** 県の形を描くところ（台のまんなか下） */
  artBox: { x: number; y: number; w: number; h: number };
};

/* ---------- 作図の道具 ---------- */

/** 円弧（a0 → a1、ラジアン。y が下向きなので角度は時計回り） */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number, steps: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = a0 + ((a1 - a0) * i) / steps;
    out.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) });
  }
  return out;
}

/** なめらかな曲線（2次ベジェ） */
function quad(p0: Pt, c: Pt, p1: Pt, steps: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const u = 1 - t;
    out.push({ x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y });
  }
  return out;
}

const p = (x: number, y: number): Pt => ({ x, y });
/** 台のまんなか（打ち出しレーンをのぞいた部分の中心）。左右対称のものはここで折り返す */
const CX = 240;
const mirror = (pt: Pt): Pt => ({ x: CX * 2 - pt.x, y: pt.y });
const DEG = Math.PI / 180;

/* ---------- 台の形 ---------- */

function buildTable(): TableGeometry {
  const walls: WallDef[] = [];
  const circles: CircleDef[] = [];

  // 外わく：左の壁 → 上のアーチ → 右の壁（打ち出しレーンの外側）
  const ARCH_C = p(261, 261);
  const ARCH_R = 266;
  walls.push({
    pts: [p(-5, 1012), p(-5, 261), ...arc(ARCH_C.x, ARCH_C.y, ARCH_R, Math.PI, Math.PI * 2, 56).slice(1), p(527, 1012)],
    r: 5,
    mat: "metal",
    look: "frame",
  });

  // 打ち出しレーンの内がわの壁（下から y=300 まで）
  walls.push({ pts: [p(483, 1012), p(483, 300)], r: 3, mat: "metal", look: "shooter" });

  // 左右のオービット（外周の通り道）の内がわの壁
  walls.push({ pts: [p(48, 330), p(48, 498)], r: 3, mat: "metal", look: "rail" });
  walls.push({ pts: [mirror(p(48, 330)), mirror(p(48, 498))], r: 3, mat: "metal", look: "rail" });

  // オービットから降りてきた玉をインレーンへ送るガイド。外の壁から内がわへ曲がり、インレーンの真上で終わる。
  // アウトレーンの入口は、このガイドの下（ガイドの先とポストのすき間）になるので、
  // 外の壁ぞいに降りてきた玉はアウトレーンに入らない（本物の台と同じつくり）
  // ガイドの面（中心線から r=3 外）を外の壁の面（x=0）にぴったりそろえる。段差があると玉がそこで跳ねる
  const orbitGuideL = arc(191, 560, 194, Math.PI, Math.PI - 42.1 * DEG, 14);
  walls.push({ pts: orbitGuideL, r: 3, mat: "metal", look: "guide", onlyInside: { x: 191, y: 560, r: 194 } });
  walls.push({ pts: orbitGuideL.map(mirror), r: 3, mat: "metal", look: "guide", onlyInside: { ...mirror(p(191, 560)), r: 194 } });

  // 上のレーン「お・で・か・け」の仕切り
  const laneGuideX = [128, 184, 240, 296, 352];
  for (const x of laneGuideX) {
    walls.push({ pts: [p(x, 106), p(x, 160)], r: 4, mat: "metal", look: "lane" });
    circles.push({ x, y: 106, r: 5, mat: "metal", look: "lane-post" });
  }

  // ガチャ穴をかこむU字の壁（下はドロップターゲットでふさがっている）
  const SCOOP_C = p(240, 456);
  walls.push({
    pts: [p(207, 549), p(207, SCOOP_C.y), ...arc(SCOOP_C.x, SCOOP_C.y, 33, Math.PI, Math.PI * 2, 18).slice(1), p(273, 549)],
    r: 3,
    mat: "metal",
    look: "scoop",
  });

  // ランプの入口（下だけ開いた箱。上へ横切った玉はランプに乗る）
  const rampBoxL = [p(98, 614), p(98, 548), p(150, 548), p(150, 614)];
  walls.push({ pts: rampBoxL, r: 3, mat: "plastic", look: "ramp-mouth" });
  walls.push({ pts: rampBoxL.map(mirror), r: 3, mat: "plastic", look: "ramp-mouth" });

  // インレーンとアウトレーンの仕切り（上の玉はゴムのポスト）と、フリッパーへ導くガイド。
  // ガイドの終わりは、下がっているフリッパーの上の面（根元が太いので約34°）をそのまま延ばした線にのせる
  // （少しでも段差があると、玉が根元に当たって跳ねてしまう）
  const inlaneL = [p(44, 736), p(44, 770.4), ...arc(94, 770.4, 50, Math.PI, Math.PI - 55.7 * DEG, 10).slice(1), p(140, 862.3)];
  walls.push({ pts: inlaneL, r: 3, mat: "metal", look: "inlane" });
  walls.push({ pts: inlaneL.map(mirror), r: 3, mat: "metal", look: "inlane" });
  circles.push({ x: 44, y: 734, r: 6, mat: "post", look: "post" });
  circles.push({ ...mirror(p(44, 734)), r: 6, mat: "post", look: "post" });

  // スリングショット（ゴムの面に当たると、はじき返す）
  // 上の角は少し外へ寄せて、インレーンの入口をじょうご形にしてある（オービットから来た玉が角に当たらない）
  const slingL: SlingDef = { side: "left", a: p(96, 700), b: p(86, 780), c: p(130, 812) };
  const slingR: SlingDef = { side: "right", a: mirror(slingL.a), b: mirror(slingL.b), c: mirror(slingL.c) };
  for (const s of [slingL, slingR]) {
    // ゴムの面（a→c）は物理側でスリングとして扱う。ここでは残りの2辺だけ壁にする
    walls.push({ pts: [s.a, s.b, s.c], r: 3, mat: "plastic", look: "sling" });
    for (const v of [s.a, s.b, s.c]) circles.push({ x: v.x, y: v.y, r: 5, mat: "post", look: "post" });
  }

  // アウトレーンの下（ドレインへ落ちる通り道の外がわ）
  walls.push({ pts: [p(0, 900), p(0, 1012)], r: 2, mat: "metal", look: "guide" });

  const bumpers: BumperDef[] = [
    { x: 182, y: 248, r: 28 },
    { x: 298, y: 248, r: 28 },
    { x: 240, y: 334, r: 28 },
  ];

  // フリッパー：支点の間 180mm、下がっているときの先端のすき間 約40mm（ここが真ん中のドレイン）
  const FL_LEN = 78;
  const flipperL: FlipperDef = { side: "left", pivot: p(150, 880), len: FL_LEN, r0: 12, r1: 6.5, rest: 30 * DEG, up: -30 * DEG };
  const flipperR: FlipperDef = { side: "right", pivot: mirror(flipperL.pivot), len: FL_LEN, r0: 12, r1: 6.5, rest: Math.PI - 30 * DEG, up: Math.PI + 30 * DEG };

  const laneY = 136;
  const sensors: SensorDef[] = [
    ...[0, 1, 2, 3].map((i) => ({
      id: `lane${i}` as SensorId,
      a: p(laneGuideX[i]! + 4, laneY),
      b: p(laneGuideX[i + 1]! - 4, laneY),
    })),
    { id: "spinner", a: p(1, 400), b: p(45, 400) },
    { id: "orbitLeftMouth", a: p(1, 470), b: p(45, 470) },
    { id: "orbitRightMouth", a: mirror(p(45, 470)), b: mirror(p(1, 470)) },
    // アーチのてっぺん（ここを横切ったらオービットを1周した）
    { id: "orbitTop", a: p(261, -2), b: p(261, 70) },
    { id: "inlaneLeft", a: p(47, 790), b: p(83, 790) },
    { id: "inlaneRight", a: mirror(p(83, 790)), b: mirror(p(47, 790)) },
    { id: "outlaneLeft", a: p(1, 790), b: p(41, 790) },
    { id: "outlaneRight", a: mirror(p(41, 790)), b: mirror(p(1, 790)) },
    { id: "kickbackLeft", a: p(1, 872), b: p(41, 872) },
    { id: "kickbackRight", a: mirror(p(41, 872)), b: mirror(p(1, 872)) },
    { id: "shooterExit", a: p(486, 330), b: p(522, 330) },
  ];

  // ランプ：右フリッパーから左ランプ、左フリッパーから右ランプを狙う。降りた玉は同じ側のインレーンへ
  const rampPathL: Pt[] = [
    p(124, 600),
    p(124, 414),
    ...arc(82, 414, 42, 0, -Math.PI, 16).slice(1),
    p(40, 610),
    ...quad(p(40, 610), p(40, 700), p(64, 756), 8).slice(1),
  ];
  const ascentEndL = 1;
  const topEndL = 1 + 16;
  const rampL: RampDef = {
    id: "left",
    mouthA: p(101, 590),
    mouthB: p(147, 590),
    path: rampPathL,
    ascentEnd: ascentEndL,
    topEnd: topEndL,
    exitDir: p(0.28, 0.96),
  };
  const rampR: RampDef = {
    id: "right",
    mouthA: mirror(rampL.mouthB),
    mouthB: mirror(rampL.mouthA),
    path: rampPathL.map(mirror),
    ascentEnd: ascentEndL,
    topEnd: topEndL,
    exitDir: p(-0.28, 0.96),
  };

  const drops: DropTargetDef[] = [
    { a: p(211, 545), b: p(229, 545) },
    { a: p(231, 545), b: p(249, 545) },
    { a: p(251, 545), b: p(269, 545) },
  ];

  const shots: ShotDef[] = [
    { id: "leftOrbit", name: "左オービット", icon: p(30, 600), arrow: { x: 52, y: 650, angle: -112 * DEG } },
    { id: "leftRamp", name: "左ランプ", icon: p(124, 660), arrow: { x: 124, y: 706, angle: -90 * DEG } },
    { id: "scoop", name: "ガチャ穴", icon: p(240, 596), arrow: { x: 240, y: 640, angle: -90 * DEG } },
    { id: "rightRamp", name: "右ランプ", icon: p(356, 660), arrow: { x: 356, y: 706, angle: -90 * DEG } },
    { id: "rightOrbit", name: "右オービット", icon: p(450, 600), arrow: { x: 428, y: 650, angle: -68 * DEG } },
  ];

  const itemSpots: ItemSpot[] = [
    // バンパーのまわり（玉がよく来る）
    { x: 128, y: 300, tier: 0 },
    { x: 352, y: 300, tier: 0 },
    { x: 240, y: 192, tier: 0 },
    // 通路・ガチャ穴の前
    { x: 178, y: 470, tier: 1 },
    { x: 302, y: 470, tier: 1 },
    { x: 240, y: 612, tier: 1 },
    // ランプ・オービットの入口
    { x: 124, y: 646, tier: 2 },
    { x: 356, y: 646, tier: 2 },
    { x: 24, y: 520, tier: 2 },
    { x: 456, y: 520, tier: 2 },
  ];

  return {
    walls,
    circles,
    bumpers,
    slings: [slingL, slingR],
    flippers: [flipperL, flipperR],
    sensors,
    ramps: [rampL, rampR],
    drops,
    scoop: { x: 240, y: 464, r: 14, ejectFrom: p(240, 488) },
    plungerRest: p(504, 938),
    shooterGate: { a: p(522, 266), b: p(484, 302), allow: p(0, -1) },
    outlaneGates: [
      { a: p(1, 724), b: p(39, 738) },
      { a: mirror(p(39, 738)), b: mirror(p(1, 724)) },
    ],
    laneX: [156, 212, 268, 324],
    laneY,
    shots,
    itemSpots,
    artBox: { x: 150, y: 620, w: 180, h: 190 },
  };
}

export const TABLE: TableGeometry = buildTable();
