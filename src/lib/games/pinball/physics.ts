/**
 * ご当地ピンボールの物理
 * =============================================================
 * 1ステップ = 台の上の時間で 1ms。画面の更新（60fps）ごとに十数ステップまとめて進める。
 * 玉は回転を持たない点として扱い、壁・ポスト・フリッパーとの当たりは「中心線からの距離」で判定する。
 * フリッパーは根元が太く先が細い形（2つの円とその接線）のまま当たりを取り、
 * 当たった場所の速さ（角速度 × 支点からの距離）を玉に渡すので、根元・先端で打球が変わる。
 *
 * ゲームのルール（得点・スキル・モード）はここには置かず、events に起きたことを積むだけにする。
 * ブラウザでもシミュレーション（scripts/simulate-pinball.mjs）でも同じコードが動く。
 */
import {
  BALL_R,
  DRAIN_Y,
  GRAVITY,
  TABLE_H,
  TABLE_W,
  type FlipperDef,
  type Material,
  type Pt,
  type RampDef,
  type RampId,
  type SensorId,
  type TableGeometry,
} from "./table";

/** 1ステップの長さ（秒） */
export const STEP = 1 / 1000;
const MAX_SPEED = 7000;

/* ---------- 材質 ---------- */

type MatSpec = { e: number; eFall: number; mu: number };
const MATS: Record<Material | "flipper" | "flipperSwing" | "drop" | "bumper" | "standup" | "pinwheel", MatSpec> = {
  // e：はね返り（遅い当たり）、eFall：速い当たりでどれだけ下がるか（3m/sで）、mu：こすれ
  metal: { e: 0.34, eFall: 0.06, mu: 0.02 },
  plastic: { e: 0.32, eFall: 0.06, mu: 0.04 },
  rubber: { e: 0.8, eFall: 0.24, mu: 0.15 },
  post: { e: 0.72, eFall: 0.2, mu: 0.12 },
  flipper: { e: 0.58, eFall: 0.22, mu: 0.12 },
  flipperSwing: { e: 0.12, eFall: 0, mu: 0.06 },
  drop: { e: 0.22, eFall: 0, mu: 0.05 },
  bumper: { e: 0.7, eFall: 0.2, mu: 0.1 },
  standup: { e: 0.42, eFall: 0.12, mu: 0.06 },
  pinwheel: { e: 0.5, eFall: 0.16, mu: 0.1 },
};
/** これより遅い当たりは、はね返さない（坂で止まっている玉がふるえないように） */
const REST_SPEED = 70;

function restitution(spec: MatSpec, impact: number): number {
  if (impact < REST_SPEED) return 0;
  return spec.e - spec.eFall * Math.min(1, impact / 3000);
}

/* ---------- 力のつよさ ---------- */

/** フリッパー：上がるときの角加速度・最高角速度、戻るときの角加速度・最高角速度（rad/s², rad/s） */
export const FLIPPER = { accel: 2600, omegaMax: 36, returnAccel: 1500, returnOmegaMax: 22 };
/** ポップバンパーがはじく速さ（mm/s）。当たった勢いの一部も足す */
const BUMPER_KICK = { base: 1750, gain: 0.22, max: 3100, cooldown: 0.08 };
/** スリングショット */
const SLING_KICK = { base: 1450, gain: 0.25, max: 2700, threshold: 260, cooldown: 0.1 };
/** ドロップターゲットが倒れる当たりの強さ */
const DROP_THRESHOLD = 110;
/** スタンドアップターゲットが光る当たりの強さ（前の面に、これより速く当たったとき） */
const STANDUP_THRESHOLD = 120;
/**
 * スキル「ふさぐ」の光の扉：乗った玉を上へはね上げる速さ（mm/s）。オービットの通り道を少しのぼって、
 * 同じがわのガイドからインレーンへ戻ってくる強さ（扉の上で止まったままにしない）
 */
const GATE_KICK_SPEED = 950;
/** かざぐるま：当たった玉が羽根をどれだけ回すか・回る速さの上限・ふだんの速さへ戻る時間（秒） */
const PINWHEEL = { spin: 0.004, maxOmega: 14, relax: 1.6, cooldown: 0.1 };
/**
 * スキル「マグネット」：ガチャ穴の前（x が x±halfWidth、y が holeY〜zoneBottom）を上っていく玉を、
 * 穴の口のまん中へ寄せる（pull・damp）。かこいの中（mouthY より上）では、穴まで上がりきれるように持ち上げる（lift）
 */
const MAGNET = { x: 240, holeY: 464, mouthY: 549, zoneBottom: 760, halfWidth: 115, inner: 30, pull: 55, damp: 4, maxAx: 5000, lift: 1900 };
/** キックバック（アウトレーンから打ち返す速さ） */
export const KICKBACK_SPEED = 3150;
/**
 * ランプ：のぼり坂の減速・頂上（出口へ向けてゆるい下り）の加速・ワイヤーを降りるときの加速（mm/s²）。
 * 頂上は少しだけ下りにしてあるので、のぼりきった玉は必ず出口まで行く（頂上で止まったままにならない）
 */
const RAMP = { up: 3800, top: 160, down: 1500, exitMax: 1550, topZ: 34 };
/**
 * プランジャー（打ち出し）：引いた量 0〜1 → 打ち出しの速さ（mm/s）。
 * 玉が上のレーン「お・で・か・け」に落ちる速さは 1500〜1610mm/s のせまい幅しかないので、
 * そこ（引いた量 25〜65%）だけゆるやかにして、スキルショットを狙えるようにしている。
 * 65% より強く引くと、アーチを1周して左のオービットから左フリッパーへ降りてくる。
 */
export const PLUNGER_CURVE: readonly (readonly [number, number])[] = [
  [0, 1050],
  [0.25, 1495],
  [0.65, 1615],
  [1, 3750],
];
export function plungerSpeed(power: number): number {
  const p = Math.max(0, Math.min(1, power));
  for (let i = 1; i < PLUNGER_CURVE.length; i += 1) {
    const [p1, v1] = PLUNGER_CURVE[i]!;
    const [p0, v0] = PLUNGER_CURVE[i - 1]!;
    if (p <= p1) return v0 + ((v1 - v0) * (p - p0)) / (p1 - p0);
  }
  return PLUNGER_CURVE[PLUNGER_CURVE.length - 1]![1];
}
/** プランジャーを引いたときに下がる量（mm） */
export const PLUNGER_TRAVEL = 34;

/* ---------- 形を当たり判定用に組み直す ---------- */

type SegKind = "wall" | "sling" | "drop" | "standup" | "gate" | "outlaneGate" | "plunger";
type Seg = {
  ax: number; ay: number; bx: number; by: number;
  ux: number; uy: number; len: number;
  r: number; mat: Material; kind: SegKind;
  /** スリング・ドロップ・アウトレーンの扉の番号 */
  idx: number;
  /** 片側からだけ当たる壁（中心からの距離の2乗がこれより小さい玉だけ当たる） */
  inside: { x: number; y: number; r2: number } | null;
  /** スタンドアップターゲットの前の面の向き */
  face: Pt | null;
};
type Circ = { x: number; y: number; r: number; mat: Material; bumper: number };

/** 当たり判定の下調べ用のマス目（40mm角）。台の外側に少し余白を持たせる */
const GRID = 40;
const GX0 = -40;
const GY0 = -40;
const GW = Math.ceil((TABLE_W + 80) / GRID);
const GH = Math.ceil((TABLE_H + 140) / GRID);

type Collision = { segs: Seg[]; circs: Circ[]; cells: { s: number[]; c: number[] }[] };

function buildCollision(table: TableGeometry): Collision {
  const segs: Seg[] = [];
  const circs: Circ[] = [];
  const addSeg = (a: Pt, b: Pt, r: number, mat: Material, kind: SegKind, idx = -1, inside: Seg["inside"] = null, face: Pt | null = null) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    segs.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, ux: dx / len, uy: dy / len, len, r, mat, kind, idx, inside, face });
  };
  for (const w of table.walls) {
    const pts = w.closed ? [...w.pts, w.pts[0]!] : w.pts;
    const inside = w.onlyInside ? { x: w.onlyInside.x, y: w.onlyInside.y, r2: w.onlyInside.r * w.onlyInside.r } : null;
    for (let i = 0; i + 1 < pts.length; i += 1) addSeg(pts[i]!, pts[i + 1]!, w.r, w.mat, "wall", -1, inside);
  }
  table.slings.forEach((s, i) => addSeg(s.a, s.c, 4, "rubber", "sling", i));
  table.drops.forEach((d, i) => addSeg(d.a, d.b, 3.5, "plastic", "drop", i));
  table.standups.forEach((bank, bi) => bank.targets.forEach((t, ti) => addSeg(t.a, t.b, 2.5, "plastic", "standup", bi * 3 + ti, null, t.face)));
  addSeg(table.shooterGate.a, table.shooterGate.b, 2, "metal", "gate");
  table.outlaneGates.forEach((g, i) => addSeg(g.a, g.b, 3, "metal", "outlaneGate", i));
  // 打ち出しレーンの床（プランジャーの先）。引くと下がる
  const floorY = table.plungerRest.y + BALL_R + 1;
  addSeg({ x: 486, y: floorY }, { x: 522, y: floorY }, 1, "rubber", "plunger");

  for (const c of table.circles) circs.push({ x: c.x, y: c.y, r: c.r, mat: c.mat, bumper: -1 });
  table.bumpers.forEach((b, i) => circs.push({ x: b.x, y: b.y, r: b.r, mat: "rubber", bumper: i }));

  const cells = Array.from({ length: GW * GH }, () => ({ s: [] as number[], c: [] as number[] }));
  const insert = (minx: number, miny: number, maxx: number, maxy: number, push: (cell: { s: number[]; c: number[] }) => void) => {
    const x0 = Math.max(0, Math.floor((minx - GX0) / GRID));
    const x1 = Math.min(GW - 1, Math.floor((maxx - GX0) / GRID));
    const y0 = Math.max(0, Math.floor((miny - GY0) / GRID));
    const y1 = Math.min(GH - 1, Math.floor((maxy - GY0) / GRID));
    for (let gy = y0; gy <= y1; gy += 1) for (let gx = x0; gx <= x1; gx += 1) push(cells[gy * GW + gx]!);
  };
  segs.forEach((s, i) => {
    const pad = s.r + BALL_R + 6;
    // プランジャーの床は下がる範囲もまとめて入れておく
    const extra = s.kind === "plunger" ? PLUNGER_TRAVEL + 4 : 0;
    insert(Math.min(s.ax, s.bx) - pad, Math.min(s.ay, s.by) - pad, Math.max(s.ax, s.bx) + pad, Math.max(s.ay, s.by) + pad + extra, (cell) => cell.s.push(i));
  });
  circs.forEach((c, i) => {
    const pad = c.r + BALL_R + 6;
    insert(c.x - pad, c.y - pad, c.x + pad, c.y + pad, (cell) => cell.c.push(i));
  });
  return { segs, circs, cells };
}

/* ---------- 世界の状態 ---------- */

export type BallMode = "field" | "ramp" | "scoop" | "gone";

export type Ball = {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  /** 1ステップ前の位置（センサーを横切ったかを見る） */
  px: number; py: number;
  mode: BallMode;
  ramp: RampId | null;
  /** ランプの上の道のり（mm）と速さ（mm/s） */
  s: number;
  sv: number;
  /** 見た目の高さ（mm）。ランプの上では大きく描く */
  z: number;
  /** ほとんど動いていない時間（玉づまり対策） */
  still: number;
  /** 最後にフリッパーに触れた時刻 */
  flipperAt: number;
  /** センサーごとの最後に反応した時刻（二重に数えない） */
  sensorAt: Partial<Record<SensorId, number>>;
};

export type FlipperState = {
  def: FlipperDef;
  angle: number;
  omega: number;
  pressed: boolean;
  /** 上がる向き（左は角度が減る -1、右は増える +1） */
  upSign: 1 | -1;
};

export type PhysEvent =
  | { type: "bumper"; index: number; ballId: number; x: number; y: number }
  | { type: "sling"; index: number; ballId: number }
  | { type: "drop"; index: number; ballId: number }
  | { type: "standup"; index: number; ballId: number }
  | { type: "pinwheel"; index: number; ballId: number; speed: number }
  | { type: "gateKick"; index: number; ballId: number }
  | { type: "hit"; mat: Material; speed: number; x: number; y: number }
  | { type: "flipperHit"; index: number; speed: number; ballId: number }
  | { type: "sensor"; id: SensorId; ballId: number; vx: number; vy: number; dir: 1 | -1 }
  | { type: "rampEnter"; id: RampId; ballId: number }
  | { type: "rampTop"; id: RampId; ballId: number }
  | { type: "rampDone"; id: RampId; ballId: number }
  | { type: "rampFail"; id: RampId; ballId: number }
  | { type: "scoop"; ballId: number }
  | { type: "drain"; ballId: number; x: number }
  | { type: "ballBall"; speed: number; x: number; y: number }
  | { type: "stuck"; ballId: number };

export type World = {
  table: TableGeometry;
  col: Collision;
  balls: Ball[];
  flippers: [FlipperState, FlipperState];
  /** ドロップターゲットが立っているか */
  dropsUp: boolean[];
  /** アウトレーンの扉（スキル）が閉まっているか */
  outlaneGate: [boolean, boolean];
  /** スキル「マグネット」：ガチャ穴の前を上っていく玉を、穴へ吸い寄せる */
  magnet: boolean;
  /** プランジャーを引いている量（0〜1） */
  plungerPull: number;
  time: number;
  events: PhysEvent[];
  bumperReadyAt: number[];
  slingReadyAt: number[];
  standupReadyAt: number[];
  gateKickReadyAt: [number, number];
  /** かざぐるまの向き（rad）と回る速さ（rad/s、正が時計まわり）。table.pinwheels と同じ順 */
  pinwheels: { angle: number; omega: number; readyAt: number }[];
  /** 当たり音を鳴らしすぎないように */
  hitSoundAt: number;
  nextBallId: number;
  /** 乱数（シード固定で再現できる） */
  rand: () => number;
};

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 当たり判定の下調べは台ごとに一度だけ作る */
const collisionCache = new WeakMap<TableGeometry, Collision>();

export function createWorld(seed: number, table: TableGeometry): World {
  let col = collisionCache.get(table);
  if (!col) {
    col = buildCollision(table);
    collisionCache.set(table, col);
  }
  const [fl, fr] = table.flippers;
  return {
    table,
    col,
    balls: [],
    flippers: [
      { def: fl, angle: fl.rest, omega: 0, pressed: false, upSign: fl.up < fl.rest ? -1 : 1 },
      { def: fr, angle: fr.rest, omega: 0, pressed: false, upSign: fr.up < fr.rest ? -1 : 1 },
    ],
    dropsUp: table.drops.map(() => true),
    outlaneGate: [false, false],
    magnet: false,
    plungerPull: 0,
    time: 0,
    events: [],
    bumperReadyAt: table.bumpers.map(() => 0),
    slingReadyAt: table.slings.map(() => 0),
    standupReadyAt: table.standups.flatMap((bank) => bank.targets.map(() => 0)),
    gateKickReadyAt: [0, 0],
    pinwheels: table.pinwheels.map((pw) => ({ angle: 0, omega: pw.omega, readyAt: 0 })),
    hitSoundAt: 0,
    nextBallId: 1,
    rand: mulberry32(seed),
  };
}

/** 玉を置く（打ち出しレーンなど） */
export function addBall(world: World, x: number, y: number, vx = 0, vy = 0): Ball {
  const ball: Ball = {
    id: world.nextBallId++,
    x, y, vx, vy, px: x, py: y,
    mode: "field",
    ramp: null, s: 0, sv: 0, z: 0,
    still: 0,
    flipperAt: -1,
    sensorAt: {},
  };
  world.balls.push(ball);
  return ball;
}

export function removeBall(world: World, ball: Ball): void {
  ball.mode = "gone";
  world.balls = world.balls.filter((b) => b !== ball);
}

/** 打ち出しレーンの床の高さ（プランジャーを引くと下がる） */
function plungerFloorY(world: World): number {
  return world.table.plungerRest.y + BALL_R + 1 + world.plungerPull * PLUNGER_TRAVEL;
}

/** 玉が打ち出しレーンの床（プランジャー）にのっているか */
export function isOnPlunger(world: World, ball: Ball): boolean {
  return ball.mode === "field" && ball.x > 486 && ball.y > plungerFloorY(world) - BALL_R - 1 - 30 && Math.abs(ball.vy) < 400;
}

/**
 * プランジャーを離して打ち出す。床にのっている玉だけが飛ぶ。
 * 本物と同じく、同じ強さでも少しだけばらつく。
 */
export function releasePlunger(world: World, power: number): Ball | null {
  world.plungerPull = 0;
  const ball = world.balls.find((b) => isOnPlunger(world, b));
  if (!ball) return null;
  const speed = plungerSpeed(power) * (1 + (world.rand() - 0.5) * 0.006);
  ball.y = Math.min(ball.y, world.table.plungerRest.y);
  ball.vy = -speed;
  ball.vx = 0;
  return ball;
}

/* ---------- フリッパー ---------- */

function updateFlipper(f: FlipperState, dt: number): void {
  const { def, upSign } = f;
  if (f.pressed) {
    f.omega += upSign * FLIPPER.accel * dt;
    if (f.omega * upSign > FLIPPER.omegaMax) f.omega = upSign * FLIPPER.omegaMax;
    f.angle += f.omega * dt;
    if ((f.angle - def.up) * upSign >= 0) {
      f.angle = def.up;
      f.omega = 0;
    }
  } else {
    f.omega -= upSign * FLIPPER.returnAccel * dt;
    if (-f.omega * upSign > FLIPPER.returnOmegaMax) f.omega = -upSign * FLIPPER.returnOmegaMax;
    f.angle += f.omega * dt;
    if ((f.angle - def.rest) * upSign <= 0) {
      f.angle = def.rest;
      f.omega = 0;
    }
  }
}

/** フリッパーの先端の位置 */
export function flipperTip(f: FlipperState): Pt {
  return { x: f.def.pivot.x + f.def.len * Math.cos(f.angle), y: f.def.pivot.y + f.def.len * Math.sin(f.angle) };
}

/**
 * 玉とフリッパー（根元の円・先端の円・その2本の接線でできた形）の当たり。
 * 当たっていれば、押し出しと速さの受け渡しをして、当たりの速さを返す。
 */
function collideFlipper(world: World, ball: Ball, f: FlipperState, index: number): number {
  const { def } = f;
  const ux = Math.cos(f.angle);
  const uy = Math.sin(f.angle);
  const nx = -uy;
  const ny = ux;
  const dx = ball.x - def.pivot.x;
  const dy = ball.y - def.pivot.y;
  const lx = dx * ux + dy * uy;
  const ly = dx * nx + dy * ny;
  // 大まかに遠ければ調べない
  if (lx < -def.r0 - BALL_R - 2 || lx > def.len + def.r1 + BALL_R + 2 || Math.abs(ly) > def.r0 + BALL_R + 2) return 0;
  const sgn = ly >= 0 ? 1 : -1;
  const yy = Math.abs(ly);
  const s = (def.r0 - def.r1) / def.len;
  const c = Math.sqrt(1 - s * s);
  // 接線の向き t = (c, -s)、外向きの法線 m = (s, c)
  const k = (lx - def.r0 * s) * c + (yy - def.r0 * c) * -s;
  let dist: number;
  let mlx: number;
  let mly: number;
  if (k < 0) {
    const d = Math.hypot(lx, yy) || 1e-6;
    dist = d - def.r0;
    mlx = lx / d;
    mly = yy / d;
  } else if (k > def.len * c) {
    const ex = lx - def.len;
    const d = Math.hypot(ex, yy) || 1e-6;
    dist = d - def.r1;
    mlx = ex / d;
    mly = yy / d;
  } else {
    dist = lx * s + yy * c - def.r0;
    mlx = s;
    mly = c;
  }
  const pen = BALL_R - dist;
  if (pen <= 0) return 0;
  // 台の向きに戻す
  const wnx = mlx * ux + sgn * mly * nx;
  const wny = mlx * uy + sgn * mly * ny;
  // 当たった点のフリッパーの速さ（ω × r）
  const cx = ball.x - wnx * BALL_R;
  const cy = ball.y - wny * BALL_R;
  const svx = -f.omega * (cy - def.pivot.y);
  const svy = f.omega * (cx - def.pivot.x);
  // 振り上げている最中は、玉をはじき飛ばさずに「乗せて運ぶ」。玉はフリッパーの上を先端へすべりながら加速し、
  // 離れたところの向きで飛んでいく（先端寄りなら早く離れて反対側へ、根元寄りなら上がりきるまで運ばれて同じ側へ）
  const swinging = f.pressed && f.omega * f.upSign > 2;
  const impact = resolve(ball, wnx, wny, pen, svx, svy, swinging ? MATS.flipperSwing : MATS.flipper);
  ball.flipperAt = world.time;
  if (impact > 250) world.events.push({ type: "flipperHit", index, speed: impact, ballId: ball.id });
  return impact;
}

/* ---------- 当たりの解決 ---------- */

/** 押し出して、はね返す。当たったときの速さ（近づいていた速さ）を返す */
function resolve(ball: Ball, nx: number, ny: number, pen: number, svx: number, svy: number, spec: MatSpec): number {
  ball.x += nx * pen;
  ball.y += ny * pen;
  let rvx = ball.vx - svx;
  let rvy = ball.vy - svy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return 0;
  const impact = -vn;
  const e = restitution(spec, impact);
  const tvx = rvx - vn * nx;
  const tvy = rvy - vn * ny;
  const tLen = Math.hypot(tvx, tvy);
  // こすれ（クーロン摩擦）：はね返りの強さに比例して、横すべりを少しだけ止める。
  // 押しつけられているだけの遅い当たり（転がっている・乗っている玉）には効かせない
  // （効かせると「すべり止め」になって、ポストやアーチのてっぺんのような、ほぼ平らな所で玉が止まる）
  const jt = impact > REST_SPEED ? Math.min(tLen, spec.mu * (1 + e) * impact) : 0;
  const tScale = tLen > 1e-6 ? (tLen - jt) / tLen : 0;
  rvx = tvx * tScale - e * vn * nx;
  rvy = tvy * tScale - e * vn * ny;
  ball.vx = rvx + svx;
  ball.vy = rvy + svy;
  return impact;
}

/** 当たりで外向きに強くはじく（バンパー・スリング） */
function kick(ball: Ball, nx: number, ny: number, pen: number, base: number, gain: number, max: number): void {
  ball.x += nx * pen;
  ball.y += ny * pen;
  const vn = ball.vx * nx + ball.vy * ny;
  const tvx = ball.vx - vn * nx;
  const tvy = ball.vy - vn * ny;
  const out = Math.min(max, base + gain * Math.abs(vn));
  ball.vx = tvx * 0.8 + nx * out;
  ball.vy = tvy * 0.8 + ny * out;
}

function emitHit(world: World, mat: Material, speed: number, x: number, y: number): void {
  if (speed < 350 || world.time - world.hitSoundAt < 0.03) return;
  world.hitSoundAt = world.time;
  world.events.push({ type: "hit", mat, speed, x, y });
}

function collideStatic(world: World, ball: Ball): void {
  const { col } = world;
  const gx = Math.floor((ball.x - GX0) / GRID);
  const gy = Math.floor((ball.y - GY0) / GRID);
  if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return;
  const cell = col.cells[gy * GW + gx]!;

  for (let i = 0; i < cell.s.length; i += 1) {
    const sg = col.segs[cell.s[i]!]!;
    if (sg.kind === "drop" && !world.dropsUp[sg.idx]) continue;

    if (sg.kind === "outlaneGate" && !world.outlaneGate[sg.idx]) continue;
    let ay = sg.ay;
    let by = sg.by;
    if (sg.kind === "plunger") {
      ay = plungerFloorY(world);
      by = ay;
    }
    // 線分のいちばん近い点
    const wx = ball.x - sg.ax;
    const wy = ball.y - ay;
    let t = wx * sg.ux + wy * sg.uy;
    if (t < 0) t = 0;
    else if (t > sg.len) t = sg.len;
    const qx = sg.ax + sg.ux * t;
    const qy = ay + (by - ay) * (t / sg.len);
    let dx = ball.x - qx;
    let dy = ball.y - qy;
    const minD = BALL_R + sg.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= minD * minD) continue;
    let d = Math.sqrt(d2);
    if (d < 1e-6) {
      // 中心が線の上にのってしまったときは、1ステップ前にいた側へ押し出す
      const side = (ball.px - sg.ax) * -sg.uy + (ball.py - ay) * sg.ux >= 0 ? 1 : -1;
      dx = -sg.uy * side;
      dy = sg.ux * side;
      d = 1;
    }
    const nx = dx / d;
    const ny = dy / d;
    const pen = minD - Math.sqrt(d2);

    if (sg.inside) {
      // 一方通行のガイド：円の外へ向かって動いている玉（上から降りてきてガイドに乗る玉）にだけ当たる。
      // 外がわから内へ入ってくる玉（キックバックで打ち上げた玉）は、そのまま通りぬける
      const ox = qx - sg.inside.x;
      const oy = qy - sg.inside.y;
      const ol = Math.hypot(ox, oy) || 1;
      if ((ball.vx * ox + ball.vy * oy) / ol < -40) continue;
    }

    if (sg.kind === "gate") {
      // 一方通行：上へ行く玉は通す
      const along = ball.vx * world.table.shooterGate.allow.x + ball.vy * world.table.shooterGate.allow.y;
      if (along > 0) continue;
    }
    if (sg.kind === "sling") {
      const vn = -(ball.vx * nx + ball.vy * ny);
      // はじくのはゴムの面だけ。両はしの角（ポスト）に当たったときはふつうにはね返る
      const onFace = t > 6 && t < sg.len - 6;
      if (onFace && vn > SLING_KICK.threshold && world.time >= world.slingReadyAt[sg.idx]!) {
        world.slingReadyAt[sg.idx] = world.time + SLING_KICK.cooldown;
        kick(ball, nx, ny, pen, SLING_KICK.base, SLING_KICK.gain, SLING_KICK.max);
        world.events.push({ type: "sling", index: sg.idx, ballId: ball.id });
        continue;
      }
    }
    if (sg.kind === "outlaneGate") {
      // 光の扉の上（アウトレーンがわ）に乗った玉は、上へはね上げる。扉の下からは、ふつうの壁
      const upx = sg.uy;
      const upy = -sg.ux;
      const above = (ball.x - sg.ax) * (upy < 0 ? upx : -upx) + (ball.y - sg.ay) * (upy < 0 ? upy : -upy) > 0;
      if (above) {
        ball.x += nx * pen;
        ball.y += ny * pen;
        if (world.time >= world.gateKickReadyAt[sg.idx as 0 | 1]) {
          world.gateKickReadyAt[sg.idx as 0 | 1] = world.time + 0.2;
          ball.vx = (sg.idx === 0 ? 70 : -70) + (world.rand() - 0.5) * 60;
          ball.vy = -GATE_KICK_SPEED * (0.95 + world.rand() * 0.1);
          world.events.push({ type: "gateKick", index: sg.idx, ballId: ball.id });
        }
        continue;
      }
    }
    if (sg.kind === "standup") {
      const vn = -(ball.vx * nx + ball.vy * ny);
      const impact = resolve(ball, nx, ny, pen, 0, 0, MATS.standup);
      const front = sg.face ? nx * sg.face.x + ny * sg.face.y > 0.35 : false;
      if (front && vn > STANDUP_THRESHOLD && world.time >= world.standupReadyAt[sg.idx]!) {
        world.standupReadyAt[sg.idx] = world.time + 0.15;
        world.events.push({ type: "standup", index: sg.idx, ballId: ball.id });
      }
      emitHit(world, "plastic", impact, ball.x, ball.y);
      continue;
    }
    if (sg.kind === "drop") {
      const vn = -(ball.vx * nx + ball.vy * ny);
      const impact = resolve(ball, nx, ny, pen, 0, 0, MATS.drop);
      if (vn > DROP_THRESHOLD) {
        world.dropsUp[sg.idx] = false;
        world.events.push({ type: "drop", index: sg.idx, ballId: ball.id });
      } else {
        emitHit(world, "plastic", impact, ball.x, ball.y);
      }
      continue;
    }
    const impact = resolve(ball, nx, ny, pen, 0, 0, MATS[sg.mat]);
    emitHit(world, sg.mat, impact, ball.x, ball.y);
  }

  for (let i = 0; i < cell.c.length; i += 1) {
    const ci = col.circs[cell.c[i]!]!;
    const dx = ball.x - ci.x;
    const dy = ball.y - ci.y;
    const minD = BALL_R + ci.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= minD * minD) continue;
    const d = Math.sqrt(d2) || 1e-6;
    const nx = dx / d;
    const ny = dy / d;
    const pen = minD - d;
    if (ci.bumper >= 0 && world.time >= world.bumperReadyAt[ci.bumper]!) {
      world.bumperReadyAt[ci.bumper] = world.time + BUMPER_KICK.cooldown;
      const kickScale = world.table.bumperKick;
      kick(ball, nx, ny, pen, BUMPER_KICK.base * kickScale, BUMPER_KICK.gain, BUMPER_KICK.max * kickScale);
      world.events.push({ type: "bumper", index: ci.bumper, ballId: ball.id, x: ci.x, y: ci.y });
      continue;
    }
    const impact = resolve(ball, nx, ny, pen, 0, 0, ci.bumper >= 0 ? MATS.bumper : MATS[ci.mat]);
    emitHit(world, ci.mat, impact, ball.x, ball.y);
  }
}

/* ---------- センサー ---------- */

function crossSensors(world: World, ball: Ball): void {
  const { px, py, x, y } = ball;
  for (const sn of world.table.sensors) {
    const minx = Math.min(sn.a.x, sn.b.x) - 1;
    const maxx = Math.max(sn.a.x, sn.b.x) + 1;
    const miny = Math.min(sn.a.y, sn.b.y) - 1;
    const maxy = Math.max(sn.a.y, sn.b.y) + 1;
    if ((px < minx && x < minx) || (px > maxx && x > maxx) || (py < miny && y < miny) || (py > maxy && y > maxy)) continue;
    // 線分どうしが交わるか
    const ex = sn.b.x - sn.a.x;
    const ey = sn.b.y - sn.a.y;
    const s1 = ex * (py - sn.a.y) - ey * (px - sn.a.x);
    const s2 = ex * (y - sn.a.y) - ey * (x - sn.a.x);
    if ((s1 > 0 && s2 > 0) || (s1 < 0 && s2 < 0) || s1 === s2) continue;
    const mx = x - px;
    const my = y - py;
    const t1 = mx * (sn.a.y - py) - my * (sn.a.x - px);
    const t2 = mx * (sn.b.y - py) - my * (sn.b.x - px);
    if ((t1 > 0 && t2 > 0) || (t1 < 0 && t2 < 0)) continue;
    const last = ball.sensorAt[sn.id] ?? -1;
    if (world.time - last < 0.12) continue;
    ball.sensorAt[sn.id] = world.time;
    // 向き：センサーの線の左右どちら側へ抜けたか（s2 の符号）
    world.events.push({ type: "sensor", id: sn.id, ballId: ball.id, vx: ball.vx, vy: ball.vy, dir: s2 > 0 ? 1 : -1 });
  }
}

/* ---------- ランプ ---------- */

type RampPath = { def: RampDef; cum: number[]; total: number; ascentLen: number; topLen: number; dirIn: Pt };
const rampPathCache = new WeakMap<RampDef, RampPath>();

function rampPath(def: RampDef): RampPath {
  const cached = rampPathCache.get(def);
  if (cached) return cached;
  const cum = [0];
  for (let i = 1; i < def.path.length; i += 1) {
    const a = def.path[i - 1]!;
    const b = def.path[i]!;
    cum.push(cum[i - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const p0 = def.path[0]!;
  const p1 = def.path[1]!;
  const l01 = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
  const rp: RampPath = {
    def,
    cum,
    total: cum[cum.length - 1]!,
    ascentLen: cum[def.ascentEnd]!,
    topLen: cum[def.topEnd]!,
    dirIn: { x: (p1.x - p0.x) / l01, y: (p1.y - p0.y) / l01 },
  };
  rampPathCache.set(def, rp);
  return rp;
}

/** ランプの道の上の位置と、見た目の高さ */
export function rampPoint(def: RampDef, s: number): Pt & { z: number } {
  const rp = rampPath(def);
  const ss = Math.max(0, Math.min(rp.total, s));
  let i = 1;
  while (i < rp.cum.length - 1 && rp.cum[i]! < ss) i += 1;
  const a = def.path[i - 1]!;
  const b = def.path[i]!;
  const seg = rp.cum[i]! - rp.cum[i - 1]! || 1;
  const t = (ss - rp.cum[i - 1]!) / seg;
  let z: number;
  if (ss <= rp.ascentLen) z = (ss / rp.ascentLen) * RAMP.topZ;
  else if (ss <= rp.topLen) z = RAMP.topZ;
  else z = RAMP.topZ * (1 - (ss - rp.topLen) / (rp.total - rp.topLen));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z };
}

/** 入口でランプに乗ったときに、のぼりきれる速さ */
export function rampMinSpeed(def: RampDef): number {
  return Math.sqrt(2 * RAMP.up * rampPath(def).ascentLen);
}

function enterRamp(world: World, ball: Ball, def: RampDef): void {
  const rp = rampPath(def);
  ball.mode = "ramp";
  ball.ramp = def.id;
  ball.s = 0;
  ball.sv = Math.max(0, ball.vx * rp.dirIn.x + ball.vy * rp.dirIn.y);
  world.events.push({ type: "rampEnter", id: def.id, ballId: ball.id });
}

function stepRamp(world: World, ball: Ball, dt: number): void {
  const def = world.table.ramps.find((r) => r.id === ball.ramp)!;
  const rp = rampPath(def);
  const before = ball.s;
  let a: number;
  if (ball.s < rp.ascentLen) a = -RAMP.up;
  else if (ball.s < rp.topLen) a = RAMP.top;
  else a = RAMP.down;
  ball.sv += a * dt;
  ball.s += ball.sv * dt;
  if (before < rp.topLen && ball.s >= rp.topLen) world.events.push({ type: "rampTop", id: def.id, ballId: ball.id });
  const pt = rampPoint(def, ball.s);
  ball.px = ball.x;
  ball.py = ball.y;
  ball.x = pt.x;
  ball.y = pt.y;
  ball.z = pt.z;
  if (ball.s <= 0) {
    // のぼりきれずに戻ってきた：入口から台へ戻す
    const back = Math.max(250, -ball.sv);
    const p0 = def.path[0]!;
    ball.mode = "field";
    ball.ramp = null;
    ball.z = 0;
    ball.x = p0.x;
    ball.y = p0.y + 4;
    ball.px = ball.x;
    ball.py = ball.y;
    ball.vx = -rp.dirIn.x * back;
    ball.vy = -rp.dirIn.y * back;
    world.events.push({ type: "rampFail", id: def.id, ballId: ball.id });
  } else if (ball.s >= rp.total) {
    const end = def.path[def.path.length - 1]!;
    let sp = Math.min(RAMP.exitMax, Math.max(350, ball.sv));
    let dx = def.exitDir.x;
    let dy = def.exitDir.y;
    if (def.exitSpread) {
      // 台の上へ落とすランプは、向きと速さを少しばらつかせる
      const a = (world.rand() - 0.5) * 2 * def.exitSpread;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      [dx, dy] = [dx * c - dy * sn, dx * sn + dy * c];
      sp *= 0.85 + world.rand() * 0.3;
    }
    ball.mode = "field";
    ball.ramp = null;
    ball.z = 0;
    ball.x = end.x;
    ball.y = end.y;
    ball.px = end.x;
    ball.py = end.y - 1;
    ball.vx = dx * sp;
    ball.vy = dy * sp;
    world.events.push({ type: "rampDone", id: def.id, ballId: ball.id });
  }
}

/** 下から上へランプの入口の線を横切ったか */
function checkRampMouths(world: World, ball: Ball): void {
  if (ball.vy >= 0) return;
  for (const def of world.table.ramps) {
    const my = def.mouthA.y;
    if (ball.py >= my && ball.y < my && ball.x > def.mouthA.x && ball.x < def.mouthB.x) {
      enterRamp(world, ball, def);
      return;
    }
  }
}

/* ---------- 1ステップ ---------- */

function collideBalls(world: World): void {
  const bs = world.balls;
  for (let i = 0; i < bs.length; i += 1) {
    const a = bs[i]!;
    if (a.mode !== "field") continue;
    // ガチャ穴の中の玉は動かない「かべ」として扱う（2つ目の玉は穴に入れず、はね返る）
    for (const held of bs) {
      if (held.mode !== "scoop") continue;
      const dx = a.x - held.x;
      const dy = a.y - held.y;
      const d2 = dx * dx + dy * dy;
      const minD = BALL_R * 2;
      if (d2 >= minD * minD || d2 < 1e-9) continue;
      const d = Math.sqrt(d2);
      resolve(a, dx / d, dy / d, minD - d, 0, 0, MATS.metal);
    }
    for (let j = i + 1; j < bs.length; j += 1) {
      const b = bs[j]!;
      if (b.mode !== "field") continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const minD = BALL_R * 2;
      if (d2 >= minD * minD || d2 < 1e-9) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const pen = (minD - d) / 2;
      a.x -= nx * pen;
      a.y -= ny * pen;
      b.x += nx * pen;
      b.y += ny * pen;
      const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rv < 0) {
        const j2 = (-(1 + 0.92) * rv) / 2;
        a.vx -= j2 * nx;
        a.vy -= j2 * ny;
        b.vx += j2 * nx;
        b.vy += j2 * ny;
        if (-rv > 300) world.events.push({ type: "ballBall", speed: -rv, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      }
    }
  }
}

/**
 * マグネットの力。上へ動いている玉にだけ効かせる（止まった玉・落ちてくる玉は引かない。
 * 引きつづけると、その場で止まってしまう。ガチャ穴から出てきた玉も下へ動いているので、すぐ戻らない）
 */
function pullToScoop(world: World, ball: Ball, dt: number): void {
  if (ball.vy > -40) return;
  const dx = MAGNET.x - ball.x;
  if (Math.abs(dx) > MAGNET.halfWidth || ball.y > MAGNET.zoneBottom || ball.y < MAGNET.holeY) return;
  if (world.balls.some((b) => b.mode === "scoop")) return;
  const ax = Math.max(-MAGNET.maxAx, Math.min(MAGNET.maxAx, dx * MAGNET.pull - ball.vx * MAGNET.damp));
  ball.vx += ax * dt;
  if (ball.y < MAGNET.mouthY && Math.abs(dx) < MAGNET.inner) ball.vy -= MAGNET.lift * dt;
}

function stepFieldBall(world: World, ball: Ball, dt: number): void {
  ball.px = ball.x;
  ball.py = ball.y;
  ball.vy += GRAVITY * dt;
  if (world.magnet) pullToScoop(world, ball, dt);
  // ころがり抵抗（ごくわずか）。ほとんど止まっている玉には効かせない
  // （効かせると、ポストやアーチのてっぺんなど、ほぼ平らなところで玉が止まったままになる）
  const sp = Math.hypot(ball.vx, ball.vy);
  if (sp > 1e-3) {
    const drop = Math.min(sp, (55 * Math.min(1, sp / 60) + sp * 0.03) * dt);
    ball.vx -= (ball.vx / sp) * drop;
    ball.vy -= (ball.vy / sp) * drop;
  }
  if (sp > MAX_SPEED) {
    ball.vx *= MAX_SPEED / sp;
    ball.vy *= MAX_SPEED / sp;
  }
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  for (let iter = 0; iter < 2; iter += 1) {
    collideStatic(world, ball);
    for (let k = 0; k < world.pinwheels.length; k += 1) collidePinwheel(world, ball, k);
    collideFlipper(world, ball, world.flippers[0], 0);
    collideFlipper(world, ball, world.flippers[1], 1);
  }
}

/** かざぐるま index の羽根 k の向き（描画用にも使う） */
export function pinwheelArm(world: World, index: number, k: number): { ux: number; uy: number } {
  const def = world.table.pinwheels[index]!;
  const a = world.pinwheels[index]!.angle + (k * Math.PI * 2) / def.arms;
  return { ux: Math.cos(a), uy: Math.sin(a) };
}

/**
 * 玉とかざぐるま（まん中の軸と、回っている羽根）の当たり。羽根の当たった場所の速さ（ω × r）を玉に渡し、
 * 玉がおした向きに羽根も回る（強く当てると速く回り、ゆっくりふだんの速さに戻る）
 */
function collidePinwheel(world: World, ball: Ball, index: number): void {
  const def = world.table.pinwheels[index]!;
  const st = world.pinwheels[index]!;
  const dx = ball.x - def.x;
  const dy = ball.y - def.y;
  const reach = def.len + def.r + BALL_R;
  if (dx * dx + dy * dy > reach * reach) return;
  let best: { nx: number; ny: number; pen: number; cx: number; cy: number } | null = null;
  // 軸
  {
    const d = Math.hypot(dx, dy) || 1e-6;
    const pen = def.hubR + BALL_R - d;
    if (pen > 0) best = { nx: dx / d, ny: dy / d, pen, cx: (dx / d) * def.hubR, cy: (dy / d) * def.hubR };
  }
  for (let k = 0; k < def.arms; k += 1) {
    const { ux, uy } = pinwheelArm(world, index, k);
    let t = dx * ux + dy * uy;
    if (t < 0) t = 0;
    else if (t > def.len) t = def.len;
    const qx = ux * t;
    const qy = uy * t;
    const ex = dx - qx;
    const ey = dy - qy;
    const d = Math.hypot(ex, ey) || 1e-6;
    const pen = def.r + BALL_R - d;
    if (pen <= 0 || (best && pen <= best.pen)) continue;
    best = { nx: ex / d, ny: ey / d, pen, cx: qx + (ex / d) * def.r, cy: qy + (ey / d) * def.r };
  }
  if (!best) return;
  const svx = -st.omega * best.cy;
  const svy = st.omega * best.cx;
  const beforeX = ball.vx;
  const beforeY = ball.vy;
  const impact = resolve(ball, best.nx, best.ny, best.pen, svx, svy, MATS.pinwheel);
  if (impact <= 0) return;
  // 玉が受けた力の反対向きに、羽根が回る（中心からの距離 × 押した力）
  const jx = ball.vx - beforeX;
  const jy = ball.vy - beforeY;
  st.omega -= PINWHEEL.spin * (best.cx * jy - best.cy * jx) / Math.max(4, def.len);
  st.omega = Math.max(-PINWHEEL.maxOmega, Math.min(PINWHEEL.maxOmega, st.omega));
  if (impact > 150 && world.time >= st.readyAt) {
    st.readyAt = world.time + PINWHEEL.cooldown;
    world.events.push({ type: "pinwheel", index, ballId: ball.id, speed: impact });
  }
}

/** スコアにならない「玉づまり」を見つけて、少しだけ揺らす（本物の台の「ボールサーチ」） */
function watchStuck(world: World, ball: Ball, dt: number): void {
  const slow = Math.hypot(ball.vx, ball.vy) < 25;
  const inShooter = ball.x > 486;
  const cradled = world.time - ball.flipperAt < 0.05 && world.flippers.some((f) => f.pressed);
  if (slow && !inShooter && !cradled) ball.still += dt;
  else ball.still = 0;
  if (ball.still > 2.5) {
    ball.still = 0;
    ball.vx += (world.rand() - 0.5) * 500;
    ball.vy -= 250 + world.rand() * 300;
    world.events.push({ type: "stuck", ballId: ball.id });
  }
}

/** dt 秒ぶん（STEP の何倍か）進める */
export function stepWorld(world: World, steps: number): void {
  const dt = STEP;
  for (let n = 0; n < steps; n += 1) {
    world.time += dt;
    updateFlipper(world.flippers[0], dt);
    updateFlipper(world.flippers[1], dt);
    for (let k = 0; k < world.pinwheels.length; k += 1) {
      const pw = world.pinwheels[k]!;
      pw.angle += pw.omega * dt;
      pw.omega += (world.table.pinwheels[k]!.omega - pw.omega) * (dt / PINWHEEL.relax);
    }
    for (const ball of world.balls) {
      if (ball.mode === "field") {
        stepFieldBall(world, ball, dt);
        crossSensors(world, ball);
        checkRampMouths(world, ball);
        if (ball.mode === "field") {
          const sc = world.table.scoop;
          const dx = ball.x - sc.x;
          const dy = ball.y - sc.y;
          if (dx * dx + dy * dy < sc.r * sc.r && !world.balls.some((b) => b.mode === "scoop")) {
            ball.mode = "scoop";
            ball.x = sc.x;
            ball.y = sc.y;
            ball.vx = 0;
            ball.vy = 0;
            world.events.push({ type: "scoop", ballId: ball.id });
          } else if (ball.y > DRAIN_Y && ball.x < 486) {
            ball.mode = "gone";
            world.events.push({ type: "drain", ballId: ball.id, x: ball.x });
          } else {
            watchStuck(world, ball, dt);
          }
        }
      } else if (ball.mode === "ramp") {
        stepRamp(world, ball, dt);
      }
    }
    collideBalls(world);
    if (world.balls.some((b) => b.mode === "gone")) world.balls = world.balls.filter((b) => b.mode !== "gone");
  }
}

/** ガチャ穴から玉を出す（左のフリッパーへ向けて） */
export function ejectScoop(world: World, ball: Ball): void {
  const from = world.table.scoop.ejectFrom;
  ball.mode = "field";
  ball.x = from.x;
  ball.y = from.y;
  ball.px = from.x;
  ball.py = from.y;
  ball.vx = -470 - world.rand() * 160;
  ball.vy = 1250 + world.rand() * 200;
}

/** キックバック：アウトレーンの玉を打ち返す */
export function kickback(world: World, ball: Ball): void {
  ball.vx = (world.rand() - 0.5) * 60;
  ball.vy = -KICKBACK_SPEED;
}
