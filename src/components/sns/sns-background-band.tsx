"use client";

import { useEffect, useState } from "react";

/**
 * 写真/チャット切替バー（id="sns-toggle-bar"）の下端から、ナビゲーションバーの上端まで
 * だけに背景画像を敷く。切替バーは sticky で位置が変わるので、実際の描画位置を
 * measure して合わせる（固定値だとズレる）
 */
export function SnsBackgroundBand() {
  const [top, setTop] = useState<number | null>(null);

  useEffect(() => {
    let frame = 0;

    function measure() {
      const bar = document.getElementById("sns-toggle-bar");
      if (bar) setTop(bar.getBoundingClientRect().bottom);
    }

    function onScrollOrResize() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }

    measure();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, []);

  if (top === null) return null;

  return (
    <div
      aria-hidden
      className="sns-bg-band pointer-events-none fixed inset-x-0 -z-10"
      style={{ top, bottom: "calc(var(--nav-height) + var(--safe-bottom))" }}
    />
  );
}
