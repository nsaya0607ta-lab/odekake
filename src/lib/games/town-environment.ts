import { moonPhase, skyAt, sunPosition, sunTimes, type GeoPoint } from "../room/sun";
import { overcastOf, withWeather, type RoomWeather, type WeatherKind } from "../room/weather";

/**
 * The town's sky, light, season and weather. "real" follows the player's saved My Room place and the
 * same Open-Meteo weather as the home screen; the other modes only change what is drawn.
 * Everything here is a pure function of (moment, place, weather, modes) so frames are reproducible.
 */
export type TownTimeMode = "real" | "morning" | "day" | "evening" | "night";
export type TownWeatherMode = "real" | "clear" | "cloudy" | "rain" | "snow";
export type TownSeason = "spring" | "summer" | "autumn" | "winter";

export type TownEnvironment = {
  /** The represented moment (ms). Manual time modes keep today's date. */
  time: number;
  /** Minutes since midnight in Japan time, with seconds as a fraction (clocks use it). */
  minutes: number;
  weekday: number;
  season: TownSeason;
  /** 0..1 cherry blossom, autumn colour and bare winter branches. */
  blossom: number;
  foliage: number;
  bare: number;
  /** Lush deep green of high summer, 0..1. */
  lush: number;
  sun: { altitude: number; azimuth: number };
  moon: { altitude: number; azimuth: number; phase: number };
  skyTop: string;
  skyBottom: string;
  /** Sunrise / sunset glow, 0..1. */
  warm: number;
  stars: number;
  /** 0 = daylight, 1 = full night. Building artwork crossfades to its lit night version. */
  night: number;
  /** Share of street lamps that are lit, 0..1. Each lamp switches on at its own threshold. */
  lightsOn: number;
  windows: "evening" | "late";
  shopsOpen: boolean;
  weather: WeatherKind;
  cloud: number;
  overcast: number;
  rain: number;
  snow: number;
  snowCover: boolean;
  thunder: boolean;
  fog: number;
  /** km/h, and the screen direction the wind blows towards (radians, 0 = right, π/2 = down). */
  wind: number;
  windAngle: number;
  temperature: number | null;
  /** How many people walk and drive at this hour, 0..1. */
  activity: number;
  traffic: number;
  /** Multiply colour for sunset warmth and overcast dimming, or null. */
  grade: string | null;
  /** 0..1 loss of colour under heavy cloud and rain. */
  grey: number;
  live: boolean;
};

const JST = 9 * 3600_000;
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const smooth = (edge0: number, edge1: number, v: number) => { const t = clamp((v - edge0) / (edge1 - edge0)); return t * t * (3 - 2 * t); };
const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export function mixColor(a: string, b: string, t: number) {
  const x = hex(a), y = hex(b);
  return `#${x.map((v, i) => Math.round(v + (y[i]! - v) * clamp(t)).toString(16).padStart(2, "0")).join("")}`;
}
function curve(keys: readonly (readonly [number, number])[], x: number) {
  for (let i = 1; i < keys.length; i++) {
    const [x1, y1] = keys[i]!, [x0, y0] = keys[i - 1]!;
    if (x <= x1) { const t = (x - x0) / (x1 - x0 || 1); return y0 + (y1 - y0) * (t * t * (3 - 2 * t)); }
  }
  return keys[keys.length - 1]![1];
}
/** Japan-time calendar fields for a moment. */
export function jstClock(time: number) {
  const d = new Date(time + JST), start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return {
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60,
    weekday: d.getUTCDay(), month: d.getUTCMonth() + 1,
    dayOfYear: Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86400000) + 1,
    midnight: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - JST,
  };
}
/** The moment drawn for a manual time mode: today, at a representative hour of that part of the day. */
export function representedTime(now: number, mode: TownTimeMode, place: GeoPoint) {
  if (mode === "real") return now;
  const { midnight } = jstClock(now);
  if (mode === "morning") return midnight + 7 * 3600_000;
  if (mode === "day") return midnight + 12.5 * 3600_000;
  if (mode === "night") return midnight + 21 * 3600_000;
  // Just after sunset: an orange horizon while the first windows and lamps light up.
  const set = sunTimes(new Date(midnight + 12 * 3600_000), place).set?.getTime();
  return (set ?? midnight + 17.5 * 3600_000) + 14 * 60_000;
}
const MANUAL_WEATHER: Record<Exclude<TownWeatherMode, "real">, Pick<RoomWeather, "kind" | "code" | "cloud" | "precip">> = {
  clear: { kind: "clear", code: 0, cloud: 5, precip: 0 },
  cloudy: { kind: "cloudy", code: 3, cloud: 92, precip: 0 },
  rain: { kind: "rain", code: 63, cloud: 100, precip: 3.2 },
  snow: { kind: "snow", code: 73, cloud: 100, precip: 1.4 },
};
/** Cherry blossom peaks later further north (Okinawa in winter, Hokkaido in May); autumn colour earlier. */
function seasonal(dayOfYear: number, lat: number) {
  const signed = (a: number, b: number) => { const d = ((a - b) % 365 + 365) % 365; return d > 182 ? d - 365 : d; };
  const after = (a: number, b: number) => ((a - b) % 365 + 365) % 365;
  const blossomPeak = 88 + (lat - 35.7) * 3.6, colourPeak = 331 - (lat - 35.7) * 4.2;
  const blossom = clamp(1 - Math.abs(signed(dayOfYear, blossomPeak)) / 11);
  const fromColour = signed(dayOfYear, colourPeak);
  const foliage = fromColour < -50 || fromColour > 34 ? 0 : fromColour <= 8 ? smooth(-50, 0, fromColour) : 1 - smooth(8, 34, fromColour);
  // Branches are bare from late autumn until the leaves return just after the blossom.
  const d = after(dayOfYear, colourPeak), leavesBack = after(blossomPeak - 8, colourPeak);
  const bare = d < 10 ? 0 : d < 36 ? smooth(10, 36, d) : d < leavesBack ? 1 : d < leavesBack + 24 ? 1 - smooth(leavesBack, leavesBack + 24, d) : 0;
  const lush = clamp(1 - Math.abs(signed(dayOfYear, 205 - (lat - 35.7) * 2)) / 55);
  return { blossom, foliage, bare, lush };
}
export function townEnvironment(input: { now: number; place: GeoPoint; weather: RoomWeather | null; timeMode?: TownTimeMode; weatherMode?: TownWeatherMode; reducedMotion?: boolean }): TownEnvironment {
  const timeMode = input.timeMode ?? "real", weatherMode = input.weatherMode ?? "real";
  const time = representedTime(input.now, timeMode, input.place), date = new Date(time);
  const clock = jstClock(time);
  const base = input.weather;
  const weather: RoomWeather = weatherMode === "real"
    ? base ?? { kind: "partly", code: 2, temp: null, cloud: 30, precip: 0, wind: 6, at: new Date(time).toISOString() }
    : { ...MANUAL_WEATHER[weatherMode], temp: weatherMode === "snow" ? Math.min(-1, base?.temp ?? -1) : base?.temp ?? null, wind: base?.wind ?? 8, windDir: base?.windDir ?? null, at: new Date(time).toISOString() };
  const sun = sunPosition(date, input.place);
  // The moon trails the sun by its phase (new moon beside the sun, full moon opposite).
  const phase = moonPhase(date), moon = sunPosition(new Date(time - phase * 24.84 * 3600_000), input.place);
  const sky = withWeather(skyAt(date, input.place), weather);
  const overcast = overcastOf(weather);
  const kind = weather.kind;
  const rain = kind === "thunder" ? 1 : kind === "rain" ? clamp(.45 + weather.precip / 6, .45, 1) : kind === "drizzle" ? .28 : 0;
  const snow = kind === "snow" ? clamp(.42 + weather.precip / 3, .42, 1) : 0;
  const fog = kind === "fog" ? .72 : kind === "drizzle" ? .16 : kind === "rain" || kind === "thunder" ? .1 : kind === "snow" ? .14 : 0;
  const cloud = Math.max(clamp(weather.cloud / 100), { clear: 0, partly: .32, cloudy: .82, fog: .7, drizzle: .85, rain: .95, snow: .92, thunder: 1 }[kind]);
  // About half an hour of twilight between daylight and a fully lit night town.
  const night = smooth(1, -7, sun.altitude);
  const dark = kind === "thunder" ? .55 : kind === "rain" ? .3 : 0;
  const lightsOn = clamp(Math.max(smooth(1, -4.5, sun.altitude), dark));
  const minutes = clock.minutes, weekend = clock.weekday === 0 || clock.weekday === 6;
  const hour = minutes / 60;
  const activityBase = curve(weekend
    ? [[0, .06], [5.5, .05], [7.5, .22], [10, .72], [13, .86], [16, .82], [18, .62], [20, .36], [22, .16], [24, .06]]
    : [[0, .05], [5, .04], [6.2, .2], [7.6, .88], [9, .52], [12, .64], [13.5, .56], [15.5, .66], [17.6, .92], [19.2, .64], [21, .34], [23, .12], [24, .05]], hour);
  const trafficBase = curve(weekend
    ? [[0, .12], [5, .08], [8, .38], [11, .78], [15, .8], [18, .72], [21, .42], [24, .12]]
    : [[0, .1], [5, .08], [6.5, .48], [7.9, .98], [9.5, .6], [12, .66], [16, .72], [18, .98], [20, .56], [22.5, .26], [24, .1]], hour);
  const activity = activityBase * (kind === "thunder" ? .25 : kind === "snow" ? .45 : kind === "rain" ? .5 : kind === "drizzle" ? .75 : kind === "fog" ? .85 : 1);
  const traffic = trafficBase * (kind === "snow" ? .62 : kind === "thunder" ? .8 : kind === "rain" ? .9 : 1);
  const season: TownSeason = clock.month <= 2 || clock.month === 12 ? "winter" : clock.month <= 5 ? "spring" : clock.month <= 8 ? "summer" : "autumn";
  const daylight = 1 - night;
  let grade = "#ffffff";
  grade = mixColor(grade, "#ffcf9f", sky.warm * .34 * daylight * (1 - overcast * .7));
  grade = mixColor(grade, kind === "rain" || kind === "thunder" ? "#a9b4bf" : "#c4cad0", overcast * (kind === "rain" || kind === "thunder" ? .6 : kind === "drizzle" ? .45 : .34) * daylight);
  if (snow) grade = mixColor(grade, "#dfe7f2", .25 * daylight);
  // Wind directions are where the wind comes from; drawing needs where it blows to.
  // The town looks south: east is screen-left, west is screen-right, north is towards the viewer.
  const from = ((weather.windDir ?? 270) % 360) * Math.PI / 180, toward = from + Math.PI;
  const screenX = -Math.sin(toward), screenY = Math.cos(toward) * .5;
  return {
    time, minutes, weekday: clock.weekday, season, ...seasonal(clock.dayOfYear, input.place.lat),
    sun, moon: { ...moon, phase }, skyTop: sky.top, skyBottom: sky.bottom, warm: sky.warm, stars: clamp(sky.stars * (1 - cloud * .9)),
    night, lightsOn, windows: minutes >= 23.5 * 60 || minutes < 5 * 60 ? "late" : "evening",
    shopsOpen: minutes >= 9.5 * 60 && minutes < 21 * 60,
    weather: kind, cloud, overcast, rain, snow, snowCover: snow > 0, thunder: kind === "thunder", fog,
    wind: weather.wind, windAngle: Math.atan2(screenY, screenX || 1e-6), temperature: weather.temp,
    activity: input.reducedMotion ? Math.min(activity, .55) : activity, traffic,
    grade: grade === "#ffffff" ? null : grade, grey: clamp(overcast - .35) * (kind === "rain" || kind === "thunder" || kind === "drizzle" ? .55 : .35),
    live: timeMode === "real" && weatherMode === "real",
  };
}
/** Japan time "H:MM" for the interface. */
export function townClockLabel(env: Pick<TownEnvironment, "minutes">) {
  const m = Math.floor(env.minutes) % 1440;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}
