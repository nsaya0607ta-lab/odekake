import { formatCoins } from "@/lib/coins";
import { getFrenchieSrc, type DogSkinId } from "@/lib/dog-skins";
import { CoinArt, LeafArt, MeadowSceneArt, NoteArt, SparkleArt, TreasureChestArt } from "./coin-art";
import { IconCoin } from "./icons";

type Props = {
  balance: number;
  /** 選択中の犬スキン。右側のプレビューをほかの画面と同じ姿に揃える */
  skin: DogSkinId;
};

/** コイン画面の上のカード。右側の犬は、選択中のスキンをそのまま映すプレビュー */
export function CoinHero({ balance, skin }: Props) {
  return (
    <section className="rough-card relative overflow-hidden">
      <div className="relative h-[196px] sm:h-[208px]">
        <MeadowSceneArt />

        {/* 犬スキンのプレビュー */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <TreasureChestArt className="absolute bottom-1 right-[-3%] w-[68px] sm:w-[76px]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getFrenchieSrc(skin, "walk")}
            alt=""
            width={300}
            height={254}
            draggable={false}
            className="absolute bottom-4 right-[11%] w-[38%] max-w-[152px] select-none"
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
        </div>
      </div>
    </section>
  );
}
