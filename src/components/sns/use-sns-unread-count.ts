"use client";

import { useEffect, useSyncExternalStore } from "react";

const CACHE_MS = 5_000;
let cachedCount = 0;
let cachedAt = 0;
let pendingRequest: Promise<number> | null = null;
const listeners = new Set<() => void>();

type IdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

function publishUnreadCount(value: number) {
  const next = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const changed = next !== cachedCount;
  cachedCount = next;
  cachedAt = Date.now();
  if (changed) listeners.forEach((listener) => listener());
}

function requestUnreadCount(force = false): Promise<number> {
  if (!force && Date.now() - cachedAt < CACHE_MS) return Promise.resolve(cachedCount);
  if (pendingRequest) return pendingRequest;

  const request = fetch("/api/sns/unread-count", {
    cache: "no-store",
    credentials: "same-origin",
  })
    .then(async (response) => {
      if (!response.ok) throw new Error("SNS_UNREAD_FETCH_FAILED");
      const payload = (await response.json()) as { unreadCount?: unknown };
      const value = Number(payload.unreadCount);
      publishUnreadCount(value);
      return cachedCount;
    })
    .catch(() => cachedCount)
    .finally(() => {
      pendingRequest = null;
    });

  pendingRequest = request;
  return request;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return cachedCount;
}

function getServerSnapshot() {
  return 0;
}

/** 既読操作の直後など、サーバー再取得を待たず全表示へ同じ値を反映する。 */
export function setSnsUnreadCount(value: number) {
  publishUnreadCount(value);
}

/** 投稿・設定変更後に、共有ストアを強制的に最新化する。 */
export function refreshSnsUnreadCount(force = true): Promise<number> {
  return requestUnreadCount(force);
}

/** 初期表示の通信と競合させず、ブラウザが空いた時に通知数を取得する。 */
export function useSnsUnreadCount(): number {
  // ヘッダーと下部ナビが同じ外部ストアを購読し、一方だけ古い表示になるのを防ぐ。
  const unreadCount = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    const idleWindow = window as IdleWindow;
    const load = () => {
      void requestUnreadCount();
    };
    const idleId = idleWindow.requestIdleCallback?.(load, { timeout: 900 });
    const timeoutId = idleId === undefined ? window.setTimeout(load, 180) : undefined;

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void requestUnreadCount(true);
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);

    return () => {
      if (idleId !== undefined) idleWindow.cancelIdleCallback?.(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, []);

  return unreadCount;
}
