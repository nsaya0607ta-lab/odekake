import { IconFlag } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SpotCard } from "@/components/spot-browser";
import { EmptyState } from "@/components/ui";
import { getRevisitWantedSpots } from "@/lib/data/spots";
import { allReadableTripIds } from "@/lib/data/workspace";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "また行きたい場所 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const { supabase } = await requireUser();

  // マイページ配下は、マイページ本体の合計と同じくアカウント全体を対象にする
  const tripIds = await allReadableTripIds(supabase);
  const spots = await getRevisitWantedSpots(supabase, tripIds);

  return (
    <>
      <PageHeader title="また行きたい場所" subtitle="すべての旅から" backHref="/mypage" />
      <PageBody>
        {spots.length === 0 ? (
          <EmptyState
            icon={<IconFlag size={30} />}
            mascot="wonder"
            title="また行きたい場所はまだありません"
            description="訪問の記録で「また行きたい」を付けると、ここにまとまります。"
            actionHref="/records"
            actionLabel="記録を見る"
          />
        ) : (
          <ul className="space-y-2">
            {spots.map((spot) => (
              <li key={spot.id}>
                <SpotCard spot={spot} />
              </li>
            ))}
          </ul>
        )}
      </PageBody>
    </>
  );
}
