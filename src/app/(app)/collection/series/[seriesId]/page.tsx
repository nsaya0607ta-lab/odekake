import { notFound } from "next/navigation";
import { CollectionProgress, ItemGrid } from "@/components/collection/collection-ui";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import {
  COLLECTION_SERIES_IDS,
  countOwned,
  getSeries,
  getSeriesItems,
  isCollectionSeriesId,
} from "@/lib/collection/items";
import { getOwnedItemCounts } from "@/lib/data/collection";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return COLLECTION_SERIES_IDS.map((seriesId) => ({ seriesId }));
}

export default async function CollectionSeriesPage({
  params,
}: {
  params: Promise<{ seriesId: string }>;
}) {
  const { seriesId } = await params;
  if (!isCollectionSeriesId(seriesId)) notFound();

  const series = getSeries(seriesId);
  if (!series) notFound();

  const { supabase, user } = await requireUser();
  const counts = await getOwnedItemCounts(supabase, user.id);
  const owned = new Set(counts.keys());
  const items = getSeriesItems(series.id);

  return (
    <>
      <PageHeader title={series.name} backHref="/collection?tab=series" subtitle={series.description} />

      <PageBody>
        <div className="space-y-4">
          <CollectionProgress
            owned={countOwned(items, owned)}
            total={items.length}
            barClass={series.tone.bar}
          />
          <ItemGrid items={items} owned={owned} counts={counts} />
          <p className="pb-2 text-center text-xs text-ink-faint">
            持っていないアイテムはシルエットで表示されます
          </p>
        </div>
      </PageBody>
    </>
  );
}
