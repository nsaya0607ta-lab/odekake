"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";
import { parseTownSnapshot } from "./data";
import {
  TOWN_MATERIAL_KEYS,
  type TownCatalogItem,
  type TownPlacementCandidate,
  type TownSnapshot,
} from "./types";

const LOCAL_STORAGE_KEY = "wanko-town-fallback-v1";

const ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "ログイン情報を確認できませんでした。",
  TOWN_ITEM_NOT_FOUND: "この建物は現在利用できません。",
  TOWN_ITEM_LOCKED: "タウンレベルが足りません。",
  INVALID_TOWN_PLACEMENT: "この場所には配置できません。",
  INSUFFICIENT_MATERIALS: "建築素材が足りません。",
  TOWN_INSTANCE_NOT_FOUND: "建物が見つかりませんでした。",
};

function friendlyTownError(message: string): string {
  const key = Object.keys(ERROR_MESSAGES).find((entry) => message.includes(entry));
  return key ? ERROR_MESSAGES[key]! : "保存に失敗しました。少し待ってからもう一度お試しください。";
}

function levelForExp(exp: number): number {
  if (exp >= 800) return 5;
  if (exp >= 520) return 4;
  if (exp >= 300) return 3;
  if (exp >= 140) return 2;
  return 1;
}

function saveLocalSnapshot(snapshot: TownSnapshot) {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage can be unavailable in private browsing. The in-memory state still works.
  }
}

function newInstanceId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "town-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

export function useTown(
  initialSnapshot: TownSnapshot,
  catalog: TownCatalogItem[],
  persistenceMode: "supabase" | "local",
) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (persistenceMode !== "local") return;
    try {
      const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) setSnapshot(parseTownSnapshot(JSON.parse(stored) as Json));
    } catch {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, [persistenceMode]);

  const applyMutation = useCallback(
    async (
      execute: () => Promise<{
        data: Json | null;
        error: { message: string } | null;
      }>,
    ): Promise<boolean> => {
      if (pending) return false;
      setPending(true);
      setError(null);

      try {
        const { data, error: mutationError } = await execute();
        if (mutationError) {
          setError(friendlyTownError(mutationError.message));
          return false;
        }
        setSnapshot(parseTownSnapshot(data));
        return true;
      } finally {
        setPending(false);
      }
    },
    [pending],
  );

  const buildItem = useCallback(
    async (candidate: TownPlacementCandidate) => {
      if (persistenceMode === "local") {
        const item = catalog.find((entry) => entry.id === candidate.itemId);
        if (!item) {
          setError(ERROR_MESSAGES.TOWN_ITEM_NOT_FOUND!);
          return false;
        }
        if (item.unlockLevel > snapshot.town.townLevel) {
          setError(ERROR_MESSAGES.TOWN_ITEM_LOCKED!);
          return false;
        }
        const hasMaterials = TOWN_MATERIAL_KEYS.every(
          (key) => snapshot.town.materials[key] >= item.cost[key],
        );
        if (!hasMaterials) {
          setError(ERROR_MESSAGES.INSUFFICIENT_MATERIALS!);
          return false;
        }

        const exp = snapshot.town.townExp + item.expReward;
        const next: TownSnapshot = {
          town: {
            ...snapshot.town,
            townExp: exp,
            townLevel: levelForExp(exp),
            materials: TOWN_MATERIAL_KEYS.reduce(
              (materials, key) => {
                materials[key] = snapshot.town.materials[key] - item.cost[key];
                return materials;
              },
              { ...snapshot.town.materials },
            ),
            updatedAt: new Date().toISOString(),
          },
          items: [
            ...snapshot.items,
            {
              instanceId: newInstanceId(),
              itemId: candidate.itemId,
              gridX: candidate.gridX,
              gridY: candidate.gridY,
              rotation: candidate.rotation,
              isPlaced: true,
              createdAt: new Date().toISOString(),
            },
          ],
        };
        setError(null);
        setSnapshot(next);
        saveLocalSnapshot(next);
        return true;
      }

      const supabase = createClient();
      return applyMutation(async () => {
        const { data, error } = await supabase.rpc("build_town_item", {
          p_item_id: candidate.itemId,
          p_grid_x: candidate.gridX,
          p_grid_y: candidate.gridY,
          p_rotation: candidate.rotation,
        });
        return { data, error };
      });
    },
    [applyMutation, catalog, persistenceMode, snapshot],
  );

  const moveItem = useCallback(
    async (candidate: TownPlacementCandidate, isPlaced = true) => {
      if (!candidate.instanceId) return false;

      if (persistenceMode === "local") {
        const itemIndex = snapshot.items.findIndex(
          (item) => item.instanceId === candidate.instanceId,
        );
        if (itemIndex < 0) {
          setError(ERROR_MESSAGES.TOWN_INSTANCE_NOT_FOUND!);
          return false;
        }
        const items = snapshot.items.map((item, index) =>
          index === itemIndex
            ? {
                ...item,
                gridX: candidate.gridX,
                gridY: candidate.gridY,
                rotation: candidate.rotation,
                isPlaced,
              }
            : item,
        );
        const next: TownSnapshot = {
          town: { ...snapshot.town, updatedAt: new Date().toISOString() },
          items,
        };
        setError(null);
        setSnapshot(next);
        saveLocalSnapshot(next);
        return true;
      }

      const supabase = createClient();
      return applyMutation(async () => {
        const { data, error } = await supabase.rpc("move_town_item", {
          p_instance_id: candidate.instanceId!,
          p_grid_x: candidate.gridX,
          p_grid_y: candidate.gridY,
          p_rotation: candidate.rotation,
          p_is_placed: isPlaced,
        });
        return { data, error };
      });
    },
    [applyMutation, persistenceMode, snapshot],
  );

  return {
    snapshot,
    pending,
    error,
    clearError: () => setError(null),
    buildItem,
    moveItem,
  };
}
