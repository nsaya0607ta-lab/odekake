import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SpotForm } from "@/components/spot-form";
import { loadCategoryNames } from "@/lib/data/spots";
import { getTripOptions } from "@/lib/data/trips";
import { resolveWorkspace } from "@/lib/data/workspace";
import { getMunicipality } from "@/lib/geo";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "行った場所を登録 | おでかけ記録" };
export const dynamic = "force-dynamic";

function todayInJapan() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function NewSpotPage({
  searchParams,
}: {
  searchParams: Promise<{ pref?: string; muni?: string; trip?: string }>;
}) {
  const [{ supabase, user }, { pref, muni, trip: requestedTripId }] = await Promise.all([
    requireUser(),
    searchParams,
  ]);
  const workspace = await resolveWorkspace(supabase, user.id);
  const [categoryNames, tripOptions] = await Promise.all([
    loadCategoryNames(supabase),
    getTripOptions(supabase, workspace.tripIds),
  ]);

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
