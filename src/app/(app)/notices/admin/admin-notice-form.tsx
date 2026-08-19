"use client";

import { useActionState } from "react";
import { postAdminNoticeAction } from "./actions";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";

export function AdminNoticeForm() {
  const [state, formAction] = useActionState(postAdminNoticeAction, emptyActionState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />

      <Field label="お知らせ本文" htmlFor="message" hint="500文字以内。送信すると全ユーザーのお知らせに表示されます。">
        <textarea
          id="message"
          name="message"
          className="field"
          rows={5}
          maxLength={500}
          defaultValue={state.values?.message ?? ""}
          placeholder="例：メンテナンスのお知らせ、新機能のご案内など"
          required
        />
      </Field>

      <SubmitButton pendingLabel="配信中…">全ユーザーに配信する</SubmitButton>
    </form>
  );
}
