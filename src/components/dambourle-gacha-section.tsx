"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatCoins } from "@/lib/coins";
import { DAMBOURLE_LEVEL_CAP, DAMBOURLE_PLANS, DAMBOURLE_RARITIES, DAMBOURLE_RARITY_RATES, type DambourlePlanId } from "@/lib/dambourle/config";
import { getDambourleBoxImage } from "@/lib/dambourle/box-image";
import { DAMBOURLE_PRIZES, getDambourleEffectSummary } from "@/lib/dambourle/prizes";
import { getDambourleLevel, getDambourleMinSkinIndex, getDambourleNextLevelRemaining, getDambourleUnlockedSkinTier } from "@/lib/dambourle/skill-levels";
import { GachaResultModal } from "./gacha-section";
import { primeGachaAudio } from "./gacha/audio";
import type { AnimationDraw, DrawResult } from "./gacha/types";
import { IconClose, IconCoin } from "./icons";

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

type ResultState = {
  plan: DambourlePlanId;
  results: DrawResult[];
};

const DAMBOURLE_COUNT_BY_RARITY = Object.fromEntries(
  DAMBOURLE_RARITIES.map((rarity) => [
    rarity,
    DAMBOURLE_PRIZES.filter((prize) => prize.rarity === rarity).length,
  ]),
) as Record<(typeof DAMBOURLE_RARITIES)[number], number>;

export function DambourleGachaSection({ balance, ownedCounts }: { balance: number; ownedCounts: Readonly<Record<string, number>> }) {
  const router = useRouter();
  const [pending, setPending] = useState<DambourlePlanId | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<DambourlePlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ResultState | null>(null);
  const [animation, setAnimation] = useState<AnimationDraw | null>(null);
  const [duplicateCoins, setDuplicateCoins] = useState(0);
  const inFlight = useRef(false);
  const ownedKinds = DAMBOURLE_PRIZES.filter((prize) => (ownedCounts[prize.id] ?? 0) > 0).length;

  const draw = useCallback(
    async (planId: DambourlePlanId) => {
      if (inFlight.current) return;
      setConfirmPlan(null);
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

  const finishAnimation = useCallback((drawResult: AnimationDraw) => {
    setAnimation(null);
    setResults({ plan: drawResult.plan as DambourlePlanId, results: drawResult.results });
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

  useEffect(() => {
    if (!confirmPlan) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmPlan(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [confirmPlan]);

  const retry = useCallback(() => {
    if (!results) return;
    setConfirmPlan(results.plan);
    setResults(null);
  }, [results]);

  const goToPicker = useCallback(() => {
    window.location.assign("/games/item-catch/dambourle");
  }, []);

  return (
    <section className="space-y-4">
      <div className="rough-card overflow-hidden p-4">
        <div className="flex items-center gap-4">
          <div className="relative h-24 w-28 shrink-0">
            {["dambourle_no4", "dambourle_no10", "dambourle_no11"].map((itemId, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={itemId}
                src={getDambourleBoxImage(itemId, getDambourleMinSkinIndex(itemId))}
                alt=""
                className="absolute h-20 w-20 object-contain drop-shadow-md"
                style={{ left: `${index * 18}px`, top: `${index === 1 ? 0 : 12}px`, zIndex: index === 1 ? 3 : index + 1 }}
              />
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black tracking-[0.16em] text-leaf-deep">ITEM CATCH</p>
            <h2 className="mt-0.5 text-lg font-black text-ink">ダンボールガチャ</h2>
            <p className="mt-1 text-[10px] leading-relaxed text-ink-soft">見た目とミニゲーム効果が異なる全{DAMBOURLE_PRIZES.length}種類。</p>
            <p className="mt-1 text-[10px] font-bold text-leaf-deep">所持 {ownedKinds} / {DAMBOURLE_PRIZES.length}種類</p>
          </div>
        </div>
      </div>

      <div className="rough-card flex items-center justify-between p-3">
        <span className="text-xs font-bold text-ink-soft">所持コイン</span>
        <span className="flex items-center gap-1 text-sm font-black text-ink">
          <IconCoin size={16} />
          {formatCoins(balance)}
        </span>
      </div>

      <div className="rough-card p-3">
        <p className="text-[11px] font-black text-ink">ランク別排出率</p>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {DAMBOURLE_RARITIES.map((rarity) => (
            <div key={rarity} className="rounded-xl bg-paper-deep px-2 py-2 text-center">
              <p className="text-[10px] font-black text-ink">{rarity}</p>
              <p className="mt-0.5 text-xs font-black text-leaf-deep">{DAMBOURLE_RARITY_RATES[rarity]}%</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[9px] leading-relaxed text-ink-faint">同じランク内のダンボールは均等確率で排出されます。</p>
      </div>

      <div className="space-y-2">
        {(Object.keys(DAMBOURLE_PLANS) as DambourlePlanId[]).map((planId) => {
          const plan = DAMBOURLE_PLANS[planId];
          const short = balance < plan.cost;
          return (
            <button
              key={planId}
              type="button"
              onClick={() => setConfirmPlan(planId)}
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
        {balance < DAMBOURLE_PLANS.single.cost ? <p className="text-center text-[10px] font-bold text-ink-faint">コインが足りません</p> : null}
      </div>

      <details className="rough-card overflow-hidden">
        <summary className="cursor-pointer px-4 py-3 text-xs font-black text-ink">排出ダンボール・効果・個別確率を見る</summary>
        <ul className="border-t border-line">
          {DAMBOURLE_PRIZES.map((prize) => {
            const count = ownedCounts[prize.id] ?? 0;
            const level = count > 0 ? getDambourleLevel(prize.rarity, count) : 1;
            const individualRate = DAMBOURLE_RARITY_RATES[prize.rarity] / DAMBOURLE_COUNT_BY_RARITY[prize.rarity];
            const maxSkin = getDambourleUnlockedSkinTier(prize.id, level);
            const remaining = count > 0 ? getDambourleNextLevelRemaining(prize.rarity, count) : null;
            return (
              <li key={prize.id} className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-paper-deep p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getDambourleBoxImage(prize.id, Math.max(getDambourleMinSkinIndex(prize.id), maxSkin))} alt="" className="h-full w-full object-contain" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-black text-ink">{prize.name}</span>
                    <span className="rounded-full bg-ink px-1.5 py-0.5 text-[8px] font-black text-white">{prize.rarity}</span>
                    <span className="text-[9px] font-bold text-ink-faint">{Number(individualRate.toFixed(3))}%</span>
                  </span>
                  <span className="mt-0.5 block text-[9px] font-bold leading-relaxed text-ink-soft">{getDambourleEffectSummary(prize, level)}</span>
                  <span className="mt-0.5 block text-[8px] text-ink-faint">
                    {count > 0
                      ? `所持${count}個・${level >= DAMBOURLE_LEVEL_CAP[prize.rarity] ? "Lv.MAX" : `Lv${level}`}${remaining ? `・次まであと${remaining}個` : ""}`
                      : "未所持"}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </details>

      {error ? <p role="status" className="text-center text-[11px] font-bold text-red-600">{error}</p> : null}

      {confirmPlan && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[130] grid place-items-center bg-[#463b2f]/40 p-5 backdrop-blur-[1px]"
              role="dialog"
              aria-modal="true"
              aria-label="ガチャ確認"
              onClick={() => setConfirmPlan(null)}
            >
              <div className="relative w-full max-w-sm rounded-[28px] border border-line bg-card p-5 text-center shadow-xl" onClick={(event) => event.stopPropagation()}>
                <button type="button" onClick={() => setConfirmPlan(null)} aria-label="とじる" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-paper-deep text-ink-faint"><IconClose size={16} /></button>
                <p className="text-[10px] font-black tracking-[0.16em] text-leaf-deep">ダンボールガチャ</p>
                <h2 className="mt-1 text-lg font-black text-ink">{DAMBOURLE_PLANS[confirmPlan].label}？</h2>
                <p className="mt-3 text-xs text-ink-soft"><span className="font-black text-ink">{formatCoins(DAMBOURLE_PLANS[confirmPlan].cost)}コイン</span>を使用します。</p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setConfirmPlan(null)} className="rounded-full border border-line bg-card px-3 py-3 text-xs font-black text-ink-soft">キャンセル</button>
                  <button type="button" onClick={() => void draw(confirmPlan)} className="rounded-full bg-leaf px-3 py-3 text-xs font-black text-white shadow-md">まわす</button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {results && typeof document !== "undefined"
        ? createPortal(
            <GachaResultModal
              results={results.results}
              plan={results.plan}
              busy={pending !== null}
              onRetry={retry}
              onClose={() => setResults(null)}
              extraActionLabel="ダンボールを選んで装備する"
              onExtraAction={goToPicker}
              footerNote={duplicateCoins > 0 ? `重複還元 +${formatCoins(duplicateCoins)}コイン` : undefined}
            />,
            document.body,
          )
        : null}
      {animation && typeof document !== "undefined" ? createPortal(<GachaCinematic draw={animation} onComplete={finishAnimation} />, document.body) : null}
    </section>
  );
}
