import Link from "next/link";
import { IconChevronRight } from "@/components/icons";
import { JapanMap } from "@/components/japan-map";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { VisitedBadge } from "@/components/ui";
import { loadAreaIndex } from "@/lib/data/areas";
import { resolveWorkspace } from "@/lib/data/workspace";
import { WorkspaceBar } from "@/components/workspace-bar";
import { REGIONS } from "@/lib/geo/regions";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "日本地図 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function MapPage() {
  const { supabase, user } = await requireUser();
  const workspace = await resolveWorkspace(supabase, user.id);
  const areas = await loadAreaIndex(supabase, workspace.tripIds);

  const visitedRegions = Object.fromEntries(
    REGIONS.map((r) => [r.slug, (areas.region.get(r.slug)?.visitCount ?? 0) > 0]),
  );

  return (
    <>
      <TopHeader title="日本地図" />
      <PageBody>
        <WorkspaceBar workspace={workspace} />

        <section className="rough-card px-3 py-4">
          <p className="mb-2 text-center text-xs text-ink-soft">
            <span className="rough-pill bg-leaf-soft px-3 py-1 text-leaf-deep">
              地方をタップすると都道府県一覧へ
            </span>
          </p>
          <JapanMap visitedRegions={visitedRegions} />
        </section>

        <section>
          <h2 className="mb-2 px-1 text-base font-bold">地方から選ぶ</h2>
          <ul className="grid grid-cols-2 gap-2">
            {REGIONS.map((region) => {
              const entry = areas.region.get(region.slug);
              const visited = (entry?.visitCount ?? 0) > 0;
              return (
                <li key={region.slug}>
                  <Link
                    href={`/map/${region.slug}`}
                    className="rough-card flex h-full items-center gap-2 px-4 py-3 transition-transform active:scale-[0.99]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{region.name}</span>
                      <span className="mt-1 flex items-center gap-1.5">
                        <VisitedBadge visited={visited} />
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
