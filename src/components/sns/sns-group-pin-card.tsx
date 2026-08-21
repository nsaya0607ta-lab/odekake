"use client";

import { useActionState, useEffect, useState } from "react";
import { setFriendGroupPinAction } from "@/app/actions/sns";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";
import { IconClose, IconPin, IconSettings } from "@/components/icons";
import type { FriendGroupPinRow } from "@/lib/supabase/types";

export function SnsGroupPinCard({ groupId, pin }: { groupId: string; pin: FriendGroupPinRow | null }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(setFriendGroupPinAction, emptyActionState);

  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state.ok]);

  if (!pin && !editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="sns-group-pin-empty pressable">
        <span><IconPin size={17} /></span>
        <span className="min-w-0 flex-1"><strong>大事な予定を固定</strong><small>集合場所や持ち物を、迷わない位置へ</small></span>
        <span aria-hidden="true">＋</span>
      </button>
    );
  }

  return (
    <section className={`sns-group-pin-card ${editing ? "is-editing" : ""}`}>
      <span className="sns-group-pin-badge"><IconPin size={13} filled /> PINNED</span>
      {editing ? (
        <form action={action} className="space-y-2.5">
          <input type="hidden" name="groupId" value={groupId} />
          <div className="flex items-center justify-between gap-2">
            <strong className="text-sm">グループの固定カード</strong>
            <button type="button" onClick={() => setEditing(false)} aria-label="編集を閉じる" className="pressable rounded-full p-2 text-ink-faint"><IconClose size={16} /></button>
          </div>
          <input name="title" maxLength={60} defaultValue={state.values?.title ?? pin?.title ?? ""} className="field text-sm font-bold" placeholder="例：土曜 10:00 東京駅集合" autoFocus />
          <textarea name="body" rows={2} maxLength={300} defaultValue={state.values?.body ?? pin?.body ?? ""} className="field text-sm" placeholder="持ち物やリンクなど（任意）" />
          <FormMessage state={state} />
          <div className="flex gap-2">
            {pin ? (
              <button
                type="submit"
                name="clear"
                value="1"
                className="sns-pin-clear pressable"
                formAction={action}
              >
                固定を解除
              </button>
            ) : null}
            <SubmitButton className="sns-pin-save pressable" pendingLabel="保存中…">保存</SubmitButton>
          </div>
        </form>
      ) : pin ? (
        <>
          <button type="button" onClick={() => setEditing(true)} aria-label="固定カードを編集" className="sns-group-pin-edit pressable"><IconSettings size={15} /></button>
          <strong>{pin.title}</strong>
          {pin.body ? <p>{pin.body}</p> : null}
          <small>{pin.updated_by_name}さんが更新</small>
        </>
      ) : null}
    </section>
  );
}
