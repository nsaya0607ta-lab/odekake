import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { getTimeline } from "@/lib/data/visits";
import { getRecordSpace } from "@/lib/data/space";
import { getRecordDestinationHierarchy } from "@/lib/data/trips";
import { requireUser } from "@/lib/supabase/server";
import { AddDestinationActions } from "./add-destination-actions";

export const metadata = { title: "追加 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function AddPage() {
  const { supabase, user } = await requireUser();
  const space = await getRecordSpace(supabase, user.id);
  const destinations = await getRecordDestinationHierarchy(supabase, user.id, space.name);

  // 最近の訪問履歴から場所を拾う。スポットを全件読んでから絞るより軽く、
  // 「最近行った順」も正しく出る。
  const recent = await getTimeline(supabase, { tripIds: space.tripIds, limit: 20 });
  const recentSpots = [...new Map(recent.map((item) => [item.spotId, item])).values()].slice(0, 5);

  return (
    <>
      <TopHeader title="追加" />
      <PageBody>
        <AddDestinationActions destinations={destinations} recentSpots={recentSpots} />
      </PageBody>
    </>
  );
}
