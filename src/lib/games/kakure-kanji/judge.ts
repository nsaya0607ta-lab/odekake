import type { Answer, Stage } from "./types";

/**
 * 正解判定（筆画えらび）。
 * プレイヤーは出題漢字の筆画をタップしてえらび（灰色→黒）、OK で答える。
 * えらんだ筆画の組が、ステージに登録された検証済み（verified）の答えの筆画の組（strokeSets のどれか）と
 * ぴったり同じときだけ正解。文字の入力や文字列の検索はしないので、字形のちがう字（戌と戍など）を
 * まちがえて正解にすることがない。
 */

export type JudgeResult =
  | { kind: "correct"; answer: Answer }
  | { kind: "duplicate"; answer: Answer }
  /** 検証中の答えと同じ組（判定に使わない） */
  | { kind: "pending" }
  /** 全部の画をえらんだ（出題漢字そのもの） */
  | { kind: "whole" }
  /** near: まだ見つけていない答えと1本だけちがうとき、たりない（fewer）か多い（more）か */
  | { kind: "wrong"; near: "fewer" | "more" | null }
  | { kind: "empty" };

/** 判定に使ってよい答え（検証済みのもの）だけ */
export function verifiedAnswers(stage: Stage): Answer[] {
  return stage.answers.filter((answer) => answer.verification.status === "verified");
}

/** 出題漢字にある筆画だけを、重なりなしで小さい順に */
export function normalizeSelection(stage: Stage, selected: Iterable<number>): number[] {
  const ids = new Set(stage.strokes.map((s) => s.id));
  return Array.from(new Set(selected)).filter((id) => ids.has(id)).sort((a, b) => a - b);
}

function sameSet(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

function isSubset(small: readonly number[], big: readonly number[]): boolean {
  const set = new Set(big);
  return small.every((id) => set.has(id));
}

/** その答えになる筆画の組か */
export function matchesAnswer(answer: Answer, selected: readonly number[]): boolean {
  return answer.strokeSets.some((set) => sameSet(set, selected));
}

export function judgeStrokes(stage: Stage, selected: Iterable<number>, found: ReadonlySet<string>): JudgeResult {
  const picked = normalizeSelection(stage, selected);
  if (picked.length === 0) return { kind: "empty" };
  if (picked.length === stage.strokes.length) return { kind: "whole" };

  const answer = verifiedAnswers(stage).find((a) => matchesAnswer(a, picked));
  if (answer) return found.has(answer.char) ? { kind: "duplicate", answer } : { kind: "correct", answer };
  if (stage.answers.some((a) => matchesAnswer(a, picked))) return { kind: "pending" };

  // まだ見つけていない答えと1本ちがいなら、そっと教える（どの答えかは言わない）
  let near: "fewer" | "more" | null = null;
  for (const a of verifiedAnswers(stage)) {
    if (found.has(a.char)) continue;
    for (const set of a.strokeSets) {
      if (set.length === picked.length + 1 && isSubset(picked, set)) near = "fewer";
      else if (set.length === picked.length - 1 && isSubset(set, picked) && near === null) near = "more";
    }
  }
  return { kind: "wrong", near };
}

/** 結果を画面に出すひとこと */
export function resultMessage(result: JudgeResult, stageKanji: string): string {
  switch (result.kind) {
    case "correct":
      return `「${result.answer.char}」を見つけた！`;
    case "duplicate":
      return `「${result.answer.char}」はもう見つけています`;
    case "pending":
      return "その形の字は確認中のため、今回は判定しません";
    case "whole":
      return `全部の線をえらぶと「${stageKanji}」そのもの。中にかくれている字をさがそう`;
    case "wrong":
      if (result.near === "fewer") return "おしい！ あと1本、線がたりないかも";
      if (result.near === "more") return "おしい！ 線が1本多いかも";
      return "その線の組み合わせでは、漢字になりません";
    case "empty":
      return "大きな漢字の線をタップして、黒くしてからOKを押してね";
  }
}
