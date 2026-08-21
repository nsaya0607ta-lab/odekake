import { IconCalendar, IconMapPin } from "@/components/icons";
import type { SnsTextPostRow } from "@/lib/supabase/types";

function formatLinkedDate(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${Number(month)}月${Number(day)}日`;
}

/** 投稿に明示的に紐づけられた場所と旅行だけを、コンパクトな旅タグとして表示する。 */
export function SnsPostPlaceTag({ post }: { post: SnsTextPostRow }) {
  if (!post.linked_visit_id || !post.linked_spot_name) return null;

  return (
    <div className="sns-post-place-tag">
      <span className="sns-post-place-pin" aria-hidden="true">
        <IconMapPin size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-black text-ink">{post.linked_spot_name}</span>
        {post.linked_trip_title ? (
          <span className="mt-px block truncate text-[10px] font-semibold text-ink-soft">
            {post.linked_trip_title}
          </span>
        ) : null}
      </span>
      {post.linked_visited_at ? (
        <span className="sns-post-place-date">
          <IconCalendar size={12} />
          {formatLinkedDate(post.linked_visited_at)}
        </span>
      ) : null}
    </div>
  );
}
