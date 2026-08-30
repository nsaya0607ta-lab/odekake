import {
  GACHA_DUPLICATE_COINS,
  ITEM_CATCH_SCORE_PER_COIN,
  LEVEL_MILESTONE_COIN_BONUSES,
  LEVEL_UP_COIN_BANDS,
  LOGIN_BONUS_SCHEDULE,
  STEP_COIN_AMOUNT,
  STEP_COIN_INTERVAL,
  STEP_COIN_MILESTONES,
  formatCoins,
} from "@/lib/coins";
import { IconChevronDown, IconCoin } from "./icons";

/** コインの取得方法をまとめて表示する折りたたみ。 */
export function CoinEarnMethods() {
  return (
    <details id="coin-how-to-get" className="group scroll-mt-20">
      <summary className="mx-auto flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-full border border-line-strong bg-card px-4 py-2 text-xs font-bold text-ink-soft shadow-sm active:bg-paper-deep">
        <IconCoin size={14} />
        コインの取得方法
        <IconChevronDown size={13} className="text-ink-faint transition-transform group-open:rotate-180" />
      </summary>

      <div className="rough-card mt-2 space-y-4 overflow-hidden p-3.5 text-[11px]">
        <div>
          <p className="font-bold text-ink-soft">ログインボーナス（1日1回）</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {LOGIN_BONUS_SCHEDULE.map((coins, index) => (
              <span key={index} className="flex items-center gap-1 rounded-full bg-paper-deep px-2 py-1 tabular-nums">
                {index + 1}日目 <IconCoin size={11} />+{formatCoins(coins)}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
            日本時間で毎日連続して開くと7日目まで増えます。7日目の次は1日目へ戻り、1日空くと連続日数も1日目へ戻ります。
          </p>
        </div>

        <div>
          <p className="font-bold text-ink-soft">レベルアップ報酬（到達レベルごとに1回）</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {LEVEL_UP_COIN_BANDS.map((band, index) => {
              const from = index === 0 ? 2 : LEVEL_UP_COIN_BANDS[index - 1]!.maxLevel + 1;
              const label = from === band.maxLevel ? `Lv.${from}` : `Lv.${from}〜${band.maxLevel}`;
              return (
                <span key={band.maxLevel} className="flex items-center gap-1 rounded-full bg-paper-deep px-2 py-1 tabular-nums">
                  {label} <IconCoin size={11} />+{formatCoins(band.coins)}
                </span>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
            Lv.31以降はレベル上限なし。次のレベルに必要なEXPの約20%を、最低250コイン・50コイン単位で受け取ります。
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {LEVEL_MILESTONE_COIN_BONUSES.map((milestone) => (
              <span key={milestone.level} className="flex items-center gap-1 rounded-full bg-sun-soft px-2 py-1 tabular-nums">
                Lv.{milestone.level}ボーナス <IconCoin size={11} />+{formatCoins(milestone.coins)}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="font-bold text-ink-soft">歩数報酬（1日ごと）</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="flex items-center gap-1 rounded-full bg-paper-deep px-2 py-1 tabular-nums">
              {STEP_COIN_INTERVAL.toLocaleString("ja-JP")}歩ごと <IconCoin size={11} />+{STEP_COIN_AMOUNT}
            </span>
            {STEP_COIN_MILESTONES.map((milestone) => (
              <span key={milestone.steps} className="flex items-center gap-1 rounded-full bg-leaf-soft px-2 py-1 tabular-nums">
                {milestone.steps.toLocaleString("ja-JP")}歩達成 <IconCoin size={11} />+{milestone.coins}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
            達成ボーナスは累積します。10,000歩なら基本1,200＋達成ボーナス1,100で、合計2,300コインです。
          </p>
        </div>

        <div>
          <p className="font-bold text-ink-soft">アイテムキャッチ</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="flex items-center gap-1 rounded-full bg-paper-deep px-2 py-1 tabular-nums">
              {ITEM_CATCH_SCORE_PER_COIN}スコアごと <IconCoin size={11} />+1
            </span>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
            50秒遊びきるたびに獲得できます。回数・獲得上限はなく、完走すれば最低1コインです。
          </p>
        </div>

        <div>
          <p className="font-bold text-ink-soft">ガチャの重複返却</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {Object.entries(GACHA_DUPLICATE_COINS).map(([rarity, coins]) => (
              <span key={rarity} className="flex items-center gap-1 rounded-full bg-paper-deep px-2 py-1 tabular-nums">
                {rarity} <IconCoin size={11} />+{coins}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
            すでに持っている景品が出たとき、レア度に応じてコインの一部が戻ります。
          </p>
        </div>
      </div>
    </details>
  );
}
