import { notFound } from "next/navigation";
import { MunicipalityBrowser } from "@/components/municipality-browser";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { loadAreaIndex, shadeLevel } from "@/lib/data/areas";
import { resolveWorkspace } from "@/lib/data/workspace";
import { getMunicipalitiesByPrefecture, getPrefecture, viewBoxFor } from "@/lib/geo";
import { loadMunicipalityShapes } from "@/lib/geo/municipality-shapes";
import {
  buildPrefectureAreas,
  findPrefectureArea,
  viewBoxForMunicipalityArea,
} from "@/lib/geo/prefecture-areas";
import { getRegion } from "@/lib/geo/regions";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PrefectureAreaPage({
  params,
}: {
  params: Promise<{ region: string; pref: string; area: string }>;
}) {
  const { region: regionSlug, pref, area: areaSlug } = await params;
  const region = getRegion(regionSlug);
  const prefecture = getPrefecture(pref);
  if (!region || !prefecture || prefecture.region.slug !== region.slug) notFound();

  const { supabase, user } = await requireUser();
  const workspace = await resolveWorkspace(supabase, user.id);
  const [areasIndex, shapes] = await Promise.all([
    loadAreaIndex(supabase, workspace.tripIds),
    loadMunicipalityShapes(prefecture.code),
  ]);

  const shapeByCode = new Map(shapes.map((shape) => [shape.code, shape]));
  const municipalities = getMunicipalitiesByPrefecture(prefecture.code).map((municipality) => {
    const entry = areasIndex.municipality.get(municipality.code);
    const shape = shapeByCode.get(municipality.code);
    return {
      code: municipality.code,
      name: municipality.name,
      d: shape?.d ?? null,
      center: shape?.center ?? null,
      span: shape?.span ?? 0,
      lat: municipality.lat,
      lng: municipality.lng,
      spotCount: entry?.spotCount ?? 0,
      visitCount: entry?.visitCount ?? 0,
      favoriteCount: entry?.favoriteCount ?? 0,
      level: entry ? shadeLevel(entry) : 0,
    };
  });

  const selectedArea = findPrefectureArea(
    buildPrefectureAreas(prefecture.code, municipalities),
    areaSlug,
  );
  if (!selectedArea) notFound();

  const visitedCount = selectedArea.municipalities.filter((municipality) => municipality.level > 0).length;
  const fallbackViewBox = viewBoxFor([prefecture], "prefecture");
  const areaViewBox = viewBoxForMunicipalityArea(selectedArea.municipalities, fallbackViewBox);

  return (
    <>
      <PageHeader
        title={selectedArea.name}
        subtitle={`${prefecture.name}・${workspace.name}`}
        backHref={`/map/${region.slug}/${prefecture.code}`}
      />
      <PageBody>
        <section className="rough-card flex items-center justify-around px-4 py-4 text-center">
          <div>
            <p className="text-2xl leading-none font-bold tabular-nums">{visitedCount}</p>
            <p className="mt-1 text-xs text-ink-soft">訪問済み</p>
          </div>
          <div className="h-8 w-px bg-line" />
          <div>
            <p className="text-2xl leading-none font-bold tabular-nums">{selectedArea.spotCount}</p>
            <p className="mt-1 text-xs text-ink-soft">登録スポット</p>
          </div>
          <div className="h-8 w-px bg-line" />
          <div>
            <p className="text-2xl leading-none font-bold tabular-nums">{selectedArea.municipalities.length}</p>
            <p className="mt-1 text-xs text-ink-soft">市区町村</p>
          </div>
        </section>

        <MunicipalityBrowser
          prefectureName={`${prefecture.name} ${selectedArea.name}`}
          viewBox={areaViewBox}
          insets={[]}
          items={selectedArea.municipalities}
          hrefBase={`/map/${region.slug}/${prefecture.code}`}
          hrefSuffix={`?area=${selectedArea.slug}`}
          hasMap={selectedArea.municipalities.some((municipality) => municipality.d !== null)}
          showMapLabels
          mapLabelStyle="callout"
          mapHeading="市区町村を地図から選ぶ"
          mapInstruction="市区町村名または地図をタップするとスポット一覧へ"
        />
      </PageBody>
    </>
  );
}
