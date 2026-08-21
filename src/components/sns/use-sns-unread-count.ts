"use client";

import { useEffect, useState } from "react";

const CACHE_MS = 5_000;
let cachedCount = 0;
let cachedAt = 0;
let pendingRequest: Promise<number> | null = null;

type IdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

function requestUnreadCount(): Promise<number> {
  if (Date.now() - cachedAt < CACHE_MS) return Promise.resolve(cachedCount);
  if (pendingRequest) return pendingRequest;

  const request = fetch("/api/sns/unread-count", {
    cache: "no-store",
    credentials: "same-origin",
  })
    .then(async (response) => {
      if (!response.ok) throw new Error("SNS_UNREAD_FETCH_FAILED");
      const payload = (await response.json()) as { unreadCount?: unknown };
      const value = Number(payload.unreadCount);
      cachedCount = Number.isFinite(value) ? Math.max(0, value) : 0;
      cachedAt = Date.now();
      return cachedCount;
    })
    .catch(() => cachedCount)
    .finally(() => {
      pendingRequest = null;
    });

  pendingRequest = request;
  return request;
}

/** 初期表示の通信と競合させず、ブラウザが空いた時に通知数を取得する。 */
export function useSnsUnreadCount(): number {
  // SSRと初回hydrationは必ず同じ表示にし、既存キャッシュもeffect後に反映する。
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    const idleWindow = window as IdleWindow;
    const load = () => {
      void requestUnreadCount().then((count) => {
        if (active) setUnreadCount(count);
      });
    };
    const idleId = idleWindow.requestIdleCallback?.(load, { timeout: 900 });
    const timeoutId = idleId === undefined ? window.setTimeout(load, 180) : undefined;

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - cachedAt > 30_000) load();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      if (idleId !== undefined) idleWindow.cancelIdleCallback?.(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  return unreadCount;
}
