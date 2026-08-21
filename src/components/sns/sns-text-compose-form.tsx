"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createFriendTextPostAction } from "@/app/actions/sns";
import { emptyActionState, FormMessage, SubmitButton } from "@/components/form";
import { IconCalendar, IconImage, IconMapPin, IconSend, IconUsers } from "@/components/icons";
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
    <form action={action} className="sns-compose-sheet sns-form-panel space-y-4">
      <div className="sns-form-audience" aria-label="公開範囲">
        <span className="sns-form-audience-icon" aria-hidden="true"><IconUsers size={16} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-black tracking-[0.12em] text-ink-faint">SHARE WITH</span>
          <span className="block text-xs font-black text-ink-soft">フレンドに公開</span>
        </span>
        <span className="sns-form-ready-dot" aria-hidden="true" />
      </div>

      <section className="sns-form-section is-message">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="sns-post-body" className="flex items-center gap-2 text-sm font-black">
            <span className="sns-form-step">1</span>
            ひとこと
          </label>
          <span className={`sns-character-count ${length > 250 ? "is-near-limit" : ""}`}>
            {length} / 280
          </span>
        </div>
        <textarea
          id="sns-post-body"
          name="body"
          rows={6}
          maxLength={280}
          className="field sns-compose-textarea border-0 text-[16px] leading-relaxed"
          placeholder="今日のおでかけ、どんな気分？"
          defaultValue={initialBody}
          onChange={(event) => setLength(event.currentTarget.value.length)}
        />
      </section>
      <section className="sns-form-section is-photo">
        <div className="mb-2 flex items-center gap-2">
          <span className="sns-form-step">2</span>
          <IconImage size={17} className="text-[#d94e86]" />
          <p className="text-sm font-black">写真を添える</p>
          <span className="sns-compose-optional">任意・最大4枚</span>
        </div>
        <PhotoUploader name="photoPaths" userId={userId} draftKey="sns-home-new" max={4} label="写真を選ぶ" persistDraft />
      </section>
      <section className="sns-compose-visit-card">
        <div className="flex items-start gap-3">
          <span className="sns-compose-visit-icon" aria-hidden="true">
            <IconMapPin size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="sns-form-step">3</span>
              <label htmlFor="sns-linked-visit" className="text-sm font-black">おでかけを添える</label>
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
      <SubmitButton pendingLabel="旅の便りを送信中…" className="sns-primary-submit pressable">
        <IconSend size={18} />
        つぶやく
        <span aria-hidden="true">✦</span>
      </SubmitButton>
    </form>
  );
}
