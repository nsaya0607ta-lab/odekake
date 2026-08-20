"use client";

import { useActionState } from "react";
import { createFriendPhotosAction } from "@/app/actions/sns";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";
import { PhotoUploader } from "@/components/photo-uploader";

export function SnsPostForm({ userId, groupId }: { userId: string; groupId: string }) {
  const [state, action] = useActionState(createFriendPhotosAction, emptyActionState);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="groupId" value={groupId} />
      <PhotoUploader
        name="photoPaths"
        userId={userId}
        draftKey={`sns-group-${groupId}-new`}
        max={10}
        label="写真"
      />

      <Field label="ひとこと" htmlFor="caption" optional>
        <textarea
          id="caption"
          name="caption"
          rows={3}
          className="field"
          placeholder="今日の一枚"
          maxLength={300}
        />
      </Field>
      <p className="text-[11px] leading-relaxed text-ink-faint">
        複数枚選ぶと、それぞれ別の投稿としてフレンドの一覧に並びます。
      </p>

      <FormMessage state={state} />
      <SubmitButton pendingLabel="投稿中…">投稿する</SubmitButton>
    </form>
  );
}
