"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * ダンボール選択画面(/games/item-catch/dambourle)で装備を変更したあと、
 * ブラウザの戻る操作などでこの画面に戻ってきても、装備直後の最新状態を
 * 必ず取り直す（HomeLiveRefresh/CoinLiveRefreshと同じ仕組み）。
 */
export function ItemCatchLiveRefresh() {
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
