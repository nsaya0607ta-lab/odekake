"use client";

import { useActionState, useEffect, useState } from "react";
import { createTripAction } from "@/app/actions/trips";
import { FormDraft } from "@/components/form-draft";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";
import { PhotoUploader } from "@/components/photo-uploader";

export function TripForm({ defaultType }: { defaultType: "solo" | "shared" }) {
  const [state, formAction] = useActionState(createTripAction, emptyActionState);
  const [tripType, setTripType] = useState<"solo" | "shared">(
    (state.values?.tripType as "solo" | "shared") ?? defaultType,
  );

  // 表紙画像の保存先パスを先に決めるため、旅行 ID を先に発行する
  const [tripId, setTripId] = useState("");
  useEffect(() => {
    const key = "odekake:trip-id";
    const saved = window.sessionStorage.getItem(key);
    if (saved) {
      setTripId(saved);
      return;
    }
    const generated = crypto.randomUUID();
    window.sessionStorage.setItem(key, generated);
    setTripId(generated);
  }, []);

  return (
    <form
      id="trip-form"
      action={formAction}
      className="space-y-5"
      noValidate
      onSubmit={() => window.sessionStorage.removeItem("odekake:trip-id")}
    >
      <FormDraft formId="trip-form" storageKey="trip-new" />
      <input type="hidden" name="tripId" value={tripId} />

      <FormMessage state={state} />

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

      <fieldset>
        <legend className="field-label">旅行タイプ</legend>
        <input type="hidden" name="tripType" value={tripType} />
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "solo", title: "一人旅", description: "自分だけが見られます" },
              { value: "shared", title: "共有旅", description: "友人と一緒に記録します" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={tripType === option.value}
              onClick={() => setTripType(option.value)}
              className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                tripType === option.value
                  ? "border-leaf bg-leaf-soft"
                  : "border-line-strong bg-card"
              }`}
            >
              <span className="block font-semibold">{option.title}</span>
              <span className="mt-0.5 block text-xs text-ink-soft">{option.description}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label="開始日" htmlFor="startDate" optional error={state.fieldErrors?.startDate}>
          <input
            id="startDate"
            name="startDate"
            type="date"
            className="field"
            defaultValue={state.values?.startDate ?? ""}
          />
        </Field>
        <Field label="終了日" htmlFor="endDate" optional error={state.fieldErrors?.endDate}>
          <input
            id="endDate"
            name="endDate"
            type="date"
            className="field"
            defaultValue={state.values?.endDate ?? ""}
          />
        </Field>
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

      {tripId ? <PhotoUploader name="coverPaths" prefix={`trips/${tripId}/cover`} max={1} label="表紙画像" /> : null}

      {tripType === "shared" ? (
        <div className="rough-card space-y-3 p-4">
          <p className="font-semibold">メンバーを招待</p>
          <p className="text-xs leading-relaxed text-ink-soft">
            メールアドレスを入力すると招待を作成します。作成後の画面で招待コードとリンクを共有できます。
          </p>
          <Field label="招待するメールアドレス" htmlFor="inviteEmails" optional hint="複数ある場合はカンマで区切ります。">
            <textarea
              id="inviteEmails"
              name="inviteEmails"
              rows={2}
              className="field"
              placeholder="friend@example.com, family@example.com"
            />
          </Field>
        </div>
      ) : null}

      <SubmitButton pendingLabel="作成中…" disabled={!tripId}>
        旅行をつくる
      </SubmitButton>
    </form>
  );
}
