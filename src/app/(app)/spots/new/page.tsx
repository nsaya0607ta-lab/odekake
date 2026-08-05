import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SpotForm } from "@/components/spot-form";
import { loadCategoryNames } from "@/lib/data/spots";
import { getMunicipality } from "@/lib/geo";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "スポットを登録 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function NewSpotPage({
  searchParams,
}: {
  searchParams: Promise<{ pref?: string; muni?: string }>;
}) {
  const [{ supabase }, { pref, muni }] = await Promise.all([requireUser(), searchParams]);
  const categoryNames = await loadCategoryNames(supabase);

  const municipality = muni ? getMunicipality(muni) : undefined;

  return (
    <>
      <PageHeader title="スポットを登録" />
      <PageBody>
        <SpotForm
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
