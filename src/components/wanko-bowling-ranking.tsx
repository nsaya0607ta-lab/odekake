"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconUser } from "@/components/icons";

type RankingPeriod = "week" | "best";

type RankingEntry = {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
  playedAt: string;
  isMe: boolean;
};

type RankingPayload = {
  ready?: boolean;
  period?: RankingPeriod;
  entries?: RankingEntry[];
  error?: string;
};

const PERIOD_LABEL: Record<RankingPeriod, string> = {
  week: "今週",
  best: "ベスト",
};

function rankStyle(rank: number): string {
  if (rank === 1) return "border-[#e1bd62] bg-[#fff2bf] text-[#8b6216]";
  if (rank === 2) return "border-[#c9c6bd] bg-[#f4f2ed] text-[#6d6960]";
  if (rank === 3) return "border-[#c9956a] bg-[#f7e2d1] text-[#895737]";
  return "border-line bg-paper-deep text-ink-soft";
}

export function WankoBowlingRanking() {
  const [period, setPeriod] = useState<RankingPeriod>("week");
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [ready, setReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRanking = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/games/wanko-bowling/ranking?period=${period}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as RankingPayload | null;
      if (!response.ok) throw new Error(payload?.error ?? "ランキングを読み込めませんでした。");

      setReady(payload?.ready === true);
      setEntries(Array.isArray(payload?.entries) ? payload.entries : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "ランキングを読み込めませんでした。");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void loadRanking();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadRanking(true);
    }, 5 * 60 * 1000);

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadRanking(true);
    };
    const refreshAfterGame = () => {
      void loadRanking(true);
    };

    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("wanko-bowling-ranking-refresh", refreshAfterGame);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("wanko-bowling-ranking-refresh", refreshAfterGame);
    };
  }, [loadRanking]);

  const myEntry = useMemo(() => entries.find((entry) => entry.isMe) ?? null, [entries]);
  const firstEntry = entries[0] ?? null;
  const gapToFirst = myEntry && firstEntry ? Math.max(0, firstEntry.score - myEntry.score) : null;

  return (
    <section className="rough-card overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-4">
        <div>
          <p className="text-[9px] font-black tracking-[0.16em] text-ink-faint">FRIEND RANKING</p>
          <h2 className="mt-0.5 text-base font-black text-ink">フレンドランキング</h2>
          <p className="mt-1 text-[10px] text-ink-faint">
            自分とフレンドの最高スコアで競います。
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-leaf-soft px-2.5 py-1 text-[9px] font-black text-leaf-deep">
          わんこボウリング
        </span>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 rounded-full bg-paper-deep p-1">
          {(["week", "best"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={period === value}
              onClick={() => setPeriod(value)}
              className={`rounded-full px-3 py-2 text-xs font-black transition-colors ${
                period === value ? "bg-card text-leaf-deep shadow-sm" : "text-ink-faint"
              }`}
            >
              {PERIOD_LABEL[value]}
            </button>
          ))}
        </div>

        <p className="mt-2 text-center text-[9px] text-ink-faint">
          {period === "week" ? "毎週月曜 0:00（日本時間）からの記録" : "これまでの自己最高記録"}
        </p>

        {loading && ready === null ? (
          <div className="py-8 text-center text-xs font-semibold text-ink-faint">ランキングを読み込み中…</div>
        ) : error ? (
          <div className="mt-4 rounded-2xl bg-paper-deep px-4 py-5 text-center">
            <p className="text-xs font-bold text-ink-soft">{error}</p>
            <button
              type="button"
              onClick={() => void loadRanking()}
              className="mt-3 rounded-full border border-line bg-card px-4 py-2 text-[11px] font-black text-ink-soft"
            >
              再読み込み
            </button>
          </div>
        ) : ready === false ? (
          <div className="mt-4 rounded-2xl bg-paper-deep px-4 py-6 text-center">
            <p className="text-sm font-bold text-ink">ランキングを準備中です</p>
            <p className="mt-1 text-[10px] leading-relaxed text-ink-faint">
              ランキング用のデータベース設定が反映されると表示されます。
            </p>
          </div>
        ) : entries.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-paper-deep px-4 py-7 text-center">
            <p className="text-sm font-bold text-ink">まだ記録がありません</p>
            <p className="mt-1 text-[10px] text-ink-faint">
              わんこボウリングを遊ぶと、ここにスコアが表示されます。
            </p>
          </div>
        ) : (
          <>
            <ol className="mt-4 divide-y divide-line overflow-hidden rounded-[22px] border border-line bg-card">
              {entries.map((entry) => (
                <li
                  key={entry.userId}
                  className={`flex items-center gap-3 px-3 py-3 ${entry.isMe ? "bg-leaf-soft/55" : ""}`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-black tabular-nums ${rankStyle(entry.rank)}`}
                  >
                    {entry.rank}
                  </span>

                  <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-paper-deep">
                    {entry.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={entry.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-ink-faint">
                        <IconUser size={19} />
                      </span>
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-bold text-ink">{entry.displayName}</span>
                      {entry.isMe ? (
                        <span className="shrink-0 rounded-full bg-leaf px-1.5 py-0.5 text-[8px] font-black text-white">あなた</span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[9px] text-ink-faint">
                      {period === "week" ? "今週のベスト" : "自己ベスト"}
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    <span className="block text-base font-black tabular-nums text-ink">
                      {entry.score.toLocaleString("ja-JP")}
                    </span>
                    <span className="block text-[8px] font-bold tracking-wide text-ink-faint">pt</span>
                  </span>
                </li>
              ))}
            </ol>

            {myEntry && gapToFirst !== null ? (
              <div className="mt-3 rounded-2xl bg-[#fff5df] px-3 py-2.5 text-center">
                {myEntry.rank === 1 ? (
                  <p className="text-xs font-black text-[#8d6231]">現在フレンド内 1位！</p>
                ) : (
                  <p className="text-xs font-black text-[#8d6231]">
                    あなたは {myEntry.rank}位 ・ 1位まであと {gapToFirst.toLocaleString("ja-JP")} pt
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-center text-[10px] font-semibold text-ink-faint">
                1回プレイすると、あなたの順位も表示されます。
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
