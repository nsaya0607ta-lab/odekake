/**
 * ホーム上部の犬カードに出す「きょうのお天気」まわりの決めごと。
 * 天気そのものはマイルームと同じ /api/my-room/weather（Open-Meteo）を使い、場所もマイルームで
 * 選んだもの（この端末に保存）を使う。ここは画面に依存しない計算だけを置く。
 */
import { PREFECTURE_NAMES } from "@/lib/geo/prefecture-names";
import { PREF_POINTS, skyAt, type GeoPoint } from "@/lib/room/sun";
import type { RoomWeather, WeatherKind } from "@/lib/room/weather";

/** マイルームが場所を保存しているキー（my-room.tsx と同じものを使う） */
export const PLACE_KEY = "odekake-room-place-v1";

export type SavedPlace = GeoPoint & { pref: string; city?: string };

/** この端末に保存された場所。なければ東京 */
export function readSavedPlace(): SavedPlace & { saved: boolean } {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PLACE_KEY) ?? "null") as Partial<SavedPlace> & { source?: string } | null;
    if (raw && typeof raw.lat === "number" && typeof raw.lon === "number" && Math.abs(raw.lat) <= 90 && Math.abs(raw.lon) <= 180 && typeof raw.pref === "string" && (raw.source === "gps" || raw.source === "pref")) {
      return { lat: raw.lat, lon: raw.lon, pref: raw.pref, ...(typeof raw.city === "string" ? { city: raw.city.slice(0, 20) } : {}), saved: true };
    }
  } catch { /* 読めなければ東京 */ }
  return { ...PREF_POINTS["13"]!, pref: "13", saved: false };
}

/** 場所の短い名前（「岐阜市」「東京」など） */
export function placeLabel(p: SavedPlace): string {
  if (p.city) return p.city.match(/^(.+?市).+区$/)?.[1] ?? p.city;
  return (PREFECTURE_NAMES.find((x) => x.code === p.pref)?.name ?? "東京都").replace(/(都|府|県)$/, "");
}

/** 時間帯（空の重ねと、犬のことばに使う） */
export type SkyPhase = "morning" | "day" | "evening" | "night";
export function skyPhaseOf(date: Date, at: GeoPoint): SkyPhase {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", hour: "numeric", hourCycle: "h23" }).format(date));
  const alt = skyAt(date, at).altitude;
  if (alt < -4) return "night";
  if (h < 11) return "morning";
  if (h >= 13 && alt < 10) return "evening";
  return "day";
}

/**
 * 気温の色。寒いほど青、ちょうどいいと緑、暑いほどオレンジ〜赤。
 * 白っぽいチップの上で読めるよう、どの色も明るさをおさえてある。
 */
const TEMP_STOPS: readonly [number, string][] = [
  [-10, "#5B4FCF"], // 凍える：むらさきがかった青
  [0, "#2F6FD6"], // 氷点下まわり：青
  [8, "#2B95C2"], // さむい：水色
  [15, "#2E9E72"], // すずしい：みどり
  [21, "#5E9B2A"], // ちょうどいい：若草
  [26, "#D08A12"], // あたたかい：やまぶき
  [30, "#E2601F"], // あつい：オレンジ
  [35, "#CF2F3B"], // 猛暑：赤
  [40, "#A3195B"], // 酷暑：赤むらさき
];
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function tempColor(t: number): string {
  const first = TEMP_STOPS[0]!, last = TEMP_STOPS[TEMP_STOPS.length - 1]!;
  if (t <= first[0]) return first[1];
  if (t >= last[0]) return last[1];
  const i = TEMP_STOPS.findIndex(([v]) => v > t);
  const [t0, c0] = TEMP_STOPS[i - 1]!, [t1, c1] = TEMP_STOPS[i]!;
  const k = (t - t0) / (t1 - t0);
  const a = hex(c0), b = hex(c1);
  return `#${a.map((v, j) => Math.round(v + (b[j]! - v) * k).toString(16).padStart(2, "0")).join("")}`;
}

/** 気温のひとこと（くわしい画面用） */
export function tempWord(t: number): string {
  if (t >= 35) return "猛暑";
  if (t >= 30) return "あつい";
  if (t >= 25) return "あたたかい";
  if (t >= 18) return "ちょうどいい";
  if (t >= 12) return "すずしい";
  if (t >= 5) return "さむい";
  return "とてもさむい";
}

export type WalkForecast = {
  /** 「◎」「◯」「△」「✕」 */
  mark: string;
  /** チップに出す短い言葉 */
  short: string;
  /** くわしい画面のアドバイス */
  advice: string;
  tone: "best" | "good" | "care" | "stay";
};

/** 天気と気温から、いまのおさんぽ予報を出す */
export function walkForecastOf(w: RoomWeather, phase: SkyPhase = "day"): WalkForecast {
  const t = w.temp;
  if (w.kind === "thunder") return { mark: "✕", short: "おうちの日", advice: "かみなりが鳴っています。きょうは おうちで あそんであげよう", tone: "stay" };
  if (w.kind === "rain") return { mark: "✕", short: "おうちの日", advice: "雨がふっています。やんだら、短めの おさんぽを", tone: "stay" };
  if (w.kind === "drizzle") return { mark: "△", short: "雨やどりしつつ", advice: "小雨です。レインコートで さっと行くなら OK", tone: "care" };
  if (t != null && t >= 27 && phase === "night") return { mark: "△", short: "夜も あつい", advice: "夜でも暑いです。地面の熱をさわって確かめて、お水を持って短めに", tone: "care" };
  if (t != null && t >= 31) return { mark: "△", short: "あつすぎ！朝夕に", advice: "地面がとても熱くなっています。すずしい朝か夜に、お水を持って", tone: "care" };
  if (t != null && t >= 27) return { mark: "△", short: "日かげで こまめに水", advice: "暑めです。日かげを選んで、こまめに お水を", tone: "care" };
  if (w.kind === "snow") return { mark: "◯", short: "雪あそび日和", advice: "雪です！ 足が冷えないよう、帰ったら肉球をふいてあげて", tone: "good" };
  if (t != null && t <= 3) return { mark: "△", short: "さむい、あったかく", advice: "とても寒いです。服を着せて、短めの おさんぽに", tone: "care" };
  if (w.kind === "fog") return { mark: "△", short: "きりに気をつけて", advice: "きりで見通しが悪いです。車に気をつけて", tone: "care" };
  if (w.pop != null && w.pop >= 60) return { mark: "◯", short: "あとで雨かも", advice: `きょうの降水確率は ${Math.round(w.pop)}%。早めの おさんぽが おすすめ`, tone: "good" };
  if ((w.kind === "clear" || w.kind === "partly") && t != null && t >= 10 && t <= 24) {
    if (phase === "night") return { mark: "◎", short: "夜さんぽ日和", advice: "おだやかな夜です。明るい道を、光るものをつけて歩こう", tone: "best" };
    return { mark: "◎", short: "おさんぽ日和", advice: "気持ちのいい天気です。いつもより遠くまで行ってみよう", tone: "best" };
  }
  return { mark: "◯", short: "おさんぽ OK", advice: "おさんぽに行けそうです。いってらっしゃい！", tone: "good" };
}

/** 天気に合わせて、立ち止まったときの仕草を出やすくする（基本ポーズ名 → 重み） */
export function restWeightsOf(w: RoomWeather | null): Partial<Record<string, number>> {
  if (!w) return {};
  const t = w.temp;
  const k: WeatherKind = w.kind;
  if (k === "thunder") return { sit: 3, sleep: 2, shake: 2 };
  if (k === "rain" || k === "drizzle") return { shake: 4, sit: 2 };
  if (k === "snow") return { happy: 4, shake: 2, sniff: 2 };
  if (t != null && t >= 29) return { sleep: 4, sit: 2, sniff: 0.5 };
  if (t != null && t <= 5) return { shake: 3, sit: 2 };
  if ((k === "clear" || k === "partly") && t != null && t >= 10 && t <= 25) return { happy: 3, sniff: 2 };
  return {};
}
