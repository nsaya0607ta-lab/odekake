"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * iPhoneショートカットなどアプリ外からSupabaseが更新されたあと、
 * ホームへ戻った時に歩数・EXPを最新状態へ同期する。
 */
export function HomeLiveRefresh() {
  const router = useRouter();
  const lastRefreshAt = useRef(0);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;

      const now = Date.now();
      if (now - lastRefreshAt.current < 3000) return;
      lastRefreshAt.current = now;
      router.refresh();
    };

    // App Router の履歴キャッシュからホームが復元された場合でも、
    // 初回表示時に1度だけサーバーデータを取り直す。
    refresh();

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  return null;
}
