"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconChevronRight, IconSearch } from "@/components/icons";
import { MunicipalityMap, type MapFrame, type MunicipalityArea } from "@/components/municipality-map";
import { VisitedBadge } from "@/components/ui";

export type MunicipalityListItem = MunicipalityArea;

/**
 * 市区町村を選ぶ画面。
 *
 * 上に境界付きの地図、下に検索と一覧を置いたハイブリッド構成にしている。
 * 市区町村の多い都道府県では地図だけでは選びにくく、
 * 逆に一覧だけでは位置関係が分からないため、両方を同時に見せる。
 * 地図をタップしても一覧を押しても、同じ市区町村の画面へ移動する。
 */
export function MunicipalityBrowser({
  prefectureName,
  viewBox,
  insets,
  items,
  hrefBase,
  hasMap,
}: {
  prefectureName: string;
  viewBox: string;
  insets: MapFrame[];
  items: MunicipalityListItem[];
  hrefBase: string;
  /** 境界データがある都道府県かどうか */
  hasMap: boolean;
}) {
  const [keyword, setKeyword] = useState("");
  const [visitedOnly, setVisitedOnly] = useState(false);

  const filtered = useMemo(() => {
    const word = keyword.trim();
    return items.filter((m) => {
      if (visitedOnly && m.level === 0) return false;
      if (word && !m.name.includes(word)) return false;
      return true;
    });
  }, [items, keyword, visitedOnly]);

  const visitedCount = items.filter((m) => m.level > 0).length;

  return (
    <div className="space-y-4">
      {hasMap ? (
        <section>
          <h2 className="mb-2 px-1 text-base font-bold">地図から選ぶ</h2>
          <div className="rough-card px-3 py-4">
            <p className="mb-2 text-center text-xs text-ink-soft">
              <span className="rough-pill bg-leaf-soft px-3 py-1 text-leaf-deep">
                市区町村をタップすると詳細へ
              </span>
            </p>
            <MunicipalityMap
              prefectureName={prefectureName}
              viewBox={viewBox}
              insets={insets}
              areas={items}
              hrefBase={hrefBase}
            />
            <p className="mt-2 text-center text-xs text-ink-soft">
              {items.length}件のうち <span className="font-bold text-ink tabular-nums">{visitedCount}</span> 件を訪問
            </p>
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 px-1 text-base font-bold">一覧から選ぶ</h2>

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

        <p className="mt-2 px-1 text-xs text-ink-faint">{filtered.length}件</p>

        {filtered.length === 0 ? (
          <p className="rough-card mt-2 px-4 py-6 text-center text-sm text-ink-soft">
            該当する市区町村がありません。
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {filtered.map((m) => (
              <li key={m.code}>
                <Link
                  href={`${hrefBase}/${m.code}`}
                  className="rough-card flex items-center gap-3 px-4 py-3 transition-transform active:scale-[0.99]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{m.name}</span>
                    <span className="mt-1 flex items-center gap-1.5">
                      <VisitedBadge visited={m.level > 0} />
                      <span className="text-xs text-ink-faint">
                        {m.spotCount}スポット
                        {m.visitCount > 0 ? `・${m.visitCount}回訪問` : ""}
                      </span>
                    </span>
                  </span>
                  <IconChevronRight size={18} className="shrink-0 text-ink-faint" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
