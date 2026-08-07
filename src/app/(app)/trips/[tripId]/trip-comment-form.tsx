"use client";

import { useActionState, useEffect, useRef } from "react";
import { addTripCommentAction } from "@/app/actions/trips";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";

export function TripCommentForm({ tripId }: { tripId: string }) {
  const [state, formAction] = useActionState(addTripCommentAction, emptyActionState);
  const formRef = useRef<HTMLFormElement>(null);

  // 依存を state.ok にすると、2回続けて投稿したとき値が true のままで
  // エフェクトが動かず、入力欄が消えない。state ごと見る。
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <input type="hidden" name="tripId" value={tripId} />
      <FormMessage state={state} />
      <textarea
        name="comment"
        rows={3}
        className="field"
        placeholder="旅の感想をメンバーに共有しましょう"
        maxLength={1000}
        defaultValue={state.values?.comment ?? ""}
        required
      />
      <SubmitButton className="btn btn-quiet w-full" pendingLabel="投稿中…">
        コメントを投稿
      </SubmitButton>
    </form>
  );
}
