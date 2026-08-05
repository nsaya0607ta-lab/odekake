import type { TripMemberRow, TripRole, TripRow } from "@/lib/supabase/types";
import type { DB } from "./client";
import { signPhotoPath } from "./photos";

export type TripSummary = {
  trip: TripRow;
  memberCount: number;
  visitCount: number;
  role: TripRole | null;
};

export type TripMemberInfo = {
  userId: string;
  role: TripRole;
  displayName: string;
  joinedAt: string;
};

export async function getTripSummaries(supabase: DB, userId: string): Promise<TripSummary[]> {
  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const tripList = (trips ?? []) as TripRow[];
  if (tripList.length === 0) return [];

  const tripIds = tripList.map((t) => t.id);

  const [{ data: members }, { data: visits }] = await Promise.all([
    supabase.from("trip_members").select("trip_id, user_id, role").in("trip_id", tripIds),
    supabase.from("visit_records").select("id, trip_id").in("trip_id", tripIds),
  ]);

  const memberCount = new Map<string, number>();
  const myRole = new Map<string, TripRole>();
  for (const m of members ?? []) {
    memberCount.set(m.trip_id, (memberCount.get(m.trip_id) ?? 0) + 1);
    if (m.user_id === userId) myRole.set(m.trip_id, m.role);
  }

  const visitCount = new Map<string, number>();
  for (const v of visits ?? []) {
    visitCount.set(v.trip_id, (visitCount.get(v.trip_id) ?? 0) + 1);
  }

  return tripList.map((trip) => ({
    trip,
    memberCount: memberCount.get(trip.id) ?? 1,
    visitCount: visitCount.get(trip.id) ?? 0,
    role: myRole.get(trip.id) ?? (trip.owner_id === userId ? "owner" : null),
  }));
}

/** 訪問履歴の登録フォームで使う、旅行の選択肢 */
export async function getTripOptions(supabase: DB): Promise<Array<Pick<TripRow, "id" | "title" | "trip_type">>> {
  const { data } = await supabase
    .from("trips")
    .select("id, title, trip_type")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getTripMembers(supabase: DB, tripId: string): Promise<TripMemberInfo[]> {
  const { data: members } = await supabase
    .from("trip_members")
    .select("*")
    .eq("trip_id", tripId)
    .order("joined_at", { ascending: true });

  const memberList = (members ?? []) as TripMemberRow[];
  if (memberList.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .in(
      "user_id",
      memberList.map((m) => m.user_id),
    );

  const names = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));

  return memberList.map((m) => ({
    userId: m.user_id,
    role: m.role,
    displayName: names.get(m.user_id) ?? "メンバー",
    joinedAt: m.joined_at,
  }));
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
