import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { nearestMunicipality } from "@/lib/geo/municipalities";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const GOOGLE_NEARBY_SEARCH_URL = "https://places.googleapis.com/v1/places:searchNearby";

type NearbyBody = {
  latitude?: unknown;
  longitude?: unknown;
};

type GoogleNearbyPlace = {
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

  const rate = checkRateLimit(`places:nearby:${userId}`, 20, 60_000);
  if (!rate.allowed) {
    return json({ error: "周辺検索の回数が多すぎます。少し時間をおいてください。" }, 429);
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) return json({ error: "Google Places API が未設定です。" }, 503);

  let body: NearbyBody;
  try {
    body = (await request.json()) as NearbyBody;
  } catch {
    return json({ error: "現在地を読み取れませんでした。" }, 400);
  }

  const latitude = body.latitude;
  const longitude = body.longitude;
  if (!validCoordinate(latitude, -90, 90) || !validCoordinate(longitude, -180, 180)) {
    return json({ error: "現在地が正しくありません。" }, 400);
  }

  const origin = { latitude, longitude };
  const response = await fetch(GOOGLE_NEARBY_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
    },
    body: JSON.stringify({
      maxResultCount: 15,
      rankPreference: "DISTANCE",
      languageCode: "ja",
      regionCode: "jp",
      locationRestriction: {
        circle: {
          center: origin,
          radius: 500,
        },
      },
    }),
    cache: "no-store",
  }).catch(() => null);

  if (!response) return json({ error: "周辺の場所を検索できませんでした。" }, 502);

  const payload = (await response.json().catch(() => ({}))) as {
    places?: GoogleNearbyPlace[];
    error?: { message?: string };
  };
  if (!response.ok) {
    console.error("Google Places nearby search failed", response.status, payload.error?.message);
    return json({ error: "Google マップの周辺候補を取得できませんでした。" }, 502);
  }

  const places = (payload.places ?? []).flatMap((place) => {
    const placeId = place.id;
    const name = place.displayName?.text;
    const placeLatitude = place.location?.latitude;
    const placeLongitude = place.location?.longitude;
    if (
      !placeId ||
      !name ||
      !validCoordinate(placeLatitude, -90, 90) ||
      !validCoordinate(placeLongitude, -180, 180)
    ) {
      return [];
    }

    const nearest = nearestMunicipality(placeLatitude, placeLongitude);
    if (!nearest) return [];

    return [{
      placeId,
      name,
      address: place.formattedAddress ?? "",
      latitude: placeLatitude,
      longitude: placeLongitude,
      prefectureCode: nearest.municipality.prefectureCode,
      municipalityCode: nearest.municipality.code,
      distanceMeters: distanceMeters(origin, {
        latitude: placeLatitude,
        longitude: placeLongitude,
      }),
    }];
  }).sort((a, b) => a.distanceMeters - b.distanceMeters);

  return json({ places });
}
