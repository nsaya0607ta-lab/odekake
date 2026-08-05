/**
 * 店舗・施設検索の入り口
 * =============================================================
 * 初期版では外部の検索サービスに接続していないため、既定の提供元は
 * 「未接続」を返すだけの none です。あとから Google Places / OpenStreetMap
 * などを足すときは、PlaceSearchProvider を実装して PROVIDERS へ登録し、
 * 環境変数 NEXT_PUBLIC_PLACE_SEARCH_PROVIDER で切り替えます。
 *
 * 検索結果は SpotLocation にそのまま変換できる形にしてあるので、
 * 画面側（LocationPicker）は提供元が増えても変更不要です。
 */
import type { LocationSource } from "@/lib/supabase/types";

export type PlaceCandidate = {
  /** 提供元の中で一意な ID。spots.place_id に保存する */
  placeId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  /** 位置の誤差の目安（メートル） */
  accuracyMeters: number | null;
  category: string | null;
};

export type PlaceSearchQuery = {
  keyword: string;
  /** 中心にする座標（現在地や市区町村の代表地点） */
  near?: { latitude: number; longitude: number } | null;
  limit?: number;
};

export type PlaceSearchResult =
  | { status: "ok"; provider: string; candidates: PlaceCandidate[] }
  | { status: "unavailable"; provider: string; message: string };

export type PlaceSearchProvider = {
  id: string;
  label: string;
  /** 画面に検索欄を出すかどうか */
  enabled: boolean;
  search(query: PlaceSearchQuery): Promise<PlaceSearchResult>;
};

const noneProvider: PlaceSearchProvider = {
  id: "none",
  label: "未接続",
  enabled: false,
  async search() {
    return {
      status: "unavailable",
      provider: "none",
      message: "店舗検索はまだ利用できません。市区町村・現在地・地図から場所を選んでください。",
    };
  },
};

const PROVIDERS: Record<string, PlaceSearchProvider> = {
  none: noneProvider,
};

export function registerPlaceSearchProvider(provider: PlaceSearchProvider) {
  PROVIDERS[provider.id] = provider;
}

export function getPlaceSearchProvider(): PlaceSearchProvider {
  const id = process.env.NEXT_PUBLIC_PLACE_SEARCH_PROVIDER ?? "none";
  return PROVIDERS[id] ?? noneProvider;
}

/** 検索結果をスポットの位置情報へ変換する */
export function toSpotLocation(candidate: PlaceCandidate, provider: string) {
  return {
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    locationSource: "place_search" as LocationSource,
    locationAccuracyMeters: candidate.accuracyMeters,
    placeProvider: provider,
    placeId: candidate.placeId,
  };
}
