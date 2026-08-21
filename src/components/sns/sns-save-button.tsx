"use client";

import { useEffect, useState, useTransition } from "react";
import { setFriendTextPostSavedAction } from "@/app/actions/sns";
import { IconBookmark } from "@/components/icons";

export function SnsSaveButton({ postId, saved }: { postId: string; saved: boolean }) {
  const [optimistic, setOptimistic] = useState(saved);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => setOptimistic(saved), [saved]);

  function toggle() {
    if (pending) return;
    const next = !optimistic;
    setOptimistic(next);
    setError("");
    if (next && "vibrate" in navigator) navigator.vibrate?.(8);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("postId", postId);
      formData.set("saved", next ? "1" : "0");
      const result = await setFriendTextPostSavedAction(formData);
      if (!result.ok) {
        setOptimistic(!next);
        setError(result.error);
      }
    });
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-label={optimistic ? "保存を解除" : "投稿を保存"}
        aria-pressed={optimistic}
        className={`sns-save-button pressable ${optimistic ? "is-saved" : ""}`}
      >
        <IconBookmark size={16} filled={optimistic} />
        <span>{optimistic ? "保存済み" : "保存"}</span>
      </button>
      {error ? <span className="sns-action-error" role="status">{error}</span> : null}
    </span>
  );
}
