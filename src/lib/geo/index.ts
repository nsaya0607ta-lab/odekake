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

/**
 * 地図の縮尺。離島の寄せ先が縮尺ごとに違うため、図形を3種類持っている。
 *   national   … 日本地図（地方を選ぶ）
 *   regional   … 地方地図（都道府県を選ぶ）
 *   prefecture … 都道府県地図（市区町村を選ぶ）
 */
export type MapScope = "national" | "regional" | "prefecture";

/** 図形の変換 [倍率, x の移動量, y の移動量]。x' = x * 倍率 + 移動量 */
export type MapTransform = [number, number, number];

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
  /** 都道府県地図用の図形 */
  prefecture: PrefectureShape;
};

/** 位置を動かして描いている離島の枠。地図上に破線と見出しを描くために使う */
export type MapInset = {
  id: string;
  label: string;
  prefectureCode: string;
  region: Region;
  /** この枠に入る緯度経度の範囲 [西, 南, 東, 北] */
  bounds: [number, number, number, number];
  /** 縮尺ごとの枠 [x, y, width, height]。寄せない縮尺では持たない */
  frames: Partial<Record<MapScope, [number, number, number, number]>>;
  /** 縮尺ごとの変換。市区町村の点にも同じものを適用する */
  transforms: Partial<Record<MapScope, MapTransform>>;
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
  pd: string;
  pbbox: number[];
  pcenter: number[];
};

type RawInset = {
  id: string;
  label: string;
  prefectureCode: string;
  bounds: number[];
  national?: number[];
  regional?: number[];
  prefecture?: number[];
  nationalTransform?: number[];
  regionalTransform?: number[];
  prefectureTransform?: number[];
};

const box = (values: number[]): [number, number, number, number] => [
  values[0] ?? 0,
  values[1] ?? 0,
  values[2] ?? 0,
  values[3] ?? 0,
];

const triple = (values: number[]): MapTransform => [values[0] ?? 1, values[1] ?? 0, values[2] ?? 0];

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
    prefecture: {
      d: p.pd,
      bbox: box(p.pbbox),
      center: [p.pcenter[0] ?? 0, p.pcenter[1] ?? 0],
    },
  };
});

export const MAP_INSETS: readonly MapInset[] = (insetData as RawInset[]).map((inset) => {
  const region = getRegionByPrefecture(inset.prefectureCode);
  if (!region) throw new Error(`地方が未定義の都道府県コードです: ${inset.prefectureCode}`);

  const frames: MapInset["frames"] = {};
  const transforms: MapInset["transforms"] = {};
  for (const scope of ["national", "regional", "prefecture"] as const) {
    const frame = inset[scope];
    const transform = inset[`${scope}Transform`];
    if (frame) frames[scope] = box(frame);
    if (transform) transforms[scope] = triple(transform);
  }

  return {
    id: inset.id,
    label: inset.label,
    prefectureCode: inset.prefectureCode,
    region,
    bounds: box(inset.bounds),
    frames,
    transforms,
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
      i.transforms[scope] &&
      lng >= i.bounds[0] &&
      lng <= i.bounds[2] &&
      lat >= i.bounds[1] &&
      lat <= i.bounds[3],
  );
  const [scale, tx, ty] = inset?.transforms[scope] ?? [1, 0, 0];
  return [lng * LAT_K * scale + tx, -lat * scale + ty];
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
    const frame = i.frames[scope];
    if (!frame) return false;
    const [fx, fy, fw, fh] = frame;
    return x >= fx && x <= fx + fw && y >= fy && y <= fy + fh;
  });
  const [scale, tx, ty] = inset?.transforms[scope] ?? [1, 0, 0];
  return [-(y - ty) / scale, (x - tx) / (LAT_K * scale)];
}

/** 指定した縮尺での図形を取り出す */
export function shapeOf(prefecture: Prefecture, scope: MapScope): PrefectureShape {
  if (scope === "national") return prefecture;
  return scope === "regional" ? prefecture.regional : prefecture.prefecture;
}

export type MapInsetFrame = { id: string; label: string; frame: [number, number, number, number] };

function framesOf(insets: readonly MapInset[], scope: MapScope): MapInsetFrame[] {
  return insets.flatMap((inset) => {
    const frame = inset.frames[scope];
    return frame ? [{ id: inset.id, label: inset.label, frame }] : [];
  });
}

export function insetsFor(scope: MapScope, regionSlug?: string): MapInsetFrame[] {
  return framesOf(
    MAP_INSETS.filter((inset) => !regionSlug || inset.region.slug === regionSlug),
    scope,
  );
}

export function insetsOfPrefecture(scope: MapScope, prefectureCode: string): MapInsetFrame[] {
  return framesOf(
    MAP_INSETS.filter((inset) => inset.prefectureCode === prefectureCode),
    scope,
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
    const frame = inset.frames[scope];
    if (!frame) continue;
    hasInset = true;
    include([frame[0], frame[1], frame[0] + frame[2], frame[1] + frame[3]]);
  }

  // 枠の見出しは枠の上へ描くので、その分の余白を足す
  const labelRoom = hasInset ? (maxY - minY) * 0.035 : 0;
  const top = minY - labelRoom;
  const pad = padding ?? Math.max(maxX - minX, maxY - top) * 0.04;

  return [minX - pad, top - pad, maxX - minX + pad * 2, maxY - top + pad * 2]
    .map((v) => v.toFixed(3))
    .join(" ");
}

