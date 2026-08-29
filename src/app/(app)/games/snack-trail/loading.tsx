/**
 * ゲーム本体と同じ暗い背景で待たせる。
 * (app) 共通のスケルトンは明るい配色なので、遷移のたびに白く光ってしまう。
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="わんこのおやつ道を読み込んでいます"
      className="fixed inset-0 z-[80] grid place-items-center bg-[linear-gradient(180deg,#101d2c_0%,#07111d_50%,#040a11_100%)]"
    >
      <div className="flex flex-col items-center gap-3">
        <span className="text-[9px] font-black tracking-[0.22em] text-[#72e3ff]">おでかけ ミニゲーム 03</span>
        <span className="text-base font-black tracking-[0.05em] text-[#f4fbff]">わんこのおやつ道</span>
        <span className="flex gap-1.5" aria-hidden="true">
          <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#72f4c6] motion-reduce:animate-none" />
          <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#72f4c6] [animation-delay:180ms] motion-reduce:animate-none" />
          <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#72f4c6] [animation-delay:360ms] motion-reduce:animate-none" />
        </span>
      </div>
      <span className="sr-only">読み込み中です</span>
    </div>
  );
}
