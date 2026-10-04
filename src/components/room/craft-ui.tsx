"use client";

/**
 * おみやげクラフトの画面
 * - CraftPanel: もようがえの「おみやげ」タブの「クラフト」。作品ごとに材料（飾っていないおみやげ）と、つくる・かざるボタン
 * - CraftDone: できあがったときのカード（紙ふぶき・できた作品・わんこのひとこと）
 */
import { CRAFT_IDS, CRAFTS, type CraftId } from "@/lib/room/crafts";
import { SOUVENIRS, type SouvenirId } from "@/lib/room/souvenirs";
import { CraftArt } from "./craft-art";
import { SouvenirArt } from "./souvenir-art";

export function CraftPanel({ crafts, availableOf, onCraft, placedOf, onPlace }: {
  crafts: Partial<Record<CraftId, number>>;
  availableOf: (id: SouvenirId) => number;
  onCraft: (id: CraftId) => void;
  placedOf: (id: CraftId) => number;
  onPlace: (id: CraftId) => void;
}) {
  const made = CRAFT_IDS.filter((id) => (crafts[id] ?? 0) > 0).length;
  return (
    <div className="mt-2">
      <div className="rounded-2xl border border-line bg-paper px-3 py-2.5">
        <div className="flex items-baseline justify-between">
          <p className="text-[12px] font-black text-ink">おみやげクラフト</p>
          <p className="text-[11px] font-bold tabular-nums text-ink-soft"><span className="text-[15px] font-black text-leaf-deep">{made}</span> / {CRAFT_IDS.length} さくひん</p>
        </div>
        <p className="mt-1 text-[10px] font-semibold leading-relaxed text-ink-faint">あつめた おみやげで、かべに かざる さくひんを つくれます。材料には「飾っていない」おみやげを つかいます（色ちがいは つかいません）。</p>
      </div>
      <ul className="mt-3 space-y-2.5">
        {CRAFT_IDS.map((id) => {
          const c = CRAFTS[id];
          const needs = Object.entries(c.needs) as [SouvenirId, number][];
          const ready = needs.every(([sid, n]) => availableOf(sid) >= n);
          const short = needs.reduce((sum, [sid, n]) => sum + Math.max(0, n - availableOf(sid)), 0);
          const have = crafts[id] ?? 0, placed = placedOf(id);
          return (
            <li key={id} className={`flex gap-3 rounded-2xl border p-2.5 ${ready ? "border-leaf/60 bg-[#F6FBF0]" : "border-line bg-paper"}`}>
              <span className={`relative flex w-[76px] shrink-0 items-center justify-center rounded-xl bg-card p-1.5 ${have ? "" : "opacity-60 [filter:saturate(.35)]"}`}>
                <CraftArt id={id} />
                {have ? <span className="absolute -right-1 -top-1 rounded-full bg-ink px-1.5 text-[9px] font-black tabular-nums text-white">×{have}</span> : null}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black leading-tight text-ink">{c.name}</p>
                {/* 材料：のこりの数 / いる数 */}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {needs.map(([sid, n]) => {
                    const a = availableOf(sid), ok = a >= n;
                    return (
                      <span key={sid} className={`flex items-center gap-1 rounded-full border py-0.5 pl-0.5 pr-2 text-[10px] font-bold tabular-nums ${ok ? "border-leaf/50 bg-card text-ink" : "border-[#F2B8B8] bg-[#FFF5F5] text-[#B8483E]"}`} title={SOUVENIRS[sid].name}>
                        <span className="block w-5"><SouvenirArt id={sid} /></span>
                        {Math.min(Math.max(0, a), n)}/{n}{ok ? " ✓" : ""}
                      </span>
                    );
                  })}
                </div>
                <div className="mt-2 flex gap-1.5">
                  <button type="button" disabled={!ready} onClick={() => onCraft(id)}
                    className="rounded-full bg-leaf-deep px-3.5 py-1.5 text-[11px] font-black text-white shadow-sm active:scale-95 disabled:bg-paper-deep disabled:text-ink-faint disabled:shadow-none">
                    {ready ? "つくる" : `あと ${short}こ`}
                  </button>
                  {have ? (
                    <button type="button" onClick={() => onPlace(id)} className="rounded-full border border-leaf/50 bg-card px-3 py-1.5 text-[11px] font-bold text-leaf-deep active:scale-95">
                      かざる <span className="tabular-nums text-ink-faint">{placed}/{have}</span>
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** できあがったときのカード */
export function CraftDone({ id, dogName, onClose, onDecorate }: { id: CraftId; dogName: string; onClose: () => void; onDecorate: () => void }) {
  const c = CRAFTS[id];
  return (
    <div className="fixed inset-0 z-[795] flex items-end justify-center bg-black/35 px-4 pb-6 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${c.name}が できた`} onClick={(e) => e.stopPropagation()} className="room-sv-pop relative w-full max-w-sm overflow-hidden rounded-[28px] border border-line bg-card text-center shadow-2xl">
        <span aria-hidden className="room-sv-burst pointer-events-none absolute left-1/2 top-[42%] z-10 block h-0 w-0">
          {Array.from({ length: 12 }, (_, i) => <span key={i} className="absolute -left-1.5 -top-1.5 block h-3 w-3 rounded-full" style={{ background: ["#FFD84A", "#FF8FB3", "#8CCB74", "#7FC8F2"][i % 4], ["--a" as string]: `${i * 30}deg` }} />)}
        </span>
        <div className="bg-[linear-gradient(160deg,#F3FAEC,#FFF6D6)] px-4 pb-3 pt-4">
          <p className="text-[11px] font-black tracking-[0.2em] text-leaf-deep">HANDMADE</p>
          <p className="mt-0.5 text-[15px] font-black text-ink">✂️ {c.name}が できた！</p>
        </div>
        <div className="px-6 pt-4">
          <span className="mx-auto block w-40 rounded-3xl bg-[#FBF6EA] p-3 shadow-inner"><CraftArt id={id} label={c.name} /></span>
          <p className="mx-auto mt-3 w-fit rounded-2xl bg-paper px-3 py-1.5 text-[12px] font-bold text-ink-soft shadow-sm">{dogName}「{c.made}」</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 px-4 pb-4">
          <button type="button" onClick={onClose} className="rounded-full border border-line bg-paper py-3 text-xs font-bold text-ink-soft active:scale-95">あとで</button>
          <button type="button" onClick={onDecorate} className="rounded-full bg-leaf-deep py-3 text-xs font-black text-white shadow-sm active:scale-95">かべに かざる</button>
        </div>
      </div>
    </div>
  );
}
