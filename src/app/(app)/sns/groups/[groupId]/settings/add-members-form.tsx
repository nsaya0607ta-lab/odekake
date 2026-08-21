"use client";

import { useActionState, useState } from "react";
import { addFriendGroupMembersAction } from "@/app/actions/sns";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";
import { IconCheck, IconUser } from "@/components/icons";
import type { FriendListRow } from "@/lib/supabase/types";

export function AddMembersForm({
  groupId,
  friends,
  avatarUrls,
}: {
  groupId: string;
  friends: FriendListRow[];
  avatarUrls: Record<string, string>;
}) {
  const [state, action] = useActionState(addFriendGroupMembersAction, emptyActionState);
  const [selectedCount, setSelectedCount] = useState(0);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="groupId" value={groupId} />
      <div className="flex items-center justify-between px-1 text-[11px] text-ink-faint">
        <span>追加するフレンドを選択</span>
        <span className="sns-member-count" aria-live="polite">{selectedCount}人</span>
      </div>
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
      <FormMessage state={state} />
      <SubmitButton className="sns-secondary-submit pressable" pendingLabel="追加中…" disabled={selectedCount === 0}>
        <IconCheck size={16} />
        {selectedCount > 0 ? `${selectedCount}人を追加` : "メンバーを選ぶ"}
      </SubmitButton>
    </form>
  );
}
