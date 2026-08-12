"use client";

import Link from "next/link";
import { STEPS_SIGN, StepsSignArt } from "@/components/home-scene";
import { useTodaySteps } from "@/lib/use-today-steps";

/**
 * ヒーローカードの下の看板。今日の歩数を出す。
 * 板の絵は StepsSignArt が描き、ここは板の面に載せる文字だけを持つ。
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
      className="relative block w-full active:scale-[0.98]"
      style={{ aspectRatio: STEPS_SIGN.ratio }}
    >
      <StepsSignArt />

      <span className="absolute flex items-center justify-center text-center leading-none" style={STEPS_SIGN.banner}>
        <span className="whitespace-nowrap text-[7px] font-bold tracking-[0.04em] text-white">今日の歩数</span>
      </span>

      <span className="absolute flex flex-col justify-center" style={STEPS_SIGN.panel}>
        <span
          className="flex items-baseline justify-center gap-1 leading-none whitespace-nowrap text-[#4d4032]"
          aria-live="polite"
        >
          <span className="text-[19px] font-bold tabular-nums">
            {steps === null ? "—" : steps.toLocaleString("ja-JP")}
          </span>
          <span className="text-[8px] font-semibold">歩</span>
        </span>
        <span className="mt-1 block truncate text-center text-[6.5px] text-[#80694d]">
          {steps === null ? "ショートカット連携前" : `歩数EXP +${stepExp.toLocaleString("ja-JP")}`}
        </span>
      </span>
    </Link>
  );
}
