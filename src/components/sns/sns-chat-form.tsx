"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ActionState } from "@/components/form";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";
import { IconImage, IconSend } from "@/components/icons";

type ChatAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** 全体チャット・グループチャットで共通の、LINEのようなメッセージ入力欄 */
export function SnsChatForm({
  action,
  hiddenFields,
  postHref,
  placeholder = "メッセージを入力…",
}: {
  action: ChatAction;
  hiddenFields?: Record<string, string>;
  postHref?: string;
  placeholder?: string;
}) {
  const [state, formAction] = useActionState(action, emptyActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  // キーボードが出ている間は下ナビを隠す（bottom-nav.tsx 側のCSSと対）ので、
  // 入力欄もナビ分の余白を空けずにキーボードへ直付けする
  useEffect(() => {
    document.body.classList.toggle("sns-chat-input-focused", focused);
    return () => document.body.classList.remove("sns-chat-input-focused");
  }, [focused]);

  return (
    <div
      className="fixed inset-x-0 z-20 border-t border-line bg-paper/95 backdrop-blur-sm"
      style={{
        bottom: focused
          ? "env(safe-area-inset-bottom, 0px)"
          : "calc(var(--nav-height) + var(--safe-bottom) + 0.5rem)",
      }}
    >
      <div className="mx-auto max-w-lg px-4 pt-2 pb-2">
        <form ref={formRef} action={formAction} className="flex items-center gap-2">
          {hiddenFields
            ? Object.entries(hiddenFields).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))
            : null}
          {postHref ? (
            <Link
              href={postHref}
              aria-label="写真を投稿"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-faint active:bg-paper-deep"
            >
              <IconImage size={20} />
            </Link>
          ) : null}
          <div className="flex min-w-0 flex-1 items-center rounded-full border border-line bg-card px-4 py-2">
            <textarea
              name="body"
              rows={1}
              maxLength={1000}
              placeholder={placeholder}
              defaultValue={state.values?.body ?? ""}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="max-h-24 min-w-0 flex-1 resize-none bg-transparent text-base leading-relaxed outline-none placeholder:text-ink-faint"
              style={{ fontSize: "16px" }}
            />
          </div>
          <SubmitButton
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-leaf text-white transition-opacity active:opacity-80 disabled:opacity-50"
            pendingLabel=""
          >
            <IconSend size={18} />
          </SubmitButton>
        </form>
        <FormMessage state={state} />
      </div>
    </div>
  );
}
