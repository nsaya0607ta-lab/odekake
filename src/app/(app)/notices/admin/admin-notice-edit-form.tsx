"use client";

import { useActionState } from "react";
import { updateAdminNoticeAction } from "./actions";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";

export function AdminNoticeEditForm({ noticeId, initialMessage }: { noticeId: string; initialMessage: string }) {
  const [state, formAction] = useActionState(updateAdminNoticeAction, emptyActionState);

  return (
    <form action={formAction} className="mt-2 space-y-2" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="noticeId" value={noticeId} />
      <textarea
        name="message"
        className="field"
        rows={3}
        maxLength={500}
        defaultValue={state.values?.message ?? initialMessage}
        required
      />
      <SubmitButton className="btn btn-quiet" pendingLabel="更新中…">
        更新する
      </SubmitButton>
    </form>
  );
}
