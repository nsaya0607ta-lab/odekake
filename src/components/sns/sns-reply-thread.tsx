"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  addFriendTextPostReplyAction,
  deleteFriendTextPostReplyAction,
  getPostRepliesAction,
} from "@/app/actions/sns";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";
import { FormDraft } from "@/components/form-draft";
import { IconChat, IconTrash, IconUser } from "@/components/icons";
import { formatRelativeTimeJa } from "@/lib/date";
import { SnsReplyLikeButton } from "@/components/sns/sns-reply-like-button";
import { SnsRichText } from "@/components/sns/sns-rich-text";
import type { SnsMentionRow } from "@/lib/supabase/types";

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
  mentions: SnsMentionRow[];
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
  const [showComposer, setShowComposer] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [refreshError, setRefreshError] = useState("");
  const [isRefreshing, startTransition] = useTransition();

  function refresh() {
    setRefreshError("");
    startTransition(async () => {
      try {
        const fresh = await getPostRepliesAction(postId);
        setReplies(fresh);
      } catch {
        setRefreshError("返信を更新できませんでした。もう一度お試しください。");
      }
    });
  }

  const topLevel = replies.filter((r) => !r.parentReplyId);
  const childrenOf = (id: string) => replies.filter((r) => r.parentReplyId === id);

  // 返信への返信は何段でもできるが、見た目のインデントは1段のまま。
  // ある返信にぶら下がる子孫すべてを、返信順（深さ優先）でフラットに並べる
  function collectDescendants(rootId: string): SnsEnrichedReply[] {
    const result: SnsEnrichedReply[] = [];
    function walk(id: string) {
      for (const child of childrenOf(id)) {
        result.push(child);
        walk(child.id);
      }
    }
    walk(rootId);
    return result;
  }

  return (
    <div className="sns-reply-thread space-y-3" aria-busy={isRefreshing}>
      {isRefreshing ? <span className="sns-reply-refresh-line" aria-hidden="true" /> : null}
      {refreshError ? (
        <div className="sns-reply-load-error is-compact" role="alert">
          <p>{refreshError}</p>
          <button type="button" onClick={refresh} disabled={isRefreshing} className="pressable">再読み込み</button>
        </div>
      ) : null}
      {showComposer ? (
        <InlineComposer
          postId={postId}
          parentReplyId={null}
          placeholder="返信する"
          onPosted={() => {
            refresh();
            setShowComposer(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowComposer(true)}
          className="sns-reply-composer-trigger pressable"
          data-haptic="light"
        >
          <span className="sns-reply-composer-icon" aria-hidden="true"><IconChat size={17} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black text-ink-soft">返信する</span>
            <span className="block truncate text-[10px] text-ink-faint">旅の余韻をひとこと残そう</span>
          </span>
          <span className="sns-reply-composer-arrow" aria-hidden="true">→</span>
        </button>
      )}
      {topLevel.length === 0 ? (
        <p className="px-1 text-xs text-ink-faint">まだ返信はありません。</p>
      ) : (
        <ul className="sns-reply-list">
          {topLevel.map((reply) => {
            const descendants = collectDescendants(reply.id);
            const expanded = expandedThreads.has(reply.id);
            return (
              <li key={reply.id} className="sns-reply-list-item">
                <ReplyRow
                  reply={reply}
                  postId={postId}
                  currentUserId={currentUserId}
                  onDeleted={refresh}
                  onReplyToggle={() => setReplyingTo((cur) => (cur === reply.id ? null : reply.id))}
                />
                {replyingTo === reply.id ? (
                  <div className="sns-nested-composer">
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
                {descendants.length > 0 ? (
                  expanded ? (
                    <ul className="sns-reply-descendants">
                      {descendants.map((descendant) => (
                        <li key={descendant.id}>
                          <ReplyRow
                            reply={descendant}
                            postId={postId}
                            currentUserId={currentUserId}
                            onDeleted={refresh}
                            onReplyToggle={() => setReplyingTo((cur) => (cur === descendant.id ? null : descendant.id))}
                            compact
                          />
                          {replyingTo === descendant.id ? (
                            <div className="sns-nested-composer is-deep">
                              <InlineComposer
                                postId={postId}
                                parentReplyId={descendant.id}
                                placeholder={`${descendant.displayName}さんに返信`}
                                onPosted={() => {
                                  refresh();
                                  setReplyingTo(null);
                                }}
                              />
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedThreads((cur) => {
                          const next = new Set(cur);
                          next.add(reply.id);
                          return next;
                        })
                      }
                      className="sns-show-more-replies pressable"
                      aria-expanded={false}
                    >
                      他{descendants.length}件の返信を見る
                    </button>
                  )
                ) : null}
              </li>
            );
          })}
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
  const formId = `sns-reply-${postId}-${parentReplyId ?? "root"}`;

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
    <form id={formId} ref={formRef} action={action} className="sns-inline-composer space-y-2">
      <FormDraft formId={formId} storageKey={formId} />
      <input type="hidden" name="postId" value={postId} />
      {parentReplyId ? <input type="hidden" name="parentReplyId" value={parentReplyId} /> : null}
      <textarea
        name="body"
        rows={2}
        maxLength={1000}
        placeholder={placeholder}
        defaultValue={state.values?.body ?? ""}
        className="field sns-inline-composer-field text-sm"
      />
      <FormMessage state={state} />
      <SubmitButton className="sns-inline-submit pressable" pendingLabel="送信中…">
        <IconChat size={15} />
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
  const [isDeleting, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState("");
  const canDelete = reply.userId === currentUserId;

  function handleDelete() {
    if (!window.confirm("この返信を削除しますか？")) return;
    setDeleteError("");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("replyId", reply.id);
      formData.set("postId", postId);
      try {
        const result = await deleteFriendTextPostReplyAction(formData);
        if (!result.ok) {
          setDeleteError(result.error);
          return;
        }
        onDeleted();
      } catch {
        setDeleteError("通信に失敗しました。もう一度お試しください。");
      }
    });
  }

  return (
    <div className={`sns-reply-row ${compact ? "is-compact" : ""}`}>
      <Link
        href={`/sns/users/${reply.userId}`}
        prefetch={false}
        className={`sns-reply-avatar pressable ${compact ? "is-compact" : ""}`}
      >
        {reply.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reply.avatarUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-ink-faint">
            <IconUser size={compact ? 14 : 16} />
          </span>
        )}
      </Link>
      <div className="sns-reply-bubble">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/sns/users/${reply.userId}`} prefetch={false} className="truncate text-xs font-bold">
            {reply.displayName}
          </Link>
          <span className="shrink-0 text-[10px] text-ink-faint">{formatRelativeTimeJa(reply.createdAt)}</span>
        </div>
        <SnsRichText body={reply.body} mentions={reply.mentions} className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed" />
        <div className="mt-1 flex items-center gap-3">
          <SnsReplyLikeButton replyId={reply.id} postId={postId} liked={reply.myLiked} count={reply.likeCount} />
          {onReplyToggle ? (
            <button type="button" onClick={onReplyToggle} className="sns-reply-action pressable" data-haptic="light">
              返信
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              aria-label="この返信を削除"
              className="pressable ml-auto flex h-11 w-11 items-center justify-center rounded-full text-ink-faint active:bg-paper"
            >
              <IconTrash size={14} />
            </button>
          ) : null}
        </div>
        {deleteError ? <p className="mt-1 text-[11px] font-bold text-blossom" role="alert">{deleteError}</p> : null}
      </div>
    </div>
  );
}
