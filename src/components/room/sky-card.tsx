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
  const ax = 24 + f * 252, ay = 78 - Math.sin(f * Math.PI) * 58;
  const status = up
    ? set - t < 60 * 60_000 ? `あと${Math.max(1, Math.round((set - t) / 60_000))}分で日の入り` : sky.altitude < 12 ? (f < 0.5 ? "朝の光がやさしい時間" : "夕方の光がさしこむ時間") : weatherDay(weather)
    : t < rise ? `日の出まで あと${Math.floor((rise - t) / 3_600_000)}時間${Math.round(((rise - t) % 3_600_000) / 60_000)}分` : sky.altitude > -6 ? "日が沈んで、空がのこりの色" : "夜。明かりをつけてのんびり";
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
      <div className="flex items-center justify-between px-4 pt-3">
        <p className="text-xs font-black text-ink-soft">きょうの空<span className="ml-1.5 text-[10px] font-bold text-ink-faint">いま {fmtJstTime(now)}</span></p>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex max-w-[60%] items-center gap-1 rounded-full border border-line bg-paper px-2.5 py-1 text-[10px] font-bold text-ink-soft active:scale-95">
          <span aria-hidden>📍</span><span className="truncate">{placeLabel}</span><span aria-hidden className="text-ink-faint">{open ? "▲" : "▼"}</span>
        </button>
      </div>
      {open ? (
        <div className="mx-3 mt-2 space-y-2 rounded-xl bg-paper-deep p-2.5">
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
          <p className="text-[10px] leading-relaxed text-ink-faint">場所はこの端末にだけ保存され、約10kmの細かさに丸めて空の計算だけに使います。時刻はいつも日本時間です。</p>
        </div>
      ) : null}
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
        <text x="8" y="92" textAnchor="start" fontSize="9" fontWeight="800" fill="#6A5A48">日の出 {times.rise ? fmtJstTime(times.rise) : "-"}</text>
        <text x="292" y="92" textAnchor="end" fontSize="9" fontWeight="800" fill="#6A5A48">日の入り {times.set ? fmtJstTime(times.set) : "-"}</text>
      </svg>
      <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-1">
        <p className="text-[12px] font-bold text-ink">{status}</p>
        <div className="flex shrink-0 items-center gap-1">
          {weather ? (
            <p className="rounded-full bg-paper-deep px-2.5 py-1 text-[10px] font-bold text-ink-soft">
              {WEATHER_LABEL[weather.kind].icon} {WEATHER_LABEL[weather.kind].label}{weather.temp !== null ? ` ${Math.round(weather.temp)}℃` : ""}
            </p>
          ) : null}
          <p className="rounded-full bg-paper-deep px-2.5 py-1 text-[10px] font-bold text-ink-soft">🌙 {moonName(moon)}</p>
        </div>
      </div>
    </div>
  );
}

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
