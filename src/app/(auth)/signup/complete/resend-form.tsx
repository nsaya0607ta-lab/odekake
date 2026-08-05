"use client";

import { useActionState } from "react";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";
import { resendConfirmationAction } from "../../actions";

export function ResendForm({ email }: { email: string }) {
  const [state, formAction] = useActionState(resendConfirmationAction, emptyActionState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="email" value={state.values?.email ?? email} />
      <FormMessage state={state} />
      <SubmitButton className="btn btn-quiet w-full" pendingLabel="送信中…">
        確認メールを再送する
      </SubmitButton>
    </form>
  );
}
