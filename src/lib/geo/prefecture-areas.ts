import officialAreaData from "./official-prefecture-areas.json";

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
  sourceKind: string;
  sourceTitle: string;
  sourceUrl: string;
};

type OfficialAreaDefinition = {
  slug: string;
  name: string;
  label: string;
  tone: AreaTone;
  municipalityCodes: string[];
  sourceKind: string;
  sourceTitle: string;
  sourceUrl: string;
};

type OfficialAreaData = {
  checkedAt: string;
  prefectures: Record<string, OfficialAreaDefinition[]>;
};

const OFFICIAL_AREA_DATA = officialAreaData as unknown as OfficialAreaData;

function pointOf(item: PrefectureAreaMunicipality): [number, number] | null {
  if (item.center) return item.center;
  if (item.lat !== null && item.lng !== null) return [item.lng, -item.lat];
  return null;
}

function centroidOf(items: PrefectureAreaMunicipality[]): [number, number] {
  const points = items.flatMap((item) => {
    const point = pointOf(item);
    return point ? [point] : [];
  });
  if (points.length === 0) return [0, 0];

  const total = points.reduce(
    (sum, point) => [sum[0] + point[0], sum[1] + point[1]] as [number, number],
    [0, 0] as [number, number],
  );
  return [total[0] / points.length, total[1] / points.length];
}

function toPrefectureArea(
  definition: OfficialAreaDefinition,
  municipalities: PrefectureAreaMunicipality[],
): PrefectureArea {
  return {
    slug: definition.slug,
    name: definition.name,
    label: definition.label,
    tone: definition.tone,
    center: centroidOf(municipalities),
    municipalities: [...municipalities].sort((a, b) => a.code.localeCompare(b.code)),
    spotCount: municipalities.reduce((sum, item) => sum + item.spotCount, 0),
    visitCount: municipalities.reduce((sum, item) => sum + item.visitCount, 0),
    favoriteCount: municipalities.reduce((sum, item) => sum + item.favoriteCount, 0),
    visitedMunicipalityCount: municipalities.filter((item) => item.level > 0).length,
    sourceKind: definition.sourceKind,
    sourceTitle: definition.sourceTitle,
    sourceUrl: definition.sourceUrl,
  };
}

/**
 * 総務省統計局の「都道府県内経済圏」を全国共通の公的区分として使用する。
 * 都道府県が行政上の区分を明示している場合は、生成データ側の県別定義を優先する。
 */
export function buildPrefectureAreas(
  prefectureCode: string,
  items: PrefectureAreaMunicipality[],
): PrefectureArea[] {
  if (items.length === 0) return [];

  const definitions = OFFICIAL_AREA_DATA.prefectures[prefectureCode] ?? [];
  const itemByCode = new Map(items.map((item) => [item.code, item]));
  const assigned = new Set<string>();

  const areas = definitions.flatMap((definition) => {
    const municipalities = definition.municipalityCodes.flatMap((code) => {
      const item = itemByCode.get(code);
      if (!item) return [];
      assigned.add(code);
      return [item];
    });
    return municipalities.length > 0 ? [toPrefectureArea(definition, municipalities)] : [];
  });

  // 市区町村マスタの更新が公式データ更新より先行した場合も画面を壊さない。
  // 通常は生成時の完全性検証により、このエリアは作成されない。
  const unassigned = items.filter((item) => !assigned.has(item.code));
  if (unassigned.length > 0) {
    areas.push(
      toPrefectureArea(
        {
          slug: "official-unclassified",
          name: "未分類地域",
          label: "未分類",
          tone: "green",
          municipalityCodes: unassigned.map((item) => item.code),
          sourceKind: "data-update-pending",
          sourceTitle: "公式地域区分の更新待ち",
          sourceUrl: "",
        },
        unassigned,
      ),
    );
  }

  return areas;
}

export function findPrefectureArea(areas: PrefectureArea[], slug: string): PrefectureArea | undefined {
  return areas.find((area) => area.slug === slug);
}

export function officialAreaDataCheckedAt(): string {
  return OFFICIAL_AREA_DATA.checkedAt;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/**
 * 離島などが同じ公式エリアに含まれている場合、全地点をそのまま bounds に入れると
 * 本島側の市区町村が数pxまで縮んでしまう。大きな距離ギャップがある場合だけ、
 * 主要な市区町村群へフォーカスしてタップ可能な大きさを確保する。
 */
function focusMunicipalities(items: PrefectureAreaMunicipality[]): PrefectureAreaMunicipality[] {
  const positioned = items.filter((item): item is PrefectureAreaMunicipality & { center: [number, number] } => item.center !== null);
  if (positioned.length < 5) return positioned;

  const medianX = median(positioned.map((item) => item.center[0]));
  const medianY = median(positioned.map((item) => item.center[1]));
  const ranked = positioned
    .map((item) => ({
      item,
      distance: Math.hypot(item.center[0] - medianX, item.center[1] - medianY),
    }))
    .sort((a, b) => a.distance - b.distance);

  const minimumKeep = Math.max(3, Math.ceil(ranked.length * 0.6));
  let bestCut = ranked.length;
  let bestRatio = 1;

  for (let index = minimumKeep - 1; index < ranked.length - 1; index += 1) {
    const current = ranked[index]?.distance ?? 0;
    const next = ranked[index + 1]?.distance ?? current;
    const ratio = next / Math.max(current, 0.0001);
    if (ratio > 2.2 && ratio > bestRatio) {
      bestRatio = ratio;
      bestCut = index + 1;
    }
  }

  return bestCut < ranked.length ? ranked.slice(0, bestCut).map(({ item }) => item) : positioned;
}

/** 選択したエリアだけを拡大表示するためのviewBoxを作る。 */
export function viewBoxForMunicipalityArea(
  items: PrefectureAreaMunicipality[],
  fallbackViewBox: string,
): string {
  const positioned = focusMunicipalities(items);
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
  const padding = Math.max(width, height) * 0.08;
  return `${(minX - padding).toFixed(4)} ${(minY - padding).toFixed(4)} ${(width + padding * 2).toFixed(4)} ${(height + padding * 2).toFixed(4)}`;
}
