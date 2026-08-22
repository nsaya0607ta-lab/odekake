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

function isChainRoll(frameIndex: number, priorRolls: number[]): boolean {
  if (frameIndex < BOWLING_FRAME_COUNT - 1) return priorRolls.length === 0;
  return priorRolls.every((roll) => roll === 10);
}

function newRoundId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `round-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function WankoBowlingGame({ ownedBalls }: { ownedBalls: OwnedBowlingBall[] }) {
  const [phase, setPhase] = useState<Phase>("select");
  const [selectedBallId, setSelectedBallId] = useState<string>(
    () => ownedBalls[0]?.id ?? "default_paw_ball",
  );
  const [frames, setFrames] = useState<BowlingFrame[]>(() => createEmptyFrames());
  const [frameIndex, setFrameIndex] = useState(0);
  const [laneResetSignal, setLaneResetSignal] = useState(0);
  const [rollLocked, setRollLocked] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [reaction, setReaction] = useState<DogReactionKind>("idle");
  const [shake, setShake] = useState(false);
  const [roundId, setRoundId] = useState(() => newRoundId());
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [earnedCoins, setEarnedCoins] = useState<number | null>(null);
  const rankingSectionIdRef = useRef("wanko-bowling-ranking");

  const framesRef = useRef(frames);
  framesRef.current = frames;
  const frameIndexRef = useRef(frameIndex);
  frameIndexRef.current = frameIndex;
  const streakRef = useRef(0);
  const submittedRef = useRef(false);

  const score = useMemo(() => calculateBowlingScore(frames), [frames]);
  const ballVisual = useMemo(() => getBowlingBallVisual(selectedBallId), [selectedBallId]);

  const loadBestScore = useCallback(async () => {
    try {
      const response = await fetch("/api/games/wanko-bowling/ranking?period=best", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        entries?: { isMe: boolean; score: number }[];
      } | null;
      const mine = payload?.entries?.find((entry) => entry.isMe);
      if (mine) setBestScore(mine.score);
    } catch {
      // ランキングが読み込めなくても、通常プレイには影響させない
    }
  }, []);

  useEffect(() => {
    void loadBestScore();
  }, [loadBestScore]);

  const startGame = useCallback(() => {
    setFrames(createEmptyFrames());
    setFrameIndex(0);
    streakRef.current = 0;
    submittedRef.current = false;
    setBanner(null);
    setReaction("idle");
    setEarnedCoins(null);
    setIsNewBest(false);
    setRoundId(newRoundId());
    setLaneResetSignal((value) => value + 1);
    setRollLocked(false);
    setPhase("playing");
  }, []);

  const submitResult = useCallback(async (finalScore: number) => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    const finalState = calculateBowlingScore(framesRef.current);
    try {
      const response = await fetch("/api/coins/wanko-bowling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId,
          score: finalScore,
          strikeCount: finalState.strikeCount,
          spareCount: finalState.spareCount,
          gutterCount: finalState.gutterCount,
          frameCount: BOWLING_FRAME_COUNT,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { coins?: number } | null;
      if (response.ok && typeof payload?.coins === "number") setEarnedCoins(payload.coins);
    } catch {
      // コイン付与に失敗しても、結果表示自体は継続する
    }

    setBestScore((prev) => {
      const newBest = prev === null || finalScore > prev;
      setIsNewBest(newBest);
      return newBest ? finalScore : prev;
    });
    void loadBestScore();
  }, [roundId, loadBestScore]);

  const handleRoll = useCallback((result: LaneRollResult) => {
    const currentFrameIndex = frameIndexRef.current;
    const isLastFrame = currentFrameIndex === BOWLING_FRAME_COUNT - 1;
    const priorRolls = framesRef.current[currentFrameIndex]?.rolls ?? [];
    const chain = isChainRoll(currentFrameIndex, priorRolls);
    const roll = result.isGutter ? 0 : result.knockedIds.length;
    const newRolls = [...priorRolls, roll];
    const newFrame: BowlingFrame = { rolls: newRolls };
    const done = isFrameDone(newFrame, currentFrameIndex);

    const nextFrames = framesRef.current.map((frame, index) => (index === currentFrameIndex ? newFrame : frame));
    setFrames(nextFrames);

    if (chain) {
      streakRef.current = roll === 10 ? streakRef.current + 1 : 0;
    }

    setRollLocked(true);

    let nextReaction: DogReactionKind = "idle";
    let nextBanner: Banner = null;

    const spareCompleted =
      newRolls.length === 2 && (newRolls[0] ?? 0) < 10 && (newRolls[0] ?? 0) + (newRolls[1] ?? 0) === 10;

    if (result.isGutter || roll === 0) {
      nextReaction = "sad";
    } else if (roll === 10 && chain) {
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
      if (!done) {
        // ストライクでラック（10本）を一掃した直後、またはスペア成立直後は次の投球のためにフルリセットする。
        // 2投連続ストライク（chain && roll===10）もこの条件でカバーする。
        if ((chain && roll === 10) || spareCompleted) needsFreshRackNext = true;
      }
    } else {
      needsFreshRackNext = done;
    }

    const resumeDelay = nextBanner ? 900 : 550;

    window.setTimeout(() => {
      if (needsFreshRackNext) setLaneResetSignal((value) => value + 1);

      if (!isLastFrame && done) {
        setFrameIndex(currentFrameIndex + 1);
      }

      if (isLastFrame && done) {
        const finalState = calculateBowlingScore(nextFrames);
        void submitResult(finalState.total);
        window.setTimeout(() => setPhase("result"), 500);
        return;
      }

      setRollLocked(false);
      setReaction("idle");
    }, resumeDelay);
  }, [submitResult]);

  const goToRanking = useCallback(() => {
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
      <div className="border-b border-line px-4 py-3">
        <div className="flex items-baseline justify-between">
          <p className="text-[9px] font-black tracking-[0.16em] text-ink-faint">SCORE</p>
          <p className="text-2xl font-black tabular-nums text-ink">{score.total}</p>
        </div>
        <div className="mt-2">
          <ScoreBoard frames={frames} score={score} currentFrameIndex={frameIndex} />
        </div>
      </div>

      <div className="relative px-3 pb-3 pt-3">
        <Lane ballVisual={ballVisual} resetSignal={laneResetSignal} active={!rollLocked} onRoll={handleRoll} />

        {banner ? (
          <div className="pointer-events-none absolute left-1/2 top-[38%] z-20 -translate-x-1/2">
            <p className="wanko-bowl-banner whitespace-nowrap text-[13vw] font-black leading-none text-[#a8442f] drop-shadow-[0_3px_0_rgba(255,255,255,0.7)]">
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
