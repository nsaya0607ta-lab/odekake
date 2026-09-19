"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useState } from "react";
import { createVisitedSpotAction } from "@/app/actions/spots";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";
import { IconCheck, IconMapPin, IconSpinner } from "@/components/icons";

type NearbyPlace = {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  prefectureCode: string;
  municipalityCode: string;
  distanceMeters: number;
};

type SearchStatus = "idle" | "locating" | "searching" | "ready" | "error";

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.max(1, Math.round(meters))}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

export function QuickVisit({
  tripId,
  visitedAt,
  placeSearchEnabled,
}: {
  tripId: string;
  visitedAt: string;
  placeSearchEnabled: boolean;
}) {
  const [state, formAction] = useActionState(createVisitedSpotAction, emptyActionState);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [selected, setSelected] = useState<NearbyPlace | null>(null);
  const [visitId, setVisitId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVisitId(crypto.randomUUID());
  }, []);

  const searchNearby = useCallback((latitude: number, longitude: number) => {
    setStatus("searching");
    setError(null);
    setSelected(null);

    void fetch("/api/places/nearby", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude, longitude }),
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as {
          places?: NearbyPlace[];
          error?: string;
        };
        if (!response.ok) throw new Error(body.error ?? "周辺の場所を検索できませんでした。");
        const nextPlaces = Array.isArray(body.places) ? body.places : [];
        setPlaces(nextPlaces);
        setStatus("ready");
        if (nextPlaces.length === 0) {
          setError("500m以内に候補が見つかりませんでした。通常の登録画面から検索してください。");
        }
      })
      .catch((reason: unknown) => {
        setPlaces([]);
        setStatus("error");
        setError(reason instanceof Error ? reason.message : "周辺の場所を検索できませんでした。");
      });
  }, []);

  const locate = useCallback(() => {
    if (!placeSearchEnabled) {
      setStatus("error");
      setError("Google Places API が未設定のため、周辺検索を利用できません。");
      return;
    }
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("この端末では現在地を取得できません。");
      return;
    }

    setStatus("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => searchNearby(position.coords.latitude, position.coords.longitude),
      (positionError) => {
        setStatus("error");
        setError(
          positionError.code === positionError.PERMISSION_DENIED
            ? "現在地の利用が許可されていません。ブラウザの設定から位置情報を許可してください。"
            : "現在地を取得できませんでした。電波の良い場所でもう一度お試しください。",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }, [placeSearchEnabled, searchNearby]);

  useEffect(() => {
    locate();
  }, [locate]);

  const loading = status === "locating" || status === "searching";

  return (
    <div className="space-y-5">
      <section className="rough-card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line bg-leaf-soft/40 px-4 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-leaf text-white">
            <IconMapPin size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">現在地の近くから選ぶ</p>
            <p className="text-xs text-ink-soft">500m以内・近い順</p>
          </div>
          <button
            type="button"
            onClick={locate}
            disabled={loading}
            className="rounded-full border border-leaf bg-card px-3 py-2 text-xs font-semibold text-leaf-deep disabled:opacity-50"
          >
            再検索
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-ink-soft">
            <IconSpinner size={20} />
            {status === "locating" ? "現在地を確認しています…" : "近くの場所を探しています…"}
          </div>
        ) : null}

        {!loading && places.length > 0 ? (
          <ul className="divide-y divide-line">
            {places.map((place) => {
              const active = selected?.placeId === place.placeId;
              return (
                <li key={place.placeId}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelected(place)}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-paper-deep ${
                      active ? "bg-leaf-soft/50" : "bg-card"
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      active ? "bg-leaf text-white" : "bg-paper-deep text-ink-faint"
                    }`}>
                      {active ? <IconCheck size={18} /> : <IconMapPin size={18} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{place.name}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-ink-faint">
                        {place.address || "住所情報なし"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-leaf-deep">
                      {formatDistance(place.distanceMeters)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {error ? (
        <p role="status" className="rounded-2xl border border-blossom bg-blossom-soft px-4 py-3 text-sm leading-relaxed text-[#8f4c59]">
          {error}
        </p>
      ) : null}

      <FormMessage state={state} />

      {selected ? (
        <form action={formAction} className="rough-card space-y-4 border-2 border-leaf p-4">
          <div>
            <p className="text-xs font-semibold text-ink-faint">選択中</p>
            <p className="mt-1 text-lg font-bold">{selected.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">{selected.address}</p>
          </div>

          <input type="hidden" name="name" value={selected.name} />
          <input type="hidden" name="categoryId" value="17" />
          <input type="hidden" name="municipalityCode" value={selected.municipalityCode} />
          <input type="hidden" name="address" value={selected.address} />
          <input type="hidden" name="postalCode" value="" />
          <input type="hidden" name="phone" value="" />
          <input type="hidden" name="websiteUrl" value="" />
          <input type="hidden" name="openingHours" value="" />
          <input type="hidden" name="closedDays" value="" />
          <input type="hidden" name="memo" value="" />
          <input type="hidden" name="latitude" value={selected.latitude} />
          <input type="hidden" name="longitude" value={selected.longitude} />
          <input type="hidden" name="locationSource" value="place_search" />
          <input type="hidden" name="locationAccuracy" value="" />
          <input type="hidden" name="placeProvider" value="google_places" />
          <input type="hidden" name="placeId" value={selected.placeId} />
          <input type="hidden" name="visitId" value={visitId} />
          <input type="hidden" name="tripId" value={tripId} />
          <input type="hidden" name="journeyId" value="" />
          <input type="hidden" name="visitedAt" value={visitedAt} />
          <input type="hidden" name="rating" value="" />
          <input type="hidden" name="comment" value="" />
          <input type="hidden" name="note" value="" />
          <input type="hidden" name="companions" value="" />
          <input type="hidden" name="amount" value="" />
          <input type="hidden" name="stayMinutes" value="" />
          <input type="hidden" name="congestionLevel" value="" />
          <input type="hidden" name="tags" value="" />
          <input type="hidden" name="photoPaths" value="[]" />

          <SubmitButton disabled={!visitId} pendingLabel="登録しています…">
            この場所を登録
          </SubmitButton>
          <p className="text-center text-[11px] text-ink-faint">
            評価・感想・写真は登録後に追加できます。
          </p>
        </form>
      ) : null}

      <Link href="/spots/new" className="btn btn-quiet w-full">
        通常の登録画面を開く
      </Link>
    </div>
  );
}
