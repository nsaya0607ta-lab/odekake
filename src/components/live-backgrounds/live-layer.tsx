"use client";

import { useEffect, useRef } from "react";
import type { AppBackgroundId, BackgroundSignals } from "@/lib/app-backgrounds";
import type { LiveInstance, LiveMode } from "./engine";
import { LIVE_LOADERS } from "./index";

/**
 * 動く・変わる背景を描く場所。描く部品はここで読みこんで、はりつける。
 * signals（天気・歩数・季節など）が変わったら、作り直さずに update で伝える。
 */
export function LiveLayer({ id, mode, signals }: { id: AppBackgroundId; mode: LiveMode; signals: BackgroundSignals }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<LiveInstance | null>(null);
  const signalsRef = useRef(signals);
  signalsRef.current = signals;
  const signalsKey = JSON.stringify(signals);

  useEffect(() => {
    const host = hostRef.current;
    const load = LIVE_LOADERS[id];
    if (!host || !load) return;
    let cancelled = false;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    load()
      .then(({ mount }) => {
        if (cancelled) return;
        instanceRef.current = mount(host, { mode, reducedMotion, signals: signalsRef.current });
      })
      .catch((error: unknown) => {
        // 読みこめなくても、CSS の下地の色は出ているので、そのままにする
        console.warn("Live background failed to load", error);
      });
    return () => {
      cancelled = true;
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, [id, mode]);

  useEffect(() => {
    instanceRef.current?.update(signalsRef.current);
  }, [signalsKey]);

  return <div ref={hostRef} className="app-bg-live" />;
}
