"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import styles from "./gacha-box-preview.module.css";

export default function GachaBoxPreviewPage() {
  const [runId, setRunId] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    setPlaying(true);
    const impactTimer = window.setTimeout(() => window.navigator.vibrate?.(24), 3260);
    const finishTimer = window.setTimeout(() => setPlaying(false), 5400);

    return () => {
      window.clearTimeout(impactTimer);
      window.clearTimeout(finishTimer);
    };
  }, [runId]);

  const replay = useCallback(() => {
    if (!playing) setRunId((current) => current + 1);
  }, [playing]);

  return (
    <main className={styles.page}>
      <section className={styles.shell} aria-labelledby="preview-title">
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>PREVIEW ONLY</p>
            <h1 id="preview-title">カプセル搬送演出</h1>
          </div>
          <span className={styles.safeBadge}>保存・消費なし</span>
        </div>

        <div className={styles.stageWrap}>
          <div
            key={runId}
            className={styles.stage}
            role="img"
            aria-label="元動画のガチャ本体とレールとダンボールを背景に、文字のない緑色のカプセルが転がって箱に入り光るアニメーション"
          >
            <Image
              className={styles.sceneImage}
              src="/gacha/box-preview/gacha-scene.webp"
              alt=""
              fill
              priority
              sizes="(max-width: 520px) 100vw, 480px"
            />

            <Image
              className={styles.travelCapsule}
              src="/gacha/box-preview/capsule-green.png"
              alt=""
              width={70}
              height={70}
              priority
            />

            <div className={styles.impactGlow} aria-hidden="true" />
            <Image
              className={styles.sourceSparkle}
              src="/gacha/box-preview/box-sparkle.png"
              alt=""
              width={340}
              height={285}
            />

            <div className={styles.resultCover} aria-hidden="true" />
            <Image
              className={styles.resultCapsule}
              src="/gacha/box-preview/capsule-green.png"
              alt=""
              width={70}
              height={70}
            />

            <span className={`${styles.twinkle} ${styles.twinkleOne}`} aria-hidden="true" />
            <span className={`${styles.twinkle} ${styles.twinkleTwo}`} aria-hidden="true" />
            <span className={`${styles.twinkle} ${styles.twinkleThree}`} aria-hidden="true" />
            <span className={`${styles.twinkle} ${styles.twinkleFour}`} aria-hidden="true" />
          </div>

          <div className={styles.caption} aria-live="polite">
            <span className={styles.captionDot} />
            {playing ? "カプセル搬送中…" : "元動画の画像で再現"}
          </div>
        </div>

        <button className={styles.replayButton} type="button" onClick={replay} disabled={playing}>
          <span aria-hidden="true">↻</span>
          {playing ? "再生中" : "もう一度見る"}
        </button>

        <p className={styles.note}>
          元動画から背景・カプセル・箱のキラキラを切り出し、カプセル上の文字だけを表示しない構成です。
        </p>
      </section>
    </main>
  );
}
