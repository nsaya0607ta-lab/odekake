"use client";

import Link from "next/link";
import { HomeLiveRefresh } from "@/components/home-live-refresh";
import { useTodaySteps } from "@/components/use-today-steps";
import { getStepProgress, type ExpProgress } from "@/lib/exp";

/**
 * おさんぽ広場の左側に、枝から吊り下がる2枚の看板。
 *
 * 上が「おでかけレベル」、下が「今日のおさんぽ」。数値はすべて実データで、歩数だけは
 * ショートカット同期を拾うためにクライアント側で更新し続ける（useTodaySteps）。
 *
 * 横幅は必ず散歩エリアの左 1/3 に収める。ここを広げると犬の歩ける範囲
 * （wandering-frenchie.tsx の WALK_ZONE_LEFT）と重なる。
 */

/** 木の板の質感。素材画像ではなく、重ねたグラデーションで作っている */
const WOOD_BACKGROUND =
  "linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,255,255,0) 46%)," +
  "linear-gradient(160deg, #f6e8ca 0%, #efd9ae 100%)";
const WOOD_SHADOW = "0 2px 0 rgba(150,122,84,0.16), inset 0 0 0 2px rgba(255,255,255,0.42)";
/** 縄。点線のグラデーションで撚りを表す */
const ROPE_BACKGROUND =
  "repeating-linear-gradient(to bottom, #c3a274 0 3px, rgba(160,128,88,0.55) 3px 6px)";

export function WalkSigns({
  progress,
  initialSteps,
  initialStepExp,
  initialCoinBalance,
}: {
  progress: ExpProgress;
  initialSteps: number | null;
  initialStepExp: number;
  initialCoinBalance: number;
}) {
  const { steps, stepExp } = useTodaySteps({ initialSteps, initialStepExp, initialCoinBalance });
  const stepProgress = getStepProgress(steps);
  const synced = steps !== null;

  return (
    <>
      <HomeLiveRefresh />
      {/* 枝は左上から右下へ傾いているので、先頭の縄だけ右側を短くして枝に合わせる */}
      <div className="absolute top-[24px] left-[2.5%] z-10 flex w-[32%] max-w-[160px] flex-col">
        <Ropes height={30} rightTop={16} />
        <Link
          href="/mypage/exp-history"
          aria-label={`おでかけレベル ${progress.level}。EXP履歴を見る`}
          className="active:scale-[0.98]"
        >
          <SignBoard label="おでかけレベル" tone="leaf">
            <span className="flex items-end justify-center gap-1 leading-none">
              <PawIcon />
              <span className="pb-[3px] text-[10px] font-semibold">Lv.</span>
              <span className="text-[22px] font-bold tabular-nums text-[#4d4032]">{progress.level}</span>
            </span>
            <span className="mt-1.5 flex w-full items-center justify-between gap-1 text-[8px] font-semibold tabular-nums">
              <span>EXP</span>
              <span className="min-w-0 truncate">
                {progress.totalExp.toLocaleString("ja-JP")} /{" "}
                {/* 最終レベルは「次のレベル」が無いので、到達済みだと分かる表示にする */}
                {progress.nextReward === null ? "MAX" : progress.nextLevelExp.toLocaleString("ja-JP")}
              </span>
            </span>
            <ProgressBar percent={progress.progressPercent} tone="leaf" />
          </SignBoard>
        </Link>

        <Ropes height={14} />
        <SignBoard label="今日のおさんぽ" tone="blossom">
          <span className="flex items-end justify-center gap-1 leading-none" aria-live="polite">
            <ShoeIcon />
            <span className="text-[22px] font-bold tabular-nums text-[#4d4032]">
              {synced ? steps.toLocaleString("ja-JP") : "—"}
            </span>
            {/* 未連携の「—」に単位を付けると「一歩」と読めてしまうので、歩数があるときだけ出す */}
            {synced ? <span className="pb-[3px] text-[9px] font-semibold">歩</span> : null}
          </span>
          <span className="mt-2 block w-full">
            <ProgressBar percent={synced ? stepProgress.progressPercent : 0} tone="blossom" />
          </span>
          <span className="mt-1.5 block w-full text-center text-[8px] font-semibold tabular-nums text-[#7a6146]">
            {!synced
              ? "ショートカット連携前"
              : stepProgress.remainingSteps === null
                ? `今日の歩数EXP +${stepExp}`
                : `EXPまであと ${stepProgress.remainingSteps.toLocaleString("ja-JP")} 歩`}
          </span>
        </SignBoard>
      </div>
    </>
  );
}

/**
 * 看板の見出しに添える小さな絵。
 * 絵文字だと端末のカラーパレット（特に青い運動靴）が水彩の色から浮くので、
 * 板と同じ茶系で描いてある。
 */
function PawIcon() {
  return (
    <svg viewBox="0 0 16 16" className="mb-[1px] h-[13px] w-[13px]" aria-hidden="true">
      <ellipse cx="8" cy="11" rx="4.4" ry="3.6" fill="#8a6b47" />
      <ellipse cx="3.6" cy="6.4" rx="1.9" ry="2.3" fill="#8a6b47" />
      <ellipse cx="6.6" cy="4.6" rx="1.9" ry="2.4" fill="#8a6b47" />
      <ellipse cx="9.8" cy="4.7" rx="1.9" ry="2.4" fill="#8a6b47" />
      <ellipse cx="12.6" cy="6.6" rx="1.8" ry="2.2" fill="#8a6b47" />
    </svg>
  );
}

function ShoeIcon() {
  return (
    <svg viewBox="0 0 20 14" className="mb-[1px] h-[13px] w-[18px]" aria-hidden="true">
      <path
        d="M2 10.4 L2.6 4.6 Q2.7 3.4 4 3.6 L6.2 4 L8.4 6.2 L14.6 8 Q18 9 18 11 L18 11.6 Q18 12.4 17 12.4 L3.2 12.4 Q2 12.4 2 11.2 Z"
        fill="#f2e3c6"
        stroke="#a98559"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path d="M6.4 4.2 L5.2 6.6 M8.6 6.4 L7.4 8.4" stroke="#a98559" strokeWidth="1" strokeLinecap="round" />
      <path d="M2.2 11.4 L17.8 11.4" stroke="#a98559" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

/** 枝と看板、看板どうしをつなぐ2本の縄 */
function Ropes({ height, rightTop = 0 }: { height: number; rightTop?: number }) {
  return (
    <span className="relative block" style={{ height }} aria-hidden="true">
      <span
        className="absolute bottom-0 left-[8%] top-0 w-[2px] rounded-full"
        style={{ background: ROPE_BACKGROUND }}
      />
      <span
        className="absolute bottom-0 right-[8%] w-[2px] rounded-full"
        style={{ background: ROPE_BACKGROUND, top: rightTop }}
      />
    </span>
  );
}

/** 木の板1枚。上辺のリボンに見出しが乗る */
function SignBoard({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "leaf" | "blossom";
  children: React.ReactNode;
}) {
  return (
    <span
      className="relative block rounded-[16px_14px_17px_13px] border-[1.5px] border-[#d8b988] px-2.5 pt-[13px] pb-2.5 text-[#6b563c]"
      style={{ background: WOOD_BACKGROUND, boxShadow: WOOD_SHADOW }}
    >
      <span
        aria-hidden="true"
        className="absolute top-[4px] left-[6%] h-[5px] w-[5px] rounded-full border border-[#d8b988] bg-white/75"
      />
      <span
        aria-hidden="true"
        className="absolute top-[4px] right-[6%] h-[5px] w-[5px] rounded-full border border-[#d8b988] bg-white/75"
      />
      <span
        className={`absolute -top-[9px] left-1/2 -translate-x-1/2 px-3 py-[2.5px] text-[9px] font-bold whitespace-nowrap text-card ${
          tone === "leaf" ? "bg-leaf" : "bg-blossom"
        }`}
        style={{ clipPath: "polygon(0 0, 100% 0, 94% 50%, 100% 100%, 0 100%, 6% 50%)" }}
      >
        {label}
      </span>
      {children}
    </span>
  );
}

function ProgressBar({ percent, tone }: { percent: number; tone: "leaf" | "blossom" }) {
  return (
    <span
      aria-hidden="true"
      className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-[#b89464]/30"
    >
      <span
        className={`block h-full rounded-full transition-[width] duration-500 ${
          tone === "leaf" ? "bg-gradient-to-r from-leaf to-leaf-deep" : "bg-gradient-to-r from-blossom to-[#c8788a]"
        }`}
        style={{ width: `${percent}%` }}
      />
    </span>
  );
}
