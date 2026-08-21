"use client";

import { useActionState, useState } from "react";
import { createFriendGroupAction } from "@/app/actions/sns";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";
import { IconCheck, IconImage, IconSend, IconUser, IconUsers } from "@/components/icons";
import { PhotoUploader } from "@/components/photo-uploader";
import type { FriendListRow } from "@/lib/supabase/types";

export function GroupForm({
  userId,
  friends,
  avatarUrls,
}: {
  userId: string;
  friends: FriendListRow[];
  avatarUrls: Record<string, string>;
}) {
  const [state, action] = useActionState(createFriendGroupAction, emptyActionState);
  const [selectedCount, setSelectedCount] = useState(0);

  return (
    <form action={action} className="sns-form-panel space-y-4">
      <section className="sns-form-section is-photo">
        <div className="mb-2 flex items-center gap-2">
          <span className="sns-form-step">1</span>
          <IconImage size={17} className="text-[#7a58d5]" />
          <p className="text-sm font-black">グループの目印</p>
          <span className="sns-compose-optional">任意</span>
        </div>
        <PhotoUploader name="iconPaths" userId={userId} draftKey="group-icon-new" max={1} label="アイコンを選ぶ" persistDraft />
      </section>

      <section className="sns-form-section is-message">
        <div className="mb-2 flex items-center gap-2">
          <span className="sns-form-step">2</span>
          <p className="text-sm font-black">名前をつける</p>
        </div>
        <Field label="グループ名" htmlFor="name" error={state.fieldErrors?.name}>
          <input
            id="name"
            name="name"
            className="field sns-group-name-field"
            defaultValue={state.values?.name ?? ""}
            placeholder="例：週末の旅仲間"
            maxLength={40}
            required
          />
        </Field>
      </section>

      <section className="sns-form-section is-members">
        <div className="mb-2 flex items-center gap-2">
          <span className="sns-form-step">3</span>
          <IconUsers size={17} className="text-[#218aaa]" />
          <p className="text-sm font-black">メンバーを選ぶ</p>
          <span className="sns-member-count" aria-live="polite">{selectedCount}人</span>
        </div>
        <p className="mb-2 text-[11px] leading-relaxed text-ink-faint">あなたは自動で参加します。あとから追加もできます。</p>
        <ul className="sns-member-picker">
          {friends.map((friend) => {
            const avatarUrl = friend.profile_image_url ? avatarUrls[friend.profile_image_url] : null;
            return (
              <li key={friend.friend_user_id}>
                <label className="sns-member-option pressable">
                  <input
                    type="checkbox"
                    name="memberUserIds"
                    value={friend.friend_user_id}
                    className="sns-member-checkbox"
                    onChange={(event) =>
                      setSelectedCount((count) => Math.max(0, count + (event.currentTarget.checked ? 1 : -1)))
                    }
                  />
                  <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-paper-deep">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-ink-faint">
                        <IconUser size={18} />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{friend.display_name}</span>
                  <span className="sns-member-checkmark" aria-hidden="true"><IconCheck size={14} /></span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <FormMessage state={state} />
      <SubmitButton pendingLabel="基地を準備中…" className="sns-primary-submit is-group pressable">
        <IconSend size={18} />
        グループを作る
        <span aria-hidden="true">✦</span>
      </SubmitButton>
    </form>
  );
}
