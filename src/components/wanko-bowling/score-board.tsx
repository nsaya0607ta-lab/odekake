"use client";

import { useEffect, useState } from "react";
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

function normalMark(roll: number): string {
  return roll === 0 ? "–" : String(roll);
}

function frameRollMarks(frame: BowlingFrame, frameIndex: number): string[] {
  const isLast = frameIndex === BOWLING_FRAME_COUNT - 1;
  const first = frame.rolls[0];
  const second = frame.rolls[1];
  const third = frame.rolls[2];

  if (!isLast) {
    if (first === undefined) return ["", ""];
    if (first === 10) return ["", "X"];
    return [
      normalMark(first),
      second === undefined ? "" : first + second === 10 ? "/" : normalMark(second),
    ];
  }

  if (first === undefined) return ["", "", ""];

  const firstMark = first === 10 ? "X" : normalMark(first);
  let secondMark = "";
  let thirdMark = "";

  if (second !== undefined) {
    if (first === 10) secondMark = second === 10 ? "X" : normalMark(second);
    else secondMark = first + second === 10 ? "/" : normalMark(second);
  }

  if (third !== undefined) {
    if (first === 10) {
      if (second === 10) thirdMark = third === 10 ? "X" : normalMark(third);
      else thirdMark = (second ?? 0) + third === 10 ? "/" : normalMark(third);
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
        <i
          key={segment}
          className={`wb-segment wb-segment-${segment} ${active.has(segment) ? "is-on" : ""}`}
        />
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
      ) : (
        <SevenSegmentDigit char={shown} large={large} />
      )}
    </span>
  );
}

function DigitalNumber({ value, large = false }: { value: number | null; large?: boolean }) {
  const text = value === null
    ? "---"
    : Math.max(0, Math.min(999, value)).toString().padStart(3, "0");

  return (
    <span
      className={`wb-digital-number ${large ? "is-large" : ""}`}
      aria-label={value === null ? "スコア未確定" : String(value)}
    >
      {text.split("").map((char, index) => (
        <RollingDigit key={index} char={char} large={large} />
      ))}
    </span>
  );
}

export function ScoreBoard({
  frames,
  score,
  currentFrameIndex,
}: {
  frames: BowlingFrame[];
  score: BowlingScoreState;
  currentFrameIndex: number;
}) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-[16px] border border-[#b8aa91] bg-[#26352e] px-1.5 pb-1.5 pt-1 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.08),0_2px_7px_rgba(63,52,44,0.18)]"
      aria-label="5フレーム ボウリングスコアボード"
    >
      <style>{`
        .wb-digital-number { display:inline-flex; align-items:center; justify-content:center; gap:1px; }
        .wb-seven-digit { position:relative; display:inline-block; width:8px; height:14px; flex:none; }
        .wb-seven-digit.is-large { width:10px; height:18px; }
        .wb-segment { position:absolute; display:block; border-radius:999px; background:rgba(191,234,153,.10); box-shadow:none; transition:background .12s ease, box-shadow .12s ease; }
        .wb-segment.is-on { background:#c7f3a2; box-shadow:0 0 4px rgba(199,243,162,.52); }
        .wb-segment-a,.wb-segment-d,.wb-segment-g { left:1.5px; width:5px; height:1.5px; }
        .wb-seven-digit.is-large .wb-segment-a,.wb-seven-digit.is-large .wb-segment-d,.wb-seven-digit.is-large .wb-segment-g { left:2px; width:6px; height:1.8px; }
        .wb-segment-a { top:0; }
        .wb-segment-g { top:6.2px; }
        .wb-segment-d { bottom:0; }
        .wb-seven-digit.is-large .wb-segment-g { top:8px; }
        .wb-segment-b,.wb-segment-c,.wb-segment-e,.wb-segment-f { width:1.5px; height:5px; }
        .wb-seven-digit.is-large .wb-segment-b,.wb-seven-digit.is-large .wb-segment-c,.wb-seven-digit.is-large .wb-segment-e,.wb-seven-digit.is-large .wb-segment-f { width:1.8px; height:6.2px; }
        .wb-segment-b { right:0; top:1px; }
        .wb-segment-c { right:0; bottom:1px; }
        .wb-segment-e { left:0; bottom:1px; }
        .wb-segment-f { left:0; top:1px; }
        .wb-roll-window { display:inline-block; width:8px; height:14px; overflow:hidden; vertical-align:middle; }
        .wb-roll-window.is-large { width:10px; height:18px; }
        .wb-roll-strip { display:flex; height:28px; flex-direction:column; animation:wb-score-roll .36s cubic-bezier(.2,.8,.2,1) both; }
        .wb-roll-strip.is-large { height:36px; animation-duration:.48s; }
        @keyframes wb-score-roll { from { transform:translateY(0); } to { transform:translateY(-50%); } }
        @media (prefers-reduced-motion: reduce) { .wb-roll-strip,.wb-roll-strip.is-large { animation:none; transform:translateY(-50%); } }
      `}</style>

      <div className="mb-1 flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <svg viewBox="0 0 34 22" className="h-4 w-6 overflow-visible" aria-hidden="true">
            <circle cx="9" cy="12" r="7" fill="#9bbbd0" />
            <circle cx="7" cy="9" r="1" fill="#456a54" />
            <circle cx="10" cy="8" r="1" fill="#456a54" />
            <path d="M24 2c2 0 3 2 3 5s-1 4 1 7c2 3 3 5 1 6-2 2-8 2-10 0-2-1-1-3 1-6 2-3 1-4 1-7s1-5 3-5Z" fill="#fffdf8" />
            <path d="M21 10h7" stroke="#db9aa5" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-[7px] font-black tracking-[0.16em] text-[#dce8d4]">WANKO SCORE</span>
        </div>
        <span className="text-[7px] font-bold text-[#a9baa8]">AUTO SCORE</span>
      </div>

      <div className="grid grid-cols-[repeat(5,minmax(0,1fr))_1.18fr] gap-[3px]">
        {frames.map((frame, index) => {
          const isActive = index === currentFrameIndex;
          const marks = frameRollMarks(frame, index);
          const result = score.frames[index];
          const rollColumns = index === BOWLING_FRAME_COUNT - 1 ? 3 : 2;

          return (
            <div
              key={index}
              className={`min-w-0 overflow-hidden rounded-[8px] border px-[2px] pb-1 pt-0.5 text-center transition-colors ${
                isActive
                  ? "border-[#b9e58e] bg-[#36513f] shadow-[0_0_8px_rgba(185,229,142,0.18)]"
                  : "border-[#506158] bg-[#1d2924]"
              }`}
            >
              <p className={`text-[7px] font-black leading-3 ${isActive ? "text-[#d7f2bd]" : "text-[#aab8ac]"}`}>
                {index + 1}F
              </p>

              <div
                className="grid h-[18px] items-center border-y border-[#425149] bg-[#17201c]"
                style={{ gridTemplateColumns: `repeat(${rollColumns}, minmax(0, 1fr))` }}
              >
                {marks.map((mark, markIndex) => (
                  <span
                    key={markIndex}
                    className={`text-[10px] font-black tabular-nums leading-none ${
                      mark === "X" || mark === "/" ? "text-[#f0d78e]" : "text-[#d5ded7]"
                    }`}
                  >
                    {mark}
                  </span>
                ))}
              </div>

              <div className="flex h-[25px] items-center justify-center">
                <DigitalNumber value={result?.cumulativeScore ?? null} />
              </div>
            </div>
          );
        })}

        <div className="min-w-0 overflow-hidden rounded-[9px] border border-[#d3bd72] bg-[#18241f] px-[2px] pb-1 pt-0.5 text-center shadow-[inset_0_0_10px_rgba(211,189,114,0.08)]">
          <p className="text-[7px] font-black leading-3 tracking-[0.08em] text-[#eadca7]">TOTAL</p>
          <div className="flex h-[18px] items-center justify-center border-y border-[#5d5840] bg-[#111915]">
            <span className="text-[7px] font-bold tracking-[0.08em] text-[#a9b8aa]">
              {score.isComplete ? "FINAL" : "LIVE"}
            </span>
          </div>
          <div className="flex h-[25px] items-center justify-center">
            <DigitalNumber value={score.total} large />
          </div>
        </div>
      </div>
    </div>
  );
}
