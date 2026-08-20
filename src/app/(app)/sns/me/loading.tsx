export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-label="個人アカウントを読み込んでいます" className="animate-pulse motion-reduce:animate-none">
      <div className="h-14 border-b border-line-strong bg-white px-4 py-4">
        <div className="h-5 w-32 rounded-full bg-paper-deep" />
      </div>
      <div className="-mt-1 flex items-center gap-3 bg-white px-4 py-1.5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-14 w-14 shrink-0 rounded-full bg-paper-deep" />
        ))}
      </div>
      <div className="space-y-2 px-4 pt-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-16 rounded-2xl bg-paper-deep" />
        ))}
      </div>
      <span className="sr-only">読み込み中です</span>
    </div>
  );
}
