"use client";

import { useActionState } from "react";
import { updateAdminNoticeAction } from "./actions";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";

export function AdminNoticeEditForm({
  noticeId,
  initialTitle,
  initialMessage,
}: {
  noticeId: string;
  initialTitle: string;
  initialMessage: string;
}) {
  const [state, formAction] = useActionState(updateAdminNoticeAction, emptyActionState);

  return (
    <form action={formAction} className="mt-2 space-y-3" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="noticeId" value={noticeId} />
      <Field label="タイトル" htmlFor={`title-${noticeId}`}>
        <input
          id={`title-${noticeId}`}
          name="title"
          type="text"
          className="field"
          maxLength={100}
          defaultValue={state.values?.title ?? initialTitle}
          required
        />
      </Field>
      <Field label="本文" htmlFor={`message-${noticeId}`}>
        <textarea
          id={`message-${noticeId}`}
          name="message"
          className="field"
          rows={4}
          maxLength={2000}
          defaultValue={state.values?.message ?? initialMessage}
          required
        />
      </Field>
      <SubmitButton className="btn btn-quiet" pendingLabel="更新中…">
        更新する
      </SubmitButton>
    </form>
  );
}
