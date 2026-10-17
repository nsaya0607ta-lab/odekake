import type { Answer, Stage } from "./types";
import { judgeStrokes, normalizeSelection, verifiedAnswers, type JudgeResult } from "./judge";

/**
 * 1回のプレイ（ラウンド）の状態と、点数・ヒントの決まり。どれも純粋な関数で、画面から切りはなしてテストできる。
 */

export type HintKind = "reading" | "strokes" | "part" | "reveal";

export const HINTS: Record<HintKind, { label: string; cost: number; description: string }> = {
  reading: { label: "読み方", cost: 10, description: "答えの読み方を1つ見る" },
  strokes: { label: "画数", cost: 10, description: "答えの画数を見る" },
  part: { label: "一部を見る", cost: 20, description: "答えに使う線の一部と、場所のヒントを見る" },
  reveal: { label: "答えを開く", cost: 40, description: "この答えを開いて一覧に入れる（点数は入らない）" },
};

export const HINT_ORDER: HintKind[] = ["reading", "strokes", "part", "reveal"];

/** 見つけやすさごとの点数 */
export const TIER_POINTS: Record<Answer["tier"], number> = { 1: 100, 2: 160, 3: 260 };
/** 続けて当てるたびに +10%（最大 +50%）。まちがえても点は減らさず、連続が切れるだけ */
export const COMBO_STEP = 0.1;
export const COMBO_MAX_BONUS = 0.5;

/** 答えた記録。text は正解なら字、ちがったら「3画」のような本数 */
export type InputRecord = { text: string; kind: JudgeResult["kind"]; at: number };

export type RoundState = {
  stageId: string;
  found: string[];
  /** ヒントで開いた答え（found にも入る） */
  revealed: string[];
  hints: Record<string, HintKind[]>;
  misses: number;
  combo: number;
  maxCombo: number;
  score: number;
  history: InputRecord[];
  startedAt: number;
  /** 見つける字（小学校で習う字）を全部見つけた時刻。このあともシークレットはさがせる */
  clearedAt: number | null;
  /** クリアの報酬をわたした時刻（二重にわたさないため） */
  rewardedAt: number | null;
  /** シークレットまで全部見つけた時刻。これでラウンドはおしまい */
  completedAt: number | null;
};

export const HISTORY_LIMIT = 30;

export function newRound(stage: Stage, now: number): RoundState {
  return {
    stageId: stage.id,
    found: [],
    revealed: [],
    hints: {},
    misses: 0,
    combo: 0,
    maxCombo: 0,
    score: 0,
    history: [],
    startedAt: now,
    clearedAt: null,
    rewardedAt: null,
    completedAt: null,
  };
}

/** シークレット枠の字か（小学校で習わない字） */
export function isSecret(answer: Answer): boolean {
  return answer.grade === null;
}

/** クリアに必要な答え（小学校で習う字） */
export function mainAnswers(stage: Stage): Answer[] {
  return orderedAnswers(stage).filter((a) => !isSecret(a));
}

/** シークレット枠の答え（数は画面に出してよい） */
export function secretAnswers(stage: Stage): Answer[] {
  return orderedAnswers(stage).filter(isSecret);
}

/** クリアに必要な数 */
export function totalAnswers(stage: Stage): number {
  return mainAnswers(stage).length;
}

/** 見つける字を全部見つけたか（クリア） */
export function isCleared(stage: Stage, round: RoundState): boolean {
  const need = mainAnswers(stage);
  return need.length > 0 && need.every((a) => round.found.includes(a.char));
}

/** シークレットまで全部見つけたか */
export function isCompleted(stage: Stage, round: RoundState): boolean {
  return verifiedAnswers(stage).every((a) => round.found.includes(a.char));
}

/** found / revealed から clearedAt・completedAt をつける */
function markProgress(stage: Stage, round: RoundState, now: number): RoundState {
  const next = { ...round };
  if (next.clearedAt === null && isCleared(stage, next)) next.clearedAt = now;
  if (next.completedAt === null && isCompleted(stage, next)) next.completedAt = now;
  return next;
}

/** 旧セーブの字を現在の正解へ対応づける。判定は字形に合わせた strokeSets だけで行う。 */
export function canonicalAnswerChar(stage: Stage, char: string): string {
  return stage.answerAliases?.[char] ?? char;
}

/** 正解の変更を保存済みラウンドにも適用する。獲得済みの点数・報酬はそのまま。 */
export function reconcileRound(stage: Stage, round: RoundState, now: number): RoundState {
  const chars = new Set(verifiedAnswers(stage).map((answer) => answer.char));
  const canonical = (char: string) => canonicalAnswerChar(stage, char);
  const normalize = (list: string[]) => [...new Set(list.map(canonical))].filter((char) => chars.has(char));
  const hints: RoundState["hints"] = {};
  for (const [char, used] of Object.entries(round.hints)) {
    const target = canonical(char);
    if (chars.has(target)) hints[target] = [...new Set([...(hints[target] ?? []), ...used])];
  }
  return markProgress(stage, {
    ...round,
    found: normalize(round.found),
    revealed: normalize(round.revealed),
    hints,
    history: round.history.flatMap((record) => {
      if (record.kind !== "correct" && record.kind !== "duplicate") return [record];
      const text = normalize(record.text.split("・")).join("・");
      return text ? [{ ...record, text }] : [];
    }),
  }, now);
}

/** 答え1つの点数。ヒントを使った答えは半分、開いた答えは0点 */
export function pointsFor(answer: Answer, combo: number, hintsUsed: HintKind[]): number {
  if (hintsUsed.includes("reveal")) return 0;
  const base = TIER_POINTS[answer.tier] * (hintsUsed.length > 0 ? 0.5 : 1);
  const bonus = Math.min(COMBO_MAX_BONUS, combo * COMBO_STEP);
  return Math.round(base * (1 + bonus));
}

export type SubmitOutcome = {
  round: RoundState;
  result: JudgeResult | null;
  /** この回答で見つけた答えと、その点数 */
  gained: {
    answer: Answer;
    points: number;
    secret: boolean;
    discoveries: { answer: Answer; points: number; secret: boolean }[];
  } | null;
  /** この回答でクリアした（見つける字がそろった） */
  cleared: boolean;
  /** この回答でシークレットまで全部そろった */
  completed: boolean;
};

/** えらんだ筆画で答える */
export function submit(stage: Stage, round: RoundState, selected: Iterable<number>, now: number): SubmitOutcome {
  if (round.completedAt !== null) return { round, result: null, gained: null, cleared: false, completed: false };
  const picked = normalizeSelection(stage, selected);
  const result = judgeStrokes(stage, picked, new Set(round.found));
  if (result.kind === "empty") return { round, result, gained: null, cleared: false, completed: false };

  let next: RoundState = { ...round };
  let gained: SubmitOutcome["gained"] = null;
  if (result.kind === "correct") {
    const discoveries = result.answers.map((answer) => ({
      answer,
      points: pointsFor(answer, round.combo, round.hints[answer.char] ?? []),
      secret: isSecret(answer),
    }));
    const points = discoveries.reduce((sum, discovery) => sum + discovery.points, 0);
    gained = { answer: result.answer, points, secret: discoveries.some((discovery) => discovery.secret), discoveries };
    next = {
      ...next,
      found: [...round.found, ...result.answers.map((answer) => answer.char)],
      score: round.score + points,
      combo: round.combo + 1,
      maxCombo: Math.max(round.maxCombo, round.combo + 1),
    };
  } else if (result.kind === "wrong" || result.kind === "whole") {
    // ちがう組み合わせのときだけ「まちがい」に数える（点は減らさず、連続が切れるだけ）
    next = { ...next, misses: round.misses + 1, combo: 0 };
  }
  const text = result.kind === "correct" || result.kind === "duplicate" ? result.answers.map((answer) => answer.char).join("・") : `${picked.length}画`;
  next.history = [{ text, kind: result.kind, at: now }, ...round.history].slice(0, HISTORY_LIMIT);
  const marked = markProgress(stage, next, now);
  return {
    round: marked,
    result,
    gained,
    cleared: round.clearedAt === null && marked.clearedAt !== null,
    completed: round.completedAt === null && marked.completedAt !== null,
  };
}

/** ヒントを使えるか（もう見つけた答え・同じヒントの2回目は使えない） */
export function canUseHint(round: RoundState, answerChar: string, kind: HintKind): boolean {
  if (round.completedAt !== null) return false;
  if (round.found.includes(answerChar)) return false;
  return !(round.hints[answerChar] ?? []).includes(kind);
}

/** ヒントを使った状態にする。コインの支払いは progress.ts の spendCoins で先に行う */
export function applyHint(stage: Stage, round: RoundState, answerChar: string, kind: HintKind, now: number): RoundState {
  if (!verifiedAnswers(stage).some((answer) => answer.char === answerChar) || !canUseHint(round, answerChar, kind)) return round;
  const hints = { ...round.hints, [answerChar]: [...(round.hints[answerChar] ?? []), kind] };
  if (kind !== "reveal") return { ...round, hints };
  const found = [...round.found, answerChar];
  return markProgress(stage, { ...round, hints, found, revealed: [...round.revealed, answerChar], combo: 0 }, now);
}

/** ヒントを使った回数。stage をわたすと、見つける字（シークレットでない字）に使った分だけを数える */
export function hintCount(round: RoundState, stage?: Stage): number {
  const main = stage ? new Set(mainAnswers(stage).map((a) => a.char)) : null;
  return Object.entries(round.hints).reduce((sum, [ch, list]) => (main && !main.has(ch) ? sum : sum + list.length), 0);
}

/**
 * 星の数。まちがいでは減らさない（何度まちがえてもストレスにならないように）。
 * 見つける字（シークレットでない字）に使ったヒントだけで決める。
 * ★3 ヒントなし / ★2 ヒント2回まで・答えを開いていない / ★1 クリア
 */
export function starsFor(stage: Stage, round: RoundState): 1 | 2 | 3 {
  const used = hintCount(round, stage);
  const main = new Set(mainAnswers(stage).map((a) => a.char));
  if (used === 0) return 3;
  if (used <= 2 && !round.revealed.some((ch) => main.has(ch))) return 2;
  return 1;
}

/** 画数（構造データではなく出題データの筆画から数える） */
export function strokeCountOf(answer: Answer): number {
  return answer.strokeSets[0]?.length ?? 0;
}

/**
 * ヒント「一部を見る」で光らせる筆画。答えの筆画の前半（半分より少なめ）だけを、出題漢字の中の本当の位置で見せる。
 * 1画の字（一）は見せる画がないので、説明の文だけを出す。
 */
export function partHintStrokes(answer: Answer): number[] {
  const set = answer.strokeSets[0] ?? [];
  return set.slice(0, Math.floor(set.length / 2));
}

/** 答えの並び（やさしい順・登録順） */
export function orderedAnswers(stage: Stage): Answer[] {
  return verifiedAnswers(stage)
    .map((answer, index) => ({ answer, index }))
    .sort((a, b) => a.answer.tier - b.answer.tier || a.index - b.index)
    .map(({ answer }) => answer);
}
