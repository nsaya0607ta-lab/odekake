import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const GOOGLE_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const GOOGLE_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

type AutocompleteBody = {
  input?: unknown;
  sessionToken?: unknown;
  near?: {
    latitude?: unknown;
    longitude?: unknown;
  } | null;
};

type GoogleSuggestion = {
  placePrediction?: {
    placeId?: string;
    distanceMeters?: number;
    text?: { text?: string };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
  };
};

type GoogleTextPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
};

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return typeof sub === "string" ? sub : null;
}

function validCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function distanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const fromLatitude = radians(from.latitude);
  const toLatitude = radians(to.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return json({ error: "ログインが必要です。" }, 401);

  // Google Places は呼ぶたびに課金される。1人が短時間に叩き続けられないようにする（60秒あたり60回）
  const rate = checkRateLimit(`places:auto:${userId}`, 60, 60_000);
  if (!rate.allowed) {
    return json(
      { error: "検索の回数が多すぎます。少し時間をおいてからお試しください。" },
      429,
    );
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) return json({ error: "Google Places API が未設定です。" }, 503);

  let body: AutocompleteBody;
  try {
    body = (await request.json()) as AutocompleteBody;
  } catch {
    return json({ error: "検索条件が正しくありません。" }, 400);
  }

  const input = typeof body.input === "string" ? body.input.trim().slice(0, 100) : "";
  const sessionToken = typeof body.sessionToken === "string" ? body.sessionToken.trim() : "";

  if (input.length < 2) return json({ suggestions: [] });
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(sessionToken)) {
    return json({ error: "検索セッションが正しくありません。" }, 400);
  }

  const latitude = body.near?.latitude;
  const longitude = body.near?.longitude;
  const origin =
    validCoordinate(latitude, -90, 90) && validCoordinate(longitude, -180, 180)
      ? { latitude, longitude }
      : null;

  // 現在地や選択地点がある場合は、候補入力向けのAutocompleteではなく
  // 複数店舗の検索向けText Searchを使い、距離順で最大20件取得する。
  if (origin) {
    const textSearchResponse = await fetch(GOOGLE_TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
      },
      body: JSON.stringify({
        textQuery: input,
        pageSize: 20,
        languageCode: "ja",
        regionCode: "jp",
        rankPreference: "DISTANCE",
        locationBias: {
          circle: {
            center: origin,
            radius: 30_000,
          },
        },
      }),
      cache: "no-store",
    }).catch(() => null);

    if (textSearchResponse) {
      const textSearchPayload = (await textSearchResponse.json().catch(() => ({}))) as {
        places?: GoogleTextPlace[];
        error?: { message?: string };
      };

      if (textSearchResponse.ok) {
        const suggestions = (textSearchPayload.places ?? [])
          .flatMap((place) => {
            const placeId = place.id;
            const name = place.displayName?.text;
            const placeLatitude = place.location?.latitude;
            const placeLongitude = place.location?.longitude;
            if (!placeId || !name) return [];

            const calculatedDistance =
              validCoordinate(placeLatitude, -90, 90) && validCoordinate(placeLongitude, -180, 180)
                ? distanceMeters(origin, { latitude: placeLatitude, longitude: placeLongitude })
                : null;

            return [
              {
                placeId,
                name,
                address: place.formattedAddress ?? null,
                distanceMeters: calculatedDistance,
                searchMode: "text_search" as const,
              },
            ];
          })
          .sort((a, b) => {
            if (a.distanceMeters === null) return 1;
            if (b.distanceMeters === null) return -1;
            return a.distanceMeters - b.distanceMeters;
          })
          .slice(0, 20);

        if (suggestions.length > 0) return json({ suggestions });
      } else {
        console.warn(
          "Google Places text search failed; falling back to autocomplete",
          textSearchResponse.status,
          textSearchPayload.error?.message,
        );
      }
    }
  }

  // 現在地がない場合、またはText Searchで候補を取得できなかった場合は
  // 入力補完としてAutocompleteを利用する。
  const googleBody: Record<string, unknown> = {
    input,
    sessionToken,
    languageCode: "ja",
    regionCode: "jp",
    includedRegionCodes: ["jp"],
    includeQueryPredictions: false,
  };

  if (origin) {
    googleBody.origin = origin;
    googleBody.locationRestriction = {
      circle: {
        center: origin,
        radius: 30_000,
      },
    };
  }

  const response = await fetch(GOOGLE_AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": [
        "suggestions.placePrediction.placeId",
        "suggestions.placePrediction.distanceMeters",
        "suggestions.placePrediction.text.text",
        "suggestions.placePrediction.structuredFormat.mainText.text",
        "suggestions.placePrediction.structuredFormat.secondaryText.text",
      ].join(","),
    },
    body: JSON.stringify(googleBody),
    cache: "no-store",
  }).catch(() => null);

  if (!response) return json({ error: "店舗検索に接続できませんでした。" }, 502);

  const payload = (await response.json().catch(() => ({}))) as {
    suggestions?: GoogleSuggestion[];
    error?: { message?: string };
  };

  if (!response.ok) {
    console.error("Google Places autocomplete failed", response.status, payload.error?.message);
    return json({ error: "Google マップの候補を取得できませんでした。" }, 502);
  }

  const suggestions = (payload.suggestions ?? [])
    .flatMap((item) => {
      const prediction = item.placePrediction;
      const placeId = prediction?.placeId;
      const name = prediction?.structuredFormat?.mainText?.text ?? prediction?.text?.text;
      if (!placeId || !name) return [];
      return [
        {
          placeId,
          name,
          address: prediction?.structuredFormat?.secondaryText?.text ?? null,
          distanceMeters:
            typeof prediction?.distanceMeters === "number" && Number.isFinite(prediction.distanceMeters)
              ? Math.max(0, Math.round(prediction.distanceMeters))
              : null,
          searchMode: "autocomplete" as const,
        },
      ];
    })
    .sort((a, b) => {
      if (a.distanceMeters === null) return 1;
      if (b.distanceMeters === null) return -1;
      return a.distanceMeters - b.distanceMeters;
    })
    .slice(0, 5);

  return json({ suggestions });
}
