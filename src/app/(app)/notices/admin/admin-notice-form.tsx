"use client";

import { useActionState } from "react";
import { postAdminNoticeAction } from "./actions";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";
import { HtmlFileUploader } from "@/components/html-file-uploader";
import { PhotoUploader } from "@/components/photo-uploader";

export function AdminNoticeForm({ userId }: { userId: string }) {
  const [state, formAction] = useActionState(postAdminNoticeAction, emptyActionState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />

      <Field label="タイトル" htmlFor="title" hint="100文字以内。お知らせ一覧にはこのタイトルだけが表示されます。">
        <input
          id="title"
          name="title"
          type="text"
          className="field"
          maxLength={100}
          defaultValue={state.values?.title ?? ""}
          placeholder="例：メンテナンスのお知らせ"
          required
        />
      </Field>

      <Field label="本文" htmlFor="message" hint="2000文字以内。タップして開いた詳細画面に表示されます。">
        <textarea
          id="message"
          name="message"
          className="field"
          rows={6}
          maxLength={2000}
          defaultValue={state.values?.message ?? ""}
          placeholder="お知らせの詳しい内容を入力してください"
          required
        />
      </Field>

      <PhotoUploader
        name="imagePaths"
        userId={userId}
        draftKey="admin-notice-new"
        max={1}
        label="画像（任意）"
        persistDraft
      />

      <Field label="リンクURL" htmlFor="linkUrl" hint="任意。httpまたはhttpsから始まるURL。詳細画面にリンクとして表示されます。">
        <input
          id="linkUrl"
          name="linkUrl"
          type="url"
          className="field"
          maxLength={2000}
          placeholder="https://example.com"
        />
      </Field>

      <HtmlFileUploader name="htmlPaths" userId={userId} draftKey="admin-notice-new-html" />

      <SubmitButton pendingLabel="配信中…">全ユーザーに配信する</SubmitButton>
    </form>
  );
}
