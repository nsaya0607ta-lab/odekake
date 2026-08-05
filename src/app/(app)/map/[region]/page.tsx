import Link from "next/link";
import { notFound } from "next/navigation";
import { IconChevronRight } from "@/components/icons";
import { RegionMap } from "@/components/japan-map";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { VisitedBadge } from "@/components/ui";
import { loadAreaIndex } from "@/lib/data/areas";
import { getPrefecturesByRegion } from "@/lib/geo";
import { getRegion } from "@/lib/geo/regions";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ region: string }> }) {
  const { region } = await params;
  const found = getRegion(region);
  return { title: found ? `${found.name}地方 | おでかけ記録` : "おでかけ記録" };
}

export default async function RegionPage({ params }: { params: Promise<{ region: string }> }) {
  const { region: regionSlug } = await params;
  const region = getRegion(regionSlug);
  if (!region) notFound();

  const { supabase } = await requireUser();
  const areas = await loadAreaIndex(supabase);
  const prefectures = getPrefecturesByRegion(region.slug);

  const visitedPrefectures = Object.fromEntries(
    prefectures.map((p) => [p.code, (areas.prefecture.get(p.code)?.visitCount ?? 0) > 0]),
  );

  return (
    <>
      <PageHeader title={`${region.name}地方`} backHref="/map" />
      <PageBody>
        <section className="rough-card px-3 py-4">
          <p className="mb-2 text-center text-xs text-ink-soft">
            <span className="rough-pill bg-leaf-soft px-3 py-1 text-leaf-deep">
              都道府県をタップすると市区町村一覧へ
            </span>
          </p>
          <RegionMap
            regionSlug={region.slug}
            visitedPrefectures={visitedPrefectures}
            className="mx-auto h-auto w-full max-h-[54vh]"
          />
        </section>

        <section>
          <h2 className="mb-2 px-1 text-base font-bold">都道府県から選ぶ</h2>
          <ul className="space-y-2">
            {prefectures.map((p) => {
              const entry = areas.prefecture.get(p.code);
              return (
                <li key={p.code}>
                  <Link
                    href={`/map/${region.slug}/${p.code}`}
                    className="rough-card flex items-center gap-3 px-4 py-3 transition-transform active:scale-[0.99]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{p.name}</span>
                      <span className="mt-1 flex items-center gap-1.5">
                        <VisitedBadge visited={(entry?.visitCount ?? 0) > 0} />
                        <span className="text-xs text-ink-faint">{entry?.spotCount ?? 0}スポット</span>
                      </span>
                    </span>
                    <IconChevronRight size={18} className="shrink-0 text-ink-faint" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </PageBody>
    </>
  );
}
