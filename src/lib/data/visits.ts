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
  tripId?: string;
  /** 旅ワークスペースの旅行。空配列なら記録なしとして扱う */
  tripIds?: string[];
  limit?: number;
  offset?: number;
};

/**
 * 1回の取得に上限を設ける。
 * 上限を決めずに読むと、記録が増えたときに写真の署名URL発行まで含めて
 * 際限なく重くなり、PostgREST の既定上限を超えた分は黙って消える。
 */
const TIMELINE_DEFAULT_LIMIT = 50;

export async function getTimeline(supabase: DB, filter: TimelineFilter = {}): Promise<TimelineItem[]> {
  if (filter.tripIds && filter.tripIds.length === 0) return [];

  const limit = filter.limit ?? TIMELINE_DEFAULT_LIMIT;
  const offset = filter.offset ?? 0;

  let query = supabase
    .from("visit_records")
    .select("*")
    .order("visited_at", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filter.tripId) query = query.eq("trip_id", filter.tripId);
  else if (filter.tripIds) query = query.in("trip_id", filter.tripIds);

  const { data } = await query;
  const visits = (data ?? []) as VisitRecordRow[];
  if (visits.length === 0) return [];

  const visitTripIds = visits.map((v) => v.trip_id);
  const visitSpotIds = visits.map((v) => v.spot_id);
  const visitIds = visits.map((v) => v.id);
  const authorIds = visits.map((v) => v.user_id);

  // 以前は旅行名を取得してから残りの問い合わせを始めていたため、
  // タイムライン表示に余分な1往復が発生していた。独立した取得は同時に行う。
  const [tripLabels, { data: spots }, { data: photos }, authorNames, categoryNames] = await Promise.all([
    loadTripLabels(supabase, visitTripIds),
    supabase.from("spots").select("*").in("id", visitSpotIds),
    supabase
      .from("visit_photos")
      .select("*")
      .in("visit_record_id", visitIds)
      .order("display_order", { ascending: true }),
    loadDisplayNames(supabase, authorIds),
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

export type CalendarVisit = {
  id: string;
  visitedAt: string;
  spotId: string;
  spotName: string;
  tripTitle: string;
};

/**
 * カレンダー用の軽い取得。
 * カレンダーは写真を出さないので、タイムラインと違って
 * 写真の読み込みと署名URLの発行を行わない。
 */
export async function getCalendarVisits(
  supabase: DB,
  tripIds: string[],
  limit = 500,
): Promise<CalendarVisit[]> {
  if (tripIds.length === 0) return [];

  const { data } = await supabase
    .from("visit_records")
    .select("id, visited_at, spot_id, trip_id")
    .in("trip_id", tripIds)
    .order("visited_at", { ascending: false })
    .limit(limit);

  const visits = data ?? [];
  if (visits.length === 0) return [];

  const [{ data: spots }, tripLabels] = await Promise.all([
    supabase
      .from("spots")
      .select("id, name")
      .in("id", [...new Set(visits.map((visit) => visit.spot_id))]),
    loadTripLabels(supabase, visits.map((visit) => visit.trip_id)),
  ]);

  const spotNames = new Map((spots ?? []).map((spot) => [spot.id, spot.name]));

  return visits.flatMap((visit) => {
    const spotName = spotNames.get(visit.spot_id);
    if (!spotName) return [];
    return [
      {
        id: visit.id,
        visitedAt: visit.visited_at,
        spotId: visit.spot_id,
        spotName,
        tripTitle: tripLabels.get(visit.trip_id)?.title ?? "旅行",
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
