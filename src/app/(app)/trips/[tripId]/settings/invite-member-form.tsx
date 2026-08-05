"use client";

import { useActionState } from "react";
import { inviteMemberAction } from "@/app/actions/trips";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";
import { IconMail } from "@/components/icons";

export function InviteMemberForm({
  tripId,
  emailSendingEnabled,
}: {
  tripId: string;
  /** メール送信の提供元が設定されているか */
  emailSendingEnabled: boolean;
}) {
  const [state, formAction] = useActionState(inviteMemberAction, emptyActionState);

  return (
    <form action={formAction} className="rough-card space-y-3 p-4" noValidate>
      <input type="hidden" name="tripId" value={tripId} />

      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blossom-soft text-[#95505e]">
          <IconMail size={17} />
        </span>
        <p className="font-semibold">メールアドレスで招待</p>
      </div>

      <FormMessage state={state} />

      <Field label="招待するメールアドレス" htmlFor="invite-email">
        <input
          id="invite-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          className="field"
          defaultValue={state.values?.email ?? ""}
          placeholder="friend@example.com"
          required
        />
      </Field>

      <Field label="ひとこと" htmlFor="invite-message" optional>
        <textarea
          id="invite-message"
          name="message"
          rows={2}
          className="field"
          defaultValue={state.values?.message ?? ""}
          placeholder="来月の京都、いっしょに記録しよう"
          maxLength={300}
        />
      </Field>

      <SubmitButton className="btn btn-quiet w-full" pendingLabel="招待中…">
        招待する
      </SubmitButton>

      <p className="text-xs leading-relaxed text-ink-faint">
        {emailSendingEnabled
          ? "招待メールを送ります。届かない場合は、下の一覧から招待リンクを共有してください。"
          : "この環境ではメールを送りません。招待をつくったあと、下の一覧から招待コードとリンクを共有できます。"}
      </p>
    </form>
  );
}
