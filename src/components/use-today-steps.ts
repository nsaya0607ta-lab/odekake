"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type TodayStepsResponse = {
  ok: boolean;
  todaySteps: number | null;
  todayStepExp: number;
  todayStepCoins: number;
  expectedStepCoins: number;
  coinBalance: number;
  coinRepairApplied: boolean;
};

/**
 * 今日の歩数・歩数EXPを /api/steps/today で最新に保つ。
 *
 * 表示側（おさんぽ看板）から取り出したもので、取得の間隔・タイミングは
 * 以前の TodayStepsCard のまま変えていない。歩数コインの補填も
 * このエンドポイント側で走るので、呼び出しを止めないこと。
 */
export function useTodaySteps({
  initialSteps,
  initialStepExp,
  initialCoinBalance,
}: {
  initialSteps: number | null;
  initialStepExp: number;
  initialCoinBalance: number;
}) {
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

  return { steps, stepExp };
}
