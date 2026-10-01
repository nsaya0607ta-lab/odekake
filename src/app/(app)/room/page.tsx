import type { Metadata } from "next";
import { MyRoom } from "@/components/room/my-room";
import { getCurrentDogSkin } from "@/lib/data/dog-skin";
import { getMyRoom, getRoomInventory } from "@/lib/data/my-room";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "わんこのおへや | おでかけ記録" };
export const dynamic = "force-dynamic";

/** わんこのおへや：図鑑アイテム・おでかけの写真・トロフィー・ペナントを飾り、犬が暮らす部屋 */
export default async function RoomPage() {
  const { supabase, user } = await requireUser();
  const [entries, room, dogSkin] = await Promise.all([
    getRoomInventory(supabase, user.id),
    getMyRoom(supabase, user.id),
    getCurrentDogSkin(supabase, user.id),
  ]);
  return <MyRoom entries={entries} initialLayout={room.layout} serverReady={room.ready} dogSkin={dogSkin} dogName="わんこ" serverNow={new Date().toISOString()} />;
}
