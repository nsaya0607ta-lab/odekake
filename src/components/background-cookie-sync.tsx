"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * 別の端末で背景を変えていたら、この端末の背景もそろえる（ホームが、DB とこの端末の背景がちがうときだけ置く）。
 * Cookie を直してから、画面を取り直す。
 */
export function BackgroundCookieSync() {
  const router = useRouter();
  useEffect(() => {
    let alive = true;
    fetch("/api/app-background/sync", { method: "POST" })
      .then((response) => {
        if (alive && response.ok) router.refresh();
      })
      .catch(() => {
        // そろえられなくても、この端末の背景のまま使える
      });
    return () => {
      alive = false;
    };
  }, [router]);
  return null;
}
