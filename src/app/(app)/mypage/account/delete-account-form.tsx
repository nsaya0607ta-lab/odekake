"use client";

import { useActionState } from "react";
import { deleteAccountAction } from "@/app/actions/account";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { emptyActionState, Field, FormMessage } from "@/components/form";

export function DeleteAccountForm() {
  const [state, formAction] = useActionState(deleteAccountAction, emptyActionState);

  return (
    <form action={formAction} className="rough-card space-y-3 p-4" noValidate>
      <FormMessage state={state} />

      <p className="text-sm leading-relaxed text-ink-soft">
        アカウントを削除すると、旅行・訪問記録・写真がすべて削除されます。元に戻すことはできません。
        参加している共有旅からも退出します。
      </p>

      <Field label="確認のため「削除」と入力してください" htmlFor="confirmText">
        <input id="confirmText" name="confirmText" type="text" className="field" placeholder="削除" required />
      </Field>

      <ConfirmSubmitButton
        message="アカウントとすべての記録を削除します。元に戻せません。よろしいですか？"
        pendingLabel="削除中…"
      >
        アカウントを削除する
      </ConfirmSubmitButton>
    </form>
  );
}
