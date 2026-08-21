"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconCalendar, IconChat, IconHeart, IconPlus, IconUser } from "@/components/icons";
import { SnsViewToggleIcons } from "@/components/sns/sns-view-toggle-icons";
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
  loadedDays,
}: {
  photos: SnsFeedPhotoRow[];
  photoUrls: Map<string, string>;
  avatarUrls: Map<string, string>;
  baseHref: string;
  loadedDays: number;
}) {
  const today = useMemo(() => todayInTokyo(), []);
  const earliestLoadedDate = useMemo(
    () => recentDateWindow(Math.max(1, loadedDays))[0] ?? today,
    [loadedDays, today],
  );
  const days = useMemo(() => groupSnsFeedByDay(photos), [photos]);
  const photoDates = useMemo(() => new Set(days.map((day) => day.photoDate)), [days]);
  const [selectedDate, setSelectedDate] = useState(() => days[0]?.photoDate ?? today);

  // 直近10日分の窓に加えて、一番古い投稿日と（カレンダーで選んだ日を含む）
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
    if (date !== selectedDate && typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(6);
    }
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
      <div id="sns-toggle-bar" className="sticky top-14 z-20 -mx-4 border-y border-line bg-paper/92 px-4 py-2 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <SnsViewToggleIcons baseHref={baseHref} view="photos" />
          <div
            ref={chipRowRef}
            className="flex min-w-0 flex-1 snap-x snap-mandatory gap-1 overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
          >
            <label
              onClick={openDatePicker}
              aria-label="日付を選ぶ"
              className="tap-target relative flex h-11 w-10 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-card text-ink-faint shadow-sm active:bg-paper-deep"
            >
              <IconCalendar size={16} />
              <input
                ref={dateInputRef}
                type="date"
                value={selectedDate}
                min={earliestLoadedDate}
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
              const hasPhotos = photoDates.has(date);
              return (
                <button
                  key={date}
                  ref={(el) => {
                    if (el) chipRefs.current.set(date, el);
                    else chipRefs.current.delete(date);
                  }}
                  type="button"
                  onClick={() => selectDate(date)}
                  aria-pressed={active}
                  className={`sns-date-chip flex h-11 w-10 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-semibold transition-colors ${
                    active
                      ? "is-active"
                      : hasPhotos
                        ? "text-ink active:bg-paper-deep"
                        : "text-ink-faint active:bg-paper-deep"
                  }`}
                >
                  <span>{date === today ? "今日" : md}</span>
                  <span className="text-[9px]">{date === today ? md : weekday}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-sky">GROUP ALBUM</p>
          <h2 className="text-base font-bold">
            {selectedDate === today ? "今日の写真" : `${formatChip(selectedDate).md}の写真`}
          </h2>
        </div>
        <span className="rounded-full bg-card/80 px-2.5 py-1 text-[10px] font-bold text-ink-faint shadow-sm ring-1 ring-line">
          {selectedDay?.photos.length ?? 0}枚
        </span>
      </div>

      {!selectedDay || selectedDay.photos.length === 0 ? (
        <Link
          href={`${baseHref}/new`}
          data-haptic="light"
          aria-label={selectedDate === today ? "今日の最初の写真を追加" : "今日の写真を追加"}
          className="sns-empty-album pressable"
        >
          <span className="sns-empty-album-art" aria-hidden="true">
            <Image src="/illustrations/sns/mode-photo-v2.webp" alt="" width={62} height={62} sizes="62px" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">
              {selectedDate === today ? "今日の最初の一枚を追加" : "この日の写真はありません"}
            </span>
            <span className="mt-0.5 block text-[11px] text-ink-faint">
              {selectedDate === today
                ? "グループの思い出をアルバムに残そう"
                : "追加した写真は今日のアルバムに保存されます"}
            </span>
          </span>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky text-white">
            <IconPlus size={17} />
          </span>
        </Link>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 rounded-[1.4rem] bg-card/60 p-1.5 shadow-sm ring-1 ring-line">
          {selectedDay.photos.map((photo) => {
            const url = photoUrls.get(photo.storage_path);
            const avatarUrl = photo.profile_image_url ? avatarUrls.get(photo.profile_image_url) : null;
            return (
              <Link
                key={photo.id}
                href={`/sns/${photo.id}`}
                prefetch={false}
                className="sns-photo-tile pressable relative aspect-square overflow-hidden bg-paper-deep"
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : null}
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-1.5 pt-6 pb-1.5">
                  <span className="flex min-w-0 items-center gap-1">
                    <span className="h-5 w-5 shrink-0 overflow-hidden rounded-full border border-white/70 bg-paper-deep">
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-ink-faint">
                          <IconUser size={11} />
                        </span>
                      )}
                    </span>
                    <span className="truncate text-[10px] font-semibold text-white">{photo.display_name}</span>
                  </span>
                  {photo.reaction_count > 0 || photo.comment_count > 0 ? (
                    <span className="flex shrink-0 items-center gap-1 text-[9px] font-semibold text-white">
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
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
