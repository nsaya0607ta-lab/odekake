"use client";

import { useEffect, useRef, useState } from "react";
import { IconMapPin, IconSearch, IconSpinner } from "@/components/icons";
import { PREFECTURE_NAMES } from "@/lib/geo/prefecture-names";

export type ExistingSpotOption = {
  id: string;
  name: string;
  address: string | null;
  categoryName: string | null;
  prefectureCode: string;
  municipalityCode: string;
};

const prefectureNameOf = (code: string) => PREFECTURE_NAMES.find((p) => p.code === code)?.name ?? "";

/** すでに登録済みのスポットを検索して選ぶ。新しく場所を登録せず、その訪問記録だけ追加したいときに使う。 */
export function ExistingSpotPicker({
  onSelect,
}: {
  onSelect: (spot: ExistingSpotOption) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [spots, setSpots] = useState<ExistingSpotOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const id = ++requestId.current;
    setBusy(true);
    setError(null);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/spots/search?q=${encodeURIComponent(keyword.trim())}`, {
          signal: controller.signal,
        });
        if (id !== requestId.current) return;
        if (!res.ok) throw new Error("failed");
        const payload = (await res.json()) as { spots: ExistingSpotOption[] };
        setSpots(payload.spots);
        setLoaded(true);
      } catch {
        if (controller.signal.aborted) return;
        setError("スポットを取得できませんでした。時間をおいてもう一度お試しください。");
      } finally {
        if (id === requestId.current) setBusy(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [keyword]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint">
          <IconSearch size={18} />
        </span>
        <input
          type="search"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="登録済みのスポット名・住所で検索"
          aria-label="登録済みのスポットを検索"
          autoComplete="off"
          className="field bg-card pl-10"
        />
      </div>

      {busy ? (
        <p className="flex items-center gap-2 px-1 text-xs text-ink-soft">
          <IconSpinner size={16} />
          検索しています…
        </p>
      ) : null}

      {error ? <p className="px-1 text-xs leading-relaxed text-[#95505e]">{error}</p> : null}

      {!busy && loaded && spots.length === 0 ? (
        <p className="rough-card p-3 text-[11px] leading-relaxed text-ink-faint">
          {keyword.trim()
            ? "該当するスポットが見つかりませんでした。"
            : "まだ登録済みのスポットがありません。「新しい場所を登録」から追加してください。"}
        </p>
      ) : null}

      {spots.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {spots.map((spot) => (
            <li key={spot.id}>
              <button
                type="button"
                onClick={() => onSelect(spot)}
                className="pressable flex min-h-14 w-full items-center gap-2 px-4 py-3 text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-leaf-deep">
                  <IconMapPin size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{spot.name}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-ink-faint">
                    {spot.address ?? `${prefectureNameOf(spot.prefectureCode)}${spot.categoryName ? ` ・ ${spot.categoryName}` : ""}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
