"use client";

import { useMemo, useState } from "react";
import { IconChevronDown, IconClose, IconMapPin, IconPlus } from "@/components/icons";
import { getMunicipalitiesByPrefecture } from "@/lib/geo/municipalities";
import { PREFECTURE_NAMES } from "@/lib/geo/prefecture-names";
import {
  MAX_TRIP_DESTINATION_AREAS,
  parseTripDestinationAreas,
  tripDestinationAreaLabel,
  tripDestinationSummary,
  type TripDestinationArea,
} from "@/lib/trip-destinations";

export function TripDestinationPicker({
  initial = [],
  error,
}: {
  initial?: unknown;
  error?: string;
}) {
  const [areas, setAreas] = useState<TripDestinationArea[]>(() => parseTripDestinationAreas(initial));
  const [open, setOpen] = useState(false);
  const [prefectureCode, setPrefectureCode] = useState("");
  const [municipalityCode, setMunicipalityCode] = useState("");
  const municipalities = useMemo(
    () => (prefectureCode ? getMunicipalitiesByPrefecture(prefectureCode) : []),
    [prefectureCode],
  );

  const addArea = () => {
    if (!prefectureCode || areas.length >= MAX_TRIP_DESTINATION_AREAS) return;
    const next: TripDestinationArea = {
      prefectureCode,
      municipalityCode: municipalityCode || null,
    };

    setAreas((current) => {
      let base = current;
      if (next.municipalityCode === null) {
        // 都道府県全体を選んだ場合は、その県の細かい選択をまとめる。
        base = current.filter((item) => item.prefectureCode !== next.prefectureCode);
      } else {
        // 市区町村を選んだ場合は、同じ県の「県全体」だけを外して具体的な行き先を優先する。
        base = current.filter(
          (item) => !(item.prefectureCode === next.prefectureCode && item.municipalityCode === null),
        );
      }

      const exists = base.some(
        (item) =>
          item.prefectureCode === next.prefectureCode &&
          item.municipalityCode === next.municipalityCode,
      );
      return exists ? base : [...base, next].slice(0, MAX_TRIP_DESTINATION_AREAS);
    });
    setMunicipalityCode("");
  };

  const removeArea = (target: TripDestinationArea) => {
    setAreas((current) =>
      current.filter(
        (item) =>
          item.prefectureCode !== target.prefectureCode ||
          item.municipalityCode !== target.municipalityCode,
      ),
    );
  };

  return (
    <section className="space-y-2">
      <p className="field-label mb-0">
        行き先 <span className="ml-1 text-[11px] font-normal text-ink-faint">（任意）</span>
      </p>

      <input
        type="hidden"
        name="destinationAreas"
        data-draft="true"
        value={JSON.stringify(areas)}
        onChange={(event) => setAreas(parseTripDestinationAreas(event.currentTarget.value))}
      />

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="rough-card flex min-h-[62px] w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-leaf-soft text-leaf-deep">
          <IconMapPin size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink-soft">
            {areas.length > 0 ? tripDestinationSummary(areas) : "都道府県・地域を追加"}
          </span>
          <span className="mt-0.5 block text-[11px] text-ink-faint">
            旅行の概要として保存します。訪問実績にはなりません
          </span>
        </span>
        <IconChevronDown
          size={18}
          className={`shrink-0 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {areas.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-1">
          {areas.map((area) => {
            const key = `${area.prefectureCode}:${area.municipalityCode ?? "*"}`;
            return (
              <span
                key={key}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-xs font-semibold text-ink-soft"
              >
                {tripDestinationAreaLabel(area)}
                <button
                  type="button"
                  onClick={() => removeArea(area)}
                  aria-label={`${tripDestinationAreaLabel(area)}を行き先から削除`}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-ink-faint active:bg-paper-deep"
                >
                  <IconClose size={13} />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      {open ? (
        <div className="rough-card space-y-3 bg-paper-deep/55 p-3.5">
          <div className="grid grid-cols-2 gap-2.5">
            <label className="min-w-0">
              <span className="mb-1 block text-[11px] font-semibold text-ink-faint">都道府県</span>
              <select
                className="field bg-card"
                value={prefectureCode}
                onChange={(event) => {
                  setPrefectureCode(event.target.value);
                  setMunicipalityCode("");
                }}
                aria-label="行き先の都道府県"
              >
                <option value="">選択</option>
                {PREFECTURE_NAMES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0">
              <span className="mb-1 block text-[11px] font-semibold text-ink-faint">市区町村・地域</span>
              <select
                className="field bg-card"
                value={municipalityCode}
                onChange={(event) => setMunicipalityCode(event.target.value)}
                disabled={!prefectureCode}
                aria-label="行き先の市区町村"
              >
                <option value="">県全体 / 未指定</option>
                {municipalities.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={addArea}
            disabled={!prefectureCode || areas.length >= MAX_TRIP_DESTINATION_AREAS}
            className="btn btn-primary w-full"
          >
            <IconPlus size={17} />
            行き先に追加
          </button>

          <p className="text-[11px] leading-relaxed text-ink-faint">
            ここで選んだだけでは地図は塗られません。実際に行った場所を登録したとき、親の個人旅・共有旅の地図とこの旅行の記録へ反映されます。
          </p>
        </div>
      ) : null}

      {error ? <p className="mt-1 text-xs text-[#a85c6a]">{error}</p> : null}
    </section>
  );
}
