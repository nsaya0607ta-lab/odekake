import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/supabase/server";

/**
 * わんこのおへやの窓の外の「いまの天気」（Open-Meteo）。
 * 場所は 0.01 度（約1km）に丸めてから問い合わせ、15分は同じ答えを使う。だれの場所かは外へ送らない
 */
export async function GET(request: Request) {
  const { user } = await requireUser();
  const limit = checkRateLimit(`my-room-weather:${user.id}`, 60, 60 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "すこし時間をおいてからお試しください。" }, { status: 429 });
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat")), lon = Number(url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "場所が正しくありません。" }, { status: 400 });
  }
  const q = new URLSearchParams({
    latitude: (Math.round(lat * 100) / 100).toFixed(2),
    longitude: (Math.round(lon * 100) / 100).toFixed(2),
    current: "weather_code,temperature_2m,cloud_cover,precipitation,wind_speed_10m",
    timezone: "Asia/Tokyo",
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`, { next: { revalidate: 900 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const json = (await res.json()) as { current?: Record<string, unknown> };
    const c = json.current;
    if (!c || typeof c.weather_code !== "number") throw new Error("no current weather");
    return NextResponse.json(
      { code: c.weather_code, temp: c.temperature_2m ?? null, cloud: c.cloud_cover ?? 0, precip: c.precipitation ?? 0, wind: c.wind_speed_10m ?? 0, at: new Date().toISOString() },
      { headers: { "Cache-Control": "private, max-age=600" } },
    );
  } catch (e) {
    console.warn("room weather unavailable", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "天気を取得できませんでした。" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
