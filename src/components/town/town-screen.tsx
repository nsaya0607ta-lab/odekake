"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  canPlaceTownItem,
  findFirstTownPlacement,
} from "@/lib/town/geometry";
import {
  TOWN_MATERIAL_KEYS,
  TOWN_MATERIAL_META,
  type TownCatalogItem,
  type TownPlacementCandidate,
  type TownSnapshot,
} from "@/lib/town/types";
import { useTown } from "@/lib/town/use-town";
import { BuildingMenu } from "./building-menu";
import { TownCanvas } from "./town-canvas";
import { TownEditControls } from "./town-edit-controls";

const LEVEL_THRESHOLDS = [0, 140, 300, 520, 800];

function nextRotation(rotation: TownPlacementCandidate["rotation"]): TownPlacementCandidate["rotation"] {
  return ((rotation + 90) % 360) as TownPlacementCandidate["rotation"];
}

export function TownScreen({
  initialSnapshot,
  catalog,
  initialCoinBalance,
  persistenceMode,
}: {
  initialSnapshot: TownSnapshot;
  catalog: TownCatalogItem[];
  initialCoinBalance: number;
  persistenceMode: "supabase" | "local";
}) {
  const { snapshot, pending, error, clearError, buildItem, moveItem } = useTown(
    initialSnapshot,
    catalog,
    persistenceMode,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<TownPlacementCandidate | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selected = snapshot.items.find((item) => item.instanceId === selectedId) ?? null;
  const selectedCatalog = selected ? catalog.find((item) => item.id === selected.itemId) ?? null : null;
  const candidateCatalog = candidate ? catalog.find((item) => item.id === candidate.itemId) ?? null : null;
  const candidateCanPlace = candidate
    ? canPlaceTownItem({
        candidate,
        catalog,
        placedItems: snapshot.items,
        unlockedAreas: snapshot.town.unlockedAreas,
      })
    : false;

  const expProgress = useMemo(() => {
    const level = snapshot.town.townLevel;
    const currentThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0;
    const nextThreshold = LEVEL_THRESHOLDS[level] ?? currentThreshold + 400;
    return {
      current: snapshot.town.townExp - currentThreshold,
      required: Math.max(1, nextThreshold - currentThreshold),
    };
  }, [snapshot.town.townExp, snapshot.town.townLevel]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function startPlacement(item: TownCatalogItem) {
    const stored = snapshot.items.find((owned) => owned.itemId === item.id && !owned.isPlaced);
    const position = findFirstTownPlacement({
      item,
      catalog,
      placedItems: snapshot.items,
      unlockedAreas: snapshot.town.unlockedAreas,
    });
    if (!position) {
      setNotice("空いている場所がありません。建物を移動・収納してください。");
      return;
    }

    setMenuOpen(false);
    setSelectedId(null);
    setEditMode(true);
    setCandidate({
      source: stored ? "stored" : "new",
      instanceId: stored?.instanceId,
      itemId: item.id,
      ...position,
    });
  }

  function selectPlacedItem(instanceId: string) {
    if (candidate) return;
    setEditMode(true);
    setMenuOpen(false);
    setSelectedId(instanceId);
  }

  function beginMove(rotation = selected?.rotation ?? 0) {
    if (!selected) return;
    setCandidate({
      source: "move",
      instanceId: selected.instanceId,
      itemId: selected.itemId,
      gridX: selected.gridX,
      gridY: selected.gridY,
      rotation,
    });
    setSelectedId(null);
  }

  async function confirmPlacement() {
    if (!candidate || !candidateCanPlace) return;
    const succeeded =
      candidate.source === "new"
        ? await buildItem(candidate)
        : await moveItem(candidate, true);
    if (!succeeded) return;
    setNotice(candidate.source === "new" ? "建物が完成しました！" : "配置を保存しました。");
    setCandidate(null);
  }

  async function storeSelected() {
    if (!selected) return;
    const succeeded = await moveItem(
      {
        source: "move",
        instanceId: selected.instanceId,
        itemId: selected.itemId,
        gridX: selected.gridX,
        gridY: selected.gridY,
        rotation: selected.rotation,
      },
      false,
    );
    if (!succeeded) return;
    setSelectedId(null);
    setNotice("建物を収納しました。建築メニューから再配置できます。");
  }

  function cancelEditing() {
    setCandidate(null);
    setSelectedId(null);
  }

  const controlsItemName = candidateCatalog?.name ?? selectedCatalog?.name ?? "";

  return (
    <div className="relative mx-auto max-w-lg overflow-hidden bg-paper">
      <TownCanvas
        catalog={catalog}
        items={snapshot.items}
        unlockedAreas={snapshot.town.unlockedAreas}
        selectedId={selectedId}
        candidate={candidate}
        candidateCanPlace={candidateCanPlace}
        editMode={editMode}
        onSelect={selectPlacedItem}
        onCandidateChange={setCandidate}
      />

      <section
        aria-label="タウン情報と操作"
        className="pointer-events-none absolute inset-x-0 top-0 z-[30] mx-auto max-w-lg px-2 pt-[max(8px,env(safe-area-inset-top))]"
      >
        <div className="pointer-events-auto rounded-[22px] border border-white/70 bg-card/90 p-2.5 shadow-[0_8px_24px_rgba(57,73,49,0.16)] backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Link
              href="/home"
              aria-label="ホームへ戻る"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line/80 bg-card/90 text-xl font-black text-ink-soft shadow-sm"
            >
              ‹
            </Link>

            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className="truncate text-sm font-black">{snapshot.town.townName}</span>
                <span className="shrink-0 text-[10px] font-black text-leaf-deep">
                  Lv.{snapshot.town.townLevel}
                </span>
              </span>
              <span className="mt-1 flex items-center gap-1.5">
                <span className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-paper-deep">
                  <span
                    className="block h-full rounded-full bg-leaf"
                    style={{ width: Math.min(100, (expProgress.current / expProgress.required) * 100) + "%" }}
                  />
                </span>
                <span className="shrink-0 text-[8px] font-bold tabular-nums text-ink-faint">
                  {Math.max(0, expProgress.current)}/{expProgress.required}
                </span>
              </span>
            </span>

            <span className="shrink-0 rounded-full bg-sun-soft px-2.5 py-1.5 text-[10px] font-black text-[#8b6a2f]">
              🪙 {initialCoinBalance.toLocaleString("ja-JP")}
            </span>
          </div>

          <div className="mt-2 flex gap-1 overflow-x-auto overscroll-contain pb-0.5">
            {TOWN_MATERIAL_KEYS.map((key) => (
              <span
                key={key}
                className="shrink-0 rounded-full bg-paper-deep/95 px-2 py-1 text-[9px] font-black text-ink-soft"
              >
                {TOWN_MATERIAL_META[key].icon} {TOWN_MATERIAL_META[key].shortLabel} {snapshot.town.materials[key]}
              </span>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                cancelEditing();
                setEditMode(false);
                setMenuOpen(true);
              }}
              className="min-h-9 rounded-xl bg-leaf text-xs font-black text-white shadow-sm"
            >
              ＋ 建築
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                cancelEditing();
                setEditMode((value) => !value);
              }}
              className={
                "min-h-9 rounded-xl border text-xs font-black " +
                (editMode
                  ? "border-sky bg-sky-soft text-[#43718f]"
                  : "border-line bg-card/90 text-ink-soft")
              }
            >
              {editMode ? "✓ 編集終了" : "✥ 編集"}
            </button>
          </div>

          {persistenceMode === "local" ? (
            <p className="mt-1.5 text-center text-[8px] font-bold text-[#7c622f]">
              端末への一時保存モード
            </p>
          ) : null}
        </div>
      </section>

      {error ? (
        <button
          type="button"
          onClick={clearError}
          className="fixed left-1/2 top-40 z-[70] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-blossom bg-card px-4 py-3 text-left text-xs font-bold text-[#9a5360] shadow-lg"
        >
          {error}<span className="float-right ml-2">×</span>
        </button>
      ) : null}

      {notice ? (
        <p className="fixed left-1/2 top-40 z-[69] w-max max-w-[88vw] -translate-x-1/2 rounded-full bg-[#3f3a33]/90 px-4 py-2 text-xs font-bold text-white shadow-lg">
          {notice}
        </p>
      ) : null}

      <BuildingMenu
        open={menuOpen}
        catalog={catalog}
        materials={snapshot.town.materials}
        townLevel={snapshot.town.townLevel}
        items={snapshot.items}
        onClose={() => setMenuOpen(false)}
        onSelect={startPlacement}
      />

      {candidate || selected ? (
        <TownEditControls
          itemName={controlsItemName}
          candidateMode={Boolean(candidate)}
          canPlace={candidateCanPlace}
          pending={pending}
          onMove={() => beginMove()}
          onRotate={() => {
            if (candidate) {
              setCandidate({ ...candidate, rotation: nextRotation(candidate.rotation) });
            } else if (selected) {
              beginMove(nextRotation(selected.rotation));
            }
          }}
          onStore={storeSelected}
          onConfirm={confirmPlacement}
          onCancel={cancelEditing}
        />
      ) : null}
    </div>
  );
}
