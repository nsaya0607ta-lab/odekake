"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { isLiveBackground } from "@/components/live-backgrounds";
import type { LiveMode } from "@/components/live-backgrounds/engine";
import { LiveLayer } from "@/components/live-backgrounds/live-layer";
import { useBackgroundSignals, useSkyTime } from "@/components/live-backgrounds/signals";
import { setTryOnBackground, useTryOnBackground } from "@/components/live-backgrounds/try-on";
import { getAppBackground, isDarkBackground, type AppBackgroundId, type BackgroundSignals } from "@/lib/app-backgrounds";

/**
 * アプリ全体の背景（ショップで買ったもの）。画面いっぱいに固定して、一番うしろに置く。
 * - 柄・風景の背景は src/app/app-backgrounds.css、動く・変わる背景は live-backgrounds が描く
 * - 暗い背景はホーム以外で薄めて、文字を読みやすくする
 * - ショップで「アプリでためす」を押しているあいだは、その背景を出して、下におためし中のバーを出す
 */
export function AppBackground({ id }: { id: AppBackgroundId }) {
  const pathname = usePathname();
  const tryOn = useTryOnBackground();
  const effective = tryOn ?? id;
  const signals = useBackgroundSignals(effective);
  const dim = pathname !== "/home" && isDarkBackground(effective, signals);

  // おためし中は、ヘッダーと下のナビをすりガラスにする（買った背景のときはレイアウトが付けている）
  useEffect(() => {
    document.documentElement.toggleAttribute("data-bg-try", tryOn !== null);
    return () => document.documentElement.removeAttribute("data-bg-try");
  }, [tryOn]);

  if (effective === "default" && tryOn === null) return null;
  return (
    <>
      <div
        className="app-bg"
        data-bg={effective}
        data-time={effective === "sky-clock" ? signals.skyTime : undefined}
        data-dim={dim ? "true" : undefined}
        aria-hidden="true"
        suppressHydrationWarning
      >
        <div className="app-bg-layer" />
        {isLiveBackground(effective) ? <LiveLayer id={effective} mode="full" signals={signals} /> : null}
      </div>
      {tryOn !== null ? <TryOnBar id={tryOn} pathname={pathname} /> : null}
    </>
  );
}

/** おためし中のバー（下のナビの上）。ホームで見る・ショップにもどる・おわる */
function TryOnBar({ id, pathname }: { id: AppBackgroundId; pathname: string }) {
  const bg = getAppBackground(id);
  return (
    <div
      role="region"
      aria-label="背景のおためし"
      className="fixed inset-x-0 z-[45] flex justify-center px-3"
      style={{ bottom: "calc(var(--nav-height) + var(--safe-bottom) + 8px)" }}
    >
      <div className="flex w-full max-w-md items-center gap-2 rounded-full border border-white/70 bg-[rgba(255,253,248,.86)] py-1.5 pl-3 pr-1.5 shadow-[0_8px_24px_rgba(60,45,25,.18)] backdrop-blur-md">
        <span className="shrink-0 rounded-full bg-[#2F6FC2] px-2 py-0.5 text-[10px] font-black text-white">おためし中</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-black">{bg.name}</span>
        {pathname !== "/home" ? (
          <Link href="/home" className="shrink-0 rounded-full bg-leaf-soft px-3 py-1.5 text-[11px] font-black text-leaf-deep active:scale-95">
            ホームで見る
          </Link>
        ) : null}
        {pathname !== "/shop" ? (
          <Link href="/shop" className="shrink-0 rounded-full bg-[#E3EFFD] px-3 py-1.5 text-[11px] font-black text-[#2F6FC2] active:scale-95">
            ショップへ
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => setTryOnBackground(null)}
          className="shrink-0 rounded-full border border-line bg-card px-3 py-1.5 text-[11px] font-bold text-ink-soft active:scale-95"
        >
          おわる
        </button>
      </div>
    </div>
  );
}

/**
 * ショップの見本用。枠の中に、その背景を描く。
 * mode が still なら1枚だけ描いて止める（一覧）。preview なら動く（大きな見本）。
 * signals で「雨のとき」「10,000歩のとき」などを見せる。時間で変わる空は、なければ今の時間帯。
 */
export function AppBackgroundPreview({ id, mode = "still", signals = {} }: { id: AppBackgroundId; mode?: LiveMode; signals?: BackgroundSignals }) {
  const currentSkyTime = useSkyTime(id === "sky-clock" && !signals.skyTime);
  const skyTime = signals.skyTime ?? currentSkyTime;
  return (
    <div
      className="app-bg app-bg-preview"
      data-bg={id}
      data-time={id === "sky-clock" ? skyTime : undefined}
      aria-hidden="true"
      suppressHydrationWarning
    >
      <div className="app-bg-layer" />
      {isLiveBackground(id) ? <LiveLayer id={id} mode={mode} signals={signals} /> : null}
    </div>
  );
}
