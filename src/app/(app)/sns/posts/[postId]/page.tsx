import { notFound } from "next/navigation";
import Link from "next/link";
import { getPostRepliesAction } from "@/app/actions/sns";
import { IconMapPin, IconUser } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { LikeButton } from "@/components/sns/like-button";
import { PostOptionsMenu } from "@/components/sns/post-options-menu";
import { SnsBackgroundBand } from "@/components/sns/sns-background-band";
import { SnsIllustratedHero } from "@/components/sns/sns-illustrated-hero";
import { SnsPostPhotoGrid } from "@/components/sns/sns-post-photo-grid";
import { SnsPostPlaceTag } from "@/components/sns/sns-post-place-tag";
import { SnsReplyThread } from "@/components/sns/sns-reply-thread";
import { SnsRepostButton } from "@/components/sns/sns-repost-button";
import { SnsRichText } from "@/components/sns/sns-rich-text";
import { SnsSaveButton } from "@/components/sns/sns-save-button";
import { signThumbOrOriginalPaths } from "@/lib/data/photos";
import { getPersonalTextPost, getSnsTextPostAvatarPaths, getSnsTextPostPhotoPaths } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(iso));
}

export default async function SnsTextPostPage({ params }: { params: Promise<{ postId: string }> }) {
  const [{ postId }, { supabase, user }] = await Promise.all([params, requireUser()]);

  const post = await getPersonalTextPost(supabase, postId);
  if (!post) notFound();

  const allPhotoPaths = getSnsTextPostPhotoPaths([post]);
  const [replies, avatarUrlMap, postPhotoUrlMap] = await Promise.all([
    getPostRepliesAction(postId),
    signThumbOrOriginalPaths(supabase, getSnsTextPostAvatarPaths([post])),
    signThumbOrOriginalPaths(supabase, allPhotoPaths),
  ]);
  const postAvatarUrl = post.profile_image_url ? avatarUrlMap.get(post.profile_image_url) : undefined;
  const postPhotoUrls = post.photo_paths.flatMap((path) => {
    const url = postPhotoUrlMap.get(path);
    return url ? [url] : [];
  });
  const postPhotoPaths = post.photo_paths.filter((path) => postPhotoUrlMap.has(path));
  const quotedPhotoUrls = post.quoted_photo_paths.flatMap((path) => {
    const url = postPhotoUrlMap.get(path);
    return url ? [url] : [];
  });
  const quotedPhotoPaths = post.quoted_photo_paths.filter((path) => postPhotoUrlMap.has(path));
  const quotedAvatarUrl = post.quoted_profile_image_url
    ? avatarUrlMap.get(post.quoted_profile_image_url)
    : undefined;

  const isOwner = post.user_id === user.id;

  return (
    <>
      <PageHeader
        title="つぶやき"
        backHref="/sns/home"
        action={<PostOptionsMenu postId={post.id} authorUserId={post.user_id} isMine={isOwner} pinned={post.is_pinned} />}
      />
      <SnsBackgroundBand hasToggleBar={false} />
      <PageBody className="sns-page-shell sns-subpage-body space-y-4">
        <article className="sns-detail-post-card">
          <span className="sns-detail-post-tape" aria-hidden="true" />
          <p className="sns-detail-post-eyebrow">TRAVEL POSTCARD</p>
          <div className="flex items-center gap-2">
            <Link
              href={`/sns/users/${post.user_id}`}
              className="h-11 w-11 shrink-0 overflow-hidden rounded-full shadow-sm ring-2 ring-card"
            >
              {postAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={postAvatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-leaf-soft text-leaf-deep">
                  <IconUser size={20} />
                </span>
              )}
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/sns/users/${post.user_id}`} className="block truncate text-[15px] font-bold">
                {post.display_name}
              </Link>
              <span className="block text-xs text-ink-faint">{formatDateTime(post.created_at)}</span>
            </div>
          </div>
          {post.body ? (
            <SnsRichText body={post.body} mentions={post.mentions} className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-normal" />
          ) : null}
          <SnsPostPhotoGrid photoUrls={postPhotoUrls} photoPaths={postPhotoPaths} postId={post.id} authorUserId={post.user_id} liked={post.my_liked} />
          <SnsPostPlaceTag post={post} />
          {post.repost_of_post_id && post.quoted_user_id ? (
            <Link href={`/sns/posts/${post.repost_of_post_id}`} className="sns-quoted-post pressable">
              <span className="flex items-center gap-2">
                <span className="sns-quoted-avatar">
                  {quotedAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={quotedAvatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : <IconUser size={15} />}
                </span>
                <span className="min-w-0 truncate text-xs font-black">{post.quoted_display_name}</span>
                <span className="ml-auto shrink-0 text-[10px] font-bold text-ink-faint">元の投稿</span>
              </span>
              {post.quoted_body ? <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{post.quoted_body}</p> : null}
              {quotedPhotoUrls.length > 0 ? (
                <SnsPostPhotoGrid photoUrls={quotedPhotoUrls} photoPaths={quotedPhotoPaths} postId={post.repost_of_post_id} />
              ) : null}
              {post.quoted_linked_spot_name ? <span className="sns-quoted-place"><IconMapPin size={12} />{post.quoted_linked_spot_name}</span> : null}
            </Link>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-dashed border-line pt-2.5">
            <LikeButton postId={post.id} authorUserId={post.user_id} liked={post.my_liked} count={post.like_count} showLabel />
            <SnsRepostButton postId={post.id} reposted={post.my_reposted} count={post.repost_count} />
            <SnsSaveButton postId={post.id} saved={post.my_saved} />
          </div>
        </article>

        <section className="sns-replies-panel space-y-3">
          <SnsIllustratedHero
            eyebrow="KEEP THE STORY GOING"
            title="会話をひろげよう"
            description={`${replies.length}件の返信。旅の余韻や次のおでかけを話そう。`}
            artSrc="/illustrations/sns/conversation-v2.webp"
            tone="conversation"
          />
          <SnsReplyThread postId={post.id} currentUserId={user.id} initialReplies={replies} />
        </section>
      </PageBody>
    </>
  );
}
