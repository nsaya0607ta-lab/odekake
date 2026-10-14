import Link from "next/link";
import { WhiteCoinArt } from "./coin-art";
import { formatCoins } from "@/lib/coins";
import type { WhiteCoinEvent } from "@/lib/data/white-coins";
import { WHITE_LOGIN_COINS, WHITE_STARTER_COINS } from "@/lib/games/town-progression";

export function WhiteCoinSection({ balance, events, canPlay = false }: { balance: number; events: WhiteCoinEvent[] | null; canPlay?: boolean }) {
  return <section id="white-coins" className="rough-card scroll-mt-20 overflow-hidden !border-[#bdcbbf] bg-[linear-gradient(150deg,#f8fcf3,#e8efdf)] p-3.5" aria-labelledby="white-coins-title">
    <div className="flex items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#c7d5c9] bg-white/80"><WhiteCoinArt className="h-9 w-9" /></span><div className="min-w-0 flex-1"><h2 id="white-coins-title" className="text-sm font-bold text-[#486457]">白コイン</h2><p className="text-[22px] font-black leading-tight tabular-nums">{formatCoins(balance)}<span className="ml-1 text-[11px] font-bold text-ink-soft">枚</span></p></div>{canPlay && <Link href="/games/town-builder" className="flex min-h-11 shrink-0 items-center rounded-full bg-[#476852] px-3 py-2 text-[11px] font-bold text-white active:scale-95">街を育てる →</Link>}</div>
    <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">街づくりのためのコイン。道路・建物・公園の敷地や部品の購入、建物の増築に使います。</p>
    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold text-[#58705b]"><span className="rounded-full border border-[#d0dcc7] bg-white/70 px-2 py-1">毎日ログイン +{WHITE_LOGIN_COINS}枚</span><span className="rounded-full border border-[#d0dcc7] bg-white/70 px-2 py-1">ホームで拾う</span><span className="rounded-full border border-[#d0dcc7] bg-white/70 px-2 py-1">クエスト・レベルアップ報酬</span></div>
    <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">街づくりをはじめると、はじまりの支援{formatCoins(WHITE_STARTER_COINS)}枚を1回受け取れます。</p>
    {events && events.length > 0 ? <ul className="mt-3 divide-y divide-[#d9e1d3] overflow-hidden rounded-2xl border border-[#d4dfcc] bg-white/70">{events.map(event => <li key={event.id} className="flex items-center gap-2 px-3 py-2.5 text-[11px]"><span className="min-w-0 flex-1"><b className="block truncate">{event.label}</b><small className="mt-0.5 block text-[10px] text-ink-faint">{new Date(event.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</small></span><span className={`shrink-0 font-bold tabular-nums ${event.amount > 0 ? "text-[#476852]" : "text-ink-soft"}`}>{event.amount > 0 ? "+" : ""}{formatCoins(event.amount)}</span></li>)}</ul> : <p className="mt-3 rounded-xl bg-white/60 p-3 text-center text-[11px] text-ink-soft">白コインの獲得・利用履歴がここに残ります。</p>}
  </section>;
}
