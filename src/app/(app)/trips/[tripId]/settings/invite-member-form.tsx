"use client";

import { useActionState } from "react";
import { inviteMemberAction } from "@/app/actions/trips";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";

export function InviteMemberForm({ tripId }: { tripId: string }) {
  const [state, formAction] = useActionState(inviteMemberAction, emptyActionState);

  return (
    <form action={formAction} className="rough-card space-y-3 p-4" noValidate>
      <input type="hidden" name="tripId" value={tripId} />
      <FormMessage state={state} />

      <Field label="メールアドレスで招待" htmlFor="invite-email">
        <input
          id="invite-email"
          name="email"
          type="email"
          inputMode="email"
          className="field"
          defaultValue={state.values?.email ?? ""}
          placeholder="friend@example.com"
          required
        />
      </Field>

      <SubmitButton className="btn btn-quiet w-full" pendingLabel="招待中…">
        招待する
      </SubmitButton>
    </form>
  );
}
