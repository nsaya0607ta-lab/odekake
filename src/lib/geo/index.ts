import municipalityData from "./municipalities.json";
import prefectureData from "./prefecture-paths.json";
import { getRegionByPrefecture, type Region } from "./regions";

export type Prefecture = {
  code: string;
  name: string;
  /** SVG の path データ（scripts/build-prefecture-paths.mjs で生成） */
  d: string;
  bbox: [number, number, number, number];
  center: [number, number];
  region: Region;
};

export type Municipality = {
  code: string;
  name: string;
  prefectureCode: string;
  lat: number | null;
  lng: number | null;
};

type RawPrefecture = {
  code: string;
  name: string;
  d: string;
  bbox: number[];
  center: number[];
};

export const PREFECTURES: readonly Prefecture[] = (prefectureData as RawPrefecture[]).map((p) => {
  const region = getRegionByPrefecture(p.code);
  if (!region) throw new Error(`地方が未定義の都道府県コードです: ${p.code}`);
  return {
    code: p.code,
    name: p.name,
    d: p.d,
    bbox: [p.bbox[0] ?? 0, p.bbox[1] ?? 0, p.bbox[2] ?? 0, p.bbox[3] ?? 0],
    center: [p.center[0] ?? 0, p.center[1] ?? 0],
    region,
  };
});

export const MUNICIPALITIES = municipalityData as readonly Municipality[];

const PREFECTURE_BY_CODE = new Map(PREFECTURES.map((p) => [p.code, p]));
const MUNICIPALITY_BY_CODE = new Map(MUNICIPALITIES.map((m) => [m.code, m]));

const MUNICIPALITIES_BY_PREFECTURE = new Map<string, Municipality[]>();
for (const m of MUNICIPALITIES) {
  const list = MUNICIPALITIES_BY_PREFECTURE.get(m.prefectureCode);
  if (list) list.push(m);
  else MUNICIPALITIES_BY_PREFECTURE.set(m.prefectureCode, [m]);
}

export function getPrefecture(code: string): Prefecture | undefined {
  return PREFECTURE_BY_CODE.get(code);
}

export function getMunicipality(code: string): Municipality | undefined {
  return MUNICIPALITY_BY_CODE.get(code);
}

export function getPrefecturesByRegion(regionSlug: string): Prefecture[] {
  return PREFECTURES.filter((p) => p.region.slug === regionSlug);
}

export function getMunicipalitiesByPrefecture(prefectureCode: string): Municipality[] {
  return MUNICIPALITIES_BY_PREFECTURE.get(prefectureCode) ?? [];
}

/** 都道府県コードの集合から SVG の viewBox を求める（余白付き） */
export function viewBoxFor(prefectures: readonly Prefecture[], padding = 0.25): string {
  if (prefectures.length === 0) return "0 0 1 1";
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of prefectures) {
    minX = Math.min(minX, p.bbox[0]);
    minY = Math.min(minY, p.bbox[1]);
    maxX = Math.max(maxX, p.bbox[2]);
    maxY = Math.max(maxY, p.bbox[3]);
  }
  return [minX - padding, minY - padding, maxX - minX + padding * 2, maxY - minY + padding * 2]
    .map((v) => v.toFixed(3))
    .join(" ");
}

/** 市区町村名から「〇〇市△△区」の親市名を取り出す（政令指定都市の区のグルーピング用） */
export function parentCityOf(name: string): string | null {
  const match = name.match(/^(.+?市)(.+区)$/);
  return match?.[1] ?? null;
}
