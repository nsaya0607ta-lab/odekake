"use client";

import { useActionState, useEffect, useRef } from "react";
import { addFriendPhotoCommentAction } from "@/app/actions/sns";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";
import { FormDraft } from "@/components/form-draft";
import { IconChat } from "@/components/icons";

export function CommentForm({ photoId }: { photoId: string }) {
  const [state, action] = useActionState(addFriendPhotoCommentAction, emptyActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const formId = `sns-photo-comment-${photoId}`;

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form id={formId} ref={formRef} action={action} className="sns-inline-composer space-y-2">
      <FormDraft formId={formId} storageKey={formId} />
      <input type="hidden" name="photoId" value={photoId} />
      <textarea
        name="body"
        rows={2}
        maxLength={1000}
        placeholder="コメントする"
        defaultValue={state.values?.body ?? ""}
        className="field sns-inline-composer-field"
      />
      <FormMessage state={state} />
      <SubmitButton className="sns-inline-submit pressable" pendingLabel="送信中…">
        <IconChat size={15} />
        コメントする
      </SubmitButton>
    </form>
  );
}
