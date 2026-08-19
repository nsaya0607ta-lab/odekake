"use client";

import { useEffect, useRef } from "react";
import { IconClose, IconUser } from "@/components/icons";

type ChatMessage = {
  id: string;
  user_id: string;
  display_name: string;
  profile_image_url: string | null;
  body: string;
  created_at: string;
};

type DeleteAction = (formData: FormData) => void | Promise<void>;

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(iso));
}

/** 全体チャット・グループチャットで共通の、LINEのようなタイムライン表示。
 * 取得データは新しい順のため並び替え、一番下が最新になるようにする */
export function SnsChatList({
  messages,
  avatarUrls,
  currentUserId,
  deleteAction,
  hiddenFieldsFor,
}: {
  messages: ChatMessage[];
  avatarUrls: Map<string, string>;
  currentUserId: string;
  deleteAction: DeleteAction;
  hiddenFieldsFor: (message: ChatMessage) => Record<string, string>;
}) {
  const bottomRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  if (messages.length === 0) {
    return <p className="px-1 py-6 text-center text-xs text-ink-faint">まだメッセージがありません。</p>;
  }

  const ordered = [...messages].reverse();

  return (
    <ul className="space-y-3 px-1 py-3">
      {ordered.map((message, index) => {
        const isLast = index === ordered.length - 1;
        const isMine = message.user_id === currentUserId;
        const avatarUrl = message.profile_image_url ? avatarUrls.get(message.profile_image_url) : null;

        if (isMine) {
          return (
            <li key={message.id} ref={isLast ? bottomRef : undefined} className="flex items-end justify-end gap-1.5">
              <form action={deleteAction} className="shrink-0">
                {Object.entries(hiddenFieldsFor(message)).map(([name, value]) => (
                  <input key={name} type="hidden" name={name} value={value} />
                ))}
                <button
                  type="submit"
                  aria-label="このメッセージを削除"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-ink-faint active:bg-paper-deep"
                >
                  <IconClose size={12} />
                </button>
              </form>
              <span className="shrink-0 text-[10px] text-ink-faint">{formatTime(message.created_at)}</span>
              <div className="max-w-[72%] rounded-2xl rounded-br-md bg-leaf-soft px-3 py-2 text-leaf-deep">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
              </div>
            </li>
          );
        }

        return (
          <li key={message.id} ref={isLast ? bottomRef : undefined} className="flex items-start gap-2">
            <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-paper-deep">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-ink-faint">
                  <IconUser size={18} />
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <span className="block truncate px-1 text-[11px] font-semibold text-ink-faint">
                {message.display_name}
              </span>
              <div className="mt-0.5 flex items-end gap-1.5">
                <div className="max-w-[72%] rounded-2xl rounded-bl-md bg-card px-3 py-2 shadow-sm">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
                </div>
                <span className="shrink-0 text-[10px] text-ink-faint">{formatTime(message.created_at)}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
