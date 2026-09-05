"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DAMBOURLE_PLANS, type DambourlePlanId } from "@/lib/dambourle/config";
import { formatCoins } from "@/lib/coins";
import { IconCoin } from "./icons";

type DrawResult = {
  id: string;
  name: string;
  rarity: string;
  isNew: boolean;
  previousLevel: number;
  newLevel: number;
};

const RARITY_TEXT_CLASS: Record<string, string> = {
  SSR: "text-ink-soft",
  UR: "text-sky",
  LR: "text-sun",
  MR: "text-blossom",
};

function formatLevelTag(level: number): string {
  return `Lv${level}`;
}

export function DambourleGachaSection({ balance }: { balance: number }) {
  const router = useRouter();
  const [pending, setPending] = useState<DambourlePlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DrawResult[] | null>(null);
  const [duplicateCoins, setDuplicateCoins] = useState(0);
  const inFlight = useRef(false);

  const draw = useCallback(
    async (planId: DambourlePlanId) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setPending(planId);
      setError(null);
      setResults(null);

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
        setResults(payload?.results ?? []);
        setDuplicateCoins(payload?.duplicateCoins ?? 0);
        router.refresh();
      } catch {
        setError("通信に失敗しました。");
      } finally {
        setPending(null);
        inFlight.current = false;
      }
    },
    [router],
  );

  return (
    <div className="space-y-3">
      <div className="rough-card flex items-center justify-between p-3">
        <span className="text-xs font-bold text-ink-soft">所持コイン</span>
        <span className="flex items-center gap-1 text-sm font-black text-ink">
          <IconCoin size={16} />
          {formatCoins(balance)}
        </span>
      </div>

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

      {results ? (
        <div className="rough-card space-y-2 p-3">
          <p className="text-xs font-bold text-ink-soft">結果</p>
          <div className="grid grid-cols-2 gap-2">
            {results.map((result, index) => (
              <div key={`${result.id}-${index}`} className="rough-card-alt flex items-center justify-between gap-2 p-2">
                <span className="min-w-0">
                  <span className={`block truncate text-xs font-black ${RARITY_TEXT_CLASS[result.rarity] ?? "text-ink"}`}>
                    {result.name}
                  </span>
                  <span className="block text-[9px] text-ink-faint">{result.rarity}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  {result.isNew ? (
                    <span className="rounded-full bg-[#ee7470] px-1.5 py-0.5 text-[8px] font-black text-white">NEW</span>
                  ) : null}
                  {result.newLevel > result.previousLevel ? (
                    <span className="rounded-full bg-[#f1c969] px-1.5 py-0.5 text-[8px] font-black text-ink">
                      {result.previousLevel > 0
                        ? `${formatLevelTag(result.previousLevel)}→${formatLevelTag(result.newLevel)}`
                        : formatLevelTag(result.newLevel)}
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
          {duplicateCoins > 0 ? (
            <p className="text-center text-[10px] text-ink-faint">重複還元 +{formatCoins(duplicateCoins)}コイン</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
