"use client";

import { useEffect } from "react";
import { cleanupTemporaryPhotosAction } from "@/app/actions/photos";

const STORAGE_KEY = "odekake:photo-cleanup-at";
const INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * 保存されずに残った写真の後片づけを、1日1回だけ静かに実行する。
 * 画面には何も出さない。
 */
export function PhotoCleanup() {
  useEffect(() => {
    const last = Number(window.localStorage.getItem(STORAGE_KEY) ?? 0);
    if (Date.now() - last < INTERVAL_MS) return;
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    void cleanupTemporaryPhotosAction().catch(() => {
      // 後片づけに失敗しても、利用者の操作には影響しない
    });
  }, []);

  return null;
}
