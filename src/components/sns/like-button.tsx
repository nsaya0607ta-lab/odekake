"use client";

import { useEffect, useState, useTransition } from "react";
import { setFriendTextPostLikeAction } from "@/app/actions/sns";
import { IconHeart } from "@/components/icons";

export function LikeButton({
  postId,
  authorUserId,
  liked,
  count,
  showLabel = false,
}: {
  postId: string;
  authorUserId: string;
  liked: boolean;
  count: number;
  showLabel?: boolean;
}) {
  const [optimistic, setOptimistic] = useState({ liked, count });
  const [, startTransition] = useTransition();

  // サーバーから最新の値が届いたら（再検証後の再描画など）ローカルの見た目もそれに合わせる
  useEffect(() => {
    setOptimistic({ liked, count });
  }, [liked, count]);

  function toggle() {
    const next = { liked: !optimistic.liked, count: optimistic.count + (optimistic.liked ? -1 : 1) };
    setOptimistic(next);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("postId", postId);
      formData.set("authorUserId", authorUserId);
      formData.set("liked", next.liked ? "1" : "0");
      await setFriendTextPostLikeAction(formData);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={optimistic.liked ? "いいねを取り消す" : "いいねする"}
      aria-pressed={optimistic.liked}
      className={`flex min-h-9 items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors active:bg-paper-deep ${
        optimistic.liked ? "bg-blossom-soft text-blossom" : "text-ink-faint"
      }`}
    >
      <IconHeart size={16} filled={optimistic.liked} />
      {showLabel ? <span className="text-[11px] font-bold">いいね</span> : null}
      {optimistic.count > 0 ? <span className="text-xs">{optimistic.count}</span> : null}
    </button>
  );
}
