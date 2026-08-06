import { IconHeart } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SpotCard } from "@/components/spot-browser";
import { EmptyState } from "@/components/ui";
import { getAllSpots } from "@/lib/data/spots";
import { resolveWorkspace } from "@/lib/data/workspace";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "お気に入り | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const { supabase, user } = await requireUser();
  const workspace = await resolveWorkspace(supabase, user.id);
  const spots = await getAllSpots(supabase, workspace.tripIds, { includeUnvisited: true });
  const favorites = spots.filter((spot) => spot.favorite);

  return (
    <>
      <PageHeader title="お気に入り" backHref="/mypage" />
      <PageBody>
        {favorites.length === 0 ? (
          <EmptyState
            icon={<IconHeart size={30} />}
            title="お気に入りはまだありません"
            description="場所の詳細画面でハートを押すと、ここに表示されます。"
          />
        ) : (
          <ul className="space-y-2">
            {favorites.map((spot) => (
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
