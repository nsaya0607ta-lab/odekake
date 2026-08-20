import Link from "next/link";
import { IconUser } from "@/components/icons";
import { formatRelativeTimeJa } from "@/lib/date";
import type { SnsTextPostRow } from "@/lib/supabase/types";
import { DeletePostButton } from "@/components/sns/delete-post-button";

/** Twitterのタイムラインのような、テキストだけの個人投稿一覧 */
export function SnsTextFeed({
  posts,
  avatarUrls,
  currentUserId,
}: {
  posts: SnsTextPostRow[];
  avatarUrls: Map<string, string>;
  currentUserId: string;
}) {
  if (posts.length === 0) {
    return <p className="px-1 py-10 text-center text-xs text-ink-faint">まだ投稿がありません。</p>;
  }

  return (
    <ul className="divide-y divide-line">
      {posts.map((post) => {
        const avatarUrl = post.profile_image_url ? avatarUrls.get(post.profile_image_url) : null;
        const isMine = post.user_id === currentUserId;

        return (
          <li key={post.id} className="flex gap-3 py-3.5">
            <Link
              href={`/sns/users/${post.user_id}`}
              aria-label={`${post.display_name}のホーム`}
              className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-paper-deep"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-ink-faint">
                  <IconUser size={20} />
                </span>
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <Link href={`/sns/users/${post.user_id}`} className="truncate text-sm font-bold">
                  {post.display_name}
                </Link>
                <span className="shrink-0 text-xs text-ink-faint">{formatRelativeTimeJa(post.created_at)}</span>
                {isMine ? (
                  <span className="ml-auto shrink-0">
                    <DeletePostButton postId={post.id} />
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed">{post.body}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
