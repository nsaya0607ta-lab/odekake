"use client";

import { useActionState } from "react";
import { addFriendGroupMembersAction } from "@/app/actions/sns";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";
import { IconUser } from "@/components/icons";
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

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="groupId" value={groupId} />
      <ul className="rough-card divide-y divide-line overflow-hidden">
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
      <FormMessage state={state} />
      <SubmitButton className="btn btn-quiet w-full text-sm" pendingLabel="追加中…">
        追加する
      </SubmitButton>
    </form>
  );
}
