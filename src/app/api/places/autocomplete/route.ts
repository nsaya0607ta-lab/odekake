import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const GOOGLE_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";

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

async function isAuthenticated() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return Boolean(data?.claims?.sub);
}

function validCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return json({ error: "ログインが必要です。" }, 401);

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

  const googleBody: Record<string, unknown> = {
    input,
    sessionToken,
    languageCode: "ja",
    regionCode: "jp",
    includedRegionCodes: ["jp"],
    includeQueryPredictions: false,
  };

  const latitude = body.near?.latitude;
  const longitude = body.near?.longitude;
  if (validCoordinate(latitude, -90, 90) && validCoordinate(longitude, -180, 180)) {
    const origin = { latitude, longitude };
    googleBody.origin = origin;
    googleBody.locationBias = {
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
