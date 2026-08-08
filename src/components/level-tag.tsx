import Link from "next/link";
import type { ExpProgress } from "@/lib/exp";

export function LevelTag({ progress }: { progress: ExpProgress }) {
  const nextLabel = progress.nextReward?.name ?? "すべて解放済み";

  return (
    <Link
      href="/mypage/exp-history"
      aria-label={`おでかけレベル ${progress.level}。EXP履歴を見る`}
      className="absolute top-3 right-3 z-10 w-[47%] max-w-[190px] rotate-[1.2deg] rounded-[18px_20px_19px_16px] border border-[#d2c5aa] bg-[#fffaf0]/96 px-3 py-3 shadow-[0_4px_14px_rgba(94,78,50,0.14)] backdrop-blur-sm active:scale-[0.98]"
    >
      <span className="block truncate text-[10px] font-bold tracking-[0.08em] text-ink-soft">
        おでかけレベル
      </span>
      <span className="mt-0.5 block text-[28px] leading-none font-bold tabular-nums text-ink">
        <span className="mr-1 text-[12px] font-semibold text-ink-soft">Lv.</span>
        {progress.level}
      </span>

      <span className="mt-2 flex items-center justify-between gap-1 text-[9px] text-ink-soft">
        <span className="font-bold">EXP</span>
        <span className="truncate tabular-nums">
          {progress.totalExp.toLocaleString("ja-JP")} / {progress.nextLevelExp.toLocaleString("ja-JP")}
        </span>
      </span>
      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-[#eee7d8]" aria-hidden="true">
        <span
          className="block h-full rounded-full bg-gradient-to-r from-leaf to-leaf-deep transition-[width] duration-500"
          style={{ width: `${progress.progressPercent}%` }}
        />
      </span>

      <span className="mt-2 block min-w-0 border-t border-dashed border-[#d8ccb5] pt-2">
        <span className="block text-[9px] text-ink-faint">次に解放</span>
        <span className="mt-0.5 block truncate text-[10px] font-bold text-ink-soft">{nextLabel}</span>
      </span>
    </Link>
  );
}

