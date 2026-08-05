"use client";

import { useRouter } from "next/navigation";
import { useState, type KeyboardEvent, type PointerEvent } from "react";

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

/** 位置を動かして描いている離島の枠 */
export type MapInsetFrame = {
  id: string;
  label: string;
  /** [x, y, width, height] */
  frame: [number, number, number, number];
};

type Props = {
  shapes: MapShape[];
  viewBox: string;
  /** ラベルの文字サイズ（viewBox 単位） */
  labelSize?: number;
  insets?: MapInsetFrame[];
  className?: string;
  ariaLabel: string;
};

export function AreaMap({ shapes, viewBox, labelSize = 0.62, insets = [], className, ariaLabel }: Props) {
  const router = useRouter();
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  // 表示倍率が変わっても境界線の太さがほぼ一定に見えるようにする
  const viewBoxWidth = Number(viewBox.split(" ")[2] ?? 1);
  const strokeWidth = viewBoxWidth / 300;

  const beginPress = (key: string, href: string) => {
    setPressedKey(key);
    router.prefetch(href);
  };

  const activate = (key: string, href: string) => {
    setPressedKey(key);
    router.push(href);

    // 遷移に失敗した場合でも選択状態が残り続けないようにする。
    // 画面遷移を待たせるための遅延ではない。
    window.setTimeout(() => {
      setPressedKey((current) => (current === key ? null : current));
    }, 900);
  };

  const onKeyDown = (event: KeyboardEvent<SVGGElement>, key: string, href: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate(key, href);
    }
  };

  const onPointerLeave = (event: PointerEvent<SVGGElement>, key: string) => {
    // マウス操作ではホバー解除時に戻す。タッチ操作では指のわずかな移動で解除しない。
    if (event.pointerType === "mouse") {
      setPressedKey((current) => (current === key ? null : current));
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
      {/* 離島の枠は図形の背面に描く */}
      {insets.map((inset) => (
        <g key={`inset-${inset.id}`} pointerEvents="none">
          <rect
            x={inset.frame[0]}
            y={inset.frame[1]}
            width={inset.frame[2]}
            height={inset.frame[3]}
            rx={labelSize * 0.5}
            fill="#fbf8f0"
            stroke="#c8c1b0"
            strokeWidth={strokeWidth * 1.3}
            strokeDasharray={`${strokeWidth * 5} ${strokeWidth * 4}`}
          />
          <text
            x={inset.frame[0] + inset.frame[2] / 2}
            y={inset.frame[1] - labelSize * 0.32}
            textAnchor="middle"
            fontSize={labelSize * 0.66}
            fill="#7b7466"
          >
            {inset.label}
          </text>
        </g>
      ))}

      {shapes.map((shape) => {
        const tone = shape.visited ? TONES[shape.tone] : UNVISITED;
        const isPressed = pressedKey === shape.key;

        return (
          <g
            key={shape.key}
            role="link"
            tabIndex={0}
            aria-label={`${shape.name}${shape.visited ? "（訪問済み）" : "（未訪問）"}`}
            onPointerDown={() => beginPress(shape.key, shape.href)}
            onPointerCancel={() => setPressedKey((current) => (current === shape.key ? null : current))}
            onPointerLeave={(event) => onPointerLeave(event, shape.key)}
            onClick={() => activate(shape.key, shape.href)}
            onKeyDown={(event) => onKeyDown(event, shape.key, shape.href)}
            onBlur={() => setPressedKey((current) => (current === shape.key ? null : current))}
            className="cursor-pointer outline-none [&:focus-visible>path]:stroke-[#5d8049] [&:hover>path]:brightness-[0.97]"
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              transform: isPressed ? "scale(0.975)" : "scale(1)",
              filter: isPressed ? "brightness(0.93)" : "none",
              transition: "transform 70ms ease-out, filter 70ms ease-out",
            }}
          >
            <title>{shape.name}</title>
            {shape.paths.map((d, index) => (
              <path
                key={index}
                d={d}
                fill={tone.fill}
                stroke={isPressed ? "#5d8049" : tone.stroke}
                strokeWidth={isPressed ? strokeWidth * 3 : strokeWidth}
                strokeLinejoin="round"
                style={{ transition: "fill 120ms ease, stroke 70ms ease, stroke-width 70ms ease" }}
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
