"use client";

import { useActionState, useEffect, useState } from "react";
import { createTripAction } from "@/app/actions/trips";
import { FormDraft } from "@/components/form-draft";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";
import { PhotoUploader } from "@/components/photo-uploader";

export function TripForm({
  userId,
  next = null,
}: {
  userId: string;
  /** 作成後の戻り先。「先に旅行を作る」導線から来たときに使う */
  next?: string | null;
}) {
  const [state, formAction] = useActionState(createTripAction, emptyActionState);
  const formId = "trip-form";
  const draftKey = "trip-new";
  const tripIdStorageKey = "odekake:trip-id";

  // 表紙画像の保存先パスを先に決めるため、旅行 ID を先に発行する。
  const [tripId, setTripId] = useState("");
  useEffect(() => {
    const saved = window.sessionStorage.getItem(tripIdStorageKey);
    if (saved) {
      setTripId(saved);
      return;
    }
    const generated = crypto.randomUUID();
    window.sessionStorage.setItem(tripIdStorageKey, generated);
    setTripId(generated);
  }, [tripIdStorageKey]);

  return (
    <form
      id={formId}
      action={formAction}
      className="space-y-5"
      noValidate
      onSubmit={() => window.sessionStorage.removeItem(tripIdStorageKey)}
    >
      <FormDraft formId={formId} storageKey={draftKey} />
      <input type="hidden" name="tripId" value={tripId} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <FormMessage state={state} />

      <div className="rough-card flex items-start gap-3 border-blossom bg-blossom-soft p-4">
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-ink-faint">この画面で作成するもの</span>
          <span className="mt-1 block font-bold">旅行の計画</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
            日程や表紙を設定し、複数の訪問記録をひとつの旅行としてまとめます。普段のおでかけ記録には作成不要です。
          </span>
        </span>
      </div>

      <Field label="旅行名" htmlFor="title" error={state.fieldErrors?.title}>
        <input
          id="title"
          name="title"
          type="text"
          className="field"
          defaultValue={state.values?.title ?? ""}
          placeholder="岐阜日帰り"
          maxLength={60}
          required
        />
      </Field>

      <div className="space-y-5">
        <div className="w-1/2 min-w-0 pr-1.5">
          <Field label="開始日" htmlFor="startDate" optional error={state.fieldErrors?.startDate}>
            <input
              id="startDate"
              name="startDate"
              type="date"
              className="field w-full min-w-0 max-w-full"
              defaultValue={state.values?.startDate ?? ""}
            />
          </Field>
        </div>
        <div className="w-1/2 min-w-0 pr-1.5">
          <Field label="終了日" htmlFor="endDate" optional error={state.fieldErrors?.endDate}>
            <input
              id="endDate"
              name="endDate"
              type="date"
              className="field w-full min-w-0 max-w-full"
              defaultValue={state.values?.endDate ?? ""}
            />
          </Field>
        </div>
      </div>

      <Field label="説明" htmlFor="description" optional>
        <textarea
          id="description"
          name="description"
          rows={3}
          className="field"
          defaultValue={state.values?.description ?? ""}
          placeholder="ひさしぶりの日帰り旅行"
          maxLength={1000}
        />
      </Field>

      <PhotoUploader
        name="coverPaths"
        userId={userId}
        draftKey="trip-new-cover"
        max={1}
        label="表紙画像"
        persistDraft
      />

      <SubmitButton pendingLabel="作成中…" disabled={!tripId}>
        旅行計画を作る
      </SubmitButton>
    </form>
  );
}
