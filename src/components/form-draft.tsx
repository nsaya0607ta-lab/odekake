"use client";

import { useEffect } from "react";

/**
 * 入力途中で画面を閉じても内容が残るように、フォームの値を localStorage に保存する。
 * 送信したタイミングで下書きは破棄する。
 */
export function FormDraft({ formId, storageKey }: { formId: string; storageKey: string }) {
  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    const key = `odekake:draft:${storageKey}`;

    const restore = () => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      let draft: Record<string, string>;
      try {
        draft = JSON.parse(raw) as Record<string, string>;
      } catch {
        window.localStorage.removeItem(key);
        return;
      }

      for (const element of form.elements) {
        if (
          !(element instanceof HTMLInputElement) &&
          !(element instanceof HTMLTextAreaElement) &&
          !(element instanceof HTMLSelectElement)
        ) {
          continue;
        }
        if (!element.name || element.type === "file" || element.type === "hidden") continue;
        const saved = draft[element.name];
        if (saved === undefined) continue;

        if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
          if (element.value === saved || (element.type === "checkbox" && saved === "on")) {
            element.checked = true;
          }
          continue;
        }
        // 下書きは入力のたびに保存しているため、そのまま復元してよい
        element.value = saved;
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
        if (!element.name || element.type === "file" || element.type === "hidden") continue;
        if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
          if (element.checked) draft[element.name] = element.value;
          continue;
        }
        if (element.value) draft[element.name] = element.value;
      }
      try {
        window.localStorage.setItem(key, JSON.stringify(draft));
      } catch {
        // 保存できなくても入力は続けられる
      }
    };

    const clear = () => window.localStorage.removeItem(key);

    restore();
    form.addEventListener("input", save);
    form.addEventListener("change", save);
    form.addEventListener("submit", clear);

    return () => {
      form.removeEventListener("input", save);
      form.removeEventListener("change", save);
      form.removeEventListener("submit", clear);
    };
  }, [formId, storageKey]);

  return null;
}
