import Link from "next/link";
import { IconUser } from "@/components/icons";
import { formatRelativeTimeJa } from "@/lib/date";
import type { SnsTextPostRow } from "@/lib/supabase/types";
import { LikeButton } from "@/components/sns/like-button";
import { PostOptionsMenu } from "@/components/sns/post-options-menu";
import { SnsCommentToggle } from "@/components/sns/sns-comment-toggle";
import { SnsPostPhotoGrid } from "@/components/sns/sns-post-photo-grid";
import { SnsPostPlaceTag } from "@/components/sns/sns-post-place-tag";

/** Twitterのタイムラインのような、テキスト＋写真の個人投稿一覧 */
export function SnsTextFeed({
  posts,
  avatarUrls,
  photoUrls,
  fullPhotoUrls,
  currentUserId,
  emptyTitle = "まだつぶやきがありません",
  emptyMessage = "最初のおでかけメモを残してみましょう。",
}: {
  posts: SnsTextPostRow[];
  avatarUrls: Map<string, string>;
  photoUrls: Map<string, string>;
  fullPhotoUrls: Map<string, string>;
  currentUserId: string;
  emptyTitle?: string;
  emptyMessage?: string;
}) {
  if (posts.length === 0) {
    return (
      <div className="sns-empty-feed">
        <span className="text-3xl" aria-hidden="true">📝</span>
        <p className="mt-2 text-sm font-bold">{emptyTitle}</p>
        <p className="mt-1 text-xs text-ink-faint">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3.5">
      {posts.map((post) => {
        const avatarUrl = post.profile_image_url ? avatarUrls.get(post.profile_image_url) : null;
        const isMine = post.user_id === currentUserId;
        const postPhotoUrls = post.photo_paths.flatMap((path) => {
          const url = photoUrls.get(path);
          return url ? [url] : [];
        });
        const postFullPhotoUrls = post.photo_paths.flatMap((path) => {
          const url = fullPhotoUrls.get(path);
          return url ? [url] : [];
        });

        return (
          <li key={post.id} className="sns-post-card flex gap-3 p-3.5">
            <span className="sns-post-tape" aria-hidden="true" />
            <Link
              href={`/sns/users/${post.user_id}`}
              aria-label={`${post.display_name}のホーム`}
              className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-card shadow-sm ring-[3px] ring-card outline outline-1 outline-line"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-leaf-soft text-leaf-deep">
                  <IconUser size={22} />
                </span>
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 pr-7">
                <Link href={`/sns/users/${post.user_id}`} className="truncate text-[15px] font-bold text-ink">
                  {post.display_name}
                </Link>
                <span className="shrink-0 rounded-full bg-paper-deep px-2 py-0.5 text-[10px] font-semibold text-ink-faint">
                  {formatRelativeTimeJa(post.created_at)}
                </span>
                {isMine ? (
                  <span className="absolute top-2.5 right-2.5 shrink-0">
                    <PostOptionsMenu postId={post.id} />
                  </span>
                ) : null}
              </div>
              {post.body ? (
                <Link href={`/sns/posts/${post.id}`} className="mt-0.5 block">
                  <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">{post.body}</p>
                </Link>
              ) : null}
              {postPhotoUrls.length > 0 ? (
                <Link href={`/sns/posts/${post.id}`} className="block">
                  <SnsPostPhotoGrid photoUrls={postPhotoUrls} fullUrls={postFullPhotoUrls} />
                </Link>
              ) : null}
              <SnsPostPlaceTag post={post} />
              <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-dashed border-line pt-2">
                <SnsCommentToggle
                  postId={post.id}
                  currentUserId={currentUserId}
                  replyCount={post.reply_count}
                  showLabel
                />
                <LikeButton
                  postId={post.id}
                  authorUserId={post.user_id}
                  liked={post.my_liked}
                  count={post.like_count}
                  showLabel
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
