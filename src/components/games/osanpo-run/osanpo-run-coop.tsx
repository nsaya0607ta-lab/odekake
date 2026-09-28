"use client";

import { useCallback, useEffect, useState } from "react";
import { OSANPO_RUN_SHEET_OPEN_EVENT } from "./engine";
import { OSANPO_RUN_RANKING_REFRESH_EVENT } from "./osanpo-run-ranking";

type Member = { userId: string; displayName: string; meters: number; isMe: boolean };
type CoopPayload = { ready?: boolean; goal?: number; total?: number; claimed?: boolean; coins?: number; members?: Member[]; error?: string };

const km = (m: number) => `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)}km`;

/**
 * 協力チャレンジ（自分とフレンドの今週の合計距離）。フレンド画面のいちばん上に出す。
 * 目標に届いたら「受け取る」で、今週ぶんのコインを1回だけもらえる。
 */
export function OsanpoRunCoop() {
  const [data, setData] = useState<CoopPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimedNow, setClaimedNow] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/games/osanpo-run/coop", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as CoopPayload | null;
      if (!response.ok) throw new Error(payload?.error ?? "協力チャレンジを読み込めませんでした。");
      setData(payload); setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "協力チャレンジを読み込めませんでした。");
    }
  }, []);

  useEffect(() => {
    void load();
    const onOpen = (event: Event) => { if ((event as CustomEvent<string>).detail === "friends") void load(); };
    const onRefresh = () => { void load(); };
    window.addEventListener(OSANPO_RUN_SHEET_OPEN_EVENT, onOpen);
    window.addEventListener(OSANPO_RUN_RANKING_REFRESH_EVENT, onRefresh);
    return () => {
      window.removeEventListener(OSANPO_RUN_SHEET_OPEN_EVENT, onOpen);
      window.removeEventListener(OSANPO_RUN_RANKING_REFRESH_EVENT, onRefresh);
    };
  }, [load]);

  const claim = async () => {
    setClaiming(true);
    try {
      const response = await fetch("/api/games/osanpo-run/coop", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { coins?: number; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "受け取れませんでした。");
      setClaimedNow(payload?.coins ?? 0);
      await load();
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : "受け取れませんでした。");
    } finally {
      setClaiming(false);
    }
  };

  if (!data && !error) return <div className="osr-coop"><p className="osr-coop-note">協力チャレンジを読み込み中…</p></div>;
  if (!data || data.ready === false) {
    return (
      <div className="osr-coop">
        <b className="osr-coop-title">協力チャレンジ</b>
        <p className="osr-coop-note">{error ?? "準備中です。データベースの設定が反映されると始まります。"}</p>
      </div>
    );
  }

  const goal = Math.max(1, data.goal ?? 1), total = data.total ?? 0, done = total >= goal;
  const members = data.members ?? [];
  const top = Math.max(1, ...members.map((m) => m.meters));
  return (
    <div className="osr-coop" data-done={done ? "1" : "0"}>
      <div className="osr-coop-head">
        <b className="osr-coop-title">協力チャレンジ</b>
        <small>今週みんなで {km(goal)} 歩こう</small>
      </div>
      <div className="osr-coop-bar" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(total, goal)} aria-label="今週の合計距離">
        <i style={{ width: `${Math.min(100, (total / goal) * 100)}%` }} />
      </div>
      <p className="osr-coop-sum">
        {km(total)} / {km(goal)}
        {done ? " ・ 達成！" : ` ・ あと${km(goal - total)}`}
      </p>
      {done && !data.claimed ? (
        <button type="button" className="osr-coop-claim" onClick={() => void claim()} disabled={claiming}>
          {claiming ? "受け取り中…" : `ごほうび ${data.coins ?? 100}コインを受け取る`}
        </button>
      ) : done ? (
        <p className="osr-coop-note">{claimedNow ? `+${claimedNow}コイン 受け取りました！` : "今週のごほうびは受け取りずみ。また来週！"}</p>
      ) : (
        <p className="osr-coop-note">達成すると、みんなそれぞれ{data.coins ?? 100}コインもらえます（月曜0時にリセット）。</p>
      )}
      {members.length > 0 ? (
        <ul className="osr-coop-list">
          {members.slice(0, 8).map((m) => (
            <li key={m.userId} className={m.isMe ? "osr-coop-me" : undefined}>
              <span>{m.displayName}{m.isMe ? "（あなた）" : ""}</span>
              <span className="osr-coop-mini"><i style={{ width: `${(m.meters / top) * 100}%` }} /></span>
              <b>{km(m.meters)}</b>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="osr-coop-note osr-coop-err">{error}</p> : null}
    </div>
  );
}
