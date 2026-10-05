/**
 * わんこのおへやの窓の外の天気。気象庁などのデータをまとめた Open-Meteo（無料・キー不要）の「いまの天気」を使う。
 * 取れないとき（オフライン・混雑）は null にして、季節だけの景色にもどす。
 */
import type { SkyState } from "./sun";

export type WeatherKind = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "thunder";

export type RoomWeather = {
  kind: WeatherKind;
  /** WMO の天気コード */
  code: number;
  /** 気温（℃） */
  temp: number | null;
  /** 雲の量（%） */
  cloud: number;
  /** 1時間の降水量（mm） */
  precip: number;
  /** 風速（km/h） */
  wind: number;
  /** きょうの最高・最低気温（℃）。取れなければ null */
  tmax?: number | null;
  tmin?: number | null;
  /** きょうの降水確率のいちばん高い値（%）。取れなければ null */
  pop?: number | null;
  /** 取得した時刻（ISO） */
  at: string;
};

/** WMO の天気コード → 窓の外の天気 */
export function weatherKindOf(code: number, cloud = 0): WeatherKind {
  if (code >= 95) return "thunder";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code === 45 || code === 48) return "fog";
  if (code === 3) return "cloudy";
  if (code === 1 || code === 2) return cloud >= 70 ? "cloudy" : "partly";
  return cloud >= 40 ? "partly" : "clear";
}

export const WEATHER_LABEL: Record<WeatherKind, { label: string; icon: string }> = {
  clear: { label: "晴れ", icon: "☀️" },
  partly: { label: "晴れ時々くもり", icon: "🌤️" },
  cloudy: { label: "くもり", icon: "☁️" },
  fog: { label: "きり", icon: "🌫️" },
  drizzle: { label: "小雨", icon: "🌦️" },
  rain: { label: "雨", icon: "☔" },
  snow: { label: "雪", icon: "❄️" },
  thunder: { label: "雷雨", icon: "⛈️" },
};

/** 空をおおう雲の濃さ（0 青空 〜 1 どんより） */
export function overcastOf(w: RoomWeather | null): number {
  if (!w) return 0;
  const base = { clear: 0, partly: 0.25, cloudy: 0.7, fog: 0.75, drizzle: 0.8, rain: 0.9, snow: 0.85, thunder: 1 }[w.kind];
  return Math.max(base, Math.min(1, w.cloud / 100) * 0.75);
}

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => `#${hex(a).map((v, i) => Math.round(v + (hex(b)[i]! - v) * t).toString(16).padStart(2, "0")).join("")}`;
const gray = (h: string, lift: number) => {
  const [r, g, b] = hex(h) as [number, number, number];
  const y = Math.round(Math.min(255, (r * 0.3 + g * 0.55 + b * 0.15) * (1 + lift)));
  return `#${[y, y, Math.min(255, y + 8)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

/** 天気で空を変える：くもりや雨は空が灰色になり、部屋が暗くなり、朝焼け夕焼けと星が見えにくくなる */
export function withWeather(sky: SkyState, w: RoomWeather | null): SkyState {
  const o = overcastOf(w);
  if (o <= 0) return sky;
  const lift = w?.kind === "fog" ? 0.25 : -0.05;
  return {
    ...sky,
    top: mix(sky.top, gray(sky.top, lift), o * 0.85),
    bottom: mix(sky.bottom, gray(sky.bottom, lift), o * 0.8),
    light: sky.light * (1 - 0.38 * o),
    warm: sky.warm * (1 - 0.8 * o),
    stars: sky.stars * (1 - o),
  };
}

/** API の返事を確かめて形をそろえる */
export function parseRoomWeather(raw: unknown): RoomWeather | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  if (typeof r.code !== "number") return null;
  const cloud = Math.max(0, Math.min(100, num(r.cloud, 0)));
  const opt = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    kind: weatherKindOf(r.code, cloud),
    code: r.code,
    temp: typeof r.temp === "number" && Number.isFinite(r.temp) ? r.temp : null,
    cloud,
    precip: Math.max(0, num(r.precip, 0)),
    wind: Math.max(0, num(r.wind, 0)),
    tmax: opt(r.tmax),
    tmin: opt(r.tmin),
    pop: opt(r.pop) == null ? null : Math.max(0, Math.min(100, opt(r.pop)!)),
    at: typeof r.at === "string" ? r.at : new Date().toISOString(),
  };
}
