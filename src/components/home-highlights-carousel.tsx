"use client";

import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { IconClock, IconFlag, IconMapPin, IconPaw, IconUser, IconUsers } from "@/components/icons";
import { formatRelativeTimeJa } from "@/lib/date";

const AUTO_ADVANCE_MS = 5000;
const SWIPE_THRESHOLD_PX = 40;

export type HomeStatsSlideData = {
  prefectures: number;
  prefectureTotal: number;
  municipalities: number;
  municipalityTotal: number;
  visits: number;
};

export type FriendActivitySlideData = {
  displayName: string;
  avatarUrl: string | null;
  spotName: string;
  registeredAt: string;
};

export type FriendStepsSlideData = {
  friendUserId: string;
  displayName: string;
  avatarUrl: string | null;
  steps: number;
}[];

type Slide =
  | { kind: "stats"; data: HomeStatsSlideData }
  | { kind: "activity"; data: FriendActivitySlideData }
  | { kind: "steps"; data: FriendStepsSlideData };

/**
 * 犬のメインカードの下にある実績エリアを、3種類の情報が自動で切り替わる
 * 1枠のカルーセルにする。
 *
 * - 自分の実績（都道府県・市区町村・訪問数）は常に表示する
 * - フレンドの最新おでかけ／歩数ランキングは、データがある時だけ差し込む
 * - 5秒ごとに自動で次のスライドへ。手動でスワイプした後も、しばらくすると自動再生に戻る
 */
export function HomeHighlightsCarousel({
  stats,
  activity,
  stepsRanking,
}: {
  stats: HomeStatsSlideData;
  activity: FriendActivitySlideData | null;
  stepsRanking: FriendStepsSlideData;
}) {
  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [{ kind: "stats", data: stats }];
    if (activity) list.push({ kind: "activity", data: activity });
    if (stepsRanking.length > 0) list.push({ kind: "steps", data: stepsRanking });
    return list;
  }, [stats, activity, stepsRanking]);

  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  useEffect(() => {
    if (slides.length <= 1) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, AUTO_ADVANCE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [slides.length, index]);

  const goTo = (next: number) => {
    setIndex(((next % slides.length) + slides.length) % slides.length);
  };

  const handleTouchStart = (event: TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: TouchEvent) => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    if (startX === null || slides.length <= 1) return;
    const endX = event.changedTouches[0]?.clientX ?? startX;
    const deltaX = endX - startX;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
    goTo(deltaX < 0 ? index + 1 : index - 1);
  };

  return (
    <section aria-label="実績とフレンドの様子" className="rough-card relative overflow-hidden px-4 pt-4 pb-3">
      <TapeCorner />
      <div
        className="relative overflow-hidden"
        style={{ minHeight: 178 }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, slideIndex) => (
            <div key={slideIndex} className="w-full shrink-0 grow-0 basis-full px-0.5">
              <SlideContent slide={slide} />
            </div>
          ))}
        </div>
      </div>

      {slides.length > 1 ? (
        <div className="mt-2 flex items-center justify-center gap-1.5" role="tablist" aria-label="表示切り替え">
          {slides.map((_, dotIndex) => (
            <button
              key={dotIndex}
              type="button"
              role="tab"
              aria-selected={dotIndex === index}
              aria-label={`${dotIndex + 1}枚目を表示`}
              onClick={() => goTo(dotIndex)}
              className="rounded-full transition-all"
              style={{
                width: dotIndex === index ? 14 : 6,
                height: 6,
                backgroundColor: dotIndex === index ? "var(--color-leaf)" : "var(--color-line-strong)",
              }}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function TapeCorner() {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-1.5 -left-2 h-6 w-16 rounded-[2px] bg-[#e6dcb8] opacity-70 shadow-sm"
      style={{ transform: "rotate(-8deg)" }}
    />
  );
}

function SlideContent({ slide }: { slide: Slide }) {
  if (slide.kind === "stats") return <StatsSlide data={slide.data} />;
  if (slide.kind === "activity") return <ActivitySlide data={slide.data} />;
  return <StepsSlide data={slide.data} />;
}

function StatsSlide({ data }: { data: HomeStatsSlideData }) {
  const items = [
    { icon: <IconMapPin size={18} />, value: data.prefectures, total: data.prefectureTotal, label: "都道府県", tone: "leaf" as const },
    { icon: <IconUsers size={18} />, value: data.municipalities, total: data.municipalityTotal, label: "市区町村など", tone: "sky" as const },
    { icon: <IconFlag size={18} />, value: data.visits, total: null, label: "訪問数", tone: "sun" as const },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 py-2">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col items-center gap-1.5 text-center">
          <span className={`flex h-10 w-10 items-center justify-center rounded-full ${toneBg(item.tone)}`}>
            <span className={toneText(item.tone)}>{item.icon}</span>
          </span>
          <span className="leading-none font-bold tabular-nums text-ink">
            <span className="text-lg">{item.value}</span>
            {item.total !== null ? <span className="text-xs text-ink-faint"> / {item.total}</span> : <span className="text-xs text-ink-faint">回</span>}
          </span>
          <span className="text-[11px] text-ink-soft">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function ActivitySlide({ data }: { data: FriendActivitySlideData }) {
  return (
    <div className="flex flex-col items-center gap-2 py-3 text-center">
      <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-paper-deep ring-2 ring-blossom-soft">
        {data.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <IconUser size={26} className="text-ink-faint" />
        )}
      </span>
      <span className="text-sm font-bold text-ink">{data.displayName}さんの新しいおでかけ</span>
      <span className="flex items-center gap-1 text-base font-bold text-leaf-deep">
        <IconMapPin size={16} />
        {data.spotName}
      </span>
      <span className="flex items-center gap-1 text-xs text-ink-faint">
        <IconClock size={13} />
        {formatRelativeTimeJa(data.registeredAt)}
      </span>
    </div>
  );
}

function StepsSlide({ data }: { data: FriendStepsSlideData }) {
  const RANK_TONE = ["sun", "sky", "apricot"] as const;

  return (
    <div className="flex flex-col gap-1.5 py-2">
      {data.slice(0, 3).map((friend, rankIndex) => (
        <div key={friend.friendUserId} className="flex items-center gap-2 rounded-xl bg-paper-deep/60 px-2.5 py-1.5">
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${toneBg(RANK_TONE[rankIndex] ?? "sky")} ${toneText(RANK_TONE[rankIndex] ?? "sky")}`}
          >
            {rankIndex + 1}
          </span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card">
            {friend.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={friend.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <IconUser size={16} className="text-ink-faint" />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{friend.displayName}</span>
          <span className="flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums text-ink">
            <IconPaw size={14} className="text-sun" />
            {friend.steps.toLocaleString("ja-JP")}
          </span>
        </div>
      ))}
    </div>
  );
}

function toneBg(tone: "leaf" | "sky" | "sun" | "apricot"): string {
  return {
    leaf: "bg-leaf-soft",
    sky: "bg-sky-soft",
    sun: "bg-sun-soft",
    apricot: "bg-apricot-soft",
  }[tone];
}

function toneText(tone: "leaf" | "sky" | "sun" | "apricot"): string {
  return {
    leaf: "text-leaf-deep",
    sky: "text-sky",
    sun: "text-[#8a6a1f]",
    apricot: "text-[#9a5a2a]",
  }[tone];
}
