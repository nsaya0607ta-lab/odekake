/**
 * 市区町村マスタ
 * =============================================================
 * 都道府県の地図パス（prefecture-paths.json）とは別のモジュールにしている。
 * 市区町村の選択だけが必要な画面で、地図データまで読み込まないようにするため。
 */
import municipalityData from "./municipalities.json";

export type Municipality = {
  code: string;
  name: string;
  prefectureCode: string;
  lat: number | null;
  lng: number | null;
};

export const MUNICIPALITIES = municipalityData as readonly Municipality[];

const MUNICIPALITY_BY_CODE = new Map(MUNICIPALITIES.map((m) => [m.code, m]));

const MUNICIPALITIES_BY_PREFECTURE = new Map<string, Municipality[]>();
for (const m of MUNICIPALITIES) {
  const list = MUNICIPALITIES_BY_PREFECTURE.get(m.prefectureCode);
  if (list) list.push(m);
  else MUNICIPALITIES_BY_PREFECTURE.set(m.prefectureCode, [m]);
}

export function getMunicipality(code: string): Municipality | undefined {
  return MUNICIPALITY_BY_CODE.get(code);
}

export function getMunicipalitiesByPrefecture(prefectureCode: string): Municipality[] {
  return MUNICIPALITIES_BY_PREFECTURE.get(prefectureCode) ?? [];
}

/** 2点間のおおよその距離（メートル） */
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const latMeters = (aLat - bLat) * 111_320;
  const lngMeters = (aLng - bLng) * 111_320 * Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  return Math.hypot(latMeters, lngMeters);
}

/**
 * 緯度経度にいちばん近い市区町村を、代表座標との距離で選ぶ。
 * 境界データを持たないため厳密な判定ではない。現在地や地図選択の入力補助に使う。
 */
export function nearestMunicipality(
  lat: number,
  lng: number,
  prefectureCode?: string,
): { municipality: Municipality; distanceMeters: number } | null {
  const candidates = prefectureCode ? getMunicipalitiesByPrefecture(prefectureCode) : MUNICIPALITIES;
  let best: Municipality | null = null;
  let bestDistance = Infinity;
  for (const m of candidates) {
    if (m.lat === null || m.lng === null) continue;
    const d = distanceMeters(lat, lng, m.lat, m.lng);
    if (d < bestDistance) {
      bestDistance = d;
      best = m;
    }
  }
  return best ? { municipality: best, distanceMeters: bestDistance } : null;
}

/** 市区町村名から「〇〇市△△区」の親市名を取り出す（政令指定都市の区のグルーピング用） */
export function parentCityOf(name: string): string | null {
  const match = name.match(/^(.+?市)(.+区)$/);
  return match?.[1] ?? null;
}
