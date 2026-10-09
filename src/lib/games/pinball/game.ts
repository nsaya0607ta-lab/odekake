/**
 * ご当地ピンボールのルール
 * =============================================================
 * 物理（physics.ts）が積んだ「起きたこと」を受けて、得点・ライト・スタンプ帳・スキル・モードを進める。
 * 画面（描画・音）は Game の中身を毎フレーム読むのと、fx に積まれた演出を取り出して使うだけにする。
 *
 * 1ゲームの流れ
 *   serve（打ち出し待ち）→ play → ボールを落とす → bonus（ボーナス集計）→ 次のボール … 3球で over
 *   ・打ち出しから BALL_SAVE_SEC 秒は、落としても戻ってくる（ボールセーブ）
 *   ・台に光るアイテムをショットで集める → その場でスキル発動。どれでも8つ（スタンプ帳）そろうと「制覇！」（3球マルチボール）
 *   ・台に出るのは、持っているご当地アイテム全部から（どの県のものも。まだ出ていないものが先）。すべての得点に図鑑ボーナスがかかる
 *   ・台の形はマップごとにちがう（maps.ts）。ゲームは world.table の形だけを見る
 *   ・上のレーン「お・で・か・け」がそろうとボーナス倍率アップ。ドロップターゲットを3つ倒すとガチャ穴が開く
 */
import type { GachaRarity } from "@/lib/gacha/config";
import {
  BALL_SAVE_SEC,
  BONUS,
  COMBO_WINDOW_SEC,
  CONQUEST_EXTRA_BALLS,
  CONQUEST_SAVE_SEC,
  ENCORE_POINTS,
  ENCORE_SEC,
  GACHA_AWARDS,
  GAME_SPEED,
  ITEM_POINTS,
  ITEM_RELOCATE_SEC,
  KICKBACK_AT_SERVE,
  LIT_ITEMS,
  MAX_BONUS_X,
  MAX_COMBO,
  MAX_EXTRA_BALLS,
  MAX_SCORE_MULT,
  PINBALL_BALLS,
  POINTS,
  SLOW_SCALE,
  STAMP_COUNT,
  STAR_RATE,
  type GachaAwardId,
} from "./config";
import {
  addBall,
  createWorld,
  ejectScoop,
  isOnPlunger,
  kickback,
  releasePlunger,
  STAGE_DROP_R,
  STEP,
  stepWorld,
  type Ball,
  type PhysEvent,
  type World,
} from "./physics";
import type { PinballSkill } from "./skills";
import { BALL_R, ITEM_PICKUP_R, SHOT_IDS, type Pt, type ShotId, type TableGeometry } from "./table";

/* ---------- 型 ---------- */

export type PinballItem = {
  /** 図鑑の id。？カプセルは "capsule:番号" */
  id: string;
  name: string;
  /** null は ？カプセル */
  rarity: GachaRarity | null;
  level: number;
  /** 限界突破の★（0〜5。アイテムを取ったときの得点が★1つで STAR_RATE ずつ上がる） */
  stars: number;
  skill: PinballSkill | null;
  /** 描く画像（public/ からのパス、または最適化済みのURL） */
  image: string | null;
};

/**
 * 台に浮かんでいるアイテム。spot は台（world.table）の itemSpots の番号、litAt はそこに出た時刻。
 * encore は スキル「おかわり」でもう一度出たもの（取るとスキルはもう一度、スタンプは増えない。until で消える）
 */
export type LitItem = { item: PinballItem; spot: number; litAt: number; encore: boolean; until: number };

export type Tone = "info" | "good" | "great" | "epic" | "bad";

export type SfxId =
  | "flipper" | "flipperHit" | "bumper" | "sling" | "drop" | "dropsAll" | "lane" | "lanesAll" | "spinner"
  | "rampUp" | "rampDone" | "rampFail" | "orbit" | "scoop" | "eject" | "gacha" | "kickback" | "save"
  | "drain" | "launch" | "item" | "skill" | "combo" | "jackpot" | "superJackpot" | "conquest" | "extraBall"
  | "bonus" | "gameOver" | "skillShot" | "outlane" | "inlane" | "metal" | "rubber" | "ballBall" | "serve"
  | "standup" | "standupsAll" | "pinwheel" | "gateKick";

export type GameFx =
  | { type: "msg"; title: string; sub?: string; tone: Tone; ms?: number }
  | { type: "pop"; x: number; y: number; text: string; tone: Tone }
  | { type: "sfx"; id: SfxId; level?: number; x?: number }
  | { type: "flash"; id: string }
  /** アイテムを取った（slot はスタンプ帳の入った場所。おかわりは -1） */
  | { type: "collect"; item: PinballItem; slot: number; from: Pt }
  | { type: "skill"; skill: PinballSkill }
  | { type: "gacha"; label: string }
  | { type: "shake"; power: number }
  | { type: "conquest" }
  | { type: "ballLost"; bonus: number }
  | { type: "gameOver" };

export type GamePhase = "serve" | "play" | "bonus" | "over";

type Timed = { factor: number; until: number };

export type Game = {
  world: World;
  rand: () => number;
  /** この台で集められるアイテム（持っているご当地アイテム） */
  pool: PinballItem[];
  /** いまのスタンプ帳で台に出せるもの（持っているアイテム。8種類に足りないときは ？カプセルで足す） */
  candidates: PinballItem[];
  /** スタンプ帳（STAMP_COUNT こ）。取った順に入る（スタンプ2倍のときは同じアイテムが2つ）。null はまだ */
  book: (PinballItem | null)[];
  /** 台に浮かんでいるアイテム */
  lit: LitItem[];
  /** このゲームで台に出たアイテム（まだ出ていないものから先に出す） */
  shown: Set<string>;
  /** このゲームで取ったアイテム（新しいものが後ろ。スキル「おかわり」で使う） */
  taken: PinballItem[];
  /** 図鑑ボーナス（ご当地アイテムを何種類持っているか。すべての得点にかける） */
  zukan: number;
  /** マップの名前（「はねはね台」など）。演出の文字に使う */
  tableName: string;
  /** 8個そろったときの大きな文字（「ご当地 制覇！」） */
  conquestTitle: string;
  phase: GamePhase;
  /** いま何球目か（1〜3） */
  ball: number;
  /** 待っているエクストラボール */
  extraBalls: number;
  extraBallsAwarded: number;
  score: number;
  /** ゲームが始まってからの時間（秒）。一時停止中は進まない */
  clock: number;
  /** 最初に打ち出してからの時間（記録用） */
  playTime: number;
  started: boolean;
  simAcc: number;
  /** 玉の速さ（GAME_SPEED。シミュレーターで変えて試せるように、ゲームごとに持つ） */
  speed: number;

  saveUntil: number;
  /** 次に台へ出た玉からボールセーブを始める */
  saveArmed: boolean;
  bonusX: number;
  perBall: { items: number; ramps: number; orbits: number; bumpers: number; drops: number };

  lanes: [boolean, boolean, boolean, boolean];
  /** スキルショットで光っているレーン（-1 は無し） */
  skillLane: number;
  skillShotArmed: boolean;
  skillShotUntil: number;
  kickbackLit: [boolean, boolean];
  /** スタンドアップターゲットが光っているか（左の3つ → 右の3つ） */
  standups: boolean[];
  gateUntil: number;
  mults: Timed[];
  bumperMults: Timed[];
  slowUntil: number;
  comboAdd: number;
  comboAddUntil: number;
  combo: number;
  lastMajorAt: number;
  /** スキル「マグネット」（ガチャ穴へ吸い寄せる）が切れる時刻 */
  magnetUntil: number;
  /** スキル「スタンプ2倍」が切れる時刻 */
  stamp2Until: number;
  /** スキル「ジャックポット予約」：次のランプで1つずつ使う（値は1回の点） */
  reserves: number[];

  extraLit: number;
  conquests: number;
  mode: "normal" | "conquest";
  jackpots: Record<ShotId, boolean>;
  superLit: boolean;
  jackpotsMade: number;

  scoopBall: Ball | null;
  scoopEjectAt: number;
  dropsResetAt: number;
  /** 自分で作るステージのドロップターゲットを立てなおす時刻（全部たおれたあと。0 は予定なし） */
  stageDropsResetAt: number;
  launchQueue: { at: number; power: number }[];
  /** 台に出た玉（ボールセーブを始めたか） */
  inPlay: Set<number>;
  orbitEnter: Map<number, { side: "left" | "right"; at: number }>;
  /** キックバックで打ち返した玉（そのままオービットを回っても、オービットのショットには数えない） */
  kickedAt: Map<number, number>;
  bonusUntil: number;
  lastBonus: number;
  /** 最後にボールを落としたところ（演出用） */
  stats: { items: number; jackpots: number; maxCombo: number; ramps: number; orbits: number; bumpers: number; skillShots: number; saves: number; scoops: number };
  fx: GameFx[];
  prevPressed: [boolean, boolean];
};

/* ---------- 準備 ---------- */

const CAPSULE_RARITIES: readonly GachaRarity[] = ["N", "R", "SR", "SSR", "UR", "LR", "MR"];

/** ？カプセル（得点だけ） */
export function capsuleItem(index: number): PinballItem {
  const r = CAPSULE_RARITIES[index % CAPSULE_RARITIES.length]!;
  return { id: `capsule:${index}`, name: "？カプセル", rarity: null, level: 0, stars: 0, skill: null, image: `/gacha/art/capsule-${r}-s.webp` };
}

/** 新しいスタンプ帳。台に出せるのは持っているアイテム全部（8種類に足りないぶんは ？カプセル） */
function newBook(g: Game): void {
  const list = [...g.pool];
  for (let i = list.length; i < STAMP_COUNT; i += 1) list.push(capsuleItem(i + g.conquests * 3));
  g.candidates = list;
  g.book = Array.from({ length: STAMP_COUNT }, () => null);
}

export type CreateGameOptions = {
  /** マップの形（maps.ts の getPinballTable） */
  table: TableGeometry;
  pool: readonly PinballItem[];
  tableName: string;
  conquestTitle?: string;
  /** 図鑑ボーナス（config.ts の zukanBonus。いつもの台は 1） */
  zukan?: number;
  seed?: number;
  speed?: number;
};

export function createGame({ table, pool, tableName, conquestTitle, zukan = 1, seed = Math.floor(Math.random() * 2 ** 31), speed = GAME_SPEED }: CreateGameOptions): Game {
  const world = createWorld(seed, table);
  const g: Game = {
    world,
    rand: world.rand,
    pool: [...pool],
    candidates: [],
    book: [],
    lit: [],
    shown: new Set(),
    taken: [],
    zukan: Math.max(1, zukan),
    tableName,
    conquestTitle: conquestTitle ?? `${tableName} 制覇！`,
    phase: "serve",
    ball: 1,
    extraBalls: 0,
    extraBallsAwarded: 0,
    score: 0,
    clock: 0,
    playTime: 0,
    started: false,
    simAcc: 0,
    speed,
    saveUntil: 0,
    saveArmed: true,
    bonusX: 1,
    perBall: { items: 0, ramps: 0, orbits: 0, bumpers: 0, drops: 0 },
    lanes: [false, false, false, false],
    skillLane: -1,
    skillShotArmed: false,
    skillShotUntil: 0,
    kickbackLit: [false, false],
    standups: table.standups.flatMap((bank) => bank.targets.map(() => false)),
    gateUntil: 0,
    mults: [],
    bumperMults: [],
    slowUntil: 0,
    comboAdd: 0,
    comboAddUntil: 0,
    combo: 0,
    lastMajorAt: -99,
    magnetUntil: 0,
    stamp2Until: 0,
    reserves: [],
    extraLit: 0,
    conquests: 0,
    mode: "normal",
    jackpots: { leftOrbit: false, leftRamp: false, scoop: false, rightRamp: false, rightOrbit: false },
    superLit: false,
    jackpotsMade: 0,
    scoopBall: null,
    scoopEjectAt: 0,
    dropsResetAt: 0,
    stageDropsResetAt: 0,
    launchQueue: [],
    inPlay: new Set(),
    orbitEnter: new Map(),
    kickedAt: new Map(),
    bonusUntil: 0,
    lastBonus: 0,
    stats: { items: 0, jackpots: 0, maxCombo: 0, ramps: 0, orbits: 0, bumpers: 0, skillShots: 0, saves: 0, scoops: 0 },
    fx: [],
    prevPressed: [false, false],
  };
  newBook(g);
  serveBall(g);
  lightItems(g);
  return g;
}

/* ---------- 便利なもの ---------- */

export function scoreMult(g: Game): number {
  let m = 1;
  for (const t of g.mults) if (t.until > g.clock) m *= t.factor;
  return Math.min(MAX_SCORE_MULT, m);
}

export function bumperMult(g: Game): number {
  let m = 1;
  for (const t of g.bumperMults) if (t.until > g.clock) m *= t.factor;
  return Math.min(25, m);
}

export function isBallSaveOn(g: Game): boolean {
  return g.clock < g.saveUntil || (g.saveArmed && g.phase === "serve");
}

/** スタンプ帳にいくつ入ったか */
export function collectedCount(g: Game): number {
  return g.book.reduce((n, item) => n + (item ? 1 : 0), 0);
}

/** 台にのっている玉の数（打ち出しレーン・ランプの上・ガチャ穴の中も数える） */
export function ballsOnTable(g: Game): number {
  return g.world.balls.length;
}

function sfx(g: Game, id: SfxId, level?: number, x?: number): void {
  g.fx.push({ type: "sfx", id, level, x });
}

function msg(g: Game, title: string, tone: Tone, sub?: string, ms?: number): void {
  g.fx.push({ type: "msg", title, sub, tone, ms });
}

/** 得点を足す（得点倍率と図鑑ボーナスをかける。noMult は得点倍率だけかけない） */
function addPoints(g: Game, base: number, at?: Pt, tone: Tone = "info", noMult = false): number {
  const value = Math.round(base * (noMult ? 1 : scoreMult(g)) * g.zukan);
  g.score += value;
  if (at && value >= 1000) g.fx.push({ type: "pop", x: at.x, y: at.y, text: `+${value.toLocaleString("ja-JP")}`, tone });
  return value;
}

/** ショットのアイテムの絵の位置（得点の文字を出すところ） */
function shotAt(g: Game, id: ShotId): Pt {
  return g.world.table.shots.find((s) => s.id === id)?.icon ?? { x: 240, y: 520 };
}

/* ---------- 打ち出し ---------- */

function serveBall(g: Game): void {
  const { x, y } = g.world.table.plungerRest;
  addBall(g.world, x, y);
  g.phase = "serve";
  g.saveArmed = true;
  // ボールごとに、左のキックバックは点いた状態で始まる（使ったらドロップターゲット3つで点けなおす）
  if (KICKBACK_AT_SERVE && !g.world.table.freeform) g.kickbackLit[0] = true;
  g.skillLane = g.world.table.laneX.length ? Math.floor(g.rand() * 4) : -1;
  g.skillShotArmed = g.skillLane >= 0;
  sfx(g, "serve");
}

/** プランジャーを引く（0〜1）。打ち出しレーンに玉がのっているときだけ */
export function setPlungerPull(g: Game, pull: number): void {
  if (g.phase === "over" || g.phase === "bonus") return;
  const onPlunger = g.world.balls.some((b) => isOnPlunger(g.world, b));
  g.world.plungerPull = onPlunger ? Math.max(0, Math.min(1, pull)) : 0;
}

/** プランジャーを離す */
export function launch(g: Game, power: number): boolean {
  if (g.phase === "over" || g.phase === "bonus") return false;
  const ball = releasePlunger(g.world, power);
  if (!ball) return false;
  g.started = true;
  sfx(g, "launch", power);
  return true;
}

export function canLaunch(g: Game): boolean {
  return (g.phase === "serve" || g.phase === "play") && g.launchQueue.length === 0 && g.world.balls.some((b) => isOnPlunger(g.world, b));
}

function queueLaunch(g: Game, delay: number): void {
  const last = g.launchQueue.length ? g.launchQueue[g.launchQueue.length - 1]!.at : g.clock;
  g.launchQueue.push({ at: Math.max(g.clock + delay, last + 0.7), power: 0.82 + g.rand() * 0.12 });
}

/* ---------- フリッパー ---------- */

export function setFlipper(g: Game, side: 0 | 1, pressed: boolean): void {
  if (g.phase === "over") pressed = false;
  g.world.flippers[side].pressed = pressed;
  if (pressed && !g.prevPressed[side]) {
    sfx(g, "flipper", side);
    // レーンチェンジ：フリッパーを押すと、上のレーンの光がとなりへ動く
    const l = g.lanes;
    g.lanes = side === 0 ? [l[1], l[2], l[3], l[0]] : [l[3], l[0], l[1], l[2]];
    if (g.phase === "serve" && g.skillLane >= 0) g.skillLane = (g.skillLane + (side === 0 ? 3 : 1)) % 4;
  }
  g.prevPressed[side] = pressed;
}

/* ---------- アイテム ---------- */

/** レア度ごとの、浮かぶ場所の選ばれやすさ（tier 0〜2）。レアなものほど狙いにくい場所に出る */
const TIER_WEIGHT: Record<"low" | "mid" | "high" | "top", readonly [number, number, number]> = {
  low: [3, 2, 0.6],
  mid: [2, 3, 1],
  high: [1, 2, 3],
  top: [0.3, 1.5, 4],
};

function tierOf(item: PinballItem): keyof typeof TIER_WEIGHT {
  if (!item.rarity || item.rarity === "N") return "low";
  if (item.rarity === "R") return "mid";
  if (item.rarity === "SR" || item.rarity === "SSR") return "high";
  return "top";
}

/** あいている場所を1つえらぶ（今いる場所 avoid と、ほかのアイテムがいる場所はのぞく） */
function pickSpot(g: Game, item: PinballItem, avoid: number | null): number | null {
  const used = new Set(g.lit.map((l) => l.spot));
  const w = TIER_WEIGHT[tierOf(item)];
  const free = g.world.table.itemSpots.flatMap((spot, i) => (used.has(i) || i === avoid ? [] : [{ i, w: w[spot.tier] }]));
  const total = free.reduce((sum, f) => sum + f.w, 0);
  if (!free.length || total <= 0) return null;
  let r = g.rand() * total;
  for (const f of free) {
    r -= f.w;
    if (r < 0) return f.i;
  }
  return free[free.length - 1]!.i;
}

/** 台に出せるアイテム（スタンプ帳にまだ入っていなくて、いま浮かんでいないもの。おかわりで出ているものも同じ絵が2つ並ばないようにのぞく） */
function availableItems(g: Game): PinballItem[] {
  const onTable = new Set(g.lit.map((l) => l.item.id));
  const inBook = new Set(g.book.flatMap((item) => (item ? [item.id] : [])));
  return g.candidates.filter((item) => !inBook.has(item.id) && !onTable.has(item.id));
}

/** 次に台へ出すアイテム（このゲームでまだ出ていないものから先に。あとはランダム。freshOnly はまだ出ていないものだけ） */
function pickNextItem(g: Game, freshOnly = false): PinballItem | null {
  const list = availableItems(g);
  const fresh = list.filter((item) => !g.shown.has(item.id));
  const from = fresh.length || freshOnly ? fresh : list;
  return from[Math.floor(g.rand() * from.length)] ?? null;
}

function lightItems(g: Game): void {
  if (g.mode === "conquest") return;
  let lit = g.lit.filter((l) => !l.encore).length;
  const max = LIT_ITEMS + g.extraLit;
  while (lit < max) {
    const item = pickNextItem(g);
    if (!item) break;
    const spot = pickSpot(g, item, null);
    if (spot === null) break;
    g.lit.push({ item, spot, litAt: g.clock, encore: false, until: Infinity });
    g.shown.add(item.id);
    lit += 1;
  }
}

/**
 * 同じ場所に長くいるアイテムは、別の場所へうつる。このゲームでまだ出ていないアイテムがあれば、入れかわってからうつる
 * （持っているアイテムが多いほど、1ゲームでいろいろ出てくる）。おかわりのアイテムは時間で消える
 */
function relocateItems(g: Game): void {
  if (g.mode !== "normal") return;
  for (let i = g.lit.length - 1; i >= 0; i -= 1) {
    const l = g.lit[i]!;
    if (l.encore && g.clock >= l.until) {
      g.lit.splice(i, 1);
      continue;
    }
    if (g.clock - l.litAt < ITEM_RELOCATE_SEC) continue;
    if (!l.encore) {
      const next = pickNextItem(g, true);
      if (next) {
        l.item = next;
        g.shown.add(next.id);
      }
    }
    const spot = pickSpot(g, l.item, l.spot);
    if (spot !== null) l.spot = spot;
    l.litAt = g.clock;
  }
}

/** 浮かんでいるアイテムに玉が当たったか（物理の1ステップごとに見る。速い玉が通りぬけないように） */
function checkPickups(g: Game): void {
  for (let i = g.lit.length - 1; i >= 0; i -= 1) {
    const spot = g.world.table.itemSpots[g.lit[i]!.spot]!;
    for (const b of g.world.balls) {
      if (b.mode !== "field") continue;
      const dx = b.x - spot.x;
      const dy = b.y - spot.y;
      if (dx * dx + dy * dy < ITEM_PICKUP_R * ITEM_PICKUP_R) {
        collectItem(g, i);
        break;
      }
    }
    // 取ったアイテムで制覇になると、残りは台から消える
    if (g.mode !== "normal") return;
  }
}

function collectItem(g: Game, index: number): void {
  const l = g.lit[index];
  if (!l) return;
  g.lit.splice(index, 1);
  const { item } = l;
  const spot = g.world.table.itemSpots[l.spot];
  const from: Pt = spot ? { x: spot.x, y: spot.y } : shotAt(g, "scoop");
  // おかわりで取ったときは、得点は半分（スキルはもう一度）
  const points = ITEM_POINTS[item.rarity ?? "capsule"] * (1 + g.conquests) * (1 + STAR_RATE * item.stars) * (l.encore ? ENCORE_POINTS : 1);
  addPoints(g, points, from, "great");
  g.perBall.items += 1;
  g.stats.items += 1;
  sfx(g, "item", item.rarity ? ["N", "R", "SR", "SSR", "UR", "LR", "MR"].indexOf(item.rarity) : 0);

  // おかわり：スタンプは増えない。スキルはもう一度（おかわりがおかわりを呼ばないように）
  if (l.encore) {
    g.fx.push({ type: "collect", item, slot: -1, from });
    if (item.skill) {
      msg(g, `おかわり！ ${item.name}`, "great", `${item.skill.title}：${item.skill.text}`, 2600);
      g.fx.push({ type: "skill", skill: item.skill });
      applySkill(g, item.skill, true);
    } else {
      msg(g, `おかわり！ ${item.name}`, "good", undefined, 1600);
    }
    return;
  }

  if (g.extraLit > 0) g.extraLit -= 1;
  // スタンプ帳に入れる（スタンプ2倍の間は2つ）
  const want = g.clock < g.stamp2Until ? 2 : 1;
  let slot = -1;
  let added = 0;
  for (let k = 0; k < g.book.length && added < want; k += 1) {
    if (g.book[k]) continue;
    g.book[k] = item;
    if (slot < 0) slot = k;
    added += 1;
  }
  g.taken.push(item);
  const done = collectedCount(g);
  g.fx.push({ type: "collect", item, slot, from });
  if (added > 1) g.fx.push({ type: "pop", x: from.x, y: from.y - 34, text: "スタンプ×2", tone: "epic" });
  if (item.skill) {
    msg(g, `${item.name} ゲット！`, "great", `${item.skill.title}：${item.skill.text}`, 2600);
    g.fx.push({ type: "skill", skill: item.skill });
    applySkill(g, item.skill, false);
  } else {
    msg(g, `${item.name} ゲット！`, "good", `スタンプ ${done} / ${STAMP_COUNT}${added > 1 ? "（2つ進んだ！）" : ""}`, 1800);
  }
  if (done >= STAMP_COUNT) startConquest(g);
  else lightItems(g);
}

/**
 * スキル「おかわり」：このゲームで取ったアイテム（新しい順・スキルのあるものが先）を、台にもう一度出す。
 * 出せるものが無いときは得点
 */
function encoreItems(g: Game, count: number): void {
  const onTable = new Set(g.lit.map((l) => l.item.id));
  const seen = new Set<string>();
  const recent: PinballItem[] = [];
  for (let k = g.taken.length - 1; k >= 0; k -= 1) {
    const item = g.taken[k]!;
    if (seen.has(item.id) || onTable.has(item.id) || item.skill?.kind === "encore") continue;
    seen.add(item.id);
    recent.push(item);
  }
  const ordered = [...recent.filter((item) => item.skill), ...recent.filter((item) => !item.skill)];
  let made = 0;
  for (const item of ordered) {
    if (made >= count) break;
    const spot = pickSpot(g, item, null);
    if (spot === null) break;
    g.lit.push({ item, spot, litAt: g.clock, encore: true, until: g.clock + ENCORE_SEC });
    made += 1;
  }
  if (made === 0) addPoints(g, POINTS.encoreMiss, shotAt(g, "scoop"), "great");
}

/* ---------- スキル ---------- */

function openScoop(g: Game): void {
  g.world.dropsUp = g.world.dropsUp.map(() => false);
}

/** スキルの効果を起こす（fromEncore は おかわりで取ったとき。おかわりの効果はもう起こさない） */
function applySkill(g: Game, skill: PinballSkill, fromEncore: boolean): void {
  sfx(g, "skill", skill.level);
  for (const e of skill.effects) {
    switch (e.type) {
      case "save":
        g.saveUntil = Math.max(g.saveUntil, g.clock + e.sec);
        break;
      case "mult":
        g.mults.push({ factor: e.factor, until: g.clock + e.sec });
        break;
      case "bumperMult":
        g.bumperMults.push({ factor: e.factor, until: g.clock + e.sec });
        break;
      case "slow":
        g.slowUntil = Math.max(g.slowUntil, g.clock + e.sec);
        break;
      case "gate":
        g.gateUntil = Math.max(g.gateUntil, g.clock + e.sec);
        break;
      case "kickback":
        g.kickbackLit[0] = true;
        if (e.both) g.kickbackLit[1] = true;
        break;
      case "bonusX":
        g.bonusX = Math.min(MAX_BONUS_X, g.bonusX + e.add);
        break;
      case "drops":
        openScoop(g);
        break;
      case "call":
        g.extraLit += e.count;
        lightItems(g);
        break;
      case "combo":
        g.comboAdd = Math.max(g.comboAdd, e.addSec);
        g.comboAddUntil = g.clock + e.sec;
        break;
      case "multiball":
        for (let i = 0; i < e.balls; i += 1) queueLaunch(g, 0.5 + i * 0.7);
        g.saveUntil = Math.max(g.saveUntil, g.clock + e.saveSec);
        break;
      case "points":
        addPoints(g, e.value, shotAt(g, "scoop"), "great");
        break;
      case "magnet":
        if (g.world.table.scoop.r === 0) {
          // ガチャ穴を置かない自由な台では、同じ時間の得点2倍にする
          g.mults.push({ factor: 2, until: g.clock + e.sec });
          break;
        }
        // 穴の前のターゲットを倒して、効いているあいだは開けたまま（立っていると吸い寄せても入れない）
        g.magnetUntil = Math.max(g.magnetUntil, g.clock + e.sec);
        openScoop(g);
        break;
      case "stamp2":
        g.stamp2Until = Math.max(g.stamp2Until, g.clock + e.sec);
        break;
      case "encore":
        if (!fromEncore) encoreItems(g, e.count);
        break;
      case "jackpot":
        for (let k = 0; k < e.shots; k += 1) g.reserves.push(e.value);
        break;
    }
  }
}

/* ---------- 制覇モード ---------- */

function startConquest(g: Game): void {
  g.conquests += 1;
  addPoints(g, POINTS.conquest * g.conquests, { x: 240, y: 520 }, "epic", true);
  g.mode = "conquest";
  g.superLit = false;
  g.jackpotsMade = 0;
  for (const id of SHOT_IDS) g.jackpots[id] = id !== "scoop";
  // 浮かんでいたアイテムは消える（おかわりのアイテムだけは、制覇モードが終わるまで待つ）
  g.lit = g.lit.filter((l) => l.encore);
  g.extraLit = 0;
  for (let i = 0; i < CONQUEST_EXTRA_BALLS; i += 1) queueLaunch(g, 1.2 + i * 0.8);
  g.saveUntil = Math.max(g.saveUntil, g.clock + CONQUEST_SAVE_SEC);
  msg(g, g.conquestTitle, "epic", g.conquests > 1 ? `${g.conquests}回目！ マルチボールでジャックポットをねらえ` : "マルチボールでジャックポットをねらえ", 3400);
  sfx(g, "conquest");
  g.fx.push({ type: "conquest" });
  g.fx.push({ type: "shake", power: 1 });
}

function endConquest(g: Game): void {
  g.mode = "normal";
  for (const id of SHOT_IDS) g.jackpots[id] = false;
  g.superLit = false;
  newBook(g);
  for (const l of g.lit) {
    l.litAt = g.clock;
    l.until = g.clock + ENCORE_SEC;
  }
  msg(g, "新しいスタンプ帳", "info", `また${STAMP_COUNT}つそろえると、もう一度制覇！`, 2200);
  lightItems(g);
}

function jackpotShot(g: Game, id: ShotId): boolean {
  if (g.mode !== "conquest") return false;
  if (id === "scoop" && g.superLit) {
    g.superLit = false;
    addPoints(g, POINTS.superJackpot * g.conquests, shotAt(g, "scoop"), "epic");
    g.stats.jackpots += 1;
    msg(g, "スーパージャックポット！", "epic", undefined, 2600);
    sfx(g, "superJackpot");
    g.fx.push({ type: "shake", power: 1 });
    for (const s of SHOT_IDS) g.jackpots[s] = s !== "scoop";
    return true;
  }
  if (!g.jackpots[id]) return false;
  g.jackpots[id] = false;
  g.jackpotsMade += 1;
  g.stats.jackpots += 1;
  addPoints(g, POINTS.jackpot * g.conquests, shotAt(g, id), "epic");
  sfx(g, "jackpot");
  g.fx.push({ type: "shake", power: 0.6 });
  if (SHOT_IDS.every((s) => !g.jackpots[s])) {
    g.superLit = true;
    openScoop(g);
    msg(g, "ジャックポット！", "epic", "スーパージャックポット点灯！ ガチャ穴をねらえ", 2400);
  } else {
    msg(g, "ジャックポット！", "epic", undefined, 1600);
  }
  return true;
}

/* ---------- ショット ---------- */

function majorShot(g: Game, id: ShotId): void {
  const window = COMBO_WINDOW_SEC + (g.clock < g.comboAddUntil ? g.comboAdd : 0);
  g.combo = g.clock - g.lastMajorAt <= window ? Math.min(MAX_COMBO, g.combo + 1) : 1;
  g.lastMajorAt = g.clock;
  g.stats.maxCombo = Math.max(g.stats.maxCombo, g.combo);
  g.skillShotArmed = false;
  g.skillLane = -1;

  const at = shotAt(g, id);
  if (id === "leftOrbit" || id === "rightOrbit") {
    addPoints(g, POINTS.orbit * g.combo, at, "good");
    g.perBall.orbits += 1;
    g.stats.orbits += 1;
    sfx(g, "orbit", g.combo);
  } else if (id === "leftRamp" || id === "rightRamp") {
    addPoints(g, POINTS.ramp * g.combo, at, "good");
    g.perBall.ramps += 1;
    g.stats.ramps += 1;
    sfx(g, "rampDone", g.combo);
  } else {
    addPoints(g, POINTS.scoop * g.combo, at, "good");
    sfx(g, "scoop");
  }
  g.fx.push({ type: "flash", id: `shot:${id}` });
  if (g.combo >= 2) {
    msg(g, `${g.combo}コンボ！`, g.combo >= 4 ? "great" : "good", undefined, 1100);
    sfx(g, "combo", g.combo);
  }

  jackpotShot(g, id);
  // ジャックポット予約（スキル）：ランプで1つ使う
  if ((id === "leftRamp" || id === "rightRamp") && g.reserves.length) {
    const value = g.reserves.shift()!;
    addPoints(g, value * (1 + g.conquests), at, "epic");
    g.stats.jackpots += 1;
    msg(g, "予約ジャックポット！", "epic", g.reserves.length ? `のこり${g.reserves.length}回` : undefined, 1800);
    sfx(g, "jackpot");
    g.fx.push({ type: "shake", power: 0.5 });
  }
}

/* ---------- スタンドアップターゲット ---------- */

/** 1組（3つ）を全部光らせた：得点と、アイテムをもう1か所よぶ（よべないときは得点を上乗せ）。光は消して、また最初から */
function standupsComplete(g: Game, bankIndex: number): void {
  const bank = g.world.table.standups[bankIndex]!;
  const at = { x: bank.center.x + (bank.side === "left" ? 30 : -30), y: bank.center.y + 46 };
  for (let k = 0; k < 3; k += 1) g.standups[bankIndex * 3 + k] = false;
  const canCall = g.mode === "normal" && availableItems(g).length > 0;
  addPoints(g, POINTS.standupsAll * (canCall ? 1 : 2), at, "great");
  g.fx.push({ type: "flash", id: `standupsAll:${bankIndex}` });
  sfx(g, "standupsAll");
  if (canCall) {
    g.extraLit += 1;
    lightItems(g);
    msg(g, "的コンプリート！", "great", "アイテムをもう1か所よぶ", 1600);
  } else {
    msg(g, "的コンプリート！", "great", undefined, 1300);
  }
}

/* ---------- ガチャ穴 ---------- */

function gachaAward(g: Game): void {
  const hasLit = g.lit.some((l) => !l.encore);
  const canCall = g.mode === "normal" && availableItems(g).length > 0;
  const candidates = GACHA_AWARDS.filter((a) => {
    if (a.id === "kickback") return !(g.kickbackLit[0] && g.kickbackLit[1]);
    if (a.id === "extraBall") return g.extraBallsAwarded < 1;
    if (a.id === "stamp") return hasLit && g.mode === "normal";
    if (a.id === "call") return canCall;
    return true;
  });
  const total = candidates.reduce((sum, a) => sum + a.weight, 0);
  let r = g.rand() * total;
  let award: GachaAwardId = "points50k";
  for (const a of candidates) {
    r -= a.weight;
    if (r < 0) {
      award = a.id;
      break;
    }
  }
  const label = GACHA_AWARDS.find((a) => a.id === award)!.label;
  g.fx.push({ type: "gacha", label });
  sfx(g, "gacha");
  switch (award) {
    case "points50k":
      addPoints(g, 50000, shotAt(g, "scoop"), "great");
      break;
    case "points100k":
      addPoints(g, 100000, shotAt(g, "scoop"), "great");
      break;
    case "save":
      g.saveUntil = Math.max(g.saveUntil, g.clock + 10);
      break;
    case "kickback":
      if (!g.kickbackLit[0]) g.kickbackLit[0] = true;
      else g.kickbackLit[1] = true;
      break;
    case "bonusx":
      g.bonusX = Math.min(MAX_BONUS_X, g.bonusX + 1);
      break;
    case "call":
      g.extraLit += 1;
      lightItems(g);
      break;
    case "stamp": {
      const index = g.lit.findIndex((l) => !l.encore);
      if (index >= 0) collectItem(g, index);
      break;
    }
    case "extraBall":
      awardExtraBall(g);
      break;
  }
  msg(g, "ガチャ！", "great", label, 2000);
}

function awardExtraBall(g: Game): void {
  if (g.extraBallsAwarded >= MAX_EXTRA_BALLS) return;
  g.extraBallsAwarded += 1;
  g.extraBalls += 1;
  msg(g, "エクストラボール！", "epic", "このボールのあと、もう1回あそべる", 2400);
  sfx(g, "extraBall");
}

/* ---------- 起きたことの処理 ---------- */

function sideOf(id: string): 0 | 1 {
  return id.endsWith("Right") ? 1 : 0;
}

function findBall(g: Game, id: number): Ball | undefined {
  return g.world.balls.find((b) => b.id === id);
}

function cancelSkillShot(g: Game): void {
  if (g.skillShotArmed && g.phase === "play") {
    g.skillShotArmed = false;
    g.skillLane = -1;
  }
}

function handleEvent(g: Game, e: PhysEvent): void {
  switch (e.type) {
    case "bumper": {
      const value = addPoints(g, POINTS.bumper * bumperMult(g));
      g.fx.push({ type: "pop", x: e.x, y: e.y - 30, text: `+${value.toLocaleString("ja-JP")}`, tone: bumperMult(g) > 1 ? "great" : "info" });
      g.fx.push({ type: "flash", id: `bumper:${e.index}` });
      g.perBall.bumpers += 1;
      g.stats.bumpers += 1;
      sfx(g, "bumper", e.index);
      cancelSkillShot(g);
      break;
    }
    case "sling":
      addPoints(g, POINTS.sling);
      g.fx.push({ type: "flash", id: `sling:${e.index}` });
      sfx(g, "sling", e.index);
      break;
    case "standup": {
      const bankIndex = Math.floor(e.index / 3);
      const bank = g.world.table.standups[bankIndex]!;
      const target = bank.targets[e.index % 3]!;
      const at = { x: (target.a.x + target.b.x) / 2 + target.face.x * 22, y: (target.a.y + target.b.y) / 2 + target.face.y * 22 };
      const fresh = !g.standups[e.index];
      g.standups[e.index] = true;
      addPoints(g, fresh ? POINTS.standup : Math.round(POINTS.standup / 3), at, fresh ? "good" : "info");
      g.fx.push({ type: "flash", id: `standup:${e.index}` });
      sfx(g, "standup", e.index % 3);
      cancelSkillShot(g);
      const lit = [0, 1, 2].every((k) => g.standups[bankIndex * 3 + k]);
      if (lit) standupsComplete(g, bankIndex);
      break;
    }
    case "pinwheel": {
      addPoints(g, POINTS.pinwheel);
      g.fx.push({ type: "flash", id: `pinwheel:${e.index}` });
      sfx(g, "pinwheel", Math.min(1, e.speed / 2500));
      break;
    }
    case "gateKick":
      g.fx.push({ type: "flash", id: `gate:${e.index}` });
      sfx(g, "gateKick");
      break;
    case "drop": {
      const d = g.world.table.drops[e.index];
      addPoints(g, POINTS.drop, d ? { x: (d.a.x + d.b.x) / 2, y: 530 } : undefined);
      g.perBall.drops += 1;
      sfx(g, "drop", e.index);
      if (g.world.dropsUp.every((up) => !up)) {
        addPoints(g, POINTS.dropsAll, { x: 240, y: 500 }, "good");
        sfx(g, "dropsAll");
        if (!g.kickbackLit[0]) {
          g.kickbackLit[0] = true;
          msg(g, "ガチャ穴オープン！", "good", "キックバック点灯", 1600);
        } else {
          msg(g, "ガチャ穴オープン！", "good", undefined, 1400);
        }
      }
      cancelSkillShot(g);
      break;
    }
    case "stageDrop": {
      // 自分で作るステージのドロップターゲット：全部たおすと、ターゲットの数に合わせたボーナス。少しして立ちなおる
      const drops = g.world.table.stageDrops;
      const d = drops[e.index];
      addPoints(g, POINTS.stageDrop, d ? { x: (d.a.x + d.b.x) / 2, y: (d.a.y + d.b.y) / 2 - 16 } : undefined);
      g.fx.push({ type: "flash", id: `stageDrop:${e.index}` });
      sfx(g, "drop", e.index % 3);
      if (g.world.stageDropsUp.every((up) => !up)) {
        const c = drops.reduce((acc, t) => ({ x: acc.x + (t.a.x + t.b.x) / 2 / drops.length, y: acc.y + (t.a.y + t.b.y) / 2 / drops.length }), { x: 0, y: 0 });
        addPoints(g, POINTS.stageDropsAll * drops.length, { x: c.x, y: c.y - 30 }, "good");
        g.fx.push({ type: "flash", id: "stageDropsAll" });
        sfx(g, "dropsAll");
        if (drops.length >= 2) msg(g, "ターゲット コンプリート！", "good", undefined, 1200);
        g.stageDropsResetAt = g.clock + 1.2;
      }
      cancelSkillShot(g);
      break;
    }
    case "spin": {
      // 自分で作るステージのスピナー：くぐった速さだけ回って、回ったぶん点が入る（オービットのスピナーと同じ数え方）
      const sp = g.world.table.spinners[e.index];
      const spins = Math.max(1, Math.min(24, Math.round(Math.hypot(e.vx, e.vy) / 220)));
      addPoints(g, POINTS.spinner * spins, sp ? { x: sp.x, y: sp.y - 18 } : undefined);
      sfx(g, "spinner", spins);
      g.fx.push({ type: "flash", id: `spin:${e.index}:${spins}` });
      cancelSkillShot(g);
      break;
    }
    case "hit":
      sfx(g, e.mat === "rubber" || e.mat === "post" ? "rubber" : "metal", Math.min(1, e.speed / 3000), e.x);
      break;
    case "flipperHit":
      if (e.speed > 900) sfx(g, "flipperHit", Math.min(1, e.speed / 3500));
      break;
    case "ballBall":
      sfx(g, "ballBall", Math.min(1, e.speed / 2500));
      break;
    case "sensor":
      handleSensor(g, e);
      break;
    case "rampEnter":
      sfx(g, "rampUp");
      cancelSkillShot(g);
      break;
    case "rampTop":
      break;
    case "rampDone":
      majorShot(g, e.id === "left" ? "leftRamp" : "rightRamp");
      break;
    case "rampFail":
      sfx(g, "rampFail");
      break;
    case "scoop": {
      const ball = findBall(g, e.ballId);
      if (!ball) break;
      g.scoopBall = ball;
      g.scoopEjectAt = g.clock + 1.9;
      g.stats.scoops += 1;
      majorShot(g, "scoop");
      gachaAward(g);
      break;
    }
    case "drain":
      handleDrain(g, e.ballId);
      break;
    case "stuck":
      break;
  }
}

function handleSensor(g: Game, e: Extract<PhysEvent, { type: "sensor" }>): void {
  switch (e.id) {
    case "lane0":
    case "lane1":
    case "lane2":
    case "lane3": {
      const i = Number(e.id.slice(4));
      if (g.skillShotArmed && g.phase === "play") {
        if (i === g.skillLane) {
          g.stats.skillShots += 1;
          addPoints(g, POINTS.skillShot, { x: g.world.table.laneX[i]!, y: g.world.table.laneY + 40 }, "epic");
          msg(g, "スキルショット！", "epic", `「${"おでかけ"[i]}」のレーンにぴったり`, 2000);
          sfx(g, "skillShot");
        }
        g.skillShotArmed = false;
        g.skillLane = -1;
      }
      if (!g.lanes[i]) {
        g.lanes[i] = true;
        addPoints(g, POINTS.lane, { x: g.world.table.laneX[i]!, y: g.world.table.laneY + 30 });
        sfx(g, "lane", i);
        if (g.lanes.every(Boolean)) {
          g.bonusX = Math.min(MAX_BONUS_X, g.bonusX + 1);
          addPoints(g, POINTS.lanesAll, { x: 240, y: 190 }, "good");
          msg(g, "おでかけ完成！", "good", `ボーナス ×${g.bonusX}`, 1600);
          sfx(g, "lanesAll");
          g.fx.push({ type: "flash", id: "lanes" });
          g.lanes = [false, false, false, false];
        }
      } else {
        addPoints(g, POINTS.lane / 3);
        sfx(g, "lane", i);
      }
      break;
    }
    case "spinner": {
      const speed = Math.hypot(e.vx, e.vy);
      const spins = Math.max(1, Math.min(24, Math.round(speed / 220)));
      addPoints(g, POINTS.spinner * spins, { x: 24, y: 380 });
      sfx(g, "spinner", spins);
      g.fx.push({ type: "flash", id: `spinner:${spins}` });
      cancelSkillShot(g);
      break;
    }
    case "orbitLeftMouth":
    case "orbitRightMouth":
      // オービットの判定は、玉が実際に走った時間（台の上の時間）で見る（玉の速さやスローで変わらないように）
      if (e.vy < 0 && g.world.time - (g.kickedAt.get(e.ballId) ?? -99) > 1.5) {
        g.orbitEnter.set(e.ballId, { side: e.id === "orbitLeftMouth" ? "left" : "right", at: g.world.time });
      }
      break;
    case "orbitTop": {
      const enter = g.orbitEnter.get(e.ballId);
      g.orbitEnter.delete(e.ballId);
      if (!enter || g.world.time - enter.at > 2.6) break;
      if (enter.side === "left" && e.vx > 0) majorShot(g, "leftOrbit");
      else if (enter.side === "right" && e.vx < 0) majorShot(g, "rightOrbit");
      break;
    }
    case "inlaneLeft":
    case "inlaneRight":
      if (e.vy > 0) {
        addPoints(g, POINTS.inlane);
        sfx(g, "inlane");
      }
      break;
    case "outlaneLeft":
    case "outlaneRight":
      if (e.vy > 0) {
        addPoints(g, POINTS.outlane);
        sfx(g, "outlane");
      }
      break;
    case "kickbackLeft":
    case "kickbackRight": {
      const side = sideOf(e.id);
      const ball = findBall(g, e.ballId);
      if (e.vy > 0 && ball && g.kickbackLit[side]) {
        kickback(g.world, ball);
        g.kickedAt.set(ball.id, g.world.time);
        g.kickbackLit[side] = false;
        addPoints(g, POINTS.kickback);
        msg(g, "キックバック！", "good", undefined, 1100);
        sfx(g, "kickback");
        g.fx.push({ type: "flash", id: `kickback:${side}` });
      }
      break;
    }
    case "shooterExit":
      break;
  }
}

function handleDrain(g: Game, ballId: number): void {
  g.orbitEnter.delete(ballId);
  const wasInPlay = g.inPlay.has(ballId);
  g.inPlay.delete(ballId);
  if (g.phase === "bonus" || g.phase === "over") return;
  if (g.clock < g.saveUntil && wasInPlay) {
    g.stats.saves += 1;
    msg(g, "ボールセーブ！", "good", "ボールが戻ってくるよ", 1300);
    sfx(g, "save");
    queueLaunch(g, 0.8);
    return;
  }
  sfx(g, "drain");
  if (g.world.balls.length > 0 || g.launchQueue.length > 0) return;
  endOfBall(g);
}

function endOfBall(g: Game): void {
  const p = g.perBall;
  const raw = p.items * BONUS.item + p.ramps * BONUS.ramp + p.orbits * BONUS.orbit + p.bumpers * BONUS.bumper + p.drops * BONUS.drop;
  const bonus = Math.round(raw * g.bonusX * g.zukan);
  g.score += bonus;
  g.lastBonus = bonus;
  g.phase = "bonus";
  g.bonusUntil = g.clock + 2.6;
  g.fx.push({ type: "ballLost", bonus });
  const zukanText = g.zukan > 1 ? ` × 図鑑${g.zukan}` : "";
  msg(g, "ボーナス", "info", `${raw.toLocaleString("ja-JP")} × ${g.bonusX}${zukanText} = ${bonus.toLocaleString("ja-JP")}`, 2400);
  sfx(g, "bonus");
  g.perBall = { items: 0, ramps: 0, orbits: 0, bumpers: 0, drops: 0 };
  g.bonusX = 1;
  g.mults = [];
  g.bumperMults = [];
  g.slowUntil = 0;
  g.gateUntil = 0;
  g.magnetUntil = 0;
  g.stamp2Until = 0;
  g.combo = 0;
  g.saveUntil = 0;
  if (g.mode === "conquest") endConquest(g);
}

function nextBall(g: Game): void {
  if (g.extraBalls > 0) {
    g.extraBalls -= 1;
    msg(g, "もう1回！", "great", "エクストラボール", 1600);
    serveBall(g);
    return;
  }
  if (g.ball < PINBALL_BALLS) {
    g.ball += 1;
    msg(g, `ボール ${g.ball}`, "info", g.ball === PINBALL_BALLS ? "ラストボール！" : undefined, 1400);
    serveBall(g);
    return;
  }
  g.phase = "over";
  g.world.flippers[0].pressed = false;
  g.world.flippers[1].pressed = false;
  g.fx.push({ type: "gameOver" });
  sfx(g, "gameOver");
}

/* ---------- 時間で進むもの ---------- */

function tick(g: Game): void {
  const { world } = g;
  world.outlaneGate = g.clock < g.gateUntil ? [true, true] : [false, false];
  world.magnet = world.table.scoop.r > 0 && g.clock < g.magnetUntil && g.phase !== "bonus";
  if (g.mults.length) g.mults = g.mults.filter((t) => t.until > g.clock);
  if (g.bumperMults.length) g.bumperMults = g.bumperMults.filter((t) => t.until > g.clock);

  // 自動の打ち出し（ボールセーブ・マルチボール）
  if (g.launchQueue.length && g.clock >= g.launchQueue[0]!.at && g.phase !== "bonus" && g.phase !== "over") {
    const onPlunger = world.balls.find((b) => isOnPlunger(world, b));
    const inLane = world.balls.some((b) => b.x > 486 && b.y > 300);
    if (onPlunger && Math.abs(onPlunger.vy) < 30) {
      const next = g.launchQueue.shift()!;
      world.plungerPull = 0;
      releasePlunger(world, next.power);
      g.started = true;
      sfx(g, "launch", next.power);
    } else if (!inLane) {
      const { x, y } = world.table.plungerRest;
      addBall(world, x, y);
      g.launchQueue[0]!.at = g.clock + 0.4;
    }
  }

  // 台に出た玉からボールセーブを始める
  for (const b of world.balls) {
    if (g.inPlay.has(b.id) || b.mode !== "field") continue;
    if (b.x < 480 || b.y < 250) {
      g.inPlay.add(b.id);
      if (g.phase === "serve") {
        g.phase = "play";
        g.skillShotUntil = g.clock + 5;
        if (g.saveArmed) {
          g.saveUntil = Math.max(g.saveUntil, g.clock + BALL_SAVE_SEC);
          g.saveArmed = false;
        }
      }
    }
  }

  if (g.skillShotArmed && g.phase === "play" && g.clock > g.skillShotUntil) {
    g.skillShotArmed = false;
    g.skillLane = -1;
  }

  // ガチャ穴から玉を出す（予定に入っていない玉が穴にいたら、念のため出す予定に入れる）
  if (!g.scoopBall) {
    const held = world.balls.find((b) => b.mode === "scoop");
    if (held) {
      g.scoopBall = held;
      g.scoopEjectAt = g.clock + 1;
    }
  }
  if (g.scoopBall && g.clock >= g.scoopEjectAt) {
    const ball = g.scoopBall;
    g.scoopBall = null;
    if (ball.mode === "scoop") {
      ejectScoop(world, ball);
      sfx(g, "eject");
      g.dropsResetAt = g.clock + 0.7;
    }
  }
  // ドロップターゲットを立てなおす（スーパージャックポット中・マグネット中は開けたまま）
  if (g.dropsResetAt && g.clock >= g.dropsResetAt && !g.superLit && g.clock >= g.magnetUntil) {
    // ガチャ穴の中・かこいの中（ターゲットの上）・すぐ下に玉がいるあいだは立てない
    // （立てると、中の玉がターゲットの上に乗って止まる。穴の中の玉も、出てくるときにかこいに閉じこめられる）
    const near = g.scoopBall !== null || world.balls.some((b) => b.mode === "scoop" || (b.mode === "field" && insideScoopArea(b, 575)));
    if (near) {
      g.dropsResetAt = g.clock + 0.3;
    } else {
      world.dropsUp = world.dropsUp.map(() => true);
      g.dropsResetAt = 0;
    }
  }
  // 自分で作るステージのドロップターゲットを立てなおす。ターゲットに重なっている玉がいるあいだは待つ
  // （重なったまま立てると、玉がターゲットの中に入ってしまう）
  if (g.stageDropsResetAt && g.clock >= g.stageDropsResetAt) {
    const clear = BALL_R + STAGE_DROP_R + 2;
    const blocked = world.balls.some((b) => b.mode === "field" && world.table.stageDrops.some((d) => distToSegment(b, d.a, d.b) < clear));
    if (blocked) {
      g.stageDropsResetAt = g.clock + 0.3;
    } else {
      world.stageDropsUp = world.stageDropsUp.map(() => true);
      g.stageDropsResetAt = 0;
    }
  }
  // 念のため：ターゲットが立っているのに、かこいの中に玉がいたら、ターゲットを倒して出してあげる
  if (world.dropsUp.some(Boolean) && world.balls.some((b) => b.mode === "field" && insideScoopArea(b, 535))) {
    world.dropsUp = world.dropsUp.map(() => false);
    g.dropsResetAt = g.clock + 0.7;
  }

  if (g.mode === "conquest" && g.launchQueue.length === 0 && world.balls.length <= 1 && g.phase === "play") {
    const inPlayBalls = world.balls.filter((b) => g.inPlay.has(b.id) || b.mode !== "field");
    if (inPlayBalls.length <= 1) endConquest(g);
  }

  if (g.phase === "bonus" && g.clock >= g.bonusUntil) nextBall(g);
}

/** 点から線分までの近さ */
function distToSegment(q: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(q.x - a.x - dx * t, q.y - a.y - dy * t);
}

/** 玉がガチャ穴のかこいの中（とその下の bottom まで）にいるか */
function insideScoopArea(b: Ball, bottom: number): boolean {
  return b.x > 195 && b.x < 285 && b.y > 405 && b.y < bottom;
}

/* ---------- 1フレーム ---------- */

/**
 * dtReal 秒（実際の時間）ぶん進める。スロー中は台の時間がゆっくり進む。
 * 画面が重くて遅れたぶんは、追いつこうとせずに捨てる（玉がワープしないように）。
 */
export function stepGame(g: Game, dtReal: number): void {
  if (g.phase === "over") return;
  const dt = Math.min(0.05, Math.max(0, dtReal));
  g.clock += dt;
  if (g.started) g.playTime += dt;
  const scale = g.speed * (g.clock < g.slowUntil ? SLOW_SCALE : 1);
  g.simAcc += dt * scale;
  let steps = Math.floor(g.simAcc / STEP);
  if (steps > 60) {
    steps = 60;
    g.simAcc = 0;
  } else {
    g.simAcc -= steps * STEP;
  }
  for (let i = 0; i < steps; i += 1) {
    stepWorld(g.world, 1);
    if (g.world.events.length) {
      const events = g.world.events;
      g.world.events = [];
      for (const e of events) handleEvent(g, e);
    }
    if (g.mode === "normal" && g.phase !== "bonus") checkPickups(g);
  }
  relocateItems(g);
  tick(g);
}

/** 演出を取り出す（取り出したぶんは消える） */
export function takeFx(g: Game): GameFx[] {
  const out = g.fx;
  g.fx = [];
  return out;
}
