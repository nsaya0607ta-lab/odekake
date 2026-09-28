import { PREFECTURE_NAMES } from "@/lib/geo/prefecture-names";
import type { DB } from "./client";
import { signThumbOrOriginalPaths } from "./photos";

/** おさんぽフレンチーの道ばたの看板に貼る、自分のおでかけ写真 */
export type OsanpoRunMemoryPhoto = {
  /** サムネイル（長辺480px・縦横比はそのまま）の配信URL */
  src: string;
  /** スポット名 */
  name: string;
  /** 都道府県名（分からなければ空） */
  pref: string;
};

/** 新しい順にこれだけ読む。看板の向き（縦・横）はゲーム側で写真の縦横比から決める */
const MEMORY_PHOTO_LIMIT = 60;

export async function getOsanpoRunMemoryPhotos(supabase: DB, userId: string): Promise<OsanpoRunMemoryPhoto[]> {
  const { data: photos, error } = await supabase
    .from("visit_photos")
    .select("storage_path, visit_record_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MEMORY_PHOTO_LIMIT);
  if (error) {
    console.warn("Osanpo run memory photos are unavailable", { code: error.code, message: error.message });
    return [];
  }
  if (!photos?.length) return [];

  const visitIds = [...new Set(photos.map((p) => p.visit_record_id))];
  const { data: visits } = await supabase.from("visit_records").select("id, spot_id").in("id", visitIds);
  const spotOfVisit = new Map((visits ?? []).map((v) => [v.id, v.spot_id]));
  const spotIds = [...new Set((visits ?? []).map((v) => v.spot_id))];
  const { data: spots } = spotIds.length
    ? await supabase.from("spots").select("id, name, prefecture_code").in("id", spotIds)
    : { data: [] };
  const spotById = new Map((spots ?? []).map((s) => [s.id, s]));
  const urls = await signThumbOrOriginalPaths(supabase, photos.map((p) => p.storage_path));

  return photos.flatMap((p) => {
    const src = urls.get(p.storage_path);
    const spotId = spotOfVisit.get(p.visit_record_id);
    const spot = spotId ? spotById.get(spotId) : undefined;
    if (!src || !spot) return [];
    const pref = PREFECTURE_NAMES.find((item) => item.code === spot.prefecture_code)?.name ?? "";
    return [{ src, name: spot.name, pref }];
  });
}
