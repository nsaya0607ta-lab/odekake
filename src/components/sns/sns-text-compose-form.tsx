"use client";

import { useActionState } from "react";
import { createFriendTextPostAction } from "@/app/actions/sns";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";
import { PhotoUploader } from "@/components/photo-uploader";

/** Twitterのような短文投稿フォーム。写真は最大4枚まで添付できる */
export function SnsTextComposeForm({ userId }: { userId: string }) {
  const [state, action] = useActionState(createFriendTextPostAction, emptyActionState);

  return (
    <form action={action} className="space-y-3">
      <textarea
        name="body"
        rows={5}
        maxLength={280}
        className="field"
        placeholder="今どうしてる？"
        defaultValue={state.values?.body ?? ""}
      />
      <PhotoUploader name="photoPaths" userId={userId} draftKey="sns-home-new" max={4} label="写真（最大4枚）" />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="投稿中…">つぶやく</SubmitButton>
    </form>
  );
}
