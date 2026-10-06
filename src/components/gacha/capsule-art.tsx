"use client";

import type { CSSProperties, Ref } from "react";
import type { GachaRarity } from "@/lib/gacha/config";
import { capsuleHalves, capsuleSrc } from "./art";
import styles from "./gacha-cinematic.module.css";

/** たたいたときに入るひび（1回目・2回目） */
const CAPSULE_CRACKS = [
  ["M30 52 L36 44 L33 37 L40 30", "M36 44 L43 46"],
  ["M70 50 L64 42 L69 34 L62 26", "M64 42 L57 45", "M52 54 L50 44 L55 38"],
] as const;

type Props = {
  rarity: GachaRarity;
  /** 受け皿に並べる小さいカプセル */
  small?: boolean;
  /** 透明なふた越しに見える中身（影だけ見せる）。undefined なら中身を描かない */
  inside?: string | null;
  topRef?: Ref<HTMLSpanElement>;
  bottomRef?: Ref<HTMLSpanElement>;
  insideRef?: Ref<HTMLSpanElement>;
  /** ひびの線（たたいて開けるカプセルだけ） */
  crackRef?: Ref<SVGSVGElement>;
  className?: string;
};

const urlOf = (src: string) => `url(${JSON.stringify(src)})`;

/**
 * カプセルの絵。ふた（上の透明なところ）と器（下の色のついたところ）を別々に動かせるよう、
 * 同じ絵を合わせ目の弧で2つに切って重ねている。
 */
export function CapsuleArt({ rarity, small = false, inside, topRef, bottomRef, insideRef, crackRef, className }: Props) {
  const halves = capsuleHalves(rarity);
  const image = urlOf(capsuleSrc(rarity, small));
  const top: CSSProperties = { backgroundImage: image, clipPath: halves.top, WebkitClipPath: halves.top };
  const bottom: CSSProperties = { backgroundImage: image, clipPath: halves.bottom, WebkitClipPath: halves.bottom };
  return (
    <span className={`${styles.capsuleArt} ${className ?? ""}`} data-rarity={rarity} aria-hidden="true">
      {inside !== undefined ? (
        <span ref={insideRef} className={styles.capsuleInside} style={inside ? { backgroundImage: urlOf(inside) } : undefined} />
      ) : null}
      <span ref={bottomRef} className={`${styles.capsuleHalf} ${styles.capsuleBottom}`} style={bottom} />
      <span ref={topRef} className={`${styles.capsuleHalf} ${styles.capsuleTop}`} style={top} />
      {crackRef ? (
        <svg ref={crackRef} className={styles.capsuleCracks} viewBox="0 0 100 100">
          {CAPSULE_CRACKS.map((paths, step) => (
            <g key={step} data-step={step + 1}>
              {paths.map((d) => <path key={d} d={d} />)}
            </g>
          ))}
        </svg>
      ) : null}
    </span>
  );
}
