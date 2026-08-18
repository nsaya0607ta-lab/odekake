"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { IconClock, IconMapPin, IconPaw, IconUser } from "@/components/icons";
import { formatRelativeTimeJa } from "@/lib/date";

const AUTO_ADVANCE_MS = 5000;
const SWIPE_THRESHOLD_PX = 40;

/** public/home-stats.webp の実ピクセル比（1440×890）。絶対に変えない。 */
const CARD_RATIO = "1440 / 890";
const STATS_CARD_SRC = "/home-stats.webp";

/** 絵の中の焼き込み文字の位置に数を重ねる（home-stats-card.tsx の実測値を踏襲） */
const VALUE_BOTTOM = "40.75%";
const VALUE_RIGHT = {
  prefectures: "75.6%",
  municipalities: "51.3%",
  visits: "20.7%",
} as const;
const VALUE_FONT_SIZE = "min(calc(4.33vw - 1.39px), 20.8px)";
const VALUE_COLOR = "#3b260f";

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
 * - 自分の実績（都道府県・市区町村・訪問数）は常に表示する。これまでの
 *   home-stats.webp をそのまま使う
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
    <section aria-label="実績とフレンドの様子" className="relative top-2" style={{ marginLeft: "-3.15%", marginRight: "-2.245%" }}>
      <div className="relative overflow-hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, slideIndex) => (
            <div key={slideIndex} className="w-full shrink-0 grow-0 basis-full">
              <SlideContent slide={slide} />
            </div>
          ))}
        </div>
      </div>

      {slides.length > 1 ? (
        <div className="mt-1.5 flex items-center justify-center gap-1.5" role="tablist" aria-label="表示切り替え">
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

function SlideContent({ slide }: { slide: Slide }) {
  if (slide.kind === "stats") return <StatsSlide data={slide.data} />;
  if (slide.kind === "activity") return <PaperCard><ActivitySlide data={slide.data} /></PaperCard>;
  return (
    <PaperCard>
      <StepsSlide data={slide.data} />
    </PaperCard>
  );
}

/** 元絵（home-stats.webp）そのままの実績スライド。数だけを絵に重ねる */
function StatsSlide({ data }: { data: HomeStatsSlideData }) {
  return (
    <div className="relative w-full" style={{ aspectRatio: CARD_RATIO }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={STATS_CARD_SRC}
        alt=""
        aria-hidden="true"
        width={1440}
        height={890}
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full select-none"
      />
      <StatValue value={data.prefectures} right={VALUE_RIGHT.prefectures} />
      <StatValue value={data.municipalities} right={VALUE_RIGHT.municipalities} />
      <StatValue value={data.visits} right={VALUE_RIGHT.visits} />
      <p className="sr-only">
        都道府県 {data.prefectures} / {data.prefectureTotal}、市区町村など {data.municipalities} /{" "}
        {data.municipalityTotal}、訪問数 {data.visits} 回
      </p>
    </div>
  );
}

function StatValue({ value, right }: { value: number; right: string }) {
  return (
    <span
      aria-hidden="true"
      className="absolute leading-none whitespace-nowrap tabular-nums"
      style={{
        right,
        bottom: VALUE_BOTTOM,
        fontSize: VALUE_FONT_SIZE,
        color: VALUE_COLOR,
        transform: "translateY(0.175em)",
      }}
    >
      {value}
    </span>
  );
}

/**
 * フレンド系スライド用の紙カード。home-stats.webp と同じ縦横比の枠に、
 * 手帳の付箋のような紙とテープの装飾を CSS で再現する（画像は焼き込みなので流用できない）。
 */
function PaperCard({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-full overflow-hidden rounded-[22px] border border-line bg-card" style={{ aspectRatio: CARD_RATIO }}>
      <span
        aria-hidden="true"
        className="absolute -top-1.5 -left-2 h-6 w-16 rounded-[2px] bg-[#e6dcb8] opacity-70"
        style={{ transform: "rotate(-8deg)" }}
      />
      <div className="flex h-full w-full items-center justify-center px-5">{children}</div>
    </div>
  );
}

function ActivitySlide({ data }: { data: FriendActivitySlideData }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
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
    <div className="flex w-full flex-col gap-1.5">
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
