import { notFound } from "next/navigation";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { loadAreaIndex } from "@/lib/data/areas";
import { getMunicipalitiesByPrefecture, getPrefecture } from "@/lib/geo";
import { getRegion } from "@/lib/geo/regions";
import { requireUser } from "@/lib/supabase/server";
import { MunicipalityList } from "./municipality-list";

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

  const { supabase } = await requireUser();
  const areas = await loadAreaIndex(supabase);

  const municipalities = getMunicipalitiesByPrefecture(prefecture.code).map((m) => {
    const entry = areas.municipality.get(m.code);
    return {
      code: m.code,
      name: m.name,
      spotCount: entry?.spotCount ?? 0,
      visited: (entry?.visitCount ?? 0) > 0,
    };
  });

  const prefectureEntry = areas.prefecture.get(prefecture.code);
  const visitedCount = municipalities.filter((m) => m.visited).length;

  return (
    <>
      <PageHeader title={prefecture.name} subtitle={`${region.name}地方`} backHref={`/map/${region.slug}`} />
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
            <p className="text-2xl leading-none font-bold tabular-nums">{municipalities.length}</p>
            <p className="mt-1 text-xs text-ink-soft">市区町村</p>
          </div>
        </section>

        <section>
          <h2 className="mb-2 px-1 text-base font-bold">市区町村から選ぶ</h2>
          <MunicipalityList items={municipalities} hrefBase={`/map/${region.slug}/${prefecture.code}`} />
        </section>
      </PageBody>
    </>
  );
}
