import Link from "next/link";
import { IconChevronRight } from "@/components/icons";
import { JapanMap } from "@/components/japan-map";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { VisitedBadge } from "@/components/ui";
import { loadAreaIndex } from "@/lib/data/areas";
import { getRecordSpace } from "@/lib/data/space";
import { MUNICIPALITIES, PREFECTURES } from "@/lib/geo";
import { REGIONS } from "@/lib/geo/regions";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "日本地図 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function MapPage() {
  const { supabase, user } = await requireUser();
  const space = await getRecordSpace(supabase, user.id);
  const areas = await loadAreaIndex(supabase, space.tripIds);

  const visitedRegions = Object.fromEntries(
    REGIONS.map((r) => [r.slug, (areas.region.get(r.slug)?.visitCount ?? 0) > 0]),
  );

  return (
    <>
      <TopHeader title="日本地図" subtitle={space.name} />
      <PageBody className="space-y-4">
        <section className="rough-card px-2 py-3">
          <JapanMap visitedRegions={visitedRegions} />
        </section>

        <section className="rough-card grid grid-cols-2 divide-x divide-line px-2 py-3 text-center">
          <div>
            <p className="text-2xl leading-none font-bold tabular-nums">
              {areas.totals.visitedPrefectures}
              <span className="text-xs font-normal text-ink-faint"> / {PREFECTURES.length}</span>
            </p>
            <p className="mt-1 text-xs text-ink-soft">訪問した都道府県</p>
          </div>
          <div>
            <p className="text-2xl leading-none font-bold tabular-nums">
              {areas.totals.visitedMunicipalities}
              <span className="text-xs font-normal text-ink-faint"> / {MUNICIPALITIES.length}</span>
            </p>
            <p className="mt-1 text-xs text-ink-soft">訪問した市区町村など</p>
          </div>
        </section>

        <section>
          <h2 className="mb-2 px-1 text-sm font-bold">地方から選ぶ</h2>
          <ul className="grid grid-cols-2 gap-2">
            {REGIONS.map((region) => {
              const entry = areas.region.get(region.slug);
              const visited = (entry?.visitCount ?? 0) > 0;
              return (
                <li key={region.slug}>
                  <Link
                    href={`/map/${region.slug}`}
                    className="rough-card flex h-full items-center gap-2 px-3 py-2.5 transition-transform active:scale-[0.99]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{region.name}</span>
                      <span className="mt-1 flex items-center gap-1.5">
                        <VisitedBadge visited={visited} />
                        <span className="text-xs text-ink-faint">{entry?.spotCount ?? 0}スポット</span>
                      </span>
                    </span>
                    <IconChevronRight size={16} className="shrink-0 text-ink-faint" />
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
