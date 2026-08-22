/**
 * わんこボウリングのスコア計算
 * =============================================================
 * 通常の10フレームではなく5フレーム制。基本ルールは一般的なボウリングと同じ：
 * - 1フレーム最大2投（ストライクなら1投で終了）
 * - ストライク・スペアのボーナス加算あり
 * - 最終（5）フレームだけストライク/スペア時にボーナス投球が発生する
 */

export const BOWLING_FRAME_COUNT = 5;
export const PINS_PER_FRAME = 10;

export type BowlingFrame = {
  /** そのフレームで倒したピン本数（投球ごと）。最終フレームは最大3投。 */
  rolls: number[];
  /** 投球ごとのガター判定。古いデータとの互換性のため省略可能。 */
  gutters?: boolean[];
};

export type BowlingFrameResult = {
  /** そのフレームまでの累積スコア。まだ確定していない（ボーナス待ち）なら null。 */
  cumulativeScore: number | null;
  isStrike: boolean;
  isSpare: boolean;
  isGutterFrame: boolean;
};

export type BowlingScoreState = {
  frames: BowlingFrameResult[];
  /** 現在確定している最新の累積スコア。 */
  total: number;
  /** ストライクになった投球数。最終フレームのボーナス投球も含む。 */
  strikeCount: number;
  spareCount: number;
  /** ガターになった投球数。 */
  gutterCount: number;
  /** 3連続ストライク（ターキー）が発生した回数。 */
  turkeyCount: number;
  isComplete: boolean;
};

export function isStrikeRoll(roll: number | undefined): boolean {
  return roll === PINS_PER_FRAME;
}

function frameIsStrike(frame: BowlingFrame): boolean {
  return frame.rolls[0] === PINS_PER_FRAME;
}

function frameIsSpare(frame: BowlingFrame): boolean {
  if (frameIsStrike(frame)) return false;
  const first = frame.rolls[0] ?? 0;
  const second = frame.rolls[1] ?? 0;
  return frame.rolls.length >= 2 && first + second === PINS_PER_FRAME;
}

function lastFrameStrikeRollCount(frame: BowlingFrame): number {
  const first = frame.rolls[0];
  const second = frame.rolls[1];
  const third = frame.rolls[2];
  let count = first === PINS_PER_FRAME ? 1 : 0;

  // 1投目がストライクなら2投目は新しい10本。スペア成立後の3投目も新しい10本。
  if (first === PINS_PER_FRAME && second === PINS_PER_FRAME) count += 1;
  if (
    third === PINS_PER_FRAME
    && (
      second === PINS_PER_FRAME
      || (first !== undefined && first < PINS_PER_FRAME && (first + (second ?? 0)) === PINS_PER_FRAME)
    )
  ) {
    count += 1;
  }

  return count;
}

function frameGutterCount(frame: BowlingFrame): number {
  if (frame.gutters && frame.gutters.length === frame.rolls.length) {
    return frame.gutters.filter(Boolean).length;
  }
  // 古い状態オブジェクトではガター投球を保持していなかったため、従来どおり
  // 「全投球0のフレーム」を1回として扱い、既存表示を壊さない。
  return frame.rolls.length > 0 && frame.rolls.every((roll) => roll === 0) ? 1 : 0;
}

/** そのフレームの投球が終わっているか（次フレームへ進めるか）を判定する。 */
export function isFrameDone(frame: BowlingFrame, frameIndex: number): boolean {
  const isLastFrame = frameIndex === BOWLING_FRAME_COUNT - 1;
  if (!isLastFrame) {
    if (frameIsStrike(frame)) return true;
    return frame.rolls.length >= 2;
  }

  // 最終フレーム：ストライク/スペアならボーナス投球で最大3投まで。
  if (frameIsStrike(frame)) return frame.rolls.length >= 3;
  if (frame.rolls.length >= 2 && (frame.rolls[0] ?? 0) + (frame.rolls[1] ?? 0) === PINS_PER_FRAME) {
    return frame.rolls.length >= 3;
  }
  return frame.rolls.length >= 2;
}

/** 次に投げるピンの残り本数（そのフレーム内で）。 */
export function pinsStandingForNextRoll(frame: BowlingFrame, frameIndex: number): number {
  const isLastFrame = frameIndex === BOWLING_FRAME_COUNT - 1;
  if (frame.rolls.length === 0) return PINS_PER_FRAME;

  if (!isLastFrame) {
    return PINS_PER_FRAME - (frame.rolls[0] ?? 0);
  }

  // 最終フレームはストライク/スペアのたびにピンが再セットされる。
  if (frame.rolls.length === 1) {
    return frameIsStrike(frame) ? PINS_PER_FRAME : PINS_PER_FRAME - (frame.rolls[0] ?? 0);
  }
  // 2投目のあと。スペア/ストライクなら3投目のためにフルリセット。
  const usedInSecondSet = frameIsStrike(frame) ? (frame.rolls[1] ?? 0) : 0;
  const secondRollTotal = (frame.rolls[0] ?? 0) + (frame.rolls[1] ?? 0);
  if (frameIsStrike(frame)) return PINS_PER_FRAME - usedInSecondSet;
  if (secondRollTotal === PINS_PER_FRAME) return PINS_PER_FRAME;
  return 0;
}

function isValidRoll(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 0 && value <= PINS_PER_FRAME;
}

/** APIで受け取った完了済みラウンドが、5フレームの合法な投球列かを検証する。 */
export function isValidCompletedBowlingFrames(value: unknown): value is BowlingFrame[] {
  if (!Array.isArray(value) || value.length !== BOWLING_FRAME_COUNT) return false;

  return value.every((rawFrame, index) => {
    if (!rawFrame || typeof rawFrame !== "object" || Array.isArray(rawFrame)) return false;
    const frame = rawFrame as { rolls?: unknown; gutters?: unknown };
    if (!Array.isArray(frame.rolls) || !frame.rolls.every(isValidRoll)) return false;
    if (
      frame.gutters !== undefined
      && (!Array.isArray(frame.gutters)
        || frame.gutters.length !== frame.rolls.length
        || !frame.gutters.every((gutter) => typeof gutter === "boolean"))
    ) {
      return false;
    }
    if (
      Array.isArray(frame.gutters)
      && frame.gutters.some((gutter, rollIndex) => gutter && frame.rolls![rollIndex] !== 0)
    ) {
      return false;
    }

    const rolls = frame.rolls as number[];
    const first = rolls[0];
    const second = rolls[1];
    const third = rolls[2];
    const isLast = index === BOWLING_FRAME_COUNT - 1;

    if (!isLast) {
      if (first === PINS_PER_FRAME) return rolls.length === 1;
      return rolls.length === 2
        && first !== undefined
        && second !== undefined
        && first + second <= PINS_PER_FRAME;
    }

    if (first === undefined || second === undefined) return false;
    if (first === PINS_PER_FRAME) {
      if (rolls.length !== 3 || third === undefined) return false;
      // 2投目がストライクでなければ、3投目は同じラックの残り本数まで。
      return second === PINS_PER_FRAME || second + third <= PINS_PER_FRAME;
    }

    if (first + second > PINS_PER_FRAME) return false;
    if (first + second === PINS_PER_FRAME) {
      return rolls.length === 3 && third !== undefined;
    }
    return rolls.length === 2;
  });
}

/**
 * フレーム配列からスコアを計算する。まだ全投球が終わっていなくても、
 * 確定できる範囲までのスコアを返す（ボーナス待ちのフレームは null）。
 */
export function calculateBowlingScore(frames: BowlingFrame[]): BowlingScoreState {
  const flatRolls: number[] = frames.flatMap((frame) => frame.rolls);
  const results: BowlingFrameResult[] = [];

  let strikeCount = 0;
  let spareCount = 0;
  let gutterCount = 0;
  let turkeyCount = 0;
  let runningStrikeStreak = 0;
  let rollCursor = 0;
  let cumulative = 0;
  let anyUnresolved = false;

  frames.forEach((frame, index) => {
    const isLastFrame = index === BOWLING_FRAME_COUNT - 1;
    const strike = frameIsStrike(frame);
    const spare = frameIsSpare(frame);
    const gutterFrame = frame.rolls.length > 0
      && (frame.gutters?.length === frame.rolls.length
        ? frame.gutters.every(Boolean)
        : frame.rolls.every((roll) => roll === 0));

    if (frame.rolls.length === 0) {
      results.push({ cumulativeScore: null, isStrike: false, isSpare: false, isGutterFrame: false });
      anyUnresolved = true;
      return;
    }

    strikeCount += isLastFrame ? lastFrameStrikeRollCount(frame) : (strike ? 1 : 0);
    if (spare) spareCount += 1;
    gutterCount += frameGutterCount(frame);

    if (strike) {
      runningStrikeStreak += 1;
      if (runningStrikeStreak >= 3) turkeyCount += 1;
    } else if (!isLastFrame || frame.rolls.length >= 1) {
      runningStrikeStreak = 0;
    }

    if (isLastFrame) {
      const frameTotal = frame.rolls.reduce((sum, roll) => sum + roll, 0);
      cumulative += frameTotal;
      rollCursor += frame.rolls.length;
      results.push({
        cumulativeScore: isFrameDone(frame, index) ? cumulative : null,
        isStrike: strike,
        isSpare: spare,
        isGutterFrame: gutterFrame,
      });
      if (!isFrameDone(frame, index)) anyUnresolved = true;
      return;
    }

    if (strike) {
      const bonus1 = flatRolls[rollCursor + 1];
      const bonus2 = flatRolls[rollCursor + 2];
      if (bonus1 === undefined || bonus2 === undefined) {
        results.push({ cumulativeScore: null, isStrike: true, isSpare: false, isGutterFrame: false });
        anyUnresolved = true;
        rollCursor += 1;
        return;
      }
      cumulative += PINS_PER_FRAME + bonus1 + bonus2;
      results.push({ cumulativeScore: cumulative, isStrike: true, isSpare: false, isGutterFrame: false });
      rollCursor += 1;
      return;
    }

    if (spare) {
      const bonus1 = flatRolls[rollCursor + 2];
      if (bonus1 === undefined) {
        results.push({ cumulativeScore: null, isStrike: false, isSpare: true, isGutterFrame: false });
        anyUnresolved = true;
        rollCursor += 2;
        return;
      }
      cumulative += PINS_PER_FRAME + bonus1;
      results.push({ cumulativeScore: cumulative, isStrike: false, isSpare: true, isGutterFrame: false });
      rollCursor += 2;
      return;
    }

    if (frame.rolls.length < 2) {
      results.push({ cumulativeScore: null, isStrike: false, isSpare: false, isGutterFrame: gutterFrame });
      anyUnresolved = true;
      rollCursor += frame.rolls.length;
      return;
    }

    const frameTotal = (frame.rolls[0] ?? 0) + (frame.rolls[1] ?? 0);
    cumulative += frameTotal;
    results.push({ cumulativeScore: cumulative, isStrike: false, isSpare: false, isGutterFrame: gutterFrame });
    rollCursor += 2;
  });

  const lastFrame = frames[BOWLING_FRAME_COUNT - 1];
  const isComplete = frames.length === BOWLING_FRAME_COUNT
    && lastFrame !== undefined
    && isFrameDone(lastFrame, BOWLING_FRAME_COUNT - 1)
    && !anyUnresolved;

  return {
    frames: results,
    total: cumulative,
    strikeCount,
    spareCount,
    gutterCount,
    turkeyCount,
    isComplete,
  };
}

export function createEmptyFrames(): BowlingFrame[] {
  return Array.from({ length: BOWLING_FRAME_COUNT }, () => ({ rolls: [], gutters: [] }));
}

/** 5フレーム制の理論上の満点（オールストライク）。 */
export const BOWLING_PERFECT_SCORE = (() => {
  const perfectFrames: BowlingFrame[] = Array.from({ length: BOWLING_FRAME_COUNT }, (_, index) =>
    index === BOWLING_FRAME_COUNT - 1 ? { rolls: [10, 10, 10] } : { rolls: [10] });
  return calculateBowlingScore(perfectFrames).total;
})();
