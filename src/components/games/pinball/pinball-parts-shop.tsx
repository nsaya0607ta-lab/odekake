"use client";

import { useEffect, useRef, useState } from "react";
import { RedCoinArt } from "@/components/coin-art";
import type { PinballItem } from "@/lib/games/pinball/game";
import { PINBALL_PARTS, type OwnedParts, type PinballPartId } from "@/lib/games/pinball/stage";
import type { PinballTheme } from "@/lib/games/pinball/themes";
import { RED_COIN_SOURCES_SHORT } from "@/lib/red-coin-rewards";
import { PinballPartArt } from "./pinball-part-art";

type Props = {
  /** 部品の絵の色（いつもの台の色） */
  theme: PinballTheme;
  /** バンパーの絵にのせるアイテム */
  bumperItem: PinballItem | null;
  /** 持っている数（はじめのぶん＋買ったぶん） */
  owned: OwnedParts;
  redCoins: number | null;
  onClose: () => void;
  /** 買えたとき（新しい持っている数・赤コインの残高） */
  onBought: (part: PinballPartId, owned: number, balance: number | null) => void;
};

/** ステージの部品のお店（赤コインで買う。くぎは10本ずつ） */
export function PinballPartsShop({ theme, bumperItem, owned, redCoins, onClose, onBought }: Props) {
  const [busy, setBusy] = useState<PinballPartId | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const buy = async (part: PinballPartId) => {
    if (busy) return;
    setBusy(part);
    setMessage(null);
    try {
      const response = await fetch("/api/games/pinball/parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ part }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; owned?: number | null; balance?: number | null; error?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "買えませんでした。");
      const info = PINBALL_PARTS.find((p) => p.id === part)!;
      onBought(part, typeof payload.owned === "number" ? payload.owned : owned[part] + info.pack, typeof payload.balance === "number" ? payload.balance : null);
      setMessage({ text: `${info.name}を買いました！`, ok: true });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "買えませんでした。", ok: false });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="pinball-shop-title" onClick={onClose}>
      <div
        className="max-h-[88dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#11141d] px-4 pb-6 pt-4 text-white shadow-[0_-12px_40px_rgba(0,0,0,0.5)]"
        style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black tracking-[0.16em] text-[#ff8a80]">PARTS SHOP</p>
            <h2 id="pinball-shop-title" className="text-[18px] font-black">部品のお店</h2>
          </div>
          {redCoins !== null ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full border border-[#ff8a80]/40 bg-[#3a1418] px-2.5 py-1" aria-label={`赤コイン ${redCoins.toLocaleString("ja-JP")}枚`}>
              <RedCoinArt className="h-[18px] w-[18px]" />
              <span className="text-[13px] font-black tabular-nums text-[#ffd3cd]">{redCoins.toLocaleString("ja-JP")}</span>
            </span>
          ) : null}
          <button ref={closeRef} type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-lg font-black active:scale-95" aria-label="とじる">
            ×
          </button>
        </div>
        <p className="mt-2 text-[11px] font-bold leading-relaxed text-white/60">
          買った部品は、どのステージにも何度でも使えます（1つのステージに置けるのは、持っている数まで）。{RED_COIN_SOURCES_SHORT}
        </p>

        {message ? (
          <p className={`mt-3 rounded-2xl px-3 py-2 text-center text-[12px] font-black ${message.ok ? "bg-[#1f3a2a] text-[#a6f0c0]" : "bg-[#3a1418] text-[#ffb4a8]"}`} role="status">
            {message.text}
          </p>
        ) : null}

        <ul className="mt-3 space-y-2">
          {PINBALL_PARTS.map((part) => {
            const have = owned[part.id];
            const full = have + part.pack > part.max;
            const short = redCoins !== null && redCoins < part.price;
            return (
              <li key={part.id} className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] p-3">
                <PinballPartArt
                  art={part.id}
                  theme={theme}
                  bumperItem={bumperItem}
                  className="h-14 w-14 shrink-0 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.45)] ring-1 ring-white/15"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-black">{part.name}</span>
                  <span className="mt-0.5 block text-[10px] font-bold leading-snug text-white/55">{part.lead}</span>
                  <span className="mt-1 block text-[10px] font-black tabular-nums text-white/75">
                    持っている {have} / {part.max}
                    {part.free ? <span className="font-bold text-white/45">（はじめから{part.free}）</span> : null}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={full || short || busy !== null}
                  onClick={() => void buy(part.id)}
                  className="flex shrink-0 flex-col items-center rounded-2xl bg-[#d0574e] px-3 py-1.5 text-white shadow-sm active:scale-95 disabled:bg-white/10 disabled:text-white/40"
                  aria-label={full ? `${part.name}はもう持てません` : `${part.name}を赤コイン${part.price}枚で買う`}
                >
                  <span className="flex items-center gap-1 text-[13px] font-black tabular-nums">
                    <RedCoinArt className="h-3.5 w-3.5" />
                    {part.price.toLocaleString("ja-JP")}
                  </span>
                  <span className="text-[9px] font-black">{busy === part.id ? "…" : full ? "いっぱい" : part.pack > 1 ? `${part.pack}こ かう` : "かう"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
