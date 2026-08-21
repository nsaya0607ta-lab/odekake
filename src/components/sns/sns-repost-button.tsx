"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { setFriendTextPostRepostAction } from "@/app/actions/sns";
import { IconChat, IconRepost } from "@/components/icons";

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
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => setOptimistic({ reposted, count }), [reposted, count]);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function toggleRepost() {
    if (pending) return;
    const next = !optimistic.reposted;
    const previous = optimistic;
    setOptimistic({ reposted: next, count: Math.max(0, optimistic.count + (next ? 1 : -1)) });
    setOpen(false);
    setError("");
    if (next && "vibrate" in navigator) navigator.vibrate?.([7, 25, 7]);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("postId", postId);
      formData.set("reposted", next ? "1" : "0");
      const result = await setFriendTextPostRepostAction(formData);
      if (!result.ok) {
        setOptimistic(previous);
        setError(result.error);
      }
    });
  }

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
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
      {open ? (
        <span className="sns-repost-popover">
          <button type="button" onClick={toggleRepost} className="pressable">
            <IconRepost size={17} />
            {optimistic.reposted ? "リポストを取り消す" : "そのままリポスト"}
          </button>
          <Link href={`/sns/home/new?quote=${postId}`} className="pressable" onClick={() => setOpen(false)}>
            <IconChat size={17} />
            コメントを付けて引用
          </Link>
        </span>
      ) : null}
      {error ? <span className="sns-action-error" role="status">{error}</span> : null}
    </span>
  );
}
