/**
 * わんこボウリングのスコア計算
 * =============================================================
 * 本来のボウリングと同じ10フレーム制が土台：
 * - 1フレーム最大2投（ストライクなら1投で終了）
 * - ストライク・スペアのボーナス加算あり
 * - 最終（10）フレームだけストライク/スペア時にボーナス投球が発生する
 *
 * そこに「わんこルール」を足している（300点が上限ではない）：
 * - ビッグラック：ストライクの次のラックはピンが15本。15本ぜんぶならメガストライク
 * - フィーバー：ターキー（3連続ストライク）のあとのフレームは、そのフレームで倒した本数がもう一度入る（2倍）
 * - キングピン：10フレーム目はまんなか（5番）が大きなキングピン。倒すと残りが全部倒れて +20
 * - スプリット・チャレンジ：ラウンドごとに2フレーム、はじめから割れた形でピンが並ぶ。両方倒せば +30
 *
 * どのラックが何本か・どのフレームがスプリットかは round_id と投球の記録だけで決まるので、
 * ブラウザと API が同じ replayBowling() で同じ結果を出せる（クライアントの申告は信用しない）。
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

/* ===== わんこルール ===== */

/** ビッグラック（ストライクの次）のピン本数。並びは5段の三角形 */
export const BIG_RACK_PIN_COUNT = 15;
/** ピン番号の最大（ビッグラックの11〜15番は5段目） */
export const MAX_PIN_ID = BIG_RACK_PIN_COUNT;
/** 10フレーム目だけ出る、まんなかの大きなピン */
export const KING_PIN_ID = 5;
export const KING_PIN_BONUS = 20;
/** スプリット・チャレンジを両方（全部）倒したときのボーナス */
export const SPLIT_CLEAR_BONUS = 30;
/** 1ラウンドにスプリット・チャレンジが出るフレーム数 */
export const SPLIT_CHALLENGES_PER_ROUND = 2;

export type RackKind = "normal" | "big" | "split";

export type BowlingRack = {
  kind: RackKind;
  /** このラックに立っているピン番号 */
  pinIds: number[];
  /** キングピン（10フレーム目）。なければ null */
  kingPinId: number | null;
  /** スプリットの呼び名（「7-10」など） */
  splitName: string | null;
};

export type SplitChallenge = { frameIndex: number; pinIds: number[]; name: string };

const SPLIT_PATTERNS: { pinIds: number[]; name: string }[] = [
  { pinIds: [7, 10], name: "7-10" },
  { pinIds: [4, 6], name: "4-6" },
  { pinIds: [7, 9], name: "7-9" },
  { pinIds: [8, 10], name: "8-10" },
  { pinIds: [4, 7, 10], name: "4-7-10" },
  { pinIds: [6, 7, 10], name: "6-7-10" },
  { pinIds: [4, 6, 7, 10], name: "ビッグフォー" },
  { pinIds: [2, 10], name: "2-10" },
  { pinIds: [3, 7], name: "3-7" },
  { pinIds: [5, 7], name: "5-7" },
  { pinIds: [5, 10], name: "5-10" },
];

/** round_id から決まる乱数（ブラウザと API で同じ値になる） */
function seededRandom(roundId: string, salt: string): () => number {
  let seed = 2166136261;
  const text = `${salt}:${roundId}`;
  for (let index = 0; index < text.length; index += 1) {
    seed ^= text.charCodeAt(index);
    seed = Math.imul(seed, 16777619) >>> 0;
  }
  if (seed === 0) seed = 0x9e3779b9;
  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return seed / 0x100000000;
  };
}

/** スプリット・チャレンジのフレーム（2〜9フレーム目から2つ）と並び */
export function getSplitChallenges(roundId: string): SplitChallenge[] {
  const random = seededRandom(roundId, "split");
  const candidates = Array.from({ length: BOWLING_FRAME_COUNT - 2 }, (_, index) => index + 1);
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex]!, candidates[index]!];
  }
  return candidates
    .slice(0, SPLIT_CHALLENGES_PER_ROUND)
    .sort((a, b) => a - b)
    .map((frameIndex) => {
      const pattern = SPLIT_PATTERNS[Math.floor(random() * SPLIT_PATTERNS.length)]!;
      return { frameIndex, pinIds: [...pattern.pinIds], name: pattern.name };
    });
}

const range = (count: number) => Array.from({ length: count }, (_, index) => index + 1);

/**
 * 新しくセットするラックを決める。
 * - そのフレームの1投目で、スプリット・チャレンジのフレームなら割れた並び（ただし直前がストライクならビッグラックを優先）
 * - 直前の「新しいラックの1投目」がストライクならビッグラック（15本）
 * - 10フレーム目はキングピンつき
 */
function makeRack(frameIndex: number, rollIndex: number, afterStrike: boolean, splits: SplitChallenge[]): BowlingRack {
  const isLast = frameIndex === BOWLING_FRAME_COUNT - 1;
  const split = rollIndex === 0 && !afterStrike ? splits.find((item) => item.frameIndex === frameIndex) : undefined;
  if (split && !isLast) {
    return { kind: "split", pinIds: [...split.pinIds], kingPinId: null, splitName: split.name };
  }
  const kind: RackKind = afterStrike ? "big" : "normal";
  return {
    kind,
    pinIds: range(kind === "big" ? BIG_RACK_PIN_COUNT : PINS_PER_FRAME),
    kingPinId: isLast ? KING_PIN_ID : null,
    splitName: null,
  };
}

export type BowlingFrameResult = {
  /** そのフレームまでの累積スコア。まだ確定していない（ボーナス待ち）なら null。 */
  cumulativeScore: number | null;
  /** スコアボードに出す印（通常フレームは2マス、10フレーム目は3マス） */
  marks: string[];
  isStrike: boolean;
  isSpare: boolean;
  isGutterFrame: boolean;
  /** このフレームでセットされたラックの種類（投球順） */
  rackKinds: RackKind[];
  /** ターキーのあとのフィーバーフレームか */
  fever: boolean;
  /** 15本ぜんぶを1投で倒した回数 */
  megaStrikeCount: number;
  /** キングピンを倒した回数（10フレーム目） */
  kingHitCount: number;
  /** スプリット・チャレンジのフレームなら、全部倒せたか。ちがうフレームは null */
  splitCleared: boolean | null;
};

export type BowlingNextRoll = {
  frameIndex: number;
  rollIndex: number;
  /** この投球の前にピンが新しくセットされるか */
  freshRack: boolean;
  rack: BowlingRack;
  /** 投球前に立っているピン */
  standingPinIds: number[];
  /** このフレームがフィーバーか */
  fever: boolean;
};

export type BowlingScoreState = {
  /** 投球の記録がルールどおりか（API での検証用） */
  valid: boolean;
  frames: BowlingFrameResult[];
  /** 現在確定している最新の累積スコア。 */
  total: number;
  /** 確定していないフレームも、いまわかる分だけ足した見こみのスコア（画面の「現在スコア」） */
  liveTotal: number;
  /** ストライクになった投球数。最終フレームのボーナス投球も含む。 */
  strikeCount: number;
  /** スペアが成立した回数。最終フレームの X 7 / のようなボーナスラックも含む。 */
  spareCount: number;
  /** ガターになった投球数。 */
  gutterCount: number;
  /** 3連続ストライク（ターキー）が発生した回数。 */
  turkeyCount: number;
  megaStrikeCount: number;
  kingHitCount: number;
  splitMakeCount: number;
  feverFrameCount: number;
  isComplete: boolean;
  /** 次の投球（ゲームが終わっていれば null） */
  next: BowlingNextRoll | null;
};

type RollRecord = {
  frameIndex: number;
  value: number;
  fresh: boolean;
  cleared: boolean;
  rackSize: number;
  rackKind: RackKind;
  kingHit: boolean;
  gutter: boolean;
};

const markOf = (value: number) => (value === 0 ? "–" : String(value));

function invalidState(): BowlingScoreState {
  return {
    valid: false,
    frames: [],
    total: 0,
    liveTotal: 0,
    strikeCount: 0,
    spareCount: 0,
    gutterCount: 0,
    turkeyCount: 0,
    megaStrikeCount: 0,
    kingHitCount: 0,
    splitMakeCount: 0,
    feverFrameCount: 0,
    isComplete: false,
    next: null,
  };
}

/**
 * 投球の記録を最初からたどり、ルールどおりかを確かめながらスコアを計算する。
 * pinFalls（どのピンを倒したか）も合わせて確かめる。途中のゲームでも、確定した範囲までを返す。
 */
export function replayBowling(roundId: string, frames: BowlingFrame[], pinFalls: BowlingPinFalls): BowlingScoreState {
  if (!Array.isArray(frames) || frames.length !== BOWLING_FRAME_COUNT) return invalidState();
  if (!Array.isArray(pinFalls)) return invalidState();

  const splits = getSplitChallenges(roundId);
  const rolls: RollRecord[] = [];
  const perFrame: { fever: boolean; rackKinds: RackKind[]; split: boolean; done: boolean; records: RollRecord[] }[] = [];
  let afterStrike = false;
  let streak = 0;
  let turkeyCount = 0;
  let rack: BowlingRack | null = null;
  let standing = new Set<number>();
  let next: BowlingNextRoll | null = null;
  let reachedEnd = false;

  for (let frameIndex = 0; frameIndex < BOWLING_FRAME_COUNT; frameIndex += 1) {
    const frame = frames[frameIndex];
    const isLast = frameIndex === BOWLING_FRAME_COUNT - 1;
    if (!frame || !Array.isArray(frame.rolls)) return invalidState();
    const frameRolls = frame.rolls;
    const gutters = frame.gutters;
    const falls = pinFalls[frameIndex] ?? [];
    if (!Array.isArray(falls) || falls.length !== frameRolls.length) return invalidState();
    if (gutters !== undefined && (!Array.isArray(gutters) || (gutters.length !== 0 && gutters.length !== frameRolls.length))) {
      return invalidState();
    }

    // まだ投げていないフレームに記録があってはいけない
    if (reachedEnd) {
      if (frameRolls.length > 0) return invalidState();
      perFrame.push({ fever: false, rackKinds: [], split: false, done: false, records: [] });
      continue;
    }

    const fever = streak >= 3;
    const info = { fever, rackKinds: [] as RackKind[], split: false, done: false, records: [] as RollRecord[] };
    let clearedBefore = true;
    let clearedInFirstTwo = false;

    const maxRolls = isLast ? 3 : 2;
    if (frameRolls.length > maxRolls) return invalidState();

    for (let rollIndex = 0; rollIndex < frameRolls.length; rollIndex += 1) {
      const fresh = rollIndex === 0 || (isLast && clearedBefore);
      if (!isLast && rollIndex > 0 && clearedBefore) return invalidState(); // ストライク・スプリット成功のあとに投げている
      if (isLast && rollIndex === 2 && !clearedInFirstTwo) return invalidState(); // 10フレーム目の3投目は、ストライクかスペアのときだけ

      if (fresh) {
        rack = makeRack(frameIndex, rollIndex, afterStrike, splits);
        standing = new Set(rack.pinIds);
        info.rackKinds.push(rack.kind);
        if (rack.kind === "split") info.split = true;
      }
      if (!rack) return invalidState();

      const value = frameRolls[rollIndex];
      if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > standing.size) return invalidState();
      const gutter = gutters?.[rollIndex] === true;
      if (gutters && gutters.length > 0 && typeof gutters[rollIndex] !== "boolean") return invalidState();
      if (gutter && value !== 0) return invalidState();

      const pinIds = falls[rollIndex];
      if (!Array.isArray(pinIds) || pinIds.length !== value) return invalidState();
      const unique = new Set<number>();
      for (const pinId of pinIds) {
        if (typeof pinId !== "number" || !Number.isInteger(pinId) || unique.has(pinId) || !standing.has(pinId)) return invalidState();
        unique.add(pinId);
      }
      const kingHit = rack.kingPinId !== null && unique.has(rack.kingPinId);
      // キングピンを倒したら、残りのピンは全部倒れている
      if (kingHit && unique.size !== standing.size) return invalidState();
      unique.forEach((pinId) => standing.delete(pinId));

      const cleared = standing.size === 0;
      const record: RollRecord = {
        frameIndex,
        value,
        fresh,
        cleared,
        rackSize: rack.pinIds.length,
        rackKind: rack.kind,
        kingHit,
        gutter,
      };
      rolls.push(record);
      info.records.push(record);

      if (fresh) {
        const strike = cleared && rack.kind !== "split";
        afterStrike = strike;
        streak = strike ? streak + 1 : 0;
        if (strike && streak >= 3) turkeyCount += 1;
      }
      if (rollIndex < 2 && cleared) clearedInFirstTwo = true;
      clearedBefore = cleared;
    }

    const count = frameRolls.length;
    info.done = isLast
      ? count === 3 || (count === 2 && !clearedInFirstTwo)
      : count === 2 || (count === 1 && clearedBefore);
    perFrame.push(info);

    if (!info.done) {
      reachedEnd = true;
      const rollIndex = count;
      const fresh = rollIndex === 0 || (isLast && clearedBefore);
      const nextRack = fresh ? makeRack(frameIndex, rollIndex, afterStrike, splits) : rack!;
      next = {
        frameIndex,
        rollIndex,
        freshRack: fresh,
        rack: nextRack,
        standingPinIds: fresh ? [...nextRack.pinIds] : [...standing].sort((a, b) => a - b),
        fever,
      };
    }
  }

  // ===== 点数 =====
  const results: BowlingFrameResult[] = [];
  let cumulative = 0;
  let live = 0;
  let blocked = false;
  let strikeCount = 0;
  let spareCount = 0;
  let gutterCount = 0;
  let megaStrikeCount = 0;
  let kingHitCount = 0;
  let splitMakeCount = 0;
  let feverFrameCount = 0;
  let cursor = 0;

  perFrame.forEach((info, frameIndex) => {
    const isLast = frameIndex === BOWLING_FRAME_COUNT - 1;
    const records = info.records;
    const values = records.map((record) => record.value);
    const sum = values.reduce((total, value) => total + value, 0);
    const first = records[0];
    const strike = !isLast && first !== undefined && first.fresh && first.cleared && first.rackKind !== "split";
    const spare = !isLast && !strike && !info.split && records.length === 2 && records[1]!.cleared;
    const splitCleared = info.split ? records.some((record) => record.cleared) : null;
    const kingHits = records.filter((record) => record.kingHit).length;

    strikeCount += records.filter((record) => record.fresh && record.cleared && record.rackKind !== "split").length;
    spareCount += records.filter((record) => !record.fresh && record.cleared && record.rackKind !== "split").length;
    gutterCount += records.filter((record) => record.gutter).length;
    megaStrikeCount += records.filter((record) => record.fresh && record.cleared && record.rackKind === "big").length;
    kingHitCount += kingHits;
    if (splitCleared) splitMakeCount += 1;
    if (info.fever && records.length > 0) feverFrameCount += 1;

    // 印
    let marks: string[];
    if (isLast) {
      marks = [0, 1, 2].map((index) => {
        const record = records[index];
        if (!record) return "";
        if (record.cleared) return record.fresh ? "X" : "/";
        return markOf(record.value);
      });
    } else if (strike) {
      marks = ["", "X"];
    } else {
      marks = [0, 1].map((index) => {
        const record = records[index];
        if (!record) return "";
        if (record.cleared) return info.split ? "◎" : "/";
        return markOf(record.value);
      });
    }

    // そのフレームの点（ストライク・スペアは次の投球を待つ）
    let base: number | null = null;
    const followUp = (offset: number) => rolls[cursor + offset]?.value;
    if (records.length > 0 && info.done) {
      if (isLast) {
        base = sum;
      } else if (info.split) {
        base = sum + (splitCleared ? SPLIT_CLEAR_BONUS : 0);
      } else if (strike) {
        const b1 = followUp(1);
        const b2 = followUp(2);
        base = b1 !== undefined && b2 !== undefined ? first!.rackSize + b1 + b2 : null;
      } else if (spare) {
        const b1 = followUp(2);
        base = b1 !== undefined ? records[0]!.rackSize + b1 : null;
      } else {
        base = sum;
      }
    }
    const extras = (info.fever ? sum : 0) + kingHits * KING_PIN_BONUS;
    const frameScore = base === null ? null : base + extras;

    // 画面の「現在スコア」用：わかっている分だけ足す
    if (records.length > 0) {
      let partial: number;
      if (strike) partial = first!.rackSize + (followUp(1) ?? 0) + (followUp(2) ?? 0);
      else if (spare) partial = records[0]!.rackSize + (followUp(2) ?? 0);
      else partial = sum + (splitCleared ? SPLIT_CLEAR_BONUS : 0);
      live += partial + extras;
    }

    if (frameScore === null || blocked) {
      blocked = true;
    } else {
      cumulative += frameScore;
    }

    results.push({
      cumulativeScore: blocked ? null : cumulative,
      marks,
      isStrike: strike,
      isSpare: spare,
      isGutterFrame: records.length > 0 && records.every((record) => record.gutter),
      rackKinds: info.rackKinds,
      fever: info.fever && records.length > 0,
      megaStrikeCount: records.filter((record) => record.fresh && record.cleared && record.rackKind === "big").length,
      kingHitCount: kingHits,
      splitCleared,
    });
    cursor += records.length;
  });

  const isComplete = !reachedEnd && !blocked && perFrame.every((info) => info.done);

  return {
    valid: true,
    frames: results,
    total: cumulative,
    liveTotal: live,
    strikeCount,
    spareCount,
    gutterCount,
    turkeyCount,
    megaStrikeCount,
    kingHitCount,
    splitMakeCount,
    feverFrameCount,
    isComplete,
    next: isComplete ? null : next,
  };
}

/** 10フレームとも終わった、ルールどおりの記録か（API で使う） */
export function isValidCompletedBowling(roundId: string, frames: unknown, pinFalls: unknown): boolean {
  if (!Array.isArray(frames) || !Array.isArray(pinFalls)) return false;
  const state = replayBowling(roundId, frames as BowlingFrame[], pinFalls as BowlingPinFalls);
  return state.valid && state.isComplete;
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


