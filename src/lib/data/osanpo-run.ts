import { PREFECTURE_NAMES } from "@/lib/geo/prefecture-names";
import type { DB } from "./client";
import { todayInJapan } from "@/lib/date";
import { signThumbOrOriginalPaths } from "./photos";
import { getPersonalTextFeed } from "./sns";

/** おさんぽフレンチーで飛行機が空を運んでくる、自分のおでかけ写真 */
export type OsanpoRunMemoryPhoto = {
  /** サムネイル（長辺480px・縦横比はそのまま）の配信URL */
  src: string;
  /** スポット名 */
  name: string;
  /** 都道府県名（分からなければ空） */
  pref: string;
  /** この写真の訪問記録（おさんぽの結果画面から記録を開く） */
  visitId: string;
};

/** 新しい順にこれだけ読む。枠の向き（縦・横）はゲーム側で写真の縦横比から決める */
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
    return [{ src, name: spot.name, pref, visitId: p.visit_record_id }];
  });
}

/**
 * おさんぽフレンチーとアプリの記録をつなぐ情報。
 * - recordedToday: 今日（日本時間）の訪問記録があるか。あるとスコアにおでかけボーナスが付く
 * - themes: 最近の訪問スポットのカテゴリの割合（0〜1）。道の景色に混ざるもの（木・鳥居・行ったお店の看板）の出やすさになる
 * - shopNames: 行ったお店・施設の名前。道ぞいの看板や屋台に書く
 */
export type OsanpoRunOdekake = {
  recordedToday: boolean;
  themes: { green: number; shrine: number; shop: number };
  shopNames: string[];
  /** よく行くカテゴリ（多い順・最大3つ）。スタート画面の説明に使う */
  topLabels: string[];
};

/** カテゴリID（categories テーブル）→ 景色のまとまり */
const GREEN_CATEGORIES = new Set([8, 9, 15, 16]); // 公園・自然・海・展望台 → 木
const SHRINE_CATEGORIES = new Set([10, 11]); // 神社・寺院 → 鳥居
const SHOP_CATEGORIES = new Set([1, 2, 4, 5, 6, 7, 13]); // 飲食店・カフェ・宿・温泉・お店・レジャー・道の駅 → 看板
const THEME_LABELS = { green: "公園・自然", shrine: "神社・お寺", shop: "お店・カフェ" } as const;
/** 景色に使う最近の訪問の件数 */
const ODEKAKE_VISIT_LIMIT = 200;
const SHOP_NAME_LIMIT = 16;
const SHOP_NAME_MAX_CHARS = 8;

const EMPTY_ODEKAKE: OsanpoRunOdekake = { recordedToday: false, themes: { green: 0, shrine: 0, shop: 0 }, shopNames: [], topLabels: [] };

/** 日本時間の日付（YYYY-MM-DD） */
const jstDate = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date(iso));

export async function getOsanpoRunOdekake(supabase: DB, userId: string): Promise<OsanpoRunOdekake> {
  const { data: visits, error } = await supabase
    .from("visit_records")
    .select("spot_id, visited_at, created_at")
    .eq("user_id", userId)
    .order("visited_at", { ascending: false })
    .limit(ODEKAKE_VISIT_LIMIT);
  if (error) {
    console.warn("Osanpo run odekake info is unavailable", { code: error.code, message: error.message });
    return EMPTY_ODEKAKE;
  }
  if (!visits?.length) return EMPTY_ODEKAKE;

  const today = todayInJapan();
  const recordedToday = visits.some((v) => v.visited_at === today || jstDate(v.created_at) === today);

  const spotIds = [...new Set(visits.map((v) => v.spot_id))];
  const { data: spots } = await supabase.from("spots").select("id, name, category_id").in("id", spotIds);
  const spotById = new Map((spots ?? []).map((s) => [s.id, s]));

  const counts = { green: 0, shrine: 0, shop: 0 };
  const shopNames: string[] = [];
  for (const v of visits) {
    const spot = spotById.get(v.spot_id);
    const cat = spot?.category_id;
    if (!spot || cat == null) continue;
    if (GREEN_CATEGORIES.has(cat)) counts.green += 1;
    else if (SHRINE_CATEGORIES.has(cat)) counts.shrine += 1;
    else if (SHOP_CATEGORIES.has(cat)) {
      counts.shop += 1;
      const name = spot.name.trim();
      if (name && shopNames.length < SHOP_NAME_LIMIT && !shopNames.includes(name)) shopNames.push(name);
    }
  }
  const total = visits.length;
  const themes = { green: counts.green / total, shrine: counts.shrine / total, shop: counts.shop / total };
  const topLabels = (Object.keys(counts) as (keyof typeof counts)[])
    .filter((k) => counts[k] > 0)
    .sort((a, b) => counts[b] - counts[a])
    .map((k) => THEME_LABELS[k]);
  return {
    recordedToday,
    themes,
    shopNames: shopNames.map((n) => (n.length > SHOP_NAME_MAX_CHARS ? `${n.slice(0, SHOP_NAME_MAX_CHARS - 1)}…` : n)),
    topLabels,
  };
}

/** おさんぽフレンチーで気球が空を運んでくる、フレンドのSNS投稿の写真 */
export type OsanpoRunFriendMemory = {
  postId: string;
  /** 投稿の1枚目の写真（サムネイル）の配信URL */
  src: string;
  /** 投稿した人の表示名 */
  author: string;
  /** 投稿に紐づいたスポット名（無ければ空） */
  spot: string;
  /** すでに自分がいいねしているか */
  liked: boolean;
};

/** 新しい投稿からこれだけ読み、写真つきのフレンドの投稿を最大 FRIEND_MEMORY_LIMIT 件使う */
const FRIEND_FEED_LIMIT = 60;
const FRIEND_MEMORY_LIMIT = 20;
/** これより古い投稿は運ばない（日） */
const FRIEND_MEMORY_DAYS = 30;

export async function getOsanpoRunFriendMemories(supabase: DB, userId: string): Promise<OsanpoRunFriendMemory[]> {
  let posts;
  try {
    posts = await getPersonalTextFeed(supabase, undefined, FRIEND_FEED_LIMIT);
  } catch {
    return [];
  }
  const since = Date.now() - FRIEND_MEMORY_DAYS * 24 * 60 * 60_000;
  const picked = posts
    .filter((post) => post.user_id !== userId && post.photo_paths.length > 0 && Date.parse(post.created_at) >= since)
    .slice(0, FRIEND_MEMORY_LIMIT);
  if (!picked.length) return [];
  const urls = await signThumbOrOriginalPaths(supabase, picked.map((post) => post.photo_paths[0]!));
  return picked.flatMap((post) => {
    const src = urls.get(post.photo_paths[0]!);
    if (!src) return [];
    return [{ postId: post.id, src, author: post.display_name || "フレンド", spot: post.linked_spot_name ?? "", liked: post.my_liked }];
  });
}
