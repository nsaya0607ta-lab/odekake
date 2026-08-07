"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconHeart, IconMapPin, IconSearch, IconSliders } from "./icons";
import type { SpotSummary } from "@/lib/data/spots";
import { matchesSearch } from "@/lib/text";
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
  search,
}: {
  spots: SpotSummary[];
  categories: Array<{ id: number; name: string }>;
  /**
   * 検索をサーバー側で行う場合の設定。
   * 一覧をページ送りしている画面では、読み込み済みの分だけを絞ると
   * 次のページのスポットが見つからないため、URL 経由で全件から探す。
   */
  search?: { action: string; keyword: string; hiddenFields?: Record<string, string> };
}) {
  const [showFilters, setShowFilters] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [minRating, setMinRating] = useState<string>("0");
  const [visitedFrom, setVisitedFrom] = useState("");
  const [visitedTo, setVisitedTo] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  const filtered = useMemo(() => {
    const min = Number(minRating);
    // サーバー側で検索済みのときは、ここで重ねて絞らない
    const needle = search ? "" : keyword.trim();
    const result = spots.filter((spot) => {
      if (needle && !matchesSearch(needle, spot.name, spot.address)) return false;
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
  }, [spots, search, keyword, categoryId, favoriteOnly, minRating, visitedFrom, visitedTo, sort]);

  const localFilterCount =
    (categoryId !== "all" ? 1 : 0) +
    (favoriteOnly ? 1 : 0) +
    (Number(minRating) > 0 ? 1 : 0) +
    (visitedFrom ? 1 : 0) +
    (visitedTo ? 1 : 0);

  const activeFilterCount = localFilterCount + ((search ? search.keyword : keyword).trim() ? 1 : 0);
  // 絞り込みは読み込み済みの分にしか効かない。件数の言い方をそれに合わせる
  const localFilterApplied = localFilterCount > 0;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {search ? (
          <form method="GET" action={search.action} className="relative min-w-0 flex-1">
            {Object.entries(search.hiddenFields ?? {}).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint">
              <IconSearch size={18} />
            </span>
            <input
              type="search"
              name="q"
              defaultValue={search.keyword}
              placeholder="スポット名・住所で探す"
              aria-label="スポットを検索"
              enterKeyHint="search"
              className="field pl-10"
            />
          </form>
        ) : (
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint">
              <IconSearch size={18} />
            </span>
            <input
              type="search"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="スポット名・住所で探す"
              aria-label="スポットを検索"
              className="field pl-10"
            />
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          className={`rough-pill flex h-11 shrink-0 items-center gap-1.5 border px-4 text-sm font-semibold ${
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
              setKeyword("");
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
        {localFilterApplied
          ? `読み込み済みの${spots.length}件のうち${filtered.length}件`
          : `${filtered.length}件を表示中`}
        （{SORT_LABELS[sort]}）
      </p>

      {localFilterApplied && search ? (
        <p className="px-1 text-xs text-ink-faint">
          カテゴリー・評価・訪問日の絞り込みは、いま読み込んでいる分にだけかかります。
          もっと見るで読み込むと対象が増えます。
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <p className="rough-card px-4 py-8 text-center text-sm text-ink-soft">
          条件に合うスポットがありません。
        </p>
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
