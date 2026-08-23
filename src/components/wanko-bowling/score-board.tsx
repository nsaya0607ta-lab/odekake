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
  return (
    <div className="relative -mx-2 -mt-2 w-[calc(100%+1rem)] overflow-hidden rounded-t-[22px] rounded-b-[10px] border border-white/15 bg-[#18251f]/92 px-1 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_2px_5px_rgba(20,18,14,0.16)] backdrop-blur-[3px]" aria-label="10フレーム ボウリングスコアボード">
      <style>{`
        .wb-digital-number{display:grid;grid-auto-flow:column;grid-auto-columns:max-content;align-items:start;justify-content:center;column-gap:1px;height:12px;line-height:0}
        .wb-digital-number.is-large{height:16px}
        .wb-seven-digit{position:relative;display:block;width:7px;height:12px;flex:none;line-height:0}
        .wb-seven-digit.is-large{width:9px;height:16px}
        .wb-segment{position:absolute;display:block;border-radius:999px;background:rgba(191,234,153,.09);box-shadow:none;transition:background .12s ease,box-shadow .12s ease}
        .wb-segment.is-on{background:#c7f3a2;box-shadow:0 0 4px rgba(199,243,162,.48)}
        .wb-segment-a,.wb-segment-d,.wb-segment-g{left:1.2px;width:4.6px;height:1.35px}
        .wb-seven-digit.is-large .wb-segment-a,.wb-seven-digit.is-large .wb-segment-d,.wb-seven-digit.is-large .wb-segment-g{left:1.7px;width:5.7px;height:1.6px}
        .wb-segment-a{top:0}.wb-segment-g{top:5.25px}.wb-segment-d{bottom:0}.wb-seven-digit.is-large .wb-segment-g{top:7.1px}
        .wb-segment-b,.wb-segment-c,.wb-segment-e,.wb-segment-f{width:1.35px;height:4.35px}
        .wb-seven-digit.is-large .wb-segment-b,.wb-seven-digit.is-large .wb-segment-c,.wb-seven-digit.is-large .wb-segment-e,.wb-seven-digit.is-large .wb-segment-f{width:1.6px;height:5.6px}
        .wb-segment-b{right:0;top:.8px}.wb-segment-c{right:0;bottom:.8px}.wb-segment-e{left:0;bottom:.8px}.wb-segment-f{left:0;top:.8px}
        .wb-roll-window{position:relative;display:block;width:7px;height:12px;overflow:hidden;flex:none;line-height:0}
        .wb-roll-window.is-large{width:9px;height:16px}
        .wb-roll-strip{position:absolute;left:0;top:0;display:grid;grid-template-rows:repeat(2,12px);width:100%;height:24px;align-items:start;animation:wb-score-roll .36s cubic-bezier(.2,.8,.2,1) both}
        .wb-roll-strip.is-large{grid-template-rows:repeat(2,16px);height:32px;animation-duration:.48s}
        @keyframes wb-score-roll{from{transform:translate3d(0,0,0)}to{transform:translate3d(0,-50%,0)}}
        @media (prefers-reduced-motion:reduce){.wb-roll-strip,.wb-roll-strip.is-large{animation:none;transform:translate3d(0,-50%,0)}}
      `}</style>

      <div className="grid grid-cols-[repeat(10,minmax(0,1fr))_1.45fr] gap-px">
        {frames.map((frame, index) => {
          const active = index === currentFrameIndex;
          const marks = frameRollMarks(frame, index);
          const result = score.frames[index];
          const columns = index === BOWLING_FRAME_COUNT - 1 ? 3 : 2;
          const isBonusFrame = bonusFrameIndex === index;
          return (
            <div
              key={index}
              className={`relative min-w-0 overflow-hidden rounded-[5px] border px-0 pb-[2px] pt-[1px] text-center transition-all ${active ? "border-[#b9e58e]/85 bg-[#456348]/82 shadow-[0_0_8px_rgba(185,229,142,0.20)]" : "border-white/10 bg-[#111b17]/62"} ${isBonusFrame ? "ring-1 ring-[#f1db91]/80" : ""}`}
            >
              {isBonusFrame ? (
                <span
                  className={`absolute -top-[3px] left-1/2 -translate-x-1/2 rounded-full px-[3px] text-[5px] font-black leading-[7px] ${bonusAchieved ? "bg-[#c9902f] text-white" : "bg-[#f1db91] text-[#5a3f12]"}`}
                  aria-label={bonusAchieved ? "ボーナスチャンス成功" : "ボーナスチャンス"}
                >
                  {bonusAchieved ? "★" : "?"}
                </span>
              ) : null}
              <p className={`text-[6px] font-black leading-[8px] ${active ? "text-[#e4f7d1]" : "text-[#aeb9b0]"}`}>{index + 1}</p>
              <div className="grid h-[13px] items-center border-y border-white/10 bg-black/16" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                {marks.map((mark, markIndex) => <span key={markIndex} className={`text-[7px] font-black tabular-nums leading-none ${mark === "X" || mark === "/" ? "text-[#f1db91]" : "text-[#edf2ee]"}`}>{mark}</span>)}
              </div>
              <div className="flex h-[19px] items-center justify-center"><DigitalNumber value={result?.cumulativeScore ?? null} /></div>
            </div>
          );
        })}

        <div className="min-w-0 overflow-hidden rounded-[6px] border border-[#d8c47b]/75 bg-[#101915]/82 px-[1px] pb-[1px] pt-[1px] text-center shadow-[inset_0_0_10px_rgba(216,196,123,0.06)]">
          <div className="flex h-[8px] items-center justify-center gap-0.5">
            <span className="text-[5px] font-black tracking-[0.06em] text-[#eadca7]">TOTAL</span>
            {lastRollPins !== null ? <span className="text-[4px] font-black text-white/55">+{lastRollPins}</span> : null}
          </div>
          <div className="flex h-[24px] items-center justify-center border-y border-[#6d6445]/55 bg-black/18 leading-none"><DigitalNumber value={liveScore} large /></div>
          <div className="flex h-[11px] items-center justify-center gap-0.5 text-[4px] font-black tracking-[0.02em] text-[#b8c4b9]"><span>BEST</span><span className="tabular-nums text-[#eadca7]">{bestScore ?? "---"}</span></div>
        </div>
      </div>
    </div>
  );
}
