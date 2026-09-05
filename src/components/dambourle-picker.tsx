"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { DAMBOURLE_PRIZES } from "@/lib/dambourle/prizes";
import { DEFAULT_BOX_ALT, DEFAULT_BOX_IMAGE, getDambourleBoxImage } from "@/lib/dambourle/box-image";
import {
  getDambourleLevel,
  getDambourleMinSkinIndex,
  getDambourleUnlockedSkinIndices,
  getDambourleUnlockedSkinTier,
} from "@/lib/dambourle/skill-levels";
import { IconCheck, IconLock } from "./icons";

const DEFAULT_ITEM_ID = "default";

type Props = {
  equippedItemId: string | null;
  equippedSkinIndex: number;
  /** item_id -> 重複数（count）。未所持のものは含まれない */
  ownedCounts: Readonly<Record<string, number>>;
};

export function DambourlePicker({ equippedItemId, equippedSkinIndex, ownedCounts }: Props) {
  const initialItemId = equippedItemId ?? DEFAULT_ITEM_ID;
  const [equipped, setEquipped] = useState({ itemId: initialItemId, skinIndex: equippedSkinIndex });
  // active = プレビュー中のダンボール、previewSkinIndex = プレビュー中のスキン段階。
  // OKボタンを押すまでは equipped（実際に装備されている状態）を変えない。
  const [activeItemId, setActiveItemId] = useState(initialItemId);
  const [previewSkinIndex, setPreviewSkinIndex] = useState(equippedSkinIndex);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  // BottomNav（bottom-nav.tsx）の固定ボックス内にある差し込み口に確定バーをポータルする。
  // 座標計算で高さを合わせるのではなく同じ固定ボックスに入れることで、隙間なくぴったり重ねる。
  const [navSlot, setNavSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setNavSlot(document.getElementById("bottom-nav-extra-slot"));
  }, []);

  const activeSkinIndices = useMemo(() => {
    if (activeItemId === DEFAULT_ITEM_ID) return [];
    const prize = DAMBOURLE_PRIZES.find((p) => p.id === activeItemId);
    const count = ownedCounts[activeItemId] ?? 0;
    if (!prize || count <= 0) return [];
    const level = getDambourleLevel(prize.rarity, count);
    return getDambourleUnlockedSkinIndices(activeItemId, level);
  }, [activeItemId, ownedCounts]);

  const activeName = activeItemId === DEFAULT_ITEM_ID ? "初期のダンボール" : DAMBOURLE_PRIZES.find((p) => p.id === activeItemId)?.name ?? activeItemId;

  const selectItem = useCallback(
    (itemId: string) => {
      setActiveItemId(itemId);
      setSaved(false);
      setError(false);
      if (itemId === DEFAULT_ITEM_ID) {
        setPreviewSkinIndex(0);
        return;
      }
      const prize = DAMBOURLE_PRIZES.find((p) => p.id === itemId);
      const count = ownedCounts[itemId] ?? 0;
      const level = prize && count > 0 ? getDambourleLevel(prize.rarity, count) : 0;
      const maxTier = getDambourleUnlockedSkinTier(itemId, level);
      const minSkinIndex = getDambourleMinSkinIndex(itemId);
      const seed = equipped.itemId === itemId ? equipped.skinIndex : maxTier;
      setPreviewSkinIndex(Math.max(minSkinIndex, Math.min(seed, maxTier)));
    },
    [equipped, ownedCounts],
  );

  const selectSkin = useCallback((skinIndex: number) => {
    setPreviewSkinIndex(skinIndex);
    setSaved(false);
    setError(false);
  }, []);

  const isPreviewEquipped = equipped.itemId === activeItemId && equipped.skinIndex === previewSkinIndex;

  const confirm = useCallback(async () => {
    if (pending || isPreviewEquipped) return;
    setPending(true);
    setError(false);
    setSaved(false);

    try {
      const response = await fetch("/api/dambourle-equipped", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: activeItemId, skinIndex: previewSkinIndex }),
      });
      if (!response.ok) throw new Error();
      setEquipped({ itemId: activeItemId, skinIndex: previewSkinIndex });
      setSaved(true);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }, [activeItemId, isPreviewEquipped, pending, previewSkinIndex]);

  return (
    <div className="space-y-4 pb-20">
      <div className="grid grid-cols-2 gap-3">
        <DambourleCard
          name="初期のダンボール"
          image={DEFAULT_BOX_IMAGE}
          alt={DEFAULT_BOX_ALT}
          unlocked
          active={activeItemId === DEFAULT_ITEM_ID}
          equipped={equipped.itemId === DEFAULT_ITEM_ID}
          sublabel="効果なし"
          onSelect={() => selectItem(DEFAULT_ITEM_ID)}
        />
        {DAMBOURLE_PRIZES.map((prize) => {
          const count = ownedCounts[prize.id] ?? 0;
          const unlocked = count > 0;
          const level = unlocked ? getDambourleLevel(prize.rarity, count) : 0;
          const minSkinIndex = getDambourleMinSkinIndex(prize.id);
          const displaySkinIndex = Math.max(minSkinIndex, Math.min(equipped.skinIndex, getDambourleUnlockedSkinTier(prize.id, level)));
          return (
            <DambourleCard
              key={prize.id}
              name={prize.name}
              image={getDambourleBoxImage(prize.id, unlocked ? displaySkinIndex : minSkinIndex)}
              alt={prize.name}
              unlocked={unlocked}
              active={activeItemId === prize.id}
              equipped={equipped.itemId === prize.id}
              sublabel={unlocked ? `${prize.rarity} / Lv${level}` : prize.rarity}
              onSelect={() => {
                if (!unlocked) return;
                selectItem(prize.id);
              }}
            />
          );
        })}
      </div>

      {activeItemId !== DEFAULT_ITEM_ID ? (
        <div className="rough-card p-3">
          <p className="text-[11px] font-bold text-ink-soft">スキンを選ぶ（解放済み：{activeSkinIndices.length}種）</p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {activeSkinIndices.map((skinIndex) => (
              <button
                key={skinIndex}
                type="button"
                onClick={() => selectSkin(skinIndex)}
                aria-pressed={previewSkinIndex === skinIndex}
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border ${
                  previewSkinIndex === skinIndex ? "border-leaf ring-2 ring-leaf/40" : "border-line"
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

      {navSlot &&
        createPortal(
          <div className="border-b border-line bg-card/95 px-4 py-3 backdrop-blur">
            <div className="mx-auto flex max-w-md items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-bold text-ink-soft">選択中：{activeName}</p>
                {error ? (
                  <p className="text-[10px] font-bold text-blossom">変更できませんでした。もう一度お試しください。</p>
                ) : saved ? (
                  <p className="text-[10px] font-bold text-leaf-deep">この見た目に変更しました！</p>
                ) : isPreviewEquipped ? (
                  <p className="text-[10px] text-ink-faint">現在装備中です</p>
                ) : (
                  <p className="text-[10px] text-ink-faint">まだ反映されていません</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={pending || isPreviewEquipped}
                className="shrink-0 rounded-full bg-leaf px-5 py-2.5 text-xs font-bold text-white shadow-sm active:translate-y-px disabled:opacity-45"
              >
                {pending ? "反映中…" : isPreviewEquipped ? "反映済み" : "この見た目にする"}
              </button>
            </div>
          </div>,
          navSlot,
        )}
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
          onContextMenu={!unlocked ? (event) => event.preventDefault() : undefined}
          style={!unlocked ? { WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" } : undefined}
          className={`h-full w-full object-contain p-3 ${unlocked ? "" : "[filter:brightness(0)] opacity-100"}`}
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
