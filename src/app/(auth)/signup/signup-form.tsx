"use client";

import { useActionState } from "react";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";
import { signUpAction } from "../actions";

export function SignUpForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signUpAction, emptyActionState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={state.values?.next ?? next} />
      <FormMessage state={state} />

      <Field label="ニックネーム" htmlFor="displayName" error={state.fieldErrors?.displayName}>
        <input
          id="displayName"
          name="displayName"
          type="text"
          autoComplete="nickname"
          className="field"
          defaultValue={state.values?.displayName ?? ""}
          placeholder="たろう"
          maxLength={30}
          required
        />
      </Field>

      <Field label="メールアドレス" htmlFor="email" error={state.fieldErrors?.email}>
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

      <Field
        label="パスワード"
        htmlFor="password"
        hint="8文字以上で設定してください。"
        error={state.fieldErrors?.password}
      >
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          className="field"
          placeholder="••••••••"
          required
        />
      </Field>

      <Field label="パスワード（確認）" htmlFor="passwordConfirm" error={state.fieldErrors?.passwordConfirm}>
        <input
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          className="field"
          placeholder="••••••••"
          required
        />
      </Field>

      <SubmitButton pendingLabel="登録中…">登録する</SubmitButton>
    </form>
  );
}
