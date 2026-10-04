import Link from "next/link";
import { formatCoins } from "@/lib/coins";
import { BlueCoinArt } from "./coin-art";
import { IconCoin } from "./icons";

/**
 * ヘッダー右上に出す所持コイン（表示のみ、押しても遷移しない）。
 * blueBalance を渡すと、となりに青コインも出す（ならぶぶん、少し小さくする）
 */
export function CoinBadge({ balance, blueBalance = null }: { balance: number; blueBalance?: number | null }) {
  const pair = blueBalance !== null;
  return (
    <div className={`flex shrink-0 items-center ${pair ? "gap-1" : ""}`}>
      <div
        aria-label={`所持コイン ${formatCoins(balance)}枚`}
        className={`flex shrink-0 items-center rounded-full border border-[#e8d4aa] bg-sun-soft/70 shadow-sm ${pair ? "gap-1 px-2 py-1" : "gap-1.5 px-3 py-1.5"}`}
      >
        <IconCoin size={pair ? 17 : 20} />
        <span className={`font-bold tabular-nums text-ink ${pair ? "text-[13px]" : "text-sm"}`}>{formatCoins(balance)}</span>
      </div>
      {pair ? (
        <div
          aria-label={`青コイン ${formatCoins(blueBalance)}枚`}
          className="flex shrink-0 items-center gap-1 rounded-full border border-[#BFD7F5] bg-[#EEF5FF] px-2 py-1 shadow-sm"
        >
          <BlueCoinArt className="h-[17px] w-[17px]" />
          <span className="text-[13px] font-bold tabular-nums text-[#1F4F8F]">{formatCoins(blueBalance)}</span>
        </div>
      ) : null}
    </div>
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
