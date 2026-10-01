import { COLLECTION_ITEMS } from "@/lib/collection/items";
import { OSANPO_RUN_RANKS, OSANPO_RUN_STAGE_IDS, OSANPO_RUN_STAGES } from "@/lib/games/osanpo-run/config";
import { PREFECTURE_NAMES } from "@/lib/geo/prefecture-names";
import {
  parsePlacements,
  photoDecorKey,
  souvenirDecorKey,
  SOUVENIRS,
  trophyDecorKey,
  type DecorEntry,
  type Placement,
} from "@/lib/room/decor";
import type { DB } from "./client";
import { getOwnedItemCounts } from "./collection";
import { signThumbOrOriginalPaths } from "./photos";

/** 飾れる写真は新しい順にこれだけ */
const ROOM_PHOTO_LIMIT = 60;
/** テーブルがまだ無い環境（マイグレーション前） */
const UNAVAILABLE_CODES = new Set(["42P01", "PGRST205"]);

export type DecorationRoomState = {
  /** 保存してある置き方（まだ1度も保存していなければ null） */
  placements: Placement[] | null;
  /** サーバーに保存できるか（テーブルが無ければ false。そのときは端末に保存する） */
  ready: boolean;
};

export async function getDecorationRoom(supabase: DB, userId: string): Promise<DecorationRoomState> {
  const { data, error } = await supabase.from("user_decoration_rooms").select("placements").eq("user_id", userId).maybeSingle();
  if (error) {
    if (!UNAVAILABLE_CODES.has(error.code ?? "")) console.warn("Decoration room is unavailable", { code: error.code, message: error.message });
    return { placements: null, ready: false };
  }
  return { placements: data ? parsePlacements(data.placements) : null, ready: true };
}

/** おへやに置けるもの（図鑑アイテム・写真・トロフィー・おみやげ） */
export async function getRoomInventory(supabase: DB, userId: string): Promise<DecorEntry[]> {
  const [ownedCounts, photos, trophies, souvenirs] = await Promise.all([
    getOwnedItemCounts(supabase, userId),
    getRoomPhotos(supabase, userId),
    getRoomTrophies(supabase, userId),
    getRoomSouvenirs(supabase, userId),
  ]);
  const items = COLLECTION_ITEMS.flatMap((item): DecorEntry[] => {
    const count = ownedCounts.get(item.id) ?? 0;
    if (count <= 0 || !item.image) return [];
    return [{ kind: "item", key: item.id, name: item.name, image: item.image, count, category: item.category, series: item.series ?? null, rarity: item.rarity }];
  });
  return [...items, ...photos, ...trophies, ...souvenirs];
}

async function getRoomPhotos(supabase: DB, userId: string): Promise<DecorEntry[]> {
  const { data: photos, error } = await supabase
    .from("visit_photos")
    .select("id, storage_path, visit_record_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(ROOM_PHOTO_LIMIT);
  if (error || !photos?.length) return [];
  const visitIds = [...new Set(photos.map((p) => p.visit_record_id))];
  const { data: visits } = await supabase.from("visit_records").select("id, spot_id, visited_at").in("id", visitIds);
  const visitById = new Map((visits ?? []).map((v) => [v.id, v]));
  const spotIds = [...new Set((visits ?? []).map((v) => v.spot_id))];
  const { data: spots } = spotIds.length ? await supabase.from("spots").select("id, name").in("id", spotIds) : { data: [] };
  const spotName = new Map((spots ?? []).map((s) => [s.id, s.name]));
  const urls = await signThumbOrOriginalPaths(supabase, photos.map((p) => p.storage_path));
  return photos.flatMap((p): DecorEntry[] => {
    const src = urls.get(p.storage_path);
    const visit = visitById.get(p.visit_record_id);
    if (!src || !visit) return [];
    return [{ kind: "photo", key: photoDecorKey(p.id), name: spotName.get(visit.spot_id) ?? "おでかけ", image: src, date: visit.visited_at, count: 1 }];
  });
}

type ScoreQuery = {
  from: (table: "osanpo_run_scores") => {
    select: (columns: "stage, score") => {
      eq: (column: "user_id", value: string) => {
        order: (column: "score", options: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: { stage: string; score: number }[] | null; error: { code?: string; message: string } | null }>;
        };
      };
    };
  };
};

/** おさんぽフレンチーの道ごとのベスト記録。ランクの色のトロフィーになる */
async function getRoomTrophies(supabase: DB, userId: string): Promise<DecorEntry[]> {
  const { data, error } = await (supabase as unknown as ScoreQuery)
    .from("osanpo_run_scores").select("stage, score").eq("user_id", userId).order("score", { ascending: false }).limit(500);
  if (error || !data?.length) return [];
  const best = new Map<string, number>();
  for (const row of data) if (!best.has(row.stage)) best.set(row.stage, row.score);
  return OSANPO_RUN_STAGE_IDS.flatMap((stage): DecorEntry[] => {
    const score = best.get(stage);
    if (score === undefined || score <= 0) return [];
    const rank = OSANPO_RUN_RANKS.find((r) => score >= r.min) ?? OSANPO_RUN_RANKS[OSANPO_RUN_RANKS.length - 1]!;
    return [{ kind: "trophy", key: trophyDecorKey(stage), name: `おさんぽ ${OSANPO_RUN_STAGES[stage].name}`, rank: rank.label, color: rank.color, score, count: 1 }];
  });
}

/** おでかけを記録した都道府県ごとに、おみやげのペナントが1つ */
async function getRoomSouvenirs(supabase: DB, userId: string): Promise<DecorEntry[]> {
  const { data: visits, error } = await supabase.from("visit_records").select("spot_id").eq("user_id", userId).limit(2000);
  if (error || !visits?.length) return [];
  const spotIds = [...new Set(visits.map((v) => v.spot_id))];
  const { data: spots } = await supabase.from("spots").select("prefecture_code").in("id", spotIds);
  const codes = new Set((spots ?? []).map((s) => s.prefecture_code));
  return PREFECTURE_NAMES.flatMap((pref): DecorEntry[] => {
    const look = SOUVENIRS[pref.code];
    if (!codes.has(pref.code) || !look) return [];
    return [{ kind: "souvenir", key: souvenirDecorKey(pref.code), name: pref.name, emoji: look.emoji, color: look.color, count: 1 }];
  });
}
