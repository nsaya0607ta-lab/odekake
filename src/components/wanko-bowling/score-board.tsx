"use client";

import type { BowlingFrame, BowlingScoreState } from "@/lib/games/wanko-bowling-score";
import { BOWLING_FRAME_COUNT } from "@/lib/games/wanko-bowling-score";

function normalMark(roll: number): string {
  return roll === 0 ? "–" : String(roll);
}

function frameLabel(frame: BowlingFrame, frameIndex: number): string {
  const isLast = frameIndex === BOWLING_FRAME_COUNT - 1;
  if (frame.rolls.length === 0) return "";

  const first = frame.rolls[0] ?? 0;
  const second = frame.rolls[1];
  const third = frame.rolls[2];

  if (!isLast) {
    if (first === 10) return "X";
    const parts = [normalMark(first)];
    if (second !== undefined) {
      parts.push(first + second === 10 ? "/" : normalMark(second));
    }
    return parts.join("  ");
  }

  const parts: string[] = [];
  if (first === 10) {
    parts.push("X");
    if (second === undefined) return parts.join(" ");
    parts.push(second === 10 ? "X" : normalMark(second));
    if (third === undefined) return parts.join(" ");
    if (second === 10) parts.push(third === 10 ? "X" : normalMark(third));
    else parts.push(second + third === 10 ? "/" : normalMark(third));
    return parts.join(" ");
  }

  parts.push(normalMark(first));
  if (second === undefined) return parts.join(" ");
  const firstSetIsSpare = first + second === 10;
  parts.push(firstSetIsSpare ? "/" : normalMark(second));
  if (third !== undefined) parts.push(third === 10 ? "X" : normalMark(third));
  return parts.join(" ");
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
      className="relative h-[96px] w-full overflow-hidden rounded-[14px] bg-[#08151b] sm:h-[108px]"
      style={{
        backgroundImage: "url('/games/wanko-bowling/scoreboard-monitor.svg')",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundSize: "100% 100%",
      }}
      aria-label="ボウリングスコアボード"
    >
      <div
        className="absolute bottom-[14%] left-[3.3%] right-[3.3%] top-[14%] grid"
        style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr)) 1.34fr" }}
      >
        {frames.map((frame, index) => {
          const isActive = index === currentFrameIndex;
          const result = score.frames[index];
          return (
            <div
              key={index}
              className={`relative grid min-w-0 grid-rows-[31%_31%_38%] text-center ${
                isActive ? "bg-[#63d1c8]/10 ring-1 ring-inset ring-[#8ae0d8]/60" : ""
              }`}
            >
              <p className={`self-center text-[8px] font-black tracking-[0.14em] ${isActive ? "text-[#9cf0df]" : "text-[#8cbac1]"}`}>
                {index + 1}F
              </p>
              <p className="self-center whitespace-nowrap px-0.5 text-[12px] font-black tabular-nums leading-none text-[#f4dc88] sm:text-[13px]">
                {frameLabel(frame, index) || "·"}
              </p>
              <p className="self-center text-[14px] font-black tabular-nums leading-none text-[#ecf7f5] sm:text-[16px]">
                {result?.cumulativeScore ?? "–"}
              </p>
            </div>
          );
        })}

        <div className="grid min-w-0 grid-rows-[31%_69%] text-center">
          <p className="self-center text-[8px] font-black tracking-[0.14em] text-[#8cbac1]">TOTAL</p>
          <p className="self-center text-[22px] font-black tabular-nums leading-none text-[#f4dc88] sm:text-[25px]">
            {score.total}
          </p>
        </div>
      </div>
    </div>
  );
}
