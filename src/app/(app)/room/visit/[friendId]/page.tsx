import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MyRoom } from "@/components/room/my-room";
import { getFriendRoom } from "@/lib/data/my-room";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "フレンドのおへや | おでかけ記録" };
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** フレンドの部屋にあそびに行く（見るだけ。いいねと置き手紙ができる） */
export default async function FriendRoomPage({ params }: { params: Promise<{ friendId: string }> }) {
  const [{ supabase, user }, { friendId }] = await Promise.all([requireUser(), params]);
  if (!UUID_PATTERN.test(friendId)) notFound();
  if (friendId === user.id) return <MovedToMyRoom />;
  const room = await getFriendRoom(supabase, user.id, friendId);
  if (!room) notFound();
  if (!room.layout) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper px-6 text-center text-ink">
        <p className="text-5xl" aria-hidden>🏠</p>
        <p className="text-[15px] font-black">{room.name}さんは、まだおへやを飾っていないみたい</p>
        <p className="text-[12px] font-bold text-ink-soft">もようがえしたら、また あそびに来てね</p>
        <Link href="/room" className="rounded-full bg-leaf-deep px-6 py-3 text-sm font-black text-white shadow-sm">じぶんのおへやに帰る</Link>
      </main>
    );
  }
  return (
    <MyRoom
      entries={room.entries}
      initialLayout={room.layout}
      serverReady
      dogSkin={room.dog}
      dogName="わんこ"
      serverNow={new Date().toISOString()}
      visit={{ friendId, name: room.name, liked: room.liked, likeCount: room.likeCount, myNotes: room.myNotes }}
    />
  );
}

function MovedToMyRoom() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper px-6 text-center text-ink">
      <p className="text-[15px] font-black">ここは、あなたのおへやです</p>
      <Link href="/room" className="rounded-full bg-leaf-deep px-6 py-3 text-sm font-black text-white shadow-sm">おへやへ</Link>
    </main>
  );
}
