"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/components/form";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";

type ChatAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** 全体チャット・グループチャットで共通のTwitterのような投稿フォーム */
export function SnsChatForm({
  action,
  hiddenFields,
  placeholder = "今なにしてる？",
}: {
  action: ChatAction;
  hiddenFields?: Record<string, string>;
  placeholder?: string;
}) {
  const [state, formAction] = useActionState(action, emptyActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2 px-1">
      {hiddenFields
        ? Object.entries(hiddenFields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)
        : null}
      <textarea
        name="body"
        rows={2}
        maxLength={1000}
        placeholder={placeholder}
        defaultValue={state.values?.body ?? ""}
        className="field"
      />
      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary w-full text-sm" pendingLabel="送信中…">
        投稿する
      </SubmitButton>
    </form>
  );
}
