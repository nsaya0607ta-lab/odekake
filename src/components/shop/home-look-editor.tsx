"use client";

/**
 * ショップの「ホームの着せかえ」。ホームのカードの並び順・出す出さない・透け感を変える。
 * 変えたらすぐ保存する（この端末に覚える）。
 */
import Link from "next/link";
import { useState } from "react";
import { CARD_STYLE_LABELS, CARD_STYLES, HOME_CARD_LABELS, type CardStyle, type HomeCardId, type HomeLook } from "@/lib/home-look";

export function HomeLookEditor({ initial }: { initial: HomeLook }) {
  const [look, setLook] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "local" | "error">("idle");

  async function save(next: HomeLook) {
    const previous = look;
    setLook(next);
    setStatus("saving");
    try {
      const response = await fetch("/api/home-look", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const payload = (await response.json().catch(() => null)) as { synced?: boolean } | null;
      if (!response.ok) throw new Error("save failed");
      setStatus(payload?.synced === false ? "local" : "saved");
    } catch {
      setLook(previous);
      setStatus("error");
    }
  }

  const move = (id: HomeCardId, step: -1 | 1) => {
    const order = [...look.order];
    const from = order.indexOf(id);
    const to = from + step;
    if (to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to]!, order[from]!];
    void save({ ...look, order });
  };
  const toggle = (id: HomeCardId) => {
    const hidden = look.hidden.includes(id) ? look.hidden.filter((h) => h !== id) : [...look.hidden, id];
    void save({ ...look, hidden });
  };
  const setCards = (cards: CardStyle) => void save({ ...look, cards });

  return (
    <section className="rounded-[22px] border border-line bg-card p-3 shadow-[0_6px_16px_rgba(90,70,40,.08)]">
      <div className="flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <h2 className="text-base font-bold">ホームの着せかえ</h2>
          <p className="mt-0.5 text-[11px] text-ink-faint">カードを減らしたり透かしたりすると、背景がよく見えます</p>
        </div>
        <Link href="/home" className="shrink-0 rounded-full bg-leaf-soft px-3 py-1.5 text-[11px] font-black text-leaf-deep active:scale-95">
          ホームで見る
        </Link>
      </div>

      <p className="mt-3 px-1 text-[12px] font-bold text-ink-soft">カードの並び</p>
      <ol className="mt-1.5 flex flex-col gap-1.5">
        <li className="flex items-center gap-2 rounded-2xl bg-paper px-3 py-2 text-[13px] text-ink-faint">
          <span className="flex-1 font-bold">わんこのカード</span>
          <span className="text-[11px]">いつも一番上</span>
        </li>
        {look.order.map((id, index) => {
          const shown = !look.hidden.includes(id);
          return (
            <li key={id} className="flex items-center gap-1.5 rounded-2xl bg-paper px-3 py-1.5">
              <span className={`flex-1 text-[13px] font-bold ${shown ? "" : "text-ink-faint line-through"}`}>{HOME_CARD_LABELS[id]}</span>
              <button
                type="button"
                onClick={() => move(id, -1)}
                disabled={index === 0}
                aria-label={`${HOME_CARD_LABELS[id]}を上へ`}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-ink-soft active:scale-95 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(id, 1)}
                disabled={index === look.order.length - 1}
                aria-label={`${HOME_CARD_LABELS[id]}を下へ`}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-ink-soft active:scale-95 disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={shown}
                aria-label={`${HOME_CARD_LABELS[id]}を出す`}
                onClick={() => toggle(id)}
                className={`relative ml-1 h-7 w-12 shrink-0 rounded-full transition-colors ${shown ? "bg-leaf" : "bg-line-strong"}`}
              >
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left] ${shown ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 px-1 text-[12px] font-bold text-ink-soft">カードの透け感</p>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="カードの透け感">
        {CARD_STYLES.map((style) => {
          const active = look.cards === style;
          return (
            <button
              key={style}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setCards(style)}
              className={`flex flex-col items-center gap-1 rounded-2xl border px-1 py-2 active:scale-[.98] ${active ? "border-leaf bg-leaf-soft" : "border-line bg-paper"}`}
            >
              {/* 見本：うしろのしま模様が、どのくらい透けるか */}
              <span className="relative block h-8 w-14 overflow-hidden rounded-lg bg-[repeating-linear-gradient(135deg,#9cc6ef_0_6px,#f4a3b6_6px_12px)]">
                <span
                  className="absolute inset-1 rounded-md bg-[#fbf3e3]"
                  style={{ opacity: style === "solid" ? 1 : style === "soft" ? 0.8 : 0.55 }}
                />
              </span>
              <span className="text-[12px] font-black">{CARD_STYLE_LABELS[style].label}</span>
              <span className="text-[10px] text-ink-faint">{CARD_STYLE_LABELS[style].note}</span>
            </button>
          );
        })}
      </div>

      <p role="status" className="mt-2 min-h-[1.2em] px-1 text-[11px] text-ink-faint">
        {status === "saving" ? "保存しています…" : status === "saved" ? "保存しました。ほかの端末のホームにも反映されます" : status === "local" ? "この端末に保存しました（ほかの端末へは、準備ができしだい反映されます）" : status === "error" ? "保存できませんでした。時間をおいてお試しください" : "背景を変えているときは、ホームを横にスワイプすると背景だけをながめられます"}
      </p>
    </section>
  );
}
