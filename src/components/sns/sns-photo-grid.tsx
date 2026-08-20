"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconCalendar, IconChat, IconHeart, IconUser } from "@/components/icons";
import { groupSnsFeedByDay } from "@/lib/data/sns";
import type { SnsFeedPhotoRow } from "@/lib/supabase/types";

const CHIP_WINDOW_DAYS = 10;

function todayInTokyo(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
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
  baseHref,
}: {
  photos: SnsFeedPhotoRow[];
  photoUrls: Map<string, string>;
  avatarUrls: Map<string, string>;
  baseHref: string;
}) {
  const today = useMemo(() => todayInTokyo(), []);
  const days = useMemo(() => groupSnsFeedByDay(photos), [photos]);
  const [selectedDate, setSelectedDate] = useState(() => days[0]?.photoDate ?? today);

  // 直近14日分の窓に加えて、一番古い投稿日と（カレンダーで任意に選んだ日を含む）
  // 選択中の日が窓の外にあれば足しておく
  const dateWindow = useMemo(() => {
    const dates = new Set(recentDateWindow(CHIP_WINDOW_DAYS));
    const oldestWithPhotos = days.at(-1)?.photoDate;
    if (oldestWithPhotos) dates.add(oldestWithPhotos);
    dates.add(selectedDate);
    return [...dates].sort();
  }, [days, selectedDate]);

  const chipRowRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef(new Map<string, HTMLButtonElement>());
  const dateInputRef = useRef<HTMLInputElement>(null);
  const didInitialScroll = useRef(false);

  const selectedDay = days.find((d) => d.photoDate === selectedDate);

  // 初回表示時は、日付の並びの始点が今日になるよう右端まで送っておく
  useEffect(() => {
    if (didInitialScroll.current) return;
    const row = chipRowRef.current;
    const todayChip = chipRefs.current.get(today);
    if (!row || !todayChip) return;
    didInitialScroll.current = true;
    row.scrollLeft = todayChip.offsetLeft + todayChip.offsetWidth - row.clientWidth;
  }, [today, dateWindow]);

  function selectDate(date: string) {
    setSelectedDate(date);
    requestAnimationFrame(() => {
      chipRefs.current.get(date)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  }

  function openDatePicker() {
    const input = dateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.click();
    }
  }

  return (
    <div className="space-y-3">
      <div className="sticky top-14 z-20 -mx-4 border-b border-line bg-paper/92 px-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center gap-1.5 py-1.5">
          <div className="flex shrink-0 items-center gap-0.5">
            <Link
              href={`${baseHref}?view=photos`}
              aria-label="写真"
              aria-current
              className="tap-target flex h-11 w-9 items-center justify-center rounded-xl bg-leaf-soft"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/sns/photo-toggle.png" alt="" className="h-8 w-8 object-contain" />
            </Link>
            <Link
              href={`${baseHref}?view=chat`}
              aria-label="チャット"
              className="tap-target flex h-11 w-9 items-center justify-center rounded-xl opacity-40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/sns/chat-toggle.png" alt="" className="h-8 w-8 object-contain" />
            </Link>
          </div>
          <span aria-hidden className="h-8 w-px shrink-0 bg-line" />
          <div
            ref={chipRowRef}
            className="flex w-[17.25rem] shrink-0 gap-1 overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
          >
            <label
              onClick={openDatePicker}
              aria-label="日付を選ぶ"
              className="tap-target relative flex h-11 w-9 shrink-0 flex-col items-center justify-center rounded-xl text-ink-faint active:bg-paper-deep"
            >
              <IconCalendar size={16} />
              <input
                ref={dateInputRef}
                type="date"
                value={selectedDate}
                max={today}
                onChange={(e) => {
                  if (e.target.value) selectDate(e.target.value);
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
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
                  className={`flex h-11 w-9 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-semibold transition-colors ${
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
        </div>
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
