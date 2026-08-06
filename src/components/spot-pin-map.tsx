"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SpotSummary } from "@/lib/data/spots";

type PinSpot = SpotSummary & { latitude: number; longitude: number };

function boundsFor(spots: PinSpot[]) {
  const lats = spots.map((spot) => spot.latitude);
  const lngs = spots.map((spot) => spot.longitude);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  let minLng = Math.min(...lngs);
  let maxLng = Math.max(...lngs);

  if (maxLat - minLat < 0.01) {
    minLat -= 0.005;
    maxLat += 0.005;
  }
  if (maxLng - minLng < 0.01) {
    minLng -= 0.005;
    maxLng += 0.005;
  }

  const latPad = (maxLat - minLat) * 0.12;
  const lngPad = (maxLng - minLng) * 0.12;
  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLng: minLng - lngPad,
    maxLng: maxLng + lngPad,
  };
}

export function SpotPinMap({ spots, municipalityName }: { spots: SpotSummary[]; municipalityName: string }) {
  const plottable = useMemo(
    () => spots.filter((spot): spot is PinSpot => spot.latitude !== null && spot.longitude !== null),
    [spots],
  );
  const [activeId, setActiveId] = useState(plottable[0]?.id ?? null);

  if (plottable.length === 0) {
    return (
      <div className="rough-card px-4 py-8 text-center text-sm text-ink-soft">
        この市区町村では、位置情報付きの訪問スポットがまだありません。
      </div>
    );
  }

  const bounds = boundsFor(plottable);
  const active = plottable.find((spot) => spot.id === activeId) ?? null;
  const toPercent = (spot: PinSpot) => ({
    left: `${((spot.longitude - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100}%`,
    top: `${(1 - (spot.latitude - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100}%`,
  });

  return (
    <section className="rough-card overflow-hidden">
      <div className="px-4 pt-4">
        <h2 className="text-base font-bold">{municipalityName}の訪問マップ</h2>
        <p className="mt-1 text-xs text-ink-soft">行った場所を小さなピンで表示しています。</p>
      </div>
      <div className="relative mx-4 mt-3 aspect-[4/3] overflow-hidden rounded-[20px] border border-line bg-[linear-gradient(135deg,#f8f3e8_0%,#fdfbf5_45%,#eaf1de_100%)]">
        <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_18%_22%,#dce8c8_0_8%,transparent_9%),radial-gradient(circle_at_72%_64%,#dce8c8_0_10%,transparent_11%),linear-gradient(160deg,transparent_0_46%,#ddd4c1_47%_49%,transparent_50%_100%)]" />
        {plottable.map((spot) => {
          const pos = toPercent(spot);
          const selected = activeId === spot.id;
          return (
            <button
              key={spot.id}
              type="button"
              onClick={() => setActiveId(spot.id)}
              aria-label={`${spot.name}、${spot.visitCount}回訪問`}
              className="pressable absolute -translate-x-1/2 -translate-y-full"
              style={pos}
            >
              <span
                className={`block rounded-full border-2 border-card shadow-sm transition-all ${selected ? "h-4 w-4 bg-leaf-deep" : "h-3 w-3 bg-blossom"}`}
              />
            </button>
          );
        })}
      </div>

      {active ? (
        <Link href={`/spots/${active.id}`} className="pressable mx-4 my-4 flex items-center gap-3 rounded-2xl border border-line bg-card p-3">
          {active.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={active.photoUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-paper-deep text-xs text-ink-faint">写真なし</span>
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
