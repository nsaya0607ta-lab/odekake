"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconUser } from "@/components/icons";

/** ゲーム側がスコアを送り終えたら、この合図で一覧を取り直す。 */
export const SNACK_TRAIL_RANKING_REFRESH_EVENT = "snack-trail-ranking-refresh";

type RankingPeriod = "week" | "best";

type RankingEntry = {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
  combo: number;
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
  if (rank === 1) return "border-[#ffd971]/70 bg-[#ffd971]/15 text-[#ffe294]";
  if (rank === 2) return "border-[#cbd7df]/55 bg-[#cbd7df]/10 text-[#e4edf3]";
  if (rank === 3) return "border-[#c98a5b]/65 bg-[#c98a5b]/15 text-[#f0ae7c]";
  return "border-white/15 bg-white/[0.05] text-white/60";
}

export function SnackTrailRanking() {
  const [period, setPeriod] = useState<RankingPeriod>("week");
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [ready, setReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRanking = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/games/snack-trail/ranking?period=${period}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as RankingPayload | null;
      if (!response.ok) throw new Error(payload?.error ?? "スコアを読み込めませんでした。");

      setReady(payload?.ready === true);
      setEntries(Array.isArray(payload?.entries) ? payload.entries : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "スコアを読み込めませんでした。");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void loadRanking();

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadRanking(true);
    };
    const refreshAfterGame = () => {
      void loadRanking(true);
    };

    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener(SNACK_TRAIL_RANKING_REFRESH_EVENT, refreshAfterGame);

    return () => {
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener(SNACK_TRAIL_RANKING_REFRESH_EVENT, refreshAfterGame);
    };
  }, [loadRanking]);

  const myEntry = useMemo(() => entries.find((entry) => entry.isMe) ?? null, [entries]);
  const firstEntry = entries[0] ?? null;
  const gapToFirst = myEntry && firstEntry ? Math.max(0, firstEntry.score - myEntry.score) : null;

  return (
    <section
      id="snack-trail-friends"
      aria-label="フレンドのおやつ道スコア"
      className="mt-3.5 scroll-mt-3 overflow-hidden rounded-[24px] border border-[#26394d] bg-[#09131e] text-white shadow-[0_18px_44px_rgba(0,0,0,0.4)]"
    >
      <div className="relative flex items-start justify-between gap-3 overflow-hidden border-b border-white/10 px-4 py-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(114,244,198,0.16),transparent_48%)]" />
        <div className="relative">
          <p className="text-[9px] font-black tracking-[0.14em] text-[#72f4c6]">フレンドスコア</p>
          <h2 className="mt-0.5 text-base font-black text-white">みんなのおやつ道</h2>
          <p className="mt-1 text-[10px] leading-relaxed text-white/45">
            自分とフレンドの、スコアと連続コンボ数だけを並べます。
          </p>
        </div>
        <span className="relative shrink-0 rounded-full border border-[#4b6a83] bg-[#102538] px-2.5 py-1 text-[9px] font-black text-[#cbeeff]">
          おやつ道
        </span>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 rounded-full border border-white/10 bg-[#06101a] p-1">
          {(["week", "best"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={period === value}
              onClick={() => setPeriod(value)}
              className={`rounded-full px-3 py-2 text-xs font-black transition-colors ${
                period === value ? "bg-[#123a33] text-[#7ff0c9] shadow-sm" : "text-white/40"
              }`}
            >
              {PERIOD_LABEL[value]}
            </button>
          ))}
        </div>

        <p className="mt-2 text-center text-[9px] text-white/40">
          {period === "week" ? "毎週月曜 0:00（日本時間）からの記録" : "これまでの自己最高記録"}
        </p>

        {loading && ready === null ? (
          <div className="py-8 text-center text-xs font-semibold text-white/45">スコアを読み込み中…</div>
        ) : error ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-5 text-center">
            <p className="text-xs font-bold text-white/65">{error}</p>
            <button
              type="button"
              onClick={() => void loadRanking()}
              className="mt-3 rounded-full border border-[#4b6a83] bg-[#102538] px-4 py-2 text-[11px] font-black text-[#cbeeff]"
            >
              再読み込み
            </button>
          </div>
        ) : ready === false ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-6 text-center">
            <p className="text-sm font-bold text-white">スコアの記録を準備中です</p>
            <p className="mt-1 text-[10px] leading-relaxed text-white/40">
              データベースの設定が反映されると、ここに並びます。
            </p>
          </div>
        ) : entries.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-7 text-center">
            <p className="text-sm font-bold text-white">まだ記録がありません</p>
            <p className="mt-1 text-[10px] text-white/40">
              1回遊ぶと、ここにスコアと連続コンボ数が表示されます。
            </p>
          </div>
        ) : (
          <>
            <ol className="mt-4 divide-y divide-white/10 overflow-hidden rounded-[22px] border border-white/10 bg-[#07111c]">
              {entries.map((entry) => (
                <li
                  key={entry.userId}
                  className={`flex items-center gap-3 px-3 py-3 ${entry.isMe ? "bg-[#72f4c6]/10" : ""}`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-black tabular-nums ${rankStyle(entry.rank)}`}
                  >
                    {entry.rank}
                  </span>

                  <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
                    {entry.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={entry.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-white/35">
                        <IconUser size={19} />
                      </span>
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-bold text-white">{entry.displayName}</span>
                      {entry.isMe ? (
                        <span className="shrink-0 rounded-full bg-[#1f8f74] px-1.5 py-0.5 text-[8px] font-black text-white">あなた</span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[9px] text-white/40">
                      {period === "week" ? "今週のベスト" : "自己ベスト"}
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    <span className="block text-base font-black tabular-nums leading-none text-[#eef7ff]">
                      {entry.score.toLocaleString("ja-JP")}
                      <span className="ml-0.5 text-[8px] font-bold tracking-wide text-white/35">点</span>
                    </span>
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-[#72f4c6]/25 bg-[#72f4c6]/10 px-1.5 py-0.5 text-[9px] font-black tabular-nums text-[#a8ffe2]">
                      <span aria-hidden="true">🐾</span>
                      {entry.combo.toLocaleString("ja-JP")}
                      <span className="font-bold text-[#a8ffe2]/70">コンボ</span>
                    </span>
                  </span>
                </li>
              ))}
            </ol>

            {myEntry && gapToFirst !== null ? (
              <div className="mt-3 rounded-2xl border border-[#ffc95c]/25 bg-[#ffc95c]/10 px-3 py-2.5 text-center">
                {myEntry.rank === 1 ? (
                  <p className="text-xs font-black text-[#ffc95c]">現在フレンド内 1位！</p>
                ) : (
                  <p className="text-xs font-black text-[#ffc95c]">
                    あなたは {myEntry.rank}位 ・ 1位まであと {gapToFirst.toLocaleString("ja-JP")}点
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-center text-[10px] font-semibold text-white/40">
                1回プレイすると、あなたの記録も並びます。
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
