import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { RoomPlanner } from "@/components/room-planner";
import { COLLECTION_ITEMS } from "@/lib/collection/items";
import { getOwnedItemIds } from "@/lib/data/collection";
import { getRoomItems } from "@/lib/data/room";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "マイルーム | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function RoomPage() {
  const { supabase, user } = await requireUser();
  const [ownedIds, placements] = await Promise.all([
    getOwnedItemIds(supabase, user.id),
    getRoomItems(supabase, user.id),
  ]);

  const items = COLLECTION_ITEMS.filter(
    (item) => ownedIds.has(item.id) && item.image !== null && !item.art,
  );

  return (
    <>
      <PageHeader title="マイルーム" backHref="/mypage" subtitle="家具を置いて、じぶんだけの部屋づくり" />
      <PageBody className="max-w-2xl px-3">
        <RoomPlanner items={items} initialPlacements={placements} />
      </PageBody>
    </>
  );
}
