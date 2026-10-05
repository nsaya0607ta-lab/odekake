/**
 * ショップの「アプリでためす」。買う前に、アプリ全体の背景を一時的に切りかえる。
 * この端末のこの画面のあいだだけ（読みこみ直すと、もとの背景にもどる）。
 */
import { useSyncExternalStore } from "react";
import type { AppBackgroundId } from "@/lib/app-backgrounds";

let current: AppBackgroundId | null = null;
const listeners = new Set<() => void>();

export function setTryOnBackground(id: AppBackgroundId | null) {
  if (current === id) return;
  current = id;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** ためしている背景（ためしていなければ null） */
export function useTryOnBackground(): AppBackgroundId | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
