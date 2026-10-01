"use client";

/**
 * 「きょうの空」：日本（東京）の日の出・日の入りと、いまの太陽の位置、月の満ち欠け。
 * おへやの窓の外と部屋の明るさは、これと同じ計算で決まる。
 */
import { useMemo } from "react";
import { fmtJstTime, moonPhase, skyAt, sunTimes } from "@/lib/room/sun";

const MOON_NAMES: [number, string][] = [
  [0.03, "新月"], [0.2, "三日月"], [0.3, "上弦の月"], [0.45, "十三夜"], [0.55, "満月"], [0.7, "十八夜"], [0.8, "下弦の月"], [0.97, "有明月"], [1, "新月"],
];
const moonName = (p: number) => MOON_NAMES.find(([max]) => p <= max)?.[1] ?? "新月";

export function SkyCard({ now }: { now: Date }) {
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now);
  const times = useMemo(() => sunTimes(new Date(`${day}T12:00:00+09:00`)), [day]);
  const sky = skyAt(now);
  const moon = moonPhase(now);
  const rise = times.rise?.getTime() ?? 0, set = times.set?.getTime() ?? 0;
  const t = now.getTime();
  const up = t >= rise && t <= set;
  const f = up && set > rise ? (t - rise) / (set - rise) : 0;
  // 弧の上の太陽（日の出 0 → 日の入り 1）
  const ax = 24 + f * 252, ay = 78 - Math.sin(f * Math.PI) * 58;
  const status = up
    ? set - t < 60 * 60_000 ? `あと${Math.max(1, Math.round((set - t) / 60_000))}分で日の入り` : sky.altitude < 12 ? (f < 0.5 ? "朝の光がやさしい時間" : "夕方の光がさしこむ時間") : "お日さまが出ている時間"
    : t < rise ? `日の出まで あと${Math.floor((rise - t) / 3_600_000)}時間${Math.round(((rise - t) % 3_600_000) / 60_000)}分` : sky.altitude > -6 ? "日が沈んで、空がのこりの色" : "夜。明かりをつけてのんびり";
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
      <div className="flex items-center justify-between px-4 pt-3">
        <p className="text-xs font-black text-ink-soft">きょうの空<span className="ml-1.5 text-[10px] font-bold text-ink-faint">日本（東京）</span></p>
        <p className="text-[10px] font-bold text-ink-faint">いま {fmtJstTime(now)}</p>
      </div>
      <svg viewBox="0 0 300 96" className="block w-full" role="img" aria-label={`日の出 ${times.rise ? fmtJstTime(times.rise) : "-"}、日の入り ${times.set ? fmtJstTime(times.set) : "-"}。${status}`}>
        <defs>
          <linearGradient id="skycard-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={sky.top} />
            <stop offset="1" stopColor={sky.bottom} />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="300" height="96" fill="url(#skycard-bg)" opacity="0.35" />
        <line x1="12" y1="78" x2="288" y2="78" stroke="#8A7A68" strokeOpacity="0.35" strokeWidth="1.5" />
        <path d="M24 78 Q150 -38 276 78" fill="none" stroke="#E0A55A" strokeWidth="2" strokeDasharray="4 4" opacity="0.8" />
        {up ? (
          <g>
            <circle cx={ax} cy={ay} r="13" fill="#FFD36A" opacity="0.35" />
            <circle cx={ax} cy={ay} r="8" fill="#FFB938" />
          </g>
        ) : (
          <g transform="translate(150 34)">
            <circle r="11" fill="#2B3266" opacity="0.15" />
            <path d={moonIcon(9, moon)} fill="#F2C94C" />
          </g>
        )}
        <text x="24" y="92" textAnchor="middle" fontSize="9" fontWeight="800" fill="#6A5A48">日の出 {times.rise ? fmtJstTime(times.rise) : "-"}</text>
        <text x="276" y="92" textAnchor="middle" fontSize="9" fontWeight="800" fill="#6A5A48">日の入り {times.set ? fmtJstTime(times.set) : "-"}</text>
      </svg>
      <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-1">
        <p className="text-[12px] font-bold text-ink">{status}</p>
        <p className="shrink-0 rounded-full bg-paper-deep px-2.5 py-1 text-[10px] font-bold text-ink-soft">🌙 {moonName(moon)}</p>
      </div>
    </div>
  );
}

function moonIcon(r: number, p: number): string {
  const k = Math.cos(2 * Math.PI * p), rx = Math.abs(k) * r;
  const waxing = p < 0.5;
  const inner = waxing ? (k > 0 ? 0 : 1) : (k > 0 ? 1 : 0);
  return `M0 ${-r} A ${r} ${r} 0 0 ${waxing ? 1 : 0} 0 ${r} A ${rx} ${r} 0 0 ${inner} 0 ${-r} Z`;
}
