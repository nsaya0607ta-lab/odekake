import Link from "next/link";
import { IconCamera, IconUsers } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { SnsPhotoGrid } from "@/components/sns/sns-photo-grid";
import { SnsTabs } from "@/components/sns/sns-tabs";
import { getFriendsSetupStatus, type FriendsSetupStatus } from "@/lib/data/friends";
import { signPhotoPaths } from "@/lib/data/photos";
import { getMyFriendGroups, getSnsFeed } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";
import type { FriendGroupRow, SnsFeedPhotoRow } from "@/lib/supabase/types";

export const metadata = { title: "SNS | おでかけ記録" };
export const dynamic = "force-dynamic";

export default async function SnsPage({
  searchParams,
}: {
  searchParams: Promise<{ posted?: string }>;
}) {
  const [{ supabase }, params] = await Promise.all([requireUser(), searchParams]);

  let setupStatus: FriendsSetupStatus = { ready: false, reason: "migration_required" };
  let photos: SnsFeedPhotoRow[] = [];
  let groups: FriendGroupRow[] = [];
  let unavailable = false;

  try {
    setupStatus = await getFriendsSetupStatus(supabase);
    if (setupStatus.ready) {
      [photos, groups] = await Promise.all([getSnsFeed(supabase), getMyFriendGroups(supabase)]);
    }
  } catch {
    unavailable = true;
  }

  const ready = setupStatus.ready && !unavailable;
  const avatarUrls = ready
    ? await signPhotoPaths(supabase, photos.flatMap((p) => (p.profile_image_url ? [p.profile_image_url] : [])))
    : new Map<string, string>();
  const photoUrls = ready
    ? await signPhotoPaths(supabase, photos.map((p) => p.storage_path))
    : new Map<string, string>();

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
        ) : photos.length === 0 ? (
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
        ) : (
          <SnsPhotoGrid
            photos={photos}
            photoUrls={photoUrls}
            avatarUrls={avatarUrls}
            hrefFor={(photoId) => `/sns/${photoId}`}
          />
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
      <h2 className="mt-3 font-bold">データベース設定が必要です</h2>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
        Supabaseで SNS 機能のSQLを実行すると利用できます。
      </p>
      <p className="mt-3 rounded-2xl bg-paper-deep px-3 py-2 text-xs font-semibold text-ink-soft">
        supabase/migrations/0044_friend_photos_sns.sql ・ 0045_friend_groups.sql
      </p>
    </div>
  );
}
