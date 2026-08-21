"use client";

import { useState, useTransition } from "react";
import { getPostRepliesAction } from "@/app/actions/sns";
import { IconChat } from "@/components/icons";
import { SnsReplyThread, type SnsEnrichedReply } from "@/components/sns/sns-reply-thread";

/** コメントアイコン。押すと投稿へ遷移せず、その場にコメント欄が開く */
export function SnsCommentToggle({
  postId,
  currentUserId,
  replyCount,
  showLabel = false,
}: {
  postId: string;
  currentUserId: string;
  replyCount: number;
  showLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState<SnsEnrichedReply[] | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    setOpen((v) => !v);
    if (replies === null) {
      startTransition(async () => {
        const data = await getPostRepliesAction(postId);
        setReplies(data);
      });
    }
  }

  return (
    <div className="contents">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label="コメントする"
        className="pressable flex min-h-9 items-center gap-1.5 rounded-full px-2.5 py-1 text-ink-faint active:bg-paper-deep"
        data-haptic="light"
      >
        <IconChat size={16} />
        {showLabel ? <span className="text-[11px] font-bold">返信</span> : null}
        {replyCount > 0 ? <span className="text-xs">{replyCount}</span> : null}
      </button>
      {open ? (
        <div className="sns-inline-thread mt-1 w-full basis-full pt-3">
          {replies === null ? (
            <div className="sns-reply-loading" role="status">
              <span aria-hidden="true" />
              <span aria-hidden="true" />
              <span aria-hidden="true" />
              <span className="sr-only">返信を読み込んでいます</span>
              {isPending ? <span className="text-[10px] font-bold text-ink-faint">会話を読み込み中</span> : null}
            </div>
          ) : (
            <SnsReplyThread postId={postId} currentUserId={currentUserId} initialReplies={replies} />
          )}
        </div>
      ) : null}
    </div>
  );
}
