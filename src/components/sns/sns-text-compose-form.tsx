"use client";

import { useActionState, useState } from "react";
import { createFriendTextPostAction } from "@/app/actions/sns";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";
import { PhotoUploader } from "@/components/photo-uploader";

/** Twitterのような短文投稿フォーム。写真は最大4枚まで添付できる */
export function SnsTextComposeForm({ userId }: { userId: string }) {
  const [state, action] = useActionState(createFriendTextPostAction, emptyActionState);
  const initialBody = state.values?.body ?? "";
  const [length, setLength] = useState(initialBody.length);

  return (
    <form action={action} className="sns-compose-sheet space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="sns-post-body" className="text-sm font-bold">ひとこと</label>
          <span className={`text-[11px] font-bold ${length > 250 ? "text-blossom" : "text-ink-faint"}`}>
            {length} / 280
          </span>
        </div>
        <textarea
          id="sns-post-body"
          name="body"
          rows={6}
          maxLength={280}
          className="field border-0 bg-card/70 text-[16px] leading-relaxed shadow-inner ring-1 ring-line"
          placeholder="今日のおでかけ、どんな気分？"
          defaultValue={initialBody}
          onChange={(event) => setLength(event.currentTarget.value.length)}
        />
      </div>
      <div className="rounded-2xl bg-card/65 p-3 ring-1 ring-line">
        <PhotoUploader name="photoPaths" userId={userId} draftKey="sns-home-new" max={4} label="写真を添える（最大4枚）" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="投稿中…" className="btn btn-primary w-full shadow-md">つぶやく</SubmitButton>
    </form>
  );
}
