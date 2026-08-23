"use client";

import type { BowlingFrame, BowlingScoreState } from "@/lib/games/wanko-bowling-score";
import { BOWLING_FRAME_COUNT } from "@/lib/games/wanko-bowling-score";

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
      className="relative h-[98px] w-full overflow-hidden sm:h-[112px]"
      style={{
        backgroundImage: "url('/games/wanko-bowling/scoreboard-monitor.svg')",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundSize: "100% 100%",
      }}
      aria-label="5フレーム ボウリングスコアボード"
    >
      <div
        className="absolute bottom-[6%] left-[1.5%] right-[1.5%] top-[6%] grid"
        style={{
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          columnGap: "1.35%",
        }}
      >
        {frames.map((frame, index) => {
          const isActive = index === currentFrameIndex;
          const marks = frameRollMarks(frame, index);
          const result = score.frames[index];
          const rollColumns = index === BOWLING_FRAME_COUNT - 1 ? 3 : 2;

          return (
            <div
              key={index}
              className={`relative grid min-w-0 grid-rows-[21.2%_32.6%_46.2%] overflow-hidden rounded-[10px] text-center ${
                isActive ? "bg-[#dcebc9]/45 ring-1 ring-inset ring-[#4f7d3b]/80" : ""
              }`}
            >
              <p className={`self-center text-[8px] font-black tracking-[0.08em] sm:text-[9px] ${isActive ? "text-[#4f7d3b]" : "text-[#756655]"}`}>
                {index + 1}F
              </p>

              <div className="grid items-center" style={{ gridTemplateColumns: `repeat(${rollColumns}, minmax(0, 1fr))` }}>
                {marks.map((mark, markIndex) => (
                  <span
                    key={markIndex}
                    className={`self-center text-[12px] font-black tabular-nums leading-none sm:text-[14px] ${
                      isActive ? "text-[#426d33]" : "text-[#4b3d32]"
                    }`}
                  >
                    {mark}
                  </span>
                ))}
              </div>

              <p className={`self-center text-[16px] font-black tabular-nums leading-none sm:text-[19px] ${isActive ? "text-[#426d33]" : "text-[#3f342c]"}`}>
                {result?.cumulativeScore ?? "–"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
