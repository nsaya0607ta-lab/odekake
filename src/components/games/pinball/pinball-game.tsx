"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { RedCoinArt } from "@/components/coin-art";
import { RARITY_STYLES } from "@/lib/gacha/config";
import { STAMP_COUNT } from "@/lib/games/pinball/config";
import type { PinballTableInfo } from "@/lib/games/pinball/tables";
import { getPinballTheme, type PinballTheme } from "@/lib/games/pinball/themes";
import { PinballPlay, type PinballResult } from "./pinball-play";
import { PINBALL_RANKING_REFRESH_EVENT, PinballRanking } from "./pinball-ranking";

type Props = {
  tables: PinballTableInfo[];
  /** 台ごとの自分のベスト */
  bests: Record<string, number>;
  /** 赤コインの残高（仕組みがまだ無い環境では null） */
  redCoins: number | null;
};

function ShapeIcon({ table, theme }: { table: PinballTableInfo; theme: PinballTheme }) {
  const id = `pb-shape-${table.id}`;
  if (!table.shape) return null;
  const [x0, y0, x1, y1] = table.shape.bbox;
  const pad = (x1 - x0) * 0.06;
  return (
    <svg viewBox={`${x0 - pad} ${y0 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}`} className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.colors.shape} />
          <stop offset="100%" stopColor={theme.colors.accent} />
        </linearGradient>
      </defs>
      {table.shape.paths.map((d, i) => (
        <path key={i} d={d} fill={`url(#${id})`} fillOpacity={table.unlocked ? 0.9 : 0.25} stroke={theme.colors.shape} strokeOpacity={0.9} strokeWidth={(x1 - x0) * 0.012} />
      ))}
    </svg>
  );
}

function TableCard({ table, best, onPlay }: { table: PinballTableInfo; best: number | null; onPlay: () => void }) {
  const theme = getPinballTheme(table.id, table.name);
  const style = {
    background: `linear-gradient(135deg, ${theme.colors.bg0}, ${theme.colors.bg1})`,
    borderColor: `${theme.colors.accent}55`,
  } as CSSProperties;
  const isDefault = table.id === "default";
  const ratio = table.totalCount ? table.ownedCount / table.totalCount : 0;

  const body = (
    <>
      <span aria-hidden="true" className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-30 blur-2xl" style={{ background: theme.colors.accent }} />
      <span className="relative flex items-center gap-3">
        <span className="relative flex h-[78px] w-[78px] shrink-0 items-center justify-center rounded-[20px] border border-white/10 bg-black/25 p-2">
          <ShapeIcon table={table} theme={theme} />
          {!table.unlocked ? <span className="absolute inset-0 flex items-center justify-center text-2xl">🔒</span> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="rounded-full px-2 py-0.5 text-[9px] font-black text-black" style={{ background: theme.colors.accent }}>
              {isDefault ? "だれでも" : table.unlocked ? "あそべる" : "まだ"}
            </span>
            {best !== null ? <span className="text-[10px] font-black tabular-nums text-white/70">ベスト {best.toLocaleString("ja-JP")}</span> : null}
          </span>
          <span className="mt-1 block text-[19px] font-black leading-tight text-white">{theme.name}</span>
          <span className="mt-0.5 block truncate text-[11px] font-bold" style={{ color: theme.colors.accent }}>
            {theme.title}
          </span>
          {!isDefault ? (
            <span className="mt-1.5 flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full" style={{ width: `${ratio * 100}%`, background: theme.colors.accent }} />
              </span>
              <span className="shrink-0 text-[10px] font-black tabular-nums text-white/75">
                {table.ownedCount} / {table.totalCount}
              </span>
            </span>
          ) : null}
        </span>
        {table.unlocked ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl font-black text-black" style={{ background: theme.colors.accent }}>
            ›
          </span>
        ) : null}
      </span>
      <span className="relative mt-3 block text-[11px] font-bold leading-relaxed text-white/70">
        {table.unlocked ? theme.lead : `都道府県ガチャで${theme.name}のアイテムを1つ当てると、この台で遊べます。`}
      </span>
      {table.preview.length ? (
        <span className="relative mt-2.5 flex items-center gap-1.5">
          {table.preview.map((item) => (
            <span key={item.id} className="relative h-9 w-9 overflow-hidden rounded-full border border-white/20 bg-white/90" title={item.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image} alt="" className="h-full w-full object-cover" />
              <span className={`absolute bottom-0 left-0 right-0 text-center text-[7px] font-black leading-[10px] ${RARITY_STYLES[item.rarity].badge}`}>{item.rarity}</span>
            </span>
          ))}
          {table.ownedCount > table.preview.length ? <span className="text-[10px] font-black text-white/60">ほか{table.ownedCount - table.preview.length}種</span> : null}
        </span>
      ) : null}
    </>
  );

  if (!table.unlocked) {
    return (
      <Link
        href="/mypage/coins"
        className="pressable relative block overflow-hidden rounded-[26px] border p-4 opacity-80 active:scale-[0.99]"
        style={style}
        aria-label={`${theme.name}の台（まだ遊べません。都道府県ガチャへ）`}
      >
        {body}
        <span className="relative mt-3 flex items-center justify-center rounded-full border border-white/20 bg-black/25 py-2 text-[11px] font-black text-white/85">都道府県ガチャへ</span>
      </Link>
    );
  }
  return (
    <button type="button" onClick={onPlay} className="pressable relative block w-full overflow-hidden rounded-[26px] border p-4 text-left active:scale-[0.99]" style={style} aria-label={`${theme.name}の台で遊ぶ`}>
      {body}
    </button>
  );
}

export function PinballGame({ tables, bests: initialBests, redCoins: initialCoins }: Props) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [bests, setBests] = useState(initialBests);
  const [redCoins, setRedCoins] = useState(initialCoins);
  const table = tables.find((t) => t.id === playing) ?? null;
  const theme = useMemo(() => (table ? getPinballTheme(table.id, table.name) : null), [table]);
  const tableNames = useMemo(() => Object.fromEntries(tables.map((t) => [t.id, t.name])), [tables]);
  const unlockedPrefs = tables.filter((t) => t.id !== "default" && t.unlocked).length;

  const onRecorded = useCallback((tableId: string, result: PinballResult) => {
    setBests((prev) => (result.score > (prev[tableId] ?? -1) ? { ...prev, [tableId]: result.score } : prev));
    if (result.balance !== null) setRedCoins(result.balance);
    window.dispatchEvent(new Event(PINBALL_RANKING_REFRESH_EVENT));
  }, []);

  return (
    <div className="min-h-dvh bg-[radial-gradient(120%_60%_at_50%_0%,#3a1418_0%,#0b0d14_55%,#07090e_100%)] pb-10 text-white">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-[#0b0d14]/85 px-3 py-2 backdrop-blur" style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}>
        <Link href="/games" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-lg font-black active:scale-95" aria-label="ゲーム一覧へ戻る">
          ‹
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[8px] font-black tracking-[0.18em] text-[#ff8a80]">GAME 05</p>
          <h1 className="truncate text-[16px] font-black">ご当地ピンボール</h1>
        </div>
        {redCoins !== null ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-[#ff8a80]/40 bg-[#3a1418] px-2.5 py-1" aria-label={`赤コイン ${redCoins.toLocaleString("ja-JP")}枚`}>
            <RedCoinArt className="h-[18px] w-[18px]" />
            <span className="text-[13px] font-black tabular-nums text-[#ffd3cd]">{redCoins.toLocaleString("ja-JP")}</span>
          </span>
        ) : null}
      </header>

      <main className="mx-auto max-w-[480px] space-y-4 px-4 pt-4">
        <section className="relative overflow-hidden rounded-[28px] border border-[#ff8a80]/25 bg-[linear-gradient(135deg,#2a1116,#121521)] p-5">
          <span aria-hidden="true" className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-[#ff6b6b]/25 blur-2xl" />
          <p className="relative text-[10px] font-black tracking-[0.1em] text-[#ff8a80]">はじいて、集めて、県制覇！</p>
          <p className="relative mt-1 text-[22px] font-black leading-tight">ご当地アイテムの台で遊ぼう</p>
          <p className="relative mt-2 text-[11px] font-bold leading-relaxed text-white/70">
            台に浮かぶご当地アイテムにボールを当てて集めると、その場でスキルが発動。{STAMP_COUNT}個そろうと「県制覇！」でマルチボール。3球で終わり、スコアに応じて赤コインがもらえます。
          </p>
          <div className="relative mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              ["左右をタップ", "フリッパー"],
              ["右下を引いて離す", "打ち出し"],
              ["3球", "1ゲーム"],
            ].map(([a, b]) => (
              <span key={a} className="rounded-2xl border border-white/10 bg-black/25 px-1.5 py-2">
                <span className="block text-[11px] font-black">{a}</span>
                <span className="block text-[9px] font-bold text-white/55">{b}</span>
              </span>
            ))}
          </div>
        </section>

        <section className="space-y-3" aria-label="台をえらぶ">
          <div className="flex items-end justify-between px-1">
            <h2 className="text-[15px] font-black">台をえらぶ</h2>
            <span className="text-[10px] font-bold text-white/55">ご当地の台 {unlockedPrefs} / {tables.length - 1}</span>
          </div>
          {tables.map((t) => (
            <TableCard
              key={t.id}
              table={t}
              best={bests[t.id] ?? null}
              onPlay={() => {
                setPlaying(t.id);
                setRunKey((k) => k + 1);
              }}
            />
          ))}
        </section>

        <Link href="/games/pinball/guide" className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] p-4 active:scale-[0.99]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#ff6b6b]/20 text-lg">📖</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black">ルールとスキルを見る</span>
            <span className="mt-0.5 block text-[11px] font-bold text-white/55">台のしかけ・得点・アイテムごとのスキル</span>
          </span>
          <span className="text-white/40">›</span>
        </Link>

        <PinballRanking tableNames={tableNames} />
      </main>

      {table && theme ? (
        <PinballPlay
          key={runKey}
          table={table}
          theme={theme}
          best={bests[table.id] ?? null}
          onExit={() => setPlaying(null)}
          onRestart={() => setRunKey((k) => k + 1)}
          onRecorded={onRecorded}
        />
      ) : null}
    </div>
  );
}
