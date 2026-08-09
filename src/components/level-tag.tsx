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
        className="absolute top-3 right-3 z-10 w-[32%] min-w-[106px] max-w-[128px] rotate-[1.4deg] active:scale-[0.98]"
      >
        <span
          aria-hidden="true"
          className="absolute -bottom-3 left-[17px] h-7 w-3 -rotate-[9deg] rounded-b-md border border-[#9d7548] bg-[#c99b61] shadow-sm"
        />
        <span
          aria-hidden="true"
          className="absolute right-[17px] -bottom-3 h-7 w-3 rotate-[9deg] rounded-b-md border border-[#9d7548] bg-[#c99b61] shadow-sm"
        />

        <span className="relative block min-h-[142px] overflow-hidden rounded-[12px_16px_13px_10px] border-2 border-[#a97e4d] bg-[#f2d9aa] px-2 py-2.5 shadow-[0_5px_12px_rgba(83,61,34,0.2),inset_0_0_0_2px_rgba(255,248,224,0.45)]">
          <span
            aria-hidden="true"
            className="absolute top-2 left-2 h-1.5 w-1.5 rounded-full border border-[#8d683f] bg-[#d8ad70] shadow-inner"
          />
          <span
            aria-hidden="true"
            className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full border border-[#8d683f] bg-[#d8ad70] shadow-inner"
          />
          <span aria-hidden="true" className="absolute top-[27px] right-[-5px] h-px w-16 -rotate-6 bg-[#c49b66]/45" />
          <span aria-hidden="true" className="absolute top-[72px] left-[-6px] h-px w-14 rotate-3 bg-[#c49b66]/40" />
          <span aria-hidden="true" className="absolute right-[-8px] bottom-[34px] h-px w-20 -rotate-3 bg-[#c49b66]/40" />

          <span className="relative block whitespace-nowrap text-center text-[8px] font-bold tracking-[0.04em] text-[#67523a]">
            おでかけレベル
          </span>
          <span className="relative mt-1 flex items-end justify-center gap-1 leading-none text-[#4d4032]">
            <span className="pb-0.5 text-[9px] font-semibold">Lv.</span>
            <span className="text-[25px] font-bold tabular-nums">{progress.level}</span>
          </span>

          <span className="relative mt-2 flex items-center justify-between gap-1 text-[8px] text-[#6d5a42]">
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

          <span className="relative mt-2 block min-w-0 border-t border-dashed border-[#b99463] pt-1.5 text-center">
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
