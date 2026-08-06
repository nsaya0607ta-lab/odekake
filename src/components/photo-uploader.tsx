"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconCamera, IconClose, IconPlus, IconSpinner } from "./icons";
import { toJapaneseStorageError } from "@/lib/errors";
import { ACCEPTED_IMAGE_TYPES, compressImage, extensionFor } from "@/lib/image";
import { isTemporaryPath, tmpPrefixFor } from "@/lib/photos";
import { createClient } from "@/lib/supabase/client";

export type UploadedPhoto = { path: string; url: string };

type StoredUploadedPhoto = UploadedPhoto & {
  /** 保存前に最終フォルダへ直接送った写真。取り消した場合は実ファイルも削除する */
  removeOnDelete?: boolean;
};

type PendingItem = {
  localId: string;
  file: File;
  previewUrl: string;
  status: "uploading" | "error";
  error?: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Supabase Storage へ直接アップロードし、保存済みのパスを hidden input で送信する。
 * 送信前にアップロードを終えるので、サーバーアクション側は失敗しにくい。
 *
 * 通常は一時領域 tmp/{user_id}/{draft_token}/ へ送り、保存時に本来の場所へ移動する。
 * 本番DBへ一時領域のStorageポリシーが未適用の場合は、訪問フォームに限り
 * trips/{trip_id}/visits/{visit_id}/ へ自動的に切り替えて保存する。
 */
export function PhotoUploader({
  name,
  userId,
  draftKey,
  max = 10,
  initial = [],
  label = "写真",
}: {
  name: string;
  userId: string;
  /** 下書きごとの識別子。同じ画面を開き直しても同じ一時フォルダを使う */
  draftKey: string;
  max?: number;
  initial?: UploadedPhoto[];
  label?: string;
}) {
  const [uploaded, setUploaded] = useState<StoredUploadedPhoto[]>(initial);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [draftToken, setDraftToken] = useState("");
  const [submitWarning, setSubmitWarning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storageKey = `odekake:photo-draft:${draftKey}`;
    const saved = window.sessionStorage.getItem(storageKey);
    if (saved) {
      setDraftToken(saved);
      return;
    }
    const generated = crypto.randomUUID();
    window.sessionStorage.setItem(storageKey, generated);
    setDraftToken(generated);
  }, [draftKey]);

  /**
   * 写真の送信中・失敗中は同じフォームの保存操作を止める。
   * React が管理している disabled 状態は直接上書きせず、フォーム属性と
   * capture フェーズのガードで、タップ・Enter の両方を確実に防ぐ。
   */
  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;

    const blocked = pending.length > 0;
    const uploading = pending.some((item) => item.status === "uploading");

    if (blocked) form.dataset.photoUploadBlocked = "true";
    else delete form.dataset.photoUploadBlocked;

    const guardSubmit = (event: Event) => {
      if (!blocked) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setSubmitWarning(
        uploading
          ? "写真の送信が完了するまでお待ちください。"
          : "送信に失敗した写真があります。再試行するか、写真を取り消してください。",
      );
    };

    form.addEventListener("submit", guardSubmit, true);
    if (!blocked) setSubmitWarning(null);

    return () => {
      form.removeEventListener("submit", guardSubmit, true);
      delete form.dataset.photoUploadBlocked;
    };
  }, [pending]);

  const total = uploaded.length + pending.length;
  const remaining = Math.max(0, max - total);

  const visitDestinationPrefix = useCallback((): string | null => {
    const form = rootRef.current?.closest("form");
    if (!form) return null;

    const valueOf = (fieldName: string) => {
      const field = form.elements.namedItem(fieldName);
      return field instanceof HTMLInputElement || field instanceof HTMLSelectElement ? field.value : "";
    };

    const tripId = valueOf("tripId");
    const visitId = valueOf("visitId");
    if (!UUID_PATTERN.test(tripId) || !UUID_PATTERN.test(visitId)) return null;
    return `trips/${tripId}/visits/${visitId}`;
  }, []);

  const upload = useCallback(
    async (item: PendingItem) => {
      try {
        const supabase = createClient();
        const blob = await compressImage(item.file);
        const extension = extensionFor(blob.type || item.file.type);
        const fileName = `${crypto.randomUUID()}.${extension}`;
        const temporaryPath = `${tmpPrefixFor(userId, draftToken || item.localId)}/${fileName}`;
        const directPrefix = visitDestinationPrefix();

        let path = temporaryPath;
        let removeOnDelete = false;
        let { error } = await supabase.storage.from("photos").upload(path, blob, {
          contentType: blob.type || item.file.type,
          upsert: false,
        });

        // 一時領域を許可するStorageポリシーが本番DBへ未適用でも、
        // 旅行へのアクセス権がある訪問フォームなら最終保存先へ直接送れる。
        if (error && directPrefix) {
          path = `${directPrefix}/${fileName}`;
          const directResult = await supabase.storage.from("photos").upload(path, blob, {
            contentType: blob.type || item.file.type,
            upsert: false,
          });
          error = directResult.error;
          removeOnDelete = !error;
        }

        if (error) throw error;

        const { data } = await supabase.storage.from("photos").createSignedUrl(path, 3600);

        setPending((list) => list.filter((p) => p.localId !== item.localId));
        setUploaded((list) => [...list, { path, url: data?.signedUrl ?? item.previewUrl, removeOnDelete }]);
      } catch (error) {
        setPending((list) =>
          list.map((p) =>
            p.localId === item.localId
              ? { ...p, status: "error", error: toJapaneseStorageError(error as { message?: string }) }
              : p,
          ),
        );
      }
    },
    [userId, draftToken, visitDestinationPrefix],
  );

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted = [...files]
      .filter((f) => ACCEPTED_IMAGE_TYPES.includes(f.type))
      .slice(0, remaining);

    const items: PendingItem[] = accepted.map((file) => ({
      localId: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: "uploading",
    }));

    setSubmitWarning(null);
    setPending((list) => [...list, ...items]);
    for (const item of items) void upload(item);

    if (inputRef.current) inputRef.current.value = "";
  };

  const removeUploaded = async (path: string) => {
    const photo = uploaded.find((item) => item.path === path);
    setUploaded((list) => list.filter((p) => p.path !== path));
    // 既存の保存済み写真は、フォーム保存前に実ファイルを消さない。
    // 一時写真と、この画面で最終フォルダへ直接送った写真だけ削除する。
    if (!isTemporaryPath(path) && !photo?.removeOnDelete) return;
    try {
      const supabase = createClient();
      await supabase.storage.from("photos").remove([path]);
    } catch {
      // 表示からは消えているので、実ファイルの削除失敗は無視する
    }
  };

  return (
    <div ref={rootRef}>
      <p className="field-label">
        {label}
        <span className="ml-1.5 text-[11px] font-normal text-ink-faint">（最大{max}枚）</span>
      </p>

      <input type="hidden" name={name} value={JSON.stringify(uploaded.map((p) => p.path))} />

      <div className="grid grid-cols-4 gap-2">
        {uploaded.map((photo) => (
          <div key={photo.path} className="relative aspect-square overflow-hidden rounded-2xl bg-paper-deep">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => void removeUploaded(photo.path)}
              aria-label="この写真を削除"
              className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-paper/90 text-ink-soft"
            >
              <IconClose size={16} />
            </button>
          </div>
        ))}

        {pending.map((item) => (
          <div key={item.localId} className="relative aspect-square overflow-hidden rounded-2xl bg-paper-deep">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.previewUrl} alt="" className="h-full w-full object-cover opacity-45" />
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center text-[10px] text-ink-soft">
              {item.status === "uploading" ? (
                <>
                  <IconSpinner size={20} />
                  送信中
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSubmitWarning(null);
                    setPending((list) =>
                      list.map((p) => (p.localId === item.localId ? { ...p, status: "uploading" } : p)),
                    );
                    void upload({ ...item, status: "uploading" });
                  }}
                  className="rounded-lg bg-paper/90 px-2 py-1 font-semibold text-[#95505e]"
                >
                  再試行
                </button>
              )}
            </span>
            {item.status === "error" ? (
              <button
                type="button"
                onClick={() => {
                  setSubmitWarning(null);
                  setPending((list) => list.filter((p) => p.localId !== item.localId));
                }}
                aria-label="この写真を取り消す"
                className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-paper/90 text-ink-soft"
              >
                <IconClose size={16} />
              </button>
            ) : null}
          </div>
        ))}

        {remaining > 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line-strong bg-card text-ink-faint transition-colors active:bg-paper-deep"
          >
            {uploaded.length === 0 && pending.length === 0 ? <IconCamera size={22} /> : <IconPlus size={22} />}
            <span className="text-[10px]">追加</span>
          </button>
        ) : null}
      </div>

      {pending.some((p) => p.status === "error") ? (
        <p className="mt-2 text-xs text-[#a85c6a]">
          {pending.find((p) => p.status === "error")?.error ?? "アップロードに失敗しました。"}
        </p>
      ) : null}

      {submitWarning ? (
        <p role="alert" className="mt-2 rounded-xl bg-blossom-soft px-3 py-2 text-xs text-[#8f4c59]">
          {submitWarning}
        </p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        multiple={max > 1}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
