"use client";

import { useActionState } from "react";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";
import { updatePasswordAction } from "../actions";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, emptyActionState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />

      <Field label="新しいパスワード" htmlFor="password" hint="8文字以上" error={state.fieldErrors?.password}>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          className="field"
          required
        />
      </Field>

      <Field label="新しいパスワード（確認）" htmlFor="passwordConfirm" error={state.fieldErrors?.passwordConfirm}>
        <input
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          className="field"
          required
        />
      </Field>

      <SubmitButton pendingLabel="変更中…">パスワードを変更する</SubmitButton>
    </form>
  );
}
