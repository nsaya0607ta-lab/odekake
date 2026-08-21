"use client";

import { useEffect, useRef, useState } from "react";
import { deleteFriendTextPostAction } from "@/app/actions/sns";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { IconMore, IconTrash } from "@/components/icons";

/** 自分の投稿カード右上に出す「…」メニュー。押すと削除だけを選べる */
export function PostOptionsMenu({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="投稿のメニュー"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="pressable flex h-11 w-11 items-center justify-center rounded-full text-ink-faint transition-colors active:bg-paper-deep"
      >
        <IconMore size={17} />
      </button>

      {open ? (
        <div className="sns-post-options-popover">
          <form action={deleteFriendTextPostAction}>
            <input type="hidden" name="postId" value={postId} />
            <ConfirmSubmitButton
              message="このつぶやきを削除しますか？"
              pendingLabel="削除中…"
              className="pressable flex min-h-11 w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-bold text-red-600 active:bg-paper-deep"
            >
              <IconTrash size={16} />
              削除
            </ConfirmSubmitButton>
          </form>
        </div>
      ) : null}
    </div>
  );
}
