import { getMunicipality } from "@/lib/geo/municipalities";
import { PREFECTURE_NAMES } from "@/lib/geo/prefecture-names";

export const MAX_TRIP_DESTINATION_AREAS = 12;

export type TripDestinationArea = {
  prefectureCode: string;
  municipalityCode: string | null;
};

const PREFECTURE_CODE_SET = new Set(PREFECTURE_NAMES.map((item) => item.code));

function decode(value: unknown): unknown {
  if (value === null || value === undefined || value === "") return [];
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function parseArea(value: unknown): TripDestinationArea | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const prefectureCode = typeof item.prefectureCode === "string" ? item.prefectureCode : "";
  const municipalityCode = item.municipalityCode === null || item.municipalityCode === ""
    ? null
    : typeof item.municipalityCode === "string"
      ? item.municipalityCode
      : "";

  if (!PREFECTURE_CODE_SET.has(prefectureCode)) return null;
  if (municipalityCode !== null) {
    const municipality = getMunicipality(municipalityCode);
    if (!municipality || municipality.prefectureCode !== prefectureCode) return null;
  }

  return { prefectureCode, municipalityCode };
}

/**
 * フォーム入力とDB(JSONB)の両方を同じ形へ正規化する。
 * 行き先は旅行の概要情報であり、訪問実績や地図の塗りつぶしには使わない。
 */
export function readTripDestinationAreas(value: unknown): {
  areas: TripDestinationArea[];
  valid: boolean;
} {
  const decoded = decode(value);
  if (!Array.isArray(decoded) || decoded.length > MAX_TRIP_DESTINATION_AREAS) {
    return { areas: [], valid: false };
  }

  const unique = new Map<string, TripDestinationArea>();
  for (const raw of decoded) {
    const area = parseArea(raw);
    if (!area) return { areas: [], valid: false };
    const key = `${area.prefectureCode}:${area.municipalityCode ?? "*"}`;
    unique.set(key, area);
  }

  return { areas: [...unique.values()], valid: true };
}

export function parseTripDestinationAreas(value: unknown): TripDestinationArea[] {
  return readTripDestinationAreas(value).areas;
}

export function tripDestinationAreaLabel(area: TripDestinationArea): string {
  if (area.municipalityCode) {
    const municipality = getMunicipality(area.municipalityCode);
    if (municipality) return municipality.name;
  }
  return PREFECTURE_NAMES.find((item) => item.code === area.prefectureCode)?.name ?? area.prefectureCode;
}

export function tripDestinationSummary(areas: TripDestinationArea[]): string {
  if (areas.length === 0) return "";
  const labels = areas.map(tripDestinationAreaLabel);
  if (labels.length <= 2) return labels.join("・");
  return `${labels.slice(0, 2).join("・")} ほか${labels.length - 2}件`;
}
