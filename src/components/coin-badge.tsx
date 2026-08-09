import Link from "next/link";
import { formatCoins } from "@/lib/coins";
import { IconCoin } from "./icons";

/** ヘッダー右上に出す所持コイン。押すとコイン画面へ */
export function CoinBadge({ balance }: { balance: number }) {
  return (
    <Link
      href="/mypage/coins"
      aria-label={`所持コイン ${formatCoins(balance)}枚。コインの詳しい内容を見る`}
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#e8d4aa] bg-sun-soft/70 px-3 py-1.5 shadow-sm transition-transform active:scale-[0.98]"
    >
      <IconCoin size={20} />
      <span className="text-sm font-bold tabular-nums text-ink">{formatCoins(balance)}</span>
    </Link>
  );
}

/**
 * コイン画面のヘッダーに出す、大きめの所持コイン。
 * 「＋」はコインのもらい方（同じ画面の下の方）へ送る。
 */
export function CoinPill({ balance }: { balance: number }) {
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full border-2 border-leaf/55 bg-card py-1 pl-1.5 pr-1 shadow-sm">
      <IconCoin size={26} />
      <span className="text-lg leading-none font-bold tabular-nums text-ink">{formatCoins(balance)}</span>
      <span className="pt-0.5 text-[10px] text-ink-soft">コイン</span>
      <Link
        href="#coin-how-to-get"
        aria-label="コインのもらい方を見る"
        className="ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-leaf text-card transition-transform active:scale-95"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </Link>
    </div>
  );
}
