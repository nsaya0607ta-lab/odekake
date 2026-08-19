import Link from "next/link";
import { createFriendMessageAction, deleteFriendMessageAction } from "@/app/actions/sns";
import { IconCamera, IconUsers } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { SnsChatForm } from "@/components/sns/sns-chat-form";
import { SnsChatList } from "@/components/sns/sns-chat-list";
import { SnsPhotoGrid } from "@/components/sns/sns-photo-grid";
import { SnsTabs } from "@/components/sns/sns-tabs";
import { SnsViewTabs } from "@/components/sns/sns-view-tabs";
import { getFriendsSetupStatus, type FriendsSetupStatus } from "@/lib/data/friends";
import { signPhotoPaths } from "@/lib/data/photos";
import { getFriendMessages, getMyFriendGroups, getSnsFeed } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";
import type { FriendGroupRow, SnsFeedPhotoRow } from "@/lib/supabase/types";

export const metadata = { title: "SNS | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function SnsPage({
  searchParams,
}: {
  searchParams: Promise<{ posted?: string; view?: string }>;
}) {
  const [{ supabase, user }, params] = await Promise.all([requireUser(), searchParams]);

  let setupStatus: FriendsSetupStatus = { ready: false, reason: "migration_required" };
  let groups: FriendGroupRow[] = [];
  let unavailable = false;

  try {
    setupStatus = await getFriendsSetupStatus(supabase);
    if (setupStatus.ready) {
      groups = await getMyFriendGroups(supabase);
    }
  } catch {
    unavailable = true;
  }

  const ready = setupStatus.ready && !unavailable;
  const view = params.view === "chat" ? "chat" : "photos";

  return (
    <>
      <TopHeader
        title="SNS"
        subtitle="フレンドと今日の写真を共有"
        action={
          <Link
            href="/sns/new"
            aria-label="写真を投稿"
            className="btn btn-primary tap-target px-4 text-sm"
          >
            <IconCamera size={18} />
            投稿
          </Link>
        }
      />
      <PageBody>
        {ready ? <SnsTabs groups={groups} /> : null}

        {params.posted === "1" ? (
          <p role="status" className="rounded-2xl border border-leaf bg-leaf-soft px-4 py-3 text-sm text-leaf-deep">
            写真を投稿しました
          </p>
        ) : null}

        {!ready ? (
          <PreparingCard />
        ) : (
          <>
            <SnsViewTabs baseHref="/sns" view={view} />
            {view === "photos" ? (
              <GlobalPhotos />
            ) : (
              <GlobalChat currentUserId={user.id} />
            )}
          </>
        )}
      </PageBody>
    </>
  );
}

async function GlobalPhotos() {
  const { supabase } = await requireUser();
  const photos: SnsFeedPhotoRow[] = await getSnsFeed(supabase);
  const avatarUrls = await signPhotoPaths(
    supabase,
    photos.flatMap((p) => (p.profile_image_url ? [p.profile_image_url] : [])),
  );
  const photoUrls = await signPhotoPaths(supabase, photos.map((p) => p.storage_path));

  if (photos.length === 0) {
    return (
      <div className="rough-card px-6 py-10 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-leaf-soft text-leaf-deep">
          <IconUsers size={28} />
        </span>
        <p className="mt-3 font-bold">まだ写真がありません</p>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
          今日の出来事を撮って、フレンドに共有しましょう。
        </p>
        <Link href="/sns/new" className="btn btn-primary mt-4 inline-flex">
          <IconCamera size={18} />
          写真を投稿する
        </Link>
      </div>
    );
  }

  return (
    <SnsPhotoGrid photos={photos} photoUrls={photoUrls} avatarUrls={avatarUrls} hrefFor={(photoId) => `/sns/${photoId}`} />
  );
}

async function GlobalChat({ currentUserId }: { currentUserId: string }) {
  const { supabase } = await requireUser();
  const messages = await getFriendMessages(supabase);
  const avatarUrls = await signPhotoPaths(
    supabase,
    messages.flatMap((m) => (m.profile_image_url ? [m.profile_image_url] : [])),
  );

  return (
    <div className="space-y-4">
      <SnsChatForm action={createFriendMessageAction} />
      <SnsChatList
        messages={messages}
        avatarUrls={avatarUrls}
        currentUserId={currentUserId}
        deleteAction={deleteFriendMessageAction}
        hiddenFieldsFor={(message) => ({ messageId: message.id })}
      />
    </div>
  );
}

function PreparingCard() {
  return (
    <div className="rough-card px-6 py-10 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-paper-deep text-ink-faint">
        <IconUsers size={28} />
      </span>
      <h2 className="mt-3 font-bold">データベース設定が必要です</h2>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
        Supabaseで SNS 機能のSQLを実行すると利用できます。
      </p>
      <p className="mt-3 rounded-2xl bg-paper-deep px-3 py-2 text-xs font-semibold text-ink-soft">
        supabase/migrations/0044〜0046
      </p>
    </div>
  );
}
