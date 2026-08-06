"use client";

import { useActionState } from "react";
import { updateTripAction } from "@/app/actions/trips";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";
import { PhotoUploader } from "@/components/photo-uploader";
import type { TripRow } from "@/lib/supabase/types";

export function TripSettingsForm({
  userId,
  trip,
  coverUrl,
}: {
  userId: string;
  trip: TripRow;
  coverUrl: string | null;
}) {
  const [state, formAction] = useActionState(updateTripAction, emptyActionState);

  return (
    <form action={formAction} className="rough-card space-y-5 p-4" noValidate>
      <input type="hidden" name="tripId" value={trip.id} />
      <input type="hidden" name="tripType" value={trip.trip_type} />

      <FormMessage state={state} />

      <Field label="旅行名" htmlFor="trip-title" error={state.fieldErrors?.title}>
        <input
          id="trip-title"
          name="title"
          type="text"
          className="field"
          defaultValue={state.values?.title ?? trip.title}
          maxLength={60}
          required
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="開始日" htmlFor="trip-start" optional>
          <input
            id="trip-start"
            name="startDate"
            type="date"
            className="field field-date-pair"
            defaultValue={state.values?.startDate ?? trip.start_date ?? ""}
          />
        </Field>
        <Field label="終了日" htmlFor="trip-end" optional error={state.fieldErrors?.endDate}>
          <input
            id="trip-end"
            name="endDate"
            type="date"
            className="field field-date-pair"
            defaultValue={state.values?.endDate ?? trip.end_date ?? ""}
          />
        </Field>
      </div>

      <Field label="説明" htmlFor="trip-description" optional>
        <textarea
          id="trip-description"
          name="description"
          rows={3}
          className="field"
          defaultValue={state.values?.description ?? trip.description ?? ""}
          maxLength={1000}
        />
      </Field>

      <PhotoUploader
        name="coverPaths"
        userId={userId}
        draftKey={`trip-cover-${trip.id}`}
        max={1}
        label="表紙画像"
        initial={trip.cover_image_url && coverUrl ? [{ path: trip.cover_image_url, url: coverUrl }] : []}
      />

      <SubmitButton pendingLabel="保存中…">保存する</SubmitButton>
    </form>
  );
}
