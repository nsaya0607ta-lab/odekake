"use client";

import dynamic from "next/dynamic";
import styles from "./block-garden-game.module.css";

const BlockGardenGame = dynamic(() => import("./block-garden-game"), {
  ssr: false,
  loading: () => (
    <div className={styles.loading} role="status" aria-live="polite">
      <div className={styles.loadingCard}>
        <div className={styles.loadingIcon} aria-hidden="true">🌱</div>
        <p className={styles.loadingTitle}>小さな庭を準備中…</p>
        <p className={styles.loadingText}>3Dフィールドはこのゲームを開いた時だけ読み込みます。</p>
      </div>
    </div>
  ),
});

export function BlockGardenLoader() {
  return <BlockGardenGame />;
}
