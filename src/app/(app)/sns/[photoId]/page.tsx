import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteFriendPhotoAction,
  deleteFriendPhotoCommentAction,
  setFriendPhotoReactionAction,
} from "@/app/actions/sns";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { IconClose, IconTrash, IconUser } from "@/components/icons";
import { PageBody } from "@/components/page-body";
import { PageHeader } from "@/components/page-header";
import { SnsBackgroundBand } from "@/components/sns/sns-background-band";
import { SnsIllustratedHero } from "@/components/sns/sns-illustrated-hero";
import { signPhotoPaths, signThumbOrOriginalPaths } from "@/lib/data/photos";
import { getFriendPhotoComments, getSnsPhoto } from "@/lib/data/sns";
import { requireUser } from "@/lib/supabase/server";
import { CommentForm } from "./comment-form";

export const dynamic = "force-dynamic";

const REACTION_EMOJIS = ["😊", "😂", "😍", "😮", "👍", "🎉"];

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(iso));
}

export default async function SnsPhotoPage({
  params,
  searchParams,
}: {
  params: Promise<{ photoId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ photoId }, sp, { supabase, user }] = await Promise.all([params, searchParams, requireUser()]);

  // 取得RPCは自分視点の閲覧範囲（フレンド or 所属グループ）で絞られているので、
  // ここで見つからなければ非公開扱い
  const photo = await getSnsPhoto(supabase, photoId);
  if (!photo) notFound();

  const backHref = photo.group_id ? `/sns/groups/${photo.group_id}` : "/sns";

  const [comments, photoUrlMap, avatarUrlMap] = await Promise.all([
    getFriendPhotoComments(supabase, photoId),
    signPhotoPaths(supabase, [photo.storage_path]),
    photo.profile_image_url
      ? signThumbOrOriginalPaths(supabase, [photo.profile_image_url])
      : Promise.resolve(new Map<string, string>()),
  ]);
  const commenterAvatarUrls = await signThumbOrOriginalPaths(
    supabase,
    comments.flatMap((c) => (c.profile_image_url ? [c.profile_image_url] : [])),
  );
  // 一覧の写真は原寸で見せる（サムネイルはグリッド専用）
  const photoUrl = photoUrlMap.get(photo.storage_path);
  const avatarUrl = photo.profile_image_url ? avatarUrlMap.get(photo.profile_image_url) : null;

  const isOwner = photo.user_id === user.id;

  return (
    <>
      <PageHeader
        title={photo.display_name}
        subtitle={photo.group_name ?? undefined}
        backHref={backHref}
        action={
          isOwner ? (
            <form action={deleteFriendPhotoAction}>
              <input type="hidden" name="photoId" value={photo.id} />
              <ConfirmSubmitButton
                className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft active:bg-paper-deep"
                pendingLabel=""
                message="この写真を削除しますか？"
              >
                <IconTrash size={19} />
              </ConfirmSubmitButton>
            </form>
          ) : null
        }
      />
      <SnsBackgroundBand hasToggleBar={false} />
      <PageBody className="sns-page-shell sns-subpage-body space-y-4">
        {sp.error === "delete" ? (
          <p role="alert" className="rounded-2xl border border-blossom bg-blossom-soft px-4 py-3 text-sm text-[#8f4c59]">
            削除できませんでした。
          </p>
        ) : null}

        <div className="sns-photo-author-strip">
          <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-paper-deep">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-ink-faint">
                <IconUser size={18} />
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{photo.display_name}</span>
            <span className="block text-[11px] text-ink-faint">{formatDateTime(photo.created_at)}</span>
          </span>
        </div>

        <div className="sns-photo-detail-stage">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="w-full object-cover" />
          ) : (
            <div className="aspect-square" />
          )}
        </div>

        {photo.caption ? <p className="sns-photo-detail-caption">{photo.caption}</p> : null}

        <section className="sns-reaction-tray" aria-label="写真へのリアクション">
          <span className="w-full text-[10px] font-black tracking-[0.12em] text-ink-faint">QUICK REACTION</span>
          {REACTION_EMOJIS.map((emoji) => {
            const selected = photo.my_reaction === emoji;
            return (
              <form key={emoji} action={setFriendPhotoReactionAction}>
                <input type="hidden" name="photoId" value={photo.id} />
                <input type="hidden" name="emoji" value={selected ? "" : emoji} />
                <button
                  type="submit"
                  className={`sns-reaction-button pressable ${
                    selected ? "is-selected" : ""
                  }`}
                  aria-pressed={selected}
                  aria-label={`${emoji}でリアクション`}
                >
                  {emoji}
                </button>
              </form>
            );
          })}
          {photo.reaction_count > 0 ? (
            <span className="flex items-center px-2 text-xs font-semibold text-ink-faint">
              {photo.reaction_count}件のリアクション
            </span>
          ) : null}
        </section>

        <section className="sns-photo-comments-panel space-y-3">
          <SnsIllustratedHero
            eyebrow="PHOTO TALK"
            title="この一枚を囲んで"
            description={`${comments.length}件のコメント。感じたことを気軽に残そう。`}
            artSrc="/illustrations/sns/conversation-v2.webp"
            tone="photo"
          />
          <CommentForm photoId={photo.id} />
          {comments.length === 0 ? (
            <p className="px-1 text-xs text-ink-faint">まだコメントはありません。</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((comment) => {
                const commentAvatar = comment.profile_image_url
                  ? commenterAvatarUrls.get(comment.profile_image_url)
                  : null;
                const canDelete = comment.user_id === user.id;
                return (
                  <li key={comment.id} className="flex items-start gap-2 px-1">
                    <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-paper-deep">
                      {commentAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={commentAvatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-ink-faint">
                          <IconUser size={16} />
                        </span>
                      )}
                    </span>
                    <div className="sns-photo-comment-bubble">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-bold">{comment.display_name}</span>
                        <span className="shrink-0 text-[10px] text-ink-faint">{formatDateTime(comment.created_at)}</span>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">{comment.body}</p>
                    </div>
                    {canDelete ? (
                      <form action={deleteFriendPhotoCommentAction} className="shrink-0">
                        <input type="hidden" name="commentId" value={comment.id} />
                        <input type="hidden" name="photoId" value={photo.id} />
                        <button
                          type="submit"
                          aria-label="このコメントを削除"
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

        <Link href={backHref} className="sns-back-to-list pressable">
          一覧へ戻る
        </Link>
      </PageBody>
    </>
  );
}
