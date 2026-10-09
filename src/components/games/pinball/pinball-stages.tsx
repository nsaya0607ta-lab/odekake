"use client";

import { useEffect, useMemo, useState } from "react";
import { RedCoinArt } from "@/components/coin-art";
import { IconUser } from "@/components/icons";
import type { PinballStageInfo } from "@/lib/data/pinball";
import { buildStageTable, STAGE_LIMIT } from "@/lib/games/pinball/stage";
import { stageTheme } from "@/lib/games/pinball/themes";
import { PinballMapPreview } from "./pinball-map-preview";

type RankingEntry = { rank: number; userId: string; displayName: string; avatarUrl: string | null; score: number; isMe: boolean };

type Props = {
  stages: PinballStageInfo[];
  redCoins: number | null;
  onPlay: (stage: PinballStageInfo) => void;
  onEdit: (stage: PinballStageInfo) => void;
  onCreate: () => void;
  onOpenShop: () => void;
};

function Avatar({ url, name, size = 20 }: { url: string | null; name: string; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/15" style={{ width: size, height: size }} title={name}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <IconUser size={Math.round(size * 0.6)} className="text-white/60" />
      )}
    </span>
  );
}

/** ステージのランキング（開いたときに読む） */
function StageRanking({ stageId }: { stageId: string }) {
  const [entries, setEntries] = useState<RankingEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/games/pinball/stages/ranking?id=${encodeURIComponent(stageId)}`, { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as { entries?: RankingEntry[]; error?: string } | null;
        if (!response.ok) throw new Error(payload?.error ?? "ランキングを読み込めませんでした。");
        if (!cancelled) setEntries(Array.isArray(payload?.entries) ? payload.entries : []);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "ランキングを読み込めませんでした。");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stageId]);

  if (error) return <p className="px-1 py-2 text-[11px] font-bold text-[#ffb4a8]">{error}</p>;
  if (!entries) return <p className="px-1 py-2 text-[11px] font-bold text-white/55">読みこんでいます…</p>;
  if (!entries.length) return <p className="px-1 py-2 text-[11px] font-bold text-white/55">まだだれも遊んでいません。いちばん乗りしよう！</p>;
  return (
    <ol className="space-y-1">
      {entries.map((entry) => (
        <li key={entry.userId} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-[12px] ${entry.isMe ? "bg-[#ff6b6b]/15" : "bg-black/20"}`}>
          <span className="w-5 shrink-0 text-center font-black tabular-nums text-[#ffd166]">{entry.rank}</span>
          <Avatar url={entry.avatarUrl} name={entry.displayName} />
          <span className="min-w-0 flex-1 truncate font-bold">{entry.isMe ? "あなた" : entry.displayName}</span>
          <span className="shrink-0 font-black tabular-nums">{entry.score.toLocaleString("ja-JP")}</span>
        </li>
      ))}
    </ol>
  );
}

function StageCard({ stage, onPlay, onEdit }: { stage: PinballStageInfo; onPlay: () => void; onEdit: () => void }) {
  const [rankingOpen, setRankingOpen] = useState(false);
  const theme = useMemo(() => stageTheme(stage.spec?.look ?? "default", stage.name), [stage.spec?.look, stage.name]);
  const table = useMemo(() => (stage.spec ? buildStageTable(stage.spec) : null), [stage.spec]);
  const playable = stage.valid && table !== null;
  return (
    <div className="overflow-hidden rounded-[22px] border p-3" style={{ background: `linear-gradient(135deg, ${theme.colors.bg0}, ${theme.colors.bg1})`, borderColor: `${theme.colors.accent}44` }}>
      <div className="flex gap-3">
        <span className="flex h-[112px] w-[60px] shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-black/30 p-1">
          {table ? <PinballMapPreview table={table} uid={stage.id} theme={theme} className="h-full w-full" /> : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex flex-wrap items-center gap-1.5">
            {stage.isMine ? (
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${stage.shared ? "bg-[#ffd166] text-black" : "bg-white/15 text-white/80"}`}>
                {stage.shared ? "フレンドに公開中" : "ないしょ"}
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-black/30 py-0.5 pl-0.5 pr-2 text-[10px] font-black text-white/85">
                <Avatar url={stage.ownerAvatarUrl} name={stage.ownerName} size={16} />
                {stage.ownerName}
              </span>
            )}
            {!playable ? <span className="rounded-full bg-[#3a1418] px-2 py-0.5 text-[9px] font-black text-[#ffb4a8]">置き方を直してね</span> : null}
          </span>
          <span className="mt-1 block truncate text-[17px] font-black leading-tight text-white">{stage.name}</span>
          <span className="mt-1 block text-[10px] font-bold leading-relaxed text-white/70">
            {stage.myBest !== null ? `あなたのベスト ${stage.myBest.toLocaleString("ja-JP")}` : "まだ遊んでいません"}
            {stage.topScore !== null && (stage.myBest === null || stage.topScore > stage.myBest) ? (
              <>
                <br />
                いちばん {stage.topScore.toLocaleString("ja-JP")}（{stage.topName ?? "フレンド"}）
              </>
            ) : null}
            {stage.isMine && stage.shared ? (
              <>
                <br />
                フレンドが {stage.plays.toLocaleString("ja-JP")}回あそんだ
              </>
            ) : null}
          </span>
          <span className="mt-auto flex flex-wrap gap-1.5 pt-2">
            <button
              type="button"
              onClick={onPlay}
              disabled={!playable}
              className="rounded-full px-3.5 py-1.5 text-[12px] font-black text-black active:scale-95 disabled:opacity-40"
              style={{ background: theme.colors.accent }}
            >
              ▶ あそぶ
            </button>
            {stage.isMine ? (
              <button type="button" onClick={onEdit} className="rounded-full border border-white/20 bg-black/25 px-3 py-1.5 text-[12px] font-black text-white active:scale-95">
                なおす
              </button>
            ) : null}
            {stage.isMine && !stage.shared ? null : (
              <button
                type="button"
                onClick={() => setRankingOpen((open) => !open)}
                className="rounded-full border border-white/20 bg-black/25 px-3 py-1.5 text-[12px] font-black text-white active:scale-95"
                aria-expanded={rankingOpen}
              >
                ランキング
              </button>
            )}
          </span>
        </span>
      </div>
      {rankingOpen ? (
        <div className="mt-2 rounded-2xl bg-black/25 p-2">
          <StageRanking stageId={stage.id} />
        </div>
      ) : null}
    </div>
  );
}

/** 台えらびの「ステージ」：自分のステージと、フレンドが公開したステージ */
export function PinballStages({ stages, redCoins, onPlay, onEdit, onCreate, onOpenShop }: Props) {
  const mine = stages.filter((s) => s.isMine);
  // 置き方に問題があるフレンドのステージは出さない（決まりを変えたときに、遊べないステージが並ばないように）
  const friends = stages.filter((s) => !s.isMine && s.valid);
  const full = mine.length >= STAGE_LIMIT;
  return (
    <section id="stages" className="scroll-mt-16 space-y-3" aria-label="ステージ">
      <div className="flex items-end justify-between gap-2 px-1">
        <div>
          <h2 className="text-[15px] font-black">ステージ</h2>
          <p className="text-[10px] font-bold text-white/55">赤コインで部品を買って、自分の台を作ろう。公開するとフレンドも遊べます。</p>
        </div>
        <button type="button" onClick={onOpenShop} className="flex shrink-0 items-center gap-1 rounded-full border border-[#ff8a80]/40 bg-[#3a1418] px-2.5 py-1.5 text-[11px] font-black text-[#ffd3cd] active:scale-95">
          <RedCoinArt className="h-4 w-4" />
          {redCoins !== null ? redCoins.toLocaleString("ja-JP") : "—"}
          <span className="ml-0.5">部品のお店</span>
        </button>
      </div>

      <button
        type="button"
        onClick={onCreate}
        disabled={full}
        className="flex w-full items-center justify-center gap-2 rounded-[22px] border border-dashed border-[#ff8a80]/50 bg-[#ff6b6b]/10 py-3.5 text-[14px] font-black text-[#ffd3cd] active:scale-[0.99] disabled:opacity-50"
      >
        <span className="text-xl leading-none">＋</span>
        {full ? `ステージは${STAGE_LIMIT}つまで（消すと作れます）` : "新しいステージを作る"}
      </button>

      {mine.length ? (
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-black text-white/70">マイステージ（{mine.length}/{STAGE_LIMIT}）</p>
          {mine.map((stage) => (
            <StageCard key={stage.id} stage={stage} onPlay={() => onPlay(stage)} onEdit={() => onEdit(stage)} />
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="px-1 text-[11px] font-black text-white/70">フレンドのステージ</p>
        {friends.length ? (
          friends.map((stage) => <StageCard key={stage.id} stage={stage} onPlay={() => onPlay(stage)} onEdit={() => onEdit(stage)} />)
        ) : (
          <p className="rounded-[18px] border border-white/10 bg-white/[0.03] px-3 py-3 text-center text-[11px] font-bold text-white/55">
            フレンドが公開したステージは、まだありません。
          </p>
        )}
      </div>
    </section>
  );
}
