import { getSharedTripList } from "@/lib/data/shared-trips";
import { getRecordSpace } from "@/lib/data/space";
import type { DB } from "./client";

export type MapScopeOption = {
  value: string;
  name: string;
  kind: "personal" | "shared";
};

export type MapScope = {
  value: string;
  name: string;
  kind: "personal" | "shared";
  tripIds: string[];
  options: MapScopeOption[];
};

export const PERSONAL_MAP_SCOPE = "personal";

/**
 * 地図に表示する記録範囲を決める。
 * 個人側は本人の個人旅に加えて、参加済みの共有旅もまとめて「自分の旅」の実績として表示する。
 * 共有側は選択した共有旅1件だけを表示する。
 *
 * 共有旅の訪問を別の visit_records に複製せず、地図の集計対象へ共有旅の trip_id を加える。
 * これにより共有旅の地図と個人の地図の両方へ同じ訪問を反映しつつ、訪問履歴やEXPの二重計上を避ける。
 */
export async function getMapScope(
  supabase: DB,
  userId: string,
  requestedTripId?: string,
): Promise<MapScope> {
  const [space, sharedTrips, personalTripsResult] = await Promise.all([
    getRecordSpace(supabase, userId),
    getSharedTripList(supabase),
    supabase
      .from("trips")
      .select("id")
      .eq("owner_id", userId)
      .eq("trip_type", "personal")
      .is("parent_trip_id", null),
  ]);

  if (personalTripsResult.error) {
    console.error("Personal map trips failed", {
      code: personalTripsResult.error.code,
      message: personalTripsResult.error.message,
    });
  }

  const acceptedSharedTrips = sharedTrips.filter((trip) => trip.my_status === "accepted");
  const selectedSharedTrip = requestedTripId
    ? acceptedSharedTrips.find((trip) => trip.trip_id === requestedTripId)
    : undefined;

  const options: MapScopeOption[] = [
    { value: PERSONAL_MAP_SCOPE, name: space.name, kind: "personal" },
    ...acceptedSharedTrips.map((trip) => ({
      value: trip.trip_id,
      name: trip.title,
      kind: "shared" as const,
    })),
  ];

  if (selectedSharedTrip) {
    return {
      value: selectedSharedTrip.trip_id,
      name: selectedSharedTrip.title,
      kind: "shared",
      tripIds: [selectedSharedTrip.trip_id],
      options,
    };
  }

  const personalTripIds = (personalTripsResult.data ?? []).map((trip) => trip.id);
  const sharedTripIds = acceptedSharedTrips.map((trip) => trip.trip_id);

  return {
    value: PERSONAL_MAP_SCOPE,
    name: space.name,
    kind: "personal",
    tripIds: [...new Set([...personalTripIds, ...sharedTripIds])],
    options,
  };
}

/** 選択中の共有旅を地図の下層画面まで引き継ぐ。個人旅では余分なクエリを付けない。 */
export function mapScopeHref(
  pathname: string,
  scope: Pick<MapScope, "kind" | "value">,
  extra?: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  if (scope.kind === "shared") params.set("trip", scope.value);
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
