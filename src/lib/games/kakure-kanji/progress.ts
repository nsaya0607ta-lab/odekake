import { z } from "zod";
import type { Stage } from "./types";
import { hintCount, starsFor, type HintKind, type RoundState } from "./engine";

/**
 * 進みぐあい（セーブデータ）と、コイン・経験値・レベル・実績・称号の決まり。
 * 今はこの端末（localStorage）に保存する。ProgressStore を差しかえればクラウド保存にできる。
 * コインはこのゲームの中だけで使う「墨コイン」で、アプリのほかのコインとは別。
 */

export const SAVE_VERSION = 1;

const hintKind = z.enum(["reading", "strokes", "part", "reveal"]);
const resultKind = z.enum(["correct", "duplicate", "pending", "whole", "wrong", "empty"]);

const roundSchema = z.object({
  stageId: z.string(),
  found: z.array(z.string()),
  revealed: z.array(z.string()),
  hints: z.record(z.string(), z.array(hintKind)),
  misses: z.number().int().min(0),
  combo: z.number().int().min(0),
  maxCombo: z.number().int().min(0),
  score: z.number().min(0),
  history: z.array(z.object({ text: z.string(), kind: resultKind, at: z.number() })),
  startedAt: z.number(),
  clearedAt: z.number().nullable(),
});

const saveSchema = z.object({
  version: z.literal(SAVE_VERSION),
  coins: z.number().int().min(0),
  exp: z.number().int().min(0),
  level: z.number().int().min(1),
  totalPoints: z.number().min(0),
  stages: z.record(
    z.string(),
    z.object({ clears: z.number().int().min(0), bestStars: z.number().int().min(0).max(3), bestScore: z.number().min(0), firstClearedAt: z.number().nullable() }),
  ),
  rounds: z.record(z.string(), roundSchema),
  achievements: z.record(z.string(), z.number()),
  hintLog: z.array(z.object({ stageId: z.string(), answer: z.string(), kind: hintKind, cost: z.number(), at: z.number() })),
  clearStreak: z.number().int().min(0),
  bestClearStreak: z.number().int().min(0),
  login: z.object({ lastDate: z.string().nullable(), streak: z.number().int().min(0) }),
  stats: z.object({ correct: z.number().int().min(0), wrong: z.number().int().min(0) }),
  settings: z.object({
    sound: z.boolean(),
    theme: z.enum(["system", "light", "dark"]),
  }),
});

export type SaveData = z.infer<typeof saveSchema>;
export type Settings = SaveData["settings"];

export const START_COINS = 60;
export const HINT_LOG_LIMIT = 200;

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    coins: START_COINS,
    exp: 0,
    level: 1,
    totalPoints: 0,
    stages: {},
    rounds: {},
    achievements: {},
    hintLog: [],
    clearStreak: 0,
    bestClearStreak: 0,
    login: { lastDate: null, streak: 0 },
    stats: { correct: 0, wrong: 0 },
    settings: { sound: true, theme: "system" },
  };
}

export function parseSave(value: unknown): SaveData | null {
  const result = saveSchema.safeParse(value);
  return result.success ? result.data : null;
}

// ---------- 保存先 ----------

export interface ProgressStore {
  load(): SaveData;
  save(data: SaveData): void;
}

/** 文字列の簡単なチェックサム（書きかけ・こわれたデータを見分ける） */
export function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

type KeyValue = { getItem(key: string): string | null; setItem(key: string, value: string): void };

function decode(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const box = JSON.parse(raw) as { sum?: unknown; body?: unknown };
    if (typeof box.body !== "string" || box.sum !== checksum(box.body)) return null;
    return parseSave(JSON.parse(box.body));
  } catch {
    return null;
  }
}

function encode(data: SaveData): string {
  const body = JSON.stringify(data);
  return JSON.stringify({ sum: checksum(body), body });
}

/**
 * localStorage に保存する。毎回「ひとつ前の正しいデータ」を .bak に残すので、
 * 本体がこわれていても1つ前から読みなおせる。どちらもだめなら、こわれたデータを .broken に残して最初から。
 */
export function createKeyValueStore(storage: KeyValue, key = "odekake_kakure_kanji_v1"): ProgressStore {
  return {
    load() {
      const main = storage.getItem(key);
      const fromMain = decode(main);
      if (fromMain) return fromMain;
      const fromBackup = decode(storage.getItem(`${key}.bak`));
      if (main) {
        try {
          storage.setItem(`${key}.broken`, main);
        } catch {
          /* 保存できなくても遊べるようにする */
        }
      }
      return fromBackup ?? defaultSave();
    },
    save(data) {
      const checked = parseSave(data);
      if (!checked) throw new Error("セーブデータの形が正しくありません");
      const previous = storage.getItem(key);
      if (previous && decode(previous)) storage.setItem(`${key}.bak`, previous);
      storage.setItem(key, encode(checked));
    },
  };
}

/** 保存できない環境（シークレットモードなど）用。遊べるが、閉じると消える */
export function createMemoryStore(): ProgressStore {
  const map = new Map<string, string>();
  return createKeyValueStore({ getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) });
}

// ---------- レベル・称号 ----------

/** 次のレベルまでに必要な経験値 */
export function expToNext(level: number): number {
  return 50 + level * 30;
}

export function levelUpCoins(newLevel: number): number {
  return 10 + newLevel * 5;
}

export const TITLES: { minLevel: number; name: string }[] = [
  { minLevel: 1, name: "漢字初心者" },
  { minLevel: 3, name: "漢字研究家" },
  { minLevel: 6, name: "漢字博士" },
  { minLevel: 10, name: "漢字名人" },
  { minLevel: 15, name: "漢字達人" },
];

export function titleFor(level: number): string {
  let name = "漢字初心者";
  for (const title of TITLES) if (level >= title.minLevel) name = title.name;
  return name;
}

export function addExp(save: SaveData, amount: number): { save: SaveData; levelUps: { level: number; coins: number }[] } {
  let { exp, level, coins } = save;
  exp += Math.max(0, Math.round(amount));
  const levelUps: { level: number; coins: number }[] = [];
  while (exp >= expToNext(level)) {
    exp -= expToNext(level);
    level += 1;
    const reward = levelUpCoins(level);
    coins += reward;
    levelUps.push({ level, coins: reward });
  }
  return { save: { ...save, exp, level, coins }, levelUps };
}

// ---------- 実績 ----------

export type AchievementId = "first_correct" | "first_clear" | "clear_10" | "clear_100" | "no_hint" | "perfect" | "streak_3";

export const ACHIEVEMENTS: { id: AchievementId; name: string; description: string; coins: number }[] = [
  { id: "first_correct", name: "初めての正解", description: "かくれた漢字を1つ見つける", coins: 10 },
  { id: "first_clear", name: "初めてのクリア", description: "ステージを1つクリアする", coins: 20 },
  { id: "no_hint", name: "ノーヒントクリア", description: "ヒントを使わずにクリアする", coins: 30 },
  { id: "perfect", name: "全問正解", description: "まちがい0・ヒント0で全部の答えを見つける", coins: 50 },
  { id: "streak_3", name: "連続クリア", description: "スキップせずに3回続けてクリアする", coins: 30 },
  { id: "clear_10", name: "10ステージクリア", description: "ちがうステージを10個クリアする", coins: 100 },
  { id: "clear_100", name: "100ステージクリア", description: "ちがうステージを100個クリアする", coins: 500 },
];

function unlock(save: SaveData, ids: AchievementId[], now: number): { save: SaveData; unlocked: AchievementId[] } {
  const fresh = ids.filter((id) => save.achievements[id] === undefined);
  if (fresh.length === 0) return { save, unlocked: [] };
  const achievements = { ...save.achievements };
  let coins = save.coins;
  for (const id of fresh) {
    achievements[id] = now;
    coins += ACHIEVEMENTS.find((a) => a.id === id)?.coins ?? 0;
  }
  return { save: { ...save, achievements, coins }, unlocked: fresh };
}

export function clearedStageCount(save: SaveData): number {
  return Object.values(save.stages).filter((s) => s.clears > 0).length;
}

// ---------- コイン ----------

export function spendCoins(save: SaveData, cost: number): { ok: true; save: SaveData } | { ok: false; shortBy: number } {
  if (!Number.isFinite(cost) || cost < 0) return { ok: false, shortBy: 0 };
  if (save.coins < cost) return { ok: false, shortBy: cost - save.coins };
  return { ok: true, save: { ...save, coins: save.coins - cost } };
}

/** ヒントを買う。コインが足りなければ何も変えない */
export function buyHint(
  save: SaveData,
  stageId: string,
  answer: string,
  kind: HintKind,
  cost: number,
  now: number,
): { ok: true; save: SaveData } | { ok: false; shortBy: number } {
  const paid = spendCoins(save, cost);
  if (!paid.ok) return paid;
  const hintLog = [{ stageId, answer, kind, cost, at: now }, ...paid.save.hintLog].slice(0, HINT_LOG_LIMIT);
  return { ok: true, save: { ...paid.save, hintLog } };
}

/** 日本時間の日付（YYYY-MM-DD） */
export function japanDate(now: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
}

function previousDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function loginBonusAmount(streak: number): number {
  return Math.min(50, 20 + (streak - 1) * 5);
}

/** その日はじめて開いたときだけ、ログインボーナスをわたす */
export function claimLoginBonus(save: SaveData, today: string): { save: SaveData; bonus: { coins: number; streak: number } | null } {
  if (save.login.lastDate === today) return { save, bonus: null };
  const streak = save.login.lastDate === previousDate(today) ? save.login.streak + 1 : 1;
  const coins = loginBonusAmount(streak);
  return { save: { ...save, coins: save.coins + coins, login: { lastDate: today, streak } }, bonus: { coins, streak } };
}

// ---------- プレイの記録 ----------

export function saveRound(save: SaveData, round: RoundState): SaveData {
  return { ...save, rounds: { ...save.rounds, [round.stageId]: round } };
}

export function dropRound(save: SaveData, stageId: string): SaveData {
  const rounds = { ...save.rounds };
  delete rounds[stageId];
  return { ...save, rounds };
}

/** 答えたあとの集計（正解数・まちがい数・初めての正解） */
export function recordAnswers(save: SaveData, correct: number, wrong: number, now: number): { save: SaveData; unlocked: AchievementId[] } {
  const next = { ...save, stats: { correct: save.stats.correct + correct, wrong: save.stats.wrong + wrong } };
  return correct > 0 ? unlock(next, ["first_correct"], now) : { save: next, unlocked: [] };
}

export type ClearReward = {
  stars: 1 | 2 | 3;
  score: number;
  coins: number;
  exp: number;
  firstClear: boolean;
  newBest: boolean;
  levelUps: { level: number; coins: number }[];
  achievements: AchievementId[];
};

/**
 * クリアの報酬をわたす。報酬は「保存中のラウンドと同じラウンド」にだけわたし、わたすときにそのラウンドを消す。
 * なので同じラウンドで2回呼ばれても（連打・再読みこみ）二重にはわたさない。
 */
export function completeStage(save: SaveData, stage: Stage, round: RoundState, now: number): { save: SaveData; reward: ClearReward | null } {
  const stored = save.rounds[stage.id];
  if (round.clearedAt === null || !stored || stored.startedAt !== round.startedAt) return { save, reward: null };
  const prev = save.stages[stage.id] ?? { clears: 0, bestStars: 0, bestScore: 0, firstClearedAt: null };
  const firstClear = prev.clears === 0;
  const stars = starsFor(round);
  const starRate = stars === 3 ? 1.5 : stars === 2 ? 1.25 : 1;
  const coins = firstClear ? Math.round(stage.reward.coins * starRate) : stage.reward.replayCoins;
  const exp = (firstClear ? stage.reward.exp : stage.reward.replayExp) + (round.found.length - round.revealed.length) * 5;

  let next: SaveData = dropRound(save, stage.id);
  next = {
    ...next,
    coins: next.coins + coins,
    totalPoints: next.totalPoints + round.score,
    clearStreak: next.clearStreak + 1,
    bestClearStreak: Math.max(next.bestClearStreak, next.clearStreak + 1),
    stages: {
      ...next.stages,
      [stage.id]: {
        clears: prev.clears + 1,
        bestStars: Math.max(prev.bestStars, stars),
        bestScore: Math.max(prev.bestScore, round.score),
        firstClearedAt: prev.firstClearedAt ?? now,
      },
    },
  };
  const leveled = addExp(next, exp);
  next = leveled.save;

  const ids: AchievementId[] = ["first_clear"];
  if (hintCount(round) === 0) ids.push("no_hint");
  if (hintCount(round) === 0 && round.misses === 0) ids.push("perfect");
  if (next.clearStreak >= 3) ids.push("streak_3");
  if (clearedStageCount(next) >= 10) ids.push("clear_10");
  if (clearedStageCount(next) >= 100) ids.push("clear_100");
  const unlocked = unlock(next, ids, now);

  return {
    save: unlocked.save,
    reward: {
      stars,
      score: round.score,
      coins,
      exp,
      firstClear,
      newBest: round.score > prev.bestScore,
      levelUps: leveled.levelUps,
      achievements: unlocked.unlocked,
    },
  };
}

/** スキップ（あきらめて答えを見る）。報酬はなく、連続クリアが切れる */
export function skipStage(save: SaveData, stageId: string): SaveData {
  return { ...dropRound(save, stageId), clearStreak: 0 };
}
