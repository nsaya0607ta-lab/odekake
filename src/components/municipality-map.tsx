"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type MunicipalityPoint = {
  code: string;
  name: string;
  /** 地図座標に変換済みの位置（サーバー側で projectPoint 済み） */
  x: number | null;
  y: number | null;
  spotCount: number;
  visited: boolean;
};

export type MapFrame = { id: string; label: string; frame: [number, number, number, number] };

type Placed = MunicipalityPoint & { x: number; y: number };

/**
 * 重なった点を少しずつ押し合って離す。
 * 政令指定都市の区のように代表座標がほぼ同じ市区町村があるため、
 * そのままでは点が完全に重なって選べなくなる。
 */
function spreadOut(points: Placed[], minDistance: number) {
  const jitter = (i: number, axis: number) => Math.sin(i * 12.9898 + axis * 78.233) * 1e-4;
  for (const [i, p] of points.entries()) {
    p.x += jitter(i, 0);
    p.y += jitter(i, 1);
  }

  for (let step = 0; step < 60; step += 1) {
    let moved = false;
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i]!;
        const b = points[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        if (distance >= minDistance || distance === 0) continue;
        const push = (minDistance - distance) / 2;
        const ux = dx / distance;
        const uy = dy / distance;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return points;
}

/**
 * 都道府県の輪郭の上に、市区町村を点で並べた地図。
 * 市区町村ごとの境界データは持たないため、代表座標を使った配置図として描く。
 *
 * 図形と座標はサーバー側で用意して渡す（地図データを端末へ送らないため）。
 */
export function MunicipalityMap({
  prefectureName,
  outline,
  viewBox,
  insets,
  items,
  hrefBase,
  className,
}: {
  prefectureName: string;
  outline: string;
  viewBox: string;
  insets: MapFrame[];
  items: MunicipalityPoint[];
  hrefBase: string;
  className?: string;
}) {
  const router = useRouter();
  const [active, setActive] = useState<string | null>(null);

  const [, , boxWidth = 1, boxHeight = 1] = viewBox.split(" ").map(Number);
  const scale = Math.max(boxWidth, boxHeight);
  // 市区町村が多い都道府県ほど点を小さくして、輪郭が埋もれないようにする
  const radius = Math.min(
    scale / 55,
    Math.max(scale / 150, Math.sqrt((boxWidth * boxHeight) / Math.max(items.length, 1)) / 6),
  );
  const strokeWidth = scale / 320;

  const placed = useMemo(() => {
    const points = items
      .filter((m): m is Placed => m.x !== null && m.y !== null)
      .map((m) => ({ ...m }));
    return spreadOut(points, radius * 2.05);
  }, [items, radius]);

  const activeItem = placed.find((m) => m.code === active) ?? null;
  const open = (code: string) => router.push(`${hrefBase}/${code}`);

  return (
    <div className={className}>
      <svg viewBox={viewBox} role="group" aria-label={`${prefectureName}の市区町村地図`} className="h-auto w-full">
        {/* 位置を動かして描いている離島の枠 */}
        {insets.map((inset) => (
          <g key={inset.id} pointerEvents="none">
            <rect
              x={inset.frame[0]}
              y={inset.frame[1]}
              width={inset.frame[2]}
              height={inset.frame[3]}
              rx={scale / 40}
              fill="#fbf8f0"
              stroke="#c8c1b0"
              strokeWidth={strokeWidth * 1.3}
              strokeDasharray={`${strokeWidth * 5} ${strokeWidth * 4}`}
            />
            <text
              x={inset.frame[0] + inset.frame[2] / 2}
              y={inset.frame[1] - scale / 90}
              textAnchor="middle"
              fontSize={scale / 34}
              fill="#7b7466"
            >
              {inset.label}
            </text>
          </g>
        ))}

        <path
          d={outline}
          fill="#eeeade"
          stroke="#c9c2b1"
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          pointerEvents="none"
        />

        {placed.map((m) => (
          <g
            key={m.code}
            role="link"
            tabIndex={0}
            aria-label={`${m.name}${m.visited ? "（訪問済み）" : "（未訪問）"}`}
            onClick={() => open(m.code)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                open(m.code);
              }
            }}
            onPointerEnter={() => setActive(m.code)}
            onFocus={() => setActive(m.code)}
            onPointerLeave={() => setActive((current) => (current === m.code ? null : current))}
            onBlur={() => setActive((current) => (current === m.code ? null : current))}
            className="cursor-pointer outline-none"
          >
            <title>{m.name}</title>
            {/* 指で押しやすいように、見た目より広い当たり判定を重ねる */}
            <circle cx={m.x} cy={m.y} r={radius * 1.9} fill="transparent" />
            <circle
              cx={m.x}
              cy={m.y}
              r={active === m.code ? radius * 1.35 : radius}
              fill={m.visited ? "#8fb36c" : "#ffffff"}
              stroke={m.visited ? "#5d8049" : "#b9b2a1"}
              strokeWidth={strokeWidth * 1.6}
              style={{ transition: "r 120ms ease" }}
            />
            {m.spotCount > 0 ? (
              <circle cx={m.x} cy={m.y} r={radius * 0.34} fill={m.visited ? "#f4f8ee" : "#8a8474"} />
            ) : null}
          </g>
        ))}

        {activeItem ? (
          <text
            x={activeItem.x}
            y={activeItem.y - radius * 1.9}
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
            {activeItem.name}
          </text>
        ) : null}
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-ink-faint">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-[#5d8049] bg-[#8fb36c]" />
          訪問済み
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-line-strong bg-card" />
          未訪問
        </span>
        <span>中の点はスポット登録あり</span>
      </div>
      <p className="mt-1 text-center text-[11px] leading-relaxed text-ink-faint">
        市区町村の代表地点を並べた配置図です。点が重なる場合は少しずらして表示しています。
      </p>
    </div>
  );
}
