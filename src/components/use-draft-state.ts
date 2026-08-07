"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * React が値を持つ入力の下書き保存
 * =============================================================
 * `FormDraft` はフォームの DOM を読み書きして下書きを復元するが、
 * hidden input の値を DOM 側から書き換えても、React の state が持っている
 * 値がすぐ上書きしてしまう。場所の指定・評価・写真のように React 側で
 * 値を持っている入力は、この hook でコンポーネント自身に保存させる。
 *
 * 保存先は localStorage。フォームを送信できたら消す
 * （写真の送信待ちなどで送信が止められた場合は残す）。
 */
const PREFIX = "odekake:draft-state:";

export function readDraftState<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export function writeDraftState(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // 保存できなくても入力は続けられる
  }
}

export function clearDraftState(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // 消せなくても操作には影響しない
  }
}

/**
 * 送信が成立したときに下書きを消す。`anchorRef` から親フォームを探す。
 * 写真のアップロード中は送信が止められるため、そのときは消さない。
 */
function useClearDraftOnSubmit(key: string | null, anchorRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!key) return;
    const form = anchorRef.current?.closest("form");
    if (!form) return;

    const clear = (event: Event) => {
      if (event.defaultPrevented || form.dataset.photoUploadBlocked === "true") return;
      clearDraftState(key);
    };

    form.addEventListener("submit", clear);
    return () => form.removeEventListener("submit", clear);
  }, [key, anchorRef]);
}

/**
 * localStorage に保存される useState。`key` が null のときは保存しない
 * （編集フォームなど、下書きを残したくない場面で使う）。
 */
export function useDraftState<T>(
  key: string | null,
  initial: T,
  anchorRef: RefObject<HTMLElement | null>,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial);
  const [restored, setRestored] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!key || started.current) return;
    started.current = true;
    const saved = readDraftState<T>(key);
    if (saved !== null) setValue(saved);
    setRestored(true);
  }, [key]);

  // 復元が終わるまでは書き込まない。初期値で下書きを上書きしてしまうため。
  useEffect(() => {
    if (!key || !restored) return;
    writeDraftState(key, value);
  }, [key, restored, value]);

  useClearDraftOnSubmit(key, anchorRef);

  return [value, setValue];
}
