"use client";

import { useActionState } from "react";
import { updateFriendGroupAction } from "@/app/actions/sns";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";
import { IconCheck } from "@/components/icons";
import { PhotoUploader } from "@/components/photo-uploader";

export function EditGroupForm({
  groupId,
  userId,
  name,
  iconPath,
  iconUrl,
}: {
  groupId: string;
  userId: string;
  name: string;
  iconPath: string | null;
  iconUrl: string | null;
}) {
  const [state, action] = useActionState(updateFriendGroupAction, emptyActionState);

  return (
    <form action={action} className="sns-settings-form space-y-4">
      <input type="hidden" name="groupId" value={groupId} />

      <PhotoUploader
        name="iconPaths"
        userId={userId}
        draftKey={`group-icon-${groupId}`}
        max={1}
        label="アイコン"
        initial={iconPath && iconUrl ? [{ path: iconPath, url: iconUrl }] : []}
      />

      <Field label="グループ名" htmlFor="name" hint="40文字まで" error={state.fieldErrors?.name}>
        <input
          id="name"
          name="name"
          className="field sns-group-name-field"
          defaultValue={state.values?.name ?? name}
          maxLength={40}
          required
        />
      </Field>

      <FormMessage state={state} />
      <SubmitButton className="sns-secondary-submit pressable" pendingLabel="保存中…">
        <IconCheck size={16} />
        保存する
      </SubmitButton>
    </form>
  );
}
