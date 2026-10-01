"use client";

/**
 * 「きょうの空」：住んでいるところの日の出・日の入りと、いまの太陽の位置、月の満ち欠け。
 * おへやの窓の外と部屋の明るさは、これと同じ計算で決まる。場所は現在地か都道府県で選べる（わからなければ東京）。
 */
import { useMemo, useState } from "react";
import { STEP_COIN_MILESTONES } from "@/lib/coins";
import type { StepDay } from "@/lib/data/exp";
import { useTodaySteps, type TodaySteps } from "@/lib/use-today-steps";
import { PREFECTURE_NAMES } from "@/lib/geo/prefecture-names";
import { WEATHER_LABEL, withWeather, type RoomWeather } from "@/lib/room/weather";
import { fmtJstTime, moonPhase, nearestPref, PREF_POINTS, skyAt, sunTimes, type GeoPoint } from "@/lib/room/sun";

/**
 * 空と天気の計算に使う場所。gps は現在地（この端末にだけ保存する）。
 * city は現在地にいちばん近い市区町村、acc は位置のずれ（m）
 */
export type RoomPlace = GeoPoint & { source: "gps" | "pref" | "default"; pref: string; city?: string; acc?: number };

/**
 * いまいる場所をできるだけ正確にとる（GPS をつかい、前の位置は使い回さない）。
 * 市区町村名は、近くの市区町村の代表地点からさがす（データは使うときだけ読みこむ）
 */
export function locateHere(): Promise<RoomPlace> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) { reject(new Error("unsupported")); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // 約10m の細かさで十分なので、小数4けたにそろえる
        const at = { lat: Math.round(pos.coords.latitude * 1e4) / 1e4, lon: Math.round(pos.coords.longitude * 1e4) / 1e4 };
        let pref = nearestPref(at), city: string | undefined;
        try {
          const { nearestMunicipality } = await import("@/lib/geo/municipalities");
          const near = nearestMunicipality(at.lat, at.lon);
          if (near && near.distanceMeters < 40_000) { pref = near.municipality.prefectureCode; city = near.municipality.name; }
        } catch { /* 市区町村がわからなくても都道府県で出す */ }
        resolve({ ...at, source: "gps", pref, city, acc: Math.round(pos.coords.accuracy) });
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}

/** 場所の短い名前（「岐阜市」など。お天気ボードの名ふだ用） */
export const placeShortName = (p: RoomPlace) => (p.city ? p.city.match(/^(.+?市).+区$/)?.[1] ?? p.city : prefNameOf(p.pref).replace(/(都|府|県)$/, ""));
export const DEFAULT_PLACE: RoomPlace = { ...PREF_POINTS["13"]!, source: "default", pref: "13" };
export const prefNameOf = (code: string) => PREFECTURE_NAMES.find((p) => p.code === code)?.name ?? "東京都";

const MOON_NAMES: [number, string][] = [
  [0.03, "新月"], [0.2, "三日月"], [0.3, "上弦の月"], [0.45, "十三夜"], [0.55, "満月"], [0.7, "十八夜"], [0.8, "下弦の月"], [0.97, "有明月"], [1, "新月"],
];
const moonName = (p: number) => MOON_NAMES.find(([max]) => p <= max)?.[1] ?? "新月";

const NO_STEPS: TodaySteps = { steps: null, stepExp: 0, coinBalance: 0 };
/** 歩数の道の長さ（この歩数で右はし）と、コインのボーナスがもらえる歩数（旗を立てる） */
const TRAIL_MAX = 12_000;
const TRAIL_X0 = 18, TRAIL_X1 = 282;
const trailX = (n: number) => TRAIL_X0 + (Math.min(n, TRAIL_MAX) / TRAIL_MAX) * (TRAIL_X1 - TRAIL_X0);
/** 手前の丘の上の道（x での高さ） */
const trailY = (x: number) => 131 + Math.sin((x / 300) * Math.PI * 2.2) * 2.2;

/** 連続記録の目標 */
const STREAK_GOAL = 5_000;
const DOW = ["日", "月", "火", "水", "木", "金", "土"];
const jstDay = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(d);
const shiftDay = (day: string, n: number) => jstDay(new Date(new Date(`${day}T12:00:00+09:00`).getTime() + n * 86_400_000));

/** きょうまでの7日分と、目標を続けて超えた日数（きょうがまだならきのうまで） */
function weekOf(history: StepDay[], today: string, todaySteps: number) {
  const byDay = new Map(history.map((d) => [d.date, d.steps]));
  byDay.set(today, Math.max(todaySteps, byDay.get(today) ?? 0));
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = shiftDay(today, i - 6);
    return { date, steps: byDay.get(date) ?? 0, dow: DOW[new Date(`${date}T12:00:00+09:00`).getUTCDay()]! };
  });
  let streak = 0;
  for (let d = (byDay.get(today) ?? 0) >= STREAK_GOAL ? today : shiftDay(today, -1); (byDay.get(d) ?? 0) >= STREAK_GOAL; d = shiftDay(d, -1)) streak++;
  return { week, streak, total: week.reduce((s, d) => s + d.steps, 0) };
}

export function SkyCard({ now, place, onPlace, weather = null, steps, history }: {
  now: Date; place: RoomPlace; onPlace: (p: RoomPlace) => void; weather?: RoomWeather | null;
  /** きょうの歩数（渡したときだけ、手前の丘におさんぽの道を描く） */
  steps?: TodaySteps;
  /** 直近の日ごとの歩数（今週のグラフと連続記録） */
  history?: StepDay[];
}) {
  const today = useTodaySteps(steps ?? NO_STEPS);
  const stepCount = steps ? today.steps : null;
  const nextGoal = stepCount === null ? null : STEP_COIN_MILESTONES.find((m) => m.steps > stepCount) ?? null;
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now);
  const stepWeek = useMemo(() => (stepCount === null || !history ? null : weekOf(history, day, stepCount)), [history, day, stepCount]);
  const times = useMemo(() => sunTimes(new Date(`${day}T12:00:00+09:00`), place), [day, place]);
  const sky = withWeather(skyAt(now, place), weather);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");
  const useHere = () => {
    setLocating(true);
    setGeoError("");
    locateHere()
      .then((p) => { onPlace(p); setOpen(false); })
      .catch((err: unknown) => {
        const denied = typeof err === "object" && err !== null && "code" in err && (err as GeolocationPositionError).code === 1;
        setGeoError(denied ? "位置情報が許可されていません。設定で許可するか、都道府県を選んでください" : err instanceof Error && err.message === "unsupported" ? "この端末では現在地が使えません。都道府県を選んでください" : "現在地がわかりませんでした。電波のよいところでもう一度ためしてください");
      })
      .finally(() => setLocating(false));
  };
  const placeLabel = place.source === "gps" ? `${place.city ? `${prefNameOf(place.pref)}${place.city}` : prefNameOf(place.pref)}（現在地）` : prefNameOf(place.pref);
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
            {/* おさんぽの道：きょう歩いたぶんだけ足あと。コインのボーナス地点に旗 */}
            {stepCount !== null ? (
              <g>
                <path d={`M${TRAIL_X0} ${trailY(TRAIL_X0)} ${Array.from({ length: 34 }, (_, i) => { const x = TRAIL_X0 + ((i + 1) * (TRAIL_X1 - TRAIL_X0)) / 34; return `L${x.toFixed(1)} ${trailY(x).toFixed(1)}`; }).join(" ")}`} fill="none" stroke={ink("#F3E2BF", "#2C3550")} strokeWidth="5" strokeLinecap="round" />
                {Array.from({ length: Math.floor((trailX(stepCount) - TRAIL_X0) / 7.5) }, (_, i) => {
                  const x = TRAIL_X0 + 3 + i * 7.5, y = trailY(x) + (i % 2 ? 1.2 : -1.2);
                  return (
                    <g key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} fill={ink("#9A6A40", "#E6C88A")} opacity={0.75}>
                      <ellipse cx="0" cy="0.6" rx="1.5" ry="1.2" />
                      <circle cx="-1.3" cy="-1.1" r="0.55" /><circle cx="0" cy="-1.5" r="0.55" /><circle cx="1.3" cy="-1.1" r="0.55" />
                    </g>
                  );
                })}
                {STEP_COIN_MILESTONES.map((m) => {
                  const x = trailX(m.steps), y = trailY(x), done = stepCount >= m.steps;
                  return (
                    <g key={m.steps} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
                      <line x1="0" y1="0" x2="0" y2="-13" stroke={ink("#7A5A3A", "#C9B48E")} strokeWidth="1.2" />
                      <path d="M0 -13 L9 -10.5 L0 -8 Z" fill={done ? "#F2B53A" : ink("#FFFFFF", "#8A90B8")} opacity={done ? 1 : 0.8} />
                      <text x="0" y="-15" textAnchor="middle" fontSize="5.5" fontWeight="900" fill="#FFFFFF" opacity="0.9">{m.steps / 1000}k</text>
                    </g>
                  );
                })}
                {/* いまいるところ */}
                <g transform={`translate(${trailX(stepCount).toFixed(1)} ${(trailY(trailX(stepCount)) - 4).toFixed(1)})`}>
                  <circle r="5.5" fill="#FFFFFF" stroke="#5E8C4A" strokeWidth="1.6" />
                  <g fill="#5E8C4A"><ellipse cx="0" cy="1.1" rx="1.9" ry="1.5" /><circle cx="-1.7" cy="-1.3" r="0.75" /><circle cx="0" cy="-1.9" r="0.75" /><circle cx="1.7" cy="-1.3" r="0.75" /></g>
                </g>
              </g>
            ) : null}
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
        {stepCount !== null ? (
          <div className="mt-2 rounded-[12px] bg-[linear-gradient(180deg,#FBF6EE,#EFE4D2)] px-3 py-2 shadow-[inset_0_1px_0_#fff]">
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-sm">👣</span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-ink-faint">きょうの歩数</p>
              <p className="flex items-baseline gap-1 leading-none text-ink" aria-live="polite">
                <span className="text-[22px] font-black tabular-nums">{stepCount.toLocaleString("ja-JP")}</span>
                <span className="text-[11px] font-bold text-ink-soft">歩</span>
              </p>
            </div>
            <p className="shrink-0 rounded-full bg-white px-2.5 py-1 text-right text-[10px] font-bold leading-tight text-ink-soft shadow-sm">
              {nextGoal ? <>🚩 {nextGoal.steps.toLocaleString("ja-JP")}歩まで<br />あと <span className="text-leaf-deep">{(nextGoal.steps - stepCount).toLocaleString("ja-JP")}</span>歩</> : <>🎉 10,000歩<br />たっせい！</>}
            </p>
          </div>
          {stepWeek ? <StepWeek {...stepWeek} /> : null}
          </div>
        ) : steps ? (
          <div className="mt-2 rounded-[12px] bg-[linear-gradient(180deg,#FBF6EE,#EFE4D2)] px-3 py-2 text-[11px] font-bold text-ink-soft shadow-[inset_0_1px_0_#fff]">👣 歩数は、ショートカットで連携すると出ます</div>
        ) : null}
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
          <p className="text-[10px] leading-relaxed text-ink-faint">
            現在地はGPSでとり、この端末にだけ保存して空と天気の計算に使います（天気は約1kmの細かさで調べます）。位置情報を許可していれば、ひらくたびに取り直します。時刻はいつも日本時間です。
            {place.source === "gps" && place.acc ? ` いまの位置のずれ：約${place.acc >= 1000 ? `${(place.acc / 1000).toFixed(1)}km` : `${place.acc}m`}` : ""}
          </p>
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

/** 窓台の下：今週の歩数（7本の棒）と連続記録 */
function StepWeek({ week, streak, total }: { week: { date: string; steps: number; dow: string }[]; streak: number; total: number }) {
  const max = Math.max(STREAK_GOAL * 1.6, ...week.map((d) => d.steps));
  const goalY = 100 - (STREAK_GOAL / max) * 100;
  return (
    <div className="mt-2 border-t border-dashed border-[#DCCDB4] pt-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold text-ink-faint">この7日間 <span className="tabular-nums text-ink-soft">{total.toLocaleString("ja-JP")}</span>歩</p>
        <p className={`rounded-full px-2 py-0.5 text-[10px] font-black shadow-sm ${streak >= 2 ? "bg-[linear-gradient(90deg,#FF9A3C,#FF5E3A)] text-white" : "bg-white text-ink-soft"}`}>
          {streak >= 2 ? <>🔥 {streak}日連続 {STREAK_GOAL.toLocaleString("ja-JP")}歩</> : streak === 1 ? <>✨ {STREAK_GOAL.toLocaleString("ja-JP")}歩 たっせい中</> : <>{STREAK_GOAL.toLocaleString("ja-JP")}歩で連続記録スタート</>}
        </p>
      </div>
      <div className="relative mt-1.5 h-14">
        <div aria-hidden className="absolute inset-x-0 border-t border-dashed border-[#E3A85C]/70" style={{ top: `${goalY}%` }}>
          <span className="absolute -top-[7px] -left-0.5 rounded bg-[#FBF6EE] px-0.5 text-[7px] font-black leading-none text-[#C9822F]">5k</span>
        </div>
        <ol className="relative flex h-full items-end justify-between gap-1.5 pl-3" aria-label="この7日間の歩数">
          {week.map((d, i) => {
            const isToday = i === week.length - 1, hit = d.steps >= STREAK_GOAL;
            return (
              <li key={d.date} className="flex h-full flex-1 flex-col items-center justify-end" title={`${d.date} ${d.steps.toLocaleString("ja-JP")}歩`}>
                <span className="sr-only">{d.dow}曜 {d.steps.toLocaleString("ja-JP")}歩</span>
                <span aria-hidden
                  className={`w-full max-w-[22px] rounded-t-[5px] rounded-b-[2px] ${isToday ? "bg-[linear-gradient(180deg,#7BC47F,#3E8E55)] shadow-[0_0_0_2px_#fff,0_2px_6px_rgba(62,142,85,.35)]" : hit ? "bg-[linear-gradient(180deg,#A9D8A0,#6DAF73)]" : "bg-[linear-gradient(180deg,#E6D8C1,#D2C0A2)]"}`}
                  style={{ height: `${Math.max(d.steps > 0 ? 6 : 3, (d.steps / max) * 100)}%` }} />
              </li>
            );
          })}
        </ol>
      </div>
      <ol aria-hidden className="mt-1 flex justify-between gap-1.5 pl-3">
        {week.map((d, i) => (
          <li key={d.date} className={`flex-1 text-center text-[9px] font-black ${i === week.length - 1 ? "text-leaf-deep" : d.dow === "日" ? "text-[#D9705A]" : d.dow === "土" ? "text-[#5A86C9]" : "text-ink-faint"}`}>
            {i === week.length - 1 ? "きょう" : d.dow}
          </li>
        ))}
      </ol>
    </div>
  );
}
