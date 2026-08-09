import { GachaMachineArt, ShopBasketArt, SparkleArt } from "./coin-art";
import { IconChevronRight } from "./icons";

/**
 * コインの使い道の2枚のカード。
 * ガチャとショップの中身はまだないので、ボタンは押せない状態で置いている。
 */
export function CoinUseCards() {
  return (
    <div className="grid grid-cols-2 items-stretch gap-3">
      <UseCard
        title="コインでガチャ"
        description={["コインをつかって", "アイテムをゲット！"]}
        buttonLabel="ガチャをまわす"
        art={<GachaMachineArt className="h-full w-auto" />}
      />
      <UseCard
        title="ショップでつかう"
        description={["コインでお買い物！", "かわいいアイテムが", "いっぱい！"]}
        buttonLabel="ショップへ行く"
        art={<ShopBasketArt className="w-full" />}
      />
    </div>
  );
}

function UseCard({
  title,
  description,
  buttonLabel,
  art,
}: {
  title: string;
  description: string[];
  buttonLabel: string;
  art: React.ReactNode;
}) {
  return (
    <section className="rough-card flex min-w-0 flex-col overflow-hidden p-3.5">
      <h2 className="flex items-center gap-1 text-[15px] font-bold">
        <SparkleArt className="w-3.5 shrink-0 text-sun" />
        <span className="min-w-0 truncate">{title}</span>
      </h2>

      <div className="mt-2 flex min-h-0 flex-1 items-start gap-0.5">
        <p className="min-w-0 flex-1 text-[10px] leading-[1.7] text-ink-soft">
          {description.map((line) => (
            <span key={line} className="block whitespace-nowrap">
              {line}
            </span>
          ))}
        </p>
        <span className="flex h-[88px] w-[44%] shrink-0 items-end justify-center">{art}</span>
      </div>

      {/* ガチャ・ショップの機能はまだないため、見た目だけの押せないボタン */}
      <button
        type="button"
        disabled
        className="mt-3 flex w-full items-center justify-center gap-1 rounded-full bg-leaf px-3 py-2.5 text-xs font-bold text-white shadow-sm"
      >
        {buttonLabel}
        <IconChevronRight size={14} className="shrink-0" />
      </button>
    </section>
  );
}
