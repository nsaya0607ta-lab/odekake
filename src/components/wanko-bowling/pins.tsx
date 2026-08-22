"use client";

import { JB_PIN_SPACING_M } from "@/lib/games/wanko-bowling-physics";

export type PinLayout = {
  id: number;
  /** 初期表示用。投球中は Lane の透視投影で上書きする。 */
  x: number;
  y: number;
  /** 1番ピン中心から左右方向の実距離。 */
  lateralM: number;
  /** 1番ピン中心からピット方向への実距離。 */
  forwardM: number;
};

/**
 * 物理上の中心間隔は公認12インチのまま維持する。
 * 以前はピン画像が小さすぎて隙間が広く見えたため、表示だけ少し大きくする。
 */
export const PIN_VISUAL_WIDTH_PCT = 4.05;

const halfSpacingM = JB_PIN_SPACING_M / 2;
const rowDepthM = JB_PIN_SPACING_M * Math.sqrt(3) / 2;

/** 物理位置は12インチ中心間隔の正三角形。 */
export const PIN_LAYOUT: readonly PinLayout[] = [
  { id: 1, x: 50, y: 13.5, lateralM: 0, forwardM: 0 },
  { id: 2, x: 43.5, y: 10.7, lateralM: -halfSpacingM, forwardM: rowDepthM },
  { id: 3, x: 56.5, y: 10.7, lateralM: halfSpacingM, forwardM: rowDepthM },
  { id: 4, x: 37, y: 7.9, lateralM: -JB_PIN_SPACING_M, forwardM: rowDepthM * 2 },
  { id: 5, x: 50, y: 7.9, lateralM: 0, forwardM: rowDepthM * 2 },
  { id: 6, x: 63, y: 7.9, lateralM: JB_PIN_SPACING_M, forwardM: rowDepthM * 2 },
  { id: 7, x: 30.5, y: 5.1, lateralM: -JB_PIN_SPACING_M * 1.5, forwardM: rowDepthM * 3 },
  { id: 8, x: 43.5, y: 5.1, lateralM: -halfSpacingM, forwardM: rowDepthM * 3 },
  { id: 9, x: 56.5, y: 5.1, lateralM: halfSpacingM, forwardM: rowDepthM * 3 },
  { id: 10, x: 69.5, y: 5.1, lateralM: JB_PIN_SPACING_M * 1.5, forwardM: rowDepthM * 3 },
];

type PinsProps = {
  registerNode: (id: number, el: HTMLDivElement | null) => void;
};

export function Pins({ registerNode }: PinsProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {PIN_LAYOUT.map((pin) => (
        <div
          key={pin.id}
          ref={(el) => registerNode(pin.id, el)}
          className="absolute"
          style={{
            left: `${pin.x}%`,
            top: `${pin.y}%`,
            width: `${PIN_VISUAL_WIDTH_PCT}%`,
            zIndex: 100 - Math.round(pin.y * 2),
            transform: "translate(-50%, -50%)",
          }}
        >
          <svg className="block h-auto w-full" viewBox="0 0 20 34" aria-hidden="true">
            <ellipse cx="10" cy="31" rx="6.5" ry="2.4" fill="rgba(58,36,22,0.18)" />
            <path
              d="M10 1.5c2.3 0 3.6 2 3.2 4.1-.3 1.5-1.3 2.4-1.3 3.9 0 1.7 2.9 3.9 3.9 7.6.9 3.4.9 6.9-.4 9.9-.9 2-2.8 3.4-5.4 3.4s-4.5-1.4-5.4-3.4c-1.3-3-1.3-6.5-.4-9.9 1-3.7 3.9-5.9 3.9-7.6 0-1.5-1-2.4-1.3-3.9C6.4 3.5 7.7 1.5 10 1.5Z"
              fill="#f7f2e8"
              stroke="rgba(58,36,22,0.34)"
              strokeWidth="1"
            />
            <rect x="4.3" y="11.8" width="11.4" height="1.9" rx="0.95" fill="#b53632" />
            <rect x="4.7" y="14.2" width="10.6" height="1.7" rx="0.85" fill="#b53632" />
          </svg>
        </div>
      ))}
    </div>
  );
}
