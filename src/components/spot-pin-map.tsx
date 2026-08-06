"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SpotSummary } from "@/lib/data/spots";
import { projectPoint } from "@/lib/geo";

type PinSpot = SpotSummary & { latitude: number; longitude: number };

type MunicipalityShapeForPins = {
  d: string;
  viewBox: string;
  prefectureCode: string;
};

export function SpotPinMap({
  spots,
  municipalityName,
  shape,
}: {
  spots: SpotSummary[];
  municipalityName: string;
  shape: MunicipalityShapeForPins | null;
}) {
  const plottable = useMemo(
    () => spots.filter((spot): spot is PinSpot => spot.latitude !== null && spot.longitude !== null),
    [spots],
  );
  const [activeId, setActiveId] = useState(plottable[0]?.id ?? null);

  if (!shape) {
    return (
      <div className="rough-card px-4 py-8 text-center text-sm text-ink-soft">
        この市区町村の境界地図を表示できません。
      </div>
    );
  }

  const parts = shape.viewBox.split(" ").map(Number);
  const minX = parts[0] ?? 0;
  const minY = parts[1] ?? 0;
  const width = parts[2] ?? 1;
  const height = parts[3] ?? 1;
  const mapScale = Math.max(width, height, 0.001);
  const active = plottable.find((spot) => spot.id === activeId) ?? null;

  return (
    <section className="rough-card overflow-hidden">
      <div className="px-4 pt-4">
        <h2 className="text-base font-bold">{municipalityName}の訪問マップ</h2>
        <p className="mt-1 text-xs text-ink-soft">市全体の地図に、訪れたスポットを小さくプロットしています。</p>
      </div>

      <div className="mx-4 mt-3 overflow-hidden rounded-[20px] border border-line bg-[radial-gradient(circle_at_20%_18%,rgba(223,234,208,0.55),transparent_28%),linear-gradient(180deg,#fffdf7_0%,#f8f4ea_100%)] p-3">
        <svg
          viewBox={shape.viewBox}
          role="img"
          aria-label={`${municipalityName}の市域と訪問スポット`}
          className="block h-auto w-full drop-shadow-[0_8px_20px_rgba(117,132,91,0.08)]"
        >
          <path
            d={shape.d}
            fill="#e7efd9"
            stroke="#8daa75"
            strokeWidth={mapScale / 220}
            strokeLinejoin="round"
          />

          {plottable.map((spot) => {
            const [x, y] = projectPoint(spot.latitude, spot.longitude, "prefecture", shape.prefectureCode);
            const selected = activeId === spot.id;
            const radius = mapScale / (selected ? 58 : 72);

            return (
              <g
                key={spot.id}
                role="button"
                tabIndex={0}
                aria-label={`${spot.name}、${spot.visitCount}回訪問`}
                onClick={() => setActiveId(spot.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActiveId(spot.id);
                  }
                }}
                className="cursor-pointer outline-none"
              >
                <circle cx={x} cy={y} r={radius * 2.1} fill="transparent" />
                <circle
                  cx={x}
                  cy={y}
                  r={radius * 1.45}
                  fill="#fffdf7"
                  stroke={selected ? "#6f925b" : "#d8a1aa"}
                  strokeWidth={radius * 0.45}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={radius * 0.78}
                  fill={selected ? "#6f925b" : "#dc9ca8"}
                />
              </g>
            );
          })}

          {plottable.length === 0 ? (
            <text
              x={minX + width / 2}
              y={minY + height / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={mapScale / 24}
              fill="#8a8478"
            >
              位置情報付きの訪問スポットはまだありません
            </text>
          ) : null}
        </svg>
      </div>

      {active ? (
        <Link
          href={`/spots/${active.id}`}
          className="pressable mx-4 my-4 flex items-center gap-3 rounded-2xl border border-line bg-card p-3"
        >
          {active.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={active.photoUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-paper-deep text-xs text-ink-faint">
              写真なし
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{active.name}</span>
            <span className="mt-1 block text-xs text-ink-soft">
              {active.visitCount}回訪問{active.lastVisitedAt ? `・最終 ${active.lastVisitedAt}` : ""}
            </span>
          </span>
          <span className="text-sm text-leaf-deep">詳細</span>
        </Link>
      ) : null}
    </section>
  );
}
