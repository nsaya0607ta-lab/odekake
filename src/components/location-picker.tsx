"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDraftState } from "@/components/use-draft-state";
import { IconCheck, IconMapPin, IconSearch, IconSpinner } from "@/components/icons";
import {
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

type OtherTab = "municipality" | "map";
type SearchMode = "nearby" | "keyword" | "region";
type SearchOrigin = { latitude: number; longitude: number; accuracyMeters: number | null };
type SearchLocationStatus = "idle" | "loading" | "ready" | "denied" | "error" | "unsupported";

const RECENT_PLACES_KEY = "odekake:recent-place-searches";
const RECENT_PLACES_MAX = 5;

const SOURCE_LABELS: Record<LocationSource, string> = {
  municipality: "市区町村の代表地点",
  address: "住所から推定",
  map: "地図で選んだ地点",
  device: "現在地",
  place_search: "Google マップの検索結果",
};

const formatDistance = (meters: number | null) => {
  if (meters === null) return null;
  if (meters < 1000) return `${Math.max(1, Math.round(meters))}m`;
  if (meters < 10_000) return `${(meters / 1000).toFixed(1)}km`;
  return `${Math.round(meters / 1000)}km`;
};

const newSessionToken = () => crypto.randomUUID();

function readRecentPlaces(): PlaceSuggestion[] {
  try {
    const raw = window.localStorage.getItem(RECENT_PLACES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Record<string, unknown>;
      if (typeof candidate.placeId !== "string" || typeof candidate.name !== "string") return [];
      return [
        {
          placeId: candidate.placeId,
          name: candidate.name,
          address: typeof candidate.address === "string" ? candidate.address : null,
          distanceMeters: null,
        },
      ];
    }).slice(0, RECENT_PLACES_MAX);
  } catch {
    return [];
  }
}

function saveRecentPlace(suggestion: PlaceSuggestion, current: PlaceSuggestion[]) {
  const next = [
    { ...suggestion, distanceMeters: null },
    ...current.filter((item) => item.placeId !== suggestion.placeId),
  ].slice(0, RECENT_PLACES_MAX);
  try {
    window.localStorage.setItem(RECENT_PLACES_KEY, JSON.stringify(next));
  } catch {
    // 保存できなくても検索は継続できる
  }
  return next;
}

/** スポットの市区町村と正確な位置を決める入力。 */
export function LocationPicker({
  initial,
  error,
  placeSearchEnabled = false,
  onPlaceSelected,
  draftKey = null,
}: {
  initial: SpotLocation;
  error?: string;
  placeSearchEnabled?: boolean;
  onPlaceSelected?: (place: PlaceAutofill) => void;
  /** 指定すると、画面を離れても選んだ場所を覚えておく */
  draftKey?: string | null;
}) {
  const provider = useMemo(() => getPlaceSearchProvider(placeSearchEnabled), [placeSearchEnabled]);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // 場所は hidden input で送るため、FormDraft の DOM 復元では戻せない。
  // React 側が値を持っているので、このコンポーネント自身で下書きを保存する。
  const [value, setValue] = useDraftState<SpotLocation>(draftKey, initial, rootRef);
  // 現在地からの検索を最優先にするため、Places検索が使えないときだけ「別の場所から探す」を最初から開く
  const [searchMode, setSearchMode] = useState<SearchMode>(provider.enabled ? "nearby" : "region");
  const [otherTab, setOtherTab] = useState<OtherTab>("municipality");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<PlaceSuggestion[]>([]);
  const [sessionToken, setSessionToken] = useState("");
  const [searchOrigin, setSearchOrigin] = useState<SearchOrigin | null>(null);
  const [searchLocationStatus, setSearchLocationStatus] = useState<SearchLocationStatus>("idle");
  const [selectedPlace, setSelectedPlace] = useState<{ name: string; address: string | null } | null>(null);

  const options = value.prefectureCode ? getMunicipalitiesByPrefecture(value.prefectureCode) : [];

  useEffect(() => {
    if (placeSearchEnabled && !sessionToken) setSessionToken(newSessionToken());
  }, [placeSearchEnabled, sessionToken]);

  useEffect(() => {
    setRecentPlaces(readRecentPlaces());
  }, []);

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

  const applyCoordinates = useCallback((
    lat: number,
    lng: number,
    source: LocationSource,
    accuracy: number | null,
    place?: { provider: string; id: string; municipalityCode?: string | null },
  ) => {
    setValue((currentValue) => {
      const addressMunicipality = place?.municipalityCode
        ? getMunicipality(place.municipalityCode)
        : undefined;
      // Google検索・現在地は、前の下書きに残った都道府県で絞らない。
      // 都道府県地図をタップした場合だけ、利用者が選んだ県内に限定する。
      const found = source === "map" && currentValue.prefectureCode
        ? nearestMunicipality(lat, lng, currentValue.prefectureCode)
        : nearestMunicipality(lat, lng);
      const chosen = addressMunicipality ?? found?.municipality;

      if (chosen && chosen.code !== currentValue.municipalityCode) {
        setNotice(`市区町村を「${chosen.name}」に合わせました。`);
      } else {
        setNotice(null);
      }

      return {
        prefectureCode: chosen?.prefectureCode ?? currentValue.prefectureCode,
        municipalityCode: chosen?.code ?? currentValue.municipalityCode,
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
        locationSource: source,
        locationAccuracyMeters: accuracy,
        placeProvider: place?.provider ?? null,
        placeId: place?.id ?? null,
      };
    });
  }, [setValue]);

  const requestSearchOrigin = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setSearchLocationStatus("unsupported");
      return;
    }

    setSearchLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSearchOrigin({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          accuracyMeters: position.coords.accuracy ?? null,
        });
        setSearchLocationStatus("ready");
      },
      (positionError) => {
        setSearchOrigin(null);
        setSearchLocationStatus(positionError.code === positionError.PERMISSION_DENIED ? "denied" : "error");
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 5 * 60_000 },
    );
  }, []);

  // 現在地の取得に失敗・拒否された場合は、自動的に地域から探す方法へ切り替える
  useEffect(() => {
    if (searchLocationStatus === "denied" || searchLocationStatus === "error" || searchLocationStatus === "unsupported") {
      setSearchMode("region");
      setOtherTab("municipality");
    }
  }, [searchLocationStatus]);

  const searchNear = useMemo(() => {
    if (searchMode === "nearby" && searchOrigin) {
      return { latitude: searchOrigin.latitude, longitude: searchOrigin.longitude };
    }
    if (searchMode === "nearby" && value.latitude !== null && value.longitude !== null) {
      return { latitude: value.latitude, longitude: value.longitude };
    }
    return null;
  }, [searchMode, searchOrigin, value.latitude, value.longitude]);

  useEffect(() => {
    if (!provider.enabled || !sessionToken) return;
    const input = keyword.trim();
    if (input.length < 2) {
      setSuggestions([]);
      setBusy(false);
      return;
    }
    if (searchLocationStatus === "loading") return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setBusy(true);
      setNotice(null);
      const result = await provider.suggest({
        keyword: input,
        sessionToken,
        near: searchNear,
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
  }, [keyword, provider, searchLocationStatus, searchNear, sessionToken]);

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
      { provider: provider.id, id: candidate.placeId, municipalityCode: candidate.municipalityCode },
    );
    onPlaceSelected?.({
      name: candidate.name,
      address: candidate.address,
      postalCode: candidate.postalCode,
    });
    setKeyword(candidate.name);
    setSelectedPlace({ name: candidate.name, address: candidate.address });
    setSuggestions([]);
    setRecentPlaces((current) => saveRecentPlace(suggestion, current));
    setSessionToken(newSessionToken());
  };

  const searchLocationText = (() => {
    if (searchLocationStatus === "loading") return "現在地を確認しています…";
    if (searchLocationStatus === "ready") return "現在地：取得済み";
    if (searchLocationStatus === "denied") return "現在地：許可されていません。地域から探してください";
    if (searchLocationStatus === "unsupported") return "現在地：この端末では利用できません";
    if (searchLocationStatus === "error") return "現在地：取得できませんでした";
    // 画面を開いただけで位置情報の許可を求めない。使うときに「取得する」を押してもらう
    return "現在地：「取得する」を押すと近くから探せます";
  })();

  const otherTabOptions = [
    { value: "municipality", label: "都道府県・市区町村から探す" },
    { value: "map", label: "地図から選ぶ" },
  ] as const;

  const searchModes = [
    { value: "nearby", label: "現在地から" },
    { value: "keyword", label: "店名検索" },
    { value: "region", label: "地域から" },
  ] as const;

  return (
    <div ref={rootRef} className="space-y-3">
      <input type="hidden" name="municipalityCode" value={value.municipalityCode} />
      <input type="hidden" name="latitude" value={value.latitude ?? ""} />
      <input type="hidden" name="longitude" value={value.longitude ?? ""} />
      <input type="hidden" name="locationSource" value={value.locationSource} />
      <input type="hidden" name="locationAccuracy" value={value.locationAccuracyMeters ?? ""} />
      <input type="hidden" name="placeProvider" value={value.placeProvider ?? ""} />
      <input type="hidden" name="placeId" value={value.placeId ?? ""} />

      {error ? <p className="text-xs text-[#a85c6a]">{error}</p> : null}

      <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-line-strong bg-card">
        {searchModes.map((mode) => (
          <button
            key={mode.value}
            type="button"
            aria-pressed={searchMode === mode.value}
            onClick={() => setSearchMode(mode.value)}
            className={`min-h-12 border-r border-line px-2 text-xs font-semibold last:border-r-0 ${
              searchMode === mode.value ? "bg-leaf-soft text-leaf-deep" : "text-ink-soft"
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {busy ? (
        <p className="flex items-center gap-2 px-1 text-xs text-ink-soft">
          <IconSpinner size={16} />
          取得しています…
        </p>
      ) : null}

      {notice ? <p className="px-1 text-xs leading-relaxed text-[#95505e]">{notice}</p> : null}

      {provider.enabled && searchMode !== "region" ? (
        <div className="space-y-3">
          {searchMode === "nearby" ? <div className="rough-card flex items-center gap-2.5 border border-leaf bg-leaf-soft/40 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-leaf text-white">
              <IconMapPin size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-leaf-deep">現在地から近い順に探す</p>
              <p className="mt-0.5 text-[11px] text-ink-soft">{searchLocationText}</p>
            </div>
            <button
              type="button"
              onClick={requestSearchOrigin}
              disabled={searchLocationStatus === "loading"}
              className="shrink-0 rounded-full border border-leaf bg-card px-3 py-1.5 text-xs font-semibold text-leaf-deep disabled:opacity-50"
            >
              {searchLocationStatus === "ready" ? "更新" : "取得する"}
            </button>
          </div> : null}

          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint">
              <IconSearch size={18} />
            </span>
            <input
              ref={searchInputRef}
              type="search"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="店名・施設名を検索"
              aria-label="現在地から近い店舗・施設を検索"
              autoComplete="off"
              className="field bg-card pl-10"
            />
          </div>

          {keyword.trim().length < 2 ? (
            <p className="px-1 text-[11px] text-ink-faint">2文字以上入力すると候補を表示します。</p>
          ) : null}

          {keyword.trim().length < 2 && recentPlaces.length > 0 ? (
            <div>
              <p className="mb-1.5 px-1 text-xs font-semibold text-ink-soft">最近選んだ場所</p>
              <div className="overflow-hidden rounded-2xl border border-line bg-card">
                <PlaceSuggestionList
                  suggestions={recentPlaces}
                  selectedPlaceId={value.placeId}
                  onChoose={chooseSuggestion}
                  showDistance={false}
                />
              </div>
            </div>
          ) : null}

          {suggestions.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-line bg-card">
              <PlaceSuggestionList
                suggestions={suggestions}
                selectedPlaceId={value.placeId}
                onChoose={chooseSuggestion}
                showDistance={Boolean(searchNear)}
              />
              <p className="border-t border-line px-4 py-2 text-right">
                <span translate="no" className="whitespace-nowrap font-sans text-xs font-normal tracking-normal text-[#5e5e5e]">
                  Google マップ
                </span>
              </p>
            </div>
          ) : null}

          {searchLocationStatus === "ready" ? (
            <button
              type="button"
              onClick={() =>
                searchOrigin &&
                applyCoordinates(searchOrigin.latitude, searchOrigin.longitude, "device", searchOrigin.accuracyMeters)
              }
              className="px-1 text-left text-[11px] font-semibold text-leaf-deep underline underline-offset-2"
            >
              候補にない場合は、この現在地をそのまま使う
            </button>
          ) : null}
        </div>
      ) : !provider.enabled && searchMode !== "region" ? (
        <p className="rough-card p-3 text-[11px] leading-relaxed text-ink-faint">
          Google Places APIキーを設定すると、現在地から近い店舗・施設を検索できます。
        </p>
      ) : null}

      {searchMode === "region" ? (
        <div className="rough-card space-y-3 p-4">
            <div className="flex flex-wrap gap-2">
              {otherTabOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={otherTab === option.value}
                  onClick={() => setOtherTab(option.value)}
                  className={`rough-pill border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    otherTab === option.value
                      ? "border-leaf bg-leaf-soft text-leaf-deep"
                      : "border-line-strong bg-card text-ink-soft"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {otherTab === "municipality" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label" htmlFor="prefectureCode">都道府県</label>
                  <select
                    id="prefectureCode"
                    className="field"
                    value={value.prefectureCode}
                    onChange={(event) =>
                      setValue((current) => ({
                        ...current,
                        prefectureCode: event.target.value,
                        municipalityCode: "",
                        latitude: null,
                        longitude: null,
                        locationSource: "municipality",
                        locationAccuracyMeters: null,
                        placeProvider: null,
                        placeId: null,
                      }))
                    }
                  >
                    <option value="">選択してください</option>
                    {PREFECTURE_NAMES.map((prefecture) => (
                      <option key={prefecture.code} value={prefecture.code}>{prefecture.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="municipalityCodeSelect">市区町村</label>
                  <select
                    id="municipalityCodeSelect"
                    className="field"
                    value={value.municipalityCode}
                    onChange={(event) => setMunicipalityCode(event.target.value)}
                    disabled={options.length === 0}
                  >
                    <option value="">{value.prefectureCode ? "選択してください" : "先に都道府県を選択"}</option>
                    {options.map((item) => (
                      <option key={item.code} value={item.code}>{item.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            {otherTab === "map" ? (
              value.prefectureCode ? (
                <LocationMapPicker
                  prefectureCode={value.prefectureCode}
                  latitude={value.latitude}
                  longitude={value.longitude}
                  onPick={(lat, lng, accuracy) => applyCoordinates(lat, lng, "map", accuracy)}
                />
              ) : (
                <p className="text-xs text-ink-soft">先に「都道府県・市区町村から探す」で都道府県を選んでください。</p>
              )
            ) : null}
        </div>
      ) : null}

      <div className="rough-card flex items-center gap-3 border border-leaf/70 p-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-leaf-deep">
          <IconMapPin size={21} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-leaf-deep">選択中の場所</p>
          <p className="mt-0.5 truncate text-sm font-bold">
            {selectedPlace?.name ?? SOURCE_LABELS[value.locationSource]}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-ink-faint">
            {selectedPlace?.address ?? (value.municipalityCode ? "場所を指定済み" : "場所を検索または選択してください")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSearchMode(provider.enabled ? "keyword" : "region");
            window.setTimeout(() => searchInputRef.current?.focus(), 0);
          }}
          className="shrink-0 rounded-full border border-leaf px-3 py-1.5 text-xs font-semibold text-leaf-deep"
        >
          変更
        </button>
      </div>
    </div>
  );
}

function PlaceSuggestionList({
  suggestions,
  selectedPlaceId,
  onChoose,
  showDistance,
}: {
  suggestions: PlaceSuggestion[];
  selectedPlaceId: string | null;
  onChoose: (suggestion: PlaceSuggestion) => Promise<void>;
  showDistance: boolean;
}) {
  return (
    <ul className="divide-y divide-line">
      {suggestions.map((suggestion) => {
        const distance = showDistance ? formatDistance(suggestion.distanceMeters) : null;
        return (
          <li key={suggestion.placeId}>
            <button
              type="button"
              onClick={() => void onChoose(suggestion)}
              className="pressable flex min-h-14 w-full items-center gap-2 px-4 py-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="block min-w-0 flex-1 truncate text-sm font-semibold">{suggestion.name}</span>
                  {distance ? (
                    <span className="shrink-0 rounded-full bg-leaf-soft px-2 py-0.5 text-[10px] font-semibold text-leaf-deep tabular-nums">
                      {distance}
                    </span>
                  ) : null}
                </span>
                {suggestion.address ? (
                  <span className="mt-0.5 block truncate text-[11px] text-ink-faint">{suggestion.address}</span>
                ) : null}
              </span>
              {selectedPlaceId === suggestion.placeId ? (
                <IconCheck size={16} className="shrink-0 text-leaf-deep" />
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
