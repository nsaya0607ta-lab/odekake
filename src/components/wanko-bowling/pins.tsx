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
 * スマホでは遠近で隙間が強調されるため、表示だけ少し大きくして実際のラックらしく見せる。
 */
export const PIN_VISUAL_WIDTH_PCT = 4.5;

const PIN_IMAGE_SRC = "/games/wanko-bowling/pin.webp";
const halfSpacingM = JB_PIN_SPACING_M / 2;
const rowDepthM = JB_PIN_SPACING_M * Math.sqrt(3) / 2;

/**
 * スコアHUDと重ならないよう、ピンデッキ全体を画面上で少し手前へ配置する。
 * 物理座標（lateralM / forwardM）は変更しない。
 */
export const PIN_LAYOUT: readonly PinLayout[] = [
  { id: 1, x: 50, y: 21.5, lateralM: 0, forwardM: 0 },
  { id: 2, x: 43.5, y: 18.7, lateralM: -halfSpacingM, forwardM: rowDepthM },
  { id: 3, x: 56.5, y: 18.7, lateralM: halfSpacingM, forwardM: rowDepthM },
  { id: 4, x: 37, y: 15.9, lateralM: -JB_PIN_SPACING_M, forwardM: rowDepthM * 2 },
  { id: 5, x: 50, y: 15.9, lateralM: 0, forwardM: rowDepthM * 2 },
  { id: 6, x: 63, y: 15.9, lateralM: JB_PIN_SPACING_M, forwardM: rowDepthM * 2 },
  { id: 7, x: 30.5, y: 13.1, lateralM: -JB_PIN_SPACING_M * 1.5, forwardM: rowDepthM * 3 },
  { id: 8, x: 43.5, y: 13.1, lateralM: -halfSpacingM, forwardM: rowDepthM * 3 },
  { id: 9, x: 56.5, y: 13.1, lateralM: halfSpacingM, forwardM: rowDepthM * 3 },
  { id: 10, x: 69.5, y: 13.1, lateralM: JB_PIN_SPACING_M * 1.5, forwardM: rowDepthM * 3 },
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={PIN_IMAGE_SRC}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="block h-auto w-full select-none"
          />
        </div>
      ))}
    </div>
  );
}
