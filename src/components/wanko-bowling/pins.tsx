"use client";

export type PinLayout = { id: number; x: number; y: number };

/** 10ピンの正三角形配置（%座標）。1がレーン側（手前）、10が奥の右端。 */
export const PIN_LAYOUT: readonly PinLayout[] = [
  { id: 1, x: 50, y: 33 },
  { id: 2, x: 42, y: 27 },
  { id: 3, x: 58, y: 27 },
  { id: 4, x: 34, y: 21 },
  { id: 5, x: 50, y: 21 },
  { id: 6, x: 66, y: 21 },
  { id: 7, x: 26, y: 15 },
  { id: 8, x: 42, y: 15 },
  { id: 9, x: 58, y: 15 },
  { id: 10, x: 74, y: 15 },
];

/** 標準的なボウリングのピン隣接グラフ（連鎖判定に使う）。 */
export const PIN_ADJACENCY: Readonly<Record<number, readonly number[]>> = {
  1: [2, 3],
  2: [1, 4, 5],
  3: [1, 5, 6],
  4: [2, 7, 8],
  5: [2, 3, 8, 9],
  6: [3, 5, 9, 10],
  7: [4, 8],
  8: [4, 5, 9],
  9: [5, 6, 8, 10],
  10: [6, 9],
};

type PinsProps = {
  standingIds: ReadonlySet<number>;
  fallingIds: ReadonlySet<number>;
};

export function Pins({ standingIds, fallingIds }: PinsProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {PIN_LAYOUT.map((pin) => {
        const standing = standingIds.has(pin.id);
        const falling = fallingIds.has(pin.id);
        if (!standing && !falling) return null;

        const fallX = pin.x < 50 ? "-14px" : pin.x > 50 ? "14px" : "3px";
        const fallR = pin.x < 50 ? "-95deg" : "95deg";

        return (
          <div
            key={pin.id}
            className={`absolute ${falling ? "wanko-bowl-pin-fall" : ""}`}
            style={{
              left: `${pin.x}%`,
              top: `${pin.y}%`,
              // -50%,-50% の中心合わせは wanko-bowl-pin-fall のキーフレーム側にも
              // 焼き込んである（Tailwind の translate ユーティリティと transform を
              // 奪い合わないようにするため）。ここでは倒れていない時だけ使う。
              transform: falling ? undefined : "translate(-50%, -50%)",
              ["--pin-fall-x" as string]: fallX,
              ["--pin-fall-r" as string]: fallR,
            }}
          >
            <svg width="20" height="34" viewBox="0 0 20 34" aria-hidden="true">
              <ellipse cx="10" cy="31" rx="6.5" ry="2.4" fill="rgba(58,36,22,0.18)" />
              <path
                d="M10 1.5c2.3 0 3.6 2 3.2 4.1-.3 1.5-1.3 2.4-1.3 3.9 0 1.7 2.9 3.9 3.9 7.6.9 3.4.9 6.9-.4 9.9-.9 2-2.8 3.4-5.4 3.4s-4.5-1.4-5.4-3.4c-1.3-3-1.3-6.5-.4-9.9 1-3.7 3.9-5.9 3.9-7.6 0-1.5-1-2.4-1.3-3.9C6.4 3.5 7.7 1.5 10 1.5Z"
                fill="#f6ecd6"
                stroke="rgba(58,36,22,0.28)"
                strokeWidth="1"
              />
              <rect x="4.6" y="12.4" width="10.8" height="2.4" rx="1.2" fill="#a8442f" />
              {/* 肉球マーク */}
              <ellipse cx="10" cy="21.6" rx="2.1" ry="1.7" fill="#5d8049" opacity="0.9" />
              <circle cx="7.3" cy="19.3" r="0.85" fill="#5d8049" opacity="0.9" />
              <circle cx="10" cy="18.4" r="0.85" fill="#5d8049" opacity="0.9" />
              <circle cx="12.7" cy="19.3" r="0.85" fill="#5d8049" opacity="0.9" />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
