"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatCoins } from "@/lib/coins";
import {
  GACHA_DISPLAY_RARITY_RATES,
  GACHA_PLANS,
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
  previousLevel: number;
  newLevel: number;
};

function formatLevelTag(level: number): string {
  return level >= 5 ? "Lv.MAX" : `Lv${level}`;
}

type AnimationDraw = {
  plan: GachaPlanId;
  results: DrawResult[];
};

const RARITY_FRAME_PATHS: Record<GachaRarity, string> = {
  N: "/collection/rarity-frames/n.webp",
  R: "/collection/rarity-frames/r.webp",
  SR: "/collection/rarity-frames/sr.webp",
  SSR: "/collection/rarity-frames/ssr.webp",
  UR: "/collection/rarity-frames/ur.webp",
  LR: "/collection/rarity-frames/lr.webp",
};

function validRarity(rarity: string): GachaRarity {
  return (["N", "R", "SR", "SSR", "UR", "LR"] as const).includes(rarity as GachaRarity)
    ? (rarity as GachaRarity)
    : "N";
}

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

  const rates = GACHA_DISPLAY_RARITY_RATES;

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
  const isSsr = draw.results.some((result) => result.rarity === "SSR" || result.rarity === "UR");
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

  const ssrIsVisible = draw.results
    .slice(0, visibleCount)
    .some((result) => result.rarity === "SSR" || result.rarity === "UR");
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
  const isUr = result.rarity === "UR";

  return (
    <div className="gacha-reference-open absolute inset-0" data-rarity={result.rarity}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/gacha/reference/lucky-paws-open.webp"
        alt="カプセルが開いた様子"
        draggable={false}
        className="absolute inset-0 h-full w-full select-none object-contain"
      />
      <span
        className="gacha-reference-tint pointer-events-none absolute left-[57.2%] top-[62%] h-[25%] w-[18.5%] rounded-b-[50%] rounded-t-[24%]"
        style={isUr ? { background: "#b51f2b", opacity: 0.72 } : undefined}
      />
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
  const rarity = validRarity(result.rarity);
  const gradientId = `capsule-${useId().replaceAll(":", "")}`;
  const size = large ? "h-[112px] w-[112px]" : "h-[52px] w-[52px]";

  return (
    <span className={`gacha-capsule relative block ${size} ${open ? "is-open" : ""}`} data-rarity={rarity} aria-label={`${rarity}カプセル`}>
      {open && result.image && (
        <span className="gacha-capsule-prize pointer-events-none absolute left-1/2 top-[43%] z-[1] flex h-[48%] w-[48%] -translate-x-1/2 -translate-y-1/2 items-center justify-center">
          <PrizeImage result={result} className="h-full w-full" />
        </span>
      )}
      <svg viewBox="0 0 100 100" className="relative z-[2] h-full w-full overflow-visible drop-shadow-[0_7px_5px_rgba(81,70,49,0.18)]" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="12" y1="52" x2="88" y2="94" gradientUnits="userSpaceOnUse">
            {rarity === "UR" ? (
              <>
                <stop stopColor="#ff9a9a" />
                <stop offset="0.48" stopColor="#d73535" />
                <stop offset="1" stopColor="#8f111b" />
              </>
            ) : rarity === "SSR" ? (
              <>
                <stop stopColor="#f7c8d8" />
                <stop offset="0.28" stopColor="#f8df96" />
                <stop offset="0.52" stopColor="#bfe2c3" />
                <stop offset="0.75" stopColor="#acd9ec" />
                <stop offset="1" stopColor="#d8c2ed" />
              </>
            ) : (
              <>
                <stop stopColor={rarity === "N" ? "#dceab8" : rarity === "R" ? "#d9ecf8" : "#fff0b7"} />
                <stop offset="1" stopColor={rarity === "N" ? "#9fc476" : rarity === "R" ? "#76add4" : "#e3b74e"} />
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
        {(rarity === "SSR" || rarity === "UR") && <path d="m77 16 2.4 6.2 6.6 2.4-6.6 2.4-2.4 6.2-2.4-6.2-6.6-2.4 6.6-2.4Z" fill="#fff8ce" />}
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

function RarityResultCard({ result, large = false }: { result: DrawResult; large?: boolean }) {
  const rarity = validRarity(result.rarity);

  return (
    <div
      className={`relative aspect-[561/701] w-full overflow-hidden rounded-[16px] bg-transparent text-center shadow-[0_3px_10px_rgba(94,78,53,0.10)] ${
        large ? "rounded-[22px]" : ""
      }`}
    >
      {/* 図鑑と同じWebPテンプレートを、そのまま同じ拡大率で使用する。 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={RARITY_FRAME_PATHS[rarity]}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full max-w-none select-none object-fill"
        style={{ transform: "scaleX(1.18) scaleY(1.06)" }}
      />

      <div className="relative z-[1] flex h-full w-full flex-col items-center px-[7%] pb-[7%] pt-[13%]">
        <span className={`flex h-[43%] shrink-0 items-center justify-center ${large ? "w-[68%]" : "w-[64%]"}`}>
          <PrizeImage result={result} className="h-full w-full" prominent={large} />
        </span>

        <span className="mt-[1%] flex h-[11%] items-center justify-center gap-1">
          {result.isNew && (
            <span
              className={`rounded-full bg-[#ee7470] font-black tracking-wide text-white shadow-sm ${
                large ? "px-3 py-0.5 text-[11px]" : "px-2 py-0.5 text-[8px]"
              }`}
            >
              NEW{large ? "!" : ""}
            </span>
          )}
          {result.newLevel > result.previousLevel && (
            <span
              className={`rounded-full bg-[#f1c969] font-black tracking-wide text-[#6e4f10] shadow-sm ${
                large ? "px-3 py-0.5 text-[11px]" : "px-2 py-0.5 text-[8px]"
              }`}
            >
              {result.previousLevel > 0 ? `${formatLevelTag(result.previousLevel)}→${formatLevelTag(result.newLevel)}` : formatLevelTag(result.newLevel)}
            </span>
          )}
        </span>

        <p
          className={`mt-[1%] flex min-h-[17%] w-full items-center justify-center line-clamp-2 font-bold leading-tight ${
            rarity === "UR" || rarity === "LR" ? "text-white" : "text-[#514a42]"
          } ${large ? "text-base" : "text-[10px]"}`}
        >
          {result.name}
        </p>
      </div>
    </div>
  );
}

function SingleResult({ result }: { result: DrawResult }) {
  const acquisitionLabel =
    result.id === "summer_frenchie"
      ? "サマースキンをゲット！"
      : result.type === "dog_skin"
        ? "わんこスキンをゲット！"
        : "おもちゃをゲット！";

  return (
    <div className="pt-1 text-center">
      <p className="pr-9 text-[11px] font-bold tracking-[0.18em] text-ink-faint">1回ガチャ</p>
      <h2 className="mt-1 pr-9 text-xl font-black text-[#6e5a3c]">おめでとう！</h2>

      <div className="mx-auto mt-4 w-[76%]">
        <RarityResultCard result={result} large />
      </div>

      <p className="mt-3 text-xs font-bold text-[#927a59]">{acquisitionLabel}</p>
      <p className="mx-auto mt-2 w-fit rounded-full bg-[#f7f1e7] px-3 py-1 text-[10px] text-[#9b896f]">
        {result.isNew ? "所持アイテムに追加されました" : "すでに持っているアイテムです"}
      </p>
      {result.newLevel > result.previousLevel && (
        <p className="mx-auto mt-2 w-fit rounded-full bg-[#fff1cf] px-3 py-1 text-[10px] font-bold text-[#a67c2d]">
          スキルレベルアップ！{result.previousLevel > 0 ? `${formatLevelTag(result.previousLevel)} → ${formatLevelTag(result.newLevel)}` : formatLevelTag(result.newLevel)}
        </p>
      )}
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
  return <RarityResultCard result={result} />;
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
