"use client";

/**
 * ホーム上部の犬カードの「きょうのお天気」。
 *
 * - HomeWeatherProvider：場所（マイルームで選んだもの）と天気を読みこんで、下の部品と犬に配る
 * - HomeWeatherSky：絵の上に重ねる空（くもり・雨・雪・きり・雷・夕方・夜・晴れの光）
 * - HomeWeatherChip：空に浮かぶチップ（天気・気温・最高/最低・おさんぽ予報）。タップでくわしい画面
 *
 * 天気が取れないとき（オフライン・混雑）は何も出さず、いつもの絵のままにする。
 * 空の重ねは看板（z-10）より下に置くので、看板の文字が暗くなることはない。
 */
import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  placeLabel,
  readSavedPlace,
  skyPhaseOf,
  tempColor,
  tempWord,
  walkForecastOf,
  type SavedPlace,
  type SkyPhase,
  type WalkForecast,
} from "@/lib/home-weather";
import { MOOD_RAIN_PENALTY, MOOD_THUNDER_PENALTY } from "@/lib/room/mood";
import { overcastOf, parseRoomWeather, WEATHER_LABEL, type RoomWeather, type WeatherKind } from "@/lib/room/weather";

type HomeWeather = {
  weather: RoomWeather;
  place: SavedPlace & { saved: boolean };
  phase: SkyPhase;
  forecast: WalkForecast;
};

const Ctx = createContext<HomeWeather | null>(null);

/** 犬カードの中の部品が、いまの天気を受け取る。プロバイダーの外や、取れないときは null */
export const useHomeWeather = () => useContext(Ctx);

/** ホームを開くたびに問い合わせないよう、10分はこの端末に覚えておく */
const CACHE_KEY = "odekake-home-weather-v1";
const CACHE_MS = 10 * 60_000;

export function HomeWeatherProvider({ children }: { children: React.ReactNode }) {
  const [place, setPlace] = useState<(SavedPlace & { saved: boolean }) | null>(null);
  const [weather, setWeather] = useState<RoomWeather | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => { setPlace(readSavedPlace()); }, []);

  useEffect(() => {
    if (!place) return;
    const lat = place.lat.toFixed(2), lon = place.lon.toFixed(2);
    let alive = true;
    const load = (useCache: boolean) => {
      if (useCache) {
        try {
          const c = JSON.parse(window.sessionStorage.getItem(CACHE_KEY) ?? "null") as { lat: string; lon: string; t: number; raw: unknown } | null;
          if (c && c.lat === lat && c.lon === lon && Date.now() - c.t < CACHE_MS) {
            const w = parseRoomWeather(c.raw);
            if (w) { setWeather(w); return; }
          }
        } catch { /* 覚えていなければ問い合わせる */ }
      }
      fetch(`/api/my-room/weather?lat=${lat}&lon=${lon}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((raw: unknown) => {
          if (!alive) return;
          const w = parseRoomWeather(raw);
          setWeather(w);
          if (w) try { window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ lat, lon, t: Date.now(), raw })); } catch { /* 覚えられなくても表示はできる */ }
        })
        .catch(() => { /* 取れなければ前のまま（はじめてなら何も出さない） */ });
    };
    load(true);
    const t = window.setInterval(() => { load(false); setNow(new Date()); }, 20 * 60_000);
    // しばらく別のアプリにいて戻ってきたら、時間帯と天気を新しくする
    const onVisible = () => { if (document.visibilityState === "visible") { setNow(new Date()); load(true); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; window.clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [place]);

  const value = useMemo<HomeWeather | null>(() => {
    if (!place || !weather) return null;
    const phase = skyPhaseOf(now, place);
    return { weather, place, phase, forecast: walkForecastOf(weather, phase) };
  }, [now, place, weather]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** 0〜1 の決まった乱数（雨つぶ・雪・星の位置。毎回同じ並びにする） */
const seeded = (i: number, salt: number) => {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/** 雲・雨で空にかける色 */
const TINT: Partial<Record<WeatherKind, string>> = {
  partly: "150,165,180",
  cloudy: "128,140,156",
  drizzle: "112,126,144",
  rain: "92,106,126",
  thunder: "70,78,100",
  snow: "196,206,222",
  fog: "236,240,244",
};

/**
 * 看板の板は背景の絵に描かれているので、そのまま暗くすると文字が読めなくなる。
 * 板のところだけ重ねを薄くする（くり抜きは少しぼかして、景色になじませる）。
 * 位置は home-scene.tsx の LEVEL_BOARD / STEPS_BOARD と同じ。
 */
const BOARD_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><defs><filter id='b' x='-10%' y='-10%' width='120%' height='120%'><feGaussianBlur stdDeviation='0.9'/></filter><mask id='m'><rect width='100' height='100' fill='white'/><g filter='url(#b)' fill='black' fill-opacity='0.92'><rect x='5.6' y='15.2' width='24.1' height='24.4' rx='3'/><rect x='5.7' y='44' width='24.2' height='27.6' rx='3'/></g></mask></defs><rect width='100' height='100' fill='white' mask='url(#m)'/></svg>`,
)}")`;

/** 絵の上に重ねる空。看板より下、犬より下に置く（HomeScene の children の先頭） */
export function HomeWeatherSky() {
  const hw = useHomeWeather();
  if (!hw) return null;
  const { weather: w, phase } = hw;
  const o = overcastOf(w);
  const tint = TINT[w.kind];
  const rainy = w.kind === "rain" || w.kind === "drizzle" || w.kind === "thunder";
  const drops = w.kind === "drizzle" ? 18 : w.kind === "rain" ? 42 : w.kind === "thunder" ? 52 : 0;
  const flakes = w.kind === "snow" ? 34 : 0;
  const clearish = w.kind === "clear" || w.kind === "partly";
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[21px_19px_23px_18px]"
      style={{ maskImage: BOARD_MASK, WebkitMaskImage: BOARD_MASK, maskSize: "100% 100%", WebkitMaskSize: "100% 100%" }}
      aria-hidden="true"
    >
      {/* 雲の量：上ほど濃く、芝のほうへ薄く */}
      {tint && w.kind !== "fog" ? (
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(180deg, rgba(${tint},${0.62 * o}) 0%, rgba(${tint},${0.42 * o}) 40%, rgba(${tint},${0.18 * o}) 70%, rgba(${tint},${0.08 * o}) 100%)` }}
        />
      ) : null}
      {/* きり：白いもやが ゆっくり流れる */}
      {w.kind === "fog" ? (
        <>
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(240,243,246,.55), rgba(240,243,246,.35) 60%, rgba(240,243,246,.2))" }} />
          <div className="hw-fog absolute -inset-x-[15%] top-[38%] h-[30%] blur-md" style={{ background: "radial-gradient(60% 50% at 50% 50%, rgba(255,255,255,.75), transparent 70%)" }} />
        </>
      ) : null}

      {/* 時間帯：朝はやわらかい光、夕方は茜色、夜は群青 */}
      {phase === "morning" ? (
        <div className="absolute inset-0 mix-blend-soft-light" style={{ background: "linear-gradient(180deg, rgba(255,226,170,.55), transparent 60%)" }} />
      ) : phase === "evening" ? (
        <div className="absolute inset-0 mix-blend-multiply" style={{ background: `linear-gradient(180deg, rgba(255,170,110,${0.55 - o * 0.3}) 0%, rgba(255,196,140,${0.35 - o * 0.2}) 50%, rgba(255,214,170,.12) 100%)` }} />
      ) : phase === "night" ? (
        <div className="absolute inset-0 mix-blend-multiply" style={{ background: "linear-gradient(180deg, rgba(38,52,120,.78) 0%, rgba(52,66,130,.62) 45%, rgba(60,72,128,.55) 100%)" }} />
      ) : null}

      {/* 暑い日は空気があたたかい色に、寒い日は少し青く */}
      {w.temp != null && w.temp >= 30 && phase !== "night" ? (
        <div className="hw-glow absolute inset-0 mix-blend-multiply" style={{ background: `linear-gradient(180deg, rgba(255,196,140,${Math.min(0.45, 0.2 + (w.temp - 30) * 0.04)}), rgba(255,220,170,.12) 70%, transparent)` }} />
      ) : w.temp != null && w.temp <= 3 && phase !== "night" ? (
        <div className="absolute inset-0 mix-blend-multiply" style={{ background: "linear-gradient(180deg, rgba(200,222,255,.45), rgba(214,230,255,.2) 70%, rgba(230,240,255,.12))" }} />
      ) : null}

      {/* 雪の日は、芝が うっすら白くなる */}
      {w.kind === "snow" ? <div className="absolute inset-x-0 bottom-0 h-[48%]" style={{ background: "linear-gradient(180deg, transparent, rgba(250,252,255,.45) 45%, rgba(250,252,255,.62))" }} /> : null}

      {/* 晴れた昼は、空の上から日差し */}
      {clearish && (phase === "day" || phase === "morning") ? (
        <div className="hw-glow absolute inset-0" style={{ background: "radial-gradient(55% 60% at 58% -8%, rgba(255,246,200,.75), rgba(255,240,190,.25) 45%, transparent 70%)" }} />
      ) : null}

      {/* 晴れた夜は星がまたたく */}
      {phase === "night" && o < 0.6
        ? Array.from({ length: 16 }, (_, i) => (
            <span
              key={`s${i}`}
              className="hw-twinkle absolute rounded-full bg-[#FFF8DC]"
              style={{
                left: `${32 + seeded(i, 1) * 64}%`,
                top: `${2 + seeded(i, 2) * 30}%`,
                width: `${1.5 + seeded(i, 3) * 1.8}px`,
                height: `${1.5 + seeded(i, 3) * 1.8}px`,
                opacity: 1 - o,
                animationDelay: `${-seeded(i, 4) * 2.6}s`,
                boxShadow: "0 0 4px rgba(255,248,220,.9)",
              }}
            />
          ))
        : null}

      {/* 雨 */}
      {Array.from({ length: drops }, (_, i) => (
        <span
          key={`r${i}`}
          className="hw-rain absolute top-0 w-[1.5px] rounded-full"
          style={{
            left: `${seeded(i, 5) * 112}%`,
            height: w.kind === "drizzle" ? "8px" : `${12 + seeded(i, 6) * 8}px`,
            background: "linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,.95))",
            boxShadow: "0 0 1px rgba(90,110,140,.35)",
            animationDuration: `${(w.kind === "drizzle" ? 1.1 : 0.62) + seeded(i, 7) * 0.3}s`,
            animationDelay: `${-seeded(i, 8) * 1.2}s`,
          }}
        />
      ))}
      {rainy && drops > 0 ? <div className="absolute inset-x-0 bottom-0 h-[30%]" style={{ background: "linear-gradient(180deg, transparent, rgba(120,140,170,.18))" }} /> : null}

      {/* 雪 */}
      {Array.from({ length: flakes }, (_, i) => (
        <span
          key={`f${i}`}
          className="hw-snow absolute top-0 rounded-full bg-white"
          style={{
            left: `${seeded(i, 9) * 100}%`,
            width: `${2.5 + seeded(i, 10) * 3}px`,
            height: `${2.5 + seeded(i, 10) * 3}px`,
            opacity: 0.7 + seeded(i, 11) * 0.3,
            animationDuration: `${5 + seeded(i, 12) * 4}s`,
            animationDelay: `${-seeded(i, 13) * 9}s`,
            boxShadow: "0 0 3px rgba(255,255,255,.9)",
          }}
        />
      ))}

      {/* 雷：ときどき空が光る */}
      {w.kind === "thunder" ? <div className="hw-flash absolute inset-0 bg-[#F4F1FF]" /> : null}
    </div>
  );
}

const fmtTemp = (t: number) => `${Math.round(t)}`;

/** 夜の晴れは、お日さまではなく月にする */
const iconOf = (kind: WeatherKind, phase: SkyPhase) =>
  phase === "night" && kind === "clear" ? { label: "晴れ", icon: "🌙" } : phase === "night" && kind === "partly" ? { label: "晴れ時々くもり", icon: "☁️" } : WEATHER_LABEL[kind];

/** 気温の数字。色は気温で変わる（寒いと青 → ちょうどいいと緑 → 暑いと赤） */
function Temp({ t, className, style }: { t: number; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`tabular-nums ${className ?? ""}`} style={{ color: tempColor(t), ...style }}>
      {fmtTemp(t)}
    </span>
  );
}

const TONE = {
  best: { text: "#2E8B4E", bg: "#E4F5E5", ring: "#9ED3A6" },
  good: { text: "#3C7FA8", bg: "#E3F0F8", ring: "#A9CDE3" },
  care: { text: "#C0661E", bg: "#FFF0DC", ring: "#F0C48E" },
  stay: { text: "#6B6F86", bg: "#ECEDF3", ring: "#C2C5D6" },
} as const;

/** 空に浮かぶお天気チップ。看板とボタンのあいだの空に置く */
export function HomeWeatherChip() {
  const hw = useHomeWeather();
  const [open, setOpen] = useState(false);
  if (!hw) return null;
  const { weather: w, forecast: f } = hw;
  const info = iconOf(w.kind, hw.phase);
  const tone = TONE[f.tone];
  return (
    <>
      {/* 空の上からロープでつるした木の札。背景の看板と同じ色・ふちどり・葉っぱにそろえる */}
      <div className="pointer-events-none absolute top-0 z-40 flex justify-center" style={{ left: "31%", right: 146, fontSize: "clamp(7px, 2.15vw, 10.5px)" }}>
        <div className="home-rise">
          <div className="hw-sway relative pt-[2.7em]">
            {/* ロープ（ねじれ模様）と、札の上の金具 */}
            {(["left-[20%]", "right-[20%]"] as const).map((side) => (
              <span key={side} className={`absolute top-0 ${side} flex h-[3.25em] w-[0.42em] flex-col items-center`} aria-hidden="true">
                <span className="w-full flex-1 rounded-b-sm border-x-[0.5px] border-[#8E6232]" style={{ background: "repeating-linear-gradient(155deg,#E0B86A 0 0.28em,#B98A45 0.28em 0.42em)" }} />
                <span className="-mt-[0.1em] block h-[0.62em] w-[0.62em] rounded-full border-[0.16em] border-[#8E6232] bg-[#F3D49A]" />
              </span>
            ))}
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              aria-label={`きょうの天気：${info.label}${w.temp != null ? `、${Math.round(w.temp)}度` : ""}。おさんぽ予報：${f.short}。くわしく見る`}
              className="pointer-events-auto relative block rounded-[0.95em] border-[1.5px] border-[#9C6B35] bg-[#F4D79C] p-[0.22em] text-left shadow-[0_2px_0_rgba(140,95,45,.35),0_5px_9px_rgba(80,55,25,.22)] active:scale-[0.96]"
            >
              <span
                className="flex flex-col items-stretch rounded-[0.75em] border border-[#D7AE6E]/80 px-[0.6em] pb-[0.4em] pt-[0.45em]"
                style={{ background: "repeating-linear-gradient(178deg, rgba(196,148,80,0) 0 0.55em, rgba(196,148,80,.09) 0.55em 0.62em), linear-gradient(180deg,#FCEFCD,#F7E3B6)" }}
              >
                <span className="flex items-center gap-[0.35em] leading-none">
                  <span className="text-[1.75em] leading-none [filter:drop-shadow(0_1px_0_rgba(120,80,30,.25))]" aria-hidden="true">{info.icon}</span>
                  {w.temp != null ? (
                    <span className="flex items-start leading-none">
                      <Temp t={w.temp} className="text-[2.15em] font-black tracking-tight [text-shadow:0_1px_0_rgba(255,248,225,.95)]" />
                      <span className="mt-[0.15em] text-[0.95em] font-bold text-[#8b6a43]">℃</span>
                    </span>
                  ) : (
                    <span className="text-[1.1em] font-bold text-[#5b4a35]">{info.label}</span>
                  )}
                  {w.tmax != null && w.tmin != null ? (
                    <span className="ml-[0.1em] flex flex-col gap-[0.2em] border-l border-dashed border-[#C9A06A] pl-[0.35em] text-[0.92em] font-black leading-none">
                      <span className="whitespace-nowrap"><span className="text-[#C9785A]">↑</span><Temp t={w.tmax} /></span>
                      <span className="whitespace-nowrap"><span className="text-[#6F95B8]">↓</span><Temp t={w.tmin} /></span>
                    </span>
                  ) : null}
                </span>
                <span
                  className="mt-[0.4em] flex items-center justify-center gap-[0.25em] whitespace-nowrap rounded-full px-[0.6em] py-[0.25em] text-[0.95em] font-black leading-none"
                  style={{ color: tone.text, background: tone.bg, boxShadow: `inset 0 0 0 1px ${tone.ring}` }}
                >
                  <span>{f.mark}</span>
                  <span>{f.short}</span>
                </span>
              </span>
              {/* 角の葉っぱと小さな花（背景の看板とおそろい） */}
              <svg viewBox="0 0 24 20" className="pointer-events-none absolute -right-[0.7em] -top-[0.75em] h-[1.9em] w-[2.3em]" aria-hidden="true">
                <path d="M4 15 C3 9 8 5 13 6 C12 11 9 15 4 15Z" fill="#9CC665" stroke="#4E7A2C" strokeWidth="0.9" strokeLinejoin="round" />
                <path d="M5 14 L11 8" stroke="#4E7A2C" strokeWidth="0.6" />
                <path d="M9 15 C11 10 16 8 21 10 C19 14 14 17 9 15Z" fill="#B5D77A" stroke="#4E7A2C" strokeWidth="0.9" strokeLinejoin="round" />
                <path d="M10 14.6 L18 11" stroke="#4E7A2C" strokeWidth="0.6" />
              </svg>
              <svg viewBox="0 0 20 20" className="pointer-events-none absolute -bottom-[0.55em] -right-[0.5em] h-[1.5em] w-[1.5em]" aria-hidden="true">
                <path d="M3 13 C2 9 6 7 9 9 C8 12 6 14 3 13Z" fill="#9CC665" stroke="#4E7A2C" strokeWidth="0.8" />
                {[0, 72, 144, 216, 288].map((a) => (
                  <ellipse key={a} cx="12" cy="7.2" rx="2.6" ry="3.2" fill="#FFFDF6" stroke="#B49A72" strokeWidth="0.6" transform={`rotate(${a} 12 10)`} />
                ))}
                <circle cx="12" cy="10" r="1.9" fill="#F4C542" stroke="#C99A24" strokeWidth="0.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {open ? <WeatherSheet hw={hw} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** 天気ごとのくわしい画面の上の色 */
const SHEET_SKY: Record<WeatherKind, string> = {
  clear: "linear-gradient(160deg,#FFF3C4,#D6EEFF 70%)",
  partly: "linear-gradient(160deg,#FFF6D6,#DCEAF6 70%)",
  cloudy: "linear-gradient(160deg,#EEF1F5,#D3DBE6 70%)",
  fog: "linear-gradient(160deg,#F6F7F9,#E2E6EC 70%)",
  drizzle: "linear-gradient(160deg,#E8EEF5,#C9D5E3 70%)",
  rain: "linear-gradient(160deg,#DFE6EF,#B8C6D8 70%)",
  snow: "linear-gradient(160deg,#F7FAFF,#DCE7F5 70%)",
  thunder: "linear-gradient(160deg,#D9DCEA,#A9AFC8 70%)",
};
const NIGHT_SKY = "linear-gradient(160deg,#3A4A8A,#22305E 75%)";

/** 温度計の目もり（左はし・右はし） */
const SCALE_MIN = -5, SCALE_MAX = 38;
const pos = (t: number) => `${Math.max(0, Math.min(100, ((t - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100))}%`;

function WeatherSheet({ hw, onClose }: { hw: HomeWeather; onClose: () => void }) {
  const { weather: w, place, forecast: f, phase } = hw;
  const info = iconOf(w.kind, phase);
  const tone = TONE[f.tone];
  const night = phase === "night";
  const penalty = w.kind === "thunder" ? MOOD_THUNDER_PENALTY : w.kind === "rain" ? MOOD_RAIN_PENALTY : 0;
  const at = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "numeric", minute: "2-digit" }).format(new Date(w.at));
  const scale = Array.from({ length: 9 }, (_, i) => SCALE_MIN + ((SCALE_MAX - SCALE_MIN) * i) / 8).map((t) => tempColor(t)).join(",");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[700] flex items-end justify-center bg-[#1d2433]/45 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="きょうのお天気"
        onClick={(e) => e.stopPropagation()}
        className="room-sv-pop w-full max-w-sm overflow-hidden rounded-[28px] border border-[#DCE3EC] bg-[#FBFCFE] shadow-2xl"
      >
        {/* 上：天気と気温 */}
        <div className="relative px-5 pb-4 pt-4" style={{ background: night ? NIGHT_SKY : SHEET_SKY[w.kind] }}>
          <div className="flex items-center justify-between gap-2">
            <p className={`text-[11px] font-black tracking-[0.18em] ${night ? "text-[#C9D3F5]" : "text-[#6E86A3]"}`}>TODAY&apos;S WEATHER</p>
            <p className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${night ? "bg-white/15 text-white" : "bg-white/70 text-[#4A5A70]"}`}>📍 {placeLabel(place)}</p>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-[54px] leading-none [filter:drop-shadow(0_3px_4px_rgba(0,0,0,.15))]" aria-hidden="true">{info.icon}</span>
            <div className="min-w-0">
              <p className={`text-[13px] font-black ${night ? "text-white" : "text-[#3D4A5C]"}`}>{info.label}</p>
              {w.temp != null ? (
                <p className="flex items-start leading-none">
                  <span
                    className="rounded-xl px-1.5 text-[44px] font-black tabular-nums tracking-tight"
                    style={{ color: tempColor(w.temp), background: night ? "rgba(255,255,255,.88)" : "transparent", textShadow: "0 1px 0 rgba(255,255,255,.9)" }}
                  >
                    {fmtTemp(w.temp)}
                  </span>
                  <span className={`mt-1.5 text-[16px] font-bold ${night ? "text-[#C9D3F5]" : "text-[#6E7F94]"}`}>℃</span>
                  <span className="mt-2 ml-2 rounded-full px-2 py-0.5 text-[11px] font-black text-white" style={{ background: tempColor(w.temp) }}>{tempWord(w.temp)}</span>
                </p>
              ) : null}
            </div>
          </div>

          {/* 温度計：きょうの最低〜最高の幅と、いまの気温 */}
          {w.temp != null ? (
            <div className="mt-3">
              <div className="relative h-[10px] rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,.15)]" style={{ background: `linear-gradient(90deg,${scale})`, opacity: 0.95 }}>
                {w.tmin != null && w.tmax != null ? (
                  <span className="absolute -inset-y-[3px] rounded-full border-2 border-white/95 shadow-[0_1px_3px_rgba(0,0,0,.2)]" style={{ left: pos(w.tmin), right: `calc(100% - ${pos(w.tmax)})` }} />
                ) : null}
                <span className="absolute top-1/2 h-[16px] w-[16px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_1px_4px_rgba(0,0,0,.3)]" style={{ left: pos(w.temp), background: tempColor(w.temp) }} />
              </div>
              <div className={`mt-1 flex justify-between text-[9px] font-bold tabular-nums ${night ? "text-[#AEB9DE]" : "text-[#8796A8]"}`}>
                <span>{SCALE_MIN}℃</span><span>10℃</span><span>20℃</span><span>30℃</span><span>{SCALE_MAX}℃</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-3 px-4 pb-4 pt-3.5">
          {/* 数字のならび */}
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <Stat label="最高" value={w.tmax != null ? <><Temp t={w.tmax} />℃</> : "—"} />
            <Stat label="最低" value={w.tmin != null ? <><Temp t={w.tmin} />℃</> : "—"} />
            <Stat label="降水確率" value={w.pop != null ? `${Math.round(w.pop)}%` : "—"} />
            <Stat label="風" value={`${Math.round(w.wind / 3.6)}m/s`} />
          </div>

          {/* おさんぽ予報 */}
          <section className="flex items-center gap-3 rounded-2xl px-3.5 py-3" style={{ background: tone.bg, boxShadow: `inset 0 0 0 1px ${tone.ring}` }}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[22px] font-black shadow-sm" style={{ color: tone.text }}>{f.mark}</span>
            <div className="min-w-0">
              <p className="text-[10px] font-black tracking-[0.12em]" style={{ color: tone.text }}>🐾 おさんぽ予報</p>
              <p className="text-[15px] font-black text-[#3D4A5C]">{f.short}</p>
              <p className="mt-0.5 text-[11px] font-bold leading-snug text-[#5D6B7E]">{f.advice}</p>
            </div>
          </section>

          {penalty ? (
            <p className="rounded-xl bg-[#F4F1FA] px-3 py-2 text-[11px] font-bold leading-snug text-[#6B5F86]">
              ☂️ 雨の日は おさんぽに行けないので、マイルームの犬の ごきげんが 少し下がります（−{penalty}）
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <Link href="/room" className="rounded-full border border-[#D6DEE8] bg-white py-2.5 text-center text-[12px] font-bold text-[#4A5A70] active:scale-95">
              {place.saved ? "場所をかえる" : "場所をえらぶ"}
            </Link>
            <button type="button" onClick={onClose} className="rounded-full bg-[linear-gradient(180deg,#6FA3D8,#4C82BD)] py-2.5 text-center text-[12px] font-black text-white shadow-sm active:scale-95">とじる</button>
          </div>
          <p className="text-center text-[9.5px] font-semibold text-[#9AA6B5]">
            {place.saved ? "" : "場所は マイルームの「きょうの空」で えらべます（いまは東京）・"}
            {at} 時点・天気データ Open-Meteo
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#E3E9F0] bg-white px-1 py-1.5">
      <p className="text-[9.5px] font-bold text-[#8796A8]">{label}</p>
      <p className="mt-0.5 text-[14px] font-black tabular-nums text-[#3D4A5C]">{value}</p>
    </div>
  );
}
