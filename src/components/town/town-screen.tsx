"use client";

import { useEffect, useMemo, useState } from "react";
import type { DogSkinId } from "@/lib/dog-skins";
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
  dogSkin,
  persistenceMode,
}: {
  initialSnapshot: TownSnapshot;
  catalog: TownCatalogItem[];
  initialCoinBalance: number;
  dogSkin: DogSkinId;
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
    <div className="relative min-h-[620px] overflow-hidden bg-paper">
      <section className="space-y-2 px-3 py-3">
        <div className="rounded-[24px] border border-line bg-card px-3 py-3 shadow-[0_6px_18px_rgba(93,80,58,0.07)]">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-leaf-soft text-2xl">🏡</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-black">{snapshot.town.townName}</span>
              <span className="mt-0.5 flex items-center gap-2">
                <span className="text-[11px] font-black text-leaf-deep">Town Lv.{snapshot.town.townLevel}</span>
                <span className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-paper-deep">
                  <span
                    className="block h-full rounded-full bg-leaf"
                    style={{ width: Math.min(100, (expProgress.current / expProgress.required) * 100) + "%" }}
                  />
                </span>
                <span className="text-[9px] font-bold tabular-nums text-ink-faint">
                  {Math.max(0, expProgress.current)}/{expProgress.required}
                </span>
              </span>
            </span>
            <span className="rounded-full bg-sun-soft px-2.5 py-1 text-[11px] font-black text-[#8b6a2f]">
              🪙 {initialCoinBalance.toLocaleString("ja-JP")}
            </span>
          </div>

          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
            {TOWN_MATERIAL_KEYS.map((key) => (
              <span key={key} className="shrink-0 rounded-full bg-paper-deep px-2.5 py-1 text-[10px] font-black text-ink-soft">
                {TOWN_MATERIAL_META[key].icon} {TOWN_MATERIAL_META[key].shortLabel} {snapshot.town.materials[key]}
              </span>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                cancelEditing();
                setEditMode(false);
                setMenuOpen(true);
              }}
              className="min-h-11 rounded-2xl bg-leaf text-sm font-black text-white shadow-sm"
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
                "min-h-11 rounded-2xl border text-sm font-black " +
                (editMode
                  ? "border-sky bg-sky-soft text-[#43718f]"
                  : "border-line bg-card text-ink-soft")
              }
            >
              {editMode ? "✓ 編集終了" : "✥ 編集"}
            </button>
          </div>
        </div>
      </section>

      {persistenceMode === "local" ? (
        <p className="mx-3 mb-2 rounded-2xl border border-sun/40 bg-sun-soft px-3 py-2 text-[11px] font-bold leading-relaxed text-[#7c622f]">
          現在は端末への一時保存モードです。この画面で建築・移動・収納を試せます。
        </p>
      ) : null}

      <TownCanvas
        catalog={catalog}
        items={snapshot.items}
        unlockedAreas={snapshot.town.unlockedAreas}
        dogSkin={dogSkin}
        selectedId={selectedId}
        candidate={candidate}
        candidateCanPlace={candidateCanPlace}
        editMode={editMode}
        onSelect={selectPlacedItem}
        onCandidateChange={setCandidate}
      />

      <div className="px-3 py-3">
        <p className="rounded-2xl border border-leaf/20 bg-leaf-soft/55 px-3 py-2 text-[11px] leading-relaxed text-leaf-deep">
          おでかけで集める素材とつながる準備済みです。今後、公園・海・山などの訪問先から素材を獲得できます。
        </p>
      </div>

      {error ? (
        <button
          type="button"
          onClick={clearError}
          className="fixed left-1/2 top-20 z-[70] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-blossom bg-card px-4 py-3 text-left text-xs font-bold text-[#9a5360] shadow-lg"
        >
          {error}<span className="float-right ml-2">×</span>
        </button>
      ) : null}

      {notice ? (
        <p className="fixed left-1/2 top-20 z-[69] w-max max-w-[88vw] -translate-x-1/2 rounded-full bg-[#3f3a33]/90 px-4 py-2 text-xs font-bold text-white shadow-lg">
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
