import Link from "next/link";
import { HomeLiveRefresh } from "@/components/home-live-refresh";
import { LEVEL_BANNER, LEVEL_BOARD, LEVEL_PANEL, SIGN_TEXT } from "@/components/home-scene";
import type { ExpProgress } from "@/lib/exp";

/**
 * 背景の絵に描かれている上の看板へ、おでかけレベルを書き込む。
 * 位置は home-scene.tsx の実測値に合わせてあるので、勝手にずらさない。
 *
 * 板の面は「レベル・EXP・バー」の3行でちょうど埋まる。次に解放される報酬まで載せると
 * 板からはみ出すので、そちらは板をタップした先（EXP履歴）に置いている。
 * 高さを持つ行に shrink-0 が要る。付け忘れると flex が縮めて EXPバーが消える。
 */
export function LevelTag({ progress }: { progress: ExpProgress }) {
  return (
    <>
      <HomeLiveRefresh />
      <Link
        href="/mypage/exp-history"
        aria-label={`おでかけレベル ${progress.level}。次に解放されるのは${
          progress.nextReward?.name ?? "すべて解放済み"
        }。EXP履歴を見る`}
        className="absolute z-10 block active:scale-[0.98]"
        style={LEVEL_BOARD}
      >
        <span className="absolute flex items-center justify-center" style={LEVEL_BANNER}>
          <span
            className="whitespace-nowrap leading-none font-bold tracking-[0.04em] text-white"
            style={{ fontSize: SIGN_TEXT.banner }}
          >
            おでかけレベル
          </span>
        </span>

        <span className="absolute flex flex-col justify-center" style={LEVEL_PANEL}>
          <span className="flex shrink-0 items-end justify-center gap-1 leading-none text-[#5b4a35]">
            <span className="pb-px font-semibold" style={{ fontSize: SIGN_TEXT.unit }}>
              Lv.
            </span>
            <span className="font-bold tabular-nums" style={{ fontSize: SIGN_TEXT.level }}>
              {progress.level}
            </span>
          </span>

          <span
            className="mt-px flex w-full shrink-0 items-center justify-between gap-1 leading-none text-[#7a6449]"
            style={{ fontSize: SIGN_TEXT.small }}
          >
            <span className="font-bold">EXP</span>
            <span className="min-w-0 truncate tabular-nums">
              {progress.totalExp.toLocaleString("ja-JP")} / {progress.nextLevelExp.toLocaleString("ja-JP")}
            </span>
          </span>
          <span
            className="mt-px block h-[3px] w-full shrink-0 overflow-hidden rounded-full bg-[#bb9463]/45"
            aria-hidden="true"
          >
            <span
              className="block h-full rounded-full bg-leaf-deep transition-[width] duration-500"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </span>
        </span>
      </Link>
    </>
  );
}
