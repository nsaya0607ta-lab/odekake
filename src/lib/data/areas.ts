import { PREFECTURES, getMunicipality } from "@/lib/geo";
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
 * 地方 / 都道府県 / 市区町村ごとの訪問状況とスポット数をまとめて取得する。
 *
 * tripIds を渡すと、その旅行の記録だけを集計する（旅ワークスペースの分離）。
 * 空配列を渡した場合は「まだ記録がない」として何も返さない。
 */
export async function loadAreaIndex(supabase: DB, tripIds: string[]): Promise<AreaIndex> {
  const prefecture = new Map<string, AreaEntry>();
  const municipality = new Map<string, AreaEntry>();
  const region = new Map<string, AreaEntry>();

  const statsResult =
    tripIds.length === 0
      ? { data: [] as AreaStatsRow[] }
      : await supabase.rpc("area_stats", { p_trip_ids: tripIds });

  const stats = (statsResult.data ?? []) as AreaStatsRow[];
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

export function areaEntry(map: Map<string, AreaEntry>, key: string): AreaEntry {
  return map.get(key) ?? EMPTY;
}

/** 地図の色分けに使う基準。あとから増やせるように名前で切り替える */
export type ShadeMetric = "visits" | "favorites";

/**
 * 色の濃さを 0〜4 で返す。0 は未訪問。
 * いまは訪問回数を基準にしているが、お気に入り数へ切り替えられるようにしている。
 */
export function shadeLevel(entry: AreaEntry, metric: ShadeMetric = "visits"): number {
  const value = metric === "favorites" ? entry.favoriteCount : entry.visitCount;
  if (entry.visitCount === 0) return 0;
  if (value <= 1) return 1;
  if (value <= 3) return 2;
  if (value <= 7) return 3;
  return 4;
}

export function municipalityLabel(code: string): string {
  return getMunicipality(code)?.name ?? "不明な市区町村";
}
