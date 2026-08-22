"use client";

export type PinLayout = { id: number; x: number; y: number };

/** レーン幅に対するピンの見た目の幅。Lane 側の当たり判定と同じ値を使う。 */
export const PIN_DIAMETER_PCT = 5.4;

/**
 * 10ピンの正三角形配置（%座標）。
 * フルスクリーン化に合わせてデッキを上へ寄せ、ボールから1番ピンまでの距離を長くする。
 */
export const PIN_LAYOUT: readonly PinLayout[] = [
  { id: 1, x: 50, y: 24 },
  { id: 2, x: 42, y: 20 },
  { id: 3, x: 58, y: 20 },
  { id: 4, x: 34, y: 16 },
  { id: 5, x: 50, y: 16 },
  { id: 6, x: 66, y: 16 },
  { id: 7, x: 26, y: 12 },
  { id: 8, x: 42, y: 12 },
  { id: 9, x: 58, y: 12 },
  { id: 10, x: 74, y: 12 },
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
            width: `${PIN_DIAMETER_PCT}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <svg className="block h-auto w-full" viewBox="0 0 20 34" aria-hidden="true">
            <ellipse cx="10" cy="31" rx="6.5" ry="2.4" fill="rgba(58,36,22,0.18)" />
            <path
              d="M10 1.5c2.3 0 3.6 2 3.2 4.1-.3 1.5-1.3 2.4-1.3 3.9 0 1.7 2.9 3.9 3.9 7.6.9 3.4.9 6.9-.4 9.9-.9 2-2.8 3.4-5.4 3.4s-4.5-1.4-5.4-3.4c-1.3-3-1.3-6.5-.4-9.9 1-3.7 3.9-5.9 3.9-7.6 0-1.5-1-2.4-1.3-3.9C6.4 3.5 7.7 1.5 10 1.5Z"
              fill="#f6ecd6"
              stroke="rgba(58,36,22,0.28)"
              strokeWidth="1"
            />
            <rect x="4.6" y="12.4" width="10.8" height="2.4" rx="1.2" fill="#a8442f" />
            <ellipse cx="10" cy="21.6" rx="2.1" ry="1.7" fill="#5d8049" opacity="0.9" />
            <circle cx="7.3" cy="19.3" r="0.85" fill="#5d8049" opacity="0.9" />
            <circle cx="10" cy="18.4" r="0.85" fill="#5d8049" opacity="0.9" />
            <circle cx="12.7" cy="19.3" r="0.85" fill="#5d8049" opacity="0.9" />
          </svg>
        </div>
      ))}
    </div>
  );
}
