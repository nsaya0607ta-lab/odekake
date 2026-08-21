"use client";

import { useState, useTransition } from "react";
import { setFriendPhotoReactionAction } from "@/app/actions/sns";

export function SnsPhotoReactionTray({
  photoId,
  emojis,
  initialReaction,
  initialCount,
}: {
  photoId: string;
  emojis: string[];
  initialReaction: string | null;
  initialCount: number;
}) {
  const [reaction, setReaction] = useState(initialReaction);
  const [count, setCount] = useState(initialCount);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function react(emoji: string) {
    if (isPending) return;
    const previousReaction = reaction;
    const previousCount = count;
    const nextReaction = reaction === emoji ? null : emoji;
    const nextCount = reaction === null
      ? count + 1
      : nextReaction === null
        ? Math.max(0, count - 1)
        : count;
    setReaction(nextReaction);
    setCount(nextCount);
    setMessage("");
    navigator.vibrate?.(7);

    startTransition(async () => {
      const data = new FormData();
      data.set("photoId", photoId);
      data.set("emoji", nextReaction ?? "");
      try {
        const result = await setFriendPhotoReactionAction(data);
        if (!result.ok) {
          setReaction(previousReaction);
          setCount(previousCount);
          setMessage(result.error);
        }
      } catch {
        setReaction(previousReaction);
        setCount(previousCount);
        setMessage("通信に失敗しました。もう一度お試しください。");
      }
    });
  }

  return (
    <section className="sns-reaction-tray" aria-label="写真へのリアクション" aria-busy={isPending}>
      <span className="w-full text-[10px] font-black tracking-[0.12em] text-ink-faint">QUICK REACTION</span>
      {emojis.map((emoji) => {
        const selected = reaction === emoji;
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => react(emoji)}
            disabled={isPending}
            className={`sns-reaction-button pressable ${selected ? "is-selected" : ""}`}
            aria-pressed={selected}
            aria-label={`${emoji}でリアクション`}
          >
            {emoji}
          </button>
        );
      })}
      {count > 0 ? (
        <span className="flex items-center px-2 text-xs font-semibold text-ink-faint">
          {count}件のリアクション
        </span>
      ) : null}
      {message ? <span className="w-full text-[11px] font-bold text-blossom" role="alert">{message}</span> : null}
    </section>
  );
}
