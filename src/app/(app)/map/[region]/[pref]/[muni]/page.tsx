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
import { loadMunicipalityShapes } from "@/lib/geo/municipality-shapes";
import { getRegion } from "@/lib/geo/regions";
import { resolveWorkspace } from "@/lib/data/workspace";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ muni: string }> }) {
  const { muni } = await params;
  const municipality = getMunicipality(muni);
  return { title: municipality ? `${municipality.name} | おでかけ記録` : "おでかけ記録" };
}

function viewBoxForMunicipalityShape(d: string): string {
  const values = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0])).filter(Number.isFinite);
  if (values.length < 4) return "0 0 1 1";
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < values.length; i += 2) {
    const x = values[i]!;
    const y = values[i + 1]!;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return "0 0 1 1";
  const width = Math.max(maxX - minX, 0.001);
  const height = Math.max(maxY - minY, 0.001);
  const pad = Math.max(width, height) * 0.08;
  return `${minX - pad} ${minY - pad} ${width + pad * 2} ${height + pad * 2}`;
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
  const [spots, categoryNames, shapes] = await Promise.all([
    getSpotsInMunicipality(supabase, municipality.code, workspace.tripIds),
    loadCategoryNames(supabase),
    loadMunicipalityShapes(prefecture.code),
  ]);

  const municipalityShape = shapes.find((shape) => shape.code === municipality.code) ?? null;
  const shapeForPins = municipalityShape
    ? {
        d: municipalityShape.d,
        viewBox: viewBoxForMunicipalityShape(municipalityShape.d),
        prefectureCode: prefecture.code,
      }
    : null;

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

        <SpotPinMap spots={spots} municipalityName={municipality.name} shape={shapeForPins} />

        {spots.length === 0 ? (
          <EmptyState
            title="まだスポットがありません"
            description={`${municipality.name}で訪れた場所を登録してみましょう。`}
            actionHref={newSpotHref}
            actionLabel="スポットを登録する"
          />
        ) : (
          <section className="space-y-2">
            <h2 className="px-1 text-base font-bold">訪問したスポット</h2>
            <SpotBrowser spots={spots} categories={categories} />
          </section>
        )}
      </PageBody>
    </>
  );
}
