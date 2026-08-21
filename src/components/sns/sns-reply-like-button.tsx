"use client";

import { useEffect, useState, useTransition } from "react";
import { setFriendTextPostReplyLikeAction } from "@/app/actions/sns";
import { IconHeart } from "@/components/icons";

export function SnsReplyLikeButton({
  replyId,
  postId,
  liked,
  count,
}: {
  replyId: string;
  postId: string;
  liked: boolean;
  count: number;
}) {
  const [optimistic, setOptimistic] = useState({ liked, count });
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setOptimistic({ liked, count });
  }, [liked, count]);

  function toggle() {
    if (pending) return;
    const previous = optimistic;
    const next = { liked: !optimistic.liked, count: optimistic.count + (optimistic.liked ? -1 : 1) };
    setOptimistic(next);
    setError("");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("replyId", replyId);
      formData.set("postId", postId);
      formData.set("liked", next.liked ? "1" : "0");
      const result = await setFriendTextPostReplyLikeAction(formData);
      if (!result.ok) {
        setOptimistic(previous);
        setError(result.error);
        window.setTimeout(() => setError(""), 2800);
      }
    });
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-label={optimistic.liked ? "いいねを取り消す" : "いいねする"}
        aria-pressed={optimistic.liked}
        className={`flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2 text-[11px] transition-colors active:bg-paper ${
          optimistic.liked ? "text-blossom" : "text-ink-faint"
        }`}
      >
        <IconHeart size={14} filled={optimistic.liked} />
        {optimistic.count > 0 ? optimistic.count : null}
      </button>
      {error ? <span className="sns-menu-toast" role="status">{error}</span> : null}
    </span>
  );
}
