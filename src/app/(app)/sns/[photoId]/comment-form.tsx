"use client";

import { useActionState, useEffect, useRef } from "react";
import { addFriendPhotoCommentAction } from "@/app/actions/sns";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";
import { IconChat } from "@/components/icons";

export function CommentForm({ photoId }: { photoId: string }) {
  const [state, action] = useActionState(addFriendPhotoCommentAction, emptyActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="sns-inline-composer space-y-2">
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
