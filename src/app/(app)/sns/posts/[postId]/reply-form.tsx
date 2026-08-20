"use client";

import { useActionState, useEffect, useRef } from "react";
import { addFriendTextPostReplyAction } from "@/app/actions/sns";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";

export function ReplyForm({ postId }: { postId: string }) {
  const [state, action] = useActionState(addFriendTextPostReplyAction, emptyActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <input type="hidden" name="postId" value={postId} />
      <textarea
        name="body"
        rows={2}
        maxLength={1000}
        placeholder="返信する"
        defaultValue={state.values?.body ?? ""}
        className="field"
      />
      <FormMessage state={state} />
      <SubmitButton className="btn btn-quiet w-full text-sm" pendingLabel="送信中…">
        返信する
      </SubmitButton>
    </form>
  );
}
