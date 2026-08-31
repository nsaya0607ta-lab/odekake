"use client";

export function TownEditControls({
  itemName,
  candidateMode,
  canPlace,
  pending,
  onMove,
  onRotate,
  onStore,
  onConfirm,
  onCancel,
}: {
  itemName: string;
  candidateMode: boolean;
  canPlace: boolean;
  pending: boolean;
  onMove: () => void;
  onRotate: () => void;
  onStore: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <section
      aria-label={candidateMode ? "配置操作" : "建物編集"}
      className="fixed inset-x-3 z-[54] mx-auto max-w-md rounded-[24px] border border-line bg-card/95 p-3 shadow-[0_12px_32px_rgba(63,58,51,0.18)] backdrop-blur-md"
      style={{ bottom: "calc(var(--nav-height) + var(--safe-bottom) + 12px)" }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-black">{itemName}</p>
        {candidateMode ? (
          <span
            className={
              "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black " +
              (canPlace ? "bg-leaf-soft text-leaf-deep" : "bg-blossom-soft text-[#a65c68]")
            }
          >
            {canPlace ? "配置できます" : "ここには置けません"}
          </span>
        ) : (
          <span className="text-[10px] font-bold text-ink-faint">編集する操作を選択</span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {candidateMode ? (
          <>
            <button type="button" onClick={onRotate} disabled={pending} className="min-h-11 rounded-2xl bg-paper-deep text-xs font-black text-ink-soft">
              ↻ 回転
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!canPlace || pending}
              className="col-span-2 min-h-11 rounded-2xl bg-leaf text-xs font-black text-white disabled:bg-line disabled:text-ink-faint"
            >
              {pending ? "保存中…" : "ここに配置"}
            </button>
            <button type="button" onClick={onCancel} disabled={pending} className="min-h-11 rounded-2xl border border-line bg-card text-xs font-black text-ink-soft">
              やめる
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onMove} disabled={pending} className="min-h-11 rounded-2xl bg-leaf-soft text-xs font-black text-leaf-deep">
              ↔ 移動
            </button>
            <button type="button" onClick={onRotate} disabled={pending} className="min-h-11 rounded-2xl bg-sky-soft text-xs font-black text-[#43718f]">
              ↻ 回転
            </button>
            <button type="button" onClick={onStore} disabled={pending} className="min-h-11 rounded-2xl bg-sun-soft text-xs font-black text-[#947132]">
              ▣ 収納
            </button>
            <button type="button" onClick={onCancel} disabled={pending} className="min-h-11 rounded-2xl border border-line bg-card text-xs font-black text-ink-soft">
              戻る
            </button>
          </>
        )}
      </div>
    </section>
  );
}
