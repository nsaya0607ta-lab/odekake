import { getMunicipality } from "@/lib/geo";
import type { SpotRow, TripType, VisitPhotoRow, VisitRecordRow } from "@/lib/supabase/types";
import type { DB } from "./client";
import { signPhotoPaths } from "./photos";
import { loadCategoryNames, loadDisplayNames, loadTripLabels } from "./spots";

export type TimelineItem = {
  id: string;
  visitedAt: string;
  createdAt: string;
  spotId: string;
  spotName: string;
  categoryName: string | null;
  municipalityName: string;
  municipalityCode: string;
  prefectureCode: string;
  tripId: string;
  tripTitle: string;
  tripType: TripType;
  rating: number | null;
  comment: string | null;
  favorite: boolean;
  authorName: string;
  authorId: string;
  photoUrls: string[];
  photoCount: number;
};

export type TimelineFilter = {
  tripType?: TripType | "all";
  tripId?: string;
  /** 旅ワークスペースの旅行。空配列なら記録なしとして扱う */
  tripIds?: string[];
  limit?: number;
};

export async function getTimeline(supabase: DB, filter: TimelineFilter = {}): Promise<TimelineItem[]> {
  if (filter.tripIds && filter.tripIds.length === 0) return [];

  let query = supabase
    .from("visit_records")
    .select("*")
    .order("visited_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (filter.tripId) query = query.eq("trip_id", filter.tripId);
  else if (filter.tripIds) query = query.in("trip_id", filter.tripIds);
  if (filter.limit) query = query.limit(filter.limit);

  const { data } = await query;
  let visits = (data ?? []) as VisitRecordRow[];
  if (visits.length === 0) return [];

  const tripLabels = await loadTripLabels(
    supabase,
    visits.map((v) => v.trip_id),
  );

  if (filter.tripType && filter.tripType !== "all") {
    visits = visits.filter((v) => tripLabels.get(v.trip_id)?.type === filter.tripType);
    if (visits.length === 0) return [];
  }

  const [{ data: spots }, { data: photos }, authorNames, categoryNames] = await Promise.all([
    supabase
      .from("spots")
      .select("*")
      .in(
        "id",
        visits.map((v) => v.spot_id),
      ),
    supabase
      .from("visit_photos")
      .select("*")
      .in(
        "visit_record_id",
        visits.map((v) => v.id),
      )
      .order("display_order", { ascending: true }),
    loadDisplayNames(
      supabase,
      visits.map((v) => v.user_id),
    ),
    loadCategoryNames(supabase),
  ]);

  const spotById = new Map(((spots ?? []) as SpotRow[]).map((s) => [s.id, s]));

  const photosByVisit = new Map<string, VisitPhotoRow[]>();
  for (const p of (photos ?? []) as VisitPhotoRow[]) {
    const list = photosByVisit.get(p.visit_record_id);
    if (list) list.push(p);
    else photosByVisit.set(p.visit_record_id, [p]);
  }

  const signed = await signPhotoPaths(
    supabase,
    [...photosByVisit.values()].flat().map((p) => p.storage_path),
  );

  return visits.flatMap((visit) => {
    const spot = spotById.get(visit.spot_id);
    if (!spot) return [];
    const label = tripLabels.get(visit.trip_id);
    const visitPhotos = photosByVisit.get(visit.id) ?? [];

    return [
      {
        id: visit.id,
        visitedAt: visit.visited_at,
        createdAt: visit.created_at,
        spotId: spot.id,
        spotName: spot.name,
        categoryName: spot.category_id ? (categoryNames.get(spot.category_id) ?? null) : null,
        municipalityName: getMunicipality(spot.municipality_code)?.name ?? "",
        municipalityCode: spot.municipality_code,
        prefectureCode: spot.prefecture_code,
        tripId: visit.trip_id,
        tripTitle: label?.title ?? "旅行",
        tripType: label?.type ?? "solo",
        rating: visit.rating,
        comment: visit.comment,
        favorite: visit.favorite,
        authorName: authorNames.get(visit.user_id) ?? "メンバー",
        authorId: visit.user_id,
        photoUrls: visitPhotos.slice(0, 3).flatMap((p) => {
          const url = signed.get(p.storage_path);
          return url ? [url] : [];
        }),
        photoCount: visitPhotos.length,
      },
    ];
  });
}

export async function getVisitForEdit(supabase: DB, visitId: string) {
  const { data: record } = await supabase.from("visit_records").select("*").eq("id", visitId).maybeSingle();
  if (!record) return null;

  const [{ data: spot }, { data: photos }] = await Promise.all([
    supabase.from("spots").select("*").eq("id", record.spot_id).maybeSingle(),
    supabase
      .from("visit_photos")
      .select("*")
      .eq("visit_record_id", visitId)
      .order("display_order", { ascending: true }),
  ]);

  const photoRows = (photos ?? []) as VisitPhotoRow[];
  const signed = await signPhotoPaths(
    supabase,
    photoRows.map((p) => p.storage_path),
  );

  return {
    record: record as VisitRecordRow,
    spot: (spot ?? null) as SpotRow | null,
    photos: photoRows.map((p) => ({
      id: p.id,
      storagePath: p.storage_path,
      url: signed.get(p.storage_path) ?? null,
    })),
  };
}
