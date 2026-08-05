"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IconChevronRight, IconMapPin, IconNotebook, IconSearch } from "@/components/icons";
import { MunicipalityMap, type MapFrame, type MunicipalityPoint } from "@/components/municipality-map";
import { VisitedBadge } from "@/components/ui";

export type MunicipalityListItem = MunicipalityPoint;

type View = "map" | "list";

const STORAGE_KEY = "odekake:municipality-view";

/**
 * 市区町村を「地図表示」と「一覧表示」で切り替えて選ぶ。
 * どちらを選んだかは次に開いたときも引き継ぐ。
 */
export function MunicipalityBrowser({
  prefectureName,
  outline,
  viewBox,
  insets,
  items,
  hrefBase,
}: {
  prefectureName: string;
  outline: string;
  viewBox: string;
  insets: MapFrame[];
  items: MunicipalityListItem[];
  hrefBase: string;
}) {
  const [view, setView] = useState<View>("map");
  const [keyword, setKeyword] = useState("");
  const [visitedOnly, setVisitedOnly] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "map" || saved === "list") setView(saved);
  }, []);

  const changeView = (next: View) => {
    setView(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const filtered = useMemo(() => {
    const word = keyword.trim();
    return items.filter((m) => {
      if (visitedOnly && !m.visited) return false;
      if (word && !m.name.includes(word)) return false;
      return true;
    });
  }, [items, keyword, visitedOnly]);

  const visitedCount = items.filter((m) => m.visited).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="px-1 text-base font-bold">市区町村から選ぶ</h2>
        <div
          role="tablist"
          aria-label="表示の切り替え"
          className="flex shrink-0 rounded-full border border-line-strong bg-card p-0.5"
        >
          {(
            [
              { value: "map", label: "地図", icon: <IconMapPin size={15} /> },
              { value: "list", label: "一覧", icon: <IconNotebook size={15} /> },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={view === option.value}
              onClick={() => changeView(option.value)}
              className={`flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                view === option.value ? "bg-leaf-soft text-leaf-deep" : "text-ink-soft"
              }`}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {view === "map" ? (
        <div className="rough-card px-3 py-4">
          <p className="mb-2 text-center text-xs text-ink-soft">
            <span className="rough-pill bg-leaf-soft px-3 py-1 text-leaf-deep">
              点をタップすると市区町村の画面へ
            </span>
          </p>
          <MunicipalityMap
            prefectureName={prefectureName}
            outline={outline}
            viewBox={viewBox}
            insets={insets}
            items={items}
            hrefBase={hrefBase}
          />
          <p className="mt-2 text-center text-xs text-ink-soft">
            {items.length}件のうち <span className="font-bold text-ink tabular-nums">{visitedCount}</span> 件を訪問
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint">
                <IconSearch size={18} />
              </span>
              <input
                type="search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="市区町村を検索"
                aria-label="市区町村を検索"
                className="field pl-10"
              />
            </div>
            <button
              type="button"
              onClick={() => setVisitedOnly((v) => !v)}
              aria-pressed={visitedOnly}
              className={`rough-pill h-12 shrink-0 border px-4 text-sm font-semibold transition-colors ${
                visitedOnly ? "border-leaf bg-leaf-soft text-leaf-deep" : "border-line-strong bg-card text-ink-soft"
              }`}
            >
              訪問済み
            </button>
          </div>

          <p className="px-1 text-xs text-ink-faint">{filtered.length}件</p>

          {filtered.length === 0 ? (
            <p className="rough-card px-4 py-6 text-center text-sm text-ink-soft">
              該当する市区町村がありません。
            </p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((m) => (
                <li key={m.code}>
                  <Link
                    href={`${hrefBase}/${m.code}`}
                    className="rough-card flex items-center gap-3 px-4 py-3 transition-transform active:scale-[0.99]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{m.name}</span>
                      <span className="mt-1 flex items-center gap-1.5">
                        <VisitedBadge visited={m.visited} />
                        <span className="text-xs text-ink-faint">{m.spotCount}スポット</span>
                      </span>
                    </span>
                    <IconChevronRight size={18} className="shrink-0 text-ink-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
