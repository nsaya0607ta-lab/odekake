"use client";

import { useCallback, useMemo, useState } from "react";
import { DAMBOURLE_PRIZES } from "@/lib/dambourle/prizes";
import { DEFAULT_BOX_ALT, DEFAULT_BOX_IMAGE, getDambourleBoxImage } from "@/lib/dambourle/box-image";
import { getDambourleLevel, getDambourleUnlockedSkinTier } from "@/lib/dambourle/skill-levels";
import { IconCheck, IconLock } from "./icons";

const DEFAULT_ITEM_ID = "default";

type Props = {
  equippedItemId: string | null;
  equippedSkinIndex: number;
  /** item_id -> 重複数（count）。未所持のものは含まれない */
  ownedCounts: Readonly<Record<string, number>>;
};

export function DambourlePicker({ equippedItemId, equippedSkinIndex, ownedCounts }: Props) {
  const [activeItemId, setActiveItemId] = useState(equippedItemId ?? DEFAULT_ITEM_ID);
  const [equipped, setEquipped] = useState({ itemId: equippedItemId ?? DEFAULT_ITEM_ID, skinIndex: equippedSkinIndex });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  const activeMaxTier = useMemo(() => {
    if (activeItemId === DEFAULT_ITEM_ID) return 0;
    const prize = DAMBOURLE_PRIZES.find((p) => p.id === activeItemId);
    const count = ownedCounts[activeItemId] ?? 0;
    if (!prize || count <= 0) return 0;
    const level = getDambourleLevel(prize.rarity, count);
    return getDambourleUnlockedSkinTier(activeItemId, level);
  }, [activeItemId, ownedCounts]);

  const equip = useCallback(
    async (itemId: string, skinIndex: number) => {
      if (pending || (itemId === equipped.itemId && skinIndex === equipped.skinIndex)) return;
      const previous = equipped;
      setEquipped({ itemId, skinIndex });
      setPending(true);
      setError(false);

      try {
        const response = await fetch("/api/dambourle-equipped", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId, skinIndex }),
        });
        if (!response.ok) throw new Error();
      } catch {
        setEquipped(previous);
        setError(true);
      } finally {
        setPending(false);
      }
    },
    [equipped, pending],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <DambourleCard
          name="初期のダンボール"
          image={DEFAULT_BOX_IMAGE}
          alt={DEFAULT_BOX_ALT}
          unlocked
          active={activeItemId === DEFAULT_ITEM_ID}
          equipped={equipped.itemId === DEFAULT_ITEM_ID}
          sublabel="効果なし"
          onSelect={() => {
            setActiveItemId(DEFAULT_ITEM_ID);
            void equip(DEFAULT_ITEM_ID, 0);
          }}
        />
        {DAMBOURLE_PRIZES.map((prize) => {
          const count = ownedCounts[prize.id] ?? 0;
          const unlocked = count > 0;
          const level = unlocked ? getDambourleLevel(prize.rarity, count) : 0;
          return (
            <DambourleCard
              key={prize.id}
              name={prize.name}
              image={getDambourleBoxImage(prize.id, unlocked ? Math.min(equipped.skinIndex, getDambourleUnlockedSkinTier(prize.id, level)) : 0)}
              alt={prize.name}
              unlocked={unlocked}
              active={activeItemId === prize.id}
              equipped={equipped.itemId === prize.id}
              sublabel={unlocked ? `${prize.rarity} / Lv${level}` : prize.rarity}
              onSelect={() => {
                if (!unlocked) return;
                setActiveItemId(prize.id);
                if (equipped.itemId !== prize.id) void equip(prize.id, Math.min(equipped.skinIndex, getDambourleUnlockedSkinTier(prize.id, level)));
              }}
            />
          );
        })}
      </div>

      {activeItemId !== DEFAULT_ITEM_ID ? (
        <div className="rough-card p-3">
          <p className="text-[11px] font-bold text-ink-soft">スキンを選ぶ（解放済み：{activeMaxTier + 1}種）</p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {Array.from({ length: activeMaxTier + 1 }, (_, skinIndex) => (
              <button
                key={skinIndex}
                type="button"
                disabled={pending}
                onClick={() => equip(activeItemId, skinIndex)}
                aria-pressed={equipped.itemId === activeItemId && equipped.skinIndex === skinIndex}
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border ${
                  equipped.itemId === activeItemId && equipped.skinIndex === skinIndex
                    ? "border-leaf ring-2 ring-leaf/40"
                    : "border-line"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getDambourleBoxImage(activeItemId, skinIndex)} alt={`スキン${skinIndex}`} draggable={false} className="h-full w-full bg-paper-deep object-contain p-1" />
                {equipped.itemId === activeItemId && equipped.skinIndex === skinIndex ? (
                  <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-leaf text-white">
                    <IconCheck size={10} />
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-center text-[11px] text-blossom">変更できませんでした。もう一度お試しください。</p> : null}
    </div>
  );
}

function DambourleCard({
  name,
  image,
  alt,
  unlocked,
  active,
  equipped,
  sublabel,
  onSelect,
}: {
  name: string;
  image: string;
  alt: string;
  unlocked: boolean;
  active: boolean;
  equipped: boolean;
  sublabel: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!unlocked}
      onClick={onSelect}
      aria-pressed={active}
      aria-label={unlocked ? name : "未所持"}
      className={`rough-card overflow-hidden p-3 text-left transition ${
        active ? "border-leaf ring-2 ring-leaf/40" : unlocked ? "active:bg-paper-deep" : "border-ink-faint/30"
      }`}
    >
      <span className={`relative block aspect-square overflow-hidden rounded-xl ${unlocked ? "bg-paper-deep" : "bg-stone-200"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={alt}
          draggable={false}
          className={`h-full w-full object-contain p-3 ${unlocked ? "" : "grayscale brightness-75 contrast-125 opacity-80"}`}
        />
        {!unlocked ? (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-b from-transparent via-paper/10 to-ink/15">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/70 text-white shadow-sm">
              <IconLock size={17} />
            </span>
            <span className="rounded-full bg-ink/70 px-2 py-0.5 text-[9px] font-bold tracking-wider text-white">未所持</span>
          </span>
        ) : null}
        {equipped ? (
          <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-leaf text-white shadow-sm">
            <IconCheck size={14} />
          </span>
        ) : null}
      </span>

      <p className={`mt-2 truncate text-sm font-bold ${unlocked ? "text-ink" : "text-ink-faint"}`}>{unlocked ? name : "？？？"}</p>
      <p className="mt-0.5 truncate text-[10px] text-ink-faint">{unlocked ? sublabel : "ガチャで手に入れると解放"}</p>
    </button>
  );
}
