"use client";

import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type MutationAction = (formData: FormData) => Promise<{ ok: true } | { ok: false; error: string }>;

/** 確認が必要な削除操作を、待機・失敗表示・画面更新まで一貫して扱う。 */
export function SnsConfirmMutationButton({
  action,
  fields,
  message,
  children,
  className,
  pendingLabel,
  successHref,
}: {
  action: MutationAction;
  fields: Record<string, string>;
  message: string;
  children: ReactNode;
  className?: string;
  pendingLabel?: string;
  successHref?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!window.confirm(message)) return;
    setError("");
    startTransition(async () => {
      const formData = new FormData();
      Object.entries(fields).forEach(([key, value]) => formData.set(key, value));
      try {
        const result = await action(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        if (successHref) router.replace(successHref);
        else router.refresh();
      } catch {
        setError("通信に失敗しました。もう一度お試しください。");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        aria-busy={isPending}
        className={className}
      >
        {isPending && pendingLabel ? pendingLabel : children}
      </button>
      {error ? <span className="sns-menu-toast" role="alert">{error}</span> : null}
    </>
  );
}
