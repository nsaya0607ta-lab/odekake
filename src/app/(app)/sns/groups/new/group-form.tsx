"use client";

import { useActionState, useState } from "react";
import { createFriendGroupAction } from "@/app/actions/sns";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";
import { IconUser } from "@/components/icons";
import { GROUP_ICON_CHOICES } from "@/lib/sns-group-icons";
import type { FriendListRow } from "@/lib/supabase/types";

export function GroupForm({
  friends,
  avatarUrls,
}: {
  friends: FriendListRow[];
  avatarUrls: Record<string, string>;
}) {
  const [state, action] = useActionState(createFriendGroupAction, emptyActionState);
  const [icon, setIcon] = useState(GROUP_ICON_CHOICES[0]);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="icon" value={icon} />

      <div>
        <p className="field-label">アイコン</p>
        <div className="mt-1 grid grid-cols-8 gap-2">
          {GROUP_ICON_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => setIcon(choice)}
              aria-label={`アイコン ${choice}`}
              aria-pressed={icon === choice}
              className={`flex aspect-square items-center justify-center rounded-full border text-lg transition-colors ${
                icon === choice ? "border-leaf bg-leaf-soft" : "border-line-strong bg-card active:bg-paper-deep"
              }`}
            >
              {choice}
            </button>
          ))}
        </div>
      </div>

      <Field label="グループ名" htmlFor="name" error={state.fieldErrors?.name}>
        <input
          id="name"
          name="name"
          className="field"
          defaultValue={state.values?.name ?? ""}
          placeholder="旅仲間"
          maxLength={40}
          required
        />
      </Field>

      <div>
        <p className="field-label">メンバーを選ぶ</p>
        <ul className="rough-card mt-1 divide-y divide-line overflow-hidden">
          {friends.map((friend) => {
            const avatarUrl = friend.profile_image_url ? avatarUrls[friend.profile_image_url] : null;
            return (
              <li key={friend.friend_user_id}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    name="memberUserIds"
                    value={friend.friend_user_id}
                    className="h-5 w-5 shrink-0 accent-leaf"
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
                  <span className="min-w-0 flex-1 truncate font-semibold">{friend.display_name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <FormMessage state={state} />
      <SubmitButton pendingLabel="作成中…">グループを作る</SubmitButton>
    </form>
  );
}
