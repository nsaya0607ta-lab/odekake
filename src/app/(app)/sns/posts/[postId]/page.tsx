import { notFound } from "next/navigation";
import Link from "next/link";
import { deleteFriendTextPostReplyAction } from "@/app/actions/sns";
import { IconClose, IconUser } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { LikeButton } from "@/components/sns/like-button";
import { PostOptionsMenu } from "@/components/sns/post-options-menu";
import { signThumbOrOriginalPaths } from "@/lib/data/photos";
import { getFriendTextPostReplies, getPersonalTextPost } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";
import { ReplyForm } from "./reply-form";

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

  const replies = await getFriendTextPostReplies(supabase, postId);
  const [avatarUrls, postAvatarUrl] = await Promise.all([
    signThumbOrOriginalPaths(
      supabase,
      replies.flatMap((r) => (r.profile_image_url ? [r.profile_image_url] : [])),
    ),
    post.profile_image_url
      ? signThumbOrOriginalPaths(supabase, [post.profile_image_url]).then((m) => m.get(post.profile_image_url!))
      : Promise.resolve(undefined),
  ]);

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
          <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-normal">{post.body}</p>
          <div className="mt-2.5">
            <LikeButton postId={post.id} authorUserId={post.user_id} liked={post.my_liked} count={post.like_count} />
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="px-1 text-sm font-bold text-ink-soft">返信（{replies.length}）</h2>
          <ReplyForm postId={post.id} />
          {replies.length === 0 ? (
            <p className="px-1 text-xs text-ink-faint">まだ返信はありません。</p>
          ) : (
            <ul className="space-y-3">
              {replies.map((reply) => {
                const replyAvatar = reply.profile_image_url ? avatarUrls.get(reply.profile_image_url) : null;
                const canDelete = reply.user_id === user.id;
                return (
                  <li key={reply.id} className="flex items-start gap-2 px-1">
                    <Link
                      href={`/sns/users/${reply.user_id}`}
                      className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-paper-deep"
                    >
                      {replyAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={replyAvatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-ink-faint">
                          <IconUser size={16} />
                        </span>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1 rounded-2xl bg-paper-deep px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/sns/users/${reply.user_id}`} className="truncate text-xs font-bold">
                          {reply.display_name}
                        </Link>
                        <span className="shrink-0 text-[10px] text-ink-faint">{formatDateTime(reply.created_at)}</span>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">{reply.body}</p>
                    </div>
                    {canDelete ? (
                      <form action={deleteFriendTextPostReplyAction} className="shrink-0">
                        <input type="hidden" name="replyId" value={reply.id} />
                        <input type="hidden" name="postId" value={post.id} />
                        <button
                          type="submit"
                          aria-label="この返信を削除"
                          className="flex h-7 w-7 items-center justify-center rounded-full text-ink-faint active:bg-paper-deep"
                        >
                          <IconClose size={14} />
                        </button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </PageBody>
    </>
  );
}
