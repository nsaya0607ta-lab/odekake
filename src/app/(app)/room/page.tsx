import type { Metadata } from "next";
import { MyRoom } from "@/components/room/my-room";
import { getCoinSummary } from "@/lib/data/coins";
import { getCurrentDogSkin } from "@/lib/data/dog-skin";
import { getExpDashboard, getStepHistory } from "@/lib/data/exp";
import { getFriendList } from "@/lib/data/friends";
import { getFriendDogs, getMyRoom, getRoomInventory, getRoomMailbox, getRoomShop } from "@/lib/data/my-room";
import { signThumbOrOriginalPaths } from "@/lib/data/photos";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "わんこのおへや | おでかけ記録" };
export const dynamic = "force-dynamic";

/** わんこのおへや：図鑑アイテム・おでかけの写真・トロフィー・ペナントを飾り、犬が暮らす部屋 */
export default async function RoomPage() {
  const { supabase, user } = await requireUser();
  const [entries, room, dogSkin, dashboard, coins, stepHistory, mail, friendRows, shop, friendDogs] = await Promise.all([
    getRoomInventory(supabase, user.id),
    getMyRoom(supabase, user.id),
    getCurrentDogSkin(supabase, user.id),
    getExpDashboard(supabase, user.id),
    getCoinSummary(supabase, user.id),
    getStepHistory(supabase, user.id, 40),
    getRoomMailbox(supabase),
    // フレンド機能が使えない環境でも、おへやは表示する
    getFriendList(supabase).catch(() => []),
    getRoomShop(supabase, user.id),
    getFriendDogs(supabase).catch(() => new Map()),
  ]);
  const avatarPaths = friendRows.flatMap((f) => (f.profile_image_url ? [f.profile_image_url] : []));
  const avatars = avatarPaths.length ? await signThumbOrOriginalPaths(supabase, avatarPaths) : new Map<string, string>();
  const friends = friendRows.map((f) => ({ id: f.friend_user_id, name: f.display_name, avatar: f.profile_image_url ? (avatars.get(f.profile_image_url) ?? null) : null, ...friendDogs.get(f.friend_user_id) }));
  return (
    <MyRoom
      entries={entries}
      initialLayout={room.layout}
      serverReady={room.ready}
      dogSkin={dogSkin}
      dogName="わんこ"
      serverNow={new Date().toISOString()}
      steps={{ steps: dashboard.todaySteps, stepExp: dashboard.todayStepExp, coinBalance: coins.balance }}
      stepHistory={stepHistory}
      guests={{ mail, friends }}
      shop={shop}
      ownerId={user.id}
    />
  );
}
