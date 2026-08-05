"use client";

import { useActionState } from "react";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";
import { requestPasswordResetAction } from "../actions";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, emptyActionState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />

      <Field label="メールアドレス" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          className="field"
          defaultValue={state.values?.email ?? ""}
          placeholder="you@example.com"
          required
        />
      </Field>

      <SubmitButton pendingLabel="送信中…">再設定メールを送る</SubmitButton>
    </form>
  );
}
