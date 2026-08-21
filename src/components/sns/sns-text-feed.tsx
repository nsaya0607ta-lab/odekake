import Link from "next/link";
import { IconMapPin, IconPin, IconRepost, IconUser } from "@/components/icons";
import { formatRelativeTimeJa } from "@/lib/date";
import type { SnsTextPostRow } from "@/lib/supabase/types";
import { LikeButton } from "@/components/sns/like-button";
import { PostOptionsMenu } from "@/components/sns/post-options-menu";
import { SnsCommentToggle } from "@/components/sns/sns-comment-toggle";
import { SnsPostPhotoGrid } from "@/components/sns/sns-post-photo-grid";
import { SnsPostPlaceTag } from "@/components/sns/sns-post-place-tag";
import { SnsRepostButton } from "@/components/sns/sns-repost-button";
import { SnsRichText } from "@/components/sns/sns-rich-text";
import { SnsSaveButton } from "@/components/sns/sns-save-button";

/** Twitterのタイムラインのような、テキスト＋写真の個人投稿一覧 */
export function SnsTextFeed({
  posts,
  avatarUrls,
  photoUrls,
  currentUserId,
  emptyTitle = "まだつぶやきがありません",
  emptyMessage = "最初のおでかけメモを残してみましょう。",
}: {
  posts: SnsTextPostRow[];
  avatarUrls: Map<string, string>;
  photoUrls: Map<string, string>;
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
        const postPhotoPaths = post.photo_paths.filter((path) => photoUrls.has(path));
        const postPhotoUrls = postPhotoPaths.flatMap((path) => {
          const url = photoUrls.get(path);
          return url ? [url] : [];
        });
        const quotedPhotoPaths = post.quoted_photo_paths.filter((path) => photoUrls.has(path));
        const quotedPhotoUrls = quotedPhotoPaths.flatMap((path) => {
          const url = photoUrls.get(path);
          return url ? [url] : [];
        });
        const quotedAvatarUrl = post.quoted_profile_image_url
          ? avatarUrls.get(post.quoted_profile_image_url)
          : null;
        const isPlainRepost = Boolean(
          post.repost_of_post_id && !post.body && post.photo_paths.length === 0 && !post.linked_visit_id,
        );

        return (
          <li key={post.id} className="sns-post-card flex gap-3 p-3.5">
            <span className="sns-post-tape" aria-hidden="true" />
            {post.is_pinned ? (
              <span className="sns-post-pinned-label">
                <IconPin size={12} filled />
                固定
              </span>
            ) : null}
            <Link
              href={`/sns/users/${post.user_id}`}
              prefetch={false}
              aria-label={`${post.display_name}のホーム`}
              className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-card shadow-sm ring-[3px] ring-card outline outline-1 outline-line"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-leaf-soft text-leaf-deep">
                  <IconUser size={22} />
                </span>
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 pr-7">
                <Link href={`/sns/users/${post.user_id}`} prefetch={false} className="truncate text-[15px] font-bold text-ink">
                  {post.display_name}
                </Link>
                <span className="shrink-0 rounded-full bg-paper-deep px-2 py-0.5 text-[10px] font-semibold text-ink-faint">
                  {formatRelativeTimeJa(post.created_at)}
                </span>
                <span className="absolute top-2.5 right-2.5 shrink-0">
                  <PostOptionsMenu
                    postId={post.id}
                    authorUserId={post.user_id}
                    isMine={isMine}
                    pinned={post.is_pinned}
                  />
                </span>
              </div>
              {isPlainRepost ? (
                <span className="sns-reposted-by"><IconRepost size={12} />リポストしました</span>
              ) : null}
              {post.body ? (
                <SnsRichText
                  body={post.body}
                  mentions={post.mentions}
                  className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink"
                />
              ) : null}
              {postPhotoUrls.length > 0 ? (
                <SnsPostPhotoGrid
                  photoUrls={postPhotoUrls}
                  photoPaths={postPhotoPaths}
                  postId={post.id}
                  authorUserId={post.user_id}
                  liked={post.my_liked}
                />
              ) : null}
              <SnsPostPlaceTag post={post} />
              {post.repost_of_post_id && post.quoted_user_id ? (
                <Link href={`/sns/posts/${post.repost_of_post_id}`} prefetch={false} className="sns-quoted-post pressable">
                  <span className="flex items-center gap-2">
                    <span className="sns-quoted-avatar">
                      {quotedAvatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={quotedAvatarUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <IconUser size={15} />
                      )}
                    </span>
                    <span className="min-w-0 truncate text-xs font-black">{post.quoted_display_name}</span>
                    <span className="ml-auto shrink-0 text-[10px] font-bold text-ink-faint">元の投稿</span>
                  </span>
                  {post.quoted_body ? (
                    <p className="mt-2 line-clamp-4 whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {post.quoted_body}
                    </p>
                  ) : null}
                  {quotedPhotoUrls.length > 0 ? (
                    <SnsPostPhotoGrid
                      photoUrls={quotedPhotoUrls}
                      photoPaths={quotedPhotoPaths}
                      postId={post.repost_of_post_id}
                    />
                  ) : null}
                  {post.quoted_linked_spot_name ? (
                    <span className="sns-quoted-place"><IconMapPin size={12} />{post.quoted_linked_spot_name}</span>
                  ) : null}
                </Link>
              ) : null}
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
                <SnsRepostButton
                  postId={post.id}
                  reposted={post.my_reposted}
                  count={post.repost_count}
                />
                <SnsSaveButton postId={post.id} saved={post.my_saved} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
