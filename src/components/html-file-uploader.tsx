"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconClose, IconPlus, IconSpinner } from "./icons";
import { NOTICE_HTML_BUCKET } from "@/lib/data/client";
import { toJapaneseStorageError } from "@/lib/errors";
import { isTemporaryPath, tmpPrefixFor, userTmpPrefixFor } from "@/lib/photos";
import { createClient } from "@/lib/supabase/client";

const ACCEPTED_HTML_TYPES = ["text/html"];

export type UploadedHtmlFile = { path: string; name: string };

type PendingItem = {
  localId: string;
  file: File;
  status: "uploading" | "error";
  error?: string;
};

/**
 * HTMLファイルを1つだけ、Supabase Storage へ直接アップロードして
 * 保存済みのパスを hidden input で送信する（PhotoUploaderのHTML版、圧縮なし）。
 *
 * 添付されたHTMLは同一オリジンの /api/photo 経由で配信されるため、表示側は必ず
 * sandbox 付き iframe（script・same-origin を許可しない）に埋め込むこと。
 */
export function HtmlFileUploader({
  name,
  userId,
  draftKey,
  initial = null,
  label = "添付ページ（HTML）",
}: {
  name: string;
  userId: string;
  draftKey: string;
  initial?: UploadedHtmlFile | null;
  label?: string;
}) {
  const [uploaded, setUploaded] = useState<UploadedHtmlFile | null>(initial);
  const [pending, setPending] = useState<PendingItem | null>(null);
  const [draftToken, setDraftToken] = useState("");
  const [rejectionNotice, setRejectionNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storageKey = `odekake:html-draft:${draftKey}`;
    const saved = window.sessionStorage.getItem(storageKey);
    if (saved) {
      setDraftToken(saved);
      return;
    }
    const generated = crypto.randomUUID();
    window.sessionStorage.setItem(storageKey, generated);
    setDraftToken(generated);
  }, [draftKey]);

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;

    const blocked = pending !== null;
    if (blocked) form.dataset.htmlUploadBlocked = "true";
    else delete form.dataset.htmlUploadBlocked;

    const guardSubmit = (event: Event) => {
      if (!blocked) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    form.addEventListener("submit", guardSubmit, true);
    return () => {
      form.removeEventListener("submit", guardSubmit, true);
      delete form.dataset.htmlUploadBlocked;
    };
  }, [pending]);

  const upload = useCallback(
    async (item: PendingItem) => {
      try {
        const supabase = createClient();
        const fileName = `${crypto.randomUUID()}.html`;
        const token = draftToken || item.localId;

        const sendTo = (prefix: string) =>
          supabase.storage
            .from(NOTICE_HTML_BUCKET)
            .upload(`${prefix}/${fileName}`, item.file, {
              contentType: "text/html",
              upsert: false,
              cacheControl: "31536000",
            });

        let path = `${tmpPrefixFor(userId, token)}/${fileName}`;
        let { error } = await sendTo(tmpPrefixFor(userId, token));

        // tmp/ を許可するStorageポリシーが未適用のデータベースでも、
        // 自分専用フォルダの中の一時領域なら書き込める。
        if (error) {
          path = `${userTmpPrefixFor(userId, token)}/${fileName}`;
          ({ error } = await sendTo(userTmpPrefixFor(userId, token)));
        }

        if (error) throw error;

        setPending(null);
        setUploaded({ path, name: item.file.name });
      } catch (error) {
        setPending({ ...item, status: "error", error: toJapaneseStorageError(error as { message?: string }) });
      }
    },
    [userId, draftToken],
  );

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    const isHtml = ACCEPTED_HTML_TYPES.includes(file.type) || file.name.toLowerCase().endsWith(".html");
    if (!isHtml) {
      setRejectionNotice("対応していない形式です。拡張子が.htmlのファイルをお使いください。");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setRejectionNotice(null);

    const item: PendingItem = { localId: crypto.randomUUID(), file, status: "uploading" };
    setPending(item);
    void upload(item);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeUploaded = async () => {
    if (!uploaded) return;
    const path = uploaded.path;
    setUploaded(null);
    if (!isTemporaryPath(path)) return;
    try {
      const supabase = createClient();
      await supabase.storage.from(NOTICE_HTML_BUCKET).remove([path]);
    } catch {
      // 表示からは消えているので、実ファイルの削除失敗は無視する
    }
  };

  return (
    <div ref={rootRef}>
      <p className="field-label">{label}</p>
      <input type="hidden" name={name} value={JSON.stringify(uploaded ? [uploaded.path] : [])} />

      {uploaded ? (
        <div className="flex items-center gap-2 rounded-2xl border border-line-strong bg-card px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-ink-soft">{uploaded.name}</span>
          <button
            type="button"
            onClick={() => void removeUploaded()}
            aria-label="このファイルを削除"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper-deep text-ink-soft"
          >
            <IconClose size={16} />
          </button>
        </div>
      ) : pending ? (
        <div className="flex items-center gap-2 rounded-2xl border border-line-strong bg-card px-3 py-2 text-sm">
          {pending.status === "uploading" ? (
            <>
              <IconSpinner size={16} />
              <span className="text-ink-soft">送信中…</span>
            </>
          ) : (
            <>
              <span className="min-w-0 flex-1 truncate text-[#a85c6a]">{pending.error ?? "送信に失敗しました"}</span>
              <button
                type="button"
                onClick={() => {
                  const retry = { ...pending, status: "uploading" as const };
                  setPending(retry);
                  void upload(retry);
                }}
                className="shrink-0 rounded-lg bg-paper-deep px-2 py-1 font-semibold text-[#95505e]"
              >
                再試行
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                aria-label="このファイルを取り消す"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper-deep text-ink-soft"
              >
                <IconClose size={16} />
              </button>
            </>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong bg-card px-3 py-2.5 text-sm text-ink-faint transition-colors active:bg-paper-deep"
        >
          <IconPlus size={18} />
          HTMLファイルを選択
        </button>
      )}

      {rejectionNotice ? <p className="mt-2 text-xs leading-relaxed text-[#a85c6a]">{rejectionNotice}</p> : null}

      <input
        ref={inputRef}
        type="file"
        accept=".html,text/html"
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
