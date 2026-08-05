export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-label="画面を読み込んでいます">
      <div className="fixed inset-x-0 top-0 z-[70] h-1 overflow-hidden bg-leaf-soft">
        <span className="route-progress block h-full w-1/3 rounded-r-full bg-leaf-deep" />
      </div>

      <main className="mx-auto max-w-lg space-y-5 px-4 pt-5">
        <div className="h-11 w-2/5 animate-pulse rounded-2xl bg-paper-deep motion-reduce:animate-none" />
        <div className="rough-card space-y-4 px-5 py-5">
          <div className="h-5 w-1/3 animate-pulse rounded-full bg-paper-deep motion-reduce:animate-none" />
          <div className="h-36 animate-pulse rounded-2xl bg-paper-deep motion-reduce:animate-none" />
        </div>
        <div className="space-y-2">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="rough-card h-16 animate-pulse bg-paper-deep motion-reduce:animate-none"
            />
          ))}
        </div>
      </main>

      <span className="sr-only">読み込み中です</span>
    </div>
  );
}
