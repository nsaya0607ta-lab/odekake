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

const halfSpacingM = JB_PIN_SPACING_M / 2;
const rowDepthM = JB_PIN_SPACING_M * Math.sqrt(3) / 2;

/**
 * 初期描画の一瞬だけ使う画面座標。Lane側の共通透視投影に近い値を入れて、
 * マウント直後にピンが大きく位置移動して見えないようにする。
 * 物理座標（lateralM / forwardM）は公認12インチ間隔のまま変更しない。
 */
export const PIN_LAYOUT: readonly PinLayout[] = [
  { id: 1, x: 50, y: 19.5, lateralM: 0, forwardM: 0 },
  { id: 2, x: 43.47, y: 18.39, lateralM: -halfSpacingM, forwardM: rowDepthM },
  { id: 3, x: 56.53, y: 18.39, lateralM: halfSpacingM, forwardM: rowDepthM },
  { id: 4, x: 37.42, y: 16.99, lateralM: -JB_PIN_SPACING_M, forwardM: rowDepthM * 2 },
  { id: 5, x: 50, y: 16.99, lateralM: 0, forwardM: rowDepthM * 2 },
  { id: 6, x: 62.58, y: 16.99, lateralM: JB_PIN_SPACING_M, forwardM: rowDepthM * 2 },
  { id: 7, x: 32.22, y: 15.3, lateralM: -JB_PIN_SPACING_M * 1.5, forwardM: rowDepthM * 3 },
  { id: 8, x: 44.07, y: 15.3, lateralM: -halfSpacingM, forwardM: rowDepthM * 3 },
  { id: 9, x: 55.93, y: 15.3, lateralM: halfSpacingM, forwardM: rowDepthM * 3 },
  { id: 10, x: 67.78, y: 15.3, lateralM: JB_PIN_SPACING_M * 1.5, forwardM: rowDepthM * 3 },
];

type PinsProps = {
  registerNode: (id: number, el: HTMLDivElement | null) => void;
  goldenPinId?: number | null;
};

export function Pins({ registerNode, goldenPinId = null }: PinsProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {PIN_LAYOUT.map((pin) => {
        const golden = pin.id === goldenPinId;
        return (
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
              filter: golden
                ? "drop-shadow(0 0 3px rgba(255,211,77,0.95)) drop-shadow(0 0 7px rgba(255,157,0,0.7))"
                : undefined,
            }}
          >
            {golden ? (
              <span className="absolute left-1/2 top-1/2 h-[145%] w-[190%] -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-[#ffd34d]/20 blur-[3px]" />
            ) : null}
            <svg className="relative block h-auto w-full" viewBox="0 0 20 34" aria-hidden="true">
              {golden ? (
                <defs>
                  <linearGradient id={`golden-pin-${pin.id}`} x1="3" y1="2" x2="17" y2="31" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#fff7b0" />
                    <stop offset="0.34" stopColor="#ffd64f" />
                    <stop offset="0.72" stopColor="#d99108" />
                    <stop offset="1" stopColor="#8a4a00" />
                  </linearGradient>
                </defs>
              ) : null}
              <ellipse cx="10" cy="31" rx="6.5" ry="2.4" fill={golden ? "rgba(255,185,30,0.36)" : "rgba(58,36,22,0.18)"} />
              <path
                d="M10 1.5c2.3 0 3.6 2 3.2 4.1-.3 1.5-1.3 2.4-1.3 3.9 0 1.7 2.9 3.9 3.9 7.6.9 3.4.9 6.9-.4 9.9-.9 2-2.8 3.4-5.4 3.4s-4.5-1.4-5.4-3.4c-1.3-3-1.3-6.5-.4-9.9 1-3.7 3.9-5.9 3.9-7.6 0-1.5-1-2.4-1.3-3.9C6.4 3.5 7.7 1.5 10 1.5Z"
                fill={golden ? `url(#golden-pin-${pin.id})` : "#f7f2e8"}
                stroke={golden ? "rgba(255,238,142,0.9)" : "rgba(58,36,22,0.34)"}
                strokeWidth="1"
              />
              <rect x="4.3" y="11.8" width="11.4" height="1.9" rx="0.95" fill={golden ? "#fff0a0" : "#b53632"} />
              <rect x="4.7" y="14.2" width="10.6" height="1.7" rx="0.85" fill={golden ? "#a65a00" : "#b53632"} />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
