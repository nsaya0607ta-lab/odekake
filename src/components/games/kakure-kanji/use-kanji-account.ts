"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KanjiAction, KanjiResponse, KanjiSnapshot } from "@/lib/games/kakure-kanji/actions";
import { createKeyValueStore, parseSave, type SaveData } from "@/lib/games/kakure-kanji/progress";

type Operation = { userId: string; requestId: string; revision: number; action: KanjiAction };

/** 応答が失われたら同じIDで再送する。確定するまで次の操作を受け付けない。 */
export function useKanjiAccount(userId: string) {
  const [save, setSave] = useState<SaveData | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const snapshot = useRef<KanjiSnapshot | null>(null);
  const pending = useRef<Operation | null>(null);
  const locked = useRef(false);
  const generation = useRef(0);
  const accept = useCallback((next: KanjiSnapshot) => {
    snapshot.current = next; setSave(next.save);
    if (next.save) {
      try { createKeyValueStore(localStorage, `odekake_kakure_kanji_blue_v1:${userId}`).save(next.save); } catch { /* サーバーの保存済み記録を使う */ }
    }
  }, [userId]);
  const send = useCallback(async (operation: Operation): Promise<KanjiResponse | null> => {
    const token = generation.current;
    locked.current = true; setBusy(true); setError(null); pending.current = operation;
    try {
      const response = await fetch("/api/games/kakure-kanji", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(operation), signal: AbortSignal.timeout(20_000) });
      const body = await response.json().catch(() => null);
      if (token !== generation.current) return null;
      if (!body) throw new Error("青コインと記録に接続できませんでした。再試行してください。");
      if (!response.ok) {
        if (response.status < 500) pending.current = null;
        if (body.snapshot) accept(body.snapshot);
        throw new Error(body.error ?? "保存できませんでした。同じ操作を再試行できます。");
      }
      if (!body.snapshot || !parseSave(body.snapshot.save)) throw new Error("保存結果を読み取れませんでした。再試行してください。");
      accept(body.snapshot); pending.current = null;
      return body as KanjiResponse;
    } catch (e) {
      if (token === generation.current) setError(e instanceof Error && !["TypeError", "AbortError", "TimeoutError"].includes(e.name) ? e.message : "通信できませんでした。同じ操作を再試行できます。");
      return null;
    } finally {
      if (token === generation.current) { locked.current = false; setBusy(false); }
    }
  }, [accept]);
  const act = useCallback(async (action: KanjiAction) => {
    if (locked.current || pending.current || !snapshot.current) return null;
    return send({ userId, requestId: crypto.randomUUID(), revision: snapshot.current.revision, action });
  }, [send, userId]);
  const load = useCallback(async () => {
    const token = generation.current;
    locked.current = true; setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/games/kakure-kanji?account=${encodeURIComponent(userId)}`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      const body = await response.json().catch(() => null);
      if (token !== generation.current) return;
      if (!response.ok || !body?.snapshot) throw new Error(body?.error ?? "青コインと記録を読み込めませんでした。");
      accept(body.snapshot);
      if (!body.snapshot.save) {
        let legacy: SaveData | undefined;
        try {
          const owner = localStorage.getItem("odekake_kakure_kanji_legacy_owner");
          if ((!owner || owner === userId) && localStorage.getItem("odekake_kakure_kanji_v1")) {
            legacy = createKeyValueStore(localStorage).load();
            localStorage.setItem("odekake_kakure_kanji_legacy_owner", userId);
          }
        } catch { /* 旧記録がなければ新しく始める */ }
        const initialized = await send({ userId, requestId: crypto.randomUUID(), revision: body.snapshot.revision, action: { type: "initialize", legacy } });
        if (!initialized) return;
      }
      if (token !== generation.current) return;
      // ログインボーナスもサーバーの日付・記録を使い、1日1回だけ受け取る。
      await send({ userId, requestId: crypto.randomUUID(), revision: snapshot.current!.revision, action: { type: "login" } });
    } catch (e) { if (token === generation.current) setError(e instanceof Error ? e.message : "読み込めませんでした。再試行してください。"); }
    finally { if (token === generation.current) { locked.current = false; setBusy(false); } }
  }, [accept, send, userId]);
  useEffect(() => {
    const token = ++generation.current;
    snapshot.current = null; pending.current = null; setSave(null);
    void load();
    return () => { generation.current = token + 1; };
  }, [load]);
  const retry = useCallback(() => {
    if (locked.current) return;
    if (pending.current) void send(pending.current).then(result => { if (result) window.location.reload(); }); else void load();
  }, [load, send]);
  return { save, busy, error, act, retry };
}
