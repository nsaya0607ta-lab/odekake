"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { createVisitAction, updateVisitAction } from "@/app/actions/visits";
import { FormDraft } from "@/components/form-draft";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";
import { PhotoUploader, type UploadedPhoto } from "@/components/photo-uploader";
import { RatingInput } from "@/components/rating-input";
import { MAX_PHOTOS_PER_VISIT } from "@/lib/image";

export type TripOption = { id: string; title: string };

export type VisitFormDefaults = {
  visitedAt: string;
  tripId: string;
  rating: number;
  comment: string;
  note: string;
  companions: string;
  amount: string;
  stayMinutes: string;
  congestionLevel: string;
  revisitWanted: boolean;
  favorite: boolean;
  tags: string;
};

export function VisitForm({
  userId,
  mode,
  visitId: fixedVisitId,
  spotId,
  spotName,
  trips,
  defaults,
  initialPhotos = [],
  lockedTripId,
}: {
  userId: string;
  mode: "create" | "edit";
  /** 編集時の訪問記録 ID。新規作成時はクライアント側で発行する */
  visitId?: string;
  spotId: string;
  spotName: string;
  trips: TripOption[];
  defaults: VisitFormDefaults;
  initialPhotos?: UploadedPhoto[];
  lockedTripId?: string;
}) {
  const action = mode === "create" ? createVisitAction : updateVisitAction;
  const [state, formAction] = useActionState(action, emptyActionState);
  const [tripId, setTripId] = useState(state.values?.tripId ?? defaults.tripId);

  // 写真の保存先パスを先に決めるため、新規作成でも訪問記録の ID を先に発行する。
  // 画面を開き直しても同じ ID を使い、写真の重複アップロードと二重登録を防ぐ。
  const idStorageKey = `odekake:visit-id:${spotId}`;
  const [visitId, setVisitId] = useState(fixedVisitId ?? "");

  useEffect(() => {
    if (fixedVisitId) return;
    const saved = window.sessionStorage.getItem(idStorageKey);
    if (saved) {
      setVisitId(saved);
      return;
    }
    const generated = crypto.randomUUID();
    window.sessionStorage.setItem(idStorageKey, generated);
    setVisitId(generated);
  }, [fixedVisitId, idStorageKey]);

  const formId = `visit-form-${mode}`;

  if (trips.length === 0) {
    return (
      <div className="rough-card space-y-3 p-5 text-center">
        <p className="font-semibold">先に旅行を作成してください</p>
        <p className="text-sm leading-relaxed text-ink-soft">
          訪問履歴はどの旅行の記録かを選んで保存します。
          <br />
          ふだんのおでかけ用に旅行を1つ作っておくと便利です。
        </p>
        <Link
          href={`/trips/new?next=${encodeURIComponent(`/visits/new?spot=${spotId}`)}`}
          className="btn btn-primary w-full"
        >
          旅行をつくる
        </Link>
      </div>
    );
  }

  // 写真は旅行ごとに分けて保存する（trips/{tripId}/visits/{visitId}/）

  return (
    <form
      id={formId}
      action={formAction}
      className="space-y-5"
      noValidate
      onSubmit={() => {
        // 保存に進んだら次回は新しい ID を使う
        if (!fixedVisitId) window.sessionStorage.removeItem(idStorageKey);
      }}
    >
      <FormDraft formId={formId} storageKey={`visit-${mode}-${visitId}`} />

      <input type="hidden" name="visitId" value={visitId} />
      <input type="hidden" name="spotId" value={spotId} />

      <FormMessage state={state} />

      <div className="rough-card px-4 py-3">
        <p className="text-xs text-ink-faint">スポット</p>
        <p className="font-semibold">{spotName}</p>
      </div>

      <Field label="訪問日" htmlFor="visitedAt" error={state.fieldErrors?.visitedAt}>
        <input
          id="visitedAt"
          name="visitedAt"
          type="date"
          className="field field-date-solo"
          defaultValue={state.values?.visitedAt ?? defaults.visitedAt}
          required
        />
      </Field>

      <Field label="旅行" htmlFor="tripId" error={state.fieldErrors?.tripId}>
        {lockedTripId ? (
          <>
            <input type="hidden" id="tripId" name="tripId" value={lockedTripId} />
            <p className="field flex items-center bg-paper-deep font-semibold">
              {trips.find((trip) => trip.id === lockedTripId)?.title ?? "選択中の旅"}
            </p>
          </>
        ) : (
          <select
            id="tripId"
            name="tripId"
            className="field"
            value={tripId}
            onChange={(e) => setTripId(e.target.value)}
            required
          >
            <option value="">選択してください</option>
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.title}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field label="一緒に行った人" htmlFor="companions" optional>
        <input
          id="companions"
          name="companions"
          type="text"
          className="field"
          defaultValue={state.values?.companions ?? defaults.companions}
          placeholder="友人と"
          maxLength={120}
        />
      </Field>

      <RatingInput
        name="rating"
        defaultValue={Number(state.values?.rating ?? defaults.rating) || 0}
        draftKey={mode === "create" && visitId ? `visit-new-${visitId}-rating` : null}
      />

      <Field label="感想" htmlFor="comment" optional error={state.fieldErrors?.comment}>
        <textarea
          id="comment"
          name="comment"
          rows={4}
          className="field"
          defaultValue={state.values?.comment ?? defaults.comment}
          placeholder="コーヒーが美味しかった！また行きたい。"
          maxLength={2000}
        />
      </Field>

      {tripId && visitId ? (
        <PhotoUploader
          name="photoPaths"
          userId={userId}
          draftKey={`visit-${visitId}`}
          max={MAX_PHOTOS_PER_VISIT}
          initial={initialPhotos}
          persistDraft={mode === "create"}
        />
      ) : (
        <p className="rounded-2xl bg-paper-deep px-4 py-3 text-xs text-ink-soft">
          写真を追加するには、先に旅行を選んでください。
        </p>
      )}

      {/* すぐ押せることに意味があるので、折りたたみの外に出しておく */}
      <div className="rough-card space-y-2 px-4 py-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="revisitWanted"
            defaultChecked={state.values ? state.values.revisitWanted === "on" : defaults.revisitWanted}
            className="h-5 w-5 accent-[#7fa568]"
          />
          また行きたい
          <span className="text-xs text-ink-faint">（マイページにまとまります）</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="favorite"
            defaultChecked={state.values ? state.values.favorite === "on" : defaults.favorite}
            className="h-5 w-5 accent-[#dd9aa6]"
          />
          お気に入りに追加する
        </label>
      </div>

      <details className="rough-card px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-ink-soft">くわしく記録する</summary>
        <div className="mt-4 space-y-4">
          <Field label="メモ" htmlFor="note" optional>
            <textarea
              id="note"
              name="note"
              rows={3}
              className="field"
              defaultValue={state.values?.note ?? defaults.note}
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
                defaultValue={state.values?.amount ?? defaults.amount}
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
                defaultValue={state.values?.stayMinutes ?? defaults.stayMinutes}
                placeholder="60"
              />
            </Field>
          </div>

          <Field label="混雑状況" htmlFor="congestionLevel" optional>
            <select
              id="congestionLevel"
              name="congestionLevel"
              className="field"
              defaultValue={state.values?.congestionLevel ?? defaults.congestionLevel}
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
              defaultValue={state.values?.tags ?? defaults.tags}
              placeholder="ひとり時間 コーヒー"
            />
          </Field>

        </div>
      </details>

      <SubmitButton pendingLabel="保存中…" disabled={!visitId}>
        保存する
      </SubmitButton>
    </form>
  );
}
