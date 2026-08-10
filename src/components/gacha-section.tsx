"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { formatCoins } from "@/lib/coins";
import { GACHA_PLANS, GACHA_RARITY_RATES, RARITY_STYLES, type GachaPlanId, type GachaRarity } from "@/lib/gacha/config";
import { GachaMachineArt, SparkleArt } from "./coin-art";
import { IconClose, IconCoin } from "./icons";

/**
 * コイン画面のガチャ
 * =============================================================
 * 大枠だけ。演出は入れず、結果は素朴なモーダルで出している。
 * 抽選・残高の減算はサーバー（/api/gacha）が行い、ここは投げて出すだけ。
 */

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

export function GachaSection({ balance }: { balance: number }) {
  const router = useRouter();
  const [pending, setPending] = useState<GachaPlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DrawResult[] | null>(null);
  const [lastPlan, setLastPlan] = useState<GachaPlanId>("single");
  // state の更新は次の描画までかかるので、連打はこの ref で同期的に止める
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
          body: JSON.stringify({ plan: planId, requestId: crypto.randomUUID() }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { results?: DrawResult[]; error?: string }
          | null;

        if (!response.ok) {
          setError(payload?.error ?? "ガチャをまわせませんでした。");
          return;
        }

        setLastPlan(planId);
        setResults(payload?.results ?? []);
        // 残高の表示を作り直す
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

  return (
    <section className="rough-card p-3.5">
      <div className="flex items-start gap-2">
        <h2 className="flex min-w-0 flex-1 items-center gap-1.5 text-base font-bold">
          <SparkleArt className="w-3.5 shrink-0 text-sun" />
          <span className="min-w-0 truncate">コインでガチャ</span>
        </h2>
        <GachaMachineArt className="h-11 w-auto shrink-0" />
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-ink-faint">
        {(Object.keys(GACHA_RARITY_RATES) as GachaRarity[]).map((rarity) => (
          <li key={rarity}>
            <span className={`font-bold ${rarityStyle(rarity).text}`}>{rarity}</span> {GACHA_RARITY_RATES[rarity]}%
          </li>
        ))}
      </ul>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {(Object.keys(GACHA_PLANS) as GachaPlanId[]).map((planId) => {
          const plan = GACHA_PLANS[planId];
          const short = balance < plan.cost;
          return (
            <button
              key={planId}
              type="button"
              onClick={() => void draw(planId)}
              disabled={pending !== null || short}
              className="flex flex-col items-center gap-0.5 rounded-2xl bg-leaf px-3 py-2.5 text-white shadow-sm disabled:opacity-45"
            >
              <span className="text-xs font-bold">{pending === planId ? "まわしています…" : plan.label}</span>
              <span className="flex items-center gap-1 text-[11px] font-bold tabular-nums">
                <IconCoin size={13} />
                {formatCoins(plan.cost)}
              </span>
            </button>
          );
        })}
      </div>

      {balance < GACHA_PLANS.single.cost && !error && (
        <p className="mt-2 text-center text-[11px] text-ink-faint">コインが足りません</p>
      )}
      {error && <p className="mt-2 text-center text-[11px] font-bold text-red-600">{error}</p>}

      {results && (
        <GachaResultModal
          results={results}
          plan={lastPlan}
          busy={pending !== null}
          onRetry={() => void draw(lastPlan)}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[86vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-card p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">ガチャ結果</h2>
          <button type="button" onClick={onClose} aria-label="とじる" className="text-ink-faint">
            <IconClose size={18} />
          </button>
        </div>

        {only ? (
          <SingleResult result={only} />
        ) : (
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {results.map((result, index) => (
              <li key={`${result.id}-${index}`}>
                <ResultCard result={result} />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onRetry}
            disabled={busy}
            className="rounded-full bg-leaf px-3 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-45"
          >
            もう1回まわす
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
  const style = rarityStyle(result.rarity);
  return (
    <div className="mt-3 flex flex-col items-center gap-2 rounded-2xl border border-line bg-sun-soft/30 p-4">
      <span className={`rounded-full px-3 py-0.5 text-sm font-bold ${style.badge}`}>{result.rarity}</span>
      <PrizeImage result={result} className="h-32 w-32" />
      {/* NEW表示用の領域。高さを固定して、出ない回でも下がずれないようにする */}
      <span className="flex h-5 items-center">
        {result.isNew && (
          <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">NEW!</span>
        )}
      </span>
      <p className="text-center text-base font-bold">{result.name}</p>
    </div>
  );
}

function ResultCard({ result }: { result: DrawResult }) {
  const style = rarityStyle(result.rarity);
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-line bg-card p-1.5">
      <span className="flex w-full items-center justify-between">
        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${style.badge}`}>{result.rarity}</span>
        {/* NEW表示用の領域 */}
        <span className="h-3.5">
          {result.isNew && (
            <span className="rounded-full bg-red-500 px-1 py-0.5 text-[8px] font-bold text-white">NEW</span>
          )}
        </span>
      </span>
      <PrizeImage result={result} className="h-14 w-14" />
      <p className="w-full truncate text-center text-[10px] font-bold">{result.name}</p>
    </div>
  );
}

/** 景品の絵。まだ用意していない景品はプレースホルダーを出す */
function PrizeImage({ result, className }: { result: DrawResult; className: string }) {
  if (!result.image) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-xl border border-dashed border-line-strong bg-card text-ink-faint ${className}`}
        aria-hidden="true"
      >
        ?
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={result.image} alt="" draggable={false} className={`shrink-0 select-none object-contain ${className}`} />
  );
}
