import { IconFlag } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SpotCard } from "@/components/spot-browser";
import { EmptyState } from "@/components/ui";
import { getAllSpots } from "@/lib/data/spots";
import { resolveWorkspace } from "@/lib/data/workspace";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "行きたい場所 | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const { supabase, user } = await requireUser();
  const workspace = await resolveWorkspace(supabase, user.id);
  const spots = await getAllSpots(supabase, workspace.tripIds, { includeUnvisited: true });
  const wishlist = spots.filter((spot) => spot.visitCount === 0);

  return (
    <>
      <PageHeader title="行きたい場所" backHref="/mypage" />
      <PageBody>
        {wishlist.length === 0 ? (
          <EmptyState
            icon={<IconFlag size={30} />}
            title="行きたい場所はまだありません"
            description="場所を登録してまだ訪問記録がないものが、ここに表示されます。"
            actionHref="/spots/new"
            actionLabel="場所を登録する"
          />
        ) : (
          <ul className="space-y-2">
            {wishlist.map((spot) => (
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
