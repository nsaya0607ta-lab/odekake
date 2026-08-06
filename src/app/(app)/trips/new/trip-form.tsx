"use client";

import { useActionState, useEffect, useState } from "react";
import { createTripAction } from "@/app/actions/trips";
import { FormDraft } from "@/components/form-draft";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";
import { PhotoUploader } from "@/components/photo-uploader";

type TripType = "solo" | "shared";

export function TripForm({ userId, tripType }: { userId: string; tripType: TripType }) {
  const [state, formAction] = useActionState(createTripAction, emptyActionState);
  const formId = `trip-form-${tripType}`;
  const draftKey = `trip-new-${tripType}`;
  const tripIdStorageKey = `odekake:trip-id:${tripType}`;

  // 表紙画像の保存先パスを先に決めるため、旅行 ID を先に発行する。
  // 個人の旅行計画と共有旅で別のキーにし、画面を切り替えても入力が混ざらないようにする。
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

  const isShared = tripType === "shared";

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
      <input type="hidden" name="tripType" value={tripType} />

      <FormMessage state={state} />

      <div
        className={`rough-card flex items-start gap-3 p-4 ${
          isShared ? "border-sky bg-sky-soft" : "border-blossom bg-blossom-soft"
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-ink-faint">
            {isShared ? "この画面で作成する旅行" : "この画面で作成するもの"}
          </span>
          <span className="mt-1 block font-bold">{isShared ? "共有旅" : "旅行の計画"}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
            {isShared
              ? "友人や家族と同じ地図・スポット・訪問履歴を共有する旅行として登録します。"
              : "日程や表紙を設定し、複数の訪問記録をひとつの旅行としてまとめます。普段のおでかけ記録には作成不要です。"}
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
          placeholder={isShared ? "友人との山口旅行" : "岐阜日帰り"}
          maxLength={60}
          required
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="開始日" htmlFor="startDate" optional error={state.fieldErrors?.startDate}>
          <input
            id="startDate"
            name="startDate"
            type="date"
            className="field field-date-pair"
            defaultValue={state.values?.startDate ?? ""}
          />
        </Field>
        <Field label="終了日" htmlFor="endDate" optional error={state.fieldErrors?.endDate}>
          <input
            id="endDate"
            name="endDate"
            type="date"
            className="field field-date-pair"
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
          placeholder={isShared ? "みんなで行く2泊3日の旅行" : "ひさしぶりの日帰り旅行"}
          maxLength={1000}
        />
      </Field>

      <PhotoUploader
        name="coverPaths"
        userId={userId}
        draftKey={`trip-new-${tripType}-cover`}
        max={1}
        label="表紙画像"
      />

      {isShared ? (
        <div className="rough-card space-y-3 p-4">
          <p className="font-semibold">メンバーを招待</p>
          <p className="text-xs leading-relaxed text-ink-soft">
            メールアドレスを入力すると招待を作成します。作成後の画面で招待コードとリンクを共有できます。
          </p>
          <Field
            label="招待するメールアドレス"
            htmlFor="inviteEmails"
            optional
            hint="複数ある場合はカンマで区切ります。"
          >
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
        {isShared ? "共有旅をつくる" : "旅行計画を作る"}
      </SubmitButton>
    </form>
  );
}
