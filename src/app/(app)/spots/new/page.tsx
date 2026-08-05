import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { loadCategoryNames } from "@/lib/data/spots";
import { getMunicipality } from "@/lib/geo";
import { requireUser } from "@/lib/supabase/server";
import { SpotForm } from "./spot-form";

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
  const defaultPrefectureCode = municipality?.prefectureCode ?? pref ?? "";

  return (
    <>
      <PageHeader title="スポットを登録" />
      <PageBody>
        <SpotForm
          categories={[...categoryNames.entries()].map(([id, name]) => ({ id, name }))}
          defaultPrefectureCode={defaultPrefectureCode}
          defaultMunicipalityCode={municipality?.code ?? ""}
        />
      </PageBody>
    </>
  );
}
