"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { IconSpinner } from "./icons";

/** サーバーアクションの共通戻り値。入力値を保持してフォームが消えないようにする */
export type ActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

export const emptyActionState: ActionState = {};

export function SubmitButton({
  children,
  className = "btn btn-primary w-full",
  pendingLabel = "送信中…",
  disabled,
}: {
  children: ReactNode;
  className?: string;
  pendingLabel?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled} aria-busy={pending}>
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

export function FormMessage({ state }: { state: ActionState }) {
  if (!state.error && !state.message) return null;
  const isError = Boolean(state.error);
  return (
    <p
      role="status"
      aria-live="polite"
      className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
        isError
          ? "border-blossom bg-blossom-soft text-[#8f4c59]"
          : "border-leaf bg-leaf-soft text-leaf-deep"
      }`}
    >
      {state.error ?? state.message}
    </p>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-[#a85c6a]">{message}</p>;
}

export function Field({
  label,
  htmlFor,
  hint,
  optional,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  optional?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {optional ? <span className="ml-1.5 text-[11px] font-normal text-ink-faint">（任意）</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
      <FieldError message={error} />
    </div>
  );
}
