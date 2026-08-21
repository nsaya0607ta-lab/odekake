"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { IconClose } from "@/components/icons";

/**
 * 投稿カード内にメニューを置くと、画面端・content-visibility・親要素の
 * transform の影響で切れることがある。document.body へポータルし、
 * 常にビューポート内へ収まるモバイル向け操作シートとして表示する。
 */
export function SnsActionSheet({
  open,
  onClose,
  title,
  description,
  returnFocusRef,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const returnFocusTo = returnFocusRef?.current;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus({ preventScroll: true });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      returnFocusTo?.focus({ preventScroll: true });
    };
  }, [open, returnFocusRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="sns-action-sheet-layer"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="sns-action-sheet"
      >
        <span className="sns-action-sheet-handle" aria-hidden="true" />
        <div className="sns-action-sheet-header">
          <span className="min-w-0 flex-1">
            <strong id={titleId}>{title}</strong>
            {description ? <small id={descriptionId}>{description}</small> : null}
          </span>
          <button type="button" onClick={onClose} className="sns-action-sheet-close pressable" aria-label="メニューを閉じる">
            <IconClose size={18} />
          </button>
        </div>
        <div className="sns-action-sheet-list">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
