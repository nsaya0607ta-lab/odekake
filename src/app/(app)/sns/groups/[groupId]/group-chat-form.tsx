"use client";

import { useActionState, useEffect, useRef } from "react";
import { createFriendGroupMessageAction } from "@/app/actions/sns";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";

export function GroupChatForm({ groupId }: { groupId: string }) {
  const [state, action] = useActionState(createFriendGroupMessageAction, emptyActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="space-y-2 px-1">
      <input type="hidden" name="groupId" value={groupId} />
      <textarea
        name="body"
        rows={2}
        maxLength={1000}
        placeholder="今なにしてる？"
        defaultValue={state.values?.body ?? ""}
        className="field"
      />
      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary w-full text-sm" pendingLabel="送信中…">
        投稿する
      </SubmitButton>
    </form>
  );
}
