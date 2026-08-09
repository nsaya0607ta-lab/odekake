"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatCoins } from "@/lib/coins";
import { IconCoin, IconLock } from "./icons";

type Props = {
  initialSteps: number | null;
  initialStepExp: number;
  initialCoinBalance: number;
  /** 次に解放できる報酬の名前。すべて解放済みなら null */
  nextRewardName: string | null;
  /** 次の報酬の解放に必要なコイン */
  nextRewardCost: number;
};

type TodayStepsResponse = {
  ok: boolean;
  todaySteps: number | null;
  todayStepExp: number;
  coinBalance: number;
};

export function TodayStepsCard({
  initialSteps,
  initialStepExp,
  initialCoinBalance,
  nextRewardName,
  nextRewardCost,
}: Props) {
  const router = useRouter();
  const [steps, setSteps] = useState(initialSteps);
  const [stepExp, setStepExp] = useState(initialStepExp);
  const [coinBalance, setCoinBalance] = useState(initialCoinBalance);
  const latestSteps = useRef(initialSteps);
  const latestStepExp = useRef(initialStepExp);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/steps/today", { cache: "no-store" });
      if (!response.ok) return;

      const body = (await response.json()) as TodayStepsResponse;
      if (!body.ok) return;

      const changed =
        body.todaySteps !== latestSteps.current || body.todayStepExp !== latestStepExp.current;

      latestSteps.current = body.todaySteps;
      latestStepExp.current = body.todayStepExp;
      setSteps(body.todaySteps);
      setStepExp(body.todayStepExp);
      setCoinBalance(body.coinBalance);

      // 歩数EXPでレベル札も変わるため、歩数が更新されたときだけServer Componentも再取得する。
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
    <div className="rough-card flex h-full min-h-0 flex-col items-center justify-center overflow-hidden bg-sun-soft/45 p-3 text-center">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#e8d4aa] bg-card text-xl shadow-sm">
        👟
      </span>
      <p className="mt-2 whitespace-nowrap text-[11px] text-ink-soft">今日のおでかけ</p>
      <p className="mt-0.5 flex items-baseline justify-center gap-1 whitespace-nowrap text-ink" aria-live="polite">
        <span className="text-3xl font-bold tabular-nums">{steps === null ? "—" : steps.toLocaleString("ja-JP")}</span>
        <span className="text-xs text-ink-soft">歩</span>
      </p>
      <p className="mt-1 whitespace-nowrap text-[10px] text-ink-faint">
        {steps === null ? "ショートカット連携前" : `今日の歩数EXP +${stepExp}`}
      </p>

      <div className="mt-2.5 w-full space-y-1.5">
        <div className="rounded-xl border border-dashed border-[#e0cba4] px-2 py-1.5 text-left">
          <p className="flex min-w-0 items-center gap-1 text-[10px] text-ink-soft">
            <IconLock size={12} className="shrink-0 text-ink-faint" />
            <span className="min-w-0 truncate">
              次に解放：<span className="font-bold text-ink">{nextRewardName ?? "すべて解放済み"}</span>
            </span>
          </p>
          {nextRewardName ? (
            <p className="mt-1 flex min-w-0 items-center gap-1 text-[10px] text-ink-soft">
              <IconCoin size={12} className="shrink-0" />
              <span className="min-w-0 truncate">
                必要コイン：
                <span className="font-bold tabular-nums text-ink">{formatCoins(nextRewardCost)}</span>
              </span>
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 items-center gap-1 rounded-xl border border-[#e8d4aa] bg-card/80 px-2 py-1.5 text-left">
          <IconCoin size={12} className="shrink-0" />
          <span className="min-w-0 truncate text-[10px] text-ink-soft">
            所持コイン：
            <span className="font-bold tabular-nums text-ink">{formatCoins(coinBalance)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
