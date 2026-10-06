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
    // ホームのお天気チップ用：きょうの最高・最低気温と、いちばん高い降水確率
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    forecast_days: "1",
    timezone: "Asia/Tokyo",
  });
  try {
    // 天気サービスがたまたま遅い・失敗したときは、1回だけやり直す（ホームを開いた直後に天気が出ないのを防ぐ）
    let res: Response | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`, { next: { revalidate: 900 }, signal: AbortSignal.timeout(attempt === 0 ? 5000 : 6000) });
        if (res.ok) break;
      } catch (e) {
        if (attempt === 1) throw e;
      }
    }
    if (!res?.ok) throw new Error(`status ${res?.status ?? "none"}`);
    const json = (await res.json()) as { current?: Record<string, unknown>; daily?: Record<string, unknown> };
    const c = json.current;
    const today = (key: string) => {
      const v = json.daily?.[key];
      return Array.isArray(v) && typeof v[0] === "number" ? v[0] : null;
    };
    if (!c || typeof c.weather_code !== "number") throw new Error("no current weather");
    return NextResponse.json(
      { code: c.weather_code, temp: c.temperature_2m ?? null, cloud: c.cloud_cover ?? 0, precip: c.precipitation ?? 0, wind: c.wind_speed_10m ?? 0,
        tmax: today("temperature_2m_max"), tmin: today("temperature_2m_min"), pop: today("precipitation_probability_max"),
        at: new Date().toISOString() },
      { headers: { "Cache-Control": "private, max-age=600" } },
    );
  } catch (e) {
    console.warn("room weather unavailable", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "天気を取得できませんでした。" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
