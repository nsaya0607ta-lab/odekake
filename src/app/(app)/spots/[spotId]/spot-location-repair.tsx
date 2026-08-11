"use client";

import { useEffect } from "react";

/** 所有者が詳細画面を開いたとき、旧ロジックで保存された位置情報を一度だけ修復する。 */
export function SpotLocationRepair({ spotId, needed }: { spotId: string; needed: boolean }) {
  useEffect(() => {
    if (!needed) return;
    const controller = new AbortController();
    void fetch(`/api/spots/${encodeURIComponent(spotId)}/repair-location`, {
      method: "POST",
      signal: controller.signal,
    });
    return () => controller.abort();
  }, [needed, spotId]);

  return null;
}
