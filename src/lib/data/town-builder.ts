import { decodeTown } from "@/lib/games/town-builder";
import type { TownSnapshot } from "@/lib/games/town-progression";
import type { DB } from "./client";

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };
export function townRpc(db: DB, name: string, args: Record<string, unknown> = {}): PromiseLike<RpcResult> {
  return (db.rpc.bind(db) as unknown as (name: string, args: Record<string, unknown>) => PromiseLike<RpcResult>)(name, args);
}
export function decodeTownSnapshot(value: unknown): TownSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  for (const k of ["balance", "revision", "xp", "maxLevel", "dailySpent"]) if (!Number.isSafeInteger(o[k]) || Number(o[k]) < 0) return null;
  if (!Array.isArray(o.claimedQuests) || !o.claimedQuests.every(v => typeof v === "string") || typeof o.date !== "string") return null;
  const town = o.town === null ? null : decodeTown(JSON.stringify(o.town));
  if (o.town !== null && !town) return null;
  return { town, balance: Number(o.balance), revision: Number(o.revision), xp: Number(o.xp), maxLevel: Number(o.maxLevel), claimedQuests: o.claimedQuests as string[], canUndo: o.canUndo === true, dailyClaimed: o.dailyClaimed === true, dailySpent: Number(o.dailySpent), dailyQuestClaimed: o.dailyQuestClaimed === true, date: o.date };
}
export async function getTownSnapshot(db: DB): Promise<TownSnapshot | null> {
  const { data, error } = await townRpc(db, "get_town_builder");
  if (error) {
    if (!["PGRST202", "42883"].includes(error.code ?? "")) console.warn("Town data unavailable", { code: error.code });
    return null;
  }
  return decodeTownSnapshot(data);
}
