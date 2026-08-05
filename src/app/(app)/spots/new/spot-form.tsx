"use client";

import { useActionState } from "react";
import { FormDraft } from "@/components/form-draft";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";
import { MunicipalityPicker } from "@/components/municipality-picker";
import { createSpotAction } from "@/app/actions/spots";

export function SpotForm({
  categories,
  defaultPrefectureCode,
  defaultMunicipalityCode,
}: {
  categories: Array<{ id: number; name: string }>;
  defaultPrefectureCode: string;
  defaultMunicipalityCode: string;
}) {
  const [state, formAction] = useActionState(createSpotAction, emptyActionState);

  return (
    <form id="spot-form" action={formAction} className="space-y-4" noValidate>
      <FormDraft formId="spot-form" storageKey="spot-new" />
      <FormMessage state={state} />

      <Field label="スポット名" htmlFor="name" error={state.fieldErrors?.name}>
        <input
          id="name"
          name="name"
          type="text"
          className="field"
          defaultValue={state.values?.name ?? ""}
          placeholder="〇〇カフェ"
          maxLength={80}
          required
        />
      </Field>

      <Field label="カテゴリー" htmlFor="categoryId" error={state.fieldErrors?.categoryId}>
        <select id="categoryId" name="categoryId" className="field" defaultValue={state.values?.categoryId ?? ""}>
          <option value="">選択しない</option>
          {categories.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <MunicipalityPicker
        defaultPrefectureCode={defaultPrefectureCode}
        defaultMunicipalityCode={state.values?.municipalityCode ?? defaultMunicipalityCode}
        error={state.fieldErrors?.municipalityCode}
      />

      <Field label="住所" htmlFor="address" optional error={state.fieldErrors?.address}>
        <input
          id="address"
          name="address"
          type="text"
          className="field"
          defaultValue={state.values?.address ?? ""}
          placeholder="岐阜市〇〇町1-2-3"
          maxLength={200}
        />
      </Field>

      <details className="rough-card px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-ink-soft">くわしい情報を入力する</summary>
        <div className="mt-4 space-y-4">
          <Field label="営業時間" htmlFor="openingHours" optional>
            <input
              id="openingHours"
              name="openingHours"
              type="text"
              className="field"
              defaultValue={state.values?.openingHours ?? ""}
              placeholder="10:00〜18:00"
              maxLength={120}
            />
          </Field>

          <Field label="定休日" htmlFor="closedDays" optional>
            <input
              id="closedDays"
              name="closedDays"
              type="text"
              className="field"
              defaultValue={state.values?.closedDays ?? ""}
              placeholder="水曜日"
              maxLength={120}
            />
          </Field>

          <Field label="公式URL" htmlFor="websiteUrl" optional>
            <input
              id="websiteUrl"
              name="websiteUrl"
              type="url"
              inputMode="url"
              className="field"
              defaultValue={state.values?.websiteUrl ?? ""}
              placeholder="https://example.com"
              maxLength={300}
            />
          </Field>

          <Field label="メモ" htmlFor="memo" optional>
            <textarea
              id="memo"
              name="memo"
              rows={3}
              className="field"
              defaultValue={state.values?.memo ?? ""}
              placeholder="落ち着いた雰囲気のカフェ"
              maxLength={1000}
            />
          </Field>
        </div>
      </details>

      <SubmitButton pendingLabel="保存中…">スポットを登録する</SubmitButton>
      <p className="text-center text-xs text-ink-faint">保存すると、続けて訪問履歴を入力できます。</p>
    </form>
  );
}
