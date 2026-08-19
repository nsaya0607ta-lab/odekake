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
    <div
      className="sticky z-10 -mx-4 border-t border-line bg-paper/95 px-4 pt-2 backdrop-blur-sm"
      style={{ bottom: "calc(var(--nav-height) + var(--safe-bottom))" }}
    >
      <form ref={formRef} action={formAction} className="flex items-end gap-2 pb-2">
        {hiddenFields
          ? Object.entries(hiddenFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))
          : null}
        <textarea
          name="body"
          rows={1}
          maxLength={1000}
          placeholder={placeholder}
          defaultValue={state.values?.body ?? ""}
          className="field flex-1 resize-none"
        />
        <SubmitButton className="btn btn-primary shrink-0 px-4 text-sm" pendingLabel="…">
          送信
        </SubmitButton>
      </form>
      <FormMessage state={state} />
    </div>
  );
}
