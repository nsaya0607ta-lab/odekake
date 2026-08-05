"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { IconSpinner } from "./icons";

/** 取り消せない操作の前に確認ダイアログを出す送信ボタン */
export function ConfirmSubmitButton({
  children,
  message,
  className = "btn btn-danger w-full",
  pendingLabel = "処理中…",
}: {
  children: ReactNode;
  message: string;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-busy={pending}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {pending ? (
        <>
          <IconSpinner size={18} />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
