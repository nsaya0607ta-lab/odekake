import type { DB } from "./client";

export type WhiteCoinEvent = { id: number; amount: number; label: string; createdAt: string };
type Result = { data: Record<string, unknown>[] | null; error: { code?: string; message: string } | null };
type WhiteQuery = PromiseLike<Result> & { order: (key: string, options: { ascending: boolean }) => { limit: (count: number) => PromiseLike<Result> } };
type WhiteFrom = (table: string) => { select: (columns: string) => { eq: (key: string, value: string) => WhiteQuery } };
const unavailable = new Set(["42P01", "PGRST205"]);
function query(db: DB) { return db.from.bind(db) as unknown as WhiteFrom; }

export async function getWhiteCoinBalance(db: DB, userId: string): Promise<number | null> {
  const { data, error } = await query(db)("user_white_coins").select("balance").eq("user_id", userId);
  if (error) {
    if (!unavailable.has(error.code ?? "")) console.warn("White coin balance unavailable", { code: error.code });
    return null;
  }
  return typeof data?.[0]?.balance === "number" ? data[0].balance : 0;
}
export async function getWhiteCoinEvents(db: DB, userId: string, limit = 20): Promise<WhiteCoinEvent[] | null> {
  const { data, error } = await query(db)("white_coin_events").select("id,amount,metadata,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  if (error) {
    if (!unavailable.has(error.code ?? "")) console.warn("White coin history unavailable", { code: error.code });
    return null;
  }
  return (data ?? []).map(row => {
    const meta = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
    return { id: Number(row.id), amount: Number(row.amount) || 0, label: typeof meta.label === "string" ? meta.label : "白コイン", createdAt: typeof row.created_at === "string" ? row.created_at : "" };
  });
}
