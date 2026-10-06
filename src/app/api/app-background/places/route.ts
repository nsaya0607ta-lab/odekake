import { NextResponse } from "next/server";
import { loadAreaIndex } from "@/lib/data/areas";
import { getRecordSpace } from "@/lib/data/space";
import { requireUser } from "@/lib/supabase/server";

/**
 * 「記録で育つ背景」（あなたの日本地図・おでかけ星図）が使う、行った都道府県・市区町村と訪問回数。
 * 地図の画面と同じ集計（自分の旅行＋共有の旅行）を使う。
 */
export async function GET() {
  const { supabase, user } = await requireUser();
  const space = await getRecordSpace(supabase, user.id);
  const areas = await loadAreaIndex(supabase, space.tripIds);
  const pick = (map: Map<string, { visitCount: number }>) => {
    const out: Record<string, number> = {};
    for (const [code, entry] of map) if (entry.visitCount > 0) out[code] = entry.visitCount;
    return out;
  };
  return NextResponse.json(
    { ok: true, prefectures: pick(areas.prefecture), municipalities: pick(areas.municipality) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
