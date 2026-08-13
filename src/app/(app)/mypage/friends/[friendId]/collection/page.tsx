import { notFound } from "next/navigation";
import { CollectionProgress, ItemGrid } from "@/components/collection/collection-ui";
import { IconLock } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { COLLECTION_ITEMS } from "@/lib/collection/items";
import { getOwnedItemIds } from "@/lib/data/collection";
import {
  FriendsUnavailableError,
  getFriendCollection,
  getFriendOverview,
} from "@/lib/data/friends";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "フレンドの図鑑 | おでかけ記録" };
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function FriendCollectionPage({
  params,
}: {
  params: Promise<{ friendId: string }>;
}) {
  const [{ supabase, user }, { friendId }] = await Promise.all([requireUser(), params]);
  if (!UUID_PATTERN.test(friendId)) notFound();

  try {
    const overview = await getFriendOverview(supabase, friendId);
    if (!overview) notFound();

    const [collection, viewerOwned] = overview.show_collection
      ? await Promise.all([
          getFriendCollection(supabase, friendId),
          getOwnedItemIds(supabase, user.id),
        ])
      : [[], new Set<string>()];
    const counts = new Map(collection.map((item) => [item.item_id, item.count]));
    const owned = new Set(counts.keys());

    return (
      <>
        <PageHeader
          title={`${overview.display_name}さんの図鑑`}
          backHref={`/mypage/friends/${friendId}`}
        />
        <PageBody>
          {!overview.show_collection ? (
            <div className="rough-card flex items-center justify-center gap-2 px-5 py-10 text-sm text-ink-faint">
              <IconLock size={18} />
              図鑑は非公開に設定されています
            </div>
          ) : (
            <div className="space-y-4">
              <p className="rough-pill border border-line-strong bg-card px-3 py-2 text-center text-[10px] font-semibold leading-relaxed text-ink-soft">
                自分も持っているアイテムは内容を表示し、未所持のアイテムは出た回数だけ確認できます
              </p>
              <CollectionProgress owned={owned.size} total={COLLECTION_ITEMS.length} />
              <ItemGrid
                items={COLLECTION_ITEMS}
                owned={owned}
                counts={counts}
                revealedOwned={viewerOwned}
                showCountWhenHidden
              />
              <p className="pb-2 text-center text-xs text-ink-faint">
                自分が持っていないアイテムはシークレット表示されます
              </p>
            </div>
          )}
        </PageBody>
      </>
    );
  } catch (error) {
    if (!(error instanceof FriendsUnavailableError)) throw error;
    return (
      <>
        <PageHeader title="フレンドの図鑑" backHref="/mypage/friends" />
        <PageBody>
          <div className="rough-card px-6 py-10 text-center font-bold">フレンド機能を準備中です</div>
        </PageBody>
      </>
    );
  }
}
