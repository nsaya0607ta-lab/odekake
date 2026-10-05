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
  // 11〜15番はビッグラック（ストライクの次）だけの5段目。ふだんは見えない
  { id: 11, x: 30, y: 15.3, lateralM: -JB_PIN_SPACING_M * 2, forwardM: rowDepthM * 4 },
  { id: 12, x: 40, y: 15.3, lateralM: -JB_PIN_SPACING_M, forwardM: rowDepthM * 4 },
  { id: 13, x: 50, y: 15.3, lateralM: 0, forwardM: rowDepthM * 4 },
  { id: 14, x: 60, y: 15.3, lateralM: JB_PIN_SPACING_M, forwardM: rowDepthM * 4 },
  { id: 15, x: 70, y: 15.3, lateralM: JB_PIN_SPACING_M * 2, forwardM: rowDepthM * 4 },
];

/**
 * ビッグラック（15本・5段）は、そのままの間隔だと5段目がレーンからはみ出すので、
 * 間隔を少しつめて並べる（ピン同士がぶつかりやすく、ピンアクションが派手になる）。
 */
export const BIG_RACK_SPACING_SCALE = 0.76;

/** キングピンの見た目の大きさ（ふつうのピンに対する倍率） */
export const KING_PIN_VISUAL_SCALE = 1.55;

type PinsProps = {
  registerNode: (id: number, el: HTMLDivElement | null) => void;
  goldenPinId?: number | null;
  /** 10フレーム目のキングピン */
  kingPinId?: number | null;
  /** フィーバー中はピンがネオンのように光る */
  fever?: boolean;
};

export function Pins({ registerNode, goldenPinId = null, kingPinId = null, fever = false }: PinsProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {PIN_LAYOUT.map((pin) => {
        const golden = pin.id === goldenPinId;
        const king = pin.id === kingPinId;
        return (
          <div
            key={pin.id}
            ref={(el) => registerNode(pin.id, el)}
            className="absolute will-change-transform"
            style={{
              left: `${pin.x}%`,
              top: `${pin.y}%`,
              width: `${PIN_VISUAL_WIDTH_PCT}%`,
              zIndex: 100 - Math.round(pin.y * 2),
              transform: "translate(-50%, -50%)",
              // 11〜15番は、ビッグラックでレーンが並べなおすまで見せない
              opacity: pin.id > 10 ? 0 : undefined,
              filter: golden
                ? "drop-shadow(0 0 3px rgba(255,211,77,0.95)) drop-shadow(0 0 7px rgba(255,157,0,0.7))"
                : king
                  ? "drop-shadow(0 0 3px rgba(190,120,255,0.95)) drop-shadow(0 0 8px rgba(255,200,80,0.6))"
                  : fever
                    ? "drop-shadow(0 0 2px rgba(255,120,240,0.95)) drop-shadow(0 0 6px rgba(120,220,255,0.75))"
                    : undefined,
            }}
          >
            {king ? (
              <span className="absolute -top-[42%] left-1/2 -translate-x-1/2 text-[0.9em] leading-none drop-shadow-[0_0_4px_rgba(255,210,80,0.95)]" style={{ fontSize: "min(14px, 3.4vw)" }} aria-hidden="true">👑</span>
            ) : null}
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
              ) : (
                <defs>
                  {/* 丸みが出るよう、左から光が当たった陰影をつける（見た目だけ） */}
                  <linearGradient id={`wb-pin-${pin.id}`} x1="3" y1="0" x2="17" y2="0" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#d8cfbf" />
                    <stop offset="0.3" stopColor="#ffffff" />
                    <stop offset="0.55" stopColor="#f7f2e8" />
                    <stop offset="1" stopColor="#bfb4a0" />
                  </linearGradient>
                </defs>
              )}
              <ellipse cx="10" cy="31" rx="6.5" ry="2.4" fill={golden ? "rgba(255,185,30,0.36)" : "rgba(58,36,22,0.18)"} />
              <path
                d="M10 1.5c2.3 0 3.6 2 3.2 4.1-.3 1.5-1.3 2.4-1.3 3.9 0 1.7 2.9 3.9 3.9 7.6.9 3.4.9 6.9-.4 9.9-.9 2-2.8 3.4-5.4 3.4s-4.5-1.4-5.4-3.4c-1.3-3-1.3-6.5-.4-9.9 1-3.7 3.9-5.9 3.9-7.6 0-1.5-1-2.4-1.3-3.9C6.4 3.5 7.7 1.5 10 1.5Z"
                fill={golden ? `url(#golden-pin-${pin.id})` : `url(#wb-pin-${pin.id})`}
                stroke={golden ? "rgba(255,238,142,0.9)" : king ? "rgba(120,60,200,0.8)" : "rgba(58,36,22,0.34)"}
                strokeWidth="1"
              />
              <rect x="4.3" y="11.8" width="11.4" height="1.9" rx="0.95" fill={golden ? "#fff0a0" : king ? "#ffc83d" : "#b53632"} />
              <rect x="4.7" y="14.2" width="10.6" height="1.7" rx="0.85" fill={golden ? "#a65a00" : king ? "#7b3fd6" : "#b53632"} />
              {/* つやの線 */}
              <path d="M7.6 4.2c-.3 1.4.6 2.6.8 4M6.4 19.5c-.6 2.4-.5 4.9.2 7" stroke="rgba(255,255,255,0.85)" strokeWidth="0.9" strokeLinecap="round" fill="none" />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
