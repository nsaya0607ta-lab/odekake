"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";
import { parseTownSnapshot } from "./data";
import type { TownPlacementCandidate, TownSnapshot } from "./types";

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

export function useTown(initialSnapshot: TownSnapshot) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyMutation = useCallback(
    async (
      mutation: ReturnType<ReturnType<typeof createClient>["rpc"]>,
    ): Promise<boolean> => {
      if (pending) return false;
      setPending(true);
      setError(null);
      const { data, error: mutationError } = await mutation;
      setPending(false);

      if (mutationError) {
        setError(friendlyTownError(mutationError.message));
        return false;
      }

      setSnapshot(parseTownSnapshot(data as Json));
      return true;
    },
    [pending],
  );

  const buildItem = useCallback(
    async (candidate: TownPlacementCandidate) => {
      const supabase = createClient();
      return applyMutation(
        supabase.rpc("build_town_item", {
          p_item_id: candidate.itemId,
          p_grid_x: candidate.gridX,
          p_grid_y: candidate.gridY,
          p_rotation: candidate.rotation,
        }),
      );
    },
    [applyMutation],
  );

  const moveItem = useCallback(
    async (candidate: TownPlacementCandidate, isPlaced = true) => {
      if (!candidate.instanceId) return false;
      const supabase = createClient();
      return applyMutation(
        supabase.rpc("move_town_item", {
          p_instance_id: candidate.instanceId,
          p_grid_x: candidate.gridX,
          p_grid_y: candidate.gridY,
          p_rotation: candidate.rotation,
          p_is_placed: isPlaced,
        }),
      );
    },
    [applyMutation],
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
