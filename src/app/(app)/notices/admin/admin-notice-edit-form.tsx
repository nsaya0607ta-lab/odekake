"use client";

import { useActionState } from "react";
import { updateAdminNoticeAction } from "./actions";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";
import { PhotoUploader } from "@/components/photo-uploader";

export function AdminNoticeEditForm({
  noticeId,
  userId,
  initialTitle,
  initialMessage,
  initialImagePath,
  initialImageUrl,
}: {
  noticeId: string;
  userId: string;
  initialTitle: string;
  initialMessage: string;
  initialImagePath: string | null;
  initialImageUrl: string | null;
}) {
  const [state, formAction] = useActionState(updateAdminNoticeAction, emptyActionState);

  return (
    <form action={formAction} className="mt-2 space-y-3" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="noticeId" value={noticeId} />
      <input type="hidden" name="previousImagePath" value={initialImagePath ?? ""} />
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
      <PhotoUploader
        name="imagePaths"
        userId={userId}
        draftKey={`admin-notice-${noticeId}`}
        max={1}
        label="画像（任意）"
        initial={initialImagePath && initialImageUrl ? [{ path: initialImagePath, url: initialImageUrl }] : []}
      />
      <SubmitButton className="btn btn-quiet" pendingLabel="更新中…">
        更新する
      </SubmitButton>
    </form>
  );
}
