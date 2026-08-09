import Link from "next/link";
import { HomeLiveRefresh } from "@/components/home-live-refresh";
import type { ExpProgress } from "@/lib/exp";

/** public/characters/level-sign.png の実ピクセル比（420×556）。絶対に変えない。 */
const SIGN_ASPECT_RATIO = "420 / 556";

export function LevelTag({ progress }: { progress: ExpProgress }) {
  const nextLabel = progress.nextReward?.name ?? "すべて解放済み";

  return (
    <>
      <HomeLiveRefresh />
      <Link
        href="/mypage/exp-history"
        aria-label={`おでかけレベル ${progress.level}。EXP履歴を見る`}
        className="absolute top-4 right-4 z-10 block w-[32%] min-w-[106px] max-w-[126px] active:scale-[0.98] sm:max-w-[130px]"
        style={{ aspectRatio: SIGN_ASPECT_RATIO, boxShadow: "none" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/characters/level-sign.png"
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none shadow-none"
          style={{
            opacity: 0.96,
            filter: "saturate(0.82) brightness(1.04) contrast(0.94)",
            boxShadow: "none",
          }}
        />

        <span
          className="absolute flex flex-col items-center justify-center text-center"
          style={{ left: "20%", right: "14%", top: "19%", bottom: "23%" }}
        >
          <span className="block w-full whitespace-nowrap text-[6.5px] font-bold tracking-[0.03em] text-[#67523a]">
            おでかけレベル
          </span>
          <span className="mt-0.5 flex items-end justify-center gap-1 leading-none text-[#4d4032]">
            <span className="pb-0.5 text-[7.5px] font-semibold">Lv.</span>
            <span className="text-[19px] font-bold tabular-nums">{progress.level}</span>
          </span>
          <span aria-hidden="true" className="mt-1 block h-px w-full bg-[#c9a06e]/50" />

          <span className="mt-1 flex w-full items-center justify-between gap-1 text-[6.5px] text-[#6d5a42]">
            <span className="font-bold">EXP</span>
            <span className="min-w-0 truncate tabular-nums">
              {progress.totalExp.toLocaleString("ja-JP")} / {progress.nextLevelExp.toLocaleString("ja-JP")}
            </span>
          </span>
          <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-[#dfc79e]/80" aria-hidden="true">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-leaf to-leaf-deep transition-[width] duration-500"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </span>

          <span aria-hidden="true" className="mt-1 block h-px w-full border-t border-dashed border-[#b99463]/75" />
          <span className="mt-1 block min-w-0">
            <span className="block text-[6.5px] text-[#80694d]">次に解放</span>
            <span className="mt-0.5 block line-clamp-2 text-[7.5px] leading-tight font-bold text-[#5c4935]">
              {nextLabel}
            </span>
          </span>
        </span>
      </Link>
    </>
  );
}
