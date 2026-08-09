import Link from "next/link";
import { formatCoins } from "@/lib/coins";
import { IconCoin } from "./icons";

/** ヘッダー右上に出す所持コイン。押すとコインの画面へ */
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
