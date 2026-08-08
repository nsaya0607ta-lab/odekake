import { IconHeart } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SpotCard } from "@/components/spot-browser";
import { EmptyState } from "@/components/ui";
import { getFavoriteSpots } from "@/lib/data/spots";
import { allReadableTripIds } from "@/lib/data/workspace";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "お気に入り | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const { supabase } = await requireUser();

  // マイページ配下は、マイページ本体の合計と同じくアカウント全体を対象にする
  const tripIds = await allReadableTripIds(supabase);
  const spots = await getFavoriteSpots(supabase, tripIds);

  return (
    <>
      <PageHeader title="お気に入り" subtitle="すべての旅から" backHref="/mypage" />
      <PageBody>
        {spots.length === 0 ? (
          <EmptyState
            icon={<IconHeart size={30} />}
            mascot="sit"
            title="お気に入りはまだありません"
            description="スポットの詳細画面でハートを押すと、ここに表示されます。"
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
