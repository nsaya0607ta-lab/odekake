"use client";

import { useActionState, useEffect, useRef } from "react";
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

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <div
      className="sticky z-10 -mx-4 bg-paper/95 px-4 pt-2 backdrop-blur-sm"
      style={{ bottom: "calc(var(--nav-height) + var(--safe-bottom))" }}
    >
      <form ref={formRef} action={formAction} className="flex items-center gap-2 pb-1">
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
  );
}
