import { parseSave } from "../games/kakure-kanji/progress";
import type { KanjiSnapshot } from "../games/kakure-kanji/actions";
import { getBlueCoinBalance } from "./blue-coins";
import type { DB } from "./client";

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };
export const kanjiRpc = (db: DB, name: string, args: Record<string, unknown>): PromiseLike<RpcResult> => (db.rpc.bind(db) as unknown as (name: string, args: Record<string, unknown>) => PromiseLike<RpcResult>)(name, args);
export function decodeKanjiSnapshot(value: unknown): KanjiSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!Number.isSafeInteger(v.balance) || Number(v.balance) < 0 || !Number.isSafeInteger(v.revision) || Number(v.revision) < 0) return null;
  const save = v.save === null ? null : parseSave(v.save);
  if (v.save !== null && !save) return null;
  return { save: save ? { ...save, coins: Number(v.balance) } : null, balance: Number(v.balance), revision: Number(v.revision) };
}
export async function getKanjiSnapshot(db: DB, userId: string): Promise<KanjiSnapshot | null> {
  const from = db.from.bind(db) as unknown as (name: string) => { select: (cols: string) => { eq: (col: string, value: string) => { maybeSingle: () => PromiseLike<{ data: { save: unknown; revision: number } | null; error: unknown }> } } };
  const [record, balance] = await Promise.all([from("user_kakure_kanji").select("save,revision").eq("user_id", userId).maybeSingle(), getBlueCoinBalance(db, userId)]);
  return record.error || balance === null ? null : decodeKanjiSnapshot({ save: record.data?.save ?? null, revision: record.data?.revision ?? 0, balance });
}
