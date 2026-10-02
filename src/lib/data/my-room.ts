import { COLLECTION_ITEMS } from "@/lib/collection/items";
import { OSANPO_RUN_RANKS, OSANPO_RUN_STAGE_IDS, OSANPO_RUN_STAGES } from "@/lib/games/osanpo-run/config";
import { PREFECTURE_NAMES } from "@/lib/geo/prefecture-names";
import { PENNANTS } from "@/lib/room/themes";
import { isDogSkinId, type DogSkinId } from "@/lib/dog-skins";
import { cleanDogName, isShopId, parseRoomLayout, pennantKey, photoKey, trophyKey, type DecorEntry, type RoomLayout, type RoomShop } from "@/lib/room/types";
import type { Json } from "@/lib/supabase/types";
import type { DB } from "./client";
import { getOwnedItemCounts } from "./collection";
import { signPhotoPaths, signThumbOrOriginalPaths } from "./photos";

/** 飾れる写真は新しい順にこれだけ */
const ROOM_PHOTO_LIMIT = 60;
/** テーブルがまだ無い環境（マイグレーション前） */
const UNAVAILABLE_CODES = new Set(["42P01", "PGRST205"]);

export type MyRoomState = {
  /** 保存してある部屋（まだ1度も保存していなければ null） */
  layout: RoomLayout | null;
  /** サーバーに保存できるか（できなければ端末に保存する） */
  ready: boolean;
};

export async function getMyRoom(supabase: DB, userId: string): Promise<MyRoomState> {
  const { data, error } = await supabase.from("user_rooms").select("layout").eq("user_id", userId).maybeSingle();
  if (error) {
    if (!UNAVAILABLE_CODES.has(error.code ?? "")) console.warn("My room is unavailable", { code: error.code, message: error.message });
    return { layout: null, ready: false };
  }
  return { layout: data ? parseRoomLayout(data.layout) : null, ready: true };
}

/** 持っている家具・窓・棚などの数と、青コインの残高（青コインの仕組みが無い環境では ready: false） */
export async function getRoomShop(supabase: DB, userId: string): Promise<RoomShop> {
  // 型の定義にまだ無いテーブルなので、ゆるく読む
  const from = supabase.from.bind(supabase) as unknown as (t: string) => {
    select: (c: string) => { eq: (k: string, v: string) => PromiseLike<{ data: Record<string, unknown>[] | null; error: { code?: string; message: string } | null }> };
  };
  const [coins, furniture] = await Promise.all([
    from("user_blue_coins").select("balance").eq("user_id", userId),
    from("user_room_furniture").select("furniture, count").eq("user_id", userId),
  ]);
  const error = coins.error ?? furniture.error;
  if (error) {
    if (!UNAVAILABLE_CODES.has(error.code ?? "")) console.warn("Room shop is unavailable", { code: error.code, message: error.message });
    return { ready: false, blueCoins: 0, owned: {} };
  }
  const owned: RoomShop["owned"] = {};
  for (const row of furniture.data ?? []) {
    if (isShopId(row.furniture) && typeof row.count === "number") owned[row.furniture] = row.count;
  }
  const balance = coins.data?.[0]?.balance;
  return { ready: true, blueCoins: typeof balance === "number" ? balance : 0, owned };
}

/** フレンドのわんこの名前と見た目（お泊まり会・窓の外を通る犬で使う。関数がまだ無い環境では空） */
export async function getFriendDogs(supabase: DB): Promise<Map<string, { dogName?: string; skin: DogSkinId }>> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (fn: "get_friend_dogs") => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;
  const { data, error } = await rpc("get_friend_dogs");
  const map = new Map<string, { dogName?: string; skin: DogSkinId }>();
  if (error || !Array.isArray(data)) return map;
  for (const row of data as Record<string, unknown>[]) {
    if (typeof row.friend_user_id !== "string") continue;
    const dogName = cleanDogName(row.dog_name);
    map.set(row.friend_user_id, { ...(dogName ? { dogName } : {}), skin: isDogSkinId(row.dog_skin) ? row.dog_skin : "default" });
  }
  return map;
}

/** おへやに飾れるもの（図鑑アイテム・写真・トロフィー・ペナント） */
export async function getRoomInventory(supabase: DB, userId: string): Promise<DecorEntry[]> {
  const [ownedCounts, photos, trophies, pennants] = await Promise.all([
    getOwnedItemCounts(supabase, userId),
    getRoomPhotos(supabase, userId),
    getRoomTrophies(supabase, userId),
    getRoomPennants(supabase, userId),
  ]);
  const items = COLLECTION_ITEMS.flatMap((item): DecorEntry[] => {
    const count = ownedCounts.get(item.id) ?? 0;
    if (count <= 0 || !item.image) return [];
    return [{ kind: "item", key: item.id, name: item.name, image: item.image, count, category: item.category, series: item.series ?? null, rarity: item.rarity }];
  });
  return [...items, ...photos, ...trophies, ...pennants];
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
  const { data: visits } = await supabase.from("visit_records").select("id, spot_id, visited_at, comment").in("id", visitIds);
  const visitById = new Map((visits ?? []).map((v) => [v.id, v]));
  const spotIds = [...new Set((visits ?? []).map((v) => v.spot_id))];
  const { data: spots } = spotIds.length ? await supabase.from("spots").select("id, name, prefecture_code").in("id", spotIds) : { data: [] };
  const spotById = new Map((spots ?? []).map((s) => [s.id, s]));
  const paths = photos.map((p) => p.storage_path);
  const [thumbs, fulls] = await Promise.all([signThumbOrOriginalPaths(supabase, paths), signPhotoPaths(supabase, paths)]);
  return photos.flatMap((p): DecorEntry[] => {
    const image = thumbs.get(p.storage_path);
    const visit = visitById.get(p.visit_record_id);
    if (!image || !visit) return [];
    const spot = spotById.get(visit.spot_id);
    return [{
      kind: "photo", key: photoKey(p.id), name: spot?.name ?? "おでかけ", image, full: fulls.get(p.storage_path) ?? image,
      date: visit.visited_at, comment: (visit.comment ?? "").trim(),
      pref: PREFECTURE_NAMES.find((x) => x.code === spot?.prefecture_code)?.name ?? "", count: 1,
    }];
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
    return [{ kind: "trophy", key: trophyKey(stage), name: `おさんぽ ${OSANPO_RUN_STAGES[stage].name}`, stage: OSANPO_RUN_STAGES[stage].name, rank: rank.label, color: rank.color, score, count: 1 }];
  });
}

/** おでかけを記録した都道府県ごとに、名物のペナントが1つ */
async function getRoomPennants(supabase: DB, userId: string): Promise<DecorEntry[]> {
  const { data: visits, error } = await supabase.from("visit_records").select("spot_id").eq("user_id", userId).limit(3000);
  if (error || !visits?.length) return [];
  const spotIds = [...new Set(visits.map((v) => v.spot_id))];
  const { data: spots } = await supabase.from("spots").select("prefecture_code").in("id", spotIds);
  const codes = new Set((spots ?? []).map((s) => s.prefecture_code));
  return PREFECTURE_NAMES.flatMap((pref): DecorEntry[] => {
    const look = PENNANTS[pref.code];
    if (!codes.has(pref.code) || !look) return [];
    return [{ kind: "pennant", key: pennantKey(pref.code), name: pref.name, emoji: look.emoji, color: look.color, count: 1 }];
  });
}

/* ---------- フレンドの部屋 ---------- */

type ShowTrophy = { name: string; stage: string; rank: string; color: string; score: number };
type ShowPhoto = { path: string; name: string; date: string; comment: string; pref: string };
/** 見る人の側だけでは描けない、飾ったものの見た目（保存のたびに持ち主が書く） */
export type RoomShowcase = { dog: DogSkinId; trophies: Record<string, ShowTrophy>; photos: Record<string, ShowPhoto> };

export async function buildRoomShowcase(supabase: DB, userId: string, layout: RoomLayout, dog: DogSkinId): Promise<RoomShowcase> {
  const keys = new Set(layout.items.map((p) => p.key));
  const photoIds = [...keys].flatMap((k) => (k.startsWith("photo:") ? [k.slice(6)] : [])).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const [trophies, photos] = await Promise.all([
    [...keys].some((k) => k.startsWith("trophy:")) ? getRoomTrophies(supabase, userId) : Promise.resolve([]),
    photoIds.length ? getPhotoDetails(supabase, userId, photoIds) : Promise.resolve([]),
  ]);
  const show: RoomShowcase = { dog, trophies: {}, photos: {} };
  for (const t of trophies) if (t.kind === "trophy" && keys.has(t.key)) show.trophies[t.key] = { name: t.name, stage: t.stage, rank: t.rank, color: t.color, score: t.score };
  for (const ph of photos) show.photos[photoKey(ph.id)] = { path: ph.path, name: ph.name, date: ph.date, comment: ph.comment.slice(0, 200), pref: ph.pref };
  return show;
}

async function getPhotoDetails(supabase: DB, userId: string, ids: string[]) {
  const { data: photos } = await supabase.from("visit_photos").select("id, storage_path, visit_record_id").eq("user_id", userId).in("id", ids);
  if (!photos?.length) return [];
  const { data: visits } = await supabase.from("visit_records").select("id, spot_id, visited_at, comment").in("id", [...new Set(photos.map((p) => p.visit_record_id))]);
  const visitById = new Map((visits ?? []).map((v) => [v.id, v]));
  const spotIds = [...new Set((visits ?? []).map((v) => v.spot_id))];
  const { data: spots } = spotIds.length ? await supabase.from("spots").select("id, name, prefecture_code").in("id", spotIds) : { data: [] };
  const spotById = new Map((spots ?? []).map((s) => [s.id, s]));
  return photos.flatMap((p) => {
    const visit = visitById.get(p.visit_record_id);
    if (!visit) return [];
    const spot = spotById.get(visit.spot_id);
    return [{
      id: p.id, path: p.storage_path, name: spot?.name ?? "おでかけ", date: visit.visited_at, comment: (visit.comment ?? "").trim(),
      pref: PREFECTURE_NAMES.find((x) => x.code === spot?.prefecture_code)?.name ?? "",
    }];
  });
}

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
function parseShowcase(value: Json | null): RoomShowcase {
  const raw = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, unknown>;
  const rec = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, Record<string, unknown>>) : {});
  const trophies: RoomShowcase["trophies"] = {};
  for (const [k, t] of Object.entries(rec(raw.trophies))) {
    if (!k.startsWith("trophy:") || !t || typeof t !== "object") continue;
    trophies[k] = { name: str(t.name, 60), stage: str(t.stage, 40), rank: str(t.rank, 8), color: /^#[0-9a-f]{3,8}$/i.test(str(t.color)) ? str(t.color) : "#C9A14A", score: typeof t.score === "number" ? t.score : 0 };
  }
  const photos: RoomShowcase["photos"] = {};
  for (const [k, ph] of Object.entries(rec(raw.photos))) {
    if (!k.startsWith("photo:") || !ph || typeof ph !== "object" || typeof ph.path !== "string") continue;
    photos[k] = { path: ph.path, name: str(ph.name, 80), date: str(ph.date, 10), comment: str(ph.comment), pref: str(ph.pref, 10) };
  }
  return { dog: isDogSkinId(raw.dog) ? raw.dog : "default", trophies, photos };
}

export type FriendRoom = {
  name: string;
  layout: RoomLayout | null;
  entries: DecorEntry[];
  dog: DogSkinId;
  likeCount: number;
  liked: boolean;
  /** 自分がこの部屋に置いた手紙（新しい順） */
  myNotes: { id: string; body: string; createdAt: string }[];
};

/** フレンドの部屋（フレンドでなければ null） */
export async function getFriendRoom(supabase: DB, viewerId: string, friendId: string): Promise<FriendRoom | null> {
  const { data, error } = await supabase.rpc("get_friend_room", { p_friend_user_id: friendId });
  if (error) {
    if (!UNAVAILABLE_CODES.has(error.code ?? "") && error.code !== "PGRST202" && error.code !== "42883") console.warn("Friend room is unavailable", { code: error.code, message: error.message });
    return null;
  }
  const row = data?.[0];
  if (!row) return null;
  const layout = row.layout ? parseRoomLayout(row.layout) : null;
  const show = parseShowcase(row.showcase);
  const keys = new Set(layout?.items.map((p) => p.key) ?? []);
  const paths = [...keys].flatMap((k) => (show.photos[k] ? [show.photos[k]!.path] : []));
  const [thumbs, fulls, notes] = await Promise.all([
    signThumbOrOriginalPaths(supabase, paths),
    signPhotoPaths(supabase, paths),
    supabase.from("room_notes").select("id, body, created_at").eq("room_owner", friendId).eq("author_id", viewerId).order("created_at", { ascending: false }).limit(5),
  ]);
  const entries = [...keys].flatMap((key): DecorEntry[] => {
    if (key.startsWith("trophy:")) {
      const t = show.trophies[key];
      return t ? [{ kind: "trophy", key, ...t, count: 1 }] : [];
    }
    if (key.startsWith("photo:")) {
      const ph = show.photos[key];
      const image = ph ? thumbs.get(ph.path) : undefined;
      return ph && image ? [{ kind: "photo", key, name: ph.name, image, full: fulls.get(ph.path) ?? image, date: ph.date, comment: ph.comment, pref: ph.pref, count: 1 }] : [];
    }
    if (key.startsWith("pennant:")) {
      const code = key.slice(8), look = PENNANTS[code], pref = PREFECTURE_NAMES.find((p) => p.code === code);
      return look && pref ? [{ kind: "pennant", key, name: pref.name, emoji: look.emoji, color: look.color, count: 1 }] : [];
    }
    const item = COLLECTION_ITEMS.find((i) => i.id === key);
    return item?.image ? [{ kind: "item", key, name: item.name, image: item.image, count: 1, category: item.category, series: item.series ?? null, rarity: item.rarity }] : [];
  });
  return {
    name: row.display_name, layout, entries, dog: show.dog, likeCount: row.like_count, liked: row.liked,
    myNotes: (notes.data ?? []).map((n) => ({ id: n.id, body: n.body, createdAt: n.created_at })),
  };
}

export type RoomMail = { kind: "note" | "like"; id: string; userId: string; name: string; body: string | null; createdAt: string };

/** 自分の部屋に届いた「いいね」と置き手紙（新しい順） */
export async function getRoomMailbox(supabase: DB, limit = 20): Promise<RoomMail[]> {
  const { data, error } = await supabase.rpc("get_room_mailbox", { p_limit: limit });
  if (error) return [];
  return (data ?? []).map((m) => ({ kind: m.kind, id: m.id, userId: m.user_id, name: m.display_name, body: m.body, createdAt: m.created_at }));
}
