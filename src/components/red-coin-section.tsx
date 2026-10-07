import Link from "next/link";
import { formatCoins } from "@/lib/coins";
import type { RedCoinEvent } from "@/lib/data/red-coins";
import { RED_COIN_POINTS } from "@/lib/games/pinball/config";
import { RedCoinArt } from "./coin-art";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * コイン画面の赤コイン：残高・ためかた・もらった履歴。
 * 赤コインの使いみちはまだ無いので、「ためておける」ことだけを伝える。
 */
export function RedCoinSection({ balance, events, tableNames }: { balance: number; events: RedCoinEvent[] | null; tableNames: Record<string, string> }) {
  return (
    <section id="red-coins" className="rough-card scroll-mt-20 overflow-hidden !border-[#F2C4BF] bg-[linear-gradient(180deg,#FFF3F1,transparent_55%)] p-3.5" aria-labelledby="red-coins-title">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFE3DF]">
          <RedCoinArt className="h-9 w-9" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="red-coins-title" className="text-sm font-bold text-[#9C2B31]">赤コイン</h2>
          <p className="text-[22px] font-black leading-tight tabular-nums text-ink">
            {formatCoins(balance)}
            <span className="ml-1 text-[11px] font-bold text-ink-soft">枚</span>
          </p>
        </div>
        <Link href="/games/pinball" className="shrink-0 rounded-full bg-[#D0574E] px-3 py-2 text-[11px] font-black text-white shadow-sm active:scale-95">
          ためる →
        </Link>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
        ご当地ピンボールのスコア{RED_COIN_POINTS.toLocaleString("ja-JP")}点ごとに1枚。使いみちはこれから増えるので、いまはためておけます。
      </p>
      {events && events.length > 0 ? (
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-card">
          {events.map((event) => (
            <li key={event.id} className="flex items-center gap-2 px-3 py-2 text-[11px]">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-ink">
                  {event.label}
                  {event.table ? <span className="ml-1 font-normal text-ink-soft">（{tableNames[event.table] ?? "ご当地の台"}）</span> : null}
                </span>
                <span className="block text-[10px] text-ink-faint">
                  {formatDate(event.createdAt)}
                  {event.score !== null ? ` ・ ${event.score.toLocaleString("ja-JP")}点` : ""}
                </span>
              </span>
              <span className={`shrink-0 font-black tabular-nums ${event.amount > 0 ? "text-[#C7353B]" : "text-ink-soft"}`}>
                {event.amount > 0 ? "+" : ""}
                {formatCoins(event.amount)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-2xl bg-paper-deep px-3 py-2.5 text-center text-[11px] text-ink-soft">まだ赤コインの履歴はありません。</p>
      )}
    </section>
  );
}
