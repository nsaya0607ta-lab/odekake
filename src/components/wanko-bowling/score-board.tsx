"use client";

import type { BowlingFrame, BowlingScoreState } from "@/lib/games/wanko-bowling-score";
import { BOWLING_FRAME_COUNT } from "@/lib/games/wanko-bowling-score";

function frameLabel(frame: BowlingFrame, frameIndex: number): string {
  const isLast = frameIndex === BOWLING_FRAME_COUNT - 1;
  if (frame.rolls.length === 0) return "";

  const rollText = (roll: number, isFirstOfFrame: boolean, prevSum: number) => {
    if (roll === 10 && (isFirstOfFrame || prevSum === 0)) return "X";
    if (!isFirstOfFrame && prevSum + roll === 10) return "/";
    return roll === 0 ? "–" : String(roll);
  };

  if (!isLast) {
    const parts: string[] = [];
    const first = frame.rolls[0] ?? 0;
    parts.push(rollText(first, true, 0));
    if (frame.rolls.length >= 2 && first !== 10) {
      parts.push(rollText(frame.rolls[1] ?? 0, false, first));
    }
    return parts.join(" ");
  }

  const parts: string[] = [];
  let runningPrev = 0;
  frame.rolls.forEach((roll, idx) => {
    const isFirstOfSet = idx === 0 || (frame.rolls[idx - 1] ?? -1) === 10 || runningPrev === 10;
    parts.push(rollText(roll, isFirstOfSet, isFirstOfSet ? 0 : runningPrev));
    runningPrev = isFirstOfSet ? roll : runningPrev + roll;
    if (roll === 10 || runningPrev === 10) runningPrev = 0;
  });
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
    <div className="grid grid-cols-5 gap-1.5">
      {frames.map((frame, index) => {
        const isActive = index === currentFrameIndex;
        const result = score.frames[index];
        return (
          <div
            key={index}
            className={`overflow-hidden rounded-[14px] border text-center ${
              isActive ? "border-leaf-deep bg-leaf-soft" : "border-line bg-card"
            }`}
          >
            <p
              className={`px-1 py-0.5 text-[8px] font-black tracking-[0.08em] ${
                isActive ? "text-leaf-deep" : "text-ink-faint"
              }`}
            >
              {index + 1}F
            </p>
            <p className="border-t border-line/70 px-1 py-1 text-[11px] font-black tabular-nums text-ink">
              {frameLabel(frame, index) || "–"}
            </p>
            <p className="border-t border-line/70 px-1 py-1 text-xs font-black tabular-nums text-ink">
              {result?.cumulativeScore ?? "–"}
            </p>
          </div>
        );
      })}
    </div>
  );
}
