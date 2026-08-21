import { notFound } from "next/navigation";
import Link from "next/link";
import { getPostRepliesAction } from "@/app/actions/sns";
import { IconUser } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { LikeButton } from "@/components/sns/like-button";
import { PostOptionsMenu } from "@/components/sns/post-options-menu";
import { SnsPostPhotoGrid } from "@/components/sns/sns-post-photo-grid";
import { SnsReplyThread } from "@/components/sns/sns-reply-thread";
import { signPhotoPaths, signThumbOrOriginalPaths } from "@/lib/data/photos";
import { getPersonalTextPost } from "@/lib/data/sns";
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

  const [replies, postAvatarUrl, postPhotoUrlMap, postFullPhotoUrlMap] = await Promise.all([
    getPostRepliesAction(postId),
    post.profile_image_url
      ? signThumbOrOriginalPaths(supabase, [post.profile_image_url]).then((m) => m.get(post.profile_image_url!))
      : Promise.resolve(undefined),
    signThumbOrOriginalPaths(supabase, post.photo_paths),
    signPhotoPaths(supabase, post.photo_paths),
  ]);
  const postPhotoUrls = post.photo_paths.flatMap((path) => {
    const url = postPhotoUrlMap.get(path);
    return url ? [url] : [];
  });
  const postFullPhotoUrls = post.photo_paths.flatMap((path) => {
    const url = postFullPhotoUrlMap.get(path);
    return url ? [url] : [];
  });

  const isOwner = post.user_id === user.id;

  return (
    <>
      <PageHeader title="つぶやき" backHref="/sns/home" action={isOwner ? <PostOptionsMenu postId={post.id} /> : null} />
      <PageBody>
        <div className="rough-card p-3.5">
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
            <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-normal">{post.body}</p>
          ) : null}
          <SnsPostPhotoGrid photoUrls={postPhotoUrls} fullUrls={postFullPhotoUrls} />
          <div className="mt-2.5">
            <LikeButton postId={post.id} authorUserId={post.user_id} liked={post.my_liked} count={post.like_count} />
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="px-1 text-sm font-bold text-ink-soft">返信（{replies.length}）</h2>
          <SnsReplyThread postId={post.id} currentUserId={user.id} initialReplies={replies} />
        </section>
      </PageBody>
    </>
  );
}
