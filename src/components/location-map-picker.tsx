"use client";

import { useRef } from "react";
import { getPrefecture, insetsOfPrefecture, projectPoint, shapeOf, unprojectPoint, viewBoxFor } from "@/lib/geo";

/**
 * 都道府県の地図をタップして場所を選ぶ。
 *
 * 地図データ（全都道府県の輪郭）を読み込むため、LocationPicker からは
 * 必要になったときだけ動的に読み込んでいる。
 */
export function LocationMapPicker({
  prefectureCode,
  latitude,
  longitude,
  onPick,
}: {
  prefectureCode: string;
  latitude: number | null;
  longitude: number | null;
  /** 選んだ位置と、画面の縮尺から求めた誤差の目安（メートル） */
  onPick: (lat: number, lng: number, accuracyMeters: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const prefecture = getPrefecture(prefectureCode);

  if (!prefecture) {
    return <p className="text-xs text-ink-soft">先に都道府県を選んでください。</p>;
  }

  const viewBox = viewBoxFor([prefecture], "regional");
  const numbers = viewBox.split(" ").map(Number) as [number, number, number, number];
  const scale = Math.max(numbers[2], numbers[3]);

  const pick = (event: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const [vx, vy, vw, vh] = numbers;
    const x = vx + ((event.clientX - rect.left) / rect.width) * vw;
    const y = vy + ((event.clientY - rect.top) / rect.height) * vh;
    const [lat, lng] = unprojectPoint(x, y, "regional", prefecture.code);
    // 画面上の1ピクセルが表す距離を、位置の誤差の目安として残す
    const metersPerPixel = (vw / rect.width) * 111_320;
    onPick(lat, lng, Math.round(metersPerPixel * 4));
  };

  const marker =
    latitude !== null && longitude !== null ? projectPoint(latitude, longitude, "regional", prefecture.code) : null;

  return (
    <div>
      <p className="mb-2 text-xs text-ink-soft">地図をタップすると、その位置を場所として記録します。</p>
      <svg
        ref={svgRef}
        viewBox={viewBox}
        role="application"
        aria-label={`${prefecture.name}の地図。タップして場所を選びます`}
        onClick={pick}
        className="h-auto w-full cursor-crosshair rounded-2xl bg-paper-deep"
      >
        {insetsOfPrefecture("regional", prefecture.code).map((inset) => (
          <rect
            key={inset.id}
            x={inset.frame[0]}
            y={inset.frame[1]}
            width={inset.frame[2]}
            height={inset.frame[3]}
            rx={scale / 40}
            fill="#fbf8f0"
            stroke="#c8c1b0"
            strokeWidth={scale / 260}
            strokeDasharray={`${scale / 64} ${scale / 80}`}
          />
        ))}
        <path
          d={shapeOf(prefecture, "regional").d}
          fill="#e7e3d5"
          stroke="#c0b9a8"
          strokeWidth={scale / 320}
          strokeLinejoin="round"
        />
        {marker ? (
          <g pointerEvents="none">
            <circle cx={marker[0]} cy={marker[1]} r={scale / 34} fill="#95505e" opacity={0.18} />
            <circle
              cx={marker[0]}
              cy={marker[1]}
              r={scale / 80}
              fill="#95505e"
              stroke="#fdfbf5"
              strokeWidth={scale / 300}
            />
          </g>
        ) : null}
      </svg>
      <p className="mt-1 text-center text-[11px] text-ink-faint">
        都道府県全体を表示しているため、番地までの精度はありません。
      </p>
    </div>
  );
}
