/**
 * 日本（東京）での、いまの太陽と月。わんこのおへやの窓の外と部屋の明るさに使う。
 * 太陽の高さ・方角は NOAA の簡易式（誤差は1度ほど）、月齢は朔望月の平均から求める。
 * 季節によって日の出・日の入りの時刻が変わるので、冬は夕方5時前に暗くなり、夏は7時でも明るい。
 */

/** 東京の緯度・経度 */
const LAT = 35.68;
const LON = 139.77;
const RAD = Math.PI / 180;

/** 太陽の高さ（度。地平線が0、マイナスは沈んでいる）と方角（度。北0・東90・南180・西270） */
export function sunPosition(date: Date): { altitude: number; azimuth: number } {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * RAD;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * n) * RAD;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const lst = (gmst * 15 + LON) * RAD;
  const ha = lst - ra;
  const lat = LAT * RAD;
  const alt = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(lat) - Math.sin(lat) * Math.cos(ha));
  return { altitude: alt / RAD, azimuth: ((az / RAD) + 360) % 360 };
}

/** 月齢の割合（0 新月 → 0.5 満月 → 1 新月） */
export function moonPhase(date: Date): number {
  const synodic = 29.530588853;
  const knownNew = Date.UTC(2000, 0, 6, 18, 14);
  const days = (date.getTime() - knownNew) / 86400000;
  return (((days % synodic) + synodic) % synodic) / synodic;
}

/** その日の日の出・日の入り（日本時間の "H:MM"）。10分きざみで高さが0をまたぐところを探して詰める */
export function sunTimes(date: Date): { rise: Date | null; set: Date | null } {
  const ymd = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(date);
  const start = new Date(`${ymd}T00:00:00+09:00`).getTime();
  const altAt = (t: number) => sunPosition(new Date(t)).altitude + 0.833; // 大気の屈折と太陽の半径ぶん
  let rise: Date | null = null, set: Date | null = null;
  const step = 10 * 60_000;
  for (let t = start; t < start + 86400000; t += step) {
    const a = altAt(t), b = altAt(t + step);
    if (a < 0 && b >= 0 && !rise) rise = new Date(t + (step * -a) / (b - a));
    if (a >= 0 && b < 0 && !set) set = new Date(t + (step * a) / (a - b));
  }
  return { rise, set };
}

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c: RGB) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const mixHex = (a: string, b: string, t: number) => toHex(hex(a).map((v, i) => v + (hex(b)[i]! - v) * t) as RGB);

/**
 * 太陽の高さごとの空と部屋の明るさ。あいだは補間する。
 * light は部屋の明るさ（0 真っ暗〜1 昼）、warm は夕焼け・朝焼けの色の強さ、stars は星の見え方
 */
const SKY_KEYS: { alt: number; top: string; bottom: string; light: number; warm: number; stars: number }[] = [
  { alt: -18, top: "#0A0F2C", bottom: "#1A2150", light: 0, warm: 0, stars: 1 },
  { alt: -12, top: "#101845", bottom: "#28306A", light: 0.04, warm: 0.05, stars: 0.9 },
  { alt: -6, top: "#1D2C68", bottom: "#B86A8A", light: 0.16, warm: 0.55, stars: 0.45 },
  { alt: -2, top: "#3A579C", bottom: "#F0956A", light: 0.32, warm: 0.95, stars: 0.1 },
  { alt: 3, top: "#5F98D2", bottom: "#FFBE86", light: 0.55, warm: 0.85, stars: 0 },
  { alt: 10, top: "#6FB3E6", bottom: "#FFE0B4", light: 0.8, warm: 0.4, stars: 0 },
  { alt: 25, top: "#62B2EC", bottom: "#CDEAFF", light: 1, warm: 0.08, stars: 0 },
  { alt: 90, top: "#4FA6E8", bottom: "#D4EEFF", light: 1, warm: 0, stars: 0 },
];

export type SkyState = { altitude: number; azimuth: number; top: string; bottom: string; light: number; warm: number; stars: number; moon: number };

export function skyAt(date: Date): SkyState {
  const { altitude, azimuth } = sunPosition(date);
  const a = Math.max(-18, Math.min(90, altitude));
  let i = 0;
  while (i < SKY_KEYS.length - 2 && a > SKY_KEYS[i + 1]!.alt) i++;
  const k0 = SKY_KEYS[i]!, k1 = SKY_KEYS[i + 1]!;
  const t = (a - k0.alt) / (k1.alt - k0.alt);
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return {
    altitude, azimuth,
    top: mixHex(k0.top, k1.top, t), bottom: mixHex(k0.bottom, k1.bottom, t),
    light: lerp(k0.light, k1.light), warm: lerp(k0.warm, k1.warm), stars: lerp(k0.stars, k1.stars),
    moon: moonPhase(date),
  };
}

export function fmtJstTime(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "numeric", minute: "2-digit", hourCycle: "h23" }).format(date);
}
