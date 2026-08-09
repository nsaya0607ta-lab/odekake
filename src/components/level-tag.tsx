import Link from "next/link";
import { HomeLiveRefresh } from "@/components/home-live-refresh";
import type { ExpProgress } from "@/lib/exp";

export function LevelTag({ progress }: { progress: ExpProgress }) {
  const nextLabel = progress.nextReward?.name ?? "すべて解放済み";

  return (
    <>
      <HomeLiveRefresh />
      <Link
        href="/mypage/exp-history"
        aria-label={`おでかけレベル ${progress.level}。EXP履歴を見る`}
        className="absolute top-3 right-3 z-10 w-[34%] min-w-[112px] max-w-[132px] rotate-[1.2deg] active:scale-[0.98]"
      >
        {/* 支柱 */}
        <span
          aria-hidden="true"
          className="absolute top-[96%] left-[24%] h-4 w-[13%] rounded-b-[2px] border border-[#9d7548] bg-gradient-to-b from-[#c99b61] to-[#a97e4d] shadow-sm"
        />
        <span
          aria-hidden="true"
          className="absolute top-[96%] right-[24%] h-4 w-[13%] rounded-b-[2px] border border-[#9d7548] bg-gradient-to-b from-[#c99b61] to-[#a97e4d] shadow-sm"
        />
        {/* 足もとの草花 */}
        <span aria-hidden="true" className="absolute -bottom-1.5 left-0 h-2 w-4 -rotate-6 rounded-full bg-leaf/70" />
        <span aria-hidden="true" className="absolute -bottom-1.5 right-0 h-2 w-4 rotate-6 rounded-full bg-leaf/70" />
        <span aria-hidden="true" className="absolute bottom-[-5px] left-[6px] h-1.5 w-1.5 rounded-full bg-sun" />

        <span className="relative block min-h-[150px] overflow-hidden rounded-[50%_50%_10px_10px/38%_38%_10px_10px] border-2 border-[#a97e4d] bg-[#f2d9aa] px-2 pt-4 pb-2.5 shadow-[0_5px_12px_rgba(83,61,34,0.2),inset_0_0_0_2px_rgba(255,248,224,0.45)]">
          {/* 頂部の葉飾り */}
          <span aria-hidden="true" className="absolute top-0 left-1/2 flex -translate-x-1/2 items-end gap-px">
            <span className="h-2 w-1.5 -rotate-[35deg] rounded-full bg-leaf" />
            <span className="mb-px h-1 w-1 rounded-full bg-[#8a6339]" />
            <span className="h-2 w-1.5 rotate-[35deg] rounded-full bg-leaf" />
          </span>
          <span aria-hidden="true" className="absolute top-2.5 left-2 h-1.5 w-1 -rotate-[20deg] rounded-full bg-leaf/70" />
          <span aria-hidden="true" className="absolute top-2.5 right-2 h-1.5 w-1 rotate-[20deg] rounded-full bg-leaf/70" />

          <span aria-hidden="true" className="absolute top-[30px] right-[-5px] h-px w-16 -rotate-6 bg-[#c49b66]/45" />
          <span aria-hidden="true" className="absolute top-[78px] left-[-6px] h-px w-14 rotate-3 bg-[#c49b66]/40" />
          <span aria-hidden="true" className="absolute right-[-8px] bottom-[38px] h-px w-20 -rotate-3 bg-[#c49b66]/40" />

          <span className="relative block whitespace-nowrap text-center text-[8px] font-bold tracking-[0.04em] text-[#67523a]">
            おでかけレベル
          </span>
          <span className="relative mt-1 flex items-end justify-center gap-1 leading-none text-[#4d4032]">
            <span className="pb-0.5 text-[9px] font-semibold">Lv.</span>
            <span className="text-[25px] font-bold tabular-nums">{progress.level}</span>
          </span>
          <span aria-hidden="true" className="relative mt-1.5 block h-px w-full bg-[#c9a06e]/60" />

          <span className="relative mt-1.5 flex items-center justify-between gap-1 text-[8px] text-[#6d5a42]">
            <span className="font-bold">EXP</span>
            <span className="min-w-0 truncate tabular-nums">
              {progress.totalExp.toLocaleString("ja-JP")} / {progress.nextLevelExp.toLocaleString("ja-JP")}
            </span>
          </span>
          <span className="relative mt-1 block h-1.5 overflow-hidden rounded-full bg-[#dfc79e]" aria-hidden="true">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-leaf to-leaf-deep transition-[width] duration-500"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </span>

          <span className="relative mt-2 flex items-center justify-center gap-1 text-[#8d683f]" aria-hidden="true">
            <span className="h-1 w-2.5 rounded-full bg-leaf/60" />
            <span className="h-1 w-2.5 rounded-full bg-leaf/60" />
          </span>
          <span className="relative mt-1 block min-w-0 text-center">
            <span className="block text-[8px] text-[#80694d]">次に解放</span>
            <span className="mt-0.5 block line-clamp-2 text-[9px] leading-tight font-bold text-[#5c4935]">
              {nextLabel}
            </span>
          </span>
        </span>
      </Link>
    </>
  );
}
