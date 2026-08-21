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
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  // サーバーから最新の値が届いたら（再検証後の再描画など）ローカルの見た目もそれに合わせる
  useEffect(() => {
    setOptimistic({ liked, count });
  }, [liked, count]);

  function toggle() {
    if (pending) return;
    const previous = optimistic;
    const next = { liked: !optimistic.liked, count: optimistic.count + (optimistic.liked ? -1 : 1) };
    setOptimistic(next);
    setError("");
    if (next.liked && typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(10);
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("postId", postId);
      formData.set("authorUserId", authorUserId);
      formData.set("liked", next.liked ? "1" : "0");
      const result = await setFriendTextPostLikeAction(formData);
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
        className={`sns-like-button pressable flex min-h-11 items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors active:bg-paper-deep ${
          optimistic.liked ? "bg-blossom-soft text-blossom" : "text-ink-faint"
        }`}
      >
        <IconHeart size={16} filled={optimistic.liked} />
        {showLabel ? <span className="text-[11px] font-bold">いいね</span> : null}
        {optimistic.count > 0 ? <span className="text-xs">{optimistic.count}</span> : null}
      </button>
      {error ? <span className="sns-menu-toast" role="status">{error}</span> : null}
    </span>
  );
}
