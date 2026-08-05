"use client";

import { useRouter } from "next/navigation";
import { useState, type PointerEvent } from "react";

export type MunicipalityArea = {
  code: string;
  name: string;
  /** 境界の SVG パス。境界データが無い市区町村は null */
  d: string | null;
  /** ラベルと目印の位置 */
  center: [number, number] | null;
  /** 描画したときの大きさ。小さいものには目印を重ねる */
  span: number;
  spotCount: number;
  visitCount: number;
  favoriteCount: number;
  /** 色の濃さ（0＝未訪問、1〜4＝訪問済み） */
  level: number;
};

export type MapFrame = { id: string; label: string; frame: [number, number, number, number] };

/**
 * 濃さの段階。いまは訪問回数で決めているが、
 * お気に入り数など別の基準へ差し替えられるように段階だけを持たせている
 * （段階の求め方は src/lib/data/areas.ts の shadeLevel）。
 */
const FILL = ["#efece2", "#dfead0", "#c6dcae", "#a8c98a", "#8fb36c"];
const STROKE = ["#c9c2b1", "#b5c69c", "#9db684", "#82a76a", "#6b9455"];

export function MunicipalityMap({
  prefectureName,
  viewBox,
  insets,
  areas,
  hrefBase,
  className,
}: {
  prefectureName: string;
  viewBox: string;
  insets: MapFrame[];
  areas: MunicipalityArea[];
  hrefBase: string;
  className?: string;
}) {
  const router = useRouter();
  const [active, setActive] = useState<string | null>(null);
  const [pressed, setPressed] = useState<string | null>(null);

  const [, , boxWidth = 1, boxHeight = 1] = viewBox.split(" ").map(Number);
  const scale = Math.max(boxWidth, boxHeight);
  const strokeWidth = scale / 420;
  // 指で押せる大きさに満たない市区町村には、丸い目印を重ねる
  const markerRadius = scale / 90;
  const smallThreshold = markerRadius * 2.4;

  const activeCode = pressed ?? active;
  const activeArea = areas.find((municipality) => municipality.code === activeCode) ?? null;

  const beginPress = (code: string) => {
    const href = `${hrefBase}/${code}`;
    setActive(code);
    setPressed(code);
    router.prefetch(href);
  };

  const open = (code: string) => {
    const href = `${hrefBase}/${code}`;
    setActive(code);
    setPressed(code);
    router.push(href);

    // 遷移に失敗した場合でも選択状態が残り続けないようにする。
    // 画面遷移を遅らせる処理ではない。
    window.setTimeout(() => {
      setPressed((current) => (current === code ? null : current));
    }, 900);
  };

  const onPointerLeave = (event: PointerEvent<SVGGElement>, code: string) => {
    if (event.pointerType === "mouse") {
      setActive((current) => (current === code ? null : current));
      setPressed((current) => (current === code ? null : current));
    }
  };

  return (
    <div className={className}>
      <svg
        viewBox={viewBox}
        role="group"
        aria-label={`${prefectureName}の市区町村地図`}
        className="h-auto w-full"
        style={{ touchAction: "manipulation" }}
      >
        {/* 位置を動かして描いている離島の枠 */}
        {insets.map((inset) => (
          <g key={inset.id} pointerEvents="none">
            <rect
              x={inset.frame[0]}
              y={inset.frame[1]}
              width={inset.frame[2]}
              height={inset.frame[3]}
              rx={scale / 50}
              fill="#fbf8f0"
              stroke="#c8c1b0"
              strokeWidth={strokeWidth * 1.3}
              strokeDasharray={`${strokeWidth * 5} ${strokeWidth * 4}`}
            />
            <text
              x={inset.frame[0] + inset.frame[2] / 2}
              y={inset.frame[1] - scale / 110}
              textAnchor="middle"
              fontSize={scale / 38}
              fill="#7b7466"
            >
              {inset.label}
            </text>
          </g>
        ))}

        {areas.map((area) => {
          if (!area.d) return null;
          const isActive = activeCode === area.code;

          return (
            <g
              key={area.code}
              role="link"
              tabIndex={0}
              aria-label={`${area.name}${area.level > 0 ? "（訪問済み）" : "（未訪問）"}`}
              onPointerDown={() => beginPress(area.code)}
              onPointerCancel={() => setPressed((current) => (current === area.code ? null : current))}
              onPointerEnter={() => setActive(area.code)}
              onPointerLeave={(event) => onPointerLeave(event, area.code)}
              onClick={() => open(area.code)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  open(area.code);
                }
              }}
              onFocus={() => setActive(area.code)}
              onBlur={() => {
                setActive((current) => (current === area.code ? null : current));
                setPressed((current) => (current === area.code ? null : current));
              }}
              className="cursor-pointer outline-none"
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                transform: pressed === area.code ? "scale(0.975)" : "scale(1)",
                filter: pressed === area.code ? "brightness(0.93)" : "none",
                transition: "transform 70ms ease-out, filter 70ms ease-out",
              }}
            >
              <title>{area.name}</title>
              <path
                d={area.d}
                fill={FILL[area.level] ?? FILL[0]}
                stroke={isActive ? "#5d8049" : (STROKE[area.level] ?? STROKE[0])}
                strokeWidth={isActive ? strokeWidth * 3 : strokeWidth}
                strokeLinejoin="round"
                style={{ transition: "stroke 70ms ease, stroke-width 70ms ease" }}
              />
              {/* 小さな市区町村は形だけでは押しづらいので、目印と当たり判定を重ねる */}
              {area.center && area.span < smallThreshold ? (
                <>
                  <circle
                    cx={area.center[0]}
                    cy={area.center[1]}
                    r={markerRadius}
                    fill={FILL[area.level] ?? FILL[0]}
                    stroke={isActive ? "#5d8049" : (STROKE[area.level] ?? STROKE[0])}
                    strokeWidth={isActive ? strokeWidth * 2.6 : strokeWidth * 1.4}
                  />
                  <circle cx={area.center[0]} cy={area.center[1]} r={markerRadius * 2.2} fill="transparent" />
                </>
              ) : null}
            </g>
          );
        })}

        {activeArea?.center ? (
          <text
            x={activeArea.center[0]}
            y={activeArea.center[1] - markerRadius * 2.2}
            textAnchor="middle"
            fontSize={scale / 26}
            fontWeight={700}
            fill="#3c382f"
            stroke="#fdfbf5"
            strokeWidth={scale / 90}
            paintOrder="stroke"
            strokeLinejoin="round"
            pointerEvents="none"
          >
            {activeArea.name}
          </text>
        ) : null}
      </svg>

      <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-ink-faint">
        <span>未訪問</span>
        {FILL.map((fill, index) => (
          <span
            key={fill}
            aria-hidden
            className="inline-block h-3 w-5 rounded-[3px] border"
            style={{ backgroundColor: fill, borderColor: STROKE[index] }}
          />
        ))}
        <span>訪問が多い</span>
      </div>
    </div>
  );
}
