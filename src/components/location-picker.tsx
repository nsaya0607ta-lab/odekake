"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { IconCheck, IconMapPin, IconSearch, IconSpinner } from "@/components/icons";
import {
  distanceMeters,
  getMunicipality,
  getMunicipalitiesByPrefecture,
  nearestMunicipality,
} from "@/lib/geo/municipalities";
import { PREFECTURE_NAMES } from "@/lib/geo/prefecture-names";
import { getPlaceSearchProvider, type PlaceCandidate } from "@/lib/places";
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

const SOURCE_LABELS: Record<LocationSource, string> = {
  municipality: "市区町村の代表地点",
  address: "住所から推定",
  map: "地図で選んだ地点",
  device: "現在地",
  place_search: "店舗検索の結果",
};

type Mode = "municipality" | "device" | "map" | "search";

const formatAccuracy = (meters: number | null) => {
  if (meters === null) return null;
  if (meters < 1000) return `およそ ±${Math.round(meters)}m`;
  return `およそ ±${(meters / 1000).toFixed(1)}km`;
};

/**
 * スポットの場所を決める入力。
 *
 * 初期版では「市区町村の代表地点」「現在地」「地図から選ぶ」の3通りに対応し、
 * 店舗検索は提供元（src/lib/places）を差し替えれば有効になる作りにしている。
 * 選び方は location_source として保存するので、あとから精度の高い座標へ
 * 置き換えたときも、どうやって決めた座標かが分かる。
 */
export function LocationPicker({
  initial,
  error,
}: {
  initial: SpotLocation;
  error?: string;
}) {
  const provider = useMemo(() => getPlaceSearchProvider(), []);
  const [value, setValue] = useState<SpotLocation>(initial);
  const [mode, setMode] = useState<Mode>("municipality");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [candidates, setCandidates] = useState<PlaceCandidate[]>([]);

  const municipality = value.municipalityCode ? getMunicipality(value.municipalityCode) : undefined;
  const options = value.prefectureCode ? getMunicipalitiesByPrefecture(value.prefectureCode) : [];

  const setMunicipalityCode = (code: string) => {
    const target = getMunicipality(code);
    setValue((current) => ({
      ...current,
      municipalityCode: code,
      // 市区町村を選び直したら、代表地点に戻す
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
    // 市区町村が未選択、または離れた場所を選んだ場合は付け替える
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

  const search = async () => {
    if (keyword.trim().length === 0) return;
    setBusy(true);
    setNotice(null);
    const result = await provider.search({
      keyword: keyword.trim(),
      near:
        value.latitude !== null && value.longitude !== null
          ? { latitude: value.latitude, longitude: value.longitude }
          : null,
      limit: 10,
    });
    setBusy(false);
    if (result.status === "unavailable") {
      setCandidates([]);
      setNotice(result.message);
      return;
    }
    setCandidates(result.candidates);
    if (result.candidates.length === 0) setNotice("該当する店舗・施設が見つかりませんでした。");
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
              <p className="mt-0.5 text-[11px] text-ink-faint">市区町村を選ぶと代表地点が入ります。</p>
            )}
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-leaf-deep">
            <IconMapPin size={18} />
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: "municipality", label: "市区町村で指定" },
              { value: "device", label: "現在地" },
              { value: "map", label: "地図から選ぶ" },
              { value: "search", label: "店舗検索" },
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

        {mode === "search" ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint">
                  <IconSearch size={18} />
                </span>
                <input
                  type="search"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="店名・施設名"
                  aria-label="店舗・施設を検索"
                  className="field pl-10"
                />
              </div>
              <button type="button" onClick={() => void search()} className="btn btn-quiet shrink-0 px-5">
                検索
              </button>
            </div>
            {candidates.length > 0 ? (
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {candidates.map((candidate) => (
                  <li key={candidate.placeId}>
                    <button
                      type="button"
                      onClick={() =>
                        applyCoordinates(
                          candidate.latitude,
                          candidate.longitude,
                          "place_search",
                          candidate.accuracyMeters,
                          { provider: provider.id, id: candidate.placeId },
                        )
                      }
                      className="flex w-full items-center gap-2 px-4 py-3 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{candidate.name}</span>
                        {candidate.address ? (
                          <span className="block truncate text-[11px] text-ink-faint">{candidate.address}</span>
                        ) : null}
                      </span>
                      {value.placeId === candidate.placeId ? (
                        <IconCheck size={16} className="shrink-0 text-leaf-deep" />
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {!provider.enabled ? (
          <p className="text-[11px] leading-relaxed text-ink-faint">
            店舗検索は提供元が未設定のため使えません。
            <code className="mx-1">NEXT_PUBLIC_PLACE_SEARCH_PROVIDER</code>
            を設定すると有効になります。
          </p>
        ) : null}
      </div>
    </div>
  );
}
