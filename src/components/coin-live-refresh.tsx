"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * iPhoneショートカットなどアプリ外から歩数が更新されたあと、
 * コイン画面へ戻った時に歩数コインの再同期と残高の再取得を行う。
 */
export function CoinLiveRefresh() {
  const router = useRouter();
  const lastRefreshAt = useRef(0);

  useEffect(() => {
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;

      const now = Date.now();
      if (now - lastRefreshAt.current < 3000) return;
      lastRefreshAt.current = now;

      try {
        await fetch("/api/steps/today", { cache: "no-store" });
      } finally {
        router.refresh();
      }
    };

    void refresh();

    const onFocus = () => void refresh();
    const onVisible = () => void refresh();

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
