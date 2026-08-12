import { cache } from "react";
import type { TripRow } from "@/lib/supabase/types";
import type { DB } from "./client";
import { signPhotoPath } from "./photos";

export type TripSummary = {
  trip: TripRow;
  visitCount: number;
};

export type JourneyOption = {
  id: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
};

export type RecordDestinationRoot = {
  id: string;
  title: string;
  kind: "personal" | "shared";
  journeys: JourneyOption[];
};

export type RecordDestinationHierarchy = {
  personal: RecordDestinationRoot | null;
  shared: RecordDestinationRoot[];
};

const PERSONAL_RECORD_TRIP_TITLE = "自分のおでかけ";
const PERSONAL_RECORD_TRIP_DESCRIPTION = "普段のおでかけをまとめる記録先";

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

export const getTripSummaries = cache(async function getTripSummaries(supabase: DB): Promise<TripSummary[]> {
  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const tripList = ((trips ?? []) as TripRow[]).filter((trip) => trip.parent_trip_id !== null);
  if (tripList.length === 0) return [];

  const journeyIds = tripList.map((t) => t.id);
  const visitCount = new Map<string, number>();

  // 0027適用後は件数だけをDB側でgroup byして返す。
  // 訪問記録が数千件あっても、全レコードをアプリへ転送しない。
  const rpc = supabase.rpc as unknown as (
    fn: string,
    args: { p_journey_ids: string[] },
  ) => Promise<{ data: Array<{ journey_id: string; visit_count: number | string }> | null; error: { code?: string } | null }>;
  const { data: counts, error: countError } = await rpc("get_journey_visit_counts", {
    p_journey_ids: journeyIds,
  });

  if (!countError && counts) {
    for (const row of counts) visitCount.set(row.journey_id, Number(row.visit_count) || 0);
  } else {
    // 0027未適用のDBでも従来どおり動く安全なフォールバック。
    const { data: visits } = await supabase
      .from("visit_records")
      .select("id, journey_id")
      .in("journey_id", journeyIds);

    for (const v of visits ?? []) {
      if (v.journey_id) visitCount.set(v.journey_id, (visitCount.get(v.journey_id) ?? 0) + 1);
    }
  }

  return tripList.map((trip) => ({ trip, visitCount: visitCount.get(trip.id) ?? 0 }));
});

/** 親の記録先と、その直下の旅行グループを分けて返す。閲覧時はDBを変更しない。 */
export async function getRecordDestinationHierarchy(
  supabase: DB,
  userId: string,
  personalSpaceName: string,
): Promise<RecordDestinationHierarchy> {
  const { data, error } = await supabase
    .from("trips")
    .select("id, title, owner_id, trip_type, parent_trip_id, start_date, end_date, description")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Record destination hierarchy failed", { code: error.code, message: error.message });
    return { personal: null, shared: [] };
  }

  const rows = (data ?? []) as Array<Pick<TripRow,
    "id" | "title" | "owner_id" | "trip_type" | "parent_trip_id" | "start_date" | "end_date" | "description"
  >>;

  let personalRoot = rows.find((trip) =>
    trip.owner_id === userId &&
    trip.trip_type === "personal" &&
    trip.parent_trip_id === null &&
    isPersonalRecordTrip(trip),
  ) ?? null;

  if (!personalRoot) {
    const ensuredPersonalTrip = await ensurePersonalRecordTrip(supabase, userId);
    if (ensuredPersonalTrip) {
      personalRoot = {
        id: ensuredPersonalTrip.id,
        title: ensuredPersonalTrip.title,
        owner_id: userId,
        trip_type: "personal",
        parent_trip_id: null,
        start_date: null,
        end_date: null,
        description: PERSONAL_RECORD_TRIP_DESCRIPTION,
      };
    }
  }

  const journeysFor = (rootId: string): JourneyOption[] => rows
    .filter((trip) => trip.parent_trip_id === rootId)
    .map((trip) => ({ id: trip.id, title: trip.title, startDate: trip.start_date, endDate: trip.end_date }));

  const sharedRoots = rows.filter((trip) => trip.trip_type === "shared" && trip.parent_trip_id === null);
  return {
    personal: personalRoot ? {
      id: personalRoot.id,
      title: personalSpaceName,
      kind: "personal",
      journeys: journeysFor(personalRoot.id),
    } : null,
    shared: sharedRoots.map((trip) => ({
      id: trip.id,
      title: trip.title,
      kind: "shared" as const,
      journeys: journeysFor(trip.id),
    })),
  };
}

export async function ensurePersonalRecordTrip(
  supabase: DB,
  userId: string,
): Promise<Pick<TripRow, "id" | "title"> | null> {
  const { data: ensured, error: ensureError } = await supabase
    .rpc("ensure_personal_record_trip")
    .maybeSingle();
  if (ensured) return { id: ensured.trip_id, title: ensured.title };

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