"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconChevronRight, IconSearch } from "@/components/icons";
import { VisitedBadge } from "@/components/ui";

export type MunicipalityListItem = {
  code: string;
  name: string;
  spotCount: number;
  visited: boolean;
};

export function MunicipalityList({
  items,
  hrefBase,
}: {
  items: MunicipalityListItem[];
  hrefBase: string;
}) {
  const [keyword, setKeyword] = useState("");
  const [visitedOnly, setVisitedOnly] = useState(false);

  const filtered = useMemo(() => {
    const word = keyword.trim();
    return items.filter((m) => {
      if (visitedOnly && !m.visited) return false;
      if (word && !m.name.includes(word)) return false;
      return true;
    });
  }, [items, keyword, visitedOnly]);

  return (
    <div className="space-y-3">
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
            visitedOnly
              ? "border-leaf bg-leaf-soft text-leaf-deep"
              : "border-line-strong bg-card text-ink-soft"
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
    </div>
  );
}
