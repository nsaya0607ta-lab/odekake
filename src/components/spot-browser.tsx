"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconHeart, IconMapPin, IconSliders } from "./icons";
import type { SpotSummary } from "@/lib/data/spots";
import { StarRating, formatDate } from "./ui";

type SortKey = "recent" | "rating" | "visits" | "name";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "最終訪問日が新しい順",
  rating: "評価が高い順",
  visits: "訪問回数が多い順",
  name: "スポット名順",
};

export function SpotBrowser({
  spots,
  categories,
  municipalityName,
}: {
  spots: SpotSummary[];
  categories: Array<{ id: number; name: string }>;
  municipalityName: string;
}) {
  const [view, setView] = useState<"map" | "list">("list");
  const [showFilters, setShowFilters] = useState(false);
  const [categoryId, setCategoryId] = useState<string>("all");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [minRating, setMinRating] = useState<string>("0");
  const [visitedFrom, setVisitedFrom] = useState("");
  const [visitedTo, setVisitedTo] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  const filtered = useMemo(() => {
    const min = Number(minRating);
    const result = spots.filter((spot) => {
      if (categoryId !== "all" && String(spot.categoryId) !== categoryId) return false;
      if (favoriteOnly && !spot.favorite) return false;
      if (min > 0 && (spot.averageRating ?? 0) < min) return false;
      if (visitedFrom && (!spot.lastVisitedAt || spot.lastVisitedAt < visitedFrom)) return false;
      if (visitedTo && (!spot.lastVisitedAt || spot.lastVisitedAt > visitedTo)) return false;
      return true;
    });

    result.sort((a, b) => {
      switch (sort) {
        case "rating":
          return (b.averageRating ?? -1) - (a.averageRating ?? -1);
        case "visits":
          return b.visitCount - a.visitCount;
        case "name":
          return a.name.localeCompare(b.name, "ja");
        default:
          return (b.lastVisitedAt ?? "").localeCompare(a.lastVisitedAt ?? "");
      }
    });

    return result;
  }, [spots, categoryId, favoriteOnly, minRating, visitedFrom, visitedTo, sort]);

  const activeFilterCount =
    (categoryId !== "all" ? 1 : 0) +
    (favoriteOnly ? 1 : 0) +
    (Number(minRating) > 0 ? 1 : 0) +
    (visitedFrom ? 1 : 0) +
    (visitedTo ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* 表示切り替え */}
      <div className="flex items-center gap-2">
        <div
          role="tablist"
          aria-label="表示方法"
          className="flex flex-1 rounded-full border border-line-strong bg-card p-1"
        >
          {(["map", "list"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
                view === key ? "bg-leaf-soft text-leaf-deep" : "text-ink-faint"
              }`}
            >
              {key === "map" ? "地図表示" : "一覧表示"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          className={`rough-pill flex h-12 shrink-0 items-center gap-1.5 border px-4 text-sm font-semibold ${
            activeFilterCount > 0
              ? "border-leaf bg-leaf-soft text-leaf-deep"
              : "border-line-strong bg-card text-ink-soft"
          }`}
        >
          <IconSliders size={18} />
          絞り込み
          {activeFilterCount > 0 ? <span className="tabular-nums">{activeFilterCount}</span> : null}
        </button>
      </div>

      {showFilters ? (
        <div className="rough-card space-y-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="filter-category">
                カテゴリー
              </label>
              <select
                id="filter-category"
                className="field"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="all">すべて</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="filter-rating">
                評価
              </label>
              <select
                id="filter-rating"
                className="field"
                value={minRating}
                onChange={(e) => setMinRating(e.target.value)}
              >
                <option value="0">すべて</option>
                <option value="3">★3以上</option>
                <option value="4">★4以上</option>
                <option value="4.5">★4.5以上</option>
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="filter-from">
                訪問日（から）
              </label>
              <input
                id="filter-from"
                type="date"
                className="field field-date-pair"
                value={visitedFrom}
                onChange={(e) => setVisitedFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="filter-to">
                訪問日（まで）
              </label>
              <input
                id="filter-to"
                type="date"
                className="field field-date-pair"
                value={visitedTo}
                onChange={(e) => setVisitedTo(e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={favoriteOnly}
              onChange={(e) => setFavoriteOnly(e.target.checked)}
              className="h-5 w-5 accent-[#dd9aa6]"
            />
            お気に入りだけを表示
          </label>

          <div>
            <label className="field-label" htmlFor="filter-sort">
              並べ替え
            </label>
            <select
              id="filter-sort"
              className="field"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn btn-quiet w-full"
            onClick={() => {
              setCategoryId("all");
              setFavoriteOnly(false);
              setMinRating("0");
              setVisitedFrom("");
              setVisitedTo("");
            }}
          >
            条件をクリア
          </button>
        </div>
      ) : null}

      <p className="px-1 text-xs text-ink-faint">
        {filtered.length}件を表示中（{SORT_LABELS[sort]}）
      </p>

      {filtered.length === 0 ? (
        <p className="rough-card px-4 py-8 text-center text-sm text-ink-soft">
          条件に合うスポットがありません。
        </p>
      ) : view === "map" ? (
        <SpotScatterMap spots={filtered} municipalityName={municipalityName} />
      ) : (
        <ul className="space-y-2">
          {filtered.map((spot) => (
            <li key={spot.id}>
              <SpotCard spot={spot} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SpotCard({ spot }: { spot: SpotSummary }) {
  return (
    <Link
      href={`/spots/${spot.id}`}
      className="rough-card flex gap-3 p-3 transition-transform active:scale-[0.99]"
    >
      <span className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-paper-deep">
        {spot.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={spot.photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-ink-faint">
            <IconMapPin size={26} />
          </span>
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1 truncate font-semibold">{spot.name}</span>
          {spot.favorite ? (
            <span className="shrink-0 text-blossom" aria-label="お気に入り">
              <IconHeart size={18} filled />
            </span>
          ) : null}
        </span>
        <span className="text-xs text-ink-soft">{spot.categoryName ?? "カテゴリー未設定"}</span>
        <StarRating value={spot.averageRating} />
        <span className="text-[11px] text-ink-faint">
          最終訪問: {formatDate(spot.lastVisitedAt)}・{spot.visitCount}回訪問
        </span>
      </span>
    </Link>
  );
}

/** 緯度経度を持つスポットを簡易的な散布図として表示する */
function SpotScatterMap({ spots, municipalityName }: { spots: SpotSummary[]; municipalityName: string }) {
  const located = spots.filter(
    (s): s is SpotSummary & { latitude: number; longitude: number } =>
      typeof s.latitude === "number" && typeof s.longitude === "number",
  );
  const missing = spots.filter((s) => typeof s.latitude !== "number" || typeof s.longitude !== "number");

  if (located.length === 0) {
    return (
      <div className="space-y-2">
        <p className="rough-card px-4 py-8 text-center text-sm leading-relaxed text-ink-soft">
          地図に表示できる位置情報がありません。
          <br />
          スポットの登録時に住所を選ぶと地図に表示されます。
        </p>
        <ul className="space-y-2">
          {missing.map((spot) => (
            <li key={spot.id}>
              <SpotCard spot={spot} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const lats = located.map((s) => s.latitude);
  const lngs = located.map((s) => s.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const padLat = Math.max((maxLat - minLat) * 0.2, 0.01);
  const padLng = Math.max((maxLng - minLng) * 0.2, 0.012);

  const toX = (lng: number) => ((lng - (minLng - padLng)) / (maxLng - minLng + padLng * 2)) * 100;
  const toY = (lat: number) => (1 - (lat - (minLat - padLat)) / (maxLat - minLat + padLat * 2)) * 100;

  return (
    <div className="space-y-2">
      <div className="rough-card relative aspect-[4/5] w-full overflow-hidden">
        {/* 方眼の下地 */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(160,150,130,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(160,150,130,0.12) 1px, transparent 1px)",
            backgroundSize: "12.5% 10%",
          }}
        />
        <p className="absolute top-3 left-3 rough-pill bg-paper/80 px-3 py-1 text-[11px] font-semibold text-ink-soft">
          {municipalityName}
        </p>

        {located.map((spot) => (
          <Link
            key={spot.id}
            href={`/spots/${spot.id}`}
            className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
            style={{ left: `${toX(spot.longitude)}%`, top: `${toY(spot.latitude)}%` }}
          >
            <span className="max-w-24 truncate rounded-lg bg-paper/90 px-1.5 py-0.5 text-[10px] font-semibold text-ink shadow-sm">
              {spot.name}
            </span>
            <span className={spot.favorite ? "text-blossom" : "text-leaf-deep"}>
              <IconMapPin size={26} />
            </span>
          </Link>
        ))}
      </div>

      {missing.length > 0 ? (
        <details className="rough-card px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-ink-soft">
            位置情報のないスポット（{missing.length}件）
          </summary>
          <ul className="mt-3 space-y-2">
            {missing.map((spot) => (
              <li key={spot.id}>
                <SpotCard spot={spot} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
