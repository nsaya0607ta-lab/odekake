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
  const [, startTransition] = useTransition();

  useEffect(() => {
    setOptimistic({ liked, count });
  }, [liked, count]);

  function toggle() {
    const next = { liked: !optimistic.liked, count: optimistic.count + (optimistic.liked ? -1 : 1) };
    setOptimistic(next);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("replyId", replyId);
      formData.set("postId", postId);
      formData.set("liked", next.liked ? "1" : "0");
      await setFriendTextPostReplyLikeAction(formData);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={optimistic.liked ? "いいねを取り消す" : "いいねする"}
      aria-pressed={optimistic.liked}
      className={`flex items-center gap-1 rounded-full px-1 py-0.5 text-[11px] transition-colors active:bg-paper ${
        optimistic.liked ? "text-blossom" : "text-ink-faint"
      }`}
    >
      <IconHeart size={12} filled={optimistic.liked} />
      {optimistic.count > 0 ? optimistic.count : null}
    </button>
  );
}
