"use client";

import { useActionState } from "react";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";
import { signInAction } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signInAction, emptyActionState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />

      <FormMessage state={state} />

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

      <Field label="パスワード" htmlFor="password" error={state.fieldErrors?.password}>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="field"
          placeholder="••••••••"
          required
        />
      </Field>

      <SubmitButton pendingLabel="ログイン中…">ログイン</SubmitButton>
    </form>
  );
}
