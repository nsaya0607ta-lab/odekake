"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { clearFriendGroupPinAction, setFriendGroupPinAction } from "@/app/actions/sns";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";
import { IconClose, IconPin, IconSettings, IconSpinner } from "@/components/icons";
import type { FriendGroupPinRow } from "@/lib/supabase/types";

export function SnsGroupPinCard({ groupId, pin }: { groupId: string; pin: FriendGroupPinRow | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [locallyCleared, setLocallyCleared] = useState(false);
  const [clearError, setClearError] = useState("");
  const [isClearing, startClearing] = useTransition();
  const [state, action] = useActionState(setFriendGroupPinAction, emptyActionState);
  const visiblePin = locallyCleared ? null : pin;

  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state.ok]);

  useEffect(() => {
    if (pin) setLocallyCleared(false);
  }, [pin]);

  function clearPin() {
    if (isClearing || !window.confirm("グループの固定カードを解除しますか？")) return;
    setClearError("");
    startClearing(async () => {
      const formData = new FormData();
      formData.set("groupId", groupId);
      const result = await clearFriendGroupPinAction(formData);
      if (!result.ok) {
        setClearError(result.error);
        return;
      }
      setLocallyCleared(true);
      setEditing(false);
      router.refresh();
    });
  }

  if (!visiblePin && !editing) {
    return (
      <button type="button" onClick={() => { setClearError(""); setEditing(true); }} className="sns-group-pin-empty pressable">
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
          <input name="title" maxLength={60} defaultValue={state.values?.title ?? visiblePin?.title ?? ""} className="field text-sm font-bold" placeholder="例：土曜 10:00 東京駅集合" autoFocus />
          <textarea name="body" rows={2} maxLength={300} defaultValue={state.values?.body ?? visiblePin?.body ?? ""} className="field text-sm" placeholder="持ち物やリンクなど（任意）" />
          <FormMessage state={clearError ? { error: clearError } : state} />
          <div className="flex gap-2">
            {visiblePin ? (
              <button
                type="button"
                onClick={clearPin}
                disabled={isClearing}
                aria-busy={isClearing}
                className="sns-pin-clear pressable"
              >
                {isClearing ? <><IconSpinner size={17} />解除中…</> : "固定を解除"}
              </button>
            ) : null}
            <SubmitButton className="sns-pin-save pressable" pendingLabel="保存中…">保存</SubmitButton>
          </div>
        </form>
      ) : visiblePin ? (
        <>
          <button type="button" onClick={() => setEditing(true)} aria-label="固定カードを編集" className="sns-group-pin-edit pressable"><IconSettings size={15} /></button>
          <strong>{visiblePin.title}</strong>
          {visiblePin.body ? <p>{visiblePin.body}</p> : null}
          <small>{visiblePin.updated_by_name}さんが更新</small>
        </>
      ) : null}
    </section>
  );
}
