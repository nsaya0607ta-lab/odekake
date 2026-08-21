"use client";

import { useActionState } from "react";
import { createFriendPhotosAction } from "@/app/actions/sns";
import { emptyActionState, Field, FormMessage, SubmitButton } from "@/components/form";
import { IconImage, IconLock, IconSend } from "@/components/icons";
import { PhotoUploader } from "@/components/photo-uploader";

export function SnsPostForm({ userId, groupId }: { userId: string; groupId: string }) {
  const [state, action] = useActionState(createFriendPhotosAction, emptyActionState);

  return (
    <form action={action} className="sns-form-panel space-y-4">
      <input type="hidden" name="groupId" value={groupId} />
      <div className="sns-form-audience">
        <span className="sns-form-audience-icon is-photo" aria-hidden="true"><IconLock size={15} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-black text-ink-soft">グループ限定公開</span>
          <span className="block text-[10px] text-ink-faint">今日中に投稿・メンバーだけが閲覧</span>
        </span>
      </div>

      <section className="sns-form-section is-photo">
        <div className="mb-2 flex items-center gap-2">
          <span className="sns-form-step">1</span>
          <IconImage size={17} className="text-[#d94e86]" />
          <p className="text-sm font-black">写真を選ぶ</p>
          <span className="sns-compose-optional">最大10枚</span>
        </div>
        <PhotoUploader
          name="photoPaths"
          userId={userId}
          draftKey={`sns-group-${groupId}-new`}
          max={10}
          label="写真を追加"
          persistDraft
        />
      </section>

      <section className="sns-form-section is-message">
        <div className="mb-2 flex items-center gap-2">
          <span className="sns-form-step">2</span>
          <p className="text-sm font-black">ひとこと</p>
          <span className="sns-compose-optional">任意</span>
        </div>
        <Field label="写真に共通のメッセージ" htmlFor="caption" optional>
          <textarea
            id="caption"
            name="caption"
            rows={3}
            className="field sns-compose-textarea"
            placeholder="今日の一枚"
            maxLength={300}
          />
        </Field>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
          複数枚はそれぞれ別の写真として並び、同じひとことが付きます。
        </p>
      </section>

      <FormMessage state={state} />
      <SubmitButton pendingLabel="アルバムへ追加中…" className="sns-primary-submit pressable">
        <IconSend size={18} />
        アルバムへ投稿
        <span aria-hidden="true">✦</span>
      </SubmitButton>
    </form>
  );
}
