/**
 * わんこボウリングのスコア計算
 * =============================================================
 * 本来のボウリングと同じ10フレーム制：
 * - 1フレーム最大2投（ストライクなら1投で終了）
 * - ストライク・スペアのボーナス加算あり
 * - 最終（10）フレームだけストライク/スペア時にボーナス投球が発生する
 */

export const BOWLING_FRAME_COUNT = 10;
export const PINS_PER_FRAME = 10;

export type BowlingFrame = {
  /** そのフレームで倒したピン本数（投球ごと）。最終フレームは最大3投。 */
  rolls: number[];
  /** 投球ごとのガター判定。古いデータとの互換性のため省略可能。 */
  gutters?: boolean[];
};

/** フレーム → 投球 → 倒したピン番号の記録。ゴールデンピン判定をAPI側で再検証する。 */
export type BowlingPinFalls = number[][][];

export type GoldenPinTarget = {
  frameIndex: number;
  pinId: number;
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
  /** スペアが成立した回数。最終フレームの X 7 / のようなボーナスラックも含む。 */
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

function lastFrameSpareCount(frame: BowlingFrame): number {
  const first = frame.rolls[0];
  const second = frame.rolls[1];
  const third = frame.rolls[2];
  let count = 0;

  if (first !== undefined && first < PINS_PER_FRAME && second !== undefined && first + second === PINS_PER_FRAME) {
    count += 1;
  }
  if (
    first === PINS_PER_FRAME
    && second !== undefined
    && second < PINS_PER_FRAME
    && third !== undefined
    && second + third === PINS_PER_FRAME
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

/** その投球の前に10本が新しくセットされるかを返す。 */
export function isFreshRackRoll(frameIndex: number, priorRolls: number[]): boolean {
  if (frameIndex < BOWLING_FRAME_COUNT - 1) return priorRolls.length === 0;
  if (priorRolls.length === 0) return true;

  const first = priorRolls[0] ?? 0;
  const second = priorRolls[1] ?? 0;
  if (priorRolls.length === 1) return first === PINS_PER_FRAME;
  if (priorRolls.length === 2) {
    if (first === PINS_PER_FRAME) return second === PINS_PER_FRAME;
    return first + second === PINS_PER_FRAME;
  }
  return false;
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
  return typeof value === "number"
    && Number.isInteger(value)
    && value >= 0
    && value <= PINS_PER_FRAME;
}

/** APIで受け取った完了済みラウンドが、10フレームの合法な投球列かを検証する。 */
export function isValidCompletedBowlingFrames(value: unknown): value is BowlingFrame[] {
  if (!Array.isArray(value) || value.length !== BOWLING_FRAME_COUNT) return false;

  return value.every((rawFrame, index) => {
    if (!rawFrame || typeof rawFrame !== "object" || Array.isArray(rawFrame)) return false;
    const frame = rawFrame as { rolls?: unknown; gutters?: unknown };
    if (!Array.isArray(frame.rolls) || !frame.rolls.every(isValidRoll)) return false;
    const rolls = frame.rolls as number[];

    if (
      frame.gutters !== undefined
      && (!Array.isArray(frame.gutters)
        || frame.gutters.length !== rolls.length
        || !frame.gutters.every((gutter) => typeof gutter === "boolean"))
    ) {
      return false;
    }
    if (
      Array.isArray(frame.gutters)
      && frame.gutters.some((gutter, rollIndex) => gutter && rolls[rollIndex] !== 0)
    ) {
      return false;
    }

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
 * スコアの本数と、実際に倒したピン番号の並びが一致するかを検証する。
 * 同じラックのピンを二度倒す記録も拒否する。
 */
export function isValidBowlingPinFalls(
  frames: BowlingFrame[],
  value: unknown,
): value is BowlingPinFalls {
  if (!Array.isArray(value) || value.length !== BOWLING_FRAME_COUNT) return false;

  return value.every((rawFrameFalls, frameIndex) => {
    const frame = frames[frameIndex];
    if (!frame || !Array.isArray(rawFrameFalls) || rawFrameFalls.length !== frame.rolls.length) return false;

    let standing = new Set<number>();
    const priorRolls: number[] = [];

    for (let rollIndex = 0; rollIndex < rawFrameFalls.length; rollIndex += 1) {
      const rawPinIds = rawFrameFalls[rollIndex];
      const roll = frame.rolls[rollIndex];
      if (!Array.isArray(rawPinIds) || rawPinIds.length !== roll) return false;

      if (isFreshRackRoll(frameIndex, priorRolls)) {
        standing = new Set(Array.from({ length: PINS_PER_FRAME }, (_, index) => index + 1));
      }

      const uniqueIds = new Set<number>();
      for (const pinId of rawPinIds) {
        if (
          typeof pinId !== "number"
          || !Number.isInteger(pinId)
          || pinId < 1
          || pinId > PINS_PER_FRAME
          || uniqueIds.has(pinId)
          || !standing.has(pinId)
        ) {
          return false;
        }
        uniqueIds.add(pinId);
      }

      uniqueIds.forEach((pinId) => standing.delete(pinId));
      priorRolls.push(roll ?? 0);
    }

    return true;
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
    spareCount += isLastFrame ? lastFrameSpareCount(frame) : (spare ? 1 : 0);
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

/**
 * ラウンドごとに1回だけ訪れる「ボーナスチャンス」フレームを round_id から決める。
 * クライアントとサーバー（DB関数）が同じ規則で同じフレームを導けるよう、
 * 単純な文字コード合計 mod BOWLING_FRAME_COUNT にしている。
 */
export function getBonusFrameIndex(roundId: string): number {
  let sum = 0;
  for (let i = 0; i < roundId.length; i += 1) {
    sum = (sum + roundId.charCodeAt(i)) % BOWLING_FRAME_COUNT;
  }
  return sum;
}

/**
 * round_idから、10フレーム中ちょうど5フレームと各1本のゴールデンピンを決める。
 * 同じ関数をブラウザとAPIで使い、クライアントによる対象の差し替えを防ぐ。
 */
export function getGoldenPinTargets(roundId: string): GoldenPinTarget[] {
  let seed = 2166136261;
  for (let index = 0; index < roundId.length; index += 1) {
    seed ^= roundId.charCodeAt(index);
    seed = Math.imul(seed, 16777619) >>> 0;
  }
  if (seed === 0) seed = 0x9e3779b9;

  const nextRandom = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return seed / 0x100000000;
  };

  const frameIndexes = Array.from({ length: BOWLING_FRAME_COUNT }, (_, index) => index);
  for (let index = frameIndexes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextRandom() * (index + 1));
    [frameIndexes[index], frameIndexes[swapIndex]] = [frameIndexes[swapIndex]!, frameIndexes[index]!];
  }

  return frameIndexes
    .slice(0, 5)
    .sort((a, b) => a - b)
    .map((frameIndex) => ({
      frameIndex,
      pinId: 1 + Math.floor(nextRandom() * PINS_PER_FRAME),
    }));
}

export function countGoldenPinHits(roundId: string, pinFalls: BowlingPinFalls): number {
  return getGoldenPinTargets(roundId).reduce((hits, target) => {
    const wasKnocked = pinFalls[target.frameIndex]?.some((roll) => roll.includes(target.pinId)) === true;
    return hits + (wasKnocked ? 1 : 0);
  }, 0);
}

export function createEmptyFrames(): BowlingFrame[] {
  return Array.from({ length: BOWLING_FRAME_COUNT }, () => ({ rolls: [], gutters: [] }));
}

/** 10フレーム制の理論上の満点（オールストライク）= 300点。 */
export const BOWLING_PERFECT_SCORE = (() => {
  const perfectFrames: BowlingFrame[] = Array.from({ length: BOWLING_FRAME_COUNT }, (_, index) =>
    index === BOWLING_FRAME_COUNT - 1 ? { rolls: [10, 10, 10] } : { rolls: [10] });
  return calculateBowlingScore(perfectFrames).total;
})();
