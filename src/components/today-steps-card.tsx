"use client";

import { useTodaySteps } from "@/lib/use-today-steps";

type Props = {
  initialSteps: number | null;
  initialStepExp: number;
  initialCoinBalance: number;
};

export function TodayStepsCard({ initialSteps, initialStepExp, initialCoinBalance }: Props) {
  const { steps, stepExp } = useTodaySteps({
    steps: initialSteps,
    stepExp: initialStepExp,
    coinBalance: initialCoinBalance,
  });

  return (
    <div className="rough-card flex h-full min-h-0 flex-col items-center justify-center overflow-hidden bg-sun-soft/45 p-4 text-center">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[#e8d4aa] bg-card text-2xl shadow-sm">
        👟
      </span>
      <p className="mt-3 whitespace-nowrap text-xs text-ink-soft">今日のおでかけ</p>
      <p className="mt-1 flex items-baseline justify-center gap-1 whitespace-nowrap text-ink" aria-live="polite">
        <span className="text-3xl font-bold tabular-nums">{steps === null ? "—" : steps.toLocaleString("ja-JP")}</span>
        <span className="text-xs text-ink-soft">歩</span>
      </p>
      <p className="mt-3 whitespace-nowrap text-[10px] text-ink-faint">
        {steps === null ? "ショートカット連携前" : `今日の歩数EXP +${stepExp}`}
      </p>
    </div>
  );
}
