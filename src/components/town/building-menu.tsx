"use client";

import { useMemo, useState } from "react";
import type { TownCatalogItem, TownMaterials, TownPlacedItem } from "@/lib/town/types";
import { BuildingItem } from "./building-item";

const CATEGORIES = [
  { id: "building", label: "建物" },
  { id: "facility", label: "施設" },
  { id: "decor", label: "デコ" },
  { id: "road", label: "道路・柵" },
  { id: "nature", label: "自然" },
] as const;

export function BuildingMenu({
  open,
  catalog,
  materials,
  townLevel,
  items,
  onClose,
  onSelect,
}: {
  open: boolean;
  catalog: TownCatalogItem[];
  materials: TownMaterials;
  townLevel: number;
  items: TownPlacedItem[];
  onClose: () => void;
  onSelect: (item: TownCatalogItem) => void;
}) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["id"]>("building");
  const visibleItems = useMemo(
    () => catalog.filter((item) => item.category === category),
    [catalog, category],
  );

  if (!open) return null;

  return (
    <section
      aria-label="建築メニュー"
      className="fixed inset-x-0 z-[55] mx-auto max-w-lg rounded-t-[30px] border border-b-0 border-line bg-paper/98 shadow-[0_-12px_32px_rgba(63,58,51,0.16)] backdrop-blur-md"
      style={{ bottom: "calc(var(--nav-height) + var(--safe-bottom))" }}
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <span>
          <h2 className="text-base font-black">建築メニュー</h2>
          <p className="text-[11px] text-ink-faint">建物を選んで、街の好きな場所へ</p>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-paper-deep text-lg text-ink-soft"
          aria-label="建築メニューを閉じる"
        >
          ×
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto px-3 pb-2">
        {CATEGORIES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setCategory(entry.id)}
            className={
              "min-h-9 shrink-0 rounded-full px-3 text-[11px] font-black " +
              (category === entry.id
                ? "bg-leaf text-white"
                : "border border-line bg-card text-ink-soft")
            }
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="min-h-[198px] max-h-[31dvh] overflow-y-auto overscroll-contain pb-[max(12px,env(safe-area-inset-bottom))]">
        {visibleItems.length ? (
          <div className="flex gap-3 overflow-x-auto px-3 pb-3 pt-1">
            {visibleItems.map((item) => (
              <BuildingItem
                key={item.id}
                item={item}
                materials={materials}
                townLevel={townLevel}
                storedCount={items.filter((owned) => owned.itemId === item.id && !owned.isPlaced).length}
                onSelect={onSelect}
              />
            ))}
          </div>
        ) : (
          <div className="mx-4 mt-2 rounded-2xl border border-dashed border-line bg-card/70 px-4 py-8 text-center">
            <p className="text-sm font-bold text-ink-soft">このカテゴリは準備中です</p>
            <p className="mt-1 text-[11px] text-ink-faint">次の段階で少しずつ追加できます。</p>
          </div>
        )}
      </div>
    </section>
  );
}
