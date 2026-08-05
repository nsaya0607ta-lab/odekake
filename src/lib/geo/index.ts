import insetData from "./map-insets.json";
import prefectureData from "./prefecture-paths.json";
import { getRegionByPrefecture, type Region } from "./regions";

export {
  MUNICIPALITIES,
  distanceMeters,
  getMunicipalitiesByPrefecture,
  getMunicipality,
  nearestMunicipality,
  parentCityOf,
  type Municipality,
} from "./municipalities";

/** 日本地図と地方地図では離島の寄せ先が違うため、図形を2種類持っている */
export type MapScope = "national" | "regional";

export type PrefectureShape = {
  /** SVG の path データ（scripts/build-prefecture-paths.mjs で生成） */
  d: string;
  bbox: [number, number, number, number];
  center: [number, number];
};

export type Prefecture = PrefectureShape & {
  code: string;
  name: string;
  region: Region;
  /** 地方地図用の図形（離島の位置だけが異なる） */
  regional: PrefectureShape;
};

/** 位置を動かして描いている離島の枠。地図上に破線と見出しを描くために使う */
export type MapInset = {
  id: string;
  label: string;
  prefectureCode: string;
  region: Region;
  /** この枠に入る緯度経度の範囲 [西, 南, 東, 北] */
  bounds: [number, number, number, number];
  /** [x, y, width, height] */
  national: [number, number, number, number];
  regional: [number, number, number, number];
  /** 図形を寄せるときに足した量。市区町村の点も同じだけ動かす */
  nationalOffset: [number, number];
  regionalOffset: [number, number];
};

type RawPrefecture = {
  code: string;
  name: string;
  d: string;
  bbox: number[];
  center: number[];
  rd: string;
  rbbox: number[];
  rcenter: number[];
};

type RawInset = {
  id: string;
  label: string;
  prefectureCode: string;
  bounds: number[];
  national: number[];
  regional: number[];
  nationalOffset: number[];
  regionalOffset: number[];
};

const box = (values: number[]): [number, number, number, number] => [
  values[0] ?? 0,
  values[1] ?? 0,
  values[2] ?? 0,
  values[3] ?? 0,
];

const pair = (values: number[]): [number, number] => [values[0] ?? 0, values[1] ?? 0];

export const PREFECTURES: readonly Prefecture[] = (prefectureData as RawPrefecture[]).map((p) => {
  const region = getRegionByPrefecture(p.code);
  if (!region) throw new Error(`地方が未定義の都道府県コードです: ${p.code}`);
  return {
    code: p.code,
    name: p.name,
    d: p.d,
    bbox: box(p.bbox),
    center: [p.center[0] ?? 0, p.center[1] ?? 0],
    region,
    regional: {
      d: p.rd,
      bbox: box(p.rbbox),
      center: [p.rcenter[0] ?? 0, p.rcenter[1] ?? 0],
    },
  };
});

export const MAP_INSETS: readonly MapInset[] = (insetData as RawInset[]).map((inset) => {
  const region = getRegionByPrefecture(inset.prefectureCode);
  if (!region) throw new Error(`地方が未定義の都道府県コードです: ${inset.prefectureCode}`);
  return {
    id: inset.id,
    label: inset.label,
    prefectureCode: inset.prefectureCode,
    region,
    bounds: box(inset.bounds),
    national: box(inset.national),
    regional: box(inset.regional),
    nationalOffset: pair(inset.nationalOffset),
    regionalOffset: pair(inset.regionalOffset),
  };
});

/** 経度方向の縮み補正。scripts/build-prefecture-paths.mjs と同じ値 */
const LAT_K = Math.cos((36 * Math.PI) / 180);

/**
 * 緯度経度を地図座標へ変換する。
 * 位置を動かして描いている離島の中の点は、図形と同じだけ動かす。
 */
export function projectPoint(
  lat: number,
  lng: number,
  scope: MapScope,
  prefectureCode?: string,
): [number, number] {
  const inset = MAP_INSETS.find(
    (i) =>
      (!prefectureCode || i.prefectureCode === prefectureCode) &&
      lng >= i.bounds[0] &&
      lng <= i.bounds[2] &&
      lat >= i.bounds[1] &&
      lat <= i.bounds[3],
  );
  const [dx, dy] = inset ? (scope === "national" ? inset.nationalOffset : inset.regionalOffset) : [0, 0];
  return [lng * LAT_K + dx, -lat + dy];
}

/** projectPoint の逆変換。地図上でタップされた位置を緯度経度に戻す */
export function unprojectPoint(
  x: number,
  y: number,
  scope: MapScope,
  prefectureCode?: string,
): [number, number] {
  const inset = MAP_INSETS.find((i) => {
    if (prefectureCode && i.prefectureCode !== prefectureCode) return false;
    const [fx, fy, fw, fh] = scope === "national" ? i.national : i.regional;
    return x >= fx && x <= fx + fw && y >= fy && y <= fy + fh;
  });
  const [dx, dy] = inset ? (scope === "national" ? inset.nationalOffset : inset.regionalOffset) : [0, 0];
  return [-(y - dy), (x - dx) / LAT_K];
}

/** 指定した縮尺での図形を取り出す */
export function shapeOf(prefecture: Prefecture, scope: MapScope): PrefectureShape {
  return scope === "national" ? prefecture : prefecture.regional;
}

const toFrame = (inset: MapInset, scope: MapScope) => ({
  id: inset.id,
  label: inset.label,
  frame: scope === "national" ? inset.national : inset.regional,
});

export function insetsFor(scope: MapScope, regionSlug?: string) {
  return MAP_INSETS.filter((inset) => !regionSlug || inset.region.slug === regionSlug).map((inset) =>
    toFrame(inset, scope),
  );
}

export function insetsOfPrefecture(scope: MapScope, prefectureCode: string) {
  return MAP_INSETS.filter((inset) => inset.prefectureCode === prefectureCode).map((inset) =>
    toFrame(inset, scope),
  );
}

const PREFECTURE_BY_CODE = new Map(PREFECTURES.map((p) => [p.code, p]));
export function getPrefecture(code: string): Prefecture | undefined {
  return PREFECTURE_BY_CODE.get(code);
}

export function getPrefecturesByRegion(regionSlug: string): Prefecture[] {
  return PREFECTURES.filter((p) => p.region.slug === regionSlug);
}

/**
 * 都道府県の集合から SVG の viewBox を求める（余白付き。離島の枠も収める）。
 * padding は地図座標での絶対値。省略すると図形の大きさの 4% を余白にする。
 */
export function viewBoxFor(
  prefectures: readonly Prefecture[],
  scope: MapScope = "national",
  padding?: number,
): string {
  if (prefectures.length === 0) return "0 0 1 1";
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const include = ([x0, y0, x1, y1]: [number, number, number, number]) => {
    minX = Math.min(minX, x0);
    minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
  };

  const codes = new Set(prefectures.map((p) => p.code));
  let hasInset = false;
  for (const p of prefectures) include(shapeOf(p, scope).bbox);
  for (const inset of MAP_INSETS) {
    if (!codes.has(inset.prefectureCode)) continue;
    hasInset = true;
    const [x, y, w, h] = scope === "national" ? inset.national : inset.regional;
    include([x, y, x + w, y + h]);
  }

  // 枠の見出しは枠の上へ描くので、その分の余白を足す
  const labelRoom = hasInset ? (maxY - minY) * 0.035 : 0;
  const top = minY - labelRoom;
  const pad = padding ?? Math.max(maxX - minX, maxY - top) * 0.04;

  return [minX - pad, top - pad, maxX - minX + pad * 2, maxY - top + pad * 2]
    .map((v) => v.toFixed(3))
    .join(" ");
}

