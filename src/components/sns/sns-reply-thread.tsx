"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  addFriendTextPostReplyAction,
  deleteFriendTextPostReplyAction,
  getPostRepliesAction,
} from "@/app/actions/sns";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";
import { IconClose, IconUser } from "@/components/icons";
import { formatRelativeTimeJa } from "@/lib/date";
import { SnsReplyLikeButton } from "@/components/sns/sns-reply-like-button";

export type SnsEnrichedReply = {
  id: string;
  parentReplyId: string | null;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  body: string;
  createdAt: string;
  likeCount: number;
  myLiked: boolean;
};

/** 投稿へのコメント欄。返信・いいね・返信への返信（ネスト1段）に対応する。
 * ホーム/ユーザー画面のカードを開いたときと、投稿詳細画面の両方で使う共通部品 */
export function SnsReplyThread({
  postId,
  currentUserId,
  initialReplies,
}: {
  postId: string;
  currentUserId: string;
  initialReplies: SnsEnrichedReply[];
}) {
  const [replies, setReplies] = useState(initialReplies);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const fresh = await getPostRepliesAction(postId);
      setReplies(fresh);
    });
  }

  const topLevel = replies.filter((r) => !r.parentReplyId);
  const childrenOf = (id: string) => replies.filter((r) => r.parentReplyId === id);

  return (
    <div className="space-y-3">
      <InlineComposer postId={postId} parentReplyId={null} onPosted={refresh} placeholder="返信する" />
      {topLevel.length === 0 ? (
        <p className="px-1 text-xs text-ink-faint">まだ返信はありません。</p>
      ) : (
        <ul className="space-y-3">
          {topLevel.map((reply) => (
            <li key={reply.id}>
              <ReplyRow
                reply={reply}
                postId={postId}
                currentUserId={currentUserId}
                onDeleted={refresh}
                onReplyToggle={() => setReplyingTo((cur) => (cur === reply.id ? null : reply.id))}
              />
              {replyingTo === reply.id ? (
                <div className="mt-2 ml-10">
                  <InlineComposer
                    postId={postId}
                    parentReplyId={reply.id}
                    placeholder={`${reply.displayName}さんに返信`}
                    onPosted={() => {
                      refresh();
                      setReplyingTo(null);
                    }}
                  />
                </div>
              ) : null}
              {childrenOf(reply.id).length > 0 ? (
                <ul className="mt-2 ml-8 space-y-2 border-l border-line pl-3">
                  {childrenOf(reply.id).map((child) => (
                    <li key={child.id}>
                      <ReplyRow reply={child} postId={postId} currentUserId={currentUserId} onDeleted={refresh} compact />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InlineComposer({
  postId,
  parentReplyId,
  placeholder,
  onPosted,
}: {
  postId: string;
  parentReplyId: string | null;
  placeholder: string;
  onPosted: () => void;
}) {
  const [state, action] = useActionState(addFriendTextPostReplyAction, emptyActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const postedRef = useRef(false);

  useEffect(() => {
    if (state.ok && !postedRef.current) {
      postedRef.current = true;
      formRef.current?.reset();
      onPosted();
    }
    if (!state.ok) postedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <input type="hidden" name="postId" value={postId} />
      {parentReplyId ? <input type="hidden" name="parentReplyId" value={parentReplyId} /> : null}
      <textarea
        name="body"
        rows={2}
        maxLength={1000}
        placeholder={placeholder}
        defaultValue={state.values?.body ?? ""}
        className="field text-sm"
      />
      <FormMessage state={state} />
      <SubmitButton className="btn btn-quiet w-full text-sm" pendingLabel="送信中…">
        返信する
      </SubmitButton>
    </form>
  );
}

function ReplyRow({
  reply,
  postId,
  currentUserId,
  onDeleted,
  onReplyToggle,
  compact = false,
}: {
  reply: SnsEnrichedReply;
  postId: string;
  currentUserId: string;
  onDeleted: () => void;
  onReplyToggle?: () => void;
  compact?: boolean;
}) {
  const [, startTransition] = useTransition();
  const canDelete = reply.userId === currentUserId;

  function handleDelete() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("replyId", reply.id);
      formData.set("postId", postId);
      await deleteFriendTextPostReplyAction(formData);
      onDeleted();
    });
  }

  return (
    <div className="flex items-start gap-2">
      <Link
        href={`/sns/users/${reply.userId}`}
        className={`shrink-0 overflow-hidden rounded-full bg-paper-deep ${compact ? "h-7 w-7" : "h-8 w-8"}`}
      >
        {reply.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reply.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-ink-faint">
            <IconUser size={compact ? 14 : 16} />
          </span>
        )}
      </Link>
      <div className="min-w-0 flex-1 rounded-2xl bg-paper-deep px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/sns/users/${reply.userId}`} className="truncate text-xs font-bold">
            {reply.displayName}
          </Link>
          <span className="shrink-0 text-[10px] text-ink-faint">{formatRelativeTimeJa(reply.createdAt)}</span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">{reply.body}</p>
        <div className="mt-1 flex items-center gap-3">
          <SnsReplyLikeButton replyId={reply.id} postId={postId} liked={reply.myLiked} count={reply.likeCount} />
          {!compact && onReplyToggle ? (
            <button type="button" onClick={onReplyToggle} className="text-[11px] text-ink-faint">
              返信
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              onClick={handleDelete}
              aria-label="この返信を削除"
              className="ml-auto flex h-6 w-6 items-center justify-center rounded-full text-ink-faint active:bg-paper"
            >
              <IconClose size={12} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
