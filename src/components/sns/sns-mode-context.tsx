"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type SnsMode = "user" | "group";
type SnsModeContextValue = { mode: SnsMode; setMode: (mode: SnsMode) => void };

const SnsModeContext = createContext<SnsModeContextValue | null>(null);

/** ユーザー/グループの表示切替を、ページ遷移せずヘッダーと切替バーの間で共有する */
export function SnsModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SnsMode>("group");
  return <SnsModeContext.Provider value={{ mode, setMode }}>{children}</SnsModeContext.Provider>;
}

export function useSnsMode() {
  const ctx = useContext(SnsModeContext);
  if (!ctx) throw new Error("useSnsMode must be used within SnsModeProvider");
  return ctx;
}
