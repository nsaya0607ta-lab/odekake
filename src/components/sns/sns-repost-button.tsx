"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { setFriendTextPostRepostAction } from "@/app/actions/sns";
import { IconChat, IconRepost } from "@/components/icons";
import { SnsActionSheet } from "@/components/sns/sns-action-sheet";

export function SnsRepostButton({
  postId,
  reposted,
  count,
}: {
  postId: string;
  reposted: boolean;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const [optimistic, setOptimistic] = useState({ reposted, count });
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOptimistic({ reposted, count }), [reposted, count]);

  function toggleRepost() {
    if (pending) return;
    const next = !optimistic.reposted;
    const previous = optimistic;
    setOptimistic({ reposted: next, count: Math.max(0, optimistic.count + (next ? 1 : -1)) });
    setOpen(false);
    setError("");
    if (next && "vibrate" in navigator) navigator.vibrate?.([7, 25, 7]);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("postId", postId);
        formData.set("reposted", next ? "1" : "0");
        const result = await setFriendTextPostRepostAction(formData);
        if (result.ok) return;
        setOptimistic(previous);
        setError(result.error);
      } catch {
        setOptimistic(previous);
        setError("通信に失敗しました。時間をおいてもう一度お試しください。");
      }
    });
  }

  return (
    <span className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="リポストメニュー"
        aria-expanded={open}
        className={`sns-repost-button pressable ${optimistic.reposted ? "is-reposted" : ""}`}
      >
        <IconRepost size={17} />
        <span>リポスト</span>
        {optimistic.count > 0 ? <span>{optimistic.count}</span> : null}
      </button>
      <SnsActionSheet
        open={open}
        onClose={() => setOpen(false)}
        title="リポスト"
        description="そのまま共有するか、コメントを添えて引用できます"
        returnFocusRef={triggerRef}
      >
        <button type="button" onClick={toggleRepost} className="pressable">
          <IconRepost size={17} />
          {optimistic.reposted ? "リポストを取り消す" : "そのままリポスト"}
        </button>
        <Link href={`/sns/home/new?quote=${postId}`} className="pressable" onClick={() => setOpen(false)}>
          <IconChat size={17} />
          コメントを付けて引用
        </Link>
      </SnsActionSheet>
      {error ? <span className="sns-action-error" role="status">{error}</span> : null}
    </span>
  );
}
