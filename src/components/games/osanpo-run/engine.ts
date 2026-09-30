/**
 * おさんぽフレンチーのゲーム本体。
 * =============================================================
 * キャンバスの描画・当たり判定・音・メニュー操作をまとめて持つ。
 * React 側（osanpo-run-game.tsx）は画面の骨組みを描くだけで、
 * createOsanpoRun() が data-osr 属性の付いた要素を探して動かす。
 * 戻り値の関数を呼ぶと、ループ・イベント・音をすべて片付ける。
 */
import { getAudioContext, resumeAudioContext } from "@/lib/audio-context";
import { isTrickKind, newTrickRun, newTrickStats, recordTrickClear, trickPose, TRICK_SPECS, TRICK_WARNING, type TrickKind, type TrickStats } from "@/lib/games/osanpo-run/tricks";
import { DOG_SKIN_IDS, getDogSkin } from "@/lib/dog-skins";
import type { GachaRarity } from "@/lib/gacha/config";
import { GACHA_RARITIES } from "@/lib/gacha/config";
import {
  isBarrierRarity,
  isOsanpoRunStageId,
  MEMORY_SIGN_PTS,
  NEIGHBOR_LEVELS,
  NEIGHBOR_NAME_MAX,
  neighborLevel,
  OSANPO_RUN_NEIGHBOR_DEFAULT_NAMES,
  PUDDLE_STOMP_PTS,
  SNIFF_REWARDS,
  OSANPO_RUN_ACHIEVEMENTS,
  OSANPO_RUN_HINTS,
  OSANPO_RUN_RANKS,
  OSANPO_RUN_ROUTE_DESC,
  OSANPO_RUN_ROUTE_SEC,
  OSANPO_RUN_ROUTES,
  OSANPO_RUN_SONGS,
  OSANPO_RUN_STAGE_IDS,
  OSANPO_RUN_STAGES,
  OSANPO_RUN_STEP_BOOSTS,
  OSANPO_RUN_STORAGE_PREFIX,
  RARITY_STYLES,
  STEP_BOOST_MUL,
  STEP_BOOST_SEC,
  stepBoostLevel,
  type OsanpoRunHintId,
  type OsanpoRunRouteKind,
  type OsanpoRunStage,
  type OsanpoRunStageId,
} from "@/lib/games/osanpo-run/config";
import { MISSION_ALL_BONUS, MISSION_COINS, type OsanpoRunMission, type OsanpoRunMissionMetric } from "@/lib/games/osanpo-run/missions";
import {
  OSANPO_RUN_SKILL_BY_ID,
  OSANPO_RUN_SKILL_MAX_LEVEL,
  OSANPO_RUN_SKILLS,
  SKILL_KIND_COLORS,
  SKILL_KIND_LABELS,
  skillValue,
  type Buff,
  type Fx,
  type ItemFilter,
  type Lv,
  type ObsGroup,
  type OsanpoRunSkill,
  type SkillKind,
  type SpawnShape,
} from "@/lib/games/osanpo-run/skills";
import {
  DEFAULT_BGM_VOLUME,
  getBgmVolume,
  getTapVolume,
  SOUND_SETTINGS_EVENT,
  sliderToGain,
} from "@/lib/sound-settings";
import {
  drawSuitcase, drawSurpriseBox, drawDeliveryDrone,
  drawBike, drawBuddy, drawCat, drawCone, drawCrow, drawDropper, drawGeyser, drawGoldfishTub, drawKakigoriFlag, drawLog, drawNoren, drawPigeons, drawRoller,
  drawPuddle, drawRock, drawSign, drawSignpost, drawSled, drawSnowman, drawWatermelon,
  ell, font, glow, hex, hslRgb, mix, rgb, rr, setCanvasFontFamily, shade, star, WHITE,
  type Ctx, type Pigeon, type RGB,
} from "./draw";
import { drawRouteGate, drawRouteScene as drawRouteSceneLayer, ROUTE_GATE_HALF, type RouteTheme } from "./route-scene";
import { drawSkyLife, drawStageGround, drawStageMid, drawStageNear, type MidItem, type NearItem, type StageView } from "./stage-scene";

export type RunItem = {
  id: string;
  name: string;
  category: string;
  series: string | null;
  rarity: GachaRarity;
  /** 小さく最適化した画像のURL */
  src: string;
  /** 図鑑のスキルLv（1〜5）。スキルの強さが変わる */
  level: number;
};

/** 1回のおさんぽの結果（サーバーへ送ってスコアの記録とコインの受け取りをする） */
/** 別画面を開いたときに送る合図（detail に画面の名前）。React 側で描いている画面の読み直しに使う */
export const OSANPO_RUN_SHEET_OPEN_EVENT = "osanpo-run-sheet-open";

export type OsanpoRunResult = { roundId: string; stage: OsanpoRunStageId; score: number; meters: number; items: number };

export type OsanpoRunOptions = {
  /** おさんぽが終わったときに呼ぶ。もらえたコインの枚数を返す（記録できなかったときは null） */
  onRunEnd?: (result: OsanpoRunResult) => Promise<number | null>;
  /** 道に落ちるアイテム（基本は持っているアイテム） */
  items: RunItem[];
  /** 持っているアイテムが少なく、見本のアイテムを混ぜているか */
  usesSampleItems: boolean;
  unlockedStages: OsanpoRunStageId[];
  bodyFontFamily: string;
  seriesTabs: { id: string; name: string }[];
  categoryLabels: Record<string, string>;
  /** アプリに同期した今日の歩数（未同期は null）。歩数ブーストに使う */
  todaySteps?: number | null;
  /** 今日のミッション3つと、今日もう達成したもののID */
  missions?: OsanpoRunMission[];
  missionsDone?: string[];
  /** ミッションを達成したときに呼ぶ。もらえたコインの枚数を返す（記録できなかったときは null） */
  onMissionClear?: (missionId: string) => Promise<number | null>;
  /** 飛行機が空を運んでくる自分のおでかけ写真（縦長は縦向き、横長は横向きの枠になる） */
  memoryPhotos?: { src: string; name: string; pref: string }[];
};

type Pose = "walk" | "trot" | "walk-tail" | "cheer" | "smile" | "bow-b" | "stand-happy" | "wave" | "sleep" | "lie-wave" | "bow";
const POSES: readonly Pose[] = ["walk", "trot", "walk-tail", "cheer", "smile", "bow-b", "stand-happy", "wave", "sleep", "lie-wave", "bow"];
const RUN_CYCLE: readonly Pose[] = ["walk", "trot", "walk-tail", "trot"];
/** 道で会うほかのフレブルの歩き（2コマ） */
const BUDDY_POSES: readonly Pose[] = ["walk", "trot"];
const DOG_W = 300, DOG_H = 254, DOG_FOOT = 240;
const DW = 80, DH = (DW * DOG_H) / DOG_W;
const GRAV = 2500, JUMP_V = 760, DJUMP_V = 640;
/** スキルなしで空中で追加できるジャンプの回数（2 = 3段ジャンプ） */
const BASE_AIR_JUMPS = 2;
/** 道に落ちているもののうち、図鑑アイテムになる割合（残りはほね）。ボーナスタイムは多め */
const ITEM_RATE = 0.12, ITEM_RATE_BONUS = 0.25;
/** 分かれ道：上の道でアイテムになる割合に足す分 / 下の道でSR以上が出やすくなる倍率 */
const ROUTE_CALM_ITEM_BONUS = 0.08, ROUTE_RISKY_RARE = 2.5;
/** 水が出たり止まったりするところ: 1周の秒数・出ている秒数・水の高さ（ふつうのジャンプでは越えられず、2段ジャンプなら越えられる） */
const GEYSER_CYCLE = 1.4, GEYSER_ON = 0.8, GEYSER_H = 124;
/** 上から落ちてくるものの重力 */
const DROP_G = 1400;
/** 空から降ってくるアイテムが、落ちている間に左へ流れる速さ（道の速さに対する割合） */
const FALL_DRIFT = 0.3;
/** ほね1本の点数（コンボ倍率がかかる） */
const BONE_PTS = 5;
/** 歩いた1mあたりの点 */
const METER_PTS = 10;
const hexRgbStr = (h: string) => { const [r, g, b] = hex(h); return `${r},${g},${b}`; };
/** 走る速さ（論理px/秒）。最初はゆっくりで、約3分かけて最高速になる */
const START_SPEED = 200, MAX_SPEED = 520;
/**
 * 背景の流れる速さ。道の速さ（最高520）をそのまま使うと奥の建物まで速く流れて酔いやすいので、
 * 上限 BG_SPEED_MAX を超えないようにしてから BG_SPEED_RATE を掛け、BG_EASE でゆっくり追いつかせる
 */
const BG_SPEED_MAX = 320, BG_SPEED_RATE = 0.75, BG_EASE = 1.5;

type GameState = "ready" | "intro" | "play" | "dying" | "over";
type Section = "normal" | "bonus" | "rush";
/**
 * 分かれ道のあとの道。gate（入口ゲート）を過ぎると on になり、t 秒たつと exit（出口ゲート）を置く。
 * 出口を過ぎると off に戻り、景色が画面の外へ流れきったら消す。位置はどれも S.dist と同じ単位
 */
type RouteState = { kind: OsanpoRunRouteKind; t: number; gate: number; exit: number | null; on: boolean };
/**
 * roller=転がってくるもの / drop=上から落ちてくるもの / buddy=ほかのわんこ（ぶつかってもOK）/
 * geyser=水が出たり止まったりするところ
 */
type ObstacleKind = "cone" | "puddle" | "bike" | "crow" | "cat" | "sign" | "pigeons" | "noren" | "roller" | "drop" | "buddy" | "geyser" | TrickKind;

type Obstacle = {
  kind: ObstacleKind;
  x: number; y: number; w: number; h: number;
  vx: number; low: boolean;
  hit: boolean; scored: boolean; hinted: boolean; minClear: number;
  ky: number; kvy: number; rot: number; spin: number;
  birds: Pigeon[]; flee: boolean; fleeT: number;
  /** スキルで消えた（水たまりを砂場にした等） / すり抜けて点をもらった */
  gone: boolean; passed: boolean;
  /** 落ちてくるものの落下速度 / 着地したか。水のタイミングのずれ・わんこの毛色にも使う */
  vy: number; landed: boolean; phase: number;
  /** ほかのわんこにあいさつ済みか */
  greeted: boolean;
  /** 仕掛けの経過秒と予告開始からの秒数（-1: 接近前）。 */
  age: number; activeTime: number;
  /** 実際の重なり中に観測した回避方法。接触で助かった場合は称号に数えない。 */
  assisted: boolean; over: boolean; under: boolean; ducked: boolean;
};
/** item が null のものはスキルで出る小さな粒（token の点数だけもらえる） */
/** look: 天気イベントで降ってくる花びら・紅葉の見た目（ふだんは空） */
type Pickup = { item: RunItem | null; token: number; x: number; y: number; vy: number; ph: number; taken: boolean; hinted: boolean; look: "" | "petal" | "leaf" };
/** 天気のイベント（虹・雷・桜吹雪・紅葉・オーロラ）。mul はそのあいだのスコア倍率 */
type WeatherKind = "rainbow" | "thunder" | "sakura" | "momiji" | "aurora";
type WeatherEvent = { kind: WeatherKind; t: number; max: number; acc: number; mul: number; nextBolt: number };
type ActiveBuff = { skill: OsanpoRunSkill; b: Buff; lv: number; key: string; t: number; max: number; count: number; acc: number; rampN: number; rainAcc: number; rainN?: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; kind: "dust" | "spark" | "ring" | "splash" | "fw" | "drop" | "crown"; color: string; g: number; scroll: boolean };
type FloatText = { x: number; y: number; text: string; color: string; size: number; life: number; max: number };
type Flyer = { item: RunItem; x0: number; y0: number; t: number };
type Env = { m: number; top: RGB; bot: RGB; far: RGB; mid: RGB; near: RGB; night: number; side: RGB; road: RGB };

type Layer<T> = { f: number; items: T[]; nx: number };

type Stats = { pigeons: number; slides: number; plays: number; meters: number; items: number; kinds: string[]; counts: Record<string, number>; rollers: number; drops: number; greets: number; geysers: number; tricks: TrickStats };
type RunRecord = { s: number; m: number; t: number };

/* ---------- 小さな道具 ---------- */
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function pickWeighted<T>(options: readonly (readonly [T, number])[]): T {
  let total = 0;
  for (const [, w] of options) total += w;
  let r = Math.random() * total;
  for (const [v, w] of options) {
    r -= w;
    if (r < 0) return v;
  }
  return options[0]![0];
}
function pickOne<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}
const store = {
  get(key: string): string | null {
    try { return window.localStorage.getItem(OSANPO_RUN_STORAGE_PREFIX + key); } catch { return null; }
  },
  set(key: string, value: string): void {
    try { window.localStorage.setItem(OSANPO_RUN_STORAGE_PREFIX + key, value); } catch { /* 保存できない環境では記録しない */ }
  },
};
function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = store.get(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/* ---------- 時間帯の色 ---------- */
const KF = ([
  [0, "#0d1030", "#23285a", "#1e2250", "#171a3f", "#0f1130", 1],
  [300, "#141a46", "#4a4a86", "#262a5c", "#1b1e48", "#111434", 0.9],
  [370, "#5f6fb8", "#ffc39b", "#7b77ab", "#4f4f86", "#2c2c58", 0.35],
  [480, "#5aa8e6", "#cdeaf7", "#9cc1dc", "#7d9cbc", "#4d5f82", 0],
  [960, "#5aa8e6", "#cdeaf7", "#9cc1dc", "#7d9cbc", "#4d5f82", 0],
  [1040, "#4d58a8", "#ffb489", "#9a87b3", "#6e5f93", "#3a3263", 0.12],
  [1110, "#2b2f70", "#e0798a", "#5d4d86", "#40376b", "#241f48", 0.55],
  [1190, "#121538", "#2e2f66", "#23265a", "#191b45", "#101233", 1],
  [1440, "#0d1030", "#23285a", "#1e2250", "#171a3f", "#0f1130", 1],
] as const).map((k) => ({ m: k[0], top: hex(k[1]), bot: hex(k[2]), far: hex(k[3]), mid: hex(k[4]), near: hex(k[5]), night: k[6] }));
const SIDE_D = hex("#cbc3d8"), SIDE_N = hex("#4a4572"), ROAD_D = hex("#666a86"), ROAD_N = hex("#1f1e3c");

function envAt(min: number): Env {
  const m = ((min % 1440) + 1440) % 1440;
  let i = 0;
  while (i < KF.length - 2 && KF[i + 1]!.m <= m) i++;
  const a = KF[i]!, b = KF[i + 1]!;
  let t = (m - a.m) / (b.m - a.m);
  t = t * t * (3 - 2 * t);
  const night = a.night + (b.night - a.night) * t;
  return {
    m, night,
    top: mix(a.top, b.top, t), bot: mix(a.bot, b.bot, t), far: mix(a.far, b.far, t), mid: mix(a.mid, b.mid, t), near: mix(a.near, b.near, t),
    side: mix(SIDE_D, SIDE_N, night), road: mix(ROAD_D, ROAD_N, night),
  };
}
const fmtClock = (min: number) => {
  const m = Math.floor(((min % 1440) + 1440) % 1440);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
};
const phaseName = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return m < 300 ? "深夜" : m < 420 ? "夜明け" : m < 660 ? "朝" : m < 960 ? "昼" : m < 1080 ? "夕方" : m < 1170 ? "日暮れ" : "夜";
};

export function createOsanpoRun(root: HTMLElement, opts: OsanpoRunOptions): () => void {
  const $ = <T extends HTMLElement = HTMLElement>(name: string): T => {
    const el = root.querySelector<T>(`[data-osr="${name}"]`);
    if (!el) throw new Error(`osanpo-run: missing element ${name}`);
    return el;
  };
  const $$ = <T extends HTMLElement = HTMLElement>(selector: string): T[] => Array.from(root.querySelectorAll<T>(selector));
  const cleanups: (() => void)[] = [];
  function on<K extends keyof WindowEventMap>(target: Window, type: K, fn: (e: WindowEventMap[K]) => void, options?: AddEventListenerOptions): void;
  function on<K extends keyof DocumentEventMap>(target: Document, type: K, fn: (e: DocumentEventMap[K]) => void, options?: AddEventListenerOptions): void;
  function on<K extends keyof HTMLElementEventMap>(target: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void, options?: AddEventListenerOptions): void;
  function on(target: EventTarget, type: string, fn: (e: never) => void, options?: AddEventListenerOptions): void {
    const listener = fn as unknown as EventListener;
    target.addEventListener(type, listener, options);
    cleanups.push(() => target.removeEventListener(type, listener, options));
  }

  setCanvasFontFamily(opts.bodyFontFamily);
  const stageEl = $("stage");
  const cvs = $<HTMLCanvasElement>("canvas");
  const ctxOrNull = cvs.getContext("2d");
  if (!ctxOrNull) return () => {};
  const ctx: Ctx = ctxOrNull;
  const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- アイテム ---------- */
  const ITEMS = opts.items;
  const itemImages = new Map<string, HTMLImageElement>();
  for (const item of ITEMS) {
    const img = new Image();
    img.decoding = "async";
    img.src = item.src;
    itemImages.set(item.id, img);
  }
  const byRarity = new Map<GachaRarity, RunItem[]>();
  for (const r of GACHA_RARITIES) byRarity.set(r, []);
  for (const item of ITEMS) byRarity.get(item.rarity)!.push(item);
  const rarityWeights = GACHA_RARITIES.filter((r) => byRarity.get(r)!.length > 0).map((r) => [r, RARITY_STYLES[r].weight] as const);
  const rarityIndex = (r: GachaRarity) => GACHA_RARITIES.indexOf(r);
  const rainItems = ITEMS.filter((it) => /水|虹|ブーツ|長靴|傘|雨/.test(it.name));
  const seriesItems = (series: string | null) => (series ? ITEMS.filter((it) => it.series === series) : []);

  function rollItem(): RunItem {
    // スキル「おもちじゃない...!?」「ごちゃまぜ」「高級魚」
    if (K.lucky.length) {
      const hit = K.lucky.shift()!, top = [...byRarity.get("MR")!, ...byRarity.get("LR")!];
      if (hit && top.length) return pickOne(top);
    }
    if (K.reroll > 0) {
      K.reroll--;
      return pickOne(byRarity.get(pickOne(rarityWeights.map(([r]) => r)))!);
    }
    if (K.rare > 1) {
      const boosted = rarityWeights.map(([r, w]) => [r, rarityIndex(r) >= 4 ? w * K.rare : w] as const);
      if (Math.random() < 0.7) return pickOne(byRarity.get(pickWeighted(boosted))!);
    }
    if (routeOn() === "risky") {
      const boosted = rarityWeights.map(([r, w]) => [r, rarityIndex(r) >= 2 ? w * ROUTE_RISKY_RARE : w] as const);
      return pickOne(byRarity.get(pickWeighted(boosted))!);
    }
    const stageSeries = seriesItems(STAGE.series);
    if (S.rain > 0.3 && rainItems.length && Math.random() < 0.35) return pickOne(rainItems);
    if (stageSeries.length && Math.random() < 0.3) return pickOne(stageSeries);
    return pickOne(byRarity.get(pickWeighted(rarityWeights))!);
  }
  function drawItemImg(c: Ctx, item: RunItem, x: number, y: number, size: number): void {
    const img = itemImages.get(item.id);
    if (!img || !img.complete || !img.naturalWidth) {
      c.fillStyle = "rgba(255,255,255,.5)"; c.beginPath(); c.arc(x, y, size * 0.3, 0, Math.PI * 2); c.fill();
      return;
    }
    const k = Math.min(size / img.naturalWidth, size / img.naturalHeight);
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    c.drawImage(img, x - w / 2, y - h / 2, w, h);
  }
  function spriteEl(item: RunItem, size: number, reveal = true, lazy = false): HTMLImageElement {
    const el = document.createElement("img");
    el.className = "osr-spr";
    el.src = item.src;
    el.alt = reveal ? item.name : "";
    el.width = size; el.height = size;
    // アプリ共通の img { height: auto } に負けないよう、枠の大きさを直接指定する
    el.style.width = `${size}px`; el.style.height = `${size}px`;
    el.loading = lazy ? "lazy" : "eager"; el.decoding = "async"; el.draggable = false;
    return el;
  }

  /* ---------- 犬（ステージごとのスキン） ---------- */
  const unlocked = new Set<OsanpoRunStageId>(opts.unlockedStages.length ? opts.unlockedStages : ["town"]);
  unlocked.add("town");
  const dogImages = new Map<string, HTMLImageElement>();
  const dogSrc = (skin: string, pose: Pose) => `/characters/${skin}/${pose}.webp`;
  function dogImage(skin: string, pose: Pose): HTMLImageElement {
    const key = `${skin}/${pose}`;
    let img = dogImages.get(key);
    if (!img) {
      img = new Image();
      img.decoding = "async";
      img.src = dogSrc(skin, pose);
      dogImages.set(key, img);
    }
    return img;
  }
  const preloadSkin = (skin: string) => POSES.forEach((p) => dogImage(skin, p));
  function setDogSprite(el: HTMLImageElement, skin: string, pose: Pose): void {
    el.src = dogSrc(skin, pose);
  }

  /* ---------- ステージ ---------- */
  const savedStage = store.get("stage");
  let STAGE_ID: OsanpoRunStageId = isOsanpoRunStageId(savedStage) && unlocked.has(savedStage) ? savedStage : "town";
  let STAGE: OsanpoRunStage = OSANPO_RUN_STAGES[STAGE_ID];
  preloadSkin(STAGE.skin);
  // 道で会う「ほかのわんこ」は、図鑑にいるフレブル（いつもの・登山・雪国・夏）からランダム。持っていなくても出る
  for (const skin of DOG_SKIN_IDS) for (const p of BUDDY_POSES) dogImage(skin, p);

  /* ---------- 記録（この端末に保存） ---------- */
  const achGot = loadJSON<Record<string, number>>("ach", {});
  const stats: Stats = Object.assign(
    { pigeons: 0, slides: 0, plays: 0, meters: 0, items: 0, kinds: [] as string[], counts: {} as Record<string, number>, rollers: 0, drops: 0, greets: 0, geysers: 0, tricks: newTrickStats() },
    loadJSON<Partial<Stats>>("stats", {}),
  );
  const kindSet = new Set<string>(stats.kinds);
  /* ---------- ご近所さん（名前となかよし度。この端末に保存） ---------- */
  type DogSkin = (typeof DOG_SKIN_IDS)[number];
  const neighbors = Object.assign({ names: {} as Partial<Record<DogSkin, string>>, greets: {} as Partial<Record<DogSkin, number>> }, loadJSON<{ names?: Partial<Record<DogSkin, string>>; greets?: Partial<Record<DogSkin, number>> }>("neighbors", {}));
  const saveNeighbors = () => store.set("neighbors", JSON.stringify(neighbors));
  const neighborName = (skin: DogSkin) => (neighbors.names[skin] ?? "").trim() || OSANPO_RUN_NEIGHBOR_DEFAULT_NAMES[skin];
  const neighborGreets = (skin: DogSkin) => neighbors.greets[skin] ?? 0;
  const saveStats = () => { stats.kinds = [...kindSet]; store.set("stats", JSON.stringify(stats)); };
  const bestOf = (id: OsanpoRunStageId) => Number(store.get(`best-${id}`) ?? 0) || 0;
  const bestDistOf = (id: OsanpoRunStageId) => Number(store.get(`bestd-${id}`) ?? 0) || 0;
  const recordsOf = (id: OsanpoRunStageId) => loadJSON<RunRecord[]>(`rec-${id}`, []);
  const SET = Object.assign({ bgm: true, sfx: true, vib: true }, loadJSON<Partial<{ bgm: boolean; sfx: boolean; vib: boolean }>>("settings", {}));
  let muted = store.get("muted") === "1";

  /* ---------- 状態 ---------- */
  let DPR = 1, SC = 1, VW = 533, VH = 300, GROUND = 236;
  /** においかぎの「くんくんマーク」。x は画面の位置で、道と同じ速さで流れる */
  type Sniff = { x: number; dug: boolean; hinted: boolean; ph: number };
  let sniffs: Sniff[] = [];
  /** 急降下で着地した時刻（水たまりスタンプの判定に使う） */
  let stompAt = -1;
  const P = {
    x: 96, y: GROUND, vy: 0, ground: true, jumps: 2, sq: 1, ph: 0, rot: 0, inv: 0, dead: false, dustT: 0,
    slide: false, slideT: 0, slideHeld: false, jumpAt: -1,
    /** 空中で下スワイプした（急降下中）。この状態で着地すると水たまりを踏める */
    dive: false,
  };
  const S = {
    state: "ready" as GameState, time: 0, t: 0, speed: 90, dist: 0, bonus: 0, treats: 0, clock: STAGE.clock, cam: 0, bgCam: 0, bgV: 0,
    srPlus: 0, pigeonsRun: 0, slidesRun: 0, greetsRun: 0, routeCalm: 0, routeRisky: 0, bonusBest: 0, missionCoins: 0, missionsNow: [] as string[], stomps: 0, digs: 0,
    memo: null as null | { x: number; y: number; photo: number; passed: boolean; t: number }, memoT: 13,
    stepT: 0, fork: null as null | { at: number }, route: null as null | RouteState, forkT: 40,
    next: 400, shield: false, chain: 0, chainT: 0, mult: 1, maxMult: 1, paused: false, deadT: 0, introT: 0,
    haul: new Map<string, number>(), happyT: 0, calm: store.get("calm") === "1",
    sec: "normal" as Section, secT: 18, rain: 0, rainTarget: 0, rainT: 0,
    bones: 0, newAch: [] as string[], newKinds: [] as string[], rainWalk: 0, rushes: 0, closes: 0, bonusGot: 0,
    best: 0, bestD: 0, passedBest: false, recordShown: false, milestone: 100, bufT: 0, fwT: 2,
    lastResult: null as null | { score: number; m: number; items: number; rank: string },
    /** このおさんぽの識別子。同じ結果を二重に送ってもコインが増えないよう、サーバー側で使う */
    roundId: "",
    /** ほかのわんこにあいさつして立ち止まっている残り秒数 */
    slowT: 0,
    /** 天気のイベント（なければ null）と、次のイベントまでの秒数 */
    wx: null as WeatherEvent | null, wxT: 30,
    /** 称号用: このおさんぽで無敵中に吹っ飛ばした数・拾ったUR以上の数・発動したスキルの種類 */
    knocks: 0, rares: 0, skillIds: new Set<string>(), tricks: newTrickRun(),
  };
  let obstacles: Obstacle[] = [], pickups: Pickup[] = [], parts: Particle[] = [], texts: FloatText[] = [], flyers: Flyer[] = [];
  const FX = { hitstop: 0, flash: 0, flashCol: "255,255,255", rareT: 0, fade: 0 };
  let FDT = 1 / 60;
  /** アイテムスキルの状態。おさんぽのたびに作り直す */
  const newSkillState = () => ({
    buffs: [] as ActiveBuff[],
    next: [] as { left: number; add: number; mul: number; up: number; dup: number; filter: ItemFilter }[],
    best: null as null | { left: number; mul: number; top: number },
    guards: [] as { n: number; t: number; kinds: ObsGroup; pts: number; after: number; name: string }[],
    clears: [] as { n: number; kinds: ObsGroup; pts: number; name: string }[],
    revives: [] as { keep: number; pts: number; mul: number; name: string }[],
    rushPass: 0, rushMul: 1, rushInv: false, forceBonus: false,
    rare: 1, nightMul: 1, runMul: 1,
    delays: [] as { t: number; pts: number; name: string }[],
    stack: 0, stackAdd: 0, cairn: 0,
    pouchMul: 0, pouchBank: 0, keepBest: 0, bestItem: 0,
    bigJumps: [] as number[], reroll: 0, lucky: [] as boolean[],
    comboGuard: 0, miss: 0, lastItem: null as RunItem | null,
    /** スピードが上がる元になる時間（「ひとやすみ」で止まり、「ゆらゆら」で0に戻る） */
    ramp: 0, textT: 0, sparkBusy: false,
  });
  let K = newSkillState();

  const bld: Layer<MidItem> = { f: 0.08, items: [], nx: -60 };
  const near: Layer<NearItem> = { f: 0.26, items: [], nx: -120 };
  const drops = Array.from({ length: 110 }, () => ({ x: Math.random(), y: Math.random(), l: rand(8, 16), v: rand(0.9, 1.2) }));
  const flies = Array.from({ length: 12 }, () => ({ x: Math.random(), y: rand(0.2, 1), p: rand(0, 6), s: rand(0.6, 1.2) }));
  const stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * 0.62, r: rand(0.4, 1.3), p: rand(0, 6) }));
  const clouds = Array.from({ length: 6 }, (_, i) => ({ x: i * 260 + rand(0, 120), y: rand(0.12, 0.42), s: rand(0.7, 1.3) }));

  function genBuilding(x: number): MidItem {
    const house = Math.random() < 0.42;
    const w = house ? rand(46, 70) : rand(54, 104), h = house ? rand(36, 58) : rand(66, 156);
    const cols = house ? (w > 58 ? 2 : 1) : Math.max(1, Math.floor((w - 12) / 13));
    const rows = house ? 1 : Math.max(1, Math.floor((h - 18) / 17));
    return {
      x, w, h, gap: rand(-8, 12), tone: rand(-0.07, 0.07), type: house ? "house" : "building", cols, rows,
      lit: Array.from({ length: cols * rows }, () => Math.random() < 0.5),
      roof: house ? "gable" : pickOne(["flat", "tank", "antenna", "flat"] as const), blink: rand(0, 6), label: "", colors: ["#fff", "#fff"],
      balcony: !house && Math.random() < 0.55,
    };
  }
  function genMid(x: number): MidItem {
    const base = genBuilding(x);
    if (STAGE_ID === "hiking") {
      const pine = Math.random() < 0.6;
      return { ...base, type: pine ? "pine" : "round", w: pine ? rand(26, 40) : rand(34, 54), h: pine ? rand(60, 130) : rand(46, 80), gap: rand(-14, 4), tone: rand(-0.08, 0.08) };
    }
    if (STAGE_ID === "summer") {
      if (Math.random() < 0.12) return { ...base, type: "torii", w: 70, h: 96, gap: rand(10, 30), tone: 0 };
      return {
        ...base, type: "stall", w: rand(66, 86), h: rand(46, 56), gap: rand(6, 16), tone: rand(-0.05, 0.05),
        label: pickOne(["やきそば", "かき氷", "たこ焼き", "りんご飴", "わたあめ", "金魚すくい", "ヨーヨー釣り", "射的"]),
        colors: pickOne([["#D63A3A", "#FFFFFF"], ["#2F6FD0", "#FFFFFF"], ["#E88A1A", "#FFF3D6"], ["#2E9A6A", "#FFFFFF"]] as const).slice() as [string, string],
      };
    }
    if (STAGE_ID === "snow" && base.type === "building" && Math.random() < 0.35) {
      const alt = genBuilding(x);
      if (alt.type === "house") return alt;
    }
    return base;
  }
  const genNear = (x: number): NearItem => ({ x, w: 6, gap: rand(230, 320), lamp: Math.random() < 0.6, vend: Math.random() < 0.3, tr: Math.random() < 0.35 });
  function fillLayer<T extends { x: number; w: number; gap: number }>(L: Layer<T>, gen: (x: number) => T, keep: number): void {
    const off = S.bgCam * L.f;
    while (L.nx < off + VW + 200) {
      const it = gen(L.nx);
      L.items.push(it);
      L.nx = it.x + it.w + it.gap;
    }
    while (L.items.length > 2 && L.items[1]!.x + keep < off) L.items.shift();
  }

  /* ---------- 画面サイズ ---------- */
  function resize(): void {
    const r = stageEl.getBoundingClientRect();
    if (!r.width || !r.height) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    cvs.width = Math.round(r.width * DPR);
    cvs.height = Math.round(r.height * DPR);
    SC = Math.min(r.width / 380, r.height / 300);
    VW = r.width / SC; VH = r.height / SC;
    const g2 = VH - Math.max(64, Math.round(VH * 0.2)), d = g2 - GROUND;
    GROUND = g2;
    P.y += d;
    for (const o of obstacles) if (o.kind === "crow" || o.kind === "drop" || isTrickKind(o.kind)) o.y += d;
    for (const it of pickups) it.y += d;
    for (const p of parts) p.y += d;
    for (const t of texts) t.y += d;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(stageEl);
  cleanups.push(() => ro.disconnect());
  resize();

  /* ---------- 音 ---------- */
  type AudioRig = { ac: AudioContext; master: GainNode; sfx: GainNode; bgm: GainNode; noise: AudioBuffer };
  let A: AudioRig | null = null;
  function ensureAudio(): void {
    if (!A) {
      try {
        const ac = getAudioContext();
        const master = ac.createGain(), sfx = ac.createGain(), bgm = ac.createGain();
        master.connect(ac.destination); sfx.connect(master); bgm.connect(master);
        const noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.5), ac.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        A = { ac, master, sfx, bgm, noise };
        applyAudio();
      } catch {
        A = null;
      }
    }
    void resumeAudioContext();
  }
  /** アプリ全体の音量設定（BGM・タップ音のスライダー）にも合わせる */
  function applyAudio(): void {
    if (!A) return;
    const bgmSlider = getBgmVolume();
    const bgmScale = bgmSlider <= 0 ? 0 : Math.min(1.5, sliderToGain(bgmSlider) / sliderToGain(DEFAULT_BGM_VOLUME));
    A.master.gain.value = muted || S.paused ? 0 : 0.9;
    A.sfx.gain.value = SET.sfx ? sliderToGain(getTapVolume()) : 0;
    A.bgm.gain.value = SET.bgm ? bgmScale : 0;
  }
  const onSoundSettings = () => applyAudio();
  window.addEventListener(SOUND_SETTINGS_EVENT, onSoundSettings);
  cleanups.push(() => window.removeEventListener(SOUND_SETTINGS_EVENT, onSoundSettings));
  function tone(f: number, dur: number, type: OscillatorType = "square", vol = 0.06, to: number | null = null, delay = 0): void {
    if (!A || muted || !SET.sfx) return;
    const { ac } = A;
    const t0 = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g); g.connect(A.sfx); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur: number, vol = 0.12, freq = 1200): void {
    if (!A || muted || !SET.sfx) return;
    const { ac } = A;
    const t0 = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = A.noise; f.type = "lowpass"; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(A.sfx); s.start(t0); s.stop(t0 + dur);
  }
  const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
  function noteAt(rig: AudioRig, f: number, t0: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode): void {
    const o = rig.ac.createOscillator(), g = rig.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function drum(rig: AudioRig, t0: number, f0: number, f1: number, dur: number, vol: number, dest: AudioNode): void {
    const o = rig.ac.createOscillator(), k = rig.ac.createGain();
    o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.85);
    k.gain.setValueAtTime(vol, t0); k.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(k); k.connect(dest); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function hat(rig: AudioRig, t0: number, vol: number, dest: AudioNode, hp = 7000, dur = 0.04): void {
    const n = rig.ac.createBufferSource(), f = rig.ac.createBiquadFilter(), k = rig.ac.createGain();
    n.buffer = rig.noise; f.type = "highpass"; f.frequency.value = hp;
    k.gain.setValueAtTime(vol, t0); k.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    n.connect(f); f.connect(k); k.connect(dest); n.start(t0); n.stop(t0 + dur + 0.01);
  }
  const BGM = { on: false, step: 0, next: 0, bpm: 120, gain: null as GainNode | null };
  function bgmStep(rig: AudioRig, g: GainNode, i: number, t0: number, spb: number): void {
    const song = OSANPO_RUN_SONGS[STAGE_ID], bar = (i >> 4) & 3, st = i & 15, root = song.roots[bar as 0 | 1 | 2 | 3], m = song.melody[i] ?? 0;
    if (song.kit === "bell") {
      if (m) { noteAt(rig, mtof(m), t0, spb * 3.4, "sine", song.level, g); noteAt(rig, mtof(m + 12), t0, spb * 1.6, "sine", song.level * 0.3, g); }
      if (st === 0 || st === 8) noteAt(rig, mtof(root), t0, spb * 7, "sine", 0.11, g);
      if (st % 4 === 2) noteAt(rig, mtof(root + 12 + (st % 8 === 6 ? 7 : 0)), t0, spb * 1.4, "triangle", 0.03, g);
      if (st === 4 || st === 12) hat(rig, t0, 0.018, g, 9000, 0.08);
      return;
    }
    if (m) noteAt(rig, mtof(m), t0, spb * 1.8, song.lead, song.level, g);
    if (song.kit === "matsuri") {
      if (st === 0 || st === 3 || st === 8 || st === 11) { drum(rig, t0, 150, 55, 0.28, st % 8 === 0 ? 0.24 : 0.14, g); hat(rig, t0, 0.03, g, 300, 0.06); }
      if (st % 4 === 2) { noteAt(rig, 1760, t0, 0.05, "square", 0.018, g); noteAt(rig, 2637, t0, 0.04, "square", 0.01, g); }
      if (st === 0 || st === 8) noteAt(rig, mtof(root), t0, spb * 3, "triangle", 0.11, g);
      if (st === 6 || st === 14) hat(rig, t0, 0.05, g, 2500, 0.03);
      return;
    }
    if (st === 0 || st === 6 || st === 8 || st === 14) noteAt(rig, mtof(root + (st === 8 ? 12 : 0)), t0, spb * 1.6, "triangle", 0.13, g);
    if (song.kit === "folk") {
      if (st % 4 === 0) [12, 16, 19].forEach((d, k) => noteAt(rig, mtof(root + d), t0 + k * 0.018, spb * 1.2, "triangle", 0.028, g));
      if (st === 0 || st === 8) drum(rig, t0, 110, 50, 0.12, 0.14, g);
      if (st === 4 || st === 12) hat(rig, t0, 0.04, g, 5000, 0.05);
      return;
    }
    if (st % 4 === 2) noteAt(rig, mtof(root + 24 + 4 * (bar % 2 ? 0 : 1)), t0, spb * 0.9, "sine", 0.03, g);
    if (st === 0 || st === 8) drum(rig, t0, 130, 45, 0.14, 0.18, g);
    if (st % 2 === 1) hat(rig, t0, st % 4 === 3 ? 0.05 : 0.025, g);
  }
  function bgmTick(): void {
    if (!A || !BGM.on || S.paused) return;
    if (!BGM.gain) { BGM.gain = A.ac.createGain(); BGM.gain.gain.value = 0.55; BGM.gain.connect(A.bgm); }
    const spb = 60 / ((BGM.bpm * OSANPO_RUN_SONGS[STAGE_ID].bpm) / 120) / 4;
    const now = A.ac.currentTime;
    if (BGM.next < now) BGM.next = now + 0.05;
    while (BGM.next < now + 0.15) {
      bgmStep(A, BGM.gain, BGM.step, BGM.next, spb);
      BGM.next += spb;
      BGM.step = (BGM.step + 1) % 64;
    }
  }
  function bgmStart(): void {
    BGM.on = true; BGM.step = 0; BGM.next = 0;
    if (BGM.gain && A) { BGM.gain.gain.cancelScheduledValues(A.ac.currentTime); BGM.gain.gain.setValueAtTime(0.55, A.ac.currentTime); }
  }
  function bgmStop(): void {
    BGM.on = false;
    if (BGM.gain && A) {
      BGM.gain.gain.setValueAtTime(BGM.gain.gain.value, A.ac.currentTime);
      BGM.gain.gain.linearRampToValueAtTime(0, A.ac.currentTime + 0.4);
    }
  }
  let rainNode: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  function rainSound(): void {
    if (!A) return;
    if (!rainNode) {
      const src = A.ac.createBufferSource(), f = A.ac.createBiquadFilter(), gain = A.ac.createGain();
      src.buffer = A.noise; src.loop = true; f.type = "bandpass"; f.frequency.value = 2600; f.Q.value = 0.6; gain.gain.value = 0;
      src.connect(f); f.connect(gain); gain.connect(A.sfx); src.start(); rainNode = { src, gain };
    }
    rainNode.gain.gain.value = STAGE.weather === "snow" ? 0 : S.rain * 0.07 * (S.state === "play" || S.state === "dying" ? 1 : 0.4);
  }
  const sfx = {
    jump: () => tone(360, 0.11, "square", 0.045, 640),
    djump: () => tone(560, 0.12, "triangle", 0.07, 1040),
    item: (m: number) => { const k = 1 + (m - 1) * 0.12; tone(880 * k, 0.07, "sine", 0.08); tone(1320 * k, 0.09, "sine", 0.07, null, 0.05); },
    fanfare: () => [660, 880, 1100, 1320].forEach((f, i) => tone(f, 0.12, "triangle", 0.07, null, i * 0.06)),
    barrier: () => { tone(523, 0.3, "triangle", 0.06); tone(784, 0.3, "triangle", 0.05, null, 0.08); tone(1046, 0.35, "sine", 0.05, null, 0.16); },
    guard: () => { noise(0.2, 0.12, 2400); tone(420, 0.25, "sine", 0.08, 180); },
    crash: () => { noise(0.35, 0.2, 900); tone(220, 0.3, "square", 0.06, 55); },
    ready: () => tone(523, 0.12, "square", 0.045),
    go: () => { tone(784, 0.22, "square", 0.05); tone(1046, 0.3, "square", 0.04, null, 0.06); },
    rare: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.18, "square", 0.045, null, i * 0.07)),
    near: () => { tone(990, 0.06, "square", 0.035); tone(1480, 0.08, "square", 0.03, null, 0.05); },
    mile: () => [784, 988, 1175].forEach((f, i) => tone(f, 0.14, "triangle", 0.05, null, i * 0.07)),
    land: () => tone(140, 0.05, "sine", 0.04, 90),
    home: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, i === 3 ? 0.5 : 0.16, "triangle", 0.06, null, i * 0.13)),
    record: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.14, "square", 0.045, null, i * 0.07)); [1046, 1318, 1568].forEach((f) => tone(f, 0.7, "triangle", 0.035, null, 0.38)); },
    pass: () => [880, 1175, 1568].forEach((f, i) => tone(f, 0.12, "triangle", 0.05, null, i * 0.06)),
    title: () => [1046, 1318, 1568].forEach((f, i) => tone(f, 0.16, "triangle", 0.05, null, i * 0.08)),
    /** スキルが発動したときの音。種類ごとに変えて、聞いただけで何が起きたかわかるように */
    skill: (kind: SkillKind) => {
      const d = 0.1;
      switch (kind) {
        case "score": tone(1320, 0.08, "square", 0.035, null, d); tone(1760, 0.16, "square", 0.035, null, d + 0.07); break;
        case "guard": tone(330, 0.28, "triangle", 0.06, 880, d); tone(1318, 0.3, "sine", 0.035, null, d + 0.12); break;
        case "spawn": [1568, 1318, 1175, 1046, 784].forEach((f, i) => tone(f, 0.09, "sine", 0.05, null, d + i * 0.045)); break;
        case "jump": tone(260, 0.22, "sine", 0.08, 960, d); break;
        case "collect": noise(0.25, 0.05, 3200); tone(520, 0.25, "sine", 0.05, 1240, d); break;
        case "combo": [659, 784, 988].forEach((f, i) => tone(f, 0.1, "square", 0.035, null, d + i * 0.06)); break;
        case "weather": tone(1046, 0.5, "triangle", 0.04, null, d); tone(1568, 0.6, "sine", 0.03, null, d + 0.1); break;
        case "pace": tone(620, 0.3, "triangle", 0.05, 300, d); break;
        case "bonus": [523, 659, 784].forEach((f) => tone(f, 0.6, "sine", 0.035, null, d)); tone(1046, 0.5, "triangle", 0.03, null, d + 0.2); break;
      }
    },
  };
  function setMuted(m: boolean): void {
    muted = m; store.set("muted", m ? "1" : "0"); applyAudio();
    $("mute-waves").toggleAttribute("hidden", m);
    $("mute-x").toggleAttribute("hidden", !m);
    $("mute").setAttribute("aria-label", m ? "音を出す" : "音を消す");
  }
  setMuted(muted);

  /* ---------- 道で会うほかのフレブル ---------- */
  const buddySkin = (o: Obstacle) => DOG_SKIN_IDS[o.phase % DOG_SKIN_IDS.length]!;
  /** ほかのフレブル。こっちに向かって歩いてくる（画像はもともと左向きなので反転しない）。あいさつ後はにっこり止まってハート */
  function drawBuddySprite(c: Ctx, o: Obstacle): void {
    const pose: Pose = o.greeted ? "smile" : BUDDY_POSES[Math.floor(S.time * 7 + o.x * 0.01) % 2]!;
    const img = dogImage(buddySkin(o), pose);
    const w = DW * 0.78, h = DH * 0.78, cx = o.x + o.w / 2;
    if (!img.complete || !img.naturalWidth) { drawBuddy(c, o.x, GROUND, o.w, S.time, o.phase, o.greeted); return; }
    c.save();
    c.translate(cx, GROUND - (o.greeted ? 0 : Math.abs(Math.sin(S.time * 9 + o.x)) * 1.2));
    c.drawImage(img, -w / 2, (-h * DOG_FOOT) / DOG_H, w, h);
    c.restore();
    if (o.greeted) {
      c.fillStyle = "#FF6B8A"; c.font = font(13); c.textAlign = "center"; c.textBaseline = "middle";
      const hearts = Math.max(1, neighborLevel(neighborGreets(buddySkin(o))));
      for (let k = 0; k < hearts; k++) c.fillText("♥", cx - 6 + (k - (hearts - 1) / 2) * 11, GROUND - h - 4 - Math.abs(Math.sin(S.time * 6 + k)) * 4);
    }
    // 小さな名札（名前となかよし度）
    const skin = buddySkin(o), lv = neighborLevel(neighborGreets(skin)), label = neighborName(skin);
    c.font = font(7.5); c.textAlign = "center"; c.textBaseline = "middle";
    const lw = c.measureText(label).width + (lv > 0 ? 18 : 10), ty = GROUND + 9;
    c.fillStyle = "rgba(24,22,52,0.72)"; rr(c, cx - lw / 2, ty - 6, lw, 12, 6); c.fill();
    c.fillStyle = "#FFFFFF"; c.fillText(label, cx - (lv > 0 ? 4 : 0), ty + 0.5);
    if (lv > 0) { c.fillStyle = "#FF9EB8"; c.font = font(7); c.fillText("♥".repeat(1) + lv, cx + lw / 2 - 8, ty + 0.5); }
  }

  /* ---------- 犬の描画 ---------- */
  function drawDog(c: Ctx, x: number, y: number): void {
    const air = !P.ground && !P.dead, sliding = P.slide && P.ground && !P.dead;
    let pose: Pose;
    if (P.dead) pose = "bow-b";
    else if (sliding) pose = "bow";
    else if (S.state === "intro") pose = "stand-happy";
    else if (air) pose = P.vy < -150 ? (P.jumps === 0 ? "cheer" : "stand-happy") : "smile";
    else if (S.happyT > 0) pose = "smile";
    else pose = RUN_CYCLE[Math.floor(P.ph / (Math.PI / 2)) % 4]!;
    const bob = air || P.dead || sliding ? 0 : -Math.abs(Math.sin(P.ph)) * 1;
    const img = dogImage(STAGE.skin, pose);
    c.save();
    c.translate(x, y + bob); c.rotate(P.rot * 0.6); c.scale(1 + (1 - P.sq) * 0.5, P.sq);
    if (img.complete && img.naturalWidth) {
      // 画像は左向きなので、進行方向（右）に向けて左右反転する
      c.scale(-1, 1);
      c.drawImage(img, -DW / 2, (-DH * DOG_FOOT) / DOG_H, DW, DH);
    } else {
      c.fillStyle = "#F6EFE4"; ell(c, 0, -22, 20, 16); c.fill();
    }
    c.restore();
    if (S.shield) {
      const pulse = 1 + Math.sin(S.time * 5) * 0.04;
      c.strokeStyle = "rgba(126,240,208,.85)"; c.lineWidth = 2; c.fillStyle = "rgba(126,240,208,.08)";
      ell(c, x, y - 28, 40 * pulse, 36 * pulse); c.fill(); c.stroke();
      c.strokeStyle = "rgba(255,255,255,.55)"; c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(x, y - 28, 34 * pulse, 30 * pulse, 0, Math.PI * 1.1, Math.PI * 1.4); c.stroke();
    }
    if (P.dead) {
      for (let i = 0; i < 3; i++) {
        const a = S.time * 4 + (i * Math.PI * 2) / 3;
        star(c, x + 14 + Math.cos(a) * 18, y - 40 + Math.sin(a) * 5, 3.4, "#FFC857");
      }
    }
  }

  /* ---------- 背景 ---------- */
  function stageEnv(e: Env): Env {
    const n = e.night;
    if (STAGE_ID === "hiking") {
      e.far = mix(e.far, [96, 140, 124], 0.35 * (1 - n * 0.6)); e.mid = mix(e.mid, [58, 104, 78], 0.5 * (1 - n * 0.5)); e.near = mix(e.near, [112, 82, 62], 0.4 * (1 - n * 0.4));
      e.side = mix(hex("#C49B6C"), hex("#4B3E52"), n); e.road = mix(hex("#78A860"), hex("#28413A"), n);
    } else if (STAGE_ID === "snow") {
      e.top = mix(e.top, [196, 208, 230], 0.3 * (1 - n)); e.bot = mix(e.bot, [236, 240, 248], 0.3 * (1 - n));
      e.far = mix(e.far, [226, 233, 246], 0.5 * (1 - n * 0.5)); e.mid = mix(e.mid, [150, 160, 196], 0.25);
      e.side = mix(hex("#F2F5FC"), hex("#8E94C2"), n * 0.85); e.road = mix(hex("#D6DEEC"), hex("#5C6194"), n * 0.85);
    } else if (STAGE_ID === "summer") {
      e.side = mix(hex("#D8CCB6"), hex("#5E5270"), n); e.road = mix(hex("#5A566E"), hex("#241E3A"), n);
    }
    return e;
  }
  function drawSky(c: Ctx, e: Env): void {
    const g = c.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, rgb(e.top)); g.addColorStop(1, rgb(e.bot));
    c.fillStyle = g; c.fillRect(0, 0, VW, GROUND + 2);
    if (e.night > 0.02) {
      for (const s of stars) {
        const a = e.night * (0.55 + 0.45 * Math.sin(S.time * 2 + s.p));
        c.fillStyle = `rgba(255,248,230,${a})`; c.fillRect(s.x * VW, s.y * GROUND, s.r, s.r);
      }
    }
    const m = e.m;
    if (m > 330 && m < 1170) {
      const p = (m - 330) / 840, sx = VW * (0.06 + 0.88 * p), sy = GROUND - 30 - Math.sin(Math.PI * p) * GROUND * 0.72;
      const warm = clamp((m - 900) / 220, 0, 1) + clamp((480 - m) / 150, 0, 1);
      const col = mix(hex("#FFF4CC"), hex("#FF9460"), clamp(warm, 0, 1));
      glow(c, sx, sy, 90, `${col[0] | 0},${col[1] | 0},${col[2] | 0}`, 0.35);
      c.fillStyle = rgb(col); c.beginPath(); c.arc(sx, sy, 17, 0, Math.PI * 2); c.fill();
    }
    if (m > 1110 || m < 400) {
      const p = ((m - 1110 + 1440) % 1440) / 730, mx = VW * (0.1 + 0.8 * p), my = GROUND - 40 - Math.sin(Math.PI * p) * GROUND * 0.62;
      glow(c, mx, my, 60, "244,240,220", 0.22 * e.night);
      c.fillStyle = `rgba(244,240,220,${0.25 + 0.75 * e.night})`; c.beginPath(); c.arc(mx, my, 12, 0, Math.PI * 2); c.fill();
      c.fillStyle = `rgba(200,196,180,${0.5 * e.night})`;
      c.beginPath(); c.arc(mx - 4, my - 2, 2.6, 0, Math.PI * 2); c.arc(mx + 3, my + 4, 1.8, 0, Math.PI * 2); c.arc(mx + 4, my - 5, 1.3, 0, Math.PI * 2); c.fill();
    }
    // 地平線あたりのにじむ光（夕焼け・朝焼けで強くなる）
    const sun = sunLight(e);
    if (sun.warm > 0.02) {
      const hz = c.createLinearGradient(0, GROUND - 150, 0, GROUND);
      hz.addColorStop(0, `rgba(${sun.rgb},0)`); hz.addColorStop(1, `rgba(${sun.rgb},${0.35 * sun.warm})`);
      c.fillStyle = hz; c.fillRect(0, GROUND - 150, VW, 152);
    }
    // 高いところの薄い筋雲
    const hc = mix(e.top, WHITE, 0.3), span = Math.max(1560, VW + 400);
    c.fillStyle = rgb(hc, 0.16 * (1 - e.night * 0.6));
    for (let i = 0; i < 4; i++) {
      const x = ((((i * 420 + 60 - S.bgCam * 0.004) % span) + span) % span) - 200, y = GROUND * (0.08 + i * 0.05);
      ell(c, x, y, 90, 2.2, -0.04); c.fill();
      ell(c, x + 50, y + 5, 60, 1.6, -0.04); c.fill();
    }
    // もこもこの雲。下側は空の色、上側は光の色で陰影をつける
    const lit = mix(mix(e.bot, WHITE, 0.55), hex("#FFD2A8"), sun.warm * 0.6), dark = mix(e.top, e.bot, 0.55);
    const ca = 0.62 - e.night * 0.36;
    for (const cl of clouds) {
      const x = ((((cl.x - S.bgCam * 0.008) % span) + span) % span) - 200, y = cl.y * GROUND, s = cl.s;
      const lobes = [[0, 0, 34, 9], [18, -7, 20, 10], [-14, -4, 17, 8], [34, -1, 14, 6]] as const;
      c.fillStyle = rgb(dark, ca); c.beginPath();
      for (const [dx, dy, rx, ry] of lobes) { c.moveTo(x + (dx + rx) * s, y + (dy + 2) * s); c.ellipse(x + dx * s, y + (dy + 2) * s, rx * s, ry * s, 0, 0, Math.PI * 2); }
      c.fill();
      c.fillStyle = rgb(lit, ca); c.beginPath();
      for (const [dx, dy, rx, ry] of lobes) { c.moveTo(x + (dx + rx * 0.9) * s, y + (dy - 1) * s); c.ellipse(x + dx * s, y + (dy - 1) * s, rx * 0.9 * s, ry * 0.8 * s, 0, 0, Math.PI * 2); }
      c.fill();
    }
  }
  /** 太陽の光の強さと色。夕方・朝方ほど warm が大きい */
  function sunLight(e: Env): { warm: number; col: RGB; rgb: string; day: number } {
    const m = e.m;
    const warm = clamp(clamp((m - 960) / 120, 0, 1) - clamp((m - 1150) / 50, 0, 1) + clamp((m - 330) / 40, 0, 1) - clamp((m - 450) / 60, 0, 1), 0, 1);
    const col = mix(hex("#FFE6B8"), hex("#FF8A5C"), warm);
    return { warm, col, rgb: `${col[0] | 0},${col[1] | 0},${col[2] | 0}`, day: 1 - e.night };
  }
  function ridge(c: Ctx, e: Env, off: number, base: number, amp: number, col: RGB, seed: number, snowcap = false): void {
    const pts: [number, number][] = [];
    let peak = base;
    for (let sx = 0; sx <= VW + 8; sx += 8) {
      const wx = sx + off;
      const h = amp * (1 + Math.sin(wx * 0.0045 + seed) * 0.55 + Math.sin(wx * 0.0117 + 1.3 + seed) * 0.3 + Math.sin(wx * 0.031 + seed * 2) * 0.1);
      pts.push([sx, base - h]);
      peak = Math.min(peak, base - h);
    }
    // 上は山の色、ふもとは空気の色に溶ける（空気遠近）
    const g = c.createLinearGradient(0, peak, 0, GROUND);
    g.addColorStop(0, rgb(col)); g.addColorStop(1, rgb(mix(col, e.bot, 0.38)));
    c.fillStyle = g; c.beginPath(); c.moveTo(0, GROUND);
    for (const [x, y] of pts) c.lineTo(x, y);
    c.lineTo(VW, GROUND); c.closePath(); c.fill();
    if (snowcap) {
      const line = peak + amp * 0.5;
      c.save(); c.beginPath(); c.moveTo(0, GROUND);
      for (const [x, y] of pts) c.lineTo(x, y);
      c.lineTo(VW, GROUND); c.closePath(); c.clip();
      c.fillStyle = rgb(mix([244, 248, 255], col, 0.25 + e.night * 0.45));
      c.beginPath(); c.moveTo(0, line);
      for (const [x] of pts) c.lineTo(x, line + Math.sin(x * 0.09 + off * 0.01) * 5 + Math.sin(x * 0.23) * 3);
      c.lineTo(VW, 0); c.lineTo(0, 0); c.closePath(); c.fill();
      c.restore();
    }
    // 稜線のふちに光が当たる
    const sun = sunLight(e);
    c.strokeStyle = `rgba(${sun.rgb},${0.18 + 0.3 * sun.warm * sun.day})`; c.lineWidth = 1.2;
    c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
  }
  /** 遠くほど霞んで見えるよう、地平線近くに空の色をうっすら重ねる */
  function haze(c: Ctx, e: Env, from: number, to: number, a: number): void {
    const g = c.createLinearGradient(0, from, 0, to);
    g.addColorStop(0, rgb(e.bot, 0)); g.addColorStop(1, rgb(e.bot, a * (1 - e.night * 0.5)));
    c.fillStyle = g; c.fillRect(0, from, VW, to - from);
  }
  /** 中景・近景・足もとは stage-scene.ts で描く */
  function stageView(c: Ctx, e: Env): StageView {
    return { c, e, stage: STAGE_ID, g: GROUND, vw: VW, vh: VH, t: S.time, calm: RM, sun: sunLight(e) };
  }
  function drawMid(c: Ctx, e: Env): void {
    drawStageMid(stageView(c, e), bld.items, S.bgCam * bld.f);
  }
  function drawNear(c: Ctx, e: Env, lamps: [number, number][]): void {
    drawStageNear(stageView(c, e), near.items, S.bgCam * near.f, lamps, S.dist);
  }
  function drawGround(c: Ctx, e: Env, lamps: [number, number][]): void {
    drawStageGround(stageView(c, e), S.cam, lamps);
  }
  function drawMarkers(c: Ctx, e: Env): void {
    if (S.state === "ready") return;
    const sx = (m: number) => P.x + (m * 50 - S.dist);
    c.textAlign = "center"; c.textBaseline = "middle"; c.font = font(8);
    const first = Math.max(100, Math.ceil((S.dist - P.x - 60) / 5000) * 100);
    for (let m = first; ; m += 100) {
      const x = sx(m);
      if (x > VW + 40) break;
      c.fillStyle = rgb(shade(e.near, 0.15)); c.fillRect(x - 1.5, GROUND - 24, 3, 20);
      c.fillStyle = rgb(mix(hex("#F6F3EA"), e.near, 0.15 + e.night * 0.35)); rr(c, x - 14, GROUND - 35, 28, 12, 3); c.fill();
      c.fillStyle = "#3A3550"; c.fillText(`${m}m`, x, GROUND - 28.6);
    }
    if (S.bestD >= 30) {
      const x = sx(S.bestD);
      if (x > -40 && x < VW + 60) {
        if (e.night > 0.2) glow(c, x + 12, GROUND - 60, 30, "255,200,87", 0.35 * e.night);
        c.fillStyle = "#F6F3EA"; c.fillRect(x - 1.5, GROUND - 72, 3, 68);
        const wave = Math.sin(S.time * 4) * 2;
        c.fillStyle = "#FFC857";
        c.beginPath(); c.moveTo(x + 1.5, GROUND - 72); c.quadraticCurveTo(x + 16, GROUND - 70 + wave, x + 30, GROUND - 64 + wave); c.lineTo(x + 1.5, GROUND - 54); c.closePath(); c.fill();
        c.fillStyle = "#2A1E0A"; c.textAlign = "left"; c.fillText("ベスト", x + 4, GROUND - 64);
        c.textAlign = "center"; c.fillStyle = "rgba(22,21,46,.8)"; rr(c, x - 20, GROUND - 50, 40, 12, 3); c.fill();
        c.fillStyle = "#FFC857"; c.fillText(`${S.bestD}m`, x, GROUND - 43.6);
      }
    }
  }

  /* ---------- 出現 ---------- */
  function addObs(kind: ObstacleKind, x: number, w: number, h: number, extra: Partial<Obstacle> = {}): void {
    obstacles.push({
      kind, x, y: 0, w, h, vx: 0, low: false, hit: false, scored: false, hinted: false, minClear: 1e9,
      ky: 0, kvy: 0, rot: 0, spin: 0, birds: [], flee: false, fleeT: 0, gone: false, passed: false, vy: 0, landed: false, phase: 0, greeted: false, age: 0, activeTime: -1, assisted: false, over: false, under: false, ducked: false, ...extra,
    });
  }
  /**
   * 道に落とすもの。ふだんはほね（BONE_PTS点）で、図鑑アイテムはたまに混ざる（ITEM_RATE）。
   * アイテムにはスキルがあるので、全部アイテムにすると拾うたびにスキルが出て忙しすぎる。
   * item を渡したとき（スキルで出すとき）はそのまま使う。
   */
  const mkPickup = (x: number, y: number, item?: RunItem | null, token = 0): Pickup => {
    const rate = (S.sec === "bonus" ? ITEM_RATE_BONUS : ITEM_RATE) + (routeOn() === "calm" ? ROUTE_CALM_ITEM_BONUS : 0);
    const it = item !== undefined ? item : Math.random() < rate ? rollItem() : null;
    return { item: it, token, x, y, vy: 0, ph: Math.random() * 6, taken: false, hinted: false, look: "" };
  };
  function treatArc(x0: number, x1: number, peak: number): void {
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      pickups.push(mkPickup(x0 + (x1 - x0) * t, GROUND - 20 - peak * 4 * t * (1 - t)));
    }
  }
  function spawnBonusItems(X: number): number {
    const kind = pickWeighted([["arc", 2], ["row", 1.5], ["high", 1.2], ["wave", 1.2]] as const);
    if (kind === "arc") { treatArc(X, X + 150, rand(70, 120)); return 60; }
    if (kind === "row") { const h = Math.random() < 0.5 ? 0 : rand(60, 96); for (let i = 0; i < 6; i++) pickups.push(mkPickup(X + i * 30, GROUND - 18 - h)); return 60; }
    if (kind === "high") { const h = rand(150, 178); for (let i = 0; i < 5; i++) pickups.push(mkPickup(X + i * 30, GROUND - h - Math.sin((i / 4) * Math.PI) * 10)); return 40; }
    for (let i = 0; i < 8; i++) pickups.push(mkPickup(X + i * 28, GROUND - 60 - Math.sin((i / 7) * Math.PI * 2) * 40));
    return 90;
  }
  function spawn(): void {
    const X = VW + 40, t = S.t;
    let extra = 0;
    if (S.sec === "bonus") { extra = spawnBonusItems(X); S.next = 110 + extra + Math.random() * 80; return; }
    const rush = S.sec === "rush", rain = S.rain > 0.3;
    const kind = pickWeighted(([
      ["cone", 3], ["puddle", rain ? 5 : 2], ["bike", t > 6 ? 2.2 : 0], ["crow", t > 12 ? 2 : 0], ["double", t > 24 || rush ? 1.6 : 0],
      ["cat", t > 18 ? 1.6 : 0], ["sign", t > 30 ? 1.4 : 0], ["pigeons", t > 9 ? 1.3 : 0], ["noren", t > 14 ? 1.8 : 0], ["lowcrow", t > 22 ? 1.2 : 0],
      ["roller", t > 16 ? 1.4 : 0], ["drop", t > 20 ? 1.2 : 0], ["buddy", t > 8 ? 1 : 0], ["geyser", t > 26 ? 1.2 : 0],
      ["suitcase", t > TRICK_SPECS.suitcase.from ? TRICK_SPECS.suitcase.weight : 0],
      ["surprise", t > TRICK_SPECS.surprise.from ? TRICK_SPECS.surprise.weight : 0],
      ["drone", t > TRICK_SPECS.drone.from ? TRICK_SPECS.drone.weight : 0],
      ["row", rush ? 0 : 1.3], ["high", rush ? 0 : 1.1], ["sniff", t > 10 && !rush ? 0.8 : 0],
    ] as const).map(([k, w]) => [k, w * routeWeight(k)] as const));
    const blocked = (k: ObstacleKind, low = false) => K.buffs.some((a) => a.b.noSpawn && inGroup({ kind: k, low } as Obstacle, a.b.noSpawn));
    const obsKind: Partial<Record<typeof kind, [ObstacleKind, boolean]>> = {
      cone: ["cone", false], puddle: ["puddle", false], bike: ["bike", false], crow: ["crow", false], lowcrow: ["crow", true], double: ["cone", false],
      cat: ["cat", false], sign: ["sign", false], pigeons: ["pigeons", false], noren: ["noren", false],
      suitcase: ["suitcase", false], surprise: ["surprise", false], drone: ["drone", true],
      roller: ["roller", false], drop: ["drop", false], buddy: ["buddy", false], geyser: ["geyser", false],
    };
    const ok = obsKind[kind];
    if (ok && blocked(ok[0], ok[1])) {
      // スキルで出ない種類のときは、かわりにアイテムを並べる
      const h = Math.random() < 0.5 ? 0 : rand(60, 96);
      for (let i = 0; i < 5; i++) pickups.push(mkPickup(X + i * 30, GROUND - 18 - h));
      S.next = 170 + S.speed * 0.55 + Math.random() * S.speed * 0.8;
      return;
    }
    switch (kind) {
      case "cone": addObs("cone", X, 24, 34); if (Math.random() < 0.45) treatArc(X - 58, X + 82, 74); break;
      case "puddle": { const w = rand(64, 96); addObs("puddle", X, w, 6); if (Math.random() < 0.4) treatArc(X - 48, X + w + 48, 60); break; }
      case "bike": addObs("bike", X, 62, 46); if (Math.random() < 0.5) treatArc(X - 60, X + 122, 92); break;
      case "crow":
        addObs("crow", X + 170, 34, 20, { y: GROUND - 84 - rand(0, 12), vx: rand(40, 90) });
        if (Math.random() < 0.6) for (let i = 0; i < 4; i++) pickups.push(mkPickup(X + 40 + i * 30, GROUND - 18));
        extra = 150; break;
      case "lowcrow": addObs("crow", X + 170, 34, 20, { y: GROUND - 58, vx: rand(30, 60), low: true }); extra = 150; break;
      case "double": {
        const g = Math.max(190, S.speed * 0.62);
        addObs("cone", X, 24, 34);
        if (Math.random() < 0.5) addObs("cone", X + g, 24, 34); else addObs("puddle", X + g, rand(56, 76), 6);
        extra = g; break;
      }
      case "cat": addObs("cat", X + 60, 34, 24, { vx: rand(60, 110) }); extra = 80; break;
      case "sign": addObs("sign", X, 40, 48); if (Math.random() < 0.5) treatArc(X - 60, X + 100, 110); break;
      case "pigeons": {
        const n = 2 + Math.floor(Math.random() * 2);
        addObs("pigeons", X, 16 + n * 18, 16, { birds: Array.from({ length: n }, (_, i) => ({ dx: 8 + i * 18 + rand(-3, 3), p: rand(0, 6), delay: i * 0.06 })) });
        break;
      }
      case "suitcase": case "surprise": case "drone": {
        const spec = TRICK_SPECS[kind];
        // 高速でも予告の時間を確保。後続の障害物との間隔にもこの距離を足す。
        const lead = S.speed * 0.8, phase = kind === "suitcase" ? rand(0, 1.8) : 0;
        const pose = trickPose(kind, GROUND, 0, -1, phase);
        addObs(kind, X + lead, spec.width, pose.h, { y: pose.y, phase, low: kind === "drone", vx: kind === "suitcase" ? 28 : 0 });
        extra = lead + 150;
        break;
      }
      case "roller": addObs("roller", X + 80, 30, 18, { vx: rand(55, 95) }); extra = 80; break;
      case "drop": addObs("drop", X + 40, 22, 22, { y: -30 }); extra = 40; break;
      case "buddy": addObs("buddy", X + 60, 44, 40, { phase: Math.floor(rand(0, DOG_SKIN_IDS.length)), vx: rand(20, 40) }); if (Math.random() < 0.5) treatArc(X - 50, X + 84, 70); break;
      case "geyser": addObs("geyser", X, 24, 0, { phase: rand(0, GEYSER_CYCLE) }); extra = 30; break;
      case "noren": addObs("noren", X, 58, 0); if (Math.random() < 0.6) for (let i = 0; i < 4; i++) pickups.push(mkPickup(X - 10 + i * 28, GROUND - 14)); extra = 40; break;
      case "sniff": sniffs.push({ x: X + 30, dug: false, hinted: false, ph: Math.random() * 6 }); extra = 60; break;
      case "row": { const h = Math.random() < 0.5 ? 0 : rand(60, 96); for (let i = 0; i < 5; i++) pickups.push(mkPickup(X + i * 30, GROUND - 18 - h)); break; }
      case "high": { const h = rand(150, 178); for (let i = 0; i < 5; i++) pickups.push(mkPickup(X + i * 30, GROUND - h - Math.sin((i / 4) * Math.PI) * 10)); break; }
    }
    S.next = (170 + S.speed * 0.55 + Math.random() * S.speed * 0.8) * (rush ? 0.68 : 1) * routeGap() + extra;
  }
  /* ---------- 思い出の写真（自分のおでかけ写真を飛行機が運ぶ） ---------- */
  type MemoryPhoto = { img: HTMLImageElement; name: string; pref: string; tall: boolean };
  const memoryPhotos: MemoryPhoto[] = [];
  // 読み込めた写真だけ使う。縦長かどうかで枠の向きを決める
  for (const p of opts.memoryPhotos ?? []) {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) memoryPhotos.push({ img, name: p.name, pref: p.pref, tall: img.naturalHeight > img.naturalWidth });
    };
    img.src = p.src;
  }
  let memoryOrder: number[] = [];
  /** 同じ写真ばかり続かないよう、全部を一巡してから並べ直す */
  function nextMemoryPhoto(): number {
    if (!memoryOrder.length) {
      memoryOrder = memoryPhotos.map((_, i) => i);
      for (let i = memoryOrder.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [memoryOrder[i], memoryOrder[j]] = [memoryOrder[j]!, memoryOrder[i]!]; }
    }
    return memoryOrder.pop()!;
  }
  /** 飛行機の流れる速さ（画面の px/秒）。道より遅く、空をゆっくり横切る */
  const planeSpeed = () => 70 + S.speed * 0.22;
  /** 写真の大きさ。空の広さに合わせて、横長は最大240×180、縦長は最大165×220 */
  function memorySize(ph: MemoryPhoto): { w: number; h: number } {
    const maxW = Math.min(ph.tall ? 165 : 240, VW * (ph.tall ? 0.42 : 0.6));
    const maxH = Math.max(70, GROUND - 120 - 60);
    let w = maxW, h = ph.tall ? (w * 4) / 3 : (w * 3) / 4;
    if (h > maxH) { h = maxH; w = ph.tall ? (h * 3) / 4 : (h * 4) / 3; }
    return { w, h };
  }
  function tickMemory(dt: number): void {
    if (S.memo) {
      const m = S.memo;
      m.x -= planeSpeed() * dt; m.t += dt;
      if (!m.passed && m.x <= P.x) {
        m.passed = true;
        const ph = memoryPhotos[m.photo];
        if (ph) { const v = addPts(MEMORY_SIGN_PTS); floatText(P.x + 20, P.y - 70, `思い出：${ph.name} +${v}`, "#FFD9A8", 13); }
      }
      if (m.x < -320) S.memo = null;
      return;
    }
    if (!memoryPhotos.length) return;
    S.memoT -= dt;
    if (S.memoT > 0) return;
    S.memo = { x: VW + 140, y: Math.max(48, GROUND * rand(0.1, 0.16)), photo: nextMemoryPhoto(), passed: false, t: 0 };
    S.memoT = rand(17, 23);
  }
  /**
   * 空を横切る飛行機に、写真がロープでぶら下がって運ばれてくる。写真の下にスポット名と都道府県の札。
   * 写真は道や障害物より奥に描くので、アイテムや障害物を隠さない
   */
  function drawMemory(c: Ctx, e: Env): void {
    const m = S.memo;
    if (!m) return;
    const ph = memoryPhotos[m.photo];
    if (!ph) return;
    const { w, h } = memorySize(ph), fr = 5;
    const bob = RM ? 0 : Math.sin(m.t * 1.6) * 3, swing = RM ? 0 : Math.sin(m.t * 1.3 + 0.8) * 0.045;
    const px = m.x, py = m.y + bob;
    if (px - 60 > VW + 20 || px + Math.max(w, 60) < -40) return;
    const night = e.night;
    // 飛行機（左向きに飛ぶ小さなプロペラ機）
    const body = mix(hex("#F4F1EA"), e.top, 0.12 + night * 0.45), accent = mix(hex("#E4572E"), e.top, 0.1 + night * 0.4);
    c.save(); c.translate(px, py); c.rotate(-0.03 + bob * 0.004);
    c.fillStyle = rgb(shade(body, -0.12));
    c.beginPath(); c.moveTo(22, -2); c.lineTo(34, -16); c.lineTo(40, -16); c.lineTo(36, 0); c.closePath(); c.fill();
    c.fillStyle = rgb(body); ell(c, 4, 0, 30, 7.5); c.fill();
    c.fillStyle = rgb(accent); c.fillRect(-10, -1.5, 34, 3);
    c.fillStyle = rgb(mix(hex("#9FD4FF"), e.top, 0.2 + night * 0.4)); ell(c, -12, -3, 6, 3.4); c.fill();
    c.fillStyle = rgb(shade(body, -0.18)); c.beginPath(); c.moveTo(-2, 1); c.lineTo(14, 1); c.lineTo(8, 12); c.lineTo(0, 12); c.closePath(); c.fill();
    c.fillStyle = rgb(accent); ell(c, -26, 0, 3, 3); c.fill();
    const blade = RM ? 7 : Math.abs(Math.sin(S.time * 40)) * 9 + 1;
    c.fillStyle = "rgba(60,60,70,0.55)"; ell(c, -29, 0, 1.4, blade); c.fill();
    if (night > 0.3) { c.fillStyle = Math.sin(S.time * 6) > 0 ? "#FF5A5A" : "rgba(255,90,90,.3)"; ell(c, 36, -16, 1.6, 1.6); c.fill(); }
    c.restore();
    // ロープと写真（振り子のように少しゆれる）
    const hx = px + 6, hy = py + 8, ropeL = 22;
    c.save(); c.translate(hx, hy); c.rotate(swing);
    const top = ropeL, left = -w / 2 - fr, bw = w + fr * 2, bh = h + fr * 2;
    c.strokeStyle = rgb(mix(hex("#5A4A3A"), e.top, 0.2 + night * 0.4)); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(left + 8, top); c.moveTo(0, 0); c.lineTo(left + bw - 8, top); c.stroke();
    if (night > 0.2) glow(c, 0, top + bh / 2, bw * 0.7, "255,226,170", 0.3 * night);
    c.fillStyle = "rgba(20,16,40,0.18)"; rr(c, left + 3, top + 4, bw, bh, 4); c.fill();
    c.fillStyle = rgb(mix(hex("#FFFFFF"), e.top, 0.05 + night * 0.35)); rr(c, left, top, bw, bh, 4); c.fill();
    c.save(); rr(c, left + fr, top + fr, w, h, 2); c.clip();
    const iw = ph.img.naturalWidth, ih = ph.img.naturalHeight, k = Math.max(w / iw, h / ih);
    c.drawImage(ph.img, left + fr + (w - iw * k) / 2, top + fr + (h - ih * k) / 2, iw * k, ih * k);
    if (night > 0.05) { c.fillStyle = `rgba(20,14,40,${(night * 0.3).toFixed(3)})`; c.fillRect(left, top, bw, bh); }
    c.restore();
    const label = ph.pref ? `${ph.name}（${ph.pref}）` : ph.name;
    c.font = font(11); c.textAlign = "center"; c.textBaseline = "middle";
    const lw = Math.min(Math.max(bw, 120), c.measureText(label).width + 18);
    c.fillStyle = "rgba(246,239,228,.96)"; rr(c, -lw / 2, top + bh + 4, lw, 18, 5); c.fill();
    c.fillStyle = "#3A2A1C"; c.fillText(label, 0, top + bh + 13.5, lw - 8);
    c.restore();
  }

  /* ---------- ご近所さんとのあいさつ ---------- */
  function greetNeighbor(o: Obstacle): void {
    const skin = buddySkin(o), before = neighborLevel(neighborGreets(skin));
    neighbors.greets[skin] = neighborGreets(skin) + 1;
    saveNeighbors();
    const lv = neighborLevel(neighborGreets(skin)), L = NEIGHBOR_LEVELS[lv]!, name = neighborName(skin);
    const v = addPts(L.pts);
    floatText(P.x + 20, P.y - 70, `くんくん… ${name}にごあいさつ +${v}`, "#FFB3C7", 14);
    if (L.gift === "bones") treatArc(P.x + 30, P.x + 170, 60);
    else if (L.gift === "item") { pickups.push(mkPickup(P.x + 40, GROUND - 40, rollGiftItem())); floatText(P.x + 20, P.y - 90, `${name}がおみやげをくれた！`, "#FFE08A", 13); }
    if (lv > before) {
      floatText(VW / 2, GROUND * 0.26, `${name}と「${L.name}」になった！`, "#FFB3C7", 18);
      sfx.fanfare(); puff(o.x + o.w / 2, GROUND - 40, 14, "spark", { g: 0 });
    }
  }
  /** おみやげ・においかぎで出るアイテム。SR以上が出やすい */
  function rollGiftItem(): RunItem {
    const boosted = rarityWeights.map(([r, w]) => [r, rarityIndex(r) >= 2 ? w * 2.2 : w] as const);
    return pickOne(byRarity.get(pickWeighted(boosted))!);
  }

  /* ---------- においかぎ ---------- */
  function tickSniffs(dt: number, playing: boolean): void {
    for (const sn of sniffs) {
      sn.x -= S.speed * dt; sn.ph += dt;
      if (!playing || sn.dug) continue;
      if (!sn.hinted && sn.x < P.x + 240) { sn.hinted = true; hint("sniff"); }
      if (P.ground && P.slide && Math.abs(sn.x - P.x) < 22) digSniff(sn);
    }
    sniffs = sniffs.filter((sn) => sn.x > -60);
  }
  function digSniff(sn: Sniff): void {
    sn.dug = true; S.digs++;
    puff(sn.x, GROUND - 2, RM ? 8 : 16, "dust", { vy: -90 });
    tone(220, 0.1, "triangle", 0.05, 160); tone(520, 0.1, "square", 0.03, 700, 0.08);
    const kind = pickWeighted(SNIFF_REWARDS.map((r) => [r.kind, r.weight] as const));
    if (kind === "bones") {
      treatArc(P.x + 20, P.x + 150, 70);
      floatText(P.x + 20, P.y - 64, "ほねを掘り当てた！", "#F3EBDD", 14);
    } else if (kind === "item") {
      pickups.push(mkPickup(P.x + 34, GROUND - 36, rollGiftItem()));
      floatText(P.x + 20, P.y - 64, "何か埋まってた！", "#FFE08A", 14);
    } else {
      const v = addPts(5);
      floatText(P.x + 20, P.y - 64, `古いくつした… +${v}`, "#C9C3F0", 13);
    }
  }
  /** 盛り土と、ゆらゆら立ちのぼる「くんくん」のにおい */
  function drawSniffs(c: Ctx, e: Env): void {
    for (const sn of sniffs) {
      if (sn.x < -40 || sn.x > VW + 40) continue;
      const soil = mix(hex(STAGE_ID === "snow" ? "#DCE4F2" : "#8A6A48"), e.near, 0.15 + e.night * 0.35);
      if (sn.dug) {
        c.fillStyle = rgb(shade(soil, -0.25)); ell(c, sn.x, GROUND + 1, 13, 3); c.fill();
        c.fillStyle = rgb(soil); ell(c, sn.x + 12, GROUND - 1, 6, 3); c.fill();
        continue;
      }
      c.fillStyle = rgb(soil); ell(c, sn.x, GROUND, 12, 4.5); c.fill();
      c.fillStyle = rgb(shade(soil, 0.18)); ell(c, sn.x - 3, GROUND - 2, 5, 1.8); c.fill();
      const a = 0.55 + 0.25 * Math.sin(sn.ph * 4);
      c.strokeStyle = `rgba(255,226,150,${a})`; c.lineWidth = 2; c.lineCap = "round";
      for (let k = -1; k <= 1; k++) {
        c.beginPath();
        for (let q = 0; q <= 8; q++) {
          const y = GROUND - 6 - q * 3.2, x = sn.x + k * 6 + Math.sin(q * 0.9 + sn.ph * (RM ? 0 : 5) + k) * 2.4;
          if (q) c.lineTo(x, y); else c.moveTo(x, y);
        }
        c.stroke();
      }
      const ty = GROUND - 40 - Math.sin(sn.ph * 3) * 1.5;
      c.font = font(8); c.textAlign = "center"; c.textBaseline = "middle";
      c.fillStyle = "rgba(40,30,60,0.55)"; rr(c, sn.x - 19, ty - 6.5, 38, 13, 6.5); c.fill();
      c.fillStyle = "#FFE7A3"; c.fillText("くんくん", sn.x, ty + 0.5);
    }
  }

  /* ---------- 今日のミッション ---------- */
  const MISSIONS = opts.missions ?? [];
  const missionDone = new Set(opts.missionsDone ?? []);
  function missionValue(metric: OsanpoRunMissionMetric): number {
    switch (metric) {
      case "bones": return S.bones;
      case "meters": return Math.floor(S.dist / 50);
      case "items": return S.treats;
      case "rarePlus": return S.srPlus;
      case "pigeons": return S.pigeonsRun;
      case "slides": return S.slidesRun;
      case "greets": return S.greetsRun;
      case "rushes": return S.rushes;
      case "combo": return S.maxMult;
      case "closes": return S.closes;
      case "skills": return S.skillIds.size;
      case "score": return score();
      case "routeCalm": return S.routeCalm;
      case "routeRisky": return S.routeRisky;
      case "bonusGot": return S.bonusBest;
    }
  }
  function tickMissions(): void {
    for (const m of MISSIONS) {
      if (missionDone.has(m.id) || missionValue(m.metric) < m.target) continue;
      missionDone.add(m.id);
      S.missionsNow.push(m.id);
      const all = MISSIONS.every((x) => missionDone.has(x.id));
      floatText(VW / 2, GROUND * 0.18, all ? "ミッション コンプリート！" : "ミッション達成！", "#FFE08A", 20);
      showNote(`✓ ${m.text}`);
      sfx.fanfare();
      renderMissions();
      opts.onMissionClear?.(m.id).then((coins) => { if (coins) { S.missionCoins += coins; renderMissionResult(); } }).catch(() => undefined);
    }
  }
  /** スタート画面の「今日のミッション」 */
  function renderMissions(): void {
    const box = $("missions");
    box.hidden = MISSIONS.length === 0;
    if (box.hidden) return;
    box.replaceChildren();
    const done = MISSIONS.filter((m) => missionDone.has(m.id)).length;
    const head = document.createElement("b");
    head.textContent = `今日のミッション ${done}/${MISSIONS.length}`;
    const note = document.createElement("small");
    note.textContent = done === MISSIONS.length ? "ぜんぶ達成！ また明日" : `1つ${MISSION_COINS}コイン・ぜんぶで+${MISSION_ALL_BONUS}`;
    const top = document.createElement("div"); top.className = "osr-missions-head"; top.append(head, note);
    const ul = document.createElement("ul");
    for (const m of MISSIONS) {
      const li = document.createElement("li");
      li.dataset.done = missionDone.has(m.id) ? "1" : "0";
      li.textContent = m.text;
      ul.appendChild(li);
    }
    box.append(top, ul);
  }
  /** 結果画面に、このおさんぽで達成したミッションともらったコインを出す */
  function renderMissionResult(): void {
    const el = $("o-missions");
    el.hidden = S.missionsNow.length === 0;
    if (el.hidden) return;
    const names = S.missionsNow.map((id) => MISSIONS.find((m) => m.id === id)?.text ?? "").filter(Boolean);
    el.textContent = `ミッション達成：${names.join("／")}${S.missionCoins > 0 ? `（+${S.missionCoins.toLocaleString()}コイン）` : ""}`;
  }

  /* ---------- 分かれ道 ---------- */
  /** 上の道（calm）は障害物をまばらに・拾うものを多く、下の道（risky）は障害物を詰める */
  function routeWeight(kind: string): number {
    const k = routeOn();
    if (!k) return 1;
    const pickup = kind === "row" || kind === "high";
    if (k === "calm") return pickup ? 1.8 : kind === "pigeons" || kind === "buddy" ? 1.6 : 0.7;
    return pickup ? 0.6 : 1;
  }
  function routeGap(): number {
    const k = routeOn();
    return k === "calm" ? 1.15 : k === "risky" ? 0.85 : 1;
  }
  const routeName = (k: OsanpoRunRouteKind) => OSANPO_RUN_ROUTES[STAGE_ID][k];
  /** いま効いている道（入口ゲートを過ぎてから出口ゲートを過ぎるまで） */
  function routeOn(): OsanpoRunRouteKind | null {
    return S.route?.on ? S.route.kind : null;
  }
  function showNote(text: string, sec = 2.6): void {
    const el = $("hint");
    el.textContent = text;
    showAgain(el);
    hintT = sec;
  }
  /** ふつうの区間で、前に障害物が残っていないときだけ、画面の右端に道しるべを出す */
  function tickFork(dt: number): void {
    if (S.route) {
      const r = S.route;
      if (!r.on && r.exit === null && S.dist >= r.gate) {
        r.on = true;
        floatText(VW / 2, GROUND * 0.3, `${routeName(r.kind)}に入った！`, r.kind === "calm" ? "#9BE3A8" : "#FFB27A", 20);
        showNote(OSANPO_RUN_ROUTE_DESC[r.kind]);
      }
      if (r.on && r.exit === null) {
        r.t -= dt;
        // 時間が来たら、画面の右端に出口ゲートを置く（そこまでは今の道のまま）
        if (r.t <= 0) r.exit = S.dist + VW + 60 - P.x;
      }
      if (r.on && r.exit !== null && S.dist >= r.exit) {
        r.on = false;
        floatText(VW / 2, GROUND * 0.3, "もとの道に合流！", "#F6EFE4", 18);
      }
      // 景色が画面の左へ流れきったら消して、次の分かれ道を待つ
      if (r.exit !== null && P.x + (r.exit - S.dist) < -160) { S.route = null; S.forkT = rand(40, 60); }
      return;
    }
    if (S.fork) {
      if (S.dist < S.fork.at) return;
      const kind: OsanpoRunRouteKind = P.ground ? "risky" : "calm";
      S.fork = null;
      // 入口ゲートは画面の右端から流れてくる。くぐったところから道が変わる
      S.route = { kind, t: OSANPO_RUN_ROUTE_SEC, gate: S.dist + VW + 70 - P.x, exit: null, on: false };
      if (kind === "calm") S.routeCalm++; else S.routeRisky++;
      floatText(VW / 2, GROUND * 0.3, `${routeName(kind)}ルートへ！`, kind === "calm" ? "#9BE3A8" : "#FFB27A", 22);
      sfx.pass();
      return;
    }
    S.forkT -= dt;
    if (S.forkT > 0 || S.sec !== "normal" || obstacles.some((o) => !o.hit && !o.gone && o.x + o.w > VW - 160)) return;
    S.fork = { at: S.dist + VW + 60 - P.x };
    S.next = Math.max(S.next, 280);
    showNote(`分かれ道！ 跳んで通ると${routeName("calm")}、そのままだと${routeName("risky")}`, 3);
  }
  /* ---------- 分かれ道のあとの景色 ---------- */
  const ROUTE_THEMES: Record<OsanpoRunStageId, Record<OsanpoRunRouteKind, RouteTheme>> = {
    town: { calm: "park", risky: "arcade" },
    hiking: { calm: "stream", risky: "ridge" },
    snow: { calm: "kamakura", risky: "onsen" },
    summer: { calm: "riverbank", risky: "yatai" },
  };
  /**
   * 入口ゲートから出口ゲートまでのあいだだけ切り抜いて、その道の景色を描く（route-scene.ts）。
   * 切れ目はゲートの柱の位置に合わせて、柱で隠す。
   * 位置は道（S.dist）と同じ速さで流れるので、ゆったりモードで背景が止まっていても動いて見える
   */
  function drawRouteScene(c: Ctx, e: Env): void {
    const r = S.route;
    if (!r) return;
    const gx = P.x + (r.gate - S.dist), ex = r.exit === null ? Infinity : P.x + (r.exit - S.dist);
    const seamL = gx - ROUTE_GATE_HALF, seamR = ex + ROUTE_GATE_HALF;
    const left = Math.max(-10, seamL), right = Math.min(VW + 10, seamR);
    const theme = ROUTE_THEMES[STAGE_ID][r.kind];
    if (right > left) {
      c.save();
      c.beginPath(); c.rect(left, 0, right - left, GROUND + 19); c.clip();
      drawRouteSceneLayer({ c, e, g: GROUND, t: S.time, base: gx, left, right, still: S.calm, calm: RM, seamL: seamL > -10, seamR: seamR < VW + 10 }, theme);
      c.restore();
    }
    if (gx > -80 && gx < VW + 80) drawRouteGate(c, e, GROUND, gx, theme, routeName(r.kind), S.time);
    if (Number.isFinite(ex) && ex > -80 && ex < VW + 80) drawRouteGate(c, e, GROUND, ex, theme, "もとの道 →", S.time);
  }
  function drawFork(c: Ctx, e: Env): void {
    if (!S.fork) return;
    const x = P.x + (S.fork.at - S.dist) + 8;
    if (x < -60 || x > VW + 80) return;
    if (e.night > 0.2) glow(c, x, GROUND - 70, 40, "255,236,190", 0.3 * e.night);
    c.fillStyle = rgb(shade(hex("#8A6A4A"), -0.1 * e.night)); c.fillRect(x - 2.5, GROUND - 96, 5, 94);
    const board = (y: number, up: boolean, label: string, col: string) => {
      c.save(); c.translate(x, y); if (up) c.rotate(-0.28);
      c.fillStyle = col;
      c.beginPath(); c.moveTo(-6, -9); c.lineTo(46, -9); c.lineTo(56, 0); c.lineTo(46, 9); c.lineTo(-6, 9); c.closePath(); c.fill();
      c.fillStyle = "#2A1E0A"; c.textAlign = "center"; c.textBaseline = "middle"; c.font = font(8);
      c.fillText(label, 24, 0.5);
      c.restore();
    };
    board(GROUND - 84, true, `↑${routeName("calm")}`, "#9BE3A8");
    board(GROUND - 58, false, routeName("risky"), "#FFB27A");
  }
  function setSection(k: Section): void {
    S.sec = k; S.bonusGot = 0;
    if (k === "bonus") { S.secT = 6; floatText(VW / 2, GROUND * 0.32, "ボーナスタイム！", "#FFC857", 24); sfx.rare(); }
    else if (k === "rush") {
      S.secT = 7; floatText(VW / 2, GROUND * 0.32, "ラッシュ！", "#FF8A5C", 24); sfx.near();
      if (K.rushPass > 0) { K.rushInv = true; K.rushMul = K.rushPass; K.rushPass = 0; announceInv(); }
    }
    else {
      S.secT = rand(14, 18);
      if (S.t > 20 && S.rainTarget === 0 && Math.random() < 0.4) {
        S.rainTarget = 1; S.rainT = rand(18, 24);
        floatText(VW / 2, GROUND * 0.32, STAGE.weather === "snow" ? "雪が強くなってきた… 足元に注意" : "雨が降ってきた… 水たまりに注意", "#A9C8FF", 18);
      }
    }
  }

  /* ---------- 演出 ---------- */
  /** 水たまりスタンプのしぶき：王冠形の水の壁、波紋、放物線を描いて飛び散る水滴 */
  function splashBurst(x: number, w: number): void {
    const y = GROUND - 1;
    parts.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.6, r: Math.min(46, 26 + w * 0.2), kind: "crown", color: "", g: 0, scroll: true });
    for (let k = 0; k < 3; k++) parts.push({ x, y: y + 2, vx: 0, vy: 0, life: -k * 0.08, max: 0.6, r: 2, kind: "splash", color: "", g: 0, scroll: true });
    const n = RM ? 10 : 26;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      parts.push({
        x: x + side * rand(2, 14), y: y - 2, vx: side * rand(40, 230), vy: -rand(220, 520), life: 0, max: rand(0.5, 0.8),
        r: rand(2.2, 4.2), kind: "drop", color: "", g: 1500, scroll: true,
      });
    }
  }
  function puff(x: number, y: number, n: number, kind: Particle["kind"], o: { vx?: number; vy?: number; g?: number; scroll?: boolean; color?: string } = {}): void {
    const count = RM ? Math.ceil(n / 2) : n;
    for (let i = 0; i < count; i++) {
      parts.push({
        x, y, vx: rand(-60, 60) + (o.vx ?? 0), vy: rand(-80, -10) + (o.vy ?? 0), life: 0, max: rand(0.35, 0.6), r: rand(2, 4.5),
        kind, color: o.color ?? "", g: o.g ?? 200, scroll: o.scroll ?? true,
      });
    }
  }
  function floatText(x: number, y: number, text: string, color = "#F6EFE4", size = 15): void {
    texts.push({ x, y, text, color, size, life: 0, max: 0.95 });
  }
  function retrigger(el: HTMLElement, cls: string): void {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }
  function showAgain(el: HTMLElement): void {
    el.hidden = true;
    void el.offsetWidth;
    el.hidden = false;
  }

  /* ---------- 称号 ---------- */
  let achQueue: string[] = [], achToastT = 0;
  function unlock(id: string): void {
    if (achGot[id]) return;
    achGot[id] = Date.now();
    store.set("ach", JSON.stringify(achGot));
    S.newAch.push(id); achQueue.push(id);
    renderAchList();
  }
  const achName = (id: string) => OSANPO_RUN_ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id;

  /* ---------- ヒント ---------- */
  let hintT = 0;
  function hint(k: OsanpoRunHintId): void {
    if (store.get(`tut-${k}`)) return;
    store.set(`tut-${k}`, "1");
    const el = $("hint");
    el.textContent = OSANPO_RUN_HINTS[k];
    showAgain(el);
    hintT = 2.4;
  }

  /* ---------- 入力 ---------- */
  function jump(v: number, n: 1 | 2, quiet = false): void {
    let k = M.jump;
    if (n === 1 && !quiet && K.bigJumps.length) { k *= K.bigJumps.shift()!; puff(P.x, GROUND, 10, "ring", { vy: 30, g: 0 }); }
    P.vy = -v * k; P.ground = false; P.jumps = n === 1 ? BASE_AIR_JUMPS + M.air : Math.max(0, P.jumps - 1); P.sq = 1.22; P.slide = false; P.slideHeld = false; P.jumpAt = S.time; P.dive = false;
    if (M.rhythm > 0 && S.state === "play" && !quiet) {
      const beat = 60 / BGM.bpm, ph = (S.time % beat) / beat;
      if (ph < 0.18 || ph > 0.82) { const got = addPts(M.rhythm); floatText(P.x + 20, P.y - 70, `♪ +${got}`, "#9BE7FF", 15); }
    }
    if (quiet) return;
    if (n === 1) { sfx.jump(); puff(P.x - 6, GROUND, 6, "dust", { vy: -20 }); }
    else { sfx.djump(); puff(P.x, P.y - 4, 8, "ring", { vy: 60, g: 0 }); }
  }
  let assetsReady = false;
  function press(src: "key" | "pointer"): void {
    ensureAudio();
    if (!$("settings-panel").hidden || openSheetName) return;
    if (S.paused) { if (src === "key") resume(); return; }
    if (S.state === "ready") { if (src === "key" && assetsReady && unlocked.has(STAGE_ID)) start(); return; }
    if (S.state === "over" || S.state === "dying") return;
    if (S.state === "intro") { S.bufT = 0.2; return; }
    if (P.ground) jump(JUMP_V, 1);
    else if (P.jumps > 0) jump(DJUMP_V, 2);
    else S.bufT = 0.14;
  }
  function slideDown(held: boolean, dur = 0.55): void {
    ensureAudio();
    if (S.state !== "play" || S.paused) return;
    if (!P.ground && S.time - P.jumpAt < 0.14 && P.vy < 0) { P.y = GROUND; P.vy = 0; P.ground = true; P.jumps = 2; }
    if (!P.ground) { P.vy = Math.max(P.vy, 950); P.slideHeld = held; P.slideT = dur; P.slide = true; P.dive = true; return; }
    if (!P.slide) { tone(260, 0.12, "triangle", 0.05, 140); puff(P.x + 16, GROUND, 6, "dust", { vy: -10 }); }
    P.slide = true; P.slideHeld = held; P.slideT = dur; P.sq = 0.85;
  }
  const slideUp = () => { P.slideHeld = false; };
  const release = () => { if (S.state === "play" && P.vy < -260) P.vy = -260; };
  const JUMP_KEYS = new Set([" ", "Spacebar", "ArrowUp", "w", "W"]);
  const SLIDE_KEYS = new Set(["ArrowDown", "s", "S"]);
  let swipe: { y: number; t: number; done: boolean } | null = null;

  on(window, "keydown", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest("button, a, input") && (e.key === " " || e.key === "Enter")) return;
    if (target?.closest("input, textarea, select")) return;
    if (!$("settings-panel").hidden) { if (e.key === "Escape") { e.preventDefault(); closeSettings(); } return; }
    if (openSheetName) { if (e.key === "Escape") { e.preventDefault(); closeSheet(); } return; }
    if (S.state === "ready" && !$("start-panel").hidden) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const ids = OSANPO_RUN_STAGE_IDS.filter((id) => unlocked.has(id));
        const i = Math.max(0, ids.indexOf(STAGE_ID));
        selectStage(ids[(i + (e.key === "ArrowRight" ? 1 : ids.length - 1)) % ids.length]!);
        return;
      }
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); press("key"); }
      return;
    }
    if (JUMP_KEYS.has(e.key)) { e.preventDefault(); if (!e.repeat) press("key"); }
    else if (SLIDE_KEYS.has(e.key)) { e.preventDefault(); if (!e.repeat) slideDown(true); }
    else if ((e.key === "p" || e.key === "P" || e.key === "Escape") && S.state === "play") { if (S.paused) resume(); else pause(); }
  });
  on(window, "keyup", (e) => {
    if (JUMP_KEYS.has(e.key)) release();
    else if (SLIDE_KEYS.has(e.key)) slideUp();
  });
  on(stageEl, "pointerdown", (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    stageEl.focus({ preventScroll: true });
    swipe = { y: e.clientY, t: performance.now(), done: false };
    press("pointer");
  });
  on(stageEl, "pointermove", (e) => {
    if (!swipe || swipe.done) return;
    const dy = e.clientY - swipe.y, lim = Math.max(14, stageEl.clientHeight * 0.03);
    if (dy > lim && performance.now() - swipe.t < 400) { swipe.done = true; slideDown(false, 0.6); }
  });
  on(window, "pointerup", () => { swipe = null; release(); });
  on(window, "pointercancel", () => { swipe = null; release(); });
  on(stageEl, "contextmenu", (e) => e.preventDefault());
  // iOS で長押しすると拡大鏡（ルーペ）や選択が出るので、ゲーム画面の上ではタッチの既定動作を止める。
  // パネルやボタンの上はタップ（click）を生かすため止めない
  on(stageEl, "touchstart", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest(".osr-panel, .osr-icon-btn, button, a, input, label")) return;
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  // iOS で画面ごと引っぱられないよう、ゲーム画面の上だけスクロールを止める
  on(stageEl, "touchmove", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest(".osr-panel")) return;
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  for (const el of $$(".osr-panel, .osr-icon-btn")) on(el, "pointerdown", (e) => e.stopPropagation());

  /* ---------- メニュー ---------- */
  {
    const imgs = [...Array.from(itemImages.values()).slice(0, 40), ...POSES.map((p) => dogImage(STAGE.skin, p))];
    const ready = () => {
      if (assetsReady) return;
      assetsReady = true;
      syncStartButton();
    };
    Promise.all(imgs.map((im) => im.decode().catch(() => undefined))).then(ready);
    const timer = window.setTimeout(ready, 4000);
    cleanups.push(() => window.clearTimeout(timer));
  }
  function syncStartButton(): void {
    const b = $<HTMLButtonElement>("start");
    const open = unlocked.has(STAGE_ID);
    b.disabled = !assetsReady || !open;
    b.textContent = !assetsReady ? "準備中…" : open ? "おさんぽに行く" : "まだ歩けない道です";
  }
  on($("start"), "click", () => { if (assetsReady && unlocked.has(STAGE_ID)) { ensureAudio(); start(); } });

  function buildStageList(): void {
    const box = $("stage-list");
    box.replaceChildren();
    for (const id of OSANPO_RUN_STAGE_IDS) {
      const st = OSANPO_RUN_STAGES[id], open = unlocked.has(id), b = document.createElement("button");
      b.type = "button"; b.className = "osr-stage-card" + (open ? "" : " osr-locked"); b.dataset.id = id;
      b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(id === STAGE_ID)); b.tabIndex = id === STAGE_ID ? 0 : -1;
      const face = document.createElement("img");
      face.className = "osr-face"; face.alt = ""; face.width = 52; face.height = 44; face.draggable = false;
      setDogSprite(face, st.skin, "stand-happy");
      const nm = document.createElement("b"); nm.textContent = st.name;
      const bs = document.createElement("small"); bs.textContent = open ? `ベスト ${bestOf(id).toLocaleString()}` : "未解放";
      b.append(face, nm, bs);
      on(b, "click", () => { ensureAudio(); selectStage(id); tone(660, 0.06, "triangle", 0.04); });
      box.appendChild(b);
    }
  }
  function selectStage(id: OsanpoRunStageId): void {
    STAGE_ID = id; STAGE = OSANPO_RUN_STAGES[id];
    if (unlocked.has(id)) store.set("stage", id);
    preloadSkin(STAGE.skin);
    S.best = bestOf(id);
    $("best-top").textContent = S.best.toLocaleString();
    $("best-label").textContent = `じこベスト・${STAGE.name}`;
    bld.items = []; bld.nx = S.bgCam * bld.f - 80; near.items = []; near.nx = S.bgCam * near.f - 160;
    if (S.state === "ready") S.clock = STAGE.clock;
    S.rain = 0; S.rainTarget = 0;
    for (const b of $$(".osr-stage-card")) {
      const sel = b.dataset.id === id;
      b.setAttribute("aria-checked", String(sel)); b.tabIndex = sel ? 0 : -1;
    }
    for (const el of $$<HTMLImageElement>("img.osr-dog")) setDogSprite(el, STAGE.skin, (el.dataset.pose as Pose) ?? "wave");
    $("stage-desc").textContent = unlocked.has(id)
      ? STAGE.desc
      : `ガチャで「${STAGE.skinName}」を手に入れると歩けるようになります。${STAGE.desc}`;
    syncStartButton();
  }
  const panelIds = ["start-panel", "over-panel", "pause-panel", "settings-panel"];
  function hidePanels(): void { for (const id of panelIds) $(id).hidden = true; }
  function backToStart(): void {
    S.state = "ready"; S.paused = false; S.clock = STAGE.clock; S.rain = 0; S.rainTarget = 0; S.sec = "normal";
    applyAudio(); bgmStop();
    Object.assign(P, { y: GROUND, vy: 0, ground: true, jumps: 2, sq: 1, rot: 0, inv: 0, dead: false, slide: false, slideHeld: false });
    obstacles = []; pickups = []; texts = []; flyers = []; parts = []; sniffs = []; S.fork = null; S.route = null; S.memo = null;
    hidePanels(); buildStageList(); selectStage(STAGE_ID); renderMissions();
    $("start-panel").hidden = false;
    $("start").focus({ preventScroll: true });
  }
  on($("stage-btn"), "click", backToStart);
  on($("quit"), "click", backToStart);
  on($("restart"), "click", () => { ensureAudio(); start(); });
  on($("retry"), "click", () => { ensureAudio(); start(); });
  on($("resume"), "click", () => resume());

  function renderAchList(): void {
    const ul = $("ach-list");
    ul.replaceChildren();
    let n = 0;
    for (const a of OSANPO_RUN_ACHIEVEMENTS) {
      const got = Boolean(achGot[a.id]);
      if (got) n++;
      const li = document.createElement("li");
      if (!got) li.className = "osr-locked";
      const b = document.createElement("b"); b.textContent = got ? a.name : "？？？";
      const sm = document.createElement("small"); sm.textContent = a.condition;
      li.append(b, sm); ul.appendChild(li);
    }
    $("ach-count").textContent = `${n} / ${OSANPO_RUN_ACHIEVEMENTS.length}`;
    $("life-stats").textContent = stats.plays
      ? `これまで ${stats.plays.toLocaleString()}回 ・ 合計 ${Math.floor(stats.meters).toLocaleString()}m ・ 拾ったアイテム ${stats.items.toLocaleString()}こ（${kindSet.size}種類）`
      : "まだ散歩の記録はありません。";
  }

  /* ---------- ずかん ---------- */
  let zkTab = "all", zkKind: SkillKind | "all" = "all", zkSel: string | null = null;
  const zkNew = new Set<string>();
  const seriesLabel = (series: string | null) => (series ? opts.seriesTabs.find((t) => t.id === series)?.name ?? "シリーズ" : "通常");
  function zkShow(id: string | null): void {
    zkSel = id;
    const box = $("zk-detail");
    box.replaceChildren();
    for (const b of $$(".osr-zk-grid button")) b.setAttribute("aria-pressed", String(b.dataset.id === id));
    const item = id ? ITEMS.find((it) => it.id === id) : undefined;
    if (!item) {
      const p = document.createElement("p"); p.textContent = "アイテムを選ぶと、ここに詳しく出ます。";
      box.appendChild(p);
      return;
    }
    const got = kindSet.has(item.id), R = RARITY_STYLES[item.rarity];
    const big = document.createElement("div"); big.className = "osr-zk-big" + (got ? "" : " osr-locked"); big.appendChild(spriteEl(item, 72, got));
    const nm = document.createElement("b"); nm.textContent = got ? item.name : "？？？";
    const tags = document.createElement("div"); tags.className = "osr-tags";
    const t1 = document.createElement("span"); t1.textContent = item.rarity; t1.style.color = R.color;
    const t2 = document.createElement("span"); t2.textContent = opts.categoryLabels[item.category] ?? "その他";
    const t3 = document.createElement("span"); t3.textContent = seriesLabel(item.series);
    tags.append(t1, t2, t3);
    const p = document.createElement("p");
    p.textContent = got ? `拾った回数 ${(stats.counts[item.id] ?? 0).toLocaleString()}回 ・ 1こ ${R.points}点` : "まだ拾っていません。道のどこかに落ちているかも。";
    box.append(big, nm, tags, p);
    const skill = OSANPO_RUN_SKILL_BY_ID.get(item.id);
    if (skill) {
      const lv = lvOf(item);
      const sk = document.createElement("div"); sk.className = "osr-zk-skill";
      const h = document.createElement("b");
      h.textContent = `スキル「${skill.name}」${item.rarity === "N" ? "" : lv >= OSANPO_RUN_SKILL_MAX_LEVEL ? " Lv.MAX" : ` Lv${lv}`}`;
      const d = document.createElement("p"); d.textContent = skill.desc;
      const mx = document.createElement("small"); mx.textContent = item.rarity === "N" ? "Nはレベルなし" : `Lv.MAX：${skill.max}`;
      sk.append(h, d, mx);
      box.appendChild(sk);
    }
  }
  function renderZukan(): void {
    const grid = $("zk-grid");
    grid.replaceChildren();
    $("zk-count").textContent = `${ITEMS.filter((it) => kindSet.has(it.id)).length} / ${ITEMS.length}`;
    const rar = $("zk-rar");
    rar.replaceChildren();
    for (const r of GACHA_RARITIES) {
      const pool = byRarity.get(r)!;
      if (!pool.length) continue;
      const sp = document.createElement("span");
      sp.style.color = RARITY_STYLES[r].color;
      sp.textContent = `${r} ${pool.filter((it) => kindSet.has(it.id)).length}/${pool.length}`;
      rar.appendChild(sp);
    }
    const tabs = $("zk-tabs");
    tabs.replaceChildren();
    const tabList = [{ id: "all", name: "すべて" }, { id: "", name: "通常" }, ...opts.seriesTabs];
    const inTab = (it: RunItem, tab: string) => tab === "all" || (it.series ?? "") === tab;
    for (const tab of tabList) {
      const pool = ITEMS.filter((it) => inTab(it, tab.id));
      if (!pool.length) continue;
      const b = document.createElement("button");
      b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(zkTab === tab.id));
      b.textContent = tab.name;
      const sm = document.createElement("small"); sm.textContent = `${pool.filter((it) => kindSet.has(it.id)).length}/${pool.length}`;
      b.appendChild(sm);
      on(b, "click", () => { zkTab = tab.id; renderZukan(); });
      tabs.appendChild(b);
    }
    // スキルの種類で絞り込む（シリーズのタブと組み合わせて使える）
    const kindOf = (it: RunItem) => OSANPO_RUN_SKILL_BY_ID.get(it.id)?.kind;
    const kinds = $("zk-kinds");
    kinds.replaceChildren();
    const inTabList = ITEMS.filter((it) => inTab(it, zkTab));
    for (const k of ["all", ...(Object.keys(SKILL_KIND_LABELS) as SkillKind[])] as const) {
      const n = k === "all" ? inTabList.length : inTabList.filter((it) => kindOf(it) === k).length;
      if (!n) continue;
      const b = document.createElement("button");
      b.type = "button"; b.setAttribute("aria-pressed", String(zkKind === k));
      if (k !== "all") b.style.setProperty("--kc", SKILL_KIND_COLORS[k]);
      b.textContent = k === "all" ? "すべてのスキル" : SKILL_KIND_LABELS[k];
      const sm = document.createElement("small"); sm.textContent = String(n);
      b.appendChild(sm);
      on(b, "click", () => { zkKind = k; renderZukan(); });
      kinds.appendChild(b);
    }
    if (zkKind !== "all" && !inTabList.some((it) => kindOf(it) === zkKind)) zkKind = "all";
    const list = inTabList.filter((it) => zkKind === "all" || kindOf(it) === zkKind).sort((a, b) => rarityIndex(a.rarity) - rarityIndex(b.rarity));
    for (const it of list) {
      const li = document.createElement("li"), b = document.createElement("button"), got = kindSet.has(it.id);
      b.type = "button"; b.dataset.id = it.id; b.className = got ? "" : "osr-locked";
      b.style.setProperty("--rc", RARITY_STYLES[it.rarity].color);
      b.setAttribute("aria-label", got ? `${it.rarity} ${it.name}` : `${it.rarity} まだ拾っていないアイテム`);
      b.appendChild(spriteEl(it, 40, got, true));
      if (zkNew.has(it.id)) { const nb = document.createElement("span"); nb.className = "osr-nb"; nb.textContent = "NEW"; b.appendChild(nb); }
      on(b, "click", () => {
        zkNew.delete(it.id); b.querySelector(".osr-nb")?.remove(); zkShow(it.id);
        // スマホでは詳細が一覧の上にあるので、下の方のアイテムを選んだら詳細まで戻す
        if (window.matchMedia("(max-width: 760px)").matches) $("zk-detail").scrollIntoView({ block: "nearest", behavior: RM ? "auto" : "smooth" });
      });
      li.appendChild(b); grid.appendChild(li);
    }
    zkShow(zkSel && list.some((it) => it.id === zkSel) ? zkSel : null);
  }
  function buildRarityGuide(): void {
    const ul = $("rarity-list");
    ul.replaceChildren();
    for (const r of GACHA_RARITIES) {
      const pool = byRarity.get(r)!;
      if (!pool.length) continue;
      const li = document.createElement("li");
      const tag = document.createElement("span"); tag.className = "osr-rar"; tag.textContent = r; tag.style.color = RARITY_STYLES[r].color;
      const samples = document.createElement("span"); samples.className = "osr-samples";
      for (const it of [...pool].sort(() => Math.random() - 0.5).slice(0, 5)) samples.appendChild(spriteEl(it, 28));
      const pts = document.createElement("span"); pts.className = "osr-pts"; pts.textContent = `${pool.length}種 +${RARITY_STYLES[r].points}`;
      li.append(tag, samples, pts); ul.appendChild(li);
    }
    const note = document.createElement("li");
    note.className = "osr-note";
    note.textContent = opts.usesSampleItems
      ? "持っているアイテムがまだ少ないので、見本のアイテムも落ちています。ガチャで集めると、自分のアイテムが落ちてくるようになります。"
      : `ふだん落ちているのはほね（+${BONE_PTS}）で、ときどき図鑑アイテムが混ざる。続けて拾うとコンボで最大×5。LR・MRを拾うと、一度だけぶつかっても平気なバリアが付く。`;
    ul.appendChild(note);
  }

  /* ---------- 設定 ---------- */
  type OptKey = "calm" | "bgm" | "sfx" | "vib";
  const OPTS: readonly [OptKey, string, string][] = [
    ["calm", "ゆったりモード", "背景を止めて、道と障害物だけが動きます。背景の動きで酔いやすい人向け。"],
    ["bgm", "BGM", "ステージごとの音楽を流します。"],
    ["sfx", "効果音", "ジャンプやアイテム、雨の音。"],
    ["vib", "振動", "ぶつかったときに振動します（対応するスマホのみ）。"],
  ];
  const getOpt = (k: OptKey) => (k === "calm" ? S.calm : SET[k]);
  function setOpt(k: OptKey, v: boolean): void {
    if (k === "calm") { S.calm = v; store.set("calm", v ? "1" : "0"); }
    else { SET[k] = v; store.set("settings", JSON.stringify(SET)); applyAudio(); }
    syncOpts();
  }
  function syncOpts(): void {
    for (const b of $$("[data-opt]")) b.setAttribute("aria-pressed", String(getOpt(b.dataset.opt as OptKey)));
  }
  {
    const box = $("set-list");
    for (const [k, name, desc] of OPTS) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "osr-toggle"; b.dataset.opt = k;
      const sw = document.createElement("span"); sw.className = "osr-sw"; sw.setAttribute("aria-hidden", "true");
      const body = document.createElement("span");
      const bb = document.createElement("b"); bb.textContent = name;
      const sm = document.createElement("small"); sm.textContent = desc;
      body.append(bb, sm); b.append(sw, body); box.appendChild(b);
    }
    for (const b of $$("[data-opt]")) on(b, "click", () => { ensureAudio(); const k = b.dataset.opt as OptKey; setOpt(k, !getOpt(k)); });
    syncOpts();
  }
  /** 設定画面の「ご近所さん」。顔・名前の入力欄・なかよし度 */
  function renderNeighbors(): void {
    const box = $("nb-list");
    box.replaceChildren();
    for (const skin of DOG_SKIN_IDS) {
      const li = document.createElement("li");
      const face = document.createElement("img");
      face.className = "osr-nbr-face"; face.alt = ""; face.width = 44; face.height = 37; face.draggable = false;
      setDogSprite(face, skin, "stand-happy");
      const body = document.createElement("div");
      const input = document.createElement("input");
      input.type = "text"; input.maxLength = NEIGHBOR_NAME_MAX; input.placeholder = OSANPO_RUN_NEIGHBOR_DEFAULT_NAMES[skin];
      input.value = neighbors.names[skin] ?? ""; input.setAttribute("aria-label", `${getDogSkin(skin).name}の名前`);
      input.autocomplete = "off"; input.enterKeyHint = "done";
      on(input, "input", () => { neighbors.names[skin] = input.value.slice(0, NEIGHBOR_NAME_MAX); saveNeighbors(); });
      on(input, "keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") input.blur(); });
      const greets = neighborGreets(skin), lv = neighborLevel(greets), next = NEIGHBOR_LEVELS[lv + 1];
      const meta = document.createElement("small");
      meta.textContent = `${getDogSkin(skin).name}・${NEIGHBOR_LEVELS[lv]!.name}（あいさつ${greets}回${next ? `・あと${next.greets - greets}回で「${next.name}」` : ""}）`;
      const hearts = document.createElement("span"); hearts.className = "osr-nbr-hearts"; hearts.textContent = "♥".repeat(lv) + "♡".repeat(NEIGHBOR_LEVELS.length - 1 - lv);
      body.append(input, meta);
      li.append(face, body, hearts);
      box.appendChild(li);
    }
  }
  let setReturn: string | null = null;
  function openSettings(): void {
    ensureAudio();
    setReturn = ["start-panel", "over-panel", "pause-panel"].find((id) => !$(id).hidden) ?? null;
    if (setReturn) $(setReturn).hidden = true;
    if (S.state === "play" && !S.paused) { S.paused = true; setReturn = "pause-panel"; applyAudio(); }
    $("settings-panel").hidden = false;
    syncOpts();
    renderNeighbors();
    $("set-close").focus({ preventScroll: true });
  }
  function closeSettings(): void {
    $("settings-panel").hidden = true;
    if (setReturn) $(setReturn).hidden = false;
    setReturn = null;
  }
  for (const b of $$("[data-open='settings']")) on(b, "click", openSettings);

  /* ---------- 別画面（ルール・ずかん・称号・記録） ---------- */
  let openSheetName: string | null = null;
  function openSheet(name: string): void {
    if (S.state === "play" || S.state === "intro" || S.state === "dying") return;
    closeSheet();
    if (name === "zukan") renderZukan();
    else if (name === "ach") renderAchList();
    else if (name === "records") renderRecords();
    const el = $(`sheet-${name}`);
    el.hidden = false;
    // React 側で描いている画面（フレンドのランキング）に、開いたことを知らせて読み直してもらう
    window.dispatchEvent(new CustomEvent(OSANPO_RUN_SHEET_OPEN_EVENT, { detail: name }));
    el.querySelector<HTMLElement>(".osr-sheet-body")?.scrollTo(0, 0);
    openSheetName = name;
    el.querySelector<HTMLElement>(".osr-sheet-back")?.focus({ preventScroll: true });
  }
  function closeSheet(): void {
    if (!openSheetName) return;
    $(`sheet-${openSheetName}`).hidden = true;
    openSheetName = null;
    stageEl.focus({ preventScroll: true });
  }
  for (const b of $$("[data-sheet]")) on(b, "click", () => { ensureAudio(); openSheet(b.dataset.sheet ?? ""); });
  for (const b of $$("[data-close-sheet]")) on(b, "click", closeSheet);
  function renderRecords(): void {
    const box = $("rec-list");
    box.replaceChildren();
    for (const id of OSANPO_RUN_STAGE_IDS) {
      const st = OSANPO_RUN_STAGES[id], recs = recordsOf(id);
      const card = document.createElement("section");
      card.className = "osr-rec-card" + (unlocked.has(id) ? "" : " osr-locked");
      const h = document.createElement("h3"); h.textContent = st.name;
      const sub = document.createElement("p");
      sub.textContent = unlocked.has(id) ? `ベスト ${bestOf(id).toLocaleString()}点 ・ 最長 ${bestDistOf(id).toLocaleString()}m` : `未解放（${st.skinName}で歩ける）`;
      card.append(h, sub);
      const ol = document.createElement("ol"); ol.className = "osr-top5";
      if (!recs.length) { const li = document.createElement("li"); li.className = "osr-empty"; li.textContent = "まだ記録がありません"; ol.appendChild(li); }
      recs.forEach((r, i) => {
        const li = document.createElement("li");
        if (S.lastResult && id === STAGE_ID && r.t === lastRecordAt) li.className = "osr-me";
        const d = new Date(r.t);
        const cells = [String(i + 1), r.s.toLocaleString(), `${r.m}m`, `${d.getMonth() + 1}/${d.getDate()}`];
        (["i", "b", "span", "small"] as const).forEach((tag, k) => { const el = document.createElement(tag); el.textContent = cells[k] ?? ""; li.appendChild(el); });
        ol.appendChild(li);
      });
      card.appendChild(ol);
      box.appendChild(card);
    }
  }
  let lastRecordAt = 0;
  on($("set-close"), "click", closeSettings);
  on($("pause-btn"), "click", () => { if (S.state === "play" && !S.paused) pause(); $("pause-btn").blur(); });
  on($("mute"), "click", () => { ensureAudio(); setMuted(!muted); $("mute").blur(); stageEl.focus({ preventScroll: true }); });
  on(document, "visibilitychange", () => { if (document.hidden && S.state === "play" && !S.paused) pause(); });
  on(window, "blur", () => { if (S.state === "play" && !S.paused) pause(); });
  on($("copy"), "click", () => {
    const r = S.lastResult;
    if (!r) return;
    const text = `おさんぽフレンチー｜${STAGE.name}で ${r.score.toLocaleString()}点（${r.m}m・アイテム${r.items}こ・ランク${r.rank}）`;
    const note = $("copy-note");
    note.hidden = false;
    note.textContent = "";
    const fallback = () => {
      note.textContent = "コピーできなかったので、下の文を選んでコピーしてください。";
      const inp = document.createElement("input");
      inp.readOnly = true; inp.value = text;
      note.appendChild(inp); inp.focus(); inp.select();
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => { note.textContent = "コピーしました。"; }, fallback);
    else fallback();
  });

  /* ---------- アイテムスキル ---------- */
  const lvOf = (item: RunItem) => (item.rarity === "N" ? 1 : clamp(item.level || 1, 1, OSANPO_RUN_SKILL_MAX_LEVEL));
  const val = (v: Lv | undefined, lv: number, fallback = 0) => (v === undefined ? fallback : skillValue(v, lv));
  const ival = (v: Lv | undefined, lv: number, fallback = 0) => Math.round(val(v, lv, fallback));
  function inGroup(o: Obstacle, g: ObsGroup): boolean {
    const k = o.kind;
    // ほかのわんこは障害物ではないので、どのスキルでもはじいたり壊したりしない
    if (k === "buddy") return false;
    switch (g) {
      case "all": return true;
      case "hard": return isTrickKind(k) || k === "cone" || k === "bike" || k === "sign" || k === "roller" || k === "drop";
      case "rock": return k === "cone" || k === "drop";
      case "rockbike": return k === "suitcase" || k === "surprise" || k === "cone" || k === "bike" || k === "roller";
      case "bikesign": return k === "surprise" || k === "bike" || k === "sign";
      case "crow": return k === "crow" || k === "pigeons";
      case "crowcat": return k === "crow" || k === "cat";
      case "cat": return k === "cat" || k === "pigeons" || k === "roller";
      case "animals": return k === "crow" || k === "cat" || k === "pigeons";
      case "puddle": return k === "puddle" || k === "geyser";
      case "puddlecrow": return k === "puddle" || k === "crow" || k === "geyser";
      case "low": return k === "drone" || k === "noren" || (k === "crow" && o.low);
      case "ground": return k !== "crow" && k !== "noren" && k !== "drone";
    }
  }
  /** いま効いている効果をまとめたもの。毎フレームの最初に作る */
  const M = {
    mul: 1, magnet: 52, wide: false, big: false, jump: 1, air: 0, float: false, hop: false, auto: false, inv: false,
    speed: 1, hold: false, stop: false, comboLock: false, comboGrace: 0, dry: false, clear: false, bright: false, tints: [] as string[],
    rhythm: 0, over: 0,
  };
  function refreshMods(): void {
    Object.assign(M, {
      mul: 1, magnet: 52, wide: false, big: false, jump: 1, air: 0, float: false, hop: false, auto: false, inv: false,
      speed: 1, hold: false, stop: false, comboLock: false, comboGrace: 0, dry: false, clear: false, bright: false, tints: [],
      rhythm: 0, over: 0,
    });
    let step = 0;
    for (const a of K.buffs) {
      const { b, lv } = a;
      if (b.mul !== undefined) M.mul *= val(b.mul, lv, 1);
      if (b.magnet !== undefined) M.magnet = Math.max(M.magnet, val(b.magnet, lv));
      if (b.jump !== undefined) M.jump *= val(b.jump, lv, 1);
      if (b.air !== undefined) M.air = Math.max(M.air, b.air);
      if (b.speed !== undefined) M.speed *= val(b.speed, lv, 1);
      if (b.comboGrace !== undefined) M.comboGrace = Math.max(M.comboGrace, val(b.comboGrace, lv));
      if (b.tint) M.tints.push(b.tint);
      if (b.rhythm !== undefined) M.rhythm = Math.max(M.rhythm, val(b.rhythm, lv));
      if (b.over !== undefined) M.over += val(b.over, lv);
      M.wide ||= Boolean(b.wide); M.big ||= Boolean(b.big); M.float ||= Boolean(b.float); M.hop ||= Boolean(b.hop);
      M.auto ||= Boolean(b.auto); M.inv ||= Boolean(b.inv || b.auto); M.hold ||= Boolean(b.hold); M.stop ||= Boolean(b.stop);
      M.comboLock ||= Boolean(b.comboLock); M.dry ||= Boolean(b.dry); M.clear ||= Boolean(b.clear); M.bright ||= Boolean(b.bright);
      step += a.acc;
    }
    if (S.stepT > 0) M.mul *= STEP_BOOST_MUL;
    M.mul *= (1 + step) * K.runMul * (envAt(S.clock).night > 0.5 ? K.nightMul : 1) * (S.wx ? S.wx.mul : 1);
  }
  /** 加点。スキルのスコア倍率がかかった値を返す */
  function addPts(base: number): number {
    const v = Math.round(base * M.mul);
    S.bonus += v;
    return v;
  }
  function knock(o: Obstacle): void {
    if (isTrickKind(o.kind)) o.assisted = true;
    if (o.kind === "puddle") { o.gone = true; puff(o.x + o.w / 2, GROUND - 2, 8, "splash"); return; }
    if (o.kind === "pigeons") { o.flee = true; return; }
    o.hit = true; o.kvy = -460; o.spin = 8;
    puff(o.x + o.w / 2, GROUND - o.h / 2, 8, "spark", { g: 0 });
  }
  function skillText(text: string, color = "#FFE7A3", size = 13): void {
    if (K.textT > 0 && size < 15) return;
    K.textT = 0.35;
    floatText(P.x + 34, P.y - 92, text, color, size);
  }
  function startBuff(skill: OsanpoRunSkill, b: Buff, lv: number, idx: number): void {
    const sec = val(b.sec, lv);
    if (sec <= 0) return;
    const key = `${skill.id}:${idx}`;
    const same = K.buffs.find((a) => a.key === key);
    if (same) { same.t = sec; same.max = sec; same.lv = lv; return; }
    const wasInv = invLeft() > 0;
    K.buffs.push({ skill, b, lv, key, t: sec, count: 0, acc: 0, rampN: 0, rainAcc: 0, max: sec });
    if ((b.inv || b.auto) && !wasInv) announceInv();
  }
  /**
   * 無敵の残り秒数（無敵・自動回避・ラッシュ無敵のうち一番長いもの）。虹色のオーラと「無敵おわり」に使う。
   * 止まるスキル（おるすばん等）も当たらないが、止まっているだけなので無敵の演出は出さない
   */
  function invLeft(): number {
    let t = K.rushInv ? Math.max(0, S.secT) : 0;
    for (const a of K.buffs) if (a.b.inv || a.b.auto) t = Math.max(t, a.t);
    return t;
  }
  function announceInv(): void {
    floatText(P.x + 10, P.y - 104, "無敵！", "#FFE7A3", 22);
    [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.1, "square", 0.04, null, i * 0.05));
    puff(P.x, P.y - 30, 14, "spark", { g: 0 });
  }
  /** 身代わり・バリア・復活は合わせて1回ぶんまで。新しく付くときは前のものを外す */
  function clearWards(): void {
    K.guards = []; K.revives = []; S.shield = false;
  }
  /** 守りの強さ。復活 > バリア・身代わり > 水たまりだけ等の限定の身代わり */
  function wardRank(): number {
    if (K.revives.length) return 3;
    if (S.shield) return 2;
    const g = K.guards[0];
    return g ? (g.kinds === "all" ? 2 : 1) : 0;
  }
  /** 新しい守りを付けられるか。今の守りより弱いものは付けず、強いか同じなら入れかえる */
  function takeWard(rank: number): boolean {
    if (rank < wardRank()) { floatText(P.x + 10, P.y - 76, "もっと強い守りを持っている", "#C9C3F0", 12); return false; }
    clearWards();
    return true;
  }
  function endBuff(a: ActiveBuff): void {
    const { b, lv } = a;
    let pts = 0;
    if (b.endPts !== undefined) pts += val(b.endPts, lv);
    if (b.countPer !== undefined && a.count > 0) pts += a.count * val(b.countPer, lv);
    if (pts > 0) {
      const v = addPts(pts);
      floatText(P.x + 40, P.y - 100, `${a.skill.name} +${v}`, "#FFC857", 17);
      sfx.fanfare();
    }
  }
  /** スキルで出すアイテム。min 以上のレアリティ / 食べ物だけ、に絞る（該当なしならいちばん近いもの） */
  function pickItem(min?: GachaRarity, food?: boolean): RunItem {
    if (!min && !food) return rollItem();
    let pool = food ? ITEMS.filter((it) => it.category === "food") : ITEMS;
    if (!pool.length) return rollItem();
    if (min) {
      const hi = pool.filter((it) => rarityIndex(it.rarity) >= rarityIndex(min));
      if (hi.length) pool = hi;
      else { const top = Math.max(...pool.map((it) => rarityIndex(it.rarity))); pool = pool.filter((it) => rarityIndex(it.rarity) === top); }
    }
    return pickOne(pool);
  }
  function spawnShape(shape: SpawnShape, n: number, make: () => Pickup["item"], token: number): void {
    const X = VW + 30, add = (x: number, y: number, vy = 0) => { const p = mkPickup(x, y, token ? null : make(), token); p.vy = vy; pickups.push(p); };
    const drop = (y0: number) => { const p = mkPickup(0, y0, token ? null : make(), token); aimDrop(p); pickups.push(p); };
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0.5;
      if (shape === "row") add(X + i * 28, GROUND - 18);
      else if (shape === "line") add(X + i * 26, GROUND - 74);
      else if (shape === "high") add(X + i * 30, GROUND - 150 - Math.sin(t * Math.PI) * 10);
      else if (shape === "arc") add(X + i * 30, GROUND - 20 - 90 * 4 * t * (1 - t));
      else if (shape === "wave") add(X + i * 26, GROUND - 60 - Math.sin(t * Math.PI * 2) * 36);
      else if (shape === "ring") {
        // 輪は数が多く一度に取りやすいので、アイテムは3つに1つにして残りはほね（強すぎないように）
        const a = (i / n) * Math.PI * 2, x = X + 60 + Math.cos(a) * 52, y = GROUND - 100 + Math.sin(a) * 44;
        if (token || i % 3 === 0) add(x, y); else pickups.push(mkPickup(x, y, null));
      }
      else if (shape === "sky") { if (token || i % 3 === 0) drop(-20 - i * 26); else { const p = mkPickup(0, -20 - i * 26, null); aimDrop(p); pickups.push(p); } }
      else if (shape === "mid") add(X, GROUND - 84);
      else add(X, GROUND - 40);
    }
  }
  /**
   * 空から降らせるアイテムの x と落ちる速さを決める。
   * 落ちきるまでに流れる分を見込んで、フレブルの少し前〜画面の右寄りに着地するようにする
   */
  function aimDrop(p: Pickup): void {
    p.vy = rand(150, 190);
    const fallT = Math.max(0, GROUND - 18 - p.y) / p.vy;
    const land = rand(P.x + 90, Math.max(P.x + 120, VW - 40));
    p.x = land + S.speed * FALL_DRIFT * fallT;
  }
  function applySkill(item: RunItem, depth = 0): void {
    const skill = OSANPO_RUN_SKILL_BY_ID.get(item.id);
    if (!skill || S.state !== "play") return;
    const lv = lvOf(item);
    if (depth === 0) { sfx.skill(skill.kind); S.skillIds.add(skill.id); if (S.skillIds.size >= 10) unlock("skills10"); }
    skill.fx.forEach((fx, idx) => runFx(skill, fx, lv, idx, depth));
  }
  function runFx(skill: OsanpoRunSkill, fx: Fx, lv: number, idx: number, depth: number): void {
    switch (fx.op) {
      case "buff": startBuff(skill, fx.b, lv, idx); break;
      case "pts": { const v = addPts(val(fx.v, lv)); floatText(P.x + 20, P.y - 70, `+${v}`, "#FFC857", 14); break; }
      case "randPts": { const v = addPts(Math.round(rand(val(fx.min, lv), val(fx.max, lv)))); floatText(P.x + 20, P.y - 70, `+${v}`, "#FFC857", 15); break; }
      case "next": { const n = ival(fx.n, lv); if (n > 0) K.next.push({ left: n, add: val(fx.add, lv), mul: val(fx.mul, lv, 1), up: ival(fx.up, lv), dup: ival(fx.dup, lv), filter: fx.filter ?? "any" }); break; }
      case "best": K.best = { left: ival(fx.n, lv), mul: val(fx.mul, lv, 2), top: 0 }; break;
      case "guard": if (!takeWard((fx.kinds ?? "all") === "all" ? 2 : 1)) break; K.guards.push({ n: 1, t: fx.sec === undefined ? Infinity : val(fx.sec, lv), kinds: fx.kinds ?? "all", pts: val(fx.pts, lv), after: val(fx.after, lv), name: skill.name }); break;
      case "clear": K.clears.push({ n: ival(fx.n, lv), kinds: fx.kinds ?? "all", pts: val(fx.pts, lv), name: skill.name }); break;
      case "clearAll": {
        let got = 0;
        for (const o of obstacles) if (!o.hit && !o.gone && !o.flee && o.kind !== "buddy" && o.x < VW + 40) { knock(o); got += addPts(val(fx.pts, lv)); }
        if (got) floatText(VW / 2, GROUND * 0.34, `${skill.name} +${got}`, "#FFC857", 20);
        FX.flash = RM ? 0.08 : 0.2; FX.flashCol = "40,30,60";
        break;
      }
      case "spawn": { const n = ival(fx.n, lv); spawnShape(fx.shape, n, () => pickItem(fx.min, fx.food), fx.token === undefined ? 0 : ival(fx.token, lv)); break; }
      case "bonus": K.rushInv = false; setSection("bonus"); S.secT = val(fx.sec, lv); break;
      case "bonusSoon": if (S.sec === "normal") { S.secT = Math.max(0.6, S.secT * (1 - val(fx.frac, lv))); K.forceBonus = true; } break;
      case "rush": K.rushPass = Math.max(K.rushPass, val(fx.mul, lv, 1)); break;
      case "clock": {
        if (fx.add) S.clock += fx.add;
        if (fx.set !== undefined) S.clock += (((fx.set - S.clock) % 1440) + 1440) % 1440;
        if (fx.night !== undefined) {
          if (envAt(S.clock).night > 0.5) spawnShape("sky", ival(fx.night, lv), () => null, 150);
          else S.clock += ((((19 * 60 + 30) - S.clock) % 1440) + 1440) % 1440;
        }
        break;
      }
      case "revive": if (!takeWard(3)) break; K.revives.push({ keep: fx.keep ?? 1, pts: val(fx.pts, lv), mul: val(fx.mul, lv, 1), name: skill.name }); break;
      case "rare": K.rare = Math.max(K.rare, val(fx.mul, lv, 1)); break;
      case "nightMul": K.nightMul = Math.max(K.nightMul, val(fx.mul, lv, 1)); break;
      case "runMul": K.runMul = Math.max(K.runMul, val(fx.stage === STAGE_ID ? fx.stageMul ?? fx.mul : fx.mul, lv, 1)); break;
      case "delay": K.delays.push({ t: fx.sec, pts: val(fx.pts, lv), name: skill.name }); break;
      case "stack": if (K.stack < fx.max) { K.stack++; K.stackAdd += val(fx.add, lv); } break;
      case "cairn":
        if (++K.cairn >= fx.need) { K.cairn = 0; const v = addPts(val(fx.pts, lv)); floatText(P.x + 30, P.y - 96, `${skill.name}完成 +${v}`, "#FFC857", 17); sfx.fanfare(); }
        else floatText(P.x + 30, P.y - 80, `${K.cairn}/${fx.need}`, "#E8E0CE", 13);
        break;
      case "pouch": K.pouchMul = Math.max(K.pouchMul, val(fx.mul, lv, 2)); break;
      case "keepBest": K.keepBest += val(fx.times, lv, 1); break;
      case "pigeons": {
        let got = 0;
        for (const o of obstacles) if (o.kind === "pigeons" && !o.flee) { o.flee = true; got += addPts(val(fx.per, lv) * o.birds.length); }
        tone(1320, 0.08, "square", 0.05, 1760);
        if (got) floatText(P.x + 40, P.y - 70, `バサバサッ +${got}`, "#C9D6E8", 15);
        break;
      }
      case "bigJump": for (let i = 0; i < ival(fx.n, lv); i++) K.bigJumps.push(val(fx.mul, lv, 1.3)); break;
      case "random": {
        if (depth > 0) break;
        const pool = OSANPO_RUN_SKILLS.filter((s) => s.id !== skill.id && !s.fx.some((f) => f.op === "random"));
        for (let i = 0; i < ival(fx.n, lv); i++) {
          const other = pickOne(pool);
          skillText(`★${other.name}`, "#C9B8FF", 15);
          other.fx.forEach((f, j) => runFx(other, f, lv, j, depth + 1));
        }
        break;
      }
      case "reroll": K.reroll += ival(fx.n, lv); break;
      case "lucky": {
        const n = ival(fx.n, lv), hits = Math.min(n, ival(fx.hits, lv));
        const q = Array.from({ length: n }, (_, i) => i < hits);
        for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [q[i], q[j]] = [q[j]!, q[i]!]; }
        K.lucky.push(...q);
        break;
      }
      case "first": { const v = addPts(val((S.haul.get(skill.id) ?? 0) <= 1 ? fx.first : fx.later, lv)); floatText(P.x + 20, P.y - 70, `+${v}`, "#FFC857", 14); break; }
      case "series": {
        const kinds = [...S.haul.keys()].filter((id) => ITEMS.find((it) => it.id === id)?.series === fx.series).length;
        const v = addPts(kinds * val(fx.per, lv));
        floatText(P.x + 20, P.y - 70, `${kinds}種類 +${v}`, "#FFC857", 14);
        break;
      }
      case "combo": {
        const add = ival(fx.add, lv) + (STAGE.weather === "snow" && S.rain > 0.3 ? ival(fx.snow, lv) : 0);
        const prev = S.mult;
        S.mult = Math.min(5, S.mult + add); S.chain = Math.max(S.chain, (S.mult - 1) * 4); S.chainT = Math.max(S.chainT, 1.5);
        S.maxMult = Math.max(S.maxMult, S.mult);
        if (S.mult > prev) { retrigger($("combo"), "osr-pulse"); onComboUp(S.mult - prev); }
        if (S.mult >= 5) unlock("combo5");
        break;
      }
      case "comboGuard": K.comboGuard += ival(fx.n, lv); break;
      case "comboPts": { const v = addPts(Math.min(30, S.chain) * val(fx.per, lv)); floatText(P.x + 20, P.y - 70, `+${v}`, "#FFC857", 14); break; }
      case "maxCombo": if (S.mult >= 5) { const v = addPts(val(fx.pts, lv)); floatText(P.x + 20, P.y - 76, `かんぱーい！ +${v}`, "#FFC857", 16); } break;
      case "weatherPts": { const v = addPts(val(fx.v, lv) * (S.rain > 0.3 ? 1 : 0.5)); floatText(P.x + 20, P.y - 70, `+${v}`, "#FFC857", 14); break; }
      case "miss": K.miss += ival(fx.n, lv); break;
      case "echo": if (K.lastItem) { const it = K.lastItem; spawnShape("arc", ival(fx.n, lv), () => it, 0); } break;
      case "reset": K.ramp = 0; floatText(P.x + 30, P.y - 80, "スピードが最初に戻った", "#9BE7FF", 14); break;
    }
  }
  function onComboUp(steps: number): void {
    for (const a of K.buffs) if (a.b.comboStep !== undefined) a.acc += val(a.b.comboStep, a.lv) * steps;
  }
  /** ぶつかったとき。true ならそのまま倒れる */
  function resolveHit(o: Obstacle): boolean {
    for (const a of K.buffs) {
      if (a.b.smash !== undefined && inGroup(o, a.b.smashKinds ?? "all")) {
        knock(o); const v = addPts(val(a.b.smash, a.lv));
        floatText(o.x + o.w / 2, GROUND - o.h - 20, `+${v}`, "#FFC857", 14); sfx.guard();
        return false;
      }
    }
    for (const a of K.buffs) {
      if (a.b.pass !== undefined) {
        if (!o.passed) { o.passed = true; const v = addPts(val(a.b.pass, a.lv)); floatText(o.x + o.w / 2, GROUND - o.h - 20, `すり抜け +${v}`, "#C9B8FF", 13); }
        return false;
      }
    }
    if (M.inv || M.stop || K.rushInv) {
      // 無敵中は、ぶつかった障害物を吹っ飛ばす
      knock(o); sfx.guard();
      if (++S.knocks >= 10) unlock("knock10");
      const v = addPts(10);
      floatText(o.x + o.w / 2, GROUND - o.h - 20, `ドカッ +${v}`, "#FFE7A3", 14);
      FX.hitstop = RM ? 0 : 0.03;
      return false;
    }
    for (const a of K.buffs) if (a.b.immune && inGroup(o, a.b.immune)) return false;
    const g = K.guards.find((x) => x.n > 0 && x.t > 0 && inGroup(o, x.kinds));
    if (g) {
      g.n--; K.cairn = 0; knock(o); P.inv = 1; sfx.guard();
      const v = g.pts ? addPts(g.pts) : 0;
      floatText(P.x + 10, P.y - 60, `${g.name}で助かった！${v ? ` +${v}` : ""}`, "#7EF0D0", 15);
      puff(P.x + 10, P.y - 26, 14, "spark", { g: 0 });
      if (g.after > 0) K.buffs.push({ skill: OSANPO_RUN_SKILL_BY_ID.get("sushi_awabi") ?? OSANPO_RUN_SKILLS[0]!, b: { sec: g.after, inv: true, label: "はりつき無敵" }, lv: 1, key: "guard-after", t: g.after, count: 0, acc: 0, rampN: 0, rainAcc: 0, max: g.after });
      return false;
    }
    return true;
  }
  /** 倒れる直前。復活スキルがあれば使う */
  function tryRevive(o: Obstacle): boolean {
    const r = K.revives.shift();
    if (!r) return false;
    knock(o); P.inv = 2; K.cairn = 0;
    if (r.keep < 1) { const loss = Math.floor(score() * (1 - r.keep)); S.bonus -= loss; floatText(P.x + 30, P.y - 40, `-${loss}`, "#FF9A9A", 14); }
    const v = r.pts ? addPts(r.pts) : 0;
    floatText(VW / 2, GROUND * 0.32, `${r.name} 復活！${v ? ` +${v}` : ""}`, "#7EF0D0", 22);
    if (r.mul > 1) K.buffs.push({ skill: OSANPO_RUN_SKILL_BY_ID.get("other_okaeri") ?? OSANPO_RUN_SKILLS[0]!, b: { sec: 10, mul: r.mul, label: "おかえりブースト" }, lv: 1, key: "revive-after", t: 10, count: 0, acc: 0, rampN: 0, rainAcc: 0, max: 10 });
    sfx.barrier(); FX.flash = RM ? 0.1 : 0.25; FX.flashCol = "126,240,208";
    puff(P.x + 10, P.y - 26, 18, "spark", { g: 0 });
    return true;
  }
  /** 毎フレームのスキル処理（プレイ中だけ） */
  function tickSkills(dt: number): void {
    if (K.textT > 0) K.textT -= dt;
    for (const a of K.buffs) {
      a.t -= dt;
      const rain = val(a.b.rain, a.lv);
      if (rain > 0) {
        a.rainAcc += rain * dt;
        while (a.rainAcc >= 1) {
          a.rainAcc -= 1;
          const tok = ival(a.b.rainToken, a.lv);
          // アイテムが降るスキルは、輪と同じく3つに1つだけアイテムで、残りはほね
          const n = a.rainN ?? 0; a.rainN = n + 1;
          const item = tok ? null : n % 3 === 0 ? rollItem() : null;
          const p = mkPickup(0, -16, item, tok);
          aimDrop(p); pickups.push(p);
        }
      }
      if (a.b.dry) { S.rainTarget = 0; S.rainT = 0; }
    }
    const ended = K.buffs.filter((a) => a.t <= 0);
    if (ended.length) {
      const hadInv = invLeft() > 0 || ended.some((a) => a.b.inv || a.b.auto);
      K.buffs = K.buffs.filter((a) => a.t > 0); ended.forEach(endBuff);
      if (hadInv && invLeft() <= 0) { floatText(P.x + 10, P.y - 96, "無敵おわり", "#C9C3F0", 14); tone(784, 0.12, "triangle", 0.05, 392); }
    }
    for (const g of K.guards) if (g.t !== Infinity) g.t -= dt;
    K.guards = K.guards.filter((g) => g.n > 0 && g.t > 0);
    for (const d of K.delays) {
      d.t -= dt;
      if (d.t <= 0) { const v = addPts(d.pts); floatText(P.x + 30, P.y - 90, `${d.name} できた！ +${v}`, "#FFC857", 16); sfx.fanfare(); }
    }
    K.delays = K.delays.filter((d) => d.t > 0);
    // 前から来る障害物をはじく・追い払う
    for (const o of obstacles) {
      if (o.hit || o.gone || o.flee || o.x > P.x + 240 || o.x + o.w < P.x - 10) continue;
      const c = K.clears.find((x) => x.n > 0 && inGroup(o, x.kinds));
      if (c) {
        c.n--; knock(o);
        const v = c.pts ? addPts(c.pts) : 0;
        floatText(o.x + o.w / 2, GROUND - o.h - 24, `${c.name}${v ? ` +${v}` : ""}`, "#9BE7FF", 13);
        continue;
      }
      if (K.buffs.some((a) => a.b.repel && inGroup(o, a.b.repel))) knock(o);
    }
    K.clears = K.clears.filter((x) => x.n > 0);
    // 自動でよける
    if (M.auto) {
      const lead = S.speed * 0.3 + 36;
      const o = obstacles.find((x) => !x.hit && !x.gone && !x.flee && x.x + x.w > P.x - 6 && x.x - (P.x + 22) < lead);
      if (o) {
        if (o.kind === "noren" || o.low) { if (P.ground) slideDown(false, 0.5); }
        else if (o.kind !== "crow" && P.ground) jump(JUMP_V, 1);
      }
    }
    if (M.hop && P.ground && !P.slide) jump(560, 1, true);
  }
  /** アイテムを拾ったときの点数（スキルの倍率・加点を反映） */
  function itemPoints(item: RunItem, airborne: boolean): { pts: number; copies: number; rarity: GachaRarity } {
    const matches = (f: ItemFilter | undefined) =>
      !f || f === "any" || (f === "food" && item.category === "food") || (f === "N" && item.rarity === "N") ||
      (f === "NR" && (item.rarity === "N" || item.rarity === "R")) || (f === "air" && airborne);
    let up = 0, add = K.stackAdd, mul = 1, dup = 0;
    for (const q of K.next) {
      if (q.left <= 0) continue;
      q.left--;
      if (!matches(q.filter)) continue;
      up += q.up; add += q.add; mul *= q.mul; dup += q.dup;
    }
    K.next = K.next.filter((q) => q.left > 0);
    for (const a of K.buffs) {
      const { b, lv } = a;
      if (b.itemMul !== undefined && matches(b.itemFilter)) mul *= val(b.itemMul, lv, 1);
      if (b.itemAdd !== undefined && matches(b.itemFilter)) add += val(b.itemAdd, lv);
      if (b.ramp !== undefined) { a.rampN++; add += a.rampN * val(b.ramp, lv); }
      if (b.fresh !== undefined && (S.haul.get(item.id) ?? 0) === 0) add += val(b.fresh, lv);
      a.count++;
    }
    const rarity = GACHA_RARITIES[Math.min(GACHA_RARITIES.length - 1, rarityIndex(item.rarity) + up)]!;
    const base = RARITY_STYLES[rarity].points * S.mult;
    return { pts: Math.round((base * mul + add) * (1 + dup) * M.mul), copies: 1 + dup, rarity };
  }
  /** HUD の「いま効いているスキル」の1行 */
  /** t/max があれば残り秒数、なければ count（「×2」「2/3」など）をカードの右端に出す */
  type SkillRow = { key: string; item: RunItem | null; glyph: string; label: string; tag: string; kind: SkillKind; t: number; max: number; count: string; desc: string };
  /** 効果をひと言で（左上の行の右側に出す） */
  function buffTag(b: Buff, lv: number): string {
    const x = (v: Lv | undefined) => `×${Math.round(val(v, lv, 1) * 10) / 10}`;
    if (b.stop) return "ストップ";
    if (b.auto) return "自動よけ";
    if (b.inv) return "無敵";
    if (b.smash !== undefined) return "こわす";
    if (b.pass !== undefined) return "すり抜け";
    if (b.mul !== undefined) return `スコア${x(b.mul)}`;
    if (b.itemMul !== undefined) return `アイテム${x(b.itemMul)}`;
    if (b.comboStep !== undefined) return "倍率アップ";
    if (b.immune || b.repel || b.noSpawn) return "よける";
    if (b.speed !== undefined) return `速さ${x(b.speed)}`;
    if (b.hold) return "速さキープ";
    if (b.air) return "空中ジャンプ";
    if (b.jump !== undefined) return `ジャンプ${x(b.jump)}`;
    if (b.float) return "ふわふわ";
    if (b.hop) return "ぴょんぴょん";
    if (b.magnet !== undefined || b.wide || b.big || b.spark) return "吸い寄せ";
    if (b.rain !== undefined) return "降ってくる";
    if (b.comboLock) return "コンボ固定";
    if (b.comboGrace !== undefined) return "コンボ延長";
    if (b.rhythm !== undefined) return "リズム";
    if (b.dry || b.clear || b.bright) return "見やすい";
    return "加点";
  }
  function skillRows(limit = 5): SkillRow[] {
    const rows: SkillRow[] = [];
    const itemOf = (id: string) => ITEMS.find((it) => it.id === id) ?? null;
    for (const a of K.buffs) {
      const label = a.b.label ?? a.skill.name;
      const same = rows.find((r) => r.label === label);
      if (same) { if (a.t > same.t) { same.t = a.t; same.max = a.max; } continue; }
      const isMax = a.lv >= OSANPO_RUN_SKILL_MAX_LEVEL;
      const desc = a.b.label ? `${a.skill.name}のあとの効果` : isMax ? `${a.skill.desc}（Lv.MAX：${a.skill.max}）` : a.skill.desc;
      rows.push({ key: a.key, item: itemOf(a.skill.id), glyph: "★", label, tag: buffTag(a.b, a.lv), kind: a.skill.kind, t: a.t, max: a.max || a.t, count: "", desc });
    }
    const add = (key: string, glyph: string, label: string, tag: string, count: string, kind: SkillKind, desc: string) =>
      rows.push({ key, item: null, glyph, label, tag, kind, t: 0, max: 0, count, desc });
    if (S.wx) {
      const info = WEATHER_INFO[S.wx.kind];
      rows.unshift({ key: `wx-${S.wx.kind}`, item: null, glyph: info.glyph, label: info.title.split("！")[0]!, tag: info.tag, kind: "weather", t: S.wx.t, max: S.wx.max, count: "", desc: info.desc });
    }
    if (S.stepT > 0) rows.push({ key: "steps", item: null, glyph: "👣", label: "歩数ブースト", tag: `×${STEP_BOOST_MUL}`, kind: "score", t: S.stepT, max: STEP_BOOST_SEC, count: "", desc: OSANPO_RUN_STEP_BOOSTS[0].desc });
    const clears = K.clears.reduce((n, c) => n + c.n, 0);
    if (clears) add("clears", "✦", K.clears[0]!.name, "はじく", `×${clears}`, "guard", "前から来る障害物をはじき飛ばす");
    if (K.rushPass) add("rush", "⚡", "あずき色の風", "ラッシュ無敵", "×1", "bonus", "次のラッシュを無敵で乗り切り、突破ボーナスが増える");
    if (K.comboGuard) add("cguard", "♥", "コンボ守り", "コンボ守り", `×${K.comboGuard}`, "combo", "コンボが切れそうになったら防ぐ");
    if (K.miss) add("miss", "✋", "てぶくろ", "自動キャッチ", `×${K.miss}`, "collect", "取りこぼしたアイテムを自動で拾う");
    if (K.bigJumps.length) add("bigjump", "⤴", "大ジャンプ", "大ジャンプ", `×${K.bigJumps.length}`, "jump", "次のジャンプが大きくなる");
    if (K.cairn) add("cairn", "▲", "積み石", "積み石", `${K.cairn}/3`, "score", "3つ積むとボーナス（ぶつかって守られると崩れる）");
    return rows.slice(0, limit);
  }
  /** 左上に、効いているスキルを1行ずつ縦に並べる。行の組み合わせが変わったときだけ作り直し、残り時間は毎フレーム更新 */
  function renderSkillRows(): void {
    const rows = S.state === "play" ? skillRows() : [];
    const box = $("skills");
    const sig = rows.map((r) => `${r.key}/${r.tag}`).join("|");
    setFlag("skills-on", rows.length > 0, (v) => { box.hidden = !v; });
    if (hud.get("skills") !== sig) {
      hud.set("skills", sig);
      box.replaceChildren(...rows.map((r) => {
        const row = document.createElement("div");
        row.className = "osr-sk"; row.style.setProperty("--kc", SKILL_KIND_COLORS[r.kind]);
        const ic = document.createElement("span"); ic.className = "osr-sk-ic";
        if (r.item) ic.appendChild(spriteEl(r.item, 20, true)); else ic.textContent = r.glyph;
        const tg = document.createElement("span"); tg.className = "osr-sk-tag"; tg.textContent = r.tag;
        const tm = document.createElement("b"); tm.className = "osr-sk-t";
        const bar = document.createElement("i"); bar.className = "osr-sk-bar";
        // スキル名は出さない（どのアイテムかは画像、効果はタグでわかる。名前は拾ったときのポップアップで見られる）
        row.title = r.label;
        row.append(ic, tg, tm, bar);
        return row;
      }));
    }
    rows.forEach((r, i) => {
      const row = box.children[i] as HTMLElement | undefined;
      if (!row) return;
      const tm = row.querySelector<HTMLElement>(".osr-sk-t")!, bar = row.querySelector<HTMLElement>(".osr-sk-bar")!;
      const timed = r.max > 0;
      const txt = timed ? `${Math.ceil(r.t)}` : r.count;
      if (tm.textContent !== txt) tm.textContent = txt;
      bar.style.transform = `scaleX(${timed ? clamp(r.t / r.max, 0, 1).toFixed(3) : "1"})`;
      row.classList.toggle("osr-sk-end", timed && r.t < 1.5);
    });
  }

  /* ---------- 天気のイベント ---------- */
  const WEATHER_INFO: Record<WeatherKind, { sec: number; mul: number; title: string; glyph: string; tag: string; desc: string }> = {
    rainbow: { sec: 10, mul: 1.2, title: "虹がかかった！ スコア×1.2", glyph: "🌈", tag: "スコア×1.2", desc: "雨あがりの虹。見えているあいだスコア×1.2" },
    thunder: { sec: 12, mul: 1, title: "かみなり！ カラスがびっくりして逃げていく", glyph: "⚡", tag: "カラス逃げる", desc: "雷が光るたびに、画面のカラスが逃げていく（1羽+20）" },
    sakura: { sec: 14, mul: 1, title: "桜吹雪！ 花びらを拾うと+5", glyph: "🌸", tag: "花びら+5", desc: "空から花びらが舞ってくる。拾うと1枚+5" },
    momiji: { sec: 14, mul: 1, title: "紅葉が舞ってきた！ 葉っぱを拾うと+5", glyph: "🍁", tag: "紅葉+5", desc: "空から紅葉が舞ってくる。拾うと1枚+5" },
    aurora: { sec: 15, mul: 1.3, title: "オーロラ！ スコア×1.3", glyph: "✨", tag: "スコア×1.3", desc: "夜空にオーロラ。見えているあいだスコア×1.3" },
  };
  function startWeather(kind: WeatherKind): void {
    const info = WEATHER_INFO[kind];
    S.wx = { kind, t: info.sec, max: info.sec, acc: 0, mul: info.mul, nextBolt: 0.4 };
    floatText(VW / 2, GROUND * 0.44, info.title, kind === "thunder" ? "#FFF3A0" : "#FFE7F2", 17);
    sfx.title();
  }
  /** 道と時間帯にあう天気のイベントを、ときどき起こす */
  function tickWeather(dt: number): void {
    const wx = S.wx;
    if (wx) {
      wx.t -= dt;
      if (wx.kind === "sakura" || wx.kind === "momiji") {
        wx.acc += dt * 2.2;
        while (wx.acc >= 1) {
          wx.acc -= 1;
          const p = mkPickup(0, -16, null, 5); p.look = wx.kind === "sakura" ? "petal" : "leaf"; aimDrop(p); p.vy *= 0.6; pickups.push(p);
        }
        if (!RM && Math.random() < dt * 18) parts.push({ x: rand(0, VW + 40), y: -10, vx: rand(-60, -20), vy: rand(30, 70), life: 0, max: rand(3, 5), r: rand(2, 3.5), kind: "fw", color: wx.kind === "sakura" ? "255,190,210" : pickOne(["235,110,60", "245,160,60", "220,70,50"]), g: 6, scroll: false });
      } else if (wx.kind === "thunder") {
        wx.nextBolt -= dt;
        if (wx.nextBolt <= 0) {
          wx.nextBolt = rand(1.8, 3.4);
          FX.flash = RM ? 0.12 : 0.4; FX.flashCol = "220,230,255";
          const timer = window.setTimeout(() => noise(0.9, 0.16, 180), 150);
          cleanups.push(() => window.clearTimeout(timer));
          let got = 0;
          for (const o of obstacles) if (o.kind === "crow" && !o.hit && o.x < VW + 20) { o.vx = -380; o.hit = true; o.kvy = -300; o.spin = 4; got += addPts(20); }
          if (got) floatText(VW / 2, GROUND * 0.36, `カラスが逃げた +${got}`, "#FFF3A0", 15);
        }
      }
      if (wx.t <= 0) S.wx = null;
      return;
    }
    S.wxT -= dt;
    if (S.wxT > 0 || S.sec !== "normal") return;
    S.wxT = rand(35, 55);
    const night = envAt(S.clock).night > 0.5, raining = S.rain > 0.4;
    const pool: WeatherKind[] = [];
    if (raining && STAGE.weather !== "snow") pool.push("thunder", "thunder");
    if (!night && !raining) pool.push("rainbow");
    if (STAGE_ID === "town") pool.push("sakura", "sakura");
    if (STAGE_ID === "hiking") pool.push("momiji", "momiji");
    if (night && (STAGE_ID === "snow" || STAGE_ID === "hiking")) pool.push("aurora", "aurora");
    if (pool.length && Math.random() < 0.75) startWeather(pickOne(pool));
  }
  /** 空に描く天気（虹・オーロラ・雷の空の暗さ）。山や建物より奥 */
  function drawWeatherSky(c: Ctx): void {
    const wx = S.wx;
    if (!wx) return;
    const fade = Math.min(1, (wx.max - wx.t) / 1.2, wx.t / 1.5);
    if (wx.kind === "rainbow") {
      const cx = VW * 0.62, cy = GROUND + 30, r0 = Math.min(VW * 0.5, 300);
      const cols = ["255,90,90", "255,160,70", "255,225,90", "110,210,120", "90,160,255", "150,110,230"];
      c.save(); c.lineWidth = 7;
      cols.forEach((col, i) => { c.strokeStyle = `rgba(${col},${0.32 * fade})`; c.beginPath(); c.arc(cx, cy, r0 - i * 7, Math.PI, 0); c.stroke(); });
      c.restore();
    } else if (wx.kind === "aurora") {
      c.save(); c.globalCompositeOperation = "lighter";
      for (let b = 0; b < 3; b++) {
        const col = ["120,255,190", "140,200,255", "200,140,255"][b]!;
        const g = c.createLinearGradient(0, 10, 0, GROUND * 0.55);
        g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.5, `rgba(${col},${0.22 * fade})`); g.addColorStop(1, `rgba(${col},0)`);
        c.fillStyle = g; c.beginPath(); c.moveTo(-20, GROUND * 0.55);
        for (let x = -20; x <= VW + 20; x += 20) c.lineTo(x, 20 + b * 18 + Math.sin(x * 0.012 + S.time * (0.6 + b * 0.2) + b) * 22);
        c.lineTo(VW + 20, GROUND * 0.55); c.closePath(); c.fill();
      }
      c.restore();
    } else if (wx.kind === "thunder") {
      c.fillStyle = `rgba(20,20,45,${0.28 * fade})`; c.fillRect(-20, -20, VW + 40, GROUND + 30);
    }
  }

  /* ---------- 進行 ---------- */
  function newRoundId(): string {
    try { if (typeof crypto !== "undefined" && crypto.randomUUID) return `osr-${crypto.randomUUID()}`; } catch { /* 古い端末 */ }
    return `osr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
  /** 結果をサーバーへ送り、もらえたコインを結果画面に出す */
  function sendResult(score: number, meters: number): void {
    const el = $("o-coins");
    if (!opts.onRunEnd || !S.roundId) { el.hidden = true; return; }
    const roundId = S.roundId;
    S.roundId = ""; // 同じおさんぽを二度送らない
    el.hidden = false; el.dataset.state = "wait";
    el.textContent = "コインを受け取り中…";
    opts.onRunEnd({ roundId, stage: STAGE_ID, score, meters, items: S.treats })
      .then((coins) => {
        if (coins === null) { el.dataset.state = "error"; el.textContent = "通信できず、コインを受け取れませんでした"; return; }
        el.dataset.state = coins > 0 ? "ok" : "zero";
        el.textContent = coins > 0 ? `+${coins.toLocaleString()} コイン ゲット！` : "コインはスコア50点ごとに1枚";
        if (coins > 0) sfx.mile();
      })
      .catch(() => { el.dataset.state = "error"; el.textContent = "通信できず、コインを受け取れませんでした"; });
  }
  /** 歩いた距離の点（1mごとに METER_PTS 点）＋ 拾ったもの・スキルなどの点 */
  const score = () => Math.floor(S.dist / 50) * METER_PTS + S.bonus;
  /* ---------- 歩数ブースト（今日の歩数に応じてスタート時に付く） ---------- */
  const todaySteps = typeof opts.todaySteps === "number" ? opts.todaySteps : null;
  const stepLv = stepBoostLevel(todaySteps);
  function renderStepBoost(): void {
    const box = $("step-boost");
    box.replaceChildren();
    const head = document.createElement("b");
    head.textContent = todaySteps === null ? "👣 歩数ブースト" : `👣 今日 ${todaySteps.toLocaleString()}歩`;
    const ul = document.createElement("ul");
    for (const [i, b] of OSANPO_RUN_STEP_BOOSTS.entries()) {
      const li = document.createElement("li");
      li.dataset.on = i < stepLv ? "1" : "0";
      const st = document.createElement("span"); st.textContent = `${b.steps.toLocaleString()}歩〜`;
      const lb = document.createElement("span"); lb.textContent = b.label;
      li.append(st, lb);
      li.title = b.desc;
      ul.appendChild(li);
    }
    const note = document.createElement("small");
    note.textContent = todaySteps === null
      ? "アプリに歩数を同期すると、歩いた分だけスタートが有利になります。"
      : stepLv === OSANPO_RUN_STEP_BOOSTS.length ? "ぜんぶ付いてスタート！" : `あと${(OSANPO_RUN_STEP_BOOSTS[stepLv]!.steps - todaySteps).toLocaleString()}歩で「${OSANPO_RUN_STEP_BOOSTS[stepLv]!.label}」`;
    box.append(head, ul, note);
  }
  /** スタートの合図と同時に、届いている段階の効果を付ける */
  function applyStepBoost(): void {
    if (stepLv <= 0) return;
    S.stepT = STEP_BOOST_SEC;
    if (stepLv >= 2 && wardRank() < 2) { clearWards(); S.shield = true; sfx.barrier(); }
    if (stepLv >= 3) setSection("bonus");
    floatText(VW / 2, GROUND * 0.22, `歩数ブースト！ ${todaySteps?.toLocaleString() ?? 0}歩`, "#9BE7FF", 18);
  }
  function start(): void {
    closeSheet();
    hidePanels();
    $("copy-note").hidden = true;
    FX.fade = RM ? 0 : 1;
    Object.assign(S, {
      state: "intro", introT: 0, roundId: newRoundId(), slowT: 0, wx: null, wxT: rand(25, 40), knocks: 0, rares: 0, skillIds: new Set<string>(), tricks: newTrickRun(), bestD: bestDistOf(STAGE_ID), passedBest: false, recordShown: false, fwT: 2,
      t: 0, speed: 0, dist: 0, bonus: 0, treats: 0, clock: STAGE.clock, srPlus: 0, pigeonsRun: 0, slidesRun: 0, greetsRun: 0, routeCalm: 0, routeRisky: 0, bonusBest: 0, missionCoins: 0, missionsNow: [], stomps: 0, digs: 0,
      memo: null, memoT: rand(10, 17),
      stepT: 0, fork: null, route: null, forkT: rand(35, 50), next: 420, shield: false, chain: 0, chainT: 0, mult: 1, maxMult: 1,
      paused: false, deadT: 0, milestone: 100, bufT: 0, haul: new Map<string, number>(), sec: "normal", secT: 18, rain: 0, rainTarget: 0, rainT: 0,
      bones: 0, newAch: [], newKinds: [], rainWalk: 0, rushes: 0, closes: 0, bonusGot: 0,
    });
    Object.assign(P, { y: GROUND, vy: 0, ground: true, jumps: 2, sq: 1, rot: 0, inv: 0, dead: false, slide: false, slideT: 0, slideHeld: false, jumpAt: -1 });
    obstacles = []; pickups = []; texts = []; flyers = []; parts = []; sniffs = []; stompAt = -1; P.dive = false;
    K = newSkillState(); refreshMods();
    applyAudio();
    floatText(P.x + 4, P.y - 84, "よーい…", "#F6EFE4", 20);
    sfx.ready();
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== stageEl) active.blur();
    stageEl.focus({ preventScroll: true });
  }
  function pause(): void {
    S.paused = true; P.slideHeld = false;
    $("pause-msg").textContent = `いま ${Math.floor(S.dist / 50)}m・${score().toLocaleString()}点。フレンチーはひと休み中。`;
    renderPauseSkills();
    $("pause-panel").hidden = false;
    applyAudio();
    $("resume").focus({ preventScroll: true });
  }
  /** 休憩画面に、いま効いているスキルと守りを説明つきで並べる */
  function renderPauseSkills(): void {
    const box = $("pause-skills");
    const rows = skillRows(20);
    const ward = S.shield ? ["バリア", "LR・MRのバリア。1回だけぶつかっても平気"]
      : K.guards[0] ? [`身代わり（${K.guards[0].name}）`, "1回だけぶつかっても平気"]
      : K.revives[0] ? [`復活（${K.revives[0].name}）`, "1回だけ倒れても復活できる"] : null;
    box.replaceChildren();
    box.hidden = rows.length === 0 && !ward;
    if (box.hidden) return;
    const h = document.createElement("h3"); h.textContent = "いま効いているスキル";
    const ul = document.createElement("ul");
    for (const r of rows) {
      const li = document.createElement("li"); li.style.setProperty("--kc", SKILL_KIND_COLORS[r.kind]);
      const ic = document.createElement("span"); ic.className = "osr-ps-ic";
      if (r.item) ic.appendChild(spriteEl(r.item, 26, true)); else ic.textContent = r.glyph;
      const body = document.createElement("div");
      const top = document.createElement("div"); top.className = "osr-ps-top";
      const nm = document.createElement("b"); nm.textContent = r.label;
      const tg = document.createElement("span"); tg.className = "osr-ps-tag"; tg.textContent = r.tag;
      const rest = document.createElement("em"); rest.textContent = r.max > 0 ? `あと${Math.ceil(r.t)}秒` : r.count;
      top.append(nm, tg, rest);
      const d = document.createElement("small"); d.textContent = r.desc;
      body.append(top, d);
      li.append(ic, body); ul.appendChild(li);
    }
    if (ward) {
      const li = document.createElement("li"); li.style.setProperty("--kc", "#7EF0D0");
      const ic = document.createElement("span"); ic.className = "osr-ps-ic"; ic.textContent = "★";
      const body = document.createElement("div");
      const top = document.createElement("div"); top.className = "osr-ps-top";
      const nm = document.createElement("b"); nm.textContent = `守り：${ward[0]}`;
      top.append(nm);
      const d = document.createElement("small"); d.textContent = ward[1]!;
      body.append(top, d); li.append(ic, body); ul.appendChild(li);
    }
    box.append(h, ul);
  }
  function resume(): void {
    S.paused = false;
    hidePanels();
    applyAudio();
    last = performance.now();
    stageEl.focus({ preventScroll: true });
  }
  function die(): void {
    if (S.t < 5) unlock("quick");
    S.state = "dying"; S.deadT = 0; P.dead = true; P.vy = -420; P.ground = false;
    sfx.crash(); bgmStop();
    puff(P.x + 20, P.y - 24, 14, "spark", { g: 300, scroll: false });
    FX.hitstop = RM ? 0 : 0.08; FX.flash = RM ? 0.15 : 0.3; FX.flashCol = "255,255,255";
    try { if (SET.vib) navigator.vibrate?.(80); } catch { /* 振動できない端末 */ }
  }
  function countUp(el: HTMLElement, to: number): void {
    if (RM || to < 10) { el.textContent = to.toLocaleString(); return; }
    const t0 = performance.now(), d = 800;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / d), eased = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(to * eased).toLocaleString();
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function showOver(): void {
    S.state = "over";
    unlock("first");
    // おさんぽの終わりに足すスキル（ポーチ・湯たんぽ）
    if (K.pouchBank > 0) { S.bonus += K.pouchBank; K.pouchBank = 0; }
    if (K.keepBest > 0 && K.bestItem > 0) { S.bonus += Math.round(K.bestItem * K.keepBest); K.keepBest = 0; }
    const sc = score(), isNew = sc > S.best, meters = Math.floor(S.dist / 50);
    if (sc > 0 && sc % 100 === 0) unlock("kiriban");
    if (isNew) { S.best = sc; store.set(`best-${STAGE_ID}`, String(sc)); }
    if (meters > bestDistOf(STAGE_ID)) store.set(`bestd-${STAGE_ID}`, String(meters));
    stats.plays += 1; stats.meters += meters; stats.items += S.treats;
    saveStats(); renderAchList();
    const rank = OSANPO_RUN_RANKS.find((r) => sc >= r.min) ?? OSANPO_RUN_RANKS[OSANPO_RUN_RANKS.length - 1]!;
    const rankEl = $("rank");
    rankEl.textContent = rank.label; rankEl.style.setProperty("--rk", rank.color);
    rankEl.className = "osr-rank" + (rank.label === "SS" ? " osr-ss" : "");
    rankEl.setAttribute("aria-label", `ランク ${rank.label}`);
    const now = Date.now(), recs = recordsOf(STAGE_ID);
    recs.push({ s: sc, m: meters, t: now });
    recs.sort((a, b) => b.s - a.s || a.t - b.t);
    store.set(`rec-${STAGE_ID}`, JSON.stringify(recs.slice(0, 5)));
    lastRecordAt = now;
    S.lastResult = { score: sc, m: meters, items: S.treats, rank: rank.label };
    tickMissions();
    renderMissionResult();
    sendResult(sc, meters);
    $("over-sub").textContent = `${STAGE.name} ・ ${STAGE.skinName} ・ ${fmtClock(S.clock)}帰宅`;
    if (isNew && sc > 0) sfx.record(); else sfx.home();
    countUp($("o-score"), sc);
    $("o-best").textContent = S.best.toLocaleString();
    $("o-new").hidden = !isNew;
    // 距離・ほね・アイテム・コンボを小さなマスに並べる（1行に詰めると折り返して読みにくい）
    $("o-line").replaceChildren(...([["きょり", `${meters}m`], ["ほね", `${S.bones}`], ["アイテム", `${S.treats}`], ["最大コンボ", `×${S.maxMult}`]] as const).map(([k, v]) => {
      const cell = document.createElement("div");
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd"); dd.textContent = v;
      cell.append(dt, dd);
      return cell;
    }));
    const haul = $("o-haul");
    haul.replaceChildren();
    const got = [...S.haul.keys()]
      .map((id) => ITEMS.find((it) => it.id === id))
      .filter((it): it is RunItem => Boolean(it))
      .sort((a, b) => rarityIndex(b.rarity) - rarityIndex(a.rarity) || (S.haul.get(b.id) ?? 0) - (S.haul.get(a.id) ?? 0))
      .slice(0, 6);
    got.forEach((it, n) => {
      const cell = document.createElement("div");
      cell.className = "osr-cell";
      cell.style.animationDelay = `${0.25 + n * 0.07}s`;
      cell.title = `${it.rarity} ${it.name} ×${S.haul.get(it.id) ?? 0}`;
      cell.appendChild(spriteEl(it, 36));
      if (S.newKinds.includes(it.id)) { const nb = document.createElement("span"); nb.className = "osr-nb"; nb.textContent = "NEW"; cell.appendChild(nb); }
      const b = document.createElement("b"); b.textContent = it.rarity; b.style.color = RARITY_STYLES[it.rarity].color;
      cell.appendChild(b); haul.appendChild(cell);
    });
    $("o-haul-wrap").hidden = got.length === 0;
    const newLine = $("o-new-line");
    newLine.hidden = !S.newKinds.length;
    newLine.textContent = S.newKinds.length ? `ずかんに新しく ${S.newKinds.length}種類 登録（${ITEMS.filter((it) => kindSet.has(it.id)).length} / ${ITEMS.length}）` : "";
    const ar = $("o-ach");
    ar.replaceChildren();
    for (const id of S.newAch) { const sp = document.createElement("span"); sp.textContent = `称号：${achName(id)}`; ar.appendChild(sp); }
    ar.hidden = S.newAch.length === 0;
    $("over-title").textContent = isNew && sc > 0 ? "ただいま！ 新記録" : "ただいま！";
    $("best-top").textContent = S.best.toLocaleString();
    $("over-panel").hidden = false;
    achQueue = []; achToastT = 0; $("ach-toast").hidden = true;
    $("hint").hidden = true; hintT = 0;
  }

  /* ---------- 更新 ---------- */
  function hitTest(o: Obstacle): boolean {
    const sl = P.slide && P.ground;
    const px0 = P.x - (sl ? 28 : 24), px1 = P.x + (sl ? 26 : 22), py0 = P.y - (sl ? 22 : 44), py1 = P.y;
    if (o.kind === "puddle") return P.y >= GROUND - 1 && px1 - 8 > o.x + 10 && px0 + 8 < o.x + o.w - 10;
    let ox0: number, ox1: number, oy0: number, oy1: number;
    if (isTrickKind(o.kind)) { ox0 = o.x + 3; ox1 = o.x + o.w - 3; oy0 = o.y - o.h + 2; oy1 = o.y; }
    else if (o.kind === "crow") { ox0 = o.x + 4; ox1 = o.x + o.w - 2; oy0 = o.y + 3; oy1 = o.y + o.h - 2; }
    else if (o.kind === "cone") { ox0 = o.x + 5; ox1 = o.x + o.w - 5; oy0 = GROUND - o.h + 5; oy1 = GROUND; }
    else if (o.kind === "noren") { ox0 = o.x + 4; ox1 = o.x + o.w - 4; oy0 = -999; oy1 = GROUND - 30; }
    else if (o.kind === "drop") { ox0 = o.x + 3; ox1 = o.x + o.w - 3; oy0 = o.y - o.h + 3; oy1 = o.y; }
    else if (o.kind === "geyser") { if (o.h < 12) return false; ox0 = o.x + 4; ox1 = o.x + o.w - 4; oy0 = GROUND - o.h; oy1 = GROUND; }
    else if (o.kind === "roller" || o.kind === "buddy") { ox0 = o.x + 4; ox1 = o.x + o.w - 4; oy0 = GROUND - o.h + 3; oy1 = GROUND; }
    else if (o.kind === "pigeons") { if (o.flee) return false; ox0 = o.x + 2; ox1 = o.x + o.w - 2; oy0 = GROUND - o.h + 2; oy1 = GROUND; }
    else if (o.kind === "cat") { ox0 = o.x + 3; ox1 = o.x + o.w - 4; oy0 = GROUND - o.h + 3; oy1 = GROUND; }
    else if (o.kind === "sign") { ox0 = o.x + 5; ox1 = o.x + o.w - 5; oy0 = GROUND - o.h + 4; oy1 = GROUND; }
    else { ox0 = o.x + 8; ox1 = o.x + o.w - 8; oy0 = GROUND - o.h + 10; oy1 = GROUND; }
    return px1 > ox0 && px0 < ox1 && py1 > oy0 && py0 < oy1;
  }
  function showRare(item: RunItem): void {
    const el = $("rare");
    el.style.setProperty("--rc", RARITY_STYLES[item.rarity].color);
    $("rare-tag").textContent = `${item.rarity} ゲット`;
    $("rare-name").textContent = item.name;
    $("rare-icon").replaceChildren(spriteEl(item, 30));
    // 発動したスキルを、アイテム名の下に出す
    const skill = OSANPO_RUN_SKILL_BY_ID.get(item.id);
    $("rare-skill").hidden = !skill;
    const lv = lvOf(item), isMax = lv >= OSANPO_RUN_SKILL_MAX_LEVEL;
    $("rare-skill-name").textContent = skill ? `★${skill.name}${item.rarity === "N" ? "" : isMax ? " Lv.MAX" : ` Lv${lv}`}` : "";
    // 説明文は Lv1 の値なので、Lv.MAX のときは MAX の効果も添える
    $("rare-skill-desc").textContent = skill ? (isMax && item.rarity !== "N" ? `${skill.desc}（Lv.MAX：${skill.max}）` : skill.desc) : "";
    showAgain(el);
    FX.rareT = 2.6;
    if (rarityIndex(item.rarity) >= 3) sfx.rare();
    if (item.rarity === "UR" || item.rarity === "LR" || item.rarity === "MR") { FX.flash = RM ? 0.08 : 0.18; FX.flashCol = RARITY_STYLES[item.rarity].glow ?? "255,255,255"; }
  }
  function take(p: Pickup): void {
    p.taken = true;
    const { item } = p;
    if (!item && !p.token) {
      // ほね。コンボはつながるが、スキルは出ない
      const prev = S.mult;
      S.chain++; S.chainT = 1.5 + M.comboGrace; S.mult = Math.min(5, 1 + Math.floor(S.chain / 4)); S.maxMult = Math.max(S.maxMult, S.mult);
      if (S.mult > prev) { retrigger($("combo"), "osr-pulse"); onComboUp(S.mult - prev); }
      if (S.mult >= 5) unlock("combo5");
      if (++S.bones >= 100) unlock("bones100");
      const v = addPts(BONE_PTS * S.mult);
      sfx.item(S.mult);
      floatText(p.x, p.y - 14, `+${v}`, "#F3EBDD", 12);
      puff(p.x, p.y, 4, "spark", { g: 0 });
      return;
    }
    if (!item) {
      // スキルで出た小さな粒
      const v = addPts(p.token);
      sfx.item(Math.min(5, S.mult + 1));
      floatText(p.x, p.y - 14, `+${v}`, "#FFE7A3", p.token >= 150 ? 16 : 12);
      puff(p.x, p.y, p.token >= 150 ? 16 : 5, "spark", { g: 0 });
      if (p.token >= 150) sfx.fanfare();
      return;
    }
    const prevMult = S.mult;
    const airborne = !P.ground;
    S.chain++; S.chainT = 1.5 + M.comboGrace; S.mult = Math.min(5, 1 + Math.floor(S.chain / 4)); S.maxMult = Math.max(S.maxMult, S.mult);
    if (S.mult > prevMult) { retrigger($("combo"), "osr-pulse"); onComboUp(S.mult - prevMult); }
    if (S.mult >= 5) unlock("combo5");
    flyers.push({ item, x0: p.x, y0: p.y, t: 0 });
    const got = itemPoints(item, airborne);
    S.happyT = 0.35; S.treats += got.copies;
    S.haul.set(item.id, (S.haul.get(item.id) ?? 0) + got.copies);
    stats.counts[item.id] = (stats.counts[item.id] ?? 0) + got.copies;
    if (!kindSet.has(item.id)) {
      kindSet.add(item.id); S.newKinds.push(item.id); zkNew.add(item.id); saveStats();
      floatText(p.x + 14, p.y - 30, "NEW", "#7EF0D0", 12);
      if (kindSet.size >= 50) unlock("kinds50");
      if (ITEMS.every((it) => kindSet.has(it.id))) unlock("kindsAll");
    }
    if (S.sec === "bonus") { if (++S.bonusGot >= 15) unlock("bonus15"); S.bonusBest = Math.max(S.bonusBest, S.bonusGot); }
    if (rarityIndex(item.rarity) >= 2) S.srPlus++;
    if (item.rarity === "MR") unlock("mr");
    if (rarityIndex(item.rarity) >= 4 && ++S.rares >= 3) unlock("rare3");
    const R = RARITY_STYLES[got.rarity];
    let pts = got.pts;
    if (K.pouchMul > 0) {
      // 「ポーチにしまう」: いまは足さず、おさんぽの終わりに倍にして足す
      K.pouchBank += Math.round(pts * K.pouchMul); K.pouchMul = 0;
      floatText(p.x, p.y - 30, "ポーチにしまった", "#E8E0CE", 12);
      pts = 0;
    }
    S.bonus += pts;
    K.bestItem = Math.max(K.bestItem, pts);
    if (K.best) {
      K.best.top = Math.max(K.best.top, pts);
      if (--K.best.left <= 0) {
        const extra = Math.round(K.best.top * (K.best.mul - 1));
        if (extra > 0) { S.bonus += extra; floatText(P.x + 30, P.y - 96, `花かんざし +${extra}`, "#FFC857", 16); }
        K.best = null;
      }
    }
    const tag = got.copies > 1 ? ` ×${got.copies}` : "";
    const upTag = got.rarity !== item.rarity ? `${got.rarity}↑ ` : "";
    if (item.rarity === "N" || (item.rarity === "R" && S.sec === "bonus")) { sfx.item(S.mult); floatText(p.x, p.y - 16, `${upTag}+${pts}${tag}`, R.color, 13); puff(p.x, p.y, 5, "spark", { g: 0 }); }
    else if (item.rarity === "R" || item.rarity === "SR") { sfx.item(S.mult + 1); floatText(p.x, p.y - 18, `${upTag}${item.name} +${pts}${tag}`, R.color, 14); puff(p.x, p.y, 8, "spark", { g: 0 }); }
    else { sfx.fanfare(); floatText(p.x, p.y - 20, `${upTag}${item.rarity} ${item.name} +${pts}${tag}`, R.color, 16); puff(p.x, p.y, 16, "spark", { g: 0 }); }
    showRare(item);
    // LR・MR のバリア。そのアイテムのスキル自体が守り（身代わり・復活）のときは、スキルの守りを優先してバリアは付けない
    const ownWard = OSANPO_RUN_SKILL_BY_ID.get(item.id)?.fx.some((f) => f.op === "guard" || f.op === "revive");
    if (isBarrierRarity(item.rarity) && !S.shield && !ownWard && wardRank() <= 2) { clearWards(); S.shield = true; sfx.barrier(); floatText(P.x + 10, P.y - 70, "バリアが付いた！", "#7EF0D0", 15); }
    applySkill(item);
    K.lastItem = item;
    // 「ぱちぱち」: 近くのアイテムももう1個
    if (!K.sparkBusy && K.buffs.some((a) => a.b.spark)) {
      const near = pickups.filter((q) => !q.taken && q !== p).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (near && Math.hypot(near.x - p.x, near.y - p.y) < 150) {
        K.sparkBusy = true;
        puff(near.x, near.y, 8, "spark", { g: 0 });
        take(near);
        K.sparkBusy = false;
      }
    }
  }

  function update(dt: number): void {
    if (S.paused) return;
    S.time += dt;
    refreshMods();
    const playing = S.state === "play";
    if (S.state === "ready") S.speed = 90;
    else if (S.state === "intro") {
      S.introT += dt; S.speed = 0;
      if (S.introT >= 0.75) {
        S.state = "play"; S.speed = START_SPEED;
        sfx.go(); bgmStart();
        floatText(P.x + 4, P.y - 84, "ドン！", "#FFC857", 24);
        puff(P.x - 10, GROUND, 8, "dust", { vy: -20 });
        if (S.bufT > 0) { S.bufT = 0; jump(JUMP_V, 1); }
        applyStepBoost();
      }
    } else if (playing) {
      S.t += dt;
      if (S.stepT > 0) S.stepT = Math.max(0, S.stepT - dt);
      if (!M.hold) K.ramp += dt;
      if (S.slowT > 0) S.slowT -= dt;
      tickWeather(dt);
      S.speed = M.stop ? 0 : (START_SPEED + Math.min(MAX_SPEED - START_SPEED, K.ramp * 1.8)) * M.speed * (S.slowT > 0 ? 0.55 : 1);
      if (S.t >= 180) unlock("survive180");
      if (S.clock >= 1440 + 300) unlock("dawn");
      tickSkills(dt);
      tickFork(dt);
      tickMemory(dt);
      tickMissions();
      S.dist += S.speed * dt;
      S.clock += dt * 1.6;
      S.next -= S.speed * dt;
      if (S.next <= 0) spawn();
      S.secT -= dt;
      if (S.secT <= 0) {
        if (S.sec === "normal") { setSection(!K.forceBonus && S.t > 40 && Math.random() < 0.5 ? "rush" : "bonus"); K.forceBonus = false; }
        else if (S.sec === "rush") {
          unlock("rush");
          if (++S.rushes >= 3) unlock("rush3");
          const got = addPts(100 * (K.rushInv ? K.rushMul : 1));
          K.rushInv = false; K.rushMul = 1;
          floatText(VW / 2, GROUND * 0.32, `ラッシュ突破！ +${got}`, "#FFC857", 20);
          sfx.mile();
          setSection("normal");
        } else setSection("normal");
      }
      const mtr = S.dist / 50;
      if (!S.passedBest && S.bestD >= 30 && mtr > S.bestD) { S.passedBest = true; floatText(P.x + 60, GROUND * 0.42, "自己ベスト地点を突破！", "#FFC857", 18); sfx.pass(); puff(P.x + 30, P.y - 40, 16, "spark", { g: 60 }); }
      if (!S.recordShown && S.best > 0 && score() > S.best) { S.recordShown = true; floatText(VW / 2, GROUND * 0.24, "ベストスコア更新中！", "#FFC857", 18); sfx.pass(); }
      if (mtr >= 100) unlock("m100");
      if (mtr >= 500) unlock("m500");
      if (mtr >= 1000) unlock("m1000");
      if (mtr >= 300 && STAGE_ID !== "town") unlock(STAGE_ID);
      if (S.rain > 0.5) { S.rainWalk += dt; if (S.rainWalk >= 20) unlock("rain"); }
      const cm = S.clock % 1440;
      if (cm >= 21 * 60 || cm < 4 * 60) unlock("night");
      if (S.rainT > 0) {
        S.rainT -= dt;
        if (S.rainT <= 0) {
          S.rainTarget = 0; floatText(VW / 2, GROUND * 0.32, STAGE.weather === "snow" ? "雪が小降りになった" : "雨がやんだ", "#A9C8FF", 16);
          // 雨あがりの昼間は、ときどき虹がかかる
          if (!S.wx && STAGE.weather !== "snow" && envAt(S.clock).night < 0.4 && Math.random() < 0.6) startWeather("rainbow");
        }
      }
      if (S.chainT > 0 && !M.comboLock) {
        S.chainT -= dt;
        if (S.chainT <= 0) {
          if (K.comboGuard > 0 && S.mult > 1) { K.comboGuard--; S.chainT = 1.5; floatText(P.x + 20, P.y - 70, "コンボキープ！", "#FF9F6B", 13); }
          else { S.chain = 0; S.mult = 1; }
        }
      }
      const meters = Math.floor(mtr);
      if (meters >= S.milestone) { floatText(VW / 2, GROUND * 0.35, `${S.milestone}m`, "#FFC857", 24); sfx.mile(); S.milestone += 100; }
    } else if (S.state === "dying") {
      S.speed *= Math.exp(-5 * dt);
      S.deadT += dt;
      if (S.deadT > 1.05) showOver();
    } else if (S.state === "over") S.speed = 0;

    S.cam += S.speed * dt;
    // 背景は道より遅く、なめらかに流す（酔いにくいよう、速さに上限をつけて急な加速・停止をならす）
    const bgTarget = S.calm ? 0 : Math.min(S.speed, BG_SPEED_MAX) * BG_SPEED_RATE;
    S.bgV += (bgTarget - S.bgV) * Math.min(1, dt * BG_EASE);
    S.bgCam += S.bgV * dt;
    fillLayer(bld, genMid, 200);
    fillLayer(near, genNear, 420);
    if (playing) BGM.bpm = 120 + clamp((S.speed - START_SPEED) / (MAX_SPEED - START_SPEED), 0, 1) * 24;
    for (const f of flyers) f.t += dt * 2.3;
    if (flyers.some((f) => f.t >= 1)) { retrigger($("score"), "osr-bump"); flyers = flyers.filter((f) => f.t < 1); }
    if (achToastT > 0) { achToastT -= dt; if (achToastT <= 0) $("ach-toast").hidden = true; }
    else if (achQueue.length) {
      const id = achQueue.shift()!;
      $("ach-name").textContent = achName(id);
      showAgain($("ach-toast"));
      achToastT = 2.4;
      sfx.title();
    }
    if (hintT > 0) { hintT -= dt; if (hintT <= 0 || !playing) { hintT = 0; $("hint").hidden = true; } }
    S.rain += (S.rainTarget - S.rain) * Math.min(1, dt * 0.8);
    rainSound();
    if (STAGE_ID === "summer" && S.state !== "over") {
      S.fwT -= dt;
      if (S.fwT <= 0 && envAt(S.clock).night > 0.4) {
        S.fwT = rand(2.5, 5);
        const fx = rand(VW * 0.25, VW * 0.9), fy = rand(GROUND * 0.12, GROUND * 0.38);
        const col = pickOne(["255,120,120", "255,210,110", "140,210,255", "190,150,255", "140,255,190"]), k = RM || S.calm ? 22 : 36;
        for (let i = 0; i < k; i++) {
          const a = (i / k) * Math.PI * 2, v = rand(70, 95);
          parts.push({ x: fx, y: fy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 1.3, r: 1.6, kind: "fw", color: col, g: 40, scroll: false });
        }
        const timer = window.setTimeout(() => noise(0.6, 0.08, 220), 120);
        cleanups.push(() => window.clearTimeout(timer));
      }
    }
    FX.flash *= Math.exp(-7 * dt);
    if (FX.fade > 0) FX.fade = Math.max(0, FX.fade - dt * 3);
    if (FX.rareT > 0) { FX.rareT -= dt; if (FX.rareT <= 0) $("rare").hidden = true; }

    // 犬
    if (P.inv > 0) P.inv -= dt;
    if (S.bufT > 0) S.bufT -= dt;
    if (S.happyT > 0) S.happyT -= dt;
    if (!P.ground) {
      P.vy += GRAV * (M.float && P.vy > 0 ? 0.3 : 1) * dt;
      if (M.float && P.vy > 230) P.vy = 230;
      P.y += P.vy * dt;
      if (P.y >= GROUND) {
        P.y = GROUND; P.vy = 0; P.ground = true; P.jumps = 2; P.sq = 0.72;
        if (P.dive) { stompAt = S.time; P.dive = false; }
        if (playing) { sfx.land(); puff(P.x - 4, GROUND, 5, "dust", { vy: -10 }); }
        if (playing && S.bufT > 0) { S.bufT = 0; jump(JUMP_V, 1); }
      }
    }
    if (P.slide) {
      if (!P.slideHeld) P.slideT -= dt;
      if (P.slideT <= 0 && !P.slideHeld) P.slide = false;
      if (P.ground && P.slide && S.speed > 100 && Math.random() < dt * 14) puff(P.x + 18, GROUND, 1, "dust", { vy: -12 });
    }
    P.sq += (1 - P.sq) * Math.min(1, dt * 12);
    const rotT = P.dead ? (P.ground ? 0 : -0.5) : P.ground ? 0 : clamp(P.vy / 2200, -0.28, 0.32);
    P.rot += (rotT - P.rot) * Math.min(1, dt * 10);
    if (P.ground && S.speed > 1) P.ph += dt * (S.state === "ready" ? 7 : 9 + S.speed / 40);
    if (P.ground && S.speed > 420) { P.dustT -= dt; if (P.dustT < 0) { P.dustT = 0.11; puff(P.x - 16, GROUND, 1, "dust", { vy: -10 }); } }

    tickSniffs(dt, playing);
    // 障害物
    const sp = S.speed;
    for (const o of obstacles) {
      o.x -= (sp + (playing ? o.vx : (o.vx * sp) / 300)) * dt;
      if (o.kind === "pigeons" && o.flee) o.fleeT += dt;
      if (o.hit) { o.kvy += GRAV * dt; o.ky += o.kvy * dt; o.rot += o.spin * dt; o.x += 160 * dt; continue; }
      if (!playing) continue;
      if (isTrickKind(o.kind)) {
        o.age += dt;
        if (o.kind !== "suitcase" && o.activeTime < 0 && o.x - (P.x + 22) < S.speed * 1.25 + 40) o.activeTime = 0;
        if (o.activeTime >= 0) o.activeTime += dt;
        const pose = trickPose(o.kind, GROUND, o.age, o.activeTime, o.phase);
        o.y = pose.y; o.h = pose.h;
      }
      if (o.kind === "geyser") {
        // 水は出たり止まったりする。出はじめは下から伸びる
        const ph = (S.t + o.phase) % GEYSER_CYCLE;
        o.h = ph < GEYSER_ON ? GEYSER_H * Math.min(1, ph / 0.1) : 0;
      } else if (o.kind === "drop" && !o.landed) {
        // フレブルの少し前に着地するタイミングで落とし始める
        const fallT = Math.sqrt((2 * (GROUND + 40)) / DROP_G);
        if (o.vy === 0 && o.x - P.x < S.speed * fallT + 70) { o.vy = 1; sfx.near(); }
        if (o.vy > 0) {
          o.vy += DROP_G * dt; o.y += o.vy * dt;
          if (o.y >= GROUND) { o.y = GROUND; o.landed = true; o.h = 16; puff(o.x + o.w / 2, GROUND - 4, 8, "dust", { vy: -30 }); tone(180, 0.12, "triangle", 0.05, 90); }
        }
      }
      if (o.kind !== "crow" && o.kind !== "noren" && o.kind !== "geyser" && o.kind !== "buddy" && !(o.kind === "drop" && !o.landed) && o.x < P.x + 22 && o.x + o.w > P.x - 18) o.minClear = Math.min(o.minClear, GROUND - o.h - P.y);
      if (o.gone) continue;
      const touching = hitTest(o);
      if (o.kind === "puddle" && touching && S.time - stompAt < 0.15) {
        // 水たまりスタンプ：急降下で着地したら、水たまりを踏み散らしてセーフ
        o.gone = true; o.scored = true;
        const v = addPts(PUDDLE_STOMP_PTS);
        floatText(P.x + 20, P.y - 64, `バシャーン！ +${v}`, "#9BE7FF", 16);
        splashBurst(Math.max(o.x + 10, Math.min(o.x + o.w - 10, P.x)), o.w);
        tone(300, 0.14, "triangle", 0.06, 120); tone(900, 0.08, "sine", 0.04, 600, 0.04);
        FX.hitstop = RM ? 0 : 0.04;
        S.stomps++;
        continue;
      }
      if (o.kind !== "buddy" && touching) {
        S.tricks.streak = 0;
        if (isTrickKind(o.kind)) o.assisted = true;
      }
      if (isTrickKind(o.kind) && !o.assisted && o.x < P.x + 22 && o.x + o.w > P.x - 24) {
        if (o.kind === "suitcase" && P.ground && o.y < GROUND - (P.slide ? 26 : 48)) o.under = true;
        if (o.kind === "drone" && P.slide && P.ground) o.ducked = true;
        if (!P.ground && P.y <= o.y - o.h + 2 && (o.kind !== "surprise" || o.h >= 119.9)) o.over = true;
      }
      if (o.kind === "buddy") {
        // ほかのわんこ。ぶつかってもよくて、あいさつすると点がもらえる（少しだけ立ち止まる）
        if (!o.greeted && touching) {
          o.greeted = true; S.slowT = 0.5;
          greetNeighbor(o);
          tone(660, 0.08, "sine", 0.05); tone(880, 0.1, "sine", 0.05, null, 0.08);
          stats.greets++; S.greetsRun++; saveStats();
          if (stats.greets >= 20) unlock("greet20");
        }
      } else if (P.inv <= 0 && touching) {
        if (!resolveHit(o)) continue;
        if (S.shield) {
          S.shield = false; P.inv = 1; o.hit = true; o.kvy = -520; o.spin = 9; sfx.guard();
          floatText(P.x + 10, P.y - 60, "バリアで助かった！", "#7EF0D0", 15);
          unlock("barrier");
          puff(P.x + 10, P.y - 26, 18, "spark", { g: 0 });
          K.cairn = 0;
        } else if (!tryRevive(o)) die();
        continue;
      }
      if (!o.hinted && o.x < P.x + (isTrickKind(o.kind) ? Math.max(220, S.speed * 1.45) : 220)) {
        o.hinted = true;
        hint(isTrickKind(o.kind) ? o.kind : o.low || o.kind === "noren" ? "slide" : o.kind === "crow" ? "crow" : o.kind === "cat" ? "cat"
          : o.kind === "roller" || o.kind === "drop" || o.kind === "buddy" || o.kind === "geyser" ? o.kind
          : o.kind === "puddle" && stats.plays >= 1 ? "stomp" : "jump");
      }
      if (!o.scored && o.x + o.w < P.x - (isTrickKind(o.kind) ? 30 : 18)) {
        o.scored = true;
        if (isTrickKind(o.kind)) {
          if (!o.assisted && !o.passed && !P.dead && S.state === "play") {
            for (const id of recordTrickClear(stats.tricks, S.tricks, o.kind, o, STAGE_ID)) unlock(id);
            saveStats();
            const stylish = (o.kind === "suitcase" && o.under) || (o.kind === "drone" && o.ducked);
            const v = addPts(TRICK_SPECS[o.kind].points + (stylish ? 15 : 0) + M.over);
            const msg = o.kind === "suitcase" ? (o.under ? "手荷物の下、失礼！" : "手荷物はお預け！") : o.kind === "surprise" ? "びっくり回避！" : (o.ducked ? "低姿勢でお届け回避！" : "配達ルート外です！");
            floatText(P.x + 30, P.y - 70, `${msg} +${v}`, "#A7E9DC", 13);
            sfx.near();
          }
          continue;
        }
        if (o.kind === "roller") { stats.rollers++; saveStats(); if (stats.rollers >= 10) unlock("roller10"); }
        else if (o.kind === "drop") { stats.drops++; saveStats(); if (stats.drops >= 10) unlock("drop10"); }
        else if (o.kind === "geyser") { stats.geysers++; saveStats(); if (stats.geysers >= 10) unlock("geyser10"); }
        if (o.kind === "buddy") {
          if (!o.greeted) { const v = addPts(5); floatText(P.x + 20, P.y - 56, `またね +${v}`, "#FFB3C7", 13); }
          continue;
        }
        if (M.over > 0 && !o.passed && o.kind !== "puddle") { const v = addPts(M.over); floatText(P.x + 30, P.y - 84, `こえた +${v}`, "#FFE7A3", 13); }
        if ((o.kind === "noren" || o.low) && P.slide && P.ground) {
          const v = addPts(15); floatText(P.x + 20, P.y - 50, `スライディング！ +${v}`, "#9BE7FF", 14);
          stats.slides++; S.slidesRun++; saveStats();
          if (stats.slides >= 10) unlock("slide10");
        } else if (o.kind === "crow") {
          if (P.ground) { const v = addPts(5); floatText(P.x + 20, P.y - 56, `くぐった +${v}`, "#C9C3F0", 13); }
        } else if (o.kind === "pigeons") {
          o.flee = true; const v = addPts(10);
          stats.pigeons++; S.pigeonsRun++; saveStats();
          if (stats.pigeons >= 10) unlock("pigeon10");
          floatText(P.x + 20, P.y - 56, `バサバサッ +${v}`, "#C9D6E8", 13);
          tone(900, 0.05, "triangle", 0.03); tone(1100, 0.05, "triangle", 0.03, null, 0.05);
        } else if (o.minClear >= 0 && o.minClear < 14 && o.kind !== "puddle") {
          const v = addPts(20); sfx.near(); floatText(P.x + 20, P.y - 56, `ギリギリ！ +${v}`, "#FFC857", 15);
          if (++S.closes >= 5) unlock("close5");
        } else addPts(5);
      }
    }
    obstacles = obstacles.filter((o) => !o.gone && o.x + o.w > -80 && o.ky < 400 && !(o.flee && o.fleeT > 2));

    // アイテム
    const reach = M.big ? 42 : 30;
    for (const it of pickups) {
      if (playing && !it.hinted && it.y < GROUND - 140 && it.x < P.x + 260) { it.hinted = true; hint("dj"); }
      // 落ちている間はゆっくり流れる（道と同じ速さだと、着地する前にフレブルを通り過ぎて取れない）
      it.x -= sp * (it.vy > 0 ? FALL_DRIFT : 1) * dt; it.ph += dt * 4;
      if (it.vy > 0) { it.y += it.vy * dt; if (it.y >= GROUND - 18) { it.y = GROUND - 18; it.vy = 0; } }
      if (!playing || it.taken) continue;
      const mx = P.x - it.x, my = P.y - 28 - it.y, d2 = mx * mx + my * my;
      if (d2 < M.magnet * M.magnet || (M.wide && Math.abs(mx) < 46 && my > 0)) {
        const d = Math.sqrt(d2) || 1, pull = (M.magnet > 52 || M.wide ? 760 : 520) * dt;
        it.x += (mx / d) * Math.min(pull, d); it.y += (my / d) * Math.min(pull, d);
      }
      const dx = it.x - P.x, dy = it.y - (P.y - 28);
      if (dx * dx + dy * dy < reach * reach) take(it);
      else if (K.miss > 0 && (it.item || it.token) && it.x < P.x - 40) { K.miss--; take(it); floatText(P.x - 10, P.y - 60, "てぶくろキャッチ", "#9BE7FF", 12); }
    }
    pickups = pickups.filter((it) => !it.taken && it.x > -40);

    for (const p of parts) { p.life += dt; p.vy += p.g * dt; p.x += (p.vx - (p.scroll ? sp : 0)) * dt; p.y += p.vy * dt; }
    parts = parts.filter((p) => p.life < p.max);
    for (const t of texts) { t.life += dt; t.y -= 34 * dt; }
    texts = texts.filter((t) => t.life < t.max);
  }

  /* ---------- 描画 ---------- */
  const hud = new Map<string, string | boolean>();
  function setText(name: string, v: string): void {
    if (hud.get(name) === v) return;
    hud.set(name, v);
    $(name).textContent = v;
  }
  function setFlag(name: string, v: boolean, apply: (v: boolean) => void): void {
    if (hud.get(name) === v) return;
    hud.set(name, v);
    apply(v);
  }
  /** 道に落ちているほね */
  /**
   * 道に落ちているアイテムのオーラ。拾うと発動するスキルの分類の色で光り、輪が回る（拾う前に何が起きるか分かるように）。
   * スキルのないアイテムは、これまでどおりレアリティの色で光る
   */
  function drawItemAura(c: Ctx, item: RunItem, x: number, y: number, size: number, ph: number): void {
    const skill = OSANPO_RUN_SKILL_BY_ID.get(item.id), R = RARITY_STYLES[item.rarity];
    if (!skill) {
      if (R.glow && item.rarity !== "MR") glow(c, x, y, item.rarity === "R" ? 20 : 26, R.glow, item.rarity === "R" ? 0.35 : 0.45 + Math.sin(S.time * 5 + ph) * 0.1);
      return;
    }
    const col = hexRgbStr(SKILL_KIND_COLORS[skill.kind]), pulse = RM ? 0 : Math.sin(S.time * 5 + ph) * 0.08;
    const r = size * 0.62;
    c.save(); c.globalCompositeOperation = "lighter";
    glow(c, x, y, r + 14, col, 0.5 + pulse);
    c.restore();
    c.save();
    c.lineWidth = 2.4; c.strokeStyle = `rgba(${col},0.95)`;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
    // 回る光の点（2つ）で、止まっていても目に入りやすく
    for (let k = 0; k < 2; k++) {
      const a = (RM ? 0.6 : S.time * 3.2 + ph) + k * Math.PI;
      const dx = x + Math.cos(a) * r, dy = y + Math.sin(a) * r;
      glow(c, dx, dy, 7, col, 0.8);
      c.fillStyle = "rgba(255,255,255,0.95)"; ell(c, dx, dy, 1.6, 1.6); c.fill();
    }
    c.restore();
  }
  function drawBone(c: Ctx, x: number, y: number, k: number): void {
    c.save(); c.translate(x, y); c.rotate(-0.35); c.scale(k, k);
    c.fillStyle = "rgba(20,16,40,.25)"; rr(c, -8, -2, 16, 6, 3); c.fill();
    c.fillStyle = "#FBF4E6"; c.strokeStyle = "#B9A98E"; c.lineWidth = 1.1;
    c.beginPath();
    for (const [bx, by] of [[-8, -3], [-8, 3], [8, -3], [8, 3]] as const) { c.moveTo(bx + 3.4, by); c.arc(bx, by, 3.4, 0, Math.PI * 2); }
    c.fill(); c.stroke();
    c.beginPath(); rr(c, -8, -2.6, 16, 5.2, 2); c.fill();
    c.restore();
  }
  function render(): void {
    const e = stageEnv(envAt(S.clock));
    const c = ctx;
    c.setTransform(DPR * SC, 0, 0, DPR * SC, 0, 0);
    drawSky(c, e);
    drawSkyLife(stageView(c, e));
    drawWeatherSky(c);
    const mountains = STAGE_ID === "hiking" || STAGE_ID === "snow";
    if (mountains) ridge(c, e, S.bgCam * 0.003 + 900, GROUND - 70, STAGE_ID === "hiking" ? 96 : 80, mix(e.far, e.bot, 0.6), 4.2, true);
    ridge(c, e, S.bgCam * 0.006, GROUND - 40, STAGE_ID === "hiking" ? 78 : STAGE_ID === "snow" ? 52 : 34, mix(e.far, e.bot, 0.45), 2.1, STAGE_ID === "snow");
    haze(c, e, GROUND - 90, GROUND - 20, 0.35);
    ridge(c, e, S.bgCam * 0.014, GROUND - 26, STAGE_ID === "hiking" ? 62 : 40, e.far, 0);
    drawMid(c, e);
    haze(c, e, GROUND - 60, GROUND - 6, 0.22);
    const lamps: [number, number][] = [];
    drawNear(c, e, lamps);
    drawGround(c, e, lamps);
    drawRouteScene(c, e);
    drawMarkers(c, e);
    drawMemory(c, e);
    drawFork(c, e);

    if (S.rain > 0.02 && STAGE.weather !== "snow" && !M.clear) { c.fillStyle = `rgba(52,60,96,${0.22 * S.rain})`; c.fillRect(-20, -20, VW + 40, GROUND + 26); }
    for (const o of obstacles) if (o.kind === "puddle") drawPuddle(c, o.x, GROUND, o.w, S.time, e.night, STAGE_ID);
    drawSniffs(c, e);
    for (const it of pickups) {
      if (it.vy > 0) {
        // 降ってくる途中は、真下の地面に影を出して着地点を知らせる
        const k = clamp(1 - (GROUND - 18 - it.y) / (GROUND + 20), 0.15, 1);
        c.fillStyle = `rgba(20,16,40,${0.28 * k})`; ell(c, it.x, GROUND + 1, 6 + 8 * k, 2 + 1.5 * k); c.fill();
      }
      if (!it.item && !it.token) { drawBone(c, it.x, it.y + Math.sin(it.ph) * 2.2, M.big ? 1.3 : 1); continue; }
      if (!it.item && it.look) {
        // 桜の花びら・紅葉。くるくる回りながら落ちてくる
        const y = it.y + Math.sin(it.ph) * 2.2;
        c.save(); c.translate(it.x, y); c.rotate(Math.sin(S.time * 3 + it.ph) * 1.2);
        if (it.look === "petal") { c.fillStyle = "#FFB8CF"; ell(c, 0, 0, 5.5, 3.2); c.fill(); c.fillStyle = "#FF8FB3"; ell(c, 2, 0, 2, 1.2); c.fill(); }
        else { c.fillStyle = "#E8663A"; c.beginPath(); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; c.lineTo(Math.cos(a) * 6, Math.sin(a) * 6); c.lineTo(Math.cos(a + 0.6) * 2.4, Math.sin(a + 0.6) * 2.4); } c.closePath(); c.fill(); }
        c.restore();
        continue;
      }
      if (!it.item) {
        const y = it.y + Math.sin(it.ph) * 2.2, big = it.token >= 150, r = big ? 9 : it.token >= 30 ? 6 : 4.5;
        glow(c, it.x, y, r * 3, big ? "255,132,188" : "255,214,110", 0.45);
        star(c, it.x, y, r, big ? "#FF9CCB" : "#FFE08A");
        continue;
      }
      const y = it.y + Math.sin(it.ph) * 2.2, rarity = it.item.rarity;
      const size = (rarity === "N" ? 28 : rarity === "R" || rarity === "SR" ? 30 : 34) * (M.big ? 1.3 : 1);
      if (rarity === "MR") { c.save(); c.globalCompositeOperation = "lighter"; glow(c, it.x, y, 30, hslRgb((S.time * 120 + it.x) % 360), 0.55); c.restore(); }
      drawItemAura(c, it.item, it.x, y, size, it.ph);
      drawItemImg(c, it.item, it.x, y, size);
      if (rarityIndex(rarity) >= 3 && Math.sin(S.time * 6 + it.ph) > 0.6) star(c, it.x + 12, y - 12, 3, RARITY_STYLES[rarity].color);
    }
    for (const o of obstacles) {
      if (o.kind === "puddle") continue;
      c.save();
      if (o.hit) {
        const cx = o.x + o.w / 2, cy = (isTrickKind(o.kind) ? o.y : GROUND) - o.h / 2 + o.ky;
        c.translate(cx, cy); c.rotate(o.rot); c.translate(-cx, -cy); c.translate(0, o.ky);
      }
      if (!o.hit && o.kind === "drop" && !o.landed) {
        // 落ちてくるものの影。近づくほど濃く大きく
        const k = clamp(1 - (GROUND - o.y) / (GROUND + 40), 0.2, 1);
        c.fillStyle = `rgba(20,16,40,${0.35 * k})`; ell(c, o.x + o.w / 2, GROUND + 1, o.w * (0.3 + 0.35 * k), 2 + 2 * k); c.fill();
      } else if (!o.hit && isTrickKind(o.kind)) {
        const altitude = Math.max(0, GROUND - o.y), k = Math.max(0.25, 1 - altitude / 130);
        c.fillStyle = `rgba(20,16,40,${0.22 * k})`; ell(c, o.x + o.w / 2, GROUND + 1, o.w * (0.35 + 0.2 * k), 2 + k); c.fill();
      } else if (!o.hit && o.kind !== "crow" && o.kind !== "noren" && o.kind !== "geyser" && !o.flee) { c.fillStyle = "rgba(20,16,40,.22)"; ell(c, o.x + o.w / 2, GROUND + 1, o.w * 0.55, 3); c.fill(); }
      if (o.kind === "crow" && !o.hit) { c.fillStyle = "rgba(20,16,40,.18)"; ell(c, o.x + o.w / 2, GROUND + 3, 13, 2.5); c.fill(); }
      if (M.bright) { c.shadowColor = "rgba(255,240,150,.95)"; c.shadowBlur = 9 * DPR * SC; }
      else if (e.night > 0.2) {
        c.shadowColor = o.kind === "crow" ? `rgba(255,236,210,${0.95 * e.night})` : `rgba(255,228,170,${0.7 * e.night})`;
        c.shadowBlur = (o.kind === "crow" ? 7 : 5) * DPR * SC;
      }
      const lk = STAGE_ID;
      if (o.kind === "suitcase") drawSuitcase(c, o.x, o.y, o.w, o.h, o.age, lk);
      else if (o.kind === "surprise") drawSurpriseBox(c, o.x, GROUND, o.w, o.h, o.age, o.activeTime >= 0 && o.activeTime < TRICK_WARNING, lk);
      else if (o.kind === "drone") drawDeliveryDrone(c, o.x, o.y, o.w, o.h, o.age, o.activeTime >= 0 && o.activeTime < TRICK_WARNING, lk);
      else if (o.kind === "cone") {
        if (lk === "hiking") drawRock(c, o.x, GROUND, o.w, o.h);
        else if (lk === "snow") drawSnowman(c, o.x, GROUND, o.w, false);
        else if (lk === "summer") drawWatermelon(c, o.x, GROUND, o.w);
        else drawCone(c, o.x, GROUND, o.w, o.h);
      } else if (o.kind === "bike") {
        if (lk === "hiking") drawLog(c, o.x, GROUND, o.w);
        else if (lk === "snow") drawSled(c, o.x, GROUND, o.w);
        else if (lk === "summer") drawGoldfishTub(c, o.x, GROUND, o.w);
        else drawBike(c, o.x, GROUND, o.w);
      } else if (o.kind === "sign") {
        if (lk === "hiking") drawSignpost(c, o.x, GROUND, o.w, o.h);
        else if (lk === "snow") drawSnowman(c, o.x + 2, GROUND, o.w - 4, true);
        else if (lk === "summer") drawKakigoriFlag(c, o.x, GROUND, o.w, o.h, S.time);
        else drawSign(c, o.x, GROUND, o.w, o.h, S.time, e.night);
      } else if (o.kind === "noren") drawNoren(c, o.x, o.w, GROUND, S.time, lk);
      else if (o.kind === "cat") drawCat(c, o.x, GROUND, o.w, S.time, e.night, lk === "snow");
      else if (o.kind === "pigeons") drawPigeons(c, o.x, o.birds, o.flee, o.fleeT, GROUND, S.time);
      else if (o.kind === "crow") drawCrow(c, o.x, o.y, o.w, o.h, S.time);
      else if (o.kind === "roller") drawRoller(c, o.x, GROUND, o.w, o.h, S.time, lk);
      else if (o.kind === "drop") drawDropper(c, o.x + o.w / 2, o.hit ? GROUND : o.y, o.w, lk, o.landed);
      else if (o.kind === "buddy") drawBuddySprite(c, o);
      else if (o.kind === "geyser") drawGeyser(c, o.x, GROUND, o.w, o.h, S.time, lk);
      c.restore();
    }
    for (const o of obstacles) {
      if (isTrickKind(o.kind) && o.kind !== "suitcase" && !o.hit && o.x > VW - 20 && o.activeTime >= 0 && o.activeTime < TRICK_WARNING) {
        c.fillStyle = "#FFE0A3"; rr(c, VW - 100, GROUND - 146, 92, 25, 8); c.fill();
        c.fillStyle = "#63465A"; c.font = font(10); c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText(o.kind === "surprise" ? "箱がガタガタ！ →" : "ドローン降下！ →", VW - 54, GROUND - 133);
      }
      if (o.kind !== "crow" || o.hit || o.x <= VW - 16) continue;
      const a = 0.75 + Math.sin(S.time * 18) * 0.25, wy = o.y + o.h / 2;
      c.fillStyle = `rgba(228,87,46,${a})`; c.beginPath(); c.arc(VW - 18, wy, 10, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#fff"; c.font = font(14); c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("!", VW - 18, wy + 1);
    }
    if (e.night > 0.35 && (STAGE_ID === "town" || STAGE_ID === "hiking")) {
      c.save(); c.globalCompositeOperation = "lighter";
      for (const f of flies) {
        f.x -= ((S.speed * 0.25) / VW + 0.01 * f.s) * FDT;
        if (f.x < -0.05) { f.x = 1.05; f.y = rand(0.2, 1); }
        const fx = f.x * VW, fy = GROUND - 30 - f.y * 70 + Math.sin(S.time * 1.3 * f.s + f.p) * 8;
        const a = (e.night - 0.35) * 1.5 * (0.4 + 0.6 * Math.max(0, Math.sin(S.time * 2.2 * f.s + f.p)));
        glow(c, fx, fy, 9, "210,255,140", a * 0.5);
        c.fillStyle = `rgba(235,255,190,${a})`; c.fillRect(fx - 0.8, fy - 0.8, 1.6, 1.6);
      }
      c.restore();
    }

    const k = 1 - clamp((GROUND - P.y) / 170, 0, 0.75);
    c.fillStyle = `rgba(20,16,40,${0.22 * k})`; ell(c, P.x, GROUND + 1, 26 * k + 4, 3.5 * k + 1); c.fill();
    const invT = S.state === "play" ? invLeft() : 0;
    if (invT > 0) {
      // 無敵: 虹色のオーラ。切れる1.5秒前から点滅して知らせる
      const ending = invT < 1.5, blink = ending && Math.floor(S.time * (invT < 0.6 ? 16 : 9)) % 2 === 1;
      const a = (blink ? 0.12 : 0.42) + Math.sin(S.time * 8) * 0.05;
      c.save(); c.globalCompositeOperation = "lighter";
      glow(c, P.x, P.y - 26, 60, hslRgb((S.time * 280) % 360), a + 0.1);
      glow(c, P.x, P.y - 26, 34, "255,250,230", a * 0.6);
      c.restore();
      if (!blink) {
        // 虹色の輪（昼の明るい背景でも無敵だとわかるように）
        c.save(); c.lineWidth = 3;
        for (let i = 0; i < 6; i++) {
          c.strokeStyle = `rgba(${hslRgb((S.time * 280 + i * 60) % 360)},.9)`;
          c.beginPath(); c.ellipse(P.x, P.y - 28, 40, 36, 0, (i / 6) * Math.PI * 2 + S.time * 3, ((i + 1) / 6) * Math.PI * 2 + S.time * 3); c.stroke();
        }
        c.restore();
      }
      if (!blink && !RM) for (let i = 0; i < 3; i++) {
        const ang = S.time * 4 + (i * Math.PI * 2) / 3;
        star(c, P.x + Math.cos(ang) * 34, P.y - 28 + Math.sin(ang) * 26, 2.6, `rgba(${hslRgb((S.time * 280 + i * 120) % 360)},.95)`);
      }
    }
    if (!(P.inv > 0 && Math.floor(S.time * 16) % 2)) drawDog(c, P.x, P.y);

    for (const p of parts) {
      const a = 1 - p.life / p.max;
      if (p.kind === "dust") { c.fillStyle = rgb(shade(e.side, 0.35), a * 0.7); c.beginPath(); c.arc(p.x, p.y, p.r * (1 + p.life * 2), 0, Math.PI * 2); c.fill(); }
      else if (p.kind === "fw") { c.fillStyle = `rgba(${p.color},${a})`; c.beginPath(); c.arc(p.x, p.y, p.r * (0.6 + a * 0.6), 0, Math.PI * 2); c.fill(); }
      else if (p.kind === "splash") { c.strokeStyle = `rgba(210,228,255,${a * 0.8})`; c.lineWidth = 1; ell(c, p.x, p.y, 1 + p.life * 22, 0.6 + p.life * 5); c.stroke(); }
      else if (p.kind === "drop") {
        // 飛び散る水滴。進む向きに少し伸ばして、上側にハイライト（地面より下に落ちたら描かない）
        if (p.y > GROUND + 4) continue;
        const ang = Math.atan2(p.vy, p.vx), len = Math.min(2.2, 1 + Math.hypot(p.vx, p.vy) / 420);
        c.fillStyle = `rgba(120,190,245,${a})`; ell(c, p.x, p.y, p.r * len, p.r, ang); c.fill();
        c.fillStyle = `rgba(235,248,255,${a})`; ell(c, p.x - p.r * 0.3, p.y - p.r * 0.35, p.r * 0.45, p.r * 0.3); c.fill();
      } else if (p.kind === "crown") {
        // 王冠形のしぶき：立ち上がってから崩れる水の壁
        const t = p.life / p.max, h = p.r * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.9), w = p.r * (0.7 + t * 0.9);
        c.fillStyle = `rgba(150,205,250,${a * 0.75})`;
        c.beginPath(); c.moveTo(p.x - w, p.y);
        for (let k = 0; k <= 8; k++) {
          const x = p.x - w + (k / 8) * w * 2, peak = k % 2 ? h : h * 0.55;
          c.quadraticCurveTo(x - w / 8, p.y - peak * 0.6, x, p.y - peak);
        }
        c.lineTo(p.x + w, p.y); c.closePath(); c.fill();
        c.fillStyle = `rgba(240,250,255,${a * 0.9})`;
        for (let k = 1; k < 8; k += 2) { const x = p.x - w + (k / 8) * w * 2; ell(c, x, p.y - h - 2, 2.2, 2.6); c.fill(); }
        c.strokeStyle = `rgba(200,232,255,${a * 0.8})`; c.lineWidth = 1.4; ell(c, p.x, p.y + 1, w * 1.25, 3 + t * 5); c.stroke();
      } else if (p.kind === "ring") { c.strokeStyle = `rgba(255,255,255,${a * 0.7})`; c.lineWidth = 1.5; ell(c, p.x, p.y, 4 + p.life * 50, 1.5 + p.life * 10); c.stroke(); }
      else star(c, p.x, p.y, p.r * a + 1, `rgba(255,214,110,${a})`);
    }
    if (flyers.length) {
      const r = $("score").getBoundingClientRect(), sr = stageEl.getBoundingClientRect();
      const tx = (r.left - sr.left + 18) / SC, ty = (r.top - sr.top + 16) / SC;
      for (const f of flyers) {
        const kk = Math.min(1, f.t), ez = kk * kk, cx = f.x0 - 30, cy = Math.min(f.y0, ty) - 60;
        const x = (1 - ez) * (1 - ez) * f.x0 + 2 * (1 - ez) * ez * cx + ez * ez * tx;
        const y = (1 - ez) * (1 - ez) * f.y0 + 2 * (1 - ez) * ez * cy + ez * ez * ty;
        c.globalAlpha = 1 - kk * 0.3; drawItemImg(c, f.item, x, y, 28 * (1 - kk * 0.55)); c.globalAlpha = 1;
      }
    }
    c.textAlign = "center"; c.textBaseline = "middle"; c.lineJoin = "round";
    for (const t of texts) {
      const a = 1 - Math.max(0, (t.life - t.max * 0.55) / (t.max * 0.45));
      const pop = RM ? 1 : 1 + Math.max(0, 0.25 - t.life) * 1.6;
      c.font = font(t.size * pop);
      // 長い文字（あいさつ等）が画面の端で切れないよう、横位置を画面内に収める
      const half = c.measureText(t.text).width / 2 + 6, tx = Math.min(VW - half, Math.max(half, t.x));
      c.strokeStyle = `rgba(22,21,46,${a * 0.85})`; c.lineWidth = 4; c.strokeText(t.text, tx, t.y);
      c.globalAlpha = a; c.fillStyle = t.color; c.fillText(t.text, tx, t.y); c.globalAlpha = 1;
    }
    if (STAGE.weather === "snow") {
      const inten = 0.35 + 0.65 * S.rain, n = Math.round(drops.length * inten * (S.calm ? 0.5 : 1) * (M.clear ? 0.2 : 1));
      c.fillStyle = "rgba(255,255,255,.85)";
      for (let i = 0; i < n; i++) {
        const d = drops[i]!;
        d.y += d.v * 0.25 * FDT;
        if (d.y > 1) { d.y -= 1.05; d.x = Math.random(); }
        const x = d.x * VW + Math.sin(S.time + i) * 6, y = d.y * (GROUND + 24);
        c.beginPath(); c.arc(x, y, 0.8 + d.l / 12, 0, Math.PI * 2); c.fill();
      }
    } else if (S.rain > 0.02) {
      const n = Math.round(drops.length * S.rain * (S.calm ? 0.45 : 1) * (M.clear ? 0.2 : 1));
      c.strokeStyle = `rgba(200,220,255,${0.45 * S.rain})`; c.lineWidth = 1; c.beginPath();
      for (let i = 0; i < n; i++) {
        const d = drops[i]!;
        d.y += d.v * 1.3 * FDT * (VH / 300); d.x -= 0.05 * FDT;
        if (d.y > 1) {
          d.y -= 1.05; d.x = Math.random() * 1.1;
          if (Math.random() < 0.3 && FDT > 0) parts.push({ x: d.x * VW, y: GROUND + rand(0, 16), vx: 0, vy: 0, life: 0, max: 0.25, r: 2, kind: "splash", color: "", g: 0, scroll: true });
        }
        const x = d.x * VW, y = d.y * (GROUND + 24);
        c.moveTo(x, y); c.lineTo(x - d.l * 0.18, y + d.l);
      }
      c.stroke();
    }
    {
      const sun = sunLight(e);
      if (sun.warm > 0.02 && sun.day > 0.1) { c.fillStyle = `rgba(${sun.rgb},${0.07 * sun.warm * sun.day})`; c.fillRect(-20, -20, VW + 40, VH + 40); }
    }
    if (S.state === "play") for (const tn of M.tints) { c.fillStyle = `rgba(${tn},${tn === "20,14,40" ? 0.28 : 0.1})`; c.fillRect(-20, -20, VW + 40, VH + 40); }
    if (FX.fade > 0.01) { c.fillStyle = `rgba(16,14,34,${FX.fade * 0.85})`; c.fillRect(-20, -20, VW + 40, VH + 40); }
    if (FX.flash > 0.02) { c.fillStyle = `rgba(${FX.flashCol},${FX.flash * 0.6})`; c.fillRect(-20, -20, VW + 40, VH + 40); }
    if (e.night > 0.05) {
      const g = c.createRadialGradient(VW / 2, VH * 0.55, VH * 0.3, VW / 2, VH * 0.55, VW * 0.75);
      g.addColorStop(0, "rgba(10,8,30,0)"); g.addColorStop(1, `rgba(10,8,30,${0.35 * e.night})`);
      c.fillStyle = g; c.fillRect(-20, -20, VW + 40, VH + 40);
    }

    // HUD
    setFlag("hud-left", S.state === "ready", (v) => { $("hud-left").style.visibility = v ? "hidden" : "visible"; });
    setText("score", score().toLocaleString());
    setText("meta", `${Math.floor(S.dist / 50)}m・ほね${S.bones}・アイテム${S.treats}`);
    setText("clock", fmtClock(S.clock));
    setText("phase", phaseName(S.clock) + (S.rain > 0.3 ? (STAGE.weather === "snow" ? "・雪" : "・雨") : "") + (S.wx ? `・${{ rainbow: "虹", thunder: "雷", sakura: "桜", momiji: "紅葉", aurora: "オーロラ" }[S.wx.kind]}` : ""));
    const secKey = S.state === "play" && S.sec !== "normal" ? S.sec : "";
    setFlag("sec-on", Boolean(secKey), (v) => { $("sec-chip").hidden = !v; });
    if (secKey) {
      $("sec-chip").dataset.k = secKey;
      setText("sec-chip", `${secKey === "bonus" ? "ボーナスタイム" : "ラッシュ"} あと${Math.ceil(S.secT)}秒`);
    }
    const routeKind = S.state === "play" ? routeOn() : null;
    setFlag("route-on", Boolean(routeKind), (v) => { $("route-chip").hidden = !v; });
    if (routeKind && S.route) {
      $("route-chip").dataset.k = routeKind;
      setText("route-chip", S.route.exit === null ? `${routeName(routeKind)}ルート あと${Math.max(1, Math.ceil(S.route.t))}秒` : `${routeName(routeKind)}ルート まもなく合流`);
    }
    renderSkillRows();
    setText("combo-text", `×${S.mult} コンボ`);
    $("combo-bar").style.transform = `scaleX(${clamp(S.chainT / 1.5, 0, 1).toFixed(3)})`;
    setFlag("combo-on", S.mult > 1 && S.state === "play", (v) => { $("combo").dataset.off = v ? "0" : "1"; });
    const ward = S.shield ? "バリア" : K.guards[0] ? `身代わり（${K.guards[0].name}）` : K.revives[0] ? `復活（${K.revives[0].name}）` : "";
    setFlag("charm-on", Boolean(ward) && S.state === "play", (v) => { $("charm").dataset.off = v ? "0" : "1"; });
    if (ward) setText("charm-text", ward);
    setFlag("pause-on", S.state === "play" && !S.paused, (v) => { $("pause-btn").hidden = !v; });
    setFlag("gear-on", (S.state === "ready" || S.state === "over") && $("settings-panel").hidden, (v) => { $("gear").hidden = !v; });
    if (S.state !== "play" && S.state !== "dying" && FX.rareT > 0) { FX.rareT = 0; $("rare").hidden = true; }
  }

  /* ---------- よけるものの小さな絵 ---------- */
  function drawIcons(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const cv of $$<HTMLCanvasElement>("canvas[data-icon]")) {
      cv.width = 56 * dpr; cv.height = 44 * dpr;
      const c = cv.getContext("2d");
      if (!c) continue;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, 56, 44);
      const kind = cv.dataset.icon;
      if (kind === "cone") { drawCone(c, 6, 38, 20, 28); drawPuddle(c, 26, 32, 26, 0.3, 0, "town"); }
      else if (kind === "bike") { c.save(); c.translate(4, 4); c.scale(0.76, 0.76); drawBike(c, 0, 48, 62); c.restore(); }
      else if (kind === "crow") drawCrow(c, 12, 12, 34, 20, 0.1);
      else if (kind === "cat") drawCat(c, 12, 38, 34, 0.2, 0, false);
      else if (kind === "sign") drawSign(c, 8, 42, 40, 38, 0, 0);
      else if (kind === "pigeons") drawPigeons(c, 6, [{ dx: 10, p: 0, delay: 0 }, { dx: 30, p: 2, delay: 0 }], false, 0, 34, 0.3);
      else if (kind === "noren") { c.save(); c.scale(0.6, 0.6); drawNoren(c, 30, 34, 100, 0, "town"); c.restore(); }
      else if (kind === "roller") drawRoller(c, 13, 38, 30, 18, 0.3, "town");
      else if (kind === "drop") { c.fillStyle = "rgba(20,16,40,.3)"; ell(c, 28, 40, 9, 2.5); c.fill(); drawDropper(c, 28, 28, 20, "town", false); }
      else if (kind === "buddy") {
        const img = dogImage("summer", "walk");
        const paint = () => { c.clearRect(0, 0, 56, 44); c.drawImage(img, 2, -1, 52, 44); };
        if (img.complete && img.naturalWidth) paint(); else { drawBuddy(c, 12, 40, 34, 0.2, 0, true); img.addEventListener("load", paint, { once: true }); }
      }
      else if (kind === "suitcase") drawSuitcase(c, 10, 40, 36, 32, 0.2, "town");
      else if (kind === "surprise") { c.save(); c.translate(16, 42); c.scale(0.6, 0.6); drawSurpriseBox(c, 0, 0, 40, 64, 0.2, false, "town"); c.restore(); }
      else if (kind === "drone") drawDeliveryDrone(c, 2, 37, 52, 30, 0.2, true, "town");
      else if (kind === "geyser") drawGeyser(c, 16, 42, 24, 40, 0.4, "town");
    }
  }

  /* ---------- ループ ---------- */
  let last = performance.now(), raf = 0, stopped = false;
  function frame(now: number): void {
    if (stopped) return;
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    FDT = S.paused ? 0 : dt;
    if (FX.hitstop > 0) { FX.hitstop -= dt; FDT = 0; render(); }
    else { update(dt); render(); bgmTick(); }
    raf = requestAnimationFrame(frame);
  }

  buildStageList();
  selectStage(STAGE_ID);
  renderStepBoost();
  renderMissions();
  renderAchList();
  renderZukan();
  buildRarityGuide();
  drawIcons();
  void document.fonts?.ready.then(() => { if (!stopped) drawIcons(); });
  P.y = GROUND;
  raf = requestAnimationFrame(frame);

  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    for (const fn of cleanups.splice(0)) fn();
    bgmStop();
    if (rainNode) { try { rainNode.src.stop(); } catch { /* 停止済み */ } rainNode.src.disconnect(); rainNode = null; }
    if (A) {
      const rig = A;
      window.setTimeout(() => rig.master.disconnect(), 450);
      A = null;
    }
  };
}
