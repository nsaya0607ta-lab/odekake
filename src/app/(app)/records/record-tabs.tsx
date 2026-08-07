import Link from "next/link";

export type RecordTab = "timeline" | "trips" | "spots" | "calendar";

export function RecordTabs({
  tabs,
  current,
}: {
  tabs: Array<{ key: RecordTab; label: string }>;
  current: RecordTab;
}) {
  return (
    <div role="tablist" aria-label="記録の表示" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={`/records?tab=${tab.key}`}
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
  );
}
