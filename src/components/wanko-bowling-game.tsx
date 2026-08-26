"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BallPicker } from "@/components/wanko-bowling/ball-picker";
import { Lane, type LaneRollResult } from "@/components/wanko-bowling/lane";
import { ScoreBoard } from "@/components/wanko-bowling/score-board";
import {
  BOWLING_FRAME_COUNT,
  calculateBowlingScore,
  createEmptyFrames,
  getBonusFrameIndex,
  isFrameDone,
  type BowlingFrame,
} from "@/lib/games/wanko-bowling-score";
import { getBowlingBallVisual, type OwnedBowlingBall } from "@/lib/games/wanko-bowling-balls";

type Phase = "select" | "playing" | "result";
type Banner = "スペア！" | "ストライク！" | "ターキー！" | "ボーナスストライク！" | null;

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
  const [newGameSignal, setNewGameSignal] = useState(0);
  const [rollLocked, setRollLocked] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [shake, setShake] = useState(false);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [earnedCoins, setEarnedCoins] = useState<number | null>(null);
  const [rewardPending, setRewardPending] = useState(false);
  const [rewardError, setRewardError] = useState<string | null>(null);
  const [lastRollPins, setLastRollPins] = useState<number | null>(null);
  const [bonusFrameIndex, setBonusFrameIndex] = useState(() => getBonusFrameIndex(newRoundId()));
  const [bonusAchieved, setBonusAchieved] = useState(false);

  const framesRef = useRef<BowlingFrame[]>(initialFrames);
  const frameIndexRef = useRef(0);
  const rollLockedRef = useRef(false);
  const streakRef = useRef(0);
  const submittedRef = useRef(false);
  const roundIdRef = useRef(newRoundId());
  const bonusFrameIndexRef = useRef(bonusFrameIndex);
  const bonusAchievedRef = useRef(false);
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
    const nextBonusFrameIndex = getBonusFrameIndex(roundIdRef.current);
    bonusFrameIndexRef.current = nextBonusFrameIndex;
    bonusAchievedRef.current = false;
    setBonusFrameIndex(nextBonusFrameIndex);
    setBonusAchieved(false);
    setBanner(null);
    setEarnedCoins(null);
    setRewardPending(false);
    setRewardError(null);
    setIsNewBest(false);
    setLastRollPins(null);
    setLaneResetSignal((value) => value + 1);
    setNewGameSignal((value) => value + 1);
    setRollLock(false);
    document.getElementById("wanko-bowling-scroll")?.scrollTo({ top: 0, behavior: "auto" });
    setPhase("playing");
  }, [commitFrameIndex, commitFrames, setRollLock]);

  const submitResult = useCallback(async (finalScore: number, finalFrames: BowlingFrame[]) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setRewardPending(true);
    setRewardError(null);

    try {
      const response = await fetch("/api/coins/wanko-bowling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId: roundIdRef.current,
          frames: finalFrames,
          bonusHit: bonusAchievedRef.current,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { coins?: number; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "コインを受け取れませんでした。");
      setEarnedCoins(typeof payload?.coins === "number" ? payload.coins : 0);
      window.dispatchEvent(new Event("wanko-bowling-ranking-refresh"));
    } catch (error) {
      setRewardError(error instanceof Error ? error.message : "コインを受け取れませんでした。");
    } finally {
      setRewardPending(false);
    }

    setBestScore((prev) => {
      const newBest = prev === null || finalScore > prev;
      setIsNewBest(newBest);
      return newBest ? finalScore : prev;
    });
    void loadBestScore();
  }, [loadBestScore]);

  const retryReward = useCallback(() => {
    submittedRef.current = false;
    void submitResult(score.total, framesRef.current);
  }, [score.total, submitResult]);

  const handleRoll = useCallback((result: LaneRollResult) => {
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
    const roll = result.knockedIds.length;
    const isGutterRoll = result.isGutter && roll === 0;

    setLastRollPins(roll);

    const newFrame: BowlingFrame = {
      rolls: [...priorRolls, roll],
      gutters: [...priorGutters, isGutterRoll],
    };
    const done = isFrameDone(newFrame, currentFrameIndex);
    const nextFrames = baseFrames.map((frame, index) =>
      index === currentFrameIndex ? newFrame : frame,
    );

    commitFrames(nextFrames);

    if (freshRack) {
      streakRef.current = roll === 10 ? streakRef.current + 1 : 0;
    }

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

    const isBonusFrame = currentFrameIndex === bonusFrameIndexRef.current;
    if (roll === 10 && freshRack) {
      if (isBonusFrame && priorRolls.length === 0 && !bonusAchievedRef.current) {
        bonusAchievedRef.current = true;
        setBonusAchieved(true);
        nextBanner = "ボーナスストライク！";
      } else {
        nextBanner = streakRef.current >= 3 ? "ターキー！" : "ストライク！";
      }
      setShake(true);
      window.setTimeout(() => setShake(false), 450);
    } else if (spareCompleted) {
      nextBanner = "スペア！";
    }

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
    }, resumeDelay);
  }, [commitFrameIndex, commitFrames, setRollLock, submitResult]);

  const goToRanking = useCallback(() => {
    window.dispatchEvent(new Event("wanko-bowling-ranking-refresh"));
    document.getElementById(rankingSectionIdRef.current)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (phase === "select") {
    return (
      <div className="h-full overflow-y-auto overscroll-none py-1">
        <BallPicker
          ownedBalls={ownedBalls}
          selectedId={selectedBallId}
          onSelect={setSelectedBallId}
          onConfirm={startGame}
        />
      </div>
    );
  }

  if (phase === "result") {
    return (
      <div className="h-full overflow-y-auto overscroll-none py-1">
        <section className="overflow-hidden rounded-[24px] border border-[#26394d] bg-[#09131e] text-white shadow-[0_20px_55px_rgba(0,0,0,0.42)]">
          <div className="relative overflow-hidden border-b border-white/10 px-4 py-6 text-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(84,216,255,0.24),transparent_58%)]" />
            <div className="relative">
              <p className="text-[9px] font-black tracking-[0.18em] text-[#54d8ff]">最終結果</p>
              <p className="mt-1 text-base font-black tracking-wide text-white/75">全10フレーム終了</p>
              <p className="mt-4 text-[10px] font-black tracking-[0.12em] text-white/40">最終スコア</p>
              <p className="mt-0.5 font-mono text-[64px] font-black leading-none tracking-[-0.08em] text-white drop-shadow-[0_0_22px_rgba(84,216,255,0.4)]">
                {score.total}
              </p>
              {isNewBest ? (
                <p className="mx-auto mt-3 w-fit rounded-full border border-[#ffc95c]/50 bg-[#ffc95c]/10 px-4 py-1 text-[10px] font-black tracking-[0.18em] text-[#ffc95c]">
                  自己ベスト更新
                </p>
              ) : (
                <p className="mt-3 text-[10px] font-bold text-white/45">
                  自己ベスト <span className="ml-1 font-mono text-white/80">{bestScore ?? score.total}</span>
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 p-4 text-center">
            <div className="rounded-[14px] border border-white/10 bg-white/[0.04] px-2 py-3">
              <p className="font-mono text-2xl font-black tabular-nums text-[#54d8ff]">{score.strikeCount}</p>
              <p className="mt-0.5 text-[8px] font-black tracking-[0.08em] text-white/40">ストライク</p>
            </div>
            <div className="rounded-[14px] border border-white/10 bg-white/[0.04] px-2 py-3">
              <p className="font-mono text-2xl font-black tabular-nums text-[#ffc95c]">{score.spareCount}</p>
              <p className="mt-0.5 text-[8px] font-black tracking-[0.08em] text-white/40">スペア</p>
            </div>
            <div className="rounded-[14px] border border-white/10 bg-white/[0.04] px-2 py-3">
              <p className="font-mono text-2xl font-black tabular-nums text-white">{score.gutterCount}</p>
              <p className="mt-0.5 text-[8px] font-black tracking-[0.08em] text-white/40">ガター</p>
            </div>
          </div>

          {rewardPending ? (
            <p className="px-4 pb-2 text-center text-xs font-bold text-white/65" aria-live="polite">
              スコアを保存してコインを受け取り中…
            </p>
          ) : rewardError ? (
            <div className="mx-4 mb-2 rounded-[14px] border border-red-400/35 bg-red-500/10 px-3 py-3 text-center" role="alert">
              <p className="text-[11px] font-bold text-red-200">{rewardError}</p>
              <button
                type="button"
                onClick={retryReward}
                className="mt-2 rounded-full bg-red-600 px-4 py-2 text-[11px] font-black text-white active:scale-[0.98]"
              >
                コイン受取を再試行
              </button>
            </div>
          ) : earnedCoins !== null ? (
            <div className="mx-4 mb-2 rounded-[14px] border border-[#ffc95c]/30 bg-[#ffc95c]/10 px-4 py-3 text-center">
              <p className="text-[8px] font-black tracking-[0.12em] text-[#ffc95c]/70">獲得コイン</p>
              <p className="mt-0.5 font-mono text-xl font-black text-[#ffc95c]">
                +{earnedCoins.toLocaleString("ja-JP")} コイン
              </p>
              {bonusAchieved ? (
                <p className="mt-1 text-[9px] font-black text-[#ffc95c]">ボーナスチャンス成功・獲得量2倍</p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2 p-4 pt-2">
            <button
              type="button"
              onClick={startGame}
              disabled={rewardPending}
              className="pressable block w-full rounded-[14px] bg-gradient-to-r from-[#12aee0] to-[#54d8ff] py-3.5 text-center text-sm font-black text-[#04101a] shadow-[0_8px_24px_rgba(34,190,235,0.25)] active:scale-[0.98] disabled:opacity-45"
            >
              もう一度プレイ
            </button>
            <button
              type="button"
              onClick={() => setPhase("select")}
              className="pressable block w-full rounded-[14px] border border-white/15 bg-white/[0.04] py-3 text-center text-sm font-black text-white/80 active:scale-[0.98]"
            >
              ボールを変える
            </button>
            <button
              type="button"
              onClick={goToRanking}
              className="pressable block w-full rounded-[14px] border border-white/15 bg-white/[0.04] py-3 text-center text-sm font-black text-white/80 active:scale-[0.98]"
            >
              ランキングを見る
            </button>
            <Link
              href="/games"
              className="pressable block w-full rounded-[14px] border border-white/15 bg-white/[0.04] py-3 text-center text-sm font-black text-white/80 active:scale-[0.98]"
            >
              ゲーム一覧へ戻る
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <section className={`relative flex h-full min-h-0 flex-col overflow-hidden ${shake ? "wanko-bowl-shake" : ""}`}>
      <div className="pointer-events-none relative z-30 shrink-0 [&>div]:!mx-0 [&>div]:!mt-0 [&>div]:!w-full [&>div]:!rounded-b-none [&>div]:!shadow-none">
        <ScoreBoard
          frames={frames}
          score={score}
          currentFrameIndex={frameIndex}
          liveScore={liveScore}
          bestScore={bestScore}
          lastRollPins={lastRollPins}
          bonusFrameIndex={bonusFrameIndex}
          bonusAchieved={bonusAchieved}
        />
      </div>

      <div className="relative -mt-px min-h-0 flex-1 [&>div]:!rounded-t-none">
        <Lane
          ballVisual={ballVisual}
          resetSignal={laneResetSignal}
          newGameSignal={newGameSignal}
          active={!rollLocked}
          onRoll={handleRoll}
        />

        {banner ? (
          <div className="pointer-events-none absolute left-1/2 top-[35%] z-40 -translate-x-1/2">
            <p className="wanko-bowl-banner whitespace-nowrap bg-gradient-to-b from-white via-[#ffc95c] to-[#ef7b18] bg-clip-text text-[clamp(2.2rem,12vw,4.2rem)] font-black italic leading-none text-transparent drop-shadow-[0_4px_0_rgba(49,19,0,0.85)]">
              {banner}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
