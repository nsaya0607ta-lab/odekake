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
}: {
  postId: string;
  currentUserId: string;
  replyCount: number;
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
        className="flex items-center gap-1.5 rounded-full px-1.5 py-1 text-ink-faint active:bg-paper-deep"
      >
        <IconChat size={16} />
        {replyCount > 0 ? <span className="text-xs">{replyCount}</span> : null}
      </button>
      {open ? (
        <div className="mt-1 w-full basis-full border-t border-line pt-3">
          {replies === null ? (
            <p className="px-1 text-xs text-ink-faint">{isPending ? "読み込み中…" : ""}</p>
          ) : (
            <SnsReplyThread postId={postId} currentUserId={currentUserId} initialReplies={replies} />
          )}
        </div>
      ) : null}
    </div>
  );
}
