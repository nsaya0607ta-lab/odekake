import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type GooglePlace = {
  id?: string;
  formattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  addressComponents?: GoogleAddressComponent[];
  error?: { message?: string };
};

async function isAuthenticated() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return Boolean(data?.claims?.sub);
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ placeId: string }> },
) {
  if (!(await isAuthenticated())) return json({ error: "ログインが必要です。" }, 401);

  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) return json({ error: "Google Places API が未設定です。" }, 503);

  const { placeId: rawPlaceId } = await params;
  const placeId = rawPlaceId.trim();
  const sessionToken = new URL(request.url).searchParams.get("sessionToken")?.trim() ?? "";

  if (!/^[A-Za-z0-9_-]{5,300}$/.test(placeId)) {
    return json({ error: "選択した場所が正しくありません。" }, 400);
  }
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(sessionToken)) {
    return json({ error: "検索セッションが正しくありません。" }, 400);
  }

  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  url.searchParams.set("languageCode", "ja");
  url.searchParams.set("regionCode", "jp");
  url.searchParams.set("sessionToken", sessionToken);

  const response = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      // 登録に必要な最小限の項目だけ取得し、上位料金の電話番号・営業時間等は取得しない。
      "X-Goog-FieldMask": "id,formattedAddress,location,addressComponents",
    },
    cache: "no-store",
  }).catch(() => null);

  if (!response) return json({ error: "場所の詳細を取得できませんでした。" }, 502);

  const payload = (await response.json().catch(() => ({}))) as GooglePlace;
  if (!response.ok) {
    console.error("Google Places details failed", response.status, payload.error?.message);
    return json({ error: "選択した場所の詳細を取得できませんでした。" }, 502);
  }

  const latitude = payload.location?.latitude;
  const longitude = payload.location?.longitude;
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return json({ error: "選択した場所に位置情報がありません。" }, 422);
  }

  const postalCode =
    payload.addressComponents?.find((component) => component.types?.includes("postal_code"))?.longText ?? null;

  return json({
    placeId: payload.id ?? placeId,
    address: payload.formattedAddress ?? null,
    postalCode,
    latitude,
    longitude,
    accuracyMeters: null,
  });
}
