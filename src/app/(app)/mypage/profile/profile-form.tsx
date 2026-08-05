"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/app/actions/account";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";
import { PhotoUploader } from "@/components/photo-uploader";

export function ProfileForm({
  userId,
  displayName,
  introduction,
  imagePath,
  imageUrl,
}: {
  userId: string;
  displayName: string;
  introduction: string;
  imagePath: string | null;
  imageUrl: string | null;
}) {
  const [state, formAction] = useActionState(updateProfileAction, emptyActionState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormMessage state={state} />

      <PhotoUploader
        name="profilePaths"
        userId={userId}
        draftKey="profile"
        max={1}
        label="プロフィール画像"
        initial={imagePath && imageUrl ? [{ path: imagePath, url: imageUrl }] : []}
      />

      <Field label="ニックネーム" htmlFor="displayName">
        <input
          id="displayName"
          name="displayName"
          type="text"
          className="field"
          defaultValue={state.values?.displayName ?? displayName}
          maxLength={30}
          required
        />
      </Field>

      <Field label="自己紹介" htmlFor="introduction" optional>
        <textarea
          id="introduction"
          name="introduction"
          rows={4}
          className="field"
          defaultValue={state.values?.introduction ?? introduction}
          placeholder="のんびり旅が好きです"
          maxLength={300}
        />
      </Field>

      <SubmitButton pendingLabel="保存中…">保存する</SubmitButton>
    </form>
  );
}
