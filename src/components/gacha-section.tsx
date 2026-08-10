"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { formatCoins } from "@/lib/coins";
import {
  GACHA_PLANS,
  GACHA_RARITY_RATES_BY_TYPE,
  GACHA_TYPE_LABELS,
  RARITY_STYLES,
  type GachaPlanId,
  type GachaRarity,
  type GachaType,
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
  const [gachaType, setGachaType] = useState<GachaType>("regular");
  const [pending, setPending] = useState<GachaPlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DrawResult[] | null>(null);
  const [lastPlan, setLastPlan] = useState<GachaPlanId>("single");
  const [lastGachaType, setLastGachaType] = useState<GachaType>("regular");
  const inFlight = useRef(false);

  const draw = useCallback(
    async (planId: GachaPlanId, selectedType: GachaType) => {
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
            gachaType: selectedType,
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

        setLastPlan(planId);
        setLastGachaType(selectedType);
        setResults(payload?.results ?? []);
        router.refresh();
      } catch {
        setError("通信に失敗しました。");
      } finally {
        inFlight.current = false;
        setPending(null);
      }
    },
    [router],
  );

  const rates = GACHA_RARITY_RATES_BY_TYPE[gachaType];
  const isRegular = gachaType === "regular";

  return (
    <section className="rough-card flex min-w-0 flex-col overflow-hidden p-3.5">
      <h2 className="flex items-center gap-1 text-[15px] font-bold">
        <SparkleArt className="w-3.5 shrink-0 text-sun" />
        <span className="min-w-0 truncate">コインでガチャ</span>
      </h2>

      <div className="mt-2 grid grid-cols-2 gap-1 rounded-full bg-paper-deep p-1" role="tablist" aria-label="ガチャの種類">
        {(["regular", "summer"] as const).map((type) => {
          const active = gachaType === type;
          return (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={pending !== null}
              onClick={() => {
                setGachaType(type);
                setError(null);
              }}
              className={`rounded-full px-2 py-1.5 text-[10px] font-bold transition ${
                active
                  ? type === "regular"
                    ? "bg-leaf-soft text-leaf-deep shadow-sm"
                    : "bg-sun-soft text-[#8a6a2a] shadow-sm"
                  : "text-ink-faint"
              } disabled:opacity-50`}
            >
              {GACHA_TYPE_LABELS[type]}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex min-h-0 flex-1 items-start gap-0.5">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] leading-[1.65] text-ink-soft">
            <span className="block whitespace-nowrap">コインをつかって</span>
            <span className="block whitespace-nowrap">
              {isRegular ? "わんこのおもちゃをゲット！" : "夏限定スキンをゲット！"}
            </span>
          </p>
          <p className="mt-1 text-[9px] font-semibold text-ink-faint">
            {isRegular ? "おもちゃ10種類" : "夏のフレブル"}
          </p>
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
              onClick={() => void draw(planId, gachaType)}
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

      {results && (
        <GachaResultModal
          results={results}
          plan={lastPlan}
          busy={pending !== null}
          onRetry={() => void draw(lastPlan, lastGachaType)}
          onClose={() => setResults(null)}
        />
      )}
    </section>
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
  const only = plan === "single" && results.length === 1 ? results[0] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#463b2f]/35 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="ガチャ結果"
    >
      <div className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-[28px] border border-[#eadfc8] bg-[#fffdf8] p-4 shadow-[0_18px_50px_rgba(75,56,36,0.22)]">
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
