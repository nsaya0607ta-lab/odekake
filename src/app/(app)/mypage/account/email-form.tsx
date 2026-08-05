"use client";

import { useActionState } from "react";
import { updateEmailAction } from "@/app/actions/account";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";

export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const [state, formAction] = useActionState(updateEmailAction, emptyActionState);

  return (
    <form action={formAction} className="rough-card space-y-3 p-4" noValidate>
      <FormMessage state={state} />

      <p className="text-xs text-ink-faint">現在のメールアドレス: {currentEmail}</p>

      <Field label="新しいメールアドレス" htmlFor="new-email">
        <input
          id="new-email"
          name="email"
          type="email"
          inputMode="email"
          className="field"
          defaultValue={state.values?.email ?? ""}
          placeholder="new@example.com"
          required
        />
      </Field>

      <SubmitButton className="btn btn-quiet w-full" pendingLabel="送信中…">
        確認メールを送る
      </SubmitButton>
    </form>
  );
}
