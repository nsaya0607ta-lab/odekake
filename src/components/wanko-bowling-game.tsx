"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BallPicker } from "@/components/wanko-bowling/ball-picker";
import { Lane, type LaneRollResult } from "@/components/wanko-bowling/lane";
import { ScoreBoard } from "@/components/wanko-bowling/score-board";
import {
  BOWLING_FRAME_COUNT,
  createEmptyFrames,
  getGoldenPinTargets,
  KING_PIN_BONUS,
  replayBowling,
  SPLIT_CLEAR_BONUS,
  type BowlingFrame,
  type BowlingNextRoll,
  type BowlingPinFalls,
  type BowlingRack,
  type GoldenPinTarget,
} from "@/lib/games/wanko-bowling-score";
import { getBowlingBallVisual, type OwnedBowlingBall } from "@/lib/games/wanko-bowling-balls";
import { bowlingFx, confettiBurst, prefersReducedMotion } from "@/components/wanko-bowling/bowling-fx";

type Phase = "select" | "playing" | "result";
type Banner = "スペア！" | "ストライク！" | "ターキー！" | "メガストライク！" | "スプリットメイク！" | "キングピン撃破！" | null;
/** 演出：投げたあとに出す大きな文字・倒した本数 */
type RollFx = {
  kind: "strike" | "turkey" | "mega" | "spare" | "split" | "king" | "gutter" | "count";
  pins: number;
  /** ボーナス点（キングピン +20・スプリット +30）。なければ 0 */
  bonus: number;
  key: number;
};
/** 新しいラックのはじめに出す帯 */
type RackIntro = { tone: "frame" | "final" | "fever" | "big" | "split"; sub: string; title: string; key: number };

const ROLL_FX_SUB: Record<RollFx["kind"], string> = {
  strike: "STRIKE",
  turkey: "TURKEY",
  mega: "MEGA STRIKE",
  spare: "SPARE",
  split: "SPLIT MAKE",
  king: "KING PIN",
  gutter: "",
  count: "",
};
const ROLL_FX_FALLBACK: Record<RollFx["kind"], string> = {
  strike: "ストライク！",
  turkey: "ターキー！",
  mega: "メガストライク！",
  spare: "スペア！",
  split: "スプリットメイク！",
  king: "キングピン撃破！",
  gutter: "ガター…",
  count: "",
};
const ROLL_FX_TEXT_CLASS: Partial<Record<RollFx["kind"], string>> = {
  spare: bowlingFx.bannerSpare,
  split: bowlingFx.bannerSplit,
  king: bowlingFx.bannerKing,
  mega: bowlingFx.bannerMega,
  gutter: bowlingFx.bannerGutter,
};
const FRAME_BAND_CLASS: Partial<Record<RackIntro["tone"], string>> = {
  final: bowlingFx.frameBandFinal,
  fever: bowlingFx.frameBandFever,
  big: bowlingFx.frameBandBig,
  split: bowlingFx.frameBandSplit,
};

/** 新しくセットしたラックに合わせて、帯の文言を決める */
function rackIntroOf(next: BowlingNextRoll): RackIntro {
  const key = Date.now();
  const isLast = next.frameIndex === BOWLING_FRAME_COUNT - 1;
  if (next.rack.kind === "split") {
    return { tone: "split", sub: "SPLIT CHALLENGE", title: `${next.rack.splitName ?? ""} を全部倒せ！ +${SPLIT_CLEAR_BONUS}`, key };
  }
  if (next.fever && next.rollIndex === 0) {
    return { tone: "fever", sub: "FEVER TIME", title: next.rack.kind === "big" ? "15ピン × 2倍！" : "倒した本数 × 2倍！", key };
  }
  if (next.rack.kind === "big") return { tone: "big", sub: "BIG RACK", title: "15ピン！", key };
  if (isLast && next.rollIndex === 0) return { tone: "final", sub: "FINAL", title: "キングピン出現！", key };
  if (isLast) return { tone: "final", sub: "BONUS", title: "ボーナス投球", key };
  return { tone: "frame", sub: "FRAME", title: `第${next.frameIndex + 1}フレーム`, key };
}

/** 結果のスコアを 0 から数え上げる（見た目だけ） */
function useCountUp(target: number, run: boolean, durationMs = 1100) {
  const [value, setValue] = useState(run ? 0 : target);
  const [done, setDone] = useState(!run);
  useEffect(() => {
    if (!run || prefersReducedMotion() || target <= 0) {
      setValue(target);
      setDone(true);
      return;
    }
    setDone(false);
    const from = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - from) / durationMs);
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDone(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, durationMs]);
  return { value, done };
}

function newRoundId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `round-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createEmptyPinFalls(): BowlingPinFalls {
  return Array.from({ length: BOWLING_FRAME_COUNT }, () => []);
}

export function WankoBowlingGame({ ownedBalls }: { ownedBalls: OwnedBowlingBall[] }) {
  const initialFrames = useMemo(() => createEmptyFrames(), []);
  const [phase, setPhase] = useState<Phase>("select");
  const [selectedBallId, setSelectedBallId] = useState<string>(
    () => ownedBalls[0]?.id ?? "default_paw_ball",
  );
  const [frames, setFrames] = useState<BowlingFrame[]>(initialFrames);
  const [pinFalls, setPinFalls] = useState<BowlingPinFalls>(createEmptyPinFalls);
  const [roundId, setRoundId] = useState<string>(newRoundId);
  /** レーンに並べるラック（新しいラックをセットするときだけ変わる） */
  const [laneRack, setLaneRack] = useState<BowlingRack>(
    () => replayBowling(roundId, initialFrames, createEmptyPinFalls()).next!.rack,
  );
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
  const [goldenPinTargets, setGoldenPinTargets] = useState<GoldenPinTarget[]>([]);
  const [goldenHitCount, setGoldenHitCount] = useState(0);
  const [goldenNotice, setGoldenNotice] = useState(false);
  const [rollFx, setRollFx] = useState<RollFx | null>(null);
  const [frameIntro, setFrameIntro] = useState<RackIntro | null>(null);
  const fxLayerRef = useRef<HTMLDivElement | null>(null);
  const resultFxLayerRef = useRef<HTMLDivElement | null>(null);

  const framesRef = useRef<BowlingFrame[]>(initialFrames);
  const frameIndexRef = useRef(0);
  const rollLockedRef = useRef(false);
  const streakRef = useRef(0);
  const submittedRef = useRef(false);
  const roundIdRef = useRef(roundId);
  const pinFallsRef = useRef<BowlingPinFalls>(pinFalls);
  const goldenPinTargetsRef = useRef<GoldenPinTarget[]>([]);
  const goldenHitFramesRef = useRef<Set<number>>(new Set());
  const rankingSectionIdRef = useRef("wanko-bowling-ranking");

  // わんこルールを含めたスコア（API と同じ関数で計算する）
  const score = useMemo(() => replayBowling(roundId, frames, pinFalls), [roundId, frames, pinFalls]);
  const liveScore = score.liveTotal;
  /** いま投げているフレームがフィーバーか（フレームが進んだときに切りかわる） */
  const feverNow = score.next?.frameIndex === frameIndex ? score.next.fever : score.frames[frameIndex]?.fever === true;
  const ballVisual = useMemo(() => getBowlingBallVisual(selectedBallId), [selectedBallId]);
  const currentGoldenTarget = goldenPinTargets.find((item) => item.frameIndex === frameIndex);
  const currentGoldenPinId = currentGoldenTarget && !goldenHitFramesRef.current.has(frameIndex)
    ? currentGoldenTarget.pinId
    : null;

  const commitFrames = useCallback((nextFrames: BowlingFrame[], nextPinFalls: BowlingPinFalls) => {
    framesRef.current = nextFrames;
    pinFallsRef.current = nextPinFalls;
    setFrames(nextFrames);
    setPinFalls(nextPinFalls);
  }, []);

  /** 投げたあとの大きな文字が消えるまで、次のラックの帯は待たせる */
  const rollFxUntilRef = useRef(0);
  const showRackIntro = useCallback((next: BowlingNextRoll) => {
    const intro = rackIntroOf(next);
    const wait = Math.max(0, rollFxUntilRef.current - Date.now());
    window.setTimeout(() => {
      setFrameIntro(intro);
      window.setTimeout(() => setFrameIntro((current) => (current?.key === intro.key ? null : current)), 1350);
    }, wait);
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
    const emptyPinFalls = createEmptyPinFalls();
    commitFrames(emptyFrames, emptyPinFalls);
    commitFrameIndex(0);
    streakRef.current = 0;
    submittedRef.current = false;
    const nextRoundId = newRoundId();
    const nextGoldenPinTargets = getGoldenPinTargets(nextRoundId);
    roundIdRef.current = nextRoundId;
    setRoundId(nextRoundId);
    const firstRoll = replayBowling(nextRoundId, emptyFrames, emptyPinFalls).next!;
    setLaneRack(firstRoll.rack);
    showRackIntro(firstRoll);
    goldenPinTargetsRef.current = nextGoldenPinTargets;
    goldenHitFramesRef.current = new Set();
    setGoldenPinTargets(nextGoldenPinTargets);
    setGoldenHitCount(0);
    setGoldenNotice(false);
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
  }, [commitFrameIndex, commitFrames, setRollLock, showRackIntro]);

  const submitResult = useCallback(async (finalScore: number, finalFrames: BowlingFrame[], finalPinFalls: BowlingPinFalls) => {
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
          pinFalls: finalPinFalls,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        coins?: number;
        goldenHits?: number;
        error?: string;
      } | null;
      if (!response.ok) throw new Error(payload?.error ?? "コインを受け取れませんでした。");
      setEarnedCoins(typeof payload?.coins === "number" ? payload.coins : 0);
      if (typeof payload?.goldenHits === "number") setGoldenHitCount(payload.goldenHits);
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
    void submitResult(score.total, framesRef.current, pinFallsRef.current);
  }, [score.total, submitResult]);

  const handleRoll = useCallback((result: LaneRollResult) => {
    if (rollLockedRef.current) return;

    const roundIdNow = roundIdRef.current;
    const baseFrames = framesRef.current;
    const basePinFalls = pinFallsRef.current;
    const before = replayBowling(roundIdNow, baseFrames, basePinFalls).next;
    if (!before) return;
    setRollLock(true);

    const currentFrameIndex = before.frameIndex;
    const isLastFrame = currentFrameIndex === BOWLING_FRAME_COUNT - 1;
    const standing = new Set(before.standingPinIds);
    let knockedIds = result.knockedIds.filter((id) => standing.has(id));
    const kingPinId = before.rack.kingPinId;
    const kingHit = kingPinId !== null && knockedIds.includes(kingPinId);
    // キングピンが倒れたら残りも全部倒れる（レーンでもそうなるが、記録はルールに合わせてそろえる）
    if (kingHit) knockedIds = [...before.standingPinIds];
    const roll = knockedIds.length;
    const isGutterRoll = result.isGutter && roll === 0;

    const currentFrame = baseFrames[currentFrameIndex] ?? { rolls: [], gutters: [] };
    const priorRolls = [...currentFrame.rolls];
    const priorGutters = currentFrame.gutters && currentFrame.gutters.length === priorRolls.length
      ? [...currentFrame.gutters]
      : Array.from({ length: priorRolls.length }, () => false);

    const nextPinFalls = basePinFalls.map((frameFalls, index) =>
      index === currentFrameIndex ? [...frameFalls, [...knockedIds]] : frameFalls,
    );
    const goldenTarget = goldenPinTargetsRef.current.find(
      (target) => target.frameIndex === currentFrameIndex,
    );
    if (
      goldenTarget
      && !goldenHitFramesRef.current.has(currentFrameIndex)
      && knockedIds.includes(goldenTarget.pinId)
    ) {
      goldenHitFramesRef.current.add(currentFrameIndex);
      setGoldenHitCount(goldenHitFramesRef.current.size);
      setGoldenNotice(true);
      window.setTimeout(() => setGoldenNotice(false), 1300);
    }

    setLastRollPins(roll);

    const newFrame: BowlingFrame = {
      rolls: [...priorRolls, roll],
      gutters: [...priorGutters, isGutterRoll],
    };
    const nextFrames = baseFrames.map((frame, index) =>
      index === currentFrameIndex ? newFrame : frame,
    );
    const after = replayBowling(roundIdNow, nextFrames, nextPinFalls);
    commitFrames(nextFrames, nextPinFalls);

    const cleared = standing.size > 0 && roll === standing.size;
    const isSplitRack = before.rack.kind === "split";
    const strike = before.freshRack && cleared && !isSplitRack;
    const mega = strike && before.rack.kind === "big";
    const spare = !before.freshRack && cleared && !isSplitRack;
    const splitMake = isSplitRack && cleared;

    if (before.freshRack) {
      streakRef.current = strike ? streakRef.current + 1 : 0;
    }

    let nextBanner: Banner = null;
    if (kingHit) nextBanner = "キングピン撃破！";
    else if (mega) nextBanner = "メガストライク！";
    else if (strike) nextBanner = streakRef.current >= 3 ? "ターキー！" : "ストライク！";
    else if (splitMake) nextBanner = "スプリットメイク！";
    else if (spare) nextBanner = "スペア！";

    if (strike || kingHit || splitMake) {
      setShake(true);
      window.setTimeout(() => setShake(false), 450);
    }

    setBanner(nextBanner);
    if (nextBanner) window.setTimeout(() => setBanner(null), 1500);

    // 演出：大きな文字・紙ふぶき・倒した本数
    const fxKind: RollFx["kind"] = kingHit
      ? "king"
      : mega
        ? "mega"
        : strike
          ? streakRef.current >= 3 ? "turkey" : "strike"
          : splitMake
            ? "split"
            : spare
              ? "spare"
              : isGutterRoll
                ? "gutter"
                : "count";
    const fxKey = Date.now();
    setRollFx({
      kind: fxKind,
      pins: roll,
      bonus: kingHit ? KING_PIN_BONUS : splitMake ? SPLIT_CLEAR_BONUS : 0,
      key: fxKey,
    });
    rollFxUntilRef.current = fxKey + 1500;
    window.setTimeout(() => setRollFx((current) => (current?.key === fxKey ? null : current)), 1500);
    if (fxKind === "king" || fxKind === "mega") confettiBurst(fxLayerRef.current, 90, ["#ffd84a", "#c38bff", "#ffffff", "#ff9ad5", "#7fe0ff"]);
    else if (fxKind === "strike" || fxKind === "turkey") confettiBurst(fxLayerRef.current, fxKind === "turkey" ? 80 : 50);
    else if (fxKind === "split") confettiBurst(fxLayerRef.current, 40, ["#9be36a", "#ffffff", "#54d8ff", "#ffc95c"]);
    else if (fxKind === "spare") confettiBurst(fxLayerRef.current, 24, ["#54d8ff", "#c9f4ff", "#ffffff", "#7fe0ff"]);

    const next = after.next;
    const frameDone = after.isComplete || (next !== null && next.frameIndex !== currentFrameIndex);
    const resumeDelay = nextBanner ? 900 : 550;

    window.setTimeout(() => {
      if (next?.freshRack) {
        setLaneRack(next.rack);
        setLaneResetSignal((value) => value + 1);
        showRackIntro(next);
      }

      if (!isLastFrame && frameDone && next) {
        commitFrameIndex(next.frameIndex);
      }

      if (after.isComplete) {
        void submitResult(after.total, nextFrames, nextPinFalls);
        window.setTimeout(() => setPhase("result"), 500);
        return;
      }

      setRollLock(false);
    }, resumeDelay);
  }, [commitFrameIndex, commitFrames, setRollLock, showRackIntro, submitResult]);

  // 演出：結果画面のスコアの数え上げと、自己ベストの紙ふぶき
  const resultCount = useCountUp(score.total, phase === "result");
  useEffect(() => {
    if (phase !== "result" || !isNewBest) return;
    const timer = window.setTimeout(() => confettiBurst(resultFxLayerRef.current, 70), 300);
    return () => window.clearTimeout(timer);
  }, [phase, isNewBest]);

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
        <section className="relative overflow-hidden rounded-[24px] border border-[#26394d] bg-[#09131e] text-white shadow-[0_20px_55px_rgba(0,0,0,0.42)]">
          <div ref={resultFxLayerRef} className={bowlingFx.layer} aria-hidden="true" />
          <div className="relative overflow-hidden border-b border-white/10 px-4 py-6 text-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(84,216,255,0.24),transparent_58%)]" />
            <div className="relative">
              <p className="text-[9px] font-black tracking-[0.18em] text-[#54d8ff]">最終結果</p>
              <p className="mt-1 text-base font-black tracking-wide text-white/75">全10フレーム終了</p>
              <p className="mt-4 text-[10px] font-black tracking-[0.12em] text-white/40">最終スコア</p>
              <p
                className={`mt-0.5 font-mono text-[64px] font-black leading-none tracking-[-0.08em] text-white drop-shadow-[0_0_22px_rgba(84,216,255,0.4)] ${resultCount.done ? bowlingFx.resultScoreDone : ""}`}
                aria-label={`最終スコア ${score.total}`}
              >
                {resultCount.value}
              </p>
              {isNewBest ? (
                <p className={`mx-auto mt-3 w-fit rounded-full border border-[#ffc95c]/50 bg-[#ffc95c]/10 px-4 py-1 text-[10px] font-black tracking-[0.18em] text-[#ffc95c] ${bowlingFx.bestBadge}`}>
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
            <div className={`rounded-[14px] border border-white/10 bg-white/[0.04] px-2 py-3 ${bowlingFx.resultIn}`} style={{ "--delay": "250ms" } as CSSProperties}>
              <p className="font-mono text-2xl font-black tabular-nums text-[#54d8ff]">{score.strikeCount}</p>
              <p className="mt-0.5 text-[8px] font-black tracking-[0.08em] text-white/40">ストライク</p>
            </div>
            <div className={`rounded-[14px] border border-white/10 bg-white/[0.04] px-2 py-3 ${bowlingFx.resultIn}`} style={{ "--delay": "360ms" } as CSSProperties}>
              <p className="font-mono text-2xl font-black tabular-nums text-[#ffc95c]">{score.spareCount}</p>
              <p className="mt-0.5 text-[8px] font-black tracking-[0.08em] text-white/40">スペア</p>
            </div>
            <div className={`rounded-[14px] border border-white/10 bg-white/[0.04] px-2 py-3 ${bowlingFx.resultIn}`} style={{ "--delay": "470ms" } as CSSProperties}>
              <p className="font-mono text-2xl font-black tabular-nums text-white">{score.gutterCount}</p>
              <p className="mt-0.5 text-[8px] font-black tracking-[0.08em] text-white/40">ガター</p>
            </div>
          </div>

          {/* わんこルールの記録 */}
          <div className="-mt-2 grid grid-cols-4 gap-1.5 px-4 pb-4 text-center">
            {[
              { label: "メガストライク", value: score.megaStrikeCount, color: "#ffd84a" },
              { label: "フィーバー", value: score.feverFrameCount, color: "#ff8ae0" },
              { label: "スプリット成功", value: score.splitMakeCount, color: "#a6ec74" },
              { label: "キングピン", value: score.kingHitCount, color: "#c38bff" },
            ].map((item, index) => (
              <div
                key={item.label}
                className={`rounded-[12px] border border-white/10 bg-white/[0.03] px-1 py-2 ${bowlingFx.resultIn}`}
                style={{ "--delay": `${520 + index * 70}ms` } as CSSProperties}
              >
                <p className="font-mono text-lg font-black tabular-nums" style={{ color: item.value > 0 ? item.color : "rgba(255,255,255,0.35)" }}>{item.value}</p>
                <p className="mt-0.5 whitespace-nowrap text-[7px] font-black text-white/40">{item.label}</p>
              </div>
            ))}
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
            <div className={`mx-4 mb-2 rounded-[14px] border border-[#ffc95c]/30 bg-[#ffc95c]/10 px-4 py-3 text-center ${bowlingFx.resultIn}`} style={{ "--delay": "560ms" } as CSSProperties}>
              <p className="text-[8px] font-black tracking-[0.12em] text-[#ffc95c]/70">獲得コイン</p>
              <p className="mt-0.5 font-mono text-xl font-black text-[#ffc95c]">
                +{earnedCoins.toLocaleString("ja-JP")} コイン
              </p>
              <p className="mt-1 text-[9px] font-black text-[#ffc95c]">
                スコア {score.total} ＋ ゴールデンピン {goldenHitCount}本 × 10
              </p>
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
        />
      </div>

      <div className="relative -mt-px min-h-0 flex-1 [&>div]:!rounded-t-none">
        <Lane
          ballVisual={ballVisual}
          goldenPinId={currentGoldenPinId}
          rack={laneRack}
          fever={feverNow}
          resetSignal={laneResetSignal}
          newGameSignal={newGameSignal}
          active={!rollLocked}
          onRoll={handleRoll}
        />

        {rollFx && rollFx.kind !== "count" ? (
          <div key={rollFx.key} className={bowlingFx.bannerWrap} role="status">
            {rollFx.kind === "strike" || rollFx.kind === "turkey" || rollFx.kind === "mega" || rollFx.kind === "king" ? (
              <span
                className={`${bowlingFx.rays} ${rollFx.kind === "turkey" ? bowlingFx.raysTurkey : ""} ${rollFx.kind === "mega" || rollFx.kind === "king" ? bowlingFx.raysMega : ""}`}
              />
            ) : null}
            {rollFx.kind !== "gutter" ? (
              <span className={bowlingFx.bannerSub}>{ROLL_FX_SUB[rollFx.kind]}</span>
            ) : null}
            <p
              className={`${bowlingFx.bannerText} ${ROLL_FX_TEXT_CLASS[rollFx.kind] ?? ""}`}
            >
              {rollFx.kind === "gutter" ? "ガター…" : banner ?? ROLL_FX_FALLBACK[rollFx.kind]}
            </p>
            {rollFx.bonus > 0 ? <span className={bowlingFx.bannerBonus}>+{rollFx.bonus}</span> : null}
          </div>
        ) : null}
        {rollFx?.kind === "count" ? (
          <p key={rollFx.key} className={bowlingFx.pinCount} role="status">
            {rollFx.pins === 9 ? <span>おしい！</span> : null}
            <b>{rollFx.pins}</b>
            <span>本</span>
          </p>
        ) : null}
        {frameIntro && !rollFx ? (
          <div key={frameIntro.key} className={bowlingFx.frameIntro} aria-hidden="true">
            <div className={`${bowlingFx.frameBand} ${FRAME_BAND_CLASS[frameIntro.tone] ?? ""}`}>
              <small>{frameIntro.sub}</small>
              <strong>{frameIntro.title}</strong>
            </div>
          </div>
        ) : null}
        <div ref={fxLayerRef} className={bowlingFx.layer} style={{ zIndex: 35 }} aria-hidden="true" />

        {goldenNotice ? (
          <div className={`pointer-events-none absolute left-1/2 top-[48%] z-50 -translate-x-1/2 ${bowlingFx.goldenNotice} rounded-full border border-[#ffd75f]/55 bg-[#2b1900]/90 px-4 py-2 shadow-[0_0_24px_rgba(255,191,35,0.5)]`}>
            <p className="whitespace-nowrap text-sm font-black text-[#ffe47e]">ゴールデンピン！ ＋10コイン</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
