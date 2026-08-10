"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  initialSteps: number | null;
  initialStepExp: number;
  initialCoinBalance: number;
};

type TodayStepsResponse = {
  ok: boolean;
  todaySteps: number | null;
  todayStepExp: number;
  todayStepCoins: number;
  expectedStepCoins: number;
  coinBalance: number;
  coinRepairApplied: boolean;
};

export function TodayStepsCard({ initialSteps, initialStepExp, initialCoinBalance }: Props) {
  const router = useRouter();
  const [steps, setSteps] = useState(initialSteps);
  const [stepExp, setStepExp] = useState(initialStepExp);
  const latestSteps = useRef(initialSteps);
  const latestStepExp = useRef(initialStepExp);
  const latestCoinBalance = useRef(initialCoinBalance);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/steps/today", { cache: "no-store" });
      if (!response.ok) return;

      const body = (await response.json()) as TodayStepsResponse;
      if (!body.ok) return;

      const changed =
        body.todaySteps !== latestSteps.current ||
        body.todayStepExp !== latestStepExp.current ||
        body.coinBalance !== latestCoinBalance.current;

      latestSteps.current = body.todaySteps;
      latestStepExp.current = body.todayStepExp;
      latestCoinBalance.current = body.coinBalance;
      setSteps(body.todaySteps);
      setStepExp(body.todayStepExp);

      // 歩数・EXP・コイン残高のどれかが変わったときだけServer Componentも再取得する。
      if (changed) router.refresh();
    } catch {
      // 一時的な通信失敗では現在表示を維持する。
    }
  }, [router]);

  useEffect(() => {
    void refresh();

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onFocus = () => void refresh();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [refresh]);

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
