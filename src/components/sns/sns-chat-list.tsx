"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconTrash, IconUser } from "@/components/icons";
import { SnsRichText } from "@/components/sns/sns-rich-text";
import type { SnsMentionRow } from "@/lib/supabase/types";

type ChatMessage = {
  id: string;
  user_id: string;
  display_name: string;
  profile_image_url: string | null;
  body: string;
  created_at: string;
  mentions: SnsMentionRow[];
};

type DeleteAction = (formData: FormData) => Promise<{ ok: true } | { ok: false; error: string }>;

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
  const router = useRouter();
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, startDelete] = useTransition();

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

  function removeMessage(messageId: string) {
    if (!window.confirm("このメッセージを削除しますか？")) return;
    setDeleteError("");
    startDelete(async () => {
      const data = new FormData();
      data.set("messageId", messageId);
      data.set("groupId", groupId);
      try {
        const result = await deleteAction(data);
        if (!result.ok) {
          setDeleteError(result.error);
          return;
        }
        router.refresh();
      } catch {
        setDeleteError("通信に失敗しました。もう一度お試しください。");
      }
    });
  }

  return (
    <>
      <ul className="sns-chat-stream space-y-3 px-2 py-4" aria-busy={isDeleting}>
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
                  <button
                    type="button"
                    onClick={() => removeMessage(message.id)}
                    disabled={isDeleting}
                    className="pressable flex h-11 w-11 items-center justify-center rounded-full text-ink-faint active:bg-paper-deep"
                  >
                    <IconTrash size={14} />
                    <span className="sr-only">このメッセージを削除</span>
                  </button>
                  <span className="shrink-0 text-[10px] text-ink-faint">{formatTime(message.created_at)}</span>
                  <div className="sns-chat-bubble-mine max-w-[76%] rounded-[1.25rem] rounded-br-md px-3.5 py-2.5 shadow-sm">
                    <SnsRichText body={message.body} mentions={message.mentions} className="whitespace-pre-wrap text-sm leading-relaxed text-white" />
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
                    <div className="sns-chat-bubble-friend max-w-[76%] rounded-[1.25rem] rounded-bl-md px-3.5 py-2.5 shadow-sm">
                      <SnsRichText body={message.body} mentions={message.mentions} className="whitespace-pre-wrap text-sm leading-relaxed" />
                    </div>
                    <span className="shrink-0 text-[10px] text-ink-faint">{formatTime(message.created_at)}</span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {deleteError ? <p className="sns-menu-toast" role="alert">{deleteError}</p> : null}
    </>
  );
}
