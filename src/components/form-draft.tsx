"use client";

import { useEffect } from "react";

type DraftElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function draftFieldKey(element: DraftElement): string {
  // React の制御コンポーネントには name がないものもあるため、id も保存キーに使う。
  return element.name || element.id;
}

function setNativeProperty(element: DraftElement, property: "value" | "checked", value: string | boolean) {
  const prototype = Object.getPrototypeOf(element) as object;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
  if (descriptor?.set) descriptor.set.call(element, value);
  else if (property === "value") element.value = String(value);
  else if (element instanceof HTMLInputElement) element.checked = Boolean(value);
}

function notifyReact(element: DraftElement) {
  // DOM の値だけを変えると、React 側の state が元の値へ戻してしまう。
  // input/change を発火して制御コンポーネント側にも復元値を伝える。
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * 入力途中で画面を閉じても内容が残るように、フォームの値を localStorage に保存する。
 * 送信したタイミングで下書きは破棄する。
 */
export function FormDraft({ formId, storageKey }: { formId: string; storageKey: string }) {
  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    const key = `odekake:draft:${storageKey}`;

    const readDraft = (): Record<string, string> | null => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as Record<string, string>;
      } catch {
        window.localStorage.removeItem(key);
        return null;
      }
    };

    const restore = () => {
      const draft = readDraft();
      if (!draft) return;

      for (const element of form.elements) {
        if (
          !(element instanceof HTMLInputElement) &&
          !(element instanceof HTMLTextAreaElement) &&
          !(element instanceof HTMLSelectElement)
        ) {
          continue;
        }
        if (element.type === "file") continue;
        if (element.type === "hidden" && element.dataset.draft !== "true") continue;

        const fieldKey = draftFieldKey(element);
        if (!fieldKey) continue;
        const saved = draft[fieldKey];
        if (saved === undefined) continue;

        if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
          const checked = saved !== "__unchecked__" && (element.value === saved || saved === "on");
          setNativeProperty(element, "checked", checked);
          if (checked || element.type === "checkbox") notifyReact(element);
          continue;
        }

        setNativeProperty(element, "value", saved);
        notifyReact(element);
      }
    };

    const save = () => {
      const draft: Record<string, string> = {};
      for (const element of form.elements) {
        if (
          !(element instanceof HTMLInputElement) &&
          !(element instanceof HTMLTextAreaElement) &&
          !(element instanceof HTMLSelectElement)
        ) {
          continue;
        }
        if (element.type === "file") continue;
        if (element.type === "hidden" && element.dataset.draft !== "true") continue;

        const fieldKey = draftFieldKey(element);
        if (!fieldKey) continue;

        if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
          if (element.type === "radio") {
            if (element.checked) draft[fieldKey] = element.value;
          } else {
            draft[fieldKey] = element.checked ? element.value || "on" : "__unchecked__";
          }
          continue;
        }

        // 空文字も保存し、以前の入力を削除した状態まで正しく復元する。
        draft[fieldKey] = element.value;
      }
      try {
        window.localStorage.setItem(key, JSON.stringify(draft));
      } catch {
        // 保存できなくても入力は続けられる
      }
    };

    const clear = (event: SubmitEvent) => {
      // 写真アップロード中など、送信が止められた場合は下書きを消さない。
      if (event.defaultPrevented || form.dataset.photoUploadBlocked === "true") return;
      window.localStorage.removeItem(key);
    };

    restore();
    // 都道府県の復元後に市区町村の選択肢が再描画されるため、次フレームでもう一度適用する。
    const frame = window.requestAnimationFrame(restore);
    const timer = window.setTimeout(restore, 80);

    form.addEventListener("input", save);
    form.addEventListener("change", save);
    form.addEventListener("submit", clear);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      form.removeEventListener("input", save);
      form.removeEventListener("change", save);
      form.removeEventListener("submit", clear);
    };
  }, [formId, storageKey]);

  return null;
}
