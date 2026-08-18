"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { IconMapPin, IconPaw, IconUser } from "@/components/icons";

const AUTO_ADVANCE_MS = 5000;
const SWIPE_THRESHOLD_PX = 40;

/** public/home-highlights-frame.webp の実ピクセル比（1536×1024）。3スライド共通の紙の枠。 */
const CARD_RATIO = "1536 / 1024";
const FRAME_SRC = "/home-highlights-frame.webp";

const STAT_ICON_SRC = {
  prefectures: "/icon-prefectures.webp",
  municipalities: "/icon-municipalities.webp",
  visits: "/icon-visits.webp",
} as const;

export type HomeStatsSlideData = {
  prefectures: number;
  prefectureTotal: number;
  municipalities: number;
  municipalityTotal: number;
  visits: number;
};

export type FriendActivitySlideData = {
  key: string;
  displayName: string;
  avatarUrl: string | null;
  spotName: string;
  registeredAt: string;
}[];

export type FriendStepsSlideData = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  steps: number;
  rank: number;
  isSelf: boolean;
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
 * - 3スライドとも同じ紙の枠画像（home-highlights-frame.webp）を土台にして、
 *   中身だけを差し替えることで兄弟カードに見えるようにする
 * - 5秒ごとに自動で次のスライドへ。手動でスワイプした後も、しばらくすると自動再生に戻る
 */
export function HomeHighlightsCarousel({
  stats,
  activity,
  stepsRanking,
}: {
  stats: HomeStatsSlideData;
  activity: FriendActivitySlideData;
  stepsRanking: FriendStepsSlideData;
}) {
  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [{ kind: "stats", data: stats }];
    if (activity.length > 0) list.push({ kind: "activity", data: activity });
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
    <section
      aria-label="実績とフレンドの様子"
      className="relative top-2"
      style={{ marginLeft: -9, marginRight: -12 }}
    >
      <div className="relative overflow-hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, slideIndex) => (
            <div key={slideIndex} className="w-full shrink-0 grow-0 basis-full px-0.5">
              <FrameCard>
                <SlideContent slide={slide} />
              </FrameCard>
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

/** 3スライド共通の紙の枠（テープ・花の水彩イラスト）を背景にして、中身を重ねる。 */
function FrameCard({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-full" style={{ aspectRatio: CARD_RATIO }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={FRAME_SRC}
        alt=""
        aria-hidden="true"
        width={1536}
        height={1024}
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full select-none"
      />
      <div className="absolute inset-0 flex items-center justify-center px-[11%] py-[13%]">{children}</div>
    </div>
  );
}

function SlideContent({ slide }: { slide: Slide }) {
  if (slide.kind === "stats") return <StatsSlide data={slide.data} />;
  if (slide.kind === "activity") return <ActivitySlide data={slide.data} />;
  return <StepsSlide data={slide.data} />;
}

function StatsSlide({ data }: { data: HomeStatsSlideData }) {
  const items = [
    { icon: STAT_ICON_SRC.prefectures, value: data.prefectures, total: data.prefectureTotal, label: "都道府県" },
    { icon: STAT_ICON_SRC.municipalities, value: data.municipalities, total: data.municipalityTotal, label: "市区町村など" },
    { icon: STAT_ICON_SRC.visits, value: data.visits, total: null, label: "訪問数" },
  ];

  return (
    <div className="flex h-full w-full flex-col items-center">
      <span className="text-base font-bold tracking-[0.15em] text-ink-soft" style={{ marginTop: -31 }}>
        あなたの実績
      </span>
      <div className="grid w-full flex-1 grid-cols-3 items-center" style={{ marginTop: 15 }}>
        {items.map((item, itemIndex) => (
          <div
            key={item.label}
            className={`flex flex-col items-center gap-2 px-0.5 text-center ${itemIndex > 0 ? "border-l border-line-strong/60" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.icon} alt="" aria-hidden="true" draggable={false} className="h-14 w-14 select-none" />
            <span className="flex flex-col items-center gap-0.5 leading-none">
              <span className="text-2xl font-bold tabular-nums text-ink">{item.value}</span>
              <span className="text-[11px] font-bold whitespace-nowrap tabular-nums text-ink-faint">
                {item.total !== null ? `/ ${item.total}` : "回"}
              </span>
            </span>
            <span className="text-xs font-bold text-ink-soft">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivitySlide({ data }: { data: FriendActivitySlideData }) {
  return (
    <div className="flex h-full w-full flex-col items-center">
      <span className="text-base font-bold tracking-[0.15em] text-ink-soft" style={{ marginTop: -31 }}>
        みんなのおでかけ
      </span>
      <div className="flex w-full flex-1 flex-col justify-center gap-1.5">
        {data.slice(0, 3).map((item) => (
          <div key={item.key} className="flex items-center gap-2 rounded-xl bg-paper/70 px-2.5 py-1.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card">
              {item.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <IconUser size={16} className="text-ink-faint" />
              )}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{item.displayName}</span>
            <span className="flex min-w-0 shrink-0 items-center gap-1 text-sm font-bold text-leaf-deep">
              <IconMapPin size={14} className="shrink-0" />
              <span className="max-w-[120px] truncate">{item.spotName}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepsSlide({ data }: { data: FriendStepsSlideData }) {
  const RANK_TONE = ["sun", "sky", "apricot"] as const;
  const top = data.filter((entry) => entry.rank <= 5);
  const selfOutsideTop = data.find((entry) => entry.isSelf && entry.rank > 5);
  const rows = selfOutsideTop ? [...top, selfOutsideTop] : top;

  return (
    <div className="flex h-full w-full flex-col items-center">
      <span className="text-base font-bold tracking-[0.15em] text-ink-soft" style={{ marginTop: -31 }}>
        フレンドの歩数
      </span>
      <div className="flex w-full flex-1 flex-col justify-center gap-1">
        {rows.map((entry, rowIndex) => (
          <div key={entry.id}>
            {selfOutsideTop && rowIndex === rows.length - 1 ? (
              <div className="my-0.5 flex items-center justify-center text-[10px] text-ink-faint">…</div>
            ) : null}
            <div
              className={`flex items-center gap-2 rounded-xl px-2.5 py-1 ${entry.isSelf ? "bg-leaf-soft/70 ring-1 ring-leaf/50" : "bg-paper/70"}`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  entry.rank <= 3 && RANK_TONE[entry.rank - 1]
                    ? `${toneBg(RANK_TONE[entry.rank - 1]!)} ${toneText(RANK_TONE[entry.rank - 1]!)}`
                    : "bg-paper-deep text-ink-soft"
                }`}
              >
                {entry.rank}
              </span>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card">
                {entry.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entry.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <IconUser size={14} className="text-ink-faint" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
                {entry.isSelf ? "あなた" : entry.displayName}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums text-ink">
                <IconPaw size={13} className="text-sun" />
                {entry.steps.toLocaleString("ja-JP")}
              </span>
            </div>
          </div>
        ))}
      </div>
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
