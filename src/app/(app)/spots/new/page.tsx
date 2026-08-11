import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SpotForm } from "@/components/spot-form";
import { loadCategoryNames } from "@/lib/data/spots";
import { todayInJapan } from "@/lib/date";
import { getRecordDestinationOptions } from "@/lib/data/trips";
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
  const [categoryNames, destinations] = await Promise.all([
    loadCategoryNames(supabase),
    getRecordDestinationOptions(supabase, user.id, space.name, space.tripIds),
  ]);

  const tripOptions = destinations.options;
  const trips = requestedTripId
    ? [...tripOptions].sort((a, b) => Number(b.id === requestedTripId) - Number(a.id === requestedTripId))
    : tripOptions;
  const municipality = muni ? getMunicipality(muni) : undefined;

  return (
    <>
      <PageHeader title="行った場所を登録" />
      <PageBody>
        <p className="rounded-2xl bg-leaf-soft px-4 py-3 text-xs leading-relaxed text-leaf-deep">
          普段のお出かけは「お出かけ」へ保存します。作成済みの旅行に行った記録だけ、記録先で旅行を選べます。
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
