"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  deleteFriendTextPostAction,
  reportSnsPostAction,
  setFriendTextPostPinAction,
  setSnsUserBlockAction,
} from "@/app/actions/sns";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { IconFlag, IconMore, IconPin, IconShield, IconTrash } from "@/components/icons";

/** 投稿右上の共通メニュー。自分は固定・削除、友達は通報・ブロックを表示する。 */
export function PostOptionsMenu({
  postId,
  authorUserId,
  isMine,
  pinned,
}: {
  postId: string;
  authorUserId: string;
  isMine: boolean;
  pinned: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [, startTransition] = useTransition();
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

  function mutate(action: (data: FormData) => Promise<{ ok: boolean; error?: string }>, data: FormData, success: string) {
    setOpen(false);
    startTransition(async () => {
      const result = await action(data);
      setMessage(result.ok ? success : result.error ?? "操作できませんでした。");
      window.setTimeout(() => setMessage(""), 2800);
    });
  }

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
          {isMine ? (
            <>
              <button
                type="button"
                className="pressable sns-post-option"
                onClick={() => {
                  const data = new FormData();
                  data.set("postId", postId);
                  data.set("pinned", pinned ? "0" : "1");
                  mutate(setFriendTextPostPinAction, data, pinned ? "固定を解除しました。" : "プロフィールに固定しました。");
                }}
              >
                <IconPin size={16} filled={pinned} />
                {pinned ? "固定を解除" : "プロフィールに固定"}
              </button>
              <form action={deleteFriendTextPostAction}>
                <input type="hidden" name="postId" value={postId} />
                <ConfirmSubmitButton
                  message="このつぶやきを削除しますか？"
                  pendingLabel="削除中…"
                  className="pressable sns-post-option is-danger"
                >
                  <IconTrash size={16} />
                  削除
                </ConfirmSubmitButton>
              </form>
            </>
          ) : (
            <>
              <button
                type="button"
                className="pressable sns-post-option"
                onClick={() => {
                  if (!window.confirm("この投稿を運営へ通報しますか？")) return;
                  const data = new FormData();
                  data.set("postId", postId);
                  data.set("reason", "不適切な投稿");
                  mutate(reportSnsPostAction, data, "通報を送信しました。");
                }}
              >
                <IconFlag size={16} />
                投稿を通報
              </button>
              <button
                type="button"
                className="pressable sns-post-option is-danger"
                onClick={() => {
                  if (!window.confirm("このユーザーをブロックしますか？投稿が表示されなくなります。")) return;
                  const data = new FormData();
                  data.set("userId", authorUserId);
                  data.set("blocked", "1");
                  mutate(setSnsUserBlockAction, data, "ユーザーをブロックしました。");
                }}
              >
                <IconShield size={16} />
                ユーザーをブロック
              </button>
            </>
          )}
        </div>
      ) : null}
      {message ? <span className="sns-menu-toast" role="status">{message}</span> : null}
    </div>
  );
}
