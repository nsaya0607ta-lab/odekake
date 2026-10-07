"use client";

import { CARD_BLEED } from "@/lib/home-card-layout";
import { HOME_SKIN_ART, type HomeSkinTheme } from "@/lib/home-skins";
import Image from "next/image";
import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { IconClock, IconMapPin, IconPaw, IconUser } from "@/components/icons";
import { MarqueeText } from "@/components/marquee-text";
import { formatRelativeTimeJa } from "@/lib/date";

const AUTO_ADVANCE_MS = 5000;
const SWIPE_THRESHOLD_PX = 40;

/** public/home-highlights-frame.webp の実ピクセル比（1536×1024）。3スライド共通の紙の枠。 */
const CARD_RATIO = "1536 / 1024";
/** 紙の枠の絵（カードの絵がらで変わる）。3スライドとも同じ絵を使う */
const FrameSrc = createContext<string>(HOME_SKIN_ART.highlights.default);

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
  /** 都道府県名（「岐阜県」など）。分からなければ null */
  prefName?: string | null;
  registeredAt: string;
  /** タップしたときに行く先（自分 → 記録、フレンド → フレンドのページ）。無ければタップできない */
  href?: string | null;
  isSelf?: boolean;
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
  skin = "default",
}: {
  /** カードの絵がら（ショップで買ったもの） */
  skin?: HomeSkinTheme;
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
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swipeDirection = useRef<"horizontal" | "vertical" | null>(null);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  const stopAutoplay = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const startAutoplay = () => {
    stopAutoplay();
    if (slides.length <= 1) return;
    // 「視差効果を減らす」設定の人には、勝手に動かさない（点やスワイプで切りかえる）
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    timerRef.current = setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, AUTO_ADVANCE_MS);
  };

  useEffect(() => {
    startAutoplay();
    return stopAutoplay;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length, index]);

  const goTo = (next: number) => {
    setIndex(((next % slides.length) + slides.length) % slides.length);
  };

  // カード内の縦スクロール（歩数一覧など）を触っている間は、横スワイプ扱いにしない。
  // 指を離すまで自動送りも止めて、画面が勝手に動かないようにする。
  const handleTouchStart = (event: TouchEvent) => {
    stopAutoplay();
    const touch = event.touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    swipeDirection.current = null;
  };

  const handleTouchMove = (event: TouchEvent) => {
    const start = touchStart.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    if (swipeDirection.current === null) {
      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      swipeDirection.current = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
    }
  };

  const handleTouchEnd = (event: TouchEvent) => {
    const start = touchStart.current;
    const direction = swipeDirection.current;
    touchStart.current = null;
    swipeDirection.current = null;
    startAutoplay();

    if (!start || slides.length <= 1 || direction !== "horizontal") return;
    const endX = event.changedTouches[0]?.clientX ?? start.x;
    const deltaX = endX - start.x;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
    goTo(deltaX < 0 ? index + 1 : index - 1);
  };

  return (
    <FrameSrc.Provider value={HOME_SKIN_ART.highlights[skin]}>
    <section
      aria-label="実績とフレンドの様子"
      className="relative"
      style={{ marginLeft: -CARD_BLEED.left, marginRight: -CARD_BLEED.right }}
    >
      <div
        className="relative overflow-hidden"
        style={{ touchAction: "pan-y" }}
        // このカードの中の横スワイプはカードの切り替えに使う（背景をながめるスワイプにしない）
        data-gaze-swipe-ignore=""
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, slideIndex) => (
            // 左右の余白は入れない（絵の幅をほかのカードとそろえて、紙のふちを同じ位置にする）
            <div key={slideIndex} className="w-full shrink-0 grow-0 basis-full">
              <FrameCard>
                <SlideContent slide={slide} />
              </FrameCard>
            </div>
          ))}
        </div>
      </div>

      {slides.length > 1 ? (
        // 点は額縁の中（下のほう）に重ねる。カードの高さを変えないよう absolute にする（並べかえ時の間かく計算のため）
        <div
          className="absolute inset-x-0 z-10 flex items-center justify-center gap-1.5"
          style={{ bottom: 28 }}
          role="tablist"
          aria-label="表示切り替え"
        >
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
    </FrameSrc.Provider>
  );
}

/** 3スライド共通の紙の枠（テープ・花の水彩イラスト）を背景にして、中身を重ねる。 */
function FrameCard({ children }: { children: ReactNode }) {
  const src = useContext(FrameSrc);
  return (
    <div className="relative w-full" style={{ aspectRatio: CARD_RATIO }}>
      <Image
        src={src}
        alt=""
        aria-hidden="true"
        fill
        sizes="(max-width: 480px) 100vw, 480px"
        draggable={false}
        className="home-card-frame pointer-events-none select-none"
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

/** 0 から数字が増えていく（「視差効果を減らす」設定なら、すぐ最後の数に） */
function useCountUp(target: number, ms = 900) {
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || target <= 0) { setValue(target); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    setValue(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

/** アイコンのまわりの、達成率のリング */
function ProgressRing({ ratio, color }: { ratio: number; color: string }) {
  const r = 30, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 68 68" className="pointer-events-none absolute -inset-[6px] h-[calc(100%+12px)] w-[calc(100%+12px)] -rotate-90" aria-hidden="true">
      <circle cx="34" cy="34" r={r} fill="none" stroke="#EADFC8" strokeWidth="4" />
      <circle cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${Math.max(0.02, Math.min(1, ratio)) * c} ${c}`} className="transition-[stroke-dasharray] duration-1000 ease-out" />
    </svg>
  );
}

function StatValue({ value }: { value: number }) {
  return <>{useCountUp(value).toLocaleString("ja-JP")}</>;
}

function StatsSlide({ data }: { data: HomeStatsSlideData }) {
  const items = [
    { icon: STAT_ICON_SRC.prefectures, value: data.prefectures, total: data.prefectureTotal, label: "都道府県", href: "/map", ring: "#7FAE5F" },
    { icon: STAT_ICON_SRC.municipalities, value: data.municipalities, total: data.municipalityTotal, label: "市区町村など", href: "/map", ring: "#6C9BD2" },
    { icon: STAT_ICON_SRC.visits, value: data.visits, total: null, label: "訪問数", href: "/records", ring: "" },
  ];

  return (
    <div className="flex h-full w-full flex-col items-center">
      <span className="text-base font-bold tracking-[0.15em] text-ink-soft" style={{ marginTop: -31 }}>
        あなたの実績
      </span>
      <div className="grid w-full flex-1 grid-cols-3 items-center" style={{ marginTop: 15 }}>
        {items.map((item, itemIndex) => (
          <Link
            key={item.label}
            href={item.href}
            aria-label={`${item.label} ${item.value}${item.total !== null ? ` / ${item.total}` : "回"}。${item.href === "/map" ? "地図" : "記録"}を見る`}
            className={`flex flex-col items-center gap-2 px-0.5 py-1 text-center transition-opacity active:opacity-60 ${itemIndex > 0 ? "border-l border-line-strong/60" : ""}`}
          >
            <span className="relative block h-14 w-14">
              {item.total !== null ? <ProgressRing ratio={item.value / Math.max(1, item.total)} color={item.ring} /> : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.icon} alt="" aria-hidden="true" draggable={false} className="relative h-14 w-14 select-none" />
            </span>
            <span className="flex flex-col items-center gap-0.5 leading-none">
              <span className="text-2xl font-bold tabular-nums text-ink"><StatValue value={item.value} /></span>
              <span className="text-[11px] font-bold whitespace-nowrap tabular-nums text-ink-faint">
                {item.total !== null ? `/ ${item.total}` : "回"}
              </span>
            </span>
            <span className="text-xs font-bold text-ink-soft">{item.label}</span>
          </Link>
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
      <div
        className={`flex w-full flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain py-1 ${data.length <= 3 ? "justify-center" : ""}`}
        style={{ touchAction: "pan-y" }}
      >
        {data.map((item) => {
          const cls = `flex shrink-0 items-center gap-2 rounded-xl px-2.5 py-1.5 shadow-[0_1px_0_rgba(120,90,50,.08)] ${item.isSelf ? "bg-leaf-soft/70 ring-1 ring-leaf/40" : "bg-paper/70"}`;
          const inner = (
          <>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card">
              {item.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <IconUser size={16} className="text-ink-faint" />
              )}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{item.isSelf ? "あなた" : item.displayName}</span>
            <span className="flex min-w-0 shrink-0 flex-col items-end gap-0.5">
              <span className="flex min-w-0 items-center gap-1 text-sm font-bold text-leaf-deep">
                <IconMapPin size={14} className="shrink-0" />
                <MarqueeText text={item.spotName} className="max-w-[110px]" />
              </span>
              <span className="flex items-center gap-1 text-[10px] text-ink-faint">
                {item.prefName ? <span className="font-bold text-ink-soft">{item.prefName}</span> : null}
                <IconClock size={10} />
                {formatRelativeTimeJa(item.registeredAt)}
              </span>
            </span>
          </>
          );
          return item.href ? (
            <Link key={item.key} href={item.href} aria-label={`${item.isSelf ? "あなた" : item.displayName} ${item.prefName ?? ""}${item.spotName} ${formatRelativeTimeJa(item.registeredAt)}`} className={`${cls} active:scale-[0.98]`}>{inner}</Link>
          ) : (
            <div key={item.key} className={cls}>{inner}</div>
          );
        })}
        {data.length <= 2 ? <p className="mt-1 text-center text-[10px] font-bold text-ink-faint">この24時間に おでかけを記録した人</p> : null}
      </div>
    </div>
  );
}

function StepsSlide({ data }: { data: FriendStepsSlideData }) {
  const RANK_TONE = ["sun", "sky", "apricot"] as const;
  const top = Math.max(1, ...data.map((entry) => entry.steps));

  return (
    <div className="flex h-full w-full flex-col items-center">
      <span className="text-base font-bold tracking-[0.15em] text-ink-soft" style={{ marginTop: -31 }}>
        フレンドの歩数
      </span>
      <div
        className={`flex w-full flex-1 flex-col gap-1 overflow-y-auto overscroll-contain py-1 ${data.length <= 4 ? "justify-center" : ""}`}
        style={{ touchAction: "pan-y" }}
      >
        {data.map((entry) => {
          const row = (
            <>
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
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex min-w-0 items-center gap-1 text-sm font-bold text-ink">
                <span className="truncate">{entry.isSelf ? "あなた" : entry.displayName}</span>
                {entry.rank === 1 && entry.steps > 0 ? <span aria-label="1位" className="shrink-0 text-[12px] leading-none">👑</span> : null}
              </span>
              {/* いちばん歩いた人を100%にした、歩数のバー */}
              <span aria-hidden="true" className="block h-1 overflow-hidden rounded-full bg-[#EADFC8]">
                <span className={`block h-full rounded-full ${entry.isSelf ? "bg-leaf" : "bg-[#E8B84A]"}`} style={{ width: `${(entry.steps / top) * 100}%` }} />
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums text-ink">
              <IconPaw size={13} className="text-sun" />
              {entry.steps.toLocaleString("ja-JP")}
            </span>
            </>
          );
          const first = entry.rank === 1 && entry.steps > 0;
          const cls = `flex shrink-0 items-center gap-2 rounded-xl px-2.5 py-1 ${entry.isSelf ? "bg-leaf-soft/70 ring-1 ring-leaf/50" : first ? "bg-[linear-gradient(90deg,#FFF4D2,#FFFBEF)] ring-1 ring-[#E8C25A]/60" : "bg-paper/70"} ${first ? "home-shine" : ""}`;
          // フレンドの行は、タップでそのフレンドのページへ（自分の行はそのまま）
          return entry.isSelf ? (
            <div key={entry.id} className={cls}>{row}</div>
          ) : (
            <Link key={entry.id} href={`/mypage/friends/${entry.id}`} aria-label={`${entry.displayName}さん ${entry.rank}位 ${entry.steps.toLocaleString("ja-JP")}歩`} className={`${cls} active:scale-[0.98]`}>{row}</Link>
          );
        })}
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
