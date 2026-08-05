"use client";

import Link from "next/link";

type Tab = "timeline" | "trips" | "spots" | "calendar";

const TYPE_FILTERS = [
  { key: "all", label: "すべて" },
  { key: "solo", label: "一人旅" },
  { key: "shared", label: "共有旅" },
] as const;

export function RecordTabs({
  tabs,
  current,
  tripType,
}: {
  tabs: Array<{ key: Tab; label: string }>;
  current: Tab;
  tripType: "all" | "solo" | "shared";
}) {
  const hrefFor = (tab: Tab, type: string) => {
    const params = new URLSearchParams({ tab });
    if (type !== "all") params.set("type", type);
    return `/records?${params.toString()}`;
  };

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="記録の表示" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={hrefFor(tab.key, tripType)}
            role="tab"
            aria-selected={current === tab.key}
            className={`rough-pill shrink-0 border px-4 py-2.5 text-sm font-semibold transition-colors ${
              current === tab.key
                ? "border-leaf bg-leaf-soft text-leaf-deep"
                : "border-line-strong bg-card text-ink-soft"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {current !== "spots" ? (
        <div className="flex gap-2">
          {TYPE_FILTERS.map((filter) => (
            <Link
              key={filter.key}
              href={hrefFor(current, filter.key)}
              aria-current={tripType === filter.key ? "true" : undefined}
              className={`rough-pill flex-1 border px-3 py-2 text-center text-xs font-semibold transition-colors ${
                tripType === filter.key
                  ? "border-sky bg-sky-soft text-[#42718f]"
                  : "border-line bg-card text-ink-faint"
              }`}
            >
              {filter.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
