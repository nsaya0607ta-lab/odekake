import { notFound } from "next/navigation";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { PrefectureAreaBrowser } from "@/components/prefecture-area-browser";
import { loadAreaIndex, shadeLevel } from "@/lib/data/areas";
import { resolveWorkspace } from "@/lib/data/workspace";
import { getMunicipalitiesByPrefecture, getPrefecture, insetsOfPrefecture, viewBoxFor } from "@/lib/geo";
import { loadMunicipalityShapes } from "@/lib/geo/municipality-shapes";
import { buildPrefectureAreas } from "@/lib/geo/prefecture-areas";
import { getRegion } from "@/lib/geo/regions";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ pref: string }> }) {
  const { pref } = await params;
  const prefecture = getPrefecture(pref);
  return { title: prefecture ? `${prefecture.name} | おでかけ記録` : "おでかけ記録" };
}

export default async function PrefecturePage({
  params,
}: {
  params: Promise<{ region: string; pref: string }>;
}) {
  const { region: regionSlug, pref } = await params;
  const region = getRegion(regionSlug);
  const prefecture = getPrefecture(pref);
  if (!region || !prefecture || prefecture.region.slug !== region.slug) notFound();

  const { supabase, user } = await requireUser();
  const workspace = await resolveWorkspace(supabase, user.id);

  // 境界データはその都道府県の分だけサーバー側で読み込む
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

  const prefectureAreas = buildPrefectureAreas(municipalities);
  const prefectureEntry = areasIndex.prefecture.get(prefecture.code);
  const visitedCount = municipalities.filter((municipality) => municipality.level > 0).length;

  return (
    <>
      <PageHeader
        title={prefecture.name}
        subtitle={`${region.name}地方・${workspace.name}`}
        backHref={`/map/${region.slug}`}
      />
      <PageBody>
        <section className="rough-card flex items-center justify-around px-4 py-4 text-center">
          <div>
            <p className="text-2xl leading-none font-bold tabular-nums">{visitedCount}</p>
            <p className="mt-1 text-xs text-ink-soft">訪問した市区町村</p>
          </div>
          <div className="h-8 w-px bg-line" />
          <div>
            <p className="text-2xl leading-none font-bold tabular-nums">{prefectureEntry?.spotCount ?? 0}</p>
            <p className="mt-1 text-xs text-ink-soft">登録スポット</p>
          </div>
          <div className="h-8 w-px bg-line" />
          <div>
            <p className="text-2xl leading-none font-bold tabular-nums">{prefectureAreas.length}</p>
            <p className="mt-1 text-xs text-ink-soft">エリア</p>
          </div>
        </section>

        <PrefectureAreaBrowser
          prefectureName={prefecture.name}
          viewBox={viewBoxFor([prefecture], "prefecture")}
          insets={insetsOfPrefecture("prefecture", prefecture.code)}
          areas={prefectureAreas}
          hrefBase={`/map/${region.slug}/${prefecture.code}`}
          hasMap={shapes.length > 0}
        />
      </PageBody>
    </>
  );
}
