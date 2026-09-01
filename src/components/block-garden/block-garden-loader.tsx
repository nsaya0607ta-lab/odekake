"use client";

import dynamic from "next/dynamic";
import styles from "./block-garden-game.module.css";

export type BlockGardenLoaderProps = {
  returnHref?: string;
  title?: string;
  eyebrow?: string;
};

const BlockGardenGame = dynamic<BlockGardenLoaderProps>(
  () => import("./block-garden-game"),
  {
    ssr: false,
    loading: () => (
      <div className={styles.loading} role="status" aria-live="polite">
        <div className={styles.loadingCard}>
          <div className={styles.loadingIcon} aria-hidden="true">🌱</div>
          <p className={styles.loadingTitle}>小さな街を準備中…</p>
          <p className={styles.loadingText}>3Dフィールドはこの画面を開いた時だけ読み込みます。</p>
        </div>
      </div>
    ),
  },
);

export function BlockGardenLoader(props: BlockGardenLoaderProps) {
  return <BlockGardenGame {...props} />;
}
