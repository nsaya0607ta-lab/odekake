/** グループ切り替え・ユーザーからの遷移直後に、データ取得を待たず即座に表示する骨格。
 * これが無いと、サーバー側の取得が終わるまで画面が固まって見えてしまう */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-label="グループを読み込んでいます" className="animate-pulse motion-reduce:animate-none">
      <div className="h-14 border-b border-line-strong bg-white px-4 py-4">
        <div className="h-5 w-32 rounded-full bg-paper-deep" />
      </div>
      <div className="-mt-1 flex items-center gap-3 bg-white px-4 py-1.5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-14 w-14 shrink-0 rounded-full bg-paper-deep" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1 px-0 pt-1">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="aspect-square bg-paper-deep" />
        ))}
      </div>
      <span className="sr-only">読み込み中です</span>
    </div>
  );
}
