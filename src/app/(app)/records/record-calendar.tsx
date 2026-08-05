"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";

export type CalendarEntry = {
  id: string;
  date: string;
  spotId: string;
  spotName: string;
  tripTitle: string;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function toKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function RecordCalendar({ entries }: { entries: CalendarEntry[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of entries) {
      const key = entry.date.slice(0, 10);
      const list = map.get(key);
      if (list) list.push(entry);
      else map.set(key, [entry]);
    }
    return map;
  }, [entries]);

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const shiftMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setSelected(null);
  };

  const selectedEntries = selected ? (byDate.get(selected) ?? []) : [];
  const monthCount = [...byDate.entries()].filter(([key]) =>
    key.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`),
  ).length;

  return (
    <div className="space-y-3">
      <div className="rough-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="前の月"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft active:bg-paper-deep"
          >
            <IconChevronLeft size={20} />
          </button>
          <p className="text-base font-bold tabular-nums">
            {year}年{month + 1}月
          </p>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="次の月"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft active:bg-paper-deep"
          >
            <IconChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((label, i) => (
            <div
              key={label}
              className={`pb-1 text-[11px] font-semibold ${
                i === 0 ? "text-[#b0707c]" : i === 6 ? "text-[#5f87a5]" : "text-ink-faint"
              }`}
            >
              {label}
            </div>
          ))}

          {cells.map((day, index) => {
            if (day === null) return <div key={`empty-${index}`} />;
            const key = toKey(year, month, day);
            const count = byDate.get(key)?.length ?? 0;
            const isSelected = selected === key;
            const isToday =
              today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(count > 0 ? (isSelected ? null : key) : null)}
                disabled={count === 0}
                aria-pressed={isSelected}
                className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm tabular-nums transition-colors ${
                  isSelected
                    ? "bg-leaf text-white"
                    : count > 0
                      ? "bg-leaf-soft text-leaf-deep"
                      : "text-ink-faint"
                } ${isToday && !isSelected ? "ring-1 ring-line-strong" : ""}`}
              >
                {day}
                {count > 0 ? (
                  <span className={`text-[9px] ${isSelected ? "text-white/90" : "text-leaf-deep"}`}>{count}件</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-center text-xs text-ink-faint">この月の記録: {monthCount}日</p>
      </div>

      {selected ? (
        <ul className="space-y-2">
          {selectedEntries.map((entry) => (
            <li key={entry.id}>
              <Link
                href={`/spots/${entry.spotId}`}
                className="rough-card flex items-center gap-3 px-4 py-3 transition-transform active:scale-[0.99]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{entry.spotName}</span>
                  <span className="text-xs text-ink-soft">{entry.tripTitle}</span>
                </span>
                <IconChevronRight size={18} className="shrink-0 text-ink-faint" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-xs text-ink-faint">記録のある日をタップすると内容が表示されます。</p>
      )}
    </div>
  );
}
