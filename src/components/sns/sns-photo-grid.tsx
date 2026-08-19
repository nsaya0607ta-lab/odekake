import Link from "next/link";
import { IconChat, IconHeart, IconUser } from "@/components/icons";
import { groupSnsFeedByDay } from "@/lib/data/sns";
import type { SnsFeedPhotoRow } from "@/lib/supabase/types";

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

export function SnsPhotoGrid({
  photos,
  photoUrls,
  avatarUrls,
  hrefFor,
}: {
  photos: SnsFeedPhotoRow[];
  photoUrls: Map<string, string>;
  avatarUrls: Map<string, string>;
  hrefFor: (photoId: string) => string;
}) {
  const days = groupSnsFeedByDay(photos);
  if (days.length === 0) return null;

  return (
    <>
      {days.map((day) => (
        <section key={day.photoDate} className="space-y-2">
          <h2 className="px-1 text-sm font-bold text-ink-soft">{formatDayLabel(day.photoDate)}</h2>
          <div className="grid grid-cols-3 gap-1.5">
            {day.photos.map((photo) => {
              const url = photoUrls.get(photo.storage_path);
              const avatarUrl = photo.profile_image_url ? avatarUrls.get(photo.profile_image_url) : null;
              return (
                <Link
                  key={photo.id}
                  href={hrefFor(photo.id)}
                  className="relative aspect-square overflow-hidden rounded-2xl bg-paper-deep active:scale-[0.98]"
                >
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                  <span className="absolute top-1 left-1 flex max-w-[calc(100%-8px)] items-center gap-1 rounded-full bg-black/45 py-0.5 pr-2 pl-0.5">
                    <span className="h-5 w-5 shrink-0 overflow-hidden rounded-full border border-white/70 bg-paper-deep">
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-ink-faint">
                          <IconUser size={11} />
                        </span>
                      )}
                    </span>
                    <span className="truncate text-[10px] font-semibold text-white">{photo.display_name}</span>
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
      ))}
    </>
  );
}
