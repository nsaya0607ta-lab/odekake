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

const TIME_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tokyo",
});

const DATE_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  month: "long",
  day: "numeric",
  weekday: "short",
  timeZone: "Asia/Tokyo",
});

const DATE_KEY_FORMATTER = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" });

function formatTime(iso: string): string {
  return TIME_FORMATTER.format(new Date(iso));
}

function formatDate(iso: string): string {
  return DATE_FORMATTER.format(new Date(iso));
}

function dateKey(iso: string): string {
  return DATE_KEY_FORMATTER.format(new Date(iso));
}

/** 全体チャット・グループチャットで共通の、LINEのようなタイムライン表示。
 * 取得データは新しい順のため並び替え、一番下が最新になるようにする */
export function SnsChatList({
  messages,
  avatarUrls,
  currentUserId,
  deleteAction,
  groupId,
}: {
  messages: ChatMessage[];
  avatarUrls: Map<string, string>;
  currentUserId: string;
  deleteAction: DeleteAction;
  groupId: string;
}) {
  const bottomRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="sns-empty-feed my-3">
        <span className="text-3xl" aria-hidden="true">
          💬
        </span>
        <p className="mt-2 text-sm font-bold">まだメッセージがありません</p>
        <p className="mt-1 text-xs text-ink-faint">写真の相談や次のおでかけの話を始めよう。</p>
      </div>
    );
  }

  const ordered = [...messages].reverse();

  return (
    <ul className="sns-chat-stream space-y-3 px-2 py-4">
      {ordered.map((message, index) => {
        const isLast = index === ordered.length - 1;
        const isMine = message.user_id === currentUserId;
        const avatarUrl = message.profile_image_url ? avatarUrls.get(message.profile_image_url) : null;
        const showDate = index === 0 || dateKey(ordered[index - 1]!.created_at) !== dateKey(message.created_at);

        if (isMine) {
          return (
            <li key={message.id} ref={isLast ? bottomRef : undefined}>
              {showDate ? <p className="sns-chat-date">{formatDate(message.created_at)}</p> : null}
              <div className="flex items-end justify-end gap-1.5">
                <form action={deleteAction} className="shrink-0">
                  <input type="hidden" name="messageId" value={message.id} />
                  <input type="hidden" name="groupId" value={groupId} />
                  <button
                    type="submit"
                    aria-label="このメッセージを削除"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-ink-faint active:bg-paper-deep"
                  >
                    <IconClose size={12} />
                  </button>
                </form>
                <span className="shrink-0 text-[10px] text-ink-faint">{formatTime(message.created_at)}</span>
                <div className="max-w-[76%] rounded-[1.25rem] rounded-br-md bg-leaf px-3.5 py-2.5 shadow-sm">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-white">{message.body}</p>
                </div>
              </div>
            </li>
          );
        }

        return (
          <li key={message.id} ref={isLast ? bottomRef : undefined}>
            {showDate ? <p className="sns-chat-date">{formatDate(message.created_at)}</p> : null}
            <div className="flex items-start gap-2">
              <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-paper-deep">
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
                <div className="mt-1 flex items-end gap-1.5">
                  <div className="max-w-[76%] rounded-[1.25rem] rounded-bl-md border border-line bg-card px-3.5 py-2.5 shadow-sm">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-ink-faint">{formatTime(message.created_at)}</span>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
