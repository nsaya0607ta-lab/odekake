import { PREFECTURES } from "@/lib/geo";
import { REGIONS } from "@/lib/geo/regions";
import type { AreaStatsRow } from "@/lib/supabase/types";
import type { DB } from "./client";

export type AreaEntry = {
  spotCount: number;
  visitCount: number;
  favoriteCount: number;
  lastVisitedAt: string | null;
};

const EMPTY: AreaEntry = { spotCount: 0, visitCount: 0, favoriteCount: 0, lastVisitedAt: null };

export type AreaIndex = {
  prefecture: Map<string, AreaEntry>;
  municipality: Map<string, AreaEntry>;
  region: Map<string, AreaEntry>;
  totals: {
    visitedPrefectures: number;
    visitedMunicipalities: number;
    spots: number;
    visits: number;
  };
};

function bump(map: Map<string, AreaEntry>, key: string, patch: Partial<AreaEntry>) {
  const current = map.get(key) ?? { ...EMPTY };
  current.spotCount += patch.spotCount ?? 0;
  current.visitCount += patch.visitCount ?? 0;
  current.favoriteCount += patch.favoriteCount ?? 0;
  if (patch.lastVisitedAt && (!current.lastVisitedAt || patch.lastVisitedAt > current.lastVisitedAt)) {
    current.lastVisitedAt = patch.lastVisitedAt;
  }
  map.set(key, current);
}

/**
 * 本番DBに area_stats がまだ適用されていない場合の代替集計。
 * 訪問履歴とスポットを通常のRLS付きクエリで読み、同じ形式へまとめる。
 */
async function loadAreaStatsDirect(supabase: DB, tripIds: string[]): Promise<AreaStatsRow[]> {
  const { data: visits, error: visitError } = await supabase
    .from("visit_records")
    .select("spot_id, visited_at, favorite")
    .in("trip_id", tripIds);

  if (visitError) {
    console.error("Failed to load visit records for area stats", {
      code: visitError.code,
      message: visitError.message,
    });
    return [];
  }

  const visitRows = visits ?? [];
  const spotIds = [...new Set(visitRows.map((visit) => visit.spot_id))];
  if (spotIds.length === 0) return [];

  const { data: spots, error: spotError } = await supabase
    .from("spots")
    .select("id, prefecture_code, municipality_code")
    .in("id", spotIds);

  if (spotError) {
    console.error("Failed to load spots for area stats", {
      code: spotError.code,
      message: spotError.message,
    });
    return [];
  }

  const spotById = new Map((spots ?? []).map((spot) => [spot.id, spot]));
  const groups = new Map<
    string,
    {
      prefectureCode: string;
      municipalityCode: string;
      spotIds: Set<string>;
      visitCount: number;
      favoriteCount: number;
      lastVisitedAt: string | null;
    }
  >();

  for (const visit of visitRows) {
    const spot = spotById.get(visit.spot_id);
    if (!spot) continue;

    const key = `${spot.prefecture_code}:${spot.municipality_code}`;
    const current = groups.get(key) ?? {
      prefectureCode: spot.prefecture_code,
      municipalityCode: spot.municipality_code,
      spotIds: new Set<string>(),
      visitCount: 0,
      favoriteCount: 0,
      lastVisitedAt: null,
    };

    current.spotIds.add(visit.spot_id);
    current.visitCount += 1;
    if (visit.favorite) current.favoriteCount += 1;
    if (!current.lastVisitedAt || visit.visited_at > current.lastVisitedAt) {
      current.lastVisitedAt = visit.visited_at;
    }
    groups.set(key, current);
  }

  return [...groups.values()].map((group) => ({
    prefecture_code: group.prefectureCode,
    municipality_code: group.municipalityCode,
    spot_count: group.spotIds.size,
    visit_count: group.visitCount,
    favorite_count: group.favoriteCount,
    last_visited_at: group.lastVisitedAt,
  }));
}

/**
 * 地方 / 都道府県 / 市区町村ごとの訪問状況とスポット数をまとめて取得する。
 *
 * tripIds を渡すと、その旅行の記録だけを集計する（旅ワークスペースの分離）。
 * 空配列を渡した場合は「まだ記録がない」として何も返さない。
 */
export async function loadAreaIndex(supabase: DB, tripIds: string[]): Promise<AreaIndex> {
  const prefecture = new Map<string, AreaEntry>();
  const municipality = new Map<string, AreaEntry>();
  const region = new Map<string, AreaEntry>();

  let stats: AreaStatsRow[] = [];
  if (tripIds.length > 0) {
    const statsResult = await supabase.rpc("area_stats", { p_trip_ids: tripIds });
    stats = (statsResult.data ?? []) as AreaStatsRow[];

    // 本番DBへ集計関数が未適用、または空結果だった場合も、実際の訪問履歴から集計する。
    if (statsResult.error || stats.length === 0) {
      if (statsResult.error) {
        console.warn("area_stats is unavailable; using direct area aggregation", {
          code: statsResult.error.code,
          message: statsResult.error.message,
        });
      }
      stats = await loadAreaStatsDirect(supabase, tripIds);
    }
  }

  for (const row of stats) {
    const patch = {
      spotCount: Number(row.spot_count),
      visitCount: Number(row.visit_count),
      favoriteCount: Number(row.favorite_count),
      lastVisitedAt: row.last_visited_at,
    };
    bump(prefecture, row.prefecture_code, patch);
    bump(municipality, row.municipality_code, patch);
  }

  for (const r of REGIONS) {
    const entry = { ...EMPTY };
    for (const code of r.prefectureCodes) {
      const p = prefecture.get(code);
      if (!p) continue;
      entry.spotCount += p.spotCount;
      entry.visitCount += p.visitCount;
      entry.favoriteCount += p.favoriteCount;
      if (p.lastVisitedAt && (!entry.lastVisitedAt || p.lastVisitedAt > entry.lastVisitedAt)) {
        entry.lastVisitedAt = p.lastVisitedAt;
      }
    }
    region.set(r.slug, entry);
  }

  let visitedPrefectures = 0;
  for (const p of PREFECTURES) {
    if ((prefecture.get(p.code)?.visitCount ?? 0) > 0) visitedPrefectures += 1;
  }

  let visitedMunicipalities = 0;
  for (const [, entry] of municipality) {
    if (entry.visitCount > 0) visitedMunicipalities += 1;
  }

  return {
    prefecture,
    municipality,
    region,
    totals: {
      visitedPrefectures,
      visitedMunicipalities,
      spots: stats.reduce((sum, row) => sum + Number(row.spot_count), 0),
      visits: stats.reduce((sum, row) => sum + Number(row.visit_count), 0),
    },
  };
}

/** 訪問回数から色の濃さを 0〜4 で返す。0 は未訪問 */
export function shadeLevel(entry: AreaEntry): number {
  const value = entry.visitCount;
  if (value === 0) return 0;
  if (value <= 1) return 1;
  if (value <= 3) return 2;
  if (value <= 7) return 3;
  return 4;
}
