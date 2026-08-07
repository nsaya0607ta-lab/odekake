"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { createVisitedSpotAction, updateSpotAction } from "@/app/actions/spots";
import { FormDraft } from "@/components/form-draft";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";
import {
  LocationPicker,
  type PlaceAutofill,
  type SpotLocation,
} from "@/components/location-picker";
import { PhotoUploader } from "@/components/photo-uploader";
import { RatingInput } from "@/components/rating-input";
import { MAX_PHOTOS_PER_VISIT } from "@/lib/image";

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

export type SpotFormTrip = {
  id: string;
  title: string;
  trip_type: "solo" | "shared";
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
  userId,
  trips = [],
  visitedAtDefault = "",
  showTripPlanningLink = false,
  locationFromUrl = false,
}: {
  categories: Array<{ id: number; name: string }>;
  location: SpotLocation;
  defaults?: SpotFormValues;
  /** 指定すると場所情報だけを編集する */
  spotId?: string;
  placeSearchEnabled?: boolean;
  userId?: string;
  trips?: SpotFormTrip[];
  visitedAtDefault?: string;
  showTripPlanningLink?: boolean;
  /** 市区町村ページなどから場所を指定して開いた場合。下書きで上書きしない */
  locationFromUrl?: boolean;
}) {
  const isEdit = Boolean(spotId);
  const action = isEdit ? updateSpotAction : createVisitedSpotAction;
  const [state, formAction] = useActionState(action, emptyActionState);
  const initial = { ...defaults, ...(state.values ?? {}) };
  const [tripId, setTripId] = useState(state.values?.tripId ?? trips[0]?.id ?? "");
  const [visitId, setVisitId] = useState("");
  const visitIdStorageKey = "odekake:visited-place-id";

  useEffect(() => {
    if (isEdit) return;
    const saved = window.sessionStorage.getItem(visitIdStorageKey);
    if (saved) {
      setVisitId(saved);
      return;
    }
    const generated = crypto.randomUUID();
    window.sessionStorage.setItem(visitIdStorageKey, generated);
    setVisitId(generated);
  }, [isEdit]);

  const applyPlaceAutofill = (place: PlaceAutofill) => {
    setInputValue("name", place.name);
    if (place.address) setInputValue("address", place.address);
    if (place.postalCode) setInputValue("postalCode", place.postalCode);
  };

  return (
    <form
      id="spot-form"
      action={formAction}
      className="space-y-5"
      noValidate
      onSubmit={() => {
        if (!isEdit) window.sessionStorage.removeItem(visitIdStorageKey);
      }}
    >
      {isEdit ? (
        <input type="hidden" name="spotId" value={spotId} />
      ) : (
        <>
          <FormDraft formId="spot-form" storageKey="visited-place-new" />
          <input type="hidden" name="visitId" value={visitId} />
        </>
      )}
      <FormMessage state={state} />

      <section className="space-y-4">
        {!isEdit ? <h2 className="px-1 text-base font-bold">場所</h2> : null}

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
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>

        <LocationPicker
          initial={location}
          error={state.fieldErrors?.municipalityCode}
          placeSearchEnabled={placeSearchEnabled}
          onPlaceSelected={applyPlaceAutofill}
          draftKey={isEdit || locationFromUrl ? null : "visited-place-new-location"}
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
      </section>

      {!isEdit ? (
        <section className="space-y-4 border-t border-line pt-5">
          <h2 className="px-1 text-base font-bold">訪問の記録</h2>

          <Field label="訪問日" htmlFor="visitedAt" error={state.fieldErrors?.visitedAt}>
            <input
              id="visitedAt"
              name="visitedAt"
              type="date"
              className="field field-date-solo"
              defaultValue={state.values?.visitedAt ?? visitedAtDefault}
              required
            />
          </Field>

          <Field label="記録先" htmlFor="tripId" error={state.fieldErrors?.tripId}>
            <select
              id="tripId"
              name="tripId"
              className="field"
              value={tripId}
              onChange={(event) => setTripId(event.target.value)}
              required
            >
              <option value="">選択してください</option>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.trip_type === "shared" ? `${trip.title}（共有旅）` : trip.title}
                </option>
              ))}
            </select>
          </Field>

          <Field label="一緒に行った人" htmlFor="companions" optional>
            <input
              id="companions"
              name="companions"
              type="text"
              className="field"
              defaultValue={state.values?.companions ?? ""}
              placeholder="友人と"
              maxLength={120}
            />
          </Field>

          <RatingInput
            name="rating"
            defaultValue={Number(state.values?.rating ?? 0) || 0}
            draftKey="visited-place-new-rating"
          />

          <Field label="感想" htmlFor="comment" optional error={state.fieldErrors?.comment}>
            <textarea
              id="comment"
              name="comment"
              rows={4}
              className="field"
              defaultValue={state.values?.comment ?? ""}
              placeholder="美味しかった。また行きたい。"
              maxLength={2000}
            />
          </Field>

          {userId && visitId && tripId ? (
            <PhotoUploader
              name="photoPaths"
              userId={userId}
              draftKey={`visited-place-${visitId}`}
              max={MAX_PHOTOS_PER_VISIT}
              persistDraft
            />
          ) : (
            <p className="rounded-2xl bg-paper-deep px-4 py-3 text-xs text-ink-soft">
              写真を追加するには、先に記録先を選んでください。
            </p>
          )}

          {/* すぐ押せることに意味があるので、折りたたみの外に出しておく */}
          <div className="rough-card space-y-2 px-4 py-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="revisitWanted"
                defaultChecked={state.values?.revisitWanted === "on"}
                className="h-5 w-5 accent-[#7fa568]"
              />
              また行きたい
              <span className="text-xs text-ink-faint">（マイページにまとまります）</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="favorite"
                defaultChecked={state.values?.favorite === "on"}
                className="h-5 w-5 accent-[#dd9aa6]"
              />
              お気に入りに追加する
            </label>
          </div>

          <details className="rough-card px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-ink-soft">訪問内容をくわしく記録する</summary>
            <div className="mt-4 space-y-4">
              <Field label="メモ" htmlFor="note" optional>
                <textarea
                  id="note"
                  name="note"
                  rows={3}
                  className="field"
                  defaultValue={state.values?.note ?? ""}
                  placeholder="駐車場は建物の裏側"
                  maxLength={2000}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="使用金額" htmlFor="amount" optional error={state.fieldErrors?.amount}>
                  <input
                    id="amount"
                    name="amount"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className="field"
                    defaultValue={state.values?.amount ?? ""}
                    placeholder="1200"
                  />
                </Field>

                <Field label="滞在時間（分）" htmlFor="stayMinutes" optional error={state.fieldErrors?.stayMinutes}>
                  <input
                    id="stayMinutes"
                    name="stayMinutes"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className="field"
                    defaultValue={state.values?.stayMinutes ?? ""}
                    placeholder="60"
                  />
                </Field>
              </div>

              <Field label="混雑状況" htmlFor="congestionLevel" optional>
                <select
                  id="congestionLevel"
                  name="congestionLevel"
                  className="field"
                  defaultValue={state.values?.congestionLevel ?? ""}
                >
                  <option value="">選択しない</option>
                  <option value="1">空いていた</option>
                  <option value="2">ふつう</option>
                  <option value="3">混んでいた</option>
                </select>
              </Field>

              <Field label="タグ" htmlFor="tags" optional hint="スペースやカンマで区切って入力できます。">
                <input
                  id="tags"
                  name="tags"
                  type="text"
                  className="field"
                  defaultValue={state.values?.tags ?? ""}
                  placeholder="ランチ ひとり時間"
                />
              </Field>

            </div>
          </details>
        </section>
      ) : null}

      <details className="rough-card px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-ink-soft">場所のくわしい情報を入力する</summary>
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

          <Field label="場所メモ" htmlFor="memo" optional>
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

      {!isEdit && trips.length === 0 ? (
        <p role="alert" className="rounded-2xl border border-blossom bg-blossom-soft px-4 py-3 text-sm text-[#8f4c59]">
          記録先を準備できませんでした。画面を再読み込みして、もう一度お試しください。
        </p>
      ) : null}

      <SubmitButton
        pendingLabel="保存中…"
        disabled={!isEdit && (trips.length === 0 || !tripId || !visitId)}
      >
        {isEdit ? "変更を保存する" : "行った場所を登録する"}
      </SubmitButton>
      {!isEdit ? (
        <p className="text-center text-xs text-ink-faint">場所と訪問履歴をまとめて保存し、日本地図へ反映します。</p>
      ) : null}

      {!isEdit && showTripPlanningLink ? (
        <div className="rough-card space-y-3 p-4 text-center">
          <p className="font-semibold">旅行としてまとめたい場合</p>
          <p className="text-xs leading-relaxed text-ink-soft">
            日程や表紙を設定して、複数の訪問記録をひとつの旅行としてまとめられます。普段のおでかけ記録には作成不要です。
          </p>
          <Link href="/trips/new/personal" className="btn btn-quiet w-full">
            旅行の計画を立てる
          </Link>
        </div>
      ) : null}
    </form>
  );
}
