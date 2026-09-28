"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconUser } from "@/components/icons";
import {
  DEFAULT_OSANPO_RUN_DIFFICULTY,
  isOsanpoRunDifficultyId,
  isOsanpoRunStageId,
  OSANPO_RUN_DIFFICULTIES,
  OSANPO_RUN_DIFFICULTY_IDS,
  OSANPO_RUN_STAGES,
  type OsanpoRunDifficultyId,
} from "@/lib/games/osanpo-run/config";
import { OSANPO_RUN_DIFFICULTY_EVENT, OSANPO_RUN_SHEET_OPEN_EVENT } from "./engine";

/** スコアを送り終えたら、この合図で一覧を取り直す */
export const OSANPO_RUN_RANKING_REFRESH_EVENT = "osanpo-run-ranking-refresh";

type RankingPeriod = "week" | "best";

type RankingEntry = {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
  meters: number;
  stage: string;
  playedAt: string;
  isMe: boolean;
};

type RankingPayload = { ready?: boolean; entries?: RankingEntry[]; error?: string };

const PERIOD_LABEL: Record<RankingPeriod, string> = { week: "今週", best: "これまで" };

/**
 * おさんぽフレンチーのフレンドランキング（自分とフレンドだけ）。
 * ゲームの「フレンド」画面の中身で、画面を開いたときとスコアを送ったあとに読み直す。
 * 難易度ごとに別のランキングで、ゲームで難易度を選び直すとこちらも切り替わる。
 */
export function OsanpoRunRanking() {
  const [period, setPeriod] = useState<RankingPeriod>("week");
  const [difficulty, setDifficulty] = useState<OsanpoRunDifficultyId>(DEFAULT_OSANPO_RUN_DIFFICULTY);
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [ready, setReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/games/osanpo-run/ranking?period=${period}&difficulty=${difficulty}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as RankingPayload | null;
      if (!response.ok) throw new Error(payload?.error ?? "ランキングを読み込めませんでした。");
      setReady(payload?.ready === true);
      setEntries(Array.isArray(payload?.entries) ? payload.entries : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "ランキングを読み込めませんでした。");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [period, difficulty]);

  useEffect(() => {
    const onDifficulty = (event: Event) => {
      const id = (event as CustomEvent<unknown>).detail;
      if (isOsanpoRunDifficultyId(id)) setDifficulty(id);
    };
    window.addEventListener(OSANPO_RUN_DIFFICULTY_EVENT, onDifficulty);
    return () => window.removeEventListener(OSANPO_RUN_DIFFICULTY_EVENT, onDifficulty);
  }, []);

  useEffect(() => {
    void load();
    const onOpen = (event: Event) => {
      if ((event as CustomEvent<string>).detail === "friends") void load(true);
    };
    const onRefresh = () => { void load(true); };
    window.addEventListener(OSANPO_RUN_SHEET_OPEN_EVENT, onOpen);
    window.addEventListener(OSANPO_RUN_RANKING_REFRESH_EVENT, onRefresh);
    return () => {
      window.removeEventListener(OSANPO_RUN_SHEET_OPEN_EVENT, onOpen);
      window.removeEventListener(OSANPO_RUN_RANKING_REFRESH_EVENT, onRefresh);
    };
  }, [load]);

  const me = useMemo(() => entries.find((entry) => entry.isMe) ?? null, [entries]);
  const top = entries[0] ?? null;
  const above = me ? entries.filter((entry) => entry.rank < me.rank).at(-1) ?? null : null;

  return (
    <div className="osr-rk">
      <div className="osr-rk-period" role="group" aria-label="期間">
        {(["week", "best"] as const).map((value) => (
          <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)}>
            {PERIOD_LABEL[value]}
          </button>
        ))}
      </div>
      <div className="osr-rk-period osr-rk-diff" role="group" aria-label="難易度">
        {OSANPO_RUN_DIFFICULTY_IDS.map((value) => (
          <button key={value} type="button" aria-pressed={difficulty === value} onClick={() => setDifficulty(value)}>
            {OSANPO_RUN_DIFFICULTIES[value].name}
          </button>
        ))}
      </div>
      <p className="osr-rk-note">
        {OSANPO_RUN_DIFFICULTIES[difficulty].name}の{period === "week" ? "毎週月曜 0:00（日本時間）からのベストスコア" : "これまでのベストスコア"} ・ 自分とフレンドだけ
      </p>

      {loading && ready === null ? (
        <p className="osr-rk-empty">読み込み中…</p>
      ) : error ? (
        <div className="osr-rk-empty">
          <p>{error}</p>
          <button type="button" className="osr-rk-retry" onClick={() => void load()}>もう一度読み込む</button>
        </div>
      ) : ready === false ? (
        <div className="osr-rk-empty">
          <p>ランキングを準備中です</p>
          <small>データベースの設定が反映されると、ここに並びます。</small>
        </div>
      ) : entries.length === 0 ? (
        <div className="osr-rk-empty">
          <p>まだ記録がありません</p>
          <small>1回おさんぽすると、あなたのスコアが並びます。</small>
        </div>
      ) : (
        <>
          {me ? (
            <p className="osr-rk-me">
              {me.rank === 1
                ? entries.length > 1 ? "フレンドの中で 1位！" : "いまは あなたが 1位"
                : `あなたは ${me.rank}位 ・ ${above ? `${above.displayName}さんまで あと${(above.score - me.score).toLocaleString()}点` : ""}`}
            </p>
          ) : (
            <p className="osr-rk-me osr-rk-me-none">
              {period === "week" ? "今週はまだ歩いていません。" : "まだ記録がありません。"}
              {top ? ` 1位は ${top.score.toLocaleString()}点` : ""}
            </p>
          )}
          <ol className="osr-rk-list">
            {entries.map((entry) => {
              const stage = isOsanpoRunStageId(entry.stage) ? OSANPO_RUN_STAGES[entry.stage].name : "";
              return (
                <li key={entry.userId} className={entry.isMe ? "osr-rk-mine" : undefined} data-rank={entry.rank <= 3 ? entry.rank : undefined}>
                  <b className="osr-rk-pos">{entry.rank}</b>
                  <span className="osr-rk-avatar">
                    {entry.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={entry.avatarUrl} alt="" />
                    ) : (
                      <IconUser size={18} />
                    )}
                  </span>
                  <span className="osr-rk-who">
                    <span className="osr-rk-name">
                      {entry.displayName}
                      {entry.isMe ? <i>あなた</i> : null}
                    </span>
                    <small>{stage}{stage ? " ・ " : ""}{entry.meters.toLocaleString()}m</small>
                  </span>
                  <span className="osr-rk-score">{entry.score.toLocaleString()}<small>点</small></span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
