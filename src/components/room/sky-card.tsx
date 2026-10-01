"use client";

/**
 * 「きょうの空」：住んでいるところの日の出・日の入りと、いまの太陽の位置、月の満ち欠け。
 * おへやの窓の外と部屋の明るさは、これと同じ計算で決まる。場所は現在地か都道府県で選べる（わからなければ東京）。
 */
import { useMemo, useState } from "react";
import { PREFECTURE_NAMES } from "@/lib/geo/prefecture-names";
import { WEATHER_LABEL, withWeather, type RoomWeather } from "@/lib/room/weather";
import { fmtJstTime, moonPhase, nearestPref, PREF_POINTS, skyAt, sunTimes, type GeoPoint } from "@/lib/room/sun";

/** 空の計算に使う場所。gps は現在地（0.1度に丸めて、この端末にだけ保存する） */
export type RoomPlace = GeoPoint & { source: "gps" | "pref" | "default"; pref: string };
export const DEFAULT_PLACE: RoomPlace = { ...PREF_POINTS["13"]!, source: "default", pref: "13" };
export const prefNameOf = (code: string) => PREFECTURE_NAMES.find((p) => p.code === code)?.name ?? "東京都";

const MOON_NAMES: [number, string][] = [
  [0.03, "新月"], [0.2, "三日月"], [0.3, "上弦の月"], [0.45, "十三夜"], [0.55, "満月"], [0.7, "十八夜"], [0.8, "下弦の月"], [0.97, "有明月"], [1, "新月"],
];
const moonName = (p: number) => MOON_NAMES.find(([max]) => p <= max)?.[1] ?? "新月";

export function SkyCard({ now, place, onPlace, weather = null }: { now: Date; place: RoomPlace; onPlace: (p: RoomPlace) => void; weather?: RoomWeather | null }) {
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now);
  const times = useMemo(() => sunTimes(new Date(`${day}T12:00:00+09:00`), place), [day, place]);
  const sky = withWeather(skyAt(now, place), weather);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");
  const useHere = () => {
    if (!("geolocation" in navigator)) { setGeoError("この端末では現在地が使えません。都道府県を選んでください"); return; }
    setLocating(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // 空の計算には町くらいの細かさで十分なので、0.1度（約10km）に丸める
        const at = { lat: Math.round(pos.coords.latitude * 10) / 10, lon: Math.round(pos.coords.longitude * 10) / 10 };
        onPlace({ ...at, source: "gps", pref: nearestPref(at) });
        setLocating(false);
        setOpen(false);
      },
      (err) => {
        setLocating(false);
        setGeoError(err.code === err.PERMISSION_DENIED ? "位置情報が許可されていません。都道府県を選んでください" : "現在地がわかりませんでした。都道府県を選んでください");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 6 * 3_600_000 },
    );
  };
  const placeLabel = place.source === "gps" ? `${prefNameOf(place.pref)}あたり（現在地）` : prefNameOf(place.pref);
  const moon = moonPhase(now);
  const rise = times.rise?.getTime() ?? 0, set = times.set?.getTime() ?? 0;
  const t = now.getTime();
  const up = t >= rise && t <= set;
  const f = up && set > rise ? (t - rise) / (set - rise) : 0;
  // 弧の上の太陽（日の出 0 → 日の入り 1）
  const ax = 24 + f * 252, ay2 = 112 - Math.sin(f * Math.PI) * 60;
  const status = up
    ? set - t < 60 * 60_000 ? `あと${Math.max(1, Math.round((set - t) / 60_000))}分で日の入り` : sky.altitude < 12 ? (f < 0.5 ? "朝の光がやさしい時間" : "夕方の光がさしこむ時間") : weatherDay(weather)
    : t < rise ? `日の出まで あと${Math.floor((rise - t) / 3_600_000)}時間${Math.round(((rise - t) % 3_600_000) / 60_000)}分` : sky.altitude > -6 ? "日が沈んで、空がのこりの色" : "夜。明かりをつけてのんびり";
  const dark = 1 - sky.light;
  const kind = weather?.kind;
  const wet = kind === "rain" || kind === "drizzle" || kind === "thunder";
  const cloudy = kind === "cloudy" || kind === "fog" || wet || kind === "snow";
  const ink = (day: string, night: string) => mix(day, night, Math.min(1, dark * 1.1));
  return (
    <div className="space-y-2">
      {/* 窓わくの中に、いまの空と町を見せる */}
      <div className="rounded-[22px] border border-[#E3D6C0] bg-[linear-gradient(180deg,#FFFFFF,#F1E8D8)] p-2 shadow-[0_8px_16px_-10px_rgba(80,55,25,.5)]">
        <div className="relative overflow-hidden rounded-[15px] shadow-[inset_0_2px_6px_rgba(40,25,10,.35)]">
          <svg viewBox="0 0 300 150" className="block w-full" role="img" aria-label={`日の出 ${times.rise ? fmtJstTime(times.rise) : "-"}、日の入り ${times.set ? fmtJstTime(times.set) : "-"}。${status}`}>
            <defs>
              <linearGradient id="skycard-bg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={sky.top} />
                <stop offset="1" stopColor={sky.bottom} />
              </linearGradient>
              <radialGradient id="skycard-glow" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor={up ? "#FFE9A8" : "#FFF6D0"} stopOpacity="0.85" />
                <stop offset="1" stopColor={up ? "#FFE9A8" : "#FFF6D0"} stopOpacity="0" />
              </radialGradient>
              <linearGradient id="skycard-glass" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0.35" stopColor="#FFFFFF" stopOpacity="0" />
                <stop offset="0.42" stopColor="#FFFFFF" stopOpacity="0.16" />
                <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="300" height="150" fill="url(#skycard-bg)" />
            {/* 星 */}
            {sky.stars > 0.05 ? STARS.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#FFF8DA" opacity={sky.stars * (i % 3 ? 0.65 : 1)} />) : null}
            {/* 太陽・月がとおる道 */}
            <path d="M24 112 Q150 -8 276 112" fill="none" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="1.6" strokeDasharray="3 5" />
            {up ? (
              <g opacity={cloudy ? 0.55 : 1}>
                <circle cx={ax} cy={ay2} r="26" fill="url(#skycard-glow)" />
                <circle cx={ax} cy={ay2} r="10" fill={mix("#FFD24A", "#FF9A4A", sky.warm)} />
              </g>
            ) : (
              <g transform="translate(206 34)" opacity={cloudy ? 0.5 : 1}>
                <circle r="24" fill="url(#skycard-glow)" />
                <path d={moonIcon(10, moon)} fill="#FFF1B8" />
              </g>
            )}
            {/* 雲（天気に合わせて） */}
            {cloudy || kind === "partly" ? (
              <g fill={wet ? ink("#B4BCC8", "#4A5068") : ink("#FFFFFF", "#5A6080")} opacity="0.92">
                {(kind === "partly" ? CLOUDS.slice(0, 2) : CLOUDS).map(([x, y, s2], i) => (
                  <g key={i} transform={`translate(${x} ${y}) scale(${s2})`}>
                    <ellipse cx="0" cy="4" rx="22" ry="8" /><circle cx="-8" cy="-1" r="9" /><circle cx="5" cy="-4" r="11" /><circle cx="15" cy="1" r="7" />
                  </g>
                ))}
              </g>
            ) : null}
            {wet ? Array.from({ length: 22 }, (_, i) => <line key={i} x1={(i * 37) % 300} y1={(i * 23) % 90} x2={((i * 37) % 300) - 3} y2={((i * 23) % 90) + 9} stroke="#DCEBFA" strokeOpacity="0.7" strokeWidth="1.3" strokeLinecap="round" />) : null}
            {kind === "snow" ? Array.from({ length: 26 }, (_, i) => <circle key={i} cx={(i * 41) % 300} cy={(i * 29) % 110} r={1.4 + (i % 3) * 0.5} fill="#FFFFFF" opacity="0.9" />) : null}
            {/* 遠くの山と町（夜は窓に明かり） */}
            <path d="M0 112 C 40 92, 70 98, 110 104 C 150 90, 200 92, 240 100 C 265 94, 285 98, 300 96 V150 H0 Z" fill={ink("#A9CC93", "#1E2A44")} />
            {HOUSES.map(([x, w, h, roof], i) => (
              <g key={i}>
                <rect x={x} y={124 - h} width={w} height={h + 4} fill={ink(["#F4E3C3", "#E8C7B4", "#DCE6EE", "#F2D7A6"][i % 4]!, "#161E33")} />
                <path d={`M${x - 2} ${124 - h} L${x + w / 2} ${124 - h - roof} L${x + w + 2} ${124 - h} Z`} fill={ink(["#C9604A", "#6A8CB8", "#8A6A4A", "#5E9C52"][i % 4]!, "#10162A")} />
                {dark > 0.55 ? <rect x={x + w / 2 - 2.5} y={124 - h + 4} width="5" height="5" fill="#FFD98A" opacity="0.9" /> : null}
              </g>
            ))}
            <path d="M0 126 C 60 118, 120 124, 170 121 C 220 118, 260 124, 300 120 V150 H0 Z" fill={ink("#8DBF6E", "#121A2E")} />
            {[38, 92, 248].map((x) => <g key={x} transform={`translate(${x} 122)`}><rect x="-1.5" y="-4" width="3" height="8" fill={ink("#7A5A3A", "#0C1222")} /><circle cy="-9" r="7" fill={ink("#5E9C52", "#0E1626")} /></g>)}
            <text x="10" y="143" fontSize="9.5" fontWeight="800" fill="#FFFFFF" opacity="0.92">日の出 {times.rise ? fmtJstTime(times.rise) : "-"}</text>
            <text x="290" y="143" fontSize="9.5" fontWeight="800" fill="#FFFFFF" opacity="0.92" textAnchor="end">日の入り {times.set ? fmtJstTime(times.set) : "-"}</text>
            <rect x="0" y="0" width="300" height="150" fill="url(#skycard-glass)" />
          </svg>
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
            <p className="rounded-full bg-black/20 px-2.5 py-1 text-[11px] font-black text-white backdrop-blur-sm">きょうの空<span className="ml-1.5 text-[10px] font-bold opacity-85">いま {fmtJstTime(now)}</span></p>
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex max-w-[58%] items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-bold text-ink-soft shadow-sm backdrop-blur-sm active:scale-95">
              <span aria-hidden>📍</span><span className="truncate">{placeLabel}</span><span aria-hidden className="text-ink-faint">{open ? "▲" : "▼"}</span>
            </button>
          </div>
        </div>
        {/* 窓台 */}
        <div className="mt-2 flex items-center justify-between gap-2 rounded-[12px] bg-[linear-gradient(180deg,#FBF6EE,#EFE4D2)] px-3 py-2 shadow-[inset_0_1px_0_#fff]">
          <p className="min-w-0 text-[12px] font-bold text-ink">{status}</p>
          <div className="flex shrink-0 items-center gap-1">
            {weather ? (
              <p className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-ink-soft shadow-sm">
                {WEATHER_LABEL[weather.kind].icon} {WEATHER_LABEL[weather.kind].label}{weather.temp !== null ? ` ${Math.round(weather.temp)}℃` : ""}
              </p>
            ) : null}
            <p className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-ink-soft shadow-sm">🌙 {moonName(moon)}</p>
          </div>
        </div>
      </div>
      {open ? (
        <div className="space-y-2 rounded-2xl border border-line bg-card p-3 shadow-sm">
          <button type="button" onClick={useHere} disabled={locating} className="w-full rounded-full bg-leaf-deep py-2 text-[12px] font-black text-white shadow-sm active:scale-[.98] disabled:opacity-60">
            {locating ? "現在地をさがしています…" : "📍 現在地を使う"}
          </button>
          <label className="flex items-center gap-2 text-[11px] font-bold text-ink-soft">
            <span className="shrink-0">都道府県で選ぶ</span>
            <select
              value={place.source === "gps" ? "" : place.pref}
              onChange={(e) => { const code = e.target.value; const pt = PREF_POINTS[code]; if (pt) { onPlace({ ...pt, source: "pref", pref: code }); setGeoError(""); setOpen(false); } }}
              className="min-w-0 flex-1 rounded-lg border border-line bg-card px-2 py-1.5 text-[12px] font-bold text-ink"
            >
              {place.source === "gps" ? <option value="">現在地を使っています</option> : null}
              {PREFECTURE_NAMES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </select>
          </label>
          {geoError ? <p className="text-[10px] font-bold text-[#C0502E]">{geoError}</p> : null}
          <p className="text-[10px] leading-relaxed text-ink-faint">場所はこの端末にだけ保存され、約10kmの細かさに丸めて空と天気の計算だけに使います。時刻はいつも日本時間です。</p>
        </div>
      ) : null}
    </div>
  );
}

const STARS: [number, number, number][] = [[20, 18, 1.2], [48, 40, 0.9], [76, 14, 1.4], [104, 52, 0.8], [132, 24, 1.1], [168, 10, 0.9], [190, 58, 1.2], [232, 18, 1], [258, 48, 1.3], [284, 26, 0.9], [60, 70, 0.8], [150, 68, 1], [270, 78, 0.8]];
const CLOUDS: [number, number, number][] = [[70, 40, 1.1], [190, 60, 0.9], [250, 30, 1.2], [120, 22, 0.8], [30, 70, 0.9]];
/** 町の家（x, 幅, 高さ, 屋根の高さ） */
const HOUSES: [number, number, number, number][] = [[18, 16, 12, 7], [52, 12, 16, 6], [130, 18, 10, 8], [158, 12, 14, 6], [206, 16, 12, 7], [262, 14, 15, 6]];
const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => `#${hexRgb(a).map((v, i) => Math.round(v + (hexRgb(b)[i]! - v) * Math.max(0, Math.min(1, t))).toString(16).padStart(2, "0")).join("")}`;

/** 昼間の天気のひとこと */
function weatherDay(w: RoomWeather | null): string {
  switch (w?.kind) {
    case "rain": case "drizzle": return "雨の日。おうちでのんびり";
    case "thunder": return "雷が鳴ってるよ。おうちにいようね";
    case "snow": return "雪の日。あったかくしてね";
    case "fog": return "きりで、おそとがかすんでる";
    case "cloudy": return "くもり空。お日さまは雲のうしろ";
    default: return "お日さまが出ている時間";
  }
}

function moonIcon(r: number, p: number): string {
  const k = Math.cos(2 * Math.PI * p), rx = Math.abs(k) * r;
  const waxing = p < 0.5;
  const inner = waxing ? (k > 0 ? 0 : 1) : (k > 0 ? 1 : 0);
  return `M0 ${-r} A ${r} ${r} 0 0 ${waxing ? 1 : 0} 0 ${r} A ${rx} ${r} 0 0 ${inner} 0 ${-r} Z`;
}
