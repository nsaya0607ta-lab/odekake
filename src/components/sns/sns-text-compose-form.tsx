"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createFriendTextPostAction } from "@/app/actions/sns";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";
import { IconCalendar, IconMapPin } from "@/components/icons";
import { PhotoUploader } from "@/components/photo-uploader";
import type { SnsLinkableVisit } from "@/lib/data/sns";

function formatVisitDate(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${year}/${month}/${day}` : value;
}

/** Twitterのような短文投稿フォーム。写真は最大4枚まで添付できる */
export function SnsTextComposeForm({
  userId,
  visitOptions,
}: {
  userId: string;
  visitOptions: SnsLinkableVisit[];
}) {
  const [state, action] = useActionState(createFriendTextPostAction, emptyActionState);
  const initialBody = state.values?.body ?? "";
  const [length, setLength] = useState(initialBody.length);
  const [selectedVisitId, setSelectedVisitId] = useState(state.values?.linkedVisitId ?? "");
  const selectedVisit = visitOptions.find((visit) => visit.id === selectedVisitId);

  return (
    <form action={action} className="sns-compose-sheet space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="sns-post-body" className="text-sm font-bold">ひとこと</label>
          <span className={`text-[11px] font-bold ${length > 250 ? "text-blossom" : "text-ink-faint"}`}>
            {length} / 280
          </span>
        </div>
        <textarea
          id="sns-post-body"
          name="body"
          rows={6}
          maxLength={280}
          className="field border-0 bg-card/70 text-[16px] leading-relaxed shadow-inner ring-1 ring-line"
          placeholder="今日のおでかけ、どんな気分？"
          defaultValue={initialBody}
          onChange={(event) => setLength(event.currentTarget.value.length)}
        />
      </div>
      <div className="rounded-2xl bg-card/65 p-3 ring-1 ring-line">
        <PhotoUploader name="photoPaths" userId={userId} draftKey="sns-home-new" max={4} label="写真を添える（最大4枚）" />
      </div>
      <section className="sns-compose-visit-card">
        <div className="flex items-start gap-3">
          <span className="sns-compose-visit-icon" aria-hidden="true">
            <IconMapPin size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <label htmlFor="sns-linked-visit" className="text-sm font-bold">おでかけを添える</label>
              <span className="sns-compose-optional">任意</span>
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-faint">
              記録済みの場所を選ぶと、場所と旅行が一緒に表示されます。
            </p>
          </div>
        </div>

        {visitOptions.length > 0 ? (
          <>
            <select
              id="sns-linked-visit"
              name="linkedVisitId"
              className="sns-compose-visit-select"
              value={selectedVisitId}
              onChange={(event) => setSelectedVisitId(event.currentTarget.value)}
            >
              <option value="">紐づけない</option>
              {visitOptions.map((visit) => (
                <option key={visit.id} value={visit.id}>
                  {visit.spotName} ・ {visit.tripTitle}（{formatVisitDate(visit.visitedAt)}）
                </option>
              ))}
            </select>
            {selectedVisit ? (
              <div className="sns-compose-visit-preview" aria-live="polite">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{selectedVisit.spotName}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-ink-soft">{selectedVisit.tripTitle}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-ink-faint">
                  <IconCalendar size={13} />
                  {formatVisitDate(selectedVisit.visitedAt)}
                </span>
              </div>
            ) : null}
          </>
        ) : (
          <p className="mt-3 rounded-xl bg-white/60 px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
            まだ紐づけられる記録がありません。先に<Link href="/add" className="font-bold text-leaf-deep underline underline-offset-2">場所を記録</Link>すると選べます。
          </p>
        )}
      </section>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="投稿中…" className="btn btn-primary w-full shadow-md">つぶやく</SubmitButton>
    </form>
  );
}
