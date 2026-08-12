import Link from "next/link";
import { HomeLiveRefresh } from "@/components/home-live-refresh";
import { LEVEL_SIGN, LevelSignArt } from "@/components/home-scene";
import type { ExpProgress } from "@/lib/exp";

/**
 * ヒーローカードの上の看板。板の絵は LevelSignArt が描き、ここは板の面に載せる
 * 文字だけを持つ。位置は LEVEL_SIGN の％に合わせてあるので、勝手にずらさない。
 */
export function LevelTag({ progress }: { progress: ExpProgress }) {
  const nextLabel = progress.nextReward?.name ?? "すべて解放済み";

  return (
    <>
      <HomeLiveRefresh />
      <Link
        href="/mypage/exp-history"
        aria-label={`おでかけレベル ${progress.level}。EXP履歴を見る`}
        className="relative block w-full active:scale-[0.98]"
        style={{ aspectRatio: LEVEL_SIGN.ratio }}
      >
        <LevelSignArt />

        <span
          className="absolute flex items-center justify-center text-center leading-none"
          style={LEVEL_SIGN.banner}
        >
          <span className="whitespace-nowrap text-[7px] font-bold tracking-[0.04em] text-white">
            おでかけレベル
          </span>
        </span>

        <span className="absolute flex flex-col justify-center" style={LEVEL_SIGN.panel}>
          <span className="flex items-end justify-center gap-1 leading-none text-[#4d4032]">
            <span className="pb-0.5 text-[8px] font-semibold">Lv.</span>
            <span className="text-[21px] font-bold tabular-nums">{progress.level}</span>
          </span>

          <span aria-hidden="true" className="mt-1 block h-px w-full bg-[#c9a06e]/45" />

          <span className="mt-1 flex w-full items-center justify-between gap-1 text-[6.5px] text-[#6d5a42]">
            <span className="font-bold">EXP</span>
            <span className="min-w-0 truncate tabular-nums">
              {progress.totalExp.toLocaleString("ja-JP")} / {progress.nextLevelExp.toLocaleString("ja-JP")}
            </span>
          </span>
          <span className="mt-0.5 block h-1.5 w-full overflow-hidden rounded-full bg-[#dfc79e]/80" aria-hidden="true">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-leaf to-leaf-deep transition-[width] duration-500"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </span>

          <span aria-hidden="true" className="mt-1 block h-px w-full border-t border-dashed border-[#b99463]/70" />

          <span className="mt-1 flex min-w-0 items-baseline justify-center gap-1">
            <span className="shrink-0 text-[6.5px] text-[#80694d]">次に解放</span>
            <span className="min-w-0 truncate text-[7.5px] font-bold text-[#5c4935]">{nextLabel}</span>
          </span>
        </span>
      </Link>
    </>
  );
}
