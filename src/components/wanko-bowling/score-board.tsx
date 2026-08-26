"use client";

import { useEffect, useRef, useState } from "react";
import type { BowlingFrame, BowlingScoreState } from "@/lib/games/wanko-bowling-score";
import { BOWLING_FRAME_COUNT } from "@/lib/games/wanko-bowling-score";

const SEGMENTS: Record<string, string[]> = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "d", "e", "g"],
  "3": ["a", "b", "c", "d", "g"],
  "4": ["b", "c", "f", "g"],
  "5": ["a", "c", "d", "f", "g"],
  "6": ["a", "c", "d", "e", "f", "g"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"],
  "-": ["g"],
};

function normalMark(roll: number) {
  return roll === 0 ? "–" : String(roll);
}

function frameRollMarks(frame: BowlingFrame, frameIndex: number): string[] {
  const last = frameIndex === BOWLING_FRAME_COUNT - 1;
  const [first, second, third] = frame.rolls;

  if (!last) {
    if (first === undefined) return ["", ""];
    if (first === 10) return ["", "X"];
    return [normalMark(first), second === undefined ? "" : first + second === 10 ? "/" : normalMark(second)];
  }

  if (first === undefined) return ["", "", ""];
  const firstMark = first === 10 ? "X" : normalMark(first);
  let secondMark = "";
  let thirdMark = "";

  if (second !== undefined) {
    secondMark = first === 10
      ? second === 10 ? "X" : normalMark(second)
      : first + second === 10 ? "/" : normalMark(second);
  }
  if (third !== undefined) {
    if (first === 10) {
      thirdMark = second === 10 ? (third === 10 ? "X" : normalMark(third)) : (second ?? 0) + third === 10 ? "/" : normalMark(third);
    } else {
      thirdMark = third === 10 ? "X" : normalMark(third);
    }
  }
  return [firstMark, secondMark, thirdMark];
}

function SevenSegmentDigit({ char, large = false }: { char: string; large?: boolean }) {
  const active = new Set(SEGMENTS[char] ?? []);
  return (
    <span className={`wb-seven-digit ${large ? "is-large" : ""}`} aria-hidden="true">
      {(["a", "b", "c", "d", "e", "f", "g"] as const).map((segment) => (
        <i key={segment} className={`wb-segment wb-segment-${segment} ${active.has(segment) ? "is-on" : ""}`} />
      ))}
    </span>
  );
}

function RollingDigit({ char, large = false }: { char: string; large?: boolean }) {
  const [shown, setShown] = useState(char);
  const [previous, setPrevious] = useState(char);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    if (char === shown) return;
    setPrevious(shown);
    setShown(char);
    setRolling(true);
    const timer = window.setTimeout(() => setRolling(false), large ? 480 : 360);
    return () => window.clearTimeout(timer);
  }, [char, large, shown]);

  return (
    <span className={`wb-roll-window ${large ? "is-large" : ""}`}>
      {rolling ? (
        <span className={`wb-roll-strip ${large ? "is-large" : ""}`}>
          <SevenSegmentDigit char={previous} large={large} />
          <SevenSegmentDigit char={shown} large={large} />
        </span>
      ) : <SevenSegmentDigit char={shown} large={large} />}
    </span>
  );
}

function DigitalNumber({ value, large = false }: { value: number | null; large?: boolean }) {
  const text = value === null ? "---" : Math.max(0, Math.min(999, value)).toString().padStart(3, "0");
  return (
    <span className={`wb-digital-number ${large ? "is-large" : ""}`} aria-label={value === null ? "スコア未確定" : String(value)}>
      {text.split("").map((char, index) => <RollingDigit key={index} char={char} large={large} />)}
    </span>
  );
}

export function ScoreBoard({
  frames,
  score,
  currentFrameIndex,
  liveScore,
  bestScore,
  lastRollPins,
  bonusFrameIndex,
  bonusAchieved,
}: {
  frames: BowlingFrame[];
  score: BowlingScoreState;
  currentFrameIndex: number;
  liveScore: number;
  bestScore: number | null;
  lastRollPins: number | null;
  bonusFrameIndex?: number;
  bonusAchieved?: boolean;
}) {
  const activeFrameRef = useRef<HTMLDivElement>(null);
  const currentRoll = Math.min(3, (frames[currentFrameIndex]?.rolls.length ?? 0) + 1);

  useEffect(() => {
    activeFrameRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [currentFrameIndex]);

  return (
    <div className="relative overflow-hidden border-b border-[#30435a] bg-[linear-gradient(180deg,#111b29_0%,#07101a_100%)] px-2 pb-2 pt-1.5 shadow-[0_8px_22px_rgba(0,0,0,0.36)]" aria-label="10フレーム ボウリングスコアボード">
      <style>{`
        .wb-digital-number{display:grid;grid-auto-flow:column;grid-auto-columns:max-content;align-items:start;justify-content:center;column-gap:1px;height:13px;line-height:0}
        .wb-digital-number.is-large{height:24px;column-gap:2px}
        .wb-seven-digit{position:relative;display:block;width:8px;height:13px;flex:none;line-height:0}
        .wb-seven-digit.is-large{width:14px;height:24px}
        .wb-segment{position:absolute;display:block;border-radius:999px;background:rgba(113,210,255,.08);box-shadow:none;transition:background .12s ease,box-shadow .12s ease}
        .wb-segment.is-on{background:#79e2ff;box-shadow:0 0 6px rgba(74,205,255,.68)}
        .wb-segment-a,.wb-segment-d,.wb-segment-g{left:1.2px;width:4.6px;height:1.35px}
        .wb-seven-digit.is-large .wb-segment-a,.wb-seven-digit.is-large .wb-segment-d,.wb-seven-digit.is-large .wb-segment-g{left:2px;width:10px;height:2px}
        .wb-segment-a{top:0}.wb-segment-g{top:5.7px}.wb-segment-d{bottom:0}.wb-seven-digit.is-large .wb-segment-g{top:11px}
        .wb-segment-b,.wb-segment-c,.wb-segment-e,.wb-segment-f{width:1.35px;height:4.35px}
        .wb-seven-digit.is-large .wb-segment-b,.wb-seven-digit.is-large .wb-segment-c,.wb-seven-digit.is-large .wb-segment-e,.wb-seven-digit.is-large .wb-segment-f{width:2px;height:9px}
        .wb-segment-b{right:0;top:.8px}.wb-segment-c{right:0;bottom:.8px}.wb-segment-e{left:0;bottom:.8px}.wb-segment-f{left:0;top:.8px}
        .wb-roll-window{position:relative;display:block;width:8px;height:13px;overflow:hidden;flex:none;line-height:0}
        .wb-roll-window.is-large{width:14px;height:24px}
        .wb-roll-strip{position:absolute;left:0;top:0;display:grid;grid-template-rows:repeat(2,13px);width:100%;height:26px;align-items:start;animation:wb-score-roll .36s cubic-bezier(.2,.8,.2,1) both}
        .wb-roll-strip.is-large{grid-template-rows:repeat(2,24px);height:48px;animation-duration:.48s}
        @keyframes wb-score-roll{from{transform:translate3d(0,0,0)}to{transform:translate3d(0,-50%,0)}}
        @media (prefers-reduced-motion:reduce){.wb-roll-strip,.wb-roll-strip.is-large{animation:none;transform:translate3d(0,-50%,0)}}
      `}</style>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-1 pb-1.5">
        <div>
          <p className="text-[7px] font-black tracking-[0.18em] text-[#7f96ac]">CURRENT</p>
          <p className="mt-0.5 whitespace-nowrap text-[12px] font-black text-white">
            FRAME {currentFrameIndex + 1}<span className="ml-1 text-[9px] text-[#79e2ff]">/ ROLL {currentRoll}</span>
          </p>
        </div>
        <div className="rounded-[10px] border border-[#35536c] bg-black/35 px-3 py-1 text-center shadow-[inset_0_0_12px_rgba(64,190,255,0.08)]">
          <p className="mb-1 text-[6px] font-black tracking-[0.2em] text-[#8da3b7]">LIVE SCORE</p>
          <DigitalNumber value={liveScore} large />
        </div>
        <div className="text-right">
          <p className="text-[7px] font-black tracking-[0.18em] text-[#7f96ac]">PERSONAL BEST</p>
          <p className="mt-0.5 text-[18px] font-black tabular-nums text-[#ffd66c]">{bestScore ?? "---"}</p>
          {lastRollPins !== null ? <p className="text-[7px] font-bold text-white/55">LAST +{lastRollPins}</p> : null}
        </div>
      </div>

      <div className="overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-1">
        {frames.map((frame, index) => {
          const active = index === currentFrameIndex;
          const marks = frameRollMarks(frame, index);
          const result = score.frames[index];
          const isBonusFrame = bonusFrameIndex === index;
          return (
            <div
              key={index}
              ref={active ? activeFrameRef : undefined}
              className={`relative w-[48px] overflow-hidden rounded-[8px] border text-center transition-all ${active ? "border-[#63d9ff] bg-[#19384b] shadow-[0_0_12px_rgba(78,206,255,0.28)]" : "border-white/10 bg-[#0a141f]"} ${isBonusFrame ? "ring-1 ring-[#ffd66c]/85" : ""}`}
            >
              {isBonusFrame ? (
                <span className={`absolute right-0.5 top-0.5 text-[7px] ${bonusAchieved ? "text-[#ffd66c]" : "text-white/55"}`} aria-label={bonusAchieved ? "ボーナスチャンス成功" : "ボーナスチャンス"}>{bonusAchieved ? "★" : "◆"}</span>
              ) : null}
              <p className={`h-[13px] text-[7px] font-black leading-[13px] ${active ? "text-[#8fe8ff]" : "text-[#8292a1]"}`}>{index + 1}</p>
              <div className="flex h-[16px] items-center justify-center gap-1 border-y border-white/10 bg-black/20">
                {marks.map((mark, markIndex) => <span key={markIndex} className={`text-[9px] font-black tabular-nums leading-none ${mark === "X" || mark === "/" ? "text-[#ffd66c]" : "text-[#eef7ff]"}`}>{mark || "·"}</span>)}
              </div>
              <div className="flex h-[21px] items-center justify-center"><DigitalNumber value={result?.cumulativeScore ?? null} /></div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
