"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { IconCheck, IconMapPin, IconSearch, IconSpinner } from "@/components/icons";
import {
  distanceMeters,
  getMunicipality,
  getMunicipalitiesByPrefecture,
  nearestMunicipality,
} from "@/lib/geo/municipalities";
import { PREFECTURE_NAMES } from "@/lib/geo/prefecture-names";
import {
  getPlaceSearchProvider,
  type PlaceCandidate,
  type PlaceSuggestion,
} from "@/lib/places";
import type { LocationSource } from "@/lib/supabase/types";

// 地図データは「地図から選ぶ」を開いたときだけ読み込む
const LocationMapPicker = dynamic(
  () => import("@/components/location-map-picker").then((m) => m.LocationMapPicker),
  { ssr: false, loading: () => <p className="text-xs text-ink-soft">地図を読み込んでいます…</p> },
);

export type SpotLocation = {
  prefectureCode: string;
  municipalityCode: string;
  latitude: number | null;
  longitude: number | null;
  locationSource: LocationSource;
  locationAccuracyMeters: number | null;
  placeProvider: string | null;
  placeId: string | null;
};

export type PlaceAutofill = Pick<PlaceCandidate, "name" | "address" | "postalCode">;

const SOURCE_LABELS: Record<LocationSource, string> = {
  municipality: "市区町村の代表地点",
  address: "住所から推定",
  map: "地図で選んだ地点",
  device: "現在地",
  place_search: "Google マップの検索結果",
};

type Mode = "municipality" | "device" | "map" | "search";

const formatAccuracy = (meters: number | null) => {
  if (meters === null) return null;
  if (meters < 1000) return `およそ ±${Math.round(meters)}m`;
  return `およそ ±${(meters / 1000).toFixed(1)}km`;
};

const newSessionToken = () => crypto.randomUUID();

/** スポットの市区町村と正確な位置を決める入力。 */
export function LocationPicker({
  initial,
  error,
  placeSearchEnabled = false,
  onPlaceSelected,
}: {
  initial: SpotLocation;
  error?: string;
  placeSearchEnabled?: boolean;
  onPlaceSelected?: (place: PlaceAutofill) => void;
}) {
  const provider = useMemo(() => getPlaceSearchProvider(placeSearchEnabled), [placeSearchEnabled]);
  const [value, setValue] = useState<SpotLocation>(initial);
  const [mode, setMode] = useState<Mode>(placeSearchEnabled ? "search" : "municipality");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [sessionToken, setSessionToken] = useState("");

  const municipality = value.municipalityCode ? getMunicipality(value.municipalityCode) : undefined;
  const options = value.prefectureCode ? getMunicipalitiesByPrefecture(value.prefectureCode) : [];

  useEffect(() => {
    if (placeSearchEnabled && !sessionToken) setSessionToken(newSessionToken());
  }, [placeSearchEnabled, sessionToken]);

  const setMunicipalityCode = (code: string) => {
    const target = getMunicipality(code);
    setValue((current) => ({
      ...current,
      municipalityCode: code,
      latitude: target?.lat ?? null,
      longitude: target?.lng ?? null,
      locationSource: "municipality",
      locationAccuracyMeters: null,
      placeProvider: null,
      placeId: null,
    }));
    setNotice(null);
  };

  const applyCoordinates = (
    lat: number,
    lng: number,
    source: LocationSource,
    accuracy: number | null,
    place?: { provider: string; id: string },
  ) => {
    const found = nearestMunicipality(lat, lng, value.prefectureCode || undefined) ?? nearestMunicipality(lat, lng);
    const current = municipality;
    const keepCurrent =
      current &&
      current.lat !== null &&
      current.lng !== null &&
      found &&
      distanceMeters(lat, lng, current.lat, current.lng) <= found.distanceMeters + 1;

    const chosen = keepCurrent ? current : found?.municipality;

    setValue({
      prefectureCode: chosen?.prefectureCode ?? value.prefectureCode,
      municipalityCode: chosen?.code ?? value.municipalityCode,
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
      locationSource: source,
      locationAccuracyMeters: accuracy,
      placeProvider: place?.provider ?? null,
      placeId: place?.id ?? null,
    });

    if (chosen && chosen.code !== value.municipalityCode) {
      setNotice(`市区町村を「${chosen.name}」に合わせました。`);
    } else {
      setNotice(null);
    }
  };

  const requestCurrentPosition = () => {
    if (!("geolocation" in navigator)) {
      setNotice("この端末では現在地を取得できません。");
      return;
    }
    setBusy(true);
    setNotice(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBusy(false);
        applyCoordinates(
          position.coords.latitude,
          position.coords.longitude,
          "device",
          position.coords.accuracy ?? null,
        );
      },
      (positionError) => {
        setBusy(false);
        setNotice(
          positionError.code === positionError.PERMISSION_DENIED
            ? "位置情報の利用が許可されていません。端末の設定をご確認ください。"
            : "現在地を取得できませんでした。時間をおいてもう一度お試しください。",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  // 入力が止まってから候補を取得し、文字ごとの無駄な通信を抑える。
  useEffect(() => {
    if (mode !== "search" || !provider.enabled || !sessionToken) return;
    const input = keyword.trim();
    if (input.length < 2) {
      setSuggestions([]);
      setBusy(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setBusy(true);
      setNotice(null);
      const result = await provider.suggest({
        keyword: input,
        sessionToken,
        near:
          value.latitude !== null && value.longitude !== null
            ? { latitude: value.latitude, longitude: value.longitude }
            : null,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setBusy(false);
      if (result.status === "unavailable") {
        setSuggestions([]);
        setNotice(result.message);
        return;
      }
      setSuggestions(result.suggestions);
      if (result.suggestions.length === 0) setNotice("該当する店舗・施設が見つかりませんでした。");
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [keyword, mode, provider, sessionToken, value.latitude, value.longitude]);

  const chooseSuggestion = async (suggestion: PlaceSuggestion) => {
    const token = sessionToken || newSessionToken();
    setBusy(true);
    setNotice(null);
    const result = await provider.details(suggestion, token);
    setBusy(false);

    if (result.status === "unavailable") {
      setNotice(result.message);
      return;
    }

    const candidate = result.candidate;
    applyCoordinates(
      candidate.latitude,
      candidate.longitude,
      "place_search",
      candidate.accuracyMeters,
      { provider: provider.id, id: candidate.placeId },
    );
    onPlaceSelected?.({
      name: candidate.name,
      address: candidate.address,
      postalCode: candidate.postalCode,
    });
    setKeyword(candidate.name);
    setSuggestions([]);
    // Place Details でセッションが終了するため、次の検索用トークンを発行する。
    setSessionToken(newSessionToken());
  };

  return (
    <div className="space-y-3">
      <input type="hidden" name="municipalityCode" value={value.municipalityCode} />
      <input type="hidden" name="latitude" value={value.latitude ?? ""} />
      <input type="hidden" name="longitude" value={value.longitude ?? ""} />
      <input type="hidden" name="locationSource" value={value.locationSource} />
      <input type="hidden" name="locationAccuracy" value={value.locationAccuracyMeters ?? ""} />
      <input type="hidden" name="placeProvider" value={value.placeProvider ?? ""} />
      <input type="hidden" name="placeId" value={value.placeId ?? ""} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="prefectureCode">
            都道府県
          </label>
          <select
            id="prefectureCode"
            className="field"
            value={value.prefectureCode}
            onChange={(e) =>
              setValue((current) => ({
                ...current,
                prefectureCode: e.target.value,
                municipalityCode: "",
                latitude: null,
                longitude: null,
                locationSource: "municipality",
                locationAccuracyMeters: null,
                placeProvider: null,
                placeId: null,
              }))
            }
            required
          >
            <option value="">選択してください</option>
            {PREFECTURE_NAMES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="municipalityCodeSelect">
            市区町村
          </label>
          <select
            id="municipalityCodeSelect"
            className="field"
            value={value.municipalityCode}
            onChange={(e) => setMunicipalityCode(e.target.value)}
            disabled={options.length === 0}
            required
          >
            <option value="">{value.prefectureCode ? "選択してください" : "先に都道府県を選択"}</option>
            {options.map((m) => (
              <option key={m.code} value={m.code}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <p className="text-xs text-[#a85c6a]">{error}</p> : null}

      <div className="rough-card space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-ink-faint">場所の指定</p>
            <p className="mt-0.5 text-sm font-semibold">{SOURCE_LABELS[value.locationSource]}</p>
            {value.latitude !== null && value.longitude !== null ? (
              <p className="mt-0.5 text-[11px] text-ink-faint tabular-nums">
                {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
                {formatAccuracy(value.locationAccuracyMeters)
                  ? `・${formatAccuracy(value.locationAccuracyMeters)}`
                  : ""}
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] text-ink-faint">検索または市区町村の選択で場所を指定します。</p>
            )}
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-leaf-deep">
            <IconMapPin size={18} />
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: "search", label: "店舗検索" },
              { value: "municipality", label: "市区町村で指定" },
              { value: "device", label: "現在地" },
              { value: "map", label: "地図から選ぶ" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={mode === option.value}
              disabled={option.value === "search" && !provider.enabled}
              onClick={() => {
                setMode(option.value);
                setNotice(null);
                if (option.value === "search" && !sessionToken) setSessionToken(newSessionToken());
                if (option.value === "device") requestCurrentPosition();
              }}
              className={`rough-pill border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-45 ${
                mode === option.value
                  ? "border-leaf bg-leaf-soft text-leaf-deep"
                  : "border-line-strong bg-card text-ink-soft"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {busy ? (
          <p className="flex items-center gap-2 text-xs text-ink-soft">
            <IconSpinner size={16} />
            取得しています…
          </p>
        ) : null}

        {notice ? <p className="text-xs leading-relaxed text-[#95505e]">{notice}</p> : null}

        {mode === "device" && !busy ? (
          <button type="button" onClick={requestCurrentPosition} className="btn btn-quiet w-full">
            現在地をもう一度取得する
          </button>
        ) : null}

        {mode === "map" ? (
          value.prefectureCode ? (
            <LocationMapPicker
              prefectureCode={value.prefectureCode}
              latitude={value.latitude}
              longitude={value.longitude}
              onPick={(lat, lng, accuracy) => applyCoordinates(lat, lng, "map", accuracy)}
            />
          ) : (
            <p className="text-xs text-ink-soft">先に都道府県を選んでください。</p>
          )
        ) : null}

        {mode === "search" && provider.enabled ? (
          <div className="space-y-2">
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint">
                <IconSearch size={18} />
              </span>
              <input
                type="search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="店名・施設名を入力"
                aria-label="Google マップで店舗・施設を検索"
                autoComplete="off"
                className="field pl-10"
              />
            </div>

            {keyword.trim().length < 2 ? (
              <p className="px-1 text-[11px] text-ink-faint">2文字以上入力すると候補を表示します。</p>
            ) : null}

            {suggestions.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-line bg-card">
                <ul className="divide-y divide-line">
                  {suggestions.map((suggestion) => (
                    <li key={suggestion.placeId}>
                      <button
                        type="button"
                        onClick={() => void chooseSuggestion(suggestion)}
                        className="pressable flex min-h-14 w-full items-center gap-2 px-4 py-3 text-left"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{suggestion.name}</span>
                          {suggestion.address ? (
                            <span className="block truncate text-[11px] text-ink-faint">{suggestion.address}</span>
                          ) : null}
                        </span>
                        {value.placeId === suggestion.placeId ? (
                          <IconCheck size={16} className="shrink-0 text-leaf-deep" />
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="border-t border-line px-4 py-2 text-right">
                  <span
                    translate="no"
                    className="whitespace-nowrap font-sans text-xs font-normal tracking-normal text-[#5e5e5e]"
                  >
                    Google マップ
                  </span>
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {!provider.enabled ? (
          <p className="text-[11px] leading-relaxed text-ink-faint">
            Google Places APIキーを設定すると、店名や施設名から候補を検索できます。
          </p>
        ) : null}
      </div>
    </div>
  );
}
