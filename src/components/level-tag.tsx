import Link from "next/link";
import { HomeLiveRefresh } from "@/components/home-live-refresh";
import { LEVEL_BANNER, LEVEL_BOARD, LEVEL_PANEL } from "@/components/home-scene";
import type { ExpProgress } from "@/lib/exp";

/**
 * 背景の絵に描かれている上の看板へ、おでかけレベルを書き込む。
 * 位置は home-scene.tsx の実測値に合わせてあるので、勝手にずらさない。
 * 板の面はそれほど広くないので、行を増やすときは必ず実機の幅で確かめること。
 */
export function LevelTag({ progress }: { progress: ExpProgress }) {
  const nextLabel = progress.nextReward?.name ?? "すべて解放済み";

  return (
    <>
      <HomeLiveRefresh />
      <Link
        href="/mypage/exp-history"
        aria-label={`おでかけレベル ${progress.level}。EXP履歴を見る`}
        className="absolute z-10 block active:scale-[0.98]"
        style={LEVEL_BOARD}
      >
        <span className="absolute flex items-center justify-center" style={LEVEL_BANNER}>
          <span className="whitespace-nowrap text-[7px] leading-none font-bold tracking-[0.04em] text-white">
            おでかけレベル
          </span>
        </span>

        {/* 板の面はぎりぎりなので、高さを持つ行には shrink-0 を付ける。
            付け忘れると flex が縮めて、EXPバーが消える */}
        <span className="absolute flex flex-col justify-center" style={LEVEL_PANEL}>
          <span className="flex shrink-0 items-end justify-center gap-1 leading-none text-[#5b4a35]">
            <span className="pb-px text-[8px] font-semibold">Lv.</span>
            <span className="text-[17px] font-bold tabular-nums">{progress.level}</span>
          </span>

          <span className="mt-px flex w-full shrink-0 items-center justify-between gap-1 text-[6px] leading-none text-[#7a6449]">
            <span className="font-bold">EXP</span>
            <span className="min-w-0 truncate tabular-nums">
              {progress.totalExp.toLocaleString("ja-JP")} / {progress.nextLevelExp.toLocaleString("ja-JP")}
            </span>
          </span>
          <span
            className="mt-0.5 block h-[5px] w-full shrink-0 overflow-hidden rounded-full bg-[#bb9463]/45"
            aria-hidden="true"
          >
            <span
              className="block h-full rounded-full bg-leaf-deep transition-[width] duration-500"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </span>

          <span className="mt-0.5 flex min-w-0 shrink-0 items-baseline justify-center gap-1 leading-none">
            <span className="shrink-0 text-[6px] text-[#8b7355]">次に解放</span>
            <span className="min-w-0 truncate text-[7px] font-bold text-[#5b4a35]">{nextLabel}</span>
          </span>
        </span>
      </Link>
    </>
  );
}
