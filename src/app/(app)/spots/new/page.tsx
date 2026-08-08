import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SpotForm } from "@/components/spot-form";
import { loadCategoryNames } from "@/lib/data/spots";
import { todayInJapan } from "@/lib/date";
import { ensurePersonalRecordTrip, getTripOptions } from "@/lib/data/trips";
import { getRecordSpace } from "@/lib/data/space";
import { getMunicipality } from "@/lib/geo";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "行った場所を登録 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function NewSpotPage({
  searchParams,
}: {
  searchParams: Promise<{ pref?: string; muni?: string; trip?: string }>;
}) {
  const [{ supabase, user }, { pref, muni, trip: requestedTripId }] = await Promise.all([
    requireUser(),
    searchParams,
  ]);
  const space = await getRecordSpace(supabase, user.id);
  const [categoryNames, initialTripOptions] = await Promise.all([
    loadCategoryNames(supabase),
    getTripOptions(supabase, space.tripIds),
  ]);

  const personalRecordTrip =
    initialTripOptions.length === 0 ? await ensurePersonalRecordTrip(supabase, user.id) : null;
  const tripOptions = personalRecordTrip ? [personalRecordTrip] : initialTripOptions;
  const trips = requestedTripId
    ? [...tripOptions].sort((a, b) => Number(b.id === requestedTripId) - Number(a.id === requestedTripId))
    : tripOptions;
  const municipality = muni ? getMunicipality(muni) : undefined;

  return (
    <>
      <PageHeader title="行った場所を登録" />
      <PageBody>
        <p className="rounded-2xl bg-leaf-soft px-4 py-3 text-xs leading-relaxed text-leaf-deep">
          場所と訪問日・感想・写真を一度に保存します。登録すると日本地図にも反映されます。
        </p>
        <SpotForm
          placeSearchEnabled={Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim())}
          userId={user.id}
          trips={trips}
          visitedAtDefault={todayInJapan()}
          showTripPlanningLink
          locationFromUrl={Boolean(municipality)}
          categories={[...categoryNames.entries()].map(([id, name]) => ({ id, name }))}
          location={{
            prefectureCode: municipality?.prefectureCode ?? pref ?? "",
            municipalityCode: municipality?.code ?? "",
            latitude: municipality?.lat ?? null,
            longitude: municipality?.lng ?? null,
            locationSource: "municipality",
            locationAccuracyMeters: null,
            placeProvider: null,
            placeId: null,
          }}
        />
      </PageBody>
    </>
  );
}
