import Link from "next/link";
import { notFound } from "next/navigation";
import { IconPlus } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SpotBrowser } from "@/components/spot-browser";
import { EmptyState } from "@/components/ui";
import { loadCategoryNames, getSpotsInMunicipality } from "@/lib/data/spots";
import { getMunicipality, getPrefecture } from "@/lib/geo";
import { getRegion } from "@/lib/geo/regions";
import { resolveWorkspace } from "@/lib/data/workspace";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ muni: string }> }) {
  const { muni } = await params;
  const municipality = getMunicipality(muni);
  return { title: municipality ? `${municipality.name} | おでかけ記録` : "おでかけ記録" };
}

export default async function MunicipalityPage({
  params,
  searchParams,
}: {
  params: Promise<{ region: string; pref: string; muni: string }>;
  searchParams: Promise<{ area?: string }>;
}) {
  const [{ region: regionSlug, pref, muni }, { area }] = await Promise.all([params, searchParams]);
  const region = getRegion(regionSlug);
  const prefecture = getPrefecture(pref);
  const municipality = getMunicipality(muni);

  if (
    !region ||
    !prefecture ||
    !municipality ||
    prefecture.region.slug !== region.slug ||
    municipality.prefectureCode !== prefecture.code
  ) {
    notFound();
  }

  const { supabase, user } = await requireUser();
  const workspace = await resolveWorkspace(supabase, user.id);
  const [spots, categoryNames] = await Promise.all([
    getSpotsInMunicipality(supabase, municipality.code, workspace.tripIds),
    loadCategoryNames(supabase),
  ]);

  const categories = [...categoryNames.entries()].map(([id, name]) => ({ id, name }));
  const newSpotHref = `/spots/new?pref=${prefecture.code}&muni=${municipality.code}`;
  const backHref =
    area && /^m\d{5}$/.test(area)
      ? `/map/${region.slug}/${prefecture.code}/area/${area}`
      : `/map/${region.slug}/${prefecture.code}`;

  return (
    <>
      <PageHeader
        title={municipality.name}
        subtitle={prefecture.name}
        backHref={backHref}
        action={
          <Link
            href={newSpotHref}
            aria-label="スポットを追加"
            className="pressable flex h-10 w-10 items-center justify-center rounded-full border border-leaf bg-leaf-soft text-leaf-deep"
          >
            <IconPlus size={20} />
          </Link>
        }
      />

      <PageBody>
        <p className="px-1 text-sm font-semibold text-ink-soft">
          訪問スポット <span className="text-lg tabular-nums text-ink">{spots.length}</span> 件
        </p>

        {spots.length === 0 ? (
          <EmptyState
            title="まだスポットがありません"
            description={`${municipality.name}で訪れた場所を登録してみましょう。`}
            actionHref={newSpotHref}
            actionLabel="スポットを登録する"
          />
        ) : (
          <SpotBrowser spots={spots} categories={categories} municipalityName={municipality.name} />
        )}
      </PageBody>
    </>
  );
}
