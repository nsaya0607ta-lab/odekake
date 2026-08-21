"use client";

import { useEffect, useRef, useState } from "react";
import { deleteFriendTextPostAction } from "@/app/actions/sns";
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
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label="投稿のメニュー"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-ink-faint transition-colors active:bg-paper-deep"
      >
        <IconMore size={17} />
      </button>

      {open ? (
        <div className="absolute top-full right-0 z-40 mt-1 w-32 overflow-hidden rounded-2xl border border-line bg-card shadow-lg">
          <form action={deleteFriendTextPostAction}>
            <input type="hidden" name="postId" value={postId} />
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-semibold text-red-600 active:bg-paper-deep"
            >
              <IconTrash size={16} />
              削除
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
