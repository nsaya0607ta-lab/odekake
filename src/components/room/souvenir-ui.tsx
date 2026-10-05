"use client";

/**
 * おさんぽのおみやげの画面
 * - SouvenirGift: おさんぽで わんこが ひろってきたとき（すぐに中身を見せる）と、
 *   遊びに来たフレンドのわんこが おみやげをくれたとき（包みをタップであける）のカード。はじめてのものに NEW、レアは金色に光る
 * - SouvenirBook: もようがえの「おみやげ」タブ。全種類の図鑑（まだのものはシルエットとヒント）から、棚や床に飾る
 */
import { useState } from "react";
import { ownedKey, SEASON_NAMES, SHINY_RATE, SOUVENIR_IDS, SOUVENIRS, souvenirHint, souvenirName, type SouvenirId, type SouvenirOwnedKey } from "@/lib/room/souvenirs";
import { SouvenirArt } from "./souvenir-art";
import { CraftPanel } from "./craft-ui";
import { CRAFT_IDS, CRAFTS, type CraftId } from "@/lib/room/crafts";

export type SouvenirNews = { id: SouvenirId; shiny: boolean; steps: number; date: string; isNew: boolean }[];

/** 虹色のふち（色ちがい） */
const RAINBOW = "linear-gradient(120deg,#FF9AC8,#FFD84A,#8CE08A,#7FC8F2,#B89AF2)";

/** いちばん見せたいもの（色ちがい → レア → はじめて → 歩数の多い節目） */
export function headline(news: SouvenirNews) {
  return [...news].sort((a, b) => Number(b.shiny) - Number(a.shiny) || Number(Boolean(SOUVENIRS[b.id].rare)) - Number(Boolean(SOUVENIRS[a.id].rare)) || Number(b.isNew) - Number(a.isNew) || b.steps - a.steps)[0]!;
}

/** 包みをあけるまえの、おみやげ袋（クラフト紙に肉球のはんこ・赤いリボン・名札） */
function GiftBag({ dogName, glow }: { dogName: string; glow: boolean }) {
  return (
    <svg viewBox="0 0 160 170" className="block h-auto w-full" aria-hidden>
      <defs>
        <linearGradient id="svbag" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#E8C690" /><stop offset="0.55" stopColor="#D4A868" /><stop offset="1" stopColor="#B88A4E" /></linearGradient>
        <linearGradient id="svbagtop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F2D6A6" /><stop offset="1" stopColor="#D4A868" /></linearGradient>
        <radialGradient id="svglow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#FFE58A" stopOpacity="0.85" /><stop offset="1" stopColor="#FFE58A" stopOpacity="0" /></radialGradient>
      </defs>
      {glow ? <circle className="room-sv-aura" cx="80" cy="92" r="78" fill="url(#svglow)" /> : null}
      <ellipse cx="80" cy="160" rx="52" ry="7" fill="#3A2614" opacity="0.18" />
      {/* 袋：ふくらんだ胴 → しぼった口 → 口のひだ */}
      <path d="M36 70 C 26 96 26 140 40 156 C 56 162 104 162 120 156 C 134 140 134 96 124 70 Z" fill="url(#svbag)" />
      <path d="M40 76 C 34 100 34 134 44 150" stroke="#F4DDB4" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.6" />
      <path d="M118 80 C 124 104 124 132 116 150" stroke="#9C6E36" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.4" />
      <path d="M50 40 C 46 52 44 62 46 72 L 114 72 C 116 62 114 52 110 40 C 100 48 90 36 80 44 C 70 36 60 48 50 40 Z" fill="url(#svbagtop)" />
      <path d="M60 46 L62 70 M80 46 L80 70 M100 46 L98 70" stroke="#B88A4E" strokeWidth="1.2" opacity="0.5" />
      {/* リボン */}
      <path d="M40 72 C 60 80 100 80 120 72 L 120 80 C 100 88 60 88 40 80 Z" fill="#D8343E" />
      <path d="M80 78 C 64 60 46 62 52 74 C 56 82 70 80 80 78 Z" fill="#E8484E" stroke="#A81E28" strokeWidth="1" />
      <path d="M80 78 C 96 60 114 62 108 74 C 104 82 90 80 80 78 Z" fill="#E8484E" stroke="#A81E28" strokeWidth="1" />
      <path d="M80 78 L 70 104 L 76 100 L 78 106 Z M80 78 L 92 102 L 86 99 L 84 105 Z" fill="#C8282E" />
      <circle cx="80" cy="78" r="5" fill="#C8282E" />
      {/* 肉球のはんこ */}
      <g transform="translate(80 122)" fill="#8A5A2E" opacity="0.55">
        <ellipse cx="0" cy="4" rx="9" ry="7.4" />
        <ellipse cx="-10" cy="-7" rx="3.6" ry="4.6" /><ellipse cx="-3.6" cy="-12" rx="3.6" ry="4.6" /><ellipse cx="3.6" cy="-12" rx="3.6" ry="4.6" /><ellipse cx="10" cy="-7" rx="3.6" ry="4.6" />
      </g>
      {/* 名札 */}
      <g transform="translate(118 86) rotate(14)">
        <path d="M0 0 L-6 -10" stroke="#C9A06A" strokeWidth="1" />
        <rect x="-4" y="0" width="34" height="16" rx="3" fill="#FFFBF0" stroke="#C9A06A" />
        <text x="13" y="11" textAnchor="middle" fontSize="7" fontWeight="900" fill="#7A4A2E">{[...dogName].slice(0, 4).join("")}より</text>
      </g>
    </svg>
  );
}

/** from: おみやげをくれた フレンドのわんこ（無ければ、自分のわんこが おさんぽで ひろってきたもの） */
export function SouvenirGift({ news, dogName, from = null, onClose, onDecorate }: { news: SouvenirNews; dogName: string; from?: { owner: string; dogName: string } | null; onClose: () => void; onDecorate: () => void }) {
  // フレンドからの おみやげは、まず包みのまま（タップであける）。おさんぽで ひろったものは、すぐに見せる
  const [open, setOpen] = useState(!from);
  const top = headline(news);
  if (!open && from) {
    const hasRare = news.some((n) => SOUVENIRS[n.id].rare || n.shiny);
    const hasShiny = news.some((n) => n.shiny);
    return (
      // 包みのあいだは、外をタップしても とじない（あけずに見のがさないように）
      <div className="fixed inset-0 z-[790] flex items-end justify-center bg-black/35 px-4 pb-6 backdrop-blur-[2px] sm:items-center">
        <div role="dialog" aria-modal="true" aria-label="フレンドのわんこからの おみやげ（つつみ）" onClick={(e) => e.stopPropagation()} className="room-sv-pop relative w-full max-w-sm rounded-[28px] border border-line bg-card px-5 pb-5 pt-4 text-center shadow-2xl">
          <p className="text-[11px] font-black tracking-[0.2em] text-[#C8543E]">FRIEND&apos;S GIFT</p>
          <p className="mt-0.5 text-[15px] font-black text-ink">🎁 {from.owner}さんちの {from.dogName}から おみやげ！</p>
          <button type="button" onClick={() => setOpen(true)} aria-label="おみやげを あける" className="mx-auto mt-2 block w-40 active:scale-95">
            <span className="room-sv-wiggle block"><GiftBag dogName={from.dogName} glow={hasRare} /></span>
          </button>
          <p className="mt-1 text-[12px] font-black text-ink-soft">{hasShiny ? "にじいろに ひかってる…！？ " : hasRare ? "なにか ひかってる…！？ " : ""}タップして あけてね</p>
          <p className="mt-0.5 text-[10px] font-bold text-ink-faint">{news.length}こ 入ってるみたい</p>
        </div>
      </div>
    );
  }
  const topRare = Boolean(SOUVENIRS[top.id].rare) || top.shiny;
  // 同じもの（色ちがいは別）は まとめて「×2」
  const keyOf = (n: { id: SouvenirId; shiny: boolean }) => ownedKey(n.id, n.shiny);
  const all = [...new Map(news.map((n) => [keyOf(n), { ...n, n: news.filter((x) => keyOf(x) === keyOf(n)).length, isNew: news.some((x) => keyOf(x) === keyOf(n) && x.isNew) }])).values()];
  // 大きく見せたものは、ほかに同じものが無ければ下の一覧には出さない
  const groups = all.filter((n) => keyOf(n) !== keyOf(top) || n.n > 1).map((n) => (keyOf(n) === keyOf(top) ? { ...n, n: n.n - 1, isNew: false } : n));
  const maxSteps = Math.max(...news.map((n) => n.steps));
  // 何日ぶんか（アプリを開かなかった日の分も、まとめて受け取ることがある）
  const days = new Set(news.map((n) => n.date)).size;
  return (
    <div className="fixed inset-0 z-[790] flex items-end justify-center bg-black/35 px-4 pb-6 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={from ? "フレンドのわんこからの おみやげ" : "わんこが ひろってきたもの"} onClick={(e) => e.stopPropagation()} className="room-sv-pop relative w-full max-w-sm overflow-hidden rounded-[28px] border border-line bg-card shadow-2xl">
        {/* あけた瞬間のキラキラ */}
        <span aria-hidden className="room-sv-burst pointer-events-none absolute left-1/2 top-[38%] z-10 block h-0 w-0">
          {Array.from({ length: 12 }, (_, i) => <span key={i} className="absolute -left-1.5 -top-1.5 block h-3 w-3 rounded-full" style={{ background: ["#FFD84A", "#FF8FB3", "#8CCB74", "#7FC8F2"][i % 4], ["--a" as string]: `${i * 30}deg` }} />)}
        </span>
        {/* 上の帯：きょうの歩数のしるし */}
        <div className={`relative px-4 pb-3 pt-4 text-center ${top.shiny ? "bg-[linear-gradient(160deg,#FFEAF4,#E6F4FF,#F0FFE6)]" : topRare ? "bg-[linear-gradient(160deg,#FFF6D6,#FFE7A8)]" : "bg-[linear-gradient(160deg,#F3FAEC,#E2F1D4)]"}`}>
          {from ? (
            <>
              <p className="text-[11px] font-black tracking-[0.2em] text-[#C8543E]">FRIEND&apos;S GIFT</p>
              <p className="mt-0.5 text-[15px] font-black text-ink">🎁 {from.dogName}が おみやげを くれたよ！</p>
              <p className="mt-0.5 text-[11px] font-bold text-ink-soft">{from.owner}さんちから あそびに来てくれた おれい</p>
            </>
          ) : (
            <>
              <p className="text-[11px] font-black tracking-[0.2em] text-leaf-deep">OSANPO FIND</p>
              <p className="mt-0.5 text-[15px] font-black text-ink">🐾 {dogName}が {news.length > 1 ? `${news.length}こ` : `${souvenirName(top.id, top.shiny)}を`} ひろってきたよ！</p>
              <p className="mt-0.5 text-[11px] font-bold text-ink-soft">{days > 1 ? `${days}日ぶんの おさんぽで みつけた（いちばん ${maxSteps.toLocaleString("ja-JP")}歩）` : `${maxSteps.toLocaleString("ja-JP")}歩の おさんぽで みつけた`}</p>
            </>
          )}
        </div>
        {/* いちばんのもの：大きく、わんこのひとことつき */}
        <div className="px-4 pt-4">
          <div className={`relative flex items-center gap-3 overflow-hidden rounded-3xl border-2 p-3 ${top.shiny ? "border-transparent bg-[#FFFCF6]" : topRare ? "border-[#E8B84A] bg-[#FFFBEA]" : "border-line bg-paper"}`}
            style={top.shiny ? { background: `linear-gradient(#FFFCF6,#FFFCF6) padding-box, ${RAINBOW} border-box` } : undefined}>
            {topRare ? <span aria-hidden className="room-sv-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent)]" /> : null}
            <span className="relative block w-24 shrink-0"><SouvenirArt id={top.id} shiny={top.shiny} label={souvenirName(top.id, top.shiny)} /></span>
            <div className="relative min-w-0">
              <div className="flex flex-wrap items-center gap-1">
                {top.shiny ? <span className="rounded-full px-2 py-0.5 text-[9px] font-black text-white" style={{ background: RAINBOW }}>✨ 色ちがい</span> : null}
                {SOUVENIRS[top.id].rare ? <span className="rounded-full bg-[#E8A21A] px-2 py-0.5 text-[9px] font-black text-white">★ レア</span> : null}
                {top.isNew ? <span className="rounded-full bg-[#E04A6A] px-2 py-0.5 text-[9px] font-black text-white">NEW</span> : null}
              </div>
              <p className="mt-1 text-[15px] font-black leading-tight text-ink">{souvenirName(top.id, top.shiny)}</p>
              <p className="mt-1.5 rounded-2xl rounded-tl-sm bg-card px-2.5 py-1.5 text-[11px] font-bold leading-snug text-ink-soft shadow-sm">「{from ? (top.shiny ? `いつもと ちがう いろの ${SOUVENIRS[top.id].name}、みつけたから あげる！` : `${dogName}に あげる！ 気に入ってくれると いいな`) : top.shiny ? `みて！ いつもと ちがう いろの ${SOUVENIRS[top.id].name}！ めったに ないんだよ` : SOUVENIRS[top.id].found}」</p>
            </div>
          </div>
        </div>
        {/* ほかのもの：ひとつずつポンと出る */}
        {groups.length ? (
          <div className="mt-3 flex flex-wrap justify-center gap-2 px-4">
            <p className="w-full text-center text-[10px] font-black text-ink-faint">ほかにも ひろってきたよ</p>
            {groups.map((n, i) => (
              <div key={keyOf(n)} className="room-sv-pop relative flex w-[66px] flex-col items-center" style={{ animationDelay: `${0.25 + i * 0.12}s` }}>
                <span className={`relative block w-14 rounded-2xl border p-1 ${n.shiny ? "border-transparent" : SOUVENIRS[n.id].rare ? "border-[#E8B84A] bg-[#FFFBEA]" : "border-line bg-paper"}`}
                  style={n.shiny ? { background: `linear-gradient(#FFFCF6,#FFFCF6) padding-box, ${RAINBOW} border-box` } : undefined}>
                  <SouvenirArt id={n.id} shiny={n.shiny} />
                  {n.n > 1 ? <span className="absolute -bottom-1 -right-1 rounded-full bg-ink px-1.5 text-[9px] font-black text-white">×{n.n}</span> : null}
                  {n.isNew ? <span className="absolute -left-1 -top-1 rounded-full bg-[#E04A6A] px-1 text-[8px] font-black text-white">NEW</span> : null}
                </span>
                <span className="mt-0.5 line-clamp-2 text-center text-[9px] font-bold leading-tight text-ink-soft">{souvenirName(n.id, n.shiny)}</span>
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
/**
 * もようがえの「おみやげ」タブ：「図鑑」と「クラフト」を切りかえる
 */
export function SouvenirBook(props: {
  owned: Partial<Record<SouvenirOwnedKey, number>>; placedOf: (id: SouvenirId, shiny: boolean) => number; onPlace: (id: SouvenirId, shiny: boolean) => void; now: Date;
  crafts: Partial<Record<CraftId, number>>; availableOf: (id: SouvenirId) => number; onCraft: (id: CraftId) => void; craftPlacedOf: (id: CraftId) => number; onPlaceCraft: (id: CraftId) => void;
}) {
  const [mode, setMode] = useState<"book" | "craft">("book");
  const ready = CRAFT_IDS.filter((id) => (Object.entries(CRAFTS[id].needs) as [SouvenirId, number][]).every(([sid, n]) => props.availableOf(sid) >= n)).length;
  return (
    <div>
      <div role="tablist" aria-label="おみやげ" className="mt-2 grid grid-cols-2 gap-1 rounded-2xl bg-paper-deep p-1">
        {([["book", "📖 図鑑"], ["craft", "✂️ クラフト"]] as const).map(([m, label]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={`relative rounded-xl py-2 text-[12px] font-black ${mode === m ? "bg-card text-ink shadow-sm" : "text-ink-soft"}`}>
            {label}
            {m === "craft" && ready ? <span className="absolute right-2 top-1.5 rounded-full bg-[#E04A6A] px-1.5 text-[9px] font-black text-white">{ready}</span> : null}
          </button>
        ))}
      </div>
      {mode === "book"
        ? <SouvenirZukan owned={props.owned} placedOf={props.placedOf} onPlace={props.onPlace} now={props.now} />
        : <CraftPanel crafts={props.crafts} availableOf={props.availableOf} onCraft={props.onCraft} placedOf={props.craftPlacedOf} onPlace={props.onPlaceCraft} />}
    </div>
  );
}

function SouvenirZukan({ owned, placedOf, onPlace, now }: { owned: Partial<Record<SouvenirOwnedKey, number>>; placedOf: (id: SouvenirId, shiny: boolean) => number; onPlace: (id: SouvenirId, shiny: boolean) => void; now: Date }) {
  const [hint, setHint] = useState<SouvenirId | null>(null);
  const have = SOUVENIR_IDS.filter((id) => (owned[id] ?? 0) > 0).length;
  const shinyHave = SOUVENIR_IDS.filter((id) => (owned[ownedKey(id, true)] ?? 0) > 0).length;
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
        <p className="mt-1.5 text-[10px] font-semibold leading-relaxed text-ink-faint">1日3,000歩から1,000歩ごとに、わんこが おさんぽで なにかを ひろってきます（10,000歩はレア）。フレンドのわんこが遊びに来た日は、おみやげを くれます。季節で見つかるものが かわります。</p>
      </div>
      {groups.map((grp) => (
        <section key={grp.key} className="mt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black text-ink-soft">
            {grp.label}
            {grp.current ? <span className="rounded-full bg-leaf-soft px-1.5 py-0.5 text-[9px] font-black text-leaf-deep">いまの季節</span> : null}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {grp.ids.map((id) => {
              const count = owned[id] ?? 0, placed = placedOf(id, false), rare = Boolean(SOUVENIRS[id].rare);
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
                <button key={id} type="button" onClick={() => onPlace(id, false)} aria-label={`${SOUVENIRS[id].name}を飾る（${placed}/${count}）`}
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
      {/* 色ちがい：まだのものは何かわからない（「？」だけ） */}
      <section className="mt-4 rounded-2xl p-[2px]" style={{ background: RAINBOW }}>
        <div className="rounded-[14px] bg-card px-2.5 pb-2.5 pt-2">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-black text-ink">✨ 色ちがい</p>
            <p className="text-[10px] font-bold tabular-nums text-ink-soft"><span className="text-[13px] font-black text-ink">{shinyHave}</span> / {SOUVENIR_IDS.length}</p>
          </div>
          <p className="mt-0.5 text-[9.5px] font-semibold text-ink-faint">おみやげを もらうとき、まれに（{SHINY_RATE}回に1回くらい）いつもと ちがう色のものが 来ます</p>
          <div className="mt-2 grid grid-cols-6 gap-1.5">
            {SOUVENIR_IDS.map((id) => {
              const count = owned[ownedKey(id, true)] ?? 0;
              if (!count) return <span key={id} aria-hidden className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-line text-[10px] font-black text-ink-faint/60">？</span>;
              const placed = placedOf(id, true);
              return (
                <button key={id} type="button" onClick={() => onPlace(id, true)} aria-label={`${souvenirName(id, true)}を飾る（${placed}/${count}）`}
                  className="relative rounded-xl border-2 border-transparent p-0.5 active:scale-[.96]" style={{ background: `linear-gradient(#FFFCF6,#FFFCF6) padding-box, ${RAINBOW} border-box` }}>
                  <SouvenirArt id={id} shiny />
                  <span className="absolute -right-1 -top-1 rounded-full bg-ink px-1 text-[8px] font-bold tabular-nums text-white">{placed}/{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
