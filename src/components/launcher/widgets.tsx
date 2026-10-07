"use client";

/**
 * アプリの画面のいちばん上にならべるウィジェット（iPhone の小さいウィジェットと同じ 2×2 マスの大きさ）。
 * - 時計と天気：日付・いまの時刻・天気（マイルームで選んだ場所）。地の色は空の色（晴れの昼は青、夜は紺、雨は灰色…）
 * - 歩数：今日の歩数と、1万歩までの輪
 * タップで開き、長押しは画面の長押しと同じメニュー。編集中はほかのアイコンといっしょにぷるぷるする。
 */
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { HomeWeather } from "@/components/home-weather";
import { placeLabel, type SkyPhase } from "@/lib/home-weather";
import type { WeatherKind } from "@/lib/room/weather";
import styles from "./launcher.module.css";

/** 時刻。分のかわり目にそろえて新しくする */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(() => {
        setNow(new Date());
        schedule();
      }, 60_000 - (Date.now() % 60_000) + 40);
    };
    schedule();
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(new Date());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return now;
}

/** タップと長押しを見分ける（指が動いたらどちらもしない） */
function usePress(onTap: () => void, onLong: (x: number, y: number) => void, disabled: boolean) {
  const state = useRef<{ x: number; y: number; timer: number; long: boolean; moved: boolean } | null>(null);
  const [down, setDown] = useState(false);
  const clear = () => {
    if (state.current) window.clearTimeout(state.current.timer);
    state.current = null;
    setDown(false);
  };
  return {
    down,
    handlers: {
      onPointerDown: (e: ReactPointerEvent) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        if (disabled) return;
        const x = e.clientX, y = e.clientY;
        const timer = window.setTimeout(() => {
          if (!state.current || state.current.moved) return;
          state.current.long = true;
          setDown(false);
          onLong(x, y);
        }, 480);
        state.current = { x, y, timer, long: false, moved: false };
        setDown(true);
      },
      onPointerMove: (e: ReactPointerEvent) => {
        const s = state.current;
        if (s && !s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) {
          s.moved = true;
          window.clearTimeout(s.timer);
          setDown(false);
        }
      },
      onPointerUp: () => {
        const s = state.current;
        clear();
        if (s && !s.long && !s.moved) onTap();
      },
      onPointerCancel: clear,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
  };
}

function WidgetShell({ className, style, label, editing, onTap, onLong, children }: {
  className?: string;
  style: CSSProperties;
  label: string;
  editing: boolean;
  onTap: () => void;
  onLong: (x: number, y: number) => void;
  children: ReactNode;
}) {
  const { down, handlers } = usePress(onTap, onLong, editing);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      className={`${styles.widget} ${className ?? ""}`}
      style={style}
      data-down={down ? "true" : undefined}
      data-editing={editing ? "true" : undefined}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        if (!editing) onTap();
      }}
      {...handlers}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ 天気のしるし */

type Glyph = "sun" | "moon" | "sunCloud" | "moonCloud" | "cloud" | "rain" | "thunder" | "snow" | "fog";

const glyphOf = (kind: WeatherKind, night: boolean): Glyph => {
  if (kind === "clear") return night ? "moon" : "sun";
  if (kind === "partly") return night ? "moonCloud" : "sunCloud";
  if (kind === "drizzle" || kind === "rain") return "rain";
  if (kind === "thunder" || kind === "snow" || kind === "fog") return kind;
  return "cloud";
};

const CLOUD = "M7.2 19.2h10.3a4.1 4.1 0 0 0 .5-8.2 5.6 5.6 0 0 0-10.7-1.3A4.8 4.8 0 0 0 7.2 19.2Z";

/** iPhone の天気の絵文字のような、色つきの小さな天気のしるし */
export function WeatherGlyph({ kind, night, size = 26 }: { kind: WeatherKind; night: boolean; size?: number }) {
  const g = glyphOf(kind, night);
  const sun = (cx: number, cy: number, r: number) => (
    <g>
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={cx - 0.75} y={cy - r - 3.4} width="1.5" height="2.4" rx="0.75" fill="#ffd23f" transform={`rotate(${i * 45} ${cx} ${cy})`} />
      ))}
      <circle cx={cx} cy={cy} r={r} fill="#ffd23f" />
    </g>
  );
  const moon = (cx: number, cy: number, r: number) => (
    <path d={`M${cx + r * 0.35} ${cy - r} a${r} ${r} 0 1 0 ${r * 0.65} ${r * 1.55} a${r * 0.85} ${r * 0.85} 0 0 1 -${r * 0.65} -${r * 1.55}Z`} fill="#fff2a8" />
  );
  const cloud = (dy = 0, fill = "#ffffff") => <path d={CLOUD} fill={fill} transform={`translate(0 ${dy})`} />;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={styles.glyph}>
      {g === "sun" ? sun(12, 12, 4.6) : null}
      {g === "moon" ? moon(11, 12, 6.4) : null}
      {g === "sunCloud" ? <>{sun(15.5, 8.5, 3.6)}{cloud(1.5)}</> : null}
      {g === "moonCloud" ? <>{moon(15, 8, 4.4)}{cloud(1.5, "#e9eef7")}</> : null}
      {g === "cloud" ? cloud(-1) : null}
      {g === "rain" ? (
        <>
          {cloud(-4)}
          {[8, 12, 16].map((x, i) => <path key={x} d={`M${x} ${17 + (i % 2)} l-1.1 3`} stroke="#5ec2ff" strokeWidth="1.8" strokeLinecap="round" />)}
        </>
      ) : null}
      {g === "thunder" ? (
        <>
          {cloud(-4, "#e6e9f2")}
          <path d="M12.6 15.2 9.8 19.6h2.4l-1 3.2 3.6-5h-2.4l1.2-2.6Z" fill="#ffd23f" />
        </>
      ) : null}
      {g === "snow" ? (
        <>
          {cloud(-4)}
          {[8, 12, 16].map((x, i) => <circle key={x} cx={x} cy={18.4 + (i % 2) * 1.6} r="1.25" fill="#ffffff" />)}
        </>
      ) : null}
      {g === "fog" ? (
        <>
          {cloud(-4, "#f1f3f6")}
          {[17.4, 20.4].map((y, i) => <rect key={y} x={4 + i * 3} y={y} width={15 - i * 4} height="1.7" rx="0.85" fill="#ffffff" opacity=".9" />)}
        </>
      ) : null}
    </svg>
  );
}

/** ウィジェットの地の色（iPhone の天気ウィジェットと同じく、空の色にする） */
function skyOf(kind: WeatherKind | null, phase: SkyPhase): string {
  const night = phase === "night";
  const clearish = kind === null || kind === "clear" || kind === "partly";
  if (night) return clearish ? "linear-gradient(180deg,#0d1938 0%,#253a73 100%)" : "linear-gradient(180deg,#1e2636 0%,#414d63 100%)";
  if (phase === "evening" && clearish) return "linear-gradient(180deg,#4c5aa6 0%,#b07494 62%,#ec9a6a 100%)";
  switch (kind) {
    case "partly": return "linear-gradient(180deg,#3f7ccc 0%,#7faad9 100%)";
    case "cloudy": return "linear-gradient(180deg,#687b92 0%,#97a6b8 100%)";
    case "fog": return "linear-gradient(180deg,#7d8b9c 0%,#a9b3bf 100%)";
    case "drizzle":
    case "rain": return "linear-gradient(180deg,#46576f 0%,#6f8098 100%)";
    case "thunder": return "linear-gradient(180deg,#2c3249 0%,#525a76 100%)";
    case "snow": return "linear-gradient(180deg,#7489a8 0%,#aebcd0 100%)";
    default: return "linear-gradient(180deg,#2a78e4 0%,#5ea6f1 100%)";
  }
}

/** 天気が取れないあいだの時間帯（端末の時計から） */
const phaseByHour = (d: Date): SkyPhase => {
  const h = d.getHours();
  return h < 5 || h >= 18 ? "night" : h < 10 ? "morning" : h >= 16 ? "evening" : "day";
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** ウィジェットはせまいので、天気の名前は短く（iPhone の天気と同じ言い方） */
const SHORT_LABEL: Record<WeatherKind, string> = {
  clear: "晴れ",
  partly: "ほぼ晴れ",
  cloudy: "くもり",
  fog: "きり",
  drizzle: "小雨",
  rain: "雨",
  snow: "雪",
  thunder: "雷雨",
};

export function ClockWeatherWidget({ hw, style, editing, onOpen, onLong }: {
  hw: HomeWeather | null;
  style: CSSProperties;
  editing: boolean;
  onOpen: () => void;
  onLong: (x: number, y: number) => void;
}) {
  const now = useClock();
  const w = hw?.weather ?? null;
  const phase = hw?.phase ?? phaseByHour(now);
  const night = phase === "night";
  const label = w ? SHORT_LABEL[w.kind] : null;
  const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
  const date = `${now.getMonth() + 1}月${now.getDate()}日（${WEEKDAYS[now.getDay()]}）`;
  const temp = w?.temp != null ? Math.round(w.temp) : null;
  return (
    <WidgetShell
      className={styles.weatherWidget}
      style={{ ...style, background: skyOf(w?.kind ?? null, phase) }}
      label={`${date} ${time}${w && label ? `、${placeLabel(hw!.place)}は${label}${temp != null ? ` ${temp}度` : ""}` : ""}`}
      editing={editing}
      onTap={onOpen}
      onLong={onLong}
    >
      {/* 夜は小さな星、昼は上からのやわらかい光 */}
      <span className={styles.widgetSheen} data-night={night ? "true" : undefined} aria-hidden="true" />
      <span className={styles.wRow}>
        <span className={styles.wDate}>{date}</span>
      </span>
      <span className={styles.wTime}>{time}</span>
      <span className={styles.wFoot}>
        {w ? (
          <>
            <span className={styles.wNow}>
              <WeatherGlyph kind={w.kind} night={night} size={24} />
              {temp != null ? <span className={styles.wTemp}>{temp}°</span> : null}
              <span className={styles.wLabel}>{label}</span>
            </span>
            <span className={styles.wSub}>
              <span className={styles.wPlace}>
                <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden="true"><path d="M9.4.6.8 4.2l3.8 1.2 1.2 3.8Z" fill="currentColor" /></svg>
                {placeLabel(hw!.place)}
              </span>
              {w.tmax != null && w.tmin != null ? <span>最高{Math.round(w.tmax)}° 最低{Math.round(w.tmin)}°</span> : null}
            </span>
          </>
        ) : (
          <span className={styles.wSub}>天気を読みこんでいます…</span>
        )}
      </span>
    </WidgetShell>
  );
}

export function StepsWidget({ steps, style, editing, onOpen, onLong }: {
  steps: number;
  style: CSSProperties;
  editing: boolean;
  onOpen: () => void;
  onLong: (x: number, y: number) => void;
}) {
  const goal = 10_000;
  const ratio = Math.min(1, steps / goal);
  const done = steps >= goal;
  const r = 19, c = 2 * Math.PI * r;
  return (
    <WidgetShell
      className={styles.stepsWidget}
      style={style}
      label={`今日の歩数 ${steps.toLocaleString()}歩${done ? "、1万歩たっせい" : `、1万歩まであと${(goal - steps).toLocaleString()}歩`}`}
      editing={editing}
      onTap={onOpen}
      onLong={onLong}
    >
      <span className={styles.sTop}>
        <span className={styles.sKicker}>今日の歩数</span>
        <svg className={styles.sRing} viewBox="0 0 48 48" aria-hidden="true">
          <defs>
            <linearGradient id="lwRing" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={done ? "#ffd75e" : "#9be15d"} />
              <stop offset="1" stopColor={done ? "#f5a623" : "#2fb36b"} />
            </linearGradient>
          </defs>
          <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(60,120,60,.14)" strokeWidth="6" />
          <circle cx="24" cy="24" r={r} fill="none" stroke="url(#lwRing)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${Math.max(0.001, c * ratio)} ${c}`} transform="rotate(-90 24 24)" />
          <g transform="translate(24 25)" fill={done ? "#e59a1c" : "#3f9d55"}>
            <ellipse cx="0" cy="2.4" rx="3.6" ry="3" />
            <ellipse cx="-4.1" cy="-2" rx="1.35" ry="1.7" />
            <ellipse cx="-1.4" cy="-4.2" rx="1.35" ry="1.75" />
            <ellipse cx="1.4" cy="-4.2" rx="1.35" ry="1.75" />
            <ellipse cx="4.1" cy="-2" rx="1.35" ry="1.7" />
          </g>
        </svg>
      </span>
      <span className={styles.sCount}>
        <span className={styles.sBig}>{steps.toLocaleString()}</span>
        <span className={styles.sUnit}>歩</span>
      </span>
      <span className={styles.sNote}>{done ? "1万歩たっせい！" : `1万歩まで あと${(goal - steps).toLocaleString()}歩`}</span>
    </WidgetShell>
  );
}
