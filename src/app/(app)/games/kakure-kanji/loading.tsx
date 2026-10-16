/** ゲーム本体と同じ和紙の色で待たせる */
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="かくれ漢字を読み込んでいます"
      className="fixed inset-0 z-[80] grid place-items-center bg-[linear-gradient(180deg,#f5eedf,#ece2cc)] dark:bg-[linear-gradient(180deg,#1c1915,#14120f)]"
    >
      <div className="flex flex-col items-center gap-3">
        <span className="text-[9px] font-black tracking-[0.22em] text-[#c4523a]">GAME 06</span>
        <span className="text-base font-black tracking-[0.1em] text-[#2b2620] dark:text-[#f1e8d8]">かくれ漢字</span>
        <span className="flex gap-1.5" aria-hidden="true">
          <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#c4523a] motion-reduce:animate-none" />
          <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#c4523a] [animation-delay:180ms] motion-reduce:animate-none" />
          <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#c4523a] [animation-delay:360ms] motion-reduce:animate-none" />
        </span>
      </div>
      <span className="sr-only">読み込み中です</span>
    </div>
  );
}
