"use client";

import { useMemo, useState } from "react";
import type { RecordDestinationHierarchy } from "@/lib/data/trips";

export type RecordDestinationValue = { tripId: string; journeyId: string };

export function RecordDestinationPicker({
  destinations,
  initialTripId,
  initialJourneyId = "",
  lockedTripId,
  onChange,
}: {
  destinations: RecordDestinationHierarchy;
  initialTripId?: string;
  initialJourneyId?: string;
  lockedTripId?: string;
  onChange?: (value: RecordDestinationValue) => void;
}) {
  const allRoots = useMemo(
    () => [...(destinations.personal ? [destinations.personal] : []), ...destinations.shared],
    [destinations],
  );
  const requestedRoot = allRoots.find((root) => root.id === (lockedTripId || initialTripId));
  const [kind, setKind] = useState<"personal" | "shared">(requestedRoot?.kind ?? "personal");
  const [sharedId, setSharedId] = useState(
    requestedRoot?.kind === "shared" ? requestedRoot.id : (destinations.shared[0]?.id ?? ""),
  );
  const [mode, setMode] = useState<"everyday" | "journey">(initialJourneyId ? "journey" : "everyday");
  const [journeyByRoot, setJourneyByRoot] = useState<Record<string, string>>(
    initialJourneyId && requestedRoot ? { [requestedRoot.id]: initialJourneyId } : {},
  );

  const root = lockedTripId
    ? allRoots.find((item) => item.id === lockedTripId) ?? null
    : kind === "personal"
      ? destinations.personal
      : destinations.shared.find((item) => item.id === sharedId) ?? null;
  const journeyId = root && mode === "journey" ? (journeyByRoot[root.id] ?? "") : "";

  const emit = (nextRootId: string, nextJourneyId: string) => onChange?.({
    tripId: nextRootId,
    journeyId: nextJourneyId,
  });

  return (
    <section className="rough-card space-y-4 p-4">
      <div>
        <p className="mb-2 text-sm font-bold">記録先</p>
        {lockedTripId ? (
          <p className="field flex items-center bg-paper-deep font-semibold">
            {root?.kind === "shared" ? `共有旅｜${root.title}` : `個人旅｜${root?.title ?? "自分の旅"}`}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="記録先の種類">
            <button
              type="button"
              className={`rounded-2xl border px-3 py-3 text-sm font-bold ${kind === "personal" ? "border-leaf bg-leaf-soft text-leaf-deep" : "border-line bg-paper"}`}
              onClick={() => {
                setKind("personal");
                const next = destinations.personal?.id ?? "";
                const canUseJourney = Boolean(destinations.personal?.journeys.length);
                if (!canUseJourney) setMode("everyday");
                const nextJourney = journeyByRoot[next] ?? destinations.personal?.journeys[0]?.id ?? "";
                if (canUseJourney && nextJourney) setJourneyByRoot((current) => ({ ...current, [next]: nextJourney }));
                emit(next, mode === "journey" && canUseJourney ? nextJourney : "");
              }}
            >
              個人旅
            </button>
            <button
              type="button"
              className={`rounded-2xl border px-3 py-3 text-sm font-bold ${kind === "shared" ? "border-leaf bg-leaf-soft text-leaf-deep" : "border-line bg-paper"}`}
              onClick={() => {
                setKind("shared");
                const next = sharedId || destinations.shared[0]?.id || "";
                setSharedId(next);
                const nextRoot = destinations.shared.find((item) => item.id === next);
                const canUseJourney = Boolean(nextRoot?.journeys.length);
                if (!canUseJourney) setMode("everyday");
                const nextJourney = journeyByRoot[next] ?? nextRoot?.journeys[0]?.id ?? "";
                if (canUseJourney && nextJourney) setJourneyByRoot((current) => ({ ...current, [next]: nextJourney }));
                emit(next, mode === "journey" && canUseJourney ? nextJourney : "");
              }}
              disabled={destinations.shared.length === 0}
            >
              共有旅
            </button>
          </div>
        )}
      </div>

      {root?.kind === "shared" && !lockedTripId ? (
        <label className="block space-y-2 text-sm font-bold">
          <span>共有旅</span>
          <select
            className="field"
            value={sharedId}
            onChange={(event) => {
              setSharedId(event.target.value);
              const nextRoot = destinations.shared.find((item) => item.id === event.target.value);
              const canUseJourney = Boolean(nextRoot?.journeys.length);
              if (!canUseJourney) setMode("everyday");
              const nextJourney = journeyByRoot[event.target.value] ?? nextRoot?.journeys[0]?.id ?? "";
              if (canUseJourney && nextJourney) setJourneyByRoot((current) => ({ ...current, [event.target.value]: nextJourney }));
              emit(event.target.value, mode === "journey" && canUseJourney ? nextJourney : "");
            }}
          >
            {destinations.shared.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
      ) : null}

      {root ? (
        <div className="space-y-3 border-t border-line pt-4">
          <p className="text-sm font-bold">まとめ方</p>
          <label className="flex items-center gap-3 rounded-2xl bg-paper-deep px-3 py-3 text-sm font-semibold">
            <input
              type="radio"
              checked={mode === "everyday"}
              onChange={() => { setMode("everyday"); emit(root.id, ""); }}
              className="h-5 w-5 accent-[#7fa568]"
            />
            普段のおでかけ
          </label>
          <label
            aria-disabled={root.journeys.length === 0}
            className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold ${
              root.journeys.length === 0
                ? "cursor-not-allowed bg-[#e8e6df] text-ink-faint opacity-70"
                : "cursor-pointer bg-paper-deep"
            }`}
          >
            <input
              type="radio"
              checked={mode === "journey"}
              disabled={root.journeys.length === 0}
              onChange={() => {
                setMode("journey");
                const next = journeyByRoot[root.id] ?? root.journeys[0]?.id ?? "";
                setJourneyByRoot((current) => ({ ...current, [root.id]: next }));
                emit(root.id, next);
              }}
              className="h-5 w-5 accent-[#7fa568] disabled:cursor-not-allowed disabled:accent-[#aaa79f]"
            />
            <span>
              旅行を選択
              {root.journeys.length === 0 ? <span className="ml-2 text-xs">（旅行がありません）</span> : null}
            </span>
          </label>
          {mode === "journey" ? (
            root.journeys.length > 0 ? (
              <select
                className="field"
                aria-label="旅行"
                value={journeyId}
                onChange={(event) => {
                  setJourneyByRoot((current) => ({ ...current, [root.id]: event.target.value }));
                  emit(root.id, event.target.value);
                }}
                required
              >
                <option value="">旅行を選択してください</option>
                {root.journeys.map((journey) => <option key={journey.id} value={journey.id}>{journey.title}</option>)}
              </select>
            ) : (
              <p className="rounded-2xl bg-sun-soft px-3 py-3 text-xs leading-relaxed text-ink-soft">
                この記録先には旅行がまだありません。「旅行の計画を立てる」から作成できます。
              </p>
            )
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-ink-soft">利用できる記録先がありません。</p>
      )}

      <input type="hidden" name="tripId" value={root?.id ?? ""} />
      <input type="hidden" name="journeyId" value={journeyId} />
    </section>
  );
}
