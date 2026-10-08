/**
 * ご当地ピンボールのマップ（台の形の種類）
 * =============================================================
 * どのマップも骨組み（外わく・上のレーン・オービット・ランプの入口・ガチャ穴・スリングショット・フリッパー）は同じで、
 * 上半分の部品とアイテムが浮かぶ場所・ランプの道がちがう（table.ts の MapSpec）。
 * 名前・色・曲は themes.ts（同じ id）。新しいマップを足したら、docs/pinball.md の「マップ」と、
 * scripts/simulate-pinball.mjs で形（stuck・shotmap）とバランスを確かめること。
 *
 * マップの id はデータベースの記録（pinball_scores.table_id）にもそのまま入る（英小文字・数字・_ で32文字まで。0137）。
 */
import { arc, buildTable, CX, DEG, mirror, p, quad, type CircleDef, type ItemSpot, type MapSpec, type PinwheelDef, type Pt, type RampShapeSpec, type TableGeometry } from "./table";

/** いちばん基本のマップ（はじめからある台。前の「いつもの台」と同じ形） */
export const DEFAULT_MAP_ID = "default";

/** 骨組みの上でアイテムが浮かぶ場所（ガチャ穴の前・ランプとオービットの入口）。どのマップも同じ */
const SHOT_SPOTS: readonly ItemSpot[] = [
  // 通路・ガチャ穴の前
  { x: 178, y: 470, tier: 1, shot: "scoop" },
  { x: 302, y: 470, tier: 1, shot: "scoop" },
  { x: 240, y: 612, tier: 1, shot: "scoop" },
  // ランプ・オービットの入口
  { x: 124, y: 646, tier: 2, shot: "leftRamp" },
  { x: 356, y: 646, tier: 2, shot: "rightRamp" },
  { x: 24, y: 520, tier: 2, shot: "leftOrbit" },
  { x: 456, y: 520, tier: 2, shot: "rightOrbit" },
];

/** いつもの台：バンパー3つ・かざぐるま1つ。バランスのいい、はじめの台 */
const DEFAULT_SPEC: MapSpec = {
  id: DEFAULT_MAP_ID,
  bumpers: [
    { x: 182, y: 248, r: 28 },
    { x: 298, y: 248, r: 28 },
    { x: 240, y: 334, r: 28 },
  ],
  // かざぐるま：上のレーンの出口の下（まん中のレーンのしきりの真下）。いつも時計まわりにゆっくり回る
  pinwheels: [{ x: CX, y: 192, arms: 4, len: 19, r: 4.5, hubR: 6.5, omega: 2.6 }],
  standupCenter: p(96, 215),
  itemSpots: [
    // バンパーのまわり（玉がよく来る。まん中はバンパー3つのあいだ）
    { x: 128, y: 300, tier: 0 },
    { x: 352, y: 300, tier: 0 },
    { x: 240, y: 277, tier: 0 },
    ...SHOT_SPOTS,
  ],
};

/**
 * はねはね台：上のまん中に、バンパー4つと左右のスリングショットでかこった「バンパーの部屋」。
 * 上のレーンを出た玉と、ランプをのぼった玉が部屋に飛びこんで、はね回ってから下へ出てくる（バンパーの当たりは、いつもの台の約2倍）。
 * バンパーどうしのすき間は 28mm 以上（玉の直径 27mm。バンパーははじくので、せまくても玉は止まらない）。
 * スリングショットの外がわとスタンドアップターゲットの間も 28mm 以上あけて、玉が通りぬけるようにしてある
 * （スリングを外へ 3mm 太くしただけで、ここに玉がはさまって止まった）
 */
const BUMPER_SPEC: MapSpec = {
  id: "bumper",
  // ランプ：のぼりきると、ワイヤーで上へ運ばれて、バンパーの部屋の上から飛びこむ（インレーンへは戻らない）
  ramp: {
    path: [p(124, 600), p(124, 420), p(124, 372), ...quad(p(124, 372), p(124, 186), p(191, 177), 12).slice(1)],
    ascentEnd: 1,
    topEnd: 2,
    exitDir: p(0.8, 0.6),
    // 落ちる向きを ±15° ばらつかせる（ぴったり同じ所に落ちると、その先の行き先が毎回同じになる）
    exitSpread: 15 * DEG,
  },
  bumpers: [
    { x: 240, y: 198, r: 23 },
    { x: 187, y: 250, r: 23 },
    { x: 293, y: 250, r: 23 },
    { x: 240, y: 302, r: 23 },
    // 部屋の出口の左右（ガチャ穴の横の通り道をのぼってきた玉も、ここで跳ね返る）
    { x: 172, y: 322, r: 18 },
    { x: 308, y: 322, r: 18 },
  ],
  // 部屋の左右の壁になる細いスリングショット（はじく面は内がわを向く）。外がわへ太くすると、ターゲットとの間に玉がはさまる
  slings: [
    { side: "left", a: p(152, 196), b: p(140, 248), c: p(152, 300) },
    { side: "right", a: p(328, 300), b: p(340, 248), c: p(328, 196) },
  ],
  pinwheels: [],
  standupCenter: p(76, 244),
  bumperKick: 1.15,
  itemSpots: [
    // 部屋の中（バンパーの間）と、部屋の左右の下
    { x: 212, y: 220, tier: 0 },
    { x: 104, y: 300, tier: 0 },
    { x: 376, y: 300, tier: 0 },
    ...SHOT_SPOTS,
  ],
};

/**
 * くぎ：まん中（x=240）で左右対称に、正三角形のこうしに並べる（となりのくぎとの間は spacing → 玉が通れるすき間）。
 * keep の円の中（風車・スタンドアップターゲットのまわり）と、area の外にはくぎを打たない
 */
function pegLattice(opts: { y0: number; rows: number; spacing: number; area: (pt: Pt) => boolean; keep: readonly { x: number; y: number; r: number }[] }): CircleDef[] {
  const rowH = opts.spacing * Math.sin(Math.PI / 3);
  const out: CircleDef[] = [];
  for (let row = 0; row < opts.rows; row += 1) {
    const y = Math.round((opts.y0 + row * rowH) * 10) / 10;
    const half = row % 2 ? opts.spacing / 2 : 0;
    for (let k = 0; k <= 6; k += 1) {
      const dx = half + k * opts.spacing;
      for (const x of dx === 0 ? [CX] : [CX - dx, CX + dx]) {
        if (!opts.area({ x, y }) || opts.keep.some((c) => Math.hypot(c.x - x, c.y - y) < c.r)) continue;
        // はね返りはゴムのポストと同じ（金属だと玉が勢いをなくして、くぎの上にのりやすい）
        out.push({ x, y, r: 3.5, mat: "post", look: "peg" });
      }
    }
  }
  return out;
}

/** 風車（くぎの台）。左は反時計まわり、右は時計まわりで、上に落ちてきた玉を外がわへ飛ばす */
const PACHI_WHEELS: PinwheelDef[] = [
  { x: 166, y: 316, arms: 4, len: 19, r: 4.5, hubR: 6.5, omega: -2.6 },
  { x: 314, y: 316, arms: 4, len: 19, r: 4.5, hubR: 6.5, omega: 2.6 },
];

/**
 * くぎと風車の台：パチンコのように、くぎが並んだ上半分を玉がカチカチ当たりながら落ちてくる。風車は2つ。
 * ランプをのぼった玉は上のまん中に落とされる。ガチャ穴のかこいの上があいていて（パチンコのまん中の入賞口）、
 * 落ちてきた玉がそのまま入ることもある。
 * くぎは、風車の羽根がとどく所から 31mm 以上はなす（近いと、くぎと羽根の間に玉がのって止まる）
 */
const PACHI_SPEC: MapSpec = {
  id: "pachinko",
  ramp: {
    path: [p(124, 600), p(124, 420), p(124, 372), ...quad(p(124, 372), p(124, 170), p(212, 168), 12).slice(1)],
    ascentEnd: 1,
    topEnd: 2,
    exitDir: p(0.9, 0.44),
    exitSpread: 18 * DEG,
  },
  bumpers: [
    { x: 196, y: 392, r: 17 },
    { x: 284, y: 392, r: 17 },
  ],
  pinwheels: PACHI_WHEELS,
  standupCenter: p(96, 215),
  scoopTopOpening: 40,
  posts: pegLattice({
    y0: 226,
    rows: 5,
    spacing: 38,
    area: (pt) => pt.x > 96 && pt.x < 384 && !(pt.y > 348 && (pt.x < 166 || pt.x > 314)),
    keep: [...PACHI_WHEELS.map((w) => ({ x: w.x, y: w.y, r: 58 })), { x: 96, y: 215, r: 52 }, { ...mirror(p(96, 215)), r: 52 }],
  }),
  itemSpots: [
    { x: 240, y: 262, tier: 0 },
    { x: 240, y: 330, tier: 0 },
    { x: 120, y: 290, tier: 0 },
    ...SHOT_SPOTS,
  ],
};

/**
 * 交わるランプ（ジェットコースター台）。左のランプは入口からのぼって右上へななめに走り、右のはしをワイヤーで降りて
 * 右のインレーンへ（右のランプはその折り返しで、左のインレーンへ）。2本はまん中で X に交わる
 */
function crossingRamp(): RampShapeSpec {
  const DIAG = 200;
  const TURN_R = 80;
  // のぼりきったところで、右上（45°）へ曲がる
  const bend = arc(184, 414, 60, Math.PI, Math.PI * 1.25, 8);
  const s = bend[bend.length - 1]!;
  const e = { x: s.x + Math.SQRT1_2 * DIAG, y: s.y - Math.SQRT1_2 * DIAG };
  // ななめの終わりから、右へ回りこんで下を向く（ここからワイヤー）
  const turn = arc(e.x + Math.SQRT1_2 * TURN_R, e.y + Math.SQRT1_2 * TURN_R, TURN_R, Math.PI * 1.25, Math.PI * 2, 10);
  const down = turn[turn.length - 1]!;
  return {
    path: [p(124, 600), p(124, 414), ...bend.slice(1), e, ...turn.slice(1), p(down.x, 600), ...quad(p(down.x, 600), p(down.x, 700), p(416, 756), 8).slice(1)],
    ascentEnd: 1,
    topEnd: 1 + (bend.length - 1) + 1,
    exitDir: p(-0.28, 0.96),
  };
}

/**
 * ジェットコースター台：左右のランプが X に交わって、反対がわのインレーンへ降りてくる長いランプ。
 * 右のフリッパーで左のランプを打つと、玉は右のインレーンへ戻ってくるので、同じショットをくり返しねらえる
 */
const COASTER_RAMP = crossingRamp();
const COASTER_SPEC: MapSpec = {
  id: "coaster",
  ramp: COASTER_RAMP,
  rampRight: { ...COASTER_RAMP, path: COASTER_RAMP.path.map(mirror), exitDir: p(-COASTER_RAMP.exitDir.x, COASTER_RAMP.exitDir.y) },
  bumpers: [
    { x: 120, y: 300, r: 22 },
    { x: 360, y: 300, r: 22 },
  ],
  pinwheels: [{ x: CX, y: 192, arms: 4, len: 19, r: 4.5, hubR: 6.5, omega: 2.6 }],
  standupCenter: p(96, 215),
  itemSpots: [
    { x: 128, y: 360, tier: 0 },
    { x: 352, y: 360, tier: 0 },
    { x: 240, y: 240, tier: 0 },
    ...SHOT_SPOTS,
  ],
};

const SPECS: readonly MapSpec[] = [DEFAULT_SPEC, BUMPER_SPEC, PACHI_SPEC, COASTER_SPEC];

/** マップの id（台えらびに並べる順） */
export const PINBALL_MAP_IDS: readonly string[] = SPECS.map((s) => s.id);

const TABLES = new Map<string, TableGeometry>(SPECS.map((s) => [s.id, buildTable(s)]));

export function isPinballMapId(id: string): boolean {
  return TABLES.has(id);
}

/**
 * 記録に使う台の id。マップの id はそのまま。前の「県の台」の id（都道府県コード）は、いつもの台と同じ形だったので
 * いつもの台として数える（古い記録・古い画面から送られてきた記録）。どちらでもなければ null
 */
export function resolvePinballMapId(tableId: string): string | null {
  if (TABLES.has(tableId)) return tableId;
  if (/^[0-9]{2}$/.test(tableId)) return DEFAULT_MAP_ID;
  return null;
}

/** マップの形（無い id は、いつもの台） */
export function getPinballTable(id: string): TableGeometry {
  return TABLES.get(id) ?? TABLES.get(DEFAULT_MAP_ID)!;
}
