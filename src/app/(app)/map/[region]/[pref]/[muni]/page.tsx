import Link from "next/link";
import { notFound } from "next/navigation";
import { IconPlus } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SpotBrowser } from "@/components/spot-browser";
import { SpotPinMap } from "@/components/spot-pin-map";
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
  const totalVisits = spots.reduce((sum, spot) => sum + spot.visitCount, 0);

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
        <section className="rough-card flex items-center justify-around px-4 py-4 text-center">
          <div>
            <p className="text-2xl leading-none font-bold tabular-nums">{totalVisits}</p>
            <p className="mt-1 text-xs text-ink-soft">訪問数</p>
          </div>
          <div className="h-8 w-px bg-line" />
          <div>
            <p className="text-2xl leading-none font-bold tabular-nums">{spots.length}</p>
            <p className="mt-1 text-xs text-ink-soft">訪問スポット</p>
          </div>
        </section>

        {spots.length === 0 ? (
          <EmptyState
            title="まだスポットがありません"
            description={`${municipality.name}で訪れた場所を登録してみましょう。`}
            actionHref={newSpotHref}
            actionLabel="スポットを登録する"
          />
        ) : (
          <>
            <SpotPinMap spots={spots} municipalityName={municipality.name} />
            <section className="space-y-2">
              <h2 className="px-1 text-base font-bold">訪問したスポット</h2>
              <SpotBrowser spots={spots} categories={categories} municipalityName={municipality.name} />
            </section>
          </>
        )}
      </PageBody>
    </>
  );
}
