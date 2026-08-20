"use client";

import { useActionState } from "react";
import { createFriendTextPostAction } from "@/app/actions/sns";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";

/** Twitterのようなテキストのみの短文投稿フォーム */
export function SnsTextComposeForm() {
  const [state, action] = useActionState(createFriendTextPostAction, emptyActionState);

  return (
    <form action={action} className="space-y-3">
      <textarea
        name="body"
        rows={5}
        maxLength={280}
        required
        className="field"
        placeholder="今どうしてる？"
      />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="投稿中…">つぶやく</SubmitButton>
    </form>
  );
}
