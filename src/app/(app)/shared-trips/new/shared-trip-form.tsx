"use client";

import { useActionState } from "react";
import { createSharedTripAction } from "../actions";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";
import { IconUsers } from "@/components/icons";
import type { FriendListRow } from "@/lib/supabase/types";

export function SharedTripForm({ friends }: { friends: FriendListRow[] }) {
  const [state, action] = useActionState(createSharedTripAction, emptyActionState);
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <section className="rough-card space-y-5 p-5">
        <Field label="旅の名前" htmlFor="title">
          <input id="title" name="title" className="field" defaultValue={state.values?.title ?? ""} placeholder="東京旅行" maxLength={60} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="開始日" htmlFor="startDate" optional>
            <input id="startDate" name="startDate" type="date" className="field" defaultValue={state.values?.startDate ?? ""} />
          </Field>
          <Field label="終了日" htmlFor="endDate" optional>
            <input id="endDate" name="endDate" type="date" className="field" defaultValue={state.values?.endDate ?? ""} />
          </Field>
        </div>
        <Field label="説明" htmlFor="description" optional>
          <textarea id="description" name="description" className="field" rows={3} defaultValue={state.values?.description ?? ""} maxLength={1000} />
        </Field>
      </section>

      <section className="space-y-3">
        <div className="px-1">
          <h2 className="font-bold">一緒に行くフレンド</h2>
          <p className="mt-1 text-xs text-ink-faint">選んだ相手には参加確認が届きます。</p>
        </div>
        <div className="rough-card divide-y divide-line overflow-hidden">
          {friends.map((friend) => (
            <label key={friend.friend_user_id} className="flex cursor-pointer items-center gap-3 px-4 py-4 active:bg-paper-deep">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-leaf-soft text-leaf-deep"><IconUsers size={19} /></span>
              <span className="min-w-0 flex-1 truncate font-semibold">{friend.display_name}</span>
              <input type="checkbox" name="friendIds" value={friend.friend_user_id} className="h-6 w-6 accent-leaf" />
            </label>
          ))}
        </div>
      </section>
      <SubmitButton pendingLabel="作成中…"><IconUsers size={18} />共有旅を作成</SubmitButton>
    </form>
  );
}
