import Link from "next/link";
import { FriendCodeControls } from "@/components/friends/friend-controls";
import { IconChevronRight, IconSliders, IconUser, IconUsers } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { COLLECTION_ITEMS } from "@/lib/collection/items";
import {
  FriendsUnavailableError,
  getFriendList,
  getMyFriendCode,
} from "@/lib/data/friends";
import { signPhotoPaths } from "@/lib/data/photos";
import { getExpProgress } from "@/lib/exp";
import { requireUser } from "@/lib/supabase/server";
import type { FriendListRow } from "@/lib/supabase/types";

export const metadata = { title: "フレンド | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ removed?: string }>;
}) {
  const [{ supabase }, params] = await Promise.all([requireUser(), searchParams]);
  let friendCode = "";
  let friends: FriendListRow[] = [];
  let unavailable = false;

  try {
    [friendCode, friends] = await Promise.all([
      getMyFriendCode(supabase),
      getFriendList(supabase),
    ]);
  } catch (error) {
    if (error instanceof FriendsUnavailableError) unavailable = true;
    else throw error;
  }

  const avatarUrls = unavailable
    ? new Map<string, string>()
    : await signPhotoPaths(
        supabase,
        friends.flatMap((friend) => (friend.profile_image_url ? [friend.profile_image_url] : [])),
      );

  return (
    <>
      <PageHeader
        title="フレンド"
        backHref="/mypage"
        action={
          <Link
            href="/mypage/friends/settings"
            aria-label="フレンド公開設定"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft active:bg-paper-deep"
          >
            <IconSliders size={20} />
          </Link>
        }
      />
      <PageBody>
        {unavailable ? (
          <PreparingCard />
        ) : (
          <>
            {params.removed === "1" ? (
              <p role="status" className="rounded-2xl border border-leaf bg-leaf-soft px-4 py-3 text-sm text-leaf-deep">
                フレンドから削除しました
              </p>
            ) : null}
            <FriendCodeControls initialCode={friendCode} />

            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-bold">フレンド</h2>
                <span className="text-sm font-semibold text-ink-faint tabular-nums">{friends.length}人</span>
              </div>
              {friends.length === 0 ? (
                <div className="rough-card px-6 py-8 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-leaf-soft text-leaf-deep">
                    <IconUsers size={28} />
                  </span>
                  <p className="mt-3 font-bold">まだフレンドはいません</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
                    相手のフレンドコードを入力すると、ここに表示されます。
                  </p>
                </div>
              ) : (
                <ul className="rough-card divide-y divide-line overflow-hidden">
                  {friends.map((friend) => {
                    const level = getExpProgress(friend.total_exp).level;
                    const avatarUrl = friend.profile_image_url
                      ? avatarUrls.get(friend.profile_image_url) ?? null
                      : null;
                    return (
                      <li key={friend.friend_user_id}>
                        <Link
                          href={`/mypage/friends/${friend.friend_user_id}`}
                          className="flex min-w-0 items-center gap-3 px-4 py-4 transition-colors active:bg-paper-deep"
                        >
                          <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-paper-deep">
                            {avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-ink-faint">
                                <IconUser size={23} />
                              </span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-bold">{friend.display_name}</span>
                            <span className="mt-0.5 block text-xs font-semibold text-leaf-deep">Lv.{level}</span>
                            <span className="mt-0.5 block truncate text-xs text-ink-faint">
                              {friend.visited_prefectures}都道府県・図鑑
                              {friend.show_collection
                                ? `${friend.collection_owned_count ?? 0}/${COLLECTION_ITEMS.length}`
                                : " 非公開"}
                            </span>
                          </span>
                          <IconChevronRight size={18} className="shrink-0 text-ink-faint" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </PageBody>
    </>
  );
}
function PreparingCard() {
  return (
    <div className="rough-card px-6 py-10 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-paper-deep text-ink-faint">
        <IconUsers size={28} />
      </span>
      <h2 className="mt-3 font-bold">フレンド機能を準備中です</h2>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
        データベースの準備が完了すると、ここからフレンドを追加できます。
      </p>
    </div>
  );
}
