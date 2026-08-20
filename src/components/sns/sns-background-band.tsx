"use client";

import { useEffect, useState } from "react";

/** 切替バーの sticky オフセット（Tailwind の top-14 = 3.5rem と合わせる） */
const STICKY_TOP_PX = 56;

/** 切替バーを持たない画面（ホームなど）でのヘッダーの実測高さ */
const HEADER_ONLY_TOP_PX = 60;

/**
 * 写真/チャット切替バー（id="sns-toggle-bar"）がある画面ではその下端から、
 * ない画面（ホームなど）ではヘッダーの下端から、ナビゲーションバーの上端まで
 * だけに背景画像を敷く。
 *
 * 切替バーは sticky なので、貼り付いた後の下端は「stickyのtopオフセット + バー自身の高さ」
 * という、スクロール位置によらない一定値になる。scrollイベントで毎回測ると
 * 描画が1フレーム遅れて一瞬すき間が見えるため、バーの実寸（offsetHeight）だけを見て
 * 一定値を計算する
 */
export function SnsBackgroundBand({ hasToggleBar = true }: { hasToggleBar?: boolean } = {}) {
  const [top, setTop] = useState<number | null>(hasToggleBar ? null : HEADER_ONLY_TOP_PX);

  useEffect(() => {
    if (!hasToggleBar) return;

    function measure() {
      const bar = document.getElementById("sns-toggle-bar");
      if (bar) setTop(STICKY_TOP_PX + bar.offsetHeight);
    }

    measure();
    window.addEventListener("resize", measure);

    // アイコン画像の読み込みでバーの高さが変わることがあるので、少し遅らせても測り直す
    const timer = window.setTimeout(measure, 300);

    return () => {
      window.removeEventListener("resize", measure);
      window.clearTimeout(timer);
    };
  }, [hasToggleBar]);

  if (top === null) return null;

  return (
    // 下は常に画面の一番下まで敷く（ナビが出ている間はナビの裏に隠れるだけなので害はなく、
    // キーボード表示でナビが消えたときにチャット入力欄との間にすき間ができない）
    <div
      aria-hidden
      className="sns-bg-band pointer-events-none fixed inset-x-0 -z-10"
      style={{ top, bottom: "env(safe-area-inset-bottom, 0px)" }}
    />
  );
}
