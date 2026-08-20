import Link from "next/link";
import { IconChat, IconHeart, IconUser } from "@/components/icons";
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
    <ul className="-mx-4 divide-y divide-line">
      {posts.map((post) => {
        const avatarUrl = post.profile_image_url ? avatarUrls.get(post.profile_image_url) : null;
        const isMine = post.user_id === currentUserId;

        return (
          <li key={post.id} className="flex gap-3 px-4 py-3">
            <Link
              href={`/sns/users/${post.user_id}`}
              aria-label={`${post.display_name}のホーム`}
              className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-paper-deep"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-ink-faint">
                  <IconUser size={22} />
                </span>
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <Link href={`/sns/users/${post.user_id}`} className="truncate text-[15px] font-bold">
                  {post.display_name}
                </Link>
                <span className="shrink-0 text-[13px] text-ink-faint">
                  ・{formatRelativeTimeJa(post.created_at)}
                </span>
                {isMine ? (
                  <span className="ml-auto shrink-0">
                    <DeletePostButton postId={post.id} />
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-normal">{post.body}</p>
              <div className="mt-2.5 flex max-w-[220px] items-center justify-between text-ink-faint">
                <span className="flex items-center gap-1.5">
                  <IconChat size={16} />
                </span>
                <span className="flex items-center gap-1.5">
                  <IconHeart size={16} />
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
