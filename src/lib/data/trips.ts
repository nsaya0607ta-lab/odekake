import { cache } from "react";
import type { TripRow } from "@/lib/supabase/types";
import type { DB } from "./client";
import { signPhotoPath } from "./photos";

export type TripSummary = {
  trip: TripRow;
  visitCount: number;
};

/**
 * 同じ画面内ではホーム・記録画面など複数箇所から呼ばれる。
 * React cache で1リクエスト中の重複したDB取得をまとめる。
 */
export const getTripSummaries = cache(async function getTripSummaries(supabase: DB): Promise<TripSummary[]> {
  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const tripList = (trips ?? []) as TripRow[];
  if (tripList.length === 0) return [];

  const { data: visits } = await supabase
    .from("visit_records")
    .select("id, trip_id")
    .in(
      "trip_id",
      tripList.map((t) => t.id),
    );

  const visitCount = new Map<string, number>();
  for (const v of visits ?? []) {
    visitCount.set(v.trip_id, (visitCount.get(v.trip_id) ?? 0) + 1);
  }

  return tripList.map((trip) => ({ trip, visitCount: visitCount.get(trip.id) ?? 0 }));
});

/** 訪問履歴の登録フォームで使う、旅行の選択肢 */
export async function getTripOptions(
  supabase: DB,
  tripIds: string[],
): Promise<Array<Pick<TripRow, "id" | "title">>> {
  if (tripIds.length === 0) return [];
  const { data } = await supabase
    .from("trips")
    .select("id, title")
    .in("id", tripIds)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/**
 * 「自分の旅」は旅行計画ではなく、普段のおでかけを記録する常設の空間。
 * DB上は訪問履歴に trip_id が必要なため、保存先がまだ無いユーザーだけ
 * 日程なしの記録用データを自動作成する。ユーザーに作成操作は求めない。
 */
export async function ensurePersonalRecordTrip(
  supabase: DB,
  userId: string,
): Promise<Pick<TripRow, "id" | "title"> | null> {
  const { data: existing } = await supabase
    .from("trips")
    .select("id, title")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from("trips")
    .insert({
      id: crypto.randomUUID(),
      owner_id: userId,
      title: "自分のおでかけ",
      start_date: null,
      end_date: null,
      description: "普段のおでかけをまとめる記録先",
    })
    .select("id, title")
    .single();

  if (error) {
    console.error("Failed to prepare personal record trip", {
      code: error.code,
      message: error.message,
    });
    return null;
  }

  return data;
}

export async function getTripCoverUrl(supabase: DB, trip: TripRow): Promise<string | null> {
  return signPhotoPath(supabase, trip.cover_image_url);
}

export function formatTripPeriod(trip: Pick<TripRow, "start_date" | "end_date">): string | null {
  const format = (value: string) => {
    const [y, m, d] = value.split("-");
    return `${y}/${m}/${d}`;
  };
  if (trip.start_date && trip.end_date) {
    if (trip.start_date === trip.end_date) return format(trip.start_date);
    return `${format(trip.start_date)} 〜 ${format(trip.end_date)}`;
  }
  if (trip.start_date) return `${format(trip.start_date)} 〜`;
  if (trip.end_date) return `〜 ${format(trip.end_date)}`;
  return null;
}
