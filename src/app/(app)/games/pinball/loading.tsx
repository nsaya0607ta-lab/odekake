/**
 * ゲーム本体と同じ暗い背景で待たせる。
 * (app) 共通のスケルトンは明るい配色なので、遷移のたびに白く光ってしまう。
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="ご当地ピンボールを読み込んでいます"
      className="fixed inset-0 z-[80] grid place-items-center bg-[radial-gradient(120%_60%_at_50%_0%,#3a1418_0%,#0b0d14_55%,#07090e_100%)]"
    >
      <div className="flex flex-col items-center gap-3">
        <span className="text-[9px] font-black tracking-[0.22em] text-[#ff8a80]">GAME 05</span>
        <span className="text-base font-black tracking-[0.05em] text-white">ご当地ピンボール</span>
        <span className="flex gap-1.5" aria-hidden="true">
          <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff8a80] motion-reduce:animate-none" />
          <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff8a80] [animation-delay:180ms] motion-reduce:animate-none" />
          <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff8a80] [animation-delay:360ms] motion-reduce:animate-none" />
        </span>
      </div>
      <span className="sr-only">読み込み中です</span>
    </div>
  );
}
