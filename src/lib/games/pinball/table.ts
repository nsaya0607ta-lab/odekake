/**
 * ご当地ピンボールの台の形
 * =============================================================
 * 単位はミリメートル。x は右、y は下（手前）が正。台の大きさ・玉の大きさ・フリッパーの長さは
 * 本物のピンボール台（約52×107cm・玉の直径27mm・フリッパー約7.5cm）に近い比率にしてある。
 *
 * 台（マップ）は何種類かある（maps.ts）。どのマップも「骨組み」は同じ：外わく・打ち出しレーン・上のレーン・
 * オービット・ランプの入口・ガチャ穴とドロップターゲット・スリングショット・インレーン／アウトレーン・フリッパー。
 * マップごとに変わるのは、上半分の部品（バンパー・かざぐるま・ポスト・スタンドアップターゲットの位置など）と、
 * アイテムが浮かぶ場所・ランプの道（MapSpec）。骨組みが同じなので、ショットの狙い方とルールはどのマップでも同じ。
 *
 * 壁は「中心線＋太さ（r）」で持つ。玉は中心線から r + BALL_R の距離でぶつかる。
 * 物理（physics.ts）と描画（components/games/pinball/render.ts）は、どちらもゲームが持つ台（world.table）だけを見る。
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
  /** 描画の種類。物理には関係しない（rubber＝2本のポストに張ったゴム、block＝プラスチックのブロック。どちらも自分で作るステージの部品） */
  look?: "frame" | "guide" | "rail" | "inlane" | "sling" | "lane" | "scoop" | "ramp-mouth" | "ramp-roof" | "shooter" | "standup-back" | "rubber" | "block";
};

/** ポスト。look は描き方：post＝ゴムの輪のポスト、lane-post＝上のレーンのしきりの頭、peg＝めっきのくぎ */
export type CircleDef = { x: number; y: number; r: number; mat: Material; look: "post" | "lane-post" | "peg" };

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
  /**
   * 降りるときの向きのばらつき（ラジアン。この幅で左右にずれ、速さも少しばらつく）。インレーンへ戻らずに台の上へ
   * 落とすランプにつける（いつも同じ所に落ちると、その先の玉の行き先まで毎回ほとんど同じになってしまう）
   */
  exitSpread?: number;
};

export type DropTargetDef = { a: Pt; b: Pt };

/**
 * スピナー（自分で作るステージの部品）：横向きの板。玉は当たらずに下をくぐりぬけ、くぐった速さだけ板が回って点が入る。
 * (x, y) が板のまん中、w が板の幅（mm）
 */
export type SpinnerDef = { x: number; y: number; w: number };

/**
 * スタンドアップターゲット（立っている的）。倒れずに、当たると光る。face は前の面の向き（玉が来る側）で、
 * 後ろや横から当たっても数えない。3つで1組（左右に1組ずつ）
 */
export type StandupDef = { a: Pt; b: Pt; face: Pt };
export type StandupBankDef = { side: "left" | "right"; center: Pt; targets: readonly [StandupDef, StandupDef, StandupDef] };

/** かざぐるま：いつもゆっくり回っている羽根。当たると回る速さが変わる（羽根は arms 本、中心から len、太さ r） */
export type PinwheelDef = { x: number; y: number; arms: number; len: number; r: number; hubR: number; omega: number };

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
 * shot は、そのショットを打てば通る場所（シミュレーターのボットが狙うのに使う。無いところはどこからでも）
 */
export type ItemSpot = { x: number; y: number; tier: 0 | 1 | 2; shot?: ShotId };
export const ITEM_PICKUP_R = 26;

export type TableGeometry = {
  /** マップの id（maps.ts） */
  id: string;
  walls: readonly WallDef[];
  circles: readonly CircleDef[];
  bumpers: readonly BumperDef[];
  slings: readonly SlingDef[];
  flippers: readonly [FlipperDef, FlipperDef];
  sensors: readonly SensorDef[];
  ramps: readonly RampDef[];
  drops: readonly DropTargetDef[];
  standups: readonly StandupBankDef[];
  /** かざぐるま（マップによって 0〜いくつか） */
  pinwheels: readonly PinwheelDef[];
  /** スピナー（自分で作るステージの部品。オービットのスピナーはセンサーの "spinner"） */
  spinners: readonly SpinnerDef[];
  /**
   * 自分で作るステージのドロップターゲット（1つずつ置く）。ガチャ穴の前の drops とは別で、全部たおすとボーナスが入って立ちなおる
   */
  stageDrops: readonly DropTargetDef[];
  /** バンパーがはじく強さの倍率（1 がふつう） */
  bumperKick: number;
  /** ガチャ穴（キックアウトホール）。玉の中心がここに入ると吸いこむ */
  scoop: Pt & { r: number; ejectFrom: Pt };
  /** 打ち出しレーンで玉がのる位置 */
  plungerRest: Pt;
  /** 打ち出しレーンの出口の一方通行ゲート（上へは通れて、上からは通れない） */
  shooterGate: { a: Pt; b: Pt; allow: Pt };
  /** アウトレーンを閉じるスキル用の扉（ふだんは無い） */
  outlaneGates: readonly [{ a: Pt; b: Pt }, { a: Pt; b: Pt }];
  /** 上のレーン「お・で・か・け」の中心 x */
  laneX: readonly number[];
  laneY: number;
  shots: readonly ShotDef[];
  itemSpots: readonly ItemSpot[];
  /** 県の形を描くところ（台のまんなか下） */
  artBox: { x: number; y: number; w: number; h: number };
  /** 白紙から作る台。固定の仕掛けは置かない */
  freeform?: boolean;
};

/** ランプの道（入口から出口まで）。入口の位置（ふつうのランプと同じところ）から始めること */
export type RampShapeSpec = { path: readonly Pt[]; ascentEnd: number; topEnd: number; exitDir: Pt; exitSpread?: number };

/**
 * マップごとに変わるところ（maps.ts で決める）。ここに無いもの（骨組み）は、どのマップでも同じ。
 * 右がわの部品は書かない（左右対称のものは、左だけ書いて折り返す。そうでないものは両方書く）
 */
export type MapSpec = {
  id: string;
  /** 外枠・打ち出し口・フリッパー以外は、自分で置いたものだけ */
  bare?: boolean;
  bumpers: readonly BumperDef[];
  pinwheels: readonly PinwheelDef[];
  /** 左のスタンドアップターゲットの組の中心（右の組は折り返し） */
  standupCenter: Pt;
  /** 足すポスト（ゴムのポスト・くぎ） */
  posts?: readonly CircleDef[];
  /** 足す壁 */
  walls?: readonly WallDef[];
  /** 足すスリングショット（上のほうにある小さなもの。はじく面は a→c） */
  slings?: readonly SlingDef[];
  /** スピナー（自分で作るステージ） */
  spinners?: readonly SpinnerDef[];
  /** ドロップターゲット（自分で作るステージ） */
  stageDrops?: readonly DropTargetDef[];
  itemSpots: readonly ItemSpot[];
  /** 左のランプの道（右はその折り返し）。無ければ、のぼって同じがわのインレーンへ戻るふつうのランプ */
  ramp?: RampShapeSpec;
  /** 右のランプの道を左と変えるとき（書くのは右のランプの道そのもの。無ければ左の折り返し） */
  rampRight?: RampShapeSpec;
  /** バンパーがはじく強さの倍率（無ければ 1） */
  bumperKick?: number;
  /**
   * ガチャ穴のかこいの上をあける幅（両はしの壁の中心の間、mm）。あけると、上から落ちてきた玉もガチャ穴に入る
   * （パチンコのまん中の入賞口のように）。無ければ、とがったアーチでふさぐ
   */
  scoopTopOpening?: number;
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
export function quad(p0: Pt, c: Pt, p1: Pt, steps: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const u = 1 - t;
    out.push({ x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y });
  }
  return out;
}

export const p = (x: number, y: number): Pt => ({ x, y });
/** 台のまんなか（打ち出しレーンをのぞいた部分の中心）。左右対称のものはここで折り返す */
export const CX = 240;
export const mirror = (pt: Pt): Pt => ({ x: CX * 2 - pt.x, y: pt.y });
export const DEG = Math.PI / 180;

/* ---------- 台の形 ---------- */

/** ふつうのランプ：入口からまっすぐのぼり、頂上で外がわへ曲がって、ワイヤーで同じがわのインレーンへ降りる */
export const STANDARD_RAMP: RampShapeSpec = {
  path: [
    p(124, 600),
    p(124, 414),
    ...arc(82, 414, 42, 0, -Math.PI, 16).slice(1),
    p(40, 610),
    ...quad(p(40, 610), p(40, 700), p(64, 756), 8).slice(1),
  ],
  ascentEnd: 1,
  topEnd: 1 + 16,
  exitDir: p(0.28, 0.96),
};

/** マップの形を組み立てる（骨組み＋マップごとの部品）。壁とポストの順番は当たり判定の順番になるので、変えると結果が少し変わる */
export function buildTable(spec: MapSpec): TableGeometry {
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

  // ガチャ穴をかこむU字の壁（下はドロップターゲットでふさがっている）。上は少しとがったアーチにして、
  // てっぺんに玉が乗って止まらないようにする（まるい頭だと、まん中にぴったり落ちた玉がしばらく止まる）
  const SCOOP_Y = 456;
  // 左半分は中心 (246, 456)・半径39 の円弧で、x=240 のてっぺんまで。右半分はその折り返し
  const archL = arc(246, SCOOP_Y, 39, Math.PI, Math.PI + Math.acos(6 / 39), 10);
  if (spec.scoopTopOpening) {
    // 上をあけるマップ：アーチを、まん中から opening/2 のところで切る（左右2本の壁になる）
    const endX = CX - spec.scoopTopOpening / 2;
    const cut = Math.PI + Math.acos((246 - endX) / 39);
    const sideL = [p(207, 549), p(207, SCOOP_Y), ...arc(246, SCOOP_Y, 39, Math.PI, cut, 8).slice(1)];
    walls.push({ pts: sideL, r: 3, mat: "metal", look: "scoop" });
    walls.push({ pts: sideL.map(mirror), r: 3, mat: "metal", look: "scoop" });
  } else {
    walls.push({
      pts: [p(207, 549), p(207, SCOOP_Y), ...archL.slice(1), ...archL.slice(0, -1).reverse().map(mirror), p(273, 549)],
      r: 3,
      mat: "metal",
      look: "scoop",
    });
  }

  // ランプの入口（下だけ開いた箱。上へ横切った玉はランプに乗る）。
  // 箱の上（ランプの下にもぐった玉が上から落ちてくるところ）は山形の屋根にして、玉が乗って止まらないようにする
  const rampBoxL = [p(98, 614), p(98, 576)];
  const rampRoofL = [p(98, 576), p(98, 552), p(124, 534), p(150, 552), p(150, 576)];
  walls.push({ pts: rampBoxL, r: 3, mat: "plastic", look: "ramp-mouth" });
  walls.push({ pts: [p(150, 576), p(150, 614)], r: 3, mat: "plastic", look: "ramp-mouth" });
  walls.push({ pts: rampRoofL, r: 3, mat: "metal", look: "ramp-roof" });
  walls.push({ pts: rampBoxL.map(mirror), r: 3, mat: "plastic", look: "ramp-mouth" });
  walls.push({ pts: [mirror(p(150, 576)), mirror(p(150, 614))], r: 3, mat: "plastic", look: "ramp-mouth" });
  walls.push({ pts: rampRoofL.map(mirror), r: 3, mat: "metal", look: "ramp-roof" });

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

  const bumpers: BumperDef[] = spec.bumpers.map((b) => ({ ...b }));

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

  // ランプ：右フリッパーから左ランプ、左フリッパーから右ランプを狙う。入口（ここから下）はどのマップも同じ
  const rampSpec = spec.ramp ?? STANDARD_RAMP;
  const rampL: RampDef = {
    id: "left",
    mouthA: p(101, 590),
    mouthB: p(147, 590),
    path: rampSpec.path,
    ascentEnd: rampSpec.ascentEnd,
    topEnd: rampSpec.topEnd,
    exitDir: rampSpec.exitDir,
    exitSpread: rampSpec.exitSpread,
  };
  const rightSpec = spec.rampRight;
  const rampR: RampDef = {
    id: "right",
    mouthA: mirror(rampL.mouthB),
    mouthB: mirror(rampL.mouthA),
    path: rightSpec ? rightSpec.path : rampSpec.path.map(mirror),
    ascentEnd: (rightSpec ?? rampSpec).ascentEnd,
    topEnd: (rightSpec ?? rampSpec).topEnd,
    exitDir: rightSpec ? rightSpec.exitDir : p(-rampSpec.exitDir.x, rampSpec.exitDir.y),
    exitSpread: (rightSpec ?? rampSpec).exitSpread,
  };

  // スタンドアップターゲット：上の左右のすみ。反対がわのフリッパーから、ガチャ穴の横の通り道とランプの下を
  // ぬけた玉が当たる向き（face）に立てる。後ろ（アーチがわ）は両はしの丸い1本の台でふさぐ
  // （ポストを別に置くと、つなぎ目のくぼみに玉が乗る）。後ろの面は 15°ほど傾いているので、
  // 上から落ちてきた玉は乗らずに転がり落ちる
  const STANDUP_FACE = { x: 0.254, y: 0.967 };
  const STANDUP_ALONG = { x: STANDUP_FACE.y, y: -STANDUP_FACE.x };
  const makeBank = (side: "left" | "right", center: Pt): StandupBankDef => {
    const flip = (pt: Pt): Pt => (side === "left" ? pt : mirror(pt));
    const at = (k: number, off = 0): Pt => ({ x: center.x + STANDUP_ALONG.x * k + STANDUP_FACE.x * off, y: center.y + STANDUP_ALONG.y * k + STANDUP_FACE.y * off });
    const face = side === "left" ? STANDUP_FACE : { x: -STANDUP_FACE.x, y: STANDUP_FACE.y };
    const target = (k: number): StandupDef => ({ a: flip(at(k - 8)), b: flip(at(k + 8)), face });
    walls.push({ pts: [flip(at(-31, -2.5)), flip(at(31, -2.5))], r: 4.5, mat: "plastic", look: "standup-back" });
    return { side, center: flip(center), targets: [target(-19), target(0), target(19)] };
  };
  const standups: [StandupBankDef, StandupBankDef] = [makeBank("left", spec.standupCenter), makeBank("right", spec.standupCenter)];

  // マップごとに足す部品（壁・ポスト・小さなスリングショット）。骨組みのあとに足す
  for (const w of spec.walls ?? []) walls.push(w);
  for (const c of spec.posts ?? []) circles.push(c);
  const extraSlings = spec.slings ?? [];
  for (const s of extraSlings) {
    walls.push({ pts: [s.a, s.b, s.c], r: 3, mat: "plastic", look: "sling" });
    for (const v of [s.a, s.b, s.c]) circles.push({ x: v.x, y: v.y, r: 5, mat: "post", look: "post" });
  }

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

  const table: TableGeometry = {
    id: spec.id,
    walls,
    circles,
    bumpers,
    slings: [slingL, slingR, ...extraSlings],
    flippers: [flipperL, flipperR],
    sensors,
    ramps: [rampL, rampR],
    drops,
    standups,
    pinwheels: spec.pinwheels.map((pw) => ({ ...pw })),
    spinners: (spec.spinners ?? []).map((sp) => ({ ...sp })),
    stageDrops: (spec.stageDrops ?? []).map((d) => ({ a: { ...d.a }, b: { ...d.b } })),
    bumperKick: spec.bumperKick ?? 1,
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
    itemSpots: spec.itemSpots.map((spot) => ({ ...spot })),
    artBox: { x: 150, y: 620, w: 180, h: 190 },
  };
  if (!spec.bare) return table;
  const hasRamps = spec.ramp !== undefined;
  return {
    ...table,
    freeform: true,
    walls: [
      walls[0]!, walls[1]!,
      ...(hasRamps ? walls.filter((w) => w.look === "ramp-mouth" || w.look === "ramp-roof") : []),
      ...(spec.walls ?? []),
      ...extraSlings.map((s): WallDef => ({ pts: [s.a, s.b, s.c], r: 3, mat: "plastic", look: "sling" })),
    ],
    circles: [
      ...(spec.posts ?? []),
      ...extraSlings.flatMap((s) => [s.a, s.b, s.c].map((v): CircleDef => ({ ...v, r: 5, mat: "post", look: "post" }))),
    ],
    slings: [...extraSlings],
    ramps: hasRamps ? table.ramps : [],
    sensors: table.sensors.filter((s) => s.id === "shooterExit"),
    drops: [],
    standups: [],
    scoop: { ...table.scoop, r: 0 },
    laneX: [],
    shots: hasRamps ? shots.filter((s) => s.id === "leftRamp" || s.id === "rightRamp") : [],
  };
}
