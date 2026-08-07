import type { SpotRow, VisitPhotoRow, VisitRecordRow } from "@/lib/supabase/types";
import type { DB } from "./client";
import { signPhotoPaths } from "./photos";

export type SpotSummary = {
  id: string;
  name: string;
  categoryId: number | null;
  categoryName: string | null;
  prefectureCode: string;
  municipalityCode: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  visitCount: number;
  lastVisitedAt: string | null;
  averageRating: number | null;
  favorite: boolean;
  /** いずれかの訪問履歴で「また行きたい」が付いている */
  revisitWanted: boolean;
  photoUrl: string | null;
};

export type VisitDetail = {
  record: VisitRecordRow;
  photos: Array<{ id: string; url: string | null; caption: string | null }>;
  authorName: string;
  tripTitle: string | null;
  tripType: "solo" | "shared" | null;
};

function summarize(visits: VisitRecordRow[]) {
  let sum = 0;
  let rated = 0;
  let favorite = false;
  let revisitWanted = false;
  let lastVisitedAt: string | null = null;

  for (const v of visits) {
    if (typeof v.rating === "number") {
      sum += v.rating;
      rated += 1;
    }
    if (v.favorite) favorite = true;
    if (v.revisit_wanted) revisitWanted = true;
    if (!lastVisitedAt || v.visited_at > lastVisitedAt) lastVisitedAt = v.visited_at;
  }

  return {
    visitCount: visits.length,
    averageRating: rated > 0 ? Math.round((sum / rated) * 10) / 10 : null,
    favorite,
    revisitWanted,
    lastVisitedAt,
  };
}

/** 代表写真は「最後に訪れた記録の1枚目」を使う */
function pickCoverPath(visits: VisitRecordRow[], photosByVisit: Map<string, VisitPhotoRow[]>): string | null {
  const ordered = [...visits].sort((a, b) => (a.visited_at < b.visited_at ? 1 : -1));
  for (const visit of ordered) {
    const photos = photosByVisit.get(visit.id);
    if (photos && photos.length > 0) return photos[0]!.storage_path;
  }
  return null;
}

async function attachSummaries(
  supabase: DB,
  spots: SpotRow[],
  categoryNames: Map<number, string>,
  tripIds: string[],
  includeUnvisited = false,
): Promise<SpotSummary[]> {
  if (spots.length === 0) return [];
  if (tripIds.length === 0 && !includeUnvisited) return [];

  const spotIds = spots.map((s) => s.id);
  const visitsQuery =
    tripIds.length === 0
      ? Promise.resolve({ data: [] as VisitRecordRow[] })
      : supabase
          .from("visit_records")
          .select("*")
          .in("spot_id", spotIds)
          .in("trip_id", tripIds)
          .order("visited_at", { ascending: false });

  const { data: visits } = await visitsQuery;
  const visitList = (visits ?? []) as VisitRecordRow[];
  const visitsBySpot = new Map<string, VisitRecordRow[]>();
  for (const v of visitList) {
    const list = visitsBySpot.get(v.spot_id);
    if (list) list.push(v);
    else visitsBySpot.set(v.spot_id, [v]);
  }

  const photosByVisit = new Map<string, VisitPhotoRow[]>();
  if (visitList.length > 0) {
    const { data: photos } = await supabase
      .from("visit_photos")
      .select("*")
      .in(
        "visit_record_id",
        visitList.map((v) => v.id),
      )
      .order("display_order", { ascending: true });

    for (const p of (photos ?? []) as VisitPhotoRow[]) {
      const list = photosByVisit.get(p.visit_record_id);
      if (list) list.push(p);
      else photosByVisit.set(p.visit_record_id, [p]);
    }
  }

  const coverPaths: Array<[string, string]> = [];
  for (const spot of spots) {
    const path = pickCoverPath(visitsBySpot.get(spot.id) ?? [], photosByVisit);
    if (path) coverPaths.push([spot.id, path]);
  }
  const signed = await signPhotoPaths(
    supabase,
    coverPaths.map(([, p]) => p),
  );
  const coverBySpot = new Map(coverPaths.map(([id, path]) => [id, signed.get(path) ?? null]));

  return spots.flatMap((spot) => {
    const spotVisits = visitsBySpot.get(spot.id) ?? [];
    if (!includeUnvisited && spotVisits.length === 0) return [];
    const stats = summarize(spotVisits);
    return [{
      id: spot.id,
      name: spot.name,
      categoryId: spot.category_id,
      categoryName: spot.category_id ? (categoryNames.get(spot.category_id) ?? null) : null,
      prefectureCode: spot.prefecture_code,
      municipalityCode: spot.municipality_code,
      address: spot.address,
      latitude: spot.latitude,
      longitude: spot.longitude,
      photoUrl: coverBySpot.get(spot.id) ?? null,
      ...stats,
    }];
  });
}

export async function loadCategoryNames(supabase: DB): Promise<Map<number, string>> {
  const { data } = await supabase.from("categories").select("id, name").eq("active", true);
  return new Map((data ?? []).map((c) => [c.id, c.name]));
}

export async function getSpotsInMunicipality(
  supabase: DB,
  municipalityCode: string,
  tripIds: string[],
): Promise<SpotSummary[]> {
  if (tripIds.length === 0) return [];
  const [{ data: spots }, categoryNames] = await Promise.all([
    supabase.from("spots").select("*").eq("municipality_code", municipalityCode).order("name"),
    loadCategoryNames(supabase),
  ]);
  return attachSummaries(supabase, (spots ?? []) as SpotRow[], categoryNames, tripIds);
}

/**
 * 一覧に並べるスポットの順番を、まず ID だけで決める。
 *
 * スポット本体・訪問履歴・写真をすべて読んでから絞り込むと、記録が増えるほど
 * 1画面あたりの読み込み量が際限なく増える（PostgREST の既定上限に当たると、
 * それ以上は黙って表示されなくなる）。先に軽い列だけで並び順を確定し、
 * 実際に表示するぶんだけ本体を読む。
 */
const SPOT_ID_SCAN_LIMIT = 2000;

async function orderedSpotIds(
  supabase: DB,
  tripIds: string[],
  includeUnvisited: boolean,
): Promise<string[]> {
  const visitedOrder: string[] = [];
  const seen = new Set<string>();

  if (tripIds.length > 0) {
    const { data: visits } = await supabase
      .from("visit_records")
      .select("spot_id, visited_at")
      .in("trip_id", tripIds)
      .order("visited_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(SPOT_ID_SCAN_LIMIT);

    for (const visit of visits ?? []) {
      if (seen.has(visit.spot_id)) continue;
      seen.add(visit.spot_id);
      visitedOrder.push(visit.spot_id);
    }
  }

  if (!includeUnvisited) return visitedOrder;

  // 訪問履歴のないスポット（登録しただけの場所）を、新しい順で後ろに足す
  const { data: spots } = await supabase
    .from("spots")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(SPOT_ID_SCAN_LIMIT);

  const rest = (spots ?? []).map((spot) => spot.id).filter((id) => !seen.has(id));
  return [...visitedOrder, ...rest];
}

export type SpotPage = { spots: SpotSummary[]; hasMore: boolean };

/** 指定した ID のスポットを、渡した順番のまま読み込む */
async function loadSpotsByIds(
  supabase: DB,
  ids: string[],
  tripIds: string[],
  includeUnvisited: boolean,
): Promise<SpotSummary[]> {
  if (ids.length === 0) return [];

  const [{ data: spots }, categoryNames] = await Promise.all([
    supabase.from("spots").select("*").in("id", ids),
    loadCategoryNames(supabase),
  ]);

  const byId = new Map(((spots ?? []) as SpotRow[]).map((spot) => [spot.id, spot]));
  const ordered = ids.flatMap((id) => {
    const spot = byId.get(id);
    return spot ? [spot] : [];
  });

  return attachSummaries(supabase, ordered, categoryNames, tripIds, includeUnvisited);
}

/** PostgREST の or 条件を壊さないよう、区切り文字を落とす */
function escapeForFilter(value: string): string {
  return value.replace(/[%,()"\\]/g, " ").trim();
}

/**
 * 名前・住所の部分一致でスポットの ID を絞る。
 *
 * 一覧の絞り込みを読み込み済みのページ内だけで行うと、次のページにある
 * スポットは検索しても出てこない。検索はサーバー側で全件に対して行う。
 */
async function searchSpotIds(supabase: DB, keyword: string): Promise<Set<string> | null> {
  const escaped = escapeForFilter(keyword);
  if (!escaped) return null;

  const { data } = await supabase
    .from("spots")
    .select("id")
    .or(`name.ilike.%${escaped}%,address.ilike.%${escaped}%`)
    .limit(SPOT_ID_SCAN_LIMIT);

  return new Set((data ?? []).map((spot) => spot.id));
}

/**
 * スポット一覧を1ページ分だけ読み込む。
 * `hasMore` は「次のページがある」ことを表す（もっと見るの表示に使う）。
 * `keyword` を渡すと、読み込み済みの分だけでなく全件から探す。
 */
export async function getSpotPage(
  supabase: DB,
  tripIds: string[],
  options?: { includeUnvisited?: boolean; limit?: number; offset?: number; keyword?: string },
): Promise<SpotPage & { total: number }> {
  const includeUnvisited = options?.includeUnvisited ?? false;
  const limit = options?.limit ?? 30;
  const offset = options?.offset ?? 0;
  const keyword = options?.keyword?.trim() ?? "";

  if (tripIds.length === 0 && !includeUnvisited) return { spots: [], hasMore: false, total: 0 };

  const [ordered, matched] = await Promise.all([
    orderedSpotIds(supabase, tripIds, includeUnvisited),
    keyword ? searchSpotIds(supabase, keyword) : Promise.resolve(null),
  ]);

  const ids = matched ? ordered.filter((id) => matched.has(id)) : ordered;
  const pageIds = ids.slice(offset, offset + limit);

  return {
    spots: await loadSpotsByIds(supabase, pageIds, tripIds, includeUnvisited),
    hasMore: ids.length > offset + limit,
    total: ids.length,
  };
}

/**
 * 訪問履歴のフラグで絞ったスポット一覧。
 * 「お気に入り」「また行きたい」は訪問履歴側に付くので、
 * 全スポットを読んでから絞るのではなく、先に訪問履歴から対象を決める。
 */
async function getFlaggedSpots(
  supabase: DB,
  tripIds: string[],
  column: "favorite" | "revisit_wanted",
  limit = 100,
): Promise<SpotSummary[]> {
  if (tripIds.length === 0) return [];

  const { data: visits } = await supabase
    .from("visit_records")
    .select("spot_id, visited_at")
    .in("trip_id", tripIds)
    .eq(column, true)
    .order("visited_at", { ascending: false })
    .limit(SPOT_ID_SCAN_LIMIT);

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const visit of visits ?? []) {
    if (seen.has(visit.spot_id)) continue;
    seen.add(visit.spot_id);
    ids.push(visit.spot_id);
    if (ids.length >= limit) break;
  }

  return loadSpotsByIds(supabase, ids, tripIds, false);
}

/** お気に入りが付いた訪問履歴のあるスポット */
export function getFavoriteSpots(supabase: DB, tripIds: string[]): Promise<SpotSummary[]> {
  return getFlaggedSpots(supabase, tripIds, "favorite");
}

/** 「また行きたい」が付いた訪問履歴のあるスポット */
export function getRevisitWantedSpots(supabase: DB, tripIds: string[]): Promise<SpotSummary[]> {
  return getFlaggedSpots(supabase, tripIds, "revisit_wanted");
}

export type SpotDetail = {
  spot: SpotRow;
  categoryName: string | null;
  summary: ReturnType<typeof summarize>;
  visits: VisitDetail[];
  galleryUrls: string[];
};

/** スポットの詳細。訪問履歴はいまの旅ワークスペースの分だけを見せる */
export async function getSpotDetail(
  supabase: DB,
  spotId: string,
  tripIds: string[],
): Promise<SpotDetail | null> {
  const { data: spot } = await supabase.from("spots").select("*").eq("id", spotId).maybeSingle();
  if (!spot) return null;

  const [{ data: visits }, categoryNames] = await Promise.all([
    tripIds.length === 0
      ? Promise.resolve({ data: [] as VisitRecordRow[] })
      : supabase
          .from("visit_records")
          .select("*")
          .eq("spot_id", spotId)
          .in("trip_id", tripIds)
          .order("visited_at", { ascending: false }),
    loadCategoryNames(supabase),
  ]);

  const visitList = (visits ?? []) as VisitRecordRow[];

  const photosByVisit = new Map<string, VisitPhotoRow[]>();
  if (visitList.length > 0) {
    const { data: photos } = await supabase
      .from("visit_photos")
      .select("*")
      .in(
        "visit_record_id",
        visitList.map((v) => v.id),
      )
      .order("display_order", { ascending: true });
    for (const p of (photos ?? []) as VisitPhotoRow[]) {
      const list = photosByVisit.get(p.visit_record_id);
      if (list) list.push(p);
      else photosByVisit.set(p.visit_record_id, [p]);
    }
  }

  const allPaths = [...photosByVisit.values()].flat().map((p) => p.storage_path);
  const signed = await signPhotoPaths(supabase, allPaths);

  const [authorNames, tripInfo] = await Promise.all([
    loadDisplayNames(supabase, visitList.map((v) => v.user_id)),
    loadTripLabels(supabase, visitList.map((v) => v.trip_id)),
  ]);

  const visitDetails: VisitDetail[] = visitList.map((record) => ({
    record,
    photos: (photosByVisit.get(record.id) ?? []).map((p) => ({
      id: p.id,
      url: signed.get(p.storage_path) ?? null,
      caption: p.caption,
    })),
    authorName: authorNames.get(record.user_id) ?? "メンバー",
    tripTitle: tripInfo.get(record.trip_id)?.title ?? null,
    tripType: tripInfo.get(record.trip_id)?.type ?? null,
  }));

  return {
    spot: spot as SpotRow,
    categoryName: spot.category_id ? (categoryNames.get(spot.category_id) ?? null) : null,
    summary: summarize(visitList),
    visits: visitDetails,
    galleryUrls: visitDetails.flatMap((v) => v.photos.map((p) => p.url).filter((u): u is string => Boolean(u))),
  };
}

export async function loadDisplayNames(supabase: DB, userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select("user_id, display_name").in("user_id", unique);
  return new Map((data ?? []).map((p) => [p.user_id, p.display_name]));
}

export async function loadTripLabels(
  supabase: DB,
  tripIds: string[],
): Promise<Map<string, { title: string; type: "solo" | "shared" }>> {
  const unique = [...new Set(tripIds)];
  if (unique.length === 0) return new Map();
  const { data } = await supabase.from("trips").select("id, title, trip_type").in("id", unique);
  return new Map((data ?? []).map((t) => [t.id, { title: t.title, type: t.trip_type }]));
}
