"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";

export type MapTone = "pink" | "green" | "blue" | "yellow" | "purple" | "orange" | "teal" | "rose";

const TONES: Record<MapTone, { fill: string; stroke: string }> = {
  pink: { fill: "#f3d7dd", stroke: "#dda9b5" },
  blue: { fill: "#d7e5f0", stroke: "#a6c2d8" },
  green: { fill: "#dceacc", stroke: "#a7c289" },
  yellow: { fill: "#f2dda0", stroke: "#d6b96f" },
  purple: { fill: "#e4dcf1", stroke: "#b5a7d4" },
  teal: { fill: "#d3eae4", stroke: "#96c6bb" },
  orange: { fill: "#f7e0cd", stroke: "#deb18c" },
  rose: { fill: "#f5d9d2", stroke: "#dcaa9b" },
};

const UNVISITED = { fill: "#e6e3da", stroke: "#cdc7b8" };

export type MapShape = {
  /** 一意なキー（地方 slug または都道府県コード） */
  key: string;
  name: string;
  /** この図形を構成する SVG パス（地方は複数県分をまとめる） */
  paths: string[];
  tone: MapTone;
  visited: boolean;
  href: string;
  /** ラベルを描く位置。省略するとラベルなし */
  labelAt?: [number, number] | null;
};

type Props = {
  shapes: MapShape[];
  viewBox: string;
  /** ラベルの文字サイズ（viewBox 単位） */
  labelSize?: number;
  className?: string;
  ariaLabel: string;
};

export function AreaMap({ shapes, viewBox, labelSize = 0.62, className, ariaLabel }: Props) {
  const router = useRouter();

  // 表示倍率が変わっても境界線の太さがほぼ一定に見えるようにする
  const viewBoxWidth = Number(viewBox.split(" ")[2] ?? 1);
  const strokeWidth = viewBoxWidth / 300;

  const activate = (href: string) => router.push(href);

  const onKeyDown = (event: KeyboardEvent<SVGGElement>, href: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate(href);
    }
  };

  return (
    <svg
      viewBox={viewBox}
      role="group"
      aria-label={ariaLabel}
      className={className}
      style={{ touchAction: "manipulation" }}
    >
      {shapes.map((shape) => {
        const tone = shape.visited ? TONES[shape.tone] : UNVISITED;
        return (
          <g
            key={shape.key}
            role="link"
            tabIndex={0}
            aria-label={`${shape.name}${shape.visited ? "（訪問済み）" : "（未訪問）"}`}
            onClick={() => activate(shape.href)}
            onKeyDown={(e) => onKeyDown(e, shape.href)}
            className="cursor-pointer outline-none [&:focus-visible>path]:stroke-[#5d8049] [&:hover>path]:brightness-[0.97]"
          >
            <title>{shape.name}</title>
            {shape.paths.map((d, i) => (
              <path
                key={i}
                d={d}
                fill={tone.fill}
                stroke={tone.stroke}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
                style={{ transition: "fill 160ms ease" }}
              />
            ))}
          </g>
        );
      })}

      {/* ラベルは図形より前面に描く */}
      {shapes.map((shape) =>
        shape.labelAt ? (
          <text
            key={`label-${shape.key}`}
            x={shape.labelAt[0]}
            y={shape.labelAt[1]}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={labelSize}
            fontWeight={600}
            fill="#4a453d"
            stroke="#fdfbf5"
            strokeWidth={labelSize * 0.42}
            paintOrder="stroke"
            strokeLinejoin="round"
            pointerEvents="none"
          >
            {shape.name}
          </text>
        ) : null,
      )}
    </svg>
  );
}
