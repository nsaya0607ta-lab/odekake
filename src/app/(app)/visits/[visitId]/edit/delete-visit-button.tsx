"use client";

import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

export function DeleteVisitButton() {
  return (
    <ConfirmSubmitButton
      message="この訪問履歴を削除します。写真もあわせて削除されます。よろしいですか？"
      pendingLabel="削除中…"
    >
      この訪問履歴を削除する
    </ConfirmSubmitButton>
  );
}
