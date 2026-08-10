import { LEVEL_UP_COIN_BANDS, STEP_COIN_AMOUNT, STEP_COIN_INTERVAL, formatCoins } from "@/lib/coins";
import { IconChevronDown, IconCoin } from "./icons";

/**
 * コインのもらい方を、押すまでは畳んでおく小さいボタン。
 * `CoinPill` の「＋」から `#coin-how-to-get` で直接ここへ飛べる
 * （id が details の外側にあると自動で開かないため、details 自体に付ける）。
 */
export function CoinEarnMethods() {
  return (
    <details id="coin-how-to-get" className="group scroll-mt-20">
      <summary className="mx-auto flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-full border border-line-strong bg-card px-4 py-2 text-xs font-bold text-ink-soft shadow-sm active:bg-paper-deep">
        <IconCoin size={14} />
        コインの取得方法
        <IconChevronDown size={13} className="text-ink-faint transition-transform group-open:rotate-180" />
      </summary>

      <div className="rough-card mt-2 space-y-3 overflow-hidden p-3.5 text-[11px]">
        <div>
          <p className="font-bold text-ink-soft">レベルアップ報酬（到達レベルごとに1回）</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {LEVEL_UP_COIN_BANDS.map((band, index) => {
              const from = index === 0 ? 2 : LEVEL_UP_COIN_BANDS[index - 1]!.maxLevel + 1;
              const label = from === band.maxLevel ? `Lv.${from}` : `Lv.${from}〜${band.maxLevel}`;
              return (
                <span
                  key={band.maxLevel}
                  className="flex items-center gap-1 rounded-full bg-paper-deep px-2 py-1 tabular-nums"
                >
                  {label}
                  <IconCoin size={11} />
                  {formatCoins(band.coins)}
                </span>
              );
            })}
          </div>
        </div>

        <div>
          <p className="font-bold text-ink-soft">歩数報酬（1日ごと）</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="flex items-center gap-1 rounded-full bg-paper-deep px-2 py-1 tabular-nums">
              {STEP_COIN_INTERVAL.toLocaleString("ja-JP")}歩ごと
              <IconCoin size={11} />+{STEP_COIN_AMOUNT}
            </span>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
            500歩達成するたびに10コイン増えます。歩数は同じ日のうちに増えた分だけ反映されます。歩数の連携はマイページの「iPhone歩数連携」から設定できます。
          </p>
        </div>
      </div>
    </details>
  );
}
