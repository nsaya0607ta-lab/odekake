"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconUser } from "@/components/icons";

/** スコアを送ったあと、この合図で一覧を取りなおす */
export const PINBALL_RANKING_REFRESH_EVENT = "pinball-ranking-refresh";

type RankingPeriod = "week" | "best";

type RankingEntry = {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
  table: string;
  playedAt: string;
  isMe: boolean;
};

type RankingPayload = { ready?: boolean; entries?: RankingEntry[]; error?: string };

const PERIOD_LABEL: Record<RankingPeriod, string> = { week: "今週", best: "これまで" };

/** ご当地ピンボールのフレンドランキング（全部の台まとめて。ベストを出した台も出す。tableName は台の id → 名前） */
export function PinballRanking({ tableName }: { tableName: (id: string) => string }) {
  const [period, setPeriod] = useState<RankingPeriod>("week");
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [ready, setReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/games/pinball/ranking?period=${period}`, { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as RankingPayload | null;
        if (!response.ok) throw new Error(payload?.error ?? "ランキングを読み込めませんでした。");
        setReady(payload?.ready === true);
        setEntries(Array.isArray(payload?.entries) ? payload.entries : []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "ランキングを読み込めませんでした。");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [period],
  );

  useEffect(() => {
    void load();
    const onRefresh = () => void load(true);
    window.addEventListener(PINBALL_RANKING_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(PINBALL_RANKING_REFRESH_EVENT, onRefresh);
  }, [load]);

  const me = useMemo(() => entries.find((e) => e.isMe) ?? null, [entries]);
  const above = me ? entries.filter((e) => e.rank < me.rank).at(-1) ?? null : null;

  return (
    <section className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4" aria-labelledby="pinball-ranking-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="pinball-ranking-title" className="text-[15px] font-black text-white">
          フレンドランキング
        </h2>
        <div className="flex rounded-full border border-white/15 bg-black/30 p-0.5" role="group" aria-label="期間">
          {(["week", "best"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={period === value}
              onClick={() => setPeriod(value)}
              className={`rounded-full px-3 py-1 text-[11px] font-black ${period === value ? "bg-[#ff6b6b] text-white" : "text-white/60"}`}
            >
              {PERIOD_LABEL[value]}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-[10px] font-bold text-white/45">
        {period === "week" ? "毎週月曜 0:00（日本時間）からのベスト" : "これまでのベスト"} ・ 全部の台まとめて ・ 自分とフレンドだけ
      </p>

      {loading && ready === null ? (
        <p className="py-6 text-center text-xs font-bold text-white/50">読み込み中…</p>
      ) : error ? (
        <div className="py-5 text-center text-xs font-bold text-white/60">
          <p>{error}</p>
          <button type="button" className="mt-2 underline" onClick={() => void load()}>
            もう一度読み込む
          </button>
        </div>
      ) : ready === false ? (
        <p className="py-6 text-center text-xs font-bold text-white/50">ランキングは準備中です</p>
      ) : entries.length === 0 ? (
        <p className="py-6 text-center text-xs font-bold text-white/50">まだ記録がありません。1回あそぶと並びます。</p>
      ) : (
        <>
          <p className="mt-3 rounded-2xl bg-black/25 px-3 py-2 text-[11px] font-black text-[#ffd3cd]">
            {me
              ? me.rank === 1
                ? entries.length > 1
                  ? "フレンドの中で 1位！"
                  : "いまは あなたが 1位"
                : `あなたは ${me.rank}位${above ? ` ・ ${above.displayName}さんまで あと${(above.score - me.score).toLocaleString("ja-JP")}点` : ""}`
              : period === "week"
                ? "今週はまだ遊んでいません"
                : "まだ記録がありません"}
          </p>
          <ol className="mt-2 space-y-1.5">
            {entries.map((entry) => (
              <li
                key={entry.userId}
                className={`flex items-center gap-2.5 rounded-2xl px-2.5 py-2 ${entry.isMe ? "border border-[#ff6b6b]/60 bg-[#ff6b6b]/10" : "bg-white/[0.03]"}`}
              >
                <b className={`w-6 shrink-0 text-center text-sm font-black ${entry.rank <= 3 ? "text-[#ffd166]" : "text-white/60"}`}>{entry.rank}</b>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-white/50">
                  {entry.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entry.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <IconUser size={16} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-black text-white">
                    {entry.displayName}
                    {entry.isMe ? <span className="ml-1.5 rounded-full bg-[#ff6b6b] px-1.5 py-px text-[9px] text-white">あなた</span> : null}
                  </span>
                  <span className="block truncate text-[10px] font-bold text-white/45">{tableName(entry.table)}</span>
                </span>
                <span className="shrink-0 text-right text-[14px] font-black tabular-nums text-white">
                  {entry.score.toLocaleString("ja-JP")}
                  <small className="ml-0.5 text-[9px] text-white/50">点</small>
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
