"use client";

/**
 * おさんぽのおみやげの画面
 * - SouvenirGift: わんこが持って帰ってきたときの「おみやげ」カード（ひとつずつポンと出る。はじめてのものに NEW、レアは金色に光る）
 * - SouvenirBook: もようがえの「おみやげ」タブ。全種類の図鑑（まだのものはシルエットとヒント）から、棚や床に飾る
 */
import { useState } from "react";
import { SEASON_NAMES, SOUVENIR_IDS, SOUVENIRS, souvenirHint, type SouvenirId } from "@/lib/room/souvenirs";
import { SouvenirArt } from "./souvenir-art";

export type SouvenirNews = { id: SouvenirId; steps: number; isNew: boolean }[];

/** いちばん見せたいもの（レア → はじめて → 歩数の多い節目） */
function headline(news: SouvenirNews) {
  return [...news].sort((a, b) => Number(Boolean(SOUVENIRS[b.id].rare)) - Number(Boolean(SOUVENIRS[a.id].rare)) || Number(b.isNew) - Number(a.isNew) || b.steps - a.steps)[0]!;
}

export function SouvenirGift({ news, dogName, onClose, onDecorate }: { news: SouvenirNews; dogName: string; onClose: () => void; onDecorate: () => void }) {
  const top = headline(news);
  const topRare = Boolean(SOUVENIRS[top.id].rare);
  // 同じものは まとめて「×2」
  const all = [...new Map(news.map((n) => [n.id, { ...n, n: news.filter((x) => x.id === n.id).length, isNew: news.some((x) => x.id === n.id && x.isNew) }])).values()];
  // 大きく見せたものは、ほかに同じものが無ければ下の一覧には出さない
  const groups = all.filter((n) => n.id !== top.id || n.n > 1).map((n) => (n.id === top.id ? { ...n, n: n.n - 1, isNew: false } : n));
  const maxSteps = Math.max(...news.map((n) => n.steps));
  return (
    <div className="fixed inset-0 z-[790] flex items-end justify-center bg-black/35 px-4 pb-6 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="わんこのおみやげ" onClick={(e) => e.stopPropagation()} className="room-sv-pop relative w-full max-w-sm overflow-hidden rounded-[28px] border border-line bg-card shadow-2xl">
        {/* 上の帯：きょうの歩数のしるし */}
        <div className={`relative px-4 pb-3 pt-4 text-center ${topRare ? "bg-[linear-gradient(160deg,#FFF6D6,#FFE7A8)]" : "bg-[linear-gradient(160deg,#F3FAEC,#E2F1D4)]"}`}>
          <p className="text-[11px] font-black tracking-[0.2em] text-leaf-deep">OSANPO SOUVENIR</p>
          <p className="mt-0.5 text-[15px] font-black text-ink">🐾 {dogName}が おみやげを もってきたよ</p>
          <p className="mt-0.5 text-[11px] font-bold text-ink-soft">{maxSteps.toLocaleString("ja-JP")}歩の おさんぽの ごほうび</p>
        </div>
        {/* いちばんのもの：大きく、わんこのひとことつき */}
        <div className="px-4 pt-4">
          <div className={`relative flex items-center gap-3 overflow-hidden rounded-3xl border-2 p-3 ${topRare ? "border-[#E8B84A] bg-[#FFFBEA]" : "border-line bg-paper"}`}>
            {topRare ? <span aria-hidden className="room-sv-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent)]" /> : null}
            <span className="relative block w-24 shrink-0"><SouvenirArt id={top.id} label={SOUVENIRS[top.id].name} /></span>
            <div className="relative min-w-0">
              <div className="flex flex-wrap items-center gap-1">
                {topRare ? <span className="rounded-full bg-[#E8A21A] px-2 py-0.5 text-[9px] font-black text-white">★ レア</span> : null}
                {top.isNew ? <span className="rounded-full bg-[#E04A6A] px-2 py-0.5 text-[9px] font-black text-white">NEW</span> : null}
              </div>
              <p className="mt-1 text-[15px] font-black leading-tight text-ink">{SOUVENIRS[top.id].name}</p>
              <p className="mt-1.5 rounded-2xl rounded-tl-sm bg-card px-2.5 py-1.5 text-[11px] font-bold leading-snug text-ink-soft shadow-sm">「{SOUVENIRS[top.id].found}」</p>
            </div>
          </div>
        </div>
        {/* ほかのもの：ひとつずつポンと出る */}
        {groups.length ? (
          <div className="mt-3 flex flex-wrap justify-center gap-2 px-4">
            <p className="w-full text-center text-[10px] font-black text-ink-faint">ほかにも もってきたよ</p>
            {groups.map((n, i) => (
              <div key={n.id} className="room-sv-pop relative flex w-[66px] flex-col items-center" style={{ animationDelay: `${0.25 + i * 0.12}s` }}>
                <span className={`relative block w-14 rounded-2xl border p-1 ${SOUVENIRS[n.id].rare ? "border-[#E8B84A] bg-[#FFFBEA]" : "border-line bg-paper"}`}>
                  <SouvenirArt id={n.id} />
                  {n.n > 1 ? <span className="absolute -bottom-1 -right-1 rounded-full bg-ink px-1.5 text-[9px] font-black text-white">×{n.n}</span> : null}
                  {n.isNew ? <span className="absolute -left-1 -top-1 rounded-full bg-[#E04A6A] px-1 text-[8px] font-black text-white">NEW</span> : null}
                </span>
                <span className="mt-0.5 line-clamp-2 text-center text-[9px] font-bold leading-tight text-ink-soft">{SOUVENIRS[n.id].name}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-2 px-4 pb-4">
          <button type="button" onClick={onClose} className="rounded-full border border-line bg-paper py-3 text-xs font-bold text-ink-soft active:scale-95">あとで</button>
          <button type="button" onClick={onDecorate} className="rounded-full bg-leaf-deep py-3 text-xs font-black text-white shadow-sm active:scale-95">おへやに かざる</button>
        </div>
      </div>
    </div>
  );
}

const SEASON_ORDER = ["spring", "summer", "autumn", "winter"] as const;
const seasonNow = (d: Date) => {
  const m = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", month: "numeric" }).format(d));
  return m >= 3 && m <= 5 ? "spring" : m >= 6 && m <= 8 ? "summer" : m >= 9 && m <= 11 ? "autumn" : "winter";
};

/** おみやげ図鑑（もようがえの「おみやげ」タブ）。持っているものはタップで飾る。まだのものはシルエットとヒント */
export function SouvenirBook({ owned, placedOf, onPlace, now }: { owned: Partial<Record<SouvenirId, number>>; placedOf: (id: SouvenirId) => number; onPlace: (id: SouvenirId) => void; now: Date }) {
  const [hint, setHint] = useState<SouvenirId | null>(null);
  const have = SOUVENIR_IDS.filter((id) => (owned[id] ?? 0) > 0).length;
  const season = seasonNow(now);
  const groups: { key: string; label: string; ids: SouvenirId[]; current: boolean }[] = [
    { key: "any", label: "いつでも", ids: SOUVENIR_IDS.filter((id) => SOUVENIRS[id].seasons.length === 0), current: false },
    ...SEASON_ORDER.map((s) => ({ key: s, label: SEASON_NAMES[s], ids: SOUVENIR_IDS.filter((id) => SOUVENIRS[id].seasons.includes(s)), current: s === season })),
  ];
  return (
    <div className="mt-2">
      {/* あつめた数 */}
      <div className="rounded-2xl border border-line bg-paper px-3 py-2.5">
        <div className="flex items-baseline justify-between">
          <p className="text-[12px] font-black text-ink">おみやげ図鑑</p>
          <p className="text-[11px] font-bold tabular-nums text-ink-soft"><span className="text-[15px] font-black text-leaf-deep">{have}</span> / {SOUVENIR_IDS.length} しゅるい</p>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper-deep"><div className="h-full rounded-full bg-[linear-gradient(90deg,#8CCB74,#5E8C4A)]" style={{ width: `${(have / SOUVENIR_IDS.length) * 100}%` }} /></div>
        <p className="mt-1.5 text-[10px] font-semibold leading-relaxed text-ink-faint">1日3,000歩から1,000歩ごとに、わんこが おさんぽのおみやげを持って帰ってきます（10,000歩はレア）。季節で見つかるものが かわります。</p>
      </div>
      {groups.map((grp) => (
        <section key={grp.key} className="mt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black text-ink-soft">
            {grp.label}
            {grp.current ? <span className="rounded-full bg-leaf-soft px-1.5 py-0.5 text-[9px] font-black text-leaf-deep">いまの季節</span> : null}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {grp.ids.map((id) => {
              const count = owned[id] ?? 0, placed = placedOf(id), rare = Boolean(SOUVENIRS[id].rare);
              if (count === 0) {
                return (
                  <button key={id} type="button" onClick={() => setHint((h) => (h === id ? null : id))} aria-label={`まだ見つけていない おみやげ（${souvenirHint(id)}）`}
                    className={`relative flex min-w-0 flex-col items-center rounded-2xl border border-dashed p-1.5 ${rare ? "border-[#E8B84A]/70 bg-[#FFFBEA]/50" : "border-line bg-paper/60"}`}>
                    <span className="block w-full opacity-[.13] [filter:brightness(0)]"><SouvenirArt id={id} /></span>
                    <span className="mt-0.5 text-[10px] font-black text-ink-faint">？？？</span>
                    {rare ? <span className="absolute left-1 top-1 text-[9px] font-black text-[#C98A1A]">★</span> : null}
                  </button>
                );
              }
              return (
                <button key={id} type="button" onClick={() => onPlace(id)} aria-label={`${SOUVENIRS[id].name}を飾る（${placed}/${count}）`}
                  className={`relative flex min-w-0 flex-col items-center rounded-2xl border p-1.5 shadow-sm transition active:scale-[.96] ${rare ? "border-[#E8B84A] bg-[#FFFBEA]" : placed ? "border-leaf/60 bg-paper" : "border-line bg-paper"}`}>
                  <span className="block w-full"><SouvenirArt id={id} /></span>
                  <span className="mt-0.5 line-clamp-2 min-h-[2.2em] text-center text-[9.5px] font-bold leading-tight text-ink">{SOUVENIRS[id].name}</span>
                  <span className="absolute right-1 top-1 rounded-full bg-card/90 px-1 text-[8.5px] font-bold tabular-nums text-ink-soft">{placed}/{count}</span>
                  {rare ? <span className="absolute left-1 top-1 text-[9px] font-black text-[#C98A1A]">★</span> : null}
                </button>
              );
            })}
          </div>
          {hint && grp.ids.includes(hint) ? <p className="mt-1.5 rounded-xl bg-paper-deep px-2.5 py-1.5 text-[10px] font-bold text-ink-soft">🔍 {souvenirHint(hint)}</p> : null}
        </section>
      ))}
    </div>
  );
}
