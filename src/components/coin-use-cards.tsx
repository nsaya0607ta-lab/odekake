import { ShopBasketArt, SparkleArt } from "./coin-art";
import { GachaSection } from "./gacha-section";
import { IconChevronRight } from "./icons";

/**
 * コインの主な使い道。
 * 左上のガチャカードを実機能の唯一の入口にし、右はショップの予告カード。
 */
export function CoinUseCards({ balance }: { balance: number }) {
  return (
    <div className="grid grid-cols-2 items-stretch gap-3">
      <GachaSection balance={balance} />
      <ShopUseCard />
    </div>
  );
}

function ShopUseCard() {
  return (
    <section className="rough-card flex min-w-0 flex-col overflow-hidden p-3.5">
      <h2 className="flex items-center gap-1 text-[15px] font-bold">
        <SparkleArt className="w-3.5 shrink-0 text-sun" />
        <span className="min-w-0 truncate">ショップでつかう</span>
      </h2>

      <div className="mt-2 flex min-h-0 flex-1 items-start gap-0.5">
        <p className="min-w-0 flex-1 text-[10px] leading-[1.7] text-ink-soft">
          <span className="block whitespace-nowrap">コインでお買い物！</span>
          <span className="block whitespace-nowrap">かわいいアイテムが</span>
          <span className="block whitespace-nowrap">いっぱい！</span>
        </p>
        <span className="flex h-[88px] w-[44%] shrink-0 items-end justify-center">
          <ShopBasketArt className="w-full" />
        </span>
      </div>

      <button
        type="button"
        disabled
        className="mt-3 flex w-full items-center justify-center gap-1 rounded-full bg-leaf px-3 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-45"
      >
        ショップへ行く
        <IconChevronRight size={14} className="shrink-0" />
      </button>
    </section>
  );
}
