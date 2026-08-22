"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BallPicker } from "@/components/wanko-bowling/ball-picker";
import { DogReaction, type DogReactionKind } from "@/components/wanko-bowling/dog-reaction";
import { Lane, type LaneRollResult } from "@/components/wanko-bowling/lane";
import { ScoreBoard } from "@/components/wanko-bowling/score-board";
import {
  BOWLING_FRAME_COUNT,
  calculateBowlingScore,
  createEmptyFrames,
  isFrameDone,
  type BowlingFrame,
} from "@/lib/games/wanko-bowling-score";
import { getBowlingBallVisual, type OwnedBowlingBall } from "@/lib/games/wanko-bowling-balls";

type Phase = "select" | "playing" | "result";
type Banner = "SPARE!!" | "STRIKE!!" | "TURKEY!!" | null;

function isFreshRackRoll(frameIndex: number, priorRolls: number[]): boolean {
  if (frameIndex < BOWLING_FRAME_COUNT - 1) return priorRolls.length === 0;
  if (priorRolls.length === 0) return true;

  const first = priorRolls[0] ?? 0;
  const second = priorRolls[1] ?? 0;
  if (priorRolls.length === 1) return first === 10;
  if (priorRolls.length === 2) {
    if (first === 10) return second === 10;
    return first + second === 10;
  }
  return false;
}

function calculateLiveBowlingScore(frames: BowlingFrame[]): number {
  const flatRolls = frames.flatMap((frame) => frame.rolls);
  let cursor = 0;
  let total = 0;

  frames.forEach((frame, index) => {
    if (frame.rolls.length === 0) return;
    const isLast = index === BOWLING_FRAME_COUNT - 1;

    if (isLast) {
      total += frame.rolls.reduce((sum, roll) => sum + roll, 0);
      cursor += frame.rolls.length;
      return;
    }

    const first = frame.rolls[0] ?? 0;
    const second = frame.rolls[1];

    if (first === 10) {
      total += 10 + (flatRolls[cursor + 1] ?? 0) + (flatRolls[cursor + 2] ?? 0);
      cursor += 1;
      return;
    }

    if (second !== undefined && first + second === 10) {
      total += 10 + (flatRolls[cursor + 2] ?? 0);
      cursor += 2;
      return;
    }

    total += frame.rolls.reduce((sum, roll) => sum + roll, 0);
    cursor += frame.rolls.length;
  });

  return total;
}

function newRoundId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `round-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function WankoBowlingGame({ ownedBalls }: { ownedBalls: OwnedBowlingBall[] }) {
  const initialFrames = useMemo(() => createEmptyFrames(), []);
  const [phase, setPhase] = useState<Phase>("select");
  const [selectedBallId, setSelectedBallId] = useState<string>(
    () => ownedBalls[0]?.id ?? "default_paw_ball",
  );
  const [frames, setFrames] = useState<BowlingFrame[]>(initialFrames);
  const [frameIndex, setFrameIndex] = useState(0);
  const [laneResetSignal, setLaneResetSignal] = useState(0);
  const [rollLocked, setRollLocked] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [reaction, setReaction] = useState<DogReactionKind>("idle");
  const [shake, setShake] = useState(false);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [earnedCoins, setEarnedCoins] = useState<number | null>(null);
  const [lastRollPins, setLastRollPins] = useState<number | null>(null);

  // 投球処理の正本はrefに置く。Reactの再描画を待たずに次投へ確実に引き継ぐ。
  const framesRef = useRef<BowlingFrame[]>(initialFrames);
  const frameIndexRef = useRef(0);
  const rollLockedRef = useRef(false);
  const streakRef = useRef(0);
  const submittedRef = useRef(false);
  const roundIdRef = useRef(newRoundId());
  const rankingSectionIdRef = useRef("wanko-bowling-ranking");

  const score = useMemo(() => calculateBowlingScore(frames), [frames]);
  const liveScore = useMemo(() => calculateLiveBowlingScore(frames), [frames]);
  const ballVisual = useMemo(() => getBowlingBallVisual(selectedBallId), [selectedBallId]);

  const commitFrames = useCallback((nextFrames: BowlingFrame[]) => {
    framesRef.current = nextFrames;
    setFrames(nextFrames);
  }, []);

  const commitFrameIndex = useCallback((nextIndex: number) => {
    frameIndexRef.current = nextIndex;
    setFrameIndex(nextIndex);
  }, []);

  const setRollLock = useCallback((locked: boolean) => {
    rollLockedRef.current = locked;
    setRollLocked(locked);
  }, []);

  const loadBestScore = useCallback(async () => {
    try {
      const response = await fetch("/api/games/wanko-bowling/ranking?period=best", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        entries?: { isMe: boolean; score: number }[];
      } | null;
      const mine = payload?.entries?.find((entry) => entry.isMe);
      if (mine) setBestScore(mine.score);
    } catch {
      // ランキング取得失敗はプレイを止めない。
    }
  }, []);

  useEffect(() => {
    void loadBestScore();
  }, [loadBestScore]);

  const startGame = useCallback(() => {
    const emptyFrames = createEmptyFrames();
    commitFrames(emptyFrames);
    commitFrameIndex(0);
    streakRef.current = 0;
    submittedRef.current = false;
    roundIdRef.current = newRoundId();
    setBanner(null);
    setReaction("idle");
    setEarnedCoins(null);
    setIsNewBest(false);
    setLastRollPins(null);
    setLaneResetSignal((value) => value + 1);
    setRollLock(false);
    setPhase("playing");
  }, [commitFrameIndex, commitFrames, setRollLock]);

  const submitResult = useCallback(async (finalScore: number, finalFrames: BowlingFrame[]) => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    try {
      const response = await fetch("/api/coins/wanko-bowling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId: roundIdRef.current,
          frames: finalFrames,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { coins?: number } | null;
      if (response.ok) {
        if (typeof payload?.coins === "number") setEarnedCoins(payload.coins);
        window.dispatchEvent(new Event("wanko-bowling-ranking-refresh"));
      }
    } catch {
      // コイン付与失敗でも結果表示は継続する。
    }

    setBestScore((prev) => {
      const newBest = prev === null || finalScore > prev;
      setIsNewBest(newBest);
      return newBest ? finalScore : prev;
    });
    void loadBestScore();
  }, [loadBestScore]);

  const handleRoll = useCallback((result: LaneRollResult) => {
    // 同一投球のfinishが重複しても二重加算しない。
    if (rollLockedRef.current) return;
    setRollLock(true);

    const currentFrameIndex = frameIndexRef.current;
    const baseFrames = framesRef.current;
    const isLastFrame = currentFrameIndex === BOWLING_FRAME_COUNT - 1;
    const currentFrame = baseFrames[currentFrameIndex] ?? { rolls: [], gutters: [] };
    const priorRolls = [...currentFrame.rolls];
    const priorGutters = currentFrame.gutters
      ? [...currentFrame.gutters]
      : Array.from({ length: priorRolls.length }, () => false);
    const freshRack = isFreshRackRoll(currentFrameIndex, priorRolls);
    const roll = result.isGutter ? 0 : result.knockedIds.length;

    setLastRollPins(roll);

    const newFrame: BowlingFrame = {
      rolls: [...priorRolls, roll],
      gutters: [...priorGutters, result.isGutter],
    };
    const done = isFrameDone(newFrame, currentFrameIndex);
    const nextFrames = baseFrames.map((frame, index) =>
      index === currentFrameIndex ? newFrame : frame,
    );

    // ここでrefを先に更新するのが重要。2投目は必ず1投目を含む配列を読む。
    commitFrames(nextFrames);

    if (freshRack) {
      streakRef.current = roll === 10 ? streakRef.current + 1 : 0;
    }

    let nextReaction: DogReactionKind = "idle";
    let nextBanner: Banner = null;
    const newRolls = newFrame.rolls;
    const regularSpareCompleted =
      newRolls.length === 2
      && (newRolls[0] ?? 0) < 10
      && (newRolls[0] ?? 0) + (newRolls[1] ?? 0) === 10;
    const finalStrikeRackSpareCompleted =
      isLastFrame
      && newRolls.length === 3
      && (newRolls[0] ?? 0) === 10
      && (newRolls[1] ?? 0) < 10
      && (newRolls[1] ?? 0) + (newRolls[2] ?? 0) === 10;
    const spareCompleted = regularSpareCompleted || finalStrikeRackSpareCompleted;

    if (result.isGutter || roll === 0) {
      nextReaction = "sad";
    } else if (roll === 10 && freshRack) {
      if (streakRef.current >= 3) {
        nextBanner = "TURKEY!!";
        nextReaction = "turkey";
      } else {
        nextBanner = "STRIKE!!";
        nextReaction = "strike";
      }
      setShake(true);
      window.setTimeout(() => setShake(false), 450);
    } else if (spareCompleted) {
      nextBanner = "SPARE!!";
      nextReaction = "spare";
    } else if (roll >= 6) {
      nextReaction = "veryHappy";
    } else if (roll >= 1) {
      nextReaction = "happy";
    } else {
      nextReaction = "sad";
    }

    setReaction(nextReaction);
    setBanner(nextBanner);
    if (nextBanner) window.setTimeout(() => setBanner(null), 1500);

    let needsFreshRackNext = false;
    if (isLastFrame) {
      if (!done && ((freshRack && roll === 10) || regularSpareCompleted)) {
        needsFreshRackNext = true;
      }
    } else {
      needsFreshRackNext = done;
    }

    const resumeDelay = nextBanner ? 900 : 550;

    window.setTimeout(() => {
      if (needsFreshRackNext) setLaneResetSignal((value) => value + 1);

      if (!isLastFrame && done) {
        commitFrameIndex(currentFrameIndex + 1);
      }

      if (isLastFrame && done) {
        const finalState = calculateBowlingScore(nextFrames);
        void submitResult(finalState.total, nextFrames);
        window.setTimeout(() => setPhase("result"), 500);
        return;
      }

      setRollLock(false);
      setReaction("idle");
    }, resumeDelay);
  }, [commitFrameIndex, commitFrames, setRollLock, submitResult]);

  const goToRanking = useCallback(() => {
    window.dispatchEvent(new Event("wanko-bowling-ranking-refresh"));
    document.getElementById(rankingSectionIdRef.current)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (phase === "select") {
    return (
      <BallPicker
        ownedBalls={ownedBalls}
        selectedId={selectedBallId}
        onSelect={setSelectedBallId}
        onConfirm={startGame}
      />
    );
  }

  if (phase === "result") {
    return (
      <section className="rough-card overflow-hidden">
        <div className="bg-leaf-soft px-4 py-7 text-center">
          <p className="text-[10px] font-black tracking-[0.16em] text-leaf-deep">GAME CLEAR!</p>
          <p className="mt-1 text-2xl font-black text-ink">5フレーム おつかれさま！</p>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4">
          <div className="rounded-[18px] bg-paper-deep px-3 py-4 text-center">
            <p className="text-[9px] font-black tracking-wide text-ink-faint">SCORE</p>
            <p className="mt-1 text-3xl font-black tabular-nums text-ink">{score.total}</p>
          </div>
          <div className="rounded-[18px] bg-paper-deep px-3 py-4 text-center">
            <p className="text-[9px] font-black tracking-wide text-ink-faint">
              {isNewBest ? "NEW BEST!" : "ベストスコア"}
            </p>
            <p className={`mt-1 text-3xl font-black tabular-nums ${isNewBest ? "text-[#c9902f]" : "text-ink"}`}>
              {bestScore ?? score.total}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 px-4 pb-2 text-center">
          <div className="rounded-[14px] bg-card px-2 py-2.5">
            <p className="text-lg font-black tabular-nums text-ink">{score.strikeCount}</p>
            <p className="text-[9px] font-bold text-ink-faint">STRIKE</p>
          </div>
          <div className="rounded-[14px] bg-card px-2 py-2.5">
            <p className="text-lg font-black tabular-nums text-ink">{score.spareCount}</p>
            <p className="text-[9px] font-bold text-ink-faint">SPARE</p>
          </div>
          <div className="rounded-[14px] bg-card px-2 py-2.5">
            <p className="text-lg font-black tabular-nums text-ink">{score.gutterCount}</p>
            <p className="text-[9px] font-bold text-ink-faint">GUTTER</p>
          </div>
        </div>

        {earnedCoins !== null ? (
          <p className="px-4 pb-2 text-center text-xs font-bold text-ink-soft">
            +{earnedCoins.toLocaleString("ja-JP")} コイン獲得！
          </p>
        ) : null}

        <div className="space-y-2 p-4 pt-2">
          <button
            type="button"
            onClick={startGame}
            className="btn pressable block w-full rounded-full bg-leaf-deep py-3 text-center text-sm font-black text-white active:scale-[0.98]"
          >
            もう一回あそぶ
          </button>
          <button
            type="button"
            onClick={() => setPhase("select")}
            className="pressable block w-full rounded-full border border-line bg-card py-3 text-center text-sm font-black text-ink-soft active:scale-[0.98]"
          >
            ボールを変える
          </button>
          <button
            type="button"
            onClick={goToRanking}
            className="pressable block w-full rounded-full border border-line bg-card py-3 text-center text-sm font-black text-ink-soft active:scale-[0.98]"
          >
            ランキングを見る
          </button>
          <Link
            href="/games"
            className="pressable block w-full rounded-full border border-line bg-card py-3 text-center text-sm font-black text-ink-soft active:scale-[0.98]"
          >
            ゲーム一覧へ戻る
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={`rough-card overflow-hidden ${shake ? "wanko-bowl-shake" : ""}`}>
      <div className="border-b border-line px-4 py-2.5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[9px] font-black tracking-[0.14em] text-leaf-deep">LIVE SCORE</p>
            <p className="mt-0.5 text-[10px] font-bold text-ink-faint">確定 {score.total}</p>
          </div>
          <div className="flex items-end gap-3">
            {lastRollPins !== null ? (
              <p className="pb-0.5 text-[10px] font-black text-ink-soft">この投球 +{lastRollPins}本</p>
            ) : null}
            <p className="text-3xl font-black tabular-nums leading-none text-ink">{liveScore}</p>
          </div>
        </div>
        <div className="mt-2">
          <ScoreBoard frames={frames} score={score} currentFrameIndex={frameIndex} />
        </div>
      </div>

      <div className="relative px-3 pb-3 pt-3">
        <Lane ballVisual={ballVisual} resetSignal={laneResetSignal} active={!rollLocked} onRoll={handleRoll} />

        {banner ? (
          <div className="pointer-events-none absolute left-1/2 top-[38%] z-20 -translate-x-1/2">
            <p className="wanko-bowl-banner whitespace-nowrap text-[clamp(2.4rem,13vw,4.5rem)] font-black leading-none text-[#a8442f] drop-shadow-[0_3px_0_rgba(255,255,255,0.7)]">
              {banner}
            </p>
          </div>
        ) : null}
      </div>

      <div className="border-t border-line px-4 py-3">
        <DogReaction reaction={reaction} />
      </div>
    </section>
  );
}
