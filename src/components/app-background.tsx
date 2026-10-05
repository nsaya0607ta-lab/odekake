"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isDarkBackground, skyTimeOf, type AppBackgroundId, type SkyTime } from "@/lib/app-backgrounds";

/** 「時間で変わる空」の時間帯。1分ごとに見直す */
function useSkyTime(enabled: boolean): SkyTime {
  const [skyTime, setSkyTime] = useState<SkyTime>(() => skyTimeOf(new Date()));
  useEffect(() => {
    if (!enabled) return;
    const update = () => setSkyTime(skyTimeOf(new Date()));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return skyTime;
}

/**
 * アプリ全体の背景（ショップで買ったもの）。画面いっぱいに固定して、一番うしろに置く。
 * 見た目は src/app/app-backgrounds.css。暗い背景はホーム以外で薄めて、文字を読みやすくする。
 */
export function AppBackground({ id }: { id: AppBackgroundId }) {
  const pathname = usePathname();
  const skyTime = useSkyTime(id === "sky-clock");
  const dim = pathname !== "/home" && isDarkBackground(id, skyTime);

  return (
    <div
      className="app-bg"
      data-bg={id}
      data-time={id === "sky-clock" ? skyTime : undefined}
      data-dim={dim ? "true" : undefined}
      aria-hidden="true"
      suppressHydrationWarning
    >
      <div className="app-bg-layer" />
    </div>
  );
}

/** ショップの見本用。枠の中に、その背景を描く（時間で変わる空は、time が無ければ今の時間帯で見せる） */
export function AppBackgroundPreview({ id, time }: { id: AppBackgroundId; time?: SkyTime }) {
  const currentSkyTime = useSkyTime(id === "sky-clock" && !time);
  const skyTime = time ?? currentSkyTime;
  return (
    <div
      className="app-bg app-bg-preview"
      data-bg={id}
      data-time={id === "sky-clock" ? skyTime : undefined}
      aria-hidden="true"
      suppressHydrationWarning
    >
      <div className="app-bg-layer" />
    </div>
  );
}
