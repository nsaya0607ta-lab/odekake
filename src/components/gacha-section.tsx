"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatCoins } from "@/lib/coins";
import {
  GACHA_PLANS,
  GACHA_RARITY_RATES,
  RARITY_STYLES,
  type GachaPlanId,
  type GachaRarity,
} from "@/lib/gacha/config";
import { GachaMachineArt, SparkleArt } from "./coin-art";
import { IconClose, IconCoin } from "./icons";

type DrawResult = {
  id: string;
  name: string;
  rarity: string;
  type: string;
  image: string | null;
  isNew: boolean;
};

type AnimationDraw = {
  plan: GachaPlanId;
  results: DrawResult[];
};

/** iOS Safariを含め、モーダル表示中に背面ページがスクロールしないよう固定する。 */
function useBodyScrollLock() {
  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      overscrollBehavior: root.style.overscrollBehavior,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      root.style.overscrollBehavior = previous.overscrollBehavior;
      window.scrollTo(0, scrollY);
    };
  }, []);
}

function rarityStyle(rarity: string) {
  return RARITY_STYLES[rarity as GachaRarity] ?? RARITY_STYLES.N;
}

function rarityTheme(rarity: string) {
  switch (rarity) {
    case "SSR":
      return {
        panel: "border-[#dfbdd7] bg-gradient-to-b from-[#fff4fb] via-[#fff9e7] to-[#eee8ff]",
        badge: "border-[#d8b4cf] bg-[#f6d9ed] text-[#8d5079]",
        glow: "bg-[#efcce2]/45",
      };
    case "SR":
      return {
        panel: "border-[#e7c96e] bg-gradient-to-b from-[#fff9e8] via-[#fffdf6] to-[#f6e9bd]",
        badge: "border-[#d8b653] bg-[#f5d56c] text-[#79591c]",
        glow: "bg-[#f4d86f]/45",
      };
    case "R":
      return {
        panel: "border-[#bfd6e8] bg-gradient-to-b from-[#f4fbff] to-[#e8f3fb]",
        badge: "border-[#b4cee3] bg-[#dcecf8] text-[#527694]",
        glow: "bg-[#bcdcf0]/35",
      };
    default:
      return {
        panel: "border-[#dfd7ca] bg-gradient-to-b from-[#fbf8f1] to-[#f0ebe2]",
        badge: "border-[#d4cbbd] bg-[#e9e3d9] text-ink-soft",
        glow: "bg-[#d9d0c4]/30",
      };
  }
}

export function GachaSection({ balance }: { balance: number }) {
  const router = useRouter();
  const [pending, setPending] = useState<GachaPlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DrawResult[] | null>(null);
  const [animation, setAnimation] = useState<AnimationDraw | null>(null);
  const [lastPlan, setLastPlan] = useState<GachaPlanId>("single");
  const inFlight = useRef(false);

  const draw = useCallback(
    async (planId: GachaPlanId) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setPending(planId);
      setError(null);

      try {
        const response = await fetch("/api/gacha", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan: planId,
            requestId: crypto.randomUUID(),
          }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { results?: DrawResult[]; error?: string }
          | null;

        if (!response.ok) {
          setError(payload?.error ?? "ガチャをまわせませんでした。");
          return;
        }

        const confirmedResults = payload?.results ?? [];
        setLastPlan(planId);
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
    setLastPlan(draw.plan);
    setResults(draw.results);
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
    setResults(null);
    void draw(lastPlan);
  }, [draw, lastPlan]);

  const rates = GACHA_RARITY_RATES;

  return (
    <section className="rough-card flex min-w-0 flex-col overflow-hidden p-3.5">
      <h2 className="flex items-center gap-1 text-[15px] font-bold">
        <SparkleArt className="w-3.5 shrink-0 text-sun" />
        <span className="min-w-0 truncate">コインでガチャ</span>
      </h2>

      <div className="mt-2 flex min-h-0 flex-1 items-start gap-0.5">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] leading-[1.65] text-ink-soft">
            <span className="block whitespace-nowrap">コインをつかって</span>
            <span className="block whitespace-nowrap">おもちゃやシリーズアイテムをゲット！</span>
          </p>
          <p className="mt-1 text-[9px] font-semibold text-ink-faint">すべて同じガチャから出ます</p>
          <p className="mt-1.5 flex items-center gap-1 text-[9px] font-bold text-ink-faint">
            <IconCoin size={11} />
            所持 {formatCoins(balance)}
          </p>
        </div>
        <span className="flex h-[88px] w-[44%] shrink-0 items-end justify-center">
          <GachaMachineArt className="h-full w-auto" />
        </span>
      </div>

      <div className="mt-1 flex flex-wrap gap-x-1.5 gap-y-0.5 text-[8px] text-ink-faint" aria-label="排出率">
        {(Object.keys(rates) as GachaRarity[]).map((rarity) =>
          rates[rarity] > 0 ? (
            <span key={rarity} className="whitespace-nowrap">
              <span className={`font-bold ${rarityStyle(rarity).text}`}>{rarity}</span> {rates[rarity]}%
            </span>
          ) : null,
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        {(Object.keys(GACHA_PLANS) as GachaPlanId[]).map((planId) => {
          const plan = GACHA_PLANS[planId];
          const short = balance < plan.cost;
          return (
            <button
              key={planId}
              type="button"
              onClick={() => void draw(planId)}
              disabled={pending !== null || short}
              className="flex w-full items-center justify-between rounded-full bg-leaf px-3 py-2 text-white shadow-sm transition active:translate-y-px disabled:opacity-45"
            >
              <span className="text-[11px] font-bold">
                {pending === planId ? "まわしています…" : plan.label}
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold tabular-nums">
                <IconCoin size={12} />
                {formatCoins(plan.cost)}
              </span>
            </button>
          );
        })}
      </div>

      {balance < GACHA_PLANS.single.cost && !error && (
        <p className="mt-1.5 text-center text-[9px] text-ink-faint">コインが足りません</p>
      )}
      {error && (
        <p className="mt-1.5 text-center text-[9px] font-bold text-red-600" role="status">
          {error}
        </p>
      )}

      {results &&
        createPortal(
          <GachaResultModal
            results={results}
            plan={lastPlan}
            busy={pending !== null}
            onRetry={retry}
            onClose={closeResults}
          />,
          document.body,
        )}
      {animation && createPortal(<GachaAnimationModal draw={animation} onComplete={finishAnimation} />, document.body)}
    </section>
  );
}

function GachaAnimationModal({
  draw,
  onComplete,
}: {
  draw: AnimationDraw;
  onComplete: (draw: AnimationDraw) => void;
}) {
  useBodyScrollLock();
  const isMulti = draw.plan === "multi";
  const isSsr = draw.results.some((result) => result.rarity === "SSR");
  const [visibleCount, setVisibleCount] = useState(0);
  const [singlePhase, setSinglePhase] = useState<"machine" | "capsule" | "open">("machine");
  const completed = useRef(false);
  const drawRef = useRef(draw);
  const completeRef = useRef(onComplete);

  useEffect(() => {
    drawRef.current = draw;
    completeRef.current = onComplete;
  }, [draw, onComplete]);

  const complete = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    completeRef.current(drawRef.current);
  }, []);

  const ssrIsVisible = draw.results.slice(0, visibleCount).some((result) => result.rarity === "SSR");
  const currentResult = isMulti && visibleCount > 0 ? draw.results[visibleCount - 1] : null;

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (callback: () => void, delay: number) => {
      timers.push(setTimeout(callback, delay));
    };

    if (reduced) {
      setVisibleCount(draw.results.length);
      setSinglePhase("open");
      later(complete, 450);
    } else if (isMulti) {
      draw.results.forEach((_, index) => {
        later(() => setVisibleCount(index + 1), 850 + index * 520);
      });
      later(complete, 850 + draw.results.length * 520 + 650);
    } else {
      later(() => {
        setVisibleCount(1);
        setSinglePhase("capsule");
      }, 900);
      later(() => setSinglePhase("open"), 1900);
      later(complete, isSsr ? 3200 : 2700);
    }

    return () => timers.forEach(clearTimeout);
  }, [complete, draw.results, isMulti, isSsr]);

  return (
    <div
      className={`gacha-animation-backdrop fixed inset-0 z-[120] flex items-center justify-center overscroll-none p-4 ${ssrIsVisible ? "gacha-ssr-flash" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={isMulti ? "10連ガチャ演出" : "1回ガチャ演出"}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-[#e6d9bf] bg-[#fffdf7] px-3.5 pb-5 pt-4 shadow-[0_22px_60px_rgba(74,58,37,0.24)] sm:px-5">
        {isMulti && (
          <button
            type="button"
            onClick={complete}
            className="absolute right-3 top-3 z-20 rounded-full border border-[#b9cba8] bg-white/90 px-3 py-1.5 text-[11px] font-bold text-leaf shadow-sm active:translate-y-px"
          >
            ▶ スキップ
          </button>
        )}

        <div className="text-center">
          <p className="text-[10px] font-bold tracking-[0.16em] text-[#a18e70]">{isMulti ? "10連ガチャ" : "1回ガチャ"}</p>
          <h2 className="mt-1 text-lg font-black text-[#6e5a3c]">
            {isMulti ? `${visibleCount} / ${draw.results.length} カプセル` : singlePhase === "open" ? "カプセル OPEN！" : "ガチャガチャ…"}
          </h2>
        </div>

        <div className="gacha-scene relative mt-2 aspect-video overflow-hidden rounded-[24px] border border-[#eee4cf] bg-[#fbf6ed]">
          {!isMulti && singlePhase === "open" && draw.results[0] ? (
            <ReferenceOpenScene result={draw.results[0]} />
          ) : (
            <>
              <span className={`gacha-machine-stage absolute left-[29%] top-[2%] h-[95%] -translate-x-1/2 ${singlePhase === "machine" || isMulti ? "is-running" : ""}`}>
                <GachaMachineArt className="h-full w-auto select-none object-contain" />
                <span className={`gacha-knob absolute left-[66%] top-[64%] h-10 w-10 -translate-x-1/2 rounded-full ${singlePhase === "machine" || isMulti ? "is-turning" : ""}`} />
              </span>

              {!isMulti && visibleCount > 0 && draw.results[0] && (
                <div className="gacha-capsule-rollout absolute bottom-5 right-[6%]">
                  <Capsule result={draw.results[0]} large />
                </div>
              )}

              {currentResult && (
                <div key={`${currentResult.id}-${visibleCount}`} className="gacha-capsule-rollout gacha-capsule-sequence absolute bottom-5 right-[8%]">
                  <Capsule result={currentResult} large />
                </div>
              )}

              <span className="absolute bottom-3 left-[4%] right-[4%] h-2 rounded-[50%] bg-[#d9c7a4]/25 blur-sm" />
              <span className="gacha-motion-line absolute bottom-[72px] right-[37%] h-px w-7 bg-[#bfa77f]/65" />
              <span className="gacha-motion-line absolute bottom-[58px] right-[34%] h-px w-5 bg-[#bfa77f]/55" />
            </>
          )}
        </div>

        {isMulti ? (
          <ol className="mt-4 grid grid-cols-5 gap-x-1.5 gap-y-3" aria-label="排出されたカプセル">
            {draw.results.map((result, index) => {
              const visible = index < visibleCount;
              return (
                <li key={`${result.id}-${index}`} className="flex min-w-0 flex-col items-center">
                  <span className="mb-1 text-[9px] font-bold text-[#9a896f]">{index + 1}</span>
                  <span className={visible ? "gacha-capsule-pop" : "opacity-0"}>
                    <Capsule result={result} />
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-3 text-center text-[11px] font-bold text-[#8d7c62]" aria-live="polite">
            {singlePhase === "machine" ? "つまみを回しています" : singlePhase === "capsule" ? "カプセルが出てきた！" : "景品を確認中…"}
          </p>
        )}

        {ssrIsVisible && (
          <div className="gacha-ssr-sparkles pointer-events-none absolute inset-0" aria-hidden="true">
            <SparkleArt className="absolute left-[12%] top-[18%] w-5 text-[#f0c95b]" />
            <SparkleArt className="absolute right-[11%] top-[31%] w-4 text-[#e69fc9]" />
            <SparkleArt className="absolute bottom-[18%] left-[18%] w-3 text-[#91cdd8]" />
            <SparkleArt className="absolute bottom-[11%] right-[15%] w-5 text-[#d0b6e8]" />
          </div>
        )}
      </div>
    </div>
  );
}

function ReferenceOpenScene({ result }: { result: DrawResult }) {
  return (
    <div className="gacha-reference-open absolute inset-0" data-rarity={result.rarity}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/gacha/reference/lucky-paws-open.webp"
        alt="カプセルが開いた様子"
        draggable={false}
        className="absolute inset-0 h-full w-full select-none object-contain"
      />
      <span className="gacha-reference-tint pointer-events-none absolute left-[57.2%] top-[62%] h-[25%] w-[18.5%] rounded-b-[50%] rounded-t-[24%]" />
      <span className="gacha-reference-prize absolute left-[66.7%] top-[63%] flex h-[19%] w-[15%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#fff8e9]/90 shadow-[0_0_18px_rgba(255,242,183,.9)]">
        <PrizeImage result={result} className="h-[92%] w-[92%]" />
      </span>
      <span className="absolute right-[4%] top-[7%] rounded-full border border-white/80 bg-white/85 px-2.5 py-1 text-[10px] font-black text-[#7a654c] shadow-sm">
        {result.rarity}
      </span>
    </div>
  );
}

function Capsule({ result, open = false, large = false }: { result: DrawResult; open?: boolean; large?: boolean }) {
  const validRarity = (["N", "R", "SR", "SSR"] as const).includes(result.rarity as GachaRarity)
    ? (result.rarity as GachaRarity)
    : "N";
  const gradientId = `capsule-${useId().replaceAll(":", "")}`;
  const size = large ? "h-[112px] w-[112px]" : "h-[52px] w-[52px]";

  return (
    <span className={`gacha-capsule relative block ${size} ${open ? "is-open" : ""}`} data-rarity={validRarity} aria-label={`${validRarity}カプセル`}>
      {open && result.image && (
        <span className="gacha-capsule-prize pointer-events-none absolute left-1/2 top-[43%] z-[1] flex h-[48%] w-[48%] -translate-x-1/2 -translate-y-1/2 items-center justify-center">
          <PrizeImage result={result} className="h-full w-full" />
        </span>
      )}
      <svg viewBox="0 0 100 100" className="relative z-[2] h-full w-full overflow-visible drop-shadow-[0_7px_5px_rgba(81,70,49,0.18)]" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="12" y1="52" x2="88" y2="94" gradientUnits="userSpaceOnUse">
            {validRarity === "SSR" ? (
              <>
                <stop stopColor="#f7c8d8" />
                <stop offset="0.28" stopColor="#f8df96" />
                <stop offset="0.52" stopColor="#bfe2c3" />
                <stop offset="0.75" stopColor="#acd9ec" />
                <stop offset="1" stopColor="#d8c2ed" />
              </>
            ) : (
              <>
                <stop stopColor={validRarity === "N" ? "#dceab8" : validRarity === "R" ? "#d9ecf8" : "#fff0b7"} />
                <stop offset="1" stopColor={validRarity === "N" ? "#9fc476" : validRarity === "R" ? "#76add4" : "#e3b74e"} />
              </>
            )}
          </linearGradient>
        </defs>
        <g className="gacha-capsule-top">
          <path d="M10 48a40 40 0 0 1 80 0Z" fill="#f8fdff" fillOpacity=".54" stroke="#9aa4a6" strokeWidth="2" />
          <path d="M24 28c8-10 20-14 31-11" fill="none" stroke="white" strokeWidth="7" strokeLinecap="round" opacity=".9" />
          <path d="M71 20c7 6 11 13 13 21" fill="none" stroke="#dbe5e7" strokeWidth="3" strokeLinecap="round" opacity=".7" />
        </g>
        <g className="gacha-capsule-bottom">
          <path d="M10 52a40 40 0 0 0 80 0Z" fill={`url(#${gradientId})`} stroke="#8e826c" strokeWidth="2" />
          <path d="M17 54h66" stroke="white" strokeWidth="3" opacity=".48" />
          <path d="M24 70c5 12 14 17 25 19" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" opacity=".26" />
        </g>
        <rect x="8" y="47" width="84" height="7" rx="3.5" fill="#fffdf5" fillOpacity=".9" stroke="#8e826c" strokeWidth="1.5" />
        {validRarity === "SSR" && <path d="m77 16 2.4 6.2 6.6 2.4-6.6 2.4-2.4 6.2-2.4-6.2-6.6-2.4 6.6-2.4Z" fill="#fff8ce" />}
      </svg>
    </span>
  );
}

function GachaResultModal({
  results,
  plan,
  busy,
  onRetry,
  onClose,
}: {
  results: DrawResult[];
  plan: GachaPlanId;
  busy: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  useBodyScrollLock();
  const only = plan === "single" && results.length === 1 ? results[0] : null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto overscroll-none bg-[#463b2f]/35 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="ガチャ結果"
    >
      <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-sm touch-pan-y overflow-y-auto overscroll-contain rounded-[28px] border border-[#eadfc8] bg-[#fffdf8] p-4 shadow-[0_18px_50px_rgba(75,56,36,0.22)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="とじる"
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-ink-faint shadow-sm"
        >
          <IconClose size={17} />
        </button>

        {only ? <SingleResult result={only} /> : <MultiResult results={results} />}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onRetry}
            disabled={busy}
            className="rounded-full bg-leaf px-3 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-45"
          >
            {plan === "multi" ? "もう10連まわす" : "もう1回まわす"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line-strong bg-card px-3 py-2.5 text-xs font-bold text-ink-soft"
          >
            とじる
          </button>
        </div>
      </div>
    </div>
  );
}

function SingleResult({ result }: { result: DrawResult }) {
  const theme = rarityTheme(result.rarity);
  const acquisitionLabel =
    result.id === "summer_frenchie"
      ? "サマースキンをゲット！"
      : result.type === "dog_skin"
        ? "わんこスキンをゲット！"
        : "おもちゃをゲット！";

  return (
    <div className={`relative overflow-hidden rounded-[24px] border p-4 ${theme.panel}`}>
      <span className={`pointer-events-none absolute left-1/2 top-[42%] h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl ${theme.glow}`} />
      <DecorativeSparkles />

      <div className="relative z-10 flex flex-col items-center text-center">
        <span className={`rounded-full border px-4 py-1 text-base font-black tracking-[0.12em] ${theme.badge}`}>
          {result.rarity}
        </span>
        <p className="mt-2 text-[22px] font-black tracking-wide text-[#6e5a3c]">おめでとう！</p>

        <div className="relative mt-3 flex h-44 w-44 items-center justify-center rounded-full border border-white/80 bg-white/55 shadow-[0_10px_28px_rgba(158,122,48,0.14)]">
          <PrizeImage result={result} className="h-36 w-36" prominent />
        </div>

        <span className="mt-2 flex h-6 items-center">
          {result.isNew && (
            <span className="-rotate-3 rounded-full bg-[#ee7470] px-3 py-0.5 text-[11px] font-black tracking-wide text-white shadow-sm">
              NEW!
            </span>
          )}
        </span>

        <p className="mt-1 text-xl font-black text-[#5b4934]">{result.name}</p>
        <p className="mt-1 text-xs font-bold text-[#927a59]">{acquisitionLabel}</p>
        <p className="mt-3 rounded-full bg-white/55 px-3 py-1 text-[10px] text-[#9b896f]">
          {result.isNew ? "所持アイテムに追加されました" : "すでに持っているアイテムです"}
        </p>
      </div>
    </div>
  );
}

function MultiResult({ results }: { results: DrawResult[] }) {
  return (
    <div>
      <div className="pr-9 text-center">
        <p className="text-[11px] font-bold tracking-[0.18em] text-ink-faint">10連ガチャ</p>
        <h2 className="mt-1 text-xl font-black text-[#6e5a3c]">結果発表！</h2>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2.5">
        {results.map((result, index) => (
          <li key={`${result.id}-${index}`}>
            <ResultCard result={result} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResultCard({ result }: { result: DrawResult }) {
  const theme = rarityTheme(result.rarity);
  return (
    <div className={`relative flex min-h-[142px] flex-col items-center overflow-hidden rounded-2xl border p-2.5 text-center ${theme.panel}`}>
      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${theme.badge}`}>{result.rarity}</span>
      <PrizeImage result={result} className="mt-1.5 h-16 w-16" />
      <span className="mt-1 flex h-4 items-center">
        {result.isNew && (
          <span className="rounded-full bg-[#ee7470] px-1.5 py-0.5 text-[8px] font-black text-white">NEW</span>
        )}
      </span>
      <p className="mt-0.5 w-full truncate text-[10px] font-bold text-[#5b4934]">{result.name}</p>
    </div>
  );
}

function DecorativeSparkles() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <SparkleArt className="absolute left-[9%] top-[18%] w-4 -rotate-12 text-[#e6bc4f]" />
      <SparkleArt className="absolute right-[10%] top-[24%] w-3 rotate-12 text-[#e9c968]" />
      <SparkleArt className="absolute left-[14%] top-[52%] w-2.5 text-[#f0cf70]" />
      <SparkleArt className="absolute right-[13%] top-[57%] w-4 rotate-12 text-[#e6bc4f]" />
      <span className="absolute left-[19%] top-[34%] h-2 w-2 rounded-full bg-[#f2a8a2]" />
      <span className="absolute right-[20%] top-[41%] h-2 w-2 rounded-full bg-[#a9cee7]" />
      <span className="absolute left-[25%] top-[70%] h-1.5 w-1.5 rotate-45 bg-[#b9d8ad]" />
      <span className="absolute right-[27%] top-[72%] h-1.5 w-1.5 rotate-45 bg-[#efbe88]" />
    </div>
  );
}

function PrizeImage({
  result,
  className,
  prominent = false,
}: {
  result: DrawResult;
  className: string;
  prominent?: boolean;
}) {
  if (!result.image) {
    return (
      <span
        className={`flex shrink-0 flex-col items-center justify-center rounded-2xl border border-dashed border-[#d7c8ad] bg-white/60 text-[#b2a188] ${className}`}
        aria-label={`${result.name}の画像は準備中です`}
      >
        <span className={prominent ? "text-4xl font-black" : "text-xl font-black"}>?</span>
        {prominent && <span className="mt-1 text-[9px] font-bold">画像準備中</span>}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={result.image} alt={result.name} draggable={false} className={`shrink-0 select-none object-contain ${className}`} />
  );
}
