"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KanjiAction } from "@/lib/games/kakure-kanji/actions";
import { KanjiAccountClient, type AccountState } from "./account-client";

export function useKanjiAccount(userId: string) {
  const [state, setState] = useState<AccountState>({ save: null, busy: true, error: null });
  const client = useRef<KanjiAccountClient | null>(null);
  useEffect(() => {
    let storage: Storage | undefined;
    try { storage = localStorage; } catch { /* サーバー保存だけで続ける */ }
    const account = new KanjiAccountClient(userId, setState, storage);
    client.current = account; setState(account.state);
    void account.initialize();
    return () => { account.dispose(); if (client.current === account) client.current = null; };
  }, [userId]);
  const act = useCallback((action: KanjiAction) => client.current?.act(action) ?? Promise.resolve(null), []);
  const retry = useCallback(() => { void client.current?.retry().then(ok => { if (ok) window.location.reload(); }); }, []);
  return { ...state, act, retry };
}
