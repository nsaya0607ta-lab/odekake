import { PREFECTURES, getMunicipality } from "@/lib/geo";
import { REGIONS } from "@/lib/geo/regions";
import type { AreaStatsRow } from "@/lib/supabase/types";
import type { DB } from "./client";

export type AreaEntry = {
  spotCount: number;
  visitCount: number;
  lastVisitedAt: string | null;
};

const EMPTY: AreaEntry = { spotCount: 0, visitCount: 0, lastVisitedAt: null };

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
  if (patch.lastVisitedAt && (!current.lastVisitedAt || patch.lastVisitedAt > current.lastVisitedAt)) {
    current.lastVisitedAt = patch.lastVisitedAt;
  }
  map.set(key, current);
}

/**
 * 地方 / 都道府県 / 市区町村ごとの登録スポット数と訪問状況をまとめて取得する。
 * 登録スポット数は spots テーブル、訪問状況は area_stats() から求める。
 */
export async function loadAreaIndex(supabase: DB): Promise<AreaIndex> {
  const [spotsResult, statsResult] = await Promise.all([
    supabase.from("spots").select("id, prefecture_code, municipality_code"),
    supabase.rpc("area_stats"),
  ]);

  const prefecture = new Map<string, AreaEntry>();
  const municipality = new Map<string, AreaEntry>();
  const region = new Map<string, AreaEntry>();

  const spots = spotsResult.data ?? [];
  for (const spot of spots) {
    bump(prefecture, spot.prefecture_code, { spotCount: 1 });
    bump(municipality, spot.municipality_code, { spotCount: 1 });
  }

  const stats = (statsResult.data ?? []) as AreaStatsRow[];
  for (const row of stats) {
    const patch = { visitCount: Number(row.visit_count), lastVisitedAt: row.last_visited_at };
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
      spots: spots.length,
      visits: stats.reduce((sum, row) => sum + Number(row.visit_count), 0),
    },
  };
}

export function areaEntry(map: Map<string, AreaEntry>, key: string): AreaEntry {
  return map.get(key) ?? EMPTY;
}

export function municipalityLabel(code: string): string {
  return getMunicipality(code)?.name ?? "不明な市区町村";
}
