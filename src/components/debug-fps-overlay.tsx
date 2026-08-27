"use client";

import { useEffect, useState } from "react";

/**
 * 一時的な調査用オーバーレイ。実機での「カクつき」の原因切り分けのため、
 * 実際のフレームレートを画面に出す。原因が特定でき次第、削除する。
 */
export function DebugFpsOverlay() {
  const [text, setText] = useState("計測中…");

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let minFps = Infinity;
    let sampleSum = 0;
    let sampleCount = 0;
    let longFrames = 0;

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (dt > 0 && dt < 2000) {
        const fps = 1000 / dt;
        minFps = Math.min(minFps, fps);
        sampleSum += fps;
        sampleCount += 1;
        if (dt > 33) longFrames += 1; // 30fps相当を下回ったフレーム
      }
      if (sampleCount >= 30) {
        const avg = Math.round(sampleSum / sampleCount);
        setText(`avg ${avg}fps / min ${Math.round(minFps)}fps / drop ${longFrames}`);
        sampleSum = 0;
        sampleCount = 0;
        longFrames = 0;
        minFps = Infinity;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: "env(safe-area-inset-top, 0px)",
        left: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,0.75)",
        color: "#5cff5c",
        fontFamily: "monospace",
        fontSize: 11,
        lineHeight: 1.4,
        padding: "3px 6px",
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
}
