"use client";

import { useActionState, useState } from "react";
import {
  addFriendAction,
  regenerateFriendCodeAction,
  updateFriendPrivacyAction,
} from "@/app/(app)/mypage/friends/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";
import { IconClipboard, IconUsers } from "@/components/icons";
import { formatFriendCode } from "@/lib/data/friends";

export function FriendCodeControls({ initialCode }: { initialCode: string }) {
  const [addState, addAction] = useActionState(addFriendAction, emptyActionState);
  const [regenerateState, regenerateAction] = useActionState(regenerateFriendCodeAction, emptyActionState);
  const [copied, setCopied] = useState(false);
  const code = formatFriendCode(regenerateState.values?.friendCode ?? initialCode);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rough-card space-y-4 p-5">
        <div>
          <p className="text-xs font-semibold text-ink-faint">あなたのフレンドコード</p>
          <div className="mt-2 flex min-w-0 items-center gap-2">
            <code className="min-w-0 flex-1 rounded-2xl border border-line-strong bg-paper-deep px-3 py-3 text-center text-xl font-black tracking-[0.12em] text-leaf-deep tabular-nums">
              {code}
            </code>
            <button
              type="button"
              onClick={copyCode}
              className="btn btn-primary tap-target shrink-0 px-3"
              aria-label="フレンドコードをコピー"
            >
              <IconClipboard size={18} />
              <span className="text-xs">{copied ? "コピー済み" : "コピー"}</span>
            </button>
          </div>
        </div>

        <form action={regenerateAction}>
          <ConfirmSubmitButton
            className="btn btn-quiet w-full text-sm"
            pendingLabel="再発行中…"
            message="フレンドコードを再発行しますか？\n古いコードは使えなくなります。"
          >
            コードを再発行
          </ConfirmSubmitButton>
        </form>
        <FormMessage state={regenerateState} />
      </section>

      <section className="rough-card p-5">
        <form action={addAction} className="space-y-3" noValidate>
          <div>
            <label htmlFor="friendCode" className="field-label">
              フレンドコードを入力
            </label>
            <input
              id="friendCode"
              name="friendCode"
              className="field text-center uppercase tracking-[0.12em]"
              defaultValue={addState.values?.friendCode ?? ""}
              placeholder="XXXX-XXXX"
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={11}
              required
            />
          </div>
          <SubmitButton pendingLabel="追加中…">
            <IconUsers size={18} />
            フレンドに追加
          </SubmitButton>
          <FormMessage state={addState} />
        </form>
      </section>
    </div>
  );
}
export function FriendPrivacyForm({
  showPrefectures,
  showCollection,
  showRecentVisits,
}: {
  showPrefectures: boolean;
  showCollection: boolean;
  showRecentVisits: boolean;
}) {
  const [state, action] = useActionState(updateFriendPrivacyAction, emptyActionState);
  const checked = (key: string, initial: boolean) => {
    const saved = state.values?.[key];
    return saved === undefined ? initial : saved === "true";
  };

  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <div className="rough-card divide-y divide-line overflow-hidden">
        <PrivacyToggle
          name="showPrefectures"
          label="行った都道府県"
          description="都道府県名と訪問回数をフレンドに表示します"
          defaultChecked={checked("showPrefectures", showPrefectures)}
        />
        <PrivacyToggle
          name="showCollection"
          label="図鑑"
          description="図鑑の進捗・所持アイテム・出た回数を表示します"
          defaultChecked={checked("showCollection", showCollection)}
        />
        <PrivacyToggle
          name="showRecentVisits"
          label="最近のおでかけ"
          description="場所名・訪問日・都道府県・市区町村だけを表示します"
          defaultChecked={checked("showRecentVisits", showRecentVisits)}
        />
      </div>
      <p className="px-2 text-xs leading-relaxed text-ink-faint">
        詳細住所、写真、コメント、メモ、金額、同行者などは、この設定に関係なく公開されません。
      </p>
      <SubmitButton pendingLabel="保存中…">公開設定を保存</SubmitButton>
    </form>
  );
}

function PrivacyToggle({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-4 px-4 py-4">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-faint">{description}</span>
      </span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-6 w-6 shrink-0 accent-leaf"
      />
    </label>
  );
}
