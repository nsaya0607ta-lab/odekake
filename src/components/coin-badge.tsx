import Link from "next/link";
import { formatCoins } from "@/lib/coins";
import { BlueCoinArt, RedCoinArt, WhiteCoinArt } from "./coin-art";
import { IconCoin } from "./icons";

/**
 * ヘッダー右上に出す所持コイン（表示のみ、押しても遷移しない）。
 * blueBalance を渡すと、となりに青コインも出す（ならぶぶん、少し小さくする）。
 * redBalance も渡すと3つになるので、黄色を上の段、青と赤を下の段に重ねて、横にのびないようにする
 */
const compact = new Intl.NumberFormat("ja-JP", { notation: "compact", maximumFractionDigits: 1 });

export function CoinBadge({ balance, blueBalance = null, redBalance = null, whiteBalance = null }: { balance: number; blueBalance?: number | null; redBalance?: number | null; whiteBalance?: number | null }) {
  if (whiteBalance !== null) return <div className="grid shrink-0 grid-cols-2 gap-0.5" aria-label="所持コイン">
    {([{ name: "コイン", value: balance, Art: null, color: "text-ink", bg: "bg-sun-soft/70 border-[#e8d4aa]" }, { name: "青コイン", value: blueBalance, Art: BlueCoinArt, color: "text-[#1F4F8F]", bg: "bg-[#EEF5FF] border-[#BFD7F5]" }, { name: "赤コイン", value: redBalance, Art: RedCoinArt, color: "text-[#9C2B31]", bg: "bg-[#FFF0EE] border-[#F2C4BF]" }, { name: "白コイン", value: whiteBalance, Art: WhiteCoinArt, color: "text-[#486457]", bg: "bg-[#f8fcf3] border-[#bdcbbf]" }]).filter(c => c.value !== null).map(c => <div key={c.name} aria-label={`${c.name} ${formatCoins(c.value ?? 0)}枚`} title={`${c.name} ${formatCoins(c.value ?? 0)}枚`} className={`flex min-w-0 items-center justify-end gap-0.5 rounded-full border px-1.5 py-px shadow-sm ${c.bg}`}>
      {c.Art ? <c.Art className="h-[14px] w-[14px] shrink-0" /> : <IconCoin size={14} />}<span className={`text-[11px] font-bold tabular-nums ${c.color}`}>{(c.value ?? 0) >= 1e6 ? compact.format(c.value ?? 0) : formatCoins(c.value ?? 0)}</span>
    </div>)}
  </div>;
  const pair = blueBalance !== null || redBalance !== null;
  const trio = blueBalance !== null && redBalance !== null;
  const yellow = (
    <div
      aria-label={`所持コイン ${formatCoins(balance)}枚`}
      className={`flex shrink-0 items-center rounded-full border border-[#e8d4aa] bg-sun-soft/70 shadow-sm ${trio ? "gap-1 px-2 py-px" : pair ? "gap-1 px-2 py-1" : "gap-1.5 px-3 py-1.5"}`}
    >
      <IconCoin size={trio ? 15 : pair ? 17 : 20} />
      <span className={`font-bold tabular-nums text-ink ${trio ? "text-[12px]" : pair ? "text-[13px]" : "text-sm"}`}>{formatCoins(balance)}</span>
    </div>
  );
  const small = trio ? "gap-0.5 px-1.5 py-px" : "gap-1 px-2 py-1";
  const icon = trio ? "h-[14px] w-[14px]" : "h-[17px] w-[17px]";
  const text = trio ? "text-[11px]" : "text-[13px]";
  const blue = blueBalance !== null ? (
    <div
      aria-label={`青コイン ${formatCoins(blueBalance)}枚`}
      className={`flex shrink-0 items-center rounded-full border border-[#BFD7F5] bg-[#EEF5FF] shadow-sm ${small}`}
    >
      <BlueCoinArt className={icon} />
      <span className={`${text} font-bold tabular-nums text-[#1F4F8F]`}>{formatCoins(blueBalance)}</span>
    </div>
  ) : null;
  const red = redBalance !== null ? (
    <div
      aria-label={`赤コイン ${formatCoins(redBalance)}枚`}
      className={`flex shrink-0 items-center rounded-full border border-[#F2C4BF] bg-[#FFF0EE] shadow-sm ${small}`}
    >
      <RedCoinArt className={icon} />
      <span className={`${text} font-bold tabular-nums text-[#9C2B31]`}>{formatCoins(redBalance)}</span>
    </div>
  ) : null;

  if (trio) {
    return (
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        {yellow}
        <div className="flex items-center gap-0.5">
          {blue}
          {red}
        </div>
      </div>
    );
  }
  return (
    <div className={`flex shrink-0 items-center ${pair ? "gap-1" : ""}`}>
      {yellow}
      {blue}
      {red}
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
