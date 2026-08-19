import Link from "next/link";
import { IconCamera, IconChat, IconHeart, IconUser, IconUsers } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { TopHeader } from "@/components/page-header";
import { getFriendsSetupStatus, type FriendsSetupStatus } from "@/lib/data/friends";
import { signPhotoPaths } from "@/lib/data/photos";
import { groupSnsFeedByDay, getSnsFeed } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";
import type { SnsFeedPhotoRow } from "@/lib/supabase/types";

export const metadata = { title: "SNS | おでかけ記録" };
export const dynamic = "force-dynamic";

function formatDayLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00+09:00`);
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86_400_000);

  const formatted = new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Tokyo",
  }).format(date);

  if (diffDays === 0) return `今日・${formatted}`;
  if (diffDays === 1) return `昨日・${formatted}`;
  return formatted;
}

export default async function SnsPage({
  searchParams,
}: {
  searchParams: Promise<{ posted?: string }>;
}) {
  const [{ supabase }, params] = await Promise.all([requireUser(), searchParams]);

  let setupStatus: FriendsSetupStatus = { ready: false, reason: "migration_required" };
  let photos: SnsFeedPhotoRow[] = [];
  let unavailable = false;

  try {
    setupStatus = await getFriendsSetupStatus(supabase);
    if (setupStatus.ready) {
      photos = await getSnsFeed(supabase);
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
  const days = groupSnsFeedByDay(photos);

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
        {params.posted === "1" ? (
          <p role="status" className="rounded-2xl border border-leaf bg-leaf-soft px-4 py-3 text-sm text-leaf-deep">
            写真を投稿しました
          </p>
        ) : null}

        {!ready ? (
          <PreparingCard />
        ) : days.length === 0 ? (
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
          days.map((day) => (
            <section key={day.photoDate} className="space-y-2">
              <h2 className="px-1 text-sm font-bold text-ink-soft">{formatDayLabel(day.photoDate)}</h2>
              <div className="grid grid-cols-3 gap-1.5">
                {day.photos.map((photo) => {
                  const url = photoUrls.get(photo.storage_path);
                  const avatarUrl = photo.profile_image_url ? avatarUrls.get(photo.profile_image_url) : null;
                  return (
                    <Link
                      key={photo.id}
                      href={`/sns/${photo.id}`}
                      className="relative aspect-square overflow-hidden rounded-2xl bg-paper-deep active:scale-[0.98]"
                    >
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      ) : null}
                      <span className="absolute top-1 left-1 h-6 w-6 overflow-hidden rounded-full border border-white/70 bg-paper-deep shadow-sm">
                        {avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-ink-faint">
                            <IconUser size={12} />
                          </span>
                        )}
                      </span>
                      {photo.reaction_count > 0 || photo.comment_count > 0 ? (
                        <span className="absolute right-1 bottom-1 flex items-center gap-1.5 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {photo.reaction_count > 0 ? (
                            <span className="flex items-center gap-0.5">
                              <IconHeart size={10} filled />
                              {photo.reaction_count}
                            </span>
                          ) : null}
                          {photo.comment_count > 0 ? (
                            <span className="flex items-center gap-0.5">
                              <IconChat size={10} />
                              {photo.comment_count}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))
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
        supabase/migrations/0044_friend_photos_sns.sql
      </p>
    </div>
  );
}
