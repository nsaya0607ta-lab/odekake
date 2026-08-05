export type AreaTone = "pink" | "green" | "blue" | "yellow" | "purple" | "orange" | "teal" | "rose";

export type PrefectureAreaMunicipality = {
  code: string;
  name: string;
  d: string | null;
  center: [number, number] | null;
  span: number;
  lat: number | null;
  lng: number | null;
  spotCount: number;
  visitCount: number;
  favoriteCount: number;
  level: number;
};

export type PrefectureArea = {
  slug: string;
  name: string;
  /** 地図上に置く短い表示名 */
  label: string;
  tone: AreaTone;
  center: [number, number];
  municipalities: PrefectureAreaMunicipality[];
  spotCount: number;
  visitCount: number;
  favoriteCount: number;
  visitedMunicipalityCount: number;
};

type PointItem = PrefectureAreaMunicipality & { point: [number, number] };

const AREA_TONES: readonly AreaTone[] = [
  "pink",
  "blue",
  "green",
  "yellow",
  "purple",
  "teal",
  "orange",
  "rose",
];

function pointOf(item: PrefectureAreaMunicipality, fallbackIndex: number): [number, number] {
  if (item.center) return item.center;
  if (item.lat !== null && item.lng !== null) return [item.lng, -item.lat];
  return [fallbackIndex, 0];
}

function boundsOf(items: PointItem[]) {
  const xs = items.map((item) => item.point[0]);
  const ys = items.map((item) => item.point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: Math.max(maxX - minX, 0.0001),
    height: Math.max(maxY - minY, 0.0001),
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

function centroidOf(items: PointItem[]): [number, number] {
  const total = items.reduce(
    (sum, item) => [sum[0] + item.point[0], sum[1] + item.point[1]] as [number, number],
    [0, 0] as [number, number],
  );
  return [total[0] / items.length, total[1] / items.length];
}

function targetAreaCount(municipalityCount: number): number {
  if (municipalityCount <= 1) return municipalityCount;
  // 1エリア内をおおむね8〜13自治体に抑え、拡大先で名称を読める密度にする。
  return Math.min(14, Math.max(2, Math.ceil(municipalityCount / 8)));
}

/**
 * 全都道府県で共通利用できる、位置ベースの自動エリア分割。
 * 最も広がりの大きいグループを縦または横に二分し、地理的に近い自治体をまとめる。
 */
function splitIntoGeographicClusters(items: PointItem[], targetCount: number): PointItem[][] {
  const clusters: PointItem[][] = [items];

  while (clusters.length < targetCount) {
    let splitIndex = -1;
    let splitScore = -1;

    clusters.forEach((cluster, index) => {
      if (cluster.length < 2) return;
      const bounds = boundsOf(cluster);
      const score = cluster.length * Math.max(bounds.width, bounds.height);
      if (score > splitScore) {
        splitScore = score;
        splitIndex = index;
      }
    });

    if (splitIndex < 0) break;

    const cluster = clusters[splitIndex];
    const bounds = boundsOf(cluster);
    const axis = bounds.width >= bounds.height ? 0 : 1;
    const sorted = [...cluster].sort((a, b) => a.point[axis] - b.point[axis]);
    const middle = Math.ceil(sorted.length / 2);
    const first = sorted.slice(0, middle);
    const second = sorted.slice(middle);

    if (first.length === 0 || second.length === 0) break;
    clusters.splice(splitIndex, 1, first, second);
  }

  return clusters;
}

function directionOf(center: [number, number], allBounds: ReturnType<typeof boundsOf>): string {
  const normalizedX = (center[0] - allBounds.centerX) / (allBounds.width / 2);
  // SVG座標は北側ほどYが小さいため反転する。
  const normalizedY = (allBounds.centerY - center[1]) / (allBounds.height / 2);
  const distance = Math.hypot(normalizedX, normalizedY);
  if (distance < 0.22) return "中央部";

  const angle = (Math.atan2(normalizedY, normalizedX) * 180) / Math.PI;
  if (angle >= -22.5 && angle < 22.5) return "東部";
  if (angle >= 22.5 && angle < 67.5) return "北東部";
  if (angle >= 67.5 && angle < 112.5) return "北部";
  if (angle >= 112.5 && angle < 157.5) return "北西部";
  if (angle >= 157.5 || angle < -157.5) return "西部";
  if (angle >= -157.5 && angle < -112.5) return "南西部";
  if (angle >= -112.5 && angle < -67.5) return "南部";
  return "南東部";
}

function shortMunicipalityName(name: string): string {
  const withoutCounty = name.replace(/^.+郡/, "");
  return withoutCounty.length <= 9 ? withoutCounty : withoutCounty.slice(-9);
}

function closestMunicipality(
  items: PointItem[],
  center: [number, number],
  allBounds: ReturnType<typeof boundsOf>,
): PointItem {
  return [...items].sort((a, b) => {
    const distanceOf = (item: PointItem) => {
      const x = (item.point[0] - center[0]) / allBounds.width;
      const y = (item.point[1] - center[1]) / allBounds.height;
      return Math.hypot(x, y);
    };
    return distanceOf(a) - distanceOf(b);
  })[0];
}

/** 全47都道府県を同じ規則で、拡大表示しやすいエリアへ分割する。 */
export function buildPrefectureAreas(items: PrefectureAreaMunicipality[]): PrefectureArea[] {
  if (items.length === 0) return [];

  const points: PointItem[] = items.map((item, index) => ({ ...item, point: pointOf(item, index) }));
  const allBounds = boundsOf(points);
  const clusters = splitIntoGeographicClusters(points, targetAreaCount(points.length));

  const sortedClusters = clusters
    .map((cluster) => ({ cluster, center: centroidOf(cluster) }))
    .sort((a, b) => a.center[1] - b.center[1] || a.center[0] - b.center[0]);

  return sortedClusters.map(({ cluster, center }, index) => {
    const anchor = closestMunicipality(cluster, center, allBounds);
    const anchorName = shortMunicipalityName(anchor.name);
    const labelBase = anchorName.replace(/[市区町村]$/, "");
    const direction = directionOf(center, allBounds);
    const municipalities = cluster
      .map(({ point: _point, ...item }) => item)
      .sort((a, b) => a.code.localeCompare(b.code));

    return {
      slug: `m${anchor.code}`,
      name: `${direction}・${anchorName}周辺`,
      label: `${labelBase}周辺`,
      tone: AREA_TONES[index % AREA_TONES.length],
      center,
      municipalities,
      spotCount: municipalities.reduce((sum, item) => sum + item.spotCount, 0),
      visitCount: municipalities.reduce((sum, item) => sum + item.visitCount, 0),
      favoriteCount: municipalities.reduce((sum, item) => sum + item.favoriteCount, 0),
      visitedMunicipalityCount: municipalities.filter((item) => item.level > 0).length,
    };
  });
}

export function findPrefectureArea(areas: PrefectureArea[], slug: string): PrefectureArea | undefined {
  return areas.find((area) => area.slug === slug);
}

/** 選択したエリアだけを拡大表示するためのviewBoxを作る。 */
export function viewBoxForMunicipalityArea(
  items: PrefectureAreaMunicipality[],
  fallbackViewBox: string,
): string {
  const positioned = items.filter((item) => item.center !== null);
  if (positioned.length === 0) return fallbackViewBox;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  positioned.forEach((item) => {
    const center = item.center as [number, number];
    const half = Math.max(item.span / 2, 0.002);
    minX = Math.min(minX, center[0] - half);
    maxX = Math.max(maxX, center[0] + half);
    minY = Math.min(minY, center[1] - half);
    maxY = Math.max(maxY, center[1] + half);
  });

  const width = Math.max(maxX - minX, 0.02);
  const height = Math.max(maxY - minY, 0.02);
  const padding = Math.max(width, height) * 0.12;
  return `${(minX - padding).toFixed(4)} ${(minY - padding).toFixed(4)} ${(width + padding * 2).toFixed(4)} ${(height + padding * 2).toFixed(4)}`;
}
