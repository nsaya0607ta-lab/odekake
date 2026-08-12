"use client";

import Link from "next/link";
import { STEPS_BANNER, STEPS_BOARD, STEPS_PANEL } from "@/components/home-scene";
import { useTodaySteps } from "@/lib/use-today-steps";

/**
 * 背景の絵に描かれている下の看板へ、今日の歩数を書き込む。
 * 位置は home-scene.tsx の実測値に合わせてあるので、勝手にずらさない。
 */
export function StepsTag({
  initialSteps,
  initialStepExp,
  initialCoinBalance,
}: {
  initialSteps: number | null;
  initialStepExp: number;
  initialCoinBalance: number;
}) {
  const { steps, stepExp } = useTodaySteps({
    steps: initialSteps,
    stepExp: initialStepExp,
    coinBalance: initialCoinBalance,
  });

  return (
    <Link
      href="/mypage/step-sync"
      aria-label={
        steps === null ? "今日の歩数は未連携。歩数の連携設定を開く" : `今日の歩数 ${steps}歩。歩数の連携設定を開く`
      }
      className="absolute z-10 block active:scale-[0.98]"
      style={STEPS_BOARD}
    >
      <span className="absolute flex items-center justify-center" style={STEPS_BANNER}>
        <span className="whitespace-nowrap text-[7px] leading-none font-bold tracking-[0.04em] text-white">
          今日の歩数
        </span>
      </span>

      <span className="absolute flex flex-col justify-center" style={STEPS_PANEL}>
        <span
          className="flex items-baseline justify-center gap-1 leading-none whitespace-nowrap text-[#5b4a35]"
          aria-live="polite"
        >
          <span className="text-[19px] font-bold tabular-nums">
            {steps === null ? "—" : steps.toLocaleString("ja-JP")}
          </span>
          <span className="text-[8px] font-semibold">歩</span>
        </span>
        <span className="mt-1 block truncate text-center text-[6.5px] leading-none text-[#8b7355]">
          {steps === null ? "ショートカット連携前" : `歩数EXP +${stepExp.toLocaleString("ja-JP")}`}
        </span>
      </span>
    </Link>
  );
}
