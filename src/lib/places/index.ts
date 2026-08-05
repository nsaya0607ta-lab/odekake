/** 店舗・施設検索のクライアント側インターフェース。 */
import type { LocationSource } from "@/lib/supabase/types";

export type PlaceSuggestion = {
  placeId: string;
  name: string;
  address: string | null;
};

export type PlaceCandidate = PlaceSuggestion & {
  latitude: number;
  longitude: number;
  /** 位置の誤差の目安（メートル） */
  accuracyMeters: number | null;
  postalCode: string | null;
  category: string | null;
};

export type PlaceSearchQuery = {
  keyword: string;
  sessionToken: string;
  /** 中心にする座標（現在地や市区町村の代表地点） */
  near?: { latitude: number; longitude: number } | null;
  signal?: AbortSignal;
};

export type PlaceSuggestionResult =
  | { status: "ok"; provider: string; suggestions: PlaceSuggestion[] }
  | { status: "unavailable"; provider: string; message: string };

export type PlaceDetailsResult =
  | { status: "ok"; provider: string; candidate: PlaceCandidate }
  | { status: "unavailable"; provider: string; message: string };

export type PlaceSearchProvider = {
  id: string;
  label: string;
  /** 画面に検索欄を出すかどうか */
  enabled: boolean;
  suggest(query: PlaceSearchQuery): Promise<PlaceSuggestionResult>;
  details(
    suggestion: PlaceSuggestion,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<PlaceDetailsResult>;
};

type ApiError = { error?: string };

async function messageOf(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as ApiError;
  return typeof body.error === "string" && body.error ? body.error : fallback;
}

const noneProvider: PlaceSearchProvider = {
  id: "none",
  label: "未接続",
  enabled: false,
  async suggest() {
    return {
      status: "unavailable",
      provider: "none",
      message: "店舗検索はまだ利用できません。市区町村・現在地・地図から場所を選んでください。",
    };
  },
  async details() {
    return {
      status: "unavailable",
      provider: "none",
      message: "店舗検索はまだ利用できません。",
    };
  },
};

function googleProvider(enabled: boolean): PlaceSearchProvider {
  return {
    id: "google_places",
    label: "Google マップ",
    enabled,
    async suggest(query) {
      if (!enabled) return noneProvider.suggest(query);

      const response = await fetch("/api/places/autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: query.keyword,
          sessionToken: query.sessionToken,
          near: query.near ?? null,
        }),
        signal: query.signal,
      }).catch(() => null);

      if (!response) {
        return {
          status: "unavailable",
          provider: "google_places",
          message: "Google マップの検索候補を取得できませんでした。",
        };
      }
      if (!response.ok) {
        return {
          status: "unavailable",
          provider: "google_places",
          message: await messageOf(response, "Google マップの検索候補を取得できませんでした。"),
        };
      }

      const body = (await response.json()) as { suggestions?: PlaceSuggestion[] };
      return {
        status: "ok",
        provider: "google_places",
        suggestions: Array.isArray(body.suggestions) ? body.suggestions : [],
      };
    },
    async details(suggestion, sessionToken, signal) {
      if (!enabled) return noneProvider.details(suggestion, sessionToken, signal);

      const response = await fetch(
        `/api/places/details/${encodeURIComponent(suggestion.placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`,
        { signal },
      ).catch(() => null);

      if (!response) {
        return {
          status: "unavailable",
          provider: "google_places",
          message: "選択した場所の詳細を取得できませんでした。",
        };
      }
      if (!response.ok) {
        return {
          status: "unavailable",
          provider: "google_places",
          message: await messageOf(response, "選択した場所の詳細を取得できませんでした。"),
        };
      }

      const body = (await response.json()) as Omit<PlaceCandidate, "name" | "category">;
      return {
        status: "ok",
        provider: "google_places",
        candidate: {
          ...body,
          placeId: body.placeId || suggestion.placeId,
          name: suggestion.name,
          address: body.address ?? suggestion.address,
          category: null,
        },
      };
    },
  };
}

export function getPlaceSearchProvider(enabled = false): PlaceSearchProvider {
  return googleProvider(enabled);
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
