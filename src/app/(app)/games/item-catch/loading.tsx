/**
 * ゲーム本体と同じ配色で待たせる。他のミニゲーム（わんこボウリング/わんこのおやつ道）と
 * 同様に、遷移直後に一瞬コンテンツが崩れて見えるのを防ぐ専用ローディング画面。
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="アイテムキャッチを読み込んでいます"
      className="fixed inset-0 z-[80] grid place-items-center bg-[linear-gradient(180deg,#fffdf8_0%,#fff5df_55%,#fbe7bd_100%)]"
    >
      <div className="flex flex-col items-center gap-3">
        <span className="text-[9px] font-black tracking-[0.22em] text-[#a46624]">おでかけ ミニゲーム 01</span>
        <span className="text-base font-black tracking-[0.05em] text-ink">アイテムキャッチ</span>
        <span className="flex gap-1.5" aria-hidden="true">
          <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#d8913b] motion-reduce:animate-none" />
          <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#d8913b] [animation-delay:180ms] motion-reduce:animate-none" />
          <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#d8913b] [animation-delay:360ms] motion-reduce:animate-none" />
        </span>
      </div>
      <span className="sr-only">読み込み中です</span>
    </div>
  );
}
