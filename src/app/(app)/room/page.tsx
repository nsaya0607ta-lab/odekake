import type { Metadata } from "next";
import { DecorationRoom } from "@/components/town/decoration-room";
import { COLLECTION_ITEMS } from "@/lib/collection/items";
import { getCoinSummary } from "@/lib/data/coins";
import { getDecorationRoom, getRoomInventory } from "@/lib/data/decoration-room";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "おへや | おでかけ記録" };
export const dynamic = "force-dynamic";

/** おへや：図鑑アイテム・おでかけの写真・トロフィー・おみやげを飾る */
export default async function RoomPage() {
  const { supabase, user } = await requireUser();
  const [entries, room, coins] = await Promise.all([
    getRoomInventory(supabase, user.id),
    getDecorationRoom(supabase, user.id),
    getCoinSummary(supabase, user.id),
  ]);
  return (
    <DecorationRoom
      entries={entries}
      initialPlacements={room.placements}
      serverReady={room.ready}
      totalCollectionCount={COLLECTION_ITEMS.length}
      coinBalance={coins.balance}
    />
  );
}
