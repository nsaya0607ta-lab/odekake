"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatCoins } from "@/lib/coins";
import { DAMBOURLE_PLANS, type DambourlePlanId } from "@/lib/dambourle/config";
import { DambourleMachineArt, SparkleArt } from "./coin-art";
import { GachaResultModal } from "./gacha-section";
import { primeGachaAudio } from "./gacha/audio";
import type { AnimationDraw, DrawResult } from "./gacha/types";
import { IconCoin } from "./icons";

const GachaCinematic = dynamic(
  () => import("./gacha/gacha-cinematic").then((module) => module.GachaCinematic),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-[140] grid place-items-center bg-[#070807] text-sm font-black tracking-[0.12em] text-white">
        演出準備中…
      </div>
    ),
  },
);

/** ダンボール自身のスキルLv上限（No.11だけ5、それ以外は70）。結果画面の「Lv.MAX」判定に使う */
const DAMBOURLE_RESULT_MAX_LEVEL = 70;

type ResultState = {
  plan: DambourlePlanId;
  results: DrawResult[];
};

export function DambourleGachaSection({ balance }: { balance: number }) {
  const router = useRouter();
  const [pending, setPending] = useState<DambourlePlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ResultState | null>(null);
  const [animation, setAnimation] = useState<AnimationDraw | null>(null);
  const [duplicateCoins, setDuplicateCoins] = useState(0);
  const inFlight = useRef(false);

  const draw = useCallback(
    async (planId: DambourlePlanId) => {
      if (inFlight.current) return;
      primeGachaAudio();
      inFlight.current = true;
      setPending(planId);
      setError(null);

      try {
        const response = await fetch("/api/dambourle-gacha", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: planId, requestId: crypto.randomUUID() }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { results?: DrawResult[]; duplicateCoins?: number; error?: string }
          | null;
        if (!response.ok) {
          setError(payload?.error ?? "ガチャをまわせませんでした。");
          return;
        }

        const confirmedResults = payload?.results ?? [];
        setDuplicateCoins(payload?.duplicateCoins ?? 0);
        setAnimation({ plan: planId, results: confirmedResults });
        router.refresh();
      } catch {
        setError("通信に失敗しました。");
      }
    },
    [router],
  );

  const finishAnimation = useCallback((draw: AnimationDraw) => {
    setAnimation(null);
    setResults({ plan: draw.plan as DambourlePlanId, results: draw.results });
    inFlight.current = false;
    setPending(null);
  }, []);

  const failAndUnlock = useCallback(() => {
    inFlight.current = false;
    setPending(null);
  }, []);

  useEffect(() => {
    if (!error || animation) return;
    failAndUnlock();
  }, [animation, error, failAndUnlock]);

  const closeResults = useCallback(() => {
    setResults(null);
  }, []);

  const retry = useCallback(() => {
    if (!results) return;
    const { plan } = results;
    setResults(null);
    void draw(plan);
  }, [draw, results]);

  return (
    <div className="space-y-3">
      <section className="rough-card flex min-w-0 flex-col overflow-hidden p-3.5">
        <h2 className="flex items-center gap-1 text-[15px] font-bold">
          <SparkleArt className="w-3.5 shrink-0 text-sun" />
          <span className="min-w-0 truncate">ダンボールガチャ</span>
        </h2>

        <div className="mt-2 flex min-h-0 flex-1 items-start gap-0.5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] leading-[1.65] text-ink-soft">
              <span className="block whitespace-nowrap">コインをつかって</span>
              <span className="block whitespace-nowrap">アイテムキャッチのダンボールをゲット！</span>
            </p>
            <p className="mt-1.5 flex items-center gap-1 text-[9px] font-bold text-ink-faint">
              <IconCoin size={11} />
              所持 {formatCoins(balance)}
            </p>
          </div>
          <span className="flex h-[88px] w-[44%] shrink-0 items-end justify-center">
            <DambourleMachineArt className="h-full w-auto" />
          </span>
        </div>
      </section>

      <div className="space-y-2">
        {(Object.keys(DAMBOURLE_PLANS) as DambourlePlanId[]).map((planId) => {
          const plan = DAMBOURLE_PLANS[planId];
          const short = balance < plan.cost;
          return (
            <button
              key={planId}
              type="button"
              onClick={() => void draw(planId)}
              disabled={pending !== null || short}
              className="flex w-full items-center justify-between rounded-full bg-leaf px-4 py-3 text-sm font-black text-white shadow-md active:translate-y-px disabled:opacity-45"
            >
              <span>{pending === planId ? "まわしています…" : plan.label}</span>
              <span className="flex items-center gap-1">
                <IconCoin size={13} />
                {formatCoins(plan.cost)}
              </span>
            </button>
          );
        })}
      </div>

      {error ? <p role="status" className="text-center text-[11px] text-blossom">{error}</p> : null}

      {results &&
        createPortal(
          <GachaResultModal
            results={results.results}
            plan={results.plan}
            busy={pending !== null}
            onRetry={retry}
            onClose={closeResults}
            maxLevel={DAMBOURLE_RESULT_MAX_LEVEL}
            footerNote={duplicateCoins > 0 ? `重複還元 +${formatCoins(duplicateCoins)}コイン` : undefined}
          />,
          document.body,
        )}
      {animation && createPortal(<GachaCinematic draw={animation} onComplete={finishAnimation} />, document.body)}
    </div>
  );
}
