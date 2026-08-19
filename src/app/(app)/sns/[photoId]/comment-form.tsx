"use client";

import { useActionState, useEffect, useRef } from "react";
import { addFriendPhotoCommentAction } from "@/app/actions/sns";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";

export function CommentForm({ photoId }: { photoId: string }) {
  const [state, action] = useActionState(addFriendPhotoCommentAction, emptyActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="space-y-2 px-1">
      <input type="hidden" name="photoId" value={photoId} />
      <textarea
        name="body"
        rows={2}
        maxLength={1000}
        placeholder="コメントする"
        defaultValue={state.values?.body ?? ""}
        className="field"
      />
      <FormMessage state={state} />
      <SubmitButton className="btn btn-quiet w-full text-sm" pendingLabel="送信中…">
        コメントする
      </SubmitButton>
    </form>
  );
}
