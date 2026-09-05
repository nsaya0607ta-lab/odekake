"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DAMBOURLE_LEVEL_CAP } from "@/lib/dambourle/config";
import { DEFAULT_BOX_ALT, DEFAULT_BOX_IMAGE, getDambourleBoxImage } from "@/lib/dambourle/box-image";
import { DAMBOURLE_PRIZES, getDambourleEffectSummary } from "@/lib/dambourle/prizes";
import {
  getDambourleLevel,
  getDambourleMinSkinIndex,
  getDambourleNextLevelRemaining,
  getDambourleUnlockedSkinTier,
} from "@/lib/dambourle/skill-levels";
import { IconCheck, IconLock } from "./icons";

const DEFAULT_ITEM_ID = "default";
const PRIZE_BY_ID = new Map(DAMBOURLE_PRIZES.map((prize) => [prize.id, prize]));

type Selection = { itemId: string; skinIndex: number };

type Props = {
  equippedItemId: string | null;
  equippedSkinIndex: number;
  /** item_id -> 重複数（count）。未所持のものは含まれない */
  ownedCounts: Readonly<Record<string, number>>;
};

export function DambourlePicker({ equippedItemId, equippedSkinIndex, ownedCounts }: Props) {
  const router = useRouter();
  const initialItemId = equippedItemId ?? DEFAULT_ITEM_ID;
  const [equipped, setEquipped] = useState<Selection>({ itemId: initialItemId, skinIndex: equippedSkinIndex });
  const [draft, setDraft] = useState<Selection>({ itemId: initialItemId, skinIndex: equippedSkinIndex });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selectedPrize = draft.itemId === DEFAULT_ITEM_ID ? null : PRIZE_BY_ID.get(draft.itemId) ?? null;
  const selectedCount = selectedPrize ? ownedCounts[selectedPrize.id] ?? 0 : 0;
  const selectedLevel = selectedPrize ? getDambourleLevel(selectedPrize.rarity, selectedCount) : 0;
  const selectedMinSkinIndex = getDambourleMinSkinIndex(draft.itemId);
  const selectedMaxSkinIndex = selectedPrize ? getDambourleUnlockedSkinTier(selectedPrize.id, selectedLevel) : 0;
  const selectedLevelCap = selectedPrize ? DAMBOURLE_LEVEL_CAP[selectedPrize.rarity] : 0;
  const nextLevelRemaining = selectedPrize ? getDambourleNextLevelRemaining(selectedPrize.rarity, selectedCount) : null;
  const hasChanges = draft.itemId !== equipped.itemId || draft.skinIndex !== equipped.skinIndex;

  const allSkinIndexes = useMemo(() => {
    if (!selectedPrize) return [];
    return Array.from({ length: 6 - selectedMinSkinIndex }, (_, index) => index + selectedMinSkinIndex);
  }, [selectedMinSkinIndex, selectedPrize]);

  const selectItem = useCallback((itemId: string) => {
    setMessage(null);
    if (itemId === DEFAULT_ITEM_ID) {
      setDraft({ itemId, skinIndex: 0 });
      return;
    }
    const prize = PRIZE_BY_ID.get(itemId);
    const count = ownedCounts[itemId] ?? 0;
    if (!prize || count <= 0) return;
    const minSkinIndex = getDambourleMinSkinIndex(itemId);
    const maxSkinIndex = getDambourleUnlockedSkinTier(itemId, getDambourleLevel(prize.rarity, count));
    const savedSkinIndex = equipped.itemId === itemId ? equipped.skinIndex : minSkinIndex;
    setDraft({ itemId, skinIndex: Math.max(minSkinIndex, Math.min(savedSkinIndex, maxSkinIndex)) });
  }, [equipped, ownedCounts]);

  const save = useCallback(async () => {
    if (pending || !hasChanges) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/dambourle-equipped", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "変更できませんでした。");
      setEquipped(draft);
      setMessage({
        type: "success",
        text: draft.itemId === DEFAULT_ITEM_ID ? "初期のダンボールに変更しました" : `${PRIZE_BY_ID.get(draft.itemId)?.name ?? "ダンボール"}を装備しました`,
      });
      router.refresh();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "変更できませんでした。もう一度お試しください。" });
    } finally {
      setPending(false);
    }
  }, [draft, hasChanges, pending, router]);

  const goToGame = useCallback(() => {
    // 装備をServer Component側でも必ず最新状態で読み直すため、ここだけ完全遷移にする。
    window.location.assign("/games/item-catch");
  }, []);

  return (
    <div className="space-y-4 pb-24">
      <section className="rough-card overflow-hidden p-4" aria-label="選択中のダンボール">
        <div className="flex gap-4">
          <span className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-paper-deep p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={draft.itemId === DEFAULT_ITEM_ID ? DEFAULT_BOX_IMAGE : getDambourleBoxImage(draft.itemId, draft.skinIndex)}
              alt={selectedPrize?.name ?? DEFAULT_BOX_ALT}
              draggable={false}
              className="h-full w-full object-contain"
            />
          </span>
          <div className="min-w-0 flex-1 py-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="text-lg font-black text-ink">{selectedPrize?.name ?? "初期のダンボール"}</h2>
              {selectedPrize ? <span className="rounded-full bg-ink px-2 py-0.5 text-[9px] font-black text-white">{selectedPrize.rarity}</span> : null}
            </div>
            <p className="mt-1 text-xs font-bold text-leaf-deep">
              {selectedPrize ? (selectedLevel >= selectedLevelCap ? "Lv.MAX" : `Lv${selectedLevel}`) : "効果なし"}
            </p>
            {selectedPrize ? <p className="mt-2 text-[11px] font-bold leading-relaxed text-ink-soft">{getDambourleEffectSummary(selectedPrize, selectedLevel)}</p> : null}
            {selectedPrize ? (
              <p className="mt-1 text-[10px] text-ink-faint">
                所持 {selectedCount}個・{nextLevelRemaining === null ? "レベル上限" : `次のLvまであと${nextLevelRemaining}個`}
              </p>
            ) : null}
          </div>
        </div>

        {selectedPrize ? (
          <div className="mt-4 border-t border-line pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold text-ink-soft">スキンを選ぶ</p>
              <p className="text-[9px] text-ink-faint">解放済み {selectedMaxSkinIndex - selectedMinSkinIndex + 1} / {allSkinIndexes.length}</p>
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {allSkinIndexes.map((skinIndex) => {
                const unlocked = skinIndex <= selectedMaxSkinIndex;
                const selected = draft.skinIndex === skinIndex;
                return (
                  <button
                    key={skinIndex}
                    type="button"
                    disabled={pending || !unlocked}
                    onClick={() => {
                      setMessage(null);
                      setDraft((current) => ({ ...current, skinIndex }));
                    }}
                    aria-pressed={selected}
                    aria-label={`スキン${skinIndex}${unlocked ? "" : " 未解放"}`}
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border transition ${
                      selected ? "border-leaf ring-2 ring-leaf/40" : unlocked ? "border-line" : "border-line opacity-45"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getDambourleBoxImage(draft.itemId, skinIndex)} alt="" draggable={false} className="h-full w-full bg-paper-deep object-contain p-1" />
                    {!unlocked ? <span className="absolute inset-0 grid place-items-center bg-ink/15 text-white"><IconLock size={16} /></span> : null}
                    {selected ? <span className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-leaf text-white"><IconCheck size={10} /></span> : null}
                  </button>
                );
              })}
            </div>
            {selectedMaxSkinIndex < 5 ? (
              <p className="mt-2 text-[9px] text-ink-faint">
                {selectedPrize.id === "dambourle_no11" ? "次のLvで次のスキンが解放されます" : `次のスキンはLv${(selectedMaxSkinIndex + 1) * 14}で解放`}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="dambourle-list-title">
        <div className="mb-2 flex items-end justify-between gap-3">
          <h2 id="dambourle-list-title" className="text-sm font-black text-ink">ダンボール一覧</h2>
          <p className="text-[10px] text-ink-faint">タップして上で確認</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DambourleCard
            name="初期のダンボール"
            image={DEFAULT_BOX_IMAGE}
            alt={DEFAULT_BOX_ALT}
            unlocked
            active={draft.itemId === DEFAULT_ITEM_ID}
            equipped={equipped.itemId === DEFAULT_ITEM_ID}
            disabled={pending}
            sublabel="効果なし"
            onSelect={() => selectItem(DEFAULT_ITEM_ID)}
          />
          {DAMBOURLE_PRIZES.map((prize) => {
            const count = ownedCounts[prize.id] ?? 0;
            const unlocked = count > 0;
            const level = unlocked ? getDambourleLevel(prize.rarity, count) : 0;
            const minSkinIndex = getDambourleMinSkinIndex(prize.id);
            const maxSkinIndex = getDambourleUnlockedSkinTier(prize.id, level);
            const cardSkinIndex = draft.itemId === prize.id
              ? draft.skinIndex
              : equipped.itemId === prize.id
                ? equipped.skinIndex
                : minSkinIndex;
            return (
              <DambourleCard
                key={prize.id}
                name={prize.name}
                image={getDambourleBoxImage(prize.id, Math.max(minSkinIndex, Math.min(cardSkinIndex, maxSkinIndex)))}
                alt={prize.name}
                unlocked={unlocked}
                active={draft.itemId === prize.id}
                equipped={equipped.itemId === prize.id}
                disabled={pending}
                sublabel={unlocked ? `${prize.rarity} / Lv${level}` : `${prize.rarity} / 未所持`}
                onSelect={() => selectItem(prize.id)}
              />
            );
          })}
        </div>
      </section>

      <div className="sticky bottom-3 z-20 rounded-2xl border border-line bg-card/95 p-3 shadow-[0_10px_30px_rgba(75,56,36,0.18)] backdrop-blur-sm">
        {message ? (
          <p role="status" className={`mb-2 text-center text-[11px] font-bold ${message.type === "success" ? "text-leaf-deep" : "text-red-600"}`}>
            {message.text}
          </p>
        ) : null}
        {hasChanges ? (
          <button type="button" onClick={() => void save()} disabled={pending} className="w-full rounded-full bg-leaf px-4 py-3 text-sm font-black text-white shadow-md active:translate-y-px disabled:opacity-45">
            {pending ? "変更しています…" : "このダンボールを使う"}
          </button>
        ) : (
          <button type="button" onClick={goToGame} className="w-full rounded-full bg-leaf px-4 py-3 text-sm font-black text-white shadow-md active:translate-y-px">
            この装備でゲームへ
          </button>
        )}
      </div>
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
  disabled,
  sublabel,
  onSelect,
}: {
  name: string;
  image: string;
  alt: string;
  unlocked: boolean;
  active: boolean;
  equipped: boolean;
  disabled: boolean;
  sublabel: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!unlocked || disabled}
      onClick={onSelect}
      aria-pressed={active}
      aria-label={`${name} ${sublabel}${equipped ? " 装備中" : ""}`}
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
        {!unlocked ? <span className="absolute inset-0 grid place-items-center bg-gradient-to-b from-transparent via-paper/10 to-ink/15 text-white"><IconLock size={22} /></span> : null}
        {equipped ? <span className="absolute left-1.5 top-1.5 rounded-full bg-leaf px-2 py-1 text-[8px] font-black text-white shadow-sm">装備中</span> : null}
        {active ? <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-white text-leaf shadow-sm"><IconCheck size={14} /></span> : null}
      </span>
      <p className={`mt-2 truncate text-sm font-bold ${unlocked ? "text-ink" : "text-ink-faint"}`}>{name}</p>
      <p className="mt-0.5 truncate text-[10px] text-ink-faint">{sublabel}</p>
    </button>
  );
}
