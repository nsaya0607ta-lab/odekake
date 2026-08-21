"use client";

import { useEffect, useRef, useState } from "react";
import { IconAt } from "@/components/icons";

export type SnsMentionOption = { id: string; label: string };

/** @ボタンから候補を選び、対象textareaのカーソル位置へ安全に表示名を挿入する。 */
export function SnsMentionPicker({
  textareaId,
  options,
  compact = false,
}: {
  textareaId: string;
  options: SnsMentionOption[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePress(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (options.length === 0) return null;

  function insert(label: string) {
    const textarea = document.getElementById(textareaId);
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    const before = textarea.value.slice(0, start);
    const prefix = before.length > 0 && !/\s$/.test(before) ? " " : "";
    const value = `${prefix}@${label} `;
    textarea.setRangeText(value, start, end, "end");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    textarea.focus();
    setOpen(false);
    if ("vibrate" in navigator) navigator.vibrate?.(5);
  }

  return (
    <div ref={rootRef} className={`sns-mention-picker ${compact ? "is-compact" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="メンションする人を選ぶ"
        className="sns-mention-trigger pressable"
      >
        <IconAt size={16} />
        メンション
      </button>
      {open ? (
        <div className="sns-mention-options" role="listbox" aria-label="メンションする人">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected="false"
              onClick={() => insert(option.label)}
              className="pressable"
            >
              @{option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
