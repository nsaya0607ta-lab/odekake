import { formatCoins } from "@/lib/coins";
import { FrenchieWithGear } from "@/components/frenchie-with-gear";
import { CoinArt, LeafArt, MeadowSceneArt, NoteArt, SparkleArt, TreasureChestArt } from "./coin-art";
import { IconCalendar, IconClipboard, IconCoin } from "./icons";

type Props = {
  balance: number;
  /** 今日もらったコイン */
  todayCoins: number;
  /** いまのおでかけレベル。解放済みの装備を着せた姿を出す */
  level: number;
};

/**
 * コイン画面の上のカード。
 * 右側の犬は、いま身につけている装備を確かめるプレビュー。
 */
export function CoinHero({ balance, todayCoins, level }: Props) {
  return (
    <section className="rough-card relative overflow-hidden">
      <div className="relative h-[196px] sm:h-[208px]">
        <MeadowSceneArt />

        {/* 着せ替えプレビュー */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <TreasureChestArt className="absolute bottom-1 right-[-3%] w-[68px] sm:w-[76px]" />
          <FrenchieWithGear
            pose="walk"
            level={level}
            className="absolute bottom-4 right-[11%] w-[38%] max-w-[152px]"
          />
          <CoinArt className="absolute right-[6%] top-[10%] w-5 rotate-[18deg]" />
          <CoinArt className="absolute right-[18%] top-[21%] w-4 -rotate-12" />
          <CoinArt className="absolute right-[2%] top-[36%] w-3.5 rotate-[32deg]" />
          <CoinArt className="absolute bottom-8 right-[36%] w-4 -rotate-[18deg]" />
          <SparkleArt className="absolute right-[31%] top-[27%] w-3.5 text-sun" />
          <SparkleArt className="absolute right-[7%] top-[52%] w-2.5 text-sun" />
          <NoteArt className="absolute right-[15%] top-[6%] w-3 text-leaf" />
          <LeafArt className="absolute right-[41%] top-[13%] w-3 text-leaf/70" />
        </div>

        {/* 所持コイン */}
        <div className="absolute inset-y-0 left-0 flex w-[53%] flex-col justify-center pl-3 pr-1 sm:w-[52%]">
          <p className="w-fit rounded-r-md rounded-l-sm bg-gradient-to-r from-[#c9a05a] to-[#dcbb7a] px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
            コインを集めて、つかおう！
          </p>

          <div className="mt-1.5 rounded-2xl border border-[#e8d9b6] bg-card/92 px-2.5 py-2.5 shadow-sm">
            <p className="text-[10px] font-bold text-ink-soft">所持コイン</p>
            <p className="mt-0.5 flex items-center gap-1.5">
              <IconCoin size={26} />
              <span className="text-[26px] leading-none font-bold tabular-nums text-ink">
                {formatCoins(balance)}
              </span>
            </p>
            <span className="mt-2 block h-px w-full bg-line" aria-hidden="true" />
            <p className="mt-2 text-[9px] leading-tight text-ink-soft">
              コインでガチャやショップを楽しもう！
            </p>
          </div>

          <div className="mt-1.5 flex items-stretch gap-1">
            <span className="flex min-w-0 flex-1 items-center gap-0.5 rounded-xl border border-[#e8d9b6] bg-card/85 px-1 py-1">
              <IconCalendar size={11} className="shrink-0 text-blossom" />
              <span className="min-w-0">
                <span className="block truncate text-[8.5px] leading-tight text-ink-soft">今日のボーナス</span>
                <span className="flex items-center gap-0.5 text-[10px] leading-tight font-bold text-ink">
                  <IconCoin size={11} />+{formatCoins(todayCoins)}
                </span>
              </span>
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-0.5 rounded-xl border border-[#e8d9b6] bg-card/85 px-1 py-1">
              <IconClipboard size={11} className="shrink-0 text-sky" />
              <span className="min-w-0">
                <span className="block truncate text-[8.5px] leading-tight text-ink-soft">コインミッション</span>
                <span className="block truncate text-[9.5px] leading-tight font-bold text-ink">達成でGET！</span>
              </span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
