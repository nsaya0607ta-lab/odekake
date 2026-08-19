"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { IconCalendar, IconChat, IconHeart, IconPlus, IconUser } from "@/components/icons";
import { groupSnsFeedByDay } from "@/lib/data/sns";
import type { SnsFeedPhotoRow } from "@/lib/supabase/types";

const CHIP_WINDOW_DAYS = 14;

function todayInTokyo(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
}

function formatDayLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00+09:00`);
  const today = new Date(`${todayInTokyo()}T00:00:00+09:00`);
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86_400_000);

  const formatted = new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Tokyo",
  }).format(date);

  if (diffDays === 0) return `今日・${formatted}`;
  if (diffDays === 1) return `昨日・${formatted}`;
  return formatted;
}

function formatChip(dateStr: string): { md: string; weekday: string } {
  const date = new Date(`${dateStr}T00:00:00+09:00`);
  return {
    md: new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", timeZone: "Asia/Tokyo" }).format(date),
    weekday: new Intl.DateTimeFormat("ja-JP", { weekday: "short", timeZone: "Asia/Tokyo" }).format(date),
  };
}

function recentDateWindow(days: number): string[] {
  const today = todayInTokyo();
  const anchor = new Date(`${today}T00:00:00+09:00`);
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(anchor.getTime() - i * 86_400_000);
    dates.push(new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(d));
  }
  return dates;
}

/** グループの写真を日付ごとに管理する表示。日付チップで選んだ1日分だけをグリッドで見せる */
export function SnsPhotoGrid({
  photos,
  photoUrls,
  avatarUrls,
  postHref,
}: {
  photos: SnsFeedPhotoRow[];
  photoUrls: Map<string, string>;
  avatarUrls: Map<string, string>;
  postHref: string;
}) {
  const today = useMemo(() => todayInTokyo(), []);
  const days = useMemo(() => groupSnsFeedByDay(photos), [photos]);
  const dateWindow = useMemo(() => {
    const window = recentDateWindow(CHIP_WINDOW_DAYS);
    const oldestWithPhotos = days.at(-1)?.photoDate;
    const windowStart = window[0];
    if (oldestWithPhotos && windowStart && oldestWithPhotos < windowStart) {
      return [oldestWithPhotos, ...window];
    }
    return window;
  }, [days]);

  const [selectedDate, setSelectedDate] = useState(() => days[0]?.photoDate ?? today);
  const chipRefs = useRef(new Map<string, HTMLButtonElement>());

  const selectedDay = days.find((d) => d.photoDate === selectedDate);

  function selectDate(date: string) {
    setSelectedDate(date);
    chipRefs.current.get(date)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  return (
    <div className="space-y-3 rounded-3xl border border-line bg-card p-3 shadow-sm">
      <div className="flex gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        <button
          type="button"
          onClick={() => selectDate(today)}
          aria-label="今日に移動"
          className="tap-target flex h-12 w-10 shrink-0 flex-col items-center justify-center rounded-xl text-ink-faint active:bg-paper-deep"
        >
          <IconCalendar size={17} />
        </button>
        {dateWindow.map((date) => {
          const { md, weekday } = formatChip(date);
          const active = date === selectedDate;
          const hasPhotos = days.some((d) => d.photoDate === date);
          return (
            <button
              key={date}
              ref={(el) => {
                if (el) chipRefs.current.set(date, el);
                else chipRefs.current.delete(date);
              }}
              type="button"
              onClick={() => selectDate(date)}
              className={`flex h-12 w-10 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-semibold transition-colors ${
                active
                  ? "bg-leaf text-white"
                  : hasPhotos
                    ? "text-ink active:bg-paper-deep"
                    : "text-ink-faint active:bg-paper-deep"
              }`}
            >
              <span>{md}</span>
              <span className="text-[10px]">{weekday}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
        <h2 className="text-sm font-bold text-ink-soft">{formatDayLabel(selectedDate)}</h2>
        <Link href={postHref} className="btn btn-primary shrink-0 px-4 py-1.5 text-xs">
          <IconPlus size={14} />
          写真を投稿
        </Link>
      </div>

      {!selectedDay || selectedDay.photos.length === 0 ? (
        <p className="px-1 py-6 text-center text-xs text-ink-faint">この日の写真はまだありません。</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {selectedDay.photos.map((photo) => {
            const url = photoUrls.get(photo.storage_path);
            const avatarUrl = photo.profile_image_url ? avatarUrls.get(photo.profile_image_url) : null;
            return (
              <Link
                key={photo.id}
                href={`/sns/${photo.id}`}
                className="relative aspect-square overflow-hidden rounded-2xl bg-paper-deep active:scale-[0.98]"
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="" className="h-full w-full object-cover" />
                ) : null}
                <span className="absolute top-1 left-1 flex max-w-[calc(100%-8px)] items-center gap-1 rounded-full bg-black/45 py-0.5 pr-2 pl-0.5">
                  <span className="h-5 w-5 shrink-0 overflow-hidden rounded-full border border-white/70 bg-paper-deep">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-ink-faint">
                        <IconUser size={11} />
                      </span>
                    )}
                  </span>
                  <span className="truncate text-[10px] font-semibold text-white">{photo.display_name}</span>
                </span>
                {photo.reaction_count > 0 || photo.comment_count > 0 ? (
                  <span className="absolute right-1 bottom-1 flex items-center gap-1.5 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {photo.reaction_count > 0 ? (
                      <span className="flex items-center gap-0.5">
                        <IconHeart size={10} filled />
                        {photo.reaction_count}
                      </span>
                    ) : null}
                    {photo.comment_count > 0 ? (
                      <span className="flex items-center gap-0.5">
                        <IconChat size={10} />
                        {photo.comment_count}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
