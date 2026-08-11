import { cache } from "react";
import type { TripRow } from "@/lib/supabase/types";
import type { DB } from "./client";
import { signPhotoPath } from "./photos";

export type TripSummary = {
  trip: TripRow;
  visitCount: number;
};

const PERSONAL_RECORD_TRIP_TITLE = "自分のおでかけ";
const PERSONAL_RECORD_TRIP_DESCRIPTION = "普段のおでかけをまとめる記録先";

/**
 * DB上は visit_records.trip_id が必須なので、普段のおでかけにも内部用の保存先を1件持つ。
 * これは旅行計画ではないため、旅行一覧や旅行件数には含めない。
 */
export function isPersonalRecordTrip(
  trip: Pick<TripRow, "title" | "start_date" | "end_date" | "description">,
): boolean {
  return (
    trip.title === PERSONAL_RECORD_TRIP_TITLE &&
    trip.start_date === null &&
    trip.end_date === null &&
    trip.description === PERSONAL_RECORD_TRIP_DESCRIPTION
  );
}

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

  const tripList = ((trips ?? []) as TripRow[]).filter((trip) => !isPersonalRecordTrip(trip));
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

/** 訪問履歴の登録フォームで使う、ユーザーが作成した旅行計画の選択肢 */
export async function getTripOptions(
  supabase: DB,
  tripIds: string[],
): Promise<Array<Pick<TripRow, "id" | "title" | "owner_id" | "trip_type">>> {
  if (tripIds.length === 0) return [];
  const { data } = await supabase
    .from("trips")
    .select("id, title, owner_id, trip_type, start_date, end_date, description")
    .in("id", tripIds)
    .order("created_at", { ascending: false });

  return (data ?? [])
    .filter((trip) => !isPersonalRecordTrip(trip))
    .map(({ id, title, owner_id, trip_type }) => ({ id, title, owner_id, trip_type }));
}

export type RecordDestinationOption = { id: string; title: string };

/** 記録先に、名前を設定した個人旅と参加可能な旅行・共有旅を並べる。 */
export async function getRecordDestinationOptions(
  supabase: DB,
  userId: string,
  personalSpaceName: string,
  tripIds: string[],
): Promise<{ options: RecordDestinationOption[]; personalTripId: string | null }> {
  const [otherTrips, ensuredPersonalTrip] = await Promise.all([
    getTripOptions(supabase, tripIds),
    ensurePersonalRecordTrip(supabase, userId),
  ]);

  // 旧DBなどで専用保存先を作れない場合も、本人所有の個人旅を候補に残す。
  const personalTrip =
    ensuredPersonalTrip ?? otherTrips.find((trip) => trip.owner_id === userId && trip.trip_type === "personal") ?? null;
  const personalTripId = personalTrip?.id ?? null;

  return {
    personalTripId,
    options: [
      ...(personalTripId ? [{ id: personalTripId, title: `個人｜${personalSpaceName}` }] : []),
      ...otherTrips
        .filter((trip) => trip.id !== personalTripId)
        .map((trip) => ({
          id: trip.id,
          title: trip.trip_type === "shared" ? `共有旅｜${trip.title}` : `旅行｜${trip.title}`,
        })),
    ],
  };
}

/**
 * 「お出かけ」は旅行計画ではなく、普段のおでかけを記録する常設の内部保存先。
 * DB上は訪問履歴に trip_id が必要なため、ユーザーごとに1件だけ自動で用意する。
 * 旅行がすでに存在していても必ずこの保存先を別に持つ。
 */
export async function ensurePersonalRecordTrip(
  supabase: DB,
  userId: string,
): Promise<Pick<TripRow, "id" | "title"> | null> {
  // 共有旅導入後もRLSや旧トリガーの状態に左右されず、本人用を必ず1件用意する。
  const { data: ensured, error: ensureError } = await supabase
    .rpc("ensure_personal_record_trip")
    .maybeSingle();
  if (ensured) return { id: ensured.trip_id, title: ensured.title };

  // 0024適用前の環境でも、従来の直接取得・作成を試して画面を維持する。
  if (ensureError && ensureError.code !== "PGRST202" && ensureError.code !== "42883") {
    console.error("Personal record trip RPC failed", {
      code: ensureError.code,
      message: ensureError.message,
    });
  }

  const { data: existing } = await supabase
    .from("trips")
    .select("id, title")
    .eq("owner_id", userId)
    .eq("title", PERSONAL_RECORD_TRIP_TITLE)
    .eq("description", PERSONAL_RECORD_TRIP_DESCRIPTION)
    .is("start_date", null)
    .is("end_date", null)
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from("trips")
    .insert({
      id: crypto.randomUUID(),
      owner_id: userId,
      title: PERSONAL_RECORD_TRIP_TITLE,
      trip_type: "personal",
      start_date: null,
      end_date: null,
      description: PERSONAL_RECORD_TRIP_DESCRIPTION,
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
