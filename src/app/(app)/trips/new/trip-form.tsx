"use client";

import { useActionState, useEffect, useState } from "react";
import { createTripAction } from "@/app/actions/trips";
import { FormDraft } from "@/components/form-draft";
import { emptyActionState, FieldError, FormMessage, SubmitButton } from "@/components/form";
import { IconChevronRight, IconUser, IconUsers } from "@/components/icons";
import { PhotoUploader } from "@/components/photo-uploader";
import { TripDestinationPicker } from "@/components/trip-destination-picker";

export function TripForm({
  userId,
  next = null,
  roots,
  initialParentId,
}: {
  userId: string;
  /** 作成後の戻り先。「先に旅行を作る」導線から来たときに使う */
  next?: string | null;
  roots: Array<{ id: string; title: string; kind: "personal" | "shared" }>;
  initialParentId?: string;
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

  const fallbackParentId = initialParentId ?? roots[0]?.id ?? "";
  const [parentTripId, setParentTripId] = useState(state.values?.parentTripId ?? fallbackParentId);

  useEffect(() => {
    if (state.values?.parentTripId) setParentTripId(state.values.parentTripId);
  }, [state.values?.parentTripId]);

  const selectedRoot = roots.find((root) => root.id === parentTripId) ?? roots[0] ?? null;

  return (
    <form
      id={formId}
      action={formAction}
      className="space-y-6 pb-3"
      noValidate
      onSubmit={() => window.sessionStorage.removeItem(tripIdStorageKey)}
    >
      <FormDraft formId={formId} storageKey={draftKey} />
      <input type="hidden" name="tripId" value={tripId} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <FormMessage state={state} />

      <section className="space-y-2">
        <p className="field-label mb-0">保存先</p>
        <div className="rough-card relative flex min-h-[76px] items-center gap-3 overflow-hidden px-4 py-3.5">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              selectedRoot?.kind === "shared" ? "bg-sky-soft text-sky" : "bg-leaf-soft text-leaf-deep"
            }`}
          >
            {selectedRoot?.kind === "shared" ? <IconUsers size={24} /> : <IconUser size={24} />}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-ink-faint">
              {selectedRoot?.kind === "shared" ? "共有旅" : "個人旅"}
            </span>
            <span className="mt-0.5 block truncate text-base font-bold">{selectedRoot?.title ?? "選択してください"}</span>
          </span>

          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-ink-soft">
            変更
            <IconChevronRight size={18} />
          </span>

          <select
            id="parentTripId"
            name="parentTripId"
            value={parentTripId}
            onChange={(event) => setParentTripId(event.target.value)}
            required
            aria-label="旅行の保存先を変更"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          >
            <option value="">選択してください</option>
            {roots.map((root) => (
              <option key={root.id} value={root.id}>
                {root.kind === "personal" ? "個人旅" : "共有旅"}｜{root.title}
              </option>
            ))}
          </select>
        </div>
        <FieldError message={state.fieldErrors?.parentTripId} />
      </section>

      <section>
        <label className="field-label flex items-center gap-2" htmlFor="title">
          <span>旅行名</span>
          <span className="rounded-md bg-leaf-soft px-1.5 py-0.5 text-[11px] font-bold text-leaf-deep">必須</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          className="field min-h-[58px] px-4 text-base font-semibold"
          defaultValue={state.values?.title ?? ""}
          placeholder="大阪・USJ旅行"
          maxLength={60}
          required
        />
        <FieldError message={state.fieldErrors?.title} />
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline gap-2">
          <p className="field-label mb-0">日程</p>
          <span className="text-[11px] text-ink-faint">あとから設定できます</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
          <div className="rough-card min-w-0 px-3 py-3 text-center">
            <label htmlFor="startDate" className="mb-1 block text-xs font-semibold text-ink-faint">
              出発日
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              className="block min-h-8 w-full bg-transparent p-0 text-center text-[16px] font-bold text-ink outline-none"
              defaultValue={state.values?.startDate ?? ""}
            />
          </div>
          <span className="text-lg text-ink-faint" aria-hidden="true">
            ▶
          </span>
          <div className="rough-card min-w-0 px-3 py-3 text-center">
            <label htmlFor="endDate" className="mb-1 block text-xs font-semibold text-ink-faint">
              終了日
            </label>
            <input
              id="endDate"
              name="endDate"
              type="date"
              className="block min-h-8 w-full bg-transparent p-0 text-center text-[16px] font-bold text-ink outline-none"
              defaultValue={state.values?.endDate ?? ""}
            />
          </div>
        </div>
        <FieldError message={state.fieldErrors?.startDate ?? state.fieldErrors?.endDate} />
      </section>

      <TripDestinationPicker
        initial={state.values?.destinationAreas ?? []}
        error={state.fieldErrors?.destinationAreas}
      />

      <section className="space-y-2">
        <p className="field-label mb-0">
          表紙 <span className="ml-1 text-[11px] font-normal text-ink-faint">（任意）</span>
        </p>
        <div className="rough-card bg-sun-soft/25 p-3.5 [&_.field-label]:hidden [&_.grid]:grid-cols-1 [&_.grid]:gap-0 [&_.grid>button]:aspect-auto [&_.grid>button]:min-h-[104px] [&_.grid>button]:border-0 [&_.grid>button]:bg-transparent [&_.grid>button]:text-ink-soft [&_.grid>div]:aspect-[16/7]">
          <PhotoUploader
            name="coverPaths"
            userId={userId}
            draftKey="trip-new-cover"
            max={1}
            label="表紙画像"
            persistDraft
          />
          <p className="pointer-events-none -mt-7 text-center text-[11px] text-ink-faint">未設定の場合は自動デザインを使用</p>
        </div>
      </section>

      <section>
        <label className="field-label" htmlFor="description">
          ひとこと <span className="ml-1 text-[11px] font-normal text-ink-faint">（任意）</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className="field min-h-[92px] px-4 py-3"
          defaultValue={state.values?.description ?? ""}
          placeholder="例：久しぶりの家族旅行"
          maxLength={1000}
        />
      </section>

      <SubmitButton
        pendingLabel="作成中…"
        disabled={!tripId || !parentTripId}
        className="btn w-full border-2 border-leaf bg-card text-leaf-deep"
      >
        この旅行を作成する
      </SubmitButton>
    </form>
  );
}
