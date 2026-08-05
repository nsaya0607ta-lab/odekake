"use client";

import { useActionState } from "react";
import { joinTripAction } from "@/app/actions/trips";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";

export function JoinTripForm({ defaultCode = "" }: { defaultCode?: string }) {
  const [state, formAction] = useActionState(joinTripAction, emptyActionState);

  return (
    <form action={formAction} className="rough-card space-y-4 p-4" noValidate>
      <FormMessage state={state} />

      <Field label="招待コード" htmlFor="inviteCode">
        <input
          id="inviteCode"
          name="inviteCode"
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          className="field text-center text-xl font-bold tracking-[0.2em] uppercase"
          defaultValue={state.values?.inviteCode ?? defaultCode}
          placeholder="ABCD2345"
          maxLength={16}
          required
        />
      </Field>

      <SubmitButton pendingLabel="参加中…">参加する</SubmitButton>
    </form>
  );
}
