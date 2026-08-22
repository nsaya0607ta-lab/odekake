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
    return parts.join(" ");
  }

  const parts: string[] = [];

  if (first === 10) {
    parts.push("X");
    if (second === undefined) return parts.join(" ");

    parts.push(second === 10 ? "X" : normalMark(second));
    if (third === undefined) return parts.join(" ");

    if (second === 10) {
      parts.push(third === 10 ? "X" : normalMark(third));
    } else {
      parts.push(second + third === 10 ? "/" : normalMark(third));
    }
    return parts.join(" ");
  }

  parts.push(normalMark(first));
  if (second === undefined) return parts.join(" ");

  const firstSetIsSpare = first + second === 10;
  parts.push(firstSetIsSpare ? "/" : normalMark(second));

  if (third !== undefined) {
    // 最終フレームのスペア後は新しい10本で投げるため、10本ならストライク表記。
    parts.push(third === 10 ? "X" : normalMark(third));
  }

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
              className={`px-1 py-1 text-[9px] font-black tracking-[0.06em] ${
                isActive ? "text-leaf-deep" : "text-ink-faint"
              }`}
            >
              {index + 1}F
            </p>
            <p className="border-t border-line/70 px-1 py-1.5 text-[13px] font-black tabular-nums leading-none text-ink">
              {frameLabel(frame, index) || "–"}
            </p>
            <p className="border-t border-line/70 px-1 py-1.5 text-sm font-black tabular-nums leading-none text-ink">
              {result?.cumulativeScore ?? "–"}
            </p>
          </div>
        );
      })}
    </div>
  );
}
