"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cachedWeather, placeLabel, readSavedPlace, requestWeather, WEATHER_CACHE_MS, WEATHER_LAST_MS, type SavedPlace } from "@/lib/home-weather";
import { townEnvironment, type TownTimeMode, type TownWeatherMode } from "@/lib/games/town-environment";
import { TOKYO } from "@/lib/room/sun";
import type { RoomWeather } from "@/lib/room/weather";

const SKY_KEY = "odekake-town-sky-v1";
const TIME_MODES: readonly TownTimeMode[] = ["real", "morning", "day", "evening", "night"];
const WEATHER_MODES: readonly TownWeatherMode[] = ["real", "clear", "cloudy", "rain", "snow"];
export type TownSkyModes = { time: TownTimeMode; weather: TownWeatherMode };

/**
 * The town's real time, place and weather. The place is the one chosen in My Room (Tokyo until then)
 * and the weather is the same Open-Meteo reading the home screen uses, cached for ten minutes.
 */
export function useTownSky() {
  const [place, setPlace] = useState<SavedPlace & { saved: boolean }>({ ...TOKYO, pref: "13", saved: false });
  const [weather, setWeather] = useState<RoomWeather | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [modes, setModes] = useState<TownSkyModes>({ time: "real", weather: "real" });
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setPlace(readSavedPlace());
    try {
      const saved = JSON.parse(localStorage.getItem(SKY_KEY) ?? "null") as Partial<TownSkyModes> | null;
      if (saved) setModes({ time: TIME_MODES.includes(saved.time!) ? saved.time! : "real", weather: WEATHER_MODES.includes(saved.weather!) ? saved.weather! : "real" });
    } catch { /* The real sky is the default. */ }
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(motion.matches);
    const change = () => setReduced(motion.matches);
    motion.addEventListener?.("change", change);
    return () => motion.removeEventListener?.("change", change);
  }, []);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(() => { if (!document.hidden) tick(); }, 15_000);
    const visible = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", visible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, []);
  useEffect(() => {
    let alive = true;
    const lat = place.lat.toFixed(2), lon = place.lon.toFixed(2);
    // Show the last known sky at once, then refresh it when it is older than ten minutes.
    const remembered = cachedWeather(lat, lon, WEATHER_LAST_MS);
    if (remembered) setWeather(remembered);
    const load = () => {
      if (document.hidden) return;
      const fresh = cachedWeather(lat, lon, WEATHER_CACHE_MS);
      if (fresh) { setWeather(fresh); return; }
      void requestWeather(lat, lon).then(next => { if (alive && next) setWeather(next); });
    };
    load();
    const timer = window.setInterval(load, 10 * 60_000);
    document.addEventListener("visibilitychange", load);
    return () => { alive = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", load); };
  }, [place.lat, place.lon]);
  const environment = useMemo(() => now === null ? null : townEnvironment({ now, place, weather, timeMode: modes.time, weatherMode: modes.weather, reducedMotion: reduced }), [now, place, weather, modes.time, modes.weather, reduced]);
  const setMode = useCallback((patch: Partial<TownSkyModes>) => {
    setModes(current => {
      const next = { ...current, ...patch };
      try { localStorage.setItem(SKY_KEY, JSON.stringify(next)); } catch { /* Only this session remembers it. */ }
      return next;
    });
  }, []);
  return { environment, weather, place, placeName: placeLabel(place), modes, setMode };
}
