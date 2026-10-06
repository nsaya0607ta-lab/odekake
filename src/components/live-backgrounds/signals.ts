/**
 * 変わる背景が使う値（時間帯・天気・歩数・季節）を、アプリの背景のために読む。
 * どれも、その背景を使っているときだけ動く（enabled が false なら何もしない）。
 */
import { useEffect, useMemo, useState } from "react";
import { seasonOf, skyTimeOf, type AppBackgroundId, type BackgroundSignals, type Season, type SkyTime, type WeatherSignal } from "@/lib/app-backgrounds";
import { cachedWeather, readSavedPlace, requestWeather, skyPhaseOf, WEATHER_CACHE_MS, WEATHER_LAST_MS } from "@/lib/home-weather";

/** 時間帯（日本時間）。1分ごとに見直す */
export function useSkyTime(enabled: boolean): SkyTime {
  const [skyTime, setSkyTime] = useState<SkyTime>(() => skyTimeOf(new Date()));
  useEffect(() => {
    if (!enabled) return;
    const update = () => setSkyTime(skyTimeOf(new Date()));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return skyTime;
}

/** 季節。1時間ごとに見直す */
function useSeason(enabled: boolean): Season {
  const [season, setSeason] = useState<Season>(() => seasonOf(new Date()));
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setSeason(seasonOf(new Date())), 3600_000);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return season;
}

/**
 * いまの天気。ホームの天気と同じ場所（マイルームで選んだところ）・同じ覚え場所を使うので、
 * ホームを開いたあとなら問い合わせずにすむ。取れないときは null（背景は晴れとして描く）。
 */
function useLiveWeather(enabled: boolean): WeatherSignal | null {
  const [weather, setWeather] = useState<WeatherSignal | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const place = readSavedPlace();
    const lat = place.lat.toFixed(2);
    const lon = place.lon.toFixed(2);
    let alive = true;
    let kind: WeatherSignal["kind"] | null = null;
    const publish = () => {
      if (alive && kind) setWeather({ kind, phase: skyPhaseOf(new Date(), place) });
    };
    const load = (useCache: boolean) => {
      const fresh = useCache ? cachedWeather(lat, lon, WEATHER_CACHE_MS) : null;
      if (fresh) { kind = fresh.kind; publish(); return; }
      // 古くても最後に取れた天気をまず使い、新しいのが届いたら差しかえる（取れなければ前のまま）
      const last = kind ? null : cachedWeather(lat, lon, WEATHER_LAST_MS);
      if (last) { kind = last.kind; publish(); }
      void requestWeather(lat, lon).then((w) => { if (w) { kind = w.kind; publish(); } });
    };
    load(true);
    // 天気は20分ごと、時間帯（昼→夕方→夜）は5分ごとに見直す
    const weatherTimer = window.setInterval(() => load(false), 20 * 60_000);
    const phaseTimer = window.setInterval(publish, 5 * 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") load(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearInterval(weatherTimer);
      window.clearInterval(phaseTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);
  return weather;
}

/** きょうの歩数。5分ごと・画面に戻ってきたときに見直す（取れないときは null） */
function useTodayStepCount(enabled: boolean): number | null {
  const [steps, setSteps] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/steps/today", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((body: { ok?: boolean; todaySteps?: unknown } | null) => {
          if (alive && body?.ok && typeof body.todaySteps === "number") setSteps(body.todaySteps);
        })
        .catch(() => {
          // 取れなければ前のまま
        });
    };
    load();
    const timer = window.setInterval(load, 5 * 60_000);
    document.addEventListener("visibilitychange", load);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [enabled]);
  return steps;
}

/** 背景 id に合わせて、使う値だけを読む */
export function useBackgroundSignals(id: AppBackgroundId): BackgroundSignals {
  const skyTime = useSkyTime(id === "sky-clock");
  const weather = useLiveWeather(id === "weather");
  const steps = useTodayStepCount(id === "garden");
  const season = useSeason(id === "seasons");
  return useMemo(() => {
    if (id === "sky-clock") return { skyTime };
    if (id === "weather") return { weather };
    if (id === "garden") return { steps };
    if (id === "seasons") return { season };
    return {};
  }, [id, skyTime, weather, steps, season]);
}
