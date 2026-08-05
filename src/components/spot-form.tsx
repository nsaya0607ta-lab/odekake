"use client";

import { useActionState } from "react";
import { createSpotAction, updateSpotAction } from "@/app/actions/spots";
import { FormDraft } from "@/components/form-draft";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";
import {
  LocationPicker,
  type PlaceAutofill,
  type SpotLocation,
} from "@/components/location-picker";

export type SpotFormValues = {
  name: string;
  categoryId: string;
  address: string;
  postalCode: string;
  phone: string;
  websiteUrl: string;
  openingHours: string;
  closedDays: string;
  memo: string;
};

const EMPTY: SpotFormValues = {
  name: "",
  categoryId: "",
  address: "",
  postalCode: "",
  phone: "",
  websiteUrl: "",
  openingHours: "",
  closedDays: "",
  memo: "",
};

function setInputValue(id: string, value: string) {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLInputElement)) return;
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  if (descriptor?.set) descriptor.set.call(element, value);
  else element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

export function SpotForm({
  categories,
  location,
  defaults = EMPTY,
  spotId,
  placeSearchEnabled = false,
}: {
  categories: Array<{ id: number; name: string }>;
  location: SpotLocation;
  defaults?: SpotFormValues;
  /** 指定すると編集、省略すると新規登録 */
  spotId?: string;
  placeSearchEnabled?: boolean;
}) {
  const isEdit = Boolean(spotId);
  const [state, formAction] = useActionState(isEdit ? updateSpotAction : createSpotAction, emptyActionState);
  const initial = { ...defaults, ...(state.values ?? {}) };

  const applyPlaceAutofill = (place: PlaceAutofill) => {
    setInputValue("name", place.name);
    if (place.address) setInputValue("address", place.address);
    if (place.postalCode) setInputValue("postalCode", place.postalCode);
  };

  return (
    <form id="spot-form" action={formAction} className="space-y-4" noValidate>
      {isEdit ? <input type="hidden" name="spotId" value={spotId} /> : <FormDraft formId="spot-form" storageKey="spot-new" />}
      <FormMessage state={state} />

      <Field label="スポット名" htmlFor="name" error={state.fieldErrors?.name}>
        <input
          id="name"
          name="name"
          type="text"
          className="field"
          defaultValue={initial.name}
          placeholder="〇〇カフェ"
          maxLength={80}
          required
        />
      </Field>

      <Field label="カテゴリー" htmlFor="categoryId" error={state.fieldErrors?.categoryId}>
        <select id="categoryId" name="categoryId" className="field" defaultValue={initial.categoryId}>
          <option value="">選択しない</option>
          {categories.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <LocationPicker
        initial={location}
        error={state.fieldErrors?.municipalityCode}
        placeSearchEnabled={placeSearchEnabled}
        onPlaceSelected={applyPlaceAutofill}
      />

      <Field label="住所" htmlFor="address" optional error={state.fieldErrors?.address}>
        <input
          id="address"
          name="address"
          type="text"
          className="field"
          defaultValue={initial.address}
          placeholder="岐阜市〇〇町1-2-3"
          maxLength={200}
        />
      </Field>

      <details className="rough-card px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-ink-soft">くわしい情報を入力する</summary>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="郵便番号" htmlFor="postalCode" optional>
              <input
                id="postalCode"
                name="postalCode"
                type="text"
                inputMode="numeric"
                className="field"
                defaultValue={initial.postalCode}
                placeholder="500-8701"
                maxLength={10}
              />
            </Field>
            <Field label="電話番号" htmlFor="phone" optional>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                className="field"
                defaultValue={initial.phone}
                placeholder="058-000-0000"
                maxLength={20}
              />
            </Field>
          </div>

          <Field label="営業時間" htmlFor="openingHours" optional>
            <input
              id="openingHours"
              name="openingHours"
              type="text"
              className="field"
              defaultValue={initial.openingHours}
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
              defaultValue={initial.closedDays}
              placeholder="水曜日"
              maxLength={120}
            />
          </Field>

          <Field label="公式URL" htmlFor="websiteUrl" optional error={state.fieldErrors?.websiteUrl}>
            <input
              id="websiteUrl"
              name="websiteUrl"
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="field"
              defaultValue={initial.websiteUrl}
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
              defaultValue={initial.memo}
              placeholder="落ち着いた雰囲気のカフェ"
              maxLength={1000}
            />
          </Field>
        </div>
      </details>

      <SubmitButton pendingLabel="保存中…">{isEdit ? "変更を保存する" : "スポットを登録する"}</SubmitButton>
      {isEdit ? null : (
        <p className="text-center text-xs text-ink-faint">保存すると、続けて訪問履歴を入力できます。</p>
      )}
    </form>
  );
}
